//! The PTY host against the fake agent in a real pseudo-terminal. Real agents
//! are never started here.

use std::sync::mpsc::{channel, Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use plan2code_app_lib::pty_host::{PtyHost, StartOptions};

mod common;
use common::{fake_agent, process_alive};

fn start_fake() -> (PtyHost, Receiver<Vec<u8>>) {
    let (tx, rx) = channel();
    let host = PtyHost::start(
        StartOptions {
            program: fake_agent().to_string_lossy().into_owned(),
            args: vec![],
            env: vec![],
            cwd: None,
            cols: 80,
            rows: 24,
        },
        move |bytes| {
            let _ = tx.send(bytes);
        },
    )
    .expect("start the fake agent");
    (host, rx)
}

/// Collect output until `needle` appears; panic with what arrived if it does not.
/// Windows' pseudo-terminal asks where the cursor is (ESC [ 6 n) and holds the
/// output until it is told, as a real terminal such as xterm does on its own.
fn wait_for(host: &PtyHost, rx: &Receiver<Vec<u8>>, seen: &mut String, needle: &str) {
    let deadline = Instant::now() + Duration::from_secs(20);
    while !seen.contains(needle) {
        let left = deadline.saturating_duration_since(Instant::now());
        match rx.recv_timeout(left) {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for _ in text.matches("[6n") {
                    host.write(b"[1;1R").unwrap();
                }
                seen.push_str(&text);
            }
            Err(RecvTimeoutError::Timeout) | Err(RecvTimeoutError::Disconnected) => {
                panic!("never saw {needle:?}; got {seen:?}")
            }
        }
    }
}

#[test]
fn banner_arrives() {
    let (host, rx) = start_fake();
    let mut seen = String::new();
    wait_for(&host, &rx, &mut seen, "FAKE-AGENT ready");
    host.kill().unwrap();
}

#[test]
fn typed_line_is_echoed() {
    let (host, rx) = start_fake();
    let mut seen = String::new();
    wait_for(&host, &rx, &mut seen, "FAKE-AGENT ready");
    host.write(b"hello there\r").unwrap();
    wait_for(&host, &rx, &mut seen, "echo: hello there");
    host.kill().unwrap();
}

#[test]
fn resize_reaches_the_child() {
    let (host, rx) = start_fake();
    let mut seen = String::new();
    wait_for(&host, &rx, &mut seen, "SIZE 80x24");
    host.resize(100, 30).unwrap();
    wait_for(&host, &rx, &mut seen, "SIZE 100x30");
    host.kill().unwrap();
}

#[test]
fn exit_code_is_returned() {
    let (host, rx) = start_fake();
    let mut seen = String::new();
    wait_for(&host, &rx, &mut seen, "FAKE-AGENT ready");
    host.write(b"EXIT 3\r").unwrap();
    assert_eq!(host.wait().unwrap(), 3);
}

#[test]
fn kill_ends_a_running_step() {
    let (host, rx) = start_fake();
    let mut seen = String::new();
    wait_for(&host, &rx, &mut seen, "FAKE-AGENT ready");
    host.write(b"STEP 30\r").unwrap();
    wait_for(&host, &rx, &mut seen, "working 1/30");
    let started = Instant::now();
    host.kill().unwrap();
    host.wait().unwrap();
    assert!(
        started.elapsed() < Duration::from_secs(10),
        "kill took too long"
    );
}

/// An npm `.cmd` shim: `cmd.exe` is the directly spawned process, the real
/// program (here, the fake agent) its grandchild. `kill` must end both, not
/// just `cmd.exe` (Task 9.8).
#[cfg(windows)]
#[test]
fn kill_ends_a_cmd_wrapped_grandchild_too() {
    use plan2code_app_lib::agents::windows_command;
    use std::fs;

    let dir = std::env::temp_dir().join(format!("plan2code-pty-cmdshim-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let shim = dir.join("shim.cmd");
    fs::write(
        &shim,
        format!("@echo off\r\n\"{}\" %*\r\n", fake_agent().display()),
    )
    .unwrap();

    let (program, args) = windows_command("shim", vec![], &dir.to_string_lossy());
    let path = format!(
        "{};{}",
        dir.to_string_lossy(),
        std::env::var("PATH").unwrap_or_default()
    );
    let (tx, rx) = channel();
    let host = PtyHost::start(
        // `cmd /c shim.cmd` is a bare name: like a real npm shim, cmd.exe
        // only finds it on PATH, never by the current directory alone.
        StartOptions {
            program,
            args,
            env: vec![("PATH".to_string(), path)],
            cwd: None,
            cols: 80,
            rows: 24,
        },
        move |bytes| {
            let _ = tx.send(bytes);
        },
    )
    .expect("start the cmd-wrapped fake agent");

    let mut seen = String::new();
    wait_for(&host, &rx, &mut seen, "FAKE-AGENT ready");
    host.write(b"PID\r").unwrap();
    wait_for(&host, &rx, &mut seen, "PID ");
    let pid: u32 = seen
        .rsplit("PID ")
        .next()
        .unwrap()
        .trim_start()
        .split(|c: char| !c.is_ascii_digit())
        .next()
        .unwrap()
        .parse()
        .expect("the grandchild's pid");
    assert!(
        process_alive(pid),
        "the grandchild should be running before kill"
    );

    host.kill().unwrap();
    let deadline = Instant::now() + Duration::from_secs(10);
    while process_alive(pid) && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(!process_alive(pid), "the grandchild outlived kill()");
    let _ = fs::remove_dir_all(&dir);
}
