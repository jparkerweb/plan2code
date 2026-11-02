// Plan2Code Web Console - the Quick question chat's inbox beside the card slot.

import path from "node:path";

import { CHAT_LIMIT } from "./public/chat.js";
import { appendJsonLine, nowIso, readJson, readJsonLines, writeJsonAtomic } from "./files.mjs";
import { isPlainObject, proseProblems, rule } from "./patches.mjs";

/* ------------------------------------------------------- the chat inbox */

// The Quick question chat rides its own channel beside the card slot, so the
// two never contend: a chat message never waits on an uncollected card send,
// and a card send never waits on chat. Every file has exactly one writer:
//
//   chat.ndjson       the server. One JSON line per entry: message / decision / reset.
//   chat-cursor.json  console.mjs. The last seq the agent was handed.
//   state.json        console.mjs `post`. The agent's replies, under chat.replies.
//                     (state.json as a whole has a second writer, the server's
//                     /submit, so every change to it goes through updateState().)
//
// The Workspace and the session meter follow the same rule, in files that
// switchWorkflow() never touches, so they carry across dashboard hops:
//
//   workspace.json         the server. Folders, version, change log, missing, remote.
//   ledger.ndjson          console.mjs. Append-only meter events and folder issues.
//   workspace-cursor.json  console.mjs. The last workspace version handed to the agent.
//   subagents-setting.json the server. The Subagents switch for this session, with its revision.
//   subagents-cursor.json  console.mjs. The last Subagents revision and state handed to the agent.
export const CHAT_FILE = "chat.ndjson";
export const CHAT_CURSOR_FILE = "chat-cursor.json";

/**
 * The inbox's entries with `seq > afterSeq`. A final segment with no newline
 * is a line still being written: it is left for the next read, never parsed
 * half-way. A line that will not parse is skipped rather than thrown on.
 */
export function readChat(dir, afterSeq = 0) {
  return readJsonLines(path.join(dir, CHAT_FILE)).filter((e) => Number.isInteger(e.seq) && e.seq > afterSeq);
}

// Single-writer rule: only the server may call this (server.mjs and its routes).
export function appendChat(dir, entry) {
  const last = readChat(dir).reduce((max, e) => Math.max(max, e.seq), 0);
  return appendJsonLine(path.join(dir, CHAT_FILE), { ...entry, seq: last + 1, at: nowIso() });
}

export function readCursor(dir) {
  const saved = readJson(path.join(dir, CHAT_CURSOR_FILE), { seq: 0 });
  const n = Number(saved && saved.seq);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Never backwards: a slow collector finishing after a faster one must not
// hand the faster one's entries over again.
export function writeCursor(dir, seq) {
  writeJsonAtomic(path.join(dir, CHAT_CURSOR_FILE), { seq: Math.max(readCursor(dir), seq) });
}

// The conversation the inbox is on: the one its last reset opened.
export function currentConversation(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "reset") return { conversation: e.conversation, workflow: e.workflow || "", sinceSeq: e.seq };
  }
  return { conversation: 0, workflow: "", sinceSeq: 0 };
}

// Typed messages only: Approve / Decline and resets never count to the limit.
export function typedCount(entries, conversation) {
  return entries.filter((e) => e.kind === "message" && e.conversation === conversation).length;
}

/**
 * The chat block of a page frame: the current conversation's person entries
 * from the inbox and the agent's replies from the state, as one list. A reply
 * sits straight after the entry it answers; one naming nothing here goes last.
 */
export function chatForFrame(entries, state) {
  const { conversation } = currentConversation(entries);
  const person = entries
    .filter((e) => (e.kind === "message" || e.kind === "decision") && e.conversation === conversation)
    .sort((a, b) => a.seq - b.seq);
  const replies = (state?.chat?.replies || []).filter((r) => r && r.conversation === conversation);
  const messages = [];
  const placed = new Set();
  for (const p of person) {
    messages.push({ from: "person", ...p });
    replies.forEach((r, i) => {
      if (r.re !== p.seq) return;
      messages.push({ from: "agent", ...r });
      placed.add(i);
    });
  }
  replies.forEach((r, i) => placed.has(i) || messages.push({ from: "agent", ...r }));
  return { conversation, messages, typed: typedCount(entries, conversation), limit: CHAT_LIMIT };
}

/**
 * What the agent has not been handed yet: entries past the cursor, minus any
 * message or decision that already has a reply. The second half is what keeps
 * a lost cursor from ever causing a second answer. Resets always go through.
 */
export function collectChat(dir, state) {
  const replied = new Set((state?.chat?.replies || []).map((r) => r && r.re));
  return readChat(dir, readCursor(dir)).filter((e) => e.kind === "reset" || !replied.has(e.seq));
}

// What is worth handing over: the collected entries once one of them is
// something the person said. A reset alone (every session opens with one)
// waits and rides along with the next message, or `wait` would return on the
// opening line of every session and every first card reply would carry it.
// A run of resets (the session's opening one, then one per skill switch)
// says one thing, so only the last of each run is handed over; it carries the
// highest seq of the run, so the cursor still moves past all of them.
export function deliverableChat(entries) {
  if (!entries.some((e) => e.kind !== "reset")) return [];
  return entries.filter((e, i) => !(e.kind === "reset" && entries[i + 1] && entries[i + 1].kind === "reset"));
}

// Things the person said that were handed over but never answered. The page keeps
// showing "working on the answer" for each until a reply lands, so the agent is
// told on every post and every wait slice until it has replied (a refusal is a reply).
export function unansweredChat(dir, state) {
  const { conversation } = currentConversation(readChat(dir, 0));
  const replied = new Set((state?.chat?.replies || []).map((r) => r && r.re));
  const cursor = readCursor(dir);
  return readChat(dir, 0)
    .filter((e) => (e.kind === "message" || e.kind === "decision") && e.conversation === conversation)
    .filter((e) => e.seq <= cursor && !replied.has(e.seq))
    .map((e) => e.seq);
}

// How many things the person said are still waiting to be collected.
export function pendingChatCount(dir, state) {
  return collectChat(dir, state).filter((e) => e.kind !== "reset").length;
}

// The chat entries as the lines appended to `reply`, in the note's shape.
// Whatever the person typed is indented past its first line, so only a real
// entry ever starts a line: a typed "Approved: edit p1" must not read as one.
export function chatReplyLines(entries) {
  const indent = (s, pad) => String(s).replace(/\r?\n/g, "\n" + pad);
  const lines = [];
  for (const e of entries) {
    if (e.kind === "message") {
      lines.push(`Quick question (${e.seq}): ${indent(e.text, "  ")}`);
      if (e.about && e.about.label) lines.push(`  About: ${indent(e.about.label, "    ")}`);
      for (const img of e.images || []) lines.push(`  Image: ${img.path} (${img.name})`);
      for (const f of e.files || []) lines.push(`  File: ${f.path} (${f.name})`);
    } else if (e.kind === "decision") {
      lines.push(`${e.decision === "approve" ? "Approved" : "Declined"} (${e.seq}): edit ${e.re}`);
      if (e.text) lines.push(`  Note: ${indent(e.text, "    ")}`);
    } else if (e.kind === "reset") {
      lines.push("New conversation started. Treat earlier chat as closed.");
    }
  }
  return lines.join("\n");
}

// A project-relative path: no root, no drive letter, no step outside.
function projectRelative(p) {
  if (typeof p !== "string" || !p.trim()) return false;
  if (/^[\\/]/.test(p) || /^[A-Za-z]:/.test(p)) return false;
  return !p.split(/[\\/]/).includes("..");
}

function underSpec(file, specDir) {
  const norm = (s) => {
    const t = s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    return process.platform === "win32" ? t.toLowerCase() : t;
  };
  const f = norm(file);
  const spec = norm(specDir);
  return Boolean(spec) && (f === spec || f.startsWith(spec + "/"));
}

/**
 * The house rules for the agent's chat replies, checked against the inbox
 * they answer. Same shape as validate(): problems as sentences, [] when fine.
 */
export function validateChat(state, entries) {
  const replies = state?.chat?.replies;
  if (replies == null) return [];
  const right = { chat: { replies: [{ re: 12, md: "..." }] } };
  if (!Array.isArray(replies)) return [rule("", "chat.replies", "must be an array", right)];
  const problems = [];
  const targets = new Set(
    entries.filter((e) => e.kind === "message" || e.kind === "decision").map((e) => e.seq)
  );
  const ids = new Set();
  for (const r of replies) {
    if (!isPlainObject(r)) {
      problems.push(rule("", "chat.replies", "every reply must be an object", right));
      continue;
    }
    const name = typeof r.id === "string" && r.id.trim() ? r.id : "(no id)";
    const at = `chat reply "${name}"`;
    if (name === "(no id)") problems.push(rule(at, "id", 'needs a non-empty string "id" (or "re", which names it)', right));
    else if (ids.has(r.id)) problems.push(rule(at, "id", "is used twice", right));
    ids.add(r.id);
    if (!Number.isInteger(r.re) || !targets.has(r.re)) {
      problems.push(rule(at, "re", "needs the seq of the message or decision it answers", right));
    }
    if (!Number.isInteger(r.conversation)) problems.push(rule(at, "conversation", "needs an integer", right));
    if (typeof r.md !== "string" || !r.md.trim()) problems.push(rule(at, "md", "needs the answer", right));

    const p = r.proposal;
    if (p != null) {
      const proposalRight = { chat: { replies: [{ re: 12, md: "...", proposal: { summary: "Rename the helper", files: ["src/util.mjs"] } }] } };
      if (!isPlainObject(p)) problems.push(rule(at, "proposal", "must be an object", proposalRight));
      else {
        if (typeof p.summary !== "string" || !p.summary.trim()) {
          problems.push(rule(at, "proposal.summary", "needs a plain-English summary", proposalRight));
        }
        if (!Array.isArray(p.files) || !p.files.length) {
          problems.push(rule(at, "proposal.files", "needs the project files it would change", proposalRight));
        } else {
          for (const f of p.files) {
            if (!projectRelative(f)) {
              problems.push(rule(at, "proposal.files", `"${f}" must be a project-relative path`, proposalRight));
            } else if (state.specDir && underSpec(f, state.specDir)) {
              problems.push(rule(at, "proposal.files", `a chat edit cannot touch the running skill's own files under ${state.specDir}/`, proposalRight));
            }
          }
        }
      }
    }

    if (r.changed != null) {
      const count = (n) => Number.isInteger(n) && n >= 0;
      if (!Array.isArray(r.changed) || !r.changed.every((c) => isPlainObject(c) && typeof c.file === "string" && count(c.added) && count(c.removed))) {
        problems.push(rule(at, "changed", "must be a list of { file, added, removed }", { changed: [{ file: "src/util.mjs", added: 3, removed: 1 }] }));
      }
    }

    problems.push(...proseProblems(String(r.md ?? ""), `${at} md`));
    if (isPlainObject(p) && typeof p.summary === "string") problems.push(...proseProblems(p.summary, `${at} proposal.summary`));
  }

  return problems;
}
