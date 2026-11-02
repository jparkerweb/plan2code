//! The commands the Implementation Loop runs on its own: the spec scripts, git,
//! the console's `post` and the person's quick check. Each call has a time
//! limit and keeps its output. No shell runs here except the quick check, whose
//! text comes only from `loop-setup.json` (never from a page message).

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crate::console_supervisor::find_console_dir;

/// What a finished (or stopped) call left behind.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ToolRun {
    pub ok: bool,
    pub code: Option<i32>,
    pub output: String,
}

/// Output kept per call: the tail, which is where a failure says why.
const OUTPUT_LIMIT: usize = 200 * 1024;

/// The limit for node and git calls.
pub const QUICK_LIMIT: Duration = Duration::from_secs(60);
/// The limit for the person's quick check.
pub const CHECK_LIMIT: Duration = Duration::from_secs(15 * 60);

const POLL: Duration = Duration::from_millis(25);

/// Appends `bytes`, dropping from the front when over `limit`.
fn append_tail(buf: &mut Vec<u8>, bytes: &[u8], limit: usize) {
    buf.extend_from_slice(bytes);
    if buf.len() > limit {
        let excess = buf.len() - limit;
        buf.drain(..excess);
    }
}

fn pump<R: Read + Send + 'static>(
    mut source: R,
    sink: Arc<Mutex<Vec<u8>>>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut chunk = [0u8; 8192];
        loop {
            match source.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if let Ok(mut buf) = sink.lock() {
                        append_tail(&mut buf, &chunk[..n], OUTPUT_LIMIT);
                    }
                }
            }
        }
    })
}

/// Run `cmd` to its end or `limit`, with `stdin` written when given. Stdout and
/// stderr share one kept `output`. The child is killed when the limit passes.
fn run_limited(cmd: Command, stdin: Option<&str>, limit: Duration) -> ToolRun {
    run_limited_with(cmd, stdin, limit, true)
}

/// `run_limited`, with stderr dropped when `keep_stderr` is false: a list read
/// from stdout must not be mixed with a warning git printed beside it.
fn run_limited_with(
    mut cmd: Command,
    stdin: Option<&str>,
    limit: Duration,
    keep_stderr: bool,
) -> ToolRun {
    cmd.env("PATH", crate::node_check::resolved_path());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.stdin(if stdin.is_some() {
        Stdio::piped()
    } else {
        Stdio::null()
    })
    .stdout(Stdio::piped())
    .stderr(if keep_stderr {
        Stdio::piped()
    } else {
        Stdio::null()
    });
    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            return ToolRun {
                ok: false,
                code: None,
                output: format!("could not start: {e}"),
            }
        }
    };
    let sink = Arc::new(Mutex::new(Vec::new()));
    let readers = [
        child.stdout.take().map(|s| pump(s, Arc::clone(&sink))),
        child.stderr.take().map(|s| pump(s, Arc::clone(&sink))),
    ];
    if let (Some(text), Some(mut pipe)) = (stdin, child.stdin.take()) {
        // A child that exits before reading closes the pipe: not an error here.
        let _ = pipe.write_all(text.as_bytes());
    }
    let pid = child.id();
    let started = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => {
                if started.elapsed() >= limit {
                    timed_out = true;
                    kill_tree(pid);
                    let _ = child.kill();
                    let _ = child.wait();
                    break None;
                }
                thread::sleep(POLL);
            }
            Err(_) => break None,
        }
    };
    // A descendant that outlives the child can keep the pipes open: wait a
    // short grace for the readers, then leave them behind.
    let grace = Instant::now() + Duration::from_secs(3);
    for reader in readers.into_iter().flatten() {
        while !reader.is_finished() && Instant::now() < grace {
            thread::sleep(POLL);
        }
        if reader.is_finished() {
            let _ = reader.join();
        }
    }
    let mut output = sink
        .lock()
        .map(|buf| String::from_utf8_lossy(&buf).into_owned())
        .unwrap_or_default();
    if timed_out {
        if !output.is_empty() && !output.ends_with('\n') {
            output.push('\n');
        }
        output.push_str(&format!("(stopped after {})", describe_limit(limit)));
    }
    ToolRun {
        ok: status.is_some_and(|s| s.success()),
        code: status.and_then(|s| s.code()),
        output,
    }
}

/// "1 minute", "15 minutes", "2 seconds".
fn describe_limit(limit: Duration) -> String {
    let secs = limit.as_secs();
    let (n, unit) = if secs >= 60 {
        (secs / 60, "minute")
    } else {
        (secs.max(1), "second")
    };
    format!("{n} {unit}{}", if n == 1 { "" } else { "s" })
}

/// End a call's whole process tree, not just the program it started.
fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(0x08000000)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("pkill")
            .args(["-KILL", "-P", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

fn node_script(script: &Path, project: &Path, args: &[&str]) -> Command {
    let mut cmd = Command::new("node");
    cmd.arg(script).args(args).current_dir(project);
    cmd
}

fn git(project: &Path, args: &[&str]) -> Command {
    let mut cmd = Command::new("git");
    cmd.args(args).current_dir(project);
    cmd
}

/// A skill script (`specs.mjs`, `commit-msg.mjs`): beside the console's skill
/// first (`<console dir>/../../scripts/`), then the Implement skills' own.
pub fn skill_script(name: &str) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    // Tests run the repository's own scripts, so they need no installed skill
    // (CI has none) and cannot drift from the source.
    #[cfg(test)]
    candidates.push(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../src/skill-scripts")
            .join(name),
    );
    if let Ok(console) = find_console_dir() {
        if let Some(skill) = console.parent().and_then(Path::parent) {
            candidates.push(skill.join("scripts").join(name));
        }
    }
    if let Some(home) = std::env::home_dir() {
        let skills = home.join(".agents").join("skills");
        for skill in ["plan2code-3-implement", "plan2code-3-implement-review"] {
            candidates.push(skills.join(skill).join("scripts").join(name));
        }
    }
    candidates.into_iter().find(|path| path.is_file())
}

fn script_or_err(name: &str) -> Result<PathBuf, String> {
    skill_script(name).ok_or_else(|| format!("the Plan2Code skill script {name} is not installed"))
}

/// `specs.mjs status <spec>`, parsed.
pub fn specs_status(project: &Path, spec: &str) -> Result<serde_json::Value, String> {
    let script = script_or_err("specs.mjs")?;
    let run = run_limited(
        node_script(&script, project, &["status", spec]),
        None,
        QUICK_LIMIT,
    );
    parse_json_object(&run)
}

/// `specs.mjs mark <spec> --phase N --to done`.
pub fn specs_mark_done(project: &Path, spec: &str, phase: u32) -> ToolRun {
    specs_mark(project, spec, phase, "done")
}

/// `specs.mjs mark <spec> --phase N --to <to>` (`in-progress` reopens a phase).
pub fn specs_mark(project: &Path, spec: &str, phase: u32, to: &str) -> ToolRun {
    let script = match script_or_err("specs.mjs") {
        Ok(script) => script,
        Err(output) => {
            return ToolRun {
                ok: false,
                code: None,
                output,
            }
        }
    };
    let phase = phase.to_string();
    run_limited(
        node_script(
            &script,
            project,
            &["mark", spec, "--phase", &phase, "--to", to],
        ),
        None,
        QUICK_LIMIT,
    )
}

/// `commit-msg.mjs --subject <subject> --add-all`: the checked message. The
/// script's own subject checks are the only ones.
pub fn commit_message(project: &Path, subject: &str) -> Result<String, String> {
    let script = script_or_err("commit-msg.mjs")?;
    let run = run_limited(
        node_script(&script, project, &["--subject", subject, "--add-all"]),
        None,
        QUICK_LIMIT,
    );
    parse_commit_msg(&run.output)
}

/// What `commit-msg.mjs` printed, read without a shell: its `message` when
/// `ok`, otherwise its error, otherwise whatever it printed.
fn parse_commit_msg(stdout: &str) -> Result<String, String> {
    let run = ToolRun {
        ok: true,
        code: Some(0),
        output: stdout.to_string(),
    };
    let value = parse_json_object(&run).map_err(|_| stdout.trim().to_string())?;
    if value["ok"].as_bool() == Some(true) {
        if let Some(message) = value["message"].as_str() {
            return Ok(message.to_string());
        }
    }
    // `error` is a machine code; `message` is the human text.
    Err(value["message"]
        .as_str()
        .or_else(|| value["error"].as_str())
        .map(str::to_string)
        .unwrap_or_else(|| stdout.trim().to_string()))
}

pub fn git_add_all(project: &Path) -> ToolRun {
    run_limited(git(project, &["add", "-A"]), None, QUICK_LIMIT)
}

/// `git commit -F -` with the message on stdin: no shell, nothing quoted.
pub fn git_commit(project: &Path, message: &str) -> ToolRun {
    git_commit_with(project, message, QUICK_LIMIT)
}

/// `git_commit` with its own time limit: a slow hook is not killed at the
/// limit of the quick calls.
pub fn git_commit_with(project: &Path, message: &str, limit: Duration) -> ToolRun {
    run_limited(git(project, &["commit", "-F", "-"]), Some(message), limit)
}

/// `git add -- <paths>`: stage exactly these files. A path git ignores (a
/// `specs/` folder in `.gitignore`) is left out, as `git add -A` leaves it out,
/// not refused.
pub fn git_add_paths(project: &Path, paths: &[&Path]) -> ToolRun {
    let wanted: Vec<&Path> = paths
        .iter()
        .copied()
        .filter(|path| {
            let mut cmd = git(project, &["check-ignore", "-q", "--"]);
            cmd.arg(path);
            !run_limited(cmd, None, QUICK_LIMIT).ok
        })
        .collect();
    if wanted.is_empty() {
        return ToolRun {
            ok: true,
            code: Some(0),
            output: String::new(),
        };
    }
    let mut cmd = git(project, &["add", "--"]);
    cmd.args(wanted);
    run_limited(cmd, None, QUICK_LIMIT)
}

/// The names of the staged files, as `git diff --cached --name-only -z` prints
/// them: NUL-separated, so no path is quoted.
pub fn git_staged(project: &Path) -> Result<Vec<String>, String> {
    let run = run_limited_with(
        git(project, &["diff", "--cached", "--name-only", "-z"]),
        None,
        QUICK_LIMIT,
        false,
    );
    if !run.ok {
        return Err(run.output.trim().to_string());
    }
    Ok(split_nul(&run.output))
}

fn split_nul(text: &str) -> Vec<String> {
    text.split('\0')
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect()
}

/// The repository's top folder: staged names are relative to it, not to
/// `project`, which may be a subfolder.
pub fn git_toplevel(project: &Path) -> Option<PathBuf> {
    let run = run_limited_with(
        git(project, &["rev-parse", "--show-toplevel"]),
        None,
        QUICK_LIMIT,
        false,
    );
    let top = run.output.trim();
    (run.ok && !top.is_empty()).then(|| PathBuf::from(top))
}

/// Whether `HEAD` names a commit (false in a repository with no commit yet).
fn git_has_head(project: &Path) -> bool {
    run_limited(
        git(project, &["rev-parse", "--verify", "-q", "HEAD"]),
        None,
        QUICK_LIMIT,
    )
    .ok
}

/// Take everything out of the index again; the files keep their contents.
pub fn git_unstage_all(project: &Path) -> ToolRun {
    if git_has_head(project) {
        run_limited(git(project, &["reset", "-q"]), None, QUICK_LIMIT)
    } else {
        // Before a first commit there is no HEAD to reset to.
        run_limited(
            git(project, &["rm", "-r", "--cached", "-q", ":/"]),
            None,
            QUICK_LIMIT,
        )
    }
}

/// The branch `HEAD` is on: `Ok(None)` for a detached HEAD, an error when
/// `project` is not a git repository.
pub fn git_branch(project: &Path) -> Result<Option<String>, String> {
    let run = run_limited(
        git(project, &["symbolic-ref", "--short", "-q", "HEAD"]),
        None,
        QUICK_LIMIT,
    );
    let name = run.output.trim();
    if run.ok && !name.is_empty() {
        return Ok(Some(name.to_string()));
    }
    // `symbolic-ref -q` exits 1 and prints nothing for a detached HEAD; any
    // other failure (not a repository, git missing) prints something.
    if run.code == Some(1) && name.is_empty() {
        return Ok(None);
    }
    Err(name.to_string())
}

/// Whether `hash` names a commit in this repository.
pub fn git_commit_exists(project: &Path, hash: &str) -> bool {
    if hash.is_empty() || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }
    let target = format!("{hash}^{{commit}}");
    run_limited(
        git(project, &["cat-file", "-e", &target]),
        None,
        QUICK_LIMIT,
    )
    .ok
}

pub fn git_head_short(project: &Path) -> Option<String> {
    let run = run_limited(
        git(project, &["rev-parse", "--short", "HEAD"]),
        None,
        QUICK_LIMIT,
    );
    let hash = run.output.trim();
    (run.ok && !hash.is_empty()).then(|| hash.to_string())
}

/// The full hash of `HEAD`, when there is a commit.
pub fn git_head_full(project: &Path) -> Option<String> {
    let run = run_limited(git(project, &["rev-parse", "HEAD"]), None, QUICK_LIMIT);
    let hash = run.output.trim();
    (run.ok && !hash.is_empty()).then(|| hash.to_string())
}

/// The paths `git status --porcelain=v1 -z` lists (renames name the new path).
pub fn git_status_porcelain(project: &Path) -> Result<Vec<String>, String> {
    let run = run_limited_with(
        git(project, &["status", "--porcelain=v1", "-z"]),
        None,
        QUICK_LIMIT,
        false,
    );
    if !run.ok {
        return Err(run.output.trim().to_string());
    }
    Ok(parse_porcelain(&run.output))
}

/// Read `git status --porcelain=v1 -z`: NUL-separated records of `XY path`, no
/// quoting. A rename or copy record is followed by one more field, the old
/// path, which is skipped (the new path is the one listed).
pub fn parse_porcelain(text: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let mut fields = text.split('\0');
    while let Some(record) = fields.next() {
        let mut chars = record.chars();
        let (Some(x), Some(y), Some(' ')) = (chars.next(), chars.next(), chars.next()) else {
            continue;
        };
        let Some(path) = record.get(x.len_utf8() + y.len_utf8() + 1..) else {
            continue;
        };
        if path.is_empty() {
            continue;
        }
        if matches!(x, 'R' | 'C') || matches!(y, 'R' | 'C') {
            fields.next();
        }
        paths.push(path.to_string());
    }
    paths
}

/// `node console.mjs post --session <sid> --file -` with `patch` on stdin.
pub fn console_post(console_dir: &Path, sid: &str, patch: &serde_json::Value) -> ToolRun {
    let mut cmd = Command::new("node");
    cmd.arg(console_dir.join("console.mjs"))
        .args(["post", "--session", sid, "--file", "-"]);
    run_limited(cmd, Some(&patch.to_string()), QUICK_LIMIT)
}

/// `node console.mjs open --resume <sid> --no-open --workflow <workflow>`: the
/// console holding a session again after it went away, without a browser.
pub fn console_resume(console_dir: &Path, sid: &str, workflow: &str) -> ToolRun {
    let mut cmd = Command::new("node");
    cmd.arg(console_dir.join("console.mjs")).args([
        "open",
        "--resume",
        sid,
        "--no-open",
        "--workflow",
        workflow,
    ]);
    run_limited(cmd, None, QUICK_LIMIT)
}

/// The person's quick check through the platform shell, in `project`.
pub fn quick_check(project: &Path, command: &str, limit: Duration) -> ToolRun {
    let mut cmd;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd = Command::new("cmd");
        // Raw, so a quoted argument reaches cmd.exe as typed (the usual
        // argument quoting would turn each quote into a backslash-quote).
        cmd.arg("/C").raw_arg(command);
    }
    #[cfg(not(windows))]
    {
        cmd = Command::new("sh");
        cmd.args(["-c", command]);
    }
    cmd.current_dir(project);
    run_limited(cmd, None, limit)
}

fn parse_json_object(run: &ToolRun) -> Result<serde_json::Value, String> {
    let text = run.output.trim();
    // Stderr shares the output: take the first line that starts the object.
    let start = text.find('{').unwrap_or(0);
    // Only the first value counts: stderr lines may trail the object.
    let first = serde_json::Deserializer::from_str(&text[start..])
        .into_iter::<serde_json::Value>()
        .next();
    match first {
        Some(Ok(value)) if value.is_object() => Ok(value),
        _ => Err(if text.is_empty() {
            "the tool printed nothing".to_string()
        } else {
            text.to_string()
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_commit_message_is_read_from_the_scripts_output_without_a_shell() {
        let ok = r#"{"ok":true,"subject":"Add it","message":"Add it\n\nAI Assisted"}"#;
        assert_eq!(parse_commit_msg(ok).unwrap(), "Add it\n\nAI Assisted");
        // Stderr noise before the object does not matter.
        let noisy = format!("warning: something\n{ok}\n");
        assert_eq!(parse_commit_msg(&noisy).unwrap(), "Add it\n\nAI Assisted");
        assert_eq!(
            parse_commit_msg(r#"{"ok":false,"error":"subject too long"}"#).unwrap_err(),
            "subject too long"
        );
        assert_eq!(
            parse_commit_msg(r#"{"ok":false,"message":"no subject"}"#).unwrap_err(),
            "no subject"
        );
        assert_eq!(
            parse_commit_msg("not json at all\n").unwrap_err(),
            "not json at all"
        );
        assert!(parse_commit_msg("").is_err());
    }

    #[test]
    fn a_refusal_as_the_script_really_prints_it_reads_as_its_message() {
        let real = "{\n  \"ok\": false,\n  \"error\": \"unsafe-subject\",\n  \"message\": \"The subject has a double quote.\",\n  \"next\": \"Rephrase.\"\n}\nerror: The subject has a double quote.\nnext: Rephrase.\n";
        assert_eq!(
            parse_commit_msg(real).unwrap_err(),
            "The subject has a double quote."
        );
        // ok without a message is still an error, never an empty commit.
        assert!(parse_commit_msg(r#"{"ok":true}"#).is_err());
    }

    #[test]
    fn the_kept_output_is_the_tail() {
        let mut buf = Vec::new();
        append_tail(&mut buf, b"0123456789", 6);
        append_tail(&mut buf, b"AB", 6);
        assert_eq!(buf, b"6789AB");
    }

    #[test]
    fn porcelain_lists_paths_and_the_new_name_of_a_rename() {
        let text = " M src/a.rs\0?? new file.txt\0R  new.rs\0old.rs\0A  \"quoted\".txt\0";
        assert_eq!(
            parse_porcelain(text),
            vec!["src/a.rs", "new file.txt", "new.rs", "\"quoted\".txt"]
        );
        assert!(parse_porcelain("").is_empty());
    }

    #[test]
    fn a_renames_old_path_is_never_read_as_a_record() {
        // The old path could look like a record; it is skipped by position.
        let text = "R  new.rs\0 M fake.rs\0 M real.rs\0";
        assert_eq!(parse_porcelain(text), vec!["new.rs", "real.rs"]);
        // A work-tree rename (intent-to-add) carries the old path too.
        assert_eq!(parse_porcelain(" R new.rs\0 M fake.rs\0"), vec!["new.rs"]);
    }

    #[test]
    fn staged_names_are_split_on_nul() {
        assert_eq!(
            split_nul("a b.txt\0dir/c.rs\0"),
            vec!["a b.txt", "dir/c.rs"]
        );
        assert!(split_nul("").is_empty());
    }

    #[test]
    fn a_call_that_outlives_its_limit_is_stopped_and_says_so() {
        #[cfg(windows)]
        let cmd = {
            let mut c = Command::new("ping");
            c.args(["-n", "30", "127.0.0.1"]);
            c
        };
        #[cfg(not(windows))]
        let cmd = {
            let mut c = Command::new("sleep");
            c.arg("30");
            c
        };
        let run = run_limited(cmd, None, Duration::from_millis(300));
        assert!(!run.ok);
        assert!(run.output.ends_with("(stopped after 1 second)"));
    }

    #[test]
    fn stdin_reaches_the_child_and_its_output_is_kept() {
        #[cfg(windows)]
        let cmd = {
            let mut c = Command::new("findstr");
            c.arg("x*");
            c
        };
        #[cfg(not(windows))]
        let cmd = Command::new("cat");
        let run = run_limited(cmd, Some("hello loop\n"), Duration::from_secs(10));
        assert!(run.ok, "{}", run.output);
        assert!(run.output.contains("hello loop"));
    }

    #[test]
    fn the_first_json_object_in_mixed_output_is_parsed() {
        let run = ToolRun {
            ok: true,
            code: Some(0),
            output: "warning: noise\n{\"ok\":true,\"n\":1}\n".to_string(),
        };
        assert_eq!(parse_json_object(&run).unwrap()["n"], 1);
    }
}
