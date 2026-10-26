//! The agent lifecycle against the fake agent in a real pseudo-terminal. Real
//! agents are never started here: `PLAN2CODE_APP_AGENT_BIN` points every agent
//! kind at the fake one.

use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex, Once};
use std::time::{Duration, Instant};

use plan2code_app_lib::agent_manager::{AgentEvent, AgentManager, AgentSnapshot, AgentState};
use plan2code_app_lib::agents::{Agent, AgentKind, PermissionMode, AGENT_BIN_ENV};

mod common;
use common::process_alive;

const TIMEOUT: Duration = Duration::from_secs(20);
const READY: &str = "FAKE-AGENT ready";

struct Harness {
    manager: AgentManager,
    rx: Receiver<AgentEvent>,
    /// Everything the agents printed, in order.
    seen: String,
    /// Every state change, in order.
    states: Vec<AgentSnapshot>,
    /// How many of `states` `wait_state` has already looked at.
    cursor: usize,
}

impl Harness {
    fn new() -> Harness {
        static BIN: Once = Once::new();
        BIN.call_once(|| std::env::set_var(AGENT_BIN_ENV, common::fake_agent()));
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        let sink = Arc::new(move |event| {
            let _ = tx.lock().unwrap().send(event);
        });
        Harness { manager: AgentManager::new(PathBuf::from("."), sink), rx, seen: String::new(), states: Vec::new(), cursor: 0 }
    }

    fn take(&mut self, event: AgentEvent) {
        match event {
            AgentEvent::Output(bytes) => {
                let text = String::from_utf8_lossy(&bytes).into_owned();
                // Windows' pseudo-terminal asks where the cursor is (ESC [ 6 n)
                // and holds the output until told, as xterm does on its own.
                for _ in text.matches("[6n") {
                    self.manager.input(b"\x1b[1;1R").unwrap();
                }
                self.seen.push_str(&text);
            }
            AgentEvent::State(snapshot) => self.states.push(snapshot),
        }
    }

    /// Handle events for `how_long`, answering the terminal's questions.
    fn pump_for(&mut self, how_long: Duration) {
        let deadline = Instant::now() + how_long;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            match self.rx.recv_timeout(left) {
                Ok(event) => self.take(event),
                Err(_) => return,
            }
        }
    }

    fn wait_for_output(&mut self, needle: &str, times: usize) {
        let deadline = Instant::now() + TIMEOUT;
        while self.seen.matches(needle).count() < times {
            let left = deadline.saturating_duration_since(Instant::now());
            match self.rx.recv_timeout(left) {
                Ok(event) => self.take(event),
                Err(RecvTimeoutError::Timeout) | Err(RecvTimeoutError::Disconnected) => {
                    panic!("never saw {needle:?} {times} time(s); got {:?}", self.seen)
                }
            }
        }
    }

    /// The next state change (after the last one this returned) that matches.
    fn wait_state(&mut self, what: &str, matches: impl Fn(&AgentSnapshot) -> bool) -> AgentSnapshot {
        let deadline = Instant::now() + TIMEOUT;
        loop {
            while self.cursor < self.states.len() {
                let snapshot = self.states[self.cursor].clone();
                self.cursor += 1;
                if matches(&snapshot) {
                    return snapshot;
                }
            }
            let left = deadline.saturating_duration_since(Instant::now());
            match self.rx.recv_timeout(left) {
                Ok(event) => self.take(event),
                Err(_) => panic!("never saw the state {what}; got {:?}", self.states),
            }
        }
    }

    fn start_and_wait_ready(&mut self) {
        self.manager.start(Agent::Builtin(AgentKind::Claude), None, None, PermissionMode::Bypass, None).expect("start the fake agent");
        self.wait_for_output(READY, 1);
    }

    fn type_line(&self, line: &str) {
        self.manager.input(format!("{line}\r").as_bytes()).unwrap();
    }
}

fn is_running(snapshot: &AgentSnapshot) -> bool {
    snapshot.state == AgentState::Running
}

#[test]
fn a_second_start_while_running_is_refused() {
    let mut h = Harness::new();
    h.start_and_wait_ready();
    let generation = h.manager.snapshot().generation;

    let refused = h.manager.start(Agent::Builtin(AgentKind::Devin), None, None, PermissionMode::Bypass, None);
    assert!(refused.is_err(), "a second start must be refused");
    let after = h.manager.snapshot();
    assert_eq!(after.state, AgentState::Running);
    assert_eq!(after.generation, generation, "the running agent was replaced");
    h.manager.stop();
}

#[test]
fn restart_keeps_the_previous_agent_kind_mode_model_and_effort() {
    let mut h = Harness::new();
    h.manager
        .start(Agent::Builtin(AgentKind::Codex), Some("gpt-5".to_string()), Some("high".to_string()), PermissionMode::Checked, None)
        .expect("start the fake agent");
    h.wait_for_output(READY, 1);
    let before = h.manager.snapshot();
    assert_eq!(before.kind, Some("codex".to_string()));
    assert_eq!(before.mode, Some(PermissionMode::Checked));
    assert_eq!(h.manager.model_and_effort(), (Some("gpt-5".to_string()), Some("high".to_string())));

    h.manager.restart().unwrap();
    h.wait_for_output(READY, 2);
    let after = h.manager.snapshot();
    assert_eq!(after.kind, Some("codex".to_string()), "restart must keep the same agent");
    assert_eq!(after.mode, Some(PermissionMode::Checked), "restart must keep the same permission mode");
    assert_eq!(
        h.manager.model_and_effort(),
        (Some("gpt-5".to_string()), Some("high".to_string())),
        "restart must keep the same model and effort"
    );
    h.manager.stop();
}

#[test]
fn restart_between_steps_replaces_the_agent_at_once() {
    let mut h = Harness::new();
    h.start_and_wait_ready();
    let generation = h.manager.snapshot().generation;

    h.manager.restart().unwrap();

    let now = h.manager.snapshot();
    assert_eq!(now.state, AgentState::Running);
    assert!(now.generation > generation, "a fresh agent was not started");
    h.wait_for_output(READY, 2);
    h.manager.stop();
}

#[test]
fn restart_mid_step_kills_the_step_at_once_instead_of_waiting_for_it() {
    let mut h = Harness::new();
    h.start_and_wait_ready();
    h.type_line("STEP 30");
    h.wait_for_output("working 1/30", 1);

    let started = Instant::now();
    h.manager.restart().unwrap();

    // Running again straight away: no wait for the step to finish.
    h.wait_state("Running again", is_running);
    h.wait_for_output(READY, 2);
    assert!(started.elapsed() < Duration::from_secs(5), "restart must not wait on the step; took {:?}", started.elapsed());
    assert!(!h.seen.contains("STEP DONE"), "the step should have been cut short, not finished");
    h.manager.stop();
}

#[test]
fn an_agent_that_exits_by_itself_ends_with_its_code_and_nothing_restarts() {
    let mut h = Harness::new();
    h.start_and_wait_ready();
    h.type_line("EXIT 7");

    let ended = h.wait_state("Ended", |s| matches!(s.state, AgentState::Ended { .. }));
    match &ended.state {
        AgentState::Ended { reason } => assert!(reason.contains('7'), "reason was {reason:?}"),
        other => panic!("expected Ended, got {other:?}"),
    }

    // Nothing starts without a press.
    h.pump_for(Duration::from_millis(1500));
    assert!(matches!(h.manager.snapshot().state, AgentState::Ended { .. }));
    assert_eq!(h.seen.matches(READY).count(), 1, "an agent started by itself");
    assert!(!h.manager.is_active());

    // A press of Restart starts a fresh one on the same brief.
    h.manager.restart().unwrap();
    h.wait_for_output(READY, 2);
    assert_eq!(h.manager.snapshot().state, AgentState::Running);
    h.manager.stop();
}

#[test]
fn quitting_with_a_running_agent_stops_it() {
    let mut h = Harness::new();
    h.start_and_wait_ready();
    assert!(h.manager.is_active());
    h.type_line("PID");
    h.wait_for_output("PID ", 1);
    let pid = h.seen.rsplit("PID ").next().unwrap().trim_start().split(|c: char| !c.is_ascii_digit()).next().unwrap().parse::<u32>().expect("the agent's pid");
    assert!(process_alive(pid), "the agent should be running before the stop");

    h.manager.stop();

    assert!(!process_alive(pid), "the agent's process outlived stop()");

    assert_eq!(h.manager.snapshot().state, AgentState::Idle);
    assert!(!h.manager.is_active());
    // The stopped agent does not come back or print again.
    let before = h.seen.len();
    h.pump_for(Duration::from_millis(1000));
    assert!(!h.seen[before..].contains(READY), "an agent started after the stop");
    assert!(h.manager.restart().is_err(), "there is nothing left to restart");
}

#[test]
fn the_replay_buffer_holds_recent_output_and_clears_on_a_fresh_agent() {
    let mut h = Harness::new();
    h.start_and_wait_ready();
    let replay = String::from_utf8_lossy(&h.manager.replay()).into_owned();
    assert!(replay.contains(READY), "replay should hold what was just printed; got {replay:?}");

    h.manager.restart().unwrap();
    h.wait_for_output(READY, 2);
    let replay = String::from_utf8_lossy(&h.manager.replay()).into_owned();
    assert_eq!(replay.matches(READY).count(), 1, "a fresh agent's replay must not carry the old one's output");
    h.manager.stop();
}

#[test]
fn a_restart_runs_the_brief_hook_and_the_bar_gets_its_note() {
    let mut h = Harness::new();
    let runs = Arc::new(Mutex::new(0));
    let counter = Arc::clone(&runs);
    h.manager.set_before_fresh(Arc::new(move || {
        *counter.lock().unwrap() += 1;
        Some("Brief ready on the dashboard".to_string())
    }));
    h.start_and_wait_ready();
    assert_eq!(*runs.lock().unwrap(), 0, "a first start leaves no brief");
    assert_eq!(h.manager.snapshot().brief_note, None);

    h.manager.restart().unwrap();

    assert_eq!(*runs.lock().unwrap(), 1, "the restart did not run the brief once");
    assert_eq!(h.manager.snapshot().brief_note.as_deref(), Some("Brief ready on the dashboard"));
    h.manager.stop();
}

#[test]
fn the_agent_gets_the_in_app_signal_and_a_restart_keeps_it() {
    let mut h = Harness::new();
    h.manager.set_env(vec![
        ("PLAN2CODE_IN_APP".to_string(), "1".to_string()),
        ("PLAN2CODE_CONSOLE_SID".to_string(), "sid-window-a".to_string()),
    ]);
    h.start_and_wait_ready();
    h.type_line("ENV PLAN2CODE_IN_APP");
    h.wait_for_output("ENV PLAN2CODE_IN_APP=1", 1);
    h.type_line("ENV PLAN2CODE_CONSOLE_SID");
    h.wait_for_output("ENV PLAN2CODE_CONSOLE_SID=sid-window-a", 1);

    // The signal changes with the console; a Restart starts on the newest.
    h.manager.set_env(vec![("PLAN2CODE_CONSOLE_SID".to_string(), "sid-window-b".to_string())]);
    h.manager.restart().unwrap();
    h.wait_for_output(READY, 2);
    h.type_line("ENV PLAN2CODE_CONSOLE_SID");
    h.wait_for_output("ENV PLAN2CODE_CONSOLE_SID=sid-window-b", 1);
    h.type_line("ENV PLAN2CODE_IN_APP");
    h.wait_for_output("ENV PLAN2CODE_IN_APP=\r", 1);
    h.manager.stop();
}

#[test]
fn an_agent_with_no_signal_set_gets_none() {
    let mut h = Harness::new();
    h.start_and_wait_ready();
    h.type_line("ENV PLAN2CODE_IN_APP");
    h.wait_for_output("ENV PLAN2CODE_IN_APP=", 1);
    assert!(!h.seen.contains("ENV PLAN2CODE_IN_APP=1"));
    h.manager.stop();
}
