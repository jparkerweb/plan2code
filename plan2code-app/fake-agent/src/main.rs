//! A stand-in for Claude, Devin and Codex in the app's tests.
//!
//! It behaves the same on Windows, macOS and Linux. Commands, one per line on
//! stdin (these words are the contract the app's integration tests rely on):
//!
//!   STEP <n>   print one progress line a second for n seconds, then `STEP DONE`
//!   EXIT <c>   exit with code c
//!   SIZE       print the terminal size once
//!   PID        print the agent's process id as `PID <n>`
//!   REPORT <json>  write <json> as `loopOutcome` into the session's state.json
//!                  (PLAN2CODE_CONSOLE_HOME and PLAN2CODE_CONSOLE_SID name it), say
//!                  `REPORT written` (`REPORT unavailable` when either is missing)
//!   HANG       say `HANGING`, then go silent for good (no more lines read)
//!   <other>    echoed back as `echo: <line>`
//!
//! A change in terminal size is reported on its own as `SIZE <cols>x<rows>`.

use std::io::{self, BufRead, Write};
use std::thread;
use std::time::Duration;

use terminal_size::{terminal_size, Height, Width};

fn size_text() -> Option<String> {
    terminal_size().map(|(Width(w), Height(h))| format!("SIZE {w}x{h}"))
}

fn say(line: &str) {
    let mut out = io::stdout().lock();
    let _ = writeln!(out, "{line}\r");
    let _ = out.flush();
}

/// What a command line asks the agent to do.
#[derive(Debug, PartialEq, Eq)]
pub enum Command {
    Step(u64),
    Exit(i32),
    Size,
    Pid,
    /// `ENV NAME`: print the variable's value, for tests of what an agent is given.
    Env(String),
    /// `REPORT <json>`: the phase report the loop waits for, as the JSON text.
    Report(String),
    /// `HANG`: go silent, to model an agent that stops answering.
    Hang,
    Echo(String),
}

/// Write `json` as the `loopOutcome` of the session named by the environment.
/// Returns false when the session cannot be named.
fn write_report(json: &str) -> bool {
    let (Ok(home), Ok(sid)) = (
        std::env::var("PLAN2CODE_CONSOLE_HOME"),
        std::env::var("PLAN2CODE_CONSOLE_SID"),
    ) else {
        return false;
    };
    write_report_to(std::path::Path::new(&home), &sid, json)
}

/// `write_report` with the session named: `<home>/sessions/<sid>/state.json`.
fn write_report_to(home: &std::path::Path, sid: &str, json: &str) -> bool {
    let Ok(outcome) = serde_json::from_str::<serde_json::Value>(json) else {
        return false;
    };
    let dir = home.join("sessions").join(sid);
    let file = dir.join("state.json");
    let mut state = std::fs::read_to_string(&file)
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .filter(|value| value.is_object())
        // The console's own file always carries its schema number; a new one does too.
        .unwrap_or_else(|| serde_json::json!({ "schema": 1 }));
    state["loopOutcome"] = outcome;
    let _ = std::fs::create_dir_all(&dir);
    let temp = dir.join("state.json.tmp");
    let Ok(text) = serde_json::to_string(&state) else {
        return false;
    };
    std::fs::write(&temp, text).is_ok() && std::fs::rename(&temp, &file).is_ok()
}

pub fn parse(line: &str) -> Command {
    let line = line.trim();
    if let Some(rest) = line.strip_prefix("STEP ") {
        if let Ok(n) = rest.trim().parse() {
            return Command::Step(n);
        }
    }
    if let Some(rest) = line.strip_prefix("EXIT ") {
        if let Ok(code) = rest.trim().parse() {
            return Command::Exit(code);
        }
    }
    if line == "SIZE" {
        return Command::Size;
    }
    if line == "PID" {
        return Command::Pid;
    }
    if let Some(name) = line.strip_prefix("ENV ") {
        return Command::Env(name.trim().to_string());
    }
    if let Some(rest) = line.strip_prefix("REPORT ") {
        let json = rest.trim();
        if serde_json::from_str::<serde_json::Value>(json).is_ok() {
            return Command::Report(json.to_string());
        }
    }
    if line == "HANG" {
        return Command::Hang;
    }
    Command::Echo(line.to_string())
}

fn main() {
    say("FAKE-AGENT ready");
    // What the app launched it with: the launch prompt is one of these, so a
    // test can read back which prompt a generation was started on.
    let args: Vec<String> = std::env::args().skip(1).collect();
    say(&format!("ARGS {}", args.join(" ")));
    if let Some(size) = size_text() {
        say(&size);
    }

    // Report a resize on its own, by watching the size, so the same code works
    // where there is no resize signal (Windows).
    thread::spawn(|| {
        let mut last = size_text();
        loop {
            thread::sleep(Duration::from_millis(100));
            let now = size_text();
            if now != last {
                if let Some(text) = &now {
                    say(text);
                }
                last = now;
            }
        }
    });

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        match parse(&line) {
            Command::Step(n) => {
                for i in 1..=n {
                    say(&format!("working {i}/{n}"));
                    thread::sleep(Duration::from_secs(1));
                }
                say("STEP DONE");
            }
            Command::Exit(code) => {
                say(&format!("exiting {code}"));
                std::process::exit(code);
            }
            Command::Size => say(&size_text().unwrap_or_else(|| "SIZE unknown".into())),
            Command::Pid => say(&format!("PID {}", std::process::id())),
            Command::Env(name) => say(&format!(
                "ENV {name}={}",
                std::env::var(&name).unwrap_or_default()
            )),
            Command::Report(json) => {
                if write_report(&json) {
                    say("REPORT written")
                } else {
                    say("REPORT unavailable")
                }
            }
            Command::Hang => {
                say("HANGING");
                loop {
                    thread::sleep(Duration::from_secs(3600));
                }
            }
            Command::Echo(text) => say(&format!("echo: {text}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_command_words() {
        assert_eq!(parse("STEP 3"), Command::Step(3));
        assert_eq!(parse("EXIT 7\r\n"), Command::Exit(7));
        assert_eq!(parse("SIZE"), Command::Size);
        assert_eq!(parse("PID"), Command::Pid);
        assert_eq!(
            parse("ENV PLAN2CODE_IN_APP"),
            Command::Env("PLAN2CODE_IN_APP".into())
        );
        assert_eq!(parse("hello there"), Command::Echo("hello there".into()));
    }

    #[test]
    fn parses_report_and_hang() {
        assert_eq!(
            parse("REPORT {\"phase\":2}"),
            Command::Report("{\"phase\":2}".into())
        );
        assert_eq!(parse("HANG\r\n"), Command::Hang);
    }

    #[test]
    fn a_report_lands_in_the_session_file_beside_what_was_there() {
        let home = std::env::temp_dir().join(format!("fake-agent-report-{}", std::process::id()));
        let dir = home.join("sessions").join("s9");
        std::fs::create_dir_all(&dir).unwrap();
        // No file yet: a new one with the schema number.
        assert!(write_report_to(&home, "s9", "{\"phase\":2}"));
        let read = || -> serde_json::Value {
            serde_json::from_str(&std::fs::read_to_string(dir.join("state.json")).unwrap()).unwrap()
        };
        assert_eq!(read()["loopOutcome"]["phase"], 2);
        assert_eq!(read()["schema"], 1);
        // An existing object keeps its keys.
        std::fs::write(dir.join("state.json"), "{\"schema\":1,\"title\":\"t\"}").unwrap();
        assert!(write_report_to(&home, "s9", "{\"phase\":3}"));
        assert_eq!(read()["title"], "t");
        assert_eq!(read()["loopOutcome"]["phase"], 3);
        // A garbage file is replaced, not trusted.
        std::fs::write(dir.join("state.json"), "not json").unwrap();
        assert!(write_report_to(&home, "s9", "{\"phase\":4}"));
        assert_eq!(read()["loopOutcome"]["phase"], 4);
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn a_report_with_bad_json_is_an_echo() {
        assert_eq!(
            parse("REPORT {not json"),
            Command::Echo("REPORT {not json".into())
        );
    }

    #[test]
    fn a_bad_number_is_just_an_echo() {
        assert_eq!(parse("STEP x"), Command::Echo("STEP x".into()));
        assert_eq!(parse("EXIT"), Command::Echo("EXIT".into()));
    }
}
