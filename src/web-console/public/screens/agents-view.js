// Plan2Code Web Console - the agents view's mount, state and server calls.
//
// One mount serves the User Preferences Agents & models tab and the
// agent-less setup page. Preferences draws a roster of agent cards
// (agents-summary.js) with the picked agent's form in a side drawer
// (agents-form.js) and an Add agent chooser where the starter templates are an
// opt-in; the setup page keeps a master-detail split, its list on the left and
// the picked entry's state (or the same form) in the right pane. The row-list
// editor shared by every list field is agents-list-editor.js and the pure
// helpers underneath are agents-data.js. Picking a card or row is the
// navigation; there is no back page.
// Nothing saves as it changes: a form edits a draft, and its Save sends the
// saved list with only that draft swapped in, so a half-typed command line
// never reaches agents.json or models.json.

import { el } from "../render.js";
import { hooks } from "../state.js";
import {
  MODEL_CLIS,
  emptyLists,
  emptyStrengths,
  newAgent,
  normalizeAgent,
  cliOf,
  agentId,
  savedEntry,
  isDirty,
  nameOf,
  cleanAgent,
  templateDraft,
} from "./agents/agents-data.js";
import { renderSummary, drawSummaryPane, drawBadge, drawChooser, markTemplateState } from "./agents/agents-summary.js";
import { drawForm, renderDirty } from "./agents/agents-form.js";

/**
 * Mount the agents view on `container`. `opts`:
 *   mode           "prefs" (the summary list) or "setup" (the pick list)
 *   forCli         setup only: the one built-in a start is wanted for, or null;
 *                    a function returning it is also accepted, so a session's
 *                    forCli updated by use-path reaches the Start gate
 *   onStart        setup only: called with the agent a Start press picks
 *   onFound        setup only: called with an entry whose state turned
 *                    "found" on a reload
 *   confirmUnsaved leaving a dirty form's unsaved check; the prefs dialog's by default
 *
 * Returns { load, wire, hasUnsaved, unsavedName, saveOpen, discardOpen,
 * focusOpen }: what the dialog drives through hooks.*.
 */
export function mountAgentsView(container, opts = {}) {
  const mode = opts.mode === "setup" ? "setup" : "prefs";
  // A built-in saved by use-path takes over as the forCli target: the server's
  // session state updates too, but the response's saved id beats the lag.
  let movedForCli = null;
  const forCli = () => {
    if (movedForCli) return movedForCli;
    const v = typeof opts.forCli === "function" ? opts.forCli() : opts.forCli;
    return typeof v === "string" && v ? v : null;
  };
  const onStart = typeof opts.onStart === "function" ? opts.onStart : null;
  // Setup only: called with an entry whose state turned "found" on a reload
  // (Check again, Use it from here), never for one already found at open.
  const onFound = typeof opts.onFound === "function" ? opts.onFound : null;
  // The state each entry's id last showed, kept across loads for onFound.
  const seenStates = new Map();
  // Back out of a form: the caller's own unsaved check, else the dialog's.
  const confirmUnsaved = typeof opts.confirmUnsaved === "function" ? opts.confirmUnsaved : () => hooks.confirmUnsaved();

  const $ = (id) => container.querySelector(`[data-av="${id}"]`);

  // A mount on a bare box (the setup screen) gets the same split scaffold the
  // prefs markup carries, built here so two mounts never share an id.
  if (!$("form")) {
    const intro = el("p", "help", "Every agent Plan2Code knows, and whether this computer can start it yet.");
    intro.dataset.av = "intro";
    const split = el("div", "split");
    const list = el("div", "split-list");
    list.dataset.av = "table";
    const add = el("button", "btn small ghost split-add", "Add agent");
    add.type = "button";
    add.dataset.av = "add";
    list.appendChild(add);
    const pane = el("div", "split-pane");
    pane.dataset.av = "form";
    split.append(list, pane);
    const status = el("span", "help");
    status.dataset.av = "status";
    status.setAttribute("role", "status");
    container.append(intro, split, status);
  }

  // Everything the renderers read or reach for lives here on the context:
  // the mount owns every piece of state and every server call, and only
  // hands the components a way to draw and to ask for what happens next.
  const ctx = {
    mode,
    $,
    // The last server reply for each list. Unknown keys on an agent ride along
    // untouched; builtins and templates only feed the setup pick list.
    saved: { agents: [], user: emptyLists(), shipped: emptyLists(), builtins: [], templates: [], strengths: emptyStrengths() },
    // The person's own strength rows per form key, once the fold changed them
    // (agents-strengths.js); a form with no entry has not touched its fold.
    strengthDrafts: new Map(),
    strengthsOpen: false,
    // The open fold's redraw, set by the fold itself.
    strengthsRefresh: null,
    // Whether GET /models answered: without it the page holds none of the
    // person's models or strengths, so the fold stays away and no save sends them.
    modelsLoaded: false,
    // At most one per form being edited: "cli:<cli>" for a built-in's own models,
    // "agent:<id>" for an added agent, "agent:new" for one being added.
    drafts: new Map(),
    // The form on screen (a drafts key), or null while the pane shows the
    // empty text or, in setup, the picked entry's state ("setup:<id>").
    openKey: null,
    setupSel: null,
    // The server's complaint about the open form, { field, error }, and a 409's
    // warnings while Save anyway is on offer.
    formError: null,
    formReplace: null,
    // The drawer's tab ("models" or "launch"), the template a new agent was
    // started from (its name, for the form's head), and whether the Add agent
    // chooser is up; templateState remembers each template command's check.
    tab: "models",
    draftFrom: null,
    chooserOpen: false,
    templateState: new Map(),
    // Delete agent waiting for its second click; the folds' open state, kept
    // across redraws.
    confirming: false,
    argsOpen: false,
    modelsOpen: false,
    // The badge each summary row last showed, by row key: { command, state }.
    found: new Map(),
    forCli,
    onStart,
    confirmUnsaved,
    pick,
    pickSetup,
    openChooser,
    closeChooser,
    startNew,
    closeDrawer,
    save: (key, options) => saveForm(key, options),
    discard: () => discardOpen(),
    deleteAgent,
    useFromHere,
    checkFound: (rows) => checkFound(rows, loadSeq),
    testCommand,
    edited,
    drawForm: () => drawForm(ctx),
  };

  // Each open of the tab loads afresh: only the newest load's answers are drawn.
  let loadSeq = 0;

  // Whether the status line says "Deleted.", which the next form opened clears
  // (load warnings stay until the next open).
  let deletedNote = false;

  function setAgentsStatus(text, isError, { deleted = false } = {}) {
    const status = $("status");
    status.textContent = text;
    status.classList.toggle("error", Boolean(isError));
    deletedNote = deleted;
  }

  /* ----------------------------------------------------- moving around */

  // The pane: the open form, else the picked entry's state or the empty text.
  function drawPane() {
    if (ctx.openKey) drawForm(ctx);
    else drawSummaryPane(ctx);
  }

  // Preferences only: the drawer shows while a form is open, and the roster
  // behind it is out of reach (it also sits behind a scrim).
  function syncDrawer() {
    const drawer = $("drawer");
    if (!drawer) return;
    drawer.hidden = !ctx.openKey;
    const behind = Boolean(ctx.openKey || ctx.chooserOpen);
    $("table").inert = behind;
    if ($("add")) $("add").inert = behind;
  }

  function syncChooser() {
    const box = $("chooser");
    if (!box) return;
    box.hidden = !ctx.chooserOpen;
    syncDrawer();
  }

  function edited() {
    if (ctx.openKey) {
      // A model added or removed changes what the strengths fold may pick.
      if (ctx.strengthsRefresh) ctx.strengthsRefresh();
      renderDirty(ctx, ctx.openKey);
    }
  }

  // Leaving a form for another row drops its draft, as closing it always did:
  // a dirty one asks first (the dialog's Save / Discard / Keep editing).
  async function leaveForm() {
    if (!ctx.openKey) return true;
    if (isDirty(ctx.saved, ctx.drafts, ctx.openKey, ctx.strengthDrafts) && !(await confirmUnsaved())) return false;
    ctx.drafts.delete(ctx.openKey);
    ctx.strengthDrafts.delete(ctx.openKey);
    ctx.openKey = null;
    ctx.draftFrom = null;
    return true;
  }

  // A prefs row (or Add agent): the pick itself is the navigation.
  async function pick(key) {
    if (key === ctx.openKey) return;
    if (!(await leaveForm())) return;
    openForm(key);
  }

  // A setup row: the pane shows the entry's state, not a form.
  async function pickSetup(key) {
    if (ctx.setupSel === key && !ctx.openKey) return;
    if (!(await leaveForm())) return;
    ctx.setupSel = key;
    renderSummary(ctx);
    drawPane();
  }

  function openForm(key) {
    if (deletedNote) setAgentsStatus("", false);
    ctx.openKey = key;
    ctx.formError = null;
    ctx.formReplace = null;
    ctx.confirming = false;
    ctx.strengthsOpen = false;
    ctx.tab = key === "agent:new" ? "launch" : "models";
    ctx.argsOpen = key === "agent:new";
    // A built-in's only section is its models: folded it would show nothing.
    ctx.modelsOpen = key.startsWith("cli:");
    if (mode === "setup") ctx.setupSel = key.startsWith("agent:") && key !== "agent:new" ? "setup:" + agentId(key) : null;
    if (!ctx.drafts.has(key)) ctx.drafts.set(key, structuredClone(key === "agent:new" ? newAgent() : savedEntry(ctx.saved, key)));
    renderSummary(ctx);
    syncDrawer();
    drawForm(ctx);
    // A form of fields starts in its first one; the models list would scroll to its add row, so it starts on its tab.
    const first = ctx.tab === "launch" ? $("form").querySelector(".prefs-agents-fields input") : null;
    (first || $("form").querySelector('.agent-tab[aria-selected="true"]'))?.focus();
  }

  // The form goes back to the empty or picked pane; focus goes to the row
  // just left, or to Add agent when that row is gone (a new agent not saved,
  // one just deleted).
  function closeForm() {
    const left = ctx.openKey;
    if (ctx.openKey) {
      ctx.drafts.delete(ctx.openKey);
      ctx.strengthDrafts.delete(ctx.openKey);
    }
    ctx.openKey = null;
    ctx.draftFrom = null;
    ctx.formError = null;
    ctx.formReplace = null;
    ctx.confirming = false;
    renderSummary(ctx);
    drawPane();
    syncDrawer();
    const rowKey = left && mode === "setup" && left.startsWith("agent:") ? "setup:" + agentId(left) : left;
    const row = rowKey && $("table").querySelector(`[data-key="${CSS.escape(rowKey)}"]`);
    (row || $("add")).focus();
  }

  const agentCardFor = (key) => $("table").querySelector(`[data-key="${CSS.escape(key)}"]`);

  // The drawer's way out (Close, its scrim, Esc): a dirty draft asks first.
  async function closeDrawer() {
    const left = ctx.openKey;
    if (!left) return;
    if (!(await leaveForm())) return focusOpen();
    ctx.formError = null;
    ctx.formReplace = null;
    ctx.confirming = false;
    renderSummary(ctx);
    drawPane();
    syncDrawer();
    (agentCardFor(left) || $("add"))?.focus();
  }

  // Add agent: the chooser, with the templates as an opt-in. Picking a tile is
  // what starts the draft (and asks about an unsaved one first).
  function openChooser() {
    ctx.chooserOpen = true;
    drawChooser(ctx);
    syncChooser();
    $("chooser").querySelector(".chooser-tile:not(:disabled)")?.focus();
    for (const t of ctx.saved.templates) checkTemplate(t.command);
  }

  function closeChooser() {
    ctx.chooserOpen = false;
    syncChooser();
    $("add")?.focus();
  }

  // Whether a template's command is on this computer, asked once per load.
  async function checkTemplate(command) {
    let state = ctx.templateState.get(command) || "unknown";
    if (state === "unknown") {
      try {
        const res = await fetch("/agents/test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command }),
        });
        if (res.ok) state = (await res.json()).found ? "ok" : "missing";
      } catch {}
      ctx.templateState.set(command, state);
    }
    if (ctx.chooserOpen) markTemplateState(ctx, command, state);
  }

  async function startNew(template) {
    if (!(await leaveForm())) return;
    ctx.chooserOpen = false;
    syncChooser();
    ctx.drafts.set("agent:new", structuredClone(template ? templateDraft(template) : newAgent()));
    openForm("agent:new");
    ctx.draftFrom = template ? template.name : null;
    drawForm(ctx);
  }

  /* ------------------------------------------------------------- badges */

  // Whether each row's command is on PATH, all at once. /agents/test only
  // resolves the command and never runs it.
  async function checkFound(rows, seq) {
    await Promise.all(
      rows.map(async (row) => {
        let state = "unknown";
        try {
          const res = await fetch("/agents/test", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ command: row.command }),
          });
          if (res.ok) state = (await res.json()).found ? "ok" : "missing";
        } catch {}
        if (seq !== loadSeq) return;
        ctx.found.set(row.key, { command: row.command, state });
        const badge = $("table").querySelector(`[data-key="${CSS.escape(row.key)}"] .prefs-badge`);
        if (badge) drawBadge(badge, state);
      })
    );
  }

  // The command's Test: where it would run from. Never saves.
  async function testCommand(command) {
    try {
      const res = await fetch("/agents/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const body = await res.json();
      if (!res.ok) return body.error || "Could not test.";
      return body.found ? "Found at " + body.path : "Not found on PATH";
    } catch {
      return "Could not test.";
    }
  }

  // "Use it from here" re-points the agent at the found location (the server
  // writes it, the page never sends a path). Gone between the look and the
  // press is the one failure the status line gets.
  async function useFromHere(entry) {
    try {
      const res = await fetch("/agents/use-path", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body && typeof body.id === "string" && entry.id === forCli()) movedForCli = body.id;
        return load();
      }
    } catch {}
    setAgentsStatus("That agent can no longer be found.", true);
  }

  /* ------------------------------------------------------------- saving */

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { res, body: await res.json() };
  }

  // The form's foot, for the Saved mark (or the error in its place).
  const formMark = (result) => hooks.markSaved($("form").querySelector(".prefs-agents-foot"), result);

  // Fresh from what was just saved: the form redraws on a clean draft.
  function savedAs(key) {
    ctx.drafts.delete(ctx.openKey);
    ctx.strengthDrafts.delete(ctx.openKey);
    ctx.openKey = key;
    ctx.drafts.set(key, structuredClone(savedEntry(ctx.saved, key)));
    ctx.draftFrom = null;
    ctx.formError = null;
    ctx.formReplace = null;
    renderSummary(ctx);
    drawForm(ctx);
  }

  // The strengths mapping to send for `owner` (a built-in's cli or an added
  // agent's id): every other agent's saved rows that still name a known agent
  // (a deleted agent's rows drop out here), plus the owner's own rows. Those are
  // the form's draft when its fold changed, else what is saved, keeping only
  // rows whose model is still in `modelIds`.
  function strengthsToSend(owner, key, modelIds) {
    const known = new Set([...MODEL_CLIS, ...ctx.saved.agents.map((a) => a.id)]);
    const out = {};
    for (const [id, rows] of Object.entries(ctx.saved.strengths.user)) if (id !== owner && known.has(id)) out[id] = rows;
    const mine = ctx.strengthDrafts.has(key) ? ctx.strengthDrafts.get(key) : ctx.saved.strengths.user[owner] || {};
    const kept = Object.fromEntries(Object.entries(mine).filter(([, row]) => row && modelIds.includes(row.model)));
    if (Object.keys(kept).length) out[owner] = kept;
    return out;
  }

  async function saveModelsFor(cli) {
    const key = "cli:" + cli;
    const sent = ctx.drafts.get(key).filter((m) => m.id);
    try {
      const modelIds = [...ctx.saved.shipped[cli], ...sent].map((m) => m.id);
      const payload = { models: { ...ctx.saved.user, [cli]: sent } };
      if (ctx.modelsLoaded) payload.strengths = strengthsToSend(cli, key, modelIds);
      const { res, body } = await postJson("/models", payload);
      if (!res.ok) {
        formMark({ ok: false, error: body.error || "Could not save." });
        return false;
      }
      ctx.saved.user[cli] = (body.user && body.user[cli]) || sent;
      if (ctx.modelsLoaded) ctx.saved.strengths.user = body.strengths || {};
    } catch {
      formMark({ ok: false, error: "Could not save." });
      return false;
    }
    savedAs("cli:" + cli);
    formMark({ ok: true, text: "Saved. Restart plan2code to use it." });
    return true;
  }

  async function saveAgentFor(key, { replace = false } = {}) {
    const draft = ctx.drafts.get(key);
    const isNew = key === "agent:new";
    if (isNew && (!String(draft.name || "").trim() || !String(draft.command || "").trim())) {
      ctx.formError = { field: String(draft.name || "").trim() ? "command" : "name", error: "Give it a name and a command first." };
      ctx.tab = "launch";
      drawForm(ctx);
      return false;
    }
    const at = isNew ? ctx.saved.agents.length : ctx.saved.agents.findIndex((a) => a.id === agentId(key));
    const agents = ctx.saved.agents.map((a) => cleanAgent(a));
    agents.splice(at, isNew ? 0 : 1, cleanAgent(draft));
    try {
      const { res, body } = await postJson("/agents", replace ? { agents, replace: true } : { agents });
      if (res.status === 409) {
        ctx.formError = { field: null, error: body.error || "Not saved." };
        ctx.formReplace = Array.isArray(body.warnings) ? body.warnings : [];
        drawForm(ctx);
        return false;
      }
      if (!res.ok) {
        ctx.formError = { field: body.index === at ? body.field : null, error: body.error || "Could not save." };
        if (ctx.formError.field) ctx.tab = ctx.formError.field === "models" ? "models" : "launch";
        ctx.formReplace = null;
        drawForm(ctx);
        return false;
      }
      ctx.saved.agents = (Array.isArray(body.agents) ? body.agents : agents).map(normalizeAgent);
    } catch {
      formMark({ ok: false, error: "Could not save." });
      return false;
    }
    const id = ctx.saved.agents[at].id;
    // The fold's rows ride a second save into models.json, under the id the
    // agent has now (a new agent only gets one from the first).
    const modelIds = draft.models.map((m) => m.id).filter(Boolean);
    const savedRows = ctx.saved.strengths.user[id] || {};
    const stale = Object.values(savedRows).some((row) => row && !modelIds.includes(row.model));
    if (ctx.modelsLoaded && (ctx.strengthDrafts.has(key) || stale)) {
      // The agent itself is saved by now: on a failure the form moves to its
      // saved id, keeps the fold's unsaved rows and says what did not land.
      const strengthsFailed = (message) => {
        const mine = ctx.strengthDrafts.get(key);
        ctx.found.delete(key);
        ctx.found.delete("agent:" + id);
        savedAs("agent:" + id);
        if (mine !== undefined) ctx.strengthDrafts.set("agent:" + id, mine);
        drawForm(ctx);
        formMark({ ok: false, error: message });
        return false;
      };
      try {
        const { res, body } = await postJson("/models", { models: ctx.saved.user, strengths: strengthsToSend(id, key, modelIds) });
        if (!res.ok) return strengthsFailed(body.error || "Saved, but the strengths could not be.");
        ctx.saved.strengths.user = body.strengths || {};
      } catch {
        return strengthsFailed("Saved, but the strengths could not be.");
      }
    }
    ctx.found.delete(key);
    ctx.found.delete("agent:" + id);
    savedAs("agent:" + id);
    formMark({ ok: true });
    return true;
  }

  function saveForm(key, options) {
    return key.startsWith("cli:") ? saveModelsFor(cliOf(key)) : saveAgentFor(key, options);
  }

  async function deleteAgent(key) {
    const agents = ctx.saved.agents.filter((a) => a.id !== agentId(key)).map(cleanAgent);
    ctx.confirming = false;
    try {
      const { res, body } = await postJson("/agents", { agents });
      if (!res.ok) {
        ctx.formError = { field: null, error: body.error || "Could not delete." };
        drawForm(ctx);
        return;
      }
      ctx.saved.agents = (Array.isArray(body.agents) ? body.agents : agents).map(normalizeAgent);
    } catch {
      ctx.formError = { field: null, error: "Could not delete." };
      drawForm(ctx);
      return;
    }
    ctx.found.delete(key);
    closeForm();
    setAgentsStatus("Deleted.", false, { deleted: true });
  }

  /* ------------------------------------------------------------- the dialog's side */

  // An open form whose draft differs from what is saved.
  function hasUnsaved() {
    return ctx.openKey !== null && isDirty(ctx.saved, ctx.drafts, ctx.openKey, ctx.strengthDrafts);
  }

  // What the unsaved prompt calls the open form.
  function unsavedName() {
    return ctx.openKey ? nameOf(ctx.saved, ctx.drafts, ctx.openKey) : "";
  }

  function saveOpen() {
    return ctx.openKey ? saveForm(ctx.openKey) : Promise.resolve(true);
  }

  function discardOpen() {
    if (!ctx.openKey) return;
    if (ctx.openKey === "agent:new") return closeForm();
    ctx.drafts.set(ctx.openKey, structuredClone(savedEntry(ctx.saved, ctx.openKey)));
    ctx.strengthDrafts.delete(ctx.openKey);
    ctx.formError = null;
    ctx.formReplace = null;
    ctx.confirming = false;
    drawForm(ctx);
  }

  // Back into the form after Keep editing or a failed Save: the marked field, else the first.
  function focusOpen() {
    const form = $("form");
    (form.querySelector("input.invalid") || form.querySelector('.agent-tab[aria-selected="true"]'))?.focus();
  }

  // Each time the dialog opens: the list, from the server. The setup mount
  // wants only the agents answer (its builtins and templates ride in it); the
  // prefs list also wants the model lists.
  async function load() {
    const seq = ++loadSeq;
    ctx.openKey = null;
    ctx.draftFrom = null;
    ctx.chooserOpen = false;
    ctx.templateState.clear();
    ctx.drafts.clear();
    ctx.strengthDrafts.clear();
    ctx.found.clear();
    ctx.formError = null;
    ctx.formReplace = null;
    ctx.confirming = false;
    const [agents, models] = await Promise.all([
      fetch("/agents").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      mode === "setup" ? Promise.resolve(null) : fetch("/models").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (seq !== loadSeq) return;
    const problems = [];
    if (agents) {
      ctx.saved.agents = (Array.isArray(agents.agents) ? agents.agents : []).map(normalizeAgent);
      ctx.saved.builtins = Array.isArray(agents.builtins) ? agents.builtins : [];
      ctx.saved.templates = Array.isArray(agents.templates) ? agents.templates : [];
      if (Array.isArray(agents.warnings)) problems.push(...agents.warnings);
    } else {
      ctx.saved.agents = [];
      ctx.saved.builtins = [];
      ctx.saved.templates = [];
      problems.push("Agents could not be loaded.");
    }
    ctx.saved.user = emptyLists();
    ctx.saved.shipped = emptyLists();
    ctx.saved.strengths = emptyStrengths();
    ctx.modelsLoaded = Boolean(models);
    if (models) {
      // A failed or missing strengths answer reads as nothing mapped.
      for (const part of ["shipped", "user"]) {
        const rows = models.strengths && models.strengths[part];
        if (rows && typeof rows === "object" && !Array.isArray(rows)) ctx.saved.strengths[part] = rows;
      }
      for (const cli of MODEL_CLIS) {
        if (Array.isArray(models.user?.[cli])) ctx.saved.user[cli] = models.user[cli];
        if (Array.isArray(models.shipped?.[cli])) ctx.saved.shipped[cli] = models.shipped[cli];
      }
    } else if (mode !== "setup") {
      problems.push("Models could not be loaded.");
    }
    if (agents) {
      for (const entry of [...ctx.saved.builtins, ...ctx.saved.agents]) {
        const had = seenStates.get(entry.id);
        if (onFound && had !== undefined && had !== "found" && entry.state === "found") onFound(entry);
        seenStates.set(entry.id, entry.state);
      }
    }
    setAgentsStatus(problems.join(" "), problems.length > 0);
    renderSummary(ctx);
    drawPane();
    syncChooser();
  }

  function wire() {
    $("add")?.addEventListener("click", () => (mode === "setup" ? pick("agent:new") : openChooser()));
    $("scrim")?.addEventListener("click", () => closeDrawer());
    // Esc backs out of the topmost layer first: the chooser, then the drawer
    // (a dirty draft asks), before the dialog's own Esc closes Preferences.
    if (mode === "prefs") {
      container.addEventListener("keydown", (e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        if (ctx.chooserOpen) {
          e.preventDefault();
          e.stopPropagation();
          closeChooser();
        } else if (ctx.openKey) {
          e.preventDefault();
          e.stopPropagation();
          closeDrawer();
        }
      });
    }
  }

  return { load, wire, hasUnsaved, unsavedName, saveOpen, discardOpen, focusOpen };
}

/* ------------------------------------------------------------- back-compat */

// The User Preferences mount, created on first use: index.html carries the
// scaffold it looks up, and the dialog opens long after load. Every export
// the dialog calls through hooks.* stays a plain function name.
let mounted = null;

function prefsView() {
  if (mounted) return mounted;
  const box = document.querySelector(".prefs-agents");
  if (!box) return null;
  mounted = mountAgentsView(box, { mode: "prefs" });
  return mounted;
}

// Each time the dialog opens: the list, from the server.
export const loadAgentsView = () => prefsView()?.load();

export const wireAgentsView = () => prefsView()?.wire();

export const hasUnsaved = () => (mounted ? mounted.hasUnsaved() : false);

export const unsavedName = () => (mounted ? mounted.unsavedName() : "");

export const saveOpen = () => (mounted ? mounted.saveOpen() : Promise.resolve(true));

export const discardOpen = () => mounted?.discardOpen();

export const focusOpen = () => mounted?.focusOpen();
