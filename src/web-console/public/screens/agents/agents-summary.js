// Plan2Code Web Console - the agents view's collection side.
//
// The collection side for both mounts. Preferences draws a roster of cards,
// one per agent (name, command, found badge, the model each strength uses),
// and the Add agent chooser, where the starter templates are an opt-in. The
// setup page keeps its master-detail list: the same agents with their
// found/outside/missing badges and the starter templates, and a right pane that
// shows the picked entry's state and way forward (Start, Use it from here, the
// install lines).
// It only draws and listens: every fetch and every piece of state lives in
// the mount, reached through `ctx`.

import { el, copyButton } from "../../render.js";
import { summaryRows, serverStateFor, agentId, templateDraft, HAS_EFFORT } from "./agents-data.js";
import { STRENGTH_ORDER, resolveStrengths } from "../../strengths.js";
import { wordChip } from "./agents-strengths.js";

/* ------------------------------------------------------------- badges */

export const BADGES = {
  ok: "Found",
  missing: "Not found on PATH",
  unknown: "Not checked",
};

export function drawBadge(badge, state) {
  badge.textContent = BADGES[state];
  badge.classList.remove("ok", "missing");
  if (state !== "unknown") badge.classList.add(state);
}

/* -------------------------------------------------------- the prefs cards */

// A model's name without its gloss ("Sonnet, latest Sonnet" or "Opus plan: Opus in plan mode" is cut at the first separator), so a card line stays one line.
const GLOSS = new RegExp(" " + String.fromCharCode(8212) + " |, |: ");
const shortLabel = (label) => label.split(GLOSS)[0];

// The model each strength resolves to for one row, as [word, label, effort]
// triples; empty while the strengths did not load.
function strengthLines(ctx, row) {
  if (!ctx.modelsLoaded) return [];
  const isCli = row.key.startsWith("cli:");
  const owner = isCli ? row.command : agentId(row.key);
  const resolved = resolveStrengths({
    shipped: (ctx.saved.strengths.shipped && ctx.saved.strengths.shipped[owner]) || {},
    user: (ctx.saved.strengths.user && ctx.saved.strengths.user[owner]) || {},
    models: row.models.map((m) => m.id),
    hasEffort: isCli && HAS_EFFORT.includes(owner),
  });
  return STRENGTH_ORDER.map((word) => {
    const pick = resolved[word];
    const model = pick && row.models.find((m) => m.id === pick.model);
    return [word, model ? shortLabel(model.label || model.id) : null, pick && pick.effort];
  });
}

// One card: the whole card is the Edit button, so it carries the data-key and
// the "Edit <name>" aria-label the flows rely on.
function agentCard(ctx, row, check) {
  const r = el("button", "agent-card");
  r.type = "button";
  r.dataset.key = row.key;
  r.setAttribute("aria-label", "Edit " + row.name);
  r.setAttribute("aria-current", ctx.openKey === row.key ? "true" : "false");
  r.addEventListener("click", () => ctx.pick(row.key));
  const top = el("span", "card-top");
  const who = el("span", "card-who");
  const name = el("span", "row-name", row.name);
  if (row.key.startsWith("agent:")) name.append(" ", el("span", "tag", "Custom"));
  who.append(name, el("code", null, row.command));
  top.appendChild(who);
  const badge = el("span", "prefs-badge");
  const known = serverStateFor(ctx.saved, row);
  if (known) {
    ctx.found.set(row.key, { command: row.command, state: known });
    drawBadge(badge, known);
  } else {
    const last = ctx.found.get(row.key);
    if (last && last.command === row.command) drawBadge(badge, last.state);
    else {
      badge.textContent = "Checking...";
      check.push(row);
    }
  }
  top.appendChild(badge);
  r.appendChild(top);
  const lines = strengthLines(ctx, row);
  if (lines.length) {
    const tiers = el("span", "card-tiers");
    for (const [word, label, effort] of lines) {
      const line = el("span", "card-tier");
      line.append(wordChip(word), label ? el("span", null, effort ? `${label} · ${effort}` : label) : el("span", "muted", "not mapped"));
      tiers.appendChild(line);
    }
    r.appendChild(tiers);
  }
  const foot = el("span", "card-foot");
  foot.append(el("span", "row-models", `${row.models.length} ${row.models.length === 1 ? "model" : "models"}`), el("span", "card-edit", "Edit ›"));
  r.appendChild(foot);
  if (row.noneShip && !row.models.length) r.appendChild(el("span", "help row-note", `No models ship for ${row.name} yet; open this card to add your own.`));
  return r;
}

/* --------------------------------------------------------- the setup rows */

// The badge a setup row's state gets: the glanceable half, with the pane
// beside it saying what the state means and what can be done about it.
function setupStateBadge(entry) {
  const badge = el("span", "prefs-badge");
  if (entry.state === "found") {
    badge.textContent = "Found";
    badge.classList.add("ok");
  } else if (entry.state === "outside") {
    badge.textContent = "Found outside PATH";
    badge.classList.add("missing");
  } else if (entry.state === "missing") {
    badge.textContent = "Not found";
    badge.classList.add("missing");
  } else {
    badge.textContent = "Not checked";
  }
  return badge;
}

// A pickable setup row: selecting it fills the pane with the entry's state,
// not a form (custom agents get an Edit in that pane).
function setupRow(ctx, entry, key, badgeFor) {
  const r = el("button", "split-row");
  r.type = "button";
  r.dataset.key = key;
  r.setAttribute("aria-current", ctx.setupSel === key ? "true" : "false");
  r.addEventListener("click", () => ctx.pickSetup(key));
  r.appendChild(el("span", "row-name", entry.name || entry.id));
  const sub = el("span", "row-sub");
  sub.appendChild(el("code", null, entry.command));
  if (badgeFor) sub.appendChild(badgeFor(entry));
  r.appendChild(sub);
  return r;
}

/* ---------------------------------------------------------- the list itself */

// The left column, whichever the mode: rows, the placeholder or templates,
// then the scaffold's Add agent button pinned last (grabbed before the list
// is cleared: a live query for it after replaceChildren finds nothing).
export function renderSummary(ctx) {
  const list = ctx.$("table");
  const add = ctx.$("add");
  list.replaceChildren();
  if (ctx.mode === "setup") {
    const cli = ctx.forCli();
    const builtins = [...ctx.saved.builtins].sort((a, b) => (a.id === cli ? -1 : b.id === cli ? 1 : 0));
    for (const b of builtins) list.appendChild(setupRow(ctx, b, "setup:" + b.id, setupStateBadge));
    for (const a of ctx.saved.agents) list.appendChild(setupRow(ctx, a, "setup:" + a.id, setupStateBadge));
    if (ctx.saved.templates.length) {
      list.appendChild(el("div", "split-list-head", "Or start from a template"));
      for (const t of ctx.saved.templates) list.appendChild(setupRow(ctx, t, "setup:" + t.name));
    }
  } else {
    const check = [];
    for (const row of summaryRows(ctx.saved)) list.appendChild(agentCard(ctx, row, check));
    const ghost = el("button", "agent-card ghost");
    ghost.type = "button";
    ghost.append(el("span", "plus", "+"), el("b", null, "Add an agent"), el("span", "muted", "From a starter template or your own command"));
    ghost.addEventListener("click", () => ctx.openChooser());
    list.appendChild(ghost);
    if (check.length) ctx.checkFound(check);
    return;
  }
  if (add) list.appendChild(add);
}

/* ------------------------------------------------ the pane while nothing is open */

// How the person puts the found folder on PATH themselves, for the OS their
// browser reports. The server already knows where the agent is; this is the
// alternative to letting Plan2Code save that location for it.
function pathNote(folder) {
  const os = navigator.platform || navigator.userAgent || "";
  if (/win/i.test(os)) {
    return "Or add its folder to your PATH: Settings > System > About > Advanced system settings > Environment Variables.";
  }
  if (/mac/i.test(os)) return `Or add its folder to PATH in ~/.zshrc: export PATH="${folder}:$PATH"`;
  return `Or add its folder to PATH in ~/.bashrc: export PATH="${folder}:$PATH"`;
}

// The state area of a picked setup entry: the badge, what the state means,
// and the one thing to do about it (Start, Use it from here, the install lines).
function setupStateArea(ctx, entry) {
  const area = el("div", "setup-agent-state");
  const badge = setupStateBadge(entry);
  if (entry.state === "found") {
    const line = el("p", "setup-agent-line");
    line.appendChild(badge);
    if (entry.path) line.append(" ", el("span", "help", entry.path));
    area.appendChild(line);
    // A session opened for one CLI only offers that one's Start.
    if (ctx.onStart && (!ctx.forCli() || entry.id === ctx.forCli())) {
      const start = el("button", "btn small primary", "Start with this agent");
      start.type = "button";
      start.addEventListener("click", () => ctx.onStart(entry));
      area.appendChild(start);
    }
  } else if (entry.state === "outside") {
    const line = el("p", "setup-agent-line");
    line.append(badge, ` Found at ${entry.path || ""}, but not on PATH`);
    area.appendChild(line);
    const use = el("button", "btn small", "Use it from here");
    use.type = "button";
    use.addEventListener("click", () => ctx.useFromHere(entry));
    area.appendChild(use);
    area.appendChild(el("p", "help", entry.folder ? pathNote(entry.folder) : "Or add its folder to your PATH yourself."));
  } else {
    area.appendChild(badge);
    if (entry.state === "missing") {
      for (const inst of Array.isArray(entry.install) ? entry.install : []) {
        const d = el("div", "setup-install");
        d.append(el("span", null, inst.label), el("code", null, inst.run));
        if (inst.note) d.appendChild(el("span", "help", inst.note));
        d.appendChild(copyButton(inst.run));
        area.appendChild(d);
      }
      if (entry.installUrl) {
        const a = el("a", null, "Install page");
        a.href = entry.installUrl;
        a.target = "_blank";
        a.rel = "noopener";
        area.appendChild(a);
      }
    }
  }
  return area;
}

// A template's pane half: its name, command and note with a Use that opens
// the new-agent form prefilled, shared by both mounts.
function templatePane(ctx, template) {
  const box = el("div", "setup-detail");
  const head = el("div", "form-head");
  const title = el("h3", "prefs-agents-title");
  title.append(el("span", null, template.name), el("code", null, template.command));
  head.appendChild(title);
  box.appendChild(head);
  if (template.note) box.appendChild(el("p", "help", template.note));
  const use = el("button", "btn small", "Use this template");
  use.type = "button";
  use.addEventListener("click", () => {
    // Cloned: the form edits the draft in place, and saved.templates is
    // the server's copy the next load draws from.
    ctx.drafts.set("agent:new", structuredClone(templateDraft(template)));
    ctx.pick("agent:new");
  });
  box.appendChild(use);
  return box;
}

// The detail pane with no form open: the picked entry's state and way
// forward, a template's note and Use, or the empty text. In Preferences a
// template row drives the same pane; every other row opens a form.
export function drawSummaryPane(ctx) {
  const pane = ctx.$("form");
  pane.replaceChildren();
  const sel = ctx.setupSel;
  const all = [...ctx.saved.builtins, ...ctx.saved.agents];
  const entry = sel && all.find((e) => "setup:" + e.id === sel);
  const template = sel && !entry && ctx.saved.templates.find((t) => "setup:" + t.name === sel);
  // Preferences' drawer holds nothing while no form is open.
  if (ctx.mode !== "setup") return;
  if (entry) {
    const box = el("div", "setup-detail");
    const head = el("div", "form-head");
    const title = el("h3", "prefs-agents-title");
    title.append(el("span", null, entry.name || entry.id), el("code", null, entry.command));
    head.appendChild(title);
    box.append(head, setupStateArea(ctx, entry));
    if (ctx.saved.agents.includes(entry)) {
      const edit = el("button", "btn small", "Edit");
      edit.type = "button";
      edit.setAttribute("aria-label", "Edit " + (entry.name || entry.id));
      edit.addEventListener("click", () => ctx.pick("agent:" + entry.id));
      box.appendChild(edit);
    }
    pane.appendChild(box);
    return;
  }
  if (template) {
    pane.appendChild(templatePane(ctx, template));
    return;
  }
  pane.appendChild(el("div", "split-empty", "Pick an agent on the left to see its state and the way forward."));
}

/* ------------------------------------------------------ the Add agent chooser */

const TEMPLATE_STATE = { ok: "Installed on this computer", missing: "Not installed yet", unknown: "" };

// The Add agent sheet: the starter templates as an opt-in, each with whether
// its command is on this computer, and a Custom agent tile for any other tool.
// A template whose command an agent already uses is shown, not offered.
export function drawChooser(ctx) {
  const box = ctx.$("chooser");
  box.replaceChildren();
  const scrim = el("div", "chooser-scrim");
  scrim.addEventListener("click", () => ctx.closeChooser());
  const sheet = el("div", "chooser-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-labelledby", "agents-chooser-title");
  const head = el("div", "chooser-head");
  const title = el("h3", null, "Add an agent");
  title.id = "agents-chooser-title";
  const close = el("button", "btn small ghost", "Cancel");
  close.type = "button";
  close.addEventListener("click", () => ctx.closeChooser());
  head.append(title, close);
  sheet.appendChild(head);
  const have = new Set([...ctx.saved.builtins, ...ctx.saved.agents].map((a) => a.command));
  if (ctx.saved.templates.length) {
    sheet.appendChild(el("p", "help", "Start from a ready-made setup. You can change everything afterwards."));
    const tiles = el("div", "chooser-tiles");
    for (const t of ctx.saved.templates) {
      const done = have.has(t.command);
      const tile = el("button", "chooser-tile");
      tile.type = "button";
      tile.dataset.template = t.name;
      tile.disabled = done;
      const state = el("span", "chooser-state");
      state.dataset.command = t.command;
      const known = ctx.templateState.get(t.command);
      state.textContent = done ? "Already added" : TEMPLATE_STATE[known || "unknown"];
      if (known) state.classList.add(known);
      tile.append(el("b", null, t.name), el("code", null, t.command));
      if (t.note) tile.appendChild(el("span", "muted", t.note));
      tile.appendChild(state);
      tile.addEventListener("click", () => ctx.startNew(t));
      tiles.appendChild(tile);
    }
    sheet.appendChild(tiles);
    sheet.appendChild(el("div", "chooser-or", "or"));
  } else {
    sheet.appendChild(el("p", "help", "Add any command-line agent: give it a name and a command, then its models."));
  }
  const custom = el("button", "chooser-tile wide");
  custom.type = "button";
  custom.dataset.template = "";
  custom.append(el("b", null, "Custom agent"), el("span", "muted", "Any command-line tool. You give it a name and a command, and add its models."));
  custom.addEventListener("click", () => ctx.startNew(null));
  sheet.appendChild(custom);
  box.append(scrim, sheet);
}

// Fills each tile's "installed" line once /agents/test has answered for its command.
export function markTemplateState(ctx, command, state) {
  for (const node of ctx.$("chooser").querySelectorAll(".chooser-state")) {
    if (node.dataset.command !== command || node.textContent === "Already added") continue;
    node.textContent = TEMPLATE_STATE[state];
    node.classList.remove("ok", "missing");
    if (state !== "unknown") node.classList.add(state);
  }
}
