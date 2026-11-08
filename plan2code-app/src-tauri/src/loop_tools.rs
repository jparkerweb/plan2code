//! The commands the Implementation Loop runs on its own: the spec scripts, git,
//! the console's `post` and the person's quick check. Each call has a time
//! limit and keeps its output. No shell runs here except the quick check, whose
//! text comes only from `loop-setup.json` (never from a page message).

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
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

/// What a stop says when too many files are staged to check.
pub const STAGED_TOO_LONG: &str =
    "too many changed files to check: add generated folders to .gitignore, then Resume";

/// Output kept for the staged-file list the commit gate checks (far above any real list).
const STAGED_LIST_LIMIT: usize = 64 * 1024 * 1024;

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
    keep: Keep,
    cut: Arc<AtomicBool>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut chunk = [0u8; 8192];
        loop {
            match source.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if let Ok(mut buf) = sink.lock() {
                        match keep {
                            Keep::Tail(cap) => append_tail(&mut buf, &chunk[..n], cap),
                            Keep::Head(cap) => {
                                let room = cap.saturating_sub(buf.len()).min(n);
                                buf.extend_from_slice(&chunk[..room]);
                                if room < n {
                                    cut.store(true, Ordering::Relaxed);
                                }
                            }
                        }
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
    cmd: Command,
    stdin: Option<&str>,
    limit: Duration,
    keep_stderr: bool,
) -> ToolRun {
    run_capped(cmd, stdin, limit, keep_stderr, Keep::Tail(OUTPUT_LIMIT)).0
}

/// Which part of a long output a call keeps.
#[derive(Clone, Copy)]
enum Keep {
    /// The last `n` bytes, where a failure says why.
    Tail(usize),
    /// The first `n` bytes; anything after is read and dropped, and the call
    /// reports it was cut. For a list a safety check must read whole.
    Head(usize),
}

/// `run_limited_with` with the part kept chosen, and whether output was dropped.
fn run_capped(
    cmd: Command,
    stdin: Option<&str>,
    limit: Duration,
    keep_stderr: bool,
    keep: Keep,
) -> (ToolRun, bool) {
    let (run, cut, _) = run_capped_bytes(cmd, stdin.map(str::as_bytes), limit, keep_stderr, keep);
    (run, cut)
}

/// `run_capped` that also hands back the kept output as the bytes the child
/// wrote: a path list read from git must not pass through a lossy decode, or a
/// name that is not UTF-8 no longer names its file.
fn run_capped_bytes(
    mut cmd: Command,
    stdin: Option<&[u8]>,
    limit: Duration,
    keep_stderr: bool,
    keep: Keep,
) -> (ToolRun, bool, Vec<u8>) {
    let cut = Arc::new(AtomicBool::new(false));
    cmd.env("PATH", crate::node_check::resolved_path());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    #[cfg(unix)]
    {
        // Its own process group, so a timeout can end every descendant at once.
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
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
            return (
                ToolRun {
                    ok: false,
                    code: None,
                    output: format!("could not start: {e}"),
                },
                false,
                Vec::new(),
            );
        }
    };
    let sink = Arc::new(Mutex::new(Vec::new()));
    let readers = [
        child
            .stdout
            .take()
            .map(|s| pump(s, Arc::clone(&sink), keep, Arc::clone(&cut))),
        child
            .stderr
            .take()
            .map(|s| pump(s, Arc::clone(&sink), keep, Arc::clone(&cut))),
    ];
    if let (Some(text), Some(mut pipe)) = (stdin, child.stdin.take()) {
        // A child that exits before reading closes the pipe: not an error here.
        let _ = pipe.write_all(text);
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
    let raw = sink.lock().map(|buf| buf.clone()).unwrap_or_default();
    let mut output = String::from_utf8_lossy(&raw).into_owned();
    if timed_out {
        if !output.is_empty() && !output.ends_with('\n') {
            output.push('\n');
        }
        output.push_str(&format!("(stopped after {})", describe_limit(limit)));
    }
    (
        ToolRun {
            ok: status.is_some_and(|s| s.success()),
            code: status.and_then(|s| s.code()),
            output,
        },
        cut.load(Ordering::Relaxed),
        raw,
    )
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
        // The child leads its own process group (see run_limited): a negative
        // pid ends the whole group, grandchildren included.
        if let Ok(pgid) = i32::try_from(pid) {
            // SAFETY: kill(2) takes plain integers and touches no memory.
            unsafe {
                libc::kill(-pgid, libc::SIGKILL);
            }
        }
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

/// `commit-msg.mjs --subject <subject>`: the checked message (the Loop stages
/// its own files through `git_add_listed`, so no add is asked for). The
/// script's own subject checks are the only ones.
pub fn commit_message(project: &Path, subject: &str) -> Result<String, String> {
    let script = script_or_err("commit-msg.mjs")?;
    let run = run_limited(
        node_script(&script, project, &["--subject", subject]),
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

/// `git add` of exactly `paths` (relative to the repository's top folder
/// `top`), read from stdin NUL-separated and taken literally: no command line
/// to outgrow, no quoting, and a name such as `[id].tsx` is a file, not a
/// pattern. Nothing to stage is a success.
pub fn git_add_listed(top: &Path, paths: &[GitPath]) -> ToolRun {
    if paths.is_empty() {
        return ToolRun {
            ok: true,
            code: Some(0),
            output: String::new(),
        };
    }
    let mut list = Vec::new();
    for path in paths {
        list.extend_from_slice(&path.bytes);
        list.push(0);
    }
    let cmd = git(
        top,
        &[
            "--literal-pathspecs",
            "add",
            "--pathspec-from-file=-",
            "--pathspec-file-nul",
        ],
    );
    run_capped_bytes(
        cmd,
        Some(&list),
        QUICK_LIMIT,
        true,
        Keep::Tail(OUTPUT_LIMIT),
    )
    .0
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

/// A path git printed, relative to the repository's top folder: the bytes as
/// git wrote them (so a name that is not UTF-8 still reaches its file) and the
/// same name made readable, for messages and for comparing with name lists.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GitPath {
    pub bytes: Vec<u8>,
    pub shown: String,
}

impl GitPath {
    pub fn from_bytes(bytes: &[u8]) -> GitPath {
        GitPath {
            bytes: bytes.to_vec(),
            shown: String::from_utf8_lossy(bytes).into_owned(),
        }
    }

    /// The file on disk under `top`. On Unix the name is the exact bytes; git
    /// writes UTF-8 names on Windows, where a file name cannot be anything else.
    pub fn under(&self, top: &Path) -> PathBuf {
        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;
            top.join(std::ffi::OsStr::from_bytes(&self.bytes))
        }
        #[cfg(not(unix))]
        {
            top.join(&self.shown)
        }
    }
}

/// The names of the staged files, as `git diff --cached --name-only -z` prints
/// them: NUL-separated, so no path is quoted, and read as bytes.
pub fn git_staged(project: &Path) -> Result<Vec<GitPath>, String> {
    git_staged_capped(project, STAGED_LIST_LIMIT)
}

/// `git_staged` with the size the list may reach. The secret and size gate
/// reads every staged name, so a list over the cap fails closed rather than
/// being checked in part.
fn git_staged_capped(project: &Path, cap: usize) -> Result<Vec<GitPath>, String> {
    let (run, cut, raw) = run_capped_bytes(
        git(project, &["diff", "--cached", "--name-only", "-z"]),
        None,
        QUICK_LIMIT,
        false,
        Keep::Head(cap),
    );
    if !run.ok {
        return Err(run.output.trim().to_string());
    }
    if cut {
        return Err(STAGED_TOO_LONG.to_string());
    }
    Ok(split_nul(&raw))
}

fn split_nul(bytes: &[u8]) -> Vec<GitPath> {
    bytes
        .split(|b| *b == 0)
        .filter(|name| !name.is_empty())
        .map(GitPath::from_bytes)
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
    Ok(git_changed(project)?
        .into_iter()
        .map(|path| path.shown)
        .collect())
}

/// `git_status_porcelain` with each path kept as git wrote it, relative to the
/// repository's top folder: the list the loop stages from.
pub fn git_changed(project: &Path) -> Result<Vec<GitPath>, String> {
    let (run, cut, raw) = run_capped_bytes(
        // Untracked files are listed whatever `status.showUntrackedFiles`
        // says: with it at `no`, the agent's new files would miss the commit. `all` lists each file,
        // not a folder, so a folder that was untracked before the phase never hides or swallows files.
        git(
            project,
            &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        ),
        None,
        QUICK_LIMIT,
        false,
        Keep::Head(STAGED_LIST_LIMIT),
    );
    if !run.ok {
        return Err(run.output.trim().to_string());
    }
    // A list cut short would name only some of the files: never stage from it.
    if cut {
        return Err(STAGED_TOO_LONG.to_string());
    }
    Ok(porcelain_paths(&raw)
        .into_iter()
        .map(GitPath::from_bytes)
        .collect())
}

/// Read `git status --porcelain=v1 -z`: NUL-separated records of `XY path`, no
/// quoting. A rename or copy record is followed by one more field, the old
/// path, which is skipped (the new path is the one listed).
pub fn parse_porcelain(text: &str) -> Vec<String> {
    porcelain_paths(text.as_bytes())
        .into_iter()
        .map(|path| String::from_utf8_lossy(path).into_owned())
        .collect()
}

/// `parse_porcelain` over the bytes git wrote. The two status letters and the
/// space are ASCII, so the path is whatever follows them.
fn porcelain_paths(bytes: &[u8]) -> Vec<&[u8]> {
    let mut paths = Vec::new();
    let mut fields = bytes.split(|b| *b == 0);
    while let Some(record) = fields.next() {
        let [x, y, b' ', path @ ..] = record else {
            continue;
        };
        if path.is_empty() {
            continue;
        }
        if matches!(x, b'R' | b'C') || matches!(y, b'R' | b'C') {
            fields.next();
        }
        paths.push(path);
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
    fn a_capped_run_keeps_the_part_asked_for_and_says_when_output_was_cut() {
        if Command::new("node").arg("--version").output().is_err() {
            assert!(std::env::var_os("CI").is_none(), "node is not on PATH");
            return;
        }
        fn run(keep: Keep, text: &str) -> (ToolRun, bool) {
            let mut cmd = Command::new("node");
            cmd.args(["-e", &format!("process.stdout.write('{text}')")]);
            run_capped(cmd, None, QUICK_LIMIT, false, keep)
        }
        let (tail, tail_cut) = run(Keep::Tail(4), "aaaabbbb");
        assert!(tail.ok);
        assert_eq!(tail.output, "bbbb");
        assert!(!tail_cut, "a tail keeper never reports a cut");
        let (head, head_cut) = run(Keep::Head(4), "aaaabbbb");
        assert_eq!(head.output, "aaaa");
        assert!(head_cut);
        let (whole, whole_cut) = run(Keep::Head(8), "aaaabbbb");
        assert_eq!(whole.output, "aaaabbbb");
        assert!(!whole_cut);
    }

    #[test]
    fn a_staged_list_over_the_cap_is_refused_not_checked_in_part() {
        if Command::new("git").arg("--version").output().is_err() {
            assert!(std::env::var_os("CI").is_none(), "git is not on PATH");
            return;
        }
        let repo =
            std::env::temp_dir().join(format!("plan2code-staged-cap-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&repo);
        std::fs::create_dir_all(&repo).unwrap();
        let git_in = |args: &[&str]| {
            let status = Command::new("git")
                .args(args)
                .current_dir(&repo)
                .status()
                .unwrap();
            assert!(status.success(), "git {args:?}");
        };
        git_in(&["init", "-q"]);
        for name in [".env", "a.txt", "b.txt"] {
            std::fs::write(repo.join(name), "x").unwrap();
        }
        git_in(&["add", "-A"]);
        // A cap below the list's size: refused, never a list missing its first names.
        assert_eq!(
            git_staged_capped(&repo, 8),
            Err(STAGED_TOO_LONG.to_string())
        );
        let all: Vec<String> = git_staged_capped(&repo, 1024)
            .unwrap()
            .into_iter()
            .map(|path| path.shown)
            .collect();
        assert_eq!(all, [".env", "a.txt", "b.txt"]);
        let _ = std::fs::remove_dir_all(&repo);
    }

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
        let shown: Vec<String> = split_nul(b"a b.txt\0dir/c.rs\0")
            .into_iter()
            .map(|path| path.shown)
            .collect();
        assert_eq!(shown, vec!["a b.txt", "dir/c.rs"]);
        assert!(split_nul(b"").is_empty());
    }

    #[test]
    fn a_name_that_is_not_utf8_keeps_its_bytes() {
        let names = split_nul(b"caf\xe9.bin\0ok.txt\0");
        assert_eq!(names[0].bytes, b"caf\xe9.bin");
        assert_eq!(names[0].shown, "caf\u{fffd}.bin");
        // The porcelain reader keeps the bytes too, and still skips a rename's old path.
        let paths = porcelain_paths(b"?? caf\xe9.bin\0R  new.rs\0old.rs\0");
        assert_eq!(paths, vec![&b"caf\xe9.bin"[..], &b"new.rs"[..]]);
        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;
            let file = names[0].under(Path::new("/top"));
            assert_eq!(file.as_os_str().as_bytes(), b"/top/caf\xe9.bin");
        }
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
