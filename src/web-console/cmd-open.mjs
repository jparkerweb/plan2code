// Plan2Code Web Console - the `open` command: start or resume a session, its server and the browser.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

import { HERE, HOME_DIR, SESSIONS_DIR, appendEvent, ensureDir, nowIso, readJson, updateState } from "./files.mjs";
import {
  CONSOLE_VERSION_DIR,
  appendLedger,
  bindLoopback,
  handOff,
  handleFile,
  healthOk,
  listHandles,
  newSessionId,
  newToken,
  nextLaunchId,
  pidAlive,
  readLedger,
  reapHandles,
  remoteWarning,
  removeScratch,
  removeSessions,
  repoRoots,
  SESSION_MAX_AGE_MS,
  sessionDir,
  staleScratch,
  staleSessions,
  sweepUploads,
  terminalLine,
  UPLOAD_MAX_AGE_MS,
} from "./sessions.mjs";
import { scanProject } from "./scan.mjs";
import {
  applyPatch,
  blankState,
  isOpen,
  switchWorkflow,
  resolveDocFiles,
  resolveDocImages,
  validate,
} from "./patches.mjs";
import {
  initialWorkspace,
  readWorkspace,
  rememberedWorkspace,
  workspaceForAgent,
  writeWorkspaceCursor,
} from "./workspace.mjs";
import { readPrHosts, resetSubagentCursor, subagentStoreEntry } from "./settings.mjs";
import { resetPointers } from "./pointers.mjs";
import { WORKFLOWS, isWorkflow } from "./public/skills.js";
import { startsClean } from "./public/hops.js";
import { STRENGTH_ORDER } from "./strengths.mjs";
import { snapshot } from "./git-repo.mjs";
import { announcePage, currentSession, inAppSignal } from "./in-app.mjs";
import { findAgent } from "./agent-lookup.mjs";
import { handoffsDir, listHandoffs, removeHandoffs, staleHandoffs } from "./handoffs.mjs";
import {
  readPatch,
  failValidation,
  liftReread,
  gitBlock,
  ledgerFromPost,
  awaitSubagentSync,
  withSubagents,
  advanceSubagents,
  printOut,
} from "./cmd-post-wait.mjs";

// The CLI's own pieces, handed over by console.mjs through useCli() before
// any command runs: console.mjs runs on import, so it cannot be imported back.
let args, print, die;
export function useCli(cli) {
  ({ args, print, die } = cli);
}

// PLAN2CODE_CONSOLE_TRACE=1 prints where the time goes, to stderr: the
// start path is what stands between someone and their first look at the page,
// and it is only worth optimizing with numbers in hand.
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
  // Only an installed console (a version folder) leaves it: a source checkout or an old per-skill
  // copy pointing console-dir at itself would leave every skill stub unable to find the shared one.
  if (!CONSOLE_VERSION_DIR.test(path.basename(HERE))) return;
  try {
    ensureDir(HOME_DIR);
    fs.writeFileSync(path.join(HOME_DIR, "console-dir"), HERE + "\n");
  } catch {
    /* a pointer we cannot leave costs nothing */
  }
}

// Printed on every `open`: this console can be framed by the desktop app (the
// embed mode, and the in-app signal). The app refuses a console without it.
const EMBED_API = 1;

// The only workflows a loop drives (open --loop).
const LOOP_WORKFLOWS = ["implement", "implement-review"];

// What the loop locks a session with: `driving`, and, when the app started this
// phase on a strength, its word (PLAN2CODE_LOOP_STRENGTH), which the server's
// Subagents sync reads so the phase's helpers follow it.
function loopLock() {
  const strength = process.env.PLAN2CODE_LOOP_STRENGTH;
  return STRENGTH_ORDER.includes(strength) ? { driving: true, strength } : { driving: true };
}

export async function cmdOpen() {
  trace("open: start");
  // A workflow the console does not know is refused first, before the pointer,
  // the reap or any session folder: a fresh open would otherwise make a
  // session under a name no page or skill can show, and a resume would write
  // that name over a good one. No --workflow at all is still fine (FR-5).
  if (args.workflow !== undefined && !isWorkflow(args.workflow)) {
    die(`unknown workflow "${args.workflow}"; one of: ${WORKFLOWS.join(", ")}`, 2);
  }
  // Loop mode (the desktop app's Implementation Loop) is asked for with
  // --loop and refused everywhere else, again before the pointer or any
  // session folder exists.
  const loopMode = args.loop !== undefined && args.loop !== false;
  if (loopMode) {
    if (!inAppSignal()) die("Loop mode runs only inside the Plan2Code desktop app.", 3);
    if (!LOOP_WORKFLOWS.includes(args.workflow)) {
      die(`--loop goes only with --workflow ${LOOP_WORKFLOWS.join(" or --workflow ")}`, 2);
    }
  }
  leavePointer();
  // Under the desktop app the page belongs in the app's window: never the
  // browser, and (unless a session was named) the app's own session, so one
  // console serves the whole window. A session that is gone is simply not
  // reused: the open below makes a new one and announces its address.
  const inApp = inAppSignal();
  if (inApp) {
    args["no-open"] = true;
    const named = args.resume || args.session;
    if (!named) {
      // The window knows its current session; the environment's is only a fallback.
      const sid = path.basename((await currentSession(inApp)) || inApp.sid || "");
      if (sid && fs.existsSync(sessionDir(sid))) args.resume = sid;
    }
  }
  // The launcher's setup flow hands this open's page back to the console that
  // asked for it: instead of a browser, the session's link is POSTed to that
  // console's /handover, which moves the launcher's own tab here. Fresh opens
  // outside the app only; a resume or an in-app session keeps its own flow.
  const setupAnnounce =
    !inApp && !args.resume && !args.session && process.env.PLAN2CODE_SETUP_ANNOUNCE && process.env.PLAN2CODE_SETUP_TOKEN
      ? { announce: process.env.PLAN2CODE_SETUP_ANNOUNCE, token: process.env.PLAN2CODE_SETUP_TOKEN }
      : null;
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
    // A resume starts the reading over: each topic file is named again when
    // its moment recurs (FR-11), whether or not this is a hop.
    resetPointers(dir);
    // A resume can also be a hand-off: the dashboard launches another skill
    // into its own session, and the first thing that skill needs is for the
    // page to stop being a dashboard. Letting the flags restate these fields
    // on resume means one command both reuses the server and turns the page,
    // rather than a resume plus a whole extra post.
    const switching = args.workflow && args.workflow !== state.workflow;
    launched = Boolean(switching);
    // A hop starts the new skill on a clean page, by the rule in
    // public/hops.js (the page applies the same one). The staged draft goes
    // too, since its item ids belonged to the old questions, and so does the
    // last run's state.git, since switchWorkflow() starts from a blank state.
    const hop = startsClean(state.workflow, args.workflow);
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
        // A new agent picking the session up: its own working turn, timed
        // from now, not the paused run's last status.
        s.agent = { status: "working", since: nowIso() };
        // The old run's warning about what a stop would lose is about its
        // unsaved work; the new run posts its own when it has some.
        delete s.stopWarning;
        // So is its count: the open questions it counted are dropped below,
        // and the page falls back to its own tally until the new run posts.
        s.headline = { stage: "", cleared: 0, total: 0, confidence: "", note: "" };
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
      // A launch is a resume that names a workflow and keeps the page put
      // (`--no-open`: Continue here, a dashboard pick, a pick-up). It starts a
      // new run, so a real ending from the last one comes down with it. A hop
      // to another skill already starts clean; this is the same skill again
      // (Pathfinder into Pathfinder), where the old finish card would freeze
      // every question the new run asks. A plain `open --resume` (no workflow)
      // still keeps a real ending, so a re-shared link shows its card.
      if (s.finish && args.workflow && args["no-open"]) {
        delete s.finish;
        delete s.stopWarning;
        s.agent = { status: "working", since: nowIso() };
      }
      if (hop) {
        s = switchWorkflow(s, {
          workflow: args.workflow,
          title: typeof args.title === "string" ? args.title : path.basename(worktree),
          specDir: args.spec,
        });
      } else if (switching) {
        s.workflow = args.workflow;
        // An inline switch (into Review) is not a loop phase.
        if (!LOOP_WORKFLOWS.includes(args.workflow)) {
          delete s.loopOutcome;
          delete s.loopEnd;
        }
      }
      if (args.title) s.title = args.title;
      if (args.spec) s.specDir = args.spec;
      // A setup session carries the hand-over data the launcher needs: which
      // CLI it is setting up and the per-session token /handover checks. On
      // resume it is rewritten only when --for-cli is passed or the session
      // has none yet; a plain resume keeps the existing token valid.
      if (args.workflow === "setup" && (args["for-cli"] !== undefined || !s.setup)) {
        s.setup = { forCli: args["for-cli"] || null, token: newToken(), created: nowIso() };
      }
      // The loop lock follows the flag: --loop locks the page, and a resume
      // without it (Fix it by hand, from a stop screen) is an ordinary,
      // unlocked session. `loopExpect` goes with the lock: the app restamps it
      // on its next look, so a stale setup never judges a new run.
      if (loopMode) s.loop = loopLock();
      else {
        delete s.loop;
        delete s.loopExpect;
        // The loop's cards mean nothing without it, and validate() refuses
        // handledBy outside a loop session, which would wedge every post.
        s.items = (s.items || []).map(({ handledBy, ...item }) => item);
      }
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
    // Locked from the first frame, before the state is first written.
    if (loopMode) state.loop = loopLock();
    // The setup session's hand-over data (forCli + the token /handover
    // checks), created with the state so the first write already has it.
    if (args.workflow === "setup") {
      state.setup = { forCli: args["for-cli"] || null, token: newToken(), created: nowIso() };
    }
  }

  // A first payload's meter and folder reports, as `post` takes them: checked
  // now, before anything is written, and appended once the launch is.
  let openRun;
  let openIssue;
  let openReread;
  let patch = null;
  if (args.file) {
    const read = readPatch(args.file);
    if (read.error) die(read.error, 2);
    patch = read.patch;
    ({ run: openRun, folderIssue: openIssue } = patch);
    delete patch.run;
    delete patch.folderIssue;
    openReread = liftReread(patch, args.workflow || state.workflow);
  }
  const base = reshape;
  if (patch) {
    // Against the page as this open leaves it (a hop starts blank), so a
    // refresh never re-reads the last skill's files into the new page.
    try {
      patch = resolveDocFiles(patch, base(structuredClone(state)), worktree);
      patch = resolveDocImages(patch, base(structuredClone(state)), dir);
    } catch (e) {
      die(e.message, 3);
    }
  }
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
  // Looked up under the project the session itself names (as `post` and `wait`
  // do), so an agent whose shell moved to another repo finds its server instead
  // of starting a second one for the same session.
  const sessionProj = state && typeof state.project === "string" && state.project ? state.project : project;
  const existing = sid && (args.resume || args.session) ? listHandles(sessionProj).find((h) => h.sid === sid) : null;
  // A live pid gets a second, longer look before it is given up on, as `stop`
  // gives one: a server busy right after a post can miss the first, and a
  // second server for the same session strands the page on the first.
  const reusable =
    existing && pidAlive(existing.pid)
      ? healthOk(existing).then((ok) => ok || healthOk(existing, 5000))
      : Promise.resolve(false);
  let boot = null;
  if (!existing) boot = await startServer(sessionProj, worktree, sid, dir, { noBrowser: Boolean(setupAnnounce) });

  // The dashboard's spec picker reads its inventory straight off the session
  // state, so the scan belongs to `open` rather than to the agent: filesystem
  // facts, recomputed every time the session becomes (or stays) a dashboard,
  // never something a model has to remember to fetch. Rooted at the worktree's
  // own top level: `project` is the common-dir key so linked worktrees share
  // sessions, but each shows the specs on its own disk.
  const scan = state.workflow === "dashboard" ? scanProject(worktree) : null;
  // This checkout's unused handoffs live outside every repo (handoffs.mjs), so
  // they join the scan here and not in scanProject(), which also serves
  // `specs.mjs list`. handoffsDir rides along so the page never guesses it.
  if (scan) {
    scan.handoffs = listHandoffs(worktree);
    scan.handoffsDir = handoffsDir();
  }
  // The git board's data, the same way: the console's own read-only snapshot
  // (git-repo.mjs), taken before the lock so no git process runs under it.
  const gitSnap = state.workflow === "git" ? snapshot(worktree, { prHosts: readPrHosts() }) : null;

  // Under the state lock, which a send on the page takes too: the result and
  // the state are read fresh here and the state is rebuilt from that read, so
  // nothing the person sent since the read above is lost or stamped over.
  let carried = false;
  let written;
  try {
    written = updateState(dir, (fresh) => {
      const next = fresh ? reshape(fresh) : state;
      if (scan) next.scan = scan;
      // A launch or hop starts the board fresh; a plain resume (a server
      // restart) keeps the last word on whether a Refresh failed.
      if (gitSnap) next.git = launched ? gitBlock(gitSnap, openReread ?? { refreshFailed: false }) : gitBlock(gitSnap, openReread, fresh?.git);

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
  appendEvent(dir, { type: "open", resumed: Boolean(args.resume || args.session), carried, caps: ["subagents"] });
  // A new agent conversation has been told nothing yet (FR-6).
  try {
    resetSubagentCursor(dir);
  } catch {}
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
  const sweptHandoffs = staleHandoffs(Date.now(), SESSION_MAX_AGE_MS);
  const sweep = () => {
    sweepUploads(SESSIONS_DIR, Date.now(), UPLOAD_MAX_AGE_MS, sid).catch(() => {});
    removeSessions(SESSIONS_DIR, sweptSessions).catch(() => {});
    removeScratch(HOME_DIR, sweptScratch).catch(() => {});
    removeHandoffs(sweptHandoffs).catch(() => {});
  };

  // A standing instruction the new agent is owed, as a `reply` holding only
  // its lines; no key when nothing is owed.
  const subagentsOwed = () => {
    // In a loop the setting must carry this phase's strength, or the stored one
    // when the phase has none, before the first block is built: a resume leaves
    // the earlier phase's strength in the setting until the server syncs.
    const expected = loopMode ? (state.loop && state.loop.strength) || subagentStoreEntry(worktree, state.workflow).strength : undefined;
    awaitSubagentSync(dir, state.workflow, expected);
    const [out, cursor] = withSubagents(dir, { reply: "" });
    return [cursor ? out : {}, cursor];
  };

  // What open tells the agent about the folders: only when there is more than
  // the folder it started in.
  const folders = workspace.folders && workspace.folders.length > 1 ? { workspace } : {};

  // Reuse a live server if one is already serving this session.
  if (existing && (await reusable)) {
    const remote = remoteWarning();
    const reuseNotes = [];
    if (remote.note) reuseNotes.push(remote.note);
    // Reuse only happens under --resume/--session, where a setup hand-over is
    // never armed, so this path just reopens the page.
    if (!args["no-open"]) openBrowser(existing.url);
    const inAppReport = await tellApp(inApp, { url: existing.url, sid, workflow: state.workflow });
    const [owed, subCursor] = subagentsOwed();
    printOut(dir, {
      ok: true,
      sid,
      session: dir,
      url: existing.url,
      embed: EMBED_API,
      ...(state.setup && state.setup.token ? { setup: { url: existing.url, token: state.setup.token } } : {}),
      ...inAppReport,
      ...(carried ? { pendingResult: true } : {}),
      terminalLine: terminalLine(existing.url),
      ...folders,
      ...owed,
      ...(remote.remote ? { remote: remote.remote } : {}),
      ...(reuseNotes.length ? { note: reuseNotes.join(" ") } : {}),
    });
    advanceSubagents(dir, subCursor);
    sweep();
    return;
  }

  // A handle whose pid is alive but is not ours (the pid was reused) leaves
  // this for last: nothing could be started until that was known.
  let started = boot || (await startServer(sessionProj, worktree, sid, dir));
  let handle = await awaitHandle(started);
  if (!handle && started.handoff) {
    // The handover went wrong somewhere (a platform that will not pass the
    // socket, a server that died taking it). Once more the old way, where
    // the server binds its own port: slower, and certain.
    started.kill();
    started = await startServer(sessionProj, worktree, sid, dir, { handoff: false, noBrowser: Boolean(setupAnnounce) });
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
  // With a setup hand-over the early tab was never sent at all: only the
  // FINAL url is POSTed to the launcher console's /handover, which moves its
  // own tab here. A failed hand-over falls back to the browser and a note.
  let handoverDone = false;
  const notes = [];
  if (!args["no-open"]) {
    if (setupAnnounce) {
      const moved = await postHandover(setupAnnounce, handle.url);
      handoverDone = moved === "ok";
      // "moved" or "gone" means the first open already spent the hand-over, so
      // the browser fallback is quiet; anything else earns the note.
      if (moved !== "ok") openBrowser(handle.url);
      if (moved === false) notes.push("Could not move the setup tab; opened a new browser tab.");
    } else if (handle.url !== started.opened) {
      openBrowser(handle.url);
    }
  }
  const remote = remoteWarning();
  if (remote.note) notes.push(remote.note);
  if (carried) notes.push("Answers are already waiting. Run `wait` to collect them.");
  const inAppReport = await tellApp(inApp, { url: handle.url, sid, workflow: state.workflow });
  if (inAppReport.inApp && !inAppReport.announced) {
    notes.push(`The app did not take the page. Open ${handle.url} in a browser, or press Reload in the app.`);
  }
  const [owed, subCursor] = subagentsOwed();
  printOut(dir, {
    ok: true,
    sid,
    session: dir,
    url: handle.url,
    embed: EMBED_API,
    ...(state.setup && state.setup.token ? { setup: { url: handle.url, token: state.setup.token } } : {}),
    ...inAppReport,
    ...(handoverDone ? { handover: true } : {}),
    port: handle.port,
    pid: handle.pid,
    ...(carried ? { pendingResult: true } : {}),
    terminalLine: terminalLine(handle.url),
    ...folders,
    ...owed,
    ...(remote.remote ? { remote: remote.remote } : {}),
    ...(notes.length ? { note: notes.join(" ") } : {}),
  });
  advanceSubagents(dir, subCursor);
  // After the print, never before it: the page and the link wait for nothing.
  sweep();
}

/**
 * Under the app, say which page to show; outside it, nothing and no keys.
 * The report rides on `open`'s output so the agent can tell what happened.
 */
async function tellApp(signal, page) {
  if (!signal) return {};
  const announced = signal.announce ? await announcePage(signal, page) : false;
  return { inApp: true, announced };
}

/**
 * POST this session's sign-in link to the setup console that asked for it
 * (PLAN2CODE_SETUP_ANNOUNCE / _TOKEN): its /handover then moves the
 * launcher's own tab here instead of a second browser opening. Loopback http
 * only, like in-app.mjs's request(): a foreign or https target is no
 * hand-over at all. Resolves "ok" on a 2xx, "moved" on the route's already-
 * moved 409, "gone" when nothing answers (the setup console already went
 * away, so the fallback is a quiet browser open) and false on any other
 * answer, which earns the caller's fallback note. Never throws.
 */
function postHandover(setup, url) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL("/handover", setup.announce);
    } catch {
      return resolve(false);
    }
    if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname)) {
      return resolve(false);
    }
    const body = JSON.stringify({ url });
    const req = http.request(
      target,
      {
        method: "POST",
        timeout: 1500,
        headers: {
          "x-plan2code-token": setup.token,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve(
            res.statusCode === 409
              ? "moved"
              : res.statusCode && res.statusCode >= 200 && res.statusCode < 300
                ? "ok"
                : false
          )
        );
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve("gone"));
    req.end(body);
  });
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
async function startServer(project, worktree, sid, dir, { handoff = true, noBrowser = false } = {}) {
  const token = newToken();
  const handlePath = handleFile(project, sid);
  ensureDir(path.dirname(handlePath), 0o700);
  fs.rmSync(handlePath, { force: true });

  // The token never goes on the command line, where any process on the
  // machine can read it (ps, Task Manager, /proc/<pid>/cmdline). It waits in a
  // one-shot file in the private session folder, named afresh for each spawn
  // so two opens racing on one session cannot read each other's, and the
  // server deletes it as soon as it has read it.
  const tokenName = `server-token-${newToken().slice(0, 12).replace(/[^A-Za-z0-9]/g, "x")}`;
  const tokenPath = path.join(dir, tokenName);
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  const logFd = fs.openSync(path.join(dir, "server.log"), "a");
  const child = spawn(
    process.execPath,
    [
      path.join(HERE, "server.mjs"),
      // Always `--flag=value`, never two words: parseArgs would read a value
      // that starts with "--" as the next flag.
      `--session=${dir}`,
      `--token-file=${tokenName}`,
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
      // half-finished answers with them. Detached processes are immune to
      // that, but not to the desktop app's Job Object on Windows: ending an
      // agent there ends a server the agent opened (the app's window reconnects).
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
  // A server that never started never took its token file: do not leave it.
  const dropTokenFile = () => {
    try {
      fs.rmSync(tokenPath, { force: true });
    } catch {}
  };
  child.on("exit", () => ((exited = true), dropTokenFile()));
  child.on("error", () => ((exited = true), dropTokenFile()));
  trace("open: server spawned");

  let opened = null;
  let released = Promise.resolve();
  if (handoff) {
    const pre = await bindLoopback();
    trace("open: port bound");
    // No socket to give (the bind failed): the server binds its own, and the
    // channel is let go once it has.
    released = handOff(child, pre);
    // noBrowser: a setup hand-over replaces the early tab; the caller POSTs
    // only the final url to the launcher console's /handover instead.
    if (pre && !args["no-open"] && !noBrowser) opened = `http://127.0.0.1:${pre.address().port}/s/${token}/`;
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

function tail(file, lines) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").slice(-lines).join("\n");
  } catch {
    return "(no server log)";
  }
}

// A missing browser command raises ENOENT as an event, after the try/catch has
// returned: without a listener it would end `open` before it printed the link.
function quietSpawn(command, args, options) {
  // The shell form passes its options in the second place.
  const child = Array.isArray(args) ? spawn(command, args, options) : spawn(command, [], args);
  child.on("error", () => {});
  child.unref();
  return child;
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
      quietSpawn(`${custom} "${url}"`, { shell: true, detached: true, stdio: "ignore", windowsHide: true });
      return;
    }

    const plat = process.platform;
    if (plat === "win32") {
      // The empty "" is the mandatory window-title argument: omit it and
      // `start` treats a quoted URL as the title and opens nothing.
      quietSpawn(process.env.COMSPEC || "cmd.exe", ["/d", "/s", "/c", "start", '""', `"${url}"`], {
        windowsVerbatimArguments: true,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    }
    if (plat === "darwin") {
      quietSpawn("open", [url], { detached: true, stdio: "ignore" });
      return;
    }
    // Linux and friends. WSL first: xdg-open there either is absent or opens a
    // Linux browser that cannot reach the Windows host.
    if (isWsl()) {
      const exe = findAgent({ command: "wslview" }).state === "found" ? "wslview" : "powershell.exe";
      const argsFor = exe === "wslview" ? [url] : ["-NoProfile", "-Command", "Start-Process", `"${url}"`];
      quietSpawn(exe, argsFor, { detached: true, stdio: "ignore" });
      return;
    }
    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return; // headless
    quietSpawn(process.env.BROWSER || "xdg-open", [url], { detached: true, stdio: "ignore" });
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
