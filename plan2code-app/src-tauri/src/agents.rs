//! The agents the app can run and the command line each one starts with. The
//! built-ins come from the one shipped agent list (`src/launcher/agents.json`,
//! installed to `~/.plan2code/bin/`), and where an agent's command is found
//! follows the one lookup rule `src/web-console/agent-lookup.mjs` states, so
//! the app, `plan2code` and the console agree on every agent's state. Knows
//! nothing about Tauri.

use std::path::{Path, PathBuf};

use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Tests only: run this program instead of the real agent, for any built-in,
/// so the fake agent stands in for Claude, Devin and Codex.
pub const AGENT_BIN_ENV: &str = "PLAN2CODE_APP_AGENT_BIN";

/* ------------------------------------------------------------ the agent list */

/// The agents.json schema this reader knows.
const AGENT_LIST_SCHEMA: f64 = 1.0;

/// One install line for one OS ("PowerShell", "Terminal", "npm").
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstallLine {
    pub label: String,
    pub run: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// A value per OS key (`win`, `mac`, `linux`), as `install` and `installDirs`
/// are shaped in agents.json.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PerOs<T> {
    #[serde(default)]
    pub win: Vec<T>,
    #[serde(default)]
    pub mac: Vec<T>,
    #[serde(default)]
    pub linux: Vec<T>,
}

impl<T> PerOs<T> {
    /// The entries for `platform` ("win" | "mac" | "linux").
    pub fn for_platform(&self, platform: &str) -> &[T] {
        match platform {
            "win" => &self.win,
            "mac" => &self.mac,
            _ => &self.linux,
        }
    }
}

/// One entry of the shipped agent list (agents.json schema 1): a built-in the
/// app can run (`kind: "builtin"`) or a starter template for the setup page's
/// custom-agent form. The console is the list's only writer; a `modelArgs` of
/// `["--model", "{model}"]` is the file's own default when the key is absent.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEntry {
    // The fields are lenient on purpose: the JS reader lists any object whose
    // `kind` names a slot, and a builtin missing `command` then looks up as
    // `missing`, the same broken row the console would show.
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub command: String,
    #[serde(default = "default_custom_prompt")]
    pub prompt: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub bypass_args: Vec<String>,
    #[serde(default)]
    pub model_args: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_url: Option<String>,
    #[serde(default)]
    pub install: PerOs<InstallLine>,
    #[serde(default)]
    pub install_dirs: PerOs<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// The shipped agent list, split the way `loadAgentList()` splits it.
#[derive(Clone, Debug, Default)]
pub struct AgentList {
    pub builtins: Vec<AgentEntry>,
    pub templates: Vec<AgentEntry>,
    pub warnings: Vec<String>,
}

/// The copy baked into the app: the fallback when the installed file is
/// missing, unreadable or the wrong schema.
const BAKED_AGENTS: &str = include_str!("../../../src/launcher/agents.json");

/// `~/.plan2code/bin/agents.json`, beside the launcher (`versions.rs` builds
/// the same `bin` path for `plan2code.js` and `version.json`).
fn agent_list_file() -> Option<PathBuf> {
    crate::versions::launcher_dir().map(|dir| dir.join("agents.json"))
}

/// The entries and warnings in one agents.json text. A text that is not a
/// schema-1 object is an error (the caller then falls back to the baked copy).
pub fn parse_agent_list(text: &str) -> Result<AgentList, String> {
    let Ok(file) = serde_json::from_str::<Value>(text) else {
        return Err("agents.json is not valid JSON".to_string());
    };
    if !file.is_object() {
        return Err("agents.json is not an object".to_string());
    }
    if file.get("schema").and_then(Value::as_f64) != Some(AGENT_LIST_SCHEMA) {
        let shown = file
            .get("schema")
            .map_or("undefined".to_string(), |v| v.to_string());
        return Err(format!(
            "agents.json has schema {shown}, not {}",
            AGENT_LIST_SCHEMA as u64
        ));
    }
    let mut out = AgentList::default();
    let empty = Vec::new();
    let list = file
        .get("agents")
        .and_then(Value::as_array)
        .unwrap_or(&empty);
    for (index, entry) in list.iter().enumerate() {
        if !entry.is_object() {
            out.warnings
                .push(format!("agents[{index}] skipped: not an object"));
            continue;
        }
        let Ok(agent) = serde_json::from_value::<AgentEntry>(entry.clone()) else {
            out.warnings.push(format!(
                "agents[{index}] skipped: missing or mistyped fields"
            ));
            continue;
        };
        match agent.kind.as_str() {
            "builtin" => out.builtins.push(agent),
            "template" => out.templates.push(agent),
            other => out
                .warnings
                .push(format!("agents[{index}] skipped: unknown kind {other:?}")),
        }
    }
    Ok(out)
}

/// Read the installed list, or the baked copy with one warning when the file
/// is missing, unreadable or the wrong schema. Never panics; the baked copy
/// always parses (a test pins it to `src/launcher/agents.json`).
fn load_agent_list_uncached() -> AgentList {
    let text = agent_list_file().and_then(|file| std::fs::read_to_string(file).ok());
    match text.as_deref().map(|text| (text, parse_agent_list(text))) {
        Some((_, Ok(list))) => list,
        why => {
            let mut list = parse_agent_list(BAKED_AGENTS).unwrap_or_default();
            let reason = match why {
                Some((_, Err(error))) => error,
                _ => "agents.json is missing".to_string(),
            };
            list.warnings
                .push(format!("{reason}; the copy built into the app is used"));
            list
        }
    }
}

static AGENT_LIST: Mutex<Option<Arc<AgentList>>> = Mutex::new(None);

/// The shipped agent list, loaded once and kept: the file changes on a skills
/// update, which restarts the app anyway; `refresh_agent_list` re-reads it
/// early for "Check again".
pub fn agent_list() -> Arc<AgentList> {
    let mut cached = AGENT_LIST.lock().unwrap_or_else(|e| e.into_inner());
    cached
        .get_or_insert_with(|| Arc::new(load_agent_list_uncached()))
        .clone()
}

/// Drop the cached list so the next `agent_list()` reads the file again.
pub fn refresh_agent_list() {
    *AGENT_LIST.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// The built-in entries, in file order.
pub fn builtin_entries() -> Vec<AgentEntry> {
    agent_list().builtins.clone()
}

/// The built-in entry `id` names, or none (a custom agent, a typo).
pub fn builtin_entry(id: &str) -> Option<AgentEntry> {
    agent_list()
        .builtins
        .iter()
        .find(|entry| entry.id == id)
        .cloned()
}

/// Whether this agent takes a separate reasoning effort. Devin's model ids
/// already carry effort (`swe-2-high`), so it has none of its own; agents.json
/// has no effort field, so the two that take one are named here.
pub fn has_effort(id: &str) -> bool {
    matches!(id, "claude" | "codex")
}

/// The extra arguments `effort` becomes for this agent, or none: Claude's own
/// flag, Codex's config override.
fn effort_args(id: &str, effort: &str) -> Vec<String> {
    match id {
        "claude" => vec!["--effort".to_string(), effort.to_string()],
        "codex" => vec!["-c".to_string(), format!("model_reasoning_effort={effort}")],
        _ => Vec::new(),
    }
}

/// How a person installs `entry`: this OS's lead install line, else its
/// install page, for the launch card's one-line hint.
pub fn install_hint(entry: &AgentEntry) -> Option<String> {
    entry
        .install
        .for_platform(lookup_platform())
        .first()
        .map(|line| line.run.clone())
        .or_else(|| entry.install_url.clone())
}

/// Whether permission checks run while the agent works. Bypass is always an
/// explicit pick, shown with a banner while it runs; it is never the silent
/// default.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionMode {
    /// The agent's own approval flow: it asks before a sensitive action.
    Checked,
    /// Permission checks are off.
    Bypass,
}

impl PermissionMode {
    pub fn id(self) -> &'static str {
        match self {
            PermissionMode::Checked => "checked",
            PermissionMode::Bypass => "bypass",
        }
    }

    pub fn from_id(id: &str) -> Option<PermissionMode> {
        match id {
            "checked" => Some(PermissionMode::Checked),
            "bypass" => Some(PermissionMode::Bypass),
            _ => None,
        }
    }
}

/* ---------------------------------------------------------- the lookup rule */
// `findAgent` in src/web-console/agent-lookup.mjs, kept to the same answers by
// the shared cases in scripts/fixtures/agent-lookup-cases.json (the test at
// the bottom of this file runs them all).

/// Where `entry`'s command can run from, mirroring the JS `findAgent`'s
/// `{ state, path, where, folder }`: "found" on the searched PATH, "outside"
/// on the saved Windows PATH, in npm's global folder or in one of the entry's
/// installDirs, "missing" nowhere. `folder` is the directory it was found in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LookupResult {
    pub state: &'static str,
    pub path: Option<PathBuf>,
    pub where_: Option<&'static str>,
    pub folder: Option<PathBuf>,
}

fn missing() -> LookupResult {
    LookupResult {
        state: "missing",
        path: None,
        where_: None,
        folder: None,
    }
}

fn hit(state: &'static str, where_: &'static str, path: PathBuf) -> LookupResult {
    LookupResult {
        state,
        path: Some(path.clone()),
        where_: Some(where_),
        folder: path.parent().map(Path::to_path_buf),
    }
}

/// The OS the lookup answers for: "win" | "mac" | "linux", as agents.json
/// keys its per-OS fields.
pub fn lookup_platform() -> &'static str {
    if cfg!(windows) {
        "win"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    }
}

/// Everything the lookup reads from the environment, as named inputs so a
/// test can drive it on any platform's rules. `None` fields read the real
/// process values.
#[derive(Clone, Debug, Default)]
pub struct LookupEnv {
    pub path: Option<String>,
    pub saved_path: Option<String>,
    pub npm_bin: Option<String>,
    pub pathext: Option<String>,
    pub platform: Option<String>,
    pub home: Option<String>,
    /// `%NAME%` expansions for installDirs, checked case-insensitively like
    /// Windows; the process environment answers a name not listed here.
    pub vars: Vec<(String, String)>,
}

/// The folders a PATH-like string names, quotes stripped. The delimiter is
/// the host's, as `path.delimiter` is on the Node side: a PATH a case drives
/// is written for the machine it runs on, not for the platform it names.
fn path_dirs(path_var: &str) -> Vec<PathBuf> {
    path_var
        .split(if cfg!(windows) { ';' } else { ':' })
        .filter(|dir| !dir.is_empty())
        .map(|dir| Path::new(dir.trim_matches('"')).to_path_buf())
        .collect()
}

/// `command` (a bare name) in `dir`, each extension tried. A name that
/// already carries an extension (goose.cmd) is tried as written first, then
/// with each extension; extensions come in uppercase from PATHEXT while
/// files are usually lowercase, so both cases are tried and the path names
/// the file as written.
fn find_in_dir(command: &str, dir: &Path, extensions: &[String]) -> Option<PathBuf> {
    let has_ext = Path::new(command).extension().is_some();
    let exts: Vec<&str> = if has_ext {
        std::iter::once("")
            .chain(extensions.iter().map(String::as_str))
            .collect()
    } else {
        extensions.iter().map(String::as_str).collect()
    };
    for ext in exts {
        let mut names = vec![format!("{command}{}", ext.to_lowercase())];
        let original = format!("{command}{ext}");
        if original != names[0] {
            names.push(original);
        }
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn find_in_dirs(command: &str, dirs: &[PathBuf], extensions: &[String]) -> Option<PathBuf> {
    dirs.iter()
        .find_map(|dir| find_in_dir(command, dir, extensions))
}

/// `~` at the start (alone or before a separator) replaced with `home`.
fn expand_home(text: &str, home: &str) -> String {
    if text == "~" {
        return home.to_string();
    }
    text.strip_prefix("~/")
        .or_else(|| text.strip_prefix("~\\"))
        .map_or_else(|| text.to_string(), |rest| format!("{home}/{rest}"))
}

/// npm's global bin folder, worked out once per process: derived without
/// spawning where possible (npm_config_prefix, %APPDATA%\npm on Windows),
/// `npm config get prefix` with a short timeout only as the fallback, and a
/// failure means "no npm folder", never an error.
fn npm_global_bin(windows: bool) -> Option<String> {
    static CACHED: Mutex<Option<Option<String>>> = Mutex::new(None);
    let mut cached = CACHED.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(value) = cached.as_ref() {
        return value.clone();
    }
    let found = npm_global_bin_uncached(windows);
    *cached = Some(found.clone());
    found
}

fn npm_global_bin_uncached(windows: bool) -> Option<String> {
    if let Ok(prefix) = std::env::var("npm_config_prefix") {
        if !prefix.is_empty() {
            return Some(if windows {
                prefix
            } else {
                format!("{prefix}/bin")
            });
        }
    }
    if windows {
        if let Ok(appdata) = std::env::var("APPDATA") {
            if !appdata.is_empty() {
                return Some(format!("{appdata}\\npm"));
            }
        }
    }
    let mut command = std::process::Command::new("npm");
    command
        .args(["config", "get", "prefix"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .env("PATH", crate::node_check::resolved_path());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let child = command.spawn();
    let child = match child {
        Ok(child) => child,
        Err(_) => return None,
    };
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });
    match rx.recv_timeout(std::time::Duration::from_secs(3)) {
        Ok(Ok(out)) => {
            let got = String::from_utf8_lossy(&out.stdout).trim().to_string();
            (!got.is_empty()).then(|| if windows { got } else { format!("{got}/bin") })
        }
        _ => None,
    }
}

/// `entry`'s command under the real environment: the process PATH on Windows
/// (the saved PATH is then checked separately so the answer can say
/// `saved-path`), the app's resolved PATH elsewhere (its login-shell merge is
/// the honest "on PATH" there).
pub fn lookup_agent(entry: &AgentEntry) -> LookupResult {
    let env = LookupEnv::default();
    lookup_agent_in(entry, &env)
}

/// `findAgent(entry, env)`, on `entry`'s `command` and `installDirs`.
pub fn lookup_agent_in(entry: &AgentEntry, env: &LookupEnv) -> LookupResult {
    let command = clean_command(entry.command.trim());
    if command.is_empty() {
        return missing();
    }
    let platform = env
        .platform
        .clone()
        .unwrap_or_else(|| lookup_platform().to_string());
    let windows = platform == "win";
    let pathext = env
        .pathext
        .clone()
        .or_else(|| std::env::var("PATHEXT").ok())
        .filter(|p| !p.is_empty())
        .unwrap_or_else(|| ".EXE;.CMD;.BAT;.COM".to_string());
    let extensions: Vec<String> = if windows {
        pathext
            .split(';')
            .filter(|e| !e.is_empty())
            .map(String::from)
            .collect()
    } else {
        vec![String::new()]
    };

    // A command written as a path is checked as a file, never looked up.
    if has_separator(command, windows) {
        let full = if Path::new(command).is_absolute() {
            PathBuf::from(command)
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(command)
        };
        let tries: Vec<PathBuf> = if windows && full.extension().is_none() {
            extensions
                .iter()
                .map(|ext| PathBuf::from(format!("{}{ext}", full.to_string_lossy())))
                .collect()
        } else {
            vec![full]
        };
        return match tries.iter().find(|t| t.is_file()) {
            Some(found) => hit("found", "path", found.clone()),
            None => missing(),
        };
    }

    let search_path = env.path.clone().unwrap_or_else(real_lookup_path);
    if let Some(found) = find_in_dirs(command, &path_dirs(&search_path), &extensions) {
        return hit("found", "path", found);
    }

    let saved = env
        .saved_path
        .clone()
        .unwrap_or_else(crate::node_check::saved_path_value);
    if let Some(found) = find_in_dirs(command, &path_dirs(&saved), &extensions) {
        return hit("outside", "saved-path", found);
    }

    let npm_bin = env.npm_bin.clone().or_else(|| npm_global_bin(windows));
    if let Some(bin) = npm_bin {
        if !bin.is_empty() {
            if let Some(found) = find_in_dir(command, Path::new(&bin), &extensions) {
                return hit("outside", "npm", found);
            }
        }
    }

    let home = env
        .home
        .clone()
        .or_else(|| std::env::home_dir().map(|h| h.to_string_lossy().into_owned()))
        .unwrap_or_default();
    // A `vars` map that is given stands alone, as `env.vars || process.env`
    // says on the JS side: the process environment is consulted only when no
    // map was supplied at all.
    let vars = |name: &str| {
        if env.vars.is_empty() {
            return std::env::var(name).ok();
        }
        env.vars
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.clone())
    };
    for dir in entry.install_dirs.for_platform(&platform) {
        let expanded = crate::node_check::expand_percent_vars(&expand_home(dir, &home), vars);
        if let Some(found) = find_in_dir(command, Path::new(&expanded), &extensions) {
            return hit("outside", "install-dir", found);
        }
    }

    missing()
}

/// What the lookup's PATH input is with no override: the inherited process
/// PATH on Windows (the saved PATH is its own input so `saved-path` can be
/// told apart), the app's resolved PATH elsewhere.
fn real_lookup_path() -> String {
    if cfg!(windows) {
        std::env::var("PATH").unwrap_or_default()
    } else {
        crate::node_check::resolved_path()
    }
}

/// The extension list `find_on_path` tries on Windows: the real PATHEXT, or
/// the usual default when it is unset.
fn pathext_list(windows: bool, pathext: Option<&str>) -> Vec<String> {
    if !windows {
        return vec![String::new()];
    }
    pathext
        .map(String::from)
        .or_else(|| std::env::var("PATHEXT").ok())
        .filter(|p| !p.is_empty())
        .unwrap_or_else(|| ".EXE;.CMD;.BAT;.COM".to_string())
        .split(';')
        .filter(|e| !e.is_empty())
        .map(String::from)
        .collect()
}

/// Whether `program` exists on `path_var`: an exact file on macOS and Linux,
/// or with any PATHEXT extension on Windows (the lookup rule's search order).
pub fn find_on_path(program: &str, path_var: &str) -> Option<PathBuf> {
    find_in_dirs(
        program,
        &path_dirs(path_var),
        &pathext_list(cfg!(windows), None),
    )
}

/// Where `entry`'s CLI runs from: the test override when it is set, else the
/// lookup's `found` answer (on the searched PATH). `None` means it cannot be
/// run without setup, whatever the other states found.
pub fn installed_at(entry: &AgentEntry) -> Option<PathBuf> {
    let bin = std::env::var(AGENT_BIN_ENV).ok().filter(|b| !b.is_empty());
    if let Some(program) = bin {
        return find_on_path(&program, &crate::node_check::resolved_path());
    }
    let found = lookup_agent(entry);
    (found.state == "found").then_some(found.path).flatten()
}

/// Whether `entry`'s CLI can be run at all.
pub fn is_installed(entry: &AgentEntry) -> bool {
    installed_at(entry).is_some()
}

/// A command to run in the pseudo-terminal.
#[derive(Debug, PartialEq, Eq)]
pub struct LaunchSpec {
    pub program: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub cwd: PathBuf,
}

/// How to start `entry` in `folder`. An empty `prompt` starts the agent with
/// nothing typed. `PLAN2CODE_APP_AGENT_BIN` replaces the program (tests only).
pub fn launch_spec(
    entry: &AgentEntry,
    folder: &Path,
    model: Option<&str>,
    effort: Option<&str>,
    mode: PermissionMode,
    prompt: &str,
) -> LaunchSpec {
    let bin = std::env::var(AGENT_BIN_ENV)
        .ok()
        .filter(|bin| !bin.is_empty());
    let mut spec = launch_spec_with(entry, folder, model, effort, mode, prompt, bin.as_deref());
    // The override names a program to run as it is; a real agent is looked up on PATH.
    if cfg!(windows) && bin.is_none() {
        let (program, args) = windows_command(
            &spec.program,
            spec.args,
            &std::env::var("PATH").unwrap_or_default(),
        );
        if program == "cmd" && args.first().map(String::as_str) == Some("/c") {
            // A shim wrapped for cmd: quote the line, hand it over in a variable
            // and keep cmd from trying the project folder before PATH, exactly as
            // a custom .cmd agent does (a same-named file in a cloned repo must not
            // run in the agent's place). Accepted trade-off: the variable reaches
            // everything the agent starts, so a `cmd` it runs as a tool no longer
            // finds `gradlew` or `setup.bat` in the project without `.\`; custom
            // .cmd agents already behave this way.
            let line: Vec<String> = args[1..].iter().map(|arg| quote_for_cmd(arg)).collect();
            spec.env.push((CMD_LINE_ENV.to_string(), line.join(" ")));
            spec.env.push((
                "NoDefaultCurrentDirectoryInExePath".to_string(),
                "1".to_string(),
            ));
            spec.args = vec![
                "/d".to_string(),
                "/c".to_string(),
                format!("%{CMD_LINE_ENV}%"),
            ];
            spec.program = program;
        } else {
            spec.program = program;
            spec.args = args;
        }
    }
    spec
}

fn launch_spec_with(
    entry: &AgentEntry,
    folder: &Path,
    model: Option<&str>,
    effort: Option<&str>,
    mode: PermissionMode,
    prompt: &str,
    bin_override: Option<&str>,
) -> LaunchSpec {
    let cwd = folder.to_path_buf();
    if let Some(bin) = bin_override {
        return LaunchSpec {
            program: bin.to_string(),
            args: vec![],
            env: vec![],
            cwd,
        };
    }

    let bypass = mode == PermissionMode::Bypass;
    let effort_args = effort
        .filter(|e| !e.is_empty())
        .map(|e| effort_args(&entry.id, e))
        .unwrap_or_default();
    let args = build_args(
        &entry.args,
        &entry.prompt,
        Some(prompt),
        model,
        bypass,
        &entry.bypass_args,
        &entry.model_args,
        &effort_args,
    );
    // A Dock or Start-menu launch often lacks nvm, Homebrew or Volta's
    // directories (Task 9.9): the agent CLI itself, and anything it shells
    // out to, needs a PATH that finds them anyway.
    let env = vec![("PATH".to_string(), crate::node_check::resolved_path())];
    LaunchSpec {
        program: clean_command(&entry.command).to_string(),
        args,
        env,
        cwd,
    }
}

/// An agent installed with npm is, on Windows, a `.cmd` shim beside an
/// extensionless script, and `CreateProcess` cannot run the script. Look the
/// program up on `path_var` for an `.exe` (run as is), `.cmd` or `.bat` (run
/// through `cmd /c`); a program found as none of them is left alone.
pub fn windows_command(program: &str, args: Vec<String>, path_var: &str) -> (String, Vec<String>) {
    for dir in path_var.split(';').filter(|dir| !dir.is_empty()) {
        for ext in ["exe", "cmd", "bat"] {
            let candidate = Path::new(dir).join(format!("{program}.{ext}"));
            if !candidate.is_file() {
                continue;
            }
            if ext == "exe" {
                return (candidate.to_string_lossy().into_owned(), args);
            }
            // The bare file name, not the full path: a path with a space gets
            // quoted, and `cmd /c` mangles a command line that starts with a quote.
            // `cmd` finds the shim on PATH itself.
            let mut wrapped = vec!["/c".to_string(), format!("{program}.{ext}")];
            wrapped.extend(args);
            return ("cmd".to_string(), wrapped);
        }
    }
    (program.to_string(), args)
}

/* ------------------------------------------------------------ custom agents */

pub const MAX_CUSTOM_AGENTS: usize = 50;
const MAX_NAME: usize = 60;
const DEFAULT_CUSTOM_PROMPT: &str = "/plan2code";

/// One model a custom agent offers.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustomModel {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

/// One entry of `~/.plan2code/agents.json`, with every default filled. The
/// rules live in `src/web-console/agents.mjs`; `scripts/fixtures/agents-cases.json`
/// pins this reader to them. Unknown keys are not kept here (the console is the
/// file's only writer).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAgent {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default = "default_custom_prompt")]
    pub prompt: String,
    #[serde(default)]
    pub bypass_args: Vec<String>,
    #[serde(default = "default_model_args")]
    pub model_args: Vec<String>,
    #[serde(default)]
    pub models: Vec<CustomModel>,
}

fn default_custom_prompt() -> String {
    DEFAULT_CUSTOM_PROMPT.to_string()
}

fn default_model_args() -> Vec<String> {
    vec!["--model".to_string(), "{model}".to_string()]
}

/// `~/.plan2code/agents.json`.
pub fn agents_file() -> Option<PathBuf> {
    Some(std::env::home_dir()?.join(".plan2code").join("agents.json"))
}

/// The custom agents in `file` and the warnings about what was skipped. A
/// missing file is no agents and no warnings; a bad file is no agents and a
/// warning. Never panics.
pub fn load_custom_agents(file: &Path) -> (Vec<CustomAgent>, Vec<String>) {
    match std::fs::read_to_string(file) {
        Ok(text) => parse_agents_file(&text),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (Vec::new(), Vec::new()),
        Err(e) => (
            Vec::new(),
            vec![format!(
                "agents.json could not be read ({e}), so no custom agents are used"
            )],
        ),
    }
}

/// `normalizeAgents` for the file's text.
pub fn parse_agents_file(text: &str) -> (Vec<CustomAgent>, Vec<String>) {
    let none = |warning: String| (Vec::new(), vec![warning]);
    let Ok(file) = serde_json::from_str::<Value>(text) else {
        return none("agents.json is not valid JSON, so no custom agents are used".to_string());
    };
    let Some(file) = file.as_object() else {
        return none("agents.json is not an object, so no custom agents are used".to_string());
    };
    if file.get("schema").and_then(Value::as_f64) != Some(1.0) {
        let shown = file
            .get("schema")
            .map_or("undefined".to_string(), |v| v.to_string());
        return none(format!(
            "agents.json has schema {shown}, not 1, so no custom agents are used"
        ));
    }
    let list = match file.get("agents") {
        None | Some(Value::Null) => return (Vec::new(), Vec::new()),
        Some(Value::Array(list)) => list,
        Some(_) => {
            return none(
                "agents.json: agents is not a list, so no custom agents are used".to_string(),
            )
        }
    };

    let mut warnings = Vec::new();
    let mut list: &[Value] = list;
    if list.len() > MAX_CUSTOM_AGENTS {
        warnings.push(format!(
            "agents.json lists {} agents; only the first {MAX_CUSTOM_AGENTS} are used",
            list.len()
        ));
        list = &list[..MAX_CUSTOM_AGENTS];
    }
    let mut agents: Vec<CustomAgent> = Vec::new();
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    for (index, entry) in list.iter().enumerate() {
        match check_entry(entry, &ids, &names) {
            Ok(agent) => {
                ids.insert(agent.id.clone());
                names.insert(agent.name.to_lowercase());
                agents.push(agent);
            }
            Err(error) => warnings.push(format!("agents[{index}] skipped: {error}")),
        }
    }
    (agents, warnings)
}

fn valid_agent_id(id: &str) -> bool {
    let mut chars = id.chars();
    let first_ok = chars
        .next()
        .is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit());
    first_ok
        && id.len() <= 32
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn text_list(entry: &Value, field: &str, default: Vec<String>) -> Result<Vec<String>, String> {
    match entry.get(field) {
        None | Some(Value::Null) => Ok(default),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item| item.as_str().map(str::to_string))
            .collect::<Option<Vec<_>>>()
            .ok_or_else(|| format!("{field} must be a list of text")),
        Some(_) => Err(format!("{field} must be a list of text")),
    }
}

// One entry against the rules, in the same order as `checkEntry` in agents.mjs.
fn check_entry(
    entry: &Value,
    ids: &HashSet<String>,
    names: &HashSet<String>,
) -> Result<CustomAgent, String> {
    let Some(object) = entry.as_object() else {
        return Err("not an object".to_string());
    };
    let id = match object.get("id").and_then(Value::as_str) {
        Some(id) if !id.is_empty() => id,
        _ => return Err("id is missing".to_string()),
    };
    if builtin_entry(id).is_some() {
        return Err(format!("id \"{id}\" belongs to a built-in agent"));
    }
    if !valid_agent_id(id) {
        return Err(format!(
            "id \"{id}\" must be 1 to 32 lowercase letters, digits or dashes, starting with a letter or digit"
        ));
    }
    if ids.contains(id) {
        return Err(format!("id \"{id}\" is already used"));
    }

    let name = object
        .get("name")
        .and_then(Value::as_str)
        .map_or("", str::trim);
    if name.is_empty() {
        return Err("name is missing".to_string());
    }
    if name.encode_utf16().count() > MAX_NAME {
        return Err(format!("name is longer than {MAX_NAME} characters"));
    }
    if names.contains(&name.to_lowercase()) {
        return Err(format!("name \"{name}\" is already used"));
    }

    let command = object
        .get("command")
        .and_then(Value::as_str)
        .map_or("", str::trim);
    if command.is_empty() {
        return Err("command is missing".to_string());
    }

    let args = text_list(entry, "args", Vec::new())?;
    let bypass_args = text_list(entry, "bypassArgs", Vec::new())?;
    let model_args = text_list(entry, "modelArgs", default_model_args())?;

    let prompt = match object.get("prompt") {
        None | Some(Value::Null) => default_custom_prompt(),
        Some(Value::String(text)) => text.clone(),
        Some(_) => return Err("prompt must be text".to_string()),
    };

    let mut models: Vec<CustomModel> = Vec::new();
    match object.get("models") {
        None | Some(Value::Null) => {}
        Some(Value::Array(items)) => {
            let mut seen = HashSet::new();
            for item in items {
                let Some(model_id) = item.get("id").and_then(Value::as_str) else {
                    return Err("every model in models needs an id".to_string());
                };
                let model_id = model_id.trim();
                if model_id.is_empty() || !seen.insert(model_id.to_string()) {
                    continue;
                }
                let label = item
                    .get("label")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|l| !l.is_empty());
                models.push(CustomModel {
                    id: model_id.to_string(),
                    label: label.map(str::to_string),
                });
            }
        }
        Some(_) => return Err("models must be a list".to_string()),
    }

    Ok(CustomAgent {
        id: id.to_string(),
        name: name.to_string(),
        command: command.to_string(),
        args,
        prompt,
        bypass_args,
        model_args,
        models,
    })
}

/// The arguments that start an agent, in order (`buildArgs` in agents.mjs):
/// `args` with `{prompt}` filled (the prompt appended when no argument holds
/// it), then `model_args` when a model is chosen, then `bypass_args` when
/// checks are off. An argument that is exactly `{bypass}` or `{model}`
/// expands to `bypass_args` / `model_args` in place (nothing when off /
/// unset) and that flag is no longer appended at the end; `extra_after_model`
/// (a built-in's effort flags) follows each `{model}` expansion.
/// `prompt` defaults to `own_prompt`; a blank one drops an argument that is
/// exactly `{prompt}`. Plain text only.
#[allow(clippy::too_many_arguments)]
fn build_args(
    args: &[String],
    own_prompt: &str,
    prompt: Option<&str>,
    model: Option<&str>,
    bypass: bool,
    bypass_args: &[String],
    model_args: &[String],
    extra_after_model: &[String],
) -> Vec<String> {
    let text = prompt.unwrap_or(own_prompt);
    let blank = text.trim().is_empty();
    let model = model.filter(|m| !m.is_empty());
    let mut out = Vec::new();
    let mut placed = false;
    let mut has_bypass = false;
    let mut has_model = false;
    for arg in args {
        if arg == "{bypass}" {
            has_bypass = true;
            if bypass {
                out.extend(bypass_args.iter().cloned());
            }
            continue;
        }
        if arg == "{model}" {
            has_model = true;
            if let Some(m) = model {
                out.extend(model_args.iter().map(|a| a.replace("{model}", m)));
            }
            out.extend(extra_after_model.iter().cloned());
            continue;
        }
        if arg.contains("{bypass}") {
            has_bypass = true;
        }
        if arg.contains("{model}") {
            has_model = true;
        }
        if !arg.contains("{prompt}") && !arg.contains("{model}") {
            out.push(arg.clone());
            continue;
        }
        if arg == "{prompt}" && blank {
            placed = true;
            continue;
        }
        let mut next = arg.clone();
        if next.contains("{prompt}") {
            placed = true;
            next = next.replace("{prompt}", text);
        }
        if next.contains("{model}") {
            next = next.replace("{model}", model.unwrap_or(""));
        }
        out.push(next);
    }
    if !placed && !blank {
        out.push(text.to_string());
    }
    if !has_model {
        if let Some(m) = model {
            out.extend(model_args.iter().map(|arg| arg.replace("{model}", m)));
        }
        out.extend(extra_after_model.iter().cloned());
    }
    if bypass && !has_bypass {
        out.extend(bypass_args.iter().cloned());
    }
    out
}

/// `build_args` for a custom agent (`build_custom_args`).
pub fn build_custom_args(
    agent: &CustomAgent,
    prompt: Option<&str>,
    model: Option<&str>,
    bypass: bool,
) -> Vec<String> {
    build_args(
        &agent.args,
        &agent.prompt,
        prompt,
        model,
        bypass,
        &agent.bypass_args,
        &agent.model_args,
        &[],
    )
}

/// An agent the app can run: one of the shipped built-ins or a custom entry.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Agent {
    Builtin(AgentEntry),
    Custom(CustomAgent),
}

impl Agent {
    pub fn id(&self) -> &str {
        match self {
            Agent::Builtin(entry) => &entry.id,
            Agent::Custom(agent) => &agent.id,
        }
    }

    pub fn label(&self) -> &str {
        match self {
            Agent::Builtin(entry) => &entry.name,
            Agent::Custom(agent) => &agent.name,
        }
    }

    /// What a first start types.
    pub fn default_prompt(&self) -> &str {
        match self {
            Agent::Builtin(entry) => &entry.prompt,
            Agent::Custom(agent) => &agent.prompt,
        }
    }

    /// A custom agent has no effort of its own.
    pub fn has_effort(&self) -> bool {
        matches!(self, Agent::Builtin(entry) if has_effort(&entry.id))
    }

    /// Where this agent's program runs from, or `None` when it cannot be run.
    /// `PLAN2CODE_APP_AGENT_BIN` still overrides the program (tests only).
    pub fn installed_at(&self) -> Option<PathBuf> {
        match self {
            Agent::Builtin(entry) => installed_at(entry),
            Agent::Custom(agent) => {
                let bin = std::env::var(AGENT_BIN_ENV).ok().filter(|b| !b.is_empty());
                let command = bin.as_deref().unwrap_or(&agent.command);
                resolve_command(command, &crate::node_check::resolved_path())
            }
        }
    }
}

/// The agent named `id`: a built-in first, else an entry of `agents.json`.
pub fn find_agent(id: &str) -> Option<Agent> {
    find_agent_in(id, agents_file().as_deref())
}

/// `find_agent` against a given agents file (`None`: built-ins only).
pub fn find_agent_in(id: &str, file: Option<&Path>) -> Option<Agent> {
    if let Some(entry) = builtin_entry(id) {
        return Some(Agent::Builtin(entry));
    }
    let (agents, _) = load_custom_agents(file?);
    agents
        .into_iter()
        .find(|agent| agent.id == id)
        .map(Agent::Custom)
}

/// Every custom agent in `~/.plan2code/agents.json`, read afresh, with the
/// warnings about anything in the file that was skipped.
pub fn custom_agents() -> (Vec<CustomAgent>, Vec<String>) {
    agents_file()
        .map(|file| load_custom_agents(&file))
        .unwrap_or_default()
}

fn clean_command(command: &str) -> &str {
    let command = command.trim();
    command
        .strip_prefix('"')
        .and_then(|c| c.strip_suffix('"'))
        .unwrap_or(command)
}

fn has_separator(command: &str, windows: bool) -> bool {
    command.contains('/') || (windows && command.contains('\\'))
}

// A file as written, or on Windows with an extension a program can have.
fn file_with_extensions(base: PathBuf) -> Option<PathBuf> {
    if base.is_file() {
        return Some(base);
    }
    if cfg!(windows) && base.extension().is_none() {
        for ext in ["exe", "cmd", "bat"] {
            let mut candidate = base.clone().into_os_string();
            candidate.push(format!(".{ext}"));
            let candidate = PathBuf::from(candidate);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Where `command` runs from: a full path is checked as a file, a bare name is
/// looked for on `path_var`. Never runs anything.
fn resolve_command(command: &str, path_var: &str) -> Option<PathBuf> {
    let command = clean_command(command);
    if command.is_empty() {
        return None;
    }
    if has_separator(command, cfg!(windows)) {
        return file_with_extensions(PathBuf::from(command));
    }
    if let Some(found) = find_on_path(command, path_var) {
        return Some(found);
    }
    // A name that already carries its extension (`tool.cmd`).
    path_var
        .split(if cfg!(windows) { ';' } else { ':' })
        .filter(|dir| !dir.is_empty())
        .map(|dir| Path::new(dir.trim_matches('"')).join(command))
        .find(|candidate| candidate.is_file())
}

/// How to start `agent` in `folder`: a built-in exactly as `launch_spec`, a
/// custom agent from its resolved command and `build_custom_args` (bypass when
/// `mode` is `Bypass`; effort does not apply).
pub fn agent_launch_spec(
    agent: &Agent,
    folder: &Path,
    model: Option<&str>,
    effort: Option<&str>,
    mode: PermissionMode,
    prompt: &str,
) -> LaunchSpec {
    match agent {
        Agent::Builtin(entry) => launch_spec(entry, folder, model, effort, mode, prompt),
        Agent::Custom(custom) => {
            if let Some(bin) = std::env::var(AGENT_BIN_ENV)
                .ok()
                .filter(|bin| !bin.is_empty())
            {
                return LaunchSpec {
                    program: bin,
                    args: vec![],
                    env: vec![],
                    cwd: folder.to_path_buf(),
                };
            }
            let resolved = agent.installed_at();
            custom_launch_spec(
                custom,
                resolved.as_deref(),
                folder,
                model,
                mode,
                prompt,
                &crate::node_check::resolved_path(),
                cfg!(windows),
            )
        }
    }
}

// `agent_launch_spec` for a custom agent, with the lookup result and the
// platform passed in so the Windows rules can be tested anywhere.
#[allow(clippy::too_many_arguments)]
fn custom_launch_spec(
    custom: &CustomAgent,
    resolved: Option<&Path>,
    folder: &Path,
    model: Option<&str>,
    mode: PermissionMode,
    prompt: &str,
    base_path: &str,
    windows: bool,
) -> LaunchSpec {
    let mut args = build_custom_args(custom, Some(prompt), model, mode == PermissionMode::Bypass);
    let mut path = base_path.to_string();
    let mut program = resolved.map_or_else(
        || clean_command(&custom.command).to_string(),
        |p| p.to_string_lossy().into_owned(),
    );
    let mut extra_env = Vec::new();
    if windows {
        let ext = resolved
            .and_then(|p| p.extension())
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if let (true, Some(file)) = (ext == "cmd" || ext == "bat", resolved) {
            let file_name = file
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            // A full path may have a space in its folder, and `cmd /c` mangles a
            // command line that starts with a quote: run the bare file name with
            // its folder at the front of the child's PATH instead.
            if has_separator(clean_command(&custom.command), true) {
                if let Some(dir) = file.parent() {
                    path = format!("{};{}", dir.to_string_lossy(), base_path);
                }
            }
            // The pseudo-terminal quotes only arguments with a space or a quote,
            // so `cmd` would read `&`, `|` or `%` in the rest itself. The line is
            // quoted as the launcher's `quoteForCmd` does and handed over in a
            // variable: `cmd` expands it once and then parses it, so its quotes
            // hold and a `%` inside it is not expanded again.
            let line: Vec<String> = std::iter::once(file_name)
                .chain(args)
                .map(|arg| quote_for_cmd(&arg))
                .collect();
            extra_env.push((CMD_LINE_ENV.to_string(), line.join(" ")));
            // `cmd` looks in the current folder (the project) before PATH: a
            // same-named file there must not run in the agent's place.
            extra_env.push((
                "NoDefaultCurrentDirectoryInExePath".to_string(),
                "1".to_string(),
            ));
            args = vec![
                "/d".to_string(),
                "/c".to_string(),
                format!("%{CMD_LINE_ENV}%"),
            ];
            program = "cmd".to_string();
        }
    }
    let mut env = vec![("PATH".to_string(), path)];
    env.append(&mut extra_env);
    LaunchSpec {
        program,
        args,
        env,
        cwd: folder.to_path_buf(),
    }
}

/// The variable a custom `.cmd` or `.bat` agent's command line reaches `cmd` in.
const CMD_LINE_ENV: &str = "PLAN2CODE_AGENT_LINE";

/// One argument of a `cmd` line, quoted when `cmd` would otherwise read it: the
/// launcher's `quoteForCmd`.
fn quote_for_cmd(arg: &str) -> String {
    let special = |c: char| c.is_whitespace() || "\"&|<>^%!()".contains(c);
    if !arg.is_empty() && !arg.chars().any(special) {
        return arg.to_string();
    }
    format!("\"{}\"", arg.replace('"', "\"\""))
}

/// The page a built-in agent installs from; any other id is an error.
pub fn install_page_url(id: &str) -> Result<String, String> {
    builtin_entry(id)
        .and_then(|entry| entry.install_url)
        .ok_or_else(|| format!("no install page for agent: {id}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A shipped built-in's entry from the baked list: deterministic in tests.
    fn entry(id: &str) -> AgentEntry {
        parse_agent_list(BAKED_AGENTS)
            .unwrap()
            .builtins
            .into_iter()
            .find(|e| e.id == id)
            .unwrap_or_else(|| panic!("no baked entry {id}"))
    }

    fn folder() -> PathBuf {
        PathBuf::from("project")
    }

    fn args(id: &str, model: Option<&str>, mode: PermissionMode, prompt: &str) -> Vec<String> {
        launch_spec_with(&entry(id), &folder(), model, None, mode, prompt, None).args
    }

    #[test]
    fn claude_puts_the_prompt_first() {
        let spec = launch_spec_with(
            &entry("claude"),
            &folder(),
            None,
            None,
            PermissionMode::Bypass,
            "/plan2code",
            None,
        );
        assert_eq!(spec.program, "claude");
        assert_eq!(
            spec.args,
            ["/plan2code", "--permission-mode", "bypassPermissions"]
        );
        assert_eq!(spec.cwd, folder());
        // A PATH that can still find nvm, Homebrew or Volta's directories (Task 9.9).
        assert_eq!(spec.env.iter().filter(|(k, _)| k == "PATH").count(), 1);
    }

    #[test]
    fn claude_with_a_model() {
        assert_eq!(
            args(
                "claude",
                Some("sonnet"),
                PermissionMode::Bypass,
                "/plan2code"
            ),
            [
                "/plan2code",
                "--permission-mode",
                "bypassPermissions",
                "--model",
                "sonnet"
            ]
        );
    }

    #[test]
    fn claude_checked_mode_skips_the_bypass_flag() {
        assert_eq!(
            args("claude", None, PermissionMode::Checked, "/plan2code"),
            ["/plan2code"]
        );
    }

    #[test]
    fn claude_with_an_effort() {
        let spec = launch_spec_with(
            &entry("claude"),
            &folder(),
            None,
            Some("high"),
            PermissionMode::Bypass,
            "/plan2code",
            None,
        );
        assert_eq!(
            spec.args,
            [
                "/plan2code",
                "--permission-mode",
                "bypassPermissions",
                "--effort",
                "high"
            ]
        );
    }

    #[test]
    fn a_full_launch_card_choice_carries_model_effort_and_mode_together() {
        let spec = launch_spec_with(
            &entry("claude"),
            &folder(),
            Some("opus"),
            Some("xhigh"),
            PermissionMode::Bypass,
            "/plan2code",
            None,
        );
        assert_eq!(
            spec.args,
            [
                "/plan2code",
                "--permission-mode",
                "bypassPermissions",
                "--model",
                "opus",
                "--effort",
                "xhigh"
            ]
        );
        let checked = launch_spec_with(
            &entry("codex"),
            &folder(),
            Some("gpt-5"),
            Some("medium"),
            PermissionMode::Checked,
            "$plan2code",
            None,
        );
        assert_eq!(
            checked.args,
            [
                "--model",
                "gpt-5",
                "-c",
                "model_reasoning_effort=medium",
                "$plan2code"
            ]
        );
    }

    #[test]
    fn devin_puts_the_prompt_after_a_double_dash() {
        let spec = launch_spec_with(
            &entry("devin"),
            &folder(),
            None,
            None,
            PermissionMode::Bypass,
            "/plan2code",
            None,
        );
        assert_eq!(spec.program, "devin");
        assert_eq!(
            spec.args,
            ["--permission-mode", "bypass", "--", "/plan2code"]
        );
    }

    #[test]
    fn devin_with_a_model_keeps_the_prompt_last() {
        assert_eq!(
            args("devin", Some("opus"), PermissionMode::Bypass, "/plan2code"),
            [
                "--permission-mode",
                "bypass",
                "--model",
                "opus",
                "--",
                "/plan2code"
            ]
        );
    }

    #[test]
    fn devin_checked_mode_skips_the_bypass_flag() {
        assert_eq!(
            args("devin", None, PermissionMode::Checked, "/plan2code"),
            ["--", "/plan2code"]
        );
    }

    #[test]
    fn codex_uses_its_own_flag_and_dollar_prompt() {
        let prompt = entry("codex").prompt;
        let spec = launch_spec_with(
            &entry("codex"),
            &folder(),
            None,
            None,
            PermissionMode::Bypass,
            &prompt,
            None,
        );
        assert_eq!(spec.program, "codex");
        assert_eq!(
            spec.args,
            ["--dangerously-bypass-approvals-and-sandbox", "$plan2code"]
        );
    }

    #[test]
    fn codex_with_a_model() {
        assert_eq!(
            args("codex", Some("gpt-5"), PermissionMode::Bypass, "$plan2code"),
            [
                "--dangerously-bypass-approvals-and-sandbox",
                "--model",
                "gpt-5",
                "$plan2code"
            ]
        );
    }

    #[test]
    fn codex_with_an_effort_uses_a_config_override() {
        let spec = launch_spec_with(
            &entry("codex"),
            &folder(),
            None,
            Some("low"),
            PermissionMode::Bypass,
            "$plan2code",
            None,
        );
        assert_eq!(
            spec.args,
            [
                "--dangerously-bypass-approvals-and-sandbox",
                "-c",
                "model_reasoning_effort=low",
                "$plan2code"
            ]
        );
    }

    #[test]
    fn codex_checked_mode_skips_the_bypass_flag() {
        assert_eq!(
            args("codex", None, PermissionMode::Checked, "$plan2code"),
            ["$plan2code"]
        );
    }

    #[test]
    fn no_prompt_means_nothing_typed() {
        assert_eq!(
            args("claude", None, PermissionMode::Bypass, ""),
            ["--permission-mode", "bypassPermissions"]
        );
        assert_eq!(
            args("devin", None, PermissionMode::Bypass, ""),
            ["--permission-mode", "bypass", "--"]
        );
        assert_eq!(
            args("codex", None, PermissionMode::Bypass, ""),
            ["--dangerously-bypass-approvals-and-sandbox"]
        );
    }

    #[test]
    fn a_custom_prompt_is_passed_through() {
        assert_eq!(
            args(
                "claude",
                None,
                PermissionMode::Bypass,
                "/plan2code pick up the brief"
            ),
            [
                "/plan2code pick up the brief",
                "--permission-mode",
                "bypassPermissions"
            ]
        );
    }

    #[test]
    fn devin_has_no_effort_of_its_own() {
        assert!(!has_effort("devin"));
        assert!(has_effort("claude"));
        assert!(has_effort("codex"));
    }

    #[test]
    fn permission_mode_ids_round_trip() {
        for mode in [PermissionMode::Checked, PermissionMode::Bypass] {
            assert_eq!(PermissionMode::from_id(mode.id()), Some(mode));
        }
        assert_eq!(PermissionMode::from_id("nope"), None);
    }

    #[test]
    fn the_override_replaces_the_program_for_every_kind() {
        for entry in [entry("claude"), entry("devin"), entry("codex")] {
            let spec = launch_spec_with(
                &entry,
                &folder(),
                Some("m"),
                Some("high"),
                PermissionMode::Bypass,
                "/plan2code",
                Some("fake-agent"),
            );
            assert_eq!(spec.program, "fake-agent");
            assert!(spec.args.is_empty());
        }
    }

    #[test]
    fn find_on_path_sees_only_what_is_really_there() {
        let dir = std::env::temp_dir().join(format!("plan2code-findonpath-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let name = if cfg!(windows) { "tool.exe" } else { "tool" };
        std::fs::write(dir.join(name), "").unwrap();
        // A name whose extension PATHEXT never lists is not found, either.
        #[cfg(windows)]
        std::fs::write(dir.join("other.xyz"), "").unwrap();
        let path = dir.to_string_lossy().into_owned();
        assert_eq!(find_on_path("tool", &path), Some(dir.join(name)));
        #[cfg(windows)]
        assert_eq!(find_on_path("other", &path), None);
        assert_eq!(find_on_path("missing-tool", &path), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_baked_list_matches_the_shipped_agents_json() {
        // include_str! means the baked copy IS src/launcher/agents.json; this
        // pins its schema so a drift between the app's structs and the file
        // shows up here, not at runtime.
        let list = parse_agent_list(BAKED_AGENTS).expect("the baked list parses");
        assert_eq!(
            list.builtins
                .iter()
                .map(|e| e.id.as_str())
                .collect::<Vec<_>>(),
            ["claude", "devin", "codex"]
        );
        assert_eq!(
            list.templates
                .iter()
                .map(|e| e.id.as_str())
                .collect::<Vec<_>>(),
            ["copilot", "opencode", "gemini", "pi", "cursor"]
        );
        assert!(list
            .builtins
            .iter()
            .all(|e| !e.command.is_empty() && !e.args.is_empty()));
    }

    #[test]
    fn the_list_loader_rejects_a_bad_file_and_reads_the_installed_path() {
        // Not JSON, not an object, or the wrong schema is an error: the
        // caller then falls back to the baked copy with a warning.
        assert!(parse_agent_list("not json").is_err());
        assert!(parse_agent_list("[]").is_err());
        assert!(parse_agent_list(r#"{"schema":2,"agents":[]}"#).is_err());
        // The file the loader reads is the launcher's own bin dir, beside
        // plan2code.js and version.json.
        let file = agent_list_file().expect("a home");
        assert!(file.ends_with(std::path::Path::new("bin").join("agents.json")));
        // Whatever is installed, a shipped built-in resolves to its entry.
        assert!(builtin_entry("claude").is_some());
        // Unknown kinds are skipped with a warning, not an error.
        let list = parse_agent_list(
            r#"{"schema":1,"agents":[{"id":"x","name":"X","kind":"future","command":"x"},{"id":"y","name":"Y","kind":"builtin","command":"y"}]}"#,
        )
        .unwrap();
        assert_eq!(list.builtins.len(), 1);
        assert_eq!(list.warnings.len(), 1);
    }

    /// Every case in the shared lookup fixture, under its own platform's
    /// rules (Task 3.4): the same file drives scripts/test-agent-lookup.mjs,
    /// so the Node and Rust lookups stay the one rule.
    #[test]
    fn the_shared_lookup_cases_all_answer_the_same() {
        // The .cmd cases check a shim's lookup; cmd's own current-folder rule
        // must not color a temp-folder stat, so the switch is cleared.
        std::env::remove_var("NoDefaultCurrentDirectoryInExePath");
        let cases: Value = serde_json::from_str(include_str!(
            "../../../scripts/fixtures/agent-lookup-cases.json"
        ))
        .unwrap();
        for (index, case) in cases["cases"].as_array().unwrap().iter().enumerate() {
            let name = case["name"].as_str().unwrap();
            let root =
                std::env::temp_dir().join(format!("p2c-lookup-{}-{index}", std::process::id()));
            let _ = std::fs::remove_dir_all(&root);
            let mut dirs: std::collections::HashMap<String, String> = Default::default();
            if let Some(map) = case["dirs"].as_object() {
                for (dir_name, files) in map {
                    let dir = root.join(dir_name).to_string_lossy().into_owned();
                    for file in files.as_array().into_iter().flatten() {
                        let target = std::path::Path::new(&dir).join(file.as_str().unwrap());
                        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
                        std::fs::write(target, b"").unwrap();
                    }
                    let _ = std::fs::create_dir_all(&dir);
                    dirs.insert(dir_name.clone(), dir);
                }
            }
            // `{name}` in a value expands to that folder's path, making the
            // dir on demand as the Node side's fill() does; collecting them
            // first keeps `fill` a read.
            let mut collect = |text: &str| {
                let mut rest = text;
                while let Some(at) = rest.find('{') {
                    let Some(end) = rest[at..].find('}') else {
                        break;
                    };
                    let key = &rest[at + 1..at + end];
                    dirs.entry(key.to_string())
                        .or_insert_with(|| root.join(key).to_string_lossy().into_owned());
                    rest = &rest[at + end + 1..];
                }
            };
            let env_obj = case["env"].as_object().cloned().unwrap_or_default();
            for value in env_obj.values().flat_map(|v| {
                let mut all: Vec<&str> = v.as_str().into_iter().collect();
                if let Some(map) = v.as_object() {
                    all.extend(map.values().filter_map(Value::as_str));
                }
                all
            }) {
                collect(value);
            }
            for s in [case["entry"]["command"].as_str(), case["folder"].as_str()]
                .into_iter()
                .flatten()
            {
                collect(s);
            }
            if let Some(map) = case["entry"]["installDirs"].as_object() {
                for list in map.values() {
                    for d in list.as_array().into_iter().flatten() {
                        if let Some(s) = d.as_str() {
                            collect(s);
                        }
                    }
                }
            }
            // `{name}` in a value expands to that folder's path.
            let fill = |value: &str| -> String {
                let mut out = value.to_string();
                while let Some(at) = out.find('{') {
                    let Some(end) = out[at..].find('}') else {
                        break;
                    };
                    let key = &out[at + 1..at + end];
                    let dir = dirs.get(key).cloned().unwrap_or_default();
                    out = format!("{}{}{}", &out[..at], dir, &out[at + end + 1..]);
                }
                out
            };
            let val = |key: &str| env_obj.get(key).and_then(Value::as_str).map(&fill);
            let env = LookupEnv {
                path: val("path"),
                saved_path: val("savedPath"),
                npm_bin: val("npmBin"),
                pathext: val("pathext"),
                platform: case["platform"].as_str().map(String::from),
                home: val("home"),
                vars: env_obj
                    .get("vars")
                    .and_then(Value::as_object)
                    .map(|vars| {
                        vars.iter()
                            .map(|(k, v)| (k.clone(), fill(v.as_str().unwrap())))
                            .collect()
                    })
                    .unwrap_or_default(),
            };
            let mut entry = AgentEntry {
                id: "case".into(),
                name: "case".into(),
                kind: "builtin".into(),
                command: String::new(),
                prompt: String::new(),
                args: vec![],
                bypass_args: vec![],
                model_args: vec![],
                install_url: None,
                install: PerOs::default(),
                install_dirs: PerOs::default(),
                note: None,
            };
            entry.command = fill(case["entry"]["command"].as_str().unwrap_or_default());
            // The fixture's `\` in installDirs names a Windows folder; the
            // temp file was made the host's way, so spell the dir the same
            // (Windows itself takes either separator).
            if let Some(map) = case["entry"]["installDirs"].as_object() {
                for (os, list) in map {
                    let dirs_list: Vec<String> = list
                        .as_array()
                        .into_iter()
                        .flatten()
                        .map(|d| fill(&d.as_str().unwrap_or_default().replace('\\', "/")))
                        .collect();
                    match os.as_str() {
                        "win" => entry.install_dirs.win = dirs_list,
                        "mac" => entry.install_dirs.mac = dirs_list,
                        _ => entry.install_dirs.linux = dirs_list,
                    }
                }
            }
            let got = lookup_agent_in(&entry, &env);
            let want_state = case["state"].as_str().unwrap();
            assert_eq!(got.state, want_state, "{name}: state");
            assert_eq!(got.where_, case["where"].as_str(), "{name}: where");
            if want_state == "missing" {
                assert_eq!(got.path, None, "{name}: path");
                assert_eq!(got.folder, None, "{name}: folder");
            } else {
                let hit = got.path.clone().expect("a path for a found entry");
                assert!(hit.is_file(), "{name}: path is a real file");
                if let Some(file) = case["file"].as_str() {
                    assert_eq!(hit.file_name().unwrap().to_str(), Some(file), "{name}");
                }
                if let Some(folder) = case["folder"].as_str() {
                    assert_eq!(
                        got.folder.as_deref(),
                        Some(std::path::Path::new(&fill(folder))),
                        "{name}: folder"
                    );
                }
            }
            let _ = std::fs::remove_dir_all(&root);
        }
    }

    #[test]
    fn a_cmd_shim_runs_through_cmd_and_the_extensionless_script_is_ignored() {
        let dir = std::env::temp_dir().join(format!("plan2code-shim-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("tool"), "#!/bin/sh").unwrap();
        std::fs::write(dir.join("tool.cmd"), "@echo off").unwrap();
        std::fs::write(dir.join("real.exe"), "").unwrap();
        let path = dir.to_string_lossy().into_owned();
        let args = vec!["--flag".to_string()];

        let (program, wrapped) = windows_command("tool", args.clone(), &path);
        assert_eq!(program, "cmd");
        assert_eq!(
            wrapped,
            [
                "/c".to_string(),
                "tool.cmd".to_string(),
                "--flag".to_string()
            ]
        );

        let (program, same) = windows_command("real", args.clone(), &path);
        assert_eq!(program, dir.join("real.exe").to_string_lossy());
        assert_eq!(same, args);

        assert_eq!(
            windows_command("missing", args.clone(), &path),
            ("missing".to_string(), args)
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ids_round_trip() {
        for entry in [entry("claude"), entry("devin"), entry("codex")] {
            assert_eq!(builtin_entry(&entry.id), Some(entry));
        }
        assert!(builtin_entry("nope").is_none());
    }

    /* ------------------------------------------------------ custom agents */

    const CASES: &str = include_str!("../../../scripts/fixtures/agents-cases.json");

    fn cases() -> Value {
        serde_json::from_str(CASES).unwrap()
    }

    #[test]
    fn the_fixture_files_cases_read_the_same() {
        let cases = cases();
        let files = cases["files"].as_array().unwrap();
        assert!(files.len() >= 20);
        for case in files {
            let name = case["name"].as_str().unwrap();
            let (agents, warnings) = match case["raw"].as_str() {
                Some(raw) => parse_agents_file(raw),
                None => (Vec::new(), Vec::new()),
            };
            let want: Vec<CustomAgent> = serde_json::from_value(case["agents"].clone()).unwrap();
            assert_eq!(agents, want, "{name}");
            let parts = case["warnings"].as_array().unwrap();
            if parts.is_empty() {
                assert!(warnings.is_empty(), "{name}: {warnings:?}");
            }
            for part in parts {
                let part = part.as_str().unwrap();
                assert!(
                    warnings.iter().any(|w| w.contains(part)),
                    "{name}: no warning names {part}: {warnings:?}"
                );
            }
        }
    }

    #[test]
    fn the_fixture_build_args_cases_build_the_same() {
        let cases = cases();
        let list = cases["buildArgs"].as_array().unwrap();
        assert!(list.len() >= 10);
        for case in list {
            let name = case["name"].as_str().unwrap();
            let entry: CustomAgent = serde_json::from_value(case["entry"].clone()).unwrap();
            let options = &case["options"];
            let got = build_custom_args(
                &entry,
                options["prompt"].as_str(),
                options["model"].as_str(),
                options["bypass"].as_bool().unwrap_or(false),
            );
            let want: Vec<String> = serde_json::from_value(case["args"].clone()).unwrap();
            assert_eq!(got, want, "{name}");
        }
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("plan2code-agents-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    const GOOSE: &str = r#"{"schema":1,"agents":[{"id":"goose","name":"Goose","command":"goose","args":["{prompt}"],"bypassArgs":["--yes"]}]}"#;

    #[test]
    fn a_missing_file_is_empty_and_a_bad_one_warns() {
        let dir = temp_dir("load");
        assert_eq!(
            load_custom_agents(&dir.join("agents.json")),
            (Vec::new(), Vec::new())
        );
        std::fs::write(dir.join("agents.json"), "{ nope").unwrap();
        let (agents, warnings) = load_custom_agents(&dir.join("agents.json"));
        assert!(agents.is_empty() && warnings.len() == 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_agent_prefers_built_ins_then_the_file() {
        let dir = temp_dir("find");
        let file = dir.join("agents.json");
        std::fs::write(&file, GOOSE).unwrap();
        assert_eq!(
            find_agent_in("claude", Some(&file)),
            Some(Agent::Builtin(entry("claude")))
        );
        let goose = find_agent_in("goose", Some(&file)).unwrap();
        assert_eq!(
            (
                goose.id(),
                goose.label(),
                goose.has_effort(),
                goose.default_prompt()
            ),
            ("goose", "Goose", false, "/plan2code")
        );
        assert_eq!(find_agent_in("goose", None), None);
        assert_eq!(find_agent_in("nope", Some(&file)), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn goose() -> CustomAgent {
        parse_agents_file(GOOSE).0.remove(0)
    }

    #[test]
    fn a_custom_launch_spec_has_its_program_and_arguments() {
        let bin = Path::new("tools").join("goose");
        let spec = custom_launch_spec(
            &goose(),
            Some(&bin),
            &folder(),
            None,
            PermissionMode::Checked,
            "/plan2code",
            "P",
            false,
        );
        assert_eq!(spec.program, bin.to_string_lossy());
        assert_eq!(spec.args, ["/plan2code"]);
        assert_eq!(spec.env, [("PATH".to_string(), "P".to_string())]);
        let spec = custom_launch_spec(
            &goose(),
            Some(&bin),
            &folder(),
            Some("m"),
            PermissionMode::Bypass,
            "/plan2code",
            "P",
            false,
        );
        assert_eq!(spec.args, ["/plan2code", "--model", "m", "--yes"]);
        let spec = custom_launch_spec(
            &goose(),
            None,
            &folder(),
            None,
            PermissionMode::Checked,
            "",
            "P",
            false,
        );
        assert_eq!((spec.program.as_str(), spec.args.len()), ("goose", 0));
    }

    #[test]
    fn a_windows_cmd_runs_through_cmd_with_its_folder_on_path_for_a_full_path() {
        let mut full = goose();
        full.command = "C:\\with space\\goose.cmd".to_string();
        let found = Path::new("C:\\with space").join("goose.cmd");
        let spec = custom_launch_spec(
            &full,
            Some(&found),
            &folder(),
            None,
            PermissionMode::Checked,
            "/p",
            "BASE",
            true,
        );
        assert_eq!(spec.program, "cmd");
        assert_eq!(spec.args, ["/d", "/c", "%PLAN2CODE_AGENT_LINE%"]);
        assert_eq!(
            spec.env[0].1,
            format!("{};BASE", found.parent().unwrap().to_string_lossy())
        );
        assert_eq!(
            spec.env[1],
            (
                "PLAN2CODE_AGENT_LINE".to_string(),
                "goose.cmd /p".to_string()
            )
        );
        assert_eq!(
            spec.env[2],
            (
                "NoDefaultCurrentDirectoryInExePath".to_string(),
                "1".to_string()
            )
        );
        // A bare name keeps the plain PATH.
        let bare = custom_launch_spec(
            &goose(),
            Some(&found),
            &folder(),
            None,
            PermissionMode::Checked,
            "/p",
            "BASE",
            true,
        );
        assert_eq!(
            (bare.program.as_str(), bare.env[0].1.as_str()),
            ("cmd", "BASE")
        );
    }

    #[test]
    fn a_cmd_line_quotes_what_cmd_would_read_as_the_launcher_does() {
        assert_eq!(quote_for_cmd("--yes"), "--yes");
        assert_eq!(quote_for_cmd(""), "\"\"");
        assert_eq!(quote_for_cmd("a|b"), "\"a|b\"");
        assert_eq!(quote_for_cmd("%X%"), "\"%X%\"");
        assert_eq!(quote_for_cmd("say \"hi\""), "\"say \"\"hi\"\"\"");
        let mut agent = goose();
        agent.args = vec!["--filter=a|b".to_string(), "{prompt}".to_string()];
        let found = Path::new("C:\\tools").join("goose.cmd");
        let spec = custom_launch_spec(
            &agent,
            Some(&found),
            &folder(),
            None,
            PermissionMode::Checked,
            "/p & x",
            "BASE",
            true,
        );
        assert_eq!(spec.env[1].1, "goose.cmd \"--filter=a|b\" \"/p & x\"");
    }

    #[cfg(windows)]
    #[test]
    fn a_full_path_cmd_in_a_spaced_folder_runs_with_its_arguments_intact_and_not_a_project_copy() {
        let root = temp_dir("spaced");
        let dir = root.join("with space");
        let project = root.join("project");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::create_dir_all(&project).unwrap();
        std::fs::write(
            dir.join("goose.cmd"),
            "@echo off\r\necho REAL [%1] [%2]\r\n",
        )
        .unwrap();
        // A same-named file in the project folder must not run instead.
        std::fs::write(project.join("goose.cmd"), "@echo off\r\necho DECOY\r\n").unwrap();
        let mut agent = goose();
        agent.command = dir.join("goose.cmd").to_string_lossy().into_owned();
        agent.args = vec!["a|b".to_string(), "%PATH%".to_string()];
        let found = Agent::Custom(agent.clone())
            .installed_at()
            .expect("resolves");
        let spec = custom_launch_spec(
            &agent,
            Some(&found),
            &project,
            None,
            PermissionMode::Checked,
            "",
            &std::env::var("PATH").unwrap_or_default(),
            true,
        );
        let mut command = std::process::Command::new(&spec.program);
        // Some shells already set the switch the spec sets; start without it.
        command
            .args(&spec.args)
            .current_dir(&spec.cwd)
            .env_remove("NoDefaultCurrentDirectoryInExePath");
        for (key, value) in &spec.env {
            command.env(key, value);
        }
        let out = command.output().expect("cmd runs");
        let text = String::from_utf8_lossy(&out.stdout);
        assert_eq!(text.trim(), "REAL [\"a|b\"] [\"%PATH%\"]", "{text}");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn install_pages_are_for_built_ins_only() {
        assert_eq!(
            install_page_url("codex").unwrap(),
            "https://github.com/openai/codex"
        );
        assert!(install_page_url("goose").is_err());
        for entry in [entry("claude"), entry("devin"), entry("codex")] {
            assert!(entry.install_url.unwrap().starts_with("https://"));
        }
    }
}
