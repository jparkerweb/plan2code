// Plan2Code Web Console - the read-only Workspace of extra folders, and @mentions.

import { hooks, page } from "../state.js";
import { copyButton, el, lightDismiss, selectContents } from "../render.js";
import { selSpec, specList, workspaceFolders } from "../selectors.js";
import { postJson } from "../net.js";
import { nameProblem } from "../workspace.js";

// The Workspace dialog. The server is the only writer of workspace.json: the
// page asks through /workspace/*, and the new list comes back on the next
// frame, which redraws the dialog while it is open.

const $ = (id) => document.getElementById(id);

// Folders the agent reported it cannot read, each told once per page load
// and launch. The server keeps only the current launch's reports, so a name
// that drops out of the list may be told again after the next launch.
const issuesTold = new Set();

let issueBannerTimer = null;

export function tellFolderIssues() {
  const issues = (page.wsFrame && page.wsFrame.issues) || [];
  const names = new Set(issues.map((i) => i.name));
  for (const name of [...issuesTold]) if (!names.has(name)) issuesTold.delete(name);
  const fresh = issues.find((i) => !issuesTold.has(i.name));
  if (!fresh) return;
  issuesTold.add(fresh.name);
  const extras = [];
  if (fresh.hint) {
    extras.push(document.createTextNode(" "));
    extras.push(el("code", "banner-hint", fresh.hint));
  }
  const open = el("button", "btn tiny banner-action", "Open workspace");
  open.type = "button";
  open.addEventListener("click", () => {
    hooks.banner(null);
    openWorkspace();
  });
  extras.push(open);
  hooks.banner(`The agent can't read @${fresh.name}: ${fresh.reason}`, "warn", extras);
  clearTimeout(issueBannerTimer);
  // Then the next folder waiting to be told, if several came at once.
  issueBannerTimer = setTimeout(() => {
    if (page.gone) return;
    hooks.banner(null);
    tellFolderIssues();
  }, 15000);
}

export async function syncWorkspaceScope(spec) {
  if (!page.S || page.S.workflow !== "dashboard" || page.gone || !page.wsFrame) return;
  const want = spec === undefined ? (selSpec() && selSpec().dir) || "" : spec;
  page.scopeMine = want;
  if ((page.wsFrame.scope || "") === want || scopeAsked === want) return;
  scopeAsked = want;
  const { status, body } = await postJson("/workspace/scope", { spec: want });
  if (status === 200 && body && Array.isArray(body.folders)) page.wsFrame = { ...page.wsFrame, ...body };
  scopeAsked = null;
  if ($("workspace-modal").open) renderWorkspace();
}

let scopeAsked = null;

// The dialog's "Remembered for" line: whose list this is.
function workspaceScopeText() {
  const scope = (page.wsFrame && page.wsFrame.scope) || "";
  if (!scope) return "Remembered for this project, so your next console session here starts with these folders.";
  const spec = specList().find((s) => s.dir === scope);
  const name = spec ? spec.name : scope.split("/").pop();
  return `Remembered for the ${name} spec, and loaded again whenever it is picked.`;
}

const NAME_RULE = "Names use lowercase letters, numbers and hyphens.";

const BROWSE_UNAVAILABLE = "Browse isn't available here — type or paste the path.";

// The folder whose Remove is waiting on its inline confirm, by id.
let wsConfirm = null;

let wsBusy = false;

export async function openWorkspace() {
  const dlg = $("workspace-modal");
  try {
    const res = await fetch("/workspace?check=1", { cache: "no-store" });
    if (res.ok) page.wsFrame = await res.json();
  } catch {}
  wsConfirm = null;
  setAddMsg("");
  renderWorkspace();
  if (!dlg.open) dlg.showModal();
  $("workspace-path").focus();
}

function setAddMsg(text, kind, action) {
  const p = $("workspace-add-msg");
  p.className = "workspace-add-msg" + (kind ? " is-" + kind : "");
  p.textContent = text;
  if (action) p.appendChild(action);
}

// One <li> per folder, original first. A frame that keeps the same folders in
// the same order is painted into the rows already there, so a box someone is
// typing in keeps its text, caret and focus; any other change rebuilds.
export function renderWorkspace() {
  const list = $("workspace-list");
  const folders = workspaceFolders();
  const ids = folders.map((f) => f.id).join("\n");
  if (list.dataset.ids !== ids) {
    list.dataset.ids = ids;
    list.replaceChildren(...folders.map(workspaceRow));
  }
  folders.forEach((f, i) => paintWorkspaceRow(list.children[i], f));
  $("workspace-browse").hidden = Boolean(page.wsFrame && page.wsFrame.remote);
  $("workspace-scope").textContent = workspaceScopeText();
}

function workspaceRow(f) {
  const li = el("li", "ws-entry");
  li.dataset.fid = f.id;

  const head = el("div", "ws-head");
  head.appendChild(el("span", "ws-chip"));
  if (f.original) head.appendChild(el("span", "ws-original", "started here — can't be removed"));
  li.appendChild(head);

  const pathRow = el("div", "ws-path-row");
  const code = el("code", "ws-path");
  pathRow.appendChild(code);
  const copy = el("button", "btn small", "Copy path");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const folder = workspaceFolders().find((x) => x.id === f.id);
    if (!folder) return;
    try {
      await navigator.clipboard.writeText(folder.path);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy path"), 1500);
    } catch {
      // Refused: the path is selected instead, ready for Ctrl+C.
      selectContents(code);
      copy.textContent = "Press Ctrl+C";
    }
  });
  pathRow.appendChild(copy);
  if (!f.original) {
    const remove = el("button", "btn small danger ws-remove", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => {
      wsConfirm = f.id;
      renderWorkspace();
      li.querySelector(".ws-confirm .btn.danger")?.focus();
    });
    pathRow.appendChild(remove);
  }
  li.appendChild(pathRow);

  li.appendChild(el("div", "ws-marks"));
  li.appendChild(workspaceField(f, "name", "Name"));
  li.appendChild(workspaceField(f, "description", "What is it?"));
  return li;
}

// The Name and What-is-it boxes. Each saves on blur or Enter through
// /workspace/edit, and only when it holds something new.
function workspaceField(f, field, labelText) {
  const wrap = el("div", "ws-field");
  const id = `ws-${field}-${f.id}`;
  const label = el("label", null, labelText);
  label.htmlFor = id;
  const input = el("input");
  input.type = "text";
  input.id = id;
  input.dataset.field = field;
  input.autocomplete = "off";
  input.spellcheck = false;
  if (field === "description") input.maxLength = 200;
  const err = el("p", "field-error");
  err.hidden = true;
  const current = () => workspaceFolders().find((x) => x.id === f.id);
  const saved = () => (current() ? current()[field] || "" : "");
  const showError = (text) => {
    err.textContent = text || "";
    err.hidden = !text;
    input.classList.toggle("invalid", Boolean(text));
  };

  if (field === "name") {
    input.addEventListener("input", () => showError(nameProblem(input.value.trim()) ? NAME_RULE : ""));
  }
  const save = async (leaving) => {
    const value = input.value.trim();
    if (value === saved()) return showError("");
    if (field === "name" && nameProblem(value)) {
      if (!leaving) return showError(NAME_RULE);
      input.value = saved();
      return showError("");
    }
    const { status, body } = await postJson("/workspace/edit", { id: f.id, [field]: value });
    // An earlier "Added as @x" is out of date once the list moves on.
    if (status === 200) {
      setAddMsg("");
      return showError("");
    }
    if (body.reason === "name-taken") showError(`@${value} is taken — try @${body.suggest}.`);
    else if (body.reason === "bad-name") showError(NAME_RULE);
    else showError("That did not save. Try again.");
    if (leaving) input.value = saved();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    save(false);
  });
  input.addEventListener("blur", () => save(true));
  wrap.append(label, input, err);
  return wrap;
}

// Everything in a row that follows the frame. A box with focus is left as
// the person has it; every other box shows what is saved.
function paintWorkspaceRow(li, f) {
  if (!li) return;
  const missing = (page.wsFrame.missing || []).includes(f.id);
  const issue = (page.wsFrame.issues || []).find((x) => x.name === f.name);
  li.classList.toggle("is-missing", missing);
  li.querySelector(".ws-chip").textContent = "@" + f.name;
  li.querySelector(".ws-path").textContent = f.path;
  for (const input of li.querySelectorAll("input[data-field]")) {
    if (document.activeElement !== input) input.value = f[input.dataset.field] || "";
  }

  const marks = li.querySelector(".ws-marks");
  marks.replaceChildren();
  if (missing) marks.appendChild(el("p", "ws-mark is-missing", "This folder no longer exists"));
  if (issue) {
    marks.appendChild(el("p", "ws-mark is-issue", "The agent can't read this yet: " + issue.reason));
    if (issue.hint) {
      const row = el("div", "ws-hint-row");
      const code = el("code", "ws-hint", issue.hint);
      row.append(code, copyButton(issue.hint, "btn tiny", code));
      marks.appendChild(row);
    }
  }
  if (f.nested) marks.appendChild(el("p", "ws-mark is-nested", "Inside another folder in the list"));
  marks.hidden = !marks.children.length;

  // Built once per confirm, so a frame landing meanwhile keeps its focus.
  const open = li.querySelector(".ws-confirm");
  if (wsConfirm !== f.id) open?.remove();
  else if (open) open.querySelector("span").textContent = `Remove @${f.name}? The agent is told.`;
  else {
    const box = el("div", "ws-confirm");
    box.setAttribute("role", "alert");
    box.appendChild(el("span", null, `Remove @${f.name}? The agent is told.`));
    const keep = el("button", "btn small ghost", "Keep it");
    keep.type = "button";
    keep.addEventListener("click", () => {
      wsConfirm = null;
      renderWorkspace();
      li.querySelector(".ws-remove")?.focus();
    });
    const go = el("button", "btn small danger", "Remove");
    go.type = "button";
    go.addEventListener("click", async () => {
      go.disabled = true;
      const { status } = await postJson("/workspace/remove", { id: f.id });
      wsConfirm = null;
      if (status === 200) setAddMsg("");
      if (status !== 200) setAddMsg(`@${f.name} could not be removed. Try again.`, "error");
      renderWorkspace();
      $("workspace-path").focus();
    });
    box.append(keep, go);
    li.appendChild(box);
  }
}

// Add by typed path, or by a path Browse… came back with. `name` is only
// sent when the person took a suggested name after a clash.
async function addWorkspaceFolder(path, name) {
  const trimmed = String(path || "").trim();
  if (!trimmed || wsBusy) return;
  wsBusy = true;
  $("workspace-add").disabled = true;
  const { status, body } = await postJson("/workspace/add", name ? { path: trimmed, name } : { path: trimmed });
  wsBusy = false;
  $("workspace-add").disabled = false;
  if (status === 200) {
    $("workspace-path").value = "";
    setAddMsg(`Added as @${body.name}.` + (body.nested ? " It's inside another folder in the list." : ""), "good");
    if (body.name && page.wsFrame && !workspaceFolders().some((f) => f.id === body.id)) {
      page.wsFrame = { ...page.wsFrame, folders: [...workspaceFolders(), body] };
    }
    renderWorkspace();
    hooks.renderWhere();
    return;
  }
  switch (body.reason) {
    case "not-a-folder":
      return setAddMsg("That isn't a folder on this machine.", "error");
    case "duplicate":
      return setAddMsg(`Already in the workspace as @${body.name}.`, "error");
    case "name-taken": {
      const taken = name || String(body.suggest || "").replace(/-\d+$/, "");
      const use = el("button", "btn tiny", `Use @${body.suggest}`);
      use.type = "button";
      use.addEventListener("click", () => addWorkspaceFolder(trimmed, body.suggest));
      return setAddMsg(`@${taken} is taken — try @${body.suggest}.`, "error", use);
    }
    case "bad-name":
      return setAddMsg(NAME_RULE, "error");
    default:
      return setAddMsg("That folder could not be added. Try again.", "error");
  }
}

async function browseWorkspace() {
  const b = $("workspace-browse");
  if (b.disabled) return;
  b.disabled = true;
  setAddMsg("Waiting for the folder picker…");
  const { status, body } = await postJson("/workspace/browse", {});
  b.disabled = false;
  if (status === 200 && body.path) {
    setAddMsg("");
    return addWorkspaceFolder(body.path);
  }
  if (status === 200 && body.cancelled) return setAddMsg("");
  setAddMsg(BROWSE_UNAVAILABLE, "error");
}

// The dialog's buttons, and the footer label that opens it.
export function wireWorkspace() {
  lightDismiss($("workspace-modal"));
  $("workspace-add").addEventListener("click", () => addWorkspaceFolder($("workspace-path").value));
  $("workspace-path").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addWorkspaceFolder(e.currentTarget.value);
  });
  $("workspace-browse").addEventListener("click", browseWorkspace);
  $("workspace-done").addEventListener("click", () => $("workspace-modal").close());
  $("workspace-modal").addEventListener("close", () => {
    wsConfirm = null;
    $("footer-where").focus();
  });
  // As on Help: the page-wide Ctrl/Cmd+Enter stands down while a dialog is open,
  // and this keeps the key inside the Workspace dialog as well.
  $("workspace-modal").addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  // The workspace label opens the Workspace dialog; each folder's Copy path
  // lives in there now.
  $("footer-where").addEventListener("click", openWorkspace);
}
