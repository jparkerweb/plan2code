#!/usr/bin/env node
// Count what the web console costs an agent, from Claude Code transcripts.
//
//   node scripts/measure-console-wire.mjs [folder] [--since D] [--until D] [--exclude ID]... [--out rows.ndjson]
//   node scripts/measure-console-wire.mjs --baseline [--reencode]
//   node scripts/measure-console-wire.mjs --runs <dir> [--reencode]
//
// The original research scripts (`research-01`, in a Pathfinder session's
// scratchpad) were outside this repository; this is their rebuild, following
// the method written down in
// specs/console-wire-format/pathfinder/questions/01-baseline-cost-today.md.
//
// Three buckets per session, each counted with `o200k_base` as a proxy (no
// Claude tokenizer runs offline; the same counter before and after is what
// matters):
//
//   patches  heredoc bodies of `post` and `open`, plus a `--file <path>` patch
//            when the same transcript wrote that path earlier (`--baseline`
//            leaves those out, since the recorded figures do)
//   outputs  the CLI's own JSON lines in `open`, `post`, `wait`, `chat` results
//   docs     standalone reads of the contract files, plus the non-JSON text of
//            a console result whose command also cats one of them
//
// A resumed or forked transcript repeats earlier entries, and the agent read
// those results only once, so each call counts once. The recorded baseline
// counted a repeated doc read every time it appeared (about 840k of its 3.98M
// doc tokens) and missed a read relative to a `cd` into the console folder, so
// `--baseline` does both, to compare like for like, and reports the repeats
// beside it as `repeatedDocTokens`. Every other mode counts each read once and
// counts the `cd` reads: those are the figures to trust.
//
// Known limits, the same in the before and the after run: a read the harness
// persisted to a file (over about 30 KB) counts only the preview it left in the
// transcript, and a doc read beside another file stays out of `docs`, as in the
// baseline. A live run reports those beside `docs` as `mixedDocTokens` (the whole
// file each names), so batching reads can never pass for reading less: compare
// `withMixed` as well as `total`.
//
// The rewrites (`reencode*`) are pure and exported for Phases 6 and 7. The
// tokenizer is loaded only when counting, so importing them costs nothing.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

/* ------------------------------------------------------------ the baseline */

export const RECORDED_BASELINE = {
  since: "2026-09-29",
  until: "2026-10-29",
  exclude: ["01bce17b"],
  sessions: 328,
  median: { patches: 2089, outputs: 3707, docs: 10326, total: 18726 },
  p90: { total: 39870 },
};
const BASELINE_TOLERANCE = 0.05;

/* --------------------------------------------------------- reading commands */

const CONSOLE_VERB = /console\.mjs["']?\s+(open|post|wait|chat|stop|help)\b/g;
const COUNTED_VERBS = new Set(["open", "post", "wait", "chat"]);
const SID = /\b(\d{8}-\d{6}-[0-9a-f]{4,})\b/;
const DOC_FILE = /(?:^|\/)(console\.md|console-[^/]+\.md|building[^/]*\.md|notes\/[^/]+\.md)$/;

// `NAME=value` assignments in the same command, so `node "$C" post` and
// `cat "$D/console.md"` read as what they run. Nothing else of a shell.
export function expandVars(command) {
  const vars = {};
  for (const m of command.matchAll(/(?:^|[\s;&])([A-Za-z_][A-Za-z0-9_]*)=("[^"\n]*"|'[^'\n]*'|[^\s;&]+)/g)) {
    vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  let out = command;
  for (let pass = 0; pass < 3; pass++) {
    out = out.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (whole, name) => (Object.hasOwn(vars, name) ? vars[name] : whole));
  }
  return out;
}

export function consoleVerbs(command) {
  return [...command.matchAll(CONSOLE_VERB)].map((m) => m[1]);
}

// Every heredoc in a command: the line that opens it, and its body.
export function heredocs(command) {
  const lines = command.split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(lines[i]);
    if (!m) continue;
    const end = lines.findIndex((l, n) => n > i && l.trim() === m[2]);
    if (end < 0) continue;
    found.push({ head: lines[i], body: lines.slice(i + 1, end).join("\n") });
    i = end;
  }
  return found;
}

// A command with its heredoc bodies taken out, so a `;` or a `cat` inside a
// patch never reads as shell.
function withoutHeredocs(command) {
  const lines = command.split("\n");
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    kept.push(lines[i]);
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(lines[i]);
    if (!m) continue;
    const end = lines.findIndex((l, n) => n > i && l.trim() === m[2]);
    if (end >= 0) i = end;
  }
  return kept.join("\n");
}

function normalizePath(p) {
  return String(p)
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\/([a-zA-Z])\//, "$1:/")
    .toLowerCase();
}

// One shell segment into words, honoring quotes.
function shellWords(segment) {
  const words = [];
  for (const m of segment.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)) {
    words.push(m[1] ?? m[2] ?? m[3]);
  }
  return words;
}

function shellSegments(command) {
  const segments = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      current += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      current += c;
    } else if (c === "\n" || c === ";" || (c === "&" && command[i + 1] === "&") || (c === "|" && command[i + 1] === "|")) {
      if (c !== "\n" && c !== ";") i++;
      segments.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  segments.push(current.trim());
  return segments.filter(Boolean);
}

// The contract file a path names, or null. A development checkout's copy under
// src/web-console/ is not the installed skill copy, and is skipped.
export function docNameOf(p, { insideConsoleDir = false } = {}) {
  const n = String(p).replace(/\\/g, "/");
  if (/(?:^|\/)src\/web-console\//.test(n)) return null;
  const m = DOC_FILE.exec(n);
  if (!m) return null;
  return insideConsoleDir || /(?:^|\/)web-console\//.test(n) ? m[1] : null;
}

// What a command reads: `docs` are the contract files it cats, and `only` says
// every `cat` and `sed -n` in it names contract files alone. Other verbs beside
// them (`ls`, `node`) do not change that, as in the baseline: only another file
// read beside a contract file makes a command mixed.
export function docReads(command, { cdReads = true } = {}) {
  const docs = [];
  let only = true;
  let insideConsoleDir = false;
  for (const segment of shellSegments(withoutHeredocs(command))) {
    // Output plumbing is not a file argument: `cat x.md | head -80`, `2>/dev/null`.
    const words = shellWords(segment.split(/\s\|\s/)[0]).filter((w) => !/^\d*>/.test(w));
    if (!words.length) continue;
    const [verb, ...rest] = words;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(verb) || verb === "echo" || verb === "printf") continue;
    if (verb === "cd") {
      insideConsoleDir = cdReads && /web-console\/?$/.test(String(rest[0] || "").replace(/\\/g, "/"));
      continue;
    }
    let files = null;
    if (verb === "cat") files = rest.filter((w) => !w.startsWith("-"));
    else if (verb === "sed" && rest[0] === "-n") files = rest.slice(2);
    if (!files) continue;
    const names = files.map((f) => docNameOf(f, { insideConsoleDir }));
    // A contract file read beside another file counts nowhere as standalone.
    if (!names.every(Boolean)) only = false;
    for (const name of names) if (name) docs.push(name);
  }
  return { docs, only: only && docs.length > 0 };
}

const HELP_TOPIC_FILES = new Set(["finish", "stop", "chat", "workspace", "subagents", "meter", "attachments", "trouble", "launches", "docs"]);
function helpTopicFile(topic) {
  if (topic === "building" || topic === "building-review") return `${topic}.md`;
  if (topic === "console") return "console.md";
  return HELP_TOPIC_FILES.has(topic) ? `console-${topic}.md` : `notes/${topic}.md`;
}

function stripLineNumbers(text) {
  return text.replace(/^[ \t]*\d+(?:→|\t)/gm, "");
}

function resultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => (c && c.type === "text" ? c.text : "")).join("\n");
  return "";
}

// The CLI's own JSON lines in a tool result, and everything else.
export function splitOutput(text) {
  const objects = [];
  const other = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("{") && t.endsWith("}")) {
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === "object") {
          objects.push({ raw: t, parsed });
          continue;
        }
      } catch {}
    }
    if (t && !/^Exit code \d+$/.test(t)) other.push(line);
  }
  return { objects, other: other.join("\n") };
}

export function postFailure(text) {
  if (/could not read --file|post needs --file/.test(text)) return "unreadable";
  if (/console: the payload was rejected/.test(text)) return "refused";
  if (/^Exit code 3\b/.test(text) && /^console: /m.test(text)) return "refused";
  return null;
}

/* -------------------------------------------------------- reading transcripts */

// Every tool call of one transcript, in order, with its result. A resumed or
// forked transcript repeats entries, so a call counts once by its id.
export async function readCalls(file) {
  const calls = new Map();
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"tool_use"') && !line.includes('"tool_result"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.isSidechain) continue;
    const content = entry.message && entry.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === "tool_use" && !calls.has(block.id)) {
        calls.set(block.id, { id: block.id, name: block.name, input: block.input || {}, at: entry.timestamp, result: null, resultCopies: 0 });
      } else if (block.type === "tool_result" && calls.has(block.tool_use_id)) {
        const call = calls.get(block.tool_use_id);
        call.resultCopies++;
        if (call.result === null) call.result = resultText(block.content);
      }
    }
  }
  return [...calls.values()];
}

export function isConsoleCall(call) {
  if (call.name !== "Bash" && call.name !== "PowerShell") return false;
  const command = String(call.input.command || "");
  return consoleVerbs(expandVars(command)).length > 0;
}

function stampOf(text) {
  const m = SID.exec(String(text || ""));
  return m ? m[1] : null;
}

function dayOf(sid) {
  return `${sid.slice(0, 4)}-${sid.slice(4, 6)}-${sid.slice(6, 8)}`;
}

/* --------------------------------------------------------------- the rewrites */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function reencodeItem(item) {
  if (!item || typeof item !== "object") return item;
  const out = { ...item };
  if (out.status === "open") delete out.status;
  if (out.required === true) delete out.required;
  if (out.allowOther === true) delete out.allowOther;
  if (Array.isArray(out.thread) && !out.thread.length) delete out.thread;
  if (Array.isArray(out.options)) {
    if (!out.options.length) delete out.options;
    else {
      out.options = out.options.map((opt, n) => {
        if (!opt || typeof opt !== "object" || opt.k !== LETTERS[n]) return opt;
        const { k, ...rest } = opt;
        return rest;
      });
    }
  }
  return out;
}

// A patch in the new shape: minified, with the console-filled defaults gone.
// Text that is not one JSON object stays as it is (it would be refused anyway).
export function reencodePatch(text) {
  let patch;
  try {
    patch = JSON.parse(text);
  } catch {
    return text;
  }
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return text;
  if (Array.isArray(patch.items)) patch = { ...patch, items: patch.items.map(reencodeItem) };
  return JSON.stringify(patch);
}

const WAIT_FIELDS = ["reply", "resume", "skillFile", "handoffFile", "handoffSkill", "fallback", "workspace", "subagents", "terminalLine"];
const WARNING_FIELDS = ["unansweredChat", "warning"];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

// `wait`, exit 0: what the person sent, the session actions and the hop fields.
export function reencodeWaitSend(obj) {
  const out = pick(obj, WAIT_FIELDS);
  const session = (Array.isArray(obj.actions) ? obj.actions : []).filter((a) => a && typeof a.i === "string" && a.i.startsWith("__"));
  if (session.length) out.session = session;
  if (Array.isArray(obj.chat) && obj.chat.length) out.chat = obj.chat.map((c) => (c && typeof c === "object" ? c.seq : c));
  return out;
}

// `wait`, exit 10.
export function reencodeWaitIdle(obj) {
  return { waiting: true, ...pick(obj, ["open", "terminalLine", ...WARNING_FIELDS]) };
}

// `post`, exit 0.
export function reencodePostAck(obj) {
  return pick(obj, ["ok", "open", "terminalLine", ...WARNING_FIELDS]);
}

function reencodeOutput(obj) {
  if (obj.status === "waiting") return reencodeWaitIdle(obj);
  if (obj.type === "submit" || obj.type === "chat" || obj.type === "cancel") return reencodeWaitSend(obj);
  if (obj.ok === true && typeof obj.items === "number") return reencodePostAck(obj);
  return obj;
}

// One session's outputs in order: terminalLine stays the first time and when it
// differs from the last one kept.
export function reencodeOutputs(objects) {
  let lastLine;
  let lastOpen;
  return objects.map((obj) => {
    // An old still-waiting line has no `open`; the new one prints it, and it is
    // the count the last post ack gave (checked against real runs in Phase 7).
    const out = { ...reencodeOutput(obj) };
    if (obj.ok === true && typeof obj.open === "number") lastOpen = obj.open;
    if (out.waiting === true && out.open === undefined && lastOpen !== undefined) out.open = lastOpen;
    if (out.terminalLine !== undefined) {
      if (out.terminalLine === lastLine) delete out.terminalLine;
      else lastLine = out.terminalLine;
    }
    return out;
  });
}

/* -------------------------------------------------------------- one session */

const POINTER_TOPICS = new Set(["console-finish.md", "console-stop.md", "console-docs.md", "console-chat.md", "console-workspace.md", "console-subagents.md", "building-review.md"]);

export function measureCalls(calls, { count, reencode = false, since, until, filePatches = true, repeatDocs = false, cdReads = true, docText = null } = {}) {
  const written = new Map();
  const row = {
    sid: null,
    commands: { open: 0, post: 0, wait: 0, chat: 0 },
    patches: 0,
    outputs: 0,
    docs: 0,
    total: 0,
    refused: 0,
    unreadable: 0,
    patchCount: 0,
    filePatches: 0,
    filePatchTokens: 0,
    repeatedDocTokens: 0,
    mixedDocTokens: 0,
    docReads: {},
    events: [],
  };
  const outputObjects = [];
  let currentSid = null;
  const inWindow = () => {
    if (!currentSid || (!since && !until)) return true;
    const day = dayOf(currentSid);
    return (!since || day >= since) && (!until || day <= until);
  };
  // One standalone doc result: once, or every time the transcript repeats it.
  const addStandaloneDoc = (call, text) => {
    const tokens = count(text);
    const repeated = tokens * Math.max(0, (call.resultCopies || 1) - 1);
    row.docs += tokens + (repeatDocs ? repeated : 0);
    row.repeatedDocTokens += repeated;
  };
  const noteRead = (name) => {
    row.docReads[name] = (row.docReads[name] || 0) + 1;
    row.events.push({ kind: "read", name });
  };

  for (const call of calls) {
    if (call.name === "Write" && call.input.file_path) {
      written.set(normalizePath(call.input.file_path), String(call.input.content ?? ""));
      continue;
    }
    if (call.name === "Read") {
      const name = docNameOf(call.input.file_path || "");
      if (name && call.result !== null && inWindow()) {
        addStandaloneDoc(call, stripLineNumbers(call.result));
        noteRead(name);
      }
      continue;
    }
    if (call.name !== "Bash" && call.name !== "PowerShell") continue;

    const raw = String(call.input.command || "");
    const command = expandVars(raw);
    const here = heredocs(raw);
    for (const h of here) {
      const target = /\b(?:cat|tee)\s*(?:>+\s*)?("[^"]+"|'[^']+'|\S+)/.exec(expandVars(h.head));
      if (target && />|\btee\b/.test(h.head) && !/console\.mjs/.test(h.head)) written.set(normalizePath(target[1]), h.body);
    }
    const verbs = consoleVerbs(command);
    const text = call.result ?? "";

    if (!verbs.length) {
      const reads = docReads(command, { cdReads });
      if (reads.only && call.result !== null && inWindow()) {
        addStandaloneDoc(call, text);
        for (const name of reads.docs) noteRead(name);
      } else if (call.result !== null && inWindow()) {
        for (const name of reads.docs) {
          noteRead(name);
          if (docText) row.mixedDocTokens += count(docText(name));
        }
      }
      continue;
    }

    const stamp = stampOf(command) || stampOf(text);
    if (stamp) {
      currentSid = stamp;
      if (!row.sid) row.sid = stamp;
    }
    if (!inWindow()) continue;

    for (const verb of verbs) if (COUNTED_VERBS.has(verb)) row.commands[verb]++;

    // A hop (`--no-open`, as every `resume` a send carries has) clears the page,
    // finish and all; a resume after a dead server keeps it.
    if (/console\.mjs["']?\s+open\b[^\n]*--resume\b[^\n]*--no-open\b/.test(command)) row.events.push({ kind: "hop" });

    let posted = raw;
    if (verbs.includes("post") || verbs.includes("open")) {
      for (const h of here) {
        if (!/console\.mjs["']?\s+(post|open)\b/.test(expandVars(h.head))) continue;
        row.patches += count(reencode ? reencodePatch(h.body) : h.body);
        row.patchCount++;
      }
      const file = /--file\s+("[^"]+"|'[^']+'|\S+)/.exec(withoutHeredocs(command));
      if (file && file[1] !== "-") {
        const body = written.get(normalizePath(file[1]));
        if (body !== undefined) {
          posted += body;
          const tokens = count(reencode ? reencodePatch(body) : body);
          row.filePatchTokens += tokens;
          row.filePatches++;
          if (filePatches) {
            row.patches += tokens;
            row.patchCount++;
          }
        }
      }
    }

    if (verbs.includes("post")) {
      const failure = postFailure(text);
      if (failure === "refused") row.refused++;
      if (failure === "unreadable") row.unreadable++;
      row.events.push({ kind: "post", at: call.at, failure, finish: /"finish"\s*:\s*\{/.test(posted), clearsFinish: /"finish"\s*:\s*null/.test(posted) });
    }
    if (verbs.includes("stop")) row.events.push({ kind: "stop", at: call.at });
    if (verbs.includes("help")) {
      const topic = /console\.mjs["']?\s+help\s+([a-z-]+)/.exec(command);
      if (topic && call.result !== null) {
        row.docs += count(text);
        noteRead(helpTopicFile(topic[1]));
      }
    }

    if (verbs.some((v) => COUNTED_VERBS.has(v)) && call.result !== null) {
      const { objects, other } = splitOutput(text);
      for (const { parsed } of objects) {
        outputObjects.push(parsed);
        const pointer = typeof parsed.read === "string" ? parsed.read : null;
        if (pointer) row.events.push({ kind: "pointer", name: pointer.replace(/^.*[\\/]/, "") });
      }
      const reads = docReads(command, { cdReads });
      if (reads.docs.length) {
        row.docs += count(other);
        for (const name of reads.docs) noteRead(name);
      }
    }
  }

  const final = reencode ? reencodeOutputs(outputObjects) : outputObjects;
  for (const obj of final) row.outputs += count(JSON.stringify(obj));
  row.total = row.patches + row.outputs + row.docs;
  row.withMixed = row.total + row.mixedDocTokens;
  return row;
}

/* ------------------------------------------------------------------ the sums */

// The baseline's own definition, so the figures compare.
export function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const PARTS = ["patches", "outputs", "docs", "total", "withMixed"];

export function summarize(rows) {
  const summary = { sessions: rows.length, median: {}, p90: {}, totals: {} };
  for (const part of PARTS) {
    const values = rows.map((r) => r[part]);
    summary.median[part] = quantile(values, 0.5);
    summary.p90[part] = quantile(values, 0.9);
    summary.totals[part] = values.reduce((a, b) => a + b, 0);
  }
  summary.commands = rows.reduce((sum, r) => sum + Object.values(r.commands).reduce((a, b) => a + b, 0), 0);
  summary.refused = rows.reduce((sum, r) => sum + r.refused, 0);
  summary.unreadable = rows.reduce((sum, r) => sum + r.unreadable, 0);
  summary.repeatedDocTokens = rows.reduce((sum, r) => sum + r.repeatedDocTokens, 0);
  summary.filePatchTokens = rows.reduce((sum, r) => sum + r.filePatchTokens, 0);
  return summary;
}

async function loadCounter() {
  const { encode } = await import("gpt-tokenizer/encoding/o200k_base");
  const cache = new Map();
  return (text) => {
    if (!text) return 0;
    let n = cache.get(text);
    if (n === undefined) {
      // Transcripts may quote a special token; it counts as plain text here.
      n = encode(text, { disallowedSpecial: new Set() }).length;
      cache.set(text, n);
    }
    return n;
  };
}

function mainTranscripts(root) {
  const files = [];
  for (const project of fs.readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const dir = path.join(root, project.name);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

export async function measureFolder(root, { since, until, exclude = [], reencode = false, filePatches = true, repeatDocs = false, cdReads = true, count }) {
  const rows = [];
  for (const file of mainTranscripts(root)) {
    const id = path.basename(file, ".jsonl");
    if (exclude.some((e) => id.startsWith(e))) continue;
    const calls = await readCalls(file);
    if (!calls.some(isConsoleCall)) continue;
    const row = measureCalls(calls, { count, reencode, since, until, filePatches, repeatDocs, cdReads });
    if (!row.sid) continue;
    if (!Object.values(row.commands).some(Boolean)) continue;
    delete row.events;
    rows.push({ id, project: path.basename(path.dirname(file)), ...row });
  }
  return rows;
}

// Each recorded figure beside what this run found.
export function compareBaseline(summary, recorded = RECORDED_BASELINE) {
  const pairs = [
    ["sessions", recorded.sessions, summary.sessions],
    ["median patches", recorded.median.patches, summary.median.patches],
    ["median outputs", recorded.median.outputs, summary.median.outputs],
    ["median docs", recorded.median.docs, summary.median.docs],
    ["median total", recorded.median.total, summary.median.total],
    ["p90 total", recorded.p90.total, summary.p90.total],
  ];
  const checks = pairs.map(([name, was, now]) => {
    const gap = (now - was) / was;
    return { name, recorded: was, reproduced: now, gapPercent: Math.round(gap * 1000) / 10, pass: Math.abs(gap) <= BASELINE_TOLERANCE };
  });
  return { pass: checks.every((c) => c.pass), differs: checks.filter((c) => !c.pass).map((c) => c.name), checks };
}

/* --------------------------------------------------------------- the live runs */

// Assistant messages in a stream-json log, grouped by message id, since one
// message arrives as several events.
export function streamMessages(text) {
  const byId = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type !== "assistant" || !event.message || event.parent_tool_use_id) continue;
    const key = event.message.id || `line-${byId.size}`;
    const blocks = Array.isArray(event.message.content) ? event.message.content : [];
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(...blocks);
  }
  return [...byId.values()];
}

// Text-only assistant messages while a session is open: a turn that ended
// without a wait, stranding the person's next click.
export function endedOnText(messages) {
  let open = false;
  let slips = 0;
  for (const blocks of messages) {
    const uses = blocks.filter((b) => b.type === "tool_use");
    if (!uses.length) {
      if (open && blocks.some((b) => b.type === "text" && b.text && b.text.trim())) slips++;
      continue;
    }
    for (const use of uses) {
      const verbs = consoleVerbs(expandVars(String((use.input && use.input.command) || "")));
      if (verbs.includes("open")) open = true;
      if (verbs.includes("stop")) open = false;
    }
  }
  return slips;
}

// What the events of one session say went wrong without anyone being told.
export function eventSlips(events) {
  const slips = { stopWithoutFinish: 0, topicBeforePointer: 0, pointerNeverRead: 0 };
  let finished = false;
  const pointed = new Set();
  const readAfter = new Set();
  const anyPointer = events.some((e) => e.kind === "pointer");
  for (const e of events) {
    if (e.kind === "hop" || (e.kind === "post" && !e.failure && e.clearsFinish)) finished = false;
    if (e.kind === "post" && !e.failure && e.finish) finished = true;
    if (e.kind === "stop" && !finished) slips.stopWithoutFinish++;
    if (e.kind === "pointer") pointed.add(e.name);
    if (e.kind === "read" && POINTER_TOPICS.has(e.name)) {
      if (anyPointer && !pointed.has(e.name)) slips.topicBeforePointer++;
      if (pointed.has(e.name)) readAfter.add(e.name);
    }
  }
  for (const name of pointed) if (!readAfter.has(name)) slips.pointerNeverRead++;
  return slips;
}

export function firstRetries(events) {
  const posts = events.filter((e) => e.kind === "post");
  let failures = 0;
  let success = 0;
  posts.forEach((post, n) => {
    if (!post.failure) return;
    failures++;
    if (posts[n + 1] && !posts[n + 1].failure) success++;
  });
  return { failures, success };
}

// Seconds from each send to the agent's next post. Information only.
export function turnTimes(sends, events) {
  const posts = events.filter((e) => e.kind === "post" && e.at).map((e) => Date.parse(e.at));
  const times = [];
  for (const send of sends) {
    // answer.mjs logs its own stage changes beside the sends.
    if (send.kind === "stage") continue;
    const at = Date.parse(send.at);
    const next = posts.find((p) => p > at);
    if (next !== undefined) times.push((next - at) / 1000);
  }
  return times;
}

function readLines(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

export async function measureRuns(dir, { reencode = false, count }) {
  const rows = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(dir, entry.name);
    const run = JSON.parse(readLines(path.join(runDir, "run.json")) || "null");
    if (!run) continue;
    // A nudged run has several transcripts, and a resume repeats earlier calls.
    const byId = new Map();
    for (const file of run.transcripts || []) {
      if (!fs.existsSync(file)) continue;
      for (const call of await readCalls(file)) if (!byId.has(call.id)) byId.set(call.id, call);
    }
    const calls = [...byId.values()];
    // The run's own copy of the contract files, as it read them.
    const consoleDir = path.join(run.project || "", ".claude", "skills", "plan2code", "references", "web-console");
    const docText = (name) => readLines(path.join(consoleDir, ...name.split("/")));
    const row = measureCalls(calls, { count, reencode, docText });
    const events = row.events;
    delete row.events;
    const sends = readLines(path.join(runDir, "answers.ndjson"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const slips = eventSlips(events);
    slips.endedOnText = endedOnText(streamMessages(readLines(path.join(runDir, "stream.ndjson"))));
    rows.push({
      id: entry.name,
      model: run.model,
      run: run.run,
      finished: Boolean(run.finished),
      ...row,
      firstRetry: firstRetries(events),
      slips,
      turnSeconds: turnTimes(sends, events),
    });
  }
  return rows;
}

export function summarizeRuns(rows) {
  const byModel = {};
  for (const model of [...new Set(rows.map((r) => r.model))]) {
    // An unfinished run is a harness bug to fix and rerun, never a figure.
    const all = rows.filter((r) => r.model === model);
    const group = all.filter((r) => r.finished);
    const summary = summarize(group);
    const docReads = {};
    const slips = { stopWithoutFinish: 0, endedOnText: 0, topicBeforePointer: 0, pointerNeverRead: 0 };
    const firstRetry = { failures: 0, success: 0 };
    const seconds = [];
    for (const r of group) {
      for (const [name, n] of Object.entries(r.docReads)) docReads[name] = (docReads[name] || 0) + n;
      for (const k of Object.keys(slips)) slips[k] += r.slips[k] || 0;
      firstRetry.failures += r.firstRetry.failures;
      firstRetry.success += r.firstRetry.success;
      seconds.push(...r.turnSeconds);
    }
    byModel[model] = {
      ...summary,
      runs: all.length,
      finished: group.length,
      firstRetry,
      slips,
      docReads,
      turnSeconds: { median: quantile(seconds, 0.5), p90: quantile(seconds, 0.9) },
    };
  }
  return { runs: rows.length, byModel };
}

/* ---------------------------------------------------------------- the command */

function parseArgs(argv) {
  const opts = { exclude: [], positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--baseline" || a === "--reencode") opts[a.slice(2)] = true;
    else if (a === "--since" || a === "--until" || a === "--out" || a === "--runs") opts[a.slice(2)] = argv[++i];
    else if (a === "--exclude") opts.exclude.push(argv[++i]);
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

function writeRows(file, rows) {
  if (file) fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const count = await loadCounter();
  const { reencode = false } = opts;

  if (opts.runs) {
    const rows = await measureRuns(opts.runs, { reencode, count });
    writeRows(opts.out, rows);
    console.log(JSON.stringify({ reencode, ...summarizeRuns(rows) }));
    return;
  }

  const root = opts.positional[0] || path.join(os.homedir(), ".claude", "projects");
  // The recorded method, whatever its slips (see the header), so the check
  // compares like for like.
  const window = opts.baseline
    ? { since: RECORDED_BASELINE.since, until: RECORDED_BASELINE.until, exclude: RECORDED_BASELINE.exclude, filePatches: false, repeatDocs: true, cdReads: false }
    : { since: opts.since, until: opts.until, exclude: opts.exclude };
  const rows = await measureFolder(root, { ...window, reencode, count });
  writeRows(opts.out, rows);
  const summary = { reencode, ...window, ...summarize(rows) };

  if (opts.baseline && !reencode) {
    const baseline = compareBaseline(summary);
    for (const c of baseline.checks) {
      process.stderr.write(`${c.pass ? "ok  " : "GAP "} ${c.name}: recorded ${c.recorded}, reproduced ${c.reproduced} (${c.gapPercent}%)\n`);
    }
    console.log(JSON.stringify({ ...summary, baseline }));
    if (!baseline.pass) process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    process.stderr.write(`measure-console-wire: ${e.message}\n`);
    process.exitCode = 1;
  });
}
