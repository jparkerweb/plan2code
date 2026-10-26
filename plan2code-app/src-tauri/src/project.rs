//! Which project folder the app works on: the folder the launcher passes in,
//! else the one the launcher remembers, else the person picks. The launcher's
//! memory is `~/.plan2code/launcher.json` (`lastFolder`, `lastCli`), shared so
//! the app and `plan2code` agree on both.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::agents;

/// Where the project folder came from, in the order it is tried.
#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectSource {
    Argument,
    Remembered,
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
    Some(std::env::home_dir()?.join(".plan2code").join("launcher.json"))
}

fn read_launcher() -> serde_json::Map<String, serde_json::Value> {
    launcher_file()
        .and_then(|file| std::fs::read_to_string(file).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

/// The folder the launcher remembers, when it is still a directory.
fn remembered_folder() -> Option<PathBuf> {
    let dir = PathBuf::from(read_launcher().get("lastFolder")?.as_str()?);
    dir.is_dir().then_some(dir)
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
            return args.get(i + 1).filter(|v| !v.is_empty() && !v.starts_with('-')).cloned();
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

/// The folder to open on: the launcher's argument wins, then its memory, then
/// nothing (the page asks with the folder picker).
pub fn resolve(args: &[String]) -> Option<ProjectDir> {
    if let Some(dir) = argument_folder(args) {
        return Some(ProjectDir { dir, source: ProjectSource::Argument });
    }
    remembered_folder().map(|dir| ProjectDir { dir, source: ProjectSource::Remembered })
}

/// A folder the person picked becomes the remembered one, so the next start
/// (app or launcher) opens on it. The launcher's other keys are kept.
pub fn remember_folder(dir: &Path) -> Result<ProjectDir, String> {
    let file = launcher_file().ok_or("no home folder found")?;
    let mut state = read_launcher();
    state.insert(
        "lastFolder".to_string(),
        serde_json::Value::String(dir.to_string_lossy().into_owned()),
    );
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    let json = serde_json::to_string_pretty(&serde_json::Value::Object(state)).map_err(err)?;
    std::fs::write(file, json).map_err(err)?;
    Ok(ProjectDir { dir: dir.to_path_buf(), source: ProjectSource::Picked })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::AgentKind;

    fn launch_choice(args: &[String]) -> LaunchChoice {
        launch_choice_in(args, None)
    }

    fn args(list: &[&str]) -> Vec<String> {
        std::iter::once("plan2code-app").chain(list.iter().copied()).map(str::to_string).collect()
    }

    #[test]
    fn the_launcher_choice_reads_agent_and_model_in_both_forms() {
        let want = LaunchChoice { agent: Some(AgentKind::Codex.id().to_string()), model: Some("gpt-5".into()) };
        assert_eq!(launch_choice(&args(&["--project", ".", "--agent", "codex", "--model", "gpt-5"])), want);
        assert_eq!(launch_choice(&args(&["--agent=codex", "--model=gpt-5"])), want);
        assert_eq!(launch_choice(&args(&["--agent", "CODEX", "--model", "gpt-5"])), want);
    }

    #[test]
    fn an_agent_alone_is_a_choice_and_a_model_alone_is_not() {
        assert_eq!(
            launch_choice(&args(&["--agent", "claude"])),
            LaunchChoice { agent: Some(AgentKind::Claude.id().to_string()), model: None }
        );
        assert_eq!(launch_choice(&args(&["--model", "opus"])), LaunchChoice::default());
    }

    #[test]
    fn an_unknown_agent_or_a_missing_value_is_ignored() {
        assert_eq!(launch_choice(&args(&["--agent", "emacs", "--model", "x"])), LaunchChoice::default());
        assert_eq!(launch_choice(&args(&["--agent"])), LaunchChoice::default());
        assert_eq!(launch_choice(&args(&["--agent", "--model", "x"])), LaunchChoice::default());
        assert_eq!(launch_choice(&args(&["--agent=", "--model=x"])), LaunchChoice::default());
        assert_eq!(launch_choice(&args(&[])), LaunchChoice::default());
        assert_eq!(
            launch_choice(&args(&["--agent", "devin", "--model"])),
            LaunchChoice { agent: Some(AgentKind::Devin.id().to_string()), model: None }
        );
    }

    #[test]
    fn a_custom_agent_id_is_accepted_when_the_file_names_it() {
        let dir = std::env::temp_dir().join(format!("p2c-project-custom-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("agents.json");
        std::fs::write(&file, r#"{"schema":1,"agents":[{"id":"goose","name":"Goose","command":"goose"}]}"#).unwrap();
        let want = LaunchChoice { agent: Some("goose".into()), model: Some("m1".into()) };
        assert_eq!(launch_choice_in(&args(&["--agent", "goose", "--model", "m1"]), Some(&file)), want);
        assert_eq!(launch_choice_in(&args(&["--agent", "other", "--model", "m1"]), Some(&file)), LaunchChoice::default());
        assert_eq!(launch_choice_in(&args(&["--agent", "goose"]), None), LaunchChoice::default());
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
}
