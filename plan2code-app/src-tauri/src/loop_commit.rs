//! The commit step of the Implementation Loop: its order, and nothing else.
//!
//! A passed phase goes through five calls, in this order: `prepare` (everything
//! that can fail, before any file is touched), `stage_and_check` (stage the
//! files the phase changed, then refuse a secret or an oversized file), `mark` (save the files, mark the
//! phase done, write the approval line), `commit` (stage the marked files and
//! commit) and, when the commit fails, `undo` (put the saved text back). The
//! driver decides what to say and where to stop; this module only does the work
//! and names the failure.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::Value;

use crate::loop_driver::{with_approval_line, write_atomic};
use crate::loop_report::LoopReport;
use crate::loop_tools;

/// What `prepare` settled before any file was touched.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Prepared {
    pub message: String,
    pub phase_file: PathBuf,
}

/// The phase file named by a row of `specs.mjs status`, as a path under
/// `<project>/<spec>/`. Refuses a name that is missing, empty, climbs out of
/// the folder (`..`, a separator, a drive letter) or does not exist.
pub fn phase_file(project: &Path, spec: &str, entry: &Value) -> Result<PathBuf, String> {
    let file = entry["file"].as_str().unwrap_or("").trim();
    if file.is_empty() {
        return Err("the spec names no phase file for this phase".to_string());
    }
    let unsafe_name = file.contains("..")
        || file.contains('/')
        || file.contains('\\')
        || file.contains('\0')
        || file.chars().nth(1) == Some(':');
    if unsafe_name {
        return Err(format!(
            "the phase file name {file} is not a plain file name"
        ));
    }
    let path = project.join(spec).join(file);
    if !path.is_file() {
        return Err(format!("the phase file {file} does not exist in {spec}"));
    }
    Ok(path)
}

/// Everything that can fail before a file changes: the commit message and the
/// phase file. Nothing is written.
pub fn prepare(
    project: &Path,
    spec: &str,
    entry: &Value,
    subject: &str,
) -> Result<Prepared, String> {
    let phase_file = phase_file(project, spec, entry)?;
    let message = loop_tools::commit_message(project, subject)
        .map_err(|e| format!("the commit message was refused: {e}"))?;
    Ok(Prepared {
        message,
        phase_file,
    })
}

/// The text of the two files `specs.mjs mark` changes, before and after the
/// loop wrote them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Marked {
    /// The phase file before the mark, and as the loop left it.
    pub saved: String,
    pub written: String,
    /// The same for `overview.md`, whose checkbox the mark flips.
    pub overview: PathBuf,
    pub overview_saved: String,
    pub overview_written: String,
}

fn read(file: &Path) -> Result<String, String> {
    std::fs::read_to_string(file).map_err(|e| format!("{} could not be read ({e})", file.display()))
}

/// Why `mark` failed, and whether the files could be put back. When they could
/// not, the phase may be left marked done and the driver must say so.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MarkFailure {
    pub message: String,
    pub put_back_failed: bool,
}

/// Mark the phase done and write the approval line, keeping the text of both
/// files so `undo` can take it back. On any failure both files are put back
/// before the error is returned.
pub fn mark(
    prepared: &Prepared,
    project: &Path,
    spec: &str,
    phase: u32,
    approval: &str,
) -> Result<Marked, MarkFailure> {
    let plain = |message: String| MarkFailure {
        message,
        put_back_failed: false,
    };
    let overview = project.join(spec).join("overview.md");
    let saved = read(&prepared.phase_file).map_err(plain)?;
    let overview_saved = read(&overview).map_err(plain)?;
    let fail = |message: String| {
        let phase_back = write_atomic(&prepared.phase_file, &saved);
        let overview_back = write_atomic(&overview, &overview_saved);
        MarkFailure {
            put_back_failed: phase_back.is_err() || overview_back.is_err(),
            message,
        }
    };
    let run = loop_tools::specs_mark_done(project, spec, phase);
    if !run.ok {
        return Err(fail(run.output.trim().to_string()));
    }
    let written = read(&prepared.phase_file)
        .map(|text| with_approval_line(&text, approval))
        .and_then(|text| {
            write_atomic(&prepared.phase_file, &text)
                .map(|()| text)
                .map_err(|e| format!("the approval line could not be written ({e})"))
        })
        .map_err(&fail)?;
    let overview_written = read(&overview).map_err(&fail)?;
    Ok(Marked {
        saved,
        written,
        overview,
        overview_saved,
        overview_written,
    })
}

/// Take the mark back: both files get their saved text again, but only while
/// both still hold what the loop wrote, so an edit the person made in between
/// is never overwritten. Nothing is written unless both can be restored, so the
/// mark is either fully off or fully on; the error names each file that could
/// not be.
pub fn undo(prepared: &Prepared, marked: &Marked) -> Result<(), String> {
    let files = [
        (&prepared.phase_file, &marked.saved, &marked.written),
        (
            &marked.overview,
            &marked.overview_saved,
            &marked.overview_written,
        ),
    ];
    let name = |file: &Path| {
        file.file_name()
            .map_or_else(String::new, |n| n.to_string_lossy().into_owned())
    };
    let changed: Vec<String> = files
        .iter()
        .filter(|(file, _, written)| std::fs::read_to_string(file).ok().as_ref() != Some(*written))
        .map(|(file, _, _)| name(file))
        .collect();
    if !changed.is_empty() {
        return Err(format!(
            "{} changed since the loop wrote it, so it was not restored",
            changed.join(" and ")
        ));
    }
    for (file, saved, _) in files {
        write_atomic(file, saved)
            .map_err(|e| format!("{} could not be restored ({e})", name(file)))?;
    }
    Ok(())
}

/// Which call failed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    Add,
    Commit,
}

/// A failed `git add` or `git commit`, with what it printed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitFailure {
    pub stage: Stage,
    pub first_line: String,
    pub output: String,
}

/// The first non-empty line of `output`, trimmed, at most 160 characters.
pub fn first_line(output: &str) -> String {
    let line = output
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("");
    if line.chars().count() > 160 {
        let cut: String = line.chars().take(157).collect();
        format!("{cut}...")
    } else {
        line.to_string()
    }
}

/// The largest file the loop will commit.
pub const MAX_STAGED_BYTES: u64 = 5 * 1024 * 1024;

/// File-name suffixes of a key or certificate.
const SECRET_SUFFIXES: [&str; 5] = [".pem", ".key", ".p12", ".pfx", ".keystore"];
/// Names an `.env` file may carry and still be committed: a template.
const ENV_TEMPLATES: [&str; 3] = [".example", ".sample", ".template"];
/// Private-key files with no suffix.
const KEY_NAMES: [&str; 2] = ["id_rsa", "id_ed25519"];

/// Why a staged file must not be committed, or `None`. Only the file name is
/// read (the part after the last separator, any case), so a folder named `.env`
/// does not match and `environment.md` or `monkey.txt` does not either.
pub fn denied(path: &str) -> Option<&'static str> {
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path);
    let name = name.to_lowercase();
    if name == ".env"
        || (name.starts_with(".env.") && !ENV_TEMPLATES.iter().any(|suffix| name.ends_with(suffix)))
    {
        return Some("an environment file");
    }
    if SECRET_SUFFIXES.iter().any(|suffix| name.ends_with(suffix)) {
        return Some("a key or certificate");
    }
    if KEY_NAMES.contains(&name.as_str()) {
        return Some("a private key");
    }
    if name == "credentials.json" || name.starts_with("secrets.") {
        return Some("a credentials file");
    }
    if name.ends_with(".loop-tmp") {
        return Some("a temporary file of the loop");
    }
    None
}

/// A staged file and its size on disk.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StagedFile {
    pub path: String,
    pub bytes: u64,
}

/// Whether the file is over `MAX_STAGED_BYTES`.
pub fn too_big(file: &StagedFile) -> bool {
    file.bytes > MAX_STAGED_BYTES
}

/// A staged file's size from its `symlink_metadata` result: a file that is
/// gone is a deletion and counts as 0 bytes; any other error means the size is
/// not known, so the gate refuses it (`None`) rather than counting 0.
pub fn staged_size(meta: std::io::Result<u64>) -> Option<u64> {
    match meta {
        Ok(bytes) => Some(bytes),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Some(0),
        Err(_) => None,
    }
}

/// What a stop says when the files this phase changed cannot be listed, so the
/// loop cannot tell its own files from the person's.
pub const OWN_FILES_UNKNOWN: &str =
    "the files this phase changed could not be listed, so nothing was staged";

/// Staged files the loop refuses to commit, by their names.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StagedProblem {
    pub files: Vec<String>,
    pub why: &'static str,
    /// Set when the files could not be taken out of the index again: git's
    /// first line. They are still staged.
    pub left_staged: Option<String>,
}

/// Why `stage_and_check` stopped: `git add` itself failed, or the staged list
/// holds something that must not be committed (and was unstaged again).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StageError {
    Add(CommitFailure),
    Problem(StagedProblem),
}

/// Stage the files this phase changed and look at the list before anything is
/// marked. `baseline` is what `git status` listed when the phase began (the
/// person's own changes, left out); `None` when it could not be read. The
/// phase's files are what `git status` lists now less the baseline, staged by
/// name, never with `git add -A`. A baseline or a list that cannot be read
/// stops here with nothing staged. Any secret-looking or oversized file, or
/// one whose size cannot be read, takes everything out of the index again and
/// returns every offending path.
pub fn stage_and_check(project: &Path, baseline: Option<&[String]>) -> Result<(), StageError> {
    let unknown = |output: String| {
        StageError::Add(CommitFailure {
            stage: Stage::Add,
            first_line: OWN_FILES_UNKNOWN.to_string(),
            output,
        })
    };
    let baseline = baseline
        .ok_or_else(|| unknown("git status could not be read when the phase began".to_string()))?;
    // Changed names are relative to the repository's top folder.
    let top = loop_tools::git_toplevel(project)
        .ok_or_else(|| unknown("the repository's top folder could not be found".to_string()))?;
    // A list over the cap keeps its own advice (add generated folders to
    // .gitignore) as the stop line; any other failure is the generic one.
    let changed = loop_tools::git_changed(project).map_err(|output| {
        if output == loop_tools::STAGED_TOO_LONG {
            StageError::Add(CommitFailure {
                stage: Stage::Add,
                first_line: output.clone(),
                output,
            })
        } else {
            unknown(output)
        }
    })?;
    // A set, not a slice scan: with every untracked file listed, a big folder makes both lists long.
    let before: std::collections::HashSet<&str> = baseline.iter().map(String::as_str).collect();
    let own: Vec<loop_tools::GitPath> = changed
        .into_iter()
        .filter(|path| !before.contains(path.shown.as_str()))
        .collect();
    let added = loop_tools::git_add_listed(&top, &own);
    if !added.ok {
        return Err(StageError::Add(CommitFailure {
            stage: Stage::Add,
            first_line: first_line(&added.output),
            output: added.output,
        }));
    }
    let staged = loop_tools::git_staged(project).map_err(|output| {
        StageError::Add(CommitFailure {
            stage: Stage::Add,
            first_line: first_line(&output),
            output,
        })
    })?;
    let mut secrets = false;
    let mut big = false;
    let mut unreadable = false;
    let mut files = Vec::new();
    for path in staged {
        // Sized by the exact bytes git wrote, so a name that is not UTF-8 is
        // still the real file. A deleted file counts as 0 bytes.
        let size = staged_size(std::fs::symlink_metadata(path.under(&top)).map(|m| m.len()));
        let file = StagedFile {
            path: path.shown,
            bytes: size.unwrap_or(0),
        };
        let is_secret = denied(&file.path).is_some();
        let is_big = too_big(&file);
        let is_unsized = size.is_none();
        if is_secret || is_big || is_unsized {
            secrets |= is_secret;
            big |= is_big;
            unreadable |= is_unsized;
            files.push(file.path);
        }
    }
    if files.is_empty() {
        return Ok(());
    }
    let unstaged = loop_tools::git_unstage_all(project);
    let left_staged = (!unstaged.ok).then(|| first_line(&unstaged.output));
    let why = match (secrets, big, unreadable) {
        (true, true, false) => "look like secrets or are over 5 MB",
        (true, false, false) => "look like secrets",
        (false, true, false) => "are over 5 MB",
        (false, false, true) => "could not be sized",
        (true, false, true) => "look like secrets or could not be sized",
        (false, true, true) => "are over 5 MB or could not be sized",
        _ => "look like secrets, are over 5 MB or could not be sized",
    };
    Err(StageError::Problem(StagedProblem {
        files,
        why,
        left_staged,
    }))
}

/// Commit what `stage_and_check` staged, plus the two files the mark changed
/// since: the phase file and `overview.md`. The short hash of the new commit.
/// `limit` is the commit's own time limit, for a slow hook.
pub fn commit(
    project: &Path,
    prepared: &Prepared,
    marked: &Marked,
    limit: Duration,
) -> Result<Option<String>, CommitFailure> {
    let added = loop_tools::git_add_paths(project, &[&prepared.phase_file, &marked.overview]);
    if !added.ok {
        return Err(CommitFailure {
            stage: Stage::Add,
            first_line: first_line(&added.output),
            output: added.output,
        });
    }
    let done = loop_tools::git_commit_with(project, &prepared.message, limit);
    if !done.ok {
        // A cut-off commit says so on its last line, after whatever a hook
        // printed first; lead with that.
        let cut_off = done
            .output
            .lines()
            .last()
            .filter(|line| line.starts_with("(stopped after"))
            .map(|line| {
                format!(
                    "the commit was {} (a hook ran too long)",
                    line.trim_matches(|c| c == '(' || c == ')')
                )
            });
        return Err(CommitFailure {
            stage: Stage::Commit,
            first_line: cut_off.unwrap_or_else(|| first_line(&done.output)),
            output: done.output,
        });
    }
    Ok(loop_tools::git_head_short(project))
}

/// Take what a failed commit left staged out of the index, so a commit the
/// person makes by hand does not carry a mark the loop took back.
pub fn unstage(project: &Path) -> Option<String> {
    let unstaged = loop_tools::git_unstage_all(project);
    (!unstaged.ok).then(|| first_line(&unstaged.output))
}

/// The phases the spec shows done (`done`) that the commit log does not hold:
/// one the loop built whose recorded commit is gone from the history, and the
/// phase a failed undo left marked. A phase the loop never recorded is trusted
/// (the person built it).
pub fn marks_without_commits(
    project: &Path,
    _spec: &str,
    done: &[u32],
    report: &LoopReport,
) -> Vec<u32> {
    let mut missing: Vec<u32> = report
        .passed()
        .iter()
        .filter(|entry| done.contains(&entry.phase))
        .filter(|entry| {
            entry
                .commit
                .as_deref()
                .is_some_and(|hash| !loop_tools::git_commit_exists(project, hash))
        })
        .map(|entry| entry.phase)
        .collect();
    if let Some(left) = &report.marked_not_committed {
        if done.contains(&left.phase) && !missing.contains(&left.phase) {
            missing.push(left.phase);
        }
    }
    missing.sort_unstable();
    missing
}

/// With commit on, the phases `status` shows done that have no commit behind
/// them (see `marks_without_commits`). With commit off a mark is trusted.
/// Reads only: nothing is written until the person has confirmed the Start.
pub fn unbacked_marks(
    project: &Path,
    spec: &str,
    status: &Value,
    report: &LoopReport,
    commit: bool,
) -> Vec<u32> {
    if !commit {
        return Vec::new();
    }
    let done: Vec<u32> = status["phases"]
        .as_array()
        .map(|all| {
            all.iter()
                .filter(|p| crate::loop_driver::checklist_done(p))
                .filter_map(|p| u32::try_from(p["number"].as_u64()?).ok())
                .collect()
        })
        .unwrap_or_default();
    marks_without_commits(project, spec, &done, report)
}

/// Open each of `phases` again through `specs.mjs`: `open` first, which also
/// sets a Complete phase file back to In Progress, then `in-progress`.
pub fn reopen(project: &Path, spec: &str, phases: &[u32]) -> Result<(), String> {
    for &n in phases {
        for to in ["open", "in-progress"] {
            let run = loop_tools::specs_mark(project, spec, n, to);
            if !run.ok {
                return Err(format!(
                    "Phase {n} is marked done with no commit, and could not be opened again: {}",
                    first_line(&run.output)
                ));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_spec(name: &str) -> (PathBuf, PathBuf) {
        let base = std::env::temp_dir().join(format!(
            "plan2code-loop-commit-{name}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&base);
        let spec = base.join("specs/lunch");
        std::fs::create_dir_all(&spec).unwrap();
        (base, spec)
    }

    #[test]
    fn the_first_line_skips_blanks_and_is_cut_at_160_characters() {
        assert_eq!(first_line("\n  \n  lint says no \nsecond"), "lint says no");
        assert_eq!(first_line(""), "");
        let long = "x".repeat(300);
        let line = first_line(&long);
        assert_eq!(line.chars().count(), 160);
        assert!(line.ends_with("..."));
        assert_eq!(first_line(&"y".repeat(160)).chars().count(), 160);
    }

    #[test]
    fn a_phase_file_must_be_a_plain_name_that_exists() {
        let (base, spec) = temp_spec("names");
        std::fs::write(spec.join("phase-2.md"), "x").unwrap();
        std::fs::write(base.join("secret.md"), "x").unwrap();
        let ok = phase_file(&base, "specs/lunch", &json!({ "file": "phase-2.md" }));
        assert_eq!(ok.unwrap(), spec.join("phase-2.md"));
        for (entry, word) in [
            (json!({}), "no phase file"),
            (json!({ "file": "" }), "no phase file"),
            (json!({ "file": "  " }), "no phase file"),
            (json!({ "file": "../../secret.md" }), "plain file name"),
            (json!({ "file": "sub/phase-2.md" }), "plain file name"),
            (json!({ "file": "sub\\phase-2.md" }), "plain file name"),
            (json!({ "file": "C:phase-2.md" }), "plain file name"),
            (json!({ "file": "phase-9.md" }), "does not exist"),
        ] {
            let err = phase_file(&base, "specs/lunch", &entry).unwrap_err();
            assert!(err.contains(word), "{entry}: {err}");
        }
    }

    const OVERVIEW: &str =
        "# Lunch - Overview\n\n## Phase Checklist\n\n- [/] [Phase 2: P2](./phase-2.md)\n";
    const PHASE: &str = "# Phase 2: P2\n\n**Status:** In Progress\n\n## Tasks\n\n- [x] **Task 2.1:** First\n\n## Phase Completion Summary\n\nBuilt it.\n";

    fn marked_spec(name: &str) -> (PathBuf, Prepared) {
        let (base, spec) = temp_spec(name);
        std::fs::write(spec.join("overview.md"), OVERVIEW).unwrap();
        std::fs::write(spec.join("phase-2.md"), PHASE).unwrap();
        let prepared = Prepared {
            message: "Add it\n\nAI Assisted".to_string(),
            phase_file: spec.join("phase-2.md"),
        };
        (base, prepared)
    }

    fn node_ready() -> bool {
        loop_tools::skill_script("specs.mjs").is_some()
            && std::process::Command::new("node")
                .arg("--version")
                .output()
                .is_ok_and(|out| out.status.success())
    }

    #[test]
    fn mark_writes_the_approval_line_and_undo_puts_both_files_back() {
        if !node_ready() {
            assert!(std::env::var_os("CI").is_none(), "node is not on PATH");
            return;
        }
        let (base, prepared) = marked_spec("undo");
        let marked = mark(&prepared, &base, "specs/lunch", 2, "Approved by the loop.").unwrap();
        let overview = std::fs::read_to_string(&marked.overview).unwrap();
        assert!(overview.contains("[x] [Phase 2"), "{overview}");
        let phase = std::fs::read_to_string(&prepared.phase_file).unwrap();
        assert!(phase.contains("Approved by the loop."), "{phase}");
        assert_eq!(phase, marked.written);
        undo(&prepared, &marked).unwrap();
        assert_eq!(
            std::fs::read_to_string(&prepared.phase_file).unwrap(),
            PHASE
        );
        assert_eq!(std::fs::read_to_string(&marked.overview).unwrap(), OVERVIEW);
    }

    #[test]
    fn undo_will_not_overwrite_an_edit_made_since_and_names_the_file() {
        if !node_ready() {
            assert!(std::env::var_os("CI").is_none(), "node is not on PATH");
            return;
        }
        let (base, prepared) = marked_spec("edited");
        let marked = mark(&prepared, &base, "specs/lunch", 2, "Approved.").unwrap();
        let mut edited = marked.written.clone();
        edited.push_str("\nMy own note.\n");
        std::fs::write(&prepared.phase_file, &edited).unwrap();
        let err = undo(&prepared, &marked).unwrap_err();
        assert!(err.contains("phase-2.md"), "{err}");
        assert!(!err.contains("overview.md"), "{err}");
        assert_eq!(
            std::fs::read_to_string(&prepared.phase_file).unwrap(),
            edited,
            "the edit stays"
        );
        assert_eq!(
            std::fs::read_to_string(&marked.overview).unwrap(),
            marked.overview_written,
            "nothing is restored unless both files can be"
        );
    }

    #[test]
    fn prepare_refuses_an_unsafe_phase_file_before_anything_is_touched() {
        let (base, prepared) = marked_spec("prepare");
        for file in ["../../secret.md", "", "phase-9.md"] {
            let err =
                prepare(&base, "specs/lunch", &json!({ "file": file }), "Add it").unwrap_err();
            assert!(!err.is_empty());
        }
        assert_eq!(
            std::fs::read_to_string(&prepared.phase_file).unwrap(),
            PHASE
        );
        let overview = base.join("specs/lunch/overview.md");
        assert_eq!(std::fs::read_to_string(overview).unwrap(), OVERVIEW);
    }

    #[test]
    fn marks_are_found_with_commit_on_and_reopened_only_when_asked() {
        if !node_ready() {
            assert!(std::env::var_os("CI").is_none(), "node is not on PATH");
            return;
        }
        let (base, prepared) = marked_spec("reopen");
        mark(&prepared, &base, "specs/lunch", 2, "Approved.").unwrap();
        let status = loop_tools::specs_status(&base, "specs/lunch").unwrap();
        assert_eq!(status["phases"][0]["marker"], "x");
        let mut report = LoopReport::new("specs/lunch", "now");
        report.marked_not_committed = Some(crate::loop_report::MarkedNotCommitted {
            phase: 2,
            file: "phase-2.md".into(),
        });
        // Commit off: a mark is trusted.
        assert!(unbacked_marks(&base, "specs/lunch", &status, &report, false).is_empty());
        // Commit on: the saved fact names the phase, and finding it writes nothing.
        let found = unbacked_marks(&base, "specs/lunch", &status, &report, true);
        assert_eq!(found, vec![2]);
        let still = loop_tools::specs_status(&base, "specs/lunch").unwrap();
        assert_eq!(still["phases"][0]["marker"], "x");
        // Reopening sets the overview and the phase file's Status back.
        reopen(&base, "specs/lunch", &found).unwrap();
        let after = loop_tools::specs_status(&base, "specs/lunch").unwrap();
        assert_eq!(after["phases"][0]["marker"], "/");
        let phase = std::fs::read_to_string(&prepared.phase_file).unwrap();
        assert!(phase.contains("**Status:** In Progress"), "{phase}");
    }

    #[test]
    fn a_failed_mark_leaves_both_files_as_they_were() {
        if !node_ready() {
            assert!(std::env::var_os("CI").is_none(), "node is not on PATH");
            return;
        }
        let (base, prepared) = marked_spec("failed-mark");
        // Phase 9 is not in the overview, so the script refuses.
        let err = mark(&prepared, &base, "specs/lunch", 9, "Approved.").unwrap_err();
        assert!(!err.message.is_empty());
        assert!(!err.put_back_failed);
        assert_eq!(
            std::fs::read_to_string(&prepared.phase_file).unwrap(),
            PHASE
        );
        let overview = base.join("specs/lunch/overview.md");
        assert_eq!(std::fs::read_to_string(overview).unwrap(), OVERVIEW);
    }

    #[test]
    fn a_report_that_names_a_marked_phase_is_rebuilt_only_when_the_spec_shows_it_done() {
        let (base, _) = temp_spec("marks");
        let mut report = LoopReport::new("specs/lunch", "now");
        report.marked_not_committed = Some(crate::loop_report::MarkedNotCommitted {
            phase: 3,
            file: "phase-3.md".into(),
        });
        assert_eq!(
            marks_without_commits(&base, "specs/lunch", &[1, 3], &report),
            vec![3]
        );
        assert!(marks_without_commits(&base, "specs/lunch", &[1], &report).is_empty());
    }

    fn git_in(repo: &Path, args: &[&str]) -> String {
        let out = std::process::Command::new("git")
            .args(args)
            .current_dir(repo)
            .output()
            .expect("run git");
        assert!(
            out.status.success(),
            "git {args:?}: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    fn git_ready() -> bool {
        let found = std::process::Command::new("git")
            .arg("--version")
            .output()
            .is_ok_and(|out| out.status.success());
        if !found {
            assert!(std::env::var_os("CI").is_none(), "git is not on PATH");
        }
        found
    }

    #[test]
    fn secret_looking_names_are_denied_and_templates_are_not() {
        for name in [
            ".env",
            ".env.local",
            ".env.production",
            ".ENV",
            "a/b/.env",
            "server.pem",
            "tls.KEY",
            "cert.p12",
            "cert.pfx",
            "release.keystore",
            "id_rsa",
            "home/.ssh/id_ed25519",
            "credentials.json",
            "config\\credentials.json",
            "secrets.yml",
            "Secrets.json",
            "x/y.loop-tmp",
        ] {
            assert!(denied(name).is_some(), "{name} should be denied");
        }
        for name in [
            ".env.example",
            ".env.production.example",
            ".env.local.sample",
            ".env.sample",
            ".env.template",
            "app/.env.EXAMPLE",
            "environment.md",
            "monkey.txt",
            "keyboard.rs",
            "id_rsa.pub",
            "my-credentials.json.md",
            "secretsauce.md",
            "src/.env/readme.md",
            "tmp.loop-tmp.md",
        ] {
            assert_eq!(denied(name), None, "{name} should be allowed");
        }
    }

    #[test]
    fn a_file_is_too_big_only_over_five_megabytes() {
        let file = |bytes| StagedFile {
            path: "a.bin".into(),
            bytes,
        };
        assert!(!too_big(&file(0)));
        assert!(!too_big(&file(MAX_STAGED_BYTES)));
        assert!(too_big(&file(MAX_STAGED_BYTES + 1)));
    }

    fn init_repo(name: &str) -> PathBuf {
        let (base, _) = temp_spec(name);
        git_in(&base, &["init", "-q"]);
        for (key, value) in [
            ("user.name", "Loop Test"),
            ("user.email", "loop@example.com"),
            ("commit.gpgsign", "false"),
            ("core.autocrlf", "false"),
            ("core.hooksPath", ".git/hooks"),
        ] {
            git_in(&base, &["config", key, value]);
        }
        base
    }

    #[test]
    fn staging_stops_on_every_secret_and_oversized_file_and_unstages_all() {
        if !git_ready() {
            return;
        }
        let repo = init_repo("stage-problem");
        std::fs::write(repo.join("ok.txt"), "fine").unwrap();
        std::fs::write(repo.join(".env"), "KEY=1").unwrap();
        std::fs::write(repo.join(".env.example"), "KEY=").unwrap();
        std::fs::create_dir_all(repo.join("sub")).unwrap();
        std::fs::write(repo.join("sub/server.pem"), "x").unwrap();
        let big = std::fs::File::create(repo.join("big.bin")).unwrap();
        big.set_len(MAX_STAGED_BYTES + 1).unwrap();
        // No commit yet: unstaging must work without a HEAD.
        let Err(StageError::Problem(problem)) = stage_and_check(&repo, Some(&[])) else {
            panic!("expected a problem");
        };
        let mut files = problem.files.clone();
        files.sort();
        assert_eq!(files, vec![".env", "big.bin", "sub/server.pem"]);
        assert_eq!(problem.why, "look like secrets or are over 5 MB");
        assert_eq!(git_in(&repo, &["diff", "--cached", "--name-only"]), "");

        // Once the offenders are gone, the same call stages the rest.
        std::fs::remove_file(repo.join(".env")).unwrap();
        std::fs::remove_file(repo.join("big.bin")).unwrap();
        std::fs::remove_file(repo.join("sub/server.pem")).unwrap();
        stage_and_check(&repo, Some(&[])).expect("a clean list passes");
        let staged = git_in(&repo, &["diff", "--cached", "--name-only"]);
        assert!(staged.contains("ok.txt") && staged.contains(".env.example"));
    }

    #[test]
    fn a_deleted_ordinary_file_passes_and_a_big_one_alone_says_so() {
        if !git_ready() {
            return;
        }
        let repo = init_repo("stage-deleted");
        std::fs::write(repo.join("a.txt"), "a").unwrap();
        git_in(&repo, &["add", "-A"]);
        git_in(&repo, &["commit", "-q", "-m", "First"]);
        std::fs::remove_file(repo.join("a.txt")).unwrap();
        stage_and_check(&repo, Some(&[])).expect("a deletion of an ordinary file passes");
        git_in(&repo, &["reset", "-q"]);
        let big = std::fs::File::create(repo.join("huge.dat")).unwrap();
        big.set_len(MAX_STAGED_BYTES + 1).unwrap();
        let Err(StageError::Problem(problem)) = stage_and_check(&repo, Some(&[])) else {
            panic!("expected a problem");
        };
        assert_eq!(problem.files, vec!["huge.dat"]);
        assert_eq!(problem.why, "are over 5 MB");
        assert_eq!(git_in(&repo, &["diff", "--cached", "--name-only"]), "");
    }

    #[test]
    fn commit_stages_the_marked_files_but_leaves_an_ignored_spec_folder_alone() {
        if !git_ready() || !node_ready() {
            assert!(
                std::env::var_os("CI").is_none(),
                "git or node is not on PATH"
            );
            return;
        }
        let repo = init_repo("commit-ignored");
        std::fs::write(repo.join(".gitignore"), "specs/\n").unwrap();
        std::fs::write(repo.join("a.txt"), "a").unwrap();
        let spec = repo.join("specs/lunch");
        std::fs::create_dir_all(&spec).unwrap();
        std::fs::write(spec.join("overview.md"), OVERVIEW).unwrap();
        std::fs::write(spec.join("phase-2.md"), PHASE).unwrap();
        let prepared = Prepared {
            message: "Add it\n\nAI Assisted".to_string(),
            phase_file: spec.join("phase-2.md"),
        };
        stage_and_check(&repo, Some(&[])).unwrap();
        let marked = mark(&prepared, &repo, "specs/lunch", 2, "Approved.").unwrap();
        let head = commit(&repo, &prepared, &marked, Duration::from_secs(30)).unwrap();
        assert!(head.is_some());
        let shown = git_in(&repo, &["show", "--name-only", "--format=%s", "HEAD"]);
        assert!(shown.contains("a.txt"), "{shown}");
        assert!(!shown.contains("specs/"), "{shown}");
    }

    #[test]
    fn a_recorded_commit_hash_is_checked_against_the_history() {
        if !git_ready() {
            return;
        }
        let (base, _) = temp_spec("hashes");
        git_in(&base, &["init", "-q"]);
        for (key, value) in [
            ("user.name", "Loop Test"),
            ("user.email", "loop@example.com"),
            ("commit.gpgsign", "false"),
        ] {
            git_in(&base, &["config", key, value]);
        }
        std::fs::write(base.join("a.txt"), "a").unwrap();
        git_in(&base, &["add", "-A"]);
        git_in(&base, &["commit", "-q", "-m", "First"]);
        let real = git_in(&base, &["rev-parse", "--short", "HEAD"]);
        assert!(loop_tools::git_commit_exists(&base, &real));
        assert!(!loop_tools::git_commit_exists(&base, "deadbee"));
        assert!(!loop_tools::git_commit_exists(&base, ""));
        assert!(!loop_tools::git_commit_exists(&base, "--all"));
        assert!(!loop_tools::git_commit_exists(&base, "HEAD"));

        let entry = |phase: u32, commit: Option<&str>| crate::loop_report::ReportEntry {
            phase,
            commit: commit.map(str::to_string),
            ..crate::loop_report::ReportEntry::default()
        };
        let mut report = LoopReport::new("specs/lunch", "now");
        report.entries.push(entry(2, Some(real.as_str())));
        report.entries.push(entry(3, Some("deadbee")));
        // Built with commit off: no hash, so nothing to check.
        report.entries.push(entry(4, None));
        // Never recorded by the loop (built by hand): trusted.
        let done = [1, 2, 3, 4];
        assert_eq!(
            marks_without_commits(&base, "specs/lunch", &done, &report),
            vec![3]
        );
        // A phase the spec no longer shows done is not listed.
        assert!(marks_without_commits(&base, "specs/lunch", &[2], &report).is_empty());
    }

    #[test]
    fn only_the_phases_own_files_are_staged_and_the_baseline_is_left_alone() {
        if !git_ready() {
            return;
        }
        let repo = init_repo("stage-own");
        // A setting that hides untracked files from a plain `git status`.
        git_in(&repo, &["config", "status.showUntrackedFiles", "no"]);
        std::fs::create_dir_all(repo.join("app")).unwrap();
        std::fs::write(repo.join("tracked.txt"), "a").unwrap();
        std::fs::write(repo.join("app/keep.tsx"), "k").unwrap();
        git_in(&repo, &["add", "tracked.txt", "app/keep.tsx"]);
        git_in(&repo, &["commit", "-q", "-m", "First"]);
        // When the phase began, the person already had two files of their
        // own: one of them a name a glob reading of `app/[id].tsx` matches.
        std::fs::write(repo.join("mine.txt"), "the person's").unwrap();
        std::fs::write(repo.join("app/i.tsx"), "decoy").unwrap();
        let mut baseline = loop_tools::git_status_porcelain(&repo).unwrap();
        baseline.sort_unstable();
        assert_eq!(baseline, vec!["app/i.tsx", "mine.txt"]);
        // The agent then edits a tracked file and adds files, one with a
        // name that reads as a pattern (listed on its own line, since `app/`
        // is tracked).
        std::fs::write(repo.join("tracked.txt"), "b").unwrap();
        std::fs::write(repo.join("app/[id].tsx"), "x").unwrap();
        std::fs::write(repo.join("new.rs"), "y").unwrap();
        stage_and_check(&repo, Some(&baseline)).expect("the agent's files pass");
        let staged = git_in(&repo, &["diff", "--cached", "--name-only"]);
        let mut staged: Vec<&str> = staged.lines().collect();
        staged.sort_unstable();
        assert_eq!(staged, vec!["app/[id].tsx", "new.rs", "tracked.txt"]);
    }

    #[test]
    fn an_untracked_folder_from_before_the_phase_neither_hides_nor_swallows_files() {
        if !git_ready() {
            return;
        }
        let repo = init_repo("stage-untracked-dir");
        std::fs::write(repo.join("tracked.txt"), "a").unwrap();
        git_in(&repo, &["add", "tracked.txt"]);
        git_in(&repo, &["commit", "-q", "-m", "First"]);
        // The person's scratch folder was untracked when the phase began.
        std::fs::create_dir_all(repo.join("scratch")).unwrap();
        std::fs::write(repo.join("scratch/mine.txt"), "the person's").unwrap();
        let mut baseline = loop_tools::git_status_porcelain(&repo).unwrap();
        baseline.sort_unstable();
        assert_eq!(baseline, vec!["scratch/mine.txt"]);
        // The agent adds a file beside it, and a folder of its own.
        std::fs::write(repo.join("scratch/new.txt"), "the agent's").unwrap();
        std::fs::create_dir_all(repo.join("made")).unwrap();
        std::fs::write(repo.join("made/a.txt"), "the agent's").unwrap();
        stage_and_check(&repo, Some(&baseline)).expect("the agent's files pass");
        let staged = git_in(&repo, &["diff", "--cached", "--name-only"]);
        let mut staged: Vec<&str> = staged.lines().collect();
        staged.sort_unstable();
        assert_eq!(staged, vec!["made/a.txt", "scratch/new.txt"]);
    }

    #[test]
    fn staging_fails_closed_when_the_phases_files_cannot_be_listed() {
        if !git_ready() {
            return;
        }
        let repo = init_repo("stage-unknown");
        std::fs::write(repo.join("a.txt"), "a").unwrap();
        // No baseline from the phase's start: nothing is staged.
        let Err(StageError::Add(failure)) = stage_and_check(&repo, None) else {
            panic!("expected a refusal");
        };
        assert_eq!(failure.first_line, OWN_FILES_UNKNOWN);
        assert_eq!(git_in(&repo, &["diff", "--cached", "--name-only"]), "");
        // Outside any repository the list cannot be read either.
        let (plain, _) = temp_spec("stage-no-repo");
        let Err(StageError::Add(failure)) = stage_and_check(&plain, Some(&[])) else {
            panic!("expected a refusal");
        };
        assert_eq!(failure.first_line, OWN_FILES_UNKNOWN);
    }

    #[test]
    fn a_size_that_cannot_be_read_is_refused_and_a_deletion_is_zero() {
        use std::io::{Error, ErrorKind};
        assert_eq!(staged_size(Ok(12)), Some(12));
        assert_eq!(staged_size(Err(Error::from(ErrorKind::NotFound))), Some(0));
        assert_eq!(
            staged_size(Err(Error::from(ErrorKind::PermissionDenied))),
            None
        );
        assert_eq!(staged_size(Err(Error::other("odd"))), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_big_file_whose_name_is_not_utf8_hits_the_size_gate() {
        use std::os::unix::ffi::OsStrExt;
        if !git_ready() {
            return;
        }
        let repo = init_repo("stage-non-utf8");
        let name = std::ffi::OsStr::from_bytes(b"caf\xe9.bin");
        let big = match std::fs::File::create(repo.join(name)) {
            Ok(file) => file,
            // A file system that refuses such a name (some macOS volumes) has nothing to check.
            Err(_) => return,
        };
        big.set_len(MAX_STAGED_BYTES + 1).unwrap();
        let Err(StageError::Problem(problem)) = stage_and_check(&repo, Some(&[])) else {
            panic!("expected the size gate to stop it");
        };
        assert_eq!(problem.files, vec!["caf\u{fffd}.bin"]);
        assert_eq!(problem.why, "are over 5 MB");
        assert_eq!(git_in(&repo, &["diff", "--cached", "--name-only"]), "");
    }
}
