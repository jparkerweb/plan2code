//! Codex's context, read from its session log. Codex writes each run to
//! `sessions/YYYY/MM/DD/rollout-*.jsonl` under its home folder (`CODEX_HOME`,
//! or `~/.codex`). The app reads the newest log for its project folder, from
//! its end, and never writes there. The format is undocumented, so the reading
//! is `BestEffort`: an unrecognised line is skipped, and a log with no usable
//! line, or no log at all, is `Unknown`. Nothing here is an error.

use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde_json::Value;

use super::{ContextReader, ContextReading};

/// How much of a log's end is read. The newest token count is near the end,
/// so a long log is never read whole.
pub const TAIL_BYTES: u64 = 256 * 1024;

/// How deep the sessions folder is searched: year, month, day, file.
const SEARCH_DEPTH: u32 = 4;

pub struct CodexReader {
    pub sessions_dir: PathBuf,
    pub folder: PathBuf,
    /// Only logs written at or after this moment belong to the running agent.
    pub since: SystemTime,
}

impl ContextReader for CodexReader {
    fn read(&self) -> ContextReading {
        match newest_log(&self.sessions_dir, &self.folder, self.since) {
            Some(file) => reading_from_file(&file),
            None => ContextReading::Unknown,
        }
    }
}

/// The percent of the model's window the newest request used, from the last
/// usable `token_count` line in `text`.
pub fn reading_from_text(text: &str) -> ContextReading {
    for line in text.lines().rev() {
        if let Some(percent) = percent_from_line(line) {
            return ContextReading::BestEffort { percent };
        }
    }
    ContextReading::Unknown
}

fn percent_from_line(line: &str) -> Option<u8> {
    let value: Value = serde_json::from_str(line).ok()?;
    if value.get("type")?.as_str()? != "event_msg" {
        return None;
    }
    let payload = value.get("payload")?;
    if payload.get("type")?.as_str()? != "token_count" {
        return None;
    }
    let info = payload.get("info")?;
    let used = info.get("last_token_usage")?.get("input_tokens")?.as_u64()?;
    let window = info.get("model_context_window")?.as_u64()?;
    if window == 0 {
        return None;
    }
    Some((used.saturating_mul(100) / window).min(100) as u8)
}

/// Reads the end of `file`. A file that cannot be opened or read is `Unknown`.
fn reading_from_file(file: &Path) -> ContextReading {
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
    reading_from_text(&String::from_utf8_lossy(&bytes))
}

/// The newest log under `sessions_dir` that was written since `since` and
/// whose first line names `folder` as its working directory.
pub fn newest_log(sessions_dir: &Path, folder: &Path, since: SystemTime) -> Option<PathBuf> {
    let mut logs = Vec::new();
    collect_logs(sessions_dir, SEARCH_DEPTH, since, &mut logs);
    let mut recent: Vec<(SystemTime, PathBuf)> = logs
        .into_iter()
        .filter_map(|file| {
            let modified = fs::metadata(&file).ok()?.modified().ok()?;
            (modified >= since).then_some((modified, file))
        })
        .collect();
    recent.sort_by(|a, b| b.0.cmp(&a.0));
    recent.into_iter().map(|(_, file)| file).find(|file| names_folder(file, folder))
}

// A day folder not touched since `since` holds no log of this run (creating a
// log updates its own folder, and only that one), so it is skipped: the walk
// stays short however many old logs Codex has kept. Year and month folders are
// always entered, as their own times say nothing about the logs below them.
// `depth` is 2 while the entries of a month folder are listed.
fn collect_logs(dir: &Path, depth: u32, since: SystemTime, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let touched = fs::metadata(&path).and_then(|m| m.modified()).is_ok_and(|m| m >= since);
            if depth > 0 && (depth != 2 || touched) {
                collect_logs(&path, depth - 1, since, out);
            }
        } else if is_rollout(&path) {
            out.push(path);
        }
    }
}

fn is_rollout(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("rollout-") && name.ends_with(".jsonl"))
}

/// True when the log's first line is a `session_meta` for `folder`.
fn names_folder(file: &Path, folder: &Path) -> bool {
    let Ok(handle) = File::open(file) else { return false };
    let mut first = String::new();
    if BufReader::new(handle).read_line(&mut first).is_err() {
        return false;
    }
    let Ok(value) = serde_json::from_str::<Value>(&first) else { return false };
    if value.get("type").and_then(Value::as_str) != Some("session_meta") {
        return false;
    }
    value
        .get("payload")
        .and_then(|payload| payload.get("cwd"))
        .and_then(Value::as_str)
        .is_some_and(|cwd| same_folder(cwd, folder))
}

/// Compares two folder paths the way Windows does: case, slash style and a
/// trailing separator do not count.
fn same_folder(cwd: &str, folder: &Path) -> bool {
    let norm = |s: &str| {
        s.trim_start_matches(r"\\?\").trim_end_matches(['\\', '/']).replace('/', "\\").to_ascii_lowercase()
    };
    norm(cwd) == norm(&folder.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    const GOOD: &str = r#"{"type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":21839},"model_context_window":258400}}}"#;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("plan2code-codex-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    // A log whose first line names `cwd`, then `body` lines, dated `modified`.
    fn write_log(sessions: &Path, name: &str, cwd: &str, body: &str, modified: SystemTime) -> PathBuf {
        let day = sessions.join("2026").join("10").join("22");
        fs::create_dir_all(&day).unwrap();
        let file = day.join(format!("rollout-{name}.jsonl"));
        let meta = serde_json::json!({ "type": "session_meta", "payload": { "cwd": cwd } });
        fs::write(&file, format!("{meta}\n{body}")).unwrap();
        // `meta` is a JSON value, so its text is escaped for the log.
        fs::File::options().write(true).open(&file).unwrap().set_modified(modified).unwrap();
        file
    }

    fn epoch_plus(secs: u64) -> SystemTime {
        SystemTime::UNIX_EPOCH + Duration::from_secs(secs)
    }

    #[test]
    fn the_last_token_count_gives_the_percent_of_the_window() {
        assert_eq!(reading_from_text(GOOD), ContextReading::BestEffort { percent: 8 });
    }

    #[test]
    fn unrecognised_and_malformed_lines_are_skipped() {
        let text = format!("not json\n{{bad\n{GOOD}\n{}", r#"{"type":"event_msg","payload":{"type":"other"}}"#);
        assert_eq!(reading_from_text(&text), ContextReading::BestEffort { percent: 8 });
    }

    #[test]
    fn a_log_with_no_usable_line_is_unknown() {
        assert_eq!(reading_from_text(""), ContextReading::Unknown);
        assert_eq!(reading_from_text("garbage\n{}"), ContextReading::Unknown);
        let zero_window = GOOD.replace("258400", "0");
        assert_eq!(reading_from_text(&zero_window), ContextReading::Unknown);
    }

    #[test]
    fn an_early_token_count_without_info_is_skipped() {
        let early = r#"{"type":"event_msg","payload":{"type":"token_count","info":null}}"#;
        assert_eq!(reading_from_text(&format!("{GOOD}\n{early}")), ContextReading::BestEffort { percent: 8 });
        assert_eq!(reading_from_text(early), ContextReading::Unknown);
    }

    #[test]
    fn only_a_session_meta_with_this_folder_names_it() {
        let root = temp_dir("names");
        let folder = Path::new(r"C:\git\project");
        let verbatim = serde_json::json!({ "type": "session_meta", "payload": { "cwd": r"\\?\C:\git\project" } });
        let cases = [
            ("not json".to_string(), false),
            (r#"{"type":"other","payload":{"cwd":"x"}}"#.to_string(), false),
            (r#"{"type":"session_meta","payload":{}}"#.to_string(), false),
            (verbatim.to_string(), true),
        ];
        for (i, (line, expected)) in cases.iter().enumerate() {
            let file = root.join(format!("rollout-{i}.jsonl"));
            fs::write(&file, format!("{line}\n{GOOD}\n")).unwrap();
            assert_eq!(names_folder(&file, folder), *expected, "{line}");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_long_log_is_read_from_its_end() {
        let dir = temp_dir("long");
        let file = dir.join("long.jsonl");
        fs::write(&file, format!("{}\n{GOOD}\n", "x".repeat(TAIL_BYTES as usize + 100))).unwrap();
        assert_eq!(reading_from_file(&file), ContextReading::BestEffort { percent: 8 });
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn a_missing_log_is_unknown() {
        assert_eq!(reading_from_file(Path::new("no-such-dir/rollout-x.jsonl")), ContextReading::Unknown);
    }

    #[test]
    fn a_missing_sessions_folder_is_unknown() {
        let reader = CodexReader {
            sessions_dir: temp_dir("none").join("sessions"),
            folder: PathBuf::from(r"C:\git\project"),
            since: epoch_plus(0),
        };
        assert_eq!(reader.read(), ContextReading::Unknown);
    }

    #[test]
    fn the_newest_log_for_this_folder_is_read() {
        let root = temp_dir("newest");
        let sessions = root.join("sessions");
        write_log(&sessions, "a-old", r"C:\git\project", GOOD, epoch_plus(100));
        write_log(&sessions, "b-other", r"C:\git\elsewhere", GOOD, epoch_plus(300));
        let newest = write_log(&sessions, "c-new", r"c:\git\project\", &GOOD.replace("21839", "129200"), epoch_plus(200));
        assert_eq!(newest_log(&sessions, Path::new(r"C:\git\project"), epoch_plus(0)), Some(newest));
        let _ = fs::remove_dir_all(root);
    }

    // Sets a folder's modified time; Windows needs the backup-semantics flag to open one.
    fn set_dir_modified(dir: &Path, time: SystemTime) {
        let mut options = fs::OpenOptions::new();
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.write(true).custom_flags(0x0200_0000);
        }
        #[cfg(not(windows))]
        options.read(true);
        options.open(dir).unwrap().set_modified(time).unwrap();
    }

    #[test]
    fn old_year_and_month_folders_do_not_hide_todays_log() {
        let root = temp_dir("parents");
        let sessions = root.join("sessions");
        let log = write_log(&sessions, "today", r"C:\git\project", GOOD, epoch_plus(500));
        // Creating a log touches only its day folder: the parents keep their old times.
        set_dir_modified(&sessions.join("2026"), epoch_plus(10));
        set_dir_modified(&sessions.join("2026").join("10"), epoch_plus(20));
        assert_eq!(newest_log(&sessions, Path::new(r"C:\git\project"), epoch_plus(100)), Some(log));
        // A day folder untouched since the agent started is skipped.
        set_dir_modified(&sessions.join("2026").join("10").join("22"), epoch_plus(30));
        assert_eq!(newest_log(&sessions, Path::new(r"C:\git\project"), epoch_plus(100)), None);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_log_from_before_the_agent_started_is_ignored() {
        let root = temp_dir("since");
        let sessions = root.join("sessions");
        write_log(&sessions, "old", r"C:\git\project", GOOD, epoch_plus(100));
        assert_eq!(newest_log(&sessions, Path::new(r"C:\git\project"), epoch_plus(200)), None);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_rotated_log_is_read_from_the_new_file() {
        let root = temp_dir("rotated");
        let sessions = root.join("sessions");
        write_log(&sessions, "first", r"C:\git\project", GOOD, epoch_plus(100));
        let reader = CodexReader {
            sessions_dir: sessions.clone(),
            folder: PathBuf::from(r"C:\git\project"),
            since: epoch_plus(0),
        };
        assert_eq!(reader.read(), ContextReading::BestEffort { percent: 8 });
        write_log(&sessions, "second", r"C:\git\project", &GOOD.replace("21839", "129200"), epoch_plus(200));
        assert_eq!(reader.read(), ContextReading::BestEffort { percent: 50 });
        let _ = fs::remove_dir_all(root);
    }
}
