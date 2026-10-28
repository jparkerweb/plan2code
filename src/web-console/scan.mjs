// Plan2Code Web Console - what the dashboard knows about the repo: AGENTS.md, and each spec's state.

import fs from "node:fs";
import path from "node:path";

import { isDeletableSpecDir } from "./public/answers.js";
import { SPEC_STATES as STATE_TABLE } from "./public/spec-states.js";
import { nowIso, readText } from "./files.mjs";
import { insideGitRepo, pendingFiles } from "./sessions.mjs";
import { countTasks, statusOf } from "./spec-files.mjs";

// The task-line pattern lives in spec-files.mjs; re-exported for any importer
// that still takes it from here.
export { TASK_LINE_RE } from "./spec-files.mjs";

/* ---------------------------------------------------------- project scan */

// What the dashboard needs to know about the repo it was opened in: whether
// AGENTS.md exists, and where every spec under specs/ sits in the pipeline.
// These are filesystem facts, not agent judgment, so the console computes
// them itself on every `open` (and every resume back to the dashboard) and
// puts them on the session state. The page lights the right cards straight
// from it; the agent keeps only the opinion (note / recommend / details).

// Where a spec folder stands, named after the step its files are ready for.
// "unrecognized" is a folder with files but no pipeline shape: it launches
// Pathfinder or Plan (the files may be reference docs) but unlocks nothing
// else, exactly like picking no spec at all. "diagnosed" is a bug Diagnose
// wrote up and nobody has fixed or planned yet: it lights Quick Task and Plan.
// "fixed" is that bug once Quick Task marked it Fixed: finished, so the
// dashboard never picks or suggests it, and Quick Task offers to archive it.
// The states themselves, with their labels and flags, are public/spec-states.js.
export const SPEC_STATES = new Set(Object.keys(STATE_TABLE));

// The newest mtime under dir. `tally.files` counts the files the same walk
// sees (within its depth and budget), for the dashboard's delete dialog.
function maxMtime(dir, depth = 4, budget = { n: 400 }, tally = null) {
  let best = 0;
  if (depth < 0 || budget.n <= 0) return best;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return best;
  }
  for (const e of entries) {
    if (budget.n-- <= 0) break;
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    try {
      if (e.isDirectory()) best = Math.max(best, maxMtime(p, depth - 1, budget, tally));
      else {
        best = Math.max(best, fs.statSync(p).mtimeMs);
        if (tally) tally.files++;
      }
    } catch {}
  }
  return best;
}

// A waiting Revise plan brief: a `**Plan change:**` line in a phase file's
// Notes. Applied or dropped, it reads `**Plan change (applied <date>):**` or
// `(dropped <date>)`, which this never matches.
const PLAN_CHANGE_RE = /^\s*\*\*Plan change:\*\*/m;

// The Notes section of a phase file: from its `## Notes` heading to the next
// `## ` heading, or "" when it has none.
function notesOf(text) {
  const at = text.search(/^## Notes\b/m);
  if (at < 0) return "";
  const rest = text.slice(at).replace(/^## Notes[^\n]*\n?/, "");
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

// Whether a phased spec has a brief waiting for Revise plan: in the phase file
// overview.md marks `[/]`, or in each phase file when none is marked.
function planChangeWaiting(dir, phases) {
  const marked = [...readText(path.join(dir, "overview.md")).matchAll(/^\s*-\s*\[\/\]\s*Phase\s+(\d+)\b/gim)].map((m) => Number(m[1]));
  const files = marked.length ? phases.filter((f) => marked.includes(Number((f.match(/^phase-0*(\d+)\.md$/i) || [])[1]))) : phases;
  return files.some((f) => PLAN_CHANGE_RE.test(notesOf(readText(path.join(dir, f)))));
}

// A spec folder's pipeline position, from its files alone. Furthest artifact
// wins: an overview beats a draft beats a map, so a spec mid-way through two
// stages reports the later one.
function classifySpec(dir, names) {
  const has = (re) => names.some((n) => re.test(n));
  const pfDir = path.join(dir, "pathfinder");
  const overview = names.includes("overview.md");
  const phases = names.filter((n) => /^phase-.*\.md$/i.test(n));
  const drafts = names.filter((n) => /^PLAN-DRAFT.*\.md$/i.test(n));
  const planDraft = drafts.length > 0;
  const planConv = has(/^PLAN-CONVERSATION.*\.md$/i);
  const liveDraft = drafts.filter((n) => !/-prev\.md$/i.test(n)).sort().reverse()[0] || drafts[0];
  const draftStatus = liveDraft ? statusOf(readText(path.join(dir, liveDraft))) || "" : "";
  const resumeAt = draftStatus.match(/Resume at Phase\s*(\d+)/i);

  if (phases.length) {
    // countTasks() counts a file's task lines (every checkbox in a file
    // written before that format). An assumed-done task (`[?]`) counts as
    // done, and the detail names how many there are.
    let done = 0;
    let assumed = 0;
    let open = 0;
    for (const f of phases) {
      const n = countTasks(readText(path.join(dir, f)));
      done += n.done;
      assumed += n.assumed;
      open += n.open;
    }
    const finished = done + assumed;
    const total = finished + open;
    const suffix = assumed > 0 ? `, ${assumed} assumed` : "";
    // Documented, building and built specs all land here: each says whether a
    // Revise plan brief is waiting, and only when one is.
    const brief = planChangeWaiting(dir, phases) ? { planChange: true } : {};
    if (open === 0 && finished > 0) return { state: "built", detail: `all tasks done${suffix}`, ...brief };
    if (finished > 0) return { state: "building", detail: `${finished} of ${total} tasks done${suffix}`, ...brief };
    return {
      state: "documented",
      detail: `${phases.length} phase${phases.length === 1 ? "" : "s"}, ${total || "?"} tasks ready`,
      ...brief,
    };
  }
  // An overview with no phase files means Document was interrupted mid-write;
  // its next step is the same as a finished plan's.
  if (overview) return { state: "planned", detail: "plan drafted" };
  // A draft Pathfinder (or an interrupted Plan) left mid-way says so in its
  // Status line: Plan still has phases to run before Document can start.
  if (resumeAt) return { state: "mapped", detail: `plan draft, resume at Phase ${resumeAt[1]}` };
  if (planDraft) return { state: "planned", detail: "plan drafted" };
  // A bug Diagnose wrote up, with nothing after it yet. A pathfinder map or a
  // plan conversation means planning has started, so the usual states win.
  // Quick Task marks the write-up Fixed once the bug is gone: then the bug is
  // done, and the folder waits only to be archived.
  const diagnosis = names.filter((n) => /^DIAGNOSIS-.*\.md$/i.test(n)).sort().reverse()[0];
  const diagnosisStatus = diagnosis ? (statusOf(readText(path.join(dir, diagnosis))) || "").replace(/\*+/g, "").trim() : "";
  if (diagnosis && !planConv && !fs.existsSync(path.join(pfDir, "map.md")))
    return /^fixed/i.test(diagnosisStatus)
      ? { state: "fixed", detail: "bug fixed" }
      : { state: "diagnosed", detail: "bug diagnosed, not fixed" };
  if (isDir(pfDir)) {
    const mapText = readText(path.join(pfDir, "map.md"));
    const status = (statusOf(mapText) || "").replace(/\*+/g, "").trim();
    if (/^cleared/i.test(status)) return { state: "mapped", detail: "all decisions made" };
    let qTotal = 0;
    let qDone = 0;
    const qDir = path.join(pfDir, "questions");
    try {
      for (const q of fs.readdirSync(qDir)) {
        if (!q.endsWith(".md")) continue;
        qTotal++;
        if (/^State:\s*resolved/m.test(readText(path.join(qDir, q)))) qDone++;
      }
    } catch {}
    return {
      state: "exploring",
      detail: qTotal ? `${qDone} of ${qTotal} decisions made` : "getting started",
    };
  }
  // A conversation log with no draft is a plan session interrupted before it
  // wrote anything: Plan resumes it, same as a cleared map.
  if (planConv) return { state: "mapped", detail: "planning in progress" };
  return { state: "unrecognized", detail: "no pipeline files yet" };
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Scan <root>/specs into picker entries, most recently touched first.
 * `touched` is the newest file mtime inside the folder — last write wins,
 * which is the honest reading of "the one you were working on".
 * `isGit` says whether `root` sits inside a git repository (no git process);
 * `pending` is how many paths a commit would take, or null when unknown.
 */
export function scanProject(root) {
  const specsDir = path.join(root, "specs");
  const specs = [];
  let names = [];
  try {
    names = fs.readdirSync(specsDir);
  } catch {}
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const dir = path.join(specsDir, name);
    if (!isDir(dir)) continue;
    // A spec deleted mid-scan (or unreadable) must not kill `open`: the
    // picker just never shows it.
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    const tally = { files: 0 };
    specs.push({
      dir: `specs/${name}`,
      name,
      ...classifySpec(dir, files),
      touched: maxMtime(dir, 4, { n: 400 }, tally),
      files: tally.files,
    });
  }
  specs.sort((a, b) => b.touched - a.touched || a.name.localeCompare(b.name));
  const isGit = insideGitRepo(root);
  return {
    at: nowIso(),
    hasAgents: fs.existsSync(path.join(root, "AGENTS.md")),
    isGit,
    pending: isGit ? pendingFiles(root) : null,
    specs,
  };
}

/**
 * Delete one spec folder, for the dashboard's Delete button (`delete-spec`).
 * Only an existing `specs/<name>` folder, as isDeletableSpecDir() spells it,
 * whose real path sits directly in the worktree's own specs/: never a link to
 * somewhere else, never specs--completed/, never anything deeper. specs/ is
 * gitignored, so a mistake here cannot be undone; every refusal throws with
 * the reason, and nothing is touched.
 */
export function removeSpec(worktree, dir) {
  if (!isDeletableSpecDir(dir)) throw new Error(`"${dir}" is not a spec folder: only specs/<name> can be deleted`);
  const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
  const root = path.resolve(worktree);
  const target = path.join(root, dir);
  let st;
  try {
    st = fs.lstatSync(target);
  } catch {
    throw new Error(`there is no ${dir} to delete`);
  }
  if (st.isSymbolicLink()) throw new Error(`${dir} is a link to another folder, so it is not deleted from here`);
  if (!st.isDirectory()) throw new Error(`${dir} is not a folder`);
  const real = fs.realpathSync.native(target);
  const realSpecs = fs.realpathSync.native(path.join(root, "specs"));
  const realRoot = fs.realpathSync.native(root);
  const rel = path.relative(fold(realRoot), fold(realSpecs));
  if (rel !== "specs" || fold(path.dirname(real)) !== fold(realSpecs)) {
    throw new Error(`${dir} resolves outside the project's specs/ folder, so it is not deleted`);
  }
  fs.rmSync(real, { recursive: true });
  return { ok: true, removed: dir };
}
