// Plan2Code Web Console - the agents view's collection side.
//
// The master-detail's left column for both mounts: Preferences draws one
// pickable row per agent (name, command, found badge, its models) plus the
// v3 orchestrator placeholder; the setup page draws the same rows with their
// found/outside/missing badges and the starter templates. While no form is
// open the right pane is this module's too: the empty text, or the picked
// entry's state and way forward (Start, Use it from here, the install lines).
// It only draws and listens: every fetch and every piece of state lives in
// the mount, reached through `ctx`.

import { el, copyButton } from "../../render.js";
import { summaryRows, serverStateFor, modelNames, agentId, templateDraft } from "./agents-data.js";

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

/* --------------------------------------------------------- the prefs rows */

// One pickable row: the whole row is the Edit button, so it carries the
// data-key and the "Edit <name>" aria-label the flows rely on.
function prefsRow(ctx, row, check) {
  const r = el("button", "split-row");
  r.type = "button";
  r.dataset.key = row.key;
  r.setAttribute("aria-label", "Edit " + row.name);
  r.setAttribute("aria-current", ctx.openKey === row.key ? "true" : "false");
  r.addEventListener("click", () => ctx.pick(row.key));
  r.appendChild(el("span", "row-name", row.name));
  const sub = el("span", "row-sub");
  sub.id = "row-sub-" + row.key;
  r.setAttribute("aria-describedby", sub.id);
  sub.appendChild(el("code", null, row.command));
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
  sub.appendChild(badge);
  const names = modelNames(row.models);
  sub.appendChild(el("span", "row-models", names.length ? `${names.length}: ${names.join(", ")}` : "None"));
  r.appendChild(sub);
  if (row.noneShip) r.appendChild(el("span", "help row-note", `No models ship for ${row.name} yet; open this row to add your own.`));
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
    for (const row of summaryRows(ctx.saved)) list.appendChild(prefsRow(ctx, row, check));
    if (ctx.saved.templates.length) {
      list.appendChild(el("div", "split-list-head", "Or start from a template"));
      for (const t of ctx.saved.templates) list.appendChild(setupRow(ctx, t, "setup:" + t.name));
    }
    const soon = el("div", "split-row soon");
    soon.append(el("span", "row-name", "v3 orchestrator"), el("span", "row-sub", "Nothing to set yet."));
    list.appendChild(soon);
    if (check.length) ctx.checkFound(check);
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
  if (ctx.mode !== "setup") {
    pane.appendChild(template ? templatePane(ctx, template) : el("div", "split-empty", "Pick an agent on the left to edit it here."));
    return;
  }
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
