//! The supervisor against the real console: a temp project, no agent, no
//! Tauri. `PLAN2CODE_CONSOLE_DIR` points the lookup at the repo's own console
//! source and `PLAN2CODE_CONSOLE_HOME` keeps the sessions out of the user's
//! real console folder. Skipped entirely when node is not on PATH.

use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};

use plan2code_app_lib::console_supervisor::{app_origin, ConsoleSupervisor};

fn have_node() -> bool {
    Command::new("node")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn repo_console_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../src/web-console")
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("p2c-sup-{name}-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn setup() -> Option<PathBuf> {
    if !have_node() {
        eprintln!("skipping: node is not on PATH");
        return None;
    }
    let console = repo_console_dir();
    assert!(console.join("console.mjs").is_file(), "console source missing at {}", console.display());
    std::env::set_var("PLAN2CODE_CONSOLE_DIR", &console);
    std::env::set_var("PLAN2CODE_CONSOLE_HOME", temp_dir("home"));
    std::env::set_var("PLAN2CODE_NO_BROWSER", "1");
    Some(temp_dir("project"))
}

fn kill_pid(pid: u32) {
    #[cfg(windows)]
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .output();
    #[cfg(not(windows))]
    let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
}

/// The detached server can take a beat to bind or die; ask until `want` holds.
fn until_health(sup: &ConsoleSupervisor, want: bool) -> bool {
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        if sup.health() == want {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

#[test]
fn starts_answers_and_stops() {
    let Some(project) = setup() else { return };
    let mut sup = ConsoleSupervisor::start(project, app_origin().to_string()).expect("start");
    assert!(!sup.session().sid.is_empty());
    assert!(sup.session().url.starts_with("http://127.0.0.1:"));
    assert!(sup.session().pid > 0);
    assert!(until_health(&sup, true), "the console URL never answered");

    sup.stop().expect("stop");
    assert!(until_health(&sup, false), "the console still answered after stop()");
}

#[test]
fn a_killed_console_is_dead_and_restarts() {
    let Some(project) = setup() else { return };
    let mut sup = ConsoleSupervisor::start(project, app_origin().to_string()).expect("start");
    assert!(until_health(&sup, true), "the console URL never answered");
    let first_sid = sup.session().sid.clone();

    kill_pid(sup.session().pid);
    assert!(until_health(&sup, false), "a killed console still looked alive");

    assert!(sup.restart_if_dead().expect("restart"), "restart_if_dead did nothing");
    assert_eq!(sup.session().sid, first_sid, "a dead console comes back on the same session, so its page and place survive");
    assert!(until_health(&sup, true), "the restarted console never answered");
    sup.stop().expect("stop");
}

#[test]
fn a_live_console_is_not_restarted() {
    let Some(project) = setup() else { return };
    let mut sup = ConsoleSupervisor::start(project, app_origin().to_string()).expect("start");
    assert!(until_health(&sup, true), "the console URL never answered");
    assert!(!sup.restart_if_dead().expect("restart check"));
    sup.stop().expect("stop");
}
