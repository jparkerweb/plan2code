#!/usr/bin/env node
// Plays the person in a scripted console session, for the live runs (run.mjs).
//
//   node scripts/console-wire-runs/answer.mjs --session <sid> --home <console home> --project <dir> --log <answers.ndjson>
//
// It follows the page's state from the session's state.json and answers through
// the same HTTP routes the page uses, with the session's cookie. The script is
// fixed: pick Quick Task on the dashboard, answer its cards, ask one Quick
// question once a doc is up, press the finish's dashboard button, launch
// Pathfinder, answer one question turn, press Stop, and exit 0 once that stop's
// finish is up. Every send is logged with a timestamp.
//
// The idea box (`templates: "idea"`) gets the fixed text below rather than its
// placeholder: an agent writes that placeholder, and the runs have to build the
// same small thing to compare.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const QUICK_IDEA = "Add an optional second argument to greet: when it is { shout: true }, return the greeting in upper case. Add a test for it.";
const PATHFINDER_IDEA = "A command line wrapper for greet, so people can run it from a terminal and pipe names into it.";
const FALLBACK_TEXT = "Keep it as small as you can.";
const QUICK_QUESTION = "Which file will this change the most?";
const MAX_SENDS = 40;
const TICK_MS = 400;
// A question posted while the agent still says it is working: the page would
// show it as not the person's turn, so give the agent this long to hand over.
const WORKING_GRACE_MS = 60_000;
const CHAT_REPLY_WAIT_MS = 120_000;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) throw new Error(`unexpected ${argv[i]}`);
    opts[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of ["session", "home", "project", "log"]) {
    if (!opts[key]) throw new Error(`--${key} is required`);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
// Before the imports below: the console reads its home once, as it loads.
process.env.PLAN2CODE_CONSOLE_HOME = opts.home;
const consoleDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "web-console");
const load = (file) => import(new URL(`file:///${path.join(consoleDir, file).replace(/\\/g, "/")}`).href);
const { listHandles, repoRoots } = await load("sessions.mjs");
const { isOpen } = await load("patches.mjs");
const { currentConversation, readChat } = await load("inbox.mjs");
const { launchReply, DASHBOARD_REPLY, SKILL_CATALOG, STOP_REPLY, stopAction } = await load("public/answers.js");

const sessionDir = path.join(opts.home, "sessions", opts.session);
const project = repoRoots(opts.project).project;
let sends = 0;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(path.join(sessionDir, "state.json"), "utf8"));
  } catch {
    return null;
  }
}

function resultPending() {
  try {
    return !JSON.parse(fs.readFileSync(path.join(sessionDir, "result.json"), "utf8")).consumedAt;
  } catch {
    return false;
  }
}

function logSend(entry) {
  fs.appendFileSync(opts.log, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

async function request(route, body) {
  const handle = listHandles(project).find((h) => h.sid === opts.session);
  if (!handle || !handle.url) return { status: 0, body: {} };
  const url = new URL(handle.url);
  const token = url.pathname.split("/")[2];
  const res = await fetch(`${url.origin}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `p2c_console_${url.port}=${token}`, origin: url.origin, connection: "close" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// One send, as the page's Send button makes it. True once the server took it.
async function send(kind, actions, reply) {
  if (++sends > MAX_SENDS) throw new Error(`more than ${MAX_SENDS} sends: the script is stuck`);
  const res = await request("/submit", { actions, reply });
  if (res.status === 409) {
    sends--;
    return false;
  }
  if (res.status !== 200) throw new Error(`/submit said ${res.status}: ${JSON.stringify(res.body)}`);
  logSend({ kind, actions, reply });
  return true;
}

function catalogEntry(workflow) {
  const entry = SKILL_CATALOG.find((s) => s.workflow === workflow);
  if (!entry) throw new Error(`no ${workflow} card in the catalog`);
  return entry;
}

function launch(workflow) {
  const entry = catalogEntry(workflow);
  answered.clear();
  const action = { i: "__launch", type: "launch", skill: entry.skill, workflow: entry.workflow, title: entry.title };
  return send(`launch ${workflow}`, [action], launchReply(entry, null));
}

function textAnswer(item, idea) {
  if (item.templates === "idea") return idea;
  const hint = String(item.placeholder || "").replace(/^\s*(for example|e\.g\.|example)[:,]?\s*/i, "").trim();
  const shaped = (value) => !item.pattern || new RegExp(item.pattern).test(value);
  if (hint && shaped(hint)) return hint;
  return shaped(FALLBACK_TEXT) ? FALLBACK_TEXT : "wire-fixture-change";
}

// The answer a person following the fixed script gives one card, as the page
// would stage it, with the word the terminal flow would have received.
function answerFor(item, idea) {
  const options = Array.isArray(item.options) ? item.options : [];
  const pickOption = () => options.find((o) => o.recommended) || options[0];
  const tokenFor = (key) => (item.token && item.token[key]) || key;
  switch (item.kind) {
    case "choice":
    case "menu": {
      const option = pickOption();
      if (option) return { value: { k: option.k }, word: tokenFor(option.k) };
      return { value: { text: FALLBACK_TEXT }, word: FALLBACK_TEXT };
    }
    case "multi": {
      const option = pickOption();
      return { value: { ks: option ? [option.k] : [] }, word: option ? tokenFor(option.k) : "skip" };
    }
    case "text": {
      const text = textAnswer(item, idea);
      return { value: { text }, word: text };
    }
    case "confirm":
      return { value: { yes: true }, word: tokenFor("yes") };
    case "recap":
      return { value: { ok: true }, word: tokenFor("ok") };
    case "review": {
      const verdicts = Array.isArray(item.verdicts) && item.verdicts.length ? item.verdicts : [{ id: "approve" }];
      const verdict = verdicts.find((v) => !v.danger) || verdicts[0];
      return { value: { verdict: verdict.id }, word: tokenFor(verdict.id) };
    }
    case "checklist": {
      const steps = Array.isArray(item.steps) ? item.steps : [];
      return { value: { done: steps.map((_, n) => n), state: "done" }, word: "done" };
    }
    case "list":
      return { value: { text: "Looks right." }, word: "Looks right." };
    default:
      return null;
  }
}

// A card is due once, and again only if the agent reopens it with something new.
// Ids are only unique within a skill: a launch clears the page, and the next
// skill may use `q1` again, so launch() forgets them.
const answered = new Map();
const cardKey = (item) => `${item.status}:${Array.isArray(item.thread) ? item.thread.length : 0}`;

function dueCards(state) {
  return (state.items || []).filter((item) => isOpen(item) && item.kind !== "notice" && answered.get(item.id) !== cardKey(item));
}

let openSince = 0;
function theirTurn(state, cards) {
  if (!cards.length) {
    openSince = 0;
    return false;
  }
  if (!openSince) openSince = Date.now();
  return !state.agent || state.agent.status !== "working" || Date.now() - openSince > WORKING_GRACE_MS;
}

async function answerCards(cards, idea) {
  const actions = [];
  const lines = [];
  for (const item of cards) {
    const answer = answerFor(item, idea);
    if (!answer) continue;
    actions.push({ i: item.id, type: "answer", kind: item.kind, ...answer.value });
    lines.push(`${item.title}: ${answer.word}`);
  }
  if (!actions.length) return false;
  const taken = await send("answer", actions, lines.join("\n"));
  if (taken) {
    for (const item of cards) answered.set(item.id, cardKey(item));
    openSince = 0;
  }
  return taken;
}

let asked = null;
async function askQuickQuestion() {
  const conversation = currentConversation(readChat(sessionDir)).conversation;
  const res = await request("/chat", { text: QUICK_QUESTION, conversation });
  if (res.status !== 200) return;
  asked = { seq: res.body.seq, at: Date.now() };
  logSend({ kind: "chat", seq: res.body.seq, text: QUICK_QUESTION });
}

const chatStillOwed = (state) =>
  asked && !(state.chat?.replies || []).some((r) => r && r.re === asked.seq) && Date.now() - asked.at < CHAT_REPLY_WAIT_MS;

async function step(stage, state) {
  const workflow = state.workflow;
  const waiting = state.agent && state.agent.status === "waiting";
  const cards = dueCards(state);

  switch (stage) {
    case "launch-quick":
      if (workflow === "dashboard" && waiting && (await launch("quick-task"))) return "quick";
      return stage;

    case "quick":
      if (workflow !== "quick-task") return stage;
      if (state.finish) {
        const taken = await send("dashboard", [{ i: "__dashboard", type: "dashboard" }], DASHBOARD_REPLY);
        return taken ? "launch-pathfinder" : stage;
      }
      if (!asked && (state.docs || []).length && theirTurn(state, cards)) {
        await askQuickQuestion();
        return stage;
      }
      if (chatStillOwed(state)) return stage;
      if (theirTurn(state, cards)) await answerCards(cards, QUICK_IDEA);
      return stage;

    case "launch-pathfinder":
      if (workflow === "dashboard" && !state.finish && waiting && (await launch("pathfinder"))) return "pathfinder";
      return stage;

    case "pathfinder":
      if (workflow !== "pathfinder") return stage;
      if (theirTurn(state, cards) && (await answerCards(cards, PATHFINDER_IDEA))) return "pathfinder-after-turn";
      return stage;

    case "pathfinder-after-turn":
      if (theirTurn(state, cards) || (waiting && !cards.length)) {
        const taken = await send("stop", [stopAction()], STOP_REPLY);
        return taken ? "stopping" : stage;
      }
      return stage;

    case "stopping":
      return state.finish ? "done" : stage;

    default:
      throw new Error(`unknown stage ${stage}`);
  }
}

async function main() {
  let stage = "launch-quick";
  while (stage !== "done") {
    await new Promise((resolve) => setTimeout(resolve, TICK_MS));
    const state = readState();
    if (!state || resultPending()) continue;
    const next = await step(stage, state);
    if (next !== stage) logSend({ kind: "stage", stage: next });
    stage = next;
  }
}

main().catch((e) => {
  process.stderr.write(`answer: ${e.message}\n`);
  process.exitCode = 1;
});
