// Plan2Code Web Console - the Changes tab: a diff block drawn as a file list and one unified diff; defines only.
//
// The block is `{ id, diff: "changes.diff", text }` (or `{ id, error }` when
// the agent could not read the changes). Diff text is file content from the
// repository, so every node is built with el() and filled with textContent:
// nothing from it ever goes through innerHTML or md().

import { el } from "./render.js";
import { parseDiff } from "./diff-parse.js";
import { agentWorking, workingMs, patience, WORKING_GRACE_MS } from "./selectors.js";
import { hooks, page, redraw } from "./state.js";
import { sendState } from "./send-state.js";

// The picked file and the scroll of each pane, per diff block, so a redraw
// of the same block keeps the person where they were.
const picks = new Map();
// The last parse of each block's text: a redraw does not parse again.
const parsed = new Map();

const blockKey = (b) => String(b.id || "") + "|" + String(b.diff || "");

function parseOnce(b) {
  const key = blockKey(b);
  const hit = parsed.get(key);
  if (hit && hit.text === b.text) return hit.result;
  const result = parseDiff(b.text);
  parsed.set(key, { text: b.text, result });
  return result;
}

const baseName = (p) => String(p || "").split("/").pop();
const folderOf = (p) => {
  const parts = String(p || "").split("/");
  parts.pop();
  return parts.join("/");
};

// What a rename row reads: old -> new, by name when the folder stayed.
function renameLabel(f) {
  return folderOf(f.oldPath) === folderOf(f.path) ? `${baseName(f.oldPath)} → ${baseName(f.path)}` : `${f.oldPath} → ${f.path}`;
}

const STATUS_WORD = { added: "Added", deleted: "Deleted", renamed: "Renamed" };

function counts(f) {
  const box = el("span", "diff-counts");
  box.appendChild(el("span", "diff-plus", `+${f.added}`));
  box.appendChild(el("span", "diff-minus", `-${f.removed}`));
  return box;
}

/* --------------------------------------------------------------- states */

// Asks the agent to read the changes again. Refused whenever Send itself
// would be (a finished or paused session, the loop building, no connection),
// and, as the brief button is, while a turn is in flight.
async function askAgain(button, status, reply) {
  const state = sendState(true);
  if (state.disabled || page.gone || page.pendingResult || (agentWorking() && workingMs() <= patience(WORKING_GRACE_MS))) {
    status.textContent = state.why || "Wait for Plan2Code to finish, then ask again.";
    return;
  }
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Asking…";
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: [{ i: "__changes", type: "changes" }], reply }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    hooks.banner("Asked for the changes again. The tab updates when they are read.", "good");
    setTimeout(() => hooks.banner(null), 5000);
    page.pendingResult = true;
    redraw();
  } catch (err) {
    if (err && err.pending) page.pendingResult = true;
    status.textContent =
      err && err.pending ? "Your last answers are still being picked up. Try again in a moment." : "That did not go through. Try again in a moment.";
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function stateBox(kind, message, buttonLabel, reply) {
  const box = el("div", "diff-state diff-" + kind);
  box.appendChild(el("p", "diff-state-msg", message));
  if (buttonLabel) {
    const btn = el("button", "btn small diff-again", buttonLabel);
    btn.type = "button";
    const status = el("p", "diff-state-why");
    status.setAttribute("role", "status");
    btn.addEventListener("click", () => askAgain(btn, status, reply));
    box.appendChild(btn);
    box.appendChild(status);
  }
  return box;
}

function drawLoading() {
  const view = el("div", "diff-view is-loading");
  view.setAttribute("aria-busy", "true");
  view.appendChild(el("p", "diff-totals", "Reading the changes…"));
  const cols = el("div", "diff-cols");
  const list = el("div", "diff-list diff-skeleton");
  for (let i = 0; i < 4; i++) list.appendChild(el("span", "diff-skel-row"));
  const pane = el("div", "diff-pane diff-skeleton");
  for (let i = 0; i < 8; i++) pane.appendChild(el("span", "diff-skel-row"));
  cols.appendChild(list);
  cols.appendChild(pane);
  view.appendChild(cols);
  return view;
}

/* ---------------------------------------------------------------- ready */

function drawHunks(f) {
  if (f.binary) return el("p", "diff-plain", "Binary file: no lines to show");
  if (f.hidden) return el("p", "diff-plain", "Lines hidden: this file may hold a secret");
  if (f.truncated) return el("p", "diff-plain", "Too large to show in full: this file is listed only");
  if (!f.hunks.length) return el("p", "diff-plain", f.status === "renamed" ? "Renamed only: no lines changed" : "No lines changed");
  const code = el("div", "diff-code");
  const rows = el("div", "diff-rows");
  for (const h of f.hunks) {
    rows.appendChild(el("div", "diff-hunk", h.header));
    for (const l of h.lines) {
      const row = el("div", "diff-line " + l.kind);
      row.appendChild(el("span", "diff-no", l.oldNo == null ? "" : String(l.oldNo)));
      row.appendChild(el("span", "diff-no", l.newNo == null ? "" : String(l.newNo)));
      row.appendChild(el("span", "diff-sign", l.kind === "add" ? "+" : l.kind === "del" ? "-" : ""));
      row.appendChild(el("code", "diff-text", l.text));
      rows.appendChild(row);
    }
  }
  code.appendChild(rows);
  return code;
}

function drawPane(f) {
  const pane = el("section", "diff-pane");
  pane.setAttribute("aria-label", "Lines of " + f.path);
  const head = el("header", "diff-pane-head");
  head.appendChild(el("strong", "diff-pane-path", f.status === "renamed" ? `${f.oldPath} → ${f.path}` : f.path));
  head.appendChild(counts(f));
  pane.appendChild(head);
  pane.appendChild(drawHunks(f));
  return pane;
}

function drawReady(b, result) {
  const key = blockKey(b);
  const files = result.files;
  const memory = picks.get(key) || {};
  let picked = files.findIndex((f) => f.path === memory.path);
  if (picked < 0) picked = 0;

  const view = el("div", "diff-view");
  const added = files.reduce((n, f) => n + f.added, 0);
  const removed = files.reduce((n, f) => n + f.removed, 0);
  const totals = el("p", "diff-totals");
  totals.appendChild(el("span", null, `${files.length} ${files.length === 1 ? "file" : "files"} changed, `));
  totals.appendChild(el("span", "diff-plus", `+${added}`));
  totals.appendChild(document.createTextNode(" "));
  totals.appendChild(el("span", "diff-minus", `-${removed}`));
  view.appendChild(totals);
  if (result.tooLarge) {
    view.appendChild(el("p", "diff-notice", "This change is too large to show in full: every file is listed, but some show no lines."));
  }

  const cols = el("div", "diff-cols");
  const list = el("ul", "diff-list");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Changed files");
  list.tabIndex = 0;
  const idBase = "diff-" + String(b.id || "block").replace(/[^A-Za-z0-9_-]/g, "") + "-";
  const rows = files.map((f, i) => {
    const row = el("li", "diff-file");
    row.id = idBase + i;
    row.setAttribute("role", "option");
    const name = el("span", "diff-file-name");
    name.appendChild(el("strong", null, f.status === "renamed" ? renameLabel(f) : baseName(f.path)));
    if (STATUS_WORD[f.status]) name.appendChild(el("span", "diff-status diff-status-" + f.status, STATUS_WORD[f.status]));
    row.appendChild(name);
    const folder = folderOf(f.path);
    if (folder) row.appendChild(el("span", "diff-file-dir", folder));
    row.appendChild(counts(f));
    row.addEventListener("click", () => pick(i, false));
    list.appendChild(row);
    return row;
  });
  cols.appendChild(list);
  let pane = drawPane(files[picked]);
  cols.appendChild(pane);
  view.appendChild(cols);

  const remember = () => {
    picks.set(key, {
      path: files[picked].path,
      listTop: list.scrollTop,
      paneTop: pane.scrollTop,
      paneLeft: pane.scrollLeft,
    });
  };
  const watch = () => pane.addEventListener("scroll", remember, { passive: true });
  function mark() {
    rows.forEach((r, i) => {
      r.setAttribute("aria-selected", i === picked ? "true" : "false");
      r.classList.toggle("is-picked", i === picked);
    });
    list.setAttribute("aria-activedescendant", rows[picked].id);
  }
  function pick(i, fromKeys) {
    if (i < 0 || i >= files.length) return;
    const changed = i !== picked;
    picked = i;
    mark();
    if (changed) {
      const next = drawPane(files[picked]);
      pane.replaceWith(next);
      pane = next;
      watch();
    }
    if (fromKeys) rows[picked].scrollIntoView({ block: "nearest" });
    remember();
  }
  list.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    const jump = { Home: 0, End: files.length - 1 }[e.key];
    if (step === undefined && jump === undefined) return;
    e.preventDefault();
    pick(step !== undefined ? picked + step : jump, true);
  });
  list.addEventListener("scroll", remember, { passive: true });
  watch();
  mark();

  // Back to where the person was once the view is on the page (a fresh
  // element has no layout to scroll yet).
  if (memory.path === files[picked].path) {
    requestAnimationFrame(() => {
      list.scrollTop = memory.listTop || 0;
      pane.scrollTop = memory.paneTop || 0;
      pane.scrollLeft = memory.paneLeft || 0;
    });
  }
  picks.set(key, { ...memory, path: files[picked].path });
  return view;
}

/* ----------------------------------------------------------------- entry */

// One diff block as the Changes tab. `doc` is the block's document, when
// known: a doc marked stale is still being read again.
export function drawDiff(b, doc) {
  if (typeof b.error === "string" && b.error.trim()) {
    return wrap(stateBox("error", `The changes could not be read: ${b.error.trim()}`, "Reload the changes", "Please refresh the Changes tab."));
  }
  if (typeof b.text !== "string" || (doc && doc.stale)) return drawLoading();
  const result = parseOnce(b);
  if (result.bad) {
    return wrap(stateBox("error", "The changes could not be read: the diff is not in a shape this page can draw.", "Reload the changes", "Please refresh the Changes tab."));
  }
  if (!result.files.length) {
    return wrap(stateBox("empty", "Nothing has changed since this run started.", "Check again", "Please refresh the Changes tab."));
  }
  return drawReady(b, result);
}

function wrap(box) {
  const view = el("div", "diff-view");
  view.appendChild(box);
  return view;
}
