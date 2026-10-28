//! Whether the app and the installed skills are on the same Plan2Code version, and the
//! one-click way to bring them level. The app's own version is the one in `tauri.conf.json`
//! (Tauri reads it into the package info); the skills' version is the `version.json` the
//! installer writes beside the launcher in `~/.plan2code/bin/` on every install and update.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use serde::Serialize;

/// How long `run_update` lets the installer run before giving up on it.
pub const UPDATE_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct VersionStatus {
    pub app: String,
    /// The installed skills' version, or none when it cannot be read.
    pub skills: Option<String>,
    /// True only when both are readable `X.Y.Z` versions and they differ: an unknown version is
    /// never a reason to nag.
    pub mismatch: bool,
    /// Only meaningful when `mismatch` is true: the skills are ahead of this app, so another
    /// Update skills run cannot fix it (a newer app is what is missing), as against the usual
    /// case of the skills sitting behind the app.
    pub skills_ahead: bool,
}

/// `~/.plan2code/bin`, or `PLAN2CODE_LAUNCHER_DIR` when it is set (tests only, the same
/// convention `PLAN2CODE_CONSOLE_HOME` and `PLAN2CODE_APP_AGENT_BIN` already use).
fn launcher_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("PLAN2CODE_LAUNCHER_DIR") {
        return Some(PathBuf::from(dir));
    }
    Some(std::env::home_dir()?.join(".plan2code").join("bin"))
}

/// `X.Y.Z` as three numbers; anything else (a pre-release tag, a missing part) is none.
fn parse(version: &str) -> Option<(u64, u64, u64)> {
    let mut parts = version.trim().split('.');
    let triple = (
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
    );
    parts.next().is_none().then_some(triple)
}

/// The `version` field of a `version.json` file.
pub fn version_in(file: &Path) -> Option<String> {
    let text = std::fs::read_to_string(file).ok()?;
    let json: serde_json::Value = serde_json::from_str(&text).ok()?;
    json.get("version")?.as_str().map(str::to_string)
}

/// The skills' version as the installer last wrote it.
pub fn installed_skills_version() -> Option<String> {
    version_in(&launcher_dir()?.join("version.json"))
}

pub fn status(app: &str, skills: Option<String>) -> VersionStatus {
    let (mismatch, skills_ahead) = match (parse(app), skills.as_deref().and_then(parse)) {
        (Some(a), Some(s)) => (a != s, s > a),
        _ => (false, false),
    };
    VersionStatus {
        app: app.to_string(),
        skills,
        mismatch,
        skills_ahead,
    }
}

/// Run the existing installer's update (`plan2code update`, through the launcher's own copy),
/// which brings the skills, the launcher and the app level. Pinned to the release tag `app_version`
/// names, not `main`, so Update skills never pulls in work the app does not know about yet. Blocks
/// until it ends or `UPDATE_TIMEOUT` passes, whichever comes first; the page asks for it with a
/// click, never on its own. `on_line` is called with each line of output as it is produced, for a
/// live progress readout. Returns the installer's last non-empty line on success.
pub fn run_update(app_version: &str, on_line: impl FnMut(&str)) -> Result<String, String> {
    run_update_within(app_version, UPDATE_TIMEOUT, on_line)
}

/// `run_update`, with the timeout as a parameter so a test can use a short one instead of
/// `UPDATE_TIMEOUT`'s real five minutes.
fn run_update_within(
    app_version: &str,
    timeout: Duration,
    mut on_line: impl FnMut(&str),
) -> Result<String, String> {
    let launcher = launcher_dir()
        .ok_or("no home folder found")?
        .join("plan2code.js");
    if !launcher.is_file() {
        return Err(format!(
            "the plan2code command is not installed ({} is missing)",
            launcher.display()
        ));
    }
    let mut command = Command::new("node");
    // A Dock or Start-menu launch often lacks nvm, Homebrew or Volta's
    // directories (Task 9.9): the update script itself shells out to `npx`
    // and `git`, which need a PATH that finds them too.
    command.env("PATH", crate::node_check::resolved_path());
    command
        .arg(&launcher)
        .arg("update")
        .arg("--tag")
        .arg(format!("v{app_version}"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW, as the console calls are
    }
    let mut child = command
        .spawn()
        .map_err(|e| format!("could not run node: {e}"))?;
    let stdout = child.stdout.take().ok_or("no stdout from the update")?;
    let stderr = child.stderr.take().ok_or("no stderr from the update")?;
    let (tx, rx) = mpsc::channel::<String>();
    let err_tx = tx.clone();
    let out_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if tx.send(line).is_err() {
                break;
            }
        }
    });
    let err_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if err_tx.send(line).is_err() {
                break;
            }
        }
    });
    let deadline = Instant::now() + timeout;
    let poll = Duration::from_millis(200).min(timeout);
    let mut last_line = String::new();
    loop {
        match rx.recv_timeout(poll) {
            Ok(line) => {
                if !line.trim().is_empty() {
                    last_line = line.clone();
                }
                on_line(&line);
            }
            Err(mpsc::RecvTimeoutError::Timeout) if Instant::now() < deadline => continue,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("the update timed out after {}s", timeout.as_secs()));
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    let _ = out_thread.join();
    let _ = err_thread.join();
    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(last_line)
    } else {
        Err(format!("the update did not finish: {last_line}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str, content: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("p2c-versions-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("version.json");
        std::fs::write(&file, content).unwrap();
        file
    }

    #[test]
    fn equal_versions_do_not_mismatch() {
        let s = status("3.0.0", Some("3.0.0".into()));
        assert_eq!(
            s,
            VersionStatus {
                app: "3.0.0".into(),
                skills: Some("3.0.0".into()),
                mismatch: false,
                skills_ahead: false
            }
        );
    }

    #[test]
    fn different_versions_mismatch_in_either_direction() {
        assert!(status("3.0.0", Some("2.11.0".into())).mismatch);
        assert!(status("3.0.0", Some("3.1.0".into())).mismatch);
    }

    #[test]
    fn skills_ahead_names_which_direction_the_mismatch_runs() {
        assert!(!status("3.0.0", Some("2.11.0".into())).skills_ahead);
        assert!(status("3.0.0", Some("3.1.0".into())).skills_ahead);
        assert!(!status("3.0.0", Some("3.0.0".into())).skills_ahead);
    }

    #[test]
    fn an_unknown_or_odd_version_never_mismatches() {
        assert!(!status("3.0.0", None).mismatch);
        assert!(!status("3.0.0", Some("3.0.0-beta".into())).mismatch);
        assert!(!status("3.0", Some("3.0.0".into())).mismatch);
        assert!(!status("3.0.0", Some("".into())).mismatch);
    }

    #[test]
    fn reads_the_version_field_of_a_version_file() {
        let file = temp_file("ok", r#"{ "name": "Plan2Code", "version": "2.11.0" }"#);
        assert_eq!(version_in(&file).as_deref(), Some("2.11.0"));
    }

    #[test]
    fn a_missing_or_broken_version_file_reads_as_none() {
        let missing = std::env::temp_dir()
            .join("p2c-versions-does-not-exist")
            .join("version.json");
        assert_eq!(version_in(&missing), None);
        assert_eq!(version_in(&temp_file("broken", "{ not json")), None);
        assert_eq!(version_in(&temp_file("nover", r#"{ "name": "x" }"#)), None);
    }

    // `PLAN2CODE_LAUNCHER_DIR` is process-global, so these tests serialize on it.
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    /// Points `launcher_dir()` at a fresh folder holding a fake `plan2code.js` (plain Node
    /// source, no quoting needed), runs `body`, then restores the environment.
    fn with_fake_launcher<T>(name: &str, script: &str, body: impl FnOnce() -> T) -> T {
        let _guard = ENV_LOCK.lock().unwrap();
        let dir = std::env::temp_dir().join(format!(
            "p2c-versions-launcher-{}-{name}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("plan2code.js"), script).unwrap();
        std::env::set_var("PLAN2CODE_LAUNCHER_DIR", &dir);
        let result = body();
        std::env::remove_var("PLAN2CODE_LAUNCHER_DIR");
        let _ = std::fs::remove_dir_all(&dir);
        result
    }

    #[test]
    fn run_update_streams_lines_live_and_returns_the_last_one_on_success() {
        let lines = std::sync::Mutex::new(Vec::<String>::new());
        let result =
            with_fake_launcher("ok", "console.log('line1'); console.log('line2');", || {
                run_update_within("9.9.9", Duration::from_secs(10), |line| {
                    lines.lock().unwrap().push(line.to_string())
                })
            });
        assert_eq!(result, Ok("line2".to_string()));
        assert_eq!(
            *lines.lock().unwrap(),
            vec!["line1".to_string(), "line2".to_string()]
        );
    }

    #[test]
    fn run_update_pins_the_install_to_the_app_s_own_release_tag() {
        let result = with_fake_launcher(
            "tag",
            "console.log(process.argv.slice(2).join(' '));",
            || run_update_within("9.9.9", Duration::from_secs(10), |_| {}),
        );
        assert_eq!(result, Ok("update --tag v9.9.9".to_string()));
    }

    #[test]
    fn run_update_fails_with_the_installer_s_own_last_line() {
        let result = with_fake_launcher("fail", "console.log('oops'); process.exit(1);", || {
            run_update_within("9.9.9", Duration::from_secs(10), |_| {})
        });
        assert_eq!(result, Err("the update did not finish: oops".to_string()));
    }

    #[test]
    fn run_update_gives_up_after_its_timeout_and_kills_the_child() {
        let result = with_fake_launcher("hang", "setInterval(() => {}, 1000);", || {
            run_update_within("9.9.9", Duration::from_millis(300), |_| {})
        });
        assert_eq!(result, Err("the update timed out after 0s".to_string()));
    }

    #[test]
    fn a_missing_launcher_is_an_error_not_a_panic() {
        let result = with_fake_launcher("missing", "", || {
            std::fs::remove_file(launcher_dir().unwrap().join("plan2code.js")).unwrap();
            run_update_within("9.9.9", Duration::from_secs(10), |_| {})
        });
        assert!(result.unwrap_err().contains("is missing"));
    }
}
