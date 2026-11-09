// Plan2Code Web Console - the agents view's per-agent form, the drawer's content.
//
// What the drawer (or, on the setup page, the split's right pane) draws while a
// draft is being edited: the head (name, command, a close button), two tabs,
// Models & strengths and Launch, the foot (Save, Discard, the Unsaved badge,
// Save anyway after a 409, Delete with its inline confirm), error marking, and
// the focus save/restore that keeps a redraw from stealing where the person
// was. A built-in's Launch tab only reads (Plan2Code owns its command); an
// added agent's holds the fields. It only draws and listens: state and fetches
// live in the mount, reached through `ctx`.

import { el } from "../../render.js";
import { listEditor } from "./agents-list-editor.js";
import { BUILT_IN, HAS_EFFORT, cliOf, savedEntry, isDirty } from "./agents-data.js";
import { strengthsPanel } from "./agents-strengths.js";
import { drawBadge } from "./agents-summary.js";

function agentField(label, field, child) {
  const wrap = el("div", "agent-field");
  wrap.dataset.field = field;
  wrap.append(el("span", null, label), child);
  return wrap;
}

function agentInput(ctx, agent, key, label, placeholder, trim) {
  const input = el("input");
  input.value = agent[key] || "";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", label);
  input.dataset.field = key;
  input.addEventListener("input", () => {
    agent[key] = trim ? input.value.trim() : input.value;
    ctx.edited();
  });
  return input;
}

// The command's Test: where it would run from. Never saves.
function agentTest(ctx, agent) {
  const wrap = el("div", "prefs-agents-test");
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
    result.textContent = await ctx.testCommand(command);
  });
  wrap.append(test, result);
  return wrap;
}

// A folded section: `<details>` whose open state lives on the mount (`which`
// is "modelsOpen" or "argsOpen") so a redraw keeps it where the person left it.
function fold(ctx, which, title, cls, kids) {
  const d = el("details", cls);
  d.open = ctx[which];
  d.addEventListener("toggle", () => (ctx[which] = d.open));
  d.append(el("summary", null, title), ...kids);
  return d;
}

/* ------------------------------------------------------------ models tab */

// One model: its name and id, the pill set (when the strengths loaded), and a
// Remove for the ones the person added.
function modelRow(ctx, m, panel, onRemove) {
  const row = el("div", onRemove ? "models-row" : "models-row locked");
  const name = el("span", "model-name");
  const named = m.label && m.label !== m.id;
  name.append(named ? m.label : m.id);
  if (named) name.append(el("code", null, m.id));
  row.appendChild(name);
  row.appendChild(panel ? panel.pills(m.id, m.label || m.id) : el("span"));
  if (onRemove) {
    const remove = el("button", "btn small ghost", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove " + (m.label || m.id));
    remove.addEventListener("click", onRemove);
    row.appendChild(remove);
  } else {
    row.appendChild(el("span"));
  }
  return row;
}

// The add-a-model row: an id, a name for the menu, and the button that moves
// them into the draft, so the draft never holds a half-typed model.
function addModelRow(ctx, list, { nameRequired, taken }) {
  const wrap = el("div", "agent-row model model-add");
  const id = el("input");
  id.placeholder = "Model id, for {model}";
  id.setAttribute("aria-label", "Model id");
  id.dataset.field = "models";
  const label = el("input");
  label.placeholder = nameRequired ? "Name shown in the menu" : "Name shown in the menu (optional)";
  label.setAttribute("aria-label", "Name shown in the menu");
  label.dataset.field = "models";
  const add = el("button", "btn small", "Add a model");
  add.type = "button";
  const submit = () => {
    const value = id.value.trim();
    const text = label.value.trim();
    id.classList.toggle("invalid", !value || taken(value));
    if (!value || taken(value)) {
      id.focus();
      return;
    }
    list.push(nameRequired ? { id: value, label: text || value } : text ? { id: value, label: text } : { id: value });
    ctx.edited();
    ctx.drawForm();
    ctx.$("form").querySelector(".model-add input")?.focus();
  };
  add.addEventListener("click", submit);
  for (const input of [id, label]) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
  }
  wrap.append(id, label, add);
  return wrap;
}

function modelsTab(ctx, key, draft) {
  const isCli = key.startsWith("cli:");
  const cli = isCli ? cliOf(key) : null;
  const mine = isCli ? draft : draft.models;
  const shipped = isCli ? ctx.saved.shipped[cli] : [];
  const all = () => [...shipped, ...mine.filter((m) => m.id)];
  const owner = isCli ? cli : key === "agent:new" ? "" : savedEntry(ctx.saved, key).id;
  const panel = ctx.modelsLoaded ? strengthsPanel(ctx, owner, draft, { models: all, hasEffort: isCli && HAS_EFFORT.includes(cli) }) : null;
  const kids = [];
  if (panel) {
    const lead = agentField("In the loop", "strengths", panel.box);
    lead.classList.add("prefs-agents-strengths-field");
    kids.push(lead);
    kids.push(el("p", "help models-tip", "Tap Thrifty, Balanced or Best on a model below to make it that strength's pick."));
  }
  if (isCli) {
    const comes = el("div", "agent-field");
    comes.append(el("span", null, "Comes with Plan2Code"));
    if (shipped.length) {
      const list = el("div", "models-list prefs-agents-shipped");
      list.setAttribute("aria-label", "Comes with Plan2Code");
      for (const m of shipped) list.appendChild(modelRow(ctx, m, panel, null));
      comes.append(list);
    } else {
      comes.append(el("p", "help prefs-agents-none", `No models ship for ${BUILT_IN[cli]} yet; add your own below.`));
    }
    kids.push(comes);
  }
  const yours = agentField(isCli ? "Models you added" : "Models", "models", el("div", "models-list prefs-agents-mine"));
  const rows = yours.querySelector(".models-list");
  mine.forEach((m, i) =>
    rows.appendChild(
      modelRow(ctx, m, panel, () => {
        mine.splice(i, 1);
        ctx.edited();
        ctx.drawForm();
      })
    )
  );
  const taken = (id) => all().some((m) => m.id === id);
  yours.appendChild(addModelRow(ctx, mine, { nameRequired: isCli, taken }));
  kids.push(yours);
  if (isCli) {
    const note = el("div", "models-note");
    note.innerHTML =
      "<ul>" +
      "<li>Restart <code>plan2code</code> to see a change in its model menu.</li>" +
      "<li>At any time, run <code>plan2code --model &lt;id&gt;</code>, or pick your model inside your agent before running a skill.</li>" +
      "<li>Updating Plan2Code refreshes the built-in list. Models you added stay, unless the built-in list now includes them.</li>" +
      "<li>Devin models are limited to Low, Medium and High effort.</li>" +
      "</ul>";
    kids.push(fold(ctx, "modelsOpen", "About this list", "agent-fold", [note]));
  }
  return kids;
}

/* ------------------------------------------------------------ launch tab */

// A built-in's Launch tab only reads: Plan2Code ships and updates its command.
function builtInLaunch(ctx, key) {
  const cli = cliOf(key);
  const entry = ctx.saved.builtins.find((b) => b.id === cli);
  const note = el("div", "note");
  note.append(el("b", null, "Managed by Plan2Code. "), `The command and arguments for ${BUILT_IN[cli]} ship with the app and update with it. Only its models are yours to change.`);
  const list = el("dl", "kv");
  const state = el("span", "prefs-badge");
  const known = ctx.found.get(key);
  drawBadge(state, known ? known.state : "unknown");
  const command = el("dd");
  command.append(el("code", null, (entry && entry.command) || cli), " ", state);
  list.append(el("dt", null, "Command"), command);
  if (entry && entry.prompt) {
    const prompt = el("dd");
    prompt.appendChild(el("code", null, entry.prompt));
    list.append(el("dt", null, "Start prompt"), prompt);
  }
  return [note, list];
}

function addedLaunch(ctx, draft) {
  const command = agentField("Command", "command", agentInput(ctx, draft, "command", "Command", "Program to run, such as myagent", true));
  command.append(agentTest(ctx, draft));
  const args = fold(ctx, "argsOpen", "Command-line arguments", "agent-fold prefs-agents-args", [
    agentField("Arguments", "args", listEditor({ list: draft.args, field: "args", placeholder: "--message={prompt}", addLabel: "Add an argument", aria: "Arguments", onChange: ctx.edited })),
    agentField("Bypass arguments", "bypassArgs", listEditor({ list: draft.bypassArgs, field: "bypassArgs", placeholder: "--yes-always", addLabel: "Add an argument", aria: "Bypass arguments", onChange: ctx.edited })),
    agentField("Model arguments", "modelArgs", listEditor({ list: draft.modelArgs, field: "modelArgs", placeholder: "--model={model}", addLabel: "Add an argument", aria: "Model arguments", onChange: ctx.edited })),
  ]);
  return [
    agentField("Name", "name", agentInput(ctx, draft, "name", "Name", "Name shown in the menu", true)),
    command,
    agentField("Start prompt", "prompt", agentInput(ctx, draft, "prompt", "Start prompt", "/plan2code (blank starts with nothing typed)", false)),
    args,
  ];
}

/* ------------------------------------------------------------------ foot */

// Save, Discard and the Unsaved badge (shown only while the draft differs),
// the Saved mark's spot, Save anyway after a 409, and Delete agent with its
// confirm on the form itself (never the browser's confirm()).
function formFoot(ctx, key) {
  const foot = el("div", "agent-foot prefs-agents-foot");
  const save = el("button", "btn small primary prefs-agents-save", "Save");
  save.type = "button";
  save.addEventListener("click", () => ctx.save(key));
  const discard = el("button", "btn small ghost prefs-agents-discard", "Discard");
  discard.type = "button";
  discard.addEventListener("click", () => ctx.discard());
  const badge = el("span", "prefs-unsaved-badge", "Unsaved");
  foot.append(save, discard, badge);
  if (ctx.formReplace) {
    const anyway = el("button", "btn small danger prefs-agents-replace", "Save anyway");
    anyway.type = "button";
    anyway.addEventListener("click", () => ctx.save(key, { replace: true }));
    foot.append(anyway);
  }
  if (key.startsWith("agent:") && key !== "agent:new") {
    if (ctx.confirming) {
      const yes = el("button", "btn small danger", "Yes, delete");
      yes.type = "button";
      yes.addEventListener("click", () => ctx.deleteAgent(key));
      const keep = el("button", "btn small ghost", "Keep");
      keep.type = "button";
      keep.addEventListener("click", () => {
        ctx.confirming = false;
        ctx.drawForm();
      });
      foot.append(el("span", "help", "Delete this agent?"), yes, keep);
    } else {
      const del = el("button", "btn small ghost danger prefs-agents-delete", "Delete agent");
      del.type = "button";
      del.addEventListener("click", () => {
        ctx.confirming = true;
        ctx.drawForm();
      });
      foot.append(del);
    }
  }
  return foot;
}

// The Unsaved badge and the Save/Discard buttons appear only while the open
// draft differs from what is saved.
export function renderDirty(ctx, key) {
  const foot = ctx.$("form").querySelector(".prefs-agents-foot");
  if (!foot || key !== ctx.openKey) return;
  const dirty = isDirty(ctx.saved, ctx.drafts, key, ctx.strengthDrafts);
  for (const sel of [".prefs-agents-save", ".prefs-agents-discard", ".prefs-unsaved-badge"]) foot.querySelector(sel).hidden = !dirty;
}

// Which field or button has focus, so a redraw (an id assigned, an error
// marked) puts the person back where they were: { nth, start, end }. What
// they typed is already in the draft the redraw reads.
const FORM_FOCUSABLE = "input, button, summary, select";

function formFocus(form) {
  const active = document.activeElement;
  if (!active || !form.contains(active)) return null;
  const at = { nth: [...form.querySelectorAll(FORM_FOCUSABLE)].indexOf(active) };
  if (active instanceof HTMLInputElement) Object.assign(at, { start: active.selectionStart, end: active.selectionEnd });
  return at;
}

function restoreFormFocus(form, at) {
  if (!at) return;
  const target = form.querySelectorAll(FORM_FOCUSABLE)[at.nth];
  // A button the redraw hid (Save, once saved) hands focus to the heading.
  if (!target || target.closest("[hidden]")) return form.querySelector(".prefs-agents-title")?.focus();
  target.focus();
  if (target instanceof HTMLInputElement && at.start !== undefined) {
    try {
      target.setSelectionRange(at.start, at.end);
    } catch {}
  }
}

const TABS = [
  ["models", "Models & strengths"],
  ["launch", "Launch"],
];

export function drawForm(ctx) {
  const pane = ctx.$("form");
  const key = ctx.openKey;
  const draft = ctx.drafts.get(key);
  const focus = formFocus(pane);
  pane.replaceChildren();
  const isCli = key.startsWith("cli:");
  const head = el("div", "form-head");
  const title = el("h3", "prefs-agents-title");
  title.tabIndex = -1;
  if (isCli) title.append(el("span", null, BUILT_IN[cliOf(key)]), el("code", null, cliOf(key)));
  else {
    title.append(el("span", null, key === "agent:new" ? "New agent" : savedEntry(ctx.saved, key).name));
    if (key === "agent:new" && ctx.draftFrom) title.append(el("span", "tag", `From the ${ctx.draftFrom} template`));
  }
  head.appendChild(title);
  if (ctx.$("drawer")) {
    const close = el("button", "btn small ghost drawer-close", "Close");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => ctx.closeDrawer());
    head.appendChild(close);
  }
  pane.appendChild(head);

  const tabs = el("div", "agent-tabs");
  tabs.setAttribute("role", "tablist");
  const order = key === "agent:new" ? [...TABS].reverse() : TABS;
  for (const [id, label] of order) {
    const tab = el("button", "agent-tab", label);
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.dataset.tab = id;
    tab.setAttribute("aria-selected", String(ctx.tab === id));
    tab.addEventListener("click", () => {
      if (ctx.tab === id) return;
      ctx.tab = id;
      ctx.drawForm();
    });
    tabs.appendChild(tab);
  }
  pane.appendChild(tabs);

  const body = el("div", "agent-body");
  const fields = el("div", "prefs-agents-fields");
  fields.setAttribute("role", "tabpanel");
  if (ctx.tab === "models") fields.append(...modelsTab(ctx, key, draft));
  else fields.append(...(isCli ? builtInLaunch(ctx, key) : addedLaunch(ctx, draft)));
  body.appendChild(fields);
  if (ctx.formError) {
    for (const input of body.querySelectorAll("input")) {
      if (input.dataset.field === ctx.formError.field) input.classList.add("invalid");
    }
    body.appendChild(el("p", "agent-error", ctx.formError.error));
  }
  if (ctx.formReplace && ctx.formReplace.length) body.appendChild(el("p", "agent-error", ctx.formReplace.join(" ")));
  pane.appendChild(body);
  pane.appendChild(formFoot(ctx, key));
  renderDirty(ctx, key);
  restoreFormFocus(pane, focus);
}
