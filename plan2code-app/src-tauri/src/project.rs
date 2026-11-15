//! Which project folder the app works on: the folder the launcher passes in,
//! else the one the person picks from the page's folder picker (the recent
//! folders, or the OS dialog). The launcher's memory is
//! `~/.plan2code/launcher.json` (`lastFolder`, `lastCli`), shared so the app
//! and `plan2code` agree on both. `recentFolders` (newest first, at
//! most 5) holds the folders worked on; `lastFolder` is always its first entry.
//! The rule for that list is written twice, here and in `src/launcher/plan2code.js`,
//! and both are held to `scripts/fixtures/recent-folders-cases.json`.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::agents;

/// Where the project folder came from: the launcher's argument, or the picker.
#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectSource {
    Argument,
    Picked,
}

#[derive(Clone)]
pub struct ProjectDir {
    pub dir: PathBuf,
    pub source: ProjectSource,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn launcher_file() -> Option<PathBuf> {
    Some(
        std::env::home_dir()?
            .join(".plan2code")
            .join("launcher.json"),
    )
}

fn read_launcher_from(file: &Path) -> serde_json::Map<String, Value> {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn read_launcher() -> serde_json::Map<String, Value> {
    launcher_file()
        .map(|file| read_launcher_from(&file))
        .unwrap_or_default()
}

/// How many recent project folders the list keeps.
const RECENT_FOLDERS_MAX: usize = 5;

/// One trailing `\` or `/` off a path, but never off a root (`C:\` or `/`).
fn trim_folder(p: &str) -> &str {
    let b = p.as_bytes();
    let drive_root = b.len() == 3 && b[1] == b':' && b[0].is_ascii_alphabetic();
    if b.len() > 1 && matches!(b[b.len() - 1], b'\\' | b'/') && !drive_root {
        &p[..p.len() - 1]
    } else {
        p
    }
}

/// Whether two paths name the same folder: a trailing separator is ignored,
/// and case is on Windows. Twin of `sameFolder` in the launcher.
pub fn same_folder(a: &str, b: &str, windows: bool) -> bool {
    let (x, y) = (trim_folder(a), trim_folder(b));
    if windows {
        x.to_lowercase() == y.to_lowercase()
    } else {
        x == y
    }
}

/// The recent folders in the launcher's state: `recentFolders`, else
/// `[lastFolder]`, else none. Twin of `readRecent`.
fn read_recent(state: &serde_json::Map<String, Value>) -> Vec<String> {
    if let Some(Value::Array(items)) = state.get("recentFolders") {
        return items
            .iter()
            .filter_map(Value::as_str)
            .filter(|s| !s.is_empty())
            .take(RECENT_FOLDERS_MAX)
            .map(str::to_string)
            .collect();
    }
    match state.get("lastFolder").and_then(Value::as_str) {
        Some(last) if !last.is_empty() => vec![last.to_string()],
        _ => Vec::new(),
    }
}

/// A new list with `dir` first, an earlier entry for the same folder removed,
/// cut to the max. Twin of `pushRecent`.
fn push_recent(list: &[String], dir: &str, windows: bool) -> Vec<String> {
    std::iter::once(dir.to_string())
        .chain(
            list.iter()
                .filter(|x| !same_folder(x, dir, windows))
                .cloned(),
        )
        .take(RECENT_FOLDERS_MAX)
        .collect()
}

/// The folders of `list` worth offering: ones that still exist, minus the one
/// in `exclude`. Twin of `listRecent`.
fn list_recent(
    list: &[String],
    exists: impl Fn(&str) -> bool,
    exclude: Option<&str>,
    windows: bool,
) -> Vec<String> {
    list.iter()
        .filter(|x| exists(x) && !exclude.is_some_and(|e| same_folder(x, e, windows)))
        .cloned()
        .collect()
}

/// The folders the person worked on lately that are still folders, newest
/// first, minus `exclude` (the project already open, by `same_folder`'s
/// rule). The page's folder picker draws them.
pub fn recent_folders(exclude: Option<&Path>) -> Vec<PathBuf> {
    let exclude = exclude.map(|p| p.to_string_lossy().into_owned());
    list_recent(
        &read_recent(&read_launcher()),
        |p| Path::new(p).is_dir(),
        exclude.as_deref(),
        cfg!(windows),
    )
    .into_iter()
    .map(PathBuf::from)
    .collect()
}

/// The id of the agent the launcher last ran (it may be a custom one). The
/// bar's picker starts on it until the app has a choice of its own
/// (`settings.rs`); a caller ignores an id that no longer resolves.
pub fn remembered_agent() -> Option<String> {
    Some(read_launcher().get("lastCli")?.as_str()?.to_string()).filter(|id| !id.is_empty())
}

/// `--project <dir>`, `--project=<dir>` or the first bare argument: the folder
/// the launcher passed in when it started the app.
fn argument_folder(args: &[String]) -> Option<PathBuf> {
    let mut i = 1; // args[0] is the program name
    while i < args.len() {
        let arg = &args[i];
        if arg == "--agent" || arg == "--model" {
            // Their values are not folders, even when a folder of that name exists.
            i += 2;
            continue;
        }
        if arg == "--project" {
            i += 1;
            if i < args.len() {
                let dir = PathBuf::from(&args[i]);
                return dir.is_dir().then_some(dir);
            }
        } else if let Some(dir) = arg.strip_prefix("--project=") {
            let dir = PathBuf::from(dir);
            return dir.is_dir().then_some(dir);
        } else if !arg.starts_with('-') {
            let dir = PathBuf::from(arg);
            return dir.is_dir().then_some(dir);
        }
        i += 1;
    }
    None
}

/// What the launcher chose before it opened the app: `--agent <id>` and `--model <id>` (or the
/// `=` forms). An unknown agent or a missing value is ignored, and a model only counts beside
/// an agent, since a model name belongs to one agent.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LaunchChoice {
    /// An agent id, built-in or custom; resolved at use through `agents::find_agent`.
    pub agent: Option<String>,
    pub model: Option<String>,
}

fn flag_value(args: &[String], flag: &str) -> Option<String> {
    let prefix = format!("{flag}=");
    let mut i = 1;
    while i < args.len() {
        let arg = &args[i];
        if arg == flag {
            return args
                .get(i + 1)
                .filter(|v| !v.is_empty() && !v.starts_with('-'))
                .cloned();
        }
        if let Some(value) = arg.strip_prefix(&prefix) {
            return (!value.is_empty()).then(|| value.to_string());
        }
        i += 1;
    }
    None
}

pub fn launch_choice(args: &[String]) -> LaunchChoice {
    launch_choice_in(args, agents::agents_file().as_deref())
}

/// `launch_choice` with the custom agents read from `agents_file` (`None`: built-ins only).
pub fn launch_choice_in(args: &[String], agents_file: Option<&Path>) -> LaunchChoice {
    let agent = flag_value(args, "--agent")
        .map(|id| id.to_lowercase())
        .filter(|id| agents::find_agent_in(id, agents_file).is_some());
    let model = agent.as_ref().and_then(|_| flag_value(args, "--model"));
    LaunchChoice { agent, model }
}

/// The folder to open on: only the launcher's argument. Without one the page
/// shows its folder picker; the last folder is the picker's first recent row,
/// never reopened silently.
pub fn resolve(args: &[String]) -> Option<ProjectDir> {
    argument_folder(args).map(|dir| ProjectDir {
        dir,
        source: ProjectSource::Argument,
    })
}

/// A folder the person picked goes to the top of the recent folders and
/// becomes `lastFolder`, so the next start (app or launcher) lists it first.
/// The launcher's other keys are kept.
pub fn remember_folder(dir: &Path) -> Result<ProjectDir, String> {
    let file = launcher_file().ok_or("no home folder found")?;
    remember_folder_in(&file, dir)?;
    Ok(ProjectDir {
        dir: dir.to_path_buf(),
        source: ProjectSource::Picked,
    })
}

/// `remember_folder`'s write, into `file`.
fn remember_folder_in(file: &Path, dir: &Path) -> Result<(), String> {
    let mut state = read_launcher_from(file);
    let recent = push_recent(&read_recent(&state), &dir.to_string_lossy(), cfg!(windows));
    state.insert("lastFolder".to_string(), Value::String(recent[0].clone()));
    state.insert(
        "recentFolders".to_string(),
        Value::Array(recent.into_iter().map(Value::String).collect()),
    );
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    let json = serde_json::to_string_pretty(&Value::Object(state)).map_err(err)?;
    crate::loop_driver::write_atomic(file, &json)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn launch_choice(args: &[String]) -> LaunchChoice {
        launch_choice_in(args, None)
    }

    fn args(list: &[&str]) -> Vec<String> {
        std::iter::once("plan2code-app")
            .chain(list.iter().copied())
            .map(str::to_string)
            .collect()
    }

    #[test]
    fn the_launcher_choice_reads_agent_and_model_in_both_forms() {
        let want = LaunchChoice {
            agent: Some("codex".to_string()),
            model: Some("gpt-5".into()),
        };
        assert_eq!(
            launch_choice(&args(&[
                "--project",
                ".",
                "--agent",
                "codex",
                "--model",
                "gpt-5"
            ])),
            want
        );
        assert_eq!(
            launch_choice(&args(&["--agent=codex", "--model=gpt-5"])),
            want
        );
        assert_eq!(
            launch_choice(&args(&["--agent", "CODEX", "--model", "gpt-5"])),
            want
        );
    }

    #[test]
    fn an_agent_alone_is_a_choice_and_a_model_alone_is_not() {
        assert_eq!(
            launch_choice(&args(&["--agent", "claude"])),
            LaunchChoice {
                agent: Some("claude".to_string()),
                model: None
            }
        );
        assert_eq!(
            launch_choice(&args(&["--model", "opus"])),
            LaunchChoice::default()
        );
    }

    #[test]
    fn an_unknown_agent_or_a_missing_value_is_ignored() {
        assert_eq!(
            launch_choice(&args(&["--agent", "emacs", "--model", "x"])),
            LaunchChoice::default()
        );
        assert_eq!(launch_choice(&args(&["--agent"])), LaunchChoice::default());
        assert_eq!(
            launch_choice(&args(&["--agent", "--model", "x"])),
            LaunchChoice::default()
        );
        assert_eq!(
            launch_choice(&args(&["--agent=", "--model=x"])),
            LaunchChoice::default()
        );
        assert_eq!(launch_choice(&args(&[])), LaunchChoice::default());
        assert_eq!(
            launch_choice(&args(&["--agent", "devin", "--model"])),
            LaunchChoice {
                agent: Some("devin".to_string()),
                model: None
            }
        );
    }

    #[test]
    fn a_custom_agent_id_is_accepted_when_the_file_names_it() {
        let dir = std::env::temp_dir().join(format!("p2c-project-custom-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("agents.json");
        std::fs::write(
            &file,
            r#"{"schema":1,"agents":[{"id":"goose","name":"Goose","command":"goose"}]}"#,
        )
        .unwrap();
        let want = LaunchChoice {
            agent: Some("goose".into()),
            model: Some("m1".into()),
        };
        assert_eq!(
            launch_choice_in(&args(&["--agent", "goose", "--model", "m1"]), Some(&file)),
            want
        );
        assert_eq!(
            launch_choice_in(&args(&["--agent", "other", "--model", "m1"]), Some(&file)),
            LaunchChoice::default()
        );
        assert_eq!(
            launch_choice_in(&args(&["--agent", "goose"]), None),
            LaunchChoice::default()
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_agent_and_model_values_are_never_taken_for_a_folder() {
        // A folder named like the agent exists right here, so a bare-argument reading would pick it.
        let cwd = std::env::temp_dir().join(format!("p2c-project-args-{}", std::process::id()));
        std::fs::create_dir_all(cwd.join("codex")).unwrap();
        let named = cwd.join("codex").to_string_lossy().into_owned();
        let found = argument_folder(&args(&["--agent", &named, "--model", &named]));
        assert_eq!(found, None);
        // Beside --project, the folder wins as before.
        let found = argument_folder(&args(&["--project", &named, "--agent", "codex"]));
        assert_eq!(found, Some(cwd.join("codex")));
        let _ = std::fs::remove_dir_all(&cwd);
    }

    const CASES: &str = include_str!("../../../scripts/fixtures/recent-folders-cases.json");

    /// Each case of the fixture group `group` with the platform values it runs under:
    /// `true` for Windows. Both platform sets run on every OS; a case with none runs under both.
    fn cases(group: &str) -> Vec<(Value, bool)> {
        let all: Value = serde_json::from_str(CASES).unwrap();
        let mut out = Vec::new();
        for case in all[group].as_array().unwrap() {
            let winds: &[bool] = match case.get("platform").and_then(Value::as_str) {
                Some("win32") => &[true],
                Some("posix") => &[false],
                _ => &[true, false],
            };
            for &windows in winds {
                out.push((case.clone(), windows));
            }
        }
        assert!(!out.is_empty(), "no {group} cases");
        out
    }

    fn strings(value: &Value) -> Vec<String> {
        value
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap().to_string())
            .collect()
    }

    #[test]
    fn read_recent_follows_the_shared_cases() {
        for (case, _) in cases("read") {
            let state = case["state"].as_object().unwrap();
            assert_eq!(
                read_recent(state),
                strings(&case["expect"]),
                "{}",
                case["name"]
            );
        }
    }

    #[test]
    fn push_recent_follows_the_shared_cases() {
        for (case, windows) in cases("push") {
            let got = push_recent(
                &strings(&case["list"]),
                case["dir"].as_str().unwrap(),
                windows,
            );
            assert_eq!(
                got,
                strings(&case["expect"]),
                "{} (windows: {windows})",
                case["name"]
            );
        }
    }

    #[test]
    fn list_recent_follows_the_shared_cases() {
        for (case, windows) in cases("list") {
            let exists = strings(&case["exists"]);
            let got = list_recent(
                &strings(&case["list"]),
                |p| exists.iter().any(|e| e == p),
                case["exclude"].as_str(),
                windows,
            );
            assert_eq!(
                got,
                strings(&case["expect"]),
                "{} (windows: {windows})",
                case["name"]
            );
        }
    }

    #[test]
    fn remember_folder_keeps_the_other_keys_and_writes_both_lists() {
        let home =
            std::env::temp_dir().join(format!("p2c-project-remember-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).unwrap();
        let file = home.join(".plan2code").join("launcher.json");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(
            &file,
            r#"{"lastFolder":"/old","lastCli":"codex","lastModels":{"codex":"m1"}}"#,
        )
        .unwrap();

        remember_folder_in(&file, Path::new("/new")).unwrap();
        let state = read_launcher_from(&file);
        assert_eq!(state["lastCli"], "codex");
        assert_eq!(state["lastModels"]["codex"], "m1");
        assert_eq!(state["lastFolder"], "/new");
        assert_eq!(state["recentFolders"], serde_json::json!(["/new", "/old"]));

        // Picking the older folder again moves it up, with no duplicate.
        remember_folder_in(&file, Path::new("/old")).unwrap();
        let state = read_launcher_from(&file);
        assert_eq!(state["lastFolder"], "/old");
        assert_eq!(state["recentFolders"], serde_json::json!(["/old", "/new"]));
        let _ = std::fs::remove_dir_all(&home);
    }
}
