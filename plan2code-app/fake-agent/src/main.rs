//! A stand-in for Claude, Devin and Codex in the app's tests.
//!
//! It behaves the same on Windows, macOS and Linux. Commands, one per line on
//! stdin (these words are the contract the app's integration tests rely on):
//!
//!   STEP <n>   print one progress line a second for n seconds, then `STEP DONE`
//!   EXIT <c>   exit with code c
//!   SIZE       print the terminal size once
//!   PID        print the agent's process id as `PID <n>`
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
    Echo(String),
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
    Command::Echo(line.to_string())
}

fn main() {
    say("FAKE-AGENT ready");
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
            Command::Env(name) => say(&format!("ENV {name}={}", std::env::var(&name).unwrap_or_default())),
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
        assert_eq!(parse("ENV PLAN2CODE_IN_APP"), Command::Env("PLAN2CODE_IN_APP".into()));
        assert_eq!(parse("hello there"), Command::Echo("hello there".into()));
    }

    #[test]
    fn a_bad_number_is_just_an_echo() {
        assert_eq!(parse("STEP x"), Command::Echo("STEP x".into()));
        assert_eq!(parse("EXIT"), Command::Echo("EXIT".into()));
    }
}
