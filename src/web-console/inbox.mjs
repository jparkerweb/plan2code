// Plan2Code Web Console - the Quick question chat's inbox beside the card slot.

import path from "node:path";

import { CHAT_LIMIT } from "./public/chat.js";
import { appendJsonLine, nowIso, readJson, readJsonLines, writeJsonAtomic } from "./files.mjs";
import { isPlainObject, proseProblems } from "./patches.mjs";

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
      lines.push(`Quick question: ${indent(e.text, "  ")}`);
      if (e.about && e.about.label) lines.push(`  About: ${indent(e.about.label, "    ")}`);
      for (const img of e.images || []) lines.push(`  Image: ${img.path} (${img.name})`);
      for (const f of e.files || []) lines.push(`  File: ${f.path} (${f.name})`);
    } else if (e.kind === "decision") {
      lines.push(`${e.decision === "approve" ? "Approved" : "Declined"}: edit ${e.re}`);
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
  if (!Array.isArray(replies)) return ['"chat.replies" must be an array'];
  const problems = [];
  const targets = new Set(
    entries.filter((e) => e.kind === "message" || e.kind === "decision").map((e) => e.seq)
  );
  const ids = new Set();
  for (const r of replies) {
    if (!isPlainObject(r)) {
      problems.push("every chat reply must be an object");
      continue;
    }
    const name = typeof r.id === "string" && r.id.trim() ? r.id : "(no id)";
    if (name === "(no id)") problems.push('every chat reply needs a non-empty string "id"');
    else if (ids.has(r.id)) problems.push(`duplicate chat reply id "${r.id}"`);
    ids.add(r.id);
    if (!Number.isInteger(r.re) || !targets.has(r.re)) {
      problems.push(`chat reply "${name}" needs "re": the seq of the message or decision it answers`);
    }
    if (!Number.isInteger(r.conversation)) problems.push(`chat reply "${name}" needs an integer "conversation"`);
    if (typeof r.md !== "string" || !r.md.trim()) problems.push(`chat reply "${name}" needs its answer in "md"`);

    const p = r.proposal;
    if (p != null) {
      if (!isPlainObject(p)) problems.push(`chat reply "${name}" "proposal" must be an object`);
      else {
        if (typeof p.summary !== "string" || !p.summary.trim()) {
          problems.push(`chat reply "${name}" proposal needs a plain-English "summary"`);
        }
        if (!Array.isArray(p.files) || !p.files.length) {
          problems.push(`chat reply "${name}" proposal needs "files": the project files it would change`);
        } else {
          for (const f of p.files) {
            if (!projectRelative(f)) {
              problems.push(`chat reply "${name}" proposal file "${f}" must be a project-relative path`);
            } else if (state.specDir && underSpec(f, state.specDir)) {
              problems.push(`a chat edit cannot touch the running skill's own files under ${state.specDir}/`);
            }
          }
        }
      }
    }

    if (r.changed != null) {
      const count = (n) => Number.isInteger(n) && n >= 0;
      if (!Array.isArray(r.changed) || !r.changed.every((c) => isPlainObject(c) && typeof c.file === "string" && count(c.added) && count(c.removed))) {
        problems.push(`chat reply "${name}" "changed" must be a list of { file, added, removed }`);
      }
    }
  }

  const prose = JSON.stringify(replies.map((r) => [r && r.md, r && r.proposal && r.proposal.summary]));
  problems.push(...proseProblems(prose, "a chat reply"));
  return problems;
}
