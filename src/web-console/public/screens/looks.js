// Plan2Code Web Console - User Preferences: looks, sounds and the launcher's model menus.

import { adoptLooks, applyLooks, loadLooks, looks, renderSwatches, resetLooks, saveLooks, syncLooks } from "../looks.js";
import { dropHeldSound, releaseHeldSound, sound, soundOn } from "../sound.js";
import { SOUND_EVENTS, soundKey } from "../palette.js";
import { ROLES, ROLE_NOT_SET, ROLE_NOT_SET_LABEL, needsRoleNudge, normalizeRole } from "../starters.js";
import { isDashboard } from "../selectors.js";
import { el, lightDismiss } from "../render.js";
import { page, redraw } from "../state.js";
import { framed, onAppMessage, tellApp } from "../app-bridge.js";

const $ = (id) => document.getElementById(id);

function setModelsStatus(text, isError) {
  const status = $("models-status");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

// Models: the launcher's menu. The built-in list ships with every install and is read-only
// here; what the person adds is saved to the server, which the launcher reads on its next run.
let modelsData = null;

// The CLIs the launcher reads a model list for, in tab order (routes.mjs MODEL_CLIS).
const MODEL_CLIS = ["claude", "devin", "codex"];

let modelsTab = "claude";

function renderModels() {
  for (const cli of MODEL_CLIS) {
    $("models-tab-" + cli).setAttribute("aria-pressed", String(cli === modelsTab));
  }
  const shipped = $("models-shipped");
  const user = $("models-user");
  shipped.replaceChildren();
  user.replaceChildren();
  if (!modelsData) {
    setModelsStatus("Models could not be loaded.", true);
    return;
  }
  for (const m of modelsData.shipped[modelsTab] || []) {
    const row = el("div", "models-row locked");
    row.append(el("span", null, m.id), el("span", null, m.label || ""));
    shipped.appendChild(row);
  }
  const mine = modelsData.user[modelsTab];
  mine.forEach((m, i) => {
    const row = el("div", "models-row");
    const id = el("input");
    id.value = m.id;
    id.placeholder = "Model id";
    id.setAttribute("aria-label", "Model id");
    const label = el("input");
    label.value = m.label;
    label.placeholder = "Name shown in the menu";
    label.setAttribute("aria-label", "Name shown in the menu");
    const remove = el("button", "btn small ghost", "Remove");
    remove.type = "button";
    id.addEventListener("change", () => { m.id = id.value.trim(); saveModels(); });
    label.addEventListener("change", () => { m.label = label.value.trim(); saveModels(); });
    remove.addEventListener("click", () => {
      mine.splice(i, 1);
      saveModels();
      renderModels();
    });
    row.append(id, label, remove);
    user.appendChild(row);
  });
}

async function saveModels() {
  try {
    const res = await fetch("/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ models: modelsData.user }),
    });
    const body = await res.json();
    if (!res.ok) return setModelsStatus(body.error || "Could not save.", true);
    setModelsStatus("Saved. Restart plan2code to use it.", false);
  } catch {
    setModelsStatus("Could not save.", true);
  }
}

async function loadModelsData() {
  try {
    const res = await fetch("/models");
    if (res.ok) modelsData = await res.json();
  } catch {}
  renderModels();
}

// Agents: CLIs Plan2Code did not find on its own, saved whole to ~/.plan2code/agents.json.
// Each card edits its entry in place (unknown keys ride along untouched); every change
// saves the whole list. A new card is not sent until it has a name and a command.
let agentsData = [];

// The server's complaint about one card, drawn on it: { index, field, error } (index into agentsData).
let agentsError = null;

// The entry whose Delete is waiting for a second click.
let agentsConfirming = null;

// Every change saves, so two saves can be in flight at once: only the newest one's answer is drawn.
let agentsSaveSeq = 0;

// The list as last loaded or saved, as sent: a change that leaves it the same (a field of a new
// card still held back) sends nothing.
let agentsLastSent = null;

function setAgentsStatus(text, isError) {
  const status = $("agents-status");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

function newAgent() {
  return { name: "", command: "", args: [], prompt: "/plan2code", bypassArgs: [], modelArgs: ["--model", "{model}"], models: [] };
}

function agentField(label, field, child) {
  const wrap = el("div", "agent-field");
  wrap.dataset.field = field;
  wrap.append(el("span", null, label), child);
  return wrap;
}

function agentInput(agent, key, label, placeholder, trim) {
  const input = el("input");
  input.value = agent[key] || "";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", label);
  input.dataset.field = key;
  input.addEventListener("change", () => {
    agent[key] = trim ? input.value.trim() : input.value;
    saveAgents();
  });
  return input;
}

// A list of text rows (arguments), with Remove on each and an Add under them.
function agentArgsEditor(agent, key, label, placeholder, addLabel) {
  const box = el("div", "agent-rows");
  box.dataset.field = key;
  const draw = () => {
    box.replaceChildren();
    agent[key].forEach((value, i) => {
      const row = el("div", "agent-row");
      const input = el("input");
      input.value = value;
      input.placeholder = placeholder;
      input.setAttribute("aria-label", label);
      input.dataset.field = key;
      input.addEventListener("change", () => { agent[key][i] = input.value.trim(); saveAgents(); });
      const remove = el("button", "btn small ghost", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        agent[key].splice(i, 1);
        draw();
        saveAgents();
      });
      row.append(input, remove);
      box.appendChild(row);
    });
    const add = el("button", "btn small ghost", addLabel);
    add.type = "button";
    add.addEventListener("click", () => {
      agent[key].push("");
      draw();
      box.querySelector(".agent-row:last-of-type input")?.focus();
    });
    box.appendChild(add);
  };
  draw();
  return agentField(label, key, box);
}

// The models list: an id and an optional name for the menu on each row.
function agentModelsEditor(agent) {
  const box = el("div", "agent-rows");
  box.dataset.field = "models";
  const draw = () => {
    box.replaceChildren();
    agent.models.forEach((m, i) => {
      const row = el("div", "agent-row model");
      const id = el("input");
      id.value = m.id || "";
      id.placeholder = "Model id, for {model}";
      id.setAttribute("aria-label", "Model id");
      id.dataset.field = "models";
      const label = el("input");
      label.value = m.label || "";
      label.placeholder = "Name shown in the menu (optional)";
      label.setAttribute("aria-label", "Name shown in the menu");
      label.dataset.field = "models";
      const remove = el("button", "btn small ghost", "Remove");
      remove.type = "button";
      id.addEventListener("change", () => { m.id = id.value.trim(); saveAgents(); });
      label.addEventListener("change", () => {
        const text = label.value.trim();
        if (text) m.label = text;
        else delete m.label;
        saveAgents();
      });
      remove.addEventListener("click", () => {
        agent.models.splice(i, 1);
        draw();
        saveAgents();
      });
      row.append(id, label, remove);
      box.appendChild(row);
    });
    const add = el("button", "btn small ghost", "Add a model");
    add.type = "button";
    add.addEventListener("click", () => {
      agent.models.push({ id: "" });
      draw();
      box.querySelector(".agent-row:last-of-type input")?.focus();
    });
    box.appendChild(add);
  };
  draw();
  return agentField("Models", "models", box);
}

// Test, and Delete with its confirm step on the card itself (never the browser's confirm()).
function agentFoot(agent) {
  const foot = el("div", "agent-foot");
  const test = el("button", "btn small", "Test");
  test.type = "button";
  const result = el("span", "help agent-test-result");
  result.setAttribute("role", "status");
  test.addEventListener("click", async () => {
    const command = String(agent.command || "").trim();
    if (!command) {
      result.textContent = "Type a command first.";
      return;
    }
    result.textContent = "Looking...";
    try {
      const res = await fetch("/agents/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const body = await res.json();
      if (!res.ok) result.textContent = body.error || "Could not test.";
      else result.textContent = body.found ? "Found at " + body.path : "Not found on PATH";
    } catch {
      result.textContent = "Could not test.";
    }
  });
  foot.append(test);
  if (agentsConfirming === agent) {
    const ask = el("span", "help", "Delete this agent?");
    const yes = el("button", "btn small danger", "Yes, delete");
    yes.type = "button";
    const keep = el("button", "btn small ghost", "Keep");
    keep.type = "button";
    yes.addEventListener("click", async () => {
      agentsConfirming = null;
      agentsData.splice(agentsData.indexOf(agent), 1);
      agentsError = null;
      renderAgents();
      await saveAgents();
    });
    keep.addEventListener("click", () => {
      agentsConfirming = null;
      renderAgents();
    });
    foot.append(ask, yes, keep);
  } else {
    const del = el("button", "btn small ghost danger", "Delete");
    del.type = "button";
    del.addEventListener("click", () => {
      agentsConfirming = agent;
      renderAgents();
    });
    foot.append(del);
  }
  foot.append(result);
  return foot;
}

// Which field or button has focus, so a redraw (an id assigned, an error marked) puts the
// person back where they were, with what they had typed: { card, nth, value, start, end }.
const AGENT_FOCUSABLE = "input, button";

function agentsFocus(list) {
  const active = document.activeElement;
  const card = active && list.contains(active) ? active.closest(".agent-card") : null;
  if (!card) return null;
  const at = { card: [...list.children].indexOf(card), nth: [...card.querySelectorAll(AGENT_FOCUSABLE)].indexOf(active) };
  if (active instanceof HTMLInputElement) Object.assign(at, { value: active.value, start: active.selectionStart, end: active.selectionEnd });
  return at;
}

function restoreAgentsFocus(list, at) {
  const card = at && list.children[at.card];
  const target = card && card.querySelectorAll(AGENT_FOCUSABLE)[at.nth];
  if (!target) return;
  if (!(target instanceof HTMLInputElement) || at.value === undefined) {
    target.focus();
    return;
  }
  const drawn = target.value;
  target.value = at.value;
  target.focus();
  try {
    target.setSelectionRange(at.start, at.end);
  } catch {}
  // Text typed before the redraw is not in agentsData yet, and the browser fires no change
  // for a value set from script, so leaving the field sends it on.
  if (at.value !== drawn) target.addEventListener("blur", () => target.dispatchEvent(new Event("change")), { once: true });
}

function renderAgents() {
  const list = $("agents-list");
  const focus = agentsFocus(list);
  list.replaceChildren();
  agentsData.forEach((agent, i) => {
    for (const key of ["args", "bypassArgs", "modelArgs", "models"]) {
      if (!Array.isArray(agent[key])) agent[key] = [];
    }
    const card = el("div", "agent-card");
    const top = el("div", "agent-top");
    top.append(
      agentField("Name", "name", agentInput(agent, "name", "Name", "Name shown in the menu", true)),
      agentField("Command", "command", agentInput(agent, "command", "Command", "Program to run, such as myagent", true)),
    );
    card.append(
      top,
      agentArgsEditor(agent, "args", "Arguments", "--message={prompt}", "Add an argument"),
      agentField("Start prompt", "prompt", agentInput(agent, "prompt", "Start prompt", "/plan2code (blank starts with nothing typed)", false)),
      agentArgsEditor(agent, "bypassArgs", "Bypass arguments", "--yes-always", "Add an argument"),
      agentArgsEditor(agent, "modelArgs", "Model arguments", "--model={model}", "Add an argument"),
      agentModelsEditor(agent),
    );
    if (agentsError && agentsError.index === i) {
      card.classList.add("invalid");
      for (const input of card.querySelectorAll("input")) {
        if (input.dataset.field === agentsError.field) input.classList.add("invalid");
      }
      card.appendChild(el("p", "agent-error", agentsError.error));
    }
    card.appendChild(agentFoot(agent));
    list.appendChild(card);
  });
  restoreAgentsFocus(list, focus);
}

// The list as the server wants it: blank rows dropped, and a new card without both a name and
// a command (one still being typed) left out, so its first field is not refused as half an
// agent. `kept` maps each sent entry back to its place.
function agentsPayload() {
  const kept = [];
  const agents = [];
  agentsData.forEach((a, i) => {
    if (!a.id && (!String(a.name || "").trim() || !String(a.command || "").trim())) return;
    kept.push(i);
    agents.push({
      ...a,
      args: a.args.filter((v) => v !== ""),
      bypassArgs: a.bypassArgs.filter((v) => v !== ""),
      modelArgs: a.modelArgs.filter((v) => v !== ""),
      models: a.models.filter((m) => m.id),
    });
  });
  return { kept, agents };
}

// `replace` is the person's Save anyway, over a file holding entries this page could not read.
async function saveAgents({ replace = false } = {}) {
  const { kept, agents } = agentsPayload();
  const sent = JSON.stringify(agents);
  if (!replace && agentsError === null && sent === agentsLastSent) return;
  const seq = ++agentsSaveSeq;
  try {
    const res = await fetch("/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(replace ? { agents, replace: true } : { agents }),
    });
    const body = await res.json();
    if (seq !== agentsSaveSeq) return;
    if (res.status === 409) {
      const warnings = Array.isArray(body.warnings) ? body.warnings : [];
      setAgentsStatus([body.error || "Not saved.", ...warnings].join(" "), true);
      $("agents-replace").hidden = false;
      return;
    }
    $("agents-replace").hidden = true;
    if (!res.ok) {
      const at = Number.isInteger(body.index) ? kept[body.index] : undefined;
      agentsError = at === undefined ? null : { index: at, field: body.field, error: body.error || "Could not save." };
      setAgentsStatus(at === undefined ? body.error || "Could not save." : "Not saved. Fix the marked agent.", true);
      renderAgents();
      return;
    }
    // Ids are assigned on the first save: take the server's entries, and redraw only then
    // (or to clear a mark), so typing in another card is not interrupted.
    const fresh = agents.some((a) => !a.id) || agentsError !== null;
    agentsError = null;
    agentsLastSent = sent;
    setAgentsStatus("Saved.", false);
    if (fresh) {
      kept.forEach((at, n) => { agentsData[at] = body.agents[n]; });
      agentsLastSent = JSON.stringify(agentsPayload().agents);
      renderAgents();
    }
  } catch {
    if (seq === agentsSaveSeq) setAgentsStatus("Could not save.", true);
  }
}

async function loadAgents() {
  agentsError = null;
  agentsConfirming = null;
  agentsLastSent = null;
  $("agents-replace").hidden = true;
  try {
    const res = await fetch("/agents");
    if (res.ok) {
      const body = await res.json();
      agentsData = Array.isArray(body.agents) ? body.agents : [];
      for (const agent of agentsData) {
        for (const key of ["args", "bypassArgs", "modelArgs", "models"]) if (!Array.isArray(agent[key])) agent[key] = [];
      }
      agentsLastSent = JSON.stringify(agentsPayload().agents);
      const warnings = Array.isArray(body.warnings) ? body.warnings : [];
      setAgentsStatus(warnings.join(" "), warnings.length > 0);
    } else {
      setAgentsStatus("Agents could not be loaded.", true);
    }
  } catch {
    setAgentsStatus("Agents could not be loaded.", true);
  }
  renderAgents();
}

// Following the system, the saved looks painted before anything is drawn, and
// the sound cues let go on the next touch. `boot` is the page's boot data.
export function startLooks(boot) {
  // Following the system means following it as it changes, including the accent,
  // whose light and dark shades are different colors.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (looks.theme === "system") {
      applyLooks();
      renderSwatches();
    }
  });

  loadLooks();
  if (boot && boot.looks && typeof boot.looks === "object") adoptLooks(boot.looks);
  applyLooks();
  syncLooks();

  for (const evt of ["pointerdown", "keydown"]) {
    window.addEventListener(evt, releaseHeldSound);
  }
}

// Preferences' buttons and fields.
export function wireLooks() {
  lightDismiss($("looks-modal"));
  $("btn-looks").addEventListener("click", () => {
    renderSwatches();
    setModelsStatus("", false);
    loadModelsData();
    loadAgents();
    $("looks-modal").showModal();
  });
  $("looks-done").addEventListener("click", () => $("looks-modal").close());
  $("looks-modal").addEventListener("close", () => {
    if (isDashboard() && !needsRoleNudge(looks) && $("main").querySelector(".dash-nudge")) redraw();
  });
  $("looks-reset").addEventListener("click", () => {
    resetLooks();
    saveLooks();
    redraw();
  });
  for (const [value, label] of [[ROLE_NOT_SET, ROLE_NOT_SET_LABEL], ...ROLES.map((r) => [r.id, r.label])]) {
    const option = el("option", null, label);
    option.value = value;
    $("looks-role").appendChild(option);
  }
  $("looks-role").addEventListener("change", (e) => {
    looks.role = normalizeRole(e.target.value);
    saveLooks();
    // The dashboard banner, and the starter templates and Ask starters on any
    // page, all order themselves by the role.
    if (page.S) redraw();
  });
  for (const radio of document.querySelectorAll('input[name="looks-theme"]')) {
    radio.addEventListener("change", () => {
      looks.theme = radio.value;
      saveLooks();
    });
  }
  for (const radio of document.querySelectorAll('input[name="looks-width"]')) {
    radio.addEventListener("change", () => {
      looks.width = radio.value;
      saveLooks();
    });
  }
  $("looks-sound").addEventListener("change", (e) => {
    looks.sound = e.target.checked;
    // Held cues are moments, not mail: muted, they are dropped rather than
    // saved up to fire all at once the next time sound comes back on.
    if (!looks.sound) dropHeldSound();
    saveLooks();
    // Turning them on is the one change you can hear: the question chime, or
    // the first cue still ticked when that one is not.
    const preview = ["question", ...Object.keys(SOUND_EVENTS)].find(soundOn);
    if (preview) sound(preview);
  });
  $("looks-activities").addEventListener("change", (e) => {
    looks.hideActivities = !e.target.checked;
    saveLooks();
    // The die comes and goes with the next render, which also closes an open
    // Activities window, paused.
    redraw();
  });
  for (const box of document.querySelectorAll("input[data-sound]")) {
    box.addEventListener("change", () => {
      const event = box.dataset.sound;
      looks[soundKey(event)] = box.checked;
      if (!box.checked) dropHeldSound(event);
      saveLooks();
      // Ticking one plays it, so the label has a sound to go with it.
      if (box.checked) sound(event);
    });
  }

  for (const cli of MODEL_CLIS) {
    $("models-tab-" + cli).addEventListener("click", () => {
      modelsTab = cli;
      renderModels();
    });
  }
  $("models-add").addEventListener("click", () => {
    if (!modelsData) return;
    modelsData.user[modelsTab].push({ id: "", label: "" });
    renderModels();
    $("models-user").querySelector(".models-row:last-child input")?.focus();
  });
  $("agents-add").addEventListener("click", () => {
    agentsData.push(newAgent());
    renderAgents();
    $("agents-list").querySelector(".agent-card:last-child input")?.focus();
  });
  $("agents-replace").addEventListener("click", () => {
    $("agents-replace").hidden = true;
    saveAgents({ replace: true });
  });
  $("models-reset").addEventListener("click", () => {
    if (!modelsData) return;
    modelsData.user = Object.fromEntries(MODEL_CLIS.map((cli) => [cli, []]));
    saveModels();
    renderModels();
  });

  // Desktop app: the taskbar switch, kept by the app in its own app.json. The
  // app says what it holds once the page is up; checked until it does.
  if (framed()) {
    $("looks-desktop").hidden = false;
    onAppMessage("taskbar-state", (data) => {
      if (typeof data.on === "boolean") $("looks-taskbar").checked = data.on;
    });
    $("looks-taskbar").addEventListener("change", (e) => tellApp("taskbar", { on: e.target.checked }));
  }
}
