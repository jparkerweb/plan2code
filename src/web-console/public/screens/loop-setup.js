// Plan2Code Web Console - the Implementation Loop's setup screen, drawn by the page from the console's saved setup and the app's facts; defines only.
//
// The dashboard's loop card opens this in place of the cards. Nothing here
// runs an agent: Start saves the setup through POST /loop-setup, then asks the
// desktop app (`loop-start { spec }`), which reads the setup itself and
// confirms in its own window. The quick check is typed text the page never
// runs or sends to the app.

import { el } from "../render.js";
import { hooks, page, redraw } from "../state.js";
import { SKILL_CATALOG } from "../answers.js";
import { postJson } from "../net.js";
import { tellApp, wireLoopMessages } from "../app-bridge.js";

const LEVELS = [
  ["critical", "Critical"],
  ["warning", "Warning"],
  ["suggestion", "Suggestion"],
];

const ON_QUESTION = [
  ["guess", "Take the agent's best guess", "The agent picks the likeliest answer and records the assumption."],
  ["pause", "Pause and wait for me", "The loop holds and calls you; nothing is lost while you are away."],
  ["stop", "Stop the loop", "The loop ends at that phase and tells you what it asked."],
];

const AFTER_LAST = [
  ["offer-finalize", "Stop and offer Finalize", "You press Finalize when you have looked it over."],
  ["run-finalize", "Run Finalize automatically", "Finalize starts by itself once every phase is built."],
];

const DEFAULT_NOTIFY_PARAM = "message";
// What the setup can send a notification to. `name` is the label for the field
// the person names, on the kinds that have one.
const NOTIFY_KINDS = [
  { id: "query", label: "A web address, with the message in its query string", placeholder: "https://example.com/hook", hint: "The app calls this address with a GET.", name: "Query string name for the message" },
  { id: "discord", label: "Discord webhook", placeholder: "https://discord.com/api/webhooks/...", hint: "In Discord: Edit Channel, Integrations, Webhooks, then Copy Webhook URL." },
  { id: "slack", label: "Slack webhook", placeholder: "https://hooks.slack.com/services/...", hint: "An Incoming Webhook URL from your Slack app's settings." },
  { id: "teams", label: "Microsoft Teams webhook", placeholder: "https://...", hint: 'In Teams: Workflows, the template "Post to a channel when a webhook request is received", then copy its URL.' },
  { id: "google-chat", label: "Google Chat webhook", placeholder: "https://chat.googleapis.com/v1/spaces/...", hint: "In the space: Apps & integrations, Webhooks, then copy the URL." },
  { id: "json", label: "A web address, with the message in a JSON body", placeholder: "https://example.com/hook", hint: "The app sends a POST with a JSON object holding the message, for any other service.", name: "JSON field name for the message" },
];
const SMART_DETAIL = "A fresh agent reads the review's findings and fixes the ones worth fixing. A skipped Critical stops the phase.";

/** Called by the page's start-up: hear the app's answers to the loop's requests. */
export function wireLoopSetup() {
  wireLoopMessages(page, redraw);
}

/**
 * Open the setup screen for `spec` (the picker's selected spec object). The
 * saved setup and the read-only facts come from the console; the agent, model
 * and permission facts come from the app.
 */
export async function openLoopSetup(spec) {
  if (!spec || !spec.dir || page.gone || page.pendingResult || page.local.launching) return;
  const dir = spec.dir;
  page.loopStart = null;
  page.loopNotifyTest = null;
  page.loopSetup = { spec: dir, loaded: false, failed: false, form: null, facts: null, problems: [], starting: false };
  tellApp("loop-facts");
  redraw();
  const mine = page.loopSetup;
  let res;
  try {
    res = await fetch("/loop-setup?spec=" + encodeURIComponent(dir), { cache: "no-store" });
  } catch {
    res = null;
  }
  if (page.loopSetup !== mine) return;
  if (!res || !res.ok) {
    mine.failed = true;
    redraw();
    return;
  }
  const answer = await res.json().catch(() => null);
  if (page.loopSetup !== mine) return;
  if (!answer) {
    mine.failed = true;
    redraw();
    return;
  }
  const { phasesLeft, branch, pending, suggestedQuickCheck, remembered, saved, ...setup } = answer;
  mine.form = {
    review: setup.review !== false,
    fixMode: setup.fixMode === "levels" ? "levels" : "smart",
    fix: Array.isArray(setup.fix) ? [...setup.fix] : LEVELS.map(([k]) => k),
    commit: setup.commit !== false,
    onQuestion: setup.onQuestion || "guess",
    afterLast: setup.afterLast || "offer-finalize",
    quickCheck: typeof setup.quickCheck === "string" ? setup.quickCheck : "",
    retryOnce: setup.retryOnce !== false,
    silenceMinutes: Number.isInteger(setup.silenceMinutes) ? setup.silenceMinutes : 20,
    notifyKind: NOTIFY_KINDS.some((k) => k.id === setup.notifyKind) ? setup.notifyKind : "query",
    notifyUrl: typeof setup.notifyUrl === "string" ? setup.notifyUrl : "",
    notifyParam: setup.notifyParam || DEFAULT_NOTIFY_PARAM,
  };
  // A first visit with nothing typed starts from the project's own check.
  if (!remembered && !mine.form.quickCheck && suggestedQuickCheck) mine.form.quickCheck = suggestedQuickCheck;
  mine.facts = {
    phasesLeft: Array.isArray(phasesLeft) ? phasesLeft : [],
    branch: typeof branch === "string" ? branch : "",
    pending: Number.isInteger(pending) ? pending : null,
  };
  mine.loaded = true;
  redraw();
}

function close() {
  page.loopSetup = null;
  page.loopStart = null;
  redraw();
}

/**
 * Why Start is grayed, or "" when it can go (FR-5), in the spec's order.
 * Exported for the page's unit tests.
 */
export function startBlock(form, facts, appFacts) {
  if (!form || !facts) return "Loading the setup...";
  if (form.commit && facts.pending !== null && facts.pending > 0) {
    return `Commit each phase needs a clean tree: ${facts.pending} uncommitted ${facts.pending === 1 ? "change" : "changes"}.`;
  }
  if (!appFacts) return "Asking the app...";
  if (appFacts.permissionMode === "checked") return "The loop needs permission checks off. Start a New Session with checks off first.";
  if (appFacts.promptSupport === false) return "This agent cannot be started with a first prompt.";
  if (!facts.phasesLeft.length) return "Nothing left to build in this spec.";
  return "";
}

/**
 * What is wrong with the web address fields as typed, or "". The server checks
 * again on save; this is the line that shows while typing.
 */
export function notifyProblem(url, param, kind = "query") {
  const address = url.trim();
  if (!address) return "";
  if (!/^https?:\/\//i.test(address)) return "The web address must start with http:// or https://.";
  let good = /^https?:\/\/[^/?#@]+([/?#][!-~]*)?$/i.test(address) && !/[^!-~]/.test(address);
  if (good) {
    try {
      good = Boolean(new URL(address).hostname);
    } catch {
      good = false;
    }
  }
  if (!good) return "That is not a web address the app can call. Leave out any user name or password, and percent-encode spaces and accents.";
  const named = NOTIFY_KINDS.some((k) => k.id === kind && k.name);
  if (named && !/^[A-Za-z0-9._~-]{1,64}$/.test(param.trim() || DEFAULT_NOTIFY_PARAM)) return "The name can only use letters, digits, and - _ . ~";
  return "";
}

/**
 * The chat service a pasted address belongs to, or "". A webhook needs a POST:
 * a GET to a Discord webhook answers 200 and posts nothing, so staying on the
 * query string kind would look like it worked.
 */
export function kindForUrl(url) {
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return "";
  }
  const host = parsed.hostname.toLowerCase();
  const under = (domain) => host === domain || host.endsWith(`.${domain}`);
  if ((under("discord.com") || under("discordapp.com")) && parsed.pathname.startsWith("/api/webhooks/")) return "discord";
  if (host === "hooks.slack.com") return "slack";
  if (host === "chat.googleapis.com") return "google-chat";
  if (under("logic.azure.com") || under("powerplatform.com") || under("powerautomate.com")) return "teams";
  return "";
}

function field(label, hint) {
  const box = el("div", "loop-field");
  box.appendChild(el("p", "loop-label", label));
  if (hint) box.appendChild(el("p", "loop-hint", hint));
  return box;
}

function toggle(id, text, checked, onChange) {
  const label = el("label", "loop-switch");
  const input = el("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  label.append(input, el("span", null, text));
  return label;
}

function radios(name, options, current, onChange) {
  const group = el("div", "loop-radios");
  group.setAttribute("role", "radiogroup");
  for (const [value, text, detail] of options) {
    const label = el("label", "loop-radio");
    const input = el("input");
    input.type = "radio";
    input.name = name;
    input.id = `loop-${name}-${value}`;
    input.checked = current === value;
    input.addEventListener("change", () => input.checked && onChange(value));
    const body = el("span", "loop-radio-body");
    body.appendChild(el("span", "loop-radio-text", text));
    if (detail) body.appendChild(el("span", "loop-radio-detail", detail));
    label.append(input, body);
    group.appendChild(label);
  }
  return group;
}

function factRow(list, label, value) {
  const row = el("div", "loop-fact");
  row.appendChild(el("dt", null, label));
  row.appendChild(el("dd", null, value));
  list.appendChild(row);
}

function agentLine(facts, doing) {
  if (!facts) return "Asking the app...";
  const bits = [facts.agentLabel || facts.agent || "the app's agent"];
  bits.push(facts.model ? `model ${facts.model}` : "default model");
  bits.push(facts.effort ? `effort ${facts.effort}` : "default effort");
  return `${bits.join(", ")} (the app's launch choice, for ${doing})`;
}

export function renderLoopSetup(main) {
  const s = page.loopSetup;
  const pane = el("div", "dash-confirm loop-setup");
  pane.appendChild(el("p", "card-kicker", "Step 3 · Implementation Loop"));
  pane.appendChild(el("h2", "dash-title", "Set up the loop"));
  const specLine = el("p", "confirm-spec");
  specLine.append(el("span", null, "for "), el("code", null, s.spec));
  pane.appendChild(specLine);

  if (s.failed) {
    pane.appendChild(el("p", "loop-error", "The setup could not be read. Go back and try again."));
  } else if (!s.loaded) {
    const wait = el("p", "dash-working");
    wait.append(el("span", "spinner tiny"), el("span", null, "Loading the setup..."));
    pane.appendChild(wait);
  } else {
    drawBody(pane, s);
  }

  const actions = el("div", "confirm-actions");
  const back = el("button", "btn ghost", "Back");
  back.type = "button";
  back.addEventListener("click", close);
  actions.appendChild(back);
  const help = el("button", "linky loop-help", "How the loop works");
  help.type = "button";
  help.addEventListener("click", () => hooks.openHelpOn("loop"));
  actions.appendChild(help);
  pane.appendChild(actions);
  main.appendChild(pane);
}

function drawBody(pane, s) {
  const f = s.form;
  const redo = () => {
    s.problems = [];
    redraw();
  };

  // What the app will do, in three plain lines (FR-3).
  const lines = el("div", "loop-lines");
  for (const text of [
    "The app builds each remaining phase in a fresh agent session, one after another, while you are away.",
    "After each phase it checks the work, marks it done and, if you chose, commits it to this branch. It never pushes.",
    "You can watch, play an Activity or stop it at any time from the banner at the top of the window.",
  ]) {
    lines.appendChild(el("p", "loop-line", text));
  }
  pane.appendChild(lines);

  // The read-only facts (FR-3).
  const facts = el("dl", "loop-facts");
  const left = s.facts.phasesLeft;
  factRow(facts, "Phases left", left.length ? left.map((p) => `Phase ${p.n}: ${p.name}`).join("\n") : "None");
  factRow(facts, "Building", agentLine(page.loopFacts, "building"));
  factRow(facts, "Reviewing", f.review ? agentLine(page.loopFacts, "reviewing") : "Review is off");
  factRow(facts, "Branch", s.facts.branch || "unknown");
  factRow(facts, "Uncommitted changes", s.facts.pending === null ? "unknown" : String(s.facts.pending));
  pane.appendChild(facts);

  // The fields (FR-2, FR-4).
  const form = el("div", "loop-form");

  const review = field("Review");
  review.appendChild(toggle("loop-review", "Review each phase with a fresh agent before it counts", f.review, (v) => ((f.review = v), redo())));
  form.appendChild(review);

  if (f.review) {
    const fix = field("Fix findings");
    fix.appendChild(
      radios(
        "fixmode",
        [
          ["smart", "Smart pick", SMART_DETAIL],
          ["levels", "By level", "The agent fixes every finding at the levels you tick."],
        ],
        f.fixMode,
        (v) => ((f.fixMode = v), redo())
      )
    );
    if (f.fixMode === "levels") {
      const row = el("div", "loop-ticks");
      for (const [key, text] of LEVELS) {
        row.appendChild(
          toggle(`loop-fix-${key}`, text, f.fix.includes(key), (on) => {
            f.fix = LEVELS.map(([k]) => k).filter((k) => (k === key ? on : f.fix.includes(k)));
            redo();
          })
        );
      }
      fix.appendChild(row);
    }
    form.appendChild(fix);
  }

  const ask = field("When a phase asks something");
  ask.appendChild(radios("onquestion", ON_QUESTION, f.onQuestion, (v) => ((f.onQuestion = v), redo())));
  form.appendChild(ask);

  const after = field("After the last phase");
  after.appendChild(radios("afterlast", AFTER_LAST, f.afterLast, (v) => ((f.afterLast = v), redo())));
  form.appendChild(after);

  const notify = field(
    "Send a notification",
    "When the loop waits on your answer or ends, except when you stop it yourself, the app sends a short message saying which. Leave the address empty to send nothing."
  );
  const kindLabel = el("label", "loop-number");
  kindLabel.appendChild(el("span", null, "Send to"));
  const kindSelect = el("select", "loop-text");
  kindSelect.id = "loop-notify-kind";
  for (const kind of NOTIFY_KINDS) {
    const option = el("option", null, kind.label);
    option.value = kind.id;
    kindSelect.appendChild(option);
  }
  kindSelect.value = f.notifyKind;
  kindLabel.appendChild(kindSelect);
  const kindHint = el("p", "loop-hint");
  const notifyInput = el("input", "loop-text");
  notifyInput.type = "text";
  notifyInput.inputMode = "url";
  notifyInput.id = "loop-notify-url";
  notifyInput.value = f.notifyUrl;
  notifyInput.maxLength = 2000;
  notifyInput.setAttribute("aria-label", "Web address to call");
  const paramRow = el("div");
  const paramLabel = el("label", "loop-number");
  const paramText = el("span");
  paramLabel.appendChild(paramText);
  const paramInput = el("input", "loop-text loop-param");
  paramInput.type = "text";
  paramInput.id = "loop-notify-param";
  paramInput.value = f.notifyParam;
  paramInput.placeholder = DEFAULT_NOTIFY_PARAM;
  paramInput.maxLength = 64;
  paramLabel.appendChild(paramInput);
  paramRow.appendChild(paramLabel);
  const notifyWarn = el("p", "loop-warn");
  const testRow = el("div", "loop-test");
  const testButton = el("button", "btn", "Send a test");
  testButton.type = "button";
  testButton.id = "loop-notify-test";
  testButton.addEventListener("click", () => sendTest(s));
  testRow.appendChild(testButton);
  const testLine = notifyTestLine();
  if (testLine) testRow.appendChild(testLine);
  const showNotify = () => {
    const kind = NOTIFY_KINDS.find((k) => k.id === f.notifyKind);
    kindSelect.value = kind.id;
    kindHint.textContent = kind.hint;
    notifyInput.placeholder = kind.placeholder;
    paramText.textContent = kind.name || "";
    paramRow.hidden = !kind.name || f.notifyUrl.trim() === "";
    const problem = notifyProblem(f.notifyUrl, f.notifyParam, kind.id);
    notifyWarn.textContent = problem;
    notifyWarn.hidden = !problem;
    testButton.disabled = Boolean(problem) || f.notifyUrl.trim() === "" || Boolean(page.loopNotifyTest && page.loopNotifyTest.waiting) || s.starting;
  };
  // What a test said was about the address as it was.
  const forgetTest = () => {
    if (page.loopNotifyTest && !page.loopNotifyTest.waiting) {
      page.loopNotifyTest = null;
      testRow.querySelector("p")?.remove();
    }
  };
  notifyInput.addEventListener("input", () => {
    f.notifyUrl = notifyInput.value;
    forgetTest();
    // A pasted webhook picks its own kind, unless the person chose one here.
    const service = kindForUrl(f.notifyUrl);
    if (service && f.notifyKind === "query" && !s.notifyKindChosen) f.notifyKind = service;
    showNotify();
  });
  kindSelect.addEventListener("change", () => {
    f.notifyKind = kindSelect.value;
    forgetTest();
    s.notifyKindChosen = true;
    showNotify();
  });
  paramInput.addEventListener("input", () => {
    f.notifyParam = paramInput.value;
    forgetTest();
    showNotify();
  });
  showNotify();
  notify.append(kindLabel, notifyInput, kindHint, paramRow, notifyWarn, testRow);
  form.appendChild(notify);

  const check = field("Quick check", "A command the app runs after each phase, such as npm run build. The page never runs it.");
  const checkInput = el("input", "loop-text");
  checkInput.type = "text";
  checkInput.id = "loop-quickcheck";
  checkInput.value = f.quickCheck;
  checkInput.placeholder = "npm run build";
  checkInput.maxLength = 500;
  checkInput.setAttribute("aria-label", "Quick check command");
  const checkWarn = el("p", "loop-warn", "No check runs after each phase.");
  checkWarn.hidden = f.quickCheck.trim() !== "";
  checkInput.addEventListener("input", () => {
    f.quickCheck = checkInput.value.replace(/[\r\n]+/g, " ");
    checkWarn.hidden = f.quickCheck.trim() !== "";
  });
  check.append(checkInput, checkWarn);
  form.appendChild(check);

  const retry = field("If a phase crashes or goes quiet");
  retry.appendChild(toggle("loop-retry", "Retry it once", f.retryOnce, (v) => ((f.retryOnce = v), redo())));
  const silence = el("label", "loop-number");
  silence.appendChild(el("span", null, "Count the agent as stuck after this many minutes with no activity"));
  const silenceInput = el("input", "loop-text loop-narrow");
  silenceInput.type = "number";
  silenceInput.id = "loop-silence";
  silenceInput.min = "1";
  silenceInput.max = "60";
  silenceInput.step = "1";
  silenceInput.value = String(f.silenceMinutes);
  silenceInput.addEventListener("input", () => {
    f.silenceMinutes = Number(silenceInput.value);
  });
  silence.appendChild(silenceInput);
  retry.appendChild(silence);
  retry.appendChild(el("p", "loop-hint", "No activity means no file changes, in the project or the agent's session, so allow for your slowest build or test run. Waiting on your answer does not count."));
  form.appendChild(retry);

  const commit = field("Commit");
  commit.appendChild(toggle("loop-commit", "Commit each phase to the current branch", f.commit, (v) => ((f.commit = v), redo())));
  form.appendChild(commit);

  pane.appendChild(form);

  // Start and the one line saying why it is grayed (FR-5).
  const block = startBlock(f, s.facts, page.loopFacts);
  const gated = Boolean(block);
  const foot = el("div", "loop-start");
  if (gated) {
    const why = el("p", "loop-why", block);
    why.setAttribute("role", "status");
    foot.appendChild(why);
    if (f.commit && s.facts.pending > 0) foot.appendChild(gitButton());
  }
  if (s.problems.length) {
    const bad = el("ul", "loop-problems");
    for (const p of s.problems) bad.appendChild(el("li", null, p));
    foot.appendChild(bad);
  }
  const waiting = s.starting && !page.loopStart;
  if (waiting) foot.appendChild(el("p", "loop-why", "Waiting for the app's confirm..."));
  if (page.loopStart && !page.loopStart.ok) foot.appendChild(el("p", "loop-error", page.loopStart.error));
  if (page.loopStart && page.loopStart.ok) foot.appendChild(el("p", "loop-why", "The loop is starting..."));
  const start = el("button", "btn primary", "Start the loop");
  start.type = "button";
  start.id = "loop-start";
  start.disabled = gated || waiting || page.gone || page.pendingResult || Boolean(page.loopStart && page.loopStart.ok);
  start.addEventListener("click", () => startLoop(s));
  foot.appendChild(start);
  pane.appendChild(foot);
}

/** The line beside Send a test, or null with nothing to say. */
function notifyTestLine() {
  const test = page.loopNotifyTest;
  if (!test) return null;
  if (test.waiting) return el("p", "loop-why", "Waiting for the app's confirm...");
  if (!test.ok) return el("p", "loop-error", test.error);
  if (test.sent) return el("p", "loop-why", "Sent, and the address answered OK. Check that the message arrived.");
  return null;
}

function gitButton() {
  const b = el("button", "btn", "Open the Git board");
  b.type = "button";
  b.addEventListener("click", () => {
    const entry = SKILL_CATALOG.find((e) => e.skill === "plan2code-git");
    if (entry) hooks.launchSkill(entry);
  });
  return b;
}

/** The form as the console saves it. */
function setupBody(f) {
  return { ...f, quickCheck: f.quickCheck.trim(), notifyUrl: f.notifyUrl.trim(), notifyParam: f.notifyParam.trim() || DEFAULT_NOTIFY_PARAM };
}

/**
 * Send a test: save, so the app can read what is on screen, then ask it. The
 * message names nothing: the app takes the address from the saved setup and
 * confirms it in its own dialog, as it does for Start.
 */
async function sendTest(s) {
  const f = s.form;
  if (!f.notifyUrl.trim() || notifyProblem(f.notifyUrl, f.notifyParam, f.notifyKind) || (page.loopNotifyTest && page.loopNotifyTest.waiting)) return;
  s.problems = [];
  page.loopNotifyTest = { waiting: true };
  redraw();
  const { status, body: answer } = await postJson("/loop-setup", setupBody(f));
  if (page.loopSetup !== s) return;
  if (status !== 200 || !answer || answer.ok !== true) {
    page.loopNotifyTest = null;
    s.problems = Array.isArray(answer && answer.problems) && answer.problems.length ? answer.problems : ["The setup could not be saved. Try again."];
    redraw();
    return;
  }
  tellApp("loop-notify-test");
}

async function startLoop(s) {
  const f = s.form;
  if (startBlock(f, s.facts, page.loopFacts) || (s.starting && !page.loopStart)) return;
  s.problems = [];
  page.loopStart = null;
  s.starting = true;
  redraw();
  const { status, body: answer } = await postJson("/loop-setup", setupBody(f));
  if (page.loopSetup !== s) return;
  if (status !== 200 || !answer || answer.ok !== true) {
    s.starting = false;
    s.problems = Array.isArray(answer && answer.problems) && answer.problems.length ? answer.problems : ["The setup could not be saved. Try again."];
    redraw();
    return;
  }
  tellApp("loop-start", { spec: s.spec });
  redraw();
}
