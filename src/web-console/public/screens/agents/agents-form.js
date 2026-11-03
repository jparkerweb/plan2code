// Plan2Code Web Console - the agents view's per-agent form, the detail pane.
//
// What the right pane draws while a draft is being edited: the built-in's
// models fold or an added agent's fields (identity inline, Models and
// Command-line arguments folded), the foot (Save, Discard, the Unsaved
// badge, Save anyway after a 409, Delete with its inline confirm), error
// marking, and the focus save/restore that keeps a redraw from stealing
// where the person was. It only draws and listens: state and fetches live
// in the mount, reached through `ctx`.

import { el } from "../../render.js";
import { listEditor } from "./agents-list-editor.js";
import { BUILT_IN, cliOf, savedEntry, isDirty } from "./agents-data.js";

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

// A built-in's whole form is its models, so the one fold holds the note, the
// locked shipped list and the editor for the person's own additions.
function builtInFields(ctx, cli, draft) {
  const shipped = el("div", "models-list prefs-agents-shipped");
  shipped.setAttribute("aria-label", "Comes with Plan2Code");
  for (const m of ctx.saved.shipped[cli]) {
    const row = el("div", "models-row locked");
    row.append(el("span", null, m.id), el("span", null, m.label || ""));
    shipped.appendChild(row);
  }
  const note = el("div", "models-note");
  note.innerHTML =
    "<ul>" +
    "<li>Restart <code>plan2code</code> to see a change in its model menu.</li>" +
    "<li>At any time, run <code>plan2code --model &lt;id&gt;</code>, or pick your model inside your agent before running a skill.</li>" +
    "<li>Updating Plan2Code refreshes the built-in list. Models you added stay, unless the built-in list now includes them.</li>" +
    "<li>Devin models are limited to Low, Medium and High effort.</li>" +
    "</ul>";
  const comes = el("div", "agent-field");
  comes.append(el("span", null, "Comes with Plan2Code"));
  if (ctx.saved.shipped[cli].length) comes.append(shipped);
  else comes.append(el("p", "help prefs-agents-none", `No models ship for ${BUILT_IN[cli]} yet; add your own below.`));
  const yours = agentField(
    "Models you added",
    "models",
    listEditor({ list: draft, kind: "models", field: "models", optionalName: false, addLabel: "Add a model", onChange: ctx.edited })
  );
  return [fold(ctx, "modelsOpen", "Models", "agent-fold", [note, comes, yours])];
}

function addedFields(ctx, draft) {
  const command = agentField("Command", "command", agentInput(ctx, draft, "command", "Command", "Program to run, such as myagent", true));
  command.append(agentTest(ctx, draft));
  const models = fold(ctx, "modelsOpen", "Models", "agent-fold", [
    agentField(
      "Models",
      "models",
      listEditor({ list: draft.models, kind: "models", field: "models", addLabel: "Add a model", onChange: ctx.edited })
    ),
  ]);
  const args = fold(ctx, "argsOpen", "Command-line arguments", "agent-fold prefs-agents-args", [
    agentField("Arguments", "args", listEditor({ list: draft.args, field: "args", placeholder: "--message={prompt}", addLabel: "Add an argument", aria: "Arguments", onChange: ctx.edited })),
    agentField("Bypass arguments", "bypassArgs", listEditor({ list: draft.bypassArgs, field: "bypassArgs", placeholder: "--yes-always", addLabel: "Add an argument", aria: "Bypass arguments", onChange: ctx.edited })),
    agentField("Model arguments", "modelArgs", listEditor({ list: draft.modelArgs, field: "modelArgs", placeholder: "--model={model}", addLabel: "Add an argument", aria: "Model arguments", onChange: ctx.edited })),
  ]);
  return [
    agentField("Name", "name", agentInput(ctx, draft, "name", "Name", "Name shown in the menu", true)),
    command,
    agentField("Start prompt", "prompt", agentInput(ctx, draft, "prompt", "Start prompt", "/plan2code (blank starts with nothing typed)", false)),
    models,
    args,
  ];
}

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
  const dirty = isDirty(ctx.saved, ctx.drafts, key);
  for (const sel of [".prefs-agents-save", ".prefs-agents-discard", ".prefs-unsaved-badge"]) foot.querySelector(sel).hidden = !dirty;
}

// Which field or button has focus, so a redraw (an id assigned, an error
// marked) puts the person back where they were: { nth, start, end }. What
// they typed is already in the draft the redraw reads.
const FORM_FOCUSABLE = "input, button, summary";

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

export function drawForm(ctx) {
  const pane = ctx.$("form");
  const key = ctx.openKey;
  const draft = ctx.drafts.get(key);
  const focus = formFocus(pane);
  pane.replaceChildren();
  const head = el("div", "form-head");
  const title = el("h3", "prefs-agents-title");
  title.tabIndex = -1;
  if (key.startsWith("cli:")) title.append(el("span", null, BUILT_IN[cliOf(key)]), el("code", null, cliOf(key)));
  else title.append(el("span", null, key === "agent:new" ? "New agent" : savedEntry(ctx.saved, key).name));
  head.appendChild(title);
  pane.appendChild(head);
  const fields = el("div", "prefs-agents-fields");
  fields.append(...(key.startsWith("cli:") ? builtInFields(ctx, cliOf(key), draft) : addedFields(ctx, draft)));
  pane.appendChild(fields);
  if (ctx.formError) {
    for (const input of pane.querySelectorAll("input")) {
      if (input.dataset.field === ctx.formError.field) input.classList.add("invalid");
    }
    pane.appendChild(el("p", "agent-error", ctx.formError.error));
  }
  if (ctx.formReplace && ctx.formReplace.length) pane.appendChild(el("p", "agent-error", ctx.formReplace.join(" ")));
  pane.appendChild(formFoot(ctx, key));
  renderDirty(ctx, key);
  restoreFormFocus(pane, focus);
}
