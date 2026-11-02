// Plan2Code Web Console - `post` and `wait`: publish a patch, then collect what the person sent.

import fs from "node:fs";
import path from "node:path";

import { HERE, appendEvent, fileStamp, nowIso, readJson, sleepSync, updateState, writeJsonAtomic } from "./files.mjs";
import {
  appendLedger,
  healthOk,
  lastLaunchId,
  listHandles,
  pidAlive,
  readLedger,
  repoRoots,
  terminalLine,
} from "./sessions.mjs";
import { applyPatch, isOpen, proseProblems, resolveDocFiles, resolveDocImages, rule, validate } from "./patches.mjs";
import {
  CHAT_FILE,
  chatReplyLines,
  collectChat,
  currentConversation,
  deliverableChat,
  unansweredChat,
  readChat,
  validateChat,
  writeCursor,
} from "./inbox.mjs";
import { pendingWorkspaceChanges, writeWorkspaceCursor } from "./workspace.mjs";
import { readPrHosts, readSubagentCursor, readSubagentSetting, writeSubagentCursor } from "./settings.mjs";
import { snapshot } from "./git-repo.mjs";
import { handoffsDir, isHandoffId, markHandoffUsed, readHandoffMeta } from "./handoffs.mjs";
import { RUN_EVENTS, TASK_EVENTS, MAX_COMMITS, MAX_TASKS, isTaskCount, progressEntry } from "./public/meter.js";
import { blockFor, offered } from "./public/subagents.js";
import { changeLine } from "./public/workspace.js";
import { duePointers, pointersForSend, rememberPointers } from "./pointers.mjs";

// The CLI's own pieces, handed over by console.mjs through useCli() before
// any command runs: console.mjs runs on import, so it cannot be imported back.
let args, print, die, mustSession, sessionProject;
export function useCli(cli) {
  ({ args, print, die, mustSession, sessionProject } = cli);
}

/* --------------------------------------------------------- printed line */

// The link line is printed by `open` and then only when it changes (a new URL
// after a restart or a resume). What was last printed lives in the session
// folder, never in state.json, which rides every frame to the page.
const PRINTED_FILE = "printed.json";

export function printedLine(dir) {
  const saved = readJson(path.join(dir, PRINTED_FILE), {});
  return saved && typeof saved.terminalLine === "string" ? saved.terminalLine : "";
}

export function rememberLine(dir, line) {
  try {
    writeJsonAtomic(path.join(dir, PRINTED_FILE), { terminalLine: line });
  } catch {}
}

// `{ terminalLine }` when the line for this link differs from the one last
// printed, else `{}`. Printing is printOut(), which stores the line after the
// print, the order advanceCursor() uses: a kill in between repeats a line,
// never loses one.
export function lineIfChanged(dir, url) {
  if (!url) return {};
  const line = terminalLine(url);
  return line === printedLine(dir) ? {} : { terminalLine: line };
}

export function printOut(dir, out) {
  print(out);
  if (typeof out.terminalLine === "string") rememberLine(dir, out.terminalLine);
}

/* ----------------------------------------------------------------- post */

// A patch from a file, or from stdin with `--file -`: a heredoc piped into
// the command saves the agent writing a file first, one tool call a turn.
// A file PowerShell wrote comes with a BOM (Out-File / Set-Content in 5.1) or
// in UTF-16 (its `>`), and both are the documented Windows route, so both read.
// Indented and minified JSON read alike. Returns `{ patch }`, or `{ error }`
// saying what is wrong and where, for the caller to print with exit 2.
export function readPatch(file) {
  let text;
  try {
    const buf = fs.readFileSync(file === "-" ? 0 : path.resolve(file));
    if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.subarray(2).toString("utf16le");
    else if (buf[0] === 0xfe && buf[1] === 0xff) text = Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
    else text = buf.toString("utf8");
  } catch (e) {
    return { error: `could not read --file ${file}: ${e.code === "ENOENT" ? "no such file" : e.message}` };
  }
  text = text.replace(/^\uFEFF/, "");
  if (!text.trim()) return { error: "the patch is empty (nothing arrived on stdin? use a quoted heredoc, <<'EOF')" };
  let patch;
  try {
    patch = JSON.parse(text);
  } catch (e) {
    return { error: parseErrorAt(text, e.message) };
  }
  // A patch is one JSON object: an array, string or number would merge
  // into the state as junk keys ("0", "1"...) and still report ok.
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    const what = patch === null ? "null" : Array.isArray(patch) ? "an array" : `a ${typeof patch}`;
    return { error: `the patch must be one JSON object ({...}), not ${what}` };
  }
  return { patch };
}

// Whether `prefix` could still grow into valid JSON: it parses, or it only
// fails by stopping short.
function viablePrefix(prefix) {
  try {
    JSON.parse(prefix);
    return true;
  } catch (e) {
    if (/end of JSON input|Unterminated/.test(e.message)) return true;
    const at = /(?:in|after) JSON at position (\d+)/.exec(e.message);
    return Boolean(at) && Number(at[1]) >= prefix.length;
  }
}

// Where JSON.parse gave up, as a 0-based character index. Node 18 and Node 20+
// word the message differently (and some messages carry no position at all),
// so the message's position is used when there is one and the spot is found
// by search when there is not.
function errorIndex(text, message) {
  const at = /(?:in|after) JSON at position (\d+)/.exec(message);
  if (at) return Math.min(Number(at[1]), text.length);
  const lc = /position \d+ \(line (\d+) column (\d+)\)/.exec(message);
  if (lc) {
    const lines = text.split("\n");
    let index = 0;
    for (let i = 0; i < Number(lc[1]) - 1 && i < lines.length; i++) index += lines[i].length + 1;
    return Math.min(index + Number(lc[2]) - 1, text.length);
  }
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (viablePrefix(text.slice(0, mid))) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// `line L, column C: <what the parser said>`, then up to 30 characters either
// side of the spot (newlines shown as \n) and a caret under it.
export function parseErrorAt(text, message) {
  const index = errorIndex(text, message);
  const before = text.slice(0, index).split("\n");
  const line = before.length;
  const column = before[before.length - 1].length + 1;
  const show = (t) => t.replaceAll("\r", "").replaceAll("\n", "\\n");
  const left = show(text.slice(Math.max(0, index - 30), index));
  const right = show(text.slice(index, index + 31));
  const said = message
    .replace(/ in JSON at position \d+( \(line \d+ column \d+\))?/, "")
    .replace(/,\s.*is not valid JSON$/s, "")
    .replace(/ at position \d+.*$/, "");
  return `line ${line}, column ${column}: ${said}\n${left}${right}\n${" ".repeat(left.length)}^`;
}

export function failValidation(problems) {
  process.stderr.write("console: the payload was rejected, nothing was written.\n");
  // A problem that runs over several lines stays under its own bullet.
  for (const p of problems) process.stderr.write("  - " + String(p).replaceAll("\n", "\n    ") + "\n");
  // exitCode, not exit(): the agent has to read these lines to fix the patch,
  // and process.exit() can truncate a pipe Node has not flushed.
  process.exitCode = 3;
}

export async function cmdPost() {
  // `post --wait <seconds>` is a post and then a wait in one command: one tool
  // call per turn instead of two. A rejected post never waits (exit 3).
  if (args.wait !== undefined && args.wait !== true && !Number.isFinite(Number.parseFloat(args.wait))) {
    die("post --wait takes the slice in seconds, as wait --seconds does", 2);
  }
  if (!postOnce()) return;
  if (args.wait === undefined) return;
  // A bare --wait takes the slice from --seconds, as wait does.
  args.seconds = args.wait === true ? args.seconds : args.wait;
  return cmdWait();
}

function postOnce() {
  const dir = mustSession();
  const file = args.file;
  if (!file) die("post needs --file <path to a JSON patch>", 2);
  const read = readPatch(file);
  if (read.error) die(read.error, 2);
  let patch = read.patch;

  const statePath = path.join(dir, "state.json");
  const before = readJson(statePath);
  if (!before) die("that session has no state", 1);
  try {
    patch = resolveDocFiles(patch, before, before.worktree || repoRoots().worktree);
    patch = resolveDocImages(patch, before, dir);
  } catch (e) {
    die(e.message, 3);
  }

  // A chat reply names the conversation it answers; the agent is no longer
  // handed the entries, so a missing one means the current conversation.
  if (patch.chat && Array.isArray(patch.chat.replies)) {
    const { conversation } = currentConversation(readChat(dir));
    patch.chat.replies = patch.chat.replies.map((r) => (r && typeof r === "object" && !Array.isArray(r) && r.conversation === undefined ? { ...r, conversation } : r));
  }

  // Meter and folder reports go to the ledger, never into state.json. Checked
  // here, before anything is written: a rejected post appends nothing.
  const { run, folderIssue } = patch;
  delete patch.run;
  delete patch.folderIssue;
  const reread = liftReread(patch, before.workflow);
  const ledgerLines = ledgerFromPost(dir, run, folderIssue, before.workflow);
  // Taken before the lock: git processes must not run while it is held.
  const snap = reread === undefined ? null : snapshot(before.worktree || repoRoots().worktree, { prHosts: readPrHosts() });

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
      // The result card and the fresh board land in this one write.
      if (snap) {
        next.git = gitBlock(snap, reread, fresh.git);
        // The footer names the branch too: after a switch or a create it is
        // the new one, and mid-rebase the one being rebased.
        const onBranch = snap.head && (snap.head.branch || snap.head.rebasing);
        if (onBranch) next.branch = onBranch;
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
  // A build scores its tasks as it clears them (meter.js, PROGRESS_WORKFLOWS),
  // after any `run` in the same post, so a phase finished here ends its count.
  if (patch.headline && typeof patch.headline === "object") {
    const ledger = readLedger(dir);
    const progress = progressEntry(ledger, lastLaunchId(ledger), next.workflow, patch.headline.cleared);
    if (progress) appendLedger(dir, progress);
  }
  appendEvent(dir, { type: "post", items: (patch.items || []).length });

  const open = next.items.filter((i) => isOpen(i) && i.required !== false && i.kind !== "notice").length;
  // Only a live server's link: no handle, no line, never a dead link.
  const handle = listHandles(sessionProject(dir)).find((h) => h.sid === path.basename(dir));
  // The first patch carrying documents names the docs topic file; a refused
  // post returned above and recorded nothing.
  const topics = Array.isArray(patch.docs) && patch.docs.length ? ["docs"] : [];
  const due = duePointers(dir, topics);
  printOut(dir, {
    ok: true,
    open,
    ...(due.length ? { read: due } : {}),
    ...unansweredNote(dir, next),
    ...(handle && handle.url ? lineIfChanged(dir, handle.url) : {}),
  });
  rememberPointers(dir, topics);
  return true;
}

/**
 * A patch's `reread`, the agent's "re-read the repo" signal on the git board
 * (FR-10), lifted out of the patch, or exit 3 when it is malformed or not on a
 * git session. state.git itself is the console's own: a patch never carries it.
 */
export function liftReread(patch, workflow) {
  if (Object.hasOwn(patch, "git")) die(rule("", "git", "is the console's own state; post reread instead", { reread: true }), 3);
  const { reread } = patch;
  delete patch.reread;
  if (reread === undefined) return undefined;
  const flagOnly =
    reread && typeof reread === "object" && !Array.isArray(reread) && Object.keys(reread).length === 1 && typeof reread.refreshFailed === "boolean";
  if (reread !== true && !flagOnly) die(rule("", "reread", "must be true or { refreshFailed: true|false }", { reread: true }), 3);
  if (workflow !== "git") die(rule("", "reread", "only goes with the git workflow", { reread: null }), 3);
  return reread;
}

/**
 * The new state.git from a snapshot. The agent's refreshFailed wins; without
 * one, a newer FETCH_HEAD means a refresh worked, and anything else keeps the
 * last word on it.
 */
export function gitBlock(snap, reread, previous) {
  let refreshFailed;
  if (reread && typeof reread === "object") refreshFailed = reread.refreshFailed;
  else if (snap.lastFetch && (!previous?.lastFetch || Date.parse(snap.lastFetch) > Date.parse(previous.lastFetch))) refreshFailed = false;
  else refreshFailed = Boolean(previous?.refreshFailed);
  // A failed fetch still touches FETCH_HEAD, so its time is not a refresh:
  // the board keeps saying when the last one that worked was.
  if (refreshFailed === true && reread && typeof reread === "object") return { ...snap, lastFetch: previous?.lastFetch ?? null, refreshFailed };
  return { ...snap, refreshFailed };
}

/**
 * The ledger lines a post's `run` and `folderIssue` stand for, or exit 3 on
 * the first bad one. Ids are scoped by the skill run in progress, so the same
 * `run` posted twice counts once, and `phase-2` in one Implement run never
 * collides with `phase-2` in the next.
 */
export function ledgerFromPost(dir, run, issue, workflow) {
  if (run === undefined && issue === undefined) return [];
  const launch = lastLaunchId(readLedger(dir));
  const lines = [];
  if (run !== undefined) {
    const event = run && typeof run === "object" ? run.event : undefined;
    const runRight = { run: { event: "implement-phase", id: "phase-2" } };
    if (!RUN_EVENTS.has(event)) die(rule("", "run", `unknown event "${event}" (one of: ${[...RUN_EVENTS].join(", ")})`, runRight), 3);
    if (typeof run.id !== "string" || !run.id.trim()) die(rule("", "run", "needs an id", runRight), 3);
    if (run.tasks !== undefined) {
      if (!TASK_EVENTS.has(event)) die(rule("", "run", `tasks only goes with ${[...TASK_EVENTS].join(" or ")}`, { run: { event: [...TASK_EVENTS][0], id: "phase-2", tasks: 9 } }), 3);
      if (!isTaskCount(run.tasks)) die(rule("", "run", `tasks must be a whole number from 1 to ${MAX_TASKS}`, { run: { event, id: run.id, tasks: 9 } }), 3);
    }
    if (run.commits !== undefined) {
      if (event !== "git-commits") die(rule("", "run", "commits only goes with git-commits", { run: { event: "git-commits", id: "commits-1", commits: 2 } }), 3);
      const ok = Number.isInteger(run.commits) && run.commits >= 1 && run.commits <= MAX_COMMITS;
      if (!ok) die(rule("", "run", `commits must be a whole number from 1 to ${MAX_COMMITS}`, { run: { event, id: run.id, commits: 2 } }), 3);
    }
    lines.push({
      kind: "run",
      id: `${launch}:${run.id}`,
      event,
      workflow,
      ...(run.tasks !== undefined ? { tasks: run.tasks } : {}),
      ...(run.commits !== undefined ? { commits: run.commits } : {}),
    });
  }
  if (issue !== undefined) {
    const text = (v) => typeof v === "string" && v.trim() !== "";
    const ok =
      issue && typeof issue === "object" && text(issue.name) && text(issue.reason) && (issue.hint === undefined || text(issue.hint));
    if (!ok) die(rule("", "folderIssue", "must be { name, reason, hint? }, each a non-empty string", { folderIssue: { name: "api", reason: "..." } }), 3);
    const problems = [...proseProblems(issue.reason, "folderIssue reason"), ...(issue.hint ? proseProblems(issue.hint, "folderIssue hint") : [])];
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

export async function cmdWait() {
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
  const project = sessionProject(dir);
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
  if (earlyChat.length) return deliverChat(dir, earlyChat, liveUrl());
  markWaiting(dir);

  // A stat every 50ms, and a read only when the file has moved. The old tick
  // was a full read and parse every 400ms, which put up to 0.4s between the
  // person pressing Send and the agent starting on it, on every single send.
  let healthAt = 0;
  // A busy server (right after a post, say) can miss one health check without
  // being gone. Only a missing handle or dead pid is proof at once; a server
  // that merely does not answer must fail three checks in a row, each with a
  // longer look, before the slice ends with exit 20.
  let healthMisses = 0;
  // The check in flight, if any. Aborted on every way out, so a fetch left
  // running never holds the process (and the agent) past the print.
  let health = null;
  const healthStop = new AbortController();
  try {
    return await pollSlice();
  } finally {
    healthStop.abort();
  }

  async function pollSlice() {
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
      if (entries.length) return deliverChat(dir, entries, liveUrl());
    }

    // The health check runs beside the polling, never in its way: awaited
    // inline, a slow /health (a busy server, just after a send) held a
    // finished send back for up to the whole fetch timeout.
    if (!health && Date.now() - healthAt > 5000) {
      healthAt = Date.now();
      const handle = listHandles(project).find((h) => h.sid === sid);
      if (!handle || !pidAlive(handle.pid)) {
        print(serverGone(sid));
        process.exitCode = 20;
        return;
      }
      const check = { done: false, ok: false };
      health = check;
      healthOk(handle, 4000, healthStop.signal).then((ok) => Object.assign(check, { done: true, ok }));
    }
    if (health && health.done) {
      const { ok } = health;
      health = null;
      if (ok) healthMisses = 0;
      else if (++healthMisses >= 3) {
        print(serverGone(sid));
        process.exitCode = 20;
        return;
      } else healthAt = Date.now() - 3000; // look again in about 2s, not 5s
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  const state = readJson(path.join(dir, "state.json")) || {};
  const open = (state.items || []).filter((i) => i.required !== false && i.kind !== "notice" && isOpen(i)).length;
  const handle = listHandles(project).find((h) => h.sid === sid);

  // A workspace change alone never ends a slice: it rides on the next send.
  printOut(dir, {
    waiting: true,
    open,
    ...unansweredNote(dir, state),
    ...(handle && handle.url ? lineIfChanged(dir, handle.url) : {}),
  });
  process.exitCode = 10;
  }
}

// Quick questions already handed over with no reply yet. Always empty when all are answered.
function unansweredNote(dir, state) {
  const seqs = unansweredChat(dir, state);
  return seqs.length
    ? { unansweredChat: seqs, warning: "Quick questions " + seqs.join(", ") + " have no reply yet and the page still shows them as pending. Reply to each now (chat.replies, re = seq): do what was asked when you can, or say why you will not." }
    : {};
}

export function serverGone(sid) {
  return { gone: true, fix: `open --resume ${sid} --workflow <yours>` };
}

// The seq numbers of the Quick questions handed over: the ids a `chat.replies`
// entry's `re` needs. The questions themselves travel in `reply`.
export function chatSeqs(entries) {
  return entries.filter((e) => e.kind === "message").map((e) => e.seq);
}

// Quick questions and nothing else: an ordinary exit 0 with no card send.
function deliverChat(dir, entries, url) {
  const [withWs, changes] = withWorkspace(dir, { reply: chatReplyLines(entries) });
  const [out, subCursor] = withSubagents(dir, withWs);
  const seqs = chatSeqs(entries);
  const topics = pointersForSend({}, readJson(path.join(dir, "state.json")) || {}, owedFlags(changes, subCursor), entries);
  const due = duePointers(dir, topics);
  printOut(dir, { ...out, ...(seqs.length ? { chat: seqs } : {}), ...(due.length ? { read: due } : {}), ...lineIfChanged(dir, url) });
  rememberPointers(dir, topics);
  advanceCursor(dir, entries);
  advanceWorkspace(dir, changes);
  advanceSubagents(dir, subCursor);
  process.exitCode = 0;
}

// The workspace changes the agent is owed, added to what it is about to read:
// one `Workspace:` line each at the end of `reply`, in words only. The second
// value is the changes, whose length is the "a change happened" flag
// (see owedFlags()); the cursor moves after the print.
export function withWorkspace(dir, out) {
  const changes = pendingWorkspaceChanges(dir);
  if (!changes.length) return [out, changes];
  const reply = [out.reply, ...changes.map(changeLine)].filter(Boolean).join("\n");
  return [{ ...out, reply }, changes];
}

// Whether the standing instructions in a reply carried a change, for the
// pointers that name a topic file when one is delivered.
export function owedFlags(changes, subCursor) {
  return { workspaceChanged: changes.length > 0, subagentsChanged: Boolean(subCursor) };
}

// Print first, then this, as with the chat cursor: a kill in between can only
// hand the same change over again, never skip one.
export function advanceWorkspace(dir, changes) {
  if (!changes.length) return;
  try {
    writeWorkspaceCursor(dir, Math.max(...changes.map((c) => c.version)));
  } catch {}
}

// The server rewrites the session's setting for a new workflow only once its
// watcher sees the state `open` just wrote, so a launch or hop that read the
// file at once would find the old workflow's and owe the agent nothing until
// its next pickup. Give the server a moment to catch up instead, never
// writing the file ourselves (FR-7). A session with no setting file at all is
// an older server, which never writes one: a short look, not the full wait.
const SUBAGENT_SYNC_WAIT_MS = 1500;
const SUBAGENT_SYNC_MISSING_MS = 250;
export function awaitSubagentSync(dir, workflow) {
  if (!offered(workflow)) return;
  const start = Date.now();
  for (;;) {
    const setting = readSubagentSetting(dir);
    if (setting && setting.workflow === workflow) return;
    const budget = setting ? SUBAGENT_SYNC_WAIT_MS : SUBAGENT_SYNC_MISSING_MS;
    if (Date.now() - start >= budget) return;
    sleepSync(25);
  }
}

// The Subagents switch the agent is owed, added to what it is about to read:
// its lines last in `reply` (in words only), after card lines,
// Quick questions and Workspace lines (FR-9). Read from the session's own
// setting file only, which only the server writes (FR-7). A setting for
// another workflow is the server not having caught up with a hop yet: it
// rides on the next pickup instead.
export function withSubagents(dir, out) {
  const setting = readSubagentSetting(dir);
  if (!setting) return [out, null];
  const workflow = (readJson(path.join(dir, "state.json")) || {}).workflow;
  if (setting.workflow !== workflow) return [out, null];
  const block = blockFor(setting, readSubagentCursor(dir));
  if (!block) return [out, null];
  const reply = [out.reply, ...block.lines].filter(Boolean).join("\n");
  return [{ ...out, reply }, block.cursor];
}

// After the print, like advanceWorkspace(): a kill in between repeats the
// block at the next pickup, never loses it.
export function advanceSubagents(dir, cursor) {
  if (!cursor) return;
  try {
    writeSubagentCursor(dir, cursor);
  } catch {}
}

// Print first, then this, exactly as consume() stamps a result: a kill in
// between can only hand the same chat over again, and collectChat() drops
// anything that already has a reply.
export function advanceCursor(dir, entries) {
  if (!entries.length) return;
  try {
    writeCursor(dir, Math.max(...entries.map((e) => e.seq)));
  } catch {}
  appendEvent(dir, { type: "chat-collect", count: entries.length });
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
  // What the agent reads is a trimmed view: `reply` (the card answers, any
  // Quick question and any Workspace or Subagents line), the `__` session
  // actions and the hop fields `reply` cannot carry. result.json keeps the
  // whole send; the link, chat and standing lines never go into it.
  const withChat = { reply: chat.length ? [result.reply, chatReplyLines(chat)].filter(Boolean).join("\n") : result.reply };
  const [withWs, changes] = withWorkspace(dir, withChat);
  const [out, subCursor] = withSubagents(dir, withWs);
  const hop = hopFor(path.basename(dir), result);
  const session = sessionActions(result);
  const seqs = chatSeqs(chat);
  // Read before markWorking() below: a __dashboard asks for the finish topic
  // or the stop topic by whether a finish is up as the person pressed it.
  const stateNow = readJson(path.join(dir, "state.json")) || {};
  const topics = pointersForSend(result, stateNow, owedFlags(changes, subCursor), chat);
  const due = duePointers(dir, topics);
  markPickedUp(result);
  printOut(dir, {
    ...(out.reply ? { reply: out.reply } : {}),
    ...(session ? { session } : {}),
    ...hop,
    ...handoffFor(result),
    ...(seqs.length ? { chat: seqs } : {}),
    ...(due.length ? { read: due } : {}),
    ...unansweredNote(dir, stateNow),
    ...lineIfChanged(dir, url),
  });
  rememberPointers(dir, topics);
  try {
    writeJsonAtomic(resultPath, collected);
  } catch {}
  markWorking(dir, result);
  appendEvent(dir, { type: "consume", kind: result.type });
  ledgerAnswers(dir, result);
  advanceCursor(dir, chat);
  advanceWorkspace(dir, changes);
  advanceSubagents(dir, subCursor);
  process.exitCode = result.type === "cancel" ? 30 : 0;
}

// A collected send is the agent's turn: the page says so at once, without the
// agent spending a whole post on "working" before it starts. The activity
// line belonged to the last stretch of work, so it goes; quietMinutes stays,
// since the page only counts it while working. Never fatal.
// The send is no longer waiting to be picked up either, so the phase the
// server set on it goes back to collecting (status and post report it).
function markWorking(dir, result) {
  if (!result) return;
  try {
    updateState(dir, (s) => {
      if (!s) return null;
      if (result.type !== "submit") return s.phase === "submitted" ? { ...s, phase: "collecting" } : null;
      // The cards this send carried, so `settle: true` settles what the agent
      // was handed and never a later send still waiting to be collected.
      const ids = [...new Set((result.actions || []).filter((a) => a && (a.type === "answer" || a.type === "skip") && typeof a.i === "string" && !a.i.startsWith("__")).map((a) => a.i))];
      return applyPatch({ ...s, phase: "collecting", collected: { at: result.consumedAt || nowIso(), ids } }, { agent: { status: "working", activity: null } });
    });
  } catch {}
}

// Waiting on an open question (or a finished screen's buttons) is the
// person's turn, whatever the last post said: an agent that replied to a note
// and went back to `wait` without restating its status left the page on
// "working" with nobody working. With nothing open it stays as it is: an
// agent waiting out its research subagents is still working. Only a change
// is written.
function markWaiting(dir) {
  try {
    updateState(dir, (s) => {
      if (!s || !s.agent || s.agent.status !== "working") return null;
      // The dashboard's menu and the git board are the page's own, and theirs
      // to click whenever the agent is waiting.
      const theirTurn =
        s.finish || s.workflow === "dashboard" || s.workflow === "git" || (s.items || []).some((i) => isOpen(i) && i.kind !== "notice");
      return theirTurn ? applyPatch(s, { agent: { status: "waiting" } }) : null;
    });
  } catch {}
}

// The session hops a send can ask for, each with the one command that makes
// it and the skill file to follow after, so the agent copies instead of
// assembling `open --resume …` from the action's fields.
const HOP_ACTIONS = {
  launch: (a) => ({ workflow: a.workflow, spec: a.spec, skill: a.skill }),
  dashboard: () => ({ workflow: "dashboard", skill: "plan2code" }),
  commit: () => ({ workflow: "git", skill: "plan2code-git" }),
  changelog: () => ({ workflow: "changelog", skill: "plan2code-changelog" }),
  pickup: pickupHop,
};

// A pick-up hops into the skill and spec the handoff's `.json` names (the page
// sends only the id). When the skill is no longer installed, the spec folder
// is gone, or the Handoff skill wrote it, Quick Task picks it up instead,
// flagged so the agent says so. In a
// source tree no skill sits beside the console, so nothing can be told to be
// missing and the stored skill stands.
function skillPath(skill) {
  return path.resolve(HERE, "..", "..", "..", skill, "SKILL.md");
}

function pickupHop(action) {
  const id = action.handoff;
  const meta = isHandoffId(id) ? readHandoffMeta(id) : null;
  const handoffFile = isHandoffId(id) ? path.join(handoffsDir(), id + ".md") : undefined;
  const quick = { workflow: "quick-task", spec: undefined, skill: "plan2code-quick-task", handoffFile, fallback: true };
  if (!meta) return quick;
  if (typeof meta.workflow !== "string" || !/^[a-z-]+$/.test(meta.workflow)) return quick;
  // The Handoff skill's own handoff: resuming it would only write another one.
  if (meta.workflow === "handoff") return quick;
  if (typeof meta.skill !== "string" || !/^[a-z0-9-]+$/.test(meta.skill)) return quick;
  const specGone =
    typeof meta.spec === "string" && meta.spec && (!SAFE_SPEC.test(meta.spec) || !fs.existsSync(path.join(meta.worktree || "", meta.spec)));
  const skillGone = !fs.existsSync(skillPath(meta.skill)) && fs.existsSync(skillPath("plan2code-quick-task"));
  if (specGone || skillGone) return quick;
  return { workflow: meta.workflow, spec: meta.spec || undefined, skill: meta.skill, handoffFile };
}

// A stop that asked for a handoff gets the Handoff skill's file beside it, so
// the agent opens it instead of locating it. Only a built skill has one.
function handoffFor(result) {
  const actions = (result && Array.isArray(result.actions) && result.actions) || [];
  if (!actions.some((a) => a && a.type === "stop" && a.i === "__stop" && a.handoff === true)) return {};
  const file = path.resolve(HERE, "..", "..", "..", "plan2code-handoff", "SKILL.md");
  return fs.existsSync(file) ? { handoffSkill: file } : {};
}

// A pick-up uses its handoff up as its hop is printed, so the next dashboard
// scan no longer lists it. Never fatal; a repeat delivery marks it again.
function markPickedUp(result) {
  const actions = (result && Array.isArray(result.actions) && result.actions) || [];
  for (const a of actions) {
    if (a && a.type === "pickup" && typeof a.i === "string" && a.i.startsWith("__") && isHandoffId(a.handoff)) {
      try {
        markHandoffUsed(a.handoff);
      } catch {}
    }
  }
}

// A spec name that is safe to put in the `resume` command: `specs/<name>` with
// nothing a shell would act on. A handoff's `.json` and a page's send are both
// data off disk or the wire, so the name is checked here and not trusted.
const SAFE_SPEC = /^specs\/[^/\\"'`$;&|<>(){}*?!#~\r\n]+$/;

// The send's `__` actions, whole, for the agent: the docs dispatch on them by
// `i`. A `type` that only repeats `i` ("__stop" and "stop") is left out. The
// card answers, comments and skips are already in `reply`.
export function sessionActions(result) {
  const actions = (result && Array.isArray(result.actions) && result.actions) || [];
  const kept = actions
    .filter((a) => a && typeof a.i === "string" && a.i.startsWith("__"))
    .map((a) => {
      if (a.type !== a.i.slice(2)) return a;
      const { type, ...rest } = a;
      return rest;
    });
  return kept.length ? kept : undefined;
}

function hopFor(sid, result) {
  const actions = (result && Array.isArray(result.actions) && result.actions) || [];
  const action = actions.find((a) => a && Object.hasOwn(HOP_ACTIONS, a.type) && typeof a.i === "string" && a.i.startsWith("__"));
  if (!action) return {};
  const { workflow, spec, skill, handoffFile, fallback } = HOP_ACTIONS[action.type](action);
  if (typeof workflow !== "string" || !/^[a-z-]+$/.test(workflow)) return {};
  const quote = (v) => (/[\s"]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);
  const specArg = typeof spec === "string" && SAFE_SPEC.test(spec) ? ` --spec ${quote(spec)}` : "";
  const out = { resume: `node "${path.join(HERE, "console.mjs")}" open --resume ${sid} --no-open --workflow ${workflow}${specArg}` };
  if (typeof skill === "string" && /^[a-z0-9-]+$/.test(skill)) {
    const file = skillPath(skill);
    if (fs.existsSync(file)) out.skillFile = file;
  }
  if (typeof handoffFile === "string") out.handoffFile = handoffFile;
  if (fallback) out.fallback = true;
  return out;
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

