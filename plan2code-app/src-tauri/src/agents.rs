//! The agents the app can run and the command line each one starts with. The
//! flags are the ones `src/launcher/plan2code.js` uses today, so the app and
//! `plan2code` start an agent the same way. Knows nothing about Tauri.

use std::path::{Path, PathBuf};

use serde::Serialize;

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
}
