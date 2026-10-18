// Plan2Code Web Console - User Preferences: looks, sounds and the launcher's model menus.

import { adoptLooks, applyLooks, loadLooks, looks, renderSwatches, resetLooks, saveLooks, syncLooks } from "../looks.js";
import { dropHeldSound, releaseHeldSound, sound, soundOn } from "../sound.js";
import { SOUND_EVENTS, soundKey } from "../palette.js";
import { ROLES, ROLE_NOT_SET, ROLE_NOT_SET_LABEL, needsRoleNudge, normalizeRole } from "../starters.js";
import { isDashboard } from "../selectors.js";
import { el, lightDismiss } from "../render.js";
import { page, redraw } from "../state.js";

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
  $("models-reset").addEventListener("click", () => {
    if (!modelsData) return;
    modelsData.user = Object.fromEntries(MODEL_CLIS.map((cli) => [cli, []]));
    saveModels();
    renderModels();
  });
}
