//! What a Restart leaves for the dashboard: the restart brief, written as a
//! pick-up handoff, so the fresh agent (which starts on the plain `/plan2code`
//! prompt and lands on the dashboard) finds the chip waiting. Nothing new is
//! stored anywhere: the brief is built from the session's files each time.

use std::path::Path;
use std::sync::Mutex;

use chrono::{DateTime, Local};
use serde_json::Value;

use crate::brief;
use crate::handoff;
use crate::session_reader;

pub const READY_NOTE: &str = "Brief ready on the dashboard";

/// The handoff the last Restart wrote. The next Restart retires it if the person
/// has not picked it up, so unused briefs do not pile up as chips.
static LAST_BRIEF: Mutex<Option<String>> = Mutex::new(None);

/// Write the brief for session `sid` as a handoff. Returns the handoff's id,
/// or `None` when there is nothing worth picking up: a workflow with no mapped
/// skill (the dashboard, or one not yet known), whose only next step would be
/// "Open the dashboard" where the fresh agent lands anyway, and a session that
/// finished, whose finished screen already named what comes next, and one
/// that has posted nothing yet (no spec, progress, activity or questions),
/// whose brief would only repeat the skill's name. A session
/// that names no worktree is an error, not a `None`, since that is a broken
/// session rather than an empty one.
pub fn leave_brief(console_home: &Path, handoffs: &Path, sid: &str, when: DateTime<Local>) -> Result<Option<String>, String> {
    let session = session_reader::load(console_home, sid).map_err(|e| e.to_string())?;
    let state = &session.state;
    let workflow = text(state, "workflow").unwrap_or("");
    let Some(skill) = brief::skill_for_workflow(workflow) else { return Ok(None) };
    if finished(state) || empty(state) {
        return Ok(None);
    }
    let worktree = text(state, "worktree").ok_or("the session names no worktree")?;
    let project = text(state, "project").unwrap_or(worktree);
    let spec = text(state, "specDir").filter(|s| valid_spec(s));
    let spec_dir = spec.map(|s| Path::new(worktree).join(s));
    let git = brief::git_summary(Path::new(worktree));
    let events = session_reader::read_ndjson(&session.dir.join("events.ndjson"));
    let body = brief::build_brief(state, spec_dir.as_deref(), git.as_ref(), &events);
    let title = match spec {
        Some(spec) => format!("Restart of {skill} on {spec}"),
        None => format!("Restart of {skill}"),
    };
    let record = handoff::Record { title: &title, worktree, project, spec, workflow, skill };
    handoff::write(handoffs, when, &record, &body).map(Some)
}

/// The bar's line for a Restart on session `sid`, written to the real console
/// and handoff folders. `None` when there was nothing to leave.
pub fn note_for_restart(sid: &str) -> Option<String> {
    let console_home = session_reader::console_home()?;
    let handoffs = handoff::handoffs_dir()?;
    match leave_brief(&console_home, &handoffs, sid, handoff::now()) {
        Ok(Some(id)) => {
            let previous = LAST_BRIEF.lock().ok().and_then(|mut last| last.replace(id.clone()));
            if let Some(previous) = previous.filter(|p| *p != id) {
                let _ = handoff::retire_if_unused(&handoffs, &previous);
            }
            Some(READY_NOTE.to_string())
        }
        Ok(None) => None,
        Err(why) => Some(format!("The brief could not be written: {why}")),
    }
}

fn text<'a>(state: &'a Value, key: &str) -> Option<&'a str> {
    state.get(key).and_then(Value::as_str).filter(|s| !s.is_empty())
}

/// The session posted a `finish` that is not a pause. A pause's headline starts
/// with "Paused" (the page's `finishPaused`) and keeps a place worth picking up.
fn finished(state: &Value) -> bool {
    let Some(finish) = state.get("finish").filter(|f| f.is_object()) else { return false };
    let headline = finish.get("headline").and_then(Value::as_str).unwrap_or("").trim_start();
    !headline.get(..6).is_some_and(|word| word.eq_ignore_ascii_case("paused"))
}

/// Nothing a fresh agent could pick up beyond the skill's name.
fn empty(state: &Value) -> bool {
    let stage = state.get("headline").and_then(|h| text(h, "stage"));
    let activity = state.get("agent").and_then(|a| text(a, "activity")).filter(|a| !a.trim().is_empty());
    let items = state.get("items").and_then(Value::as_array).is_some_and(|items| !items.is_empty());
    text(state, "specDir").is_none() && stage.is_none() && activity.is_none() && !items
}

fn valid_spec(spec: &str) -> bool {
    spec.strip_prefix("specs/").is_some_and(|name| !name.is_empty() && name != "." && name != ".." && !name.contains(['/', '\\']))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use std::fs;
    use std::path::PathBuf;

    fn fixture(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("plan2code-restart-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A console home with one session on `workflow`, and a project with a spec.
    fn session(name: &str, workflow: &str, spec: Option<&str>) -> (PathBuf, PathBuf, PathBuf) {
        let root = fixture(name);
        let home = root.join("console");
        let project = root.join("project");
        let dir = home.join("sessions").join("s1");
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(&project).unwrap();
        let state = serde_json::json!({
            "schema": 1,
            "workflow": workflow,
            "specDir": spec,
            "worktree": project.to_string_lossy(),
            "project": project.to_string_lossy(),
            "headline": { "stage": "Phase 5: Restart brief", "cleared": 4, "total": 11 },
            "items": [],
        });
        fs::write(dir.join("state.json"), state.to_string()).unwrap();
        (home, project, root.join("handoffs"))
    }

    fn when() -> DateTime<Local> {
        Local.with_ymd_and_hms(2026, 10, 21, 14, 5, 0).unwrap()
    }

    #[test]
    fn a_mid_implement_session_leaves_a_pick_up_the_dashboard_lists() {
        let (home, project, handoffs) = session("pickup", "implement", Some("specs/feature"));
        let spec = project.join("specs").join("feature");
        fs::create_dir_all(&spec).unwrap();
        fs::write(spec.join("overview.md"), "- [/] [Phase 5: Restart](./phase-5.md)\n").unwrap();
        fs::write(spec.join("phase-5.md"), "- [ ] **Task 5.1:** Create the reader\n").unwrap();

        let id = leave_brief(&home, &handoffs, "s1", when()).unwrap().expect("a handoff");
        assert_eq!(id, "2026-10-21-1405-handoff");
        let record: Value = serde_json::from_str(&fs::read_to_string(handoffs.join(format!("{id}.json"))).unwrap()).unwrap();
        assert_eq!(record["workflow"], "implement");
        assert_eq!(record["spec"], "specs/feature");
        let doc = fs::read_to_string(handoffs.join(format!("{id}.md"))).unwrap();
        assert!(doc.contains("## Next task\n\nTask 5.1: Create the reader"));
        assert!(doc.contains("Phase 5: Restart brief: 4 of 11 done."));
    }

    #[test]
    fn a_dashboard_session_leaves_nothing() {
        let (home, _, handoffs) = session("dashboard", "dashboard", None);
        assert_eq!(leave_brief(&home, &handoffs, "s1", when()).unwrap(), None);
        assert!(!handoffs.exists());
    }

    #[test]
    fn a_skill_that_has_posted_nothing_leaves_nothing() {
        let (home, _, handoffs) = session("blank", "quick-task", None);
        let file = home.join("sessions").join("s1").join("state.json");
        let mut state: Value = serde_json::from_str(&fs::read_to_string(&file).unwrap()).unwrap();
        state["headline"] = Value::Null;
        fs::write(&file, state.to_string()).unwrap();
        assert_eq!(leave_brief(&home, &handoffs, "s1", when()).unwrap(), None);
    }

    #[test]
    fn a_finished_session_leaves_nothing_but_a_paused_one_does() {
        let (home, _, handoffs) = session("finished", "implement", Some("specs/feature"));
        let file = home.join("sessions").join("s1").join("state.json");
        let mut state: Value = serde_json::from_str(&fs::read_to_string(&file).unwrap()).unwrap();
        state["finish"] = serde_json::json!({ "headline": "Phase 5 is built", "dashboard": true });
        fs::write(&file, state.to_string()).unwrap();
        assert_eq!(leave_brief(&home, &handoffs, "s1", when()).unwrap(), None);

        state["finish"] = serde_json::json!({ "headline": "Paused at Phase 5" });
        fs::write(&file, state.to_string()).unwrap();
        assert!(leave_brief(&home, &handoffs, "s1", when()).unwrap().is_some());
    }

    #[test]
    fn the_brief_carries_the_agent_activity_and_recent_events() {
        let (home, _project, handoffs) = session("activity", "implement", None);
        let dir = home.join("sessions").join("s1");
        let mut state: Value = serde_json::from_str(&fs::read_to_string(dir.join("state.json")).unwrap()).unwrap();
        state["agent"] = serde_json::json!({ "status": "working", "activity": "Spiking Claude's context signal (Task 10.1)" });
        fs::write(dir.join("state.json"), state.to_string()).unwrap();
        fs::write(
            dir.join("events.ndjson"),
            "{\"at\":\"2026-10-23T01:08:47.152Z\",\"type\":\"post\",\"items\":0}\n{\"at\":\"2026-10-23T01:09:00.000Z\",\"type\":\"consume\",\"kind\":\"submit\"}\n",
        )
        .unwrap();

        let id = leave_brief(&home, &handoffs, "s1", when()).unwrap().expect("a handoff");
        let doc = fs::read_to_string(handoffs.join(format!("{id}.md"))).unwrap();
        assert!(doc.contains("Doing: Spiking Claude's context signal (Task 10.1)"));
        assert!(doc.contains("## Recent activity\n\n- post (0 items)\n- consume: submit\n"));
    }

    #[test]
    fn a_session_that_does_not_exist_is_an_error_not_a_brief() {
        let (home, _, handoffs) = session("missing", "implement", None);
        assert!(leave_brief(&home, &handoffs, "nope", when()).is_err());
    }

    #[test]
    fn a_spec_that_is_not_one_folder_is_left_out_of_the_record() {
        let (home, _, handoffs) = session("badspec", "pathfinder", Some("specs/a/b"));
        let id = leave_brief(&home, &handoffs, "s1", when()).unwrap().unwrap();
        let record: Value = serde_json::from_str(&fs::read_to_string(handoffs.join(format!("{id}.json"))).unwrap()).unwrap();
        assert!(record["spec"].is_null());
    }
}
