//! Writes a handoff the dashboard already knows how to list: a `.md` document
//! and its `.json` record in `~/.plan2code/handoffs/`, in the shape
//! `src/web-console/handoffs.mjs` reads (`v: 1`, the local-minute id, `usedAt`
//! null). The console is not changed for this, so the dashboard's **Pick it up
//! here** chip appears as it does for a handoff the Handoff skill wrote.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Datelike, Local, SecondsFormat, Timelike, Utc};
use serde_json::json;

/// `~/.plan2code/handoffs`, or `PLAN2CODE_HANDOFFS_DIR` when it is moved.
pub fn handoffs_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("PLAN2CODE_HANDOFFS_DIR") {
        return Some(PathBuf::from(dir));
    }
    Some(std::env::home_dir()?.join(".plan2code").join("handoffs"))
}

/// What the dashboard needs to resume the session the handoff came from.
pub struct Record<'a> {
    pub title: &'a str,
    pub worktree: &'a str,
    pub project: &'a str,
    /// `specs/<name>`, or none.
    pub spec: Option<&'a str>,
    pub workflow: &'a str,
    pub skill: &'a str,
}

/// Write `body` as the handoff's document and the record beside it, under an
/// id made from `when`'s local minute. Returns the id. The record is claimed
/// exclusively, so two writes in the same minute never share an id; a failed
/// write leaves nothing behind.
pub fn write(
    dir: &Path,
    when: DateTime<Local>,
    record: &Record,
    body: &str,
) -> Result<String, String> {
    validate(record)?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let base = format!(
        "{:04}-{:02}-{:02}-{:02}{:02}-handoff",
        when.year(),
        when.month(),
        when.day(),
        when.hour(),
        when.minute()
    );
    let written = when
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    for n in 1.. {
        let id = if n == 1 {
            base.clone()
        } else {
            format!("{base}-{n}")
        };
        let md = dir.join(format!("{id}.md"));
        let json_file = dir.join(format!("{id}.json"));
        if md.exists() {
            continue;
        }
        let mut claim = match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&json_file)
        {
            Ok(file) => file,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.to_string()),
        };
        let meta = json!({
            "v": 1,
            "id": id,
            "title": record.title,
            "worktree": record.worktree,
            "project": record.project,
            "spec": record.spec,
            "workflow": record.workflow,
            "skill": record.skill,
            "written": written,
            "fromStop": false,
            "usedAt": null,
        });
        let text = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())? + "\n";
        if let Err(e) = claim.write_all(text.as_bytes()) {
            let _ = fs::remove_file(&json_file);
            return Err(e.to_string());
        }
        if let Err(e) = write_document(&md, &title_line(record.title), body) {
            let _ = fs::remove_file(&json_file);
            return Err(e);
        }
        return Ok(id);
    }
    unreachable!("the id loop only ends by returning")
}

fn write_document(md: &Path, heading: &str, body: &str) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(md)
        .map_err(|e| e.to_string())?;
    file.write_all(format!("{heading}\n\n{body}").as_bytes())
        .map_err(|e| e.to_string())
}

fn title_line(title: &str) -> String {
    format!("# Handoff: {title}")
}

/// Delete a handoff the person has not picked up (its record has no `usedAt`),
/// both files. A picked-up one, or one already gone, is left alone.
pub fn retire_if_unused(dir: &Path, id: &str) -> Result<(), String> {
    let json_file = dir.join(format!("{id}.json"));
    let Ok(text) = fs::read_to_string(&json_file) else {
        return Ok(());
    };
    let used = serde_json::from_str::<serde_json::Value>(&text)
        .ok()
        .is_some_and(|meta| !meta["usedAt"].is_null());
    if used {
        return Ok(());
    }
    for file in [json_file, dir.join(format!("{id}.md"))] {
        match fs::remove_file(&file) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

/// The same rules the console applies to the record, so a bad field is refused
/// here rather than written and then ignored.
fn validate(record: &Record) -> Result<(), String> {
    let lower_dashes =
        |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_lowercase() || c == '-');
    if !lower_dashes(record.workflow) {
        return Err(format!(
            "workflow must be lowercase letters and dashes, got {:?}",
            record.workflow
        ));
    }
    let skill_ok = !record.skill.is_empty()
        && record
            .skill
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if !skill_ok {
        return Err(format!(
            "skill must be a skill name, got {:?}",
            record.skill
        ));
    }
    if let Some(spec) = record.spec {
        let name = spec.strip_prefix("specs/");
        if name.is_none_or(|n| {
            n.is_empty() || n == "." || n == ".." || n.contains('/') || n.contains('\\')
        }) {
            return Err(format!("spec must be specs/<name>, got {spec:?}"));
        }
    }
    Ok(())
}

/// The clock's local time, for the id. Tests pass their own.
pub fn now() -> DateTime<Local> {
    Local::now()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn fixture(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("plan2code-handoff-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn record() -> Record<'static> {
        Record {
            title: "Restart of plan2code-3-implement",
            worktree: "C:\\git\\plan2code",
            project: "C:\\git\\plan2code",
            spec: Some("specs/feature"),
            workflow: "implement",
            skill: "plan2code-3-implement",
        }
    }

    fn at(hour: u32, minute: u32) -> DateTime<Local> {
        Local
            .with_ymd_and_hms(2026, 10, 21, hour, minute, 0)
            .unwrap()
    }

    #[test]
    fn the_record_has_the_shape_the_dashboard_reads() {
        let dir = fixture("shape");
        let id = write(&dir, at(13, 52), &record(), "## Next task\n\nTask 5.2").unwrap();
        assert_eq!(id, "2026-10-21-1352-handoff");
        let meta: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(dir.join(format!("{id}.json"))).unwrap())
                .unwrap();
        assert_eq!(meta["v"], 1);
        assert_eq!(meta["id"], id.as_str());
        assert_eq!(meta["workflow"], "implement");
        assert_eq!(meta["skill"], "plan2code-3-implement");
        assert_eq!(meta["spec"], "specs/feature");
        assert_eq!(meta["fromStop"], false);
        assert!(meta["usedAt"].is_null());
        assert!(meta["written"].as_str().unwrap().ends_with('Z'));
        let doc = fs::read_to_string(dir.join(format!("{id}.md"))).unwrap();
        assert!(doc.starts_with("# Handoff: Restart of plan2code-3-implement\n\n"));
        assert!(doc.contains("## Next task"));
    }

    #[test]
    fn a_second_write_in_the_same_minute_takes_the_next_id() {
        let dir = fixture("clash");
        let first = write(&dir, at(9, 0), &record(), "one").unwrap();
        let second = write(&dir, at(9, 0), &record(), "two").unwrap();
        assert_eq!(first, "2026-10-21-0900-handoff");
        assert_eq!(second, "2026-10-21-0900-handoff-2");
    }

    #[test]
    fn a_bad_workflow_is_refused_before_anything_is_written() {
        let dir = fixture("bad");
        let mut bad = record();
        bad.workflow = "Implement";
        assert!(write(&dir, at(9, 0), &bad, "x").is_err());
        assert!(!dir.exists());
    }

    #[test]
    fn an_unused_handoff_is_retired_and_a_picked_up_one_is_kept() {
        let dir = fixture("retire");
        let unused = write(&dir, at(10, 0), &record(), "one").unwrap();
        let used = write(&dir, at(10, 1), &record(), "two").unwrap();
        fs::write(
            dir.join(format!("{used}.json")),
            r#"{"v":1,"usedAt":"2026-10-21T10:02:00.000Z"}"#,
        )
        .unwrap();
        retire_if_unused(&dir, &unused).unwrap();
        retire_if_unused(&dir, &used).unwrap();
        assert!(!dir.join(format!("{unused}.json")).exists());
        assert!(!dir.join(format!("{unused}.md")).exists());
        assert!(dir.join(format!("{used}.json")).exists());
        assert!(dir.join(format!("{used}.md")).exists());
    }

    #[test]
    fn a_spec_must_be_one_folder_under_specs() {
        let mut bad = record();
        bad.spec = Some("specs/a/b");
        assert!(validate(&bad).is_err());
    }
}
