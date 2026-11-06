//! At most one agent per project folder: start it, end it, restart it (always
//! at once: the app confirms with the person first, so nothing here waits for
//! a quiet moment), and notice when it ends by itself.
//! Knows nothing about Tauri: state changes and output go to one callback.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use serde::Serialize;

use crate::agents::{agent_launch_spec, Agent, PermissionMode};
use crate::pty_host::{PtyHost, StartOptions};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum AgentState {
    Idle,
    Running,
    /// The agent ended without a Restart press, or could not be started.
    Ended {
        reason: String,
    },
}

/// Runs just before a Restart starts the fresh agent, and returns the line the
/// bar shows about it (`None` for no line). It must not call back into the
/// manager: it runs with the manager's state locked.
pub type BeforeFresh = Arc<dyn Fn() -> Option<String> + Send + Sync>;

/// Runs when the Implementation Loop starts a phase's fresh agent: the app
/// forgets the console session it was showing, so the new agent's `open`
/// makes a session of its own. Like `BeforeFresh`, it must not call back into
/// the manager.
pub type ForgetSession = Arc<dyn Fn() + Send + Sync>;

/// What the page needs to draw the bar. `generation` counts the agents started
/// so far: a new number means a fresh agent, so the terminal clears.
#[derive(Clone, Debug, Serialize)]
pub struct AgentSnapshot {
    #[serde(flatten)]
    pub state: AgentState,
    pub kind: Option<String>,
    pub generation: u64,
    /// The running (or last started) agent's permission mode, so the bar's
    /// note can name it instead of assuming bypass.
    pub mode: Option<PermissionMode>,
    /// What the last Restart left for the dashboard, for the bar.
    #[serde(rename = "briefNote", skip_serializing_if = "Option::is_none")]
    pub brief_note: Option<String>,
}

pub enum AgentEvent {
    Output(Vec<u8>),
    State(AgentSnapshot),
}

/// Receives events from several threads. State events are sent while the
/// manager holds its lock, so a sink must not call back into the manager.
pub type Sink = Arc<dyn Fn(AgentEvent) + Send + Sync>;

struct Running {
    host: Arc<PtyHost>,
}

/// What a Restart starts again, besides the brief: the agent, its model and
/// effort (when it has one), and its permission mode. Restart reuses this
/// whole, unchanged choice (Task 9.6).
#[derive(Clone)]
struct StartChoice {
    kind: Agent,
    model: Option<String>,
    effort: Option<String>,
    mode: PermissionMode,
}

/// Recent output from the current generation is kept bounded, so a page
/// reload or a fresh output channel can redraw the screen instead of staying
/// blank. About enough for a full screen redraw with some headroom, never
/// the whole scrollback.
const REPLAY_LIMIT: usize = 256 * 1024;

/// Appends `bytes` to `replay`, dropping from the front (the oldest) when
/// that would put it over `limit`: the tail, what a redraw actually needs,
/// is always what is kept.
fn append_replay(replay: &mut Vec<u8>, bytes: &[u8], limit: usize) {
    replay.extend_from_slice(bytes);
    if replay.len() > limit {
        let excess = replay.len() - limit;
        replay.drain(..excess);
    }
}

struct Inner {
    state: AgentState,
    running: Option<Running>,
    /// What a Restart starts again: the choice and its brief (the prompt a
    /// restart runs again, never a transient first prompt).
    last_start: Option<(StartChoice, Option<String>)>,
    size: (u16, u16),
    brief_note: Option<String>,
    /// Cleared when a fresh agent starts; see `REPLAY_LIMIT`.
    replay: Vec<u8>,
}

struct Shared {
    folder: PathBuf,
    sink: Sink,
    before_fresh: Mutex<Option<BeforeFresh>>,
    forget_session: Mutex<Option<ForgetSession>>,
    /// Environment every agent this manager starts gets, on top of its own:
    /// the in-app signal that sends the agent's console pages to this window.
    extra_env: Mutex<Vec<(String, String)>>,
    /// Bumped for every agent started. Output and exits from an older agent
    /// compare against it and are dropped.
    generation: AtomicU64,
    inner: Mutex<Inner>,
}

pub struct AgentManager {
    shared: Arc<Shared>,
}

fn lock(inner: &Mutex<Inner>) -> MutexGuard<'_, Inner> {
    // A panic in another thread must not take the whole app's agent control down.
    inner
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl AgentManager {
    pub fn new(folder: PathBuf, sink: Sink) -> AgentManager {
        AgentManager {
            shared: Arc::new(Shared {
                folder,
                sink,
                before_fresh: Mutex::new(None),
                forget_session: Mutex::new(None),
                extra_env: Mutex::new(Vec::new()),
                generation: AtomicU64::new(0),
                inner: Mutex::new(Inner {
                    state: AgentState::Idle,
                    running: None,
                    last_start: None,
                    size: (80, 24),
                    brief_note: None,
                    replay: Vec::new(),
                }),
            }),
        }
    }

    pub fn folder(&self) -> &PathBuf {
        &self.shared.folder
    }

    /// Run `hook` before every Restart starts its fresh agent.
    pub fn set_before_fresh(&self, hook: BeforeFresh) {
        if let Ok(mut slot) = self.shared.before_fresh.lock() {
            *slot = Some(hook);
        }
    }

    /// Run `hook` whenever the loop starts a phase's fresh agent (`start_fresh`
    /// and `forget_session`).
    pub fn set_forget_session(&self, hook: ForgetSession) {
        if let Ok(mut slot) = self.shared.forget_session.lock() {
            *slot = Some(hook);
        }
    }

    /// Make the app forget the console session it follows, so the next agent's
    /// `open` starts a new one.
    pub fn forget_session(&self) {
        self.shared.forget();
    }

    /// Give every agent started from now on these variables (replacing any set before).
    pub fn set_env(&self, env: Vec<(String, String)>) {
        if let Ok(mut slot) = self.shared.extra_env.lock() {
            *slot = env;
        }
    }

    /// Start `kind` (built-in or custom) on `model`, `effort` and `mode`, with `brief` (`None` is
    /// the placeholder brief: the plain `/plan2code` prompt, which opens the
    /// dashboard). A second start while an agent runs is refused. Restart
    /// reuses this exact choice, so a later call replaces it for good.
    pub fn start(
        &self,
        kind: Agent,
        model: Option<String>,
        effort: Option<String>,
        mode: PermissionMode,
        brief: Option<String>,
    ) -> Result<(), String> {
        let prompt = brief
            .clone()
            .unwrap_or_else(|| kind.default_prompt().to_string());
        self.begin(
            StartChoice {
                kind,
                model,
                effort,
                mode,
            },
            brief,
            prompt,
            None,
            Vec::new(),
        )
    }

    /// Like `start`, but `prompt` is this launch's first prompt alone: a later
    /// Restart still opens the placeholder brief (the dashboard), it does not
    /// run `prompt` again. The loop's own agent starts take this path, so a
    /// phase prompt never becomes the brief a New Session repeats.
    pub fn start_transient(
        &self,
        kind: Agent,
        model: Option<String>,
        effort: Option<String>,
        mode: PermissionMode,
        prompt: String,
    ) -> Result<(), String> {
        self.begin(
            StartChoice {
                kind,
                model,
                effort,
                mode,
            },
            None,
            prompt,
            None,
            Vec::new(),
        )
    }

    /// `start_transient` for a loop phase that runs on its own strength after
    /// the agent was stopped: the stored launch choice is `kind`, `model`,
    /// `effort` and `mode` (so a later New Session or phase runs on it), while
    /// this one launch runs on `phase_model` and `phase_effort` with
    /// `extra_env` added.
    pub fn start_transient_on(
        &self,
        launch: (Agent, Option<String>, Option<String>, PermissionMode),
        prompt: String,
        phase_model: String,
        phase_effort: Option<String>,
        extra_env: Vec<(String, String)>,
    ) -> Result<(), String> {
        let (kind, model, effort, mode) = launch;
        let on = StartChoice {
            kind: kind.clone(),
            model: Some(phase_model),
            effort: phase_effort,
            mode,
        };
        self.begin(
            StartChoice {
                kind,
                model,
                effort,
                mode,
            },
            None,
            prompt,
            Some(on),
            extra_env,
        )
    }

    /// `start` and `start_transient` behind one door: remember `choice` with
    /// `restart_brief` (what a later Restart runs again), then spawn the agent
    /// on `first_prompt`, which is not always the same string.
    fn begin(
        &self,
        choice: StartChoice,
        restart_brief: Option<String>,
        first_prompt: String,
        launch_choice: Option<StartChoice>,
        launch_env: Vec<(String, String)>,
    ) -> Result<(), String> {
        let mut inner = lock(&self.shared.inner);
        if inner.state == AgentState::Running {
            return Err("an agent is already running for this project".to_string());
        }
        inner.brief_note = None;
        let previous = inner.last_start.replace((choice, restart_brief));
        match self
            .shared
            .spawn(&mut inner, first_prompt, launch_choice, launch_env)
        {
            Ok(()) => Ok(()),
            Err(e) => {
                // A start that never ran must not take away what Restart would
                // have started again.
                inner.last_start = previous;
                Err(e)
            }
        }
    }

    /// Start a fresh agent on the stored launch choice with `prompt` as its
    /// only first prompt: the Implementation Loop's way to begin a phase. A
    /// running agent is killed first (the same path as Restart), but without
    /// Restart's brief note; the app still forgets the console session, so
    /// the new agent's `open` makes a new one. An agent that ended, or never
    /// ran, starts directly. Needs a launch choice from an earlier start.
    /// `prompt` belongs to this launch alone: the stored brief stays what it
    /// was, so a later New Session still opens the dashboard, not this
    /// prompt again.
    pub fn start_fresh(&self, prompt: String) -> Result<(), String> {
        self.fresh(prompt, None, Vec::new())
    }

    /// Like `start_fresh`, but the agent runs on `model` and `effort` for this
    /// launch alone, with `extra_env` added to its environment: the loop's way
    /// to start a phase on its strength. The agent kind and permission mode
    /// stay the stored launch choice's, and the stored choice itself is never
    /// written, so a later `start_fresh`, New Session or Restart runs on the
    /// original model and effort without `extra_env`.
    pub fn start_phase_on(
        &self,
        prompt: String,
        model: String,
        effort: Option<String>,
        extra_env: Vec<(String, String)>,
    ) -> Result<(), String> {
        let stored = lock(&self.shared.inner)
            .last_start
            .as_ref()
            .map(|(choice, _)| choice.clone())
            .ok_or("no agent has been started")?;
        let choice = StartChoice {
            model: Some(model),
            effort,
            ..stored
        };
        self.fresh(prompt, Some(choice), extra_env)
    }

    /// The kill-then-spawn body `start_fresh` and `start_phase_on` share.
    fn fresh(
        &self,
        prompt: String,
        choice: Option<StartChoice>,
        extra_env: Vec<(String, String)>,
    ) -> Result<(), String> {
        let mut inner = lock(&self.shared.inner);
        if inner.last_start.is_none() {
            return Err("no agent has been started".to_string());
        }
        inner.brief_note = None;
        self.shared.forget();
        if inner.state == AgentState::Running {
            self.shared.generation.fetch_add(1, Ordering::SeqCst);
            if let Some(old) = inner.running.take() {
                let _ = old.host.kill();
            }
        }
        match self.shared.spawn(&mut inner, prompt, choice, extra_env) {
            Ok(()) => Ok(()),
            Err(e) => {
                inner.state = AgentState::Ended {
                    reason: format!("could not start the agent: {e}"),
                };
                self.shared.emit(&inner);
                Err(e)
            }
        }
    }

    /// The stored launch choice: agent, model, effort and permission mode.
    pub fn launch_choice(&self) -> Option<(Agent, Option<String>, Option<String>, PermissionMode)> {
        lock(&self.shared.inner)
            .last_start
            .as_ref()
            .map(|(choice, _)| {
                (
                    choice.kind.clone(),
                    choice.model.clone(),
                    choice.effort.clone(),
                    choice.mode,
                )
            })
    }

    pub fn snapshot(&self) -> AgentSnapshot {
        self.shared.snapshot(&lock(&self.shared.inner))
    }

    /// The current generation's recent output, for a page that just mounted
    /// (a reload or a fresh window) to redraw instead of staying blank.
    pub fn replay(&self) -> Vec<u8> {
        lock(&self.shared.inner).replay.clone()
    }

    /// The model and effort the current (or last) start chose. The bar only
    /// ever needs `snapshot`'s `kind` and `mode`; this exists so a test can
    /// confirm Restart keeps the other two of the four just as unchanged.
    pub fn model_and_effort(&self) -> (Option<String>, Option<String>) {
        match &lock(&self.shared.inner).last_start {
            Some((choice, _)) => (choice.model.clone(), choice.effort.clone()),
            None => (None, None),
        }
    }

    pub fn is_active(&self) -> bool {
        lock(&self.shared.inner).state == AgentState::Running
    }

    pub fn input(&self, bytes: &[u8]) -> Result<(), String> {
        let host = lock(&self.shared.inner)
            .running
            .as_ref()
            .map(|r| Arc::clone(&r.host));
        match host {
            Some(host) => host.write(bytes),
            None => Ok(()),
        }
    }

    /// The terminal changed size. Remembered, so a fresh agent starts at it.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let mut inner = lock(&self.shared.inner);
        inner.size = (cols, rows);
        match &inner.running {
            Some(running) => running.host.resize(cols, rows),
            None => Ok(()),
        }
    }

    /// Kill the agent (if any) and start a fresh one on the same brief, at
    /// once, whatever it is doing. The app asks the person to confirm before
    /// calling this: there is no in-between "waiting" state here, because the
    /// agent's own output (status lines, a spinner) never truly goes quiet, so
    /// a "wait for it to finish" rule would wait forever in practice. Restart
    /// also answers an ended agent, where nothing is lost by it.
    pub fn restart(&self) -> Result<(), String> {
        let mut inner = lock(&self.shared.inner);
        if inner.state == AgentState::Idle {
            return Err("no agent has been started".to_string());
        }
        self.shared.replace(&mut inner)
    }

    /// End the agent for good (quitting). Nothing starts afterwards, and the
    /// agent's process is gone when this returns.
    pub fn stop(&self) {
        let host = {
            let mut inner = lock(&self.shared.inner);
            // Older agents' output and exits stop counting from here.
            self.shared.generation.fetch_add(1, Ordering::SeqCst);
            let host = inner.running.take().map(|r| r.host);
            inner.state = AgentState::Idle;
            inner.last_start = None;
            self.shared.emit(&inner);
            host
        };
        if let Some(host) = host {
            let _ = host.kill();
            let _ = host.wait();
        }
    }
}

impl Drop for AgentManager {
    fn drop(&mut self) {
        self.stop();
    }
}

impl Shared {
    fn snapshot(&self, inner: &Inner) -> AgentSnapshot {
        AgentSnapshot {
            state: inner.state.clone(),
            kind: inner
                .last_start
                .as_ref()
                .map(|(choice, _)| choice.kind.id().to_string()),
            mode: inner.last_start.as_ref().map(|(choice, _)| choice.mode),
            generation: self.generation.load(Ordering::SeqCst),
            brief_note: inner.brief_note.clone(),
        }
    }

    fn forget(&self) {
        let hook = self
            .forget_session
            .lock()
            .ok()
            .and_then(|slot| slot.clone());
        if let Some(run) = hook {
            run();
        }
    }

    fn emit(&self, inner: &Inner) {
        (self.sink)(AgentEvent::State(self.snapshot(inner)));
    }

    /// Start the agent in `inner.last_start` on `prompt` and watch for it to
    /// end. `prompt` is this launch's first prompt: the stored brief for a
    /// start or a Restart, or a transient one (`start_fresh`,
    /// `start_transient`) that a Restart must not repeat.
    ///
    /// `choice_override` runs this launch on another choice than the stored
    /// one (which it never replaces), and `launch_env` is added to the
    /// process env after the manager's own; both are empty for every caller
    /// but the loop's phase start.
    fn spawn(
        self: &Arc<Self>,
        inner: &mut Inner,
        prompt: String,
        choice_override: Option<StartChoice>,
        launch_env: Vec<(String, String)>,
    ) -> Result<(), String> {
        let choice = match choice_override {
            Some(choice) => choice,
            None => {
                inner
                    .last_start
                    .clone()
                    .ok_or("no agent has been started")?
                    .0
            }
        };
        let mut spec = agent_launch_spec(
            &choice.kind,
            &self.folder,
            choice.model.as_deref(),
            choice.effort.as_deref(),
            choice.mode,
            &prompt,
        );
        if let Ok(extra) = self.extra_env.lock() {
            spec.env.extend(extra.iter().cloned());
        }
        spec.env.extend(launch_env);
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;

        let on_output = {
            let shared = Arc::clone(self);
            move |bytes: Vec<u8>| {
                // Taking the lock here, briefly, keeps this behind the state
                // change that announces its agent (`spawn`'s caller holds the
                // lock until it has emitted), so the page clears its screen
                // before the banner. It is released before the send below,
                // which can be slow, so typing (`input`) is never stuck
                // behind a flood of output.
                let stale = {
                    let mut in_order = lock(&shared.inner);
                    if shared.generation.load(Ordering::SeqCst) != generation {
                        true
                    } else {
                        append_replay(&mut in_order.replay, &bytes, REPLAY_LIMIT);
                        false
                    }
                };
                if stale {
                    return;
                }
                (shared.sink)(AgentEvent::Output(bytes));
            }
        };
        let host = Arc::new(PtyHost::start(
            StartOptions {
                program: spec.program,
                args: spec.args,
                env: spec.env,
                cwd: Some(spec.cwd),
                cols: inner.size.0,
                rows: inner.size.1,
            },
            on_output,
        )?);

        inner.running = Some(Running {
            host: Arc::clone(&host),
        });
        inner.state = AgentState::Running;
        // A fresh agent starts on a clean screen; its replay must too.
        inner.replay.clear();
        self.emit(inner);

        let shared = Arc::clone(self);
        thread::spawn(move || {
            let reason = match host.wait_described() {
                Ok((_, Some(signal))) => format!("was ended by a signal ({signal})"),
                Ok((code, None)) => format!("exited with code {code}"),
                Err(e) => format!("stopped: {e}"),
            };
            shared.on_exit(generation, reason);
        });
        Ok(())
    }

    /// Kill the running agent (if any) and start a fresh one on the same
    /// brief. A fresh agent that cannot start leaves the state `Ended`.
    fn replace(self: &Arc<Self>, inner: &mut Inner) -> Result<(), String> {
        // Bumping the generation first drops whatever the old agent still says.
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Some(old) = inner.running.take() {
            let _ = old.host.kill();
        }
        let hook = self.before_fresh.lock().ok().and_then(|slot| slot.clone());
        inner.brief_note = hook.and_then(|run| run());
        let prompt = inner
            .last_start
            .as_ref()
            .map(|(choice, brief)| {
                brief
                    .clone()
                    .unwrap_or_else(|| choice.kind.default_prompt().to_string())
            })
            .ok_or("no agent has been started")?;
        match self.spawn(inner, prompt, None, Vec::new()) {
            Ok(()) => Ok(()),
            Err(e) => {
                inner.state = AgentState::Ended {
                    reason: format!("could not start the agent: {e}"),
                };
                self.emit(inner);
                Err(e)
            }
        }
    }

    /// The agent's process ended. Stale if a newer agent has replaced it.
    fn on_exit(self: &Arc<Self>, generation: u64, reason: String) {
        let mut inner = lock(&self.inner);
        if self.generation.load(Ordering::SeqCst) != generation {
            return;
        }
        inner.running = None;
        // Ended on its own: say why and start nothing.
        inner.state = AgentState::Ended { reason };
        self.emit(&inner);
    }
}

#[cfg(test)]
mod replay_tests {
    use super::*;

    #[test]
    fn under_the_limit_keeps_everything() {
        let mut replay = b"hello ".to_vec();
        append_replay(&mut replay, b"world", 20);
        assert_eq!(replay, b"hello world");
    }

    #[test]
    fn over_the_limit_drops_the_oldest_bytes_and_keeps_the_tail() {
        let mut replay = b"0123456789".to_vec();
        append_replay(&mut replay, b"ABCDE", 10);
        // 15 bytes written, a 10-byte limit: the oldest 5 ("01234") are gone.
        assert_eq!(replay, b"56789ABCDE");
        assert_eq!(replay.len(), 10);
    }

    #[test]
    fn a_single_write_longer_than_the_limit_keeps_only_its_own_tail() {
        let mut replay = Vec::new();
        append_replay(&mut replay, b"0123456789", 4);
        assert_eq!(replay, b"6789");
    }
}
