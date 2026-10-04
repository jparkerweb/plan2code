#!/usr/bin/env node
// Plan2Code Web Console - the CLI the agent drives.
//
//   open    create or resume a session, publish a payload, start the server, print the URL
//   post    publish a new payload (an update) to a running session
//   wait    block for a bounded slice, then report. Exit code says what happened.
//   chat    collect Quick question messages right now, never waiting
//   keep    copy a cited note attachment into specs/<idea>/attachments/
//   status  list sessions, or show one
//   stop    shut a session's server down
//
// The design point: the SERVER is long-lived and detached; the WAITER is a short
// foreground command the agent re-invokes. A twenty-minute human session then
// never has to live inside a single tool call, and nothing the harness does to
// background tasks can destroy the human's work.
//
// Exit codes from `wait`:
//   0   done. stdout is the result JSON.
//   10  still waiting. stdout is a one-line progress summary. Call wait again.
//   20  the server is gone. Run `open --resume <sid>` and re-share the URL.
//   30  the person pressed Cancel.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  CHAT_FILE,
  HERE,
  HOME_DIR,
  SESSIONS_DIR,
  appendEvent,
  appendLedger,
  applyPatch,
  attachmentName,
  bindLoopback,
  blankState,
  chatReplyLines,
  collectChat,
  deliverableChat,
  die,
  ensureDir,
  fileStamp,
  forgetWorkspace,
  handOff,
  handleFile,
  healthOk,
  initialWorkspace,
  isOpen,
  lastLaunchId,
  listHandles,
  newSessionId,
  newToken,
  nextLaunchId,
  nowIso,
  parseArgs,
  pendingChatCount,
  unansweredChat,
  pendingWorkspaceChanges,
  pidAlive,
  print,
  projectRoot,
  proseProblems,
  readChat,
  readJson,
  readLedger,
  readWorkspace,
  reapHandles,
  rememberedWorkspace,
  remoteWarning,
  removeScratch,
  removeSessions,
  repoRoots,
  scanProject,
  SESSION_MAX_AGE_MS,
  sessionDir,
  sleepSync,
  specKey,
  staleScratch,
  staleSessions,
  sweepUploads,
  switchWorkflow,
  terminalLine,
  updateState,
  UPLOAD_MAX_AGE_MS,
  validate,
  validateChat,
  workspaceForAgent,
  writeCursor,
  writeJsonAtomic,
  writeWorkspaceCursor,
} from "./lib.mjs";
import { RUN_EVENTS, TASK_EVENTS, MAX_TASKS, isTaskCount } from "./public/meter.js";
import { changeLine } from "./public/workspace.js";

// Mirrors the server's absolute lifetime cap: a handle older than this cannot
// still be one of our servers, so its pid gets no second look.
const MAX_SERVER_LIFE_MS = 4 * 60 * 60 * 1000;

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = parseArgs(argv.slice(1));

// PLAN2CODE_CONSOLE_TRACE=1 prints where the time goes, to stderr: the
// start path is what stands between someone and their first look at the page,
// and it is only worth optimising with numbers in hand.
const TRACE = Boolean(process.env.PLAN2CODE_CONSOLE_TRACE);
function trace(what) {
  if (TRACE) process.stderr.write(`trace ${Math.round(performance.now())}ms ${what}\n`);
}

/* ----------------------------------------------------------------- open */

// Cache this console's directory where a later agent session can find it.
// HOME_DIR is fixed (~/.plan2code/console, or $PLAN2CODE_CONSOLE_HOME), so
// console-dir there is a stable place to look: the next skill that offers the
// console points its agent at the file rather than making it search the skill
// install dirs again. Written by `open` alone, which starts every session: a
// `wait` or a `post` every few seconds need not rewrite it each time.
function leavePointer() {
  try {
    ensureDir(HOME_DIR);
    fs.writeFileSync(path.join(HOME_DIR, "console-dir"), HERE + "\n");
  } catch {
    /* a pointer we cannot leave costs nothing */
  }
}

async function cmdOpen() {
  trace("open: start");
  leavePointer();
  const { project, worktree, branch } = repoRoots();
  reapHandles(project);
  trace("open: project found");

  let sid = args.resume || args.session;
  let dir;
  let state;
  // A new skill run for the meter: a fresh open, or a resume into another workflow.
  let launched = true;
  // Everything `open` does to a stored state, as a step it can take twice:
  // once now, on the read below, so a bad payload is refused before anything
  // starts, and again on a fresh read under the state lock when it writes, so
  // a send the person made in between is kept rather than written over.
  let reshape = (s) => s;

  if (sid) {
    sid = path.basename(sid);
    dir = sessionDir(sid);
    if (!fs.existsSync(dir)) die(`no session "${sid}" to resume`, 1);
    state = readJson(path.join(dir, "state.json"));
    if (!state) die(`session "${sid}" has no state`, 1);
    // A resume can also be a hand-off: the dashboard launches another skill
    // into its own session, and the first thing that skill needs is for the
    // page to stop being a dashboard. Letting the flags restate these fields
    // on resume means one command both reuses the server and turns the page,
    // rather than a resume plus a whole extra post.
    const switching = args.workflow && args.workflow !== state.workflow;
    launched = Boolean(switching);
    // Going through the dashboard is a fresh start: a skill launched from
    // the menu gets a clean page, not the last skill's questions and tabs
    // under its own name. The staged draft goes too, since its item ids
    // belonged to the old questions. A skill run inline from another (a
    // quick task's review) never passes the dashboard, so it keeps the page.
    const hop = switching && (args.workflow === "dashboard" || state.workflow === "dashboard");
    if (hop) fs.rmSync(path.join(dir, "draft.json"), { force: true });
    reshape = (s) => {
      // Resuming takes a pause back down. A paused finish is a bookmark --
      // "saved here, pick it up later" -- and picking it up is exactly what
      // this is. Left in place, the page keeps saying PAUSED over every
      // question the resumed session asks, because `finish` is a scalar and
      // only an explicit `finish: null` patch clears it. A real ending is
      // different: re-sharing a finished session's link should still show its
      // card, so only a headline that says "paused" comes down. Done before
      // --file applies, so a patch can still post a finish of its own.
      if (s.finish && /^\s*paused\b/i.test(String(s.finish.headline || ""))) {
        delete s.finish;
        // The questions still open at the pause were the old session's asks,
        // already narrated in the finish body so the next session can name
        // them. Whatever the resumed session still needs it asks again, in its
        // own words -- kept, the leftovers sit beside the new asks as
        // duplicates nobody owns. Settled items stay: they are the record.
        s.items = (s.items || []).filter((i) => !isOpen(i));
        // And the topics that only the dropped items lived under, so a new
        // item reusing an old topic id does not inherit a stale title.
        const liveTopics = new Set(s.items.map((i) => i.topic));
        s.topics = (s.topics || []).filter((t) => liveTopics.has(t.id));
      }
      if (hop) {
        s = switchWorkflow(s, {
          workflow: args.workflow,
          title: typeof args.title === "string" ? args.title : path.basename(worktree),
          specDir: args.spec,
        });
      } else if (switching) s.workflow = args.workflow;
      if (args.title) s.title = args.title;
      if (args.spec) s.specDir = args.spec;
      // Every resume clears the wake-up flag: a server restart, a launch from
      // the dashboard, a Back-to-dashboard return. Cleared here rather than by
      // the page because the page cannot write state, and a replay on a return
      // is exactly what the decision rules out.
      delete s.wake;
      return s;
    };
  } else {
    sid = newSessionId();
    // Named, not made: the folder is created once --file has passed, so a
    // rejected first payload leaves no empty session behind for nothing to sweep.
    dir = sessionDir(sid);
    state = blankState({
      sid,
      project,
      workflow: args.workflow,
      // Until the agent knows what the session is about, the folder it runs
      // in is the honest name, and it lets `open` go before any thinking.
      title: typeof args.title === "string" ? args.title : path.basename(worktree),
      specDir: args.spec,
    });
    // Only a freshly opened dashboard plays Planny's wake-up.
    if (args.workflow === "dashboard") state.wake = true;
  }

  // A first payload's meter and folder reports, as `post` takes them: checked
  // now, before anything is written, and appended once the launch is.
  let openRun;
  let openIssue;
  let patch = null;
  if (args.file) {
    patch = readJson(path.resolve(args.file));
    if (!patch) die(`could not read --file ${args.file} as JSON`, 2);
    ({ run: openRun, folderIssue: openIssue } = patch);
    delete patch.run;
    delete patch.folderIssue;
  }
  const base = reshape;
  const settle = (s) => {
    s = base(s);
    // On every open, so a resume from another worktree refreshes both.
    s.worktree = worktree;
    s.branch = branch;
    return s;
  };
  reshape = (s) => (patch ? applyPatch(settle(s), patch) : settle(s));
  state = settle(state);
  if (patch) {
    ledgerFromPost(dir, openRun, openIssue, state.workflow);
    try {
      state = applyPatch(state, patch);
    } catch (e) {
      die(e.message, 3);
    }
    const problems = validate(state);
    if (problems.length) return failValidation(problems);
  }
  ensureDir(dir);

  // A fresh session needs a fresh server, and a server is a whole Node boot:
  // the slowest thing `open` does, bar the browser. Start both now, before
  // the scan and the state write, so their start-up runs alongside them
  // instead of after. The server does look at the state as it boots, and on
  // a fresh session finds none yet: it takes the worktree from its command
  // line, not from the state, and picks the state up on its first request or
  // poll tick. No page can reach it before it is listening, and the state is
  // on disk long before a browser gets there.
  const existing = sid && (args.resume || args.session) ? listHandles(project).find((h) => h.sid === sid) : null;
  const reusable = existing && pidAlive(existing.pid) ? healthOk(existing) : Promise.resolve(false);
  let boot = null;
  if (!existing) boot = await startServer(project, worktree, sid, dir);

  // The dashboard's spec picker reads its inventory straight off the session
  // state, so the scan belongs to `open` rather than to the agent: filesystem
  // facts, recomputed every time the session becomes (or stays) a dashboard,
  // never something a model has to remember to fetch. Rooted at the worktree's
  // own top level: `project` is the common-dir key so linked worktrees share
  // sessions, but each shows the specs on its own disk.
  const scan = state.workflow === "dashboard" ? scanProject(worktree) : null;

  // Under the state lock, which a send on the page takes too: the result and
  // the state are read fresh here and the state is rebuilt from that read, so
  // nothing the person sent since the read above is lost or stamped over.
  let carried = false;
  let written;
  try {
    written = updateState(dir, (fresh) => {
      const next = fresh ? reshape(fresh) : state;
      if (scan) next.scan = scan;

      // Clear a result the agent already collected, and ONLY that one.
      //
      // An unconsumed result is answers a person pressed Send on that nobody has
      // picked up yet. Deleting it here is exactly the documented crash-recovery
      // case ("your session died, press Send anyway, the next session picks it
      // up") and deleting it destroys their work silently.
      const resultPath = path.join(dir, "result.json");
      const waiting = readJson(resultPath);
      if (waiting && waiting.consumedAt) fs.rmSync(resultPath, { force: true });
      carried = Boolean(waiting && !waiting.consumedAt);

      // Do not stamp over "submitted" either: the phase is how the page knows a
      // send is still in flight.
      if (!carried) next.phase = "collecting";
      return next;
    });
  } catch (e) {
    written = { error: e.message };
  }
  if (!written || written.error) {
    // A server just started for this state would only serve a page that never starts.
    if (boot) boot.kill();
    die(`could not write the session state: ${written ? written.error : "unknown"}`, 1);
  }
  state = written.state;
  appendEvent(dir, { type: "open", resumed: Boolean(args.resume || args.session), carried });
  trace("open: state written");

  // Dashboard launches are recorded too (they score nothing), so the folder
  // issues the page shows reset with every skill run. Never fatal: the meter
  // is advice, and the page must not wait on it.
  try {
    if (launched) appendLedger(dir, { kind: "launch", id: nextLaunchId(readLedger(dir)), workflow: state.workflow });
    for (const line of ledgerFromPost(dir, openRun, openIssue, state.workflow)) appendLedger(dir, line);
  } catch {}
  const workspace = workspaceOnOpen(dir, worktree, state.specDir);

  // Month-old sessions and scratch files: listed before the print so the
  // agent can see what went, removed after it so the page waits for nothing.
  // Nothing about this reaches the page.
  const sweptSessions = staleSessions(SESSIONS_DIR, Date.now(), SESSION_MAX_AGE_MS, sid);
  const sweptScratch = staleScratch(HOME_DIR, Date.now(), SESSION_MAX_AGE_MS);
  const swept =
    sweptSessions.length || sweptScratch.length
      ? { swept: { sessions: sweptSessions, scratch: sweptScratch } }
      : {};
  const sweep = () => {
    sweepUploads(SESSIONS_DIR, Date.now(), UPLOAD_MAX_AGE_MS, sid).catch(() => {});
    removeSessions(SESSIONS_DIR, sweptSessions).catch(() => {});
    removeScratch(HOME_DIR, sweptScratch).catch(() => {});
  };

  // Reuse a live server if one is already serving this session.
  if (existing && (await reusable)) {
    if (!args["no-open"]) openBrowser(existing.url);
    print({
      ok: true,
      sid,
      session: dir,
      url: existing.url,
      reused: true,
      pendingResult: carried,
      terminalLine: terminalLine(existing.url),
      workspace,
      ...swept,
      ...remoteWarning(),
    });
    sweep();
    return;
  }

  // A handle whose pid is alive but is not ours (the pid was reused) leaves
  // this for last: nothing could be started until that was known.
  let started = boot || (await startServer(project, worktree, sid, dir));
  let handle = await awaitHandle(started);
  if (!handle && started.handoff) {
    // The handover went wrong somewhere (a platform that will not pass the
    // socket, a server that died taking it). Once more the old way, where
    // the server binds its own port: slower, and certain.
    started.kill();
    started = await startServer(project, worktree, sid, dir, { handoff: false });
    handle = await awaitHandle(started);
  }
  if (!handle) {
    const log = tail(path.join(dir, "server.log"), 12);
    die(`the console server did not start within 8s.\n${log}`, 1);
  }
  trace("open: server listening");
  // Unref'd, or the cap itself would hold the process open for its full span.
  await Promise.race([started.released, new Promise((r) => setTimeout(r, 2000).unref())]);
  trace("open: socket handed over");

  // The early tab went to the port `open` bound. If the server ended up
  // anywhere else, that tab is a dead end, so send the browser to the real one.
  if (!args["no-open"] && handle.url !== started.opened) openBrowser(handle.url);
  const remote = remoteWarning();
  const notes = [];
  if (remote.note) notes.push(remote.note);
  if (carried) notes.push("Answers are already waiting. Run `wait` to collect them.");
  print({
    ok: true,
    sid,
    session: dir,
    url: handle.url,
    port: handle.port,
    pid: handle.pid,
    pendingResult: carried,
    terminalLine: terminalLine(handle.url),
    workspace,
    ...swept,
    ...(remote.remote ? { remote: remote.remote } : {}),
    ...(notes.length ? { note: notes.join(" ") } : {}),
  });
  // After the print, never before it: the page and the link wait for nothing.
  sweep();
}

/**
 * The workspace as `open` hands it to the agent, and the cursor seeded to
 * match: the agent now has the whole list, so no change up to here is owed.
 * Read-only on workspace.json, which only the server writes; on a fresh
 * session the server has not made it yet, so what was remembered for this
 * folder and spec stands in, the same list the server is about to make.
 */
function workspaceOnOpen(dir, worktree, specDir) {
  const ws = readWorkspace(dir) || initialWorkspace(worktree, rememberedWorkspace(worktree, specDir).entry);
  const missing = ws.folders.filter((f) => !isFolder(f.path)).map((f) => f.id);
  try {
    writeWorkspaceCursor(dir, ws.version || 0);
  } catch {}
  return workspaceForAgent({ ...ws, missing });
}

function isFolder(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Start a detached server for the session, and the browser with it.
 *
 * The browser is the slowest thing in the whole start: from `start <url>` to
 * its first request is most of a second on Windows, far longer than the
 * server takes to boot. So the port is bound HERE, the link exists while the
 * server is still booting, and the browser is sent at once. The bound socket
 * is then handed to the server over an IPC channel; a request that arrives
 * before the handover waits in the socket's queue, and one this process
 * happened to accept is passed across as a socket of its own. Nothing the
 * browser sends is refused or lost on the way.
 *
 * The order is timed. The server is spawned first, because its boot is the
 * longest step the agent waits on. The bind comes next and overlaps that
 * boot: a process's first listen() blocks for ~50ms on Windows while the
 * socket stack loads, which is time the server spends booting anyway.
 */
async function startServer(project, worktree, sid, dir, { handoff = true } = {}) {
  const token = newToken();
  const handlePath = handleFile(project, sid);
  ensureDir(path.dirname(handlePath));
  fs.rmSync(handlePath, { force: true });

  const logFd = fs.openSync(path.join(dir, "server.log"), "a");
  const child = spawn(
    process.execPath,
    [
      path.join(HERE, "server.mjs"),
      // Always `--flag=value`, never two words: a base64url token can start
      // with "--", and parseArgs would read it as the next flag and leave the
      // server with `token: true`. The paths get the same form for the same reason.
      `--session=${dir}`,
      `--token=${token}`,
      `--project=${project}`,
      // The checkout the session runs in, which the state does not hold yet
      // on a fresh open. See WORKTREE in server.mjs.
      `--worktree=${worktree}`,
      ...(handoff ? ["--handoff"] : []),
      ...(args["idle-ms"] ? [`--idle-ms=${args["idle-ms"]}`] : []),
    ],
    {
      // Detached, because harness-managed background tasks get killed at
      // assorted timeouts and on compaction, which would take the human's
      // half-finished answers with them. Detached processes are immune.
      detached: true,
      // Redirecting stdio to a file is what lets the child outlive us. The
      // IPC channel is only for the handover, and is closed straight after.
      stdio: ["ignore", logFd, logFd, ...(handoff ? ["ipc"] : [])],
      // windowsHide defaults to FALSE, and `detached` on Windows gives the
      // child its own console window which "once enabled, cannot be disabled".
      // Omit this and every handoff flashes a black box at the user.
      windowsHide: true,
    }
  );
  fs.closeSync(logFd);
  let exited = false;
  child.on("exit", () => (exited = true));
  child.on("error", () => (exited = true));
  trace("open: server spawned");

  let opened = null;
  let released = Promise.resolve();
  if (handoff) {
    const pre = await bindLoopback();
    trace("open: port bound");
    // No socket to give (the bind failed): the server binds its own, and the
    // channel is let go once it has.
    released = handOff(child, pre);
    if (pre && !args["no-open"]) opened = `http://127.0.0.1:${pre.address().port}/s/${token}/`;
  } else child.unref();
  // Each spawn blocks for a moment (tens of ms for cmd.exe on Windows), so
  // the browser's comes after the server's: the server's boot is what the
  // agent waits on, and the browser's lead is most of a second regardless.
  if (opened) {
    openBrowser(opened);
    trace("open: browser sent");
  }
  return {
    handlePath,
    handoff,
    opened,
    released,
    dead: () => exited,
    kill: () => {
      try {
        child.kill();
      } catch {}
    },
  };
}

// Learn the port by waiting for the handle file, not by parsing stdout:
// stdout went to the log file, and the file handshake is race-free and is
// the same code path the reap sweep uses. Checked every 10ms: the file is
// tiny, and a coarse tick here is dead time added to every first paint.
// Null when the server died first, or never showed up.
async function awaitHandle(started) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const handle = readJson(started.handlePath);
    if (handle && handle.url) return handle;
    if (started.dead()) return null;
    await new Promise((r) => setTimeout(r, 10));
  }
  return null;
}

function failValidation(problems) {
  process.stderr.write("console: the payload was rejected, nothing was written.\n");
  for (const p of problems) process.stderr.write("  - " + p + "\n");
  // exitCode, not exit(): the agent has to read these lines to fix the patch,
  // and process.exit() can truncate a pipe Node has not flushed.
  process.exitCode = 3;
}

/* ----------------------------------------------------------------- post */

function cmdPost() {
  const dir = mustSession();
  const file = args.file;
  if (!file) die("post needs --file <path to a JSON patch>", 2);
  const patch = readJson(path.resolve(file));
  if (!patch) die(`could not read --file ${file} as JSON`, 2);

  const statePath = path.join(dir, "state.json");
  const before = readJson(statePath);
  if (!before) die("that session has no state", 1);

  // Meter and folder reports go to the ledger, never into state.json. Checked
  // here, before anything is written: a rejected post appends nothing.
  const { run, folderIssue } = patch;
  delete patch.run;
  delete patch.folderIssue;
  const ledgerLines = ledgerFromPost(dir, run, folderIssue, before.workflow);

  // The patch is applied to a fresh read under the state lock, never to the
  // read above: a send the person made in between is in the file, and a write
  // built on the older read would take it away. Nothing in here may exit, so
  // the lock is always let go; a refusal is carried out and reported after.
  let refused = null;
  let problems = [];
  let written;
  try {
    written = updateState(dir, (fresh) => {
      if (!fresh) {
        refused = ["that session has no state", 1];
        return null;
      }
      let next;
      try {
        next = applyPatch(fresh, patch);
      } catch (e) {
        refused = [e.message, 3];
        return null;
      }
      problems = validate(next);
      if (!problems.length && patch.chat) problems = validateChat(next, readChat(dir));
      return problems.length ? null : next;
    });
  } catch (e) {
    die(e.message, 1);
  }
  if (refused) die(...refused);
  if (problems.length) return failValidation(problems);
  const next = written.state;

  for (const line of ledgerLines) appendLedger(dir, line);
  appendEvent(dir, { type: "post", items: (patch.items || []).length });

  const open = next.items.filter((i) => isOpen(i) && i.required !== false).length;
  // Only a live server's link: no handle, no line, never a dead link.
  const handle = listHandles(projectRoot()).find((h) => h.sid === path.basename(dir));
  print({
    ok: true,
    items: next.items.length,
    open,
    phase: next.phase,
    ...unansweredNote(dir, next),
    ...(handle && handle.url ? { terminalLine: terminalLine(handle.url) } : {}),
  });
}

/**
 * The ledger lines a post's `run` and `folderIssue` stand for, or exit 3 on
 * the first bad one. Ids are scoped by the skill run in progress, so the same
 * `run` posted twice counts once, and `phase-2` in one Implement run never
 * collides with `phase-2` in the next.
 */
function ledgerFromPost(dir, run, issue, workflow) {
  if (run === undefined && issue === undefined) return [];
  const launch = lastLaunchId(readLedger(dir));
  const lines = [];
  if (run !== undefined) {
    const event = run && typeof run === "object" ? run.event : undefined;
    if (!RUN_EVENTS.has(event)) die(`run: unknown event "${event}"`, 3);
    if (typeof run.id !== "string" || !run.id.trim()) die("run: id required", 3);
    if (run.tasks !== undefined) {
      if (!TASK_EVENTS.has(event)) die(`run: tasks only goes with ${[...TASK_EVENTS].join(" or ")}`, 3);
      if (!isTaskCount(run.tasks)) die(`run: tasks must be a whole number from 1 to ${MAX_TASKS}`, 3);
    }
    lines.push({ kind: "run", id: `${launch}:${run.id}`, event, workflow, ...(run.tasks !== undefined ? { tasks: run.tasks } : {}) });
  }
  if (issue !== undefined) {
    const text = (v) => typeof v === "string" && v.trim() !== "";
    const ok =
      issue && typeof issue === "object" && text(issue.name) && text(issue.reason) && (issue.hint === undefined || text(issue.hint));
    if (!ok) die("folderIssue must be { name, reason, hint? }, each a non-empty string", 3);
    const problems = proseProblems(JSON.stringify([issue.reason, issue.hint || ""]), "folderIssue");
    if (problems.length) die(problems.join("\n  "), 3);
    lines.push({
      kind: "folder-issue",
      id: `${launch}:${issue.name}`,
      name: issue.name,
      reason: issue.reason,
      ...(issue.hint ? { hint: issue.hint } : {}),
    });
  }
  return lines;
}

/* ----------------------------------------------------------------- wait */

async function cmdWait() {
  const dir = mustSession();
  // "240s" reads as 240. A --seconds with no number in it at all would make
  // the deadline NaN, and the slice would end at once with exit 10: a busy
  // loop, not a wait. So that is refused rather than guessed at.
  const given = args.seconds;
  const asked = typeof given === "string" ? Number.parseFloat(given) : NaN;
  if (given !== undefined && !Number.isFinite(asked)) {
    die(`--seconds must be a number, got "${args.seconds}"`, 2);
  }
  const seconds = Math.max(5, given === undefined ? 240 : asked);
  const sid = path.basename(dir);
  const project = projectRoot();
  const resultPath = path.join(dir, "result.json");
  const chatPath = path.join(dir, CHAT_FILE);
  const deadline = Date.now() + seconds * 1000;
  const pendingChat = () => deliverableChat(collectChat(dir, readJson(path.join(dir, "state.json")) || {}));

  // A result may already be sitting there: the person can finish the form even
  // when the agent's session died, and a fresh agent picks it up here.
  const liveUrl = () => listHandles(project).find((h) => h.sid === sid)?.url || "";
  const existing = readJson(resultPath);
  if (existing && !existing.consumedAt) return consume(dir, resultPath, existing, liveUrl(), pendingChat());
  const earlyChat = pendingChat();
  if (earlyChat.length) return deliverChat(dir, sid, earlyChat, liveUrl());

  // A stat every 50ms, and a read only when the file has moved. The old tick
  // was a full read and parse every 400ms, which put up to 0.4s between the
  // person pressing Send and the agent starting on it, on every single send.
  let healthAt = 0;
  // A busy server (right after a post, say) can miss one health check without
  // being gone. Only a missing handle or dead pid is proof at once; a server
  // that merely does not answer must fail three checks in a row, each with a
  // longer look, before the slice ends with exit 20.
  let healthMisses = 0;
  // Null, not the current stamp: a result written between the check above and
  // this line would otherwise read as already seen and wait out the slice.
  let seen = null;
  let chatSeen = null;
  while (Date.now() < deadline) {
    const stamp = fileStamp(resultPath);
    if (stamp && stamp !== seen) {
      const result = readJson(resultPath);
      if (result && !result.consumedAt) return consume(dir, resultPath, result, liveUrl(), pendingChat());
      // Unreadable for a moment (a lock, a scanner): look again next tick.
      seen = result ? stamp : null;
    }

    // The chat inbox beside it, on the same tick: a Quick question ends the
    // slice as surely as a card send does.
    const chatStamp = fileStamp(chatPath);
    if (chatStamp !== chatSeen) {
      chatSeen = chatStamp;
      const entries = pendingChat();
      if (entries.length) return deliverChat(dir, sid, entries, liveUrl());
    }

    if (Date.now() - healthAt > 5000) {
      healthAt = Date.now();
      const handle = listHandles(project).find((h) => h.sid === sid);
      if (!handle || !pidAlive(handle.pid)) {
        print(serverGone(sid));
        process.exitCode = 20;
        return;
      }
      if (await healthOk(handle, 4000)) healthMisses = 0;
      else if (++healthMisses >= 3) {
        print(serverGone(sid));
        process.exitCode = 20;
        return;
      } else healthAt = Date.now() - 3000; // look again in about 2s, not 5s
    }
    sleepSync(50);
  }

  const state = readJson(path.join(dir, "state.json")) || {};
  const items = (state.items || []).filter((i) => i.required !== false);
  const answered = items.filter((i) => !isOpen(i)).length;
  const draft = readJson(path.join(dir, "draft.json"), {});
  const staged = Object.keys(draft.staged || {}).length;
  const handle = listHandles(project).find((h) => h.sid === sid);

  print({
    status: "waiting",
    sid,
    elapsed: fmtMs(Date.now() - Date.parse(state.created || nowIso())),
    answered,
    total: items.length,
    staged,
    url: handle ? handle.url : "",
    message: "Waiting on your answer in the web console",
    next: "NOT FINISHED, do not end your turn or write a summary: relay the message in one line, then run this same wait command again right now. Repeat until the exit code is not 10.",
    pendingChat: 0,
    ...unansweredNote(dir, state),
    // A workspace change alone never ends a slice: it rides on the next send.
    pendingWorkspace: pendingWorkspaceChanges(dir).length,
    ...(handle && handle.url ? { terminalLine: terminalLine(handle.url) } : {}),
  });
  process.exitCode = 10;
}

// Quick questions already handed over with no reply yet. Always empty when all are answered.
function unansweredNote(dir, state) {
  const seqs = unansweredChat(dir, state);
  return seqs.length
    ? { unansweredChat: seqs, warning: "Quick questions " + seqs.join(", ") + " have no reply yet and the page still shows them as pending. Reply to each now (chat.replies, re = seq): do what was asked when you can, or say why you will not." }
    : {};
}

function serverGone(sid) {
  return {
    status: "server-gone",
    sid,
    message: "The console server is not running. Start it again with `open --resume <sid> --no-open`, then keep waiting: at a finished screen too, since the person's Ask messages and the dashboard button still need you.",
  };
}

// Quick questions and nothing else: an ordinary exit 0 with no card actions.
function deliverChat(dir, sid, entries, url) {
  const [out, changes] = withWorkspace(dir, {
    type: "chat",
    at: nowIso(),
    sid,
    actions: [],
    chat: entries,
    reply: chatReplyLines(entries),
  });
  print({ ...out, ...(url ? { terminalLine: terminalLine(url) } : {}) });
  advanceCursor(dir, entries);
  advanceWorkspace(dir, changes);
  process.exitCode = 0;
}

// The workspace changes the agent is owed, added to what it is about to read:
// the list as `workspace`, and one line each at the end of `reply`.
function withWorkspace(dir, out) {
  const changes = pendingWorkspaceChanges(dir);
  if (!changes.length) return [out, changes];
  const reply = [out.reply, ...changes.map(changeLine)].filter(Boolean).join("\n");
  return [{ ...out, workspace: changes, reply }, changes];
}

// Print first, then this, as with the chat cursor: a kill in between can only
// hand the same change over again, never skip one.
function advanceWorkspace(dir, changes) {
  if (!changes.length) return;
  try {
    writeWorkspaceCursor(dir, Math.max(...changes.map((c) => c.version)));
  } catch {}
}

// Print first, then this, exactly as consume() stamps a result: a kill in
// between can only hand the same chat over again, and collectChat() drops
// anything that already has a reply.
function advanceCursor(dir, entries) {
  if (!entries.length) return;
  try {
    writeCursor(dir, Math.max(...entries.map((e) => e.seq)));
  } catch {}
  appendEvent(dir, { type: "chat-collect", count: entries.length });
}

/* ----------------------------------------------------------------- chat */

// The instant check a build makes between tasks. Never sleeps, and never
// touches result.json: card sends stay with `wait`.
async function cmdChat() {
  const dir = mustSession();
  const sid = path.basename(dir);
  const handle = listHandles(projectRoot()).find((h) => h.sid === sid);
  if (!handle || !pidAlive(handle.pid) || !(await healthOk(handle))) {
    print(serverGone(sid));
    process.exitCode = 20;
    return;
  }
  const entries = deliverableChat(collectChat(dir, readJson(path.join(dir, "state.json")) || {}));
  const changes = pendingWorkspaceChanges(dir);
  if (!entries.length && !changes.length) {
    print({ chat: [] });
    process.exitCode = 10;
    return;
  }
  const reply = [chatReplyLines(entries), ...changes.map(changeLine)].filter(Boolean).join("\n");
  print({ chat: entries, workspace: changes, reply, terminalLine: terminalLine(handle.url) });
  advanceCursor(dir, entries);
  advanceWorkspace(dir, changes);
  process.exitCode = 0;
}

/**
 * Hand a result to the agent, then mark it collected. In that order.
 *
 * Both halves of this guard the same thing, and it matters most in agents other
 * than the one this was built against: plenty of harnesses cap a single shell
 * call well below a wait slice and kill it at their own timeout.
 *
 * Printing before stamping means such a kill can only ever cause the NEXT wait
 * to hand the same result over twice, which the agent can absorb. The other
 * order loses answers someone pressed Send on, silently and permanently.
 *
 * And exiting by setting `exitCode` rather than calling process.exit(): stdout
 * to a pipe is asynchronous, and process.exit() truncates whatever Node has not
 * flushed. That would throw the result away just as thoroughly.
 */
function consume(dir, resultPath, result, url, chat = []) {
  const collected = { ...result, consumedAt: nowIso() };
  // The link, any chat and any workspace change ride on what the agent reads,
  // never on result.json itself.
  const withChat = { ...collected, chat };
  if (chat.length) withChat.reply = [collected.reply, chatReplyLines(chat)].filter(Boolean).join("\n");
  const [out, changes] = withWorkspace(dir, withChat);
  print(url ? { ...out, terminalLine: terminalLine(url) } : out);
  try {
    writeJsonAtomic(resultPath, collected);
  } catch {}
  appendEvent(dir, { type: "consume", kind: result.type });
  ledgerAnswers(dir, result);
  advanceCursor(dir, chat);
  advanceWorkspace(dir, changes);
  process.exitCode = result.type === "cancel" ? 30 : 0;
}

// One `answer` ledger line per item the person answered in this send, for
// the session meter. The id carries the send's stamp, so a send collected
// twice (a kill before consumedAt was written) still counts once, while the
// same question answered again in a later round counts again: that round was
// real back-and-forth. Never fatal: the meter is advice.
function ledgerAnswers(dir, result) {
  if (!result || result.type !== "submit" || !Array.isArray(result.actions)) return;
  try {
    const launch = lastLaunchId(readLedger(dir));
    const workflow = (readJson(path.join(dir, "state.json")) || {}).workflow;
    const items = new Set();
    for (const a of result.actions) {
      if (a && a.type === "answer" && typeof a.i === "string" && !a.i.startsWith("__")) items.add(a.i);
    }
    for (const i of items) appendLedger(dir, { kind: "answer", id: `${launch}:answer:${result.at}:${i}`, workflow });
  } catch {}
}

/* ----------------------------------------------------------------- keep */

// Copy one of the session's note attachments into specs/<idea>/attachments/, so
// a spec file can cite it after the session is swept. Run by the agent, never
// the server: the server still never writes into a project.
function cmdKeep() {
  const usage = "keep needs --session <sid> --upload <path> --name <name> --spec specs/<idea>";
  if ([args.upload, args.name, args.spec].some((v) => typeof v !== "string")) die(usage, 2);
  const dir = mustSession();
  const state = readJson(path.join(dir, "state.json"));
  if (!state) die("that session has no state", 1);
  const project = state.project;

  const upload = path.resolve(args.upload);
  if (!inside(path.join(dir, "uploads"), upload)) die("upload is not in this session's uploads folder", 3);
  const spec = path.resolve(project, args.spec);
  const attachments = path.join(spec, "attachments");
  if (!inside(project, spec) || !inside(fs.realpathSync(project), realNearest(attachments))) {
    die("spec folder is outside the project", 3);
  }
  if (!fs.existsSync(upload) || !fs.statSync(upload).isFile()) die("no such upload", 3);

  const file = attachmentName({ upload, name: args.name });
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
function cmdForget() {
  if (typeof args.spec !== "string" || !args.spec.trim()) die("forget needs --spec specs/<idea>", 2);
  let spec = specKey(args.spec);
  if (/\.md$/i.test(spec)) spec = spec.slice(0, spec.lastIndexOf("/"));
  const worktree = repoRoots().worktree;
  print({ ok: true, spec, forgot: forgetWorkspace(worktree, spec) });
}

/* ----------------------------------------------------------------- help */

function cmdHelp() {
  process.stdout.write(`console.mjs — the Plan2Code web console. A detached server, a loopback
port, and the filesystem as transport; this CLI is the whole agent surface.

  open    [--file <payload.json>] [--workflow <w>] [--title "<t>"] [--spec <dir>]
          [--session|--resume <sid>] [--no-open] [--idle-ms <ms>]
          Start or resume a session and its server. Prints { ok, sid, session,
          url, terminalLine }, plus swept { sessions, scratch } when old
          sessions or scratch files were removed. Run it FIRST, before
          reading anything: the page shows a starting screen until your
          first post. --file is optional, and --title defaults to the
          project's folder name. Also prints workspace: { folders: [{ name,
          path, description?, original? }], missing? }, the folders this
          console session reads as context, addressed as @name. The list is
          remembered per folder and spec in workspaces.json beside looks.json.
  post    --session <sid> --file <patch.json>
          Merge a patch into the session. Prints terminalLine while the
          server is live. Exit 3 = rejected; stderr says why. A patch may
          carry run: { event, id, tasks? } (session meter points) and folderIssue:
          { name, reason, hint? } (a workspace folder you could not read);
          both go to the ledger, never into the state.
  wait    --session <sid> [--seconds <N>]
          A bounded wait slice, sized below your shell timeout. Exit 0 = the
          result is on stdout, 10 = still waiting ("Waiting on your answer
          in the web console"; call again), 20 = server gone (open --resume
          <sid>), 30 = cancelled. Exits 0 and 10 carry terminalLine.
          Exit 0 may carry "chat" (Quick questions); with no card send it
          is type: "chat" and actions is empty. Exit 0 may also carry
          "workspace" (changes since you last heard, each once, with a
          "Workspace: ..." line in reply); exit 10 counts them as
          pendingWorkspace, and a change alone never ends a slice.
  chat    --session <sid>
          Collect Quick questions and workspace changes now, never waiting,
          never touching card sends. Exit 0 = { chat, workspace, reply,
          terminalLine }, 10 = none, 20 = server gone.
  terminalLine is "→ Look at the web console: <url>": end your terminal
  messages with it during a console session.
  keep    --session <sid> --upload <path> --name <name> --spec specs/<idea> [--from <file>]
          Copy a cited note attachment into specs/<idea>/attachments/. Prints
          { ok, path, link, image, reused }; exit 2 = bad usage, 3 = refused or
          missing. Paste link as it is.
  forget  --spec specs/<idea>
          Drop the workspace folders remembered for that spec, in this
          folder (Finalize, after archiving it). Prints { ok, spec, forgot };
          forgot is false when nothing was saved. Exit 2 = bad usage.
  status  [--session <sid>] [--all]
          One session, or every session belonging to this project.
  stop    --session <sid> | --all
          Shut a session's server down. Always post finish first.

  workflows: dashboard · init · init-update · pathfinder · quick-task · plan ·
             revise-plan · document · implement · implement-review · review ·
             finalize · handoff

  A session handed to you by the dashboard (a --session id): resume it with
  "open --resume <sid> --no-open --workflow <yours> --title <t>" -- never a
  fresh "open", which would strand the page the person is watching.

  The full contract is console.md beside this file. Build sessions
  (implement, implement-review, quick-task) also read building.md.
`);
}

/* --------------------------------------------------------------- status */

async function cmdStatus() {
  const project = projectRoot();
  if (args.session || args.sid) {
    const dir = mustSession();
    const state = readJson(path.join(dir, "state.json")) || {};
    const handle = listHandles(project).find((h) => h.sid === path.basename(dir));
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

async function cmdStop() {
  const project = projectRoot();
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

/* ---------------------------------------------------------------- utils */

function mustSession() {
  const raw = args.session || args.sid;
  if (!raw) die("--session <dir or id> is required", 2);
  const dir = fs.existsSync(raw) ? path.resolve(raw) : sessionDir(path.basename(raw));
  if (!fs.existsSync(dir)) die(`no session at ${dir}`, 1);
  return dir;
}

function tail(file, lines) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").slice(-lines).join("\n");
  } catch {
    return "(no server log)";
  }
}

function fmtMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/**
 * Best-effort, never fatal. If we cannot open a browser we still printed the URL,
 * and the URL is the primary channel.
 */
function openBrowser(url) {
  try {
    if (process.env.NO_BROWSER || process.env.PLAN2CODE_NO_BROWSER) return;
    // Do not try from a place where there is no browser to open.
    if (process.env.SSH_CONNECTION || process.env.REMOTE_CONTAINERS) return;

    // A browser of their choosing: a command line, run through the shell,
    // with the link appended. The token is base64url, so the quoted link
    // carries nothing a shell would read.
    const custom = process.env.PLAN2CODE_BROWSER;
    if (custom) {
      spawn(`${custom} "${url}"`, { shell: true, detached: true, stdio: "ignore", windowsHide: true }).unref();
      return;
    }

    const plat = process.platform;
    if (plat === "win32") {
      // The empty "" is the mandatory window-title argument: omit it and
      // `start` treats a quoted URL as the title and opens nothing.
      spawn(process.env.COMSPEC || "cmd.exe", ["/d", "/s", "/c", "start", '""', `"${url}"`], {
        windowsVerbatimArguments: true,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
      return;
    }
    if (plat === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
      return;
    }
    // Linux and friends. WSL first: xdg-open there either is absent or opens a
    // Linux browser that cannot reach the Windows host.
    if (isWsl()) {
      const exe = which("wslview") ? "wslview" : "powershell.exe";
      const argsFor = exe === "wslview" ? [url] : ["-NoProfile", "-Command", "Start-Process", `"${url}"`];
      spawn(exe, argsFor, { detached: true, stdio: "ignore" }).unref();
      return;
    }
    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return; // headless
    spawn(process.env.BROWSER || "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* never fatal */
  }
}

function isWsl() {
  if (process.platform !== "linux") return false;
  try {
    return /microsoft/i.test(fs.readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}

function which(bin) {
  const dirs = (process.env.PATH || "").split(path.delimiter);
  return dirs.some((d) => {
    try {
      fs.accessSync(path.join(d, bin), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

/* ------------------------------------------------------------- dispatch */

const COMMANDS = {
  open: cmdOpen,
  post: cmdPost,
  wait: cmdWait,
  chat: cmdChat,
  keep: cmdKeep,
  forget: cmdForget,
  status: cmdStatus,
  stop: cmdStop,
  help: cmdHelp,
};

// Say which Node is too old, rather than dying later inside a health check with
// "fetch is not defined". Whatever agent is driving this has to be able to read
// the failure, tell the person in one line, and carry on in the terminal.
const nodeMajor = Number.parseInt(process.versions.node, 10);
if (Number.isFinite(nodeMajor) && nodeMajor < 18) {
  process.stderr.write(
    `console: needs Node 18 or newer, found ${process.versions.node}. ` +
      `Say so in one line and carry on in the terminal.\n`
  );
  process.exit(2);
}

if (!cmd || !Object.hasOwn(COMMANDS, cmd)) {
  process.stderr.write(
    "console: usage: console.mjs <open|post|wait|chat|keep|status|stop|help> [--session <id>] [--file <patch.json>] [--seconds N]\n"
  );
  process.exit(2);
}

// A flag given with no value parses as `true`, and a boolean handed on as a
// path or a name crashes somewhere deep (path.basename(true) throws). Every
// flag that takes a value is checked once, here, and refused as bad usage.
const VALUE_FLAGS = ["session", "sid", "resume", "file", "spec", "title", "workflow", "upload", "name", "from", "seconds", "limit", "idle-ms"];
for (const flag of VALUE_FLAGS) {
  if (flag in args && typeof args[flag] !== "string") die(`--${flag} needs a value`, 2);
}

await COMMANDS[cmd]();
