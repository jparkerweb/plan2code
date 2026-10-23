//! Reads a console session's files without disturbing them. The console owns
//! `~/.plan2code/console/sessions/<sid>/`: this module only opens files for
//! reading. It never creates, locks, renames or removes anything there, so the
//! console's own writes are never blocked by the app (NFR-3).

use std::io;
use std::path::{Path, PathBuf};
use std::thread::sleep;
use std::time::Duration;

use serde_json::Value;

/// The one session schema this reader understands (`state.json`'s `schema`).
pub const SCHEMA: u64 = 1;

/// How many times a locked `state.json` is tried again. The console renames
/// the file while it writes, so Windows can refuse a read for a moment.
const LOCKED_RETRIES: u32 = 5;
const RETRY_EVERY: Duration = Duration::from_millis(50);

/// Windows: ERROR_SHARING_VIOLATION and ERROR_LOCK_VIOLATION.
const WINDOWS_SHARING: [i32; 2] = [32, 33];

#[derive(Debug, PartialEq, Eq)]
pub enum ReadError {
    /// The file is not there.
    Missing(PathBuf),
    /// Still locked after every retry.
    Busy,
    /// Some other read failure.
    Unreadable(String),
    /// Not a JSON object.
    Malformed(String),
    /// A schema this app does not read.
    Schema(u64),
}

impl std::fmt::Display for ReadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReadError::Missing(file) => write!(f, "{} is missing", file.display()),
            ReadError::Busy => write!(f, "session busy: the console is still writing its state"),
            ReadError::Unreadable(why) => write!(f, "could not read the session: {why}"),
            ReadError::Malformed(why) => write!(f, "the session file is not valid: {why}"),
            ReadError::Schema(found) => {
                write!(f, "session schema {found} is not supported (this app reads schema {SCHEMA})")
            }
        }
    }
}

/// A session's `state.json`, read once. Nothing else in the session folder is
/// read here: the Ask chat lives in `chat.ndjson` and stays out of the brief.
pub struct Session {
    pub dir: PathBuf,
    pub state: Value,
}

/// `~/.plan2code/console`, or `PLAN2CODE_CONSOLE_HOME` when the console is
/// relocated (the same rule the console and the supervisor follow).
pub fn console_home() -> Option<PathBuf> {
    if let Ok(home) = std::env::var("PLAN2CODE_CONSOLE_HOME") {
        return Some(PathBuf::from(home));
    }
    Some(std::env::home_dir()?.join(".plan2code").join("console"))
}

/// `<console home>/sessions/<sid>`.
pub fn session_dir(console_home: &Path, sid: &str) -> PathBuf {
    console_home.join("sessions").join(sid)
}

/// Open and parse the session `sid` under `console_home`.
pub fn load(console_home: &Path, sid: &str) -> Result<Session, ReadError> {
    let dir = session_dir(console_home, sid);
    let text = read_with_retry(&dir.join("state.json"), |file| std::fs::read_to_string(file))?;
    let state = parse_state(&text)?;
    Ok(Session { dir, state })
}

/// Read `file` through `read`. A locked file (a sharing or permission error) is
/// tried again up to `LOCKED_RETRIES` times, `RETRY_EVERY` apart; then the
/// session is reported busy. `read` is a parameter so a test can stand in a
/// reader that fails a few times.
pub fn read_with_retry<F>(file: &Path, mut read: F) -> Result<String, ReadError>
where
    F: FnMut(&Path) -> io::Result<String>,
{
    let mut retries = 0;
    loop {
        match read(file) {
            Ok(text) => return Ok(text),
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Err(ReadError::Missing(file.to_path_buf())),
            Err(e) if is_locked(&e) => {
                if retries == LOCKED_RETRIES {
                    return Err(ReadError::Busy);
                }
                retries += 1;
                sleep(RETRY_EVERY);
            }
            Err(e) => return Err(ReadError::Unreadable(e.to_string())),
        }
    }
}

fn is_locked(e: &io::Error) -> bool {
    e.kind() == io::ErrorKind::PermissionDenied || e.raw_os_error().is_some_and(|code| WINDOWS_SHARING.contains(&code))
}

/// Parse `state.json` text: a JSON object whose `schema` is `SCHEMA`.
pub fn parse_state(text: &str) -> Result<Value, ReadError> {
    let state: Value = serde_json::from_str(text).map_err(|e| ReadError::Malformed(e.to_string()))?;
    if !state.is_object() {
        return Err(ReadError::Malformed("not a JSON object".to_string()));
    }
    let schema = state
        .get("schema")
        .and_then(Value::as_u64)
        .ok_or_else(|| ReadError::Malformed("no schema number".to_string()))?;
    if schema != SCHEMA {
        return Err(ReadError::Schema(schema));
    }
    Ok(state)
}

/// Each line of a `.ndjson` file that parses as JSON, in order. A partial last
/// line (the console was mid-write) does not parse and is dropped; so is any
/// other line that does not parse. A missing file has no lines.
pub fn read_ndjson(file: &Path) -> Vec<Value> {
    match std::fs::read_to_string(file) {
        Ok(text) => parse_ndjson(&text),
        Err(_) => Vec::new(),
    }
}

pub fn parse_ndjson(text: &str) -> Vec<Value> {
    text.lines().filter(|line| !line.trim().is_empty()).filter_map(|line| serde_json::from_str(line).ok()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    fn fixture(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("plan2code-reader-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    const STATE: &str = r#"{"schema": 1, "sid": "s1", "workflow": "implement", "specDir": "specs/x"}"#;

    #[test]
    fn a_complete_session_loads() {
        let home = fixture("complete");
        let dir = session_dir(&home, "s1");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("state.json"), STATE).unwrap();
        let session = load(&home, "s1").unwrap();
        assert_eq!(session.state["workflow"], "implement");
        assert_eq!(session.dir, dir);
    }

    #[test]
    fn a_partial_last_line_is_dropped() {
        let lines = parse_ndjson("{\"a\":1}\n{\"b\":2}\n{\"c\":");
        assert_eq!(lines, vec![serde_json::json!({"a": 1}), serde_json::json!({"b": 2})]);
    }

    #[test]
    fn a_missing_ndjson_file_has_no_lines() {
        assert!(read_ndjson(&fixture("no-ndjson").join("events.ndjson")).is_empty());
    }

    #[test]
    fn a_missing_state_file_is_reported() {
        let home = fixture("missing");
        match load(&home, "nope") {
            Err(ReadError::Missing(file)) => assert!(file.ends_with("state.json")),
            other => panic!("expected Missing, got {:?}", other.map(|s| s.dir)),
        }
    }

    #[test]
    fn another_schema_is_rejected_with_a_clear_message() {
        let err = parse_state(r#"{"schema": 2}"#).unwrap_err();
        assert_eq!(err, ReadError::Schema(2));
        assert!(err.to_string().contains("schema 2 is not supported"));
    }

    #[test]
    fn a_locked_file_that_frees_up_on_the_third_retry_is_read() {
        let tries = Cell::new(0);
        let text = read_with_retry(Path::new("state.json"), |_| {
            tries.set(tries.get() + 1);
            if tries.get() < 4 {
                Err(io::Error::from(io::ErrorKind::PermissionDenied))
            } else {
                Ok(STATE.to_string())
            }
        });
        assert_eq!(text.unwrap(), STATE);
        assert_eq!(tries.get(), 4);
    }

    #[test]
    fn a_file_that_stays_locked_is_busy_not_a_failure() {
        let tries = Cell::new(0);
        let result = read_with_retry(Path::new("state.json"), |_| {
            tries.set(tries.get() + 1);
            Err(io::Error::from_raw_os_error(32))
        });
        assert_eq!(result, Err(ReadError::Busy));
        assert_eq!(tries.get(), LOCKED_RETRIES + 1);
    }
}
