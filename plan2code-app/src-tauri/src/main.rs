// Hide the extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};

use plan2code_app_lib::announce::AnnounceServer;
use plan2code_app_lib::agent_manager::{AgentEvent, AgentManager, AgentState, Sink};
use plan2code_app_lib::agents::{self, AgentKind, PermissionMode};
use plan2code_app_lib::console_supervisor::{app_origin, origin_of, ConsoleSupervisor};
use plan2code_app_lib::context::claude::ClaudeReader;
use plan2code_app_lib::context::codex::CodexReader;
use plan2code_app_lib::context::{self, ContextReader, ContextReading, Meter};
use plan2code_app_lib::node_check;
use plan2code_app_lib::project::{self, ProjectDir};
use plan2code_app_lib::restart_brief;
use plan2code_app_lib::settings;
use plan2code_app_lib::versions;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

type PageChannel = Arc<Mutex<Option<Channel<InvokeResponseBody>>>>;

// The project the app is working on, the console it supervises for it and the
// agent it runs there.
#[derive(Default)]
struct AppState {
    project: Mutex<Option<ProjectDir>>,
    // The agent and model the launcher chose, from its arguments.
    launch: project::LaunchChoice,
    console: Arc<Mutex<Option<ConsoleSupervisor>>>,
    agent: Mutex<Option<Arc<AgentManager>>>,
    // Where the agent's output and state changes go: the page's latest channel.
    page: PageChannel,
    // How much text the running agent has produced and been given, for the meter.
    context: Arc<Mutex<Meter>>,
    // This window's endpoint for pages the agent's `console.mjs open` wants shown here.
    announce: Mutex<Option<AnnounceServer>>,
    // The Node version `main()` found before opening the window (Task 1.7 exits
    // cleanly on anything else, so this is always a passing version once the
    // window exists), and which binary that was, with `resolved_path`'s PATH
    // (Task 9.9): the first-run checklist's Node row names both.
    node_version: Option<String>,
    node_binary: Option<String>,
}

// The operating system and, on Windows, the build number xterm needs for ConPTY.
#[tauri::command]
fn platform_info() -> serde_json::Value {
    let build = if cfg!(windows) { windows_build() } else { None };
    serde_json::json!({ "os": std::env::consts::OS, "windowsBuild": build })
}

// What the launch card offers per agent: whether its CLI is on PATH (else how
// to install it), and whether it takes its own reasoning effort.
#[tauri::command]
fn agent_availability() -> serde_json::Value {
    let entries: Vec<_> = AgentKind::ALL
        .iter()
        .map(|&kind| {
            let at = agents::installed_at(kind);
            serde_json::json!({
                "id": kind.id(),
                "label": kind.label(),
                "installed": at.is_some(),
                // Which binary was used (Task 9.9), when one was found.
                "path": at.map(|p| p.to_string_lossy().into_owned()),
                "installHint": kind.install_hint(),
                "hasEffort": kind.has_effort(),
            })
        })
        .collect();
    serde_json::json!(entries)
}

// `cmd /c ver` prints e.g. `Microsoft Windows [Version 10.0.26300.1234]`.
fn windows_build() -> Option<u32> {
    let out = std::process::Command::new("cmd").args(["/c", "ver"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let version = text.split("Version ").nth(1)?;
    version.split('.').nth(2)?.trim().parse().ok()
}

// Sends the agent's output as raw bytes and its state changes as JSON, on the
// page's latest channel. Nothing is sent while no page has registered one.
// The meter sees every output and state change too, page or no page.
fn page_sink(page: PageChannel, meter: Arc<Mutex<Meter>>) -> Sink {
    Arc::new(move |event| {
        if let Ok(mut meter) = meter.lock() {
            match &event {
                AgentEvent::Output(bytes) => meter.add_output(bytes),
                AgentEvent::State(snapshot) => {
                    let running = snapshot.state == AgentState::Running;
                    meter.observe(snapshot.generation, running);
                    meter.set_kind(snapshot.kind);
                }
            }
        }
        let Ok(guard) = page.lock() else { return };
        let Some(channel) = guard.as_ref() else { return };
        let body = match event {
            AgentEvent::Output(bytes) => InvokeResponseBody::Raw(bytes),
            AgentEvent::State(snapshot) => match serde_json::to_string(&snapshot) {
                Ok(json) => InvokeResponseBody::Json(json),
                Err(_) => return,
            },
        };
        let _ = channel.send(body);
    })
}

// The manager for the current project, made on first use. A manager for a
// different folder replaces an idle one.
fn agent_for_project(state: &AppState) -> Result<Arc<AgentManager>, String> {
    let dir = {
        let project = state.project.lock().map_err(|e| e.to_string())?;
        project.as_ref().map(|p| p.dir.clone()).ok_or("no project folder chosen")?
    };
    let mut guard = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(agent) = guard.as_ref() {
        // Only the same folder's manager is reused: an active agent for a
        // folder the project has since moved away from must not be handed
        // back as if it belonged to the new one.
        if agent.folder() == &dir {
            return Ok(Arc::clone(agent));
        }
    }
    let sink = page_sink(Arc::clone(&state.page), Arc::clone(&state.context));
    let agent = Arc::new(AgentManager::new(dir, sink));
    // A Restart leaves the brief for the dashboard, from the console that is running now.
    let console = Arc::clone(&state.console);
    agent.set_before_fresh(Arc::new(move || {
        let sid = console.lock().ok()?.as_ref()?.session().sid.clone();
        restart_brief::note_for_restart(&sid)
    }));
    *guard = Some(Arc::clone(&agent));
    Ok(agent)
}

fn current_agent(state: &AppState) -> Option<Arc<AgentManager>> {
    state.agent.lock().ok().and_then(|guard| guard.clone())
}

// The origin the app page has, which the console must allow as its frame
// parent. In a release build that is a constant, but `tauri dev` serves the
// page from a loopback dev server, so the window is asked for its real URL.
fn window_origin(app: &tauri::AppHandle) -> String {
    app.get_webview_window("main")
        .and_then(|window| window.url().ok())
        .and_then(|url| origin_of(url.as_str()))
        .unwrap_or_else(|| app_origin().to_string())
}

// Gives the agent the in-app signal: this window's announce endpoint and the
// origin its console must allow. The agent's own `open` then shows its pages
// here (it asks the window which session is current). Without an endpoint the
// agent gets nothing and opens pages the plain way.
fn sync_agent_env(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let Some(agent) = current_agent(&state) else { return };
    let env = match state.announce.lock().ok() {
        Some(guard) => guard
            .as_ref()
            .map(|server| server.agent_env(&window_origin(app), &app.package_info().version.to_string()))
            .unwrap_or_default(),
        None => Vec::new(),
    };
    agent.set_env(env);
}

#[tauri::command]
fn agent_start(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    kind: String,
    model: Option<String>,
    effort: Option<String>,
    mode: String,
    cols: u16,
    rows: u16,
    on_output: Channel<InvokeResponseBody>,
) -> Result<(), String> {
    let kind = AgentKind::from_id(&kind).ok_or_else(|| format!("unknown agent: {kind}"))?;
    let mode = PermissionMode::from_id(&mode).ok_or_else(|| format!("unknown permission mode: {mode}"))?;
    *state.page.lock().map_err(|e| e.to_string())? = Some(on_output);
    let agent = agent_for_project(&state)?;
    agent.resize(cols, rows)?;
    sync_agent_env(&app);
    agent.start(kind, model, effort, mode, None)?;
    // A settings file that cannot be written must not stop the agent.
    if let Some(file) = settings::settings_file() {
        let _ = settings::save_last_agent(&file, kind);
    }
    Ok(())
}

#[tauri::command]
fn agent_input(state: State<'_, AppState>, data: String) -> Result<(), String> {
    if let Ok(mut meter) = state.context.lock() {
        meter.add(data.len());
    }
    match current_agent(&state) {
        Some(agent) => agent.input(data.as_bytes()),
        None => Ok(()),
    }
}

#[tauri::command]
fn agent_resize(state: State<'_, AppState>, cols: u16, rows: u16) -> Result<(), String> {
    match current_agent(&state) {
        Some(agent) => agent.resize(cols, rows),
        None => Ok(()),
    }
}

#[tauri::command]
fn agent_restart(state: State<'_, AppState>) -> Result<(), String> {
    current_agent(&state).ok_or("no agent has been started")?.restart()
}

#[tauri::command]
fn agent_state(state: State<'_, AppState>) -> serde_json::Value {
    match current_agent(&state) {
        Some(agent) => serde_json::to_value(agent.snapshot()).unwrap_or_default(),
        None => idle_snapshot_json(),
    }
}

fn idle_snapshot_json() -> serde_json::Value {
    serde_json::json!({ "state": "idle", "kind": null, "mode": null, "generation": 0 })
}

/// A page that just mounted (a reload, or this window's first paint while an
/// agent survived it) registers its output channel here instead of through
/// `agent_start`, which would try to start a second agent. Replays the
/// current generation's recent output on it at once, so the terminal does
/// not come up blank, and returns the same shape `agent_state` does.
#[tauri::command]
fn agent_reattach(state: State<'_, AppState>, on_output: Channel<InvokeResponseBody>) -> Result<serde_json::Value, String> {
    let agent = current_agent(&state);
    *state.page.lock().map_err(|e| e.to_string())? = Some(on_output.clone());
    if let Some(agent) = &agent {
        let replay = agent.replay();
        if !replay.is_empty() {
            let _ = on_output.send(InvokeResponseBody::Raw(replay));
        }
    }
    Ok(match &agent {
        Some(agent) => serde_json::to_value(agent.snapshot()).unwrap_or_default(),
        None => idle_snapshot_json(),
    })
}

// The bar's meter, polled at most every two seconds: how full the running
// agent's context looks, labeled by how it was read.
#[tauri::command]
fn agent_context(state: State<'_, AppState>) -> serde_json::Value {
    let (estimate, kind, since) = match state.context.lock() {
        Ok(meter) => (meter.read(), meter.kind(), meter.since()),
        Err(_) => (ContextReading::Unknown, None, None),
    };
    let agent = current_agent(&state);
    let model = agent.as_ref().and_then(|agent| agent.model_and_effort().0);
    // Claude's own transcript, or Codex's own log, is read when there is one;
    // an unknown reading from either falls back to the labeled estimate.
    // Nothing is read while no agent runs.
    let reading = match (estimate, kind, agent, since) {
        (ContextReading::Unknown, _, _, _) => ContextReading::Unknown,
        (_, Some(AgentKind::Claude), Some(agent), Some(since)) => {
            // `window_for` always has a window for Claude; the fallback here only
            // guards against a future change to that rule.
            let window = context::window_for(kind, model.as_deref()).unwrap_or(context::ESTIMATE_TOKEN_WINDOW);
            let claude = ClaudeReader { projects_dir: claude_projects_dir(), folder: agent.folder().clone(), since, window };
            match claude.read() {
                ContextReading::Unknown => estimate,
                read => read,
            }
        }
        (_, Some(AgentKind::Codex), Some(agent), Some(since)) => {
            let codex = CodexReader {
                sessions_dir: codex_sessions_dir(),
                folder: agent.folder().clone(),
                since,
            };
            match codex.read() {
                ContextReading::Unknown => estimate,
                read => read,
            }
        }
        _ => estimate,
    };
    serde_json::to_value(reading).unwrap_or_default()
}

// Claude Code's transcripts folder: `CLAUDE_CONFIG_DIR` when it is set, else `~/.claude`.
fn claude_projects_dir() -> std::path::PathBuf {
    let home = std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::home_dir().map(|home| home.join(".claude")))
        .unwrap_or_default();
    home.join("projects")
}

// Codex's sessions folder: `CODEX_HOME` when it is set, else `~/.codex`.
fn codex_sessions_dir() -> std::path::PathBuf {
    let home = std::env::var_os("CODEX_HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::home_dir().map(|home| home.join(".codex")))
        .unwrap_or_default();
    home.join("sessions")
}

// Asks before quitting while an agent runs; "no" keeps the app open.
fn confirm_quit(app: &tauri::AppHandle) {
    let app = app.clone();
    app.dialog()
        .message("An agent is still running. Quit and stop it?")
        .title("Quit Plan2Code")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::YesNo)
        .show({
            let app = app.clone();
            move |quit| {
                if quit {
                    quit_app(&app);
                }
            }
        });
}

fn agent_is_active(app: &tauri::AppHandle) -> bool {
    current_agent(&app.state::<AppState>()).is_some_and(|agent| agent.is_active())
}

// Stops the agent, then the console, then exits.
fn quit_app(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    if let Some(agent) = current_agent(&state) {
        agent.stop();
    }
    if let Ok(mut guard) = state.console.lock() {
        if let Some(mut console) = guard.take() {
            let _ = console.stop();
        }
    }
    app.exit(0);
}

/// What the page draws its bar from: the folder (or that none is chosen yet)
/// and the agent the picker starts on.
#[tauri::command]
fn app_state(state: State<'_, AppState>) -> serde_json::Value {
    let project = state.project.lock().ok().and_then(|p| p.clone());
    let settings_file = settings::settings_file();
    // The agent picked in the launcher starts the bar's picker, ahead of the app's own last one.
    let last_agent = state
        .launch
        .agent
        .or_else(|| settings_file.as_ref().and_then(|file| settings::load_last_agent(file)))
        .or_else(project::remembered_agent);
    let nudge = settings_file
        .as_ref()
        .map_or(settings::DEFAULT_NUDGE_PERCENT, |file| settings::load_nudge_percent(file));
    let term_panel = settings_file.as_ref().map_or(
        settings::TermPanelSettings {
            dock: settings::DEFAULT_TERM_DOCK.to_string(),
            fraction: settings::DEFAULT_TERM_FRACTION,
            collapsed: false,
        },
        |file| settings::load_term_panel(file),
    );
    let first_run_done = settings_file.as_ref().is_some_and(|file| settings::load_first_run_done(file));
    serde_json::json!({
        "projectDir": project.as_ref().map(|p| p.dir.to_string_lossy().into_owned()),
        "projectDirSource": project.as_ref().map(|p| p.source),
        "lastAgent": last_agent.map(|kind| kind.id()),
        "launchModel": state.launch.model,
        "contextNudgePercent": nudge,
        // Task 1.7 already exits before the window opens on a missing or too-old
        // Node, so this is always a pass; the checklist's Node row just names it.
        "nodeVersion": state.node_version,
        "nodeBinary": state.node_binary,
        "skillsVersion": versions::installed_skills_version(),
        "firstRunDone": first_run_done,
        // The launcher always passes `--project` alongside `--agent`, so an
        // explicit `--agent` means skip straight to starting it, no checklist
        // or launch card shown.
        "autoStart": state.launch.agent.map(|kind| kind.id()),
        "termPanel": term_panel,
    })
}

/// The terminal pane's toolbar remembers its shape here: dock side, size and
/// whether it was left collapsed. A settings file that cannot be written is
/// reported to the caller; the pane itself keeps working either way.
#[tauri::command]
fn save_term_panel(dock: String, fraction: f64, collapsed: bool) -> Result<(), String> {
    let file = settings::settings_file().ok_or("no home folder found")?;
    settings::save_term_panel(&file, &dock, fraction, collapsed)
}

/// The first-run checklist passed once: later launches go straight to the
/// launch card (Task 9.4).
#[tauri::command]
fn save_first_run_done() -> Result<(), String> {
    let file = settings::settings_file().ok_or("no home folder found")?;
    settings::save_first_run_done(&file)
}

/// The app's version (`tauri.conf.json`'s, which Tauri puts in the package info) beside the
/// installed skills' version. The bar shows its Update line when they differ (FR-14).
#[tauri::command]
fn version_status(app: tauri::AppHandle) -> versions::VersionStatus {
    versions::status(&app.package_info().version.to_string(), versions::installed_skills_version())
}

/// What `update_skills` resolves with: the installer's last line, and the version status
/// re-read afterwards, so the bar can say plainly whether the mismatch is actually gone.
#[derive(serde::Serialize)]
struct UpdateOutcome {
    message: String,
    status: versions::VersionStatus,
}

/// Run the existing installer's update, pinned to this app's own release tag. Only the bar's
/// button asks for it: never silently. `progress` carries each line of the installer's own
/// output live, for the bar to show while it runs.
#[tauri::command]
async fn update_skills(app: tauri::AppHandle, progress: Channel<String>) -> Result<UpdateOutcome, String> {
    let version = app.package_info().version.to_string();
    let message = tauri::async_runtime::spawn_blocking(move || {
        versions::run_update(&version, |line| {
            let _ = progress.send(line.to_string());
        })
    })
    .await
    .map_err(|e| e.to_string())??;
    let status = versions::status(&app.package_info().version.to_string(), versions::installed_skills_version());
    Ok(UpdateOutcome { message, status })
}

/// The OS folder picker, shown when no folder is known; a choice becomes the
/// launcher's remembered folder.
#[tauri::command]
fn pick_project_folder(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|p| p.as_path().map(|dir| dir.to_path_buf()));
    let Some(dir) = picked else {
        return Ok(None);
    };
    let choice = project::remember_folder(&dir)?;
    let text = choice.dir.to_string_lossy().into_owned();
    *state.project.lock().map_err(|e| e.to_string())? = Some(choice);
    Ok(Some(text))
}

/// Stops the old project's agent and console and clears both from state, so
/// neither `agent_for_project` nor `console_start` can hand either back once
/// the project has moved on (Task 9.5). The old agent's `Idle` state still
/// reaches the page's current channel here; only after that does this take
/// the channel away.
fn teardown_project(state: &AppState) -> Result<(), String> {
    if let Some(agent) = current_agent(state) {
        agent.stop();
    }
    *state.agent.lock().map_err(|e| e.to_string())? = None;
    *state.page.lock().map_err(|e| e.to_string())? = None;
    if let Ok(mut guard) = state.console.lock() {
        if let Some(mut sup) = guard.take() {
            let _ = sup.stop();
        }
    }
    Ok(())
}

/// Switch to a different project folder, picked fresh: a clean teardown of
/// the old one (its agent stopped, its console stopped) before the new
/// folder is remembered, so `agent_for_project` and `console_start` start
/// fresh for it rather than reusing anything from the one just left. Picking
/// nothing (cancelled) leaves the current project untouched. One project per
/// window stays; this replaces it, it does not add a second.
#[tauri::command]
fn change_project(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|p| p.as_path().map(|dir| dir.to_path_buf()));
    let Some(dir) = picked else {
        return Ok(None);
    };

    teardown_project(&state)?;

    let choice = project::remember_folder(&dir)?;
    let text = choice.dir.to_string_lossy().into_owned();
    *state.project.lock().map_err(|e| e.to_string())? = Some(choice);
    Ok(Some(text))
}

/// The console the agent opened, alive and as it is now, or restarted on the
    /// same session when it died. The app never starts a dashboard of its own:
/// the agent does, by running the skill, and announces it. Nothing to show yet
/// is an error the page words for the person.
#[tauri::command]
fn console_start(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    console_start_impl(&state)
}

fn console_start_impl(state: &AppState) -> Result<serde_json::Value, String> {
    let mut guard = state.console.lock().map_err(|e| e.to_string())?;
    let sup = guard.as_mut().ok_or("The agent has not opened the dashboard yet.")?;
    if !sup.health() {
        sup.restart_if_dead()?;
    }
    serde_json::to_value(sup.session()).map_err(|e| e.to_string())
}

/// The bar's poll: none (never started or stopped on purpose), running, or
/// dead (started but not answering).
#[tauri::command]
fn console_status(state: State<'_, AppState>) -> serde_json::Value {
    let Ok(guard) = state.console.lock() else {
        return serde_json::json!({ "state": "none", "url": null });
    };
    match guard.as_ref() {
        Some(sup) if sup.stopped() => serde_json::json!({ "state": "none", "url": null }),
        Some(sup) if sup.health() => serde_json::json!({ "state": "running", "url": sup.session().url }),
        Some(sup) => serde_json::json!({ "state": "dead", "url": sup.session().url }),
        None => serde_json::json!({ "state": "none", "url": null }),
    }
}

#[tauri::command]
fn console_stop(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.console.lock().map_err(|e| e.to_string())?;
    if let Some(mut sup) = guard.take() {
        sup.stop()?;
    }
    Ok(())
}

fn main() {
    // Without Node 18+ the console and skills cannot run: say so and stop (FR-13).
    let status = node_check::check_node();
    let node_problem = node_check::problem_message(&status);
    let node_version = match &status {
        node_check::NodeStatus::Ok(version) => Some(version.clone()),
        _ => None,
    };
    let node_binary = node_version.as_ref().and_then(|_| node_check::node_binary_path());

    let args = std::env::args().collect::<Vec<_>>();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            project: Mutex::new(project::resolve(&args)),
            launch: project::launch_choice(&args),
            node_version,
            node_binary,
            ..AppState::default()
        })
        .invoke_handler(tauri::generate_handler![
            platform_info,
            agent_availability,
            agent_start,
            agent_input,
            agent_resize,
            agent_restart,
            agent_state,
            agent_reattach,
            agent_context,
            app_state,
            save_term_panel,
            save_first_run_done,
            version_status,
            update_skills,
            pick_project_folder,
            change_project,
            console_start,
            console_status,
            console_stop
        ])
        .on_window_event(|window, event| {
            // Closing with an agent running asks first; "no" keeps the window open.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle().clone();
                if agent_is_active(&app) {
                    api.prevent_close();
                    confirm_quit(&app);
                }
            }
        })
        .setup(move |app| {
            // Pages the agent's `open` announces: the supervisor and the agent's
            // environment follow the console, and the page frame shows it.
            let handle = app.handle().clone();
            let server = AnnounceServer::start(Arc::new(move |notice| {
                let state = handle.state::<AppState>();
                if let Ok(mut guard) = state.console.lock() {
                    match guard.as_mut() {
                        Some(sup) => sup.follow(&notice.url, &notice.sid),
                        // The agent started the console: the app owns its stop from here.
                        None => {
                            let dir = state.project.lock().ok().and_then(|p| p.as_ref().map(|p| p.dir.clone()));
                            if let Some(dir) = dir {
                                if let Ok(sup) =
                                    ConsoleSupervisor::adopt(dir, window_origin(&handle), &notice.url, &notice.sid)
                                {
                                    *guard = Some(sup);
                                }
                            }
                        }
                    }
                }
                let _ = handle.emit("console-page", &notice);
            }));
            match server {
                Ok(server) => {
                    if let Ok(mut slot) = app.state::<AppState>().announce.lock() {
                        *slot = Some(server);
                    }
                }
                // Without it the agent opens pages the plain way; nothing else breaks.
                Err(error) => eprintln!("plan2code: no announce endpoint: {error}"),
            }
            if let Some(message) = &node_problem {
                app.dialog()
                    .message(message)
                    .title("Plan2Code needs Node.js")
                    .kind(MessageDialogKind::Error)
                    .blocking_show();
                std::process::exit(1);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Plan2Code app")
        .run(|app, event| {
            // Cmd+Q and the app menu's Quit on macOS end the app without closing the
            // window first. An exit asked for in code (`code` is set) is `quit_app`'s own.
            if let tauri::RunEvent::ExitRequested { api, code: None, .. } = event {
                if agent_is_active(app) {
                    api.prevent_exit();
                    confirm_quit(app);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn state_for(dir: &str) -> AppState {
        AppState {
            project: Mutex::new(Some(ProjectDir { dir: PathBuf::from(dir), source: project::ProjectSource::Picked })),
            ..AppState::default()
        }
    }

    // Covers the folder-matching rule itself (Task 9.5's fix); a genuinely
    // *active* agent for the old folder needs a real spawned process to
    // prove against, which only the `tests/agent_manager.rs` harness (the
    // fake agent) can build — out of reach for an inline test here. The
    // by-hand "Change project" check (RELEASE-CHECKLIST.md) covers that case.
    #[test]
    fn a_different_folder_never_gets_the_old_manager_back() {
        let state = state_for("project-a");
        let first = agent_for_project(&state).expect("a manager for project-a");
        assert_eq!(first.folder(), &PathBuf::from("project-a"));

        // The project moved on; the slot still holds project-a's manager
        // until a fresh call replaces it.
        *state.project.lock().unwrap() = Some(ProjectDir { dir: PathBuf::from("project-b"), source: project::ProjectSource::Picked });
        let second = agent_for_project(&state).expect("a manager for project-b");
        assert_eq!(second.folder(), &PathBuf::from("project-b"));
        assert!(!Arc::ptr_eq(&first, &second), "project-a's manager must never stand in for project-b's");
    }

    #[test]
    fn the_same_folder_reuses_the_same_manager() {
        let state = state_for("project-a");
        let first = agent_for_project(&state).unwrap();
        let second = agent_for_project(&state).unwrap();
        assert!(Arc::ptr_eq(&first, &second), "the same folder should not make a second manager");
    }

    fn have_node() -> bool {
        std::process::Command::new("node").arg("--version").output().map(|o| o.status.success()).unwrap_or(false)
    }

    /// A real console, the same way `tests/console_supervisor.rs` sets one
    /// up: `PLAN2CODE_CONSOLE_DIR` points at the repo's own console source,
    /// `PLAN2CODE_CONSOLE_HOME` keeps its session files out of the real one.
    fn real_console() -> Option<plan2code_app_lib::console_supervisor::ConsoleSupervisor> {
        if !have_node() {
            eprintln!("skipping: node is not on PATH");
            return None;
        }
        let console_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../src/web-console");
        if !console_dir.join("console.mjs").is_file() {
            eprintln!("skipping: console source missing at {}", console_dir.display());
            return None;
        }
        let pid = std::process::id();
        let project = std::env::temp_dir().join(format!("p2c-main-test-project-{pid}"));
        std::fs::create_dir_all(&project).unwrap();
        std::env::set_var("PLAN2CODE_CONSOLE_DIR", &console_dir);
        std::env::set_var("PLAN2CODE_CONSOLE_HOME", std::env::temp_dir().join(format!("p2c-main-test-home-{pid}")));
        std::env::set_var("PLAN2CODE_NO_BROWSER", "1");
        Some(
            plan2code_app_lib::console_supervisor::ConsoleSupervisor::start(
                project,
                plan2code_app_lib::console_supervisor::app_origin().to_string(),
            )
            .expect("start a real console for the test"),
        )
    }

    #[test]
    fn teardown_clears_the_console_so_console_start_refuses_not_reconnects() {
        let Some(sup) = real_console() else { return };
        let state = state_for("project-a");
        *state.console.lock().unwrap() = Some(sup);
        assert!(console_start_impl(&state).is_ok(), "console_start should work before the project changes");

        teardown_project(&state).unwrap();

        let err = console_start_impl(&state).expect_err("console_start must refuse, not reconnect to the old session");
        assert!(err.contains("has not opened the dashboard"), "unexpected message: {err:?}");
    }
}
