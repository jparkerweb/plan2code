//! The Implementation Loop's report: everything the loop did on the person's
//! behalf, across stops and resumes, until every phase is built.
//!
//! While a build is under way the report lives in `loop-reports.json` in the
//! console's folder, saved after every phase, retry and stop. It cannot live in
//! the project yet: a file there would dirty the tree, and Resume needs a clean
//! one to commit each phase. When the last phase is built it is written to
//! `specs/<feature>/LOOP-SUMMARY-<date>.md` and its entry here goes away.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::loop_driver::{fold_key, write_atomic, Finding, Outcome};

pub const REPORTS_FILE: &str = "loop-reports.json";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryResult {
    #[default]
    Passed,
    Stopped,
    Retried,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Assumption {
    pub task: String,
    pub note: String,
}

/// One thing that happened to a phase, in the order it happened.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ReportEntry {
    pub at: String,
    pub phase: u32,
    pub name: String,
    pub result: EntryResult,
    /// Why it stopped or was retried; empty for a phase that passed.
    pub line: String,
    pub commit: Option<String>,
    pub subject: String,
    pub summary: String,
    pub tests: String,
    /// Whether the phase got as far as reporting; false for a crash or a stop mid-build.
    pub reported: bool,
    pub review_ran: bool,
    pub fixed: Vec<Finding>,
    pub skipped: Vec<Finding>,
    pub left_open: Vec<Finding>,
    pub assumed: Vec<Assumption>,
    pub blocked: Vec<String>,
    pub conflicts: Vec<String>,
    pub decisions: Vec<String>,
    /// Things the app noticed that did not stop the phase (leftover Suggestions).
    pub warnings: Vec<String>,
    pub retries: u32,
    /// What the phase ran on, with Set strength per phase on: "Thrifty",
    /// "Balanced", "Best" or "Match my session" (the word a retry stepped up
    /// to, for a retry); empty with the toggle off.
    pub strength: String,
    /// The model it ran on, with the effort folded in ("sonnet, low").
    pub model: String,
}

impl ReportEntry {
    /// An entry's review, tasks and decisions, from the phase's report.
    pub fn with_outcome(mut self, outcome: &Outcome) -> ReportEntry {
        self.reported = true;
        self.subject.clone_from(&outcome.subject);
        self.summary.clone_from(&outcome.summary);
        self.tests = match &outcome.tests {
            Some(t) if !t.summary.is_empty() => t.summary.clone(),
            Some(t) if t.passed => "passed".to_string(),
            Some(t) if t.ran => "failed".to_string(),
            _ => "not reported".to_string(),
        };
        if let Some(review) = &outcome.review {
            self.review_ran = review.ran;
            self.fixed.clone_from(&review.fixed);
            self.left_open.clone_from(&review.unfixed);
            if let Some(triage) = &review.triage {
                self.skipped.clone_from(&triage.skipped);
            }
        }
        self.blocked.clone_from(&outcome.tasks.blocked);
        self.conflicts.clone_from(&outcome.conflicts);
        self.decisions.clone_from(&outcome.decisions);
        for task in &outcome.tasks.assumed {
            if !self.assumed.iter().any(|a| &a.task == task) {
                self.assumed.push(Assumption {
                    task: task.clone(),
                    note: String::new(),
                });
            }
        }
        self
    }
}

/// A phase the loop marked done whose commit failed and whose mark could not be
/// taken back: it survives an app restart, so Resume can rebuild the phase.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct MarkedNotCommitted {
    pub phase: u32,
    pub file: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LoopReport {
    pub spec: String,
    pub started: String,
    pub entries: Vec<ReportEntry>,
    pub marked_not_committed: Option<MarkedNotCommitted>,
}

impl LoopReport {
    pub fn new(spec: &str, started: &str) -> LoopReport {
        LoopReport {
            spec: spec.to_string(),
            started: started.to_string(),
            entries: Vec::new(),
            marked_not_committed: None,
        }
    }

    pub fn set_marked(&mut self, phase: u32, file: &str) {
        self.marked_not_committed = Some(MarkedNotCommitted {
            phase,
            file: file.to_string(),
        });
    }

    pub fn clear_marked(&mut self) {
        self.marked_not_committed = None;
    }

    /// Each phase's latest pass, by phase number.
    pub fn passed(&self) -> Vec<&ReportEntry> {
        let mut seen: Vec<&ReportEntry> = Vec::new();
        for entry in self
            .entries
            .iter()
            .filter(|e| e.result == EntryResult::Passed)
        {
            seen.retain(|e| e.phase != entry.phase);
            seen.push(entry);
        }
        seen.sort_by_key(|e| e.phase);
        seen
    }
}

// ------------------------------------------------------------- the store

fn key(project: &Path, spec: &str) -> String {
    format!("{}|{spec}", fold_key(project))
}

fn read_store(home: &Path) -> Value {
    std::fs::read_to_string(home.join(REPORTS_FILE))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .filter(|store| store["schema"].as_u64() == Some(1) && store["reports"].is_object())
        .unwrap_or_else(|| json!({ "schema": 1, "reports": {} }))
}

/// The report under way for this spec, if a build of it has not finished.
pub fn load(home: &Path, project: &Path, spec: &str) -> Option<LoopReport> {
    let store = read_store(home);
    serde_json::from_value(store["reports"].get(key(project, spec))?.clone()).ok()
}

pub fn save(home: &Path, project: &Path, report: &LoopReport) -> Result<(), String> {
    let mut store = read_store(home);
    store["reports"][key(project, &report.spec)] = json!(report);
    write_atomic(&home.join(REPORTS_FILE), &store.to_string())
}

pub fn remove(home: &Path, project: &Path, spec: &str) -> Result<(), String> {
    let mut store = read_store(home);
    let gone = store["reports"]
        .as_object_mut()
        .and_then(|all| all.remove(&key(project, spec)));
    if gone.is_none() {
        return Ok(());
    }
    write_atomic(&home.join(REPORTS_FILE), &store.to_string())
}

// ------------------------------------------------------ the phase file

/// The `[?]` tasks in a phase file and their `Assumed:` notes: on the task's own
/// line or on an indented line under it.
pub fn assumptions_in(phase_text: &str) -> Vec<Assumption> {
    let mut found: Vec<Assumption> = Vec::new();
    let mut open = false;
    for line in phase_text.lines() {
        let trimmed = line.trim_start();
        let indented = trimmed.len() < line.len();
        if let Some(rest) = trimmed.strip_prefix("- [?]") {
            found.push(Assumption {
                task: task_id(rest),
                note: note_in(rest).unwrap_or_default(),
            });
            open = true;
        } else if !indented {
            open = false;
        } else if open {
            if let (Some(last), Some(note)) = (found.last_mut(), note_in(trimmed)) {
                if last.note.is_empty() {
                    last.note = note;
                }
            }
        }
    }
    found
}

fn note_in(text: &str) -> Option<String> {
    let (_, note) = text.split_once("Assumed:")?;
    let note = note.trim().trim_end_matches("**").trim();
    (!note.is_empty()).then(|| note.to_string())
}

/// `2.4` from ` **Task 2.4:** Do it`; the line itself when it names no task.
fn task_id(rest: &str) -> String {
    let id = rest.split_once("Task ").and_then(|(_, after)| {
        let id: String = after
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '.')
            .collect();
        (!id.is_empty()).then(|| id.trim_end_matches('.').to_string())
    });
    id.unwrap_or_else(|| rest.trim().to_string())
}

// ----------------------------------------------------------- the markdown

fn cell(text: &str) -> String {
    text.replace('|', "\\|").replace(['\r', '\n'], " ")
}

fn finding_line(f: &Finding) -> String {
    let file = if f.file.is_empty() {
        String::new()
    } else {
        format!(" (`{}`)", cell(&f.file))
    };
    format!("- {}: {}{file}", f.level.word(), cell(&f.title))
}

fn section(md: &mut String, title: &str, lines: &[String], none: &str) {
    md.push_str(&format!("\n**{title}**\n\n"));
    if lines.is_empty() {
        md.push_str(none);
        md.push('\n');
    } else {
        md.push_str(&lines.join("\n"));
        md.push('\n');
    }
}

fn entry_markdown(md: &mut String, e: &ReportEntry) {
    let word = match e.result {
        EntryResult::Passed => "built",
        EntryResult::Stopped => "stopped",
        EntryResult::Retried => "retried",
    };
    md.push_str(&format!(
        "\n### Phase {}: {} ({word}, {})\n\n",
        e.phase,
        cell(&e.name),
        e.at
    ));
    if !e.line.is_empty() {
        md.push_str(&format!("{}\n\n", cell(&e.line)));
    }
    if let Some(commit) = &e.commit {
        md.push_str(&format!("- Commit: `{commit}` {}\n", cell(&e.subject)));
    } else if e.result == EntryResult::Passed {
        md.push_str("- Commit: not committed\n");
    }
    if !e.strength.is_empty() {
        let on = if e.model.is_empty() {
            e.strength.clone()
        } else {
            format!("{} ({})", e.strength, e.model)
        };
        md.push_str(&format!("- Ran on: {}\n", cell(&on)));
    }
    if e.retries > 0 {
        md.push_str(&format!("- Retries: {}\n", e.retries));
    }
    if !e.warnings.is_empty() {
        let notes: Vec<String> = e.warnings.iter().map(|w| cell(w)).collect();
        md.push_str(&format!("- Warnings: {}\n", notes.join("; ")));
    }
    if !e.reported {
        md.push_str(
            "- The agent ended before reporting, so its review and decisions are unknown.\n",
        );
    } else {
        md.push_str(&format!("- Summary: {}\n", cell(&e.summary)));
        md.push_str(&format!("- Tests: {}\n", cell(&e.tests)));
    }
    if !e.blocked.is_empty() {
        md.push_str(&format!("- Blocked tasks: {}\n", e.blocked.join(", ")));
    }
    for conflict in &e.conflicts {
        md.push_str(&format!("- Spec conflict: {}\n", cell(conflict)));
    }
    let assumed: Vec<String> = e
        .assumed
        .iter()
        .map(|a| {
            let note = if a.note.is_empty() {
                "(no note in the phase file)"
            } else {
                &a.note
            };
            format!("- Task {}: {}", cell(&a.task), cell(note))
        })
        .collect();
    if e.reported || !assumed.is_empty() {
        section(md, "Assumptions it made", &assumed, "None.");
    }
    if !e.reported {
        return;
    }
    let decisions: Vec<String> = e
        .decisions
        .iter()
        .map(|d| format!("- {}", cell(d)))
        .collect();
    section(
        md,
        "Other decisions it reported",
        &decisions,
        "None reported.",
    );
    if !e.review_ran {
        md.push_str("\n**Review:** did not run.\n");
        return;
    }
    let fixed: Vec<String> = e.fixed.iter().map(finding_line).collect();
    section(md, "Findings it fixed", &fixed, "None.");
    let skipped: Vec<String> = e
        .skipped
        .iter()
        .map(|f| {
            format!(
                "{}: {}",
                finding_line(f),
                cell(f.reason.as_deref().unwrap_or("(no reason given)"))
            )
        })
        .collect();
    section(md, "Findings it chose not to fix", &skipped, "None.");
    let left: Vec<String> = e.left_open.iter().map(finding_line).collect();
    section(md, "Findings left open", &left, "None.");
}

/// The report's body: the table of phases and every entry, oldest first.
pub fn body_markdown(report: &LoopReport) -> String {
    let mut md = String::from(
        "Everything below comes from each phase's report, as its agent wrote it, except the \
         task marks, the quick check and the commits, which the app checked or made itself. \
         An agent can only report the decisions it noticed making.\n",
    );
    let passed = report.passed();
    if !passed.is_empty() {
        md.push_str(
            "\n## Phases\n\n| Phase | Commit | Subject | Fixed | Not fixed | Left open | Assumed | Other decisions | Retries |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n",
        );
        for e in &passed {
            md.push_str(&format!(
                "| Phase {}: {} | {} | {} | {} | {} | {} | {} | {} | {} |\n",
                e.phase,
                cell(&e.name),
                e.commit.as_deref().unwrap_or("not committed"),
                cell(&e.subject),
                e.fixed.len(),
                e.skipped.len(),
                e.left_open.len(),
                e.assumed.len(),
                e.decisions.len(),
                e.retries,
            ));
        }
    }
    md.push_str("\n## What happened, in order\n");
    if report.entries.is_empty() {
        md.push_str("\nNo phase has finished or stopped yet.\n");
    }
    for entry in &report.entries {
        entry_markdown(&mut md, entry);
    }
    md
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::loop_driver::FixLevel;

    fn finding(title: &str, reason: Option<&str>) -> Finding {
        Finding {
            level: FixLevel::Warning,
            title: title.into(),
            file: "src/y.js".into(),
            reason: reason.map(str::to_string),
        }
    }

    fn entry(phase: u32, result: EntryResult) -> ReportEntry {
        ReportEntry {
            at: "2026-11-01 10:00".into(),
            phase,
            name: format!("P{phase}"),
            result,
            ..ReportEntry::default()
        }
    }

    #[test]
    fn the_store_keeps_a_report_per_project_and_spec_until_it_is_removed() {
        let home = std::env::temp_dir().join(format!("plan2code-report-{}", std::process::id()));
        std::fs::create_dir_all(&home).unwrap();
        let (a, b) = (Path::new("C:/one"), Path::new("C:/two"));
        assert_eq!(load(&home, a, "specs/x"), None);
        let mut report = LoopReport::new("specs/x", "2026-11-01 10:00");
        report.entries.push(entry(1, EntryResult::Passed));
        save(&home, a, &report).unwrap();
        save(&home, b, &LoopReport::new("specs/x", "later")).unwrap();
        assert_eq!(load(&home, a, "specs/x").unwrap(), report);
        assert_eq!(load(&home, a, "specs/other"), None);
        remove(&home, a, "specs/x").unwrap();
        assert_eq!(load(&home, a, "specs/x"), None);
        assert_eq!(load(&home, b, "specs/x").unwrap().started, "later");
        remove(&home, a, "specs/x").unwrap();
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn a_broken_store_reads_as_empty_and_is_replaced() {
        let home =
            std::env::temp_dir().join(format!("plan2code-report-bad-{}", std::process::id()));
        std::fs::create_dir_all(&home).unwrap();
        std::fs::write(home.join(REPORTS_FILE), "not json").unwrap();
        assert_eq!(load(&home, Path::new("C:/one"), "specs/x"), None);
        let report = LoopReport::new("specs/x", "now");
        save(&home, Path::new("C:/one"), &report).unwrap();
        assert_eq!(load(&home, Path::new("C:/one"), "specs/x").unwrap(), report);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn assumptions_come_from_the_task_line_or_the_line_under_it() {
        let text = "# Phase 2\n\n- [x] **Task 2.1:** Done\n  - Assumed: not this one\n- [?] **Task 2.2:** Pick a store\n  - Test: through the route\n  - Assumed: SQLite, since the spec names no store\n- [?] **Task 2.3:** Pick a port. Assumed: 8080\n- [?] **Task 2.4:** No note\n\n## Notes\n\nAssumed: not under a task\n";
        assert_eq!(
            assumptions_in(text),
            vec![
                Assumption {
                    task: "2.2".into(),
                    note: "SQLite, since the spec names no store".into()
                },
                Assumption {
                    task: "2.3".into(),
                    note: "8080".into()
                },
                Assumption {
                    task: "2.4".into(),
                    note: String::new()
                },
            ]
        );
    }

    #[test]
    fn the_report_lists_every_kind_of_decision_with_its_reason() {
        let mut report = LoopReport::new("specs/x", "2026-11-01 10:00");
        let mut built = entry(2, EntryResult::Passed);
        built.reported = true;
        built.review_ran = true;
        built.commit = Some("a1b2c3d".into());
        built.subject = "Add | the driver".into();
        built.summary = "Built it".into();
        built.tests = "14 pass".into();
        built.fixed.push(finding("Null check", None));
        built
            .skipped
            .push(finding("Rename", Some("Outside this phase")));
        built.left_open.push(finding("Name the timer", None));
        built.assumed.push(Assumption {
            task: "2.2".into(),
            note: "SQLite".into(),
        });
        built.assumed.push(Assumption {
            task: "2.3".into(),
            note: String::new(),
        });
        built
            .decisions
            .push("Kept the old route for callers".into());
        built.retries = 1;
        report.entries.push(built);
        let md = body_markdown(&report);
        assert!(
            md.contains("| Phase 2: P2 | a1b2c3d | Add \\| the driver | 1 | 1 | 1 | 2 | 1 | 1 |")
        );
        assert!(md.contains("- warning: Null check (`src/y.js`)"));
        assert!(md.contains("- warning: Rename (`src/y.js`): Outside this phase"));
        assert!(md.contains("- warning: Name the timer (`src/y.js`)"));
        assert!(md.contains("- Task 2.2: SQLite"));
        assert!(md.contains("- Task 2.3: (no note in the phase file)"));
        assert!(md.contains("- Kept the old route for callers"));
        assert!(md.contains("- Tests: 14 pass"));
        assert!(md.contains("- Retries: 1"));
        assert!(!md.contains('\u{2014}'));
    }

    #[test]
    fn a_phase_that_never_reported_says_so_and_keeps_what_the_file_shows() {
        let mut report = LoopReport::new("specs/x", "2026-11-01 10:00");
        let mut stopped = entry(3, EntryResult::Stopped);
        stopped.line = "Phase 3 stopped: the agent crashed".into();
        stopped.assumed.push(Assumption {
            task: "3.1".into(),
            note: "Port 8080".into(),
        });
        report.entries.push(stopped);
        let md = body_markdown(&report);
        assert!(md.contains("Phase 3 stopped: the agent crashed"));
        assert!(md.contains("its review and decisions are unknown"));
        assert!(md.contains("- Task 3.1: Port 8080"));
        assert!(!md.contains("Findings it fixed"));
    }

    #[test]
    fn a_later_pass_is_the_phases_row_and_earlier_attempts_stay_in_the_story() {
        let mut report = LoopReport::new("specs/x", "2026-11-01 10:00");
        report.entries.push(entry(1, EntryResult::Stopped));
        let mut first = entry(1, EntryResult::Passed);
        first.subject = "first".into();
        report.entries.push(first);
        report.entries.push(entry(2, EntryResult::Passed));
        let mut again = entry(1, EntryResult::Passed);
        again.subject = "again".into();
        report.entries.push(again);
        let passed = report.passed();
        assert_eq!(passed.len(), 2);
        assert_eq!(passed[0].phase, 1);
        assert_eq!(passed[0].subject, "again");
        assert_eq!(passed[1].phase, 2);
        assert_eq!(body_markdown(&report).matches("### Phase 1").count(), 3);
    }

    #[test]
    fn warnings_show_under_the_phase_and_an_old_store_loads_without_them() {
        let mut e = entry(2, EntryResult::Passed);
        e.warnings = vec!["2 Suggestions left unfixed".into(), "a | b".into()];
        let mut report = LoopReport::new("specs/x", "2026-11-01 10:00");
        report.entries.push(e);
        let md = body_markdown(&report);
        assert!(
            md.contains("- Warnings: 2 Suggestions left unfixed; a \\| b"),
            "{md}"
        );
        let mut report = LoopReport::new("specs/x", "2026-11-01 10:00");
        report.entries.push(entry(3, EntryResult::Passed));
        assert!(!body_markdown(&report).contains("Warnings"));
        let old: ReportEntry = serde_json::from_str(r#"{"phase":4,"name":"P4"}"#).unwrap();
        assert!(old.warnings.is_empty());
    }

    #[test]
    fn a_phase_line_says_what_it_ran_on_and_an_old_store_says_nothing() {
        let mut thrifty = entry(2, EntryResult::Passed);
        thrifty.strength = "Thrifty".into();
        thrifty.model = "sonnet, low".into();
        let mut matched = entry(3, EntryResult::Passed);
        matched.strength = "Match my session".into();
        matched.model = "opus".into();
        let mut bare = entry(4, EntryResult::Passed);
        bare.strength = "Best".into();
        let mut report = LoopReport::new("specs/x", "2026-11-01 10:00");
        report.entries = vec![thrifty, matched, bare, entry(5, EntryResult::Passed)];
        let md = body_markdown(&report);
        assert!(md.contains("- Ran on: Thrifty (sonnet, low)"), "{md}");
        assert!(md.contains("- Ran on: Match my session (opus)"), "{md}");
        assert!(
            md.contains(
                "- Ran on: Best
"
            ),
            "{md}"
        );
        assert_eq!(md.matches("Ran on").count(), 3, "toggle off adds nothing");
        let old: ReportEntry = serde_json::from_str(r#"{"phase":4,"name":"P4"}"#).unwrap();
        assert!(old.strength.is_empty() && old.model.is_empty());
    }
}
