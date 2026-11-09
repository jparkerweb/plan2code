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

const STRENGTH_WORDS = [
  ["thrifty", "Thrifty"],
  ["balanced", "Balanced"],
  ["best", "Best"],
];
const MATCH_SESSION = "Match my session";

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
  page.loopSetup = { spec: dir, loaded: false, failed: false, form: null, facts: null, problems: [], starting: false, resolvedFor: undefined };
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
  const { phasesLeft, branch, pending, suggestedQuickCheck, remembered, saved, picks, resolved, ...setup } = answer;
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
    notifyPhases: setup.notifyPhases === true,
    phaseStrength: setup.phaseStrength === true,
    // Every spec's picks, as saved; only this spec's key is changed here.
    strengths: setup.strengths && typeof setup.strengths === "object" && !Array.isArray(setup.strengths) ? structuredClone(setup.strengths) : {},
  };
  if (Array.isArray(picks)) mine.form.strengths[dir] = structuredClone(picks);
  // A first visit with nothing typed starts from the project's own check.
  if (!remembered && !mine.form.quickCheck && suggestedQuickCheck) mine.form.quickCheck = suggestedQuickCheck;
  mine.facts = {
    spec: dir,
    phasesLeft: Array.isArray(phasesLeft) ? phasesLeft : [],
    branch: typeof branch === "string" ? branch : "",
    pending: Number.isInteger(pending) ? pending : null,
    // The loop agent's strengths: undefined until the app has named the agent
    // and the console has answered, then null (no such agent) or { word: { model, effort? } }.
    resolved: undefined,
  };
  mine.loaded = true;
  redraw();
}

const loopAgent = () => (page.loopFacts && typeof page.loopFacts.agent === "string" ? page.loopFacts.agent : "");

/**
 * Read the loop agent's strengths once the app has said which agent it is. The
 * setup and the app answer in either order, so every draw asks (cheaply) whether
 * the agent changed since the last read.
 */
function ensureResolved(s) {
  if (!page.loopFacts || s.resolvedFor === loopAgent()) return;
  const agent = loopAgent();
  s.resolvedFor = agent;
  if (!agent) {
    s.facts.resolved = null;
    return;
  }
  fetch("/loop-setup?spec=" + encodeURIComponent(s.spec) + "&agent=" + encodeURIComponent(agent), { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((answer) => {
      if (page.loopSetup !== s || s.resolvedFor !== agent) return;
      s.facts.resolved = answer && answer.resolved && typeof answer.resolved === "object" ? answer.resolved : null;
      redraw();
    });
}

const hasMapping = (resolved) => Boolean(resolved) && Object.keys(resolved).length > 0;

/** This spec's saved word for a phase, or "" for Match my session. */
function pickOf(form, spec, phase) {
  const list = form.strengths && form.strengths[spec];
  const hit = Array.isArray(list) ? list.find((p) => p.n === phase.n && p.name === phase.name) : null;
  return hit ? hit.strength : "";
}

function setPick(form, spec, phase, word) {
  const rest = (form.strengths[spec] || []).filter((p) => p.n !== phase.n);
  if (word) rest.push({ n: phase.n, name: phase.name, strength: word });
  rest.sort((a, b) => a.n - b.n);
  form.strengths[spec] = rest;
}

/** The phases left whose saved pick is not mapped for the loop's agent. */
function unmappedPicks(form, facts, spec) {
  const resolved = facts.resolved;
  return facts.phasesLeft.filter((p) => {
    const word = pickOf(form, spec, p);
    return word && !(resolved && resolved[word]);
  });
}

/** "sonnet, low": what a pick becomes. Match my session shows the launch choice. */
export function pickModelText(resolved, word, appFacts) {
  if (!word) {
    if (!appFacts) return "";
    return [appFacts.model || "default model", appFacts.effort].filter(Boolean).join(", ");
  }
  const row = resolved && resolved[word];
  return row ? [row.model, row.effort].filter(Boolean).join(", ") : "";
}

function close() {
  stopWatchingLine();
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
  // A saved pick the agent no longer maps holds Start until it is changed (FR-14).
  // An agent with nothing mapped grays the section instead, and its picks do not count.
  if (form.phaseStrength && facts.resolved === undefined) return "Asking the app...";
  if (form.phaseStrength && hasMapping(facts.resolved)) {
    const bad = unmappedPicks(form, facts, facts.spec);
    if (bad.length) return `Pick a new strength for ${bad.map((p) => `Phase ${p.n}`).join(", ")}: not mapped for this agent.`;
  }
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

/** A plain select: [value, text, disabled?] options, the chosen value, a change handler. */
function select(id, label, options, value, onChange) {
  const box = el("select", "loop-select");
  box.id = id;
  box.setAttribute("aria-label", label);
  for (const [v, text, disabled] of options) {
    const o = el("option", null, text);
    o.value = v;
    o.disabled = Boolean(disabled);
    box.appendChild(o);
  }
  box.value = value;
  box.addEventListener("change", () => onChange(box.value));
  return box;
}

/**
 * The rising-bar badge of the Subagents tab for a strength level: bars up to
 * `level` (1 to 3) are on. Level 0 (Match my session) has no rank, so it draws
 * three flat bars with the middle one lighter. `text` adds the name after the bars.
 */
export function strengthBadge(level, text) {
  const chip = el("span", `sa-badge lvl-${level}`);
  chip.appendChild(strengthBars(level));
  if (text) chip.appendChild(document.createTextNode(text));
  return chip;
}

function strengthBars(level) {
  const bars = el("span", level ? "sa-bars" : "sa-bars is-flat");
  bars.setAttribute("aria-hidden", "true");
  for (let i = 1; i <= 3; i++) bars.appendChild(el("i", level && i <= level ? "on" : null));
  return bars;
}

const SVG_NS = "http://www.w3.org/2000/svg";
let lineGrid = null;
let lineWatching = false;
// The grid can change width with no window resize (Preferences' page width): watch the grid itself too.
const lineObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => redrawLine()) : null;

function svgPart(name, attrs) {
  const part = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) part.setAttribute(k, String(v));
  return part;
}

/**
 * Draw the strength line into the grid's SVG from where the checked nodes sit:
 * a dashed column line per strength, then a square-step path from each row's
 * picked node to the next. Derived from the DOM on every call, so it cannot
 * disagree with the radios.
 */
export function drawStrengthLine(grid) {
  const svg = grid && grid.querySelector(".loop-strength-line");
  if (!svg) return;
  svg.replaceChildren();
  const gr = grid.getBoundingClientRect();
  const nodes = [...grid.querySelectorAll(".loop-strength-row input:checked + .loop-strength-node")];
  if (nodes.length < 2 || !gr.width) return;
  svg.setAttribute("viewBox", `0 0 ${gr.width} ${gr.height}`);
  const pts = nodes.map((n) => {
    const b = n.getBoundingClientRect();
    return { x: b.left - gr.left + b.width / 2, y: b.top - gr.top + b.height / 2 };
  });
  const top = grid.querySelector(".loop-strength-row").getBoundingClientRect().top - gr.top;
  grid.querySelectorAll(".loop-strength-head .loop-strength-chip").forEach((chip, k) => {
    const b = chip.getBoundingClientRect();
    const x = b.left - gr.left + b.width / 2;
    svg.appendChild(svgPart("line", { class: `col lvl-${k}`, x1: x, x2: x, y1: top, y2: gr.height }));
  });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const p = pts[i];
    // The run across sits at the top of the next node's cell, so it stays clear of a phase name above the cells.
    const m = nodes[i].parentElement.getBoundingClientRect().top - gr.top;
    let d = `M${a.x} ${a.y}V${p.y}`;
    if (a.x !== p.x) {
      const r = Math.min(8, Math.abs(p.x - a.x) / 2);
      const dir = p.x > a.x ? 1 : -1;
      d = `M${a.x} ${a.y}V${m - r}Q${a.x} ${m} ${a.x + dir * r} ${m}H${p.x - dir * r}Q${p.x} ${m} ${p.x} ${m + r}V${p.y}`;
    }
    svg.appendChild(svgPart("path", { class: "step", d }));
  }
}

function redrawLine() {
  if (lineGrid && lineGrid.isConnected) drawStrengthLine(lineGrid);
  else stopWatchingLine();
}

function stopWatchingLine() {
  lineGrid = null;
  if (lineWatching) window.removeEventListener("resize", redrawLine);
  if (lineObserver) lineObserver.disconnect();
  lineWatching = false;
}

/** Draw once layout exists, and again on resize (the window's or the grid's) and when fonts load; stop once the grid is gone. */
function watchStrengthLine(grid) {
  lineGrid = grid;
  if (!lineWatching) window.addEventListener("resize", redrawLine);
  lineWatching = true;
  if (lineObserver) lineObserver.observe(grid);
  requestAnimationFrame(redrawLine);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawLine);
}

/** The "Strength per phase" field: the toggle, Set all to, and one row per phase left. */
function strengthField(s, redo) {
  stopWatchingLine();
  const f = s.form;
  const resolved = s.facts.resolved;
  const box = field("Strength per phase");
  const mapped = hasMapping(resolved);
  const loading = resolved === undefined;
  const off = !loading && !mapped;
  const sw = toggle("loop-phase-strength", "Set strength per phase", f.phaseStrength && !off, (v) => ((f.phaseStrength = v), redo()));
  if (off) {
    sw.classList.add("is-gray");
    sw.querySelector("input").disabled = true;
  }
  box.appendChild(sw);
  if (off) {
    const line = el("p", "loop-hint loop-strength-none");
    line.append("This agent has no strengths mapped yet. ");
    const link = el("button", "linky", "Map them in Agents & models");
    link.type = "button";
    link.addEventListener("click", () => hooks.openPrefs("agents"));
    line.appendChild(link);
    box.appendChild(line);
    return box;
  }
  if (loading) {
    box.appendChild(el("p", "loop-hint", "Asking the app which agent this loop uses..."));
    return box;
  }
  if (!f.phaseStrength) return box;

  // An unmapped word stays in the list, grayed, so a saved one is seen and changed.
  const options = [
    ["", MATCH_SESSION],
    ...STRENGTH_WORDS.map(([word, label]) => [word, resolved[word] ? label : label + " (not mapped)", !resolved[word]]),
  ];
  const all = el("div", "loop-strength-all");
  all.appendChild(el("label", "loop-strength-label", "Set all to"));
  all.firstChild.htmlFor = "loop-strength-all";
  const everyone = select("loop-strength-all", "Set all phases to", [["-", "Choose..."], ...options.map(([v, t, d]) => [v === "" ? "match" : v, t, d])], "-", (v) => {
    if (v === "-") return;
    for (const p of s.facts.phasesLeft) setPick(f, s.spec, p, v === "match" ? "" : v);
    redraw();
  });
  all.appendChild(everyone);
  box.appendChild(all);

  // One column per option, in rank order: level 0 is Match my session.
  const columns = [["", MATCH_SESSION], ...STRENGTH_WORDS].map(([value, label], level) => ({ value, label, level, mapped: value === "" || Boolean(resolved[value]) }));
  const grid = el("div", "loop-strength-grid");
  const line = svgPart("svg", { class: "loop-strength-line", "aria-hidden": "true", focusable: "false" });
  const head = el("div", "loop-strength-head");
  head.appendChild(el("span", "loop-strength-spacer"));
  for (const c of columns) {
    const chip = strengthBadge(c.level, c.mapped ? c.label : `${c.label} (not mapped)`);
    chip.classList.add("loop-strength-chip");
    if (!c.mapped) chip.classList.add("is-unmapped");
    head.appendChild(chip);
  }
  head.appendChild(el("span", "loop-strength-spacer"));
  grid.appendChild(head);

  const rows = el("div", "loop-strength-rows");
  for (const p of s.facts.phasesLeft) {
    const word = pickOf(f, s.spec, p);
    const row = el("div", "loop-strength-row");
    row.dataset.phase = String(p.n);
    row.setAttribute("role", "radiogroup");
    row.setAttribute("aria-label", `Phase ${p.n} strength`);
    row.appendChild(el("span", "loop-strength-phase", `Phase ${p.n}: ${p.name}`));
    for (const c of columns) {
      const cell = el("label", `loop-strength-cell lvl-${c.level}${c.mapped ? "" : " is-unmapped"}`);
      const input = el("input");
      input.type = "radio";
      input.name = `loop-strength-${p.n}`;
      input.id = `loop-strength-${p.n}-${c.value || "match"}`;
      input.value = c.value;
      input.checked = word === c.value;
      input.disabled = !c.mapped;
      input.setAttribute("aria-label", `Phase ${p.n} ${c.label}`);
      input.addEventListener("change", () => {
        if (!input.checked) return;
        setPick(f, s.spec, p, c.value);
        s.problems = [];
        redraw();
      });
      const node = el("span", "loop-strength-node");
      node.appendChild(strengthBars(c.level));
      cell.append(input, node);
      row.appendChild(cell);
    }
    row.appendChild(el("span", "loop-strength-model", pickModelText(resolved, word, page.loopFacts)));
    rows.appendChild(row);
  }
  grid.appendChild(rows);
  if (s.facts.phasesLeft.length >= 2) {
    grid.prepend(line);
    watchStrengthLine(grid);
  }
  box.appendChild(grid);
  return box;
}

function drawBody(pane, s) {
  const f = s.form;
  ensureResolved(s);
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

  form.appendChild(strengthField(s, redo));

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
    "When the loop waits on your answer or ends, except when you stop it yourself, the app sends a short message saying which, with the project, the phase, what it built and how long it took. Leave the address empty to send nothing."
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
  const phasesRow = toggle("loop-notify-phases", "Also tell me when each phase is complete", f.notifyPhases, (v) => {
    f.notifyPhases = v;
  });
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
    phasesRow.hidden = f.notifyUrl.trim() === "";
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
  notify.append(kindLabel, notifyInput, kindHint, paramRow, phasesRow, notifyWarn, testRow);
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

/** The form as the console saves it (exported for the page tests). */
export function setupBody(f, s) {
  const body = { ...f, quickCheck: f.quickCheck.trim(), notifyUrl: f.notifyUrl.trim(), notifyParam: f.notifyParam.trim() || DEFAULT_NOTIFY_PARAM };
  // Only this spec's key changes: its rows that are not Match my session. With the
  // toggle off, or an agent with nothing mapped, the saved picks stay as they are
  // but the loop is told nothing about strengths (NFR-3).
  const strengths = structuredClone(f.strengths || {});
  const mine = (strengths[s.spec] || []).filter((p) => p.strength);
  if (mine.length) strengths[s.spec] = mine;
  else delete strengths[s.spec];
  body.strengths = strengths;
  body.phaseStrength = f.phaseStrength && hasMapping(s.facts.resolved);
  return body;
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
  const { status, body: answer } = await postJson("/loop-setup", setupBody(f, s));
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
  const { status, body: answer } = await postJson("/loop-setup", setupBody(f, s));
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
