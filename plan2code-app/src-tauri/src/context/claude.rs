//! Claude's context, read from its own transcript: the last `assistant` message's
//! token usage, as a fraction of its context window. Claude Code writes one file
//! per session under `~/.claude/projects/<cwd, every non-alphanumeric character
//! replaced with `-`>/<session id>.jsonl` (relocatable via `CLAUDE_CONFIG_DIR`),
//! and names it after the session's own id, so a project folder's newest file
//! since the agent started is this run's transcript (Task 10.1's spike; the
//! same approach `codex.rs` uses for Codex's log). The entry format is
//! undocumented ("internal and may change between versions" per Claude's own
//! docs), so a usable reading is `BestEffort`, never `Real`. An unreadable line
//! is skipped, and a transcript with no usable line, or no transcript at all,
//! is `Unknown`.

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde_json::Value;

use super::{ContextReader, ContextReading};

/// How much of a transcript's end is read; the newest usage is near the end.
pub const TAIL_BYTES: u64 = 256 * 1024;

pub struct ClaudeReader {
    pub projects_dir: PathBuf,
    pub folder: PathBuf,
    /// Only a transcript written at or after this moment belongs to the running agent.
    pub since: SystemTime,
    /// The context window to read the usage against (`super::window_for`).
    pub window: u64,
}

impl ContextReader for ClaudeReader {
    fn read(&self) -> ContextReading {
        match newest_transcript(&self.projects_dir.join(encode(&self.folder)), self.since) {
            Some(file) => reading_from_file(&file, self.window),
            None => ContextReading::Unknown,
        }
    }
}

/// `folder` with every non-alphanumeric character replaced by `-`, the way
/// Claude Code names a project's transcripts directory.
fn encode(folder: &Path) -> String {
    folder.to_string_lossy().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

/// The newest `*.jsonl` file directly under `dir` that was written at or after `since`.
fn newest_transcript(dir: &Path, since: SystemTime) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    let mut newest: Option<(SystemTime, PathBuf)> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let Ok(modified) = entry.metadata().and_then(|m| m.modified()) else { continue };
        if modified < since {
            continue;
        }
        if newest.as_ref().is_none_or(|(best, _)| modified > *best) {
            newest = Some((modified, path));
        }
    }
    newest.map(|(_, path)| path)
}

/// The percent of `window` the last usable `assistant` usage line in `text` used.
pub fn reading_from_text(text: &str, window: u64) -> ContextReading {
    for line in text.lines().rev() {
        if let Some(percent) = percent_from_line(line, window) {
            return ContextReading::BestEffort { percent };
        }
    }
    ContextReading::Unknown
}

fn percent_from_line(line: &str, window: u64) -> Option<u8> {
    if window == 0 {
        return None;
    }
    let value: Value = serde_json::from_str(line).ok()?;
    if value.get("type")?.as_str()? != "assistant" {
        return None;
    }
    let usage = value.get("message")?.get("usage")?;
    let input = usage.get("input_tokens")?.as_u64()?;
    let cache_read = usage.get("cache_read_input_tokens").and_then(Value::as_u64).unwrap_or(0);
    let cache_creation = usage.get("cache_creation_input_tokens").and_then(Value::as_u64).unwrap_or(0);
    let used = input.saturating_add(cache_read).saturating_add(cache_creation);
    Some((used.saturating_mul(100) / window).min(100) as u8)
}

/// Reads the end of `file`. A file that cannot be opened or read is `Unknown`.
fn reading_from_file(file: &Path, window: u64) -> ContextReading {
    let Ok(mut handle) = File::open(file) else { return ContextReading::Unknown };
    let Ok(len) = handle.metadata().map(|m| m.len()) else { return ContextReading::Unknown };
    if len > TAIL_BYTES && handle.seek(SeekFrom::Start(len - TAIL_BYTES)).is_err() {
        return ContextReading::Unknown;
    }
    let mut bytes = Vec::new();
    if handle.read_to_end(&mut bytes).is_err() {
        return ContextReading::Unknown;
    }
    // The first line of a partial tail is cut short; it fails to parse and is skipped.
    reading_from_text(&String::from_utf8_lossy(&bytes), window)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    const GOOD: &str = r#"{"type":"assistant","message":{"usage":{"input_tokens":2,"cache_creation_input_tokens":724,"cache_read_input_tokens":205907}}}"#;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("plan2code-claude-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn epoch_plus(secs: u64) -> SystemTime {
        SystemTime::UNIX_EPOCH + Duration::from_secs(secs)
    }

    fn write_transcript(dir: &Path, name: &str, body: &str, modified: SystemTime) -> PathBuf {
        fs::create_dir_all(dir).unwrap();
        let file = dir.join(format!("{name}.jsonl"));
        fs::write(&file, body).unwrap();
        File::options().write(true).open(&file).unwrap().set_modified(modified).unwrap();
        file
    }

    #[test]
    fn the_last_assistant_usage_gives_the_percent_of_the_window() {
        assert_eq!(reading_from_text(GOOD, 206_633), ContextReading::BestEffort { percent: 100 });
        assert_eq!(reading_from_text(GOOD, 1_000_000), ContextReading::BestEffort { percent: 20 });
    }

    #[test]
    fn a_normal_transcript_is_read_from_the_newest_assistant_line() {
        let early = r#"{"type":"assistant","message":{"usage":{"input_tokens":2,"cache_creation_input_tokens":0,"cache_read_input_tokens":99998}}}"#;
        let text = format!("{early}\n{GOOD}");
        assert_eq!(reading_from_text(&text, 206_633), ContextReading::BestEffort { percent: 100 });
    }

    #[test]
    fn a_partial_last_line_is_skipped_in_favour_of_the_line_before_it() {
        let text = format!("{GOOD}\n{{\"type\":\"assistant\",\"mess");
        assert_eq!(reading_from_text(&text, 1_000_000), ContextReading::BestEffort { percent: 20 });
    }

    #[test]
    fn non_assistant_and_malformed_lines_are_skipped() {
        let text = format!("not json\n{{bad\n{{\"type\":\"user\",\"message\":{{}}}}\n{GOOD}");
        assert_eq!(reading_from_text(&text, 1_000_000), ContextReading::BestEffort { percent: 20 });
    }

    #[test]
    fn a_line_with_no_usable_usage_is_unknown() {
        assert_eq!(reading_from_text("", 1_000_000), ContextReading::Unknown);
        assert_eq!(reading_from_text(r#"{"type":"assistant","message":{}}"#, 1_000_000), ContextReading::Unknown);
        assert_eq!(reading_from_text(GOOD, 0), ContextReading::Unknown);
    }

    #[test]
    fn a_missing_file_is_unknown() {
        let reader = ClaudeReader {
            projects_dir: temp_dir("missing").join("projects"),
            folder: PathBuf::from(r"C:\git\project"),
            since: epoch_plus(0),
            window: 200_000,
        };
        assert_eq!(reader.read(), ContextReading::Unknown);
    }

    #[test]
    fn a_long_transcript_is_read_from_its_end() {
        let dir = temp_dir("long");
        let file = write_transcript(&dir, "long", &format!("{}\n{GOOD}", "x".repeat(TAIL_BYTES as usize + 100)), epoch_plus(0));
        assert_eq!(reading_from_file(&file, 206_633), ContextReading::BestEffort { percent: 100 });
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn the_newest_transcript_for_this_folder_is_read() {
        let root = temp_dir("newest");
        let projects = root.join("projects");
        let dir = projects.join(encode(Path::new(r"C:\git\project")));
        write_transcript(&dir, "a-old", GOOD, epoch_plus(100));
        let newest = write_transcript(&dir, "b-new", &GOOD.replace("205907", "500000"), epoch_plus(200));
        let reader = ClaudeReader { projects_dir: projects, folder: PathBuf::from(r"C:\git\project"), since: epoch_plus(0), window: 1_000_000 };
        assert_eq!(reader.read(), ContextReading::BestEffort { percent: 50 });
        let _ = fs::remove_dir_all(root);
        let _ = newest;
    }

    #[test]
    fn a_rotated_file_is_read_from_the_new_one() {
        let root = temp_dir("rotated");
        let projects = root.join("projects");
        let dir = projects.join(encode(Path::new(r"C:\git\project")));
        write_transcript(&dir, "first", GOOD, epoch_plus(100));
        let reader = ClaudeReader { projects_dir: projects.clone(), folder: PathBuf::from(r"C:\git\project"), since: epoch_plus(0), window: 1_000_000 };
        assert_eq!(reader.read(), ContextReading::BestEffort { percent: 20 });
        write_transcript(&dir, "second", &GOOD.replace("205907", "500000"), epoch_plus(200));
        assert_eq!(reader.read(), ContextReading::BestEffort { percent: 50 });
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_transcript_from_before_the_agent_started_is_ignored() {
        let root = temp_dir("since");
        let projects = root.join("projects");
        let dir = projects.join(encode(Path::new(r"C:\git\project")));
        write_transcript(&dir, "old", GOOD, epoch_plus(100));
        let reader = ClaudeReader { projects_dir: projects, folder: PathBuf::from(r"C:\git\project"), since: epoch_plus(200), window: 1_000_000 };
        assert_eq!(reader.read(), ContextReading::Unknown);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn the_cwd_is_encoded_the_way_claude_code_names_its_projects_folder() {
        assert_eq!(encode(Path::new(r"C:\git\plan2code")), "C--git-plan2code");
    }
}
