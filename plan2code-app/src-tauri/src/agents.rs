//! The agents the app can run and the command line each one starts with. The
//! flags are the ones `src/launcher/plan2code.js` uses today, so the app and
//! `plan2code` start an agent the same way. Knows nothing about Tauri.

use std::path::{Path, PathBuf};

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Tests only: run this program instead of the real agent, for any `AgentKind`,
/// so the fake agent stands in for Claude, Devin and Codex.
pub const AGENT_BIN_ENV: &str = "PLAN2CODE_APP_AGENT_BIN";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentKind {
    Claude,
    Devin,
    Codex,
}

impl AgentKind {
    pub const ALL: [AgentKind; 3] = [AgentKind::Claude, AgentKind::Devin, AgentKind::Codex];

    /// The id the page and the settings file use.
    pub fn id(self) -> &'static str {
        match self {
            AgentKind::Claude => "claude",
            AgentKind::Devin => "devin",
            AgentKind::Codex => "codex",
        }
    }

    pub fn from_id(id: &str) -> Option<AgentKind> {
        AgentKind::ALL.into_iter().find(|kind| kind.id() == id)
    }

    pub fn label(self) -> &'static str {
        match self {
            AgentKind::Claude => "Claude Code",
            AgentKind::Devin => "Devin",
            AgentKind::Codex => "Codex",
        }
    }

    /// What a first start types: the skill that opens the dashboard. Codex
    /// mentions a skill with `$name`.
    pub fn default_prompt(self) -> &'static str {
        match self {
            AgentKind::Codex => "$plan2code",
            _ => "/plan2code",
        }
    }

    /// The program this agent runs as, before any PATH resolution.
    pub fn program_name(self) -> &'static str {
        match self {
            AgentKind::Claude => "claude",
            AgentKind::Devin => "devin",
            AgentKind::Codex => "codex",
        }
    }

    /// Whether this agent takes a separate reasoning effort. Devin's model
    /// ids already carry effort (`swe-2-high`), so it has none of its own.
    pub fn has_effort(self) -> bool {
        matches!(self, AgentKind::Claude | AgentKind::Codex)
    }

    /// Where to install this agent: an npm command or, with no package of its
    /// own, the site to install from. The same text `src/launcher/plan2code.js`
    /// shows for a missing CLI.
    pub fn install_hint(self) -> &'static str {
        match self {
            AgentKind::Claude => "npm i -g @anthropic-ai/claude-code",
            AgentKind::Devin => "https://devin.ai",
            AgentKind::Codex => "npm i -g @openai/codex",
        }
    }

    /// The official page to install this agent from. The same links as the
    /// launcher's `CLIS` and the overview's Quick Reference: change all together.
    pub fn install_url(self) -> &'static str {
        match self {
            AgentKind::Claude => "https://code.claude.com/docs/en/setup",
            AgentKind::Devin => "https://docs.devin.ai/work-with-devin/devin-cli",
            AgentKind::Codex => "https://github.com/openai/codex",
        }
    }
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

/// Whether `program` exists on `path_var`: an exact file on macOS and Linux,
/// or with `.exe`, `.cmd` or `.bat` on Windows (as `windows_command` resolves
/// a program to run).
pub fn find_on_path(program: &str, path_var: &str) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(windows) { &["exe", "cmd", "bat"] } else { &[""] };
    path_var.split(if cfg!(windows) { ';' } else { ':' }).filter(|dir| !dir.is_empty()).find_map(|dir| {
        exts.iter().find_map(|ext| {
            let name = if ext.is_empty() { program.to_string() } else { format!("{program}.{ext}") };
            let candidate = Path::new(dir).join(name);
            candidate.is_file().then_some(candidate)
        })
    })
}

/// Where `kind`'s CLI runs from: the test override when it is set, else its
/// program name on PATH. `None` means it cannot be run.
pub fn installed_at(kind: AgentKind) -> Option<PathBuf> {
    let bin = std::env::var(AGENT_BIN_ENV).ok().filter(|b| !b.is_empty());
    let program = bin.unwrap_or_else(|| kind.program_name().to_string());
    find_on_path(&program, crate::node_check::resolved_path())
}

/// Whether `kind`'s CLI can be run at all.
pub fn is_installed(kind: AgentKind) -> bool {
    installed_at(kind).is_some()
}

/// A command to run in the pseudo-terminal.
#[derive(Debug, PartialEq, Eq)]
pub struct LaunchSpec {
    pub program: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub cwd: PathBuf,
}

/// How to start `kind` in `folder`. An empty `prompt` starts the agent with
/// nothing typed. `PLAN2CODE_APP_AGENT_BIN` replaces the program (tests only).
pub fn launch_spec(
    kind: AgentKind,
    folder: &Path,
    model: Option<&str>,
    effort: Option<&str>,
    mode: PermissionMode,
    prompt: &str,
) -> LaunchSpec {
    let bin = std::env::var(AGENT_BIN_ENV).ok().filter(|bin| !bin.is_empty());
    let mut spec = launch_spec_with(kind, folder, model, effort, mode, prompt, bin.as_deref());
    // The override names a program to run as it is; a real agent is looked up on PATH.
    if cfg!(windows) && bin.is_none() {
        let (program, args) = windows_command(&spec.program, spec.args, &std::env::var("PATH").unwrap_or_default());
        spec.program = program;
        spec.args = args;
    }
    spec
}

fn launch_spec_with(
    kind: AgentKind,
    folder: &Path,
    model: Option<&str>,
    effort: Option<&str>,
    mode: PermissionMode,
    prompt: &str,
    bin_override: Option<&str>,
) -> LaunchSpec {
    let cwd = folder.to_path_buf();
    if let Some(bin) = bin_override {
        return LaunchSpec { program: bin.to_string(), args: vec![], env: vec![], cwd };
    }

    let strings = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    let model_args = |args: &mut Vec<String>| {
        if let Some(model) = model {
            args.push("--model".to_string());
            args.push(model.to_string());
        }
    };
    let bypass = mode == PermissionMode::Bypass;
    let mut args = Vec::new();
    let program = match kind {
        AgentKind::Claude => {
            if !prompt.is_empty() {
                args.push(prompt.to_string());
            }
            if bypass {
                args.extend(strings(&["--permission-mode", "bypassPermissions"]));
            }
            model_args(&mut args);
            if let Some(effort) = effort {
                args.push("--effort".to_string());
                args.push(effort.to_string());
            }
            "claude"
        }
        AgentKind::Devin => {
            if bypass {
                args.extend(strings(&["--permission-mode", "bypass"]));
            }
            model_args(&mut args);
            if !prompt.is_empty() {
                args.push("--".to_string());
                args.push(prompt.to_string());
            }
            "devin"
        }
        AgentKind::Codex => {
            if bypass {
                args.extend(strings(&["--dangerously-bypass-approvals-and-sandbox"]));
            }
            model_args(&mut args);
            if let Some(effort) = effort {
                args.push("-c".to_string());
                args.push(format!("model_reasoning_effort={effort}"));
            }
            if !prompt.is_empty() {
                args.push(prompt.to_string());
            }
            "codex"
        }
    };
    // A Dock or Start-menu launch often lacks nvm, Homebrew or Volta's
    // directories (Task 9.9): the agent CLI itself, and anything it shells
    // out to, needs a PATH that finds them anyway.
    let env = vec![("PATH".to_string(), crate::node_check::resolved_path().to_string())];
    LaunchSpec { program: program.to_string(), args, env, cwd }
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
const BUILTIN_IDS: [&str; 3] = ["claude", "devin", "codex"];
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
        Err(e) => (Vec::new(), vec![format!("agents.json could not be read ({e}), so no custom agents are used")]),
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
        let shown = file.get("schema").map_or("undefined".to_string(), |v| v.to_string());
        return none(format!("agents.json has schema {shown}, not 1, so no custom agents are used"));
    }
    let list = match file.get("agents") {
        None | Some(Value::Null) => return (Vec::new(), Vec::new()),
        Some(Value::Array(list)) => list,
        Some(_) => return none("agents.json: agents is not a list, so no custom agents are used".to_string()),
    };

    let mut warnings = Vec::new();
    let mut list: &[Value] = list;
    if list.len() > MAX_CUSTOM_AGENTS {
        warnings.push(format!("agents.json lists {} agents; only the first {MAX_CUSTOM_AGENTS} are used", list.len()));
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
    let first_ok = chars.next().is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit());
    first_ok && id.len() <= 32 && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
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
fn check_entry(entry: &Value, ids: &HashSet<String>, names: &HashSet<String>) -> Result<CustomAgent, String> {
    let Some(object) = entry.as_object() else { return Err("not an object".to_string()) };
    let id = match object.get("id").and_then(Value::as_str) {
        Some(id) if !id.is_empty() => id,
        _ => return Err("id is missing".to_string()),
    };
    if BUILTIN_IDS.contains(&id) {
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

    let name = object.get("name").and_then(Value::as_str).map_or("", str::trim);
    if name.is_empty() {
        return Err("name is missing".to_string());
    }
    if name.encode_utf16().count() > MAX_NAME {
        return Err(format!("name is longer than {MAX_NAME} characters"));
    }
    if names.contains(&name.to_lowercase()) {
        return Err(format!("name \"{name}\" is already used"));
    }

    let command = object.get("command").and_then(Value::as_str).map_or("", str::trim);
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
                let label = item.get("label").and_then(Value::as_str).map(str::trim).filter(|l| !l.is_empty());
                models.push(CustomModel { id: model_id.to_string(), label: label.map(str::to_string) });
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

/// The arguments that start a custom agent, in order (`buildArgs` in
/// agents.mjs): `args` with `{prompt}` filled (the prompt appended when no
/// argument holds it), then `model_args` when a model is chosen, then
/// `bypass_args` when checks are off. `prompt` defaults to the entry's own; a
/// blank one drops an argument that is exactly `{prompt}`. Plain text only.
pub fn build_custom_args(agent: &CustomAgent, prompt: Option<&str>, model: Option<&str>, bypass: bool) -> Vec<String> {
    let text = prompt.unwrap_or(&agent.prompt);
    let blank = text.trim().is_empty();
    let mut out = Vec::new();
    let mut placed = false;
    for arg in &agent.args {
        if !arg.contains("{prompt}") {
            out.push(arg.clone());
            continue;
        }
        placed = true;
        if arg == "{prompt}" && blank {
            continue;
        }
        out.push(arg.replace("{prompt}", text));
    }
    if !placed && !blank {
        out.push(text.to_string());
    }
    if let Some(model) = model.filter(|m| !m.is_empty()) {
        out.extend(agent.model_args.iter().map(|arg| arg.replace("{model}", model)));
    }
    if bypass {
        out.extend(agent.bypass_args.iter().cloned());
    }
    out
}

/// An agent the app can run: one of the three built-ins or a custom entry.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Agent {
    Builtin(AgentKind),
    Custom(CustomAgent),
}

impl Agent {
    pub fn id(&self) -> &str {
        match self {
            Agent::Builtin(kind) => kind.id(),
            Agent::Custom(agent) => &agent.id,
        }
    }

    pub fn label(&self) -> &str {
        match self {
            Agent::Builtin(kind) => kind.label(),
            Agent::Custom(agent) => &agent.name,
        }
    }

    /// What a first start types.
    pub fn default_prompt(&self) -> &str {
        match self {
            Agent::Builtin(kind) => kind.default_prompt(),
            Agent::Custom(agent) => &agent.prompt,
        }
    }

    /// A custom agent has no effort of its own.
    pub fn has_effort(&self) -> bool {
        matches!(self, Agent::Builtin(kind) if kind.has_effort())
    }

    /// Where this agent's program runs from, or `None` when it cannot be run.
    /// `PLAN2CODE_APP_AGENT_BIN` still overrides the program (tests only).
    pub fn installed_at(&self) -> Option<PathBuf> {
        match self {
            Agent::Builtin(kind) => installed_at(*kind),
            Agent::Custom(agent) => {
                let bin = std::env::var(AGENT_BIN_ENV).ok().filter(|b| !b.is_empty());
                let command = bin.as_deref().unwrap_or(&agent.command);
                resolve_command(command, crate::node_check::resolved_path())
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
    if let Some(kind) = AgentKind::from_id(id) {
        return Some(Agent::Builtin(kind));
    }
    let (agents, _) = load_custom_agents(file?);
    agents.into_iter().find(|agent| agent.id == id).map(Agent::Custom)
}

/// Every custom agent in `~/.plan2code/agents.json`, read afresh.
pub fn custom_agents() -> Vec<CustomAgent> {
    agents_file().map(|file| load_custom_agents(&file).0).unwrap_or_default()
}

fn clean_command(command: &str) -> &str {
    let command = command.trim();
    command.strip_prefix('"').and_then(|c| c.strip_suffix('"')).unwrap_or(command)
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
        Agent::Builtin(kind) => launch_spec(*kind, folder, model, effort, mode, prompt),
        Agent::Custom(custom) => {
            if let Some(bin) = std::env::var(AGENT_BIN_ENV).ok().filter(|bin| !bin.is_empty()) {
                return LaunchSpec { program: bin, args: vec![], env: vec![], cwd: folder.to_path_buf() };
            }
            let resolved = agent.installed_at();
            custom_launch_spec(
                custom,
                resolved.as_deref(),
                folder,
                model,
                mode,
                prompt,
                crate::node_check::resolved_path(),
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
    let mut program =
        resolved.map_or_else(|| clean_command(&custom.command).to_string(), |p| p.to_string_lossy().into_owned());
    if windows {
        let ext = resolved.and_then(|p| p.extension()).map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
        if let (true, Some(file)) = (ext == "cmd" || ext == "bat", resolved) {
            let file_name = file.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            // A full path may have a space in its folder, and `cmd /c` mangles a
            // command line that starts with a quote: run the bare file name with
            // its folder at the front of the child's PATH instead.
            if has_separator(clean_command(&custom.command), true) {
                if let Some(dir) = file.parent() {
                    path = format!("{};{}", dir.to_string_lossy(), base_path);
                }
            }
            let mut wrapped = vec!["/c".to_string(), file_name];
            wrapped.append(&mut args);
            args = wrapped;
            program = "cmd".to_string();
        }
    }
    LaunchSpec { program, args, env: vec![("PATH".to_string(), path)], cwd: folder.to_path_buf() }
}

/// The page a built-in agent installs from; any other id is an error.
pub fn install_page_url(id: &str) -> Result<&'static str, String> {
    AgentKind::from_id(id).map(AgentKind::install_url).ok_or_else(|| format!("no install page for agent: {id}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder() -> PathBuf {
        PathBuf::from("project")
    }

    fn args(kind: AgentKind, model: Option<&str>, mode: PermissionMode, prompt: &str) -> Vec<String> {
        launch_spec_with(kind, &folder(), model, None, mode, prompt, None).args
    }

    #[test]
    fn claude_puts_the_prompt_first() {
        let spec = launch_spec_with(AgentKind::Claude, &folder(), None, None, PermissionMode::Bypass, "/plan2code", None);
        assert_eq!(spec.program, "claude");
        assert_eq!(spec.args, ["/plan2code", "--permission-mode", "bypassPermissions"]);
        assert_eq!(spec.cwd, folder());
        // A PATH that can still find nvm, Homebrew or Volta's directories (Task 9.9).
        assert_eq!(spec.env.iter().filter(|(k, _)| k == "PATH").count(), 1);
    }

    #[test]
    fn claude_with_a_model() {
        assert_eq!(
            args(AgentKind::Claude, Some("sonnet"), PermissionMode::Bypass, "/plan2code"),
            ["/plan2code", "--permission-mode", "bypassPermissions", "--model", "sonnet"]
        );
    }

    #[test]
    fn claude_checked_mode_skips_the_bypass_flag() {
        assert_eq!(args(AgentKind::Claude, None, PermissionMode::Checked, "/plan2code"), ["/plan2code"]);
    }

    #[test]
    fn claude_with_an_effort() {
        let spec =
            launch_spec_with(AgentKind::Claude, &folder(), None, Some("high"), PermissionMode::Bypass, "/plan2code", None);
        assert_eq!(spec.args, ["/plan2code", "--permission-mode", "bypassPermissions", "--effort", "high"]);
    }

    #[test]
    fn a_full_launch_card_choice_carries_model_effort_and_mode_together() {
        let spec = launch_spec_with(
            AgentKind::Claude,
            &folder(),
            Some("opus"),
            Some("xhigh"),
            PermissionMode::Bypass,
            "/plan2code",
            None,
        );
        assert_eq!(
            spec.args,
            ["/plan2code", "--permission-mode", "bypassPermissions", "--model", "opus", "--effort", "xhigh"]
        );
        let checked = launch_spec_with(
            AgentKind::Codex,
            &folder(),
            Some("gpt-5"),
            Some("medium"),
            PermissionMode::Checked,
            "$plan2code",
            None,
        );
        assert_eq!(checked.args, ["--model", "gpt-5", "-c", "model_reasoning_effort=medium", "$plan2code"]);
    }

    #[test]
    fn devin_puts_the_prompt_after_a_double_dash() {
        let spec = launch_spec_with(AgentKind::Devin, &folder(), None, None, PermissionMode::Bypass, "/plan2code", None);
        assert_eq!(spec.program, "devin");
        assert_eq!(spec.args, ["--permission-mode", "bypass", "--", "/plan2code"]);
    }

    #[test]
    fn devin_with_a_model_keeps_the_prompt_last() {
        assert_eq!(
            args(AgentKind::Devin, Some("opus"), PermissionMode::Bypass, "/plan2code"),
            ["--permission-mode", "bypass", "--model", "opus", "--", "/plan2code"]
        );
    }

    #[test]
    fn devin_checked_mode_skips_the_bypass_flag() {
        assert_eq!(args(AgentKind::Devin, None, PermissionMode::Checked, "/plan2code"), ["--", "/plan2code"]);
    }

    #[test]
    fn codex_uses_its_own_flag_and_dollar_prompt() {
        let prompt = AgentKind::Codex.default_prompt();
        let spec = launch_spec_with(AgentKind::Codex, &folder(), None, None, PermissionMode::Bypass, prompt, None);
        assert_eq!(spec.program, "codex");
        assert_eq!(spec.args, ["--dangerously-bypass-approvals-and-sandbox", "$plan2code"]);
    }

    #[test]
    fn codex_with_a_model() {
        assert_eq!(
            args(AgentKind::Codex, Some("gpt-5"), PermissionMode::Bypass, "$plan2code"),
            ["--dangerously-bypass-approvals-and-sandbox", "--model", "gpt-5", "$plan2code"]
        );
    }

    #[test]
    fn codex_with_an_effort_uses_a_config_override() {
        let spec =
            launch_spec_with(AgentKind::Codex, &folder(), None, Some("low"), PermissionMode::Bypass, "$plan2code", None);
        assert_eq!(
            spec.args,
            ["--dangerously-bypass-approvals-and-sandbox", "-c", "model_reasoning_effort=low", "$plan2code"]
        );
    }

    #[test]
    fn codex_checked_mode_skips_the_bypass_flag() {
        assert_eq!(args(AgentKind::Codex, None, PermissionMode::Checked, "$plan2code"), ["$plan2code"]);
    }

    #[test]
    fn no_prompt_means_nothing_typed() {
        assert_eq!(args(AgentKind::Claude, None, PermissionMode::Bypass, ""), ["--permission-mode", "bypassPermissions"]);
        assert_eq!(args(AgentKind::Devin, None, PermissionMode::Bypass, ""), ["--permission-mode", "bypass"]);
        assert_eq!(args(AgentKind::Codex, None, PermissionMode::Bypass, ""), ["--dangerously-bypass-approvals-and-sandbox"]);
    }

    #[test]
    fn a_custom_prompt_is_passed_through() {
        assert_eq!(
            args(AgentKind::Claude, None, PermissionMode::Bypass, "/plan2code pick up the brief"),
            ["/plan2code pick up the brief", "--permission-mode", "bypassPermissions"]
        );
    }

    #[test]
    fn devin_has_no_effort_of_its_own() {
        assert!(!AgentKind::Devin.has_effort());
        assert!(AgentKind::Claude.has_effort());
        assert!(AgentKind::Codex.has_effort());
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
        for kind in AgentKind::ALL {
            let spec = launch_spec_with(
                kind,
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
        let path = dir.to_string_lossy().into_owned();
        assert_eq!(find_on_path("tool", &path), Some(dir.join(name)));
        assert_eq!(find_on_path("missing-tool", &path), None);
        let _ = std::fs::remove_dir_all(&dir);
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
        assert_eq!(wrapped, ["/c".to_string(), "tool.cmd".to_string(), "--flag".to_string()]);

        let (program, same) = windows_command("real", args.clone(), &path);
        assert_eq!(program, dir.join("real.exe").to_string_lossy());
        assert_eq!(same, args);

        assert_eq!(windows_command("missing", args.clone(), &path), ("missing".to_string(), args));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ids_round_trip() {
        for kind in AgentKind::ALL {
            assert_eq!(AgentKind::from_id(kind.id()), Some(kind));
        }
        assert_eq!(AgentKind::from_id("nope"), None);
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
                assert!(warnings.iter().any(|w| w.contains(part)), "{name}: no warning names {part}: {warnings:?}");
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
        let dir = std::env::temp_dir().join(format!("plan2code-agents-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    const GOOSE: &str = r#"{"schema":1,"agents":[{"id":"goose","name":"Goose","command":"goose","args":["{prompt}"],"bypassArgs":["--yes"]}]}"#;

    #[test]
    fn a_missing_file_is_empty_and_a_bad_one_warns() {
        let dir = temp_dir("load");
        assert_eq!(load_custom_agents(&dir.join("agents.json")), (Vec::new(), Vec::new()));
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
        assert_eq!(find_agent_in("claude", Some(&file)), Some(Agent::Builtin(AgentKind::Claude)));
        let goose = find_agent_in("goose", Some(&file)).unwrap();
        assert_eq!((goose.id(), goose.label(), goose.has_effort(), goose.default_prompt()), ("goose", "Goose", false, "/plan2code"));
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
        let spec = custom_launch_spec(&goose(), Some(&bin), &folder(), None, PermissionMode::Checked, "/plan2code", "P", false);
        assert_eq!(spec.program, bin.to_string_lossy());
        assert_eq!(spec.args, ["/plan2code"]);
        assert_eq!(spec.env, [("PATH".to_string(), "P".to_string())]);
        let spec = custom_launch_spec(&goose(), Some(&bin), &folder(), Some("m"), PermissionMode::Bypass, "/plan2code", "P", false);
        assert_eq!(spec.args, ["/plan2code", "--model", "m", "--yes"]);
        let spec = custom_launch_spec(&goose(), None, &folder(), None, PermissionMode::Checked, "", "P", false);
        assert_eq!((spec.program.as_str(), spec.args.len()), ("goose", 0));
    }

    #[test]
    fn a_windows_cmd_runs_through_cmd_with_its_folder_on_path_for_a_full_path() {
        let mut full = goose();
        full.command = "C:\\with space\\goose.cmd".to_string();
        let found = Path::new("C:\\with space").join("goose.cmd");
        let spec = custom_launch_spec(&full, Some(&found), &folder(), None, PermissionMode::Checked, "/p", "BASE", true);
        assert_eq!(spec.program, "cmd");
        assert_eq!(spec.args, ["/c", "goose.cmd", "/p"]);
        assert_eq!(spec.env[0].1, format!("{};BASE", found.parent().unwrap().to_string_lossy()));
        // A bare name keeps the plain PATH.
        let bare = custom_launch_spec(&goose(), Some(&found), &folder(), None, PermissionMode::Checked, "/p", "BASE", true);
        assert_eq!((bare.program.as_str(), bare.env[0].1.as_str()), ("cmd", "BASE"));
    }

    #[cfg(windows)]
    #[test]
    fn a_full_path_cmd_in_a_spaced_folder_resolves_and_wraps() {
        let dir = temp_dir("spaced").join("with space");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("goose.cmd"), "@echo off").unwrap();
        let mut agent = goose();
        agent.command = dir.join("goose.cmd").to_string_lossy().into_owned();
        let found = Agent::Custom(agent.clone()).installed_at().expect("resolves");
        let spec = custom_launch_spec(&agent, Some(&found), &folder(), None, PermissionMode::Checked, "/p", "BASE", true);
        assert_eq!((spec.program.as_str(), spec.args[1].as_str()), ("cmd", "goose.cmd"));
        assert!(spec.env[0].1.starts_with(&dir.to_string_lossy().to_string()));
        let _ = std::fs::remove_dir_all(dir.parent().unwrap());
    }

    #[test]
    fn install_pages_are_for_built_ins_only() {
        assert_eq!(install_page_url("codex").unwrap(), "https://github.com/openai/codex");
        assert!(install_page_url("goose").is_err());
        for kind in AgentKind::ALL {
            assert!(kind.install_url().starts_with("https://"));
        }
    }
}
