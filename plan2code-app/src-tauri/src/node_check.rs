//! The Node 18+ check (FR-13). The console and the skills run on Node, so the
//! app refuses to start without it and says what to install.
//!
//! An app started from the Dock, Finder or a `.desktop` file, rather than a
//! terminal, inherits a minimal PATH: none of nvm, Homebrew or Volta's
//! directories, which a login shell's own profile adds. `resolved_path`
//! (Task 9.9) is what every process this app spawns (the console, an update,
//! an agent CLI) should run with, not the bare inherited one; `node_check`,
//! `console_supervisor`, `versions` and `agents` all use it.

use std::process::Command;
use std::sync::Mutex;

pub const MIN_NODE_MAJOR: u32 = 18;

#[derive(Debug, PartialEq, Eq)]
pub enum NodeStatus {
    Ok(String),
    TooOld(String),
    Missing,
}

/// Major version from `node --version` output such as `v20.11.1`.
pub fn parse_node_major(output: &str) -> Option<u32> {
    let text = output.trim().strip_prefix('v')?;
    text.split('.').next()?.parse().ok()
}

/// Classify the output of `node --version`.
pub fn classify(output: &str) -> NodeStatus {
    let version = output.trim().to_string();
    match parse_node_major(output) {
        Some(major) if major >= MIN_NODE_MAJOR => NodeStatus::Ok(version),
        Some(_) => NodeStatus::TooOld(version),
        None => NodeStatus::Missing,
    }
}

pub fn check_node() -> NodeStatus {
    match Command::new("node").env("PATH", resolved_path()).arg("--version").output() {
        Ok(out) if out.status.success() => classify(&String::from_utf8_lossy(&out.stdout)),
        _ => NodeStatus::Missing,
    }
}

/// `--node <path>` or `--node=<path>`: the launcher's own `node`, already
/// resolved under the person's real shell. Only its directory is used here,
/// so it joins the PATH the normal way rather than replacing every lookup.
fn node_override_dir(args: &[String]) -> Option<String> {
    let mut i = 1; // args[0] is the program name
    while i < args.len() {
        let value = if args[i] == "--node" {
            args.get(i + 1).cloned()
        } else {
            args[i].strip_prefix("--node=").map(str::to_string)
        };
        if let Some(path) = value.filter(|v| !v.is_empty()) {
            return std::path::Path::new(&path).parent().map(|dir| dir.to_string_lossy().into_owned());
        }
        i += 1;
    }
    None
}

/// The login shell's own PATH: running it as a login shell sources
/// `.zprofile`, `.bash_profile` or `.profile`, which a GUI launch never does.
/// Windows sets PATH outside any shell's startup files, so this is unix only.
#[cfg(unix)]
fn login_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    let out = Command::new(&shell).args(["-lc", "echo $PATH"]).output().ok()?;
    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (out.status.success() && !path.is_empty()).then_some(path)
}

static RESOLVED_PATH: Mutex<Option<String>> = Mutex::new(None);

/// The PATH every process this app spawns should run with: an explicit
/// `--node`'s directory first, then (macOS and Linux) the login shell's own
/// PATH, then this process's own PATH, each included only once. Worked out
/// once per launch, and again only on `refresh_path`.
pub fn resolved_path() -> String {
    let mut cached = RESOLVED_PATH.lock().unwrap_or_else(|e| e.into_inner());
    cached.get_or_insert_with(|| build_path(false)).clone()
}

/// Work the PATH out again, for "Check again" after an agent CLI was
/// installed: an installer may have added a folder (the login shell's
/// profile on macOS and Linux, the saved user or system PATH on Windows)
/// that this process's own PATH has never had.
pub fn refresh_path() {
    let fresh = build_path(true);
    *RESOLVED_PATH.lock().unwrap_or_else(|e| e.into_inner()) = Some(fresh);
}

fn build_path(fresh: bool) -> String {
    let args: Vec<String> = std::env::args().collect();
    let inherited = std::env::var("PATH").unwrap_or_default();
    let mut parts = Vec::new();
    if let Some(dir) = node_override_dir(&args) {
        parts.push(dir);
    }
    #[cfg(unix)]
    if let Some(login) = login_shell_path() {
        parts.push(login);
    }
    // At start this process's PATH already is the saved one; only a refresh
    // needs to read it again.
    #[cfg(windows)]
    if fresh {
        parts.extend(saved_windows_path());
    }
    #[cfg(not(windows))]
    let _ = fresh;
    if !inherited.is_empty() {
        parts.push(inherited);
    }
    parts.join(if cfg!(windows) { ";" } else { ":" })
}

/// The system then the user PATH as saved in the registry, with `%NAME%`
/// expanded: what a newly opened terminal would get.
#[cfg(windows)]
fn saved_windows_path() -> Vec<String> {
    use std::os::windows::process::CommandExt;
    let keys = [r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment", r"HKCU\Environment"];
    keys.iter()
        .filter_map(|key| {
            let out = Command::new("reg")
                .args(["query", key, "/v", "Path"])
                .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
                .output()
                .ok()?;
            let value = parse_reg_query_value(&String::from_utf8_lossy(&out.stdout))?;
            Some(expand_percent_vars(&value, |name| std::env::var(name).ok()))
        })
        .collect()
}

/// The value from `reg query <key> /v <name>` output: the text after the
/// `REG_SZ` or `REG_EXPAND_SZ` column on its line.
#[cfg_attr(not(windows), allow(dead_code))]
fn parse_reg_query_value(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let (_, rest) = line.split_once("REG_EXPAND_SZ").or_else(|| line.split_once("REG_SZ"))?;
        let value = rest.trim();
        (!value.is_empty()).then(|| value.to_string())
    })
}

/// `%NAME%` replaced with `lookup(NAME)`; an unknown name stays as written.
#[cfg_attr(not(windows), allow(dead_code))]
fn expand_percent_vars(text: &str, lookup: impl Fn(&str) -> Option<String>) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) if end > 0 => match lookup(&after[..end]) {
                Some(value) => {
                    out.push_str(&value);
                    rest = &after[end + 1..];
                }
                None => {
                    out.push('%');
                    rest = after;
                }
            },
            _ => {
                out.push('%');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

/// Where `node` actually resolves, with `resolved_path`: for the first-run
/// checklist to name (Task 9.9), not for `check_node` itself to decide with.
pub fn node_binary_path() -> Option<String> {
    let (program, arg) = if cfg!(windows) { ("where", "node") } else { ("which", "node") };
    let out = Command::new(program).env("PATH", resolved_path()).arg(arg).output().ok()?;
    if !out.status.success() {
        return None;
    }
    String::from_utf8_lossy(&out.stdout).lines().next().map(str::trim).filter(|s| !s.is_empty()).map(str::to_string)
}

/// The plain message shown when the check fails; `None` when Node is fine.
pub fn problem_message(status: &NodeStatus) -> Option<String> {
    match status {
        NodeStatus::Ok(_) => None,
        NodeStatus::TooOld(v) => Some(format!(
            "Plan2Code needs Node.js {MIN_NODE_MAJOR} or newer, and this computer has {v}.\n\nInstall the current LTS release from https://nodejs.org and start Plan2Code again."
        )),
        NodeStatus::Missing => Some(format!(
            "Plan2Code needs Node.js {MIN_NODE_MAJOR} or newer, and it was not found.\n\nInstall the current LTS release from https://nodejs.org and start Plan2Code again."
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_node_18_and_newer() {
        assert_eq!(classify("v18.0.0\n"), NodeStatus::Ok("v18.0.0".into()));
        assert_eq!(classify("v20.11.1"), NodeStatus::Ok("v20.11.1".into()));
        assert_eq!(classify("v24.12.0\r\n"), NodeStatus::Ok("v24.12.0".into()));
    }

    #[test]
    fn rejects_node_older_than_18() {
        assert_eq!(classify("v16.20.2"), NodeStatus::TooOld("v16.20.2".into()));
        assert_eq!(classify("v17.9.1"), NodeStatus::TooOld("v17.9.1".into()));
    }

    #[test]
    fn treats_garbage_as_missing() {
        assert_eq!(classify("not a version"), NodeStatus::Missing);
        assert_eq!(classify(""), NodeStatus::Missing);
        assert_eq!(classify("v"), NodeStatus::Missing);
        assert_eq!(classify("vx.1.2"), NodeStatus::Missing);
    }

    #[test]
    fn message_only_for_a_problem() {
        assert!(problem_message(&NodeStatus::Ok("v20.0.0".into())).is_none());
        assert!(problem_message(&NodeStatus::Missing).unwrap().contains("nodejs.org"));
        assert!(problem_message(&NodeStatus::TooOld("v16.0.0".into())).unwrap().contains("v16.0.0"));
    }

    fn args(list: &[&str]) -> Vec<String> {
        std::iter::once("plan2code-app").chain(list.iter().copied()).map(str::to_string).collect()
    }

    #[test]
    fn the_node_override_names_its_directory_in_both_forms() {
        let want = if cfg!(windows) { "C:\\nvm\\v20" } else { "/home/x/.nvm/v20" };
        let bin = if cfg!(windows) { "C:\\nvm\\v20\\node.exe" } else { "/home/x/.nvm/v20/node" };
        assert_eq!(node_override_dir(&args(&["--node", bin])).as_deref(), Some(want));
        assert_eq!(node_override_dir(&args(&[&format!("--node={bin}")])).as_deref(), Some(want));
    }

    #[test]
    fn no_override_or_a_missing_value_is_none() {
        assert_eq!(node_override_dir(&args(&[])), None);
        assert_eq!(node_override_dir(&args(&["--node"])), None);
        assert_eq!(node_override_dir(&args(&["--node="])), None);
        assert_eq!(node_override_dir(&args(&["--agent", "claude"])), None);
    }

    #[test]
    fn reads_the_saved_path_out_of_reg_query_output() {
        let out = "\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\.local\\bin;C:\\Tools\r\n\r\n";
        assert_eq!(parse_reg_query_value(out).as_deref(), Some("%USERPROFILE%\\.local\\bin;C:\\Tools"));
        let plain = "HKEY_LOCAL_MACHINE\\x\r\n    Path    REG_SZ    C:\\Windows\r\n";
        assert_eq!(parse_reg_query_value(plain).as_deref(), Some("C:\\Windows"));
        assert_eq!(parse_reg_query_value("ERROR: The system was unable to find the specified registry key or value.\r\n"), None);
    }

    #[test]
    fn expands_known_percent_names_and_keeps_the_rest() {
        let lookup = |name: &str| (name == "USERPROFILE").then(|| "C:\\Users\\sam".to_string());
        assert_eq!(expand_percent_vars("%USERPROFILE%\\.local\\bin;C:\\x", lookup), "C:\\Users\\sam\\.local\\bin;C:\\x");
        assert_eq!(expand_percent_vars("%NOPE%\\bin;%USERPROFILE%", lookup), "%NOPE%\\bin;C:\\Users\\sam");
        assert_eq!(expand_percent_vars("50%", lookup), "50%");
        assert_eq!(expand_percent_vars("a%%b", lookup), "a%%b");
    }

    #[test]
    fn refresh_path_keeps_this_process_path() {
        refresh_path();
        let inherited = std::env::var("PATH").unwrap_or_default();
        assert!(resolved_path().ends_with(&inherited));
    }
}
