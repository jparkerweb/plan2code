//! The restart brief: what a fresh agent needs to pick a session up where it
//! stopped, written from the console's session files and the spec on disk. It
//! is derived on demand and never cached. The Ask chat is left out (FR-7).

use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::Value;

/// How many of the person's most recent answers the brief carries.
const RECENT_ANSWERS: usize = 10;

/// How many of the session's most recent `events.ndjson` lines the brief carries.
const RECENT_EVENTS: usize = 5;

/// The git argument for the last five commits, one line each.
const RECENT_COMMITS: &str = "-5";

/// How long the one-line next step may run before it is cut.
const NEXT_STEP_MAX: usize = 200;

/// The skill a console workflow runs, as the dashboard launches it.
pub fn skill_for_workflow(workflow: &str) -> Option<&'static str> {
    Some(match workflow {
        "init" => "plan2code-init",
        "init-update" => "plan2code-init-update",
        "pathfinder" => "plan2code-0-pathfinder",
        "plan" => "plan2code-1-plan",
        "revise-plan" => "plan2code-1b-revise-plan",
        "quick-task" => "plan2code-quick-task",
        "document" => "plan2code-2-document",
        "implement" => "plan2code-3-implement",
        "implement-review" => "plan2code-3-implement-review",
        "review" => "plan2code-review",
        "finalize" => "plan2code-4-finalize",
        "handoff" => "plan2code-handoff",
        "git" => "plan2code-git",
        "changelog" => "plan2code-changelog",
        "xray" => "plan2code-xray",
        "diagnose" => "plan2code-diagnose",
        _ => return None,
    })
}

/// What the repository looks like now: `git status --short`, and the last
/// commits. `None` when the folder is not a git repository.
pub struct GitSummary {
    pub status: String,
    pub log: String,
}

pub fn git_summary(folder: &Path) -> Option<GitSummary> {
    let status = git(folder, &["status", "--short"])?;
    // A repository with no commits yet has no log: the status alone is the record.
    let log = git(folder, &["log", RECENT_COMMITS, "--oneline"]).unwrap_or_default();
    Some(GitSummary { status, log })
}

/// Longest a git call may hold up the caller. The brief is built while the
/// agent's state is locked, so a slow repository must not stall the window.
const GIT_TIMEOUT: Duration = Duration::from_secs(2);

fn git(folder: &Path, args: &[&str]) -> Option<String> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(folder)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW, as the console calls are
    }
    let mut child = command.spawn().ok()?;
    let mut out = child.stdout.take()?;
    let reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = out.read_to_end(&mut bytes);
        bytes
    });
    let deadline = Instant::now() + GIT_TIMEOUT;
    let status = loop {
        if let Some(status) = child.try_wait().ok()? {
            break status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        thread::sleep(Duration::from_millis(20));
    };
    let bytes = reader.join().ok()?;
    status
        .success()
        .then(|| String::from_utf8_lossy(&bytes).trim_end().to_string())
}

/// The brief as Markdown. `state` is a session's `state.json`; `spec_dir` is
/// the spec folder on disk, when the session has one; `git` is the repository
/// summary, when the folder is one; `events` is the session's `events.ndjson`,
/// oldest first.
pub fn build_brief(
    state: &Value,
    spec_dir: Option<&Path>,
    git: Option<&GitSummary>,
    events: &[Value],
) -> String {
    let workflow = str_field(state, "workflow").unwrap_or("");
    let skill = skill_for_workflow(workflow);
    let spec = str_field(state, "specDir");
    let mut out = String::new();

    out.push_str("## Where you were\n\n");
    match skill {
        Some(skill) => out.push_str(&format!("- Skill: {skill} (workflow `{workflow}`)\n")),
        None => out.push_str(&format!("- Workflow: `{workflow}`\n")),
    }
    match spec {
        Some(spec) => out.push_str(&format!("- Spec: {spec}\n")),
        None => out.push_str("- Spec: none yet\n"),
    }
    out.push('\n');

    out.push_str("## Progress\n\n");
    let headline = state.get("headline");
    let stage = headline.and_then(|h| str_field(h, "stage")).unwrap_or("");
    let cleared = headline
        .and_then(|h| h.get("cleared"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let total = headline
        .and_then(|h| h.get("total"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let activity = state
        .get("agent")
        .and_then(|a| str_field(a, "activity"))
        .map(str::trim)
        .filter(|a| !a.is_empty());
    if !stage.is_empty() {
        out.push_str(&format!("{stage}: {cleared} of {total} done.\n"));
        if let Some(activity) = activity {
            out.push_str(&format!("Doing: {activity}\n"));
        }
        out.push('\n');
    } else if let Some(activity) = activity {
        out.push_str(&format!("Doing: {activity}\n\n"));
    } else {
        out.push_str("No progress posted yet.\n\n");
    }

    let items = state
        .get("items")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);

    out.push_str("### Open questions\n\n");
    let open: Vec<&Value> = items
        .iter()
        .filter(|i| matches!(str_field(i, "status"), Some("open" | "reopened")))
        .collect();
    if open.is_empty() {
        out.push_str("None.\n\n");
    } else {
        for item in open {
            out.push_str(&format!("- {}\n", title_of(item)));
        }
        out.push('\n');
    }

    out.push_str("## Recent answers and decisions\n\n");
    let answered: Vec<&Value> = items
        .iter()
        .filter(|i| str_field(i, "status") == Some("answered"))
        .collect();
    let recent = &answered[answered.len().saturating_sub(RECENT_ANSWERS)..];
    if recent.is_empty() {
        out.push_str("None yet.\n\n");
    } else {
        for item in recent {
            let answer = answer_text(item);
            let answer = if answer.is_empty() {
                "answered".to_string()
            } else {
                answer
            };
            out.push_str(&format!("- {}: {answer}\n", title_of(item)));
        }
        out.push('\n');
    }

    if let Some(git) = git {
        out.push_str("## Git\n\n");
        out.push_str("Changes:\n\n```\n");
        out.push_str(if git.status.is_empty() {
            "clean"
        } else {
            &git.status
        });
        out.push_str("\n```\n\n");
        if !git.log.is_empty() {
            out.push_str("Last commits:\n\n```\n");
            out.push_str(&git.log);
            out.push_str("\n```\n\n");
        }
    }

    if !events.is_empty() {
        out.push_str("## Recent activity\n\n");
        let recent = &events[events.len().saturating_sub(RECENT_EVENTS)..];
        for event in recent {
            out.push_str(&format!("- {}\n", render_event(event)));
        }
        out.push('\n');
    }

    out.push_str("## Next task\n\n");
    out.push_str(&next_step(spec_dir, skill));
    out.push('\n');
    out
}

/// One `events.ndjson` line, as a terse line for a fresh agent. A shape this
/// does not special-case falls back to its raw `type`.
fn render_event(event: &Value) -> String {
    let kind = str_field(event, "type").unwrap_or("event");
    match kind {
        "post" => {
            let items = event.get("items").and_then(Value::as_u64).unwrap_or(0);
            format!("post ({items} items)")
        }
        "consume" => match str_field(event, "kind") {
            Some(kind) => format!("consume: {kind}"),
            None => "consume".to_string(),
        },
        "open" => {
            if event
                .get("resumed")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                "open (resumed)".to_string()
            } else {
                "open".to_string()
            }
        }
        other => other.to_string(),
    }
}

/// The one-line next step: the first open task of the spec's in-progress phase
/// (or, failing that, the first phase not started); otherwise the skill's name;
/// otherwise "Open the dashboard".
pub fn next_step(spec_dir: Option<&Path>, skill: Option<&str>) -> String {
    if let Some(task) = spec_dir.and_then(open_task) {
        return cut(&task);
    }
    match skill {
        Some(skill) => format!("Continue with {skill}"),
        None => "Open the dashboard".to_string(),
    }
}

/// The first `- [ ]` task line of the active phase file, as one line of text.
fn open_task(spec_dir: &Path) -> Option<String> {
    let overview = fs::read_to_string(spec_dir.join("overview.md")).ok()?;
    let phase = active_phase(&overview)?;
    let text = fs::read_to_string(spec_dir.join(format!("phase-{phase}.md"))).ok()?;
    let line = text
        .lines()
        .map(str::trim_start)
        .find(|l| l.starts_with("- [ ]"))?;
    Some(line.trim_start_matches("- [ ]").trim().replace("**", ""))
}

/// The phase number the overview marks in progress (`[/]`), else the first
/// one not started (`[ ]`).
fn active_phase(overview: &str) -> Option<u32> {
    let phase_of = |line: &str| {
        let rest = &line[line.find("phase-")? + "phase-".len()..];
        let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        digits.parse::<u32>().ok()
    };
    let rows = || {
        overview
            .lines()
            .map(str::trim_start)
            .filter(|l| l.starts_with("- ["))
    };
    rows()
        .find(|l| l.starts_with("- [/]"))
        .and_then(phase_of)
        .or_else(|| rows().find(|l| l.starts_with("- [ ]")).and_then(phase_of))
}

fn cut(text: &str) -> String {
    let mut out: String = text.chars().take(NEXT_STEP_MAX).collect();
    if text.chars().count() > NEXT_STEP_MAX {
        out.push('…');
    }
    out
}

fn str_field<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(Value::as_str)
}

fn title_of(item: &Value) -> String {
    let title = str_field(item, "title")
        .or_else(|| str_field(item, "id"))
        .unwrap_or("(untitled)");
    title.trim().to_string()
}

/// An answer as the person gave it: the option's label for a pick, plus any
/// words they typed. Empty when the answer carries nothing to show.
fn answer_text(item: &Value) -> String {
    let Some(answer) = item.get("answer") else {
        return String::new();
    };
    let options = item.get("options").and_then(Value::as_array);
    let label = |k: &str| {
        options
            .and_then(|list| list.iter().find(|o| str_field(o, "k") == Some(k)))
            .and_then(|o| str_field(o, "text"))
            .unwrap_or(k)
            .to_string()
    };
    let mut parts: Vec<String> = Vec::new();
    if let Some(k) = str_field(answer, "k") {
        parts.push(label(k));
    }
    if let Some(list) = answer.get("ks").and_then(Value::as_array) {
        let picks: Vec<String> = list.iter().filter_map(Value::as_str).map(label).collect();
        if !picks.is_empty() {
            parts.push(picks.join(", "));
        }
    }
    if let Some(yes) = answer.get("yes").and_then(Value::as_bool) {
        parts.push(if yes { "yes" } else { "no" }.to_string());
    }
    if let Some(verdict) = str_field(answer, "verdict") {
        parts.push(verdict.to_string());
    }
    if let Some(text) = str_field(answer, "text")
        .map(str::trim)
        .filter(|t| !t.is_empty())
    {
        parts.push(text.to_string());
    }
    parts.join("; ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fixture(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("plan2code-brief-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn mid_implement_spec() -> std::path::PathBuf {
        let spec = fixture("spec").join("specs").join("feature");
        fs::create_dir_all(&spec).unwrap();
        fs::write(
            spec.join("overview.md"),
            "- [x] [Phase 1: Foundations](./phase-1.md)\n- [/] [Phase 2: Restart](./phase-2.md)\n- [ ] [Phase 3: Later](./phase-3.md)\n",
        )
        .unwrap();
        fs::write(spec.join("phase-2.md"), "## Tasks\n\n- [x] **Task 2.1:** Done already\n- [ ] **Task 2.2:** Write the **reader**\n- [ ] **Task 2.3:** Later\n").unwrap();
        spec
    }

    fn mid_implement_state() -> Value {
        json!({
            "schema": 1,
            "workflow": "implement",
            "specDir": "specs/feature",
            "headline": { "stage": "Phase 2: Restart", "cleared": 1, "total": 3 },
            "items": [
                { "id": "q1", "title": "Which format", "status": "answered", "kind": "choice",
                  "options": [{ "k": "A", "text": "Markdown" }, { "k": "B", "text": "Plain text" }],
                  "answer": { "k": "A" } },
                { "id": "q2", "title": "Keep the header", "status": "answered", "kind": "confirm", "answer": { "yes": true } },
                { "id": "q3", "title": "Anything else?", "status": "open", "kind": "text" }
            ]
        })
    }

    #[test]
    fn a_mid_implement_session_carries_every_section() {
        let spec = mid_implement_spec();
        let git = GitSummary {
            status: " M src/lib.rs".to_string(),
            log: "abc1234 Add the reader".to_string(),
        };
        let brief = build_brief(&mid_implement_state(), Some(&spec), Some(&git), &[]);
        assert!(brief.contains("Skill: plan2code-3-implement (workflow `implement`)"));
        assert!(brief.contains("Spec: specs/feature"));
        assert!(brief.contains("Phase 2: Restart: 1 of 3 done."));
        assert!(brief.contains("### Open questions\n\n- Anything else?"));
        assert!(brief.contains("- Which format: Markdown"));
        assert!(brief.contains("- Keep the header: yes"));
        assert!(brief.contains(" M src/lib.rs"));
        assert!(brief.contains("abc1234 Add the reader"));
        assert!(brief.contains("## Next task\n\nTask 2.2: Write the reader"));
    }

    #[test]
    fn the_brief_names_only_the_last_ten_answers() {
        let items: Vec<Value> = (0..12)
            .map(|n| json!({ "id": format!("q{n}"), "title": format!("Question {n}"), "status": "answered", "answer": { "text": format!("Answer {n}") } }))
            .collect();
        let state = json!({ "schema": 1, "workflow": "pathfinder", "items": items });
        let brief = build_brief(&state, None, None, &[]);
        assert!(!brief.contains("Question 0:"));
        assert!(!brief.contains("Question 1:"));
        assert!(brief.contains("- Question 2: Answer 2"));
        assert!(brief.contains("- Question 11: Answer 11"));
    }

    #[test]
    fn a_pathfinder_session_without_a_spec_says_so() {
        let state = json!({ "schema": 1, "workflow": "pathfinder", "headline": { "stage": "Charting", "cleared": 2, "total": 5 } });
        let brief = build_brief(&state, None, None, &[]);
        assert!(brief.contains("Skill: plan2code-0-pathfinder"));
        assert!(brief.contains("- Spec: none yet"));
        assert!(!brief.contains("## Git"));
        assert!(brief.contains("## Next task\n\nContinue with plan2code-0-pathfinder"));
    }

    #[test]
    fn a_session_with_no_spec_and_no_skill_opens_the_dashboard() {
        let state = json!({ "schema": 1, "workflow": "dashboard" });
        assert!(
            build_brief(&state, None, None, &[]).ends_with("## Next task\n\nOpen the dashboard\n")
        );
    }

    #[test]
    fn chat_entries_never_reach_the_brief() {
        let home = fixture("chat");
        let dir = home.join("sessions").join("s1");
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("state.json"),
            r#"{"schema": 1, "workflow": "implement"}"#,
        )
        .unwrap();
        fs::write(
            dir.join("chat.ndjson"),
            "{\"kind\":\"ask\",\"text\":\"CHAT-ONLY-WORDS\"}\n",
        )
        .unwrap();
        let session = crate::session_reader::load(&home, "s1").unwrap();
        let brief = build_brief(&session.state, None, None, &[]);
        assert!(!brief.contains("CHAT-ONLY-WORDS"));
    }

    #[test]
    fn a_folder_that_is_not_a_repository_has_no_git_summary() {
        assert!(git_summary(&fixture("not-a-repo")).is_none());
    }

    #[test]
    fn the_brief_names_what_the_agent_was_doing() {
        let state = json!({
            "schema": 1,
            "workflow": "implement",
            "headline": { "stage": "Phase 2: Restart", "cleared": 1, "total": 3 },
            "agent": { "status": "working", "activity": "Spiking Claude's context signal (Task 10.1)" },
        });
        let brief = build_brief(&state, None, None, &[]);
        assert!(brief.contains(
            "Phase 2: Restart: 1 of 3 done.\nDoing: Spiking Claude's context signal (Task 10.1)\n"
        ));
    }

    #[test]
    fn an_activity_without_a_headline_still_shows() {
        let state = json!({ "schema": 1, "workflow": "implement", "agent": { "status": "working", "activity": "Reading the spec" } });
        let brief = build_brief(&state, None, None, &[]);
        assert!(brief.contains("Doing: Reading the spec\n"));
        assert!(!brief.contains("No progress posted yet."));
    }

    #[test]
    fn an_empty_activity_falls_back_to_no_progress_posted() {
        let state = json!({ "schema": 1, "workflow": "implement", "agent": { "status": "idle", "activity": "" } });
        let brief = build_brief(&state, None, None, &[]);
        assert!(brief.contains("No progress posted yet."));
    }

    #[test]
    fn the_brief_names_a_few_recent_events() {
        let state = json!({ "schema": 1, "workflow": "implement" });
        let events = vec![
            json!({ "at": "2026-10-23T01:00:00.000Z", "type": "listening", "port": 4100 }),
            json!({ "at": "2026-10-23T01:08:00.000Z", "type": "open", "resumed": true }),
            json!({ "at": "2026-10-23T01:08:47.152Z", "type": "post", "items": 3 }),
            json!({ "at": "2026-10-23T01:09:00.000Z", "type": "consume", "kind": "submit" }),
        ];
        let brief = build_brief(&state, None, None, &events);
        assert!(brief.contains("## Recent activity\n\n- listening\n- open (resumed)\n- post (3 items)\n- consume: submit\n"));
    }

    #[test]
    fn only_the_last_five_events_are_named() {
        let state = json!({ "schema": 1, "workflow": "implement" });
        let events: Vec<Value> = (0..8)
            .map(|n| json!({ "type": "upload", "id": format!("f{n}") }))
            .collect();
        let brief = build_brief(&state, None, None, &events);
        assert_eq!(brief.matches("- upload\n").count(), RECENT_EVENTS);
    }

    #[test]
    fn no_events_means_no_recent_activity_section() {
        let state = json!({ "schema": 1, "workflow": "implement" });
        assert!(!build_brief(&state, None, None, &[]).contains("## Recent activity"));
    }

    #[test]
    fn a_skill_name_maps_to_its_workflow() {
        assert_eq!(
            skill_for_workflow("quick-task"),
            Some("plan2code-quick-task")
        );
        assert_eq!(skill_for_workflow("unknown"), None);
    }
}
