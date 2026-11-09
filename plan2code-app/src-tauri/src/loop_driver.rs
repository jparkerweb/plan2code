//! The Implementation Loop's driver: one fresh agent per phase, the app judging
//! what each one reports. The agent builds and reports (`loopOutcome`); only
//! this module marks a phase done and commits it (NFR-3). The running record
//! lives in memory alone, so an app restart ends the loop and a new Start picks
//! up from the spec's marks (NFR-5).
//!
//! The judgment is in pure functions (`phase_prompt`, `judge_outcome`,
//! `silence_expired`, `should_retry`, `step_for_stage`, `open_question`,
//! `stop_line`, `evidence_markdown`, `with_approval_line`, `summary_markdown`)
//! so they test without an agent. A crashed or silent agent gets one fresh
//! retry; every other failure stops at once through `stop_loop`, the one place
//! a stop goes, with its evidence on the page.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::agent_manager::{AgentManager, AgentState};
use crate::agents::{Agent, PermissionMode};
use crate::console_supervisor::find_console_dir;
use crate::loop_commit;
use crate::loop_notify::{self, NotifyKind};
use crate::loop_report::{self, EntryResult, LoopReport, ReportEntry};
use crate::loop_tools;
use crate::models::{self, StrengthRow};
use crate::session_reader::{self, ReadError};

// ---------------------------------------------------------------- the setup

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FixMode {
    #[default]
    Levels,
    Smart,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FixLevel {
    Critical,
    Warning,
    Suggestion,
}

impl FixLevel {
    pub fn word(self) -> &'static str {
        match self {
            FixLevel::Critical => "critical",
            FixLevel::Warning => "warning",
            FixLevel::Suggestion => "suggestion",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OnQuestion {
    Pause,
    Stop,
    #[default]
    Guess,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AfterLast {
    #[default]
    OfferFinalize,
    RunFinalize,
}

/// A phase's strength word: what the person picked for one phase.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Strength {
    Thrifty,
    Balanced,
    Best,
}

impl Strength {
    /// The word the setup, the env var and the console use.
    pub fn word(self) -> &'static str {
        match self {
            Strength::Thrifty => "thrifty",
            Strength::Balanced => "balanced",
            Strength::Best => "best",
        }
    }

    /// The word for the report and the page.
    pub fn label(self) -> &'static str {
        match self {
            Strength::Thrifty => "Thrifty",
            Strength::Balanced => "Balanced",
            Strength::Best => "Best",
        }
    }

    pub fn from_word(word: &str) -> Option<Strength> {
        match word {
            "thrifty" => Some(Strength::Thrifty),
            "balanced" => Some(Strength::Balanced),
            "best" => Some(Strength::Best),
            _ => None,
        }
    }
}

/// The env var a strength phase's agent gets; the console reads it so the
/// phase's helpers follow the phase.
pub const STRENGTH_ENV: &str = "PLAN2CODE_LOOP_STRENGTH";

/// One saved pick: the phase's number and name (a renamed phase drops the pick)
/// and the strength word chosen for it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhasePick {
    pub n: u32,
    pub name: String,
    pub strength: Strength,
}

/// One project's entry in `loop-setup.json`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LoopSetup {
    pub review: bool,
    // An entry saved before this field existed fixed by level, so it keeps
    // doing that (FixMode's own default) rather than taking the new setup's.
    #[serde(default)]
    pub fix_mode: FixMode,
    pub fix: Vec<FixLevel>,
    pub commit: bool,
    pub on_question: OnQuestion,
    pub after_last: AfterLast,
    pub quick_check: String,
    pub retry_once: bool,
    pub silence_minutes: u32,
    /// How the notification is sent, when the loop needs the person or ends.
    pub notify_kind: NotifyKind,
    /// The web address it goes to; empty for none.
    pub notify_url: String,
    /// The query parameter or JSON field that carries the message, for the
    /// kinds that let the person name it.
    pub notify_param: String,
    /// Whether a phase that passes is told to the address too (the question,
    /// stop and finish messages are always sent).
    pub notify_phases: bool,
    /// Whether each phase runs on its own strength (off: every phase runs as today).
    pub phase_strength: bool,
    /// The picks per spec folder (`specs/<name>`), only for phases not yet done.
    pub strengths: BTreeMap<String, Vec<PhasePick>>,
}

impl Default for LoopSetup {
    fn default() -> Self {
        LoopSetup {
            review: true,
            fix_mode: FixMode::Smart,
            fix: vec![FixLevel::Critical, FixLevel::Warning, FixLevel::Suggestion],
            commit: true,
            on_question: OnQuestion::Guess,
            after_last: AfterLast::OfferFinalize,
            quick_check: String::new(),
            retry_once: true,
            silence_minutes: 20,
            notify_kind: NotifyKind::Query,
            notify_url: String::new(),
            notify_param: loop_notify::DEFAULT_PARAM.to_string(),
            notify_phases: false,
            phase_strength: false,
            strengths: BTreeMap::new(),
        }
    }
}

impl LoopSetup {
    /// The levels whose leftovers matter: every level in Smart pick.
    fn chosen_levels(&self) -> Vec<FixLevel> {
        if !self.review {
            return Vec::new();
        }
        match self.fix_mode {
            FixMode::Smart => vec![FixLevel::Critical, FixLevel::Warning, FixLevel::Suggestion],
            FixMode::Levels => self.fix.clone(),
        }
    }
}

// -------------------------------------------------------------- the outcome

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Finding {
    pub level: FixLevel,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub file: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(default)]
pub struct Triage {
    pub ran: bool,
    pub skipped: Vec<Finding>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(default)]
pub struct Left {
    pub critical: u32,
    pub warning: u32,
    pub suggestion: u32,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(default)]
pub struct ReviewPart {
    pub ran: bool,
    pub recheck: bool,
    pub triage: Option<Triage>,
    pub left: Left,
    pub unfixed: Vec<Finding>,
    pub fixed: Vec<Finding>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(default)]
pub struct TasksPart {
    pub blocked: Vec<String>,
    pub assumed: Vec<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(default)]
pub struct TestsPart {
    pub ran: bool,
    pub passed: bool,
    pub summary: String,
    /// Names of the tests that failed, when `passed` is false.
    pub failing: Vec<String>,
    /// Names of the failing tests the phase file's Notes say are expected to
    /// fail until a later phase (`expectedFailures` on the wire).
    #[serde(rename = "expectedFailures")]
    pub expected_failures: Vec<String>,
}

/// What a phase's skill reported (`loopOutcome`, overview API).
#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(default)]
pub struct Outcome {
    pub phase: u32,
    pub result: String,
    pub reason: Option<String>,
    pub summary: String,
    pub tests: Option<TestsPart>,
    pub review: Option<ReviewPart>,
    pub tasks: TasksPart,
    pub conflicts: Vec<String>,
    pub decisions: Vec<String>,
    pub subject: String,
}

// -------------------------------------------------------------- the record

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Step {
    Starting,
    Build,
    Review,
    Fixes,
    Recheck,
    WaitingOnYou,
    Checking,
    Commit,
}

impl Step {
    pub fn label(&self) -> &'static str {
        match self {
            Step::Starting => "Starting",
            Step::Build => "Build",
            Step::Review => "Review",
            Step::Fixes => "Fixes",
            Step::Recheck => "Re-check",
            Step::WaitingOnYou => "Waiting on you",
            Step::Checking => "Checking",
            Step::Commit => "Commit",
        }
    }
}

/// The step a console headline stage names; any other word is Build.
pub fn step_for_stage(stage: &str) -> Step {
    let stage = stage.to_lowercase();
    if stage.contains("re-check") || stage.contains("recheck") {
        Step::Recheck
    } else if stage.contains("fix") {
        Step::Fixes
    } else if stage.contains("review") {
        Step::Review
    } else {
        Step::Build
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PhaseStatus {
    Pending,
    Running,
    Done,
    Stopped,
}

#[derive(Clone, Debug)]
pub struct PhaseRecord {
    pub n: u32,
    pub name: String,
    pub status: PhaseStatus,
    pub commit: Option<String>,
    pub subject: Option<String>,
    pub retries: u32,
    /// The strength this phase runs on now: its pick, stepped up by a retry.
    /// `None` for Match my session and for a run with the toggle off.
    pub strength: Option<Strength>,
}

#[derive(Clone, Debug)]
pub struct RunningRecord {
    /// Tells a watch thread whether the record is still its own loop's.
    pub run_id: u64,
    pub project: PathBuf,
    pub spec: String,
    pub setup: LoopSetup,
    pub phases: Vec<PhaseRecord>,
    pub current: usize,
    pub step: Step,
    pub sid: Option<String>,
    /// The latest phase session seen, kept across phases so a stop that comes
    /// before the next session opens can still be told to the page.
    pub last_sid: Option<String>,
    pub started_at: Instant,
    /// The same moment as epoch milliseconds, for the strip's elapsed clock.
    pub started_at_ms: u64,
    pub phase_started_at: Instant,
    /// The last sign of work (session files, the tree), for silence.
    pub last_activity: SystemTime,
    /// When the session files and the tree were last looked at.
    pub activity_checked: Instant,
    pub retries_used: u32,
    pub stop_after_phase: bool,
    /// Set by Stop now; the watch thread ends the loop on its next look.
    pub stop_now: bool,
    /// A question holds the loop (step Waiting on you).
    pub waiting: bool,
    /// The current phase's agent generation, to tell its end from an older one's.
    pub generation: u64,
    /// The phase's report and its entry from `specs.mjs status`, kept for the
    /// evidence document.
    pub last_outcome: Option<Outcome>,
    pub last_entry: Option<Value>,
    /// Output of the call that stopped the loop (a refused commit's hook), kept
    /// for the evidence document.
    pub failure_output: Option<String>,
    /// Why the call to the web address failed while a question held the loop.
    pub notify_failure: Option<String>,
    /// Everything this build has done, across stops and resumes.
    pub report: LoopReport,
    /// Why the report could not be saved, the last time it could not.
    pub report_failure: Option<String>,
    /// Phases Start found marked done with no commit behind them and opened again.
    pub rebuilt: Vec<u32>,
    /// A Resume on a dirty tree: how many uncommitted files the resumed phase's
    /// commit will take.
    pub resumed_files: Option<usize>,
    /// The branch the loop started on (None: not known, or commit off outside
    /// a repository). A detached HEAD never starts a loop.
    pub branch: Option<String>,
    /// `HEAD` when the loop started, kept for later use (nothing shows it yet).
    pub start_head: Option<String>,
    /// Files that were already changed when the loop started: the person's own
    /// work, left out of the stop screen's list of the agent's.
    pub own_dirty: Vec<String>,
    /// How many looks in a row could not read the phase's session; reset by
    /// the next good read. While it is above zero a silence stop says why.
    pub read_failures: u32,
    /// What each strength word maps to for the loop's agent, resolved once at
    /// the start (empty with the toggle off), so no phase start rereads files.
    pub strength_rows: BTreeMap<String, StrengthRow>,
    /// The launch choice's model and effort, which a Match my session phase runs on.
    pub launch_model: Option<String>,
    pub launch_effort: Option<String>,
    /// What `git status` listed when the current phase began: changes that
    /// are not the phase's, left out of its commit. `None` when it could not
    /// be read, and the commit then stages nothing. A retry keeps the first
    /// try's baseline, so the work the crashed try left is still the phase's.
    pub phase_baseline: Option<Vec<String>>,
    /// An Implement page announced while the phase had no session yet, but
    /// not yet locked by the agent's `open --loop`: adopted on a later look
    /// once its state shows the lock (`note_page`).
    pub page_candidate: Option<String>,
}

/// What one phase runs on, for its start, the strip and the report.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PhaseRun {
    /// `None`: the phase runs on the launch choice.
    pub strength: Option<Strength>,
    pub model: Option<String>,
    pub effort: Option<String>,
}

impl PhaseRun {
    /// "sonnet, low", "opus", or "" when no model is known.
    pub fn model_text(&self) -> String {
        match (&self.model, &self.effort) {
            (Some(m), Some(e)) => format!("{m}, {e}"),
            (Some(m), None) => m.clone(),
            _ => String::new(),
        }
    }

    /// The report's word: "Thrifty", or "Match my session".
    pub fn word_text(&self) -> &'static str {
        self.strength.map_or("Match my session", Strength::label)
    }
}

fn report_time() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M").to_string()
}

fn epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| u64::try_from(d.as_millis()).unwrap_or(0))
        .unwrap_or(0)
}

impl RunningRecord {
    pub fn new(
        project: PathBuf,
        spec: String,
        setup: LoopSetup,
        phases: Vec<PhaseRecord>,
    ) -> RunningRecord {
        let now = Instant::now();
        let report = LoopReport::new(&spec, &report_time());
        RunningRecord {
            run_id: NEXT_RUN.fetch_add(1, Ordering::SeqCst),
            project,
            spec,
            setup,
            phases,
            current: 0,
            step: Step::Starting,
            sid: None,
            last_sid: None,
            started_at: now,
            started_at_ms: epoch_ms(),
            phase_started_at: now,
            last_activity: SystemTime::now(),
            activity_checked: now,
            retries_used: 0,
            stop_after_phase: false,
            stop_now: false,
            waiting: false,
            generation: 0,
            last_outcome: None,
            last_entry: None,
            failure_output: None,
            notify_failure: None,
            report,
            report_failure: None,
            rebuilt: Vec::new(),
            resumed_files: None,
            branch: None,
            start_head: None,
            own_dirty: Vec::new(),
            read_failures: 0,
            strength_rows: BTreeMap::new(),
            launch_model: None,
            launch_effort: None,
            phase_baseline: None,
            page_candidate: None,
        }
    }

    /// What phase `index` runs on, or `None` with Set strength per phase off.
    /// A phase whose word the agent does not map runs on the launch choice
    /// (Start is held for such a pick, so this is only a guard).
    pub fn phase_run(&self, index: usize) -> Option<PhaseRun> {
        if !self.setup.phase_strength {
            return None;
        }
        let word = self.phases.get(index)?.strength;
        if let Some(word) = word {
            if let Some(row) = self.strength_rows.get(word.word()) {
                return Some(PhaseRun {
                    strength: Some(word),
                    model: Some(row.model.clone()),
                    effort: row.effort.clone(),
                });
            }
        }
        Some(PhaseRun {
            strength: None,
            model: self.launch_model.clone(),
            effort: self.launch_effort.clone(),
        })
    }

    /// Step phase `index` one strength up for its retry: Thrifty to Balanced,
    /// Balanced to Best, Best stays; a partly mapped agent goes to the next
    /// word it maps, or stays. A Match my session phase stays.
    pub fn step_strength_up(&mut self, index: usize) {
        let Some(phase) = self.phases.get_mut(index) else {
            return;
        };
        let Some(word) = phase.strength else { return };
        if let Some(next) = models::next_strength(&self.strength_rows, word.word())
            .and_then(|w| Strength::from_word(&w))
        {
            phase.strength = Some(next);
        }
    }
}

/// What the strip in the app's top bar shows (`loop-state` event).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopStateEvent {
    pub running: bool,
    pub spec_name: String,
    /// The current phase's number in the spec, and the run's last phase number.
    pub phase: u32,
    pub phases: u32,
    pub phase_name: String,
    /// The phase this run built just before the current one, while the next starts.
    pub previous_phase: Option<u32>,
    pub previous_committed: bool,
    /// The current phase has used its retry.
    pub phase_retried: bool,
    pub step: String,
    pub started_at_ms: u64,
    pub retries_used: u32,
    pub stop_after_phase: bool,
    /// Stop now was pressed: the agent is ending and nothing more is committed.
    pub stopping: bool,
    /// Stop after this phase can be turned on (false on the run's last phase).
    pub can_stop_after: bool,
    /// The running phase's strength word, when it has one (not Match my session).
    pub strength: Option<String>,
    /// The model and effort the phase runs on, when known.
    pub model: Option<String>,
    pub effort: Option<String>,
}

impl LoopStateEvent {
    /// The last event of a loop: the strip goes away.
    pub fn ended() -> LoopStateEvent {
        LoopStateEvent {
            running: false,
            spec_name: String::new(),
            phase: 0,
            phases: 0,
            phase_name: String::new(),
            previous_phase: None,
            previous_committed: false,
            phase_retried: false,
            step: String::new(),
            started_at_ms: 0,
            retries_used: 0,
            stop_after_phase: false,
            stopping: false,
            can_stop_after: false,
            strength: None,
            model: None,
            effort: None,
        }
    }
}

pub fn state_event(rec: &RunningRecord) -> LoopStateEvent {
    let current = rec.phases.get(rec.current);
    let previous = rec
        .current
        .checked_sub(1)
        .and_then(|at| rec.phases.get(at))
        .filter(|p| p.status == PhaseStatus::Done);
    let run = rec.phase_run(rec.current);
    LoopStateEvent {
        running: true,
        spec_name: rec
            .spec
            .strip_prefix("specs/")
            .unwrap_or(&rec.spec)
            .to_string(),
        phase: rec.phases.get(rec.current).map_or(0, |p| p.n),
        phases: rec.phases.last().map_or(0, |p| p.n),
        phase_name: current.map_or_else(String::new, |p| p.name.clone()),
        previous_phase: previous.map(|p| p.n),
        previous_committed: previous.is_some_and(|p| p.commit.is_some()),
        phase_retried: current.is_some_and(|p| p.retries > 0),
        step: rec.step.label().to_string(),
        started_at_ms: rec.started_at_ms,
        retries_used: rec.retries_used,
        stop_after_phase: rec.stop_after_phase,
        stopping: rec.stop_now,
        can_stop_after: rec.current + 1 < rec.phases.len(),
        strength: run
            .as_ref()
            .and_then(|r| r.strength)
            .map(|w| w.word().to_string()),
        model: run.as_ref().and_then(|r| r.model.clone()),
        effort: run.as_ref().and_then(|r| r.effort.clone()),
    }
}

/// The running loop's strip state, or `None` when no loop runs.
pub fn current_event(slot: &LoopSlot) -> Option<LoopStateEvent> {
    lock(slot).as_ref().map(state_event)
}

/// What Resume, Fix it by hand and Finalize need after the running record is
/// gone. Memory only (NFR-5).
#[derive(Clone)]
pub struct LastLoop {
    pub project: PathBuf,
    pub spec: String,
    pub launch: Launch,
    /// The quick check the person last confirmed in the Start dialog.
    pub confirmed_check: String,
    /// The notification the person last confirmed there.
    pub confirmed_notify: String,
}

pub type LoopSlot = Arc<Mutex<Option<RunningRecord>>>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Verdict {
    /// The phase holds. `warnings` are things to show on the report that do
    /// not stop the loop (leftover Suggestions).
    Approve {
        warnings: Vec<String>,
    },
    Refuse(String),
}

/// A poisoned mutex is still taken: the watcher catches its own panics (see
/// `watch_with`), and a panic inside a lock poisons it, so the stop that
/// follows must still be able to clear the slot.
fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

// ---------------------------------------------------------- pure judgment

/// The first prompt of a phase's fresh agent. `phase` names the phase to build,
/// so the agent never picks one by its own rules and reports another.
pub fn phase_prompt(spec: &str, phase: u32, setup: &LoopSetup) -> String {
    let skill = if setup.review {
        "plan2code-3-implement-review"
    } else {
        "plan2code-3-implement"
    };
    let mut prompt = format!("/{skill} {spec}/overview.md --web --loop --phase {phase}");
    if setup.review {
        if setup.fix_mode == FixMode::Smart {
            prompt.push_str(" --fix smart");
        } else if !setup.fix.is_empty() {
            let levels: Vec<&str> = [FixLevel::Critical, FixLevel::Warning, FixLevel::Suggestion]
                .into_iter()
                .filter(|level| setup.fix.contains(level))
                .map(FixLevel::word)
                .collect();
            prompt.push_str(&format!(" --fix {}", levels.join(",")));
        }
    }
    if setup.on_question == OnQuestion::Guess {
        prompt.push_str(" --guess");
    }
    prompt
}

fn count(tasks: &Value, key: &str) -> u64 {
    counted(tasks, key).unwrap_or(0)
}

/// A task count the spec's status gave, or `None` when the key is missing, so a
/// missing count is never read as zero.
fn counted(tasks: &Value, key: &str) -> Option<u64> {
    tasks.get(key).and_then(Value::as_u64)
}

/// How many findings of `level` the phase left: the report's counter or the
/// length of its unfixed list, whichever is larger. An agent can miscount, so
/// neither is trusted alone.
fn leftover(review: &ReviewPart, level: FixLevel) -> u32 {
    let counter = match level {
        FixLevel::Critical => review.left.critical,
        FixLevel::Warning => review.left.warning,
        FixLevel::Suggestion => review.left.suggestion,
    };
    let listed = review.unfixed.iter().filter(|f| f.level == level).count();
    counter.max(u32::try_from(listed).unwrap_or(u32::MAX))
}

/// Why a phase says it failed, for the stop line and the notification: what the
/// agent wrote, which a person can read, else the contract's reason in words.
fn failed_words(outcome: &Outcome) -> String {
    let summary = outcome.summary.trim();
    if !summary.is_empty() {
        return summary.to_string();
    }
    match outcome.reason.as_deref() {
        Some("tests") => "its tests failed",
        Some("findings") => "the review left findings it had to fix",
        Some("blocked") => "a task is blocked",
        Some("conflict") => "the spec conflicts with the code",
        _ => "it reported a failure",
    }
    .to_string()
}

/// The report's note about Suggestions the phase left unfixed, if any. They
/// never refuse a phase, but the person should see them.
fn suggestion_warning(review: &ReviewPart) -> Option<String> {
    let n = leftover(review, FixLevel::Suggestion);
    (n > 0).then(|| {
        format!(
            "{n} Suggestion{} left unfixed",
            if n == 1 { "" } else { "s" }
        )
    })
}

/// The `loopExpect` patch: the setup's judging criteria, stamped into the
/// phase's session so the console refuses a report that misses one at post
/// time, while the agent can still fix it. `fix` is "smart" or the level
/// list; an empty list means findings are reported, not fixed.
fn expect_patch(setup: &LoopSetup) -> Value {
    json!({
        "loopExpect": {
            "review": setup.review,
            "fix": match setup.fix_mode {
                FixMode::Smart => json!("smart"),
                FixMode::Levels => json!(setup.fix.iter().map(|l| l.word()).collect::<Vec<_>>()),
            },
            "guess": setup.on_question == OnQuestion::Guess,
        }
    })
}

/// Whether to take the skill's report at its word, cross-checked against the
/// spec's own marks (`phase_status` is the phase's entry from `specs.mjs
/// status`). The quick check runs after an Approve, not here.
/// Whether every failing test the report names is also listed as expected.
fn excused_failures(tests: &TestsPart) -> bool {
    !tests.failing.is_empty()
        && tests
            .failing
            .iter()
            .all(|name| tests.expected_failures.contains(name))
}

pub fn judge_outcome(outcome: &Outcome, phase_status: &Value, setup: &LoopSetup) -> Verdict {
    let refuse = |why: String| Verdict::Refuse(why);
    if outcome.result == "failed" {
        return refuse(failed_words(outcome));
    }
    if outcome.result != "passed" {
        return refuse(format!("the report said \"{}\"", outcome.result));
    }
    // Missing data is never success: a phase the spec does not show, or shows
    // without counts, cannot be taken at the report's word.
    let n = outcome.phase;
    if phase_status.is_null() {
        return refuse(format!("the spec has no status for Phase {n}"));
    }
    let tasks = &phase_status["tasks"];
    if !tasks.is_object() {
        return refuse(format!("the spec shows no task counts for Phase {n}"));
    }
    let Some(total) = counted(tasks, "total") else {
        return refuse(format!("the spec shows no task total for Phase {n}"));
    };
    if total == 0 {
        return refuse(format!("the spec shows no tasks in Phase {n}"));
    }
    // A failed test run is a refusal even when every task is ticked. Blocked
    // tasks and listed conflicts are not: the checks below cover blocked tasks
    // through the spec's own marks, and a conflict the agent worked around is
    // reported to the person, not refused (FR-7).
    // A failure is excused only when every failing test is named and also
    // listed as expected: a bare "expected" never passes, so a real failure
    // cannot be waved through.
    let mut warnings = Vec::new();
    if let Some(tests) = &outcome.tests {
        if tests.ran && !tests.passed {
            if excused_failures(tests) {
                warnings.push(format!(
                    "{} test(s) failed as the phase's Notes expect: {}",
                    tests.failing.len(),
                    tests.failing.join(", ")
                ));
            } else {
                let summary = one_line(&tests.summary);
                return refuse(if summary.is_empty() {
                    "its tests ran and failed".to_string()
                } else {
                    format!("its tests ran and failed: {summary}")
                });
            }
        }
    }
    let blocked = count(tasks, "blocked");
    // `open` already holds pending, in-progress, blocked and unknown tasks.
    let open = count(tasks, "open");
    if blocked > 0 || open > 0 {
        return refuse(format!(
            "the spec disagrees: {blocked} blocked, {open} still open"
        ));
    }
    let assumed = count(tasks, "assumed");
    if assumed > 0 && setup.on_question != OnQuestion::Guess {
        return refuse("assumed tasks without best guess".to_string());
    }
    let done = count(tasks, "complete") + assumed;
    if done != total {
        return refuse(format!("the spec shows {done} of {total} tasks done"));
    }
    if setup.review {
        let review = outcome.review.clone().unwrap_or_default();
        if !review.ran {
            return refuse("review did not run".to_string());
        }
        if setup.fix_mode == FixMode::Smart {
            match &review.triage {
                Some(triage) if triage.ran => {
                    let critical = triage
                        .skipped
                        .iter()
                        .filter(|f| f.level == FixLevel::Critical)
                        .count();
                    if critical > 0 {
                        return refuse(format!("{critical} Critical skipped by the triage"));
                    }
                }
                _ => return refuse("the triage did not run".to_string()),
            }
        }
        let chosen = setup.chosen_levels();
        if !chosen.is_empty() && !review.recheck {
            return refuse("the re-check did not run".to_string());
        }
        let mut left = Vec::new();
        let critical = leftover(&review, FixLevel::Critical);
        if chosen.contains(&FixLevel::Critical) && critical > 0 {
            left.push(format!("{critical} Critical"));
        }
        let warning = leftover(&review, FixLevel::Warning);
        if chosen.contains(&FixLevel::Warning) && warning > 0 {
            left.push(format!("{warning} Warning"));
        }
        if !left.is_empty() {
            return refuse(format!("{} left after the re-check", left.join(" / ")));
        }
        warnings.extend(suggestion_warning(&review));
    }
    Verdict::Approve { warnings }
}

/// Whether the agent has been quiet too long. A waiting question never counts
/// (the person may take all night). The limit is the setup's silence minutes
/// or the skill's own `quietMinutes`, whichever is longer, at most 60.
pub fn silence_expired(
    now: SystemTime,
    last_activity: SystemTime,
    setup: &LoopSetup,
    quiet_minutes: Option<u32>,
    waiting: bool,
) -> bool {
    if waiting {
        return false;
    }
    let minutes = setup
        .silence_minutes
        .max(quiet_minutes.unwrap_or(0))
        .min(60);
    let limit = Duration::from_secs(u64::from(minutes) * 60);
    now.duration_since(last_activity)
        .is_ok_and(|quiet| quiet > limit)
}

/// Why a loop ended.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StopCause {
    Crash,
    Silence,
    Refused(String),
    QuickCheck,
    Commit,
    /// The commit failed and the mark could not be taken back: the phase file
    /// (named here) says done while its work is not committed.
    MarkedNotCommitted(String),
    /// The staged files hold something that looks like a secret or is over 5 MB
    /// (every offending path). Nothing was marked or committed.
    UnsafeFiles(Vec<String>),
    Question,
    StoppedByPerson,
    NoSession,
    /// The watcher thread panicked (the panic's text, on one line). Never
    /// retried: the loop's own code failed, not the agent.
    WatcherFailed(String),
}

/// One fresh retry for a crash, silence or an announce notice that never came
/// (a crash), when the setup allows it and the phase has not used it yet. A
/// failed watcher is never retried.
pub fn should_retry(cause: &StopCause, setup: &LoopSetup, retries_used_this_phase: u32) -> bool {
    matches!(
        cause,
        StopCause::Crash | StopCause::Silence | StopCause::NoSession
    ) && setup.retry_once
        && retries_used_this_phase == 0
}

/// Whether the session state holds a question for the person: an item still
/// open or reopened, required, not handled by the loop and not just a notice.
pub fn open_question(state: &Value) -> bool {
    first_open_question(state).is_some()
}

/// The first question `open_question` would count, as its title (the
/// question's body when it has no title), or `None`.
pub fn first_open_question(state: &Value) -> Option<String> {
    state["items"].as_array()?.iter().find_map(|item| {
        let open = matches!(item["status"].as_str(), Some("open" | "reopened"))
            && item["required"].as_bool() != Some(false)
            && item["kind"].as_str() != Some("notice")
            && item.get("handledBy").is_none_or(Value::is_null);
        if !open {
            return None;
        }
        let title = item["title"].as_str().map(str::trim).unwrap_or_default();
        let text = if title.is_empty() {
            item["body"].as_str().map(str::trim).unwrap_or_default()
        } else {
            title
        };
        Some(one_line(text))
    })
}

/// Whether an announced page can be the running phase's session: the agent
/// has locked it with `open --loop` (`loop.driving`) and it holds no report
/// yet. A page without the lock is a plain `open` (or not a loop page at all),
/// and a report already there belongs to an older run.
pub fn page_is_this_phase(state: &Value) -> bool {
    state["loop"]["driving"].as_bool().unwrap_or(false)
        && state.get("loopOutcome").is_none_or(Value::is_null)
}

/// The line the stop screen leads with. `detail` is the exit reason for a
/// crash, the minutes for silence and the whole clause for a refused commit.
pub fn stop_line(cause: &StopCause, phase: u32, detail: &str, retried: bool) -> String {
    let after = if retried { " after one retry" } else { "" };
    match cause {
        StopCause::Crash => format!("Phase {phase} stopped: the agent crashed ({detail}){after}"),
        StopCause::Silence => {
            format!("Phase {phase} stopped: the agent went silent for {detail} minutes{after}")
        }
        StopCause::NoSession => {
            format!("Phase {phase} stopped: the agent never opened the console{after}")
        }
        StopCause::Refused(why) => format!("Phase {phase} stopped: {why}"),
        StopCause::QuickCheck => format!("Phase {phase} stopped: the quick check failed"),
        StopCause::Commit => {
            let why: String = one_line(detail).chars().take(100).collect();
            let why = if why.is_empty() {
                "git gave no reason".to_string()
            } else {
                why
            };
            format!(
                "Phase {phase} was not committed: {why}. The work is uncommitted; Resume tries the commit again"
            )
        }
        StopCause::MarkedNotCommitted(file) => {
            format!("Phase {phase} is marked done in {file} but its work is not committed")
        }
        StopCause::UnsafeFiles(files) => {
            let shown: Vec<&str> = files.iter().take(5).map(String::as_str).collect();
            let more = match files.len().saturating_sub(5) {
                0 => String::new(),
                m => format!(" and {m} more"),
            };
            format!(
                "Phase {phase} was not committed: {}{more} look like secrets or are over 5 MB. Nothing was marked or committed",
                shown.join(", ")
            )
        }
        StopCause::Question if detail.is_empty() => {
            format!("Phase {phase} stopped: it asked a question")
        }
        StopCause::Question => {
            let asked: String = one_line(detail).chars().take(100).collect();
            format!("Phase {phase} stopped: it asked a question, \"{asked}\"")
        }
        StopCause::StoppedByPerson => {
            format!("Stopped during Phase {phase}. This phase's changes stay uncommitted.")
        }
        StopCause::WatcherFailed(text) => {
            let text: String = one_line(text).chars().take(100).collect();
            format!(
                "The loop's watcher failed: {text}. Nothing more was committed; Resume starts again"
            )
        }
    }
}

// ---------------------------------------------------------- the setup file

/// The key `loop-setup.json` keeps a project under: the console's `foldKey`
/// (resolved path, lowercased on Windows and macOS).
pub fn fold_key(project: &Path) -> String {
    let mut text = project.to_string_lossy().into_owned();
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        text = rest.to_string();
    }
    if cfg!(windows) {
        text = text.replace('/', "\\");
    }
    let sep: &[char] = if cfg!(windows) { &['\\'] } else { &['/'] };
    let trimmed = text.trim_end_matches(sep);
    // A bare root ("C:\" or "/") keeps its separator.
    let mut text = if trimmed.is_empty() || trimmed.ends_with(':') {
        text
    } else {
        trimmed.to_string()
    };
    if cfg!(windows) || cfg!(target_os = "macos") {
        text = text.to_lowercase();
    }
    text
}

/// This project's saved setup. The app never takes setup values from a page
/// message: the quick check reaches it only from this file.
pub fn read_setup(project: &Path) -> Result<LoopSetup, String> {
    let home = session_reader::console_home().ok_or("no home folder found")?;
    read_setup_from(&home.join("loop-setup.json"), project)
}

fn read_setup_from(file: &Path, project: &Path) -> Result<LoopSetup, String> {
    const NONE: &str = "No loop setup saved for this project";
    let text = std::fs::read_to_string(file).map_err(|_| NONE.to_string())?;
    let store: Value = serde_json::from_str(&text).map_err(|_| NONE.to_string())?;
    if store["schema"].as_u64() != Some(1) {
        return Err(NONE.to_string());
    }
    let entry = store["projects"]
        .get(fold_key(project))
        .ok_or_else(|| NONE.to_string())?;
    serde_json::from_value(entry.clone())
        .map_err(|e| format!("The saved loop setup could not be read: {e}"))
}

// ------------------------------------------------------------ the facts

/// What the setup screen shows about the agent a loop would use.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopFacts {
    pub agent: Option<String>,
    pub agent_label: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub permission_mode: Option<String>,
    pub prompt_support: bool,
    pub running: bool,
}

/// Whether the agent's launch can carry a first prompt. Built-in agents take
/// one, and a custom agent's template gets it appended when no argument holds
/// `{prompt}` (`build_custom_args`); a future kind can answer false.
pub fn prompt_support(agent: &Agent) -> bool {
    match agent {
        Agent::Builtin(_) | Agent::Custom(_) => true,
    }
}

// -------------------------------------------------------- starting a loop

/// `specs/<name>`: one folder directly under `specs/`, not a link.
pub fn validate_spec(project: &Path, spec: &str) -> Result<(), String> {
    let bad = || format!("not a spec folder: {spec}");
    let name = spec.strip_prefix("specs/").ok_or_else(bad)?;
    if name.is_empty()
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(bad());
    }
    let meta = std::fs::symlink_metadata(project.join("specs").join(name)).map_err(|_| bad())?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return Err(bad());
    }
    Ok(())
}

/// Whether a phase row from `specs.mjs status` is done in its Phase Checklist:
/// the script's own `checklist` state, so `[X]` and `[?]` count as `[x]` does.
pub fn checklist_done(phase: &Value) -> bool {
    matches!(phase["checklist"].as_str(), Some("complete" | "assumed"))
}

static NEXT_RUN: AtomicU64 = AtomicU64::new(1);

/// Everything Start checks before the confirm: the spec, the saved setup, the
/// phases left to build and the gates (FR-5). Starts nothing.
pub fn prepare(
    project: &Path,
    spec: &str,
    mode: PermissionMode,
    prompt_ok: bool,
    resuming: bool,
) -> Result<RunningRecord, String> {
    validate_spec(project, spec)?;
    let setup = read_setup(project)?;
    let report = session_reader::console_home()
        .and_then(|home| loop_report::load(&home, project, spec))
        .unwrap_or_default();
    prepare_with(project, spec, setup, &report, mode, prompt_ok, resuming)
}

/// `prepare` with the saved setup and report given. Reads only: a phase marked
/// done with no commit behind it stays in the list (`rebuilt`) and is opened
/// again by `reopen_rebuilt`, after the person has confirmed.
pub fn prepare_with(
    project: &Path,
    spec: &str,
    setup: LoopSetup,
    report: &LoopReport,
    mode: PermissionMode,
    prompt_ok: bool,
    resuming: bool,
) -> Result<RunningRecord, String> {
    if !setup.notify_url.is_empty()
        && !loop_notify::valid_setup(setup.notify_kind, &setup.notify_url, &setup.notify_param)
    {
        return Err("The saved notification address is not valid".to_string());
    }
    let status = loop_tools::specs_status(project, spec)?;
    // With commit on, a "done" mark must have a commit behind it.
    let rebuilt = loop_commit::unbacked_marks(project, spec, &status, report, setup.commit);
    let phases: Vec<PhaseRecord> = status["phases"]
        .as_array()
        .map(|all| {
            all.iter()
                .filter_map(|p| {
                    let n = u32::try_from(p["number"].as_u64()?).ok()?;
                    // Done is what `specs.mjs` calls done: `[x]`, `[X]` and `[?]`.
                    // A blocked `[!]` phase stays in, so the loop stops on it
                    // with its reason rather than building past it.
                    if checklist_done(p) && !rebuilt.contains(&n) {
                        return None;
                    }
                    Some(PhaseRecord {
                        n,
                        name: p["name"].as_str().unwrap_or("").to_string(),
                        status: PhaseStatus::Pending,
                        commit: None,
                        subject: None,
                        retries: 0,
                        strength: phase_pick(&setup, spec, n, p["name"].as_str().unwrap_or("")),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    if phases.is_empty() {
        return Err("Nothing left to build".to_string());
    }
    // A detached HEAD would leave every phase's commit on no branch at all.
    // Outside a repository a loop with commit off may still run.
    let branch = match loop_tools::git_branch(project) {
        Ok(None) => {
            return Err("HEAD is detached. Switch to a branch before starting the loop".to_string())
        }
        Ok(branch) => branch,
        Err(e) if setup.commit => return Err(e),
        Err(_) => None,
    };
    let own_dirty = loop_tools::git_status_porcelain(project).unwrap_or_default();
    let mut resumed_files = None;
    if setup.commit {
        let dirty = loop_tools::git_status_porcelain(project)?;
        if !dirty.is_empty() {
            // A Resume after this app stopped the spec carries the stopped
            // phase's uncommitted work by design; a fresh Start needs a clean tree.
            if !resuming {
                return Err(format!(
                    "Commit each phase needs a clean tree: {} uncommitted changes",
                    dirty.len()
                ));
            }
            resumed_files = Some(dirty.len());
        }
    }
    if mode == PermissionMode::Checked {
        return Err(
            "The loop needs permission checks off. Start a New Session with checks off first."
                .to_string(),
        );
    }
    if !prompt_ok {
        return Err(
            "This agent cannot be started with a prompt, so it cannot run the loop.".to_string(),
        );
    }
    let mut rec = RunningRecord::new(project.to_path_buf(), spec.to_string(), setup, phases);
    rec.rebuilt = rebuilt;
    rec.resumed_files = resumed_files;
    rec.branch = branch;
    rec.start_head = loop_tools::git_head_full(project);
    // On a resumed run this holds the stopped phase's work too, by design: it
    // is listed as the person's own, the known limit of a baseline.
    rec.own_dirty = own_dirty;
    Ok(rec)
}

/// The strength the person picked for phase `n` called `name` of `spec`, only
/// with the toggle on. A renamed phase drops its pick.
fn phase_pick(setup: &LoopSetup, spec: &str, n: u32, name: &str) -> Option<Strength> {
    if !setup.phase_strength {
        return None;
    }
    setup
        .strengths
        .get(spec)?
        .iter()
        .find(|p| p.n == n && p.name == name)
        .map(|p| p.strength)
}

/// What each strength word maps to for `agent`, from the shipped and user
/// model files: read once, when the loop begins.
fn strength_rows_for(agent: &Agent) -> BTreeMap<String, StrengthRow> {
    let models: Vec<String> = match agent {
        Agent::Builtin(entry) => models::models_for_builtin(&entry.id),
        Agent::Custom(custom) => custom.models.clone(),
    }
    .into_iter()
    .map(|m| m.id)
    .collect();
    models::strengths_for(agent.id(), &models, agent.has_effort())
}

/// Open again the phases `prepare` found marked done with no commit behind
/// them. Writes to the spec, so Start calls it only after the confirm.
pub fn reopen_rebuilt(rec: &RunningRecord) -> Result<(), String> {
    loop_commit::reopen(&rec.project, &rec.spec, &rec.rebuilt)
}

/// Whether `branch` is the repository's trunk, where a loop's commits land
/// straight on the shared line.
pub fn is_trunk(branch: &str) -> bool {
    matches!(branch, "main" | "master")
}

/// The stop screen's list: the agent's uncommitted files, at most 200.
fn uncommitted_files(project: &Path, own_dirty: &[String]) -> Vec<String> {
    let now = loop_tools::git_status_porcelain(project).unwrap_or_default();
    let mut files = agent_work(now, own_dirty);
    files.truncate(200);
    files
}

/// Whether this loop will commit straight to `main` or `master`. A Resume never
/// skips its confirm then.
pub fn commits_to_trunk(rec: &RunningRecord) -> bool {
    rec.setup.commit && rec.branch.as_deref().is_some_and(is_trunk)
}

/// The files the agent changed: what `git status` lists now, less the files
/// that were already changed when the loop started. A file both the person and
/// the agent changed is hidden from the list, a known limit.
pub fn agent_work(now: Vec<String>, own: &[String]) -> Vec<String> {
    let before: std::collections::HashSet<&str> = own.iter().map(String::as_str).collect();
    now.into_iter()
        .filter(|file| !before.contains(file.as_str()))
        .collect()
}

/// The app's own Start confirm.
pub fn confirm_text(rec: &RunningRecord) -> String {
    let name = rec.spec.strip_prefix("specs/").unwrap_or(&rec.spec);
    let n = rec.phases.len();
    let phases = if n == 1 {
        "1 phase".to_string()
    } else {
        format!("{n} phases")
    };
    let check = rec.setup.quick_check.trim();
    let mut text = if check.is_empty() {
        format!("Build {phases} of {name}? No quick check is set.")
    } else {
        format!("Build {phases} of {name}? After each phase the app runs: {check}")
    };
    if !rec.rebuilt.is_empty() {
        let list: Vec<String> = rec.rebuilt.iter().map(|n| format!("Phase {n}")).collect();
        text.push_str(&format!(
            " {} is marked done but has no commit in the log, so it is built again.",
            list.join(" and ")
        ));
    }
    if let Some(files) = rec.resumed_files {
        let files = if files == 1 {
            "1 uncommitted file".to_string()
        } else {
            format!("{files} uncommitted files")
        };
        text.push_str(&format!(
            " The resumed phase's commit will take {files} already in the tree."
        ));
    }
    if commits_to_trunk(rec) {
        let branch = rec.branch.as_deref().unwrap_or_default();
        text.push_str(&format!(
            " You are on `{branch}`: every phase will commit straight to it. Start only if that is what you want."
        ));
    }
    if !rec.setup.notify_url.is_empty() {
        let when = if rec.setup.notify_phases {
            "after each phase, when the loop needs you, or when it ends"
        } else {
            "When the loop needs you or ends"
        };
        text.push_str(&format!(
            " {}, {}.",
            capitalized(when),
            loop_notify::describe(
                rec.setup.notify_kind,
                &rec.setup.notify_url,
                &rec.setup.notify_param
            )
        ));
    }
    text
}

fn capitalized(text: &str) -> String {
    let mut chars = text.chars();
    chars
        .next()
        .map(|c| c.to_uppercase().collect::<String>() + chars.as_str())
        .unwrap_or_default()
}

/// What the Start confirm promised about the notification, to tell a change on
/// Resume; empty when no address is set.
pub fn confirmed_notify(setup: &LoopSetup) -> String {
    if setup.notify_url.is_empty() {
        String::new()
    } else {
        format!(
            "{:?} {} {} {}",
            setup.notify_kind, setup.notify_url, setup.notify_param, setup.notify_phases
        )
    }
}

/// The app's own confirm for Send a test: the saved setup's notification, or why
/// there is nothing to test.
pub fn notify_test_confirm(setup: &LoopSetup) -> Result<String, String> {
    if setup.notify_url.is_empty() {
        return Err("Fill in the address first".to_string());
    }
    if !loop_notify::valid_setup(setup.notify_kind, &setup.notify_url, &setup.notify_param) {
        return Err("The saved notification address is not valid".to_string());
    }
    Ok(format!(
        "Send a test notification? To do that, {}.",
        loop_notify::describe(setup.notify_kind, &setup.notify_url, &setup.notify_param)
    ))
}

/// Send a test: the saved notification with a message that says what it is. Must
/// not run on an async runtime's own thread (the HTTP client blocks).
pub fn send_notify_test(setup: &LoopSetup) -> Result<(), String> {
    const MESSAGE: &str =
        "Plan2Code test: the Implementation Loop's notifications will arrive here.";
    match notify(setup, MESSAGE) {
        Some(reason) => Err(format!("The test was not sent: {reason}")),
        None => Ok(()),
    }
}

/// Where the loop is, copied out of the record so a message can be written, and
/// sent, with no lock held.
#[derive(Clone, Debug)]
pub struct Where {
    pub project: String,
    pub spec: String,
    pub n: u32,
    /// The spec's last phase number (phases already done are not in the record).
    pub of: usize,
    pub name: String,
    pub phase_time: Duration,
    pub run_time: Duration,
}

impl Where {
    pub fn of(rec: &RunningRecord, index: usize) -> Where {
        let phase = &rec.phases[index];
        Where {
            project: rec
                .project
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            spec: rec
                .spec
                .strip_prefix("specs/")
                .unwrap_or(&rec.spec)
                .to_string(),
            n: phase.n,
            of: rec.phases.last().map_or(0, |p| p.n as usize),
            name: phase.name.clone(),
            phase_time: rec.phase_started_at.elapsed(),
            run_time: rec.started_at.elapsed(),
        }
    }

    /// "plan2code / lunch", or just the spec when the folder has no name.
    fn label(&self) -> String {
        if self.project.is_empty() {
            self.spec.clone()
        } else {
            format!("{} / {}", self.project, self.spec)
        }
    }

    /// "Phase 2 of 4 (Setup screen)".
    fn phase_text(&self) -> String {
        let mut text = format!("Phase {} of {}", self.n, self.of);
        if !self.name.is_empty() {
            text.push_str(&format!(" ({})", self.name));
        }
        text
    }

    /// "Elapsed: phase 6m, run 14m."
    fn elapsed(&self) -> String {
        format!(
            "Elapsed: phase {}, run {}.",
            minutes(self.phase_time),
            minutes(self.run_time)
        )
    }
}

/// "under 1m", "6m", "1h 5m".
fn minutes(time: Duration) -> String {
    let total = time.as_secs() / 60;
    match total {
        0 => "under 1m".to_string(),
        1..=59 => format!("{total}m"),
        _ => format!("{}h {}m", total / 60, total % 60),
    }
}

/// The message for a question holding the loop, or ending it (On question: Stop).
pub fn question_message(at: &Where, ended: bool) -> String {
    let (verb, tail) = if ended {
        ("stopped on", "has a question for you to answer")
    } else {
        ("is waiting on", "has a question for you to answer")
    };
    format!(
        "Plan2Code loop {verb} {}: {} {tail}. {}",
        at.label(),
        at.phase_text(),
        at.elapsed()
    )
}

/// The message for a loop that built everything.
pub fn finished_message(at: &Where, phases: usize) -> String {
    let built = if phases == 1 {
        "1 phase".to_string()
    } else {
        format!("all {phases} phases")
    };
    format!(
        "Plan2Code loop complete on {}: {built} built. Elapsed: {}.",
        at.label(),
        minutes(at.run_time)
    )
}

/// The message for a stop, or none when the person stopped it themselves.
pub fn stop_message(cause: &StopCause, at: &Where, line: &str) -> Option<String> {
    match cause {
        StopCause::StoppedByPerson => None,
        StopCause::Question => Some(question_message(at, true)),
        _ => Some(format!(
            "Plan2Code loop stopped on {} at {}: {line} {}",
            at.label(),
            at.phase_text(),
            at.elapsed()
        )),
    }
}

/// What a phase that passed did, for its message.
pub struct PhaseDone {
    /// How many tasks the phase had, all of them done (the approval checked).
    pub tasks: Option<u64>,
    pub subject: String,
    /// The commit's short id, when one was made.
    pub commit: Option<String>,
    /// The next phase's number and name, or none after the last.
    pub next: Option<(u32, String)>,
}

/// The message for a phase that passed (Also tell me when each phase is complete).
pub fn phase_message(at: &Where, done: &PhaseDone) -> String {
    let mut text = format!(
        "Plan2Code loop on {}: {} is complete.",
        at.label(),
        at.phase_text()
    );
    let mut did = Vec::new();
    if let Some(tasks) = done.tasks {
        did.push(format!(
            "{tasks} {}",
            if tasks == 1 { "task" } else { "tasks" }
        ));
    }
    match (done.subject.trim(), done.commit.as_deref()) {
        ("", Some(commit)) => did.push(format!("committed {commit}")),
        ("", None) => {}
        (subject, Some(commit)) => did.push(format!("committed \"{subject}\" ({commit})")),
        (subject, None) => did.push(format!("\"{subject}\", not committed")),
    }
    if !did.is_empty() {
        text.push_str(&format!(" Done: {}.", did.join(", ")));
    }
    match &done.next {
        Some((n, name)) if name.is_empty() => text.push_str(&format!(" Next: Phase {n}.")),
        Some((n, name)) => text.push_str(&format!(" Next: Phase {n}, {name}.")),
        None => text.push_str(" That was the last phase."),
    }
    text.push(' ');
    text.push_str(&at.elapsed());
    text
}

/// Send the setup's notification, when it has one; the reason it failed, if it did.
fn notify(setup: &LoopSetup, message: &str) -> Option<String> {
    if setup.notify_url.is_empty() {
        return None;
    }
    loop_notify::send(
        setup.notify_kind,
        &setup.notify_url,
        &setup.notify_param,
        message,
    )
    .err()
}

/// The clause the end of a loop says about a failed call.
fn notify_failed(reason: &str) -> String {
    format!("the notification could not be sent ({reason})")
}

/// An agent's launch choice: agent, model, effort and permission mode.
pub type Launch = (Agent, Option<String>, Option<String>, PermissionMode);

/// What the app does as the loop moves. Both run on the watch thread (or the
/// command that asked) and must not call back into the driver.
pub struct Hooks {
    /// Told on every change of phase, step, retries or running (the strip).
    pub emit: Box<dyn Fn(LoopStateEvent) + Send + Sync>,
    /// A question now holds the loop: set the app's own taskbar attention, so
    /// the dot and flash do not depend on the locked page sending one.
    pub attention: Box<dyn Fn() + Send + Sync>,
}

/// What the watch thread needs, shared by every step of one loop.
#[derive(Clone)]
struct Ctx {
    slot: LoopSlot,
    agent: Arc<AgentManager>,
    console_dir: PathBuf,
    home: PathBuf,
    launch: Launch,
    run_id: u64,
    hooks: Arc<Hooks>,
    limits: Limits,
}

/// A notice that waits for the new agent's console: how long before the phase
/// counts as crashed.
const NOTICE_WAIT: Duration = Duration::from_secs(180);
const WATCH_EVERY: Duration = Duration::from_secs(2);
/// How often silence looks at the session's files and the tree.
const ACTIVITY_EVERY: Duration = Duration::from_secs(30);
/// How long a phase's commit may run: a slow pre-commit hook is allowed this
/// much, where the quick calls keep their one minute.
const COMMIT_LIMIT: Duration = Duration::from_secs(10 * 60);

/// The watcher's timing, settable so a test can run a loop in milliseconds.
/// The default is the three constants above.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Limits {
    /// How often the watcher looks at the running phase.
    pub watch_every: Duration,
    /// How long a new phase may wait for its agent's console.
    pub notice_wait: Duration,
    /// How often silence looks at the session's files and the tree.
    pub activity_every: Duration,
    /// How long a phase's commit may run, hooks included.
    pub commit_limit: Duration,
}

impl Default for Limits {
    fn default() -> Self {
        Limits {
            watch_every: WATCH_EVERY,
            notice_wait: NOTICE_WAIT,
            activity_every: ACTIVITY_EVERY,
            commit_limit: COMMIT_LIMIT,
        }
    }
}

/// Store the record and start its first phase; a watch thread follows it.
pub fn begin(
    slot: &LoopSlot,
    agent: Arc<AgentManager>,
    rec: RunningRecord,
    launch: Launch,
    hooks: Hooks,
) -> Result<(), String> {
    begin_with_limits(slot, agent, rec, launch, hooks, Limits::default())
}

/// `begin` with the watcher's timing given; a test starts a real loop with
/// millisecond limits through it.
pub fn begin_with_limits(
    slot: &LoopSlot,
    agent: Arc<AgentManager>,
    rec: RunningRecord,
    launch: Launch,
    hooks: Hooks,
    limits: Limits,
) -> Result<(), String> {
    let console_dir = find_console_dir()?;
    let home = session_reader::console_home().ok_or("no home folder found")?;
    // A build that stopped earlier carries on in the same report.
    let mut rec = rec;
    if rec.setup.phase_strength {
        rec.strength_rows = strength_rows_for(&launch.0);
    }
    rec.launch_model.clone_from(&launch.1);
    rec.launch_effort.clone_from(&launch.2);
    if let Some(report) = loop_report::load(&home, &rec.project, &rec.spec) {
        rec.report = report;
    }
    let ctx = Ctx {
        slot: Arc::clone(slot),
        agent,
        console_dir,
        home,
        launch,
        run_id: rec.run_id,
        hooks: Arc::new(hooks),
        limits,
    };
    {
        let mut guard = lock(slot);
        if guard.is_some() {
            return Err("A loop is already running".to_string());
        }
        *guard = Some(rec);
    }
    if let Err(e) = start_phase(&ctx, 0) {
        *lock(slot) = None;
        // start_phase already told the strip "Starting": take it away again.
        (ctx.hooks.emit)(LoopStateEvent::ended());
        return Err(e);
    }
    thread::spawn(move || watch(ctx));
    Ok(())
}

/// A page the app took: while a loop waits for its phase's session, an
/// Implement or Implement + Review page whose `state` the agent has locked
/// with `open --loop`, and that holds no report yet, is that session
/// (`page_is_this_phase`). One without the lock is kept as a candidate the
/// watch adopts once the lock shows; one with a report is ignored.
pub fn note_page(slot: &LoopSlot, workflow: &str, sid: &str, state: &Value) {
    if !matches!(workflow, "implement" | "implement-review") {
        return;
    }
    if let Some(rec) = lock(slot).as_mut() {
        if rec.sid.is_some() {
            return;
        }
        if page_is_this_phase(state) {
            adopt_page(rec, sid);
        } else if state.is_object() && state.get("loopOutcome").is_none_or(Value::is_null) {
            // An unreadable page (no state) is no candidate: it must not replace a real one.
            rec.page_candidate = Some(sid.to_string());
        }
    }
}

/// Follow `sid` as the phase's session from here.
fn adopt_page(rec: &mut RunningRecord, sid: &str) {
    rec.sid = Some(sid.to_string());
    rec.last_sid = Some(sid.to_string());
    rec.last_activity = SystemTime::now();
    rec.page_candidate = None;
}

/// The candidate `note_page` held back, adopted once its state shows the
/// agent's lock; the session to follow, or `None` while there is none yet.
fn adopt_candidate(ctx: &Ctx, candidate: Option<&str>) -> Option<String> {
    let sid = candidate?;
    let session = session_reader::load(&ctx.home, sid).ok()?;
    if !page_is_this_phase(&session.state) {
        return None;
    }
    let mut guard = lock(&ctx.slot);
    let rec = guard.as_mut().filter(|r| r.run_id == ctx.run_id)?;
    if rec.sid.is_none() && rec.page_candidate.as_deref() == Some(sid) {
        adopt_page(rec, sid);
    }
    rec.sid.clone()
}

/// What `git status` lists as the phase begins, as its commit's baseline.
/// The first phase of a resumed run leaves out the stopped phase's files: that
/// work is this phase's to commit.
fn phase_baseline(project: &Path, carried: &[String]) -> Option<Vec<String>> {
    let now = loop_tools::git_status_porcelain(project).ok()?;
    Some(agent_work(now, carried))
}

/// Start a fresh agent on `prompt`: on the agent's stored launch choice when it
/// has one, else on `launch` (an agent the loop stopped has forgotten it). The
/// prompt is transient either way: a later New Session opens the dashboard, it
/// does not run the phase's (or Fix it's or Finalize's) prompt again.
pub fn start_with(agent: &AgentManager, launch: &Launch, prompt: String) -> Result<(), String> {
    if agent.launch_choice().is_some() {
        agent.start_fresh(prompt)
    } else {
        agent.forget_session();
        let (kind, model, effort, mode) = launch.clone();
        agent.start_transient(kind, model, effort, mode, prompt)
    }
}

/// Start a fresh agent on `prompt` for a phase that runs on `word`'s `row`: the
/// agent starts on that model and effort with `PLAN2CODE_LOOP_STRENGTH` set,
/// and the stored launch choice stays what it was (an agent the loop stopped
/// gets the launch choice stored, then the phase's own run on top).
pub fn start_phase_with(
    agent: &AgentManager,
    launch: &Launch,
    prompt: String,
    row: &StrengthRow,
    word: Strength,
) -> Result<(), String> {
    let env = vec![(STRENGTH_ENV.to_string(), word.word().to_string())];
    if agent.launch_choice().is_some() {
        agent.start_phase_on(prompt, row.model.clone(), row.effort.clone(), env)
    } else {
        agent.forget_session();
        agent.start_transient_on(
            launch.clone(),
            prompt,
            row.model.clone(),
            row.effort.clone(),
            env,
        )
    }
}

/// The prompt behind Fix it by hand: an ordinary Implement session.
pub fn fix_prompt(spec: &str) -> String {
    format!("/plan2code-3-implement {spec}/overview.md --web")
}

/// The prompt behind Ask a question: an ordinary agent on the stopped phase
/// that builds and fixes nothing. It opens the console with `--web`, which
/// joins the session already on screen, and answers through its Ask tab.
pub fn ask_prompt(spec: &str) -> String {
    format!(
        "The Implementation Loop for {spec} stopped. Change nothing: do not start the loop, \
         do not edit files and do not run git. Read {spec}/overview.md and the report so far, \
         then open the web console with --web (it joins the session already on screen). Pass \
         neither --workflow nor --spec to that open: any workflow name makes it a hop to \
         another skill, which wipes the stopped screen. Answer the person's questions through its Ask tab until they press a button on the \
         stopped screen."
    )
}

/// Start the Ask agent: `start_with` without the forget step, so the agent's
/// `open` joins the session on screen and the stopped screen stays up. The
/// prompt is transient, as `start_with`'s is.
pub fn start_asking(agent: &AgentManager, launch: &Launch, prompt: String) -> Result<(), String> {
    let (kind, model, effort, mode) = launch.clone();
    agent.start_transient(kind, model, effort, mode, prompt)
}

pub fn finalize_prompt(spec: &str) -> String {
    format!("/plan2code-4-finalize {spec}/overview.md --web")
}

fn emit(ctx: &Ctx) {
    let event = {
        let guard = lock(&ctx.slot);
        guard
            .as_ref()
            .filter(|r| r.run_id == ctx.run_id)
            .map(state_event)
    };
    if let Some(event) = event {
        (ctx.hooks.emit)(event);
    }
}

fn start_phase(ctx: &Ctx, index: usize) -> Result<(), String> {
    // The baseline is read before the agent starts, outside the lock; a retry
    // keeps the first try's.
    let baseline = {
        let guard = lock(&ctx.slot);
        let rec = guard.as_ref().ok_or("the loop ended")?;
        let first_try = rec.phases.get(index).is_some_and(|p| p.retries == 0);
        first_try.then(|| {
            let carried = if index == 0 && rec.resumed_files.is_some() {
                rec.own_dirty.clone()
            } else {
                Vec::new()
            };
            (rec.project.clone(), carried)
        })
    }
    .map(|(project, carried)| phase_baseline(&project, &carried));
    let prompt = {
        let mut guard = lock(&ctx.slot);
        let rec = guard.as_mut().ok_or("the loop ended")?;
        if let Some(baseline) = baseline {
            rec.phase_baseline = baseline;
        }
        rec.page_candidate = None;
        rec.current = index;
        rec.phases[index].status = PhaseStatus::Running;
        rec.step = Step::Starting;
        rec.sid = None;
        rec.waiting = false;
        rec.last_outcome = None;
        rec.last_entry = None;
        rec.phase_started_at = Instant::now();
        rec.activity_checked = Instant::now();
        rec.last_activity = SystemTime::now();
        let prompt = phase_prompt(&rec.spec, rec.phases[index].n, &rec.setup);
        let on = rec.phase_run(index).and_then(|run| {
            let word = run.strength?;
            Some((word, rec.strength_rows.get(word.word())?.clone()))
        });
        (prompt, on)
    };
    let (prompt, on) = prompt;
    // Said before the agent starts: the banner is up from the moment of Start,
    // and says what is happening between phases.
    emit(ctx);
    match on {
        Some((word, row)) => start_phase_with(&ctx.agent, &ctx.launch, prompt, &row, word)?,
        None => start_with(&ctx.agent, &ctx.launch, prompt)?,
    }
    let generation = ctx.agent.snapshot().generation;
    if let Some(rec) = lock(&ctx.slot).as_mut().filter(|r| r.run_id == ctx.run_id) {
        rec.generation = generation;
    }
    emit(ctx);
    Ok(())
}

// ---------------------------------------------------------- the watch loop

fn watch(ctx: Ctx) {
    watch_with(ctx, tick);
}

/// The watcher: look every `watch_every` until `step` says the loop is over.
/// A panic in `step` ends the loop with the "watcher failed" stop, so the slot
/// is cleared, the agent ended and the page told, never a loop left running
/// with nothing watching it.
fn watch_with(ctx: Ctx, mut step: impl FnMut(&Ctx) -> bool) {
    loop {
        thread::sleep(ctx.limits.watch_every);
        let seen = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| step(&ctx)));
        match seen {
            Ok(true) => {}
            Ok(false) => return,
            Err(payload) => {
                let text = payload
                    .downcast_ref::<&str>()
                    .map(|s| (*s).to_string())
                    .or_else(|| payload.downcast_ref::<String>().cloned())
                    .unwrap_or_else(|| "an unknown error".to_string());
                let text: String = one_line(&text).chars().take(200).collect();
                let cause = StopCause::WatcherFailed(text);
                let line = stop_line(&cause, 0, "", false);
                stop_loop(&ctx, cause, line, &["resume", "fix"]);
                return;
            }
        }
    }
}

/// What one pass over the running loop needs, copied out so no lock is held
/// while a tool runs.
struct Snapshot {
    project: PathBuf,
    spec: String,
    setup: LoopSetup,
    current: usize,
    phase_n: u32,
    sid: Option<String>,
    waited: Duration,
    generation: u64,
    stop_now: bool,
    phase_retries: u32,
    last_activity: SystemTime,
    activity_due: bool,
    page_candidate: Option<String>,
}

/// The running loop as one look sees it, or `None` when this loop is over.
fn take_snapshot(ctx: &Ctx) -> Option<Snapshot> {
    let guard = lock(&ctx.slot);
    match guard.as_ref() {
        Some(rec) if rec.run_id == ctx.run_id => Some(Snapshot {
            project: rec.project.clone(),
            spec: rec.spec.clone(),
            setup: rec.setup.clone(),
            current: rec.current,
            phase_n: rec.phases[rec.current].n,
            sid: rec.sid.clone(),
            waited: rec.phase_started_at.elapsed(),
            generation: rec.generation,
            stop_now: rec.stop_now,
            phase_retries: rec.phases[rec.current].retries,
            last_activity: rec.last_activity,
            activity_due: rec.activity_checked.elapsed() >= ctx.limits.activity_every,
            page_candidate: rec.page_candidate.clone(),
        }),
        _ => None,
    }
}

/// One look at the running phase. Returns false when the loop is over.
fn tick(ctx: &Ctx) -> bool {
    let Some(snap) = take_snapshot(ctx) else {
        return false;
    };
    if snap.stop_now {
        stop_by_person(ctx, &snap);
        return false;
    }
    let adopted = || adopt_candidate(ctx, snap.page_candidate.as_deref());
    let Some(sid) = snap.sid.clone().or_else(adopted) else {
        if let Some(reason) = crashed(ctx, &snap) {
            return fail(ctx, &snap, StopCause::Crash, reason);
        }
        if snap.waited > ctx.limits.notice_wait {
            return fail(ctx, &snap, StopCause::NoSession, String::new());
        }
        return true;
    };
    let session = match session_reader::load(&ctx.home, &sid) {
        Ok(session) => session,
        // Busy is the console mid-write, or a file that stays locked: look
        // again, but an ended agent is still judged and a state that never
        // frees counts as silence, or a locked file would hang the loop. It
        // is not counted as a failed read, which names a state that cannot be
        // understood.
        Err(ReadError::Busy) => {
            if let Some(go) = crash_or_outcome(ctx, &snap, &sid) {
                return go;
            }
            if silence_expired(
                SystemTime::now(),
                snap.last_activity,
                &snap.setup,
                None,
                false,
            ) {
                let minutes = snap.setup.silence_minutes.min(60);
                return fail(ctx, &snap, StopCause::Silence, minutes.to_string());
            }
            return true;
        }
        // Any other error reads as "no outcome yet": the ended-agent check
        // runs, and a session that stays unreadable counts as silence.
        Err(_) => {
            if let Some(go) = crash_or_outcome(ctx, &snap, &sid) {
                return go;
            }
            note_read_failure(ctx, true);
            let now = SystemTime::now();
            if silence_expired(now, snap.last_activity, &snap.setup, None, false) {
                let minutes = snap.setup.silence_minutes.min(60);
                return fail(ctx, &snap, StopCause::Silence, minutes.to_string());
            }
            return true;
        }
    };
    note_read_failure(ctx, false);
    let state = &session.state;
    if state["loopOutcome"].is_object() {
        return handle_outcome(ctx, &snap, &state["loopOutcome"]);
    }
    ensure_expect(ctx, &snap, &sid, state);
    if let Some(go) = crash_or_outcome(ctx, &snap, &sid) {
        return go;
    }
    // Under best guess a question is one the agent could not guess: the phase
    // stops on it at once, the stop card naming it, rather than waiting.
    if snap.setup.on_question == OnQuestion::Guess {
        if let Some(question) = first_open_question(state) {
            let cause = StopCause::Question;
            let line = stop_line(&cause, snap.phase_n, &question, false);
            stop_loop(ctx, cause, line, &["resume", "fix"]);
            return false;
        }
    }
    let asked = snap.setup.on_question != OnQuestion::Guess && open_question(state);
    if asked && snap.setup.on_question == OnQuestion::Stop {
        let cause = StopCause::Question;
        let line = stop_line(&cause, snap.phase_n, "", false);
        stop_loop(ctx, cause, line, &["resume", "fix"]);
        return false;
    }
    observe(ctx, state["headline"]["stage"].as_str(), asked);

    let quiet = state["agent"]["quietMinutes"]
        .as_u64()
        .and_then(|m| u32::try_from(m).ok());
    let mut last = snap.last_activity;
    if snap.activity_due {
        last = refresh_activity(ctx, &snap, &session.dir);
    }
    if silence_expired(SystemTime::now(), last, &snap.setup, quiet, asked) {
        let minutes = snap.setup.silence_minutes.max(quiet.unwrap_or(0)).min(60);
        return fail(ctx, &snap, StopCause::Silence, minutes.to_string());
    }
    true
}

/// The agent has ended by itself: read the session once more before calling
/// it a crash, because an agent that writes its report and exits between two
/// looks must be judged, not retried. `Some(goes_on)` when it had ended (the
/// report was handled, or the crash stop or retry ran); `None` when it has not.
fn crash_or_outcome(ctx: &Ctx, snap: &Snapshot, sid: &str) -> Option<bool> {
    let reason = crashed(ctx, snap)?;
    if let Ok(session) = session_reader::load(&ctx.home, sid) {
        if session.state["loopOutcome"].is_object() {
            return Some(handle_outcome(ctx, snap, &session.state["loopOutcome"]));
        }
    }
    Some(fail(ctx, snap, StopCause::Crash, reason))
}

/// Whether `e` is a whole `loopExpect` stamp: the three fields the console
/// enforces, each the right kind. Anything less counts as no stamp, so a
/// corrupt or partial one is replaced rather than left to fail every post.
fn valid_expect(e: &Value) -> bool {
    let fix_ok = e["fix"].as_str() == Some("smart")
        || e["fix"].as_array().is_some_and(|a| {
            a.iter()
                .all(|l| ["critical", "warning", "suggestion"].contains(&l.as_str().unwrap_or("")))
        });
    e.is_object() && e["review"].is_boolean() && e["guess"].is_boolean() && fix_ok
}

/// The judging criteria (`loopExpect`), posted into the session so the
/// console refuses a report that misses one at post time, while the agent can
/// still fix and repost, instead of the phase stopping on the verdict later.
/// It lands only once the agent has locked the session with `open --loop`,
/// and is reposted on every look while the stored stamp is missing or not the
/// full shape (a fresh session, an unlock that dropped it, a corrupt stamp).
/// A post that does not land only weakens this early check and is retried.
fn ensure_expect(ctx: &Ctx, snap: &Snapshot, sid: &str, state: &Value) {
    if !state["loop"]["driving"].as_bool().unwrap_or(false) || valid_expect(&state["loopExpect"]) {
        return;
    }
    let _ = loop_tools::console_post(&ctx.console_dir, sid, &expect_patch(&snap.setup));
}

/// Count (or clear) the looks that could not read the session.
fn note_read_failure(ctx: &Ctx, failed: bool) {
    let mut guard = lock(&ctx.slot);
    if let Some(rec) = guard.as_mut().filter(|r| r.run_id == ctx.run_id) {
        if failed {
            rec.read_failures += 1;
        } else if rec.read_failures > 0 {
            rec.read_failures = 0;
        }
    }
}

/// The reason the current phase's agent ended by itself, if it did.
fn crashed(ctx: &Ctx, snap: &Snapshot) -> Option<String> {
    let seen = ctx.agent.snapshot();
    match seen.state {
        AgentState::Ended { reason } if seen.generation == snap.generation => Some(reason),
        _ => None,
    }
}

/// Take the step from the page's headline, or Waiting on you while a question
/// holds the loop; the first moment of a hold sets the app's own attention.
fn observe(ctx: &Ctx, stage: Option<&str>, asked: bool) {
    let (changed, hold) = {
        let mut guard = lock(&ctx.slot);
        let Some(rec) = guard.as_mut().filter(|r| r.run_id == ctx.run_id) else {
            return;
        };
        let before = (rec.step, rec.waiting);
        let newly_waiting = asked && !rec.waiting;
        rec.waiting = asked;
        if asked {
            // A held question is not silence, and the clock starts afresh the
            // moment it is answered.
            rec.last_activity = SystemTime::now();
            rec.activity_checked = Instant::now();
            rec.step = Step::WaitingOnYou;
        } else if matches!(rec.step, Step::Checking | Step::Commit) {
            // The app's own steps: the page's headline does not name them.
        } else if let Some(stage) = stage {
            rec.step = step_for_stage(stage);
        } else if rec.step == Step::WaitingOnYou {
            rec.step = Step::Build;
        }
        let hold = newly_waiting.then(|| (rec.setup.clone(), Where::of(rec, rec.current)));
        ((rec.step, rec.waiting) != before, hold)
    };
    if let Some((setup, at)) = hold {
        (ctx.hooks.attention)();
        // On its own thread: a slow address must not delay the watch.
        let (slot, run_id) = (Arc::clone(&ctx.slot), ctx.run_id);
        thread::spawn(move || {
            if let Some(reason) = notify(&setup, &question_message(&at, false)) {
                if let Some(rec) = lock(&slot).as_mut().filter(|r| r.run_id == run_id) {
                    rec.notify_failure = Some(reason);
                }
            }
        });
    }
    if changed {
        emit(ctx);
    }
}

/// A file time is never later than now: a file dated in the future (a clock
/// that was wrong, a copied file) must not hold the last sign of work ahead of
/// the clock, or silence would never fire.
fn clamp_to_now(time: SystemTime) -> SystemTime {
    time.min(SystemTime::now())
}

fn modified(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path)
        .ok()?
        .modified()
        .ok()
        .map(clamp_to_now)
}

/// The newest sign of work: the session's own files, or a file `git status`
/// lists (ignored folders never appear, so they never count).
fn newest_work(session_dir: &Path, project: &Path) -> Option<SystemTime> {
    let mut newest = ["state.json", "events.ndjson"]
        .iter()
        .filter_map(|name| modified(&session_dir.join(name)))
        .max();
    if let Ok(files) = loop_tools::git_status_porcelain(project) {
        let tree = files
            .iter()
            .take(2000)
            .filter_map(|file| modified(&project.join(file.trim_end_matches('/'))))
            .max();
        newest = newest.max(tree);
    }
    newest
}

fn refresh_activity(ctx: &Ctx, snap: &Snapshot, session_dir: &Path) -> SystemTime {
    let newest = newest_work(session_dir, &snap.project);
    let mut guard = lock(&ctx.slot);
    let Some(rec) = guard.as_mut().filter(|r| r.run_id == ctx.run_id) else {
        return snap.last_activity;
    };
    rec.activity_checked = Instant::now();
    if let Some(time) = newest.map(clamp_to_now) {
        if time > rec.last_activity {
            rec.last_activity = time;
        }
    }
    rec.last_activity
}

/// A crash, silence or a console that never opened: one fresh retry when the
/// setup allows it, else the loop stops. Returns whether the loop goes on.
fn fail(ctx: &Ctx, snap: &Snapshot, cause: StopCause, detail: String) -> bool {
    // Stop now was pressed since this look began: the ended agent is not a
    // crash and nothing is retried.
    if stop_requested(ctx) {
        stop_by_person(ctx, snap);
        return false;
    }
    if should_retry(&cause, &snap.setup, snap.phase_retries) {
        // The retry runs one strength up, and its entry says so.
        if let Some(rec) = lock(&ctx.slot).as_mut().filter(|r| r.run_id == ctx.run_id) {
            rec.step_strength_up(snap.current);
        }
        let why = stop_line(&cause, snap.phase_n, &detail, false);
        let name = phase_name(ctx);
        add_entry(
            ctx,
            ReportEntry {
                at: report_time(),
                phase: snap.phase_n,
                name,
                result: EntryResult::Retried,
                line: why,
                retries: 1,
                assumed: phase_assumptions(&snap.project, &snap.spec, snap.phase_n, None),
                ..ReportEntry::default()
            },
        );
        {
            let mut guard = lock(&ctx.slot);
            let Some(rec) = guard.as_mut().filter(|r| r.run_id == ctx.run_id) else {
                return false;
            };
            rec.phases[snap.current].retries += 1;
            rec.retries_used += 1;
        }
        // Stop now may have come while the entry was written: no new agent.
        if stop_requested(ctx) {
            stop_by_person(ctx, snap);
            return false;
        }
        // Nothing is undone: the skill picks up at the phase's first open task.
        return match start_phase(ctx, snap.current) {
            Ok(()) => true,
            Err(e) => {
                let why = format!("the retry could not start ({})", one_line(&e));
                let cause = StopCause::Refused(why);
                let line = stop_line(&cause, snap.phase_n, "", true);
                stop_loop(ctx, cause, line, &["resume", "fix"]);
                false
            }
        };
    }
    let line = stop_line(&cause, snap.phase_n, &detail, snap.phase_retries > 0);
    stop_loop(ctx, cause, line, &["resume", "fix"]);
    false
}

fn stop_by_person(ctx: &Ctx, snap: &Snapshot) {
    let cause = StopCause::StoppedByPerson;
    let line = stop_line(&cause, snap.phase_n, "", false);
    stop_loop(ctx, cause, line, &["resume", "fix"]);
}

/// Stop now came before the commit began: nothing is committed. `staged` is
/// whether the loop put files in the index, which are taken out again.
fn stop_before_mark(ctx: &Ctx, snap: &Snapshot, staged: bool) -> bool {
    if staged {
        loop_commit::unstage(&snap.project);
    }
    stop_by_person(ctx, snap);
    false
}

fn stop_requested(ctx: &Ctx) -> bool {
    lock(&ctx.slot)
        .as_ref()
        .is_some_and(|r| r.run_id == ctx.run_id && r.stop_now)
}

/// Judge a phase's report and, when it holds, record it: quick check, mark,
/// approval line, commit, stop the agent, then the next phase, a stop the
/// person asked for, or the finish. Returns whether the loop goes on.
fn handle_outcome(ctx: &Ctx, snap: &Snapshot, raw: &Value) -> bool {
    let n = snap.phase_n;
    let stop = |cause: StopCause, line: String| {
        stop_loop(ctx, cause, line, &["resume", "fix"]);
        false
    };
    let refused = |why: String| {
        let cause = StopCause::Refused(why);
        let line = stop_line(&cause, n, "", false);
        stop(cause, line)
    };
    let outcome: Outcome = match serde_json::from_value(raw.clone()) {
        Ok(outcome) => outcome,
        Err(e) => return refused(format!("the phase report could not be read ({e})")),
    };
    if outcome.phase != n {
        return refused(format!("the report names Phase {}", outcome.phase));
    }
    let status = match loop_tools::specs_status(&snap.project, &snap.spec) {
        Ok(status) => status,
        Err(e) => return refused(format!("the spec could not be read ({})", one_line(&e))),
    };
    let entry = status["phases"]
        .as_array()
        .and_then(|all| {
            all.iter()
                .find(|p| p["number"].as_u64() == Some(u64::from(n)))
        })
        .cloned()
        .unwrap_or(Value::Null);
    keep_report(ctx, &outcome, &entry);
    let warnings = match judge_outcome(&outcome, &entry, &snap.setup) {
        Verdict::Refuse(why) => return refused(why),
        Verdict::Approve { warnings } => warnings,
    };

    // Everything that can fail before a file changes comes first.
    let prepared = if snap.setup.commit {
        loop_commit::prepare(&snap.project, &snap.spec, &entry, &outcome.subject)
    } else {
        loop_commit::phase_file(&snap.project, &snap.spec, &entry).map(|phase_file| {
            loop_commit::Prepared {
                message: String::new(),
                phase_file,
            }
        })
    };
    let prepared = match prepared {
        Ok(prepared) => prepared,
        Err(e) => return refused(one_line(&e)),
    };

    set_step(ctx, Step::Checking);
    let check = snap.setup.quick_check.trim();
    if !check.is_empty() {
        let run = loop_tools::quick_check(&snap.project, check, loop_tools::CHECK_LIMIT);
        if !run.ok {
            keep_output(ctx, &run.output);
            let cause = StopCause::QuickCheck;
            let line = stop_line(&cause, n, "", false);
            return stop(cause, line);
        }
    }
    // Stop now came while the check ran: nothing is staged or marked yet.
    if stop_requested(ctx) {
        return stop_before_mark(ctx, snap, false);
    }
    // With commit on, stage and look at the list before any file is marked:
    // a secret or an oversized file stops the phase with nothing to undo.
    if snap.setup.commit {
        set_step(ctx, Step::Commit);
        let baseline = lock(&ctx.slot)
            .as_ref()
            .filter(|r| r.run_id == ctx.run_id)
            .and_then(|r| r.phase_baseline.clone());
        match loop_commit::stage_and_check(&snap.project, baseline.as_deref()) {
            Ok(()) => {}
            Err(loop_commit::StageError::Add(failure)) => {
                keep_output(ctx, &failure.output);
                let left_staged = loop_commit::unstage(&snap.project);
                let cause = StopCause::Commit;
                let detail = if failure.first_line == loop_tools::STAGED_TOO_LONG
                    || failure.first_line == loop_commit::OWN_FILES_UNKNOWN
                {
                    failure.first_line.clone()
                } else {
                    format!("git add failed: {}", failure.first_line)
                };
                let mut line = stop_line(&cause, n, &detail, false);
                if let Some(why) = left_staged {
                    line = format!(
                        "{line}. The files are still staged ({why}): run git reset before committing by hand"
                    );
                }
                return stop(cause, line);
            }
            Err(loop_commit::StageError::Problem(problem)) => {
                let mut kept = problem.files.join("\n");
                if let Some(why) = &problem.left_staged {
                    kept.push_str(&format!("\n\nThey could not be unstaged: {why}"));
                }
                keep_output(ctx, &kept);
                let cause = StopCause::UnsafeFiles(problem.files);
                let mut line = stop_line(&cause, n, "", false);
                if let Some(why) = &problem.left_staged {
                    line = format!(
                        "{line}. They are still staged ({why}): run git reset before committing by hand"
                    );
                }
                return stop(cause, line);
            }
        }
    }
    if stop_requested(ctx) {
        return stop_before_mark(ctx, snap, snap.setup.commit);
    }
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let approval = approval_line(&date, &snap.setup);
    let marked = match loop_commit::mark(&prepared, &snap.project, &snap.spec, n, &approval) {
        Ok(marked) => marked,
        Err(failure) if failure.put_back_failed => {
            // Both files could not be put back: the spec may say done with
            // nothing committed, so say so and keep the fact like a failed undo.
            keep_output(ctx, &failure.message);
            return marked_not_committed(ctx, &prepared, n);
        }
        Err(failure) => {
            keep_output(ctx, &failure.message);
            let left_staged = if snap.setup.commit {
                loop_commit::unstage(&snap.project)
            } else {
                None
            };
            let staged_note = left_staged
                .map(|why| {
                    format!("; the files are still staged ({why}): run git reset before committing by hand")
                })
                .unwrap_or_default();
            return refused(format!(
                "the phase could not be marked done ({}){staged_note}",
                one_line(&failure.message)
            ));
        }
    };

    let mut commit = None;
    if snap.setup.commit {
        // Stop now came during the mark: take the mark back, commit nothing.
        // Once the commit below begins, it is finished (and nothing follows).
        if stop_requested(ctx) {
            return match loop_commit::undo(&prepared, &marked) {
                Ok(()) => stop_before_mark(ctx, snap, true),
                Err(why) => {
                    keep_output(ctx, &why);
                    marked_not_committed(ctx, &prepared, n)
                }
            };
        }
        match loop_commit::commit(&snap.project, &prepared, &marked, ctx.limits.commit_limit) {
            Ok(head) => {
                commit = head;
                set_marked(ctx, None);
            }
            Err(failure) => return commit_failed(ctx, snap, &prepared, &marked, &failure),
        }
    }
    ctx.agent.stop();

    let passed = ReportEntry {
        at: report_time(),
        phase: n,
        name: phase_name(ctx),
        result: EntryResult::Passed,
        commit: commit.clone(),
        retries: snap.phase_retries,
        assumed: phase_assumptions(&snap.project, &snap.spec, n, Some(&entry)),
        warnings,
        ..ReportEntry::default()
    }
    .with_outcome(&outcome);
    add_entry(ctx, passed);
    let (next, stop_after, stop_now, told) = {
        let mut guard = lock(&ctx.slot);
        let Some(rec) = guard.as_mut().filter(|r| r.run_id == ctx.run_id) else {
            return false;
        };
        let phase = &mut rec.phases[snap.current];
        phase.status = PhaseStatus::Done;
        phase.commit = commit;
        phase.subject = Some(outcome.subject.clone());
        let told = (rec.setup.notify_phases && !rec.setup.notify_url.is_empty()).then(|| {
            let tasks = &entry["tasks"];
            let done = PhaseDone {
                tasks: counted(tasks, "total"),
                subject: outcome.subject.clone(),
                commit: rec.phases[snap.current].commit.clone(),
                next: rec
                    .phases
                    .get(snap.current + 1)
                    .map(|p| (p.n, p.name.clone())),
            };
            (
                rec.setup.clone(),
                phase_message(&Where::of(rec, snap.current), &done),
            )
        });
        (
            (snap.current + 1 < rec.phases.len()).then_some(snap.current + 1),
            rec.stop_after_phase,
            rec.stop_now,
            told,
        )
    };
    if let Some((setup, message)) = told {
        // On its own thread: a slow address must not delay the next phase.
        let (slot, run_id) = (Arc::clone(&ctx.slot), ctx.run_id);
        thread::spawn(move || {
            if let Some(reason) = notify(&setup, &message) {
                if let Some(rec) = lock(&slot).as_mut().filter(|r| r.run_id == run_id) {
                    rec.notify_failure = Some(reason);
                }
            }
        });
    }
    // Stop now, even on the last phase: the phase is recorded as it stands,
    // and no next phase or Finalize follows.
    if stop_now {
        let how = if snap.setup.commit {
            "committed"
        } else {
            "marked done"
        };
        let can: &[&str] = if next.is_some() {
            &["resume"]
        } else {
            &["finalize"]
        };
        stop_loop(
            ctx,
            StopCause::StoppedByPerson,
            format!("Stopped after Phase {n} was {how}, as asked"),
            can,
        );
        return false;
    }
    match next {
        Some(_) if stop_after => {
            stop_loop(
                ctx,
                StopCause::StoppedByPerson,
                format!("Stopped after Phase {n}, as asked"),
                &["resume"],
            );
            false
        }
        Some(index) => match start_phase(ctx, index) {
            Ok(()) => true,
            Err(e) => {
                let cause = StopCause::Refused(format!(
                    "the next phase could not start ({})",
                    one_line(&e)
                ));
                let line = format!("The next phase could not start: {}", one_line(&e));
                stop_loop(ctx, cause, line, &["resume", "fix"]);
                false
            }
        },
        None => {
            finish(ctx);
            false
        }
    }
}

/// A commit that failed: take the mark back and stop with the work uncommitted
/// and the spec showing the phase open. When the mark cannot be taken back,
/// stop at once and save the fact, so it survives an app restart.
fn commit_failed(
    ctx: &Ctx,
    snap: &Snapshot,
    prepared: &loop_commit::Prepared,
    marked: &loop_commit::Marked,
    failure: &loop_commit::CommitFailure,
) -> bool {
    let n = snap.phase_n;
    keep_output(ctx, &failure.output);
    let (cause, line) = match loop_commit::undo(prepared, marked) {
        Ok(()) => {
            let left_staged = loop_commit::unstage(&snap.project);
            let cause = StopCause::Commit;
            let detail = match failure.stage {
                loop_commit::Stage::Add => format!("git add failed: {}", failure.first_line),
                loop_commit::Stage::Commit => failure.first_line.clone(),
            };
            let mut line = stop_line(&cause, n, &detail, false);
            if let Some(why) = left_staged {
                line = format!(
                    "{line}. The files are still staged ({why}): run git reset before committing by hand"
                );
            }
            (cause, line)
        }
        Err(why) => {
            keep_output(ctx, &format!("{why}\n\n{}", failure.output));
            return marked_not_committed(ctx, prepared, n);
        }
    };
    stop_loop(ctx, cause, line, &["resume", "fix"]);
    false
}

/// Stop at once: the phase file says done and its work is not committed. The
/// fact is saved with the report, so it survives an app restart.
fn marked_not_committed(ctx: &Ctx, prepared: &loop_commit::Prepared, n: u32) -> bool {
    let file = prepared
        .phase_file
        .file_name()
        .map_or_else(String::new, |f| f.to_string_lossy().into_owned());
    set_marked(ctx, Some((n, file.clone())));
    let cause = StopCause::MarkedNotCommitted(file);
    let line = stop_line(&cause, n, "", false);
    stop_loop(ctx, cause, line, &["resume", "fix"]);
    false
}

/// Remember (or forget) that a phase is marked done with no commit behind it.
/// `stop_loop` and `add_entry` save the report, so the fact reaches the disk.
fn set_marked(ctx: &Ctx, marked: Option<(u32, String)>) {
    if let Some(rec) = lock(&ctx.slot).as_mut().filter(|r| r.run_id == ctx.run_id) {
        match marked {
            Some((phase, file)) => rec.report.set_marked(phase, &file),
            None => rec.report.clear_marked(),
        }
    }
}

/// The current phase's name, for a report entry.
fn phase_name(ctx: &Ctx) -> String {
    lock(&ctx.slot)
        .as_ref()
        .filter(|r| r.run_id == ctx.run_id)
        .map(|r| r.phases[r.current].name.clone())
        .unwrap_or_default()
}

/// The assumptions the phase file holds now. `entry` is the phase's row from
/// `specs.mjs status` when one is at hand; it names the file.
fn phase_assumptions(
    project: &Path,
    spec: &str,
    phase: u32,
    entry: Option<&Value>,
) -> Vec<loop_report::Assumption> {
    let file = entry
        .and_then(|e| e["file"].as_str())
        .map_or_else(|| format!("phase-{phase}.md"), str::to_string);
    std::fs::read_to_string(project.join(spec).join(file))
        .map(|text| loop_report::assumptions_in(&text))
        .unwrap_or_default()
}

/// Add to the report and save it straight away, so a crash loses nothing. A save
/// that fails never stops the loop; the report stays in memory and the end says so.
fn add_entry(ctx: &Ctx, entry: ReportEntry) {
    let mut entry = entry;
    let saved = {
        let mut guard = lock(&ctx.slot);
        let Some(rec) = guard.as_mut().filter(|r| r.run_id == ctx.run_id) else {
            return;
        };
        // What the phase ran on, with Set strength per phase on.
        if entry.strength.is_empty() {
            if let Some(run) = rec.phase_run(rec.current) {
                entry.strength = run.word_text().to_string();
                entry.model = run.model_text();
            }
        }
        rec.report.entries.push(entry);
        (rec.project.clone(), rec.report.clone())
    };
    let result = loop_report::save(&ctx.home, &saved.0, &saved.1);
    if let Some(rec) = lock(&ctx.slot).as_mut().filter(|r| r.run_id == ctx.run_id) {
        rec.report_failure = result.err();
    }
}

fn set_step(ctx: &Ctx, step: Step) {
    let changed = {
        let mut guard = lock(&ctx.slot);
        match guard.as_mut().filter(|r| r.run_id == ctx.run_id) {
            Some(rec) => {
                let changed = rec.step != step;
                rec.step = step;
                changed
            }
            None => false,
        }
    };
    if changed {
        emit(ctx);
    }
}

fn keep_output(ctx: &Ctx, output: &str) {
    if let Some(rec) = lock(&ctx.slot).as_mut().filter(|r| r.run_id == ctx.run_id) {
        rec.failure_output = Some(output.to_string());
    }
}

fn keep_report(ctx: &Ctx, outcome: &Outcome, entry: &Value) {
    if let Some(rec) = lock(&ctx.slot).as_mut().filter(|r| r.run_id == ctx.run_id) {
        rec.last_outcome = Some(outcome.clone());
        rec.last_entry = Some(entry.clone());
    }
}

fn one_line(text: &str) -> String {
    let line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if line.chars().count() > 160 {
        let cut: String = line.chars().take(157).collect();
        format!("{cut}...")
    } else {
        line
    }
}

// ------------------------------------------------------ requests from the app

/// Stop after this phase: the phase finishes (review, mark, commit), then the
/// loop stops instead of starting the next. Returns the strip's new state.
pub fn request_stop_after(slot: &LoopSlot, on: bool) -> Result<LoopStateEvent, String> {
    let mut guard = lock(slot);
    let rec = guard.as_mut().ok_or("No loop is running")?;
    if on && rec.current + 1 >= rec.phases.len() {
        return Err("This is the last phase".to_string());
    }
    rec.stop_after_phase = on;
    Ok(state_event(rec))
}

/// Stop now: the flag is set first, so the ended agent is never taken for a
/// crash and no branch of the loop starts more work, then the agent (when one
/// is running) is ended; the watch thread tells the page. The strip's new state
/// ("Stopping") goes to `emit` while the slot is still held, so the watcher's
/// own "ended" event can never come before it; ending the agent can take a
/// while, and runs after.
pub fn request_stop_now(
    slot: &LoopSlot,
    agent: Option<&AgentManager>,
    emit: impl FnOnce(&LoopStateEvent),
) -> Result<LoopStateEvent, String> {
    let event = {
        let mut guard = lock(slot);
        let rec = guard.as_mut().ok_or("No loop is running")?;
        rec.stop_now = true;
        let event = state_event(rec);
        emit(&event);
        event
    };
    if let Some(agent) = agent {
        agent.stop();
    }
    Ok(event)
}

/// Forget the running loop without a word to the page: the app is quitting.
pub fn abandon(slot: &LoopSlot) {
    *lock(slot) = None;
}

pub fn is_running(slot: &LoopSlot) -> bool {
    lock(slot).is_some()
}

/// What the quit check says: the current phase's number, the run's last phase
/// number and the phases committed so far. `None` when no loop runs.
pub fn quit_facts(slot: &LoopSlot) -> Option<(u32, u32, Vec<u32>)> {
    lock(slot).as_ref().map(|rec| {
        let committed = rec
            .phases
            .iter()
            .filter(|p| p.status == PhaseStatus::Done && p.commit.is_some())
            .map(|p| p.n)
            .collect();
        (
            rec.phases.get(rec.current).map_or(0, |p| p.n),
            rec.phases.last().map_or(0, |p| p.n),
            committed,
        )
    })
}

// ------------------------------------------------------------ the ending

/// Every phase this build has touched, by number: what the report says for one
/// that passed, even in an earlier run before a Resume, else this run's record.
fn phase_rows(rec: &RunningRecord) -> Value {
    let passed = rec.report.passed();
    let mut rows: Vec<(u32, Value)> = passed
        .iter()
        .map(|e| {
            (
                e.phase,
                json!({
                    "n": e.phase,
                    "name": e.name,
                    "commit": e.commit,
                    "unfixed": e.skipped.len() + e.left_open.len(),
                    "retries": e.retries,
                    "fixed": e.fixed.len(),
                    "skipped": e.skipped.len(),
                    "left": e.left_open.len(),
                    "assumed": e.assumed.len(),
                    "decisions": e.decisions.len(),
                }),
            )
        })
        .collect();
    for p in &rec.phases {
        if !rows.iter().any(|(n, _)| *n == p.n) {
            rows.push((
                p.n,
                json!({
                    "n": p.n,
                    "name": p.name,
                    "commit": p.commit,
                    "unfixed": 0,
                    "retries": p.retries,
                    "fixed": 0,
                    "skipped": 0,
                    "left": 0,
                    "assumed": 0,
                    "decisions": 0,
                }),
            ));
        }
    }
    rows.sort_by_key(|(n, _)| *n);
    Value::Array(rows.into_iter().map(|(_, row)| row).collect())
}

/// The stop's evidence with the report so far under it, within the size limit.
fn evidence_with_report(evidence: &str, rec: &RunningRecord) -> String {
    let mut md = format!(
        "{evidence}\n# Everything the loop has done so far\n\n{}",
        loop_report::body_markdown(&rec.report)
    );
    if let Some(why) = &rec.report_failure {
        md.push_str(&format!(
            "\nThe report could not be saved along the way ({}), so a crash of the app would lose it.\n",
            one_line(why)
        ));
    }
    if md.len() > EVIDENCE_LIMIT {
        let mut cut = EVIDENCE_LIMIT;
        while !md.is_char_boundary(cut) {
            cut -= 1;
        }
        md.truncate(cut);
        md.push_str(
            "\n\n(cut here: the rest is kept, and is in the report when the build finishes)\n",
        );
    }
    md
}

const EVIDENCE_LIMIT: usize = 100 * 1024;
const OUTPUT_KEEP: usize = 40 * 1024;

/// The last `max` bytes of `text`, cut on a character boundary.
fn tail(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    let mut start = text.len() - max;
    while !text.is_char_boundary(start) {
        start += 1;
    }
    format!("(earlier output left out)\n{}", &text[start..])
}

fn fenced(text: &str) -> String {
    let body = tail(text.trim_end(), OUTPUT_KEEP).replace("```", "'''");
    format!("```\n{body}\n```\n")
}

/// Task ids from a `specs.mjs status` list (`blockedTasks`, `assumedTasks`):
/// plain ids or objects that name one.
fn task_ids(entry: &Value, key: &str) -> Vec<String> {
    entry[key]
        .as_array()
        .map(|all| {
            all.iter()
                .map(|t| match t {
                    Value::String(id) => id.clone(),
                    Value::Object(_) => t["id"]
                        .as_str()
                        .or_else(|| t["task"].as_str())
                        .map_or_else(|| t.to_string(), str::to_string),
                    other => other.to_string(),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn ids_text(ids: Vec<String>) -> String {
    if ids.is_empty() {
        "none".to_string()
    } else {
        ids.join(", ")
    }
}

fn report_section(outcome: &Outcome, entry: Option<&Value>) -> String {
    let mut md = String::from("\n## What the phase reported\n\n");
    md.push_str(&format!("- Summary: {}\n", one_line(&outcome.summary)));
    let tests = match &outcome.tests {
        Some(t) if !t.summary.is_empty() => one_line(&t.summary),
        Some(t) if t.passed => "passed".to_string(),
        Some(t) if t.ran => "failed".to_string(),
        _ => "not reported".to_string(),
    };
    md.push_str(&format!("- Tests: {tests}\n"));
    if let Some(review) = &outcome.review {
        md.push_str(&format!(
            "- Left after the review: {} Critical, {} Warning, {} Suggestion\n",
            review.left.critical, review.left.warning, review.left.suggestion
        ));
    }
    if let Some(note) = outcome.review.as_ref().and_then(suggestion_warning) {
        md.push_str(&format!("- Warnings: {note}\n"));
    }
    if let Some(entry) = entry {
        md.push_str(&format!(
            "- Blocked tasks: {}\n",
            ids_text(task_ids(entry, "blockedTasks"))
        ));
        md.push_str(&format!(
            "- Assumed tasks: {}\n",
            ids_text(task_ids(entry, "assumedTasks"))
        ));
    }
    if let Some(review) = &outcome.review {
        if !review.unfixed.is_empty() {
            md.push_str("\n### Findings left unfixed\n\n");
            for f in &review.unfixed {
                md.push_str(&format!(
                    "- {}: {} ({})\n",
                    f.level.word(),
                    one_line(&f.title),
                    one_line(&f.file)
                ));
            }
        }
    }
    md
}

/// The markdown behind "Why the loop stopped": what failed and the proof, by
/// cause. Kept under 100 KB (output is trimmed to its tail).
pub fn evidence_markdown(cause: &StopCause, line: &str, rec: &RunningRecord) -> String {
    let mut md = format!("## What happened\n\n{line}\n");
    let phase_report = matches!(
        cause,
        StopCause::Refused(_)
            | StopCause::QuickCheck
            | StopCause::Commit
            | StopCause::MarkedNotCommitted(_)
            | StopCause::UnsafeFiles(_)
    );
    if phase_report {
        if let Some(outcome) = &rec.last_outcome {
            md.push_str(&report_section(outcome, rec.last_entry.as_ref()));
        }
    }
    match cause {
        StopCause::QuickCheck => {
            md.push_str("\n## The quick check\n\n");
            md.push_str(&format!("Command: `{}`\n\n", rec.setup.quick_check.trim()));
            md.push_str(&fenced(
                rec.failure_output.as_deref().unwrap_or("(no output)"),
            ));
        }
        StopCause::Commit => {
            md.push_str("\n## What git said\n\n");
            md.push_str(&fenced(
                rec.failure_output.as_deref().unwrap_or("(no output)"),
            ));
            md.push_str(
                "\nThe phase was approved, but its changes are not committed. The mark was taken back, so the spec still shows the phase open. Fix what git says, then press Resume to try the commit again.\n",
            );
        }
        StopCause::MarkedNotCommitted(file) => {
            md.push_str("\n## What git said\n\n");
            md.push_str(&fenced(
                rec.failure_output.as_deref().unwrap_or("(no output)"),
            ));
            md.push_str(&format!(
                "\nThe phase is marked done in `{file}` (and in overview.md), but its changes are not committed, and the mark could not be taken back. Set the phase back to in progress by hand, or press Resume: it checks every done mark against the commit log and builds this phase again.\n"
            ));
        }
        StopCause::UnsafeFiles(files) => {
            md.push_str("\n## The files\n\n");
            for file in files {
                let reason =
                    loop_commit::denied(file).unwrap_or("over 5 MB, or its size could not be read");
                md.push_str(&format!("- `{file}` ({reason})\n"));
            }
            md.push_str(
                "\nThe phase was approved, but these files were staged and the loop does not commit secrets or files over 5 MB. Nothing was marked done or committed, and everything was taken out of the index again (unless the stop line says otherwise). Remove the files, or add them to `.gitignore`, then press Resume.\n",
            );
        }
        StopCause::Refused(_) => {
            if let Some(output) = &rec.failure_output {
                md.push_str("\n## Output\n\n");
                md.push_str(&fenced(output));
            }
        }
        StopCause::Crash | StopCause::NoSession => {
            md.push_str("\nThe agent's terminal, beside this page, shows where it ended.\n");
        }
        StopCause::Silence => {
            md.push_str("\nNothing changed in the session or the project for that long, so the loop ended the agent.\n");
            if rec.read_failures > 0 {
                md.push_str(
                    "\nThe session could not be read during that time, so it counted as silence.\n",
                );
            }
        }
        StopCause::WatcherFailed(_) => {
            md.push_str(
                "\nThe loop's own watcher stopped working, so the agent was ended. Whatever was committed stays committed; nothing more was. Press Resume to carry on from the spec.\n",
            );
        }
        StopCause::Question if rec.setup.on_question == OnQuestion::Guess => {
            md.push_str("\nBest guess was on, but the phase asked a question it could not guess, so the loop stopped rather than wait. Answer it with Fix it by hand, or settle it in the spec, then press Resume.\n");
        }
        StopCause::Question => {
            md.push_str("\nThe setup says to stop when a phase asks something.\n");
        }
        StopCause::StoppedByPerson => {
            md.push_str("\nNothing was undone: the project stays as the agent left it.\n");
        }
    }
    if !rec.own_dirty.is_empty() {
        md.push_str(
            "\n## Your own files\n\nThese files were already changed when the loop started, so the list of uncommitted files leaves them out. A file you and the agent both changed is hidden from that list too.\n\n",
        );
        for file in rec.own_dirty.iter().take(50) {
            md.push_str(&format!("- `{file}`\n"));
        }
        if rec.own_dirty.len() > 50 {
            md.push_str(&format!("- and {} more\n", rec.own_dirty.len() - 50));
        }
    }
    if md.len() > EVIDENCE_LIMIT {
        let mut cut = EVIDENCE_LIMIT;
        while !md.is_char_boundary(cut) {
            cut -= 1;
        }
        md.truncate(cut);
        md.push_str("\n\n(cut here)\n");
    }
    md
}

/// Tell the page how the loop ended. A session the console no longer holds is
/// opened again once; a post the console refuses is repeated with the line
/// alone, so the page always hears the end.
fn post_end(ctx: &Ctx, rec: &RunningRecord, patch: &Value) {
    // A post writes the session's files, so it works with no server running,
    // and on Windows the agent's server has just ended with the agent. The
    // window brings the server back when it hears the loop ended.
    let Some(sid) = rec.sid.clone().or_else(|| rec.last_sid.clone()) else {
        return;
    };
    if loop_tools::console_post(&ctx.console_dir, &sid, patch).ok {
        return;
    }
    let workflow = if rec.setup.review {
        "implement-review"
    } else {
        "implement"
    };
    if loop_tools::console_resume(&ctx.console_dir, &sid, workflow).ok
        && loop_tools::console_post(&ctx.console_dir, &sid, patch).ok
    {
        return;
    }
    let mut plain = patch.clone();
    if let Some(object) = plain.as_object_mut() {
        object.remove("docs");
    }
    if let Some(end) = plain.get_mut("loopEnd").and_then(Value::as_object_mut) {
        end.remove("evidence");
    }
    let _ = loop_tools::console_post(&ctx.console_dir, &sid, &plain);
}

/// The buttons a stopped screen offers: `can`, with Ask a question first
/// whenever Resume is offered (the person can ask before choosing), and Back
/// to the dashboard last.
fn stop_can(can: &[&str]) -> Vec<String> {
    let ask = can.contains(&"resume") && !can.contains(&"ask");
    ask.then_some("ask")
        .into_iter()
        .chain(can.iter().copied())
        .chain(["dashboard"])
        .map(String::from)
        .collect()
}

/// End the loop, the one place every stop goes through: stop the agent, mark
/// the phase stopped, write the evidence and the end to the page, clear the
/// record and tell the strip. `can` names the buttons the stop screen offers.
fn stop_loop(ctx: &Ctx, cause: StopCause, line: String, can: &[&str]) {
    // The record first: a stale caller (an older loop's watcher) finds a newer
    // record, or none, and returns without ever ending the newer loop's agent.
    let rec = {
        let mut guard = lock(&ctx.slot);
        match guard.take() {
            Some(rec) if rec.run_id == ctx.run_id => rec,
            other => {
                *guard = other;
                return;
            }
        }
    };
    ctx.agent.stop();
    // The strip goes at once, so a new Start in the gap while this stop is
    // written is not hidden by this loop's late event.
    (ctx.hooks.emit)(LoopStateEvent::ended());
    let mut rec = rec;
    let at = rec.current;
    // A phase already built and recorded (Stop after this phase) adds only the
    // stop; any other carries what its agent reported, if it got that far.
    let built = rec.phases[at].status == PhaseStatus::Done;
    if rec.phases[at].status == PhaseStatus::Running {
        rec.phases[at].status = PhaseStatus::Stopped;
    }
    // Only the agent's work: files that were already changed when the loop
    // started are the person's own. A file both of them changed is hidden here,
    // a known limit of comparing names.
    let uncommitted = uncommitted_files(&rec.project, &rec.own_dirty);
    let line: String = one_line(&line).chars().take(200).collect();
    let mut entry = ReportEntry {
        at: report_time(),
        phase: rec.phases[at].n,
        name: rec.phases[at].name.clone(),
        result: EntryResult::Stopped,
        line: line.clone(),
        retries: rec.phases[at].retries,
        ..ReportEntry::default()
    };
    if !built {
        entry.assumed = phase_assumptions(
            &rec.project,
            &rec.spec,
            entry.phase,
            rec.last_entry.as_ref(),
        );
        if let Some(outcome) = &rec.last_outcome {
            entry = entry.with_outcome(outcome);
        }
    }
    // What the phase ran on, as `add_entry` does for every other entry.
    if let Some(run) = rec.phase_run(at) {
        entry.strength = run.word_text().to_string();
        entry.model = run.model_text();
    }
    rec.report.entries.push(entry);
    rec.report_failure = loop_report::save(&ctx.home, &rec.project, &rec.report).err();
    let mut evidence = evidence_with_report(&evidence_markdown(&cause, &line, &rec), &rec);
    let sent = stop_message(&cause, &Where::of(&rec, at), &line)
        .and_then(|message| notify(&rec.setup, &message));
    if let Some(reason) = sent.or_else(|| rec.notify_failure.clone()) {
        let said = notify_failed(&reason);
        evidence.push_str(&format!("\n\nAlso, {said}.\n"));
    }
    let patch = json!({
        "docs": [{
            "id": "evidence",
            "title": "Why the loop stopped, and the report so far",
            "blocks": [{ "id": "body", "state": "settled", "md": evidence }],
        }],
        "loopEnd": {
            "kind": "stopped",
            "line": line,
            "evidence": "evidence",
            "phases": phase_rows(&rec),
            "uncommitted": uncommitted,
            "can": stop_can(can),
        },
    });
    post_end(ctx, &rec, &patch);
}

fn finish(ctx: &Ctx) {
    let rec = {
        let guard = lock(&ctx.slot);
        match guard.as_ref() {
            Some(rec) if rec.run_id == ctx.run_id => rec.clone(),
            _ => return,
        }
    };
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let spec_dir = rec.project.join(&rec.spec);
    let file = unused_summary_name(&date, |name| spec_dir.join(name).exists());
    let relative = format!("{}/{file}", rec.spec);
    let built = phase_rows(&rec).as_array().map_or(0, Vec::len);
    let line = if built == 1 {
        "The 1 phase is built".to_string()
    } else {
        format!("All {built} phases built")
    };
    // Written before Finalize starts, saying what is planned; rewritten below
    // when what happened differs, so the file never claims a Finalize that
    // did not start.
    let planned = finalize_note(&rec.setup, stop_requested(ctx), None);
    let written = write_atomic(
        &spec_dir.join(&file),
        &summary_markdown(&rec, &date, &planned),
    );
    if written.is_ok() {
        // The project holds the report now. A failure here only means the next
        // loop on this spec starts from this report, so it is not worth a stop.
        let _ = loop_report::remove(&ctx.home, &rec.project, &rec.spec);
    }
    // Stop now pressed while the summary was written: no Finalize agent starts.
    let skip_finalize = stop_requested(ctx);
    let finalize_error = if rec.setup.after_last == AfterLast::RunFinalize && !skip_finalize {
        start_with(&ctx.agent, &ctx.launch, finalize_prompt(&rec.spec)).err()
    } else {
        None
    };
    let happened = finalize_note(&rec.setup, skip_finalize, finalize_error.as_deref());
    if written.is_ok() && happened != planned {
        let _ = write_atomic(
            &spec_dir.join(&file),
            &summary_markdown(&rec, &date, &happened),
        );
    }
    // The page always hears the end; a summary that could not be written or a
    // Finalize that could not start is said in the line.
    let mut said = line.clone();
    let mut patch = json!({});
    let mut evidence = None;
    match &written {
        Ok(()) => {
            evidence = Some("loop-summary");
            patch["docs"] = json!([{
                "id": "loop-summary",
                "title": "Loop summary",
                "blocks": [{ "id": "body", "file": relative }],
            }]);
        }
        Err(e) => said = format!("{said}; the summary file could not be written ({e})"),
    }
    if let Some(e) = finalize_error {
        said = format!("{said}; Finalize could not start ({e})");
    }
    if skip_finalize && rec.setup.after_last == AfterLast::RunFinalize {
        said = format!("{said}; Finalize was not started, as you asked to stop");
    }
    let message = finished_message(&Where::of(&rec, rec.current), built);
    if let Some(reason) = notify(&rec.setup, &message).or_else(|| rec.notify_failure.clone()) {
        said = format!("{said}; {}", notify_failed(&reason));
    }
    let mut end = json!({
        "kind": "finished",
        "line": one_line(&said),
        "phases": phase_rows(&rec),
        "uncommitted": [],
        "can": ["finalize", "dashboard"],
    });
    if let Some(id) = evidence {
        end["evidence"] = json!(id);
    }
    patch["loopEnd"] = end;
    post_end(ctx, &rec, &patch);
    {
        let mut guard = lock(&ctx.slot);
        if guard.as_ref().is_some_and(|r| r.run_id == ctx.run_id) {
            *guard = None;
        }
    }
    (ctx.hooks.emit)(LoopStateEvent::ended());
}

// ----------------------------------------------------- the files it writes

/// `LOOP-SUMMARY-<date>.md`, or `-2`, `-3` and so on when a report of that name
/// is already there: a second build the same day must not replace the first's.
pub fn unused_summary_name(date: &str, taken: impl Fn(&str) -> bool) -> String {
    let first = format!("LOOP-SUMMARY-{date}.md");
    if !taken(&first) {
        return first;
    }
    (2..)
        .map(|n| format!("LOOP-SUMMARY-{date}-{n}.md"))
        .find(|name| !taken(name))
        .unwrap_or(first)
}

fn levels_text(setup: &LoopSetup) -> String {
    if setup.fix_mode == FixMode::Smart {
        return "smart pick".to_string();
    }
    if setup.fix.is_empty() {
        return "no fix levels".to_string();
    }
    [FixLevel::Critical, FixLevel::Warning, FixLevel::Suggestion]
        .into_iter()
        .filter(|level| setup.fix.contains(level))
        .map(FixLevel::word)
        .collect::<Vec<_>>()
        .join(", ")
}

/// The line the app leaves under a phase's completion summary.
pub fn approval_line(date: &str, setup: &LoopSetup) -> String {
    let check = setup.quick_check.trim();
    let check = if check.is_empty() {
        "no quick check".to_string()
    } else {
        format!("quick check passed ({check})")
    };
    let review = if setup.review {
        format!("review at {}", levels_text(setup))
    } else {
        "review off".to_string()
    };
    format!("Approved by the Implementation Loop on {date}: tests passed, {check}, {review}.")
}

const SUMMARY_HEADING: &str = "## Phase Completion Summary";

/// `text` with `line` as the first line under the completion summary heading;
/// the heading and the line are appended when the file has none. The file's
/// own line endings are kept (LF when it has no CRLF).
pub fn with_approval_line(text: &str, line: &str) -> String {
    let eol = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let lines: Vec<&str> = text.lines().collect();
    let heading = lines
        .iter()
        .position(|l| l.trim_end().eq_ignore_ascii_case(SUMMARY_HEADING));
    let mut out: Vec<String> = Vec::new();
    match heading {
        Some(at) => {
            out.extend(lines[..=at].iter().map(|l| l.to_string()));
            out.push(String::new());
            out.push(line.to_string());
            let mut rest = &lines[at + 1..];
            if rest.first().is_some_and(|l| l.trim().is_empty()) {
                rest = &rest[1..];
            }
            if !rest.is_empty() {
                out.push(String::new());
                out.extend(rest.iter().map(|l| l.to_string()));
            }
        }
        None => {
            out.extend(lines.iter().map(|l| l.to_string()));
            if out.last().is_some_and(|l| !l.is_empty()) {
                out.push(String::new());
            }
            out.push(SUMMARY_HEADING.to_string());
            out.push(String::new());
            out.push(line.to_string());
        }
    }
    let mut joined = out.join(eol);
    joined.push_str(eol);
    joined
}

/// A temp file beside the target, then a rename.
pub(crate) fn write_atomic(file: &Path, text: &str) -> Result<(), String> {
    let name = file
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let temp = file.with_file_name(format!("{name}.loop-tmp"));
    std::fs::write(&temp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&temp, file).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        e.to_string()
    })
}

/// What the summary says about Finalize.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FinalizeNote {
    /// After last: Stop and offer Finalize.
    Offer,
    /// After last: Run Finalize, and it is starting.
    Starting,
    /// After last: Run Finalize, but Stop now came first.
    Skipped,
    /// After last: Run Finalize, and it could not start (why, on one line).
    Failed(String),
}

/// The Finalize note for the setup, a Stop now and a start's error.
pub fn finalize_note(setup: &LoopSetup, stopped: bool, error: Option<&str>) -> FinalizeNote {
    match (setup.after_last, stopped, error) {
        (AfterLast::OfferFinalize, _, _) => FinalizeNote::Offer,
        (AfterLast::RunFinalize, true, _) => FinalizeNote::Skipped,
        (AfterLast::RunFinalize, false, Some(e)) => FinalizeNote::Failed(one_line(e)),
        (AfterLast::RunFinalize, false, None) => FinalizeNote::Starting,
    }
}

/// `LOOP-SUMMARY-<date>.md`: the setup used, each phase, the end state and
/// what became of Finalize.
pub fn summary_markdown(rec: &RunningRecord, date: &str, finalize: &FinalizeNote) -> String {
    let setup = &rec.setup;
    let name = rec.spec.strip_prefix("specs/").unwrap_or(&rec.spec);
    let yes = |on: bool| if on { "on" } else { "off" };
    let mut md = format!(
        "# Loop report: {name}\n\nBuilt by the Implementation Loop, started {} and finished {date}.\n\n",
        rec.report.started
    );
    md.push_str("## Setup of the last run\n\n");
    md.push_str(&format!("- Review: {}\n", yes(setup.review)));
    if setup.review {
        md.push_str(&format!("- Fixes: {}\n", levels_text(setup)));
    }
    md.push_str(&format!("- Commit each phase: {}\n", yes(setup.commit)));
    let on_question = match setup.on_question {
        OnQuestion::Pause => "pause and wait for you",
        OnQuestion::Stop => "stop the loop",
        OnQuestion::Guess => "best guess",
    };
    md.push_str(&format!("- When a phase asks something: {on_question}\n"));
    let check = setup.quick_check.trim();
    md.push_str(&format!(
        "- Quick check: {}\n",
        if check.is_empty() {
            "none".to_string()
        } else {
            format!("`{check}`")
        }
    ));
    md.push_str(&format!(
        "- Retry once after a crash or silence: {}\n",
        yes(setup.retry_once)
    ));
    // Only whether: this file is committed, and an address may hold a token.
    md.push_str(&format!(
        "- Send a notification when it stops: {}\n\n",
        yes(!setup.notify_url.is_empty())
    ));
    md.push_str(&loop_report::body_markdown(&rec.report));
    md.push_str(&format!(
        "\n## End state\n\nPhases built by this loop: {}.\n\n",
        phase_rows(rec).as_array().map_or(0, Vec::len)
    ));
    let command = format!("`/plan2code-4-finalize {}/overview.md`", rec.spec);
    md.push_str(&match finalize {
        FinalizeNote::Starting => format!("Finalize was started in a fresh session: {command}.\n"),
        FinalizeNote::Offer => format!("Next: run Finalize with {command}.\n"),
        FinalizeNote::Skipped => format!(
            "Finalize was not started, as you asked the loop to stop. Next: run Finalize with {command}.\n"
        ),
        FinalizeNote::Failed(why) => format!(
            "Finalize could not start ({why}). Next: run Finalize with {command}.\n"
        ),
    });
    md
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> LoopSetup {
        LoopSetup {
            fix_mode: FixMode::Levels,
            on_question: OnQuestion::Pause,
            ..LoopSetup::default()
        }
    }

    /// Where a message is written from, without a record behind it.
    fn at_phase(spec: &str, n: u32, of: usize) -> Where {
        Where {
            project: "plan2code".into(),
            spec: spec.strip_prefix("specs/").unwrap_or(spec).into(),
            n,
            of,
            name: format!("P{n}"),
            phase_time: Duration::from_secs(6 * 60 + 20),
            run_time: Duration::from_secs(74 * 60),
        }
    }

    #[test]
    fn the_messages_say_what_the_person_needs_to_know() {
        let at = at_phase("specs/lunch", 2, 4);
        assert_eq!(
            question_message(&at, false),
            "Plan2Code loop is waiting on plan2code / lunch: Phase 2 of 4 (P2) has a question for you to answer. Elapsed: phase 6m, run 1h 14m."
        );
        assert_eq!(
            stop_message(&StopCause::Question, &at, "ignored").unwrap(),
            "Plan2Code loop stopped on plan2code / lunch: Phase 2 of 4 (P2) has a question for you to answer. Elapsed: phase 6m, run 1h 14m."
        );
        assert_eq!(
            finished_message(&at, 3),
            "Plan2Code loop complete on plan2code / lunch: all 3 phases built. Elapsed: 1h 14m."
        );
        assert_eq!(
            finished_message(&at, 1),
            "Plan2Code loop complete on plan2code / lunch: 1 phase built. Elapsed: 1h 14m."
        );
        assert_eq!(
            stop_message(&StopCause::QuickCheck, &at, "Phase 2 stopped: tests").unwrap(),
            "Plan2Code loop stopped on plan2code / lunch at Phase 2 of 4 (P2): Phase 2 stopped: tests Elapsed: phase 6m, run 1h 14m."
        );
        assert_eq!(
            stop_message(&StopCause::StoppedByPerson, &at, "x"),
            None,
            "the person is already there"
        );
    }

    #[test]
    fn the_total_is_the_specs_last_phase_not_the_phases_left() {
        let rec = record("specs/x", vec![phase(4), phase(5)]);
        assert_eq!(Where::of(&rec, 0).phase_text(), "Phase 4 of 5 (P4)");
    }

    #[test]
    fn a_phase_message_says_what_was_done_and_what_is_next() {
        let at = at_phase("specs/lunch", 2, 4);
        let done = PhaseDone {
            tasks: Some(5),
            subject: "Add votes".into(),
            commit: Some("abc1234".into()),
            next: Some((3, "Results".into())),
        };
        assert_eq!(
            phase_message(&at, &done),
            "Plan2Code loop on plan2code / lunch: Phase 2 of 4 (P2) is complete. Done: 5 tasks, committed \"Add votes\" (abc1234). Next: Phase 3, Results. Elapsed: phase 6m, run 1h 14m."
        );
        // Commit off, the last phase, one task: nothing invented.
        let last = PhaseDone {
            tasks: Some(1),
            subject: "Add votes".into(),
            commit: None,
            next: None,
        };
        let text = phase_message(&at_phase("specs/lunch", 4, 4), &last);
        assert!(
            text.contains("Done: 1 task, \"Add votes\", not committed."),
            "{text}"
        );
        assert!(text.contains("That was the last phase."), "{text}");
        assert!(!text.contains("Next:"), "{text}");
        let bare = PhaseDone {
            tasks: None,
            subject: String::new(),
            commit: None,
            next: Some((3, String::new())),
        };
        let text = phase_message(&at, &bare);
        assert!(!text.contains("Done:"), "{text}");
        assert!(text.contains("Next: Phase 3."), "{text}");
    }

    #[test]
    fn the_phase_message_is_opt_in_and_changes_what_the_confirm_promises() {
        let mut s = setup();
        assert!(!s.notify_phases, "off by default");
        let older: LoopSetup = serde_json::from_value(json!({ "review": true })).unwrap();
        assert!(!older.notify_phases, "an older entry sends none");
        s.notify_url = "https://e.com/hook".into();
        let off = confirmed_notify(&s);
        let rec = RunningRecord::new("p".into(), "specs/x".into(), s.clone(), vec![phase(1)]);
        assert!(confirm_text(&rec).contains("When the loop needs you or ends"));
        s.notify_phases = true;
        assert_ne!(
            off,
            confirmed_notify(&s),
            "Resume asks again when the box changes"
        );
        let rec = RunningRecord::new("p".into(), "specs/x".into(), s, vec![phase(1)]);
        assert!(confirm_text(&rec)
            .contains("After each phase, when the loop needs you, or when it ends"));
    }

    #[test]
    fn no_web_address_means_no_call_and_an_older_entry_reads_with_none() {
        assert_eq!(notify(&setup(), "x"), None);
        let s: LoopSetup = serde_json::from_value(json!({ "review": true })).unwrap();
        assert_eq!(s.notify_url, "");
        assert_eq!(s.notify_param, "message");
        assert_eq!(confirmed_notify(&s), "");
    }

    #[test]
    fn the_confirm_names_the_web_address_and_a_changed_one_is_told_apart() {
        let mut s = setup();
        let bare = RunningRecord::new("p".into(), "specs/x".into(), s.clone(), vec![phase(1)]);
        assert!(!confirm_text(&bare).contains("calls"));
        s.notify_url = "https://e.com/hook".into();
        let first = confirmed_notify(&s);
        let rec = RunningRecord::new("p".into(), "specs/x".into(), s.clone(), vec![phase(1)]);
        assert!(confirm_text(&rec)
            .contains("the app calls: https://e.com/hook with a message in message."));
        s.notify_param = "msg".into();
        let second = confirmed_notify(&s);
        assert_ne!(second, first);
        s.notify_kind = NotifyKind::Discord;
        assert_ne!(
            confirmed_notify(&s),
            second,
            "a changed kind is asked again"
        );
        let rec = RunningRecord::new("p".into(), "specs/x".into(), s.clone(), vec![phase(1)]);
        assert!(confirm_text(&rec).contains("the app posts to Discord at: https://e.com/hook."));
    }

    #[test]
    fn the_summary_never_holds_the_web_address() {
        let mut rec = record("specs/x", vec![phase(1)]);
        rec.setup.notify_url = "https://e.com/hook?token=secret".into();
        let md = summary_markdown(&rec, "2026-11-01", &FinalizeNote::Offer);
        assert!(md.contains("Send a notification when it stops: on"));
        assert!(!md.contains("secret"));
    }

    #[test]
    fn the_summary_says_what_became_of_finalize() {
        let mut rec = record("specs/x", vec![phase(1)]);
        assert_eq!(
            finalize_note(&rec.setup, true, Some("x")),
            FinalizeNote::Offer
        );
        rec.setup.after_last = AfterLast::RunFinalize;
        let note = |stopped, error| finalize_note(&rec.setup, stopped, error);
        assert_eq!(note(false, None), FinalizeNote::Starting);
        assert_eq!(note(true, None), FinalizeNote::Skipped);
        assert_eq!(
            note(false, Some("no\nagent")),
            FinalizeNote::Failed("no agent".into())
        );
        let md = |n: FinalizeNote| summary_markdown(&rec, "2026-11-01", &n);
        assert!(md(FinalizeNote::Starting).contains("Finalize was started in a fresh session"));
        for n in [
            FinalizeNote::Skipped,
            FinalizeNote::Failed("no agent".into()),
        ] {
            let text = md(n);
            assert!(!text.contains("was started"), "{text}");
            assert!(text
                .contains("Next: run Finalize with `/plan2code-4-finalize specs/x/overview.md`."));
        }
        assert!(md(FinalizeNote::Failed("no agent".into()))
            .contains("Finalize could not start (no agent)."));
    }

    #[test]
    fn a_new_setup_starts_on_smart_pick_and_best_guess() {
        assert_eq!(LoopSetup::default().fix_mode, FixMode::Smart);
        assert_eq!(LoopSetup::default().on_question, OnQuestion::Guess);
    }

    #[test]
    fn the_expect_patch_carries_the_setup() {
        assert_eq!(
            expect_patch(&setup()),
            json!({ "loopExpect": { "review": true, "fix": ["critical", "warning", "suggestion"], "guess": false } })
        );
        let mut smart = setup();
        smart.fix_mode = FixMode::Smart;
        smart.on_question = OnQuestion::Guess;
        assert_eq!(expect_patch(&smart)["loopExpect"]["fix"], json!("smart"));
        assert_eq!(expect_patch(&smart)["loopExpect"]["guess"], json!(true));
        let mut no_review = setup();
        no_review.review = false;
        no_review.fix = vec![FixLevel::Critical];
        assert_eq!(
            expect_patch(&no_review)["loopExpect"],
            json!({ "review": false, "fix": ["critical"], "guess": false })
        );
    }

    #[test]
    fn a_stamp_counts_only_when_whole() {
        assert!(valid_expect(
            &json!({ "review": true, "fix": "smart", "guess": false })
        ));
        assert!(valid_expect(
            &json!({ "review": true, "fix": ["critical"], "guess": true })
        ));
        for bad in [
            json!(5),
            json!({ "review": "yes", "fix": "smart", "guess": false }),
            json!({ "review": true, "guess": false }),
            json!({ "review": true, "fix": ["major"], "guess": false }),
            json!({ "review": true, "fix": "everything", "guess": false }),
        ] {
            assert!(!valid_expect(&bad), "{bad}");
        }
    }

    fn phase(n: u32) -> PhaseRecord {
        PhaseRecord {
            n,
            name: format!("P{n}"),
            status: PhaseStatus::Pending,
            commit: None,
            subject: None,
            retries: 0,
            strength: None,
        }
    }

    fn record(spec: &str, phases: Vec<PhaseRecord>) -> RunningRecord {
        RunningRecord::new(PathBuf::from("."), spec.into(), setup(), phases)
    }

    /// An approval with nothing to warn about.
    fn approved() -> Verdict {
        Verdict::Approve { warnings: vec![] }
    }

    fn status(complete: u64, blocked: u64, open: u64, assumed: u64) -> Value {
        json!({ "tasks": { "total": complete + blocked + open + assumed, "complete": complete, "blocked": blocked, "open": open, "pending": 0, "in-progress": 0, "assumed": assumed } })
    }

    fn passed() -> Outcome {
        Outcome {
            phase: 3,
            result: "passed".into(),
            subject: "Add the driver".into(),
            review: Some(ReviewPart {
                ran: true,
                recheck: true,
                ..ReviewPart::default()
            }),
            ..Outcome::default()
        }
    }

    fn finding(level: FixLevel) -> Finding {
        Finding {
            level,
            title: "t".into(),
            file: "f".into(),
            reason: None,
        }
    }

    fn refused(v: Verdict) -> String {
        match v {
            Verdict::Refuse(why) => why,
            Verdict::Approve { .. } => panic!("expected a refusal"),
        }
    }

    #[test]
    fn the_prompt_follows_review_fix_and_guess() {
        let mut s = setup();
        assert_eq!(
            phase_prompt("specs/x", 1, &s),
            "/plan2code-3-implement-review specs/x/overview.md --web --loop --phase 1 --fix critical,warning,suggestion"
        );
        s.fix = vec![FixLevel::Warning];
        s.on_question = OnQuestion::Guess;
        assert_eq!(
            phase_prompt("specs/x", 3, &s),
            "/plan2code-3-implement-review specs/x/overview.md --web --loop --phase 3 --fix warning --guess"
        );
        s.fix_mode = FixMode::Smart;
        assert!(phase_prompt("specs/x", 1, &s).contains(" --fix smart --guess"));
        s.fix.clear();
        s.fix_mode = FixMode::Levels;
        s.on_question = OnQuestion::Pause;
        assert!(!phase_prompt("specs/x", 1, &s).contains("--fix"));
        s.review = false;
        s.fix = vec![FixLevel::Critical];
        assert_eq!(
            phase_prompt("specs/x", 2, &s),
            "/plan2code-3-implement specs/x/overview.md --web --loop --phase 2"
        );
    }

    #[test]
    fn a_clean_report_that_the_spec_agrees_with_is_approved() {
        assert_eq!(
            judge_outcome(&passed(), &status(14, 0, 0, 0), &setup()),
            approved()
        );
    }

    #[test]
    fn a_failed_report_is_refused_with_its_reason() {
        let mut o = passed();
        o.result = "failed".into();
        o.reason = Some("tests".into());
        o.summary = "Opus misses the 40% target".into();
        assert_eq!(
            refused(judge_outcome(&o, &status(14, 0, 0, 0), &setup())),
            "Opus misses the 40% target",
            "the person is told what the agent found, not a contract word"
        );
        o.summary = "  ".into();
        assert_eq!(
            refused(judge_outcome(&o, &status(14, 0, 0, 0), &setup())),
            "its tests failed"
        );
        o.reason = None;
        assert_eq!(
            refused(judge_outcome(&o, &status(14, 0, 0, 0), &setup())),
            "it reported a failure"
        );
    }

    #[test]
    fn marks_that_disagree_with_the_report_are_refused() {
        assert!(
            refused(judge_outcome(&passed(), &status(12, 1, 0, 0), &setup()))
                .starts_with("the spec disagrees")
        );
        assert!(
            refused(judge_outcome(&passed(), &status(12, 0, 2, 0), &setup()))
                .starts_with("the spec disagrees")
        );
    }

    #[test]
    fn assumed_tasks_need_best_guess() {
        let st = status(14, 0, 0, 1);
        assert_eq!(
            refused(judge_outcome(&passed(), &st, &setup())),
            "assumed tasks without best guess"
        );
        let mut s = setup();
        s.on_question = OnQuestion::Guess;
        assert_eq!(judge_outcome(&passed(), &st, &s), approved());
    }

    #[test]
    fn review_and_recheck_must_have_run() {
        let st = status(14, 0, 0, 0);
        let mut o = passed();
        o.review = None;
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "review did not run"
        );
        o.review = Some(ReviewPart {
            ran: true,
            recheck: false,
            ..ReviewPart::default()
        });
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "the re-check did not run"
        );
        let mut s = setup();
        s.fix.clear();
        assert_eq!(judge_outcome(&o, &st, &s), approved());
        s.review = false;
        o.review = None;
        assert_eq!(judge_outcome(&o, &st, &s), approved());
    }

    #[test]
    fn critical_and_warning_left_at_a_chosen_level_refuse_but_suggestions_never_do() {
        let st = status(14, 0, 0, 0);
        let mut o = passed();
        o.review.as_mut().unwrap().left = Left {
            critical: 1,
            warning: 2,
            suggestion: 5,
        };
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "1 Critical / 2 Warning left after the re-check"
        );
        let mut s = setup();
        s.fix = vec![FixLevel::Critical];
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "1 Critical left after the re-check"
        );
        o.review.as_mut().unwrap().left = Left {
            critical: 0,
            warning: 0,
            suggestion: 5,
        };
        assert_eq!(
            judge_outcome(&o, &st, &setup()),
            Verdict::Approve {
                warnings: vec!["5 Suggestions left unfixed".into()]
            },
            "leftover Suggestions approve, with a warning"
        );
    }

    #[test]
    fn smart_pick_needs_the_triage_and_refuses_a_skipped_critical() {
        let st = status(14, 0, 0, 0);
        let mut s = setup();
        s.fix_mode = FixMode::Smart;
        s.fix.clear();
        let mut o = passed();
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "the triage did not run"
        );
        o.review.as_mut().unwrap().triage = Some(Triage {
            ran: false,
            skipped: vec![],
        });
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "the triage did not run"
        );
        o.review.as_mut().unwrap().triage = Some(Triage {
            ran: true,
            skipped: vec![finding(FixLevel::Warning), finding(FixLevel::Suggestion)],
        });
        assert_eq!(judge_outcome(&o, &st, &s), approved());
        o.review
            .as_mut()
            .unwrap()
            .triage
            .as_mut()
            .unwrap()
            .skipped
            .push(finding(FixLevel::Critical));
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "1 Critical skipped by the triage"
        );
        // Smart pick counts every level as chosen for what is left.
        o.review
            .as_mut()
            .unwrap()
            .triage
            .as_mut()
            .unwrap()
            .skipped
            .clear();
        o.review.as_mut().unwrap().left.warning = 1;
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "1 Warning left after the re-check"
        );
    }

    #[test]
    fn an_unticked_level_never_stops_the_loop_by_level() {
        let st = status(14, 0, 0, 0);
        let mut s = setup();
        s.fix = vec![FixLevel::Critical];
        let mut o = passed();
        o.review.as_mut().unwrap().left = Left {
            critical: 0,
            warning: 3,
            suggestion: 9,
        };
        assert_eq!(
            judge_outcome(&o, &st, &s),
            Verdict::Approve {
                warnings: vec!["9 Suggestions left unfixed".into()]
            }
        );
        // Smart pick counts every level as chosen, so the same leftover stops it.
        s.fix_mode = FixMode::Smart;
        o.review.as_mut().unwrap().triage = Some(Triage {
            ran: true,
            skipped: vec![],
        });
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "3 Warning left after the re-check"
        );
        o.review.as_mut().unwrap().left = Left {
            critical: 1,
            warning: 0,
            suggestion: 0,
        };
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "1 Critical left after the re-check"
        );
        o.review.as_mut().unwrap().left = Left::default();
        o.review.as_mut().unwrap().recheck = false;
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "the re-check did not run"
        );
    }

    #[test]
    fn missing_or_empty_status_data_never_reads_as_success() {
        let setup = setup();
        let why = |status: Value| refused(judge_outcome(&passed(), &status, &setup));
        assert_eq!(
            why(Value::Null),
            "the spec has no status for Phase 3",
            "a phase the spec does not show"
        );
        assert_eq!(why(json!({})), "the spec shows no task counts for Phase 3");
        assert_eq!(
            why(json!({ "tasks": { "complete": 14, "open": 0 } })),
            "the spec shows no task total for Phase 3"
        );
        assert_eq!(
            why(json!({ "tasks": { "total": 0, "complete": 0, "open": 0 } })),
            "the spec shows no tasks in Phase 3"
        );
        assert_eq!(
            why(json!({ "tasks": { "total": 14, "complete": 13, "open": 0 } })),
            "the spec shows 13 of 14 tasks done",
            "a count that does not add up, even with nothing open or blocked"
        );
    }

    #[test]
    fn a_report_whose_tests_ran_and_failed_is_refused() {
        let st = status(14, 0, 0, 0);
        let mut o = passed();
        o.tests = Some(TestsPart {
            ran: true,
            passed: false,
            summary: "3 failed
second line"
                .into(),
            ..Default::default()
        });
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "its tests ran and failed: 3 failed second line"
        );
        o.tests.as_mut().unwrap().summary.clear();
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "its tests ran and failed"
        );
        o.tests = Some(TestsPart {
            ran: false,
            passed: false,
            summary: String::new(),
            ..Default::default()
        });
        assert_eq!(judge_outcome(&o, &st, &setup()), approved());
        o.tests = None;
        assert_eq!(judge_outcome(&o, &st, &setup()), approved());
    }

    #[test]
    fn failing_tests_the_notes_expect_pass_with_a_warning_and_others_are_refused() {
        let st = status(14, 0, 0, 0);
        let mut o = passed();
        o.tests = Some(TestsPart {
            ran: true,
            passed: false,
            summary: "3 failed".into(),
            failing: vec!["a".into(), "b".into()],
            expected_failures: vec!["a".into(), "b".into()],
        });
        match judge_outcome(&o, &st, &setup()) {
            Verdict::Approve { warnings } => assert!(warnings
                .iter()
                .any(|w| w.contains("2 test(s) failed as the phase's Notes expect: a, b"))),
            other => panic!("expected approval, got {other:?}"),
        }
        o.tests.as_mut().unwrap().expected_failures = vec!["a".into()];
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "its tests ran and failed: 3 failed"
        );
        let t = o.tests.as_mut().unwrap();
        t.failing.clear();
        t.expected_failures = vec!["a".into()];
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "its tests ran and failed: 3 failed",
            "a bare expectation with no named failure never passes"
        );
    }

    #[test]
    fn blocked_tasks_and_conflicts_in_the_report_alone_do_not_refuse() {
        let mut o = passed();
        o.tasks.blocked = vec!["3.2".into()];
        o.conflicts = vec!["the spec and the code disagree".into()];
        assert_eq!(
            judge_outcome(&o, &status(14, 0, 0, 0), &setup()),
            approved(),
            "only the spec's own marks decide"
        );
    }

    #[test]
    fn the_larger_of_the_counter_and_the_unfixed_list_decides_each_level() {
        let st = status(14, 0, 0, 0);
        // The counter says none, the list holds one Critical.
        let mut o = passed();
        o.review.as_mut().unwrap().unfixed = vec![finding(FixLevel::Critical)];
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "1 Critical left after the re-check"
        );
        // The counter says one, the list is empty.
        let mut o = passed();
        o.review.as_mut().unwrap().left.critical = 1;
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "1 Critical left after the re-check"
        );
        // A leftover Warning refuses, from either source.
        let mut o = passed();
        o.review.as_mut().unwrap().unfixed = vec![finding(FixLevel::Warning); 2];
        assert_eq!(
            refused(judge_outcome(&o, &st, &setup())),
            "2 Warning left after the re-check"
        );
        // A leftover Suggestion approves with a warning, singular for one.
        let mut o = passed();
        o.review.as_mut().unwrap().unfixed = vec![finding(FixLevel::Suggestion)];
        assert_eq!(
            judge_outcome(&o, &st, &setup()),
            Verdict::Approve {
                warnings: vec!["1 Suggestion left unfixed".into()]
            }
        );
        // Levels mode: an unfixed finding of a chosen level refuses, of an
        // unchosen level does not.
        let mut s = setup();
        s.fix = vec![FixLevel::Warning];
        let mut o = passed();
        o.review.as_mut().unwrap().unfixed = vec![finding(FixLevel::Warning)];
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "1 Warning left after the re-check"
        );
        o.review.as_mut().unwrap().unfixed = vec![finding(FixLevel::Critical)];
        assert_eq!(judge_outcome(&o, &st, &s), approved());
        // Smart pick: every level counts as chosen.
        let mut s = setup();
        s.fix_mode = FixMode::Smart;
        s.fix.clear();
        let mut o = passed();
        o.review.as_mut().unwrap().triage = Some(Triage {
            ran: true,
            skipped: vec![],
        });
        o.review.as_mut().unwrap().unfixed = vec![finding(FixLevel::Warning)];
        assert_eq!(
            refused(judge_outcome(&o, &st, &s)),
            "1 Warning left after the re-check"
        );
        // All zero and an empty list still approve with nothing to say.
        let o = passed();
        assert_eq!(judge_outcome(&o, &st, &setup()), approved());
    }

    #[test]
    fn the_prompt_orders_levels_fixed_and_drops_fix_without_review() {
        let mut s = setup();
        s.fix = vec![FixLevel::Suggestion, FixLevel::Critical];
        assert!(phase_prompt("specs/x", 1, &s).ends_with(" --fix critical,suggestion"));
        s.fix_mode = FixMode::Smart;
        assert!(phase_prompt("specs/x", 1, &s).ends_with("--web --loop --phase 1 --fix smart"));
        assert!(!phase_prompt("specs/x", 1, &s).contains("critical"));
        s.review = false;
        assert_eq!(
            phase_prompt("specs/x", 1, &s),
            "/plan2code-3-implement specs/x/overview.md --web --loop --phase 1"
        );
        s.fix_mode = FixMode::Levels;
        s.on_question = OnQuestion::Guess;
        assert_eq!(
            phase_prompt("specs/x", 1, &s),
            "/plan2code-3-implement specs/x/overview.md --web --loop --phase 1 --guess"
        );
    }

    #[test]
    fn done_is_the_checklist_state_so_capital_x_and_assumed_phases_count() {
        for state in ["complete", "assumed"] {
            assert!(checklist_done(
                &json!({ "marker": "X", "checklist": state })
            ));
        }
        for state in ["pending", "in-progress", "blocked", "unknown"] {
            assert!(!checklist_done(
                &json!({ "marker": "x", "checklist": state })
            ));
        }
        assert!(!checklist_done(&json!({ "marker": "x" })));
    }

    #[test]
    fn an_unknown_result_is_not_approved() {
        let mut o = passed();
        o.result = String::new();
        assert!(refused(judge_outcome(&o, &status(14, 0, 0, 0), &setup()))
            .starts_with("the report said"));
    }

    #[test]
    fn the_first_phase_page_wins_and_other_workflows_are_ignored() {
        let rec = record("specs/x", vec![]);
        let slot: LoopSlot = Arc::new(Mutex::new(Some(rec)));
        let locked = json!({ "loop": { "driving": true } });
        note_page(&slot, "dashboard", "s0", &locked);
        assert!(lock(&slot).as_ref().unwrap().sid.is_none());
        note_page(&slot, "implement-review", "s1", &locked);
        note_page(&slot, "implement", "s2", &locked);
        let guard = lock(&slot);
        assert_eq!(guard.as_ref().unwrap().sid.as_deref(), Some("s1"));
        assert_eq!(guard.as_ref().unwrap().last_sid.as_deref(), Some("s1"));
    }

    #[test]
    fn a_page_without_the_loops_lock_or_with_a_stale_report_is_never_the_phases() {
        let rec = record("specs/x", vec![]);
        let slot: LoopSlot = Arc::new(Mutex::new(Some(rec)));
        // A plain open (no lock yet): held as a candidate, not followed.
        note_page(
            &slot,
            "implement-review",
            "plain",
            &json!({ "workflow": "implement-review" }),
        );
        assert!(lock(&slot).as_ref().unwrap().sid.is_none());
        assert_eq!(
            lock(&slot).as_ref().unwrap().page_candidate.as_deref(),
            Some("plain")
        );
        // A locked page that already holds a report belongs to an older run.
        let stale = json!({ "loop": { "driving": true }, "loopOutcome": { "phase": 1 } });
        note_page(&slot, "implement", "stale", &stale);
        assert!(lock(&slot).as_ref().unwrap().sid.is_none());
        assert_eq!(
            lock(&slot).as_ref().unwrap().page_candidate.as_deref(),
            Some("plain"),
            "a stale page is not even a candidate"
        );
        // An unreadable page (no state) is no session either.
        note_page(&slot, "implement", "gone", &Value::Null);
        assert!(lock(&slot).as_ref().unwrap().sid.is_none());
        assert_eq!(
            lock(&slot).as_ref().unwrap().page_candidate.as_deref(),
            Some("plain"),
            "an unreadable page does not replace the candidate"
        );
        // The locked page with no report is the phase's session.
        note_page(
            &slot,
            "implement",
            "s1",
            &json!({ "loop": { "driving": true } }),
        );
        let guard = lock(&slot);
        let rec = guard.as_ref().unwrap();
        assert_eq!(rec.sid.as_deref(), Some("s1"));
        assert_eq!(rec.page_candidate, None);
        assert!(page_is_this_phase(
            &json!({ "loop": { "driving": true }, "loopOutcome": null })
        ));
        assert!(!page_is_this_phase(
            &json!({ "loop": { "driving": false } })
        ));
    }

    #[test]
    fn the_first_open_question_is_named_by_its_title_or_its_body() {
        let state = json!({ "items": [
            { "id": "a", "kind": "notice", "status": "open", "title": "Just so you know" },
            { "id": "b", "kind": "choice", "status": "answered", "title": "Old one" },
            { "id": "c", "kind": "multi", "status": "open", "title": "Which to fix", "handledBy": "loop" },
            { "id": "d", "kind": "text", "status": "open", "required": false, "title": "Optional" },
            { "id": "e", "kind": "choice", "status": "open", "title": "  Which database  " },
        ] });
        assert_eq!(
            first_open_question(&state).as_deref(),
            Some("Which database")
        );
        let untitled = json!({ "items": [{ "id": "f", "kind": "text", "status": "reopened", "body": "Where do\nthe files go?" }] });
        assert_eq!(
            first_open_question(&untitled).as_deref(),
            Some("Where do the files go?")
        );
        assert_eq!(first_open_question(&json!({ "items": [] })), None);
        assert_eq!(
            stop_line(&StopCause::Question, 2, "Which database", false),
            "Phase 2 stopped: it asked a question, \"Which database\""
        );
        assert_eq!(
            stop_line(&StopCause::Question, 2, "", false),
            "Phase 2 stopped: it asked a question"
        );
    }

    #[test]
    fn the_headline_stage_picks_the_step() {
        assert_eq!(step_for_stage("Phase 3: Review"), Step::Review);
        assert_eq!(step_for_stage("Fixes"), Step::Fixes);
        assert_eq!(step_for_stage("Re-check"), Step::Recheck);
        assert_eq!(step_for_stage("Phase 3: Driver core"), Step::Build);
        assert_eq!(Step::Recheck.label(), "Re-check");
        assert_eq!(Step::WaitingOnYou.label(), "Waiting on you");
    }

    #[test]
    fn the_setup_file_entry_reads_with_kebab_values_and_a_missing_fix_mode() {
        let entry = json!({
            "review": true, "fix": ["critical", "warning"], "commit": false,
            "onQuestion": "guess", "afterLast": "run-finalize",
            "quickCheck": "npm run build", "retryOnce": false, "silenceMinutes": 30,
            "saved": "2026-11-01T00:00:00Z"
        });
        let s: LoopSetup = serde_json::from_value(entry).unwrap();
        assert_eq!(s.fix_mode, FixMode::Levels);
        assert_eq!(s.fix, vec![FixLevel::Critical, FixLevel::Warning]);
        assert_eq!(s.on_question, OnQuestion::Guess);
        assert_eq!(s.after_last, AfterLast::RunFinalize);
        assert_eq!(s.silence_minutes, 30);
    }

    #[test]
    fn an_older_entry_reads_without_phase_strengths() {
        let s: LoopSetup =
            serde_json::from_value(json!({ "review": true, "commit": false })).unwrap();
        assert!(!s.phase_strength);
        assert!(s.strengths.is_empty());
    }

    #[test]
    fn a_full_entry_with_phase_strengths_round_trips() {
        let entry = json!({
            "phaseStrength": true,
            "strengths": { "specs/lunch": [
                { "n": 2, "name": "The API", "strength": "thrifty" },
                { "n": 3, "name": "The page", "strength": "best" }
            ] }
        });
        let s: LoopSetup = serde_json::from_value(entry.clone()).unwrap();
        assert!(s.phase_strength);
        let picks = &s.strengths["specs/lunch"];
        assert_eq!(picks.len(), 2);
        assert_eq!(picks[0].strength, Strength::Thrifty);
        assert_eq!(
            picks[1],
            PhasePick {
                n: 3,
                name: "The page".to_string(),
                strength: Strength::Best
            }
        );
        let back = serde_json::to_value(&s).unwrap();
        assert_eq!(back["phaseStrength"], true);
        assert_eq!(back["strengths"], entry["strengths"]);
        let again: LoopSetup = serde_json::from_value(back).unwrap();
        assert_eq!(again, s);
    }

    #[test]
    fn the_setup_is_found_under_the_consoles_folded_key() {
        let dir = std::env::temp_dir().join(format!("plan2code-loop-setup-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let project = dir.join("My Project");
        let file = dir.join("loop-setup.json");
        let store = json!({ "schema": 1, "projects": { fold_key(&project): { "quickCheck": "make", "commit": true } } });
        std::fs::write(&file, store.to_string()).unwrap();
        assert_eq!(
            read_setup_from(&file, &project).unwrap().quick_check,
            "make"
        );
        let other = read_setup_from(&file, &dir.join("elsewhere")).unwrap_err();
        assert_eq!(other, "No loop setup saved for this project");
        std::fs::write(&file, r#"{"schema":2,"projects":{}}"#).unwrap();
        assert!(read_setup_from(&file, &project).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn the_key_is_lowercase_with_backslashes_and_no_trailing_separator() {
        assert_eq!(
            fold_key(Path::new("C:/Git/Plan2Code/")),
            r"c:\git\plan2code"
        );
        assert_eq!(fold_key(Path::new(r"\\?\C:\Git\X")), r"c:\git\x");
    }

    #[test]
    fn the_approval_line_names_the_check_and_the_review() {
        let mut s = setup();
        s.quick_check = "npm run build".into();
        assert_eq!(
            approval_line("2026-11-01", &s),
            "Approved by the Implementation Loop on 2026-11-01: tests passed, quick check passed (npm run build), review at critical, warning, suggestion."
        );
        s.quick_check.clear();
        s.review = false;
        assert!(
            approval_line("2026-11-01", &s).ends_with("tests passed, no quick check, review off.")
        );
        s.review = true;
        s.fix_mode = FixMode::Smart;
        assert!(approval_line("2026-11-01", &s).ends_with("review at smart pick."));
    }

    #[test]
    fn the_approval_line_goes_first_under_the_heading_and_the_rest_stays() {
        let text = "# Phase 3\n\n## Phase Completion Summary\n\n_Filled in after implementation._\n\n## Notes\n\nx\n";
        let out = with_approval_line(text, "Approved.");
        assert_eq!(
            out,
            "# Phase 3\n\n## Phase Completion Summary\n\nApproved.\n\n_Filled in after implementation._\n\n## Notes\n\nx\n"
        );
        // A heading with nothing after it; CRLF in, CRLF out.
        assert_eq!(
            with_approval_line("a\r\n## Phase Completion Summary\r\n", "Approved."),
            "a\r\n## Phase Completion Summary\r\n\r\nApproved.\r\n"
        );
    }

    #[test]
    fn a_file_without_the_heading_gets_it_at_the_end() {
        assert_eq!(
            with_approval_line("# Phase 3\n\nbody\n", "Approved."),
            "# Phase 3\n\nbody\n\n## Phase Completion Summary\n\nApproved.\n"
        );
    }

    #[test]
    fn only_a_spec_folder_directly_under_specs_is_valid() {
        let dir = std::env::temp_dir().join(format!("plan2code-loop-spec-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("specs").join("lunch-vote")).unwrap();
        std::fs::write(dir.join("specs").join("a-file"), "x").unwrap();
        assert!(validate_spec(&dir, "specs/lunch-vote").is_ok());
        for bad in [
            "specs/missing",
            "specs/a-file",
            "specs/../x",
            "specs/a/b",
            "lunch-vote",
            "specs/",
            "specs/a b",
        ] {
            assert!(validate_spec(&dir, bad).is_err(), "{bad}");
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_confirm_names_the_phase_count_and_the_quick_check() {
        let mut rec = record(
            "specs/lunch-vote",
            vec![phase(3), phase(4), phase(5), phase(6)],
        );
        assert_eq!(
            confirm_text(&rec),
            "Build 4 phases of lunch-vote? No quick check is set."
        );
        rec.setup.quick_check = "npm run build".into();
        assert_eq!(
            confirm_text(&rec),
            "Build 4 phases of lunch-vote? After each phase the app runs: npm run build"
        );
    }

    #[test]
    fn the_summary_lists_every_phase_its_commit_and_the_unfixed_findings() {
        let mut done = phase(3);
        done.name = "Driver | core".into();
        done.status = PhaseStatus::Done;
        done.commit = Some("a1b2c3d".into());
        done.subject = Some("Add the driver".into());
        let mut rec = record("specs/x", vec![done]);
        rec.report.entries.push(ReportEntry {
            at: "2026-11-01 10:00".into(),
            phase: 3,
            name: "Driver | core".into(),
            commit: Some("a1b2c3d".into()),
            subject: "Add the driver".into(),
            reported: true,
            review_ran: true,
            skipped: vec![Finding {
                level: FixLevel::Warning,
                title: "Rename".into(),
                file: "src/y.js".into(),
                reason: Some("Outside this phase".into()),
            }],
            ..ReportEntry::default()
        });
        rec.step = Step::Commit;
        let md = summary_markdown(&rec, "2026-11-01", &FinalizeNote::Offer);
        assert!(md.contains(
            "| Phase 3: Driver \\| core | a1b2c3d | Add the driver | 0 | 1 | 0 | 0 | 0 | 0 |"
        ));
        assert!(md.contains("- warning: Rename (`src/y.js`): Outside this phase"));
        assert!(md.contains("Next: run Finalize with `/plan2code-4-finalize specs/x/overview.md`."));
        assert!(!md.contains('\u{2014}'));
    }

    // ----------------------------------------------- failures, stops, the strip

    fn at(minutes: u64) -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(minutes * 60)
    }

    #[test]
    fn silence_waits_past_the_limit_and_never_while_a_question_waits() {
        let s = setup(); // 20 minutes
        assert!(!silence_expired(at(120), at(100), &s, None, false));
        assert!(silence_expired(at(121), at(100), &s, None, false));
        // A waiting question has no time limit.
        assert!(!silence_expired(at(1000), at(0), &s, None, true));
        // The skill's own quiet minutes stretch the limit, never shrink it.
        assert!(!silence_expired(at(140), at(100), &s, Some(45), false));
        assert!(silence_expired(at(146), at(100), &s, Some(45), false));
        assert!(silence_expired(at(121), at(100), &s, Some(5), false));
        // Capped at 60 minutes whatever either side asks for.
        assert!(silence_expired(at(161), at(100), &s, Some(500), false));
        let mut long = setup();
        long.silence_minutes = 60;
        assert!(!silence_expired(at(160), at(100), &long, Some(90), false));
        assert!(silence_expired(at(161), at(100), &long, Some(90), false));
        // A clock that went backwards is not silence.
        assert!(!silence_expired(at(100), at(200), &s, None, false));
    }

    #[test]
    fn only_a_crash_silence_or_a_missing_console_retries_and_only_once() {
        let s = setup();
        for cause in [StopCause::Crash, StopCause::Silence, StopCause::NoSession] {
            assert!(should_retry(&cause, &s, 0), "{cause:?}");
            assert!(!should_retry(&cause, &s, 1), "{cause:?} twice");
        }
        for cause in [
            StopCause::Refused("x".into()),
            StopCause::QuickCheck,
            StopCause::Commit,
            StopCause::Question,
            StopCause::StoppedByPerson,
        ] {
            assert!(!should_retry(&cause, &s, 0), "{cause:?}");
        }
        let mut off = setup();
        off.retry_once = false;
        assert!(!should_retry(&StopCause::Crash, &off, 0));
        assert!(!should_retry(&StopCause::Silence, &off, 0));
    }

    #[test]
    fn a_question_is_an_open_required_item_the_loop_does_not_handle() {
        let item = |status: &str, extra: Value| {
            let mut v = json!({ "id": "q1", "kind": "choice", "status": status });
            if let (Some(o), Some(e)) = (v.as_object_mut(), extra.as_object()) {
                for (k, val) in e {
                    o.insert(k.clone(), val.clone());
                }
            }
            json!({ "items": [v] })
        };
        assert!(open_question(&item("open", json!({}))));
        assert!(open_question(&item(
            "reopened",
            json!({ "required": true })
        )));
        assert!(!open_question(&item("answered", json!({}))));
        assert!(!open_question(&item("skipped", json!({}))));
        assert!(!open_question(&item("open", json!({ "required": false }))));
        assert!(!open_question(&item("open", json!({ "kind": "notice" }))));
        assert!(!open_question(&item(
            "open",
            json!({ "handledBy": "loop" })
        )));
        assert!(open_question(&item("open", json!({ "handledBy": null }))));
        assert!(!open_question(&json!({})));
        assert!(!open_question(&json!({ "items": [] })));
    }

    #[test]
    fn each_stop_has_its_line() {
        assert_eq!(
            stop_line(&StopCause::Crash, 3, "exit code 1", false),
            "Phase 3 stopped: the agent crashed (exit code 1)"
        );
        assert_eq!(
            stop_line(&StopCause::Crash, 3, "exit code 1", true),
            "Phase 3 stopped: the agent crashed (exit code 1) after one retry"
        );
        assert_eq!(
            stop_line(&StopCause::Silence, 2, "20", true),
            "Phase 2 stopped: the agent went silent for 20 minutes after one retry"
        );
        assert_eq!(
            stop_line(&StopCause::NoSession, 2, "", false),
            "Phase 2 stopped: the agent never opened the console"
        );
        assert_eq!(
            stop_line(&StopCause::Question, 4, "", false),
            "Phase 4 stopped: it asked a question"
        );
        assert_eq!(
            stop_line(&StopCause::QuickCheck, 4, "", false),
            "Phase 4 stopped: the quick check failed"
        );
        assert_eq!(
            stop_line(&StopCause::Commit, 4, "lint says no", false),
            "Phase 4 was not committed: lint says no. The work is uncommitted; Resume tries the commit again"
        );
        assert_eq!(
            stop_line(
                &StopCause::MarkedNotCommitted("phase-4.md".into()),
                4,
                "",
                false
            ),
            "Phase 4 is marked done in phase-4.md but its work is not committed"
        );
        assert_eq!(
            stop_line(
                &StopCause::Refused("1 Warning left after the re-check".into()),
                2,
                "",
                false
            ),
            "Phase 2 stopped: 1 Warning left after the re-check"
        );
        assert_eq!(
            stop_line(&StopCause::StoppedByPerson, 5, "", false),
            "Stopped during Phase 5. This phase's changes stay uncommitted."
        );
    }

    #[test]
    fn the_evidence_for_a_refusal_lists_the_report_and_the_blocked_tasks() {
        let mut rec = record("specs/x", vec![phase(2)]);
        let mut outcome = passed();
        outcome.summary = "Built the screen".into();
        outcome.tests = Some(TestsPart {
            ran: true,
            passed: false,
            summary: "2 failed".into(),
            ..Default::default()
        });
        let review = outcome.review.as_mut().unwrap();
        review.left = Left {
            critical: 0,
            warning: 1,
            suggestion: 2,
        };
        review.unfixed.push(Finding {
            level: FixLevel::Warning,
            title: "Name the timer".into(),
            file: "src/x.js".into(),
            reason: None,
        });
        rec.last_outcome = Some(outcome);
        rec.last_entry = Some(json!({
            "blockedTasks": ["2.3", { "id": "2.4" }],
            "assumedTasks": []
        }));
        let cause = StopCause::Refused("1 Warning left after the re-check".into());
        let md = evidence_markdown(
            &cause,
            "Phase 2 stopped: 1 Warning left after the re-check",
            &rec,
        );
        assert!(md.starts_with("## What happened"));
        assert!(md.contains("- Summary: Built the screen"));
        assert!(md.contains("- Tests: 2 failed"));
        assert!(md.contains("0 Critical, 1 Warning, 2 Suggestion"));
        assert!(md.contains("- Blocked tasks: 2.3, 2.4"));
        assert!(md.contains("- Assumed tasks: none"));
        assert!(md.contains("warning: Name the timer (src/x.js)"));
    }

    #[test]
    fn the_evidence_of_an_approved_phase_that_stopped_later_shows_the_suggestion_warning() {
        let mut rec = record("specs/x", vec![phase(2)]);
        let mut outcome = passed();
        outcome
            .review
            .as_mut()
            .unwrap()
            .unfixed
            .push(finding(FixLevel::Suggestion));
        rec.last_outcome = Some(outcome);
        let md = evidence_markdown(&StopCause::QuickCheck, "l", &rec);
        assert!(md.contains("- Warnings: 1 Suggestion left unfixed"), "{md}");
        rec.last_outcome = Some(passed());
        let md = evidence_markdown(&StopCause::QuickCheck, "l", &rec);
        assert!(!md.contains("Warnings"), "{md}");
    }

    #[test]
    fn the_evidence_keeps_a_failed_checks_command_and_the_tail_of_its_output() {
        let mut rec = record("specs/x", vec![phase(2)]);
        rec.setup.quick_check = "npm run build".into();
        rec.failure_output = Some(format!("{}\nerror TS2304: nope", "x".repeat(60_000)));
        let md = evidence_markdown(&StopCause::QuickCheck, "line", &rec);
        assert!(md.contains("Command: `npm run build`"));
        assert!(md.contains("error TS2304: nope"));
        assert!(md.contains("(earlier output left out)"));
        assert!(md.len() < EVIDENCE_LIMIT);
        // A refused commit keeps the hook's words.
        rec.failure_output = Some("pre-commit hook failed".into());
        let md = evidence_markdown(&StopCause::Commit, "line", &rec);
        assert!(md.contains("pre-commit hook failed"));
        assert!(md.contains("not committed"));
        // Output that holds a code fence cannot close ours early.
        rec.failure_output = Some("a ``` b".into());
        let md = evidence_markdown(&StopCause::Commit, "line", &rec);
        assert!(md.contains("a ''' b"));
    }

    #[test]
    fn a_crash_and_silence_name_nothing_the_agent_did_not_leave() {
        let rec = record("specs/x", vec![phase(2)]);
        let md = evidence_markdown(
            &StopCause::Crash,
            "Phase 2 stopped: the agent crashed (x)",
            &rec,
        );
        assert!(md.contains("terminal"));
        assert!(!md.contains("What the phase reported"));
        let md = evidence_markdown(&StopCause::Silence, "l", &rec);
        assert!(md.contains("Nothing changed"));
        assert!(!md.contains('\u{2014}'));
    }

    #[test]
    fn the_tail_cuts_on_a_character_boundary() {
        let text = "ab\u{e9}\u{e9}\u{e9}cd";
        let cut = tail(text, 5);
        assert!(cut.ends_with("cd"));
        assert_eq!(tail("short", 100), "short");
    }

    #[test]
    fn the_strip_shows_the_spec_phase_and_step() {
        let mut rec = record("specs/lunch-vote", vec![phase(4), phase(5), phase(7)]);
        rec.current = 1;
        rec.step = Step::Review;
        rec.retries_used = 1;
        rec.stop_after_phase = true;
        let event = state_event(&rec);
        assert!(event.running);
        assert_eq!(event.spec_name, "lunch-vote");
        assert_eq!(event.phase, 5);
        assert_eq!(event.phases, 7);
        assert_eq!(event.step, "Review");
        assert_eq!(event.phase_name, "P5");
        assert_eq!(event.previous_phase, None, "Phase 4 is not done");
        assert!(!event.phase_retried);
        assert_eq!(event.retries_used, 1);
        assert!(event.stop_after_phase);
        assert!(event.started_at_ms > 0);
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["specName"], "lunch-vote");
        assert_eq!(json["stopAfterPhase"], true);
        assert!(json["startedAtMs"].is_u64());
        let ended = LoopStateEvent::ended();
        assert!(!ended.running);
    }

    #[test]
    fn the_banner_hears_what_just_finished_and_whether_this_is_a_retry() {
        let mut rec = record("specs/x", vec![phase(1), phase(2)]);
        assert_eq!(state_event(&rec).previous_phase, None);
        rec.phases[0].status = PhaseStatus::Done;
        rec.phases[0].commit = Some("abc1234".into());
        rec.current = 1;
        let event = state_event(&rec);
        assert_eq!(event.previous_phase, Some(1));
        assert!(event.previous_committed);
        rec.phases[0].commit = None;
        assert!(!state_event(&rec).previous_committed);
        rec.phases[1].retries = 1;
        assert!(state_event(&rec).phase_retried);
        let json = serde_json::to_value(state_event(&rec)).unwrap();
        assert_eq!(json["phaseName"], "P2");
        assert_eq!(json["previousPhase"], 1);
        assert_eq!(json["phaseRetried"], true);
    }

    /// A local web address that hands over the first line of each call it gets.
    fn listening_address() -> (String, std::sync::mpsc::Receiver<String>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = std::sync::mpsc::channel();
        thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { return };
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let text = String::from_utf8_lossy(&buf[..n]).to_string();
                let _ = stream.write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                );
                let first = text.lines().next().unwrap_or("").to_string();
                if tx.send(first).is_err() {
                    return;
                }
            }
        });
        (format!("http://127.0.0.1:{port}/hook"), rx)
    }

    /// A running loop on a temp project, with no session, so nothing reaches a console.
    fn notifying_loop(name: &str) -> (Ctx, std::sync::mpsc::Receiver<String>) {
        let dir = std::env::temp_dir().join(format!(
            "plan2code-loop-notify-{name}-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(dir.join("specs/lunch")).unwrap();
        let report_home = dir.join("console-home");
        std::fs::create_dir_all(&report_home).unwrap();
        let _ = std::fs::remove_file(report_home.join(loop_report::REPORTS_FILE));
        let (url, calls) = listening_address();
        let mut s = setup();
        s.notify_url = url;
        s.notify_param = "msg".into();
        let rec = RunningRecord::new(dir, "specs/lunch".into(), s, vec![phase(2), phase(3)]);
        let run_id = rec.run_id;
        let slot: LoopSlot = Arc::new(Mutex::new(Some(rec)));
        let ctx = Ctx {
            slot,
            agent: Arc::new(AgentManager::new(PathBuf::from("."), Arc::new(|_| {}))),
            console_dir: PathBuf::from("."),
            home: report_home,
            launch: (
                Agent::Builtin(crate::agents::builtin_entry("claude").unwrap()),
                None,
                None,
                PermissionMode::Bypass,
            ),
            run_id,
            hooks: Arc::new(Hooks {
                emit: Box::new(|_| {}),
                attention: Box::new(|| {}),
            }),
            limits: Limits::default(),
        };
        (ctx, calls)
    }

    // ------------------------------------------------ the loop test harness
    //
    // A real throwaway git repository, the fake agent in a pseudo-terminal and
    // millisecond limits, so the loop's glue code runs end to end without a
    // mock of git.

    /// Whether `program` runs; a test that needs it says so and skips when not.
    /// On CI (`CI` is set) a missing program fails the test instead, so a
    /// runner without git or node cannot turn the tests into silent passes.
    fn program_ready(test: &str, program: &str) -> bool {
        let found = std::process::Command::new(program)
            .arg("--version")
            .output()
            .is_ok_and(|out| out.status.success());
        if !found {
            assert!(
                std::env::var_os("CI").is_none(),
                "{test}: {program} is not on PATH"
            );
            eprintln!("SKIPPED {test}: {program} is not on PATH");
        }
        found
    }

    fn git_ready(test: &str) -> bool {
        program_ready(test, "git")
    }

    /// Git, node and the skill scripts (`specs.mjs`, `commit-msg.mjs`) the tick
    /// runs. The scripts are the repository's own (see `loop_tools::skill_script`).
    fn harness_ready(test: &str) -> bool {
        let scripts = loop_tools::skill_script("specs.mjs").is_some()
            && loop_tools::skill_script("commit-msg.mjs").is_some();
        assert!(
            scripts,
            "{test}: the skill scripts are missing from src/skill-scripts"
        );
        git_ready(test) && program_ready(test, "node")
    }

    fn git_in(repo: &Path, args: &[&str]) -> String {
        let out = std::process::Command::new("git")
            .args(args)
            .current_dir(repo)
            .output()
            .expect("run git");
        assert!(
            out.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    /// A new git repository in a unique temp folder, with `specs/lunch` (Phases
    /// 2 and 3, two open tasks each) and one commit. The console home sits
    /// beside it, in `console-home`.
    fn throwaway_repo(name: &str) -> PathBuf {
        let base =
            std::env::temp_dir().join(format!("plan2code-loop-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let repo = base.join("repo");
        let spec = repo.join("specs/lunch");
        std::fs::create_dir_all(&spec).unwrap();
        git_in(&repo, &["init", "-q"]);
        for (key, value) in [
            ("user.name", "Loop Test"),
            ("user.email", "loop@example.com"),
            ("commit.gpgsign", "false"),
            ("core.autocrlf", "false"),
            // A global hooks folder must not run in a test.
            ("core.hooksPath", ".git/hooks"),
        ] {
            git_in(&repo, &["config", key, value]);
        }
        std::fs::write(
            spec.join("overview.md"),
            "# Lunch - Overview\n\n## Phase Checklist\n\n- [/] [Phase 2: P2](./phase-2.md)\n- [ ] [Phase 3: P3](./phase-3.md)\n",
        )
        .unwrap();
        for n in [2, 3] {
            std::fs::write(
                spec.join(format!("phase-{n}.md")),
                format!(
                    "# Phase {n}: P{n}\n\n**Status:** In Progress\n\n## Tasks\n\n- [ ] **Task {n}.1:** First\n- [ ] **Task {n}.2:** Second\n"
                ),
            )
            .unwrap();
        }
        git_in(&repo, &["add", "-A"]);
        git_in(&repo, &["commit", "-q", "-m", "Start the lunch spec"]);
        repo
    }

    /// Make `.git/hooks/pre-commit` refuse every commit, printing `first_line`
    /// and a second line to stderr.
    fn add_failing_hook(repo: &Path, first_line: &str) {
        let hook = repo.join(".git/hooks/pre-commit");
        std::fs::create_dir_all(hook.parent().unwrap()).unwrap();
        std::fs::write(
            &hook,
            format!("#!/bin/sh\necho \"{first_line}\" >&2\necho \"second line\" >&2\nexit 1\n"),
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    /// What `specs.mjs status` says about the throwaway spec.
    fn spec_status(repo: &Path) -> Value {
        loop_tools::specs_status(repo, "specs/lunch").expect("specs.mjs status")
    }

    /// Tick every task of Phase `n` off, as a finished build leaves it.
    fn finish_phase_tasks(repo: &Path, n: u32) {
        let file = repo.join(format!("specs/lunch/phase-{n}.md"));
        let text = std::fs::read_to_string(&file).unwrap();
        std::fs::write(&file, text.replace("- [ ]", "- [x]")).unwrap();
    }

    /// Where `cargo build -p fake-agent` leaves the fake agent, built on first use.
    fn fake_agent_path() -> PathBuf {
        static BUILD: std::sync::Once = std::sync::Once::new();
        BUILD.call_once(|| {
            let status = std::process::Command::new(env!("CARGO"))
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
        assert!(path.exists(), "{} is missing", path.display());
        path
    }

    /// The fake agent as a custom agent. The loop's tests start it this way, not
    /// through `PLAN2CODE_APP_AGENT_BIN`: that variable is process-wide, and
    /// other tests in this process read it.
    fn fake_agent_launch() -> Launch {
        let agent = crate::agents::CustomAgent {
            id: "fake".into(),
            name: "Fake agent".into(),
            command: fake_agent_path().to_string_lossy().into_owned(),
            args: Vec::new(),
            prompt: String::new(),
            bypass_args: Vec::new(),
            model_args: Vec::new(),
            models: Vec::new(),
        };
        (Agent::Custom(agent), None, None, PermissionMode::Bypass)
    }

    /// An agent manager for the fake agent, and everything the agents printed. The pump answers the pseudo-terminal's cursor question,
    /// as a terminal does, or Windows holds the output back.
    fn fake_agent_manager(folder: &Path) -> (Arc<AgentManager>, Arc<Mutex<String>>) {
        use crate::agent_manager::AgentEvent;
        let (tx, rx) = std::sync::mpsc::channel();
        let tx = Mutex::new(tx);
        let sink: crate::agent_manager::Sink = Arc::new(move |event| {
            let _ = lock(&tx).send(event);
        });
        let manager = Arc::new(AgentManager::new(folder.to_path_buf(), sink));
        let seen = Arc::new(Mutex::new(String::new()));
        let (weak, log) = (Arc::downgrade(&manager), Arc::clone(&seen));
        thread::spawn(move || {
            for event in rx {
                if let AgentEvent::Output(bytes) = event {
                    let text = String::from_utf8_lossy(&bytes).into_owned();
                    if text.contains("[6n") {
                        if let Some(manager) = weak.upgrade() {
                            let _ = manager.input(b"\x1b[1;1R");
                        }
                    }
                    lock(&log).push_str(&text);
                }
            }
        });
        (manager, seen)
    }

    /// Poll until `ready`; the wait ends on state, not on a fixed sleep.
    fn wait_until(what: &str, mut ready: impl FnMut() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(30);
        while Instant::now() < deadline {
            if ready() {
                return;
            }
            thread::sleep(Duration::from_millis(20));
        }
        panic!("never saw {what}");
    }

    /// `running_loop` with the fake agent's output as well.
    fn running_loop_seen(repo: &Path, limits: Limits) -> (Ctx, PathBuf, Arc<Mutex<String>>) {
        let home = repo.parent().unwrap().join("console-home");
        std::fs::create_dir_all(home.join("sessions/s1")).unwrap();
        std::fs::write(home.join("sessions/s1/state.json"), "{\"schema\":1}").unwrap();
        let (agent, seen) = fake_agent_manager(repo);
        let mut rec = RunningRecord::new(
            repo.to_path_buf(),
            "specs/lunch".into(),
            setup(),
            vec![phase(2), phase(3)],
        );
        rec.sid = Some("s1".into());
        rec.last_sid = Some("s1".into());
        // What a phase start reads from the clean throwaway repo.
        rec.phase_baseline = Some(Vec::new());
        let run_id = rec.run_id;
        let ctx = Ctx {
            slot: Arc::new(Mutex::new(Some(rec))),
            agent,
            console_dir: PathBuf::from("."),
            home: home.clone(),
            launch: fake_agent_launch(),
            run_id,
            hooks: Arc::new(Hooks {
                emit: Box::new(|_| {}),
                attention: Box::new(|| {}),
            }),
            limits,
        };
        (ctx, home, seen)
    }

    /// A loop on the throwaway repo, session `s1` open, the given limits and
    /// the fake agent: what `notifying_loop` is, with real git behind it.
    fn running_loop(repo: &Path, limits: Limits) -> (Ctx, PathBuf) {
        let (ctx, home, _) = running_loop_seen(repo, limits);
        (ctx, home)
    }

    /// Replace session `s1`'s `state.json`, whole, as the console does
    /// (with the schema number the reader insists on).
    fn write_session(home: &Path, mut state: Value) {
        state["schema"] = json!(crate::session_reader::SCHEMA);
        let dir = home.join("sessions/s1");
        std::fs::write(dir.join("state.json.tmp"), state.to_string()).unwrap();
        std::fs::rename(dir.join("state.json.tmp"), dir.join("state.json")).unwrap();
    }

    /// A phase report that passes every check.
    fn good_report(phase: u32) -> Value {
        json!({
            "phase": phase,
            "result": "passed",
            "summary": "Built it",
            "subject": "Add the driver",
            "tests": { "ran": true, "passed": true, "summary": "ok" },
            "review": { "ran": true, "recheck": true },
            "tasks": { "blocked": [], "assumed": [] },
        })
    }

    fn end_the_test(ctx: &Ctx) {
        ctx.agent.stop();
        *lock(&ctx.slot) = None;
    }

    /// The last entry of the loop's saved report, once the loop has ended.
    fn last_entry_saved(home: &Path, repo: &Path) -> ReportEntry {
        loop_report::load(home, repo, "specs/lunch")
            .expect("a saved report")
            .entries
            .last()
            .cloned()
            .expect("an entry")
    }

    #[test]
    fn the_default_limits_are_the_watchers_own_constants() {
        let limits = Limits::default();
        assert_eq!(limits.watch_every, Duration::from_secs(2));
        assert_eq!(limits.notice_wait, Duration::from_secs(180));
        assert_eq!(limits.activity_every, Duration::from_secs(30));
    }

    #[test]
    fn a_throwaway_repo_has_the_spec_and_a_failing_hook_stops_a_commit() {
        if !harness_ready("throwaway repo") {
            return;
        }
        let repo = throwaway_repo("harness");
        let status = spec_status(&repo);
        assert_eq!(status["phases"].as_array().unwrap().len(), 2);
        assert_eq!(status["phases"][0]["tasks"]["open"], 2);
        add_failing_hook(&repo, "hook says no");
        std::fs::write(repo.join("new.txt"), "x").unwrap();
        let added = loop_tools::git_add_listed(&repo, &loop_tools::git_changed(&repo).unwrap());
        assert!(added.ok);
        let done = loop_tools::git_commit(&repo, "Add new\n\nAI Assisted");
        assert!(!done.ok);
        assert!(done.output.starts_with("hook says no"), "{}", done.output);
    }

    #[test]
    fn a_good_report_passes_marks_the_phase_done_and_commits_it() {
        if !harness_ready("good report") {
            return;
        }
        let repo = throwaway_repo("good-report");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(tick(&ctx), "the loop goes on to Phase 3");
        {
            let guard = lock(&ctx.slot);
            let rec = guard.as_ref().unwrap();
            assert_eq!(rec.current, 1);
            assert_eq!(rec.phases[0].status, PhaseStatus::Done);
            let head = git_in(&repo, &["rev-parse", "--short", "HEAD"]);
            assert_eq!(rec.phases[0].commit.as_deref(), Some(head.as_str()));
            assert_eq!(rec.phases[0].subject.as_deref(), Some("Add the driver"));
        }
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver"
        );
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "x");
        end_the_test(&ctx);
    }

    #[test]
    fn a_passing_phase_calls_the_web_address_only_when_the_box_is_on() {
        if !harness_ready("phase message") {
            return;
        }
        for (on, name) in [(true, "phase-message-on"), (false, "phase-message-off")] {
            let repo = throwaway_repo(name);
            let (ctx, home) = running_loop(&repo, Limits::default());
            let (url, calls) = listening_address();
            {
                let mut guard = lock(&ctx.slot);
                let setup = &mut guard.as_mut().unwrap().setup;
                setup.notify_url = url;
                setup.notify_param = "msg".into();
                setup.notify_phases = on;
            }
            finish_phase_tasks(&repo, 2);
            write_session(&home, json!({ "loopOutcome": good_report(2) }));
            assert!(tick(&ctx), "the loop goes on to Phase 3");
            if on {
                let call = calls.recv_timeout(CALL_WAIT).unwrap();
                assert!(call.contains("is%20complete."), "{call}");
                assert!(call.contains("Phase%202%20of%203%20"), "{call}");
                assert!(call.contains("Add%20the%20driver"), "{call}");
                assert!(call.contains("Next%3A%20Phase%203"), "{call}");
            } else {
                assert!(calls.recv_timeout(QUIET).is_err(), "the box is off");
            }
            end_the_test(&ctx);
        }
    }

    #[test]
    fn under_best_guess_a_question_stops_the_phase_at_once_naming_it() {
        if !git_ready("guess question") {
            return;
        }
        let repo = throwaway_repo("guess-question");
        let (ctx, home) = running_loop(&repo, Limits::default());
        lock(&ctx.slot).as_mut().unwrap().setup.on_question = OnQuestion::Guess;
        // The loop's own cards never stop it.
        write_session(
            &home,
            json!({ "loop": { "driving": true }, "items": [
                { "id": "fixes", "kind": "multi", "status": "answered", "title": "Which to fix", "handledBy": "loop" },
            ] }),
        );
        assert!(tick(&ctx), "nothing to answer yet");
        write_session(
            &home,
            json!({ "loop": { "driving": true }, "items": [
                { "id": "q1", "kind": "choice", "status": "open", "title": "Which database" },
            ] }),
        );
        assert!(!tick(&ctx), "the question stops the loop on the first look");
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(
            entry.line,
            "Phase 2 stopped: it asked a question, \"Which database\""
        );
    }

    #[test]
    fn a_page_announced_before_the_lock_is_followed_once_the_lock_shows() {
        if !git_ready("candidate page") {
            return;
        }
        let repo = throwaway_repo("candidate-page");
        let (ctx, home) = running_loop(&repo, Limits::default());
        lock(&ctx.slot).as_mut().unwrap().sid = None;
        // The skill's first, plain open announces the page before `open --loop`.
        write_session(&home, json!({ "workflow": "implement-review" }));
        note_page(
            &ctx.slot,
            "implement-review",
            "s1",
            &json!({ "workflow": "implement-review" }),
        );
        assert!(tick(&ctx));
        assert!(
            lock(&ctx.slot).as_ref().unwrap().sid.is_none(),
            "not locked yet"
        );
        // `open --loop` locks it: the next look follows it.
        write_session(
            &home,
            json!({ "workflow": "implement-review", "loop": { "driving": true } }),
        );
        assert!(tick(&ctx));
        assert_eq!(lock(&ctx.slot).as_ref().unwrap().sid.as_deref(), Some("s1"));
        end_the_test(&ctx);
    }

    #[test]
    fn the_commit_takes_only_the_files_the_phase_changed() {
        if !harness_ready("own files") {
            return;
        }
        let repo = throwaway_repo("own-files");
        let (ctx, home) = running_loop(&repo, Limits::default());
        // The person's own change, there before the phase began.
        std::fs::write(repo.join("mine.txt"), "the person's").unwrap();
        start_phase(&ctx, 0).expect("start the fake agent");
        assert_eq!(
            lock(&ctx.slot).as_ref().unwrap().phase_baseline.as_deref(),
            Some(&["mine.txt".to_string()][..])
        );
        let locked = json!({ "loop": { "driving": true } });
        write_session(&home, locked.clone());
        note_page(&ctx.slot, "implement-review", "s1", &locked);
        // The agent's work.
        finish_phase_tasks(&repo, 2);
        std::fs::write(repo.join("agent.txt"), "built").unwrap();
        write_session(
            &home,
            json!({ "loop": { "driving": true }, "loopOutcome": good_report(2) }),
        );
        assert!(tick(&ctx), "the loop goes on to Phase 3");
        let shown = git_in(&repo, &["show", "--name-only", "--format=", "HEAD"]);
        assert!(shown.contains("agent.txt"), "{shown}");
        assert!(shown.contains("specs/lunch/phase-2.md"), "{shown}");
        assert!(!shown.contains("mine.txt"), "{shown}");
        assert_eq!(git_in(&repo, &["status", "--porcelain"]), "?? mine.txt");
        end_the_test(&ctx);
    }

    #[test]
    fn a_phase_whose_start_could_not_list_the_tree_commits_nothing() {
        if !harness_ready("no baseline") {
            return;
        }
        let repo = throwaway_repo("no-baseline");
        let (ctx, home) = running_loop(&repo, Limits::default());
        lock(&ctx.slot).as_mut().unwrap().phase_baseline = None;
        finish_phase_tasks(&repo, 2);
        std::fs::write(repo.join("agent.txt"), "built").unwrap();
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        let head = git_in(&repo, &["rev-parse", "HEAD"]);
        assert!(!tick(&ctx), "the commit stops the loop");
        assert_eq!(
            git_in(&repo, &["rev-parse", "HEAD"]),
            head,
            "nothing committed"
        );
        assert_eq!(git_in(&repo, &["diff", "--cached", "--name-only"]), "");
        let entry = last_entry_saved(&home, &repo);
        assert!(
            entry.line.contains(loop_commit::OWN_FILES_UNKNOWN),
            "{}",
            entry.line
        );
    }

    #[test]
    fn a_phase_that_never_opens_its_console_stops_with_that_cause() {
        if !git_ready("no session") {
            return;
        }
        let repo = throwaway_repo("no-session");
        let limits = Limits {
            notice_wait: Duration::ZERO,
            ..Limits::default()
        };
        let (ctx, home) = running_loop(&repo, limits);
        {
            let mut guard = lock(&ctx.slot);
            let rec = guard.as_mut().unwrap();
            rec.sid = None;
            rec.setup.retry_once = false;
        }
        assert!(!tick(&ctx), "the loop is over");
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(
            entry.line,
            "Phase 2 stopped: the agent never opened the console"
        );
    }

    #[test]
    fn a_crashed_agent_gets_one_retry_and_then_the_loop_stops() {
        if !git_ready("crash") {
            return;
        }
        let repo = throwaway_repo("crash");
        let (ctx, home, seen) = running_loop_seen(&repo, Limits::default());
        let ready = |count: usize| {
            wait_until("the fake agent ready", || {
                lock(&seen).matches("FAKE-AGENT ready").count() >= count
            })
        };
        let crash = || {
            ctx.agent.input(b"EXIT 3\r").unwrap();
            wait_until("the agent ended", || {
                matches!(ctx.agent.snapshot().state, AgentState::Ended { .. })
            });
        };
        start_phase(&ctx, 0).expect("start the fake agent");
        ready(1);
        crash();
        assert!(tick(&ctx), "the first crash is retried");
        {
            let guard = lock(&ctx.slot);
            let rec = guard.as_ref().unwrap();
            assert_eq!(rec.phases[0].retries, 1);
            assert_eq!(rec.retries_used, 1);
            assert_eq!(rec.phases[0].status, PhaseStatus::Running);
        }
        ready(2);
        crash();
        assert!(!tick(&ctx), "the second crash stops the loop");
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert!(entry.line.contains("the agent crashed"), "{}", entry.line);
        assert!(entry.line.ends_with("after one retry"), "{}", entry.line);
    }

    fn strength_rows() -> BTreeMap<String, StrengthRow> {
        let row = |model: &str, effort: Option<&str>| StrengthRow {
            model: model.into(),
            effort: effort.map(str::to_string),
        };
        BTreeMap::from([
            ("thrifty".to_string(), row("sonnet", Some("low"))),
            ("balanced".to_string(), row("opus", Some("medium"))),
            ("best".to_string(), row("opus", Some("high"))),
        ])
    }

    /// Turn Set strength per phase on for the harness loop: the phases'
    /// words, the rows an agent maps and a launch model for Match my session.
    fn with_strengths(ctx: &Ctx, words: &[Option<Strength>]) {
        let mut guard = lock(&ctx.slot);
        let rec = guard.as_mut().unwrap();
        rec.setup.phase_strength = true;
        rec.strength_rows = strength_rows();
        rec.launch_model = Some("haiku".into());
        for (phase, word) in rec.phases.iter_mut().zip(words) {
            phase.strength = *word;
        }
    }

    #[test]
    fn a_thrifty_phase_starts_on_its_strength_and_a_retry_steps_it_up() {
        if !git_ready("strength retry") {
            return;
        }
        let repo = throwaway_repo("strength-retry");
        let (ctx, home, seen) = running_loop_seen(&repo, Limits::default());
        with_strengths(&ctx, &[Some(Strength::Thrifty), Some(Strength::Best)]);
        let ready = |count: usize| {
            wait_until("the fake agent ready", || {
                lock(&seen).matches("FAKE-AGENT ready").count() >= count
            })
        };
        start_phase(&ctx, 0).expect("start the fake agent");
        ready(1);
        ctx.agent.input(b"ENV PLAN2CODE_LOOP_STRENGTH\r").unwrap();
        wait_until("the strength env", || {
            lock(&seen).contains("ENV PLAN2CODE_LOOP_STRENGTH=thrifty")
        });
        // The strip says what the phase runs on.
        let event = state_event(lock(&ctx.slot).as_ref().unwrap());
        assert_eq!(event.strength.as_deref(), Some("thrifty"));
        assert_eq!(event.model.as_deref(), Some("sonnet"));
        assert_eq!(event.effort.as_deref(), Some("low"));
        // The stored launch choice is the loop's own, not the phase's.
        let (_, model, _, _) = ctx.agent.launch_choice().unwrap();
        assert_eq!(model, None);

        ctx.agent.input(b"EXIT 3\r").unwrap();
        wait_until("the agent ended", || {
            matches!(ctx.agent.snapshot().state, AgentState::Ended { .. })
        });
        assert!(tick(&ctx), "the crash is retried");
        {
            let guard = lock(&ctx.slot);
            let rec = guard.as_ref().unwrap();
            assert_eq!(rec.phases[0].strength, Some(Strength::Balanced));
            let entry = rec.report.entries.last().unwrap();
            assert_eq!(entry.result, EntryResult::Retried);
            assert_eq!(entry.strength, "Balanced");
            assert_eq!(entry.model, "opus, medium");
        }
        ready(2);
        ctx.agent.input(b"ENV PLAN2CODE_LOOP_STRENGTH\r").unwrap();
        wait_until("the stepped-up env", || {
            lock(&seen).contains("ENV PLAN2CODE_LOOP_STRENGTH=balanced")
        });
        let saved = loop_report::load(&home, &repo, "specs/lunch").expect("a saved report");
        assert_eq!(saved.entries.last().unwrap().strength, "Balanced");
        end_the_test(&ctx);
    }

    #[test]
    fn a_loop_with_the_toggle_off_starts_every_phase_without_the_strength_env() {
        if !git_ready("strength off") {
            return;
        }
        let repo = throwaway_repo("strength-off");
        let (ctx, _home, seen) = running_loop_seen(&repo, Limits::default());
        {
            // The words are there, but the toggle is off: they are ignored.
            let mut guard = lock(&ctx.slot);
            let rec = guard.as_mut().unwrap();
            rec.strength_rows = strength_rows();
            rec.phases[0].strength = Some(Strength::Best);
            assert!(rec.phase_run(0).is_none());
        }
        start_phase(&ctx, 0).expect("start the fake agent");
        wait_until("the fake agent ready", || {
            lock(&seen).contains("FAKE-AGENT ready")
        });
        ctx.agent.input(b"ENV PLAN2CODE_LOOP_STRENGTH\r").unwrap();
        wait_until("the env line", || {
            lock(&seen).contains("ENV PLAN2CODE_LOOP_STRENGTH=\r")
        });
        let event = state_event(lock(&ctx.slot).as_ref().unwrap());
        assert_eq!(
            (event.strength, event.model, event.effort),
            (None, None, None)
        );
        end_the_test(&ctx);
    }

    #[test]
    fn fix_it_by_hand_and_finalize_never_pass_the_strength_env() {
        if !git_ready("strength fix") {
            return;
        }
        let repo = throwaway_repo("strength-fix");
        let (ctx, _home, seen) = running_loop_seen(&repo, Limits::default());
        with_strengths(&ctx, &[Some(Strength::Thrifty), None]);
        start_phase(&ctx, 0).expect("start the fake agent");
        wait_until("the phase agent ready", || {
            lock(&seen).matches("FAKE-AGENT ready").count() >= 1
        });
        for (round, prompt) in [fix_prompt("specs/lunch"), finalize_prompt("specs/lunch")]
            .into_iter()
            .enumerate()
        {
            start_with(&ctx.agent, &ctx.launch, prompt).unwrap();
            wait_until("the next agent ready", || {
                lock(&seen).matches("FAKE-AGENT ready").count() >= round + 2
            });
            ctx.agent.input(b"ENV PLAN2CODE_LOOP_STRENGTH\r").unwrap();
            wait_until("the env line", || {
                lock(&seen).matches("PLAN2CODE_LOOP_STRENGTH=\r").count() > round
            });
        }
        assert!(!lock(&seen).contains("PLAN2CODE_LOOP_STRENGTH=thrifty"));
        end_the_test(&ctx);
    }

    #[test]
    fn a_retry_steps_best_stays_and_a_partly_mapped_agent_skips_to_its_next_word() {
        let mut rec = record("specs/x", vec![phase(1), phase(2), phase(3), phase(4)]);
        rec.strength_rows = strength_rows();
        rec.phases[0].strength = Some(Strength::Thrifty);
        rec.phases[1].strength = Some(Strength::Balanced);
        rec.phases[2].strength = Some(Strength::Best);
        for i in 0..4 {
            rec.step_strength_up(i);
        }
        assert_eq!(rec.phases[0].strength, Some(Strength::Balanced));
        assert_eq!(rec.phases[1].strength, Some(Strength::Best));
        assert_eq!(rec.phases[2].strength, Some(Strength::Best), "Best stays");
        assert_eq!(rec.phases[3].strength, None, "Match my session stays");

        // An agent that maps only Thrifty and Best skips the gap, and stays
        // when nothing above is mapped.
        rec.strength_rows.remove("balanced");
        rec.phases[0].strength = Some(Strength::Thrifty);
        rec.step_strength_up(0);
        assert_eq!(rec.phases[0].strength, Some(Strength::Best));
        rec.strength_rows.remove("best");
        rec.phases[1].strength = Some(Strength::Thrifty);
        rec.step_strength_up(1);
        assert_eq!(rec.phases[1].strength, Some(Strength::Thrifty));
    }

    #[test]
    fn the_strip_says_a_match_my_session_phase_runs_on_the_launch_model() {
        let mut rec = record("specs/x", vec![phase(1)]);
        rec.setup.phase_strength = true;
        rec.strength_rows = strength_rows();
        rec.launch_model = Some("opus".into());
        rec.launch_effort = Some("high".into());
        let event = state_event(&rec);
        assert_eq!(event.strength, None);
        assert_eq!(event.model.as_deref(), Some("opus"));
        assert_eq!(event.effort.as_deref(), Some("high"));
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["model"], "opus");
        assert!(json["strength"].is_null());
        // A pick the agent does not map runs on the launch choice too.
        rec.strength_rows.clear();
        rec.phases[0].strength = Some(Strength::Thrifty);
        assert_eq!(rec.phase_run(0).unwrap().strength, None);
    }

    #[test]
    fn a_stopped_phase_entry_says_what_it_ran_on() {
        if !git_ready("stopped ran on") {
            return;
        }
        let repo = throwaway_repo("stopped-ran-on");
        let limits = Limits {
            notice_wait: Duration::ZERO,
            ..Limits::default()
        };
        let (ctx, home) = running_loop(&repo, limits);
        {
            let mut guard = lock(&ctx.slot);
            let rec = guard.as_mut().unwrap();
            rec.sid = None;
            rec.setup.retry_once = false;
            rec.setup.phase_strength = true;
            rec.phases[rec.current].strength = Some(Strength::Thrifty);
            rec.strength_rows.insert(
                "thrifty".to_string(),
                StrengthRow {
                    model: "sonnet".to_string(),
                    effort: Some("low".to_string()),
                },
            );
        }
        assert!(!tick(&ctx), "the loop is over");
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(entry.strength, "Thrifty");
        assert_eq!(entry.model, "sonnet, low");
    }

    #[test]
    fn a_refused_commit_stops_the_loop() {
        if !harness_ready("refused commit") {
            return;
        }
        let repo = throwaway_repo("refused-commit");
        add_failing_hook(&repo, "lint says no");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        let before = std::fs::read_to_string(repo.join("specs/lunch/phase-2.md")).unwrap();
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(!tick(&ctx));
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(
            entry.line,
            "Phase 2 was not committed: lint says no. The work is uncommitted; Resume tries the commit again"
        );
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Start the lunch spec",
            "nothing was committed"
        );
        // The mark was taken back: the phase is open and its file is as the
        // agent left it.
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "/");
        assert_eq!(
            std::fs::read_to_string(repo.join("specs/lunch/phase-2.md")).unwrap(),
            before
        );
        let status = git_in(&repo, &["status", "--porcelain"]);
        assert!(status.contains("specs/lunch/phase-2.md"), "{status}");
        assert_eq!(
            git_in(&repo, &["diff", "--cached", "--name-only"]),
            "",
            "nothing stays staged"
        );
        let saved = loop_report::load(&home, &repo, "specs/lunch").unwrap();
        assert_eq!(saved.marked_not_committed, None);

        // Resume with the hook fixed commits the same phase.
        std::fs::remove_file(repo.join(".git/hooks/pre-commit")).unwrap();
        let (again, home) = running_loop(&repo, Limits::default());
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(tick(&again), "the loop goes on to Phase 3");
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver"
        );
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "x");
        end_the_test(&again);
    }

    #[test]
    fn a_passing_report_with_failed_tests_is_refused_and_nothing_changes() {
        if !harness_ready("failed tests") {
            return;
        }
        let repo = throwaway_repo("failed-tests");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        let before = std::fs::read_to_string(repo.join("specs/lunch/phase-2.md")).unwrap();
        let head = git_in(&repo, &["rev-parse", "HEAD"]);
        let mut report = good_report(2);
        report["tests"] = json!({ "ran": true, "passed": false, "summary": "2 failed" });
        write_session(&home, json!({ "loopOutcome": report }));
        assert!(!tick(&ctx));
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(
            entry.line,
            "Phase 2 stopped: its tests ran and failed: 2 failed"
        );
        assert_eq!(git_in(&repo, &["rev-parse", "HEAD"]), head, "no commit");
        assert_eq!(
            git_in(&repo, &["diff", "--cached", "--name-only"]),
            "",
            "nothing staged"
        );
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "/");
        assert_eq!(
            std::fs::read_to_string(repo.join("specs/lunch/phase-2.md")).unwrap(),
            before,
            "the spec is untouched"
        );
    }

    #[test]
    fn a_phase_with_a_task_left_open_is_refused_with_the_specs_counts() {
        if !harness_ready("open task") {
            return;
        }
        let repo = throwaway_repo("open-task");
        let (ctx, home) = running_loop(&repo, Limits::default());
        // The agent ticked one task and reported success all the same.
        let file = repo.join("specs/lunch/phase-2.md");
        let text = std::fs::read_to_string(&file).unwrap();
        std::fs::write(&file, text.replacen("- [ ]", "- [x]", 1)).unwrap();
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(!tick(&ctx));
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(
            entry.line,
            "Phase 2 stopped: the spec disagrees: 0 blocked, 1 still open"
        );
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "/");
    }

    #[test]
    fn a_leftover_suggestion_commits_the_phase_and_is_recorded_as_a_warning() {
        if !harness_ready("leftover suggestion") {
            return;
        }
        let repo = throwaway_repo("leftover-suggestion");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        let mut report = good_report(2);
        report["review"] = json!({
            "ran": true,
            "recheck": true,
            "left": { "critical": 0, "warning": 0, "suggestion": 1 },
            "unfixed": [
                { "level": "suggestion", "title": "Name the timer", "file": "src/x.js" },
                { "level": "suggestion", "title": "Trim the log", "file": "src/y.js" }
            ]
        });
        write_session(&home, json!({ "loopOutcome": report }));
        assert!(tick(&ctx), "the loop goes on to Phase 3");
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver"
        );
        let saved = loop_report::load(&home, &repo, "specs/lunch").unwrap();
        let entry = saved.entries.last().unwrap();
        assert_eq!(entry.result, EntryResult::Passed);
        assert_eq!(
            entry.warnings,
            vec!["2 Suggestions left unfixed".to_string()],
            "the larger of the counter (1) and the list (2)"
        );
        end_the_test(&ctx);
    }

    #[test]
    fn the_approval_line_is_inside_the_phases_commit() {
        if !harness_ready("approval in commit") {
            return;
        }
        let repo = throwaway_repo("approval-commit");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(tick(&ctx));
        let shown = git_in(&repo, &["show", "HEAD"]);
        assert!(
            shown.contains("Approved by the Implementation Loop on"),
            "{shown}"
        );
        assert!(shown.contains("specs/lunch/overview.md"), "{shown}");
        assert_eq!(git_in(&repo, &["status", "--porcelain"]), "");
        end_the_test(&ctx);
    }

    #[test]
    fn a_failed_undo_stops_with_the_exact_message_and_the_fact_outlives_the_run() {
        if !harness_ready("failed undo") {
            return;
        }
        let repo = throwaway_repo("failed-undo");
        // The hook edits the phase file while the commit runs, so the loop
        // cannot tell its own text from the person's and must not restore it.
        let hook = repo.join(".git/hooks/pre-commit");
        std::fs::create_dir_all(hook.parent().unwrap()).unwrap();
        std::fs::write(
            &hook,
            "#!/bin/sh\necho \"edited\" >> specs/lunch/phase-2.md\necho \"hook says no\" >&2\nexit 1\n",
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(!tick(&ctx));
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(
            entry.line,
            "Phase 2 is marked done in phase-2.md but its work is not committed"
        );
        // A re-load of the store, as after an app restart.
        let saved = loop_report::load(&home, &repo, "specs/lunch").unwrap();
        assert_eq!(
            saved.marked_not_committed,
            Some(loop_report::MarkedNotCommitted {
                phase: 2,
                file: "phase-2.md".into()
            })
        );
        // Resume finds the mark has no commit and opens the phase again.
        let status = spec_status(&repo);
        assert_eq!(status["phases"][0]["marker"], "x");
        let reopened = loop_commit::unbacked_marks(&repo, "specs/lunch", &status, &saved, true);
        assert_eq!(reopened, vec![2]);
        loop_commit::reopen(&repo, "specs/lunch", &reopened).unwrap();
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "/");
    }

    /// What a stopped phase leaves behind when the agent left `file` in the
    /// tree: the line, the spec and git as the person would find them.
    fn assert_unsafe_stop(repo: &Path, home: &Path, ctx: &Ctx, file: &str) {
        assert!(!tick(ctx), "the loop is over");
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(home, repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(
            entry.line,
            format!(
                "Phase 2 was not committed: {file} look like secrets or are over 5 MB. Nothing was marked or committed"
            )
        );
        assert_eq!(
            git_in(repo, &["log", "-1", "--format=%s"]),
            "Start the lunch spec",
            "nothing was committed"
        );
        assert_eq!(
            git_in(repo, &["diff", "--cached", "--name-only"]),
            "",
            "nothing stays staged"
        );
        assert_eq!(spec_status(repo)["phases"][0]["marker"], "/");
        let phase = std::fs::read_to_string(repo.join("specs/lunch/phase-2.md")).unwrap();
        assert!(!phase.contains("Approved by the Implementation Loop"));
        let saved = loop_report::load(home, repo, "specs/lunch").unwrap();
        assert_eq!(saved.marked_not_committed, None);
    }

    #[test]
    fn an_agent_that_leaves_an_env_file_stops_the_phase_before_any_mark() {
        if !harness_ready("env file") {
            return;
        }
        let repo = throwaway_repo("env-file");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        std::fs::write(repo.join(".env"), "TOKEN=abc").unwrap();
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert_unsafe_stop(&repo, &home, &ctx, ".env");
    }

    #[test]
    fn an_agent_that_leaves_a_six_megabyte_file_stops_the_phase() {
        if !harness_ready("big file") {
            return;
        }
        let repo = throwaway_repo("big-file");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        let big = std::fs::File::create(repo.join("dump.bin")).unwrap();
        big.set_len(6 * 1024 * 1024).unwrap();
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert_unsafe_stop(&repo, &home, &ctx, "dump.bin");
    }

    #[test]
    fn many_offending_files_are_named_five_at_a_time_and_all_in_the_evidence() {
        let files: Vec<String> = (1..=7).map(|n| format!("k{n}.pem")).collect();
        let cause = StopCause::UnsafeFiles(files.clone());
        assert_eq!(
            stop_line(&cause, 4, "", false),
            "Phase 4 was not committed: k1.pem, k2.pem, k3.pem, k4.pem, k5.pem and 2 more look like secrets or are over 5 MB. Nothing was marked or committed"
        );
        let mut rec = record("specs/lunch", vec![phase(4)]);
        rec.own_dirty = vec!["mine.txt".into()];
        let md = evidence_markdown(&cause, "line", &rec);
        for file in &files {
            assert!(md.contains(&format!("`{file}`")), "{file} missing: {md}");
        }
        assert!(md.contains("(a key or certificate)"), "{md}");
        assert!(md.contains("## Your own files") && md.contains("`mine.txt`"));
        let big = evidence_markdown(&StopCause::UnsafeFiles(vec!["dump.bin".into()]), "l", &rec);
        assert!(big.contains("`dump.bin` (over 5 MB"), "{big}");
        // The line is never sent as a notification for a stop by the person.
        assert!(stop_message(&cause, &at_phase("specs/lunch", 4, 5), "x").is_some());
    }

    #[test]
    fn an_env_example_is_committed_like_any_other_file() {
        if !harness_ready("env example") {
            return;
        }
        let repo = throwaway_repo("env-example");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        std::fs::write(repo.join(".env.example"), "TOKEN=").unwrap();
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(tick(&ctx), "the loop goes on to Phase 3");
        let shown = git_in(&repo, &["show", "--name-only", "--format=%s", "HEAD"]);
        assert!(shown.contains(".env.example"), "{shown}");
        end_the_test(&ctx);
    }

    fn add_slow_hook(repo: &Path, seconds: u32) {
        let hook = repo.join(".git/hooks/pre-commit");
        std::fs::create_dir_all(hook.parent().unwrap()).unwrap();
        std::fs::write(&hook, format!("#!/bin/sh\nsleep {seconds}\nexit 0\n")).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    #[test]
    fn a_slow_hook_commits_within_the_commit_limit_and_is_cut_off_past_it() {
        if !harness_ready("commit limit") {
            return;
        }
        // Within the limit: the hook's two seconds do not matter.
        let repo = throwaway_repo("slow-hook");
        add_slow_hook(&repo, 1);
        let limits = Limits {
            commit_limit: Duration::from_secs(30),
            ..Limits::default()
        };
        let (ctx, home) = running_loop(&repo, limits);
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(tick(&ctx), "a slow hook still commits");
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver"
        );
        end_the_test(&ctx);

        // Past the limit: the commit is stopped, the mark is taken back.
        let repo = throwaway_repo("slow-hook-cut");
        add_slow_hook(&repo, 20);
        let limits = Limits {
            commit_limit: Duration::from_millis(300),
            ..Limits::default()
        };
        let (ctx, home) = running_loop(&repo, limits);
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(!tick(&ctx));
        let entry = last_entry_saved(&home, &repo);
        assert!(entry.line.contains("stopped after"), "{}", entry.line);
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "/");
    }

    #[test]
    fn start_refuses_a_detached_head_with_commit_on_or_off() {
        if !harness_ready("detached") {
            return;
        }
        let repo = throwaway_repo("detached");
        git_in(&repo, &["checkout", "-q", "--detach"]);
        for commit in [true, false] {
            let err = prepare_with(
                &repo,
                "specs/lunch",
                LoopSetup {
                    commit,
                    ..prepare_setup()
                },
                &LoopReport::new("specs/lunch", "now"),
                PermissionMode::Bypass,
                true,
                false,
            )
            .expect_err("a detached HEAD is refused");
            assert_eq!(
                err,
                "HEAD is detached. Switch to a branch before starting the loop"
            );
        }
        assert_eq!(loop_tools::git_branch(&repo), Ok(None));
    }

    #[test]
    fn the_confirm_names_main_and_resume_never_skips_it_there() {
        if !harness_ready("trunk") {
            return;
        }
        let repo = throwaway_repo("trunk");
        let report = LoopReport::new("specs/lunch", "now");
        let go = || {
            prepare_with(
                &repo,
                "specs/lunch",
                prepare_setup(),
                &report,
                PermissionMode::Bypass,
                true,
                true,
            )
            .expect("prepare")
        };
        for trunk in ["main", "master"] {
            git_in(&repo, &["checkout", "-q", "-B", trunk]);
            let rec = go();
            assert_eq!(rec.branch.as_deref(), Some(trunk));
            assert!(commits_to_trunk(&rec));
            assert!(
                confirm_text(&rec).contains(&format!(
                    "You are on `{trunk}`: every phase will commit straight to it. Start only if that is what you want."
                )),
                "{}",
                confirm_text(&rec)
            );
        }
        git_in(&repo, &["checkout", "-q", "-b", "feature/lunch"]);
        let rec = go();
        assert!(!commits_to_trunk(&rec));
        assert!(!confirm_text(&rec).contains("You are on"));
    }

    #[test]
    fn start_skips_phases_specs_mjs_calls_done_and_keeps_a_blocked_one() {
        if !harness_ready("checklist states") {
            return;
        }
        let repo = throwaway_repo("checklist-states");
        let spec = repo.join("specs/lunch");
        std::fs::write(
            spec.join("overview.md"),
            "# Lunch - Overview\n\n## Phase Checklist\n\n- [X] [Phase 1: P1](./phase-1.md)\n- [!] [Phase 2: P2](./phase-2.md)\n- [?] [Phase 3: P3](./phase-3.md)\n- [ ] [Phase 4: P4](./phase-4.md)\n",
        )
        .unwrap();
        for n in [1, 4] {
            std::fs::write(
                spec.join(format!("phase-{n}.md")),
                format!("# Phase {n}: P{n}\n\n## Tasks\n\n- [ ] **Task {n}.1:** First\n"),
            )
            .unwrap();
        }
        git_in(&repo, &["add", "-A"]);
        git_in(&repo, &["commit", "-q", "-m", "checklist states"]);
        let rec = prepare_with(
            &repo,
            "specs/lunch",
            prepare_setup(),
            &LoopReport::new("specs/lunch", "now"),
            PermissionMode::Bypass,
            true,
            false,
        )
        .expect("prepare");
        let numbers: Vec<u32> = rec.phases.iter().map(|p| p.n).collect();
        assert_eq!(numbers, vec![2, 4]);
        assert!(phase_prompt(&rec.spec, rec.phases[0].n, &rec.setup).contains(" --phase 2"));
    }

    #[test]
    fn the_stop_screen_leaves_out_what_was_dirty_at_start() {
        if !harness_ready("own dirty") {
            return;
        }
        let repo = throwaway_repo("own-dirty");
        std::fs::write(repo.join("mine.txt"), "mine").unwrap();
        let rec = prepare_with(
            &repo,
            "specs/lunch",
            prepare_setup(),
            &LoopReport::new("specs/lunch", "now"),
            PermissionMode::Bypass,
            true,
            true,
        )
        .expect("a resume takes the dirty tree");
        assert_eq!(rec.own_dirty, vec!["mine.txt"]);
        assert_eq!(
            rec.start_head.as_deref(),
            Some(git_in(&repo, &["rev-parse", "HEAD"]).as_str())
        );
        std::fs::write(repo.join("agent work.txt"), "x").unwrap();
        assert_eq!(
            uncommitted_files(&repo, &rec.own_dirty),
            vec!["agent work.txt"]
        );
    }

    #[test]
    fn the_agents_work_is_what_is_dirty_now_less_what_was_dirty_then() {
        let own = vec!["a.txt".to_string()];
        let now = vec!["a.txt".to_string(), "b.txt".to_string()];
        assert_eq!(agent_work(now, &own), vec!["b.txt"]);
        assert_eq!(agent_work(vec!["c".into()], &[]), vec!["c"]);
        assert!(agent_work(Vec::new(), &own).is_empty());
        assert!(is_trunk("main") && is_trunk("master"));
        assert!(!is_trunk("mainline") && !is_trunk("feature/main"));
    }

    /// The setup the prepare tests use: commit on, notification off.
    fn prepare_setup() -> LoopSetup {
        LoopSetup {
            commit: true,
            ..setup()
        }
    }

    #[test]
    fn start_needs_a_clean_tree_and_resume_takes_the_dirty_one_it_left() {
        if !harness_ready("prepare") {
            return;
        }
        let repo = throwaway_repo("prepare-dirty");
        let report = LoopReport::new("specs/lunch", "now");
        let go = |resuming: bool| {
            prepare_with(
                &repo,
                "specs/lunch",
                prepare_setup(),
                &report,
                PermissionMode::Bypass,
                true,
                resuming,
            )
        };
        let rec = go(false).expect("a clean tree starts");
        assert_eq!(rec.resumed_files, None);
        std::fs::write(repo.join("agent-work.txt"), "x").unwrap();
        let err = go(false).expect_err("a dirty tree refuses a fresh Start");
        assert!(err.contains("clean tree: 1 uncommitted"), "{err}");
        let rec = go(true).expect("Resume takes the dirty tree");
        assert_eq!(rec.resumed_files, Some(1));
        assert!(confirm_text(&rec).contains("1 uncommitted file already in the tree"));
    }

    #[test]
    fn a_phase_with_no_commit_behind_its_mark_is_listed_but_not_written_until_confirmed() {
        if !harness_ready("prepare rebuilt") {
            return;
        }
        let repo = throwaway_repo("prepare-rebuilt");
        // Phase 2 is marked done by the loop, and its commit is gone.
        assert!(loop_tools::specs_mark_done(&repo, "specs/lunch", 2).ok);
        git_in(&repo, &["add", "-A"]);
        git_in(&repo, &["commit", "-q", "-m", "Mark Phase 2 by hand"]);
        let mut report = LoopReport::new("specs/lunch", "now");
        report.entries.push(ReportEntry {
            phase: 2,
            commit: Some("deadbee".into()),
            ..ReportEntry::default()
        });
        let go = |commit: bool| {
            prepare_with(
                &repo,
                "specs/lunch",
                LoopSetup {
                    commit,
                    ..prepare_setup()
                },
                &report,
                PermissionMode::Bypass,
                true,
                false,
            )
            .expect("prepare")
        };
        let rec = go(true);
        assert_eq!(rec.rebuilt, vec![2]);
        assert_eq!(rec.phases.iter().map(|p| p.n).collect::<Vec<_>>(), [2, 3]);
        assert_eq!(
            spec_status(&repo)["phases"][0]["marker"],
            "x",
            "nothing written yet"
        );
        assert_eq!(git_in(&repo, &["status", "--porcelain"]), "");
        assert!(confirm_text(&rec).contains("Phase 2 is marked done but has no commit"));
        reopen_rebuilt(&rec).unwrap();
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "/");
        // With commit off the mark is trusted: only Phase 3 is left.
        assert!(loop_tools::specs_mark_done(&repo, "specs/lunch", 2).ok);
        let rec = go(false);
        assert!(rec.rebuilt.is_empty());
        assert_eq!(rec.phases.iter().map(|p| p.n).collect::<Vec<_>>(), [3]);
    }

    #[test]
    fn a_commit_that_gives_no_reason_still_reads_as_a_sentence() {
        assert_eq!(
            stop_line(&StopCause::Commit, 2, "", false),
            "Phase 2 was not committed: git gave no reason. The work is uncommitted; Resume tries the commit again"
        );
    }

    #[test]
    fn with_commit_off_the_phase_is_marked_and_nothing_is_committed() {
        if !harness_ready("commit off") {
            return;
        }
        let repo = throwaway_repo("commit-off");
        add_failing_hook(&repo, "never reached");
        let (ctx, home) = running_loop(&repo, Limits::default());
        lock(&ctx.slot).as_mut().unwrap().setup.commit = false;
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(tick(&ctx));
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Start the lunch spec"
        );
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "x");
        let text = std::fs::read_to_string(repo.join("specs/lunch/phase-2.md")).unwrap();
        assert!(
            text.contains("Approved by the Implementation Loop on"),
            "{text}"
        );
        end_the_test(&ctx);
    }

    #[test]
    fn finish_writes_the_summary_and_empties_the_slot() {
        if !git_ready("finish") {
            return;
        }
        let repo = throwaway_repo("finish");
        let (ctx, _home) = running_loop(&repo, Limits::default());
        {
            let mut guard = lock(&ctx.slot);
            let rec = guard.as_mut().unwrap();
            for p in &mut rec.phases {
                p.status = PhaseStatus::Done;
                p.commit = Some("abc1234".into());
            }
            rec.current = 1;
        }
        finish(&ctx);
        assert!(lock(&ctx.slot).is_none());
        let date = chrono::Local::now().format("%Y-%m-%d").to_string();
        let md = std::fs::read_to_string(repo.join(format!("specs/lunch/LOOP-SUMMARY-{date}.md")))
            .expect("the summary file");
        assert!(md.contains("Phases built by this loop: 2."));
    }

    #[test]
    fn stop_after_ends_the_loop_once_the_phase_is_built() {
        if !harness_ready("stop after") {
            return;
        }
        let repo = throwaway_repo("stop-after");
        let (ctx, home) = running_loop(&repo, Limits::default());
        request_stop_after(&ctx.slot, true).unwrap();
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(!tick(&ctx));
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(entry.line, "Stopped after Phase 2, as asked");
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver"
        );
    }

    #[test]
    fn stop_now_with_no_agent_running_leaves_the_slot_taken_until_the_next_look() {
        if !git_ready("stop now") {
            return;
        }
        let repo = throwaway_repo("stop-now");
        let (ctx, home) = running_loop(&repo, Limits::default());
        request_stop_now(&ctx.slot, Some(&ctx.agent), |_| {}).unwrap();
        // Only the watcher's next look ends the loop (the flag is read first),
        // so the slot stays taken until then.
        assert!(is_running(&ctx.slot));
        assert!(lock(&ctx.slot).as_ref().unwrap().stop_now);
        assert!(!tick(&ctx));
        assert!(lock(&ctx.slot).is_none());
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(
            entry.line,
            "Stopped during Phase 2. This phase's changes stay uncommitted."
        );
    }

    #[test]
    fn the_watcher_thread_runs_on_its_limits_and_ends_the_loop_when_stopped() {
        if !git_ready("watcher") {
            return;
        }
        let repo = throwaway_repo("watcher");
        let limits = Limits {
            watch_every: Duration::from_millis(10),
            ..Limits::default()
        };
        let (ctx, _home) = running_loop(&repo, limits);
        request_stop_now(&ctx.slot, Some(&ctx.agent), |_| {}).unwrap();
        let watcher = ctx.clone();
        thread::spawn(move || watch(watcher));
        wait_until("the watcher to end the loop", || !is_running(&ctx.slot));
    }

    // ------------------------------------ the watcher and the stop promises

    /// Wait until the fake agent has printed its ready line `count` times.
    fn fake_agent_ready(seen: &Arc<Mutex<String>>, count: usize) {
        wait_until("the fake agent ready", || {
            lock(seen).matches("FAKE-AGENT ready").count() >= count
        });
    }

    /// Wait until the loop's report holds an entry (the stop was written).
    fn wait_for_entry(home: &Path, repo: &Path) {
        wait_until("the stop to be reported", || {
            loop_report::load(home, repo, "specs/lunch").is_some_and(|r| !r.entries.is_empty())
        });
    }

    #[test]
    fn a_panic_in_the_watcher_stops_the_loop_and_the_agent_and_a_new_loop_can_start() {
        if !harness_ready("watcher panic") {
            return;
        }
        let repo = throwaway_repo("watcher-panic");
        let limits = Limits {
            watch_every: Duration::from_millis(10),
            ..Limits::default()
        };
        let (ctx, home, seen) = running_loop_seen(&repo, limits);
        start_phase(&ctx, 0).expect("start the fake agent");
        fake_agent_ready(&seen, 1);
        let watcher = ctx.clone();
        thread::spawn(move || {
            watch_with(watcher, |c| {
                // A panic inside the lock poisons it, the worst case for the stop.
                let _held = c.slot.lock().unwrap();
                panic!("boom inside the lock");
            })
        });
        wait_for_entry(&home, &repo);
        assert!(!is_running(&ctx.slot), "the slot is cleared");
        assert!(ctx.slot.is_poisoned(), "the lock really was poisoned");
        wait_until("the agent to end", || {
            matches!(ctx.agent.snapshot().state, AgentState::Idle)
        });
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert_eq!(
            entry.line,
            "The loop's watcher failed: boom inside the lock. Nothing more was committed; Resume starts again"
        );
        // A new loop can take the slot.
        *lock(&ctx.slot) = Some(record("specs/lunch", vec![phase(2), phase(3)]));
        assert!(is_running(&ctx.slot));
        abandon(&ctx.slot);
    }

    #[test]
    fn a_watcher_that_returns_false_just_ends() {
        if !git_ready("watcher ends") {
            return;
        }
        let repo = throwaway_repo("watcher-ends");
        let limits = Limits {
            watch_every: Duration::from_millis(5),
            ..Limits::default()
        };
        let (ctx, _home) = running_loop(&repo, limits);
        let mut looks = 0;
        watch_with(ctx.clone(), |_| {
            looks += 1;
            looks < 3
        });
        assert_eq!(looks, 3);
        assert!(is_running(&ctx.slot), "no stop: the step ended the watch");
        end_the_test(&ctx);
    }

    #[test]
    fn an_unreadable_session_counts_as_silence_and_a_good_read_clears_the_count() {
        if !harness_ready("unreadable session") {
            return;
        }
        let repo = throwaway_repo("unreadable");
        let (ctx, home) = running_loop(&repo, Limits::default());
        lock(&ctx.slot).as_mut().unwrap().setup.retry_once = false;
        std::fs::write(home.join("sessions/s1/state.json"), "not json at all").unwrap();
        assert!(tick(&ctx), "recent activity: still waiting");
        assert!(tick(&ctx));
        assert_eq!(lock(&ctx.slot).as_ref().unwrap().read_failures, 2);
        // A good read puts the count back to zero.
        write_session(&home, json!({}));
        assert!(tick(&ctx));
        assert_eq!(lock(&ctx.slot).as_ref().unwrap().read_failures, 0);
        // Unreadable again, and quiet for two hours: the loop ends as silent.
        std::fs::write(home.join("sessions/s1/state.json"), "{").unwrap();
        lock(&ctx.slot).as_mut().unwrap().last_activity =
            SystemTime::now() - Duration::from_secs(2 * 60 * 60);
        assert!(!tick(&ctx), "silence ends the loop");
        assert!(!is_running(&ctx.slot));
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert!(
            entry
                .line
                .starts_with("Phase 2 stopped: the agent went silent for"),
            "{}",
            entry.line
        );
    }

    #[test]
    fn a_state_file_that_stays_locked_or_a_directory_still_ends_in_a_silence_stop() {
        if !harness_ready("locked session") {
            return;
        }
        let repo = throwaway_repo("locked-session");
        let (ctx, home) = running_loop(&repo, Limits::default());
        lock(&ctx.slot).as_mut().unwrap().setup.retry_once = false;
        // A directory where the file belongs: Windows reads that as a locked
        // file (Busy), other systems as unreadable; both must end the same way.
        let state = home.join("sessions/s1/state.json");
        std::fs::remove_file(&state).unwrap();
        std::fs::create_dir(&state).unwrap();
        assert!(tick(&ctx), "recent activity: still waiting");
        lock(&ctx.slot).as_mut().unwrap().last_activity =
            SystemTime::now() - Duration::from_secs(2 * 60 * 60);
        assert!(!tick(&ctx), "silence ends the loop");
        assert!(!is_running(&ctx.slot));
        let entry = last_entry_saved(&home, &repo);
        assert!(entry.line.contains("went silent for"), "{}", entry.line);
    }

    #[test]
    fn stop_now_tells_the_strip_while_the_slot_is_held() {
        let slot: LoopSlot = Arc::new(Mutex::new(Some(record(
            "specs/x",
            vec![phase(2), phase(3)],
        ))));
        let mut told = Vec::new();
        let event = request_stop_now(&slot, None, |event| {
            assert!(
                slot.try_lock().is_err(),
                "the slot is held while it is told"
            );
            told.push(event.clone());
        })
        .unwrap();
        assert_eq!(told, vec![event]);
        assert!(told[0].stopping);
        let none: LoopSlot = Arc::new(Mutex::new(None));
        let mut called = false;
        assert!(request_stop_now(&none, None, |_| called = true).is_err());
        assert!(!called, "no loop, nothing to tell");
    }

    #[test]
    fn the_silence_evidence_says_when_the_session_could_not_be_read() {
        let mut rec = record("specs/x", vec![phase(2)]);
        let line = stop_line(&StopCause::Silence, 2, "20", false);
        let plain = evidence_markdown(&StopCause::Silence, &line, &rec);
        assert!(!plain.contains("could not be read"));
        rec.read_failures = 3;
        let md = evidence_markdown(&StopCause::Silence, &line, &rec);
        assert!(md.contains("The session could not be read during that time"));
    }

    #[test]
    fn a_report_written_just_before_the_agent_exits_is_handled_not_retried() {
        if !harness_ready("report before exit") {
            return;
        }
        let repo = throwaway_repo("report-before-exit");
        let (ctx, home, seen) = running_loop_seen(&repo, Limits::default());
        start_phase(&ctx, 0).expect("start the fake agent");
        fake_agent_ready(&seen, 1);
        // The look found no report; then the agent wrote it and exited.
        let snap = take_snapshot(&ctx).unwrap();
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        ctx.agent.input(b"EXIT 0\r").unwrap();
        wait_until("the agent ended", || {
            matches!(ctx.agent.snapshot().state, AgentState::Ended { .. })
        });
        assert_eq!(crash_or_outcome(&ctx, &snap, "s1"), Some(true));
        {
            let guard = lock(&ctx.slot);
            let rec = guard.as_ref().unwrap();
            assert_eq!(rec.phases[0].status, PhaseStatus::Done);
            assert_eq!(rec.phases[0].retries, 0, "not retried");
            assert_eq!(rec.retries_used, 0);
            assert_eq!(rec.current, 1, "the next phase began");
        }
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver"
        );
        end_the_test(&ctx);
    }

    #[test]
    fn an_ended_agent_with_no_report_is_a_crash_and_one_that_has_not_ended_is_no_crash() {
        if !harness_ready("crash or outcome") {
            return;
        }
        let repo = throwaway_repo("crash-or-outcome");
        let (ctx, home, seen) = running_loop_seen(&repo, Limits::default());
        lock(&ctx.slot).as_mut().unwrap().setup.retry_once = false;
        start_phase(&ctx, 0).expect("start the fake agent");
        fake_agent_ready(&seen, 1);
        let snap = take_snapshot(&ctx).unwrap();
        assert_eq!(crash_or_outcome(&ctx, &snap, "s1"), None, "still running");
        ctx.agent.input(b"EXIT 3\r").unwrap();
        wait_until("the agent ended", || {
            matches!(ctx.agent.snapshot().state, AgentState::Ended { .. })
        });
        assert_eq!(crash_or_outcome(&ctx, &snap, "s1"), Some(false));
        assert!(!is_running(&ctx.slot));
        assert!(last_entry_saved(&home, &repo).line.contains("crashed"));
    }

    #[test]
    fn a_file_dated_in_the_future_never_holds_the_last_sign_of_work_ahead_of_the_clock() {
        let dir = std::env::temp_dir().join(format!("plan2code-clamp-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("future.txt");
        std::fs::write(&file, "x").unwrap();
        let future = SystemTime::now() + Duration::from_secs(24 * 60 * 60);
        std::fs::File::options()
            .write(true)
            .open(&file)
            .unwrap()
            .set_modified(future)
            .unwrap();
        let seen = modified(&file).expect("a time");
        assert!(seen <= SystemTime::now(), "clamped to now");
        assert!(clamp_to_now(future) <= SystemTime::now());
        let past = SystemTime::now() - Duration::from_secs(60);
        assert_eq!(clamp_to_now(past), past, "an older time is left alone");
        // Silence fires on a clamped time once the limit has passed.
        let setup = setup();
        let quiet = SystemTime::now() - Duration::from_secs(61 * 60);
        assert!(silence_expired(
            SystemTime::now(),
            quiet,
            &setup,
            None,
            false
        ));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn stop_now_sets_the_flag_with_or_without_an_agent_and_tells_the_strip() {
        let slot: LoopSlot = Arc::new(Mutex::new(Some(record(
            "specs/x",
            vec![phase(2), phase(3)],
        ))));
        let before = current_event(&slot).unwrap();
        assert!(!before.stopping);
        assert!(before.can_stop_after, "not the last phase");
        let event = request_stop_now(&slot, None, |_| {}).expect("no agent is not an error");
        assert!(event.stopping);
        assert!(lock(&slot).as_ref().unwrap().stop_now);
        let ended = LoopStateEvent::ended();
        assert!(!ended.stopping && !ended.can_stop_after);
    }

    #[test]
    fn stop_after_toggles_and_is_refused_on_the_last_phase() {
        let slot: LoopSlot = Arc::new(Mutex::new(Some(record(
            "specs/x",
            vec![phase(2), phase(3)],
        ))));
        assert!(request_stop_after(&slot, true).unwrap().stop_after_phase);
        assert!(!request_stop_after(&slot, false).unwrap().stop_after_phase);
        assert!(!lock(&slot).as_ref().unwrap().stop_after_phase);
        lock(&slot).as_mut().unwrap().current = 1;
        let event = current_event(&slot).unwrap();
        assert!(
            !event.can_stop_after,
            "the last phase has nothing to stop after"
        );
        assert_eq!(
            request_stop_after(&slot, true),
            Err("This is the last phase".to_string())
        );
        assert!(!lock(&slot).as_ref().unwrap().stop_after_phase);
        assert!(
            request_stop_after(&slot, false).is_ok(),
            "off is always allowed"
        );
    }

    #[test]
    fn stop_after_on_then_off_carries_on_to_the_next_phase() {
        if !harness_ready("stop after toggle") {
            return;
        }
        let repo = throwaway_repo("stop-after-toggle");
        let (ctx, home) = running_loop(&repo, Limits::default());
        request_stop_after(&ctx.slot, true).unwrap();
        request_stop_after(&ctx.slot, false).unwrap();
        finish_phase_tasks(&repo, 2);
        write_session(&home, json!({ "loopOutcome": good_report(2) }));
        assert!(tick(&ctx), "the loop goes on to Phase 3");
        {
            let guard = lock(&ctx.slot);
            let rec = guard.as_ref().unwrap();
            assert_eq!(rec.current, 1);
            assert_eq!(rec.phases[0].status, PhaseStatus::Done);
        }
        end_the_test(&ctx);
    }

    #[test]
    fn stop_now_before_the_commit_commits_nothing_retries_nothing_and_marks_nothing() {
        if !harness_ready("stop now before commit") {
            return;
        }
        let repo = throwaway_repo("stop-now-before");
        let (ctx, home) = running_loop(&repo, Limits::default());
        finish_phase_tasks(&repo, 2);
        // The look began before Stop now was pressed.
        let snap = take_snapshot(&ctx).unwrap();
        request_stop_now(&ctx.slot, Some(&ctx.agent), |_| {}).unwrap();
        assert!(!handle_outcome(&ctx, &snap, &good_report(2)));
        assert!(!is_running(&ctx.slot));
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Start the lunch spec",
            "nothing was committed"
        );
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "/", "not marked");
        assert_eq!(git_in(&repo, &["diff", "--cached", "--name-only"]), "");
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(
            entry.line,
            "Stopped during Phase 2. This phase's changes stay uncommitted."
        );
    }

    #[test]
    fn stop_now_after_the_agent_ended_is_not_a_crash_and_starts_no_retry() {
        if !harness_ready("stop now not a crash") {
            return;
        }
        let repo = throwaway_repo("stop-now-crash");
        let (ctx, home, seen) = running_loop_seen(&repo, Limits::default());
        {
            let mut guard = lock(&ctx.slot);
            guard.as_mut().unwrap().setup.retry_once = true;
        }
        start_phase(&ctx, 0).expect("start the fake agent");
        fake_agent_ready(&seen, 1);
        let snap = take_snapshot(&ctx).unwrap();
        request_stop_now(&ctx.slot, Some(&ctx.agent), |_| {}).unwrap();
        // The look that began earlier meets the ended agent.
        assert!(!fail(&ctx, &snap, StopCause::Crash, "exit code 1".into()));
        assert!(!is_running(&ctx.slot));
        assert!(
            matches!(ctx.agent.snapshot().state, AgentState::Idle),
            "the agent is ended and no retry started another"
        );
        let entry = last_entry_saved(&home, &repo);
        assert_eq!(entry.result, EntryResult::Stopped);
        assert!(
            entry.line.starts_with("Stopped during Phase 2"),
            "{}",
            entry.line
        );
        assert_eq!(entry.retries, 0);
    }

    /// A pre-commit hook that says it has begun, then takes `seconds`.
    fn add_marking_slow_hook(repo: &Path, seconds: u32) {
        let hook = repo.join(".git/hooks/pre-commit");
        std::fs::create_dir_all(hook.parent().unwrap()).unwrap();
        std::fs::write(
            &hook,
            format!("#!/bin/sh\necho begun > .git/hook-begun\nsleep {seconds}\nexit 0\n"),
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
    }

    /// Press Stop now once the commit's hook has begun, and return how the
    /// phase's look went (whether the loop would go on).
    fn stop_now_during_the_commit(repo: &Path, ctx: &Ctx, phase: u32) -> bool {
        add_marking_slow_hook(repo, 2);
        finish_phase_tasks(repo, phase);
        let snap = take_snapshot(ctx).unwrap();
        let (worker, report) = (ctx.clone(), good_report(phase));
        let handle = thread::spawn(move || handle_outcome(&worker, &snap, &report));
        wait_until("the commit's hook to begin", || {
            repo.join(".git/hook-begun").exists()
        });
        request_stop_now(&ctx.slot, Some(&ctx.agent), |_| {}).unwrap();
        handle.join().expect("the look did not panic")
    }

    #[test]
    fn stop_now_while_a_slow_hook_runs_finishes_the_commit_and_nothing_follows() {
        if !harness_ready("stop now during commit") {
            return;
        }
        let repo = throwaway_repo("stop-now-during");
        let limits = Limits {
            commit_limit: Duration::from_secs(60),
            ..Limits::default()
        };
        let (ctx, home) = running_loop(&repo, limits);
        assert!(!stop_now_during_the_commit(&repo, &ctx, 2));
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver",
            "the begun commit finished"
        );
        assert_eq!(spec_status(&repo)["phases"][0]["marker"], "x");
        assert!(!is_running(&ctx.slot));
        assert!(
            matches!(ctx.agent.snapshot().state, AgentState::Idle),
            "no next phase's agent"
        );
        let report = loop_report::load(&home, &repo, "specs/lunch").unwrap();
        let passed = report
            .entries
            .iter()
            .find(|e| e.result == EntryResult::Passed);
        assert!(
            passed.is_some_and(|e| e.commit.is_some()),
            "recorded as done"
        );
        assert_eq!(
            last_entry_saved(&home, &repo).line,
            "Stopped after Phase 2 was committed, as asked"
        );
    }

    #[test]
    fn stop_now_on_the_last_phase_never_finishes_the_loop_or_runs_finalize() {
        if !harness_ready("stop now last phase") {
            return;
        }
        let repo = throwaway_repo("stop-now-last");
        let limits = Limits {
            commit_limit: Duration::from_secs(60),
            ..Limits::default()
        };
        let (ctx, home) = running_loop(&repo, limits);
        {
            let mut guard = lock(&ctx.slot);
            let rec = guard.as_mut().unwrap();
            rec.setup.after_last = AfterLast::RunFinalize;
            rec.phases[0].status = PhaseStatus::Done;
            rec.phases[0].commit = Some("abc1234".into());
            rec.current = 1;
            rec.phases[1].status = PhaseStatus::Running;
        }
        assert!(!stop_now_during_the_commit(&repo, &ctx, 3));
        assert_eq!(
            git_in(&repo, &["log", "-1", "--format=%s"]),
            "Add the driver"
        );
        let date = chrono::Local::now().format("%Y-%m-%d").to_string();
        assert!(
            !repo
                .join(format!("specs/lunch/LOOP-SUMMARY-{date}.md"))
                .exists(),
            "finish never ran"
        );
        assert!(
            matches!(ctx.agent.snapshot().state, AgentState::Idle),
            "no Finalize agent"
        );
        assert_eq!(
            last_entry_saved(&home, &repo).line,
            "Stopped after Phase 3 was committed, as asked"
        );
    }

    #[test]
    fn finish_skips_finalize_when_stop_now_was_pressed() {
        if !harness_ready("finish skips finalize") {
            return;
        }
        let repo = throwaway_repo("finish-skips");
        let (ctx, _home) = running_loop(&repo, Limits::default());
        {
            let mut guard = lock(&ctx.slot);
            let rec = guard.as_mut().unwrap();
            rec.setup.after_last = AfterLast::RunFinalize;
            for p in &mut rec.phases {
                p.status = PhaseStatus::Done;
                p.commit = Some("abc1234".into());
            }
            rec.current = 1;
            rec.stop_now = true;
        }
        finish(&ctx);
        assert!(!is_running(&ctx.slot));
        assert!(
            matches!(ctx.agent.snapshot().state, AgentState::Idle),
            "Finalize was not started"
        );
    }

    #[test]
    fn a_stale_stop_never_ends_a_newer_loops_agent() {
        if !harness_ready("stale stop") {
            return;
        }
        let repo = throwaway_repo("stale-stop");
        let (ctx, _home, seen) = running_loop_seen(&repo, Limits::default());
        start_phase(&ctx, 0).expect("start the fake agent");
        fake_agent_ready(&seen, 1);
        // Another loop took the slot; this one's watcher is stale.
        let newer = record("specs/lunch", vec![phase(2), phase(3)]);
        let newer_id = newer.run_id;
        *lock(&ctx.slot) = Some(newer);
        stop_loop(&ctx, StopCause::Crash, "stale".into(), &["resume", "fix"]);
        assert!(
            matches!(ctx.agent.snapshot().state, AgentState::Running),
            "the agent was left alone"
        );
        assert_eq!(lock(&ctx.slot).as_ref().unwrap().run_id, newer_id);
        end_the_test(&ctx);
    }

    #[test]
    fn the_watcher_failed_stop_has_its_line_and_is_never_retried() {
        let cause = StopCause::WatcherFailed("index out of bounds".into());
        assert_eq!(
            stop_line(&cause, 3, "", false),
            "The loop's watcher failed: index out of bounds. Nothing more was committed; Resume starts again"
        );
        assert!(!should_retry(&cause, &setup(), 0));
        let line = stop_line(&cause, 3, "", false);
        assert!(stop_message(&cause, &at_phase("specs/lunch", 3, 3), &line)
            .unwrap()
            .contains("watcher failed"));
        let rec = record("specs/x", vec![phase(3)]);
        assert!(evidence_markdown(&cause, &line, &rec).contains("watcher stopped working"));
        let long = StopCause::WatcherFailed("x".repeat(500));
        assert!(
            stop_line(&long, 1, "", false).len() < 200,
            "trimmed to a line"
        );
    }

    const QUIET: Duration = Duration::from_millis(300);
    const CALL_WAIT: Duration = Duration::from_secs(10);

    #[test]
    fn a_report_outlasts_a_stop_and_a_resume_and_lands_in_the_project_when_built() {
        let (ctx, _calls) = notifying_loop("report");
        let (home, project) = {
            let guard = lock(&ctx.slot);
            let rec = guard.as_ref().unwrap();
            (ctx.home.clone(), rec.project.clone())
        };
        std::fs::write(
            project.join("specs/lunch/phase-2.md"),
            "- [?] **Task 2.1:** Pick\n  - Assumed: SQLite\n",
        )
        .unwrap();
        for old in std::fs::read_dir(project.join("specs/lunch")).unwrap() {
            let old = old.unwrap();
            if old
                .file_name()
                .to_string_lossy()
                .starts_with("LOOP-SUMMARY")
            {
                std::fs::remove_file(old.path()).unwrap();
            }
        }
        // The first run: the phase reports a skip, then the quick check stops it.
        {
            let mut guard = lock(&ctx.slot);
            let rec = guard.as_mut().unwrap();
            let mut outcome = passed();
            outcome.review.as_mut().unwrap().triage = Some(Triage {
                ran: true,
                skipped: vec![Finding {
                    level: FixLevel::Warning,
                    title: "Rename the helper".into(),
                    file: "src/y.js".into(),
                    reason: Some("Outside this phase".into()),
                }],
            });
            outcome.decisions = vec!["Kept the old route".into()];
            rec.last_outcome = Some(outcome);
        }
        stop_loop(
            &ctx,
            StopCause::QuickCheck,
            "Phase 2 stopped: the quick check failed".into(),
            &["resume"],
        );
        assert!(lock(&ctx.slot).is_none());
        let saved = loop_report::load(&home, &project, "specs/lunch").unwrap();
        assert_eq!(saved.entries.len(), 1);
        assert_eq!(saved.entries[0].result, EntryResult::Stopped);
        assert_eq!(saved.entries[0].skipped[0].title, "Rename the helper");
        assert_eq!(saved.entries[0].assumed[0].note, "SQLite");
        assert_eq!(saved.entries[0].decisions, vec!["Kept the old route"]);

        // Resume: a new run holding only what is left, on the same report.
        let mut rec = RunningRecord::new(
            project.clone(),
            "specs/lunch".into(),
            setup(),
            vec![phase(3)],
        );
        rec.report = saved;
        rec.report.entries.push(ReportEntry {
            at: "t".into(),
            phase: 2,
            name: "P2".into(),
            commit: Some("abc1234".into()),
            fixed: vec![finding(FixLevel::Critical)],
            reported: true,
            review_ran: true,
            ..ReportEntry::default()
        });
        rec.report.entries.push(ReportEntry {
            at: "t".into(),
            phase: 3,
            name: "P3".into(),
            commit: Some("def5678".into()),
            reported: true,
            ..ReportEntry::default()
        });
        let run_id = rec.run_id;
        let rows = phase_rows(&rec);
        assert_eq!(
            rows.as_array().unwrap().len(),
            2,
            "the phase from before the Resume stays"
        );
        assert_eq!(rows[0]["commit"], "abc1234");
        assert_eq!(rows[0]["fixed"], 1);
        loop_report::save(&home, &project, &rec.report).unwrap();
        let resumed = Ctx {
            slot: Arc::new(Mutex::new(Some(rec))),
            agent: Arc::clone(&ctx.agent),
            console_dir: PathBuf::from("."),
            home: home.clone(),
            launch: ctx.launch.clone(),
            run_id,
            hooks: Arc::clone(&ctx.hooks),
            limits: ctx.limits,
        };
        finish(&resumed);
        let date = chrono::Local::now().format("%Y-%m-%d").to_string();
        let md =
            std::fs::read_to_string(project.join(format!("specs/lunch/LOOP-SUMMARY-{date}.md")))
                .unwrap();
        assert!(md.contains("Rename the helper"), "from before the Resume");
        assert!(md.contains("Outside this phase"));
        assert!(md.contains("Phases built by this loop: 2."));
        assert_eq!(
            loop_report::load(&home, &project, "specs/lunch"),
            None,
            "the project holds it now"
        );
    }

    #[test]
    fn a_second_report_the_same_day_gets_its_own_name() {
        let taken = |name: &str| {
            name == "LOOP-SUMMARY-2026-11-01.md" || name == "LOOP-SUMMARY-2026-11-01-2.md"
        };
        assert_eq!(
            unused_summary_name("2026-11-02", taken),
            "LOOP-SUMMARY-2026-11-02.md"
        );
        assert_eq!(
            unused_summary_name("2026-11-01", taken),
            "LOOP-SUMMARY-2026-11-01-3.md"
        );
    }

    #[test]
    fn send_a_test_confirms_the_saved_address_and_says_how_it_went() {
        let mut s = setup();
        assert_eq!(
            notify_test_confirm(&s).unwrap_err(),
            "Fill in the address first"
        );
        s.notify_url = "not an address".into();
        assert!(notify_test_confirm(&s).unwrap_err().contains("not valid"));

        let (url, calls) = listening_address();
        s.notify_url = url.clone();
        s.notify_param = "msg".into();
        assert!(notify_test_confirm(&s).unwrap().contains(&url));
        send_notify_test(&s).unwrap();
        let call = calls.recv_timeout(CALL_WAIT).unwrap();
        assert!(call.contains("Plan2Code%20test"), "{call}");

        // A port nothing listens on: the reason, and never the address.
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        s.notify_url = format!("http://127.0.0.1:{port}/secret");
        let err = send_notify_test(&s).unwrap_err();
        assert!(err.starts_with("The test was not sent: "), "{err}");
        assert!(!err.contains("secret"), "{err}");
    }

    #[test]
    fn a_finished_loop_calls_the_web_address_with_the_message() {
        let (ctx, calls) = notifying_loop("finish");
        finish(&ctx);
        let call = calls.recv_timeout(CALL_WAIT).unwrap();
        assert!(
            call.starts_with("GET /hook?msg=Plan2Code%20loop%20complete%20on%20"),
            "{call}"
        );
        // The project's folder comes first, then the spec, then the time taken.
        assert!(
            call.ends_with(
                "%20%2F%20lunch%3A%20all%202%20phases%20built.%20Elapsed%3A%20under%201m. HTTP/1.1"
            ),
            "{call}"
        );
    }

    #[test]
    fn a_stopped_loop_calls_with_its_reason_unless_the_person_stopped_it() {
        let (ctx, calls) = notifying_loop("stop");
        stop_loop(
            &ctx,
            StopCause::QuickCheck,
            "Phase 2 stopped: the quick check failed".into(),
            &["resume"],
        );
        let call = calls.recv_timeout(CALL_WAIT).unwrap();
        assert!(call.contains("loop%20stopped%20on%20"), "{call}");
        assert!(
            call.contains("%20%2F%20lunch%20at%20Phase%202%20of%203"),
            "{call}"
        );
        assert!(call.contains("the%20quick%20check%20failed"), "{call}");

        let (ctx, calls) = notifying_loop("question");
        stop_loop(&ctx, StopCause::Question, "x".into(), &["resume"]);
        let call = calls.recv_timeout(CALL_WAIT).unwrap();
        assert!(call.contains("has%20a%20question%20for%20you"), "{call}");

        let (ctx, calls) = notifying_loop("person");
        stop_loop(&ctx, StopCause::StoppedByPerson, "x".into(), &["resume"]);
        assert!(calls.recv_timeout(QUIET).is_err(), "the person is there");
    }

    #[test]
    fn a_question_holding_the_loop_calls_once_per_hold() {
        let (ctx, calls) = notifying_loop("hold");
        observe(&ctx, None, true);
        let call = calls.recv_timeout(CALL_WAIT).unwrap();
        assert!(call.contains("is%20waiting%20on%20"), "{call}");
        assert!(
            call.contains("%20%2F%20lunch%3A%20Phase%202%20of%203"),
            "{call}"
        );
        // Still the same question: no second call. Answered, then a new one: another.
        observe(&ctx, None, true);
        assert!(calls.recv_timeout(QUIET).is_err());
        observe(&ctx, None, false);
        observe(&ctx, None, true);
        assert!(calls.recv_timeout(CALL_WAIT).is_ok());
    }

    #[test]
    fn a_call_that_fails_keeps_the_loop_going_and_is_remembered() {
        let (ctx, _calls) = notifying_loop("fail");
        // A port nothing listens on.
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        lock(&ctx.slot).as_mut().unwrap().setup.notify_url =
            format!("http://127.0.0.1:{port}/secret");
        observe(&ctx, None, true);
        let start = Instant::now();
        let failure = loop {
            let seen = lock(&ctx.slot).as_ref().unwrap().notify_failure.clone();
            if let Some(failure) = seen {
                break failure;
            }
            assert!(start.elapsed() < CALL_WAIT, "the failure never came back");
            thread::sleep(Duration::from_millis(20));
        };
        assert!(!failure.contains("secret"), "{failure}");
        assert!(lock(&ctx.slot).as_ref().unwrap().waiting);
    }

    #[test]
    fn stop_after_this_phase_is_remembered_and_stop_now_ends_the_agent() {
        let slot: LoopSlot = Arc::new(Mutex::new(None));
        assert!(request_stop_after(&slot, true).is_err());
        let agent = AgentManager::new(PathBuf::from("."), Arc::new(|_| {}));
        assert!(request_stop_now(&slot, Some(&agent), |_| {}).is_err());
        *lock(&slot) = Some(record("specs/x", vec![phase(2), phase(3)]));
        let event = request_stop_after(&slot, true).unwrap();
        assert!(event.stop_after_phase);
        assert!(lock(&slot).as_ref().unwrap().stop_after_phase);
        request_stop_now(&slot, Some(&agent), |_| {}).unwrap();
        assert!(lock(&slot).as_ref().unwrap().stop_now);
        assert!(is_running(&slot));
        abandon(&slot);
        assert!(!is_running(&slot));
        assert!(current_event(&slot).is_none());
    }

    #[test]
    fn the_quit_check_lists_only_committed_phases() {
        let slot: LoopSlot = Arc::new(Mutex::new(None));
        assert!(quit_facts(&slot).is_none());
        let mut done = phase(1);
        done.status = PhaseStatus::Done;
        done.commit = Some("abc1234".into());
        let mut uncommitted = phase(2);
        uncommitted.status = PhaseStatus::Done;
        let mut rec = record("specs/x", vec![done, uncommitted, phase(3), phase(4)]);
        rec.current = 2;
        *lock(&slot) = Some(rec);
        assert_eq!(quit_facts(&slot), Some((3, 4, vec![1])));
    }

    #[test]
    fn fix_and_finalize_start_ordinary_sessions() {
        assert_eq!(
            fix_prompt("specs/x"),
            "/plan2code-3-implement specs/x/overview.md --web"
        );
        assert!(!fix_prompt("specs/x").contains("--loop"));
        assert_eq!(
            finalize_prompt("specs/x"),
            "/plan2code-4-finalize specs/x/overview.md --web"
        );
    }

    #[test]
    fn the_ask_prompt_names_the_spec_and_changes_nothing() {
        let prompt = ask_prompt("specs/x");
        assert!(prompt.contains("specs/x"), "{prompt}");
        assert!(prompt.contains("--web"), "{prompt}");
        assert!(!prompt.contains("--loop"), "{prompt}");
        assert!(!prompt.contains("--phase"), "{prompt}");
        assert!(prompt.to_lowercase().contains("change nothing"), "{prompt}");
        assert!(!prompt.contains('\u{2014}'), "{prompt}");
        // The open must not name a workflow or a spec: a hop wipes the stopped screen.
        assert!(prompt.contains("neither --workflow nor --spec"), "{prompt}");
        assert!(!prompt.contains("--workflow implement"), "{prompt}");
    }

    #[test]
    fn every_resumable_stop_offers_ask_first_and_a_finalize_only_stop_does_not() {
        assert_eq!(
            stop_can(&["resume", "fix"]),
            ["ask", "resume", "fix", "dashboard"]
        );
        assert_eq!(stop_can(&["resume"]), ["ask", "resume", "dashboard"]);
        assert_eq!(stop_can(&["finalize"]), ["finalize", "dashboard"]);
        // Never twice when a caller already named it.
        assert_eq!(stop_can(&["ask", "resume"]), ["ask", "resume", "dashboard"]);
    }

    #[test]
    fn asking_leaves_the_session_on_screen_and_fix_it_by_hand_still_forgets_it() {
        let (agent, seen) = fake_agent_manager(Path::new("."));
        let forgets = Arc::new(Mutex::new(0));
        let counter = Arc::clone(&forgets);
        agent.set_forget_session(Arc::new(move || *lock(&counter) += 1));
        let launch = fake_agent_launch();

        start_asking(&agent, &launch, ask_prompt("specs/x")).unwrap();
        wait_until("the Ask agent ready", || {
            lock(&seen).matches("FAKE-AGENT ready").count() >= 1
        });
        assert_eq!(*lock(&forgets), 0, "Ask must join the session on screen");

        // The Ask agent is still running when the next button is pressed, as in
        // the app: Fix it by hand replaces it and forgets the session.
        start_with(&agent, &launch, fix_prompt("specs/x")).unwrap();
        wait_until("the fix agent ready", || {
            lock(&seen).matches("FAKE-AGENT ready").count() >= 2
        });
        assert_eq!(*lock(&forgets), 1, "Fix it by hand must forget the session");
        let prompts = launched_prompts(&seen);
        assert_eq!(
            prompts,
            vec![ask_prompt("specs/x"), fix_prompt("specs/x")],
            "the fix prompt replaced the Ask agent's"
        );
        agent.stop();
    }

    #[test]
    fn resuming_the_loop_after_asking_replaces_the_ask_agent_and_forgets_the_session() {
        let (agent, seen) = fake_agent_manager(Path::new("."));
        let forgets = Arc::new(Mutex::new(0));
        let counter = Arc::clone(&forgets);
        agent.set_forget_session(Arc::new(move || *lock(&counter) += 1));
        let launch = fake_agent_launch();

        start_asking(&agent, &launch, ask_prompt("specs/x")).unwrap();
        wait_until("the Ask agent ready", || {
            lock(&seen).matches("FAKE-AGENT ready").count() >= 1
        });
        assert_eq!(*lock(&forgets), 0, "Ask must join the session on screen");

        let row = strength_rows()["balanced"].clone();
        start_phase_with(
            &agent,
            &launch,
            "resume prompt".into(),
            &row,
            Strength::Balanced,
        )
        .unwrap();
        wait_until("the resumed agent ready", || {
            lock(&seen).matches("FAKE-AGENT ready").count() >= 2
        });
        assert_eq!(*lock(&forgets), 1, "Resume must forget the session");
        assert_eq!(
            launched_prompts(&seen),
            vec![ask_prompt("specs/x"), "resume prompt".to_string()],
            "the resumed phase replaced the Ask agent's"
        );
        agent.stop();
    }

    /// The `ARGS` lines the fake agent has printed, one per generation, in the
    /// order they started: the prompts each launch ran with.
    fn launched_prompts(seen: &Arc<Mutex<String>>) -> Vec<String> {
        lock(seen)
            .lines()
            .filter_map(|line| {
                line.trim()
                    .strip_prefix("ARGS")
                    .map(|rest| rest.trim().to_string())
            })
            .collect()
    }

    /// A plain folder to run the fake agent in: no git or specs needed, the
    /// manager only spawns the program there.
    fn agent_folder(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("plan2code-agent-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn wait_for_generations(seen: &Arc<Mutex<String>>, count: usize) {
        let deadline = Instant::now() + Duration::from_secs(30);
        while Instant::now() < deadline {
            if launched_prompts(seen).len() >= count {
                return;
            }
            thread::sleep(Duration::from_millis(20));
        }
        panic!(
            "never saw {count} agent generations; the fake agent printed {:?}. No ARGS line means target/debug/fake-agent is older than its source: touch fake-agent/src/main.rs",
            lock(seen).as_str()
        );
    }

    #[test]
    fn new_session_opens_the_dashboard_not_the_phase_prompt_again() {
        let folder = agent_folder("restart");
        let (agent, seen) = fake_agent_manager(&folder);
        // The loop's cold start, then the usual fresh start: both transient.
        start_with(&agent, &fake_agent_launch(), "phase one prompt".into()).unwrap();
        wait_for_generations(&seen, 1);
        start_with(&agent, &fake_agent_launch(), "phase two prompt".into()).unwrap();
        wait_for_generations(&seen, 2);
        // New Session starts on the placeholder brief, not the last prompt.
        agent.restart().unwrap();
        wait_for_generations(&seen, 3);
        assert_eq!(
            launched_prompts(&seen),
            vec![
                "phase one prompt".to_string(),
                "phase two prompt".to_string(),
                String::new()
            ],
            "a transient prompt must never become what Restart starts again"
        );
        agent.stop();
    }

    #[test]
    fn a_real_brief_survives_a_transient_prompt() {
        let folder = agent_folder("brief");
        let (agent, seen) = fake_agent_manager(&folder);
        let (kind, model, effort, mode) = fake_agent_launch();
        agent
            .start(
                kind,
                model,
                effort,
                mode,
                Some("the original brief".to_string()),
            )
            .unwrap();
        wait_for_generations(&seen, 1);
        agent.start_fresh("a phase prompt".into()).unwrap();
        wait_for_generations(&seen, 2);
        agent.restart().unwrap();
        wait_for_generations(&seen, 3);
        assert_eq!(
            launched_prompts(&seen),
            vec![
                "the original brief".to_string(),
                "a phase prompt".to_string(),
                "the original brief".to_string()
            ],
            "Restart starts the stored brief again"
        );
        agent.stop();
    }
}
