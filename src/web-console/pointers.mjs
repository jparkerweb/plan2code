// Plan2Code Web Console - pointers: which topic file the console names, and when.
//
// The card (console.md) leaves a topic out and the console's own output names
// its file at the moment that topic is due: `read: [<absolute path>]`, once per
// session per topic, and again after a resume. What was printed lives in the
// session folder (pointers.json), never in state.json, which rides every frame
// to the page, and never on the page's stream.

import fs from "node:fs";
import path from "node:path";

import { HERE, readJson, writeJsonAtomic } from "./files.mjs";

const POINTERS_FILE = "pointers.json";

// Topic -> the file that explains it, beside console.mjs.
export const POINTER_FILES = {
  finish: "console-finish.md",
  stop: "console-stop.md",
  docs: "console-docs.md",
  chat: "console-chat.md",
  workspace: "console-workspace.md",
  subagents: "console-subagents.md",
  review: "building-review.md",
};

function printedTopics(dir) {
  const saved = readJson(path.join(dir, POINTERS_FILE), {});
  return saved && Array.isArray(saved.printed) ? saved.printed.filter((t) => typeof t === "string") : [];
}

/**
 * The absolute paths of the topic files in `topics` not yet printed in this
 * session, in the order given and each once. An unreadable or missing memory
 * reads as nothing printed yet.
 */
export function duePointers(dir, topics) {
  const done = new Set(printedTopics(dir));
  const out = [];
  for (const topic of new Set(topics || [])) {
    if (Object.hasOwn(POINTER_FILES, topic) && !done.has(topic)) out.push(path.join(HERE, POINTER_FILES[topic]));
  }
  return out;
}

/**
 * Record that these topics were printed. Called after the print, the order
 * advanceCursor() uses: a kill in between repeats a pointer, never loses one.
 * Never fatal.
 */
export function rememberPointers(dir, topics) {
  const known = (topics || []).filter((t) => Object.hasOwn(POINTER_FILES, t));
  if (!known.length) return;
  try {
    const printed = [...new Set([...printedTopics(dir), ...known])];
    writeJsonAtomic(path.join(dir, POINTERS_FILE), { printed });
  } catch {}
}

/** Forget what was printed (a resume starts the reading over). */
export function resetPointers(dir) {
  try {
    fs.rmSync(path.join(dir, POINTERS_FILE), { force: true });
  } catch {}
}

// The verdict a review card was answered with, wherever the action keeps it.
function verdictOf(action) {
  if (typeof action.verdict === "string" && action.verdict) return action.verdict;
  const answer = action.answer;
  return answer && typeof answer === "object" && typeof answer.verdict === "string" && answer.verdict ? answer.verdict : "";
}

/**
 * The topics a collected send makes due. Pure: no I/O.
 *
 * `result` is the send (result.json; an empty object for a chat-only pickup),
 * `state` the session state as read before the page is set back to working,
 * `changes` the standing-instruction flags from owedFlags(), and `chat` the
 * Quick question entries delivered with it.
 */
export function pointersForSend(result, state, changes, chat = []) {
  const topics = [];
  const actions = (result && Array.isArray(result.actions) && result.actions) || [];
  const items = (state && Array.isArray(state.items) && state.items) || [];
  for (const a of actions) {
    if (!a || typeof a !== "object") continue;
    if (a.i === "__commit") topics.push("finish");
    else if (a.i === "__dashboard") topics.push(state && state.finish ? "finish" : "stop");
    else if (a.i === "__stop") topics.push("stop");
    else if (a.i === "__review") topics.push("review");
    else if (a.type === "answer" && typeof a.i === "string" && !a.i.startsWith("__")) {
      const item = items.find((x) => x && x.id === a.i);
      if (item && item.kind === "review" && verdictOf(a)) topics.push("review");
    }
  }
  if ((chat || []).some((e) => e && e.kind === "message")) topics.push("chat");
  if (changes && changes.workspaceChanged) topics.push("workspace");
  if (changes && changes.subagentsChanged) topics.push("subagents");
  return [...new Set(topics)];
}
