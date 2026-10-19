// Plan2Code Web Console - the small commands: keep, forget, delete-spec, handoff, delete-handoff, status and stop.

import fs from "node:fs";
import path from "node:path";

import { SESSIONS_DIR, appendEvent, readJson } from "./files.mjs";
import { attachmentName, healthOk, listHandles, pidAlive, projectRoot, repoRoots, sessionDir } from "./sessions.mjs";
import { removeSpec } from "./scan.mjs";
import { isOpen } from "./patches.mjs";
import { pendingChatCount } from "./inbox.mjs";
import { forgetWorkspace, specKey } from "./workspace.mjs";
import { newHandoff, removeHandoff } from "./handoffs.mjs";
import { WORKFLOWS, isWorkflow } from "./public/skills.js";

// The CLI's own pieces, handed over by console.mjs through useCli() before
// any command runs: console.mjs runs on import, so it cannot be imported back.
let args, print, die, mustSession, sessionProject;
export function useCli(cli) {
  ({ args, print, die, mustSession, sessionProject } = cli);
}

// Mirrors the server's absolute lifetime cap: a handle older than this cannot
// still be one of our servers, so its pid gets no second look.
const MAX_SERVER_LIFE_MS = 4 * 60 * 60 * 1000;

/* ----------------------------------------------------------------- keep */

// Copy one of the session's note attachments into specs/<idea>/attachments/, so
// a spec file can cite it after the session is swept. Run by the agent, never
// the server: the server still never writes into a project.
export function cmdKeep() {
  const usage = "keep needs --session <sid> --upload <path> --name <name> --spec specs/<idea>";
  if ([args.upload, args.name, args.spec].some((v) => typeof v !== "string")) die(usage, 2);
  const dir = mustSession();
  const state = readJson(path.join(dir, "state.json"));
  if (!state) die("that session has no state", 1);
  const project = state.project;

  const upload = path.resolve(args.upload);
  // Compared as real paths: Windows hands the same folder out both long
  // (C:\Users\Justin.Parker) and 8.3 (C:\Users\JUSTIN~1.PAR), and the reply's
  // path need not be spelled the way this session's directory is.
  // A path that does not exist (yet) resolves through its nearest real parent,
  // so a missing upload still reads as missing, not as somewhere else.
  const real = (p) => {
    try {
      return fs.realpathSync.native(p);
    } catch {
      const parent = path.dirname(path.resolve(p));
      return parent === path.resolve(p) ? path.resolve(p) : path.join(real(parent), path.basename(p));
    }
  };
  if (!inside(real(path.join(dir, "uploads")), real(upload))) die("upload is not in this session's uploads folder", 3);
  const spec = path.resolve(project, args.spec);
  const attachments = path.join(spec, "attachments");
  if (!inside(project, spec) || !inside(fs.realpathSync(project), realNearest(attachments))) {
    die("spec folder is outside the project", 3);
  }
  if (!fs.existsSync(upload) || !fs.statSync(upload).isFile()) die("no such upload", 3);

  // The file the link is written for has to be in the project too, or the
  // relative link would point out of it.
  if (typeof args.from === "string" && !inside(project, path.resolve(project, args.from))) {
    die("--from is outside the project", 3);
  }

  // One upload, one copy: kept again under another name, the copy it already
  // has (named for the same upload id) is the one reused.
  // Named from the real path: an 8.3 spelling (7CF881~1.JPG) would name the
  // copy after the short form and miss the copy this upload already has.
  const named = attachmentName({ upload: real(upload), name: args.name });
  const suffix = named.slice(named.lastIndexOf("-"));
  let existing = null;
  try {
    existing = fs.readdirSync(attachments).find((f) => f.endsWith(suffix));
  } catch {}
  const file = existing || named;
  const target = path.join(attachments, file);
  fs.mkdirSync(attachments, { recursive: true });
  let reused = false;
  try {
    fs.copyFileSync(upload, target, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
    reused = true;
  }

  const slashes = (p) => p.split(path.sep).join("/");
  const linkBase = typeof args.from === "string" ? path.dirname(path.resolve(project, args.from)) : spec;
  const kept = slashes(path.relative(project, target));
  print({
    ok: true,
    path: kept,
    link: slashes(path.relative(linkBase, target)),
    image: path.extname(target) === ".jpg",
    reused,
  });
  appendEvent(dir, { type: "keep", id: path.basename(upload, path.extname(upload)), path: kept });
}

// Whether child sits strictly under parent. path.relative handles drive
// letters and POSIX alike; Windows paths fold case, as the server's do.
function inside(parent, child) {
  const fold = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
  const rel = path.relative(fold(path.resolve(parent)), fold(path.resolve(child)));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

// p with its nearest existing ancestor's symlinks and junctions resolved, so a
// linked specs/, spec or attachments/ folder cannot carry a copy out of the project.
function realNearest(p) {
  let existing = p;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  return path.join(fs.realpathSync(existing), path.relative(existing, p));
}

/* --------------------------------------------------------------- forget */

// Drop the folder list remembered for one spec (Finalize, once the spec is
// archived). The project's own list and every other spec's are untouched.
export function cmdForget() {
  if (typeof args.spec !== "string" || !args.spec.trim()) die("forget needs --spec specs/<idea>", 2);
  let spec = specKey(args.spec);
  if (/\.md$/i.test(spec)) spec = spec.slice(0, spec.lastIndexOf("/"));
  const worktree = repoRoots().worktree;
  print({ ok: true, spec, forgot: forgetWorkspace(worktree, spec) });
}

/* ---------------------------------------------------------- delete-spec */

// The dashboard's Delete button, carried out by the agent: the page never
// writes into a project. removeSpec() does every check; a refusal is exit 3
// with the reason, and the remembered workspace for the spec goes with it.
export function cmdDeleteSpec() {
  if (typeof args.spec !== "string" || !args.spec.trim()) die("delete-spec needs --spec specs/<name>", 2);
  const worktree = repoRoots().worktree;
  try {
    const done = removeSpec(worktree, args.spec);
    forgetWorkspace(worktree, args.spec);
    print(done);
  } catch (err) {
    print({ ok: false, message: err.message });
    process.exit(3);
  }
}

/* --------------------------------------------------------------- handoff */

// A handoff the agent is about to write, claimed in ~/.plan2code/handoffs/
// (handoffs.mjs) for this checkout: the Stop flow's "Stop with a handoff" and
// the Handoff skill both start here. Only the .json is written; the agent
// writes the document at the printed path.
export function cmdHandoff() {
  const usage = "handoff needs: handoff new --workflow <w> --skill <s> [--spec specs/<x>] [--title <t>] [--from-stop]";
  if (args._[0] !== "new" || args._.length > 1) die(usage, 2);
  if (typeof args.workflow !== "string" || typeof args.skill !== "string") die(usage, 2);
  // newHandoff() takes any lowercase name; a handoff is only useful to a
  // workflow the console can launch, so the name must be one it knows (FR-5).
  if (!isWorkflow(args.workflow)) die(`unknown workflow "${args.workflow}"; one of: ${WORKFLOWS.join(", ")}`, 2);
  if ("from-stop" in args && args["from-stop"] !== true) die("--from-stop takes no value", 2);
  const { worktree, project } = repoRoots();
  try {
    const { id, path: file, meta } = newHandoff({
      worktree,
      project,
      spec: args.spec,
      workflow: args.workflow,
      skill: args.skill,
      title: args.title,
      fromStop: args["from-stop"] === true,
    });
    print({ ok: true, id, path: file, meta });
  } catch (err) {
    print({ ok: false, message: err.message });
    process.exit(3);
  }
}

// The dashboard's Delete on a Handoff chip, carried out by the agent, the
// same shape as delete-spec: removeHandoff() does every check.
export function cmdDeleteHandoff() {
  if (typeof args.handoff !== "string" || !args.handoff.trim()) die("delete-handoff needs --handoff <id>", 2);
  try {
    print(removeHandoff(args.handoff));
  } catch (err) {
    print({ ok: false, message: err.message });
    process.exit(3);
  }
}

/* --------------------------------------------------------------- status */

export async function cmdStatus() {
  const project = projectRoot();
  if (args.session || args.sid) {
    const dir = mustSession();
    const state = readJson(path.join(dir, "state.json")) || {};
    const handle = listHandles(sessionProject(dir)).find((h) => h.sid === path.basename(dir));
    const result = readJson(path.join(dir, "result.json"));
    return print({
      sid: state.sid,
      session: dir,
      workflow: state.workflow,
      title: state.title,
      phase: state.phase,
      items: (state.items || []).length,
      open: (state.items || []).filter(isOpen).length,
      url: handle ? handle.url : "",
      live: handle ? pidAlive(handle.pid) : false,
      pendingResult: Boolean(result && !result.consumedAt),
      pendingChat: pendingChatCount(dir, state),
    });
  }

  let sids = [];
  try {
    sids = fs.readdirSync(SESSIONS_DIR).sort().reverse();
  } catch {
    return print({ sessions: [] });
  }
  const handles = listHandles(project);
  const rows = [];
  for (const sid of sids.slice(0, Number(args.limit || 20))) {
    const dir = sessionDir(sid);
    const state = readJson(path.join(dir, "state.json"));
    if (!state) continue;
    if (!args.all && state.project !== project) continue;
    const handle = handles.find((h) => h.sid === sid);
    const result = readJson(path.join(dir, "result.json"));
    rows.push({
      sid,
      workflow: state.workflow,
      title: state.title,
      phase: state.phase,
      created: state.created,
      live: handle ? pidAlive(handle.pid) : false,
      url: handle ? handle.url : "",
      pendingResult: Boolean(result && !result.consumedAt),
      pendingChat: pendingChatCount(dir, state),
    });
  }
  print({ sessions: rows });
}

/* ----------------------------------------------------------------- stop */

export async function cmdStop() {
  // --all is this folder's sessions; one named session is found wherever
  // the command runs from.
  const named = !args.all && (args.session || args.sid) ? sessionDir(path.basename(args.session || args.sid)) : null;
  const project = named && fs.existsSync(named) ? sessionProject(named) : projectRoot();
  const handles = listHandles(project);
  const targets = args.all
    ? handles
    : handles.filter((h) => h.sid === path.basename(args.session || args.sid || ""));
  if (!targets.length) return print({ ok: true, stopped: 0 });

  let stopped = 0;
  let skipped = 0;
  for (const h of targets) {
    // Identify the process before killing it. A handle file can outlive a
    // reboot in the system temp directory, and PIDs get reused; without this
    // check `stop --all` can kill an unrelated program that happens to have
    // inherited the number. /health returning our own sid is the only proof:
    // a live pid and a young handle are not, since a server that died a
    // minute ago leaves exactly that behind for any process to inherit. A
    // busy server gets a second, longer look, and still has to answer as
    // ours; one that does not is left alone, and only its handle goes.
    const young = Date.now() - Date.parse(h.startedAt || 0) < MAX_SERVER_LIFE_MS;
    const ours = (await healthOk(h)) || (young && pidAlive(h.pid) && (await healthOk(h, 5000)));
    if (!ours) {
      skipped++;
      try {
        fs.rmSync(h.handlePath, { force: true });
      } catch {}
      continue;
    }
    try {
      process.kill(h.pid);
      stopped++;
    } catch {}
    try {
      fs.rmSync(h.handlePath, { force: true });
    } catch {}
  }
  print({ ok: true, stopped, ...(skipped ? { skippedStaleHandles: skipped } : {}) });
}
