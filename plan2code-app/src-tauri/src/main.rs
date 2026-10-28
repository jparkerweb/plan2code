// Hide the extra console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use plan2code_app_lib::agent_manager::{AgentEvent, AgentManager, AgentState, BeforeFresh, Sink};
use plan2code_app_lib::agents::{self, Agent, AgentKind, PermissionMode};
use plan2code_app_lib::announce::{AnnounceServer, PageNotice};
use plan2code_app_lib::attention::{self, Badge, Signal};
use plan2code_app_lib::console_supervisor::{
    app_origin, origin_of, session_on_disk, ConsoleSupervisor,
};
use plan2code_app_lib::node_check;
use plan2code_app_lib::project::{self, ProjectDir};
use plan2code_app_lib::quit_prompt::{quit_prompt, QuitCase};
use plan2code_app_lib::restart_brief;
use plan2code_app_lib::settings;
#[cfg(windows)]
use plan2code_app_lib::task_dialog;
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
    // This window's endpoint for pages the agent's `console.mjs open` wants shown here.
    announce: Arc<Mutex<Option<AnnounceServer>>>,
    // The Node version `main()` found before opening the window (Task 1.7 exits
    // cleanly on anything else, so this is always a passing version once the
    // window exists), and which binary that was, with `resolved_path`'s PATH
    // (Task 9.9): the first-run checklist's Node row names both.
    node_version: Option<String>,
    node_binary: Option<String>,
    // What the taskbar entry last said, and whether it may say anything.
    attention: Mutex<AttentionState>,
    // The app itself, once it is set up: the agent's sink clears the taskbar
    // through it when the agent ends.
    app: Arc<OnceLock<tauri::AppHandle>>,
}

// The console page's last state as the taskbar shows it (attention.rs), and
// the Desktop app switch, `taskbarSignal` in app.json.
struct AttentionState {
    last: Option<Signal>,
    enabled: bool,
}

impl Default for AttentionState {
    fn default() -> Self {
        AttentionState {
            last: None,
            enabled: true,
        }
    }
}

// The operating system and, on Windows, the build number xterm needs for ConPTY.
#[tauri::command]
fn platform_info() -> serde_json::Value {
    let build = if cfg!(windows) { windows_build() } else { None };
    serde_json::json!({ "os": std::env::consts::OS, "windowsBuild": build })
}

// What the launch card offers per agent: whether its CLI is on PATH (else how
// to install it), and whether it takes its own reasoning effort; plus the
// warnings about agents.json.
#[tauri::command]
fn agent_availability(refresh: Option<bool>) -> serde_json::Value {
    // "Check again" also works the PATH out again, so a CLI whose installer
    // added a new folder to it is found without restarting the app.
    if refresh == Some(true) {
        node_check::refresh_path();
    }
    // Built-ins first, then the custom agents, read afresh on every call so
    // "Check again" sees a change to agents.json.
    let mut entries: Vec<_> = AgentKind::ALL
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
                "installUrl": kind.install_url(),
                "hasEffort": kind.has_effort(),
                "custom": false,
                "models": null,
            })
        })
        .collect();
    let (customs, warnings) = agents::custom_agents();
    for custom in customs {
        let at = Agent::Custom(custom.clone()).installed_at();
        entries.push(serde_json::json!({
            "id": custom.id,
            "label": custom.name,
            "installed": at.is_some(),
            "path": at.map(|p| p.to_string_lossy().into_owned()),
            "installHint": null,
            "installUrl": null,
            "hasEffort": false,
            "custom": true,
            "models": custom.models,
        }));
    }
    // What was skipped in agents.json, so a custom agent that vanished from
    // the picker is explained, as the launcher and the console do.
    serde_json::json!({ "agents": entries, "warnings": warnings })
}

// Opens a built-in agent install page in the default browser. Any other id
// is an error: the page never names the link itself.
#[tauri::command]
fn open_install_page(id: String) -> Result<(), String> {
    let url = agents::install_page_url(&id)?;
    // The same switches as the console open-link.mjs.
    if std::env::var_os("NO_BROWSER").is_some_and(|v| !v.is_empty())
        || std::env::var_os("PLAN2CODE_NO_BROWSER").is_some_and(|v| !v.is_empty())
    {
        return Ok(());
    }
    let mut command = if cfg!(windows) {
        let mut c = std::process::Command::new("rundll32.exe");
        c.args(["url.dll,FileProtocolHandler", url]);
        c
    } else if cfg!(target_os = "macos") {
        let mut c = std::process::Command::new("open");
        c.arg(url);
        c
    } else {
        let browser = std::env::var("BROWSER")
            .ok()
            .filter(|b| !b.is_empty())
            .unwrap_or_else(|| "xdg-open".to_string());
        let mut c = std::process::Command::new(browser);
        c.arg(url);
        c
    };
    command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("could not open {url}: {e}"))
}

// `cmd /c ver` prints e.g. `Microsoft Windows [Version 10.0.26300.1234]`.
fn windows_build() -> Option<u32> {
    let out = std::process::Command::new("cmd")
        .args(["/c", "ver"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let version = text.split("Version ").nth(1)?;
    version.split('.').nth(2)?.trim().parse().ok()
}

// Sends the agent's output as raw bytes and its state changes as JSON, on the
// page's latest channel. Nothing is sent while no page has registered one. An
// agent that ends takes the taskbar's dot with it, page or no page.
fn page_sink(page: PageChannel, app: Arc<OnceLock<tauri::AppHandle>>) -> Sink {
    Arc::new(move |event| {
        if let AgentEvent::State(snapshot) = &event {
            if let (AgentState::Ended { .. }, Some(app)) = (&snapshot.state, app.get()) {
                clear_attention(app);
            }
        }
        let Ok(guard) = page.lock() else { return };
        let Some(channel) = guard.as_ref() else {
            return;
        };
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
        project
            .as_ref()
            .map(|p| p.dir.clone())
            .ok_or("no project folder chosen")?
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
    let sink = page_sink(Arc::clone(&state.page), Arc::clone(&state.app));
    let agent = Arc::new(AgentManager::new(dir, sink));
    agent.set_before_fresh(before_fresh_hook(state));
    *guard = Some(Arc::clone(&agent));
    Ok(agent)
}

// What New Session does before the fresh agent starts. It leaves the brief for
// the dashboard, from the console session running now, then forgets that
// session, so the fresh agent's `open` starts one of its own: a session that
// joined the old one would carry its meter along, still red after the very
// press the red meter asks for. The old console is left to shut itself down
// once the frame moves on to the new page.
fn before_fresh_hook(state: &AppState) -> BeforeFresh {
    let console = Arc::clone(&state.console);
    let announce = Arc::clone(&state.announce);
    Arc::new(move || {
        let sid = console
            .lock()
            .ok()
            .and_then(|guard| guard.as_ref().map(|sup| sup.session().sid.clone()));
        let note = sid.and_then(|sid| restart_brief::note_for_restart(&sid));
        if let Ok(guard) = announce.lock() {
            if let Some(server) = guard.as_ref() {
                server.forget_current();
            }
        }
        note
    })
}

fn current_agent(state: &AppState) -> Option<Arc<AgentManager>> {
    state.agent.lock().ok().and_then(|guard| guard.clone())
}

// The origin the app page has, which the console must allow as its frame
// parent. In a release build that is a constant, but `tauri dev` serves the
// page from a loopback dev server, so the window is asked for its real URL.
/// A page the agent's `open` announced: the supervisor follows it, or adopts
/// it when the agent started the console (the app owns its stop from there).
/// Says whether the window should show it. A session outside this app's
/// console store is refused: `cargo test` run by the agent inside the app
/// once announced a test's throwaway console, the window followed it, and
/// when the test shut it down the reconnect opened an empty dashboard, so the
/// build's own page was never seen again.
fn take_announced(
    state: &AppState,
    notice: &PageNotice,
    origin: String,
    on_disk: impl Fn(&str) -> bool,
) -> bool {
    if !on_disk(&notice.sid) {
        return false;
    }
    if let Ok(mut guard) = state.console.lock() {
        match guard.as_mut() {
            Some(sup) => sup.follow(&notice.url, &notice.sid),
            None => {
                let dir = state
                    .project
                    .lock()
                    .ok()
                    .and_then(|p| p.as_ref().map(|p| p.dir.clone()));
                if let Some(dir) = dir {
                    if let Ok(sup) = ConsoleSupervisor::adopt(dir, origin, &notice.url, &notice.sid)
                    {
                        *guard = Some(sup);
                    }
                }
            }
        }
    }
    true
}

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
    let Some(agent) = current_agent(&state) else {
        return;
    };
    let env = match state.announce.lock().ok() {
        Some(guard) => guard
            .as_ref()
            .map(|server| {
                server.agent_env(&window_origin(app), &app.package_info().version.to_string())
            })
            .unwrap_or_default(),
        None => Vec::new(),
    };
    agent.set_env(env);
}

// `on_output` is deliberately not a parameter here: `agent_reattach` already
// registered `state.page` when the page mounted (`main()` on the frontend
// calls it before this), and that registration must stay the only one. Every
// Channel argument Tauri deserializes for an invoke is a fresh wrapper around
// the same frontend id; dropping one (as happened here when it replaced the
// reattach registration) sends the frontend an "end" message that
// unregisters that id for good, breaking all future sends through it.
#[tauri::command]
#[allow(clippy::too_many_arguments)] // one argument per key the frontend passes to invoke
fn agent_start(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    kind: String,
    model: Option<String>,
    effort: Option<String>,
    mode: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let kind = agents::find_agent(&kind).ok_or_else(|| format!("unknown agent: {kind}"))?;
    let mode =
        PermissionMode::from_id(&mode).ok_or_else(|| format!("unknown permission mode: {mode}"))?;
    let agent = agent_for_project(&state)?;
    agent.resize(cols, rows)?;
    sync_agent_env(&app);
    agent.start(kind.clone(), model, effort, mode, None)?;
    // A settings file that cannot be written must not stop the agent.
    if let Some(file) = settings::settings_file() {
        let _ = settings::save_last_agent(&file, kind.id());
    }
    Ok(())
}

#[tauri::command]
fn agent_input(state: State<'_, AppState>, data: String) -> Result<(), String> {
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
    current_agent(&state)
        .ok_or("no agent has been started")?
        .restart()
}

fn idle_snapshot_json() -> serde_json::Value {
    serde_json::json!({ "state": "idle", "kind": null, "mode": null, "generation": 0 })
}

/// A page that just mounted (a reload, or this window's first paint while an
/// agent survived it) registers its output channel here instead of through
/// `agent_start`, which would try to start a second agent. Replays the
/// current generation's recent output on it at once, so the terminal does
/// not come up blank.
#[tauri::command]
fn agent_reattach(
    state: State<'_, AppState>,
    on_output: Channel<InvokeResponseBody>,
) -> Result<serde_json::Value, String> {
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

// Set while a quit box is open, so a second close or quit does not stack another.
static QUIT_OPEN: AtomicBool = AtomicBool::new(false);

// Clears QUIT_OPEN when the box closes, however its handler ends.
struct QuitOpen;

impl Drop for QuitOpen {
    fn drop(&mut self) {
        QUIT_OPEN.store(false, Ordering::SeqCst);
    }
}

// Asks before quitting while an agent runs; anything but Quit keeps the app
// open. The words follow whose turn the page last reported (quit_prompt.rs).
fn confirm_quit(app: &tauri::AppHandle) {
    if QUIT_OPEN.swap(true, Ordering::SeqCst) {
        return;
    }
    let open = QuitOpen;
    let last = app
        .state::<AppState>()
        .attention
        .lock()
        .ok()
        .and_then(|guard| guard.last);
    let prompt = quit_prompt(last);
    #[cfg(windows)]
    {
        if let Some(parent) = app
            .get_webview_window("main")
            .and_then(|window| window.hwnd().ok())
        {
            // TaskDialog blocks until it closes, so it runs off the event loop.
            let app = app.clone();
            let parent = parent.0 as isize;
            std::thread::spawn(move || {
                let _open = open;
                if task_dialog::ask(parent as _, &prompt) {
                    quit_app(&app);
                }
            });
            return;
        }
    }
    let kind = match prompt.case {
        QuitCase::Waiting => MessageDialogKind::Info,
        QuitCase::Working => MessageDialogKind::Warning,
    };
    // The plugin makes its first button the default, so off Windows Enter
    // means Quit. Stay first would make Esc quit instead, since the plugin
    // reads Esc as "not the first button".
    let app = app.clone();
    app.dialog()
        .message(prompt.message)
        .title(prompt.heading)
        .kind(kind)
        .buttons(MessageDialogButtons::OkCancelCustom(
            prompt.quit.to_string(),
            prompt.stay.to_string(),
        ))
        .show({
            let app = app.clone();
            move |quit| {
                let _open = open;
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

// The console page's state, told on every change (`attention` from the page):
// the taskbar's dot for this system, and one flash on a change into the
// person's move or needs attention while the window is not focused. An
// unknown word does nothing.
#[tauri::command]
fn set_attention(app: tauri::AppHandle, state: State<'_, AppState>, signal: String) {
    let Some(next) = Signal::from_id(&signal) else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let (prev, enabled) = {
        let Ok(mut guard) = state.attention.lock() else {
            return;
        };
        (guard.last.replace(next), guard.enabled)
    };
    apply_badge(
        &window,
        attention::badge_for(next, std::env::consts::OS, enabled),
    );
    if attention::should_flash(prev, next, window.is_focused().unwrap_or(true), enabled) {
        let _ = window.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
}

// The one place a badge reaches the window, in each system's own form. A call
// that fails changes nothing else: the taskbar is a hint, never a blocker.
#[cfg_attr(
    not(any(target_os = "windows", target_os = "macos", target_os = "linux")),
    allow(unused_variables)
)]
fn apply_badge(window: &tauri::WebviewWindow, badge: Badge) {
    #[cfg(target_os = "windows")]
    {
        let icon = match badge {
            Badge::Dot(color) => Some(tauri::image::Image::new_owned(
                attention::dot_rgba(color, attention::DOT_SIZE),
                attention::DOT_SIZE,
                attention::DOT_SIZE,
            )),
            _ => None,
        };
        let _ = window.set_overlay_icon(icon);
    }
    #[cfg(target_os = "macos")]
    {
        let label = match badge {
            Badge::Label(text) => Some(text.to_string()),
            _ => None,
        };
        let _ = window.set_badge_label(label);
    }
    #[cfg(target_os = "linux")]
    {
        let count = match badge {
            Badge::Count(count) => Some(count),
            _ => None,
        };
        let _ = window.set_badge_count(count);
    }
}

// No dot and no flash: the agent ended, the page went away, or the switch was
// turned off. Whose turn it is is unknown until the page tells again, so the
// quit check uses its working words meanwhile (the agent may be mid-step).
fn clear_attention(app: &tauri::AppHandle) {
    if let Ok(mut guard) = app.state::<AppState>().attention.lock() {
        guard.last = None;
    }
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    apply_badge(&window, Badge::None);
    let _ = window.request_user_attention(None);
}

// The app page clears it when a new page loads in the frame or none answers.
#[tauri::command]
fn clear_attention_cmd(app: tauri::AppHandle) {
    clear_attention(&app);
}

// The Desktop app switch in the console's User Preferences (`taskbar` from the
// page). Off clears the dot and stops flashes; on shows the dot for the state
// the page last told at once, since the page only tells it again on a change.
// Either way the last state is kept. Saved in the app's own app.json, never
// in the console's files.
#[tauri::command]
fn set_taskbar_signal(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    on: bool,
) -> Result<(), String> {
    let saved = settings::settings_file()
        .ok_or_else(|| "no home folder found".to_string())
        .and_then(|file| settings::save_taskbar_signal(&file, on));
    let last = {
        let Ok(mut guard) = state.attention.lock() else {
            return saved;
        };
        guard.enabled = on;
        guard.last.unwrap_or(Signal::Plain)
    };
    if let Some(window) = app.get_webview_window("main") {
        apply_badge(
            &window,
            attention::badge_for(last, std::env::consts::OS, on),
        );
        if !on {
            let _ = window.request_user_attention(None);
        }
    }
    saved
}

/// What the page draws its bar from: the folder (or that none is chosen yet)
/// and the agent the picker starts on.
#[tauri::command]
fn app_state(state: State<'_, AppState>) -> serde_json::Value {
    let project = state.project.lock().ok().and_then(|p| p.clone());
    let settings_file = settings::settings_file();
    // The agent picked in the launcher starts the bar's picker, ahead of the app's own last one.
    // An id that no longer resolves (a removed custom agent) is skipped.
    let known = |id: &String| agents::find_agent(id).is_some();
    let last_agent = state
        .launch
        .agent
        .clone()
        .filter(known)
        .or_else(|| {
            settings_file
                .as_ref()
                .and_then(|file| settings::load_last_agent(file))
                .filter(known)
        })
        .or_else(|| project::remembered_agent().filter(known));
    let term_panel = settings_file.as_ref().map_or(
        settings::TermPanelSettings {
            dock: settings::DEFAULT_TERM_DOCK.to_string(),
            fraction: settings::DEFAULT_TERM_FRACTION,
            collapsed: false,
        },
        |file| settings::load_term_panel(file),
    );
    let first_run_done = settings_file
        .as_ref()
        .is_some_and(|file| settings::load_first_run_done(file));
    serde_json::json!({
        "projectDir": project.as_ref().map(|p| p.dir.to_string_lossy().into_owned()),
        "projectDirSource": project.as_ref().map(|p| p.source),
        "lastAgent": last_agent,
        "launchModel": state.launch.model,
        // Task 1.7 already exits before the window opens on a missing or too-old
        // Node, so this is always a pass; the checklist's Node row just names it.
        "nodeVersion": state.node_version,
        "nodeBinary": state.node_binary,
        "skillsVersion": versions::installed_skills_version(),
        "firstRunDone": first_run_done,
        // The launcher always passes `--project` alongside `--agent`, so an
        // explicit `--agent` means skip straight to starting it, no checklist
        // or launch card shown.
        "autoStart": state.launch.agent,
        "termPanel": term_panel,
        // The Desktop app switch, for the page's User Preferences.
        "taskbarSignal": state.attention.lock().map_or(true, |guard| guard.enabled),
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
    versions::status(
        &app.package_info().version.to_string(),
        versions::installed_skills_version(),
    )
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
async fn update_skills(
    app: tauri::AppHandle,
    progress: Channel<String>,
) -> Result<UpdateOutcome, String> {
    let version = app.package_info().version.to_string();
    let message = tauri::async_runtime::spawn_blocking(move || {
        versions::run_update(&version, |line| {
            let _ = progress.send(line.to_string());
        })
    })
    .await
    .map_err(|e| e.to_string())??;
    let status = versions::status(
        &app.package_info().version.to_string(),
        versions::installed_skills_version(),
    );
    Ok(UpdateOutcome { message, status })
}

/// The OS folder picker, shown when no folder is known; a choice becomes the
/// launcher's remembered folder.
#[tauri::command]
fn pick_project_folder(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
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
/// the project has moved on (Task 9.5). `state.page` is deliberately left
/// alone: it is the page's own output channel, not the project's, and it must
/// stay the single live registration for `agentChannel`'s id for the page's
/// whole lifetime. Dropping it here (even briefly, to `None`) sends the
/// frontend an "end" message that unregisters that id for good — no later
/// command can ever re-register the same frontend `Channel` object after
/// that, whatever it passes, so a project switch would silently and
/// permanently cut the new agent's output off from the page.
fn teardown_project(state: &AppState) -> Result<(), String> {
    if let Some(agent) = current_agent(state) {
        agent.stop();
    }
    *state.agent.lock().map_err(|e| e.to_string())? = None;
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
/// nothing (canceled) leaves the current project untouched. One project per
/// window stays; this replaces it, it does not add a second.
#[tauri::command]
fn change_project(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
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
    let sup = guard
        .as_mut()
        .ok_or("The agent has not opened the dashboard yet.")?;
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
        Some(sup) if sup.health() => {
            serde_json::json!({ "state": "running", "url": sup.session().url })
        }
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
    let node_binary = node_version
        .as_ref()
        .and_then(|_| node_check::node_binary_path());

    let args = std::env::args().collect::<Vec<_>>();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            project: Mutex::new(project::resolve(&args)),
            launch: project::launch_choice(&args),
            node_version,
            node_binary,
            attention: Mutex::new(AttentionState {
                last: None,
                enabled: settings::settings_file()
                    .is_none_or(|file| settings::load_taskbar_signal(&file)),
            }),
            ..AppState::default()
        })
        .invoke_handler(tauri::generate_handler![
            platform_info,
            agent_availability,
            open_install_page,
            agent_start,
            agent_input,
            agent_resize,
            agent_restart,
            agent_reattach,
            app_state,
            save_term_panel,
            save_first_run_done,
            version_status,
            update_skills,
            pick_project_folder,
            change_project,
            console_start,
            console_status,
            console_stop,
            set_attention,
            clear_attention_cmd,
            set_taskbar_signal
        ])
        .on_window_event(|window, event| {
            // Looking at the window is the answer to its flash.
            if let tauri::WindowEvent::Focused(true) = event {
                let _ = window.request_user_attention(None);
            }
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
            let _ = app.state::<AppState>().app.set(app.handle().clone());
            // Pages the agent's `open` announces: the supervisor and the agent's
            // environment follow the console, and the page frame shows it.
            let handle = app.handle().clone();
            let server = AnnounceServer::start(Arc::new(move |notice| {
                let state = handle.state::<AppState>();
                let taken =
                    take_announced(&state, &notice, window_origin(&handle), session_on_disk);
                if taken {
                    let _ = handle.emit("console-page", &notice);
                } else {
                    eprintln!(
                        "plan2code: ignored a page outside the console store: {}",
                        notice.sid
                    );
                }
                taken
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
            if let tauri::RunEvent::ExitRequested {
                api, code: None, ..
            } = event
            {
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
            project: Mutex::new(Some(ProjectDir {
                dir: PathBuf::from(dir),
                source: project::ProjectSource::Picked,
            })),
            ..AppState::default()
        }
    }

    fn notice(sid: &str) -> PageNotice {
        PageNotice {
            url: "http://127.0.0.1:5555/s/t/".into(),
            sid: sid.into(),
            workflow: "dashboard".into(),
        }
    }

    /// A supervisor following the build's console, adopted with the repo's own
    /// console source so it never depends on an installed one.
    fn following_the_build() -> ConsoleSupervisor {
        std::env::set_var(
            "PLAN2CODE_CONSOLE_DIR",
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../src/web-console"),
        );
        ConsoleSupervisor::adopt(
            PathBuf::from("."),
            app_origin().to_string(),
            "http://127.0.0.1:4444/s/b/",
            "build",
        )
        .expect("adopt with the repo's console")
    }

    fn sid_followed(state: &AppState) -> String {
        state
            .console
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .session()
            .sid
            .clone()
    }

    /// Adopted, never started here: skip Drop's `stop`.
    fn let_go(state: &AppState) {
        std::mem::forget(state.console.lock().unwrap().take());
    }

    #[test]
    fn a_page_from_outside_the_console_store_never_takes_the_window() {
        // A test's throwaway console, opened by `cargo test` inside the app with
        // the agent's in-app variables: following it swapped a build's page for
        // the test's, then for an empty dashboard once the test shut it down.
        let state = state_for("project-a");
        assert!(!take_announced(
            &state,
            &notice("test-console"),
            app_origin().to_string(),
            |_| false
        ));
        assert!(state.console.lock().unwrap().is_none(), "nothing adopted");

        // Already following the build's own console: it stays on that one.
        *state.console.lock().unwrap() = Some(following_the_build());
        assert!(!take_announced(
            &state,
            &notice("test-console"),
            app_origin().to_string(),
            |_| false
        ));
        assert_eq!(sid_followed(&state), "build");
        let_go(&state);
    }

    #[test]
    fn a_page_from_the_console_store_is_followed() {
        let state = state_for("project-a");
        *state.console.lock().unwrap() = Some(following_the_build());
        assert!(take_announced(
            &state,
            &notice("next"),
            app_origin().to_string(),
            |_| true
        ));
        assert_eq!(sid_followed(&state), "next");
        let_go(&state);
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
        *state.project.lock().unwrap() = Some(ProjectDir {
            dir: PathBuf::from("project-b"),
            source: project::ProjectSource::Picked,
        });
        let second = agent_for_project(&state).expect("a manager for project-b");
        assert_eq!(second.folder(), &PathBuf::from("project-b"));
        assert!(
            !Arc::ptr_eq(&first, &second),
            "project-a's manager must never stand in for project-b's"
        );
    }

    #[test]
    fn new_session_forgets_the_windows_session_so_the_fresh_agent_starts_its_own() {
        let state = state_for("project-a");
        let server = AnnounceServer::start(Arc::new(|_| true)).unwrap();
        let port: u16 = server
            .url()
            .rsplit_once(':')
            .unwrap()
            .1
            .trim_end_matches("/page")
            .parse()
            .unwrap();
        *state.announce.lock().unwrap() = Some(server);
        let body = r#"{"url":"http://127.0.0.1:5000/s/abc/","sid":"s1","workflow":"plan"}"#;
        let mut stream = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        let token = state
            .announce
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .token()
            .to_string();
        use std::io::{Read, Write};
        write!(
            stream,
            "POST /page HTTP/1.1\r\nHost: 127.0.0.1\r\nx-plan2code-token: {token}\r\ncontent-length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
        let mut answer = String::new();
        stream.read_to_string(&mut answer).unwrap();
        assert!(
            answer.starts_with("HTTP/1.1 204"),
            "the page was announced: {answer}"
        );
        assert_eq!(
            state
                .announce
                .lock()
                .unwrap()
                .as_ref()
                .unwrap()
                .current()
                .map(|n| n.sid),
            Some("s1".to_string())
        );

        // No console supervised here, so no brief to write: only the forgetting.
        assert_eq!(before_fresh_hook(&state)(), None);
        assert_eq!(
            state.announce.lock().unwrap().as_ref().unwrap().current(),
            None,
            "the fresh agent's open must not join s1"
        );
    }

    #[test]
    fn the_same_folder_reuses_the_same_manager() {
        let state = state_for("project-a");
        let first = agent_for_project(&state).unwrap();
        let second = agent_for_project(&state).unwrap();
        assert!(
            Arc::ptr_eq(&first, &second),
            "the same folder should not make a second manager"
        );
    }

    fn have_node() -> bool {
        std::process::Command::new("node")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
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
            eprintln!(
                "skipping: console source missing at {}",
                console_dir.display()
            );
            return None;
        }
        let pid = std::process::id();
        let project = std::env::temp_dir().join(format!("p2c-main-test-project-{pid}"));
        std::fs::create_dir_all(&project).unwrap();
        std::env::set_var("PLAN2CODE_CONSOLE_DIR", &console_dir);
        std::env::set_var(
            "PLAN2CODE_CONSOLE_HOME",
            std::env::temp_dir().join(format!("p2c-main-test-home-{pid}")),
        );
        std::env::set_var("PLAN2CODE_NO_BROWSER", "1");
        // Run inside the desktop app, the agent's in-app variables would have this
        // console announce itself to the live window and take it over.
        for name in [
            "PLAN2CODE_IN_APP",
            "PLAN2CODE_APP_ANNOUNCE",
            "PLAN2CODE_APP_TOKEN",
            "PLAN2CODE_CONSOLE_SID",
        ] {
            std::env::remove_var(name);
        }
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
        assert!(
            console_start_impl(&state).is_ok(),
            "console_start should work before the project changes"
        );

        teardown_project(&state).unwrap();

        let err = console_start_impl(&state)
            .expect_err("console_start must refuse, not reconnect to the old session");
        assert!(
            err.contains("has not opened the dashboard"),
            "unexpected message: {err:?}"
        );
    }
}
