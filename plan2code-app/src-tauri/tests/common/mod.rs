//! Shared by the integration tests: where the fake agent program is, and
//! whether a process id is still alive.

use std::path::PathBuf;
use std::process::Command;
use std::sync::Once;

/// Is a process with this id still there? Asks the operating system.
#[allow(dead_code)]
pub fn process_alive(pid: u32) -> bool {
    if cfg!(windows) {
        let out = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout)
            .split_whitespace()
            .any(|word| word == pid.to_string())
    } else {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

pub fn fake_agent() -> PathBuf {
    // `cargo test` does not build another package's program, so build it once.
    static BUILD: Once = Once::new();
    BUILD.call_once(|| {
        let status = Command::new(env!("CARGO"))
            .args(["build", "-p", "fake-agent"])
            .status()
            .expect("run cargo");
        assert!(status.success(), "could not build the fake agent");
    });
    // The test binary is in target/<profile>/deps; the fake agent is one up.
    let exe = std::env::current_exe().unwrap();
    let path = exe
        .parent()
        .and_then(|deps| deps.parent())
        .unwrap()
        .join(format!("fake-agent{}", std::env::consts::EXE_SUFFIX));
    assert!(
        path.exists(),
        "{} is missing after building the fake agent",
        path.display()
    );
    path
}
