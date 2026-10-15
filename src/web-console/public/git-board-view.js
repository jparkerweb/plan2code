// Plan2Code Web Console - the tabbed git board's drawing.
//
// drawGitBoard(ctx) builds the whole board -- header, tab strip, card slot,
// step strip and the Changes, Branches and Sync bodies -- from what
// git-board.js decides and what the host hands it. It decides nothing new:
// a rule belongs in git-board.js, a click goes out through ctx.on.
//
// No DOM access: every node comes from `ctx.h` (el, md, copyButton); the page
// and `node --test` both import this file. On what h.el returns, the view uses
// only: appendChild, append, replaceChildren, setAttribute, removeAttribute,
// addEventListener, classList.add/remove/toggle, and the properties
// className, id, type, value, checked, disabled, textContent, placeholder,
// title, open, href, target, rel, tabIndex. Text runs are h.el("span", null, text).
//
// Every button, input and select is made through control(), which greys it
// out whenever controlAllowed(mode, role) says no and stamps data-gate with
// its role; one disabled for a reason of the view's own also carries
// data-own. The guard test in scripts/test-web-console-git-board.mjs holds
// every control to that.

import {
  BRANCH_TYPES,
  GIT_TABS,
  PR_HOST_LABELS,
  boardActions,
  boardPrLink,
  cleanupGroups,
  commitTicks,
  composeBranchName,
  controlAllowed,
  createSources,
  currentRow,
  filterBranches,
  foldRemote,
  nameStatus,
  orderBranches,
  refreshedLine,
  relativeAge,
} from "./git-board.js";

const OP_WORDS = { rebase: "A rebase", am: "A git am", merge: "A merge", "cherry-pick": "A cherry-pick", revert: "A revert" };

const TAB_IDS = new Set(GIT_TABS.map((t) => t.id));

const list = (v) => (Array.isArray(v) ? v : []);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const opName = (op) => (op === "am" ? "git am" : op || "operation");

/* ------------------------------------------------------------ the gate */

// The one way the view makes an interactive control. `disabled` is the view's
// own reason (mid-operation, nothing ticked, a name that is taken); the busy
// gate is applied on top of it, always.
function control(ctx, tag, className, label, { role = "action", onClick, onInput, onChange, disabled = false, title } = {}) {
  const node = ctx.h.el(tag, className, label);
  if (tag === "button") node.type = "button";
  node.disabled = Boolean(disabled) || !controlAllowed(ctx.mode, role);
  node.setAttribute("data-gate", role);
  if (disabled) node.setAttribute("data-own", "true");
  if (title) node.title = title;
  if (onClick) node.addEventListener("click", onClick);
  if (onInput) node.addEventListener("input", onInput);
  if (onChange) node.addEventListener("change", onChange);
  return node;
}

// A copy button is a control like any other: greyed while busy.
function copy(ctx, text, cls, codeEl) {
  const b = ctx.h.copyButton(text, cls, codeEl);
  b.setAttribute("data-gate", "action");
  b.disabled = !controlAllowed(ctx.mode, "action");
  return b;
}

// "Open pull request": a link while it can open, an inert look-alike while busy.
function prLink(ctx, url, cls = "btn small primary") {
  const label = "Open pull request";
  if (!controlAllowed(ctx.mode, "action")) {
    const span = ctx.h.el("span", `${cls} git-pr-open is-disabled`, label);
    span.setAttribute("aria-disabled", "true");
    span.setAttribute("data-gate", "action");
    return span;
  }
  const a = ctx.h.el("a", `${cls} git-pr-open`, label);
  if (typeof url === "string" && /^https:\/\//i.test(url)) a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("data-gate", "action");
  return a;
}

/* ------------------------------------------------------------ the board */

/** The tab to draw: the remembered one when it is a real tab, else the one owning the next step. */
export function activeTab(ctx) {
  const tab = ctx.board && ctx.board.tab;
  return TAB_IDS.has(tab) ? tab : ctx.step.tab;
}

/**
 * The whole board: `{ node, cardSlot }`. `node` is div.git-board holding the
 * header, the result line, the tab strip, `cardSlot` (empty, for the host's
 * cards) and the active tab's panel.
 */
export function drawGitBoard(ctx) {
  const { git, h } = ctx;
  const node = h.el("div", "git-board");
  const cardSlot = h.el("div", "git-cards");
  if (git.error) {
    node.appendChild(cardSlot);
    const warn = h.el("div", "git-warn", git.error);
    warn.setAttribute("role", "alert");
    node.appendChild(warn);
    return { node, cardSlot };
  }
  if (git.repo === false) {
    // "Above" only once there is a card above: before the agent's first post
    // the slot is empty, and the note would point at nothing.
    node.appendChild(cardSlot);
    node.appendChild(
      h.el(
        "p",
        "git-note",
        ctx.hasCard
          ? "This folder is not a git repository yet, so there is no board. Plan2Code asks above what to do."
          : "This folder is not a git repository yet, so there is no board. Plan2Code will ask what to do here in a moment."
      )
    );
    return { node, cardSlot };
  }
  const tab = activeTab(ctx);
  node.appendChild(header(ctx));
  if (ctx.notice) node.appendChild(resultLine(ctx, ctx.notice));
  node.appendChild(tabStrip(ctx, tab));
  node.appendChild(cardSlot);
  node.appendChild(tabPanel(ctx, tab));
  return { node, cardSlot };
}

/* -------------------------------------------------------------- header */

function header(ctx) {
  const { git, h } = ctx;
  const head = git.head || {};
  const remotes = list(git.remotes);
  const cur = currentRow(git);
  const box = h.el("header", "git-head");
  const row = h.el("div", "git-head-row");
  // Mid-rebase HEAD is detached, but the person is still on their branch.
  const title = head.branch || (head.rebasing ? `${head.rebasing} · rebasing` : `Not on a branch (at ${head.detached || "an unknown commit"})`);
  row.appendChild(h.el("h2", "git-branch", title));
  if (head.branch) {
    row.appendChild(
      h.el("span", "git-track", head.upstream && head.gone ? "remote copy deleted" : head.upstream ? `↑${head.ahead || 0} ↓${head.behind || 0}` : "not published")
    );
    if (remotes.length > 1 && cur && cur.upstreamRemote) row.appendChild(h.el("span", "badge", cur.upstreamRemote));
  }
  box.appendChild(row);

  const meta = h.el("div", "git-head-meta");
  if (!remotes.length) {
    meta.appendChild(h.el("span", "git-noremote", "No remote"));
    const cmd = "git remote add origin <url>";
    const code = h.el("code", "md-code", cmd);
    meta.appendChild(code);
    meta.appendChild(copy(ctx, cmd, "btn small", code));
  } else meta.appendChild(h.el("span", "git-refreshed", refreshedLine(git, ctx.now)));
  if (ctx.mode === "running" && ctx.activity) meta.appendChild(h.el("span", "git-activity", ctx.activity));
  box.appendChild(meta);
  return box;
}

function resultLine(ctx, notice) {
  const box = ctx.h.el("div", "git-result");
  box.setAttribute("role", "status");
  if (notice.title) box.appendChild(ctx.h.el("strong", "git-result-title", notice.title));
  if (notice.body) box.appendChild(ctx.h.md(notice.body, "md git-result-body"));
  return box;
}

/* ----------------------------------------------------------- tab strip */

function tabStrip(ctx, active) {
  const { h } = ctx;
  const bar = h.el("div", "git-tab-bar");
  const strip = h.el("div", "git-tabs");
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", "Git board");
  for (const t of GIT_TABS) {
    const on = t.id === active;
    const b = control(ctx, "button", "git-tab" + (on ? " is-active" : ""), null, { role: "nav", onClick: () => ctx.on.pickTab(t.id) });
    b.setAttribute("role", "tab");
    b.id = `git-tab-${t.id}`;
    b.setAttribute("aria-controls", `git-panel-${t.id}`);
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
    b.appendChild(h.el("span", "git-tab-label", t.label));
    const badge = ctx.badges && ctx.badges[t.id];
    if (badge) {
      b.appendChild(h.el("span", `git-tab-badge is-${badge.kind}${badge.next ? " is-next" : ""}`, badge.text));
      if (badge.label) b.setAttribute("aria-label", `${t.label}, ${badge.label}`);
    }
    strip.appendChild(b);
  }
  bar.appendChild(strip);
  const done = control(ctx, "button", "btn small git-done", "Done with git", { role: "done", onClick: () => ctx.on.send("done") });
  if (ctx.mode === "offline") done.title = ctx.offlineReason === "pending" ? "Your last click is still being picked up." : "Not connected right now.";
  bar.appendChild(done);
  return bar;
}

/* ---------------------------------------------------------- tab panels */

function tabPanel(ctx, id) {
  const panel = ctx.h.el("section", "git-panel-tab");
  panel.setAttribute("role", "tabpanel");
  panel.id = `git-panel-${id}`;
  panel.setAttribute("aria-labelledby", `git-tab-${id}`);
  const strip = stepStrip(ctx, id);
  if (strip) panel.appendChild(strip);
  panel.appendChild(id === "changes" ? changesBody(ctx) : id === "branches" ? branchesBody(ctx) : syncBody(ctx));
  return panel;
}

/* ---------------------------------------------------------- step strip */

// One step's click, as the board offers it.
function runStep(ctx, s) {
  const { git, on } = ctx;
  switch (s.op) {
    case "commit":
      return on.openPanel("commit");
    case "create-commit":
      return on.openPanel("create", { commit: true });
    case "create":
      return on.openPanel("create");
    case "cleanup":
      return on.openPanel("cleanup");
    // No ignore op exists: the commit panel opens with nothing ticked and the
    // held-back paths set to Add to .gitignore, and its button sends `commit`.
    case "ignore":
      return on.openPanel("commit", { ignore: list(s.files), ticks: [] });
    case "fix":
      return on.pickTab("sync");
    case "publish": {
      // Named only when there is one to name: with two or more, the agent's
      // `plan publish` asks which.
      const remotes = list(git.remotes);
      return on.send("publish", remotes.length === 1 && remotes[0].name ? { remote: remotes[0].name } : {});
    }
    default:
      return on.send(s.op, {}, { operation: git.inProgress });
  }
}

function stepButton(ctx, s, cls) {
  if (s.op === "pr") return prLink(ctx, s.url, cls);
  return control(ctx, "button", cls, s.label, { onClick: () => runStep(ctx, s) });
}

function stepStrip(ctx, id) {
  const { git, h, step } = ctx;
  const p = step.primary;
  if (id !== step.tab) {
    if (!p) return null;
    const where = GIT_TABS.find((t) => t.id === step.tab);
    return control(ctx, "button", "git-hint", `Next step is on ${where ? where.label : step.tab}: ${p.label} →`, {
      role: "nav",
      onClick: () => ctx.on.pickTab(step.tab),
    });
  }
  // Mid-operation, Sync's own block is the step (syncBody).
  if (id === "sync" && git.inProgress) return null;
  const box = h.el("div", "git-step" + (git.inProgress ? " is-warn" : "") + (p ? "" : " is-calm"));
  box.appendChild(h.el("div", "git-step-kicker", p ? "Next step" : "Nothing to do"));
  box.appendChild(h.el("h3", "git-step-title", p ? p.label : step.line));
  if (p && p.why) box.appendChild(h.el("p", "git-step-why", p.why));
  if (step.stale) box.appendChild(staleLine(ctx, step.stale));
  if (step.held) {
    const held = h.el("div", "git-held");
    held.appendChild(h.md(step.held, "md git-held-body"));
    box.appendChild(held);
  }
  if (ctx.mode === "running") {
    box.appendChild(h.el("p", "git-activity", ctx.activity || "Plan2Code is working on it."));
    return box;
  }
  const actions = h.el("div", "git-step-actions");
  if (p) {
    actions.appendChild(stepButton(ctx, p, "btn primary"));
    const second = step.secondary[0];
    if (second) actions.appendChild(stepButton(ctx, second, "btn ghost"));
  } else {
    for (const s of step.secondary) actions.appendChild(stepButton(ctx, s, "btn small"));
  }
  box.appendChild(actions);
  return box;
}

// "Checked 3 hr. ago — Refresh?", its Refresh word a button.
function staleLine(ctx, text) {
  const line = ctx.h.el("p", "git-stale");
  const word = "Refresh?";
  line.appendChild(ctx.h.el("span", null, text.endsWith(word) ? text.slice(0, -word.length) : `${text} `));
  line.appendChild(control(ctx, "button", "btn small ghost git-stale-refresh", word, { onClick: () => ctx.on.send("refresh") }));
  return line;
}

/* -------------------------------------------------------------- panels */

function panelFrame(ctx, title, { closable = true, disabled = false } = {}) {
  const p = ctx.h.el("section", "git-panel");
  const head = ctx.h.el("div", "git-panel-head");
  head.appendChild(ctx.h.el("h3", "git-panel-title", title));
  if (closable) head.appendChild(control(ctx, "button", "btn small ghost", "Close", { disabled, onClick: () => ctx.on.closePanel() }));
  p.appendChild(head);
  return p;
}

// Mid-operation, Changes and Branches only show what is there.
const waitLine = (ctx) => ctx.h.el("p", "git-wait", `Everything here waits until the ${opName(ctx.git.inProgress)} is finished or aborted.`);

/* ------------------------------------------------------------- Changes */

function changesBody(ctx) {
  const { git, board, h } = ctx;
  const body = h.el("div", "git-changes");
  const frozen = Boolean(git.inProgress);
  if (frozen) body.appendChild(waitLine(ctx));
  if (board.panel === "create" && board.create && board.create.commit) {
    body.appendChild(createPanel(ctx, frozen));
    return body;
  }
  const ch = git.changes || {};
  const any = list(ch.files).length || list(ch.untrackedDirs).length;
  if (!any) {
    body.appendChild(h.el("p", "git-empty", `No changes. Nothing to commit on ${(git.head || {}).branch || "this commit"}.`));
    return body;
  }
  body.appendChild(commitPanel(ctx, frozen));
  return body;
}

function commitPanel(ctx, frozen) {
  const { git, board, h, on } = ctx;
  const ch = git.changes || {};
  const first = git.hasCommits === false;
  const opened = board.panel === "commit";
  const p = panelFrame(ctx, first ? "Make the first commit" : "Commit", { closable: opened, disabled: frozen });
  const ticks = board.ticks || (board.ticks = commitTicks(ch));
  const ignored = board.ignore || (board.ignore = new Set());

  const table = h.el("table", "git-table git-files");
  const thead = h.el("thead");
  const hr = h.el("tr");
  for (const label of ["", "File", "State"]) hr.appendChild(h.el("th", null, label));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = h.el("tbody");

  const tickBox = (id, path) => {
    const box = control(ctx, "input", null, null, {
      disabled: frozen,
      onChange: () => {
        if (box.checked) {
          ticks.add(path);
          ignored.delete(path);
        } else ticks.delete(path);
        on.redraw();
      },
    });
    box.type = "checkbox";
    box.id = id;
    box.checked = ticks.has(path);
    box.setAttribute("aria-label", `Commit ${path}`);
    return box;
  };
  const ignoreToggle = (id, path) => {
    const label = h.el("label", "git-ignore");
    const box = control(ctx, "input", null, null, {
      disabled: frozen,
      onChange: () => {
        if (box.checked) {
          ignored.add(path);
          ticks.delete(path);
        } else ignored.delete(path);
        on.redraw();
      },
    });
    box.type = "checkbox";
    box.id = id;
    box.checked = ignored.has(path);
    label.append(box, h.el("span", null, " Add to .gitignore"));
    return label;
  };

  list(ch.files).forEach((f, i) => {
    const tr = h.el("tr", f.risky ? "is-held" : null);
    const cell = h.el("td");
    cell.appendChild(tickBox(`git-tick-f${i}`, f.path));
    tr.appendChild(cell);
    tr.appendChild(h.el("td", "git-path", f.path));
    const state = h.el("td", "git-state", f.state || "");
    if (f.risky) {
      state.appendChild(h.el("span", "badge git-badge is-held", "held back"));
      state.appendChild(ignoreToggle(`git-ignore-f${i}`, f.path));
    }
    tr.appendChild(state);
    tbody.appendChild(tr);
  });
  list(ch.untrackedDirs).forEach((d, i) => {
    const tr = h.el("tr");
    const cell = h.el("td");
    cell.appendChild(tickBox(`git-tick-d${i}`, d.path));
    tr.appendChild(cell);
    tr.appendChild(h.el("td", "git-path", d.path));
    const state = h.el("td", "git-state", `untracked folder · ${plural(d.files, "file", "files")} `);
    state.appendChild(ignoreToggle(`git-ignore-d${i}`, d.path));
    tr.appendChild(state);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  p.appendChild(table);

  const known = new Set([...list(ch.files), ...list(ch.untrackedDirs)].map((f) => f.path));
  const files = [...ticks].filter((path) => known.has(path));
  const ignore = [...ignored].filter((path) => known.has(path));
  const send = () => on.send("commit", { files, ignore });
  const actions = h.el("div", "git-panel-actions");
  const head = git.head || {};
  const detached = !first && !head.branch;
  if (detached) {
    // No branch to commit on: the commit makes one, .gitignore-only picks included.
    actions.appendChild(
      control(ctx, "button", "btn small primary", "Create branch", {
        disabled: frozen || (!files.length && !ignore.length),
        onClick: () => on.openPanel("create", { commit: true, files, ignore }),
      })
    );
  } else if (!files.length && ignore.length) {
    // Only .gitignore picks: the commit takes .gitignore alone.
    actions.appendChild(control(ctx, "button", "btn small primary", `Add ${ignore.length} to .gitignore`, { disabled: frozen, onClick: send }));
  } else if (!first && head.branch && head.branch === git.defaultBranch) {
    actions.appendChild(h.el("p", "git-offer", `You're on ${head.branch}. Make a branch for this?`));
    actions.appendChild(
      control(ctx, "button", "btn small primary", "Create branch", {
        disabled: frozen || !files.length,
        onClick: () => on.openPanel("create", { commit: true, files, ignore }),
      })
    );
    actions.appendChild(control(ctx, "button", "btn small", `Commit on ${head.branch}`, { disabled: frozen || !files.length, onClick: send }));
  } else {
    actions.appendChild(
      control(ctx, "button", "btn small primary", `Commit ${plural(files.length, "file", "files")}`, { disabled: frozen || !files.length, onClick: send })
    );
  }
  if (opened) actions.appendChild(control(ctx, "button", "btn small ghost", "Cancel", { disabled: frozen, onClick: () => on.closePanel() }));
  p.appendChild(actions);
  return p;
}

/* ------------------------------------------------------------ Branches */

function branchesBody(ctx) {
  const { git, board, h, on } = ctx;
  const body = h.el("section", "git-branches");
  const frozen = Boolean(git.inProgress);
  if (frozen) body.appendChild(waitLine(ctx));

  const tools = h.el("div", "git-tools");
  const search = control(ctx, "input", "git-search", null, {
    role: "nav",
    disabled: frozen,
    onInput: () => {
      board.query = search.value;
      on.redraw();
    },
  });
  search.type = "search";
  search.id = "git-search";
  search.placeholder = "Search branches";
  search.setAttribute("aria-label", "Search branches");
  search.value = board.query || "";
  tools.appendChild(search);
  // Not mid-operation, and not before the first commit, when there is nothing to branch from.
  const first = git.hasCommits === false;
  const nb = control(ctx, "button", "btn small", "New branch", {
    disabled: frozen || first,
    title: first ? "Make the first commit, then you can branch from it." : frozen ? "Finish or abort what is in progress first." : undefined,
    onClick: () => on.openPanel("create"),
  });
  tools.appendChild(nb);
  body.appendChild(tools);

  if (board.panel === "create" && board.create && !board.create.commit) body.appendChild(createPanel(ctx, frozen));

  const { merged, gone } = cleanupGroups(git);
  const sweep = git.defaultBranch ? merged.length + gone.length : 0;
  if (board.panel === "cleanup" && sweep) body.appendChild(cleanupPanel(ctx, frozen));
  else if (sweep) {
    const offer = h.el("p", "git-sweep-offer");
    offer.appendChild(h.el("span", null, `${plural(sweep, "branch", "branches")} merged or gone on the remote. `));
    offer.appendChild(control(ctx, "button", "btn small ghost", "Choose which to clean up…", { disabled: frozen, onClick: () => on.openPanel("cleanup") }));
    body.appendChild(offer);
  }

  // Mid-rebase HEAD is detached, but the branch being rebased is still the
  // one they are on: it keeps its current badge, and never offers Delete.
  const rebasing = git.head && git.head.rebasing;
  const rows = list(git.branches).map((b) => (rebasing && !b.remote && b.name === rebasing ? { ...b, current: true } : b));
  const { top, remoteOnly } = orderBranches(rows);
  const locals = filterBranches(top, board.query);
  if (locals.length) body.appendChild(branchTable(ctx, locals, frozen));
  else body.appendChild(h.el("p", "git-empty", board.query ? "No local branch matches." : "No local branches yet."));

  if (remoteOnly.length) {
    const fold = foldRemote(remoteOnly, { showAll: board.showAll, query: board.query });
    const det = h.el("details", "git-remote-only");
    det.setAttribute("data-gate", "nav");
    // null remoteOpen takes the fold's default (open under a search); a
    // manual toggle wins over it. The toggle event fires for the programmatic
    // open too, so only a change away from what was drawn counts as theirs.
    const drawnOpen = board.remoteOpen ?? Boolean(fold.open);
    det.open = drawnOpen;
    det.addEventListener("toggle", () => {
      if (det.open !== drawnOpen) board.remoteOpen = det.open;
    });
    det.appendChild(h.el("summary", null, `Remote only (${board.query ? fold.shown.length : remoteOnly.length})`));
    if (fold.shown.length) det.appendChild(branchTable(ctx, fold.shown, frozen));
    else det.appendChild(h.el("p", "git-empty", "No remote branch matches."));
    if (fold.hidden) {
      det.appendChild(
        control(ctx, "button", "btn small ghost", `Show all ${remoteOnly.length}`, {
          role: "nav",
          disabled: frozen,
          onClick: () => {
            board.showAll = true;
            on.redraw();
          },
        })
      );
    }
    body.appendChild(det);
  }
  return body;
}

function branchTable(ctx, rows, frozen) {
  const { h, on } = ctx;
  const table = h.el("table", "git-table");
  const thead = h.el("thead");
  const hr = h.el("tr");
  for (const label of ["Branch", "Ahead / behind", "Last commit", ""]) hr.appendChild(h.el("th", null, label));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = h.el("tbody");
  for (const b of rows) {
    const tr = h.el("tr", b.current ? "is-current" : null);
    const name = h.el("td", "git-cell-name");
    name.appendChild(h.el("span", "git-name", b.remote ? `${b.remote}/${b.name}` : b.name));
    const badges = [
      [b.current, "current", "is-current"],
      [b.default, "default", "is-default"],
      [b.merged, "Merged", "is-merged"],
      [b.gone, "Remote copy deleted", "is-gone"],
    ];
    for (const [shown, label, cls] of badges) if (shown) name.appendChild(h.el("span", `badge git-badge ${cls}`, label));
    tr.appendChild(name);

    let track = "not published";
    if (b.remote) track = "remote only";
    else if (b.gone) track = "—";
    else if (b.upstream) track = `↑${b.ahead || 0} ↓${b.behind || 0}`;
    tr.appendChild(h.el("td", "git-cell-track", track));

    const last = h.el("td", "git-cell-last");
    const l = b.last || {};
    last.appendChild(h.el("span", "git-subject", l.subject || ""));
    const by = [l.author, relativeAge(l.at, ctx.now)].filter(Boolean).join(" · ");
    if (by) last.appendChild(h.el("span", "git-by", by));
    tr.appendChild(last);

    const acts = h.el("td", "git-cell-actions");
    const branch = b.remote ? `${b.remote}/${b.name}` : b.name;
    // Mid-operation a row's Switch or Delete would ask for a second git op on top of the first.
    if (!b.current) acts.appendChild(control(ctx, "button", "btn small", "Switch", { disabled: frozen, onClick: () => on.send("switch", { branch }) }));
    if (!b.remote && !b.current && !b.default) {
      acts.appendChild(control(ctx, "button", "btn small danger", "Delete", { disabled: frozen, onClick: () => on.send("delete", { branch: b.name }) }));
    }
    tr.appendChild(acts);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  // The table scrolls sideways on its own when the column is narrower than
  // its no-wrap cells, so the search row and the buttons above it stay put.
  const wrap = h.el("div", "git-table-wrap");
  wrap.appendChild(table);
  return wrap;
}

function createPanel(ctx, frozen) {
  const { git, board, h, on } = ctx;
  const c = board.create;
  const p = panelFrame(ctx, c.commit ? "New branch for this commit" : "New branch", { disabled: frozen });
  const src = createSources(git, c.commit);

  const option = (value) => {
    const o = h.el("option", null, value);
    o.value = value;
    return o;
  };

  const fromRow = h.el("div", "git-field-row");
  const fromLabel = h.el("label", "git-field", "From ");
  const from = control(ctx, "select", null, null, {
    disabled: frozen,
    onChange: () => {
      c.from = from.value;
      on.redraw();
    },
  });
  from.id = "git-new-from";
  for (const o of src.options) from.appendChild(option(o));
  from.value = c.from;
  fromLabel.appendChild(from);
  fromRow.appendChild(fromLabel);
  if (src.here && c.from !== src.here) {
    fromRow.appendChild(
      control(ctx, "button", "btn small ghost", `From ${src.here}`, {
        disabled: frozen,
        onClick: () => {
          c.from = src.here;
          on.redraw();
        },
      })
    );
  }
  p.appendChild(fromRow);

  const parts = h.el("div", "git-field-row");
  const typeLabel = h.el("label", "git-field", "Type ");
  const type = control(ctx, "select", null, null, {
    disabled: frozen,
    onChange: () => {
      c.type = type.value;
      refresh();
    },
  });
  type.id = "git-new-type";
  for (const t of BRANCH_TYPES) type.appendChild(option(t));
  type.value = c.type;
  typeLabel.appendChild(type);
  const descLabel = h.el("label", "git-field is-wide", "Short description ");
  const desc = control(ctx, "input", null, null, {
    disabled: frozen,
    onInput: () => {
      c.description = desc.value;
      refresh();
    },
  });
  desc.id = "git-new-desc";
  desc.placeholder = "export csv";
  desc.value = c.description || "";
  descLabel.appendChild(desc);
  parts.append(typeLabel, descLabel);
  p.appendChild(parts);

  const nameLabel = h.el("label", "git-field is-wide", "Branch name ");
  const name = control(ctx, "input", "git-new-name", null, {
    disabled: frozen,
    onInput: () => {
      c.name = name.value;
      refresh();
    },
  });
  name.id = "git-new-name";
  nameLabel.appendChild(name);
  p.appendChild(nameLabel);
  const status = h.el("p", "git-name-status");
  status.setAttribute("aria-live", "polite");
  p.appendChild(status);

  // The name mirrors the two fields until it is edited directly.
  const currentName = () => (c.name == null ? composeBranchName(c) : c.name);
  const actions = h.el("div", "git-panel-actions");
  const go = control(ctx, "button", "btn small primary", "Create", {
    disabled: true,
    onClick: () => {
      const fields = { name: currentName(), from: c.from };
      if (c.commit) Object.assign(fields, { then: "commit", files: c.files || [] });
      if (c.commit && c.ignore && c.ignore.length) fields.ignore = c.ignore;
      on.send("create", fields);
    },
  });
  actions.appendChild(go);
  actions.appendChild(control(ctx, "button", "btn small ghost", "Cancel", { disabled: frozen, onClick: () => on.closePanel() }));
  p.appendChild(actions);

  // Typing updates the name box, the status line and Create in place, never a redraw.
  const noFiles = c.commit && !list(c.files).length && !list(c.ignore).length;
  const refresh = () => {
    const value = currentName();
    if (name.value !== value) name.value = value;
    const st = nameStatus(value, git);
    nameLine(ctx, status, st, frozen);
    if (noFiles) status.appendChild(h.el("span", null, " Nothing is ticked to commit."));
    const own = frozen || st.kind !== "free" || noFiles;
    go.disabled = own || !controlAllowed(ctx.mode, "action");
    if (own) go.setAttribute("data-own", "true");
    else go.removeAttribute("data-own");
  };
  refresh();
  return p;
}

function nameLine(ctx, line, st, frozen) {
  const { h, on } = ctx;
  line.replaceChildren();
  line.className = "git-name-status is-" + st.kind;
  const say = (text) => line.appendChild(h.el("span", null, text));
  const switchTo = (branch) =>
    line.appendChild(control(ctx, "button", "btn small", "Switch to it", { disabled: frozen, onClick: () => on.send("switch", { branch }) }));
  if (st.kind === "empty") say("Fill in the fields above, or type a name.");
  else if (st.kind === "invalid") say(st.reason);
  else if (st.kind === "free") say("That name is free.");
  else if (st.kind === "local") {
    say(`${st.branch} already exists here. `);
    switchTo(st.branch);
  } else if (st.kind === "remote") {
    say(`${st.remote}/${st.branch} already exists on ${st.remote}. `);
    switchTo(`${st.remote}/${st.branch}`);
  } else if (st.kind === "nested") say(`It clashes with ${st.clash}: one branch cannot be a folder of another.`);
}

function cleanupPanel(ctx, frozen) {
  const { git, board, h, on } = ctx;
  const p = panelFrame(ctx, "Clean up branches", { disabled: frozen });
  const { merged, gone } = cleanupGroups(git);
  const sweep = board.sweep || (board.sweep = new Set([...merged, ...gone].map((b) => b.name)));
  const group = (title, rows, key) => {
    if (!rows.length) return;
    p.appendChild(h.el("h4", "git-group-title", title));
    const ul = h.el("ul", "git-sweep");
    rows.forEach((b, i) => {
      const li = h.el("li");
      const label = h.el("label");
      const box = control(ctx, "input", null, null, {
        disabled: frozen,
        onChange: () => {
          if (box.checked) sweep.add(b.name);
          else sweep.delete(b.name);
          on.redraw();
        },
      });
      box.type = "checkbox";
      box.id = `git-sweep-${key}${i}`;
      box.checked = sweep.has(b.name);
      label.append(box, h.el("span", null, " " + b.name));
      li.appendChild(label);
      ul.appendChild(li);
    });
    p.appendChild(ul);
  };
  group(`Merged into ${git.defaultBranch}`, merged, "m");
  group("Remote copy deleted", gone, "g");
  const known = new Set([...merged, ...gone].map((b) => b.name));
  const branches = [...sweep].filter((n) => known.has(n));
  const actions = h.el("div", "git-panel-actions");
  actions.appendChild(
    control(ctx, "button", "btn small danger", `Delete ${plural(branches.length, "branch", "branches")}`, {
      disabled: frozen || !branches.length,
      onClick: () => on.send("cleanup", { branches }),
    })
  );
  actions.appendChild(control(ctx, "button", "btn small ghost", "Cancel", { disabled: frozen, onClick: () => on.closePanel() }));
  p.appendChild(actions);
  return p;
}

/* ---------------------------------------------------------------- Sync */

function syncBody(ctx) {
  const { git, h } = ctx;
  const body = h.el("div", "git-sync");
  if (git.inProgress) {
    body.appendChild(opBlock(ctx));
    return body;
  }
  const pr = prBlock(ctx);
  if (pr) body.appendChild(pr);

  const acts = boardActions(git, { busy: ctx.mode !== "idle" });
  const row = h.el("div", "git-sync-actions");
  const primaryOp = ctx.step.primary && ctx.step.primary.op;
  for (const key of ["refresh", "pull", "push", "publish"]) {
    const a = acts[key];
    if (!a.shown) continue;
    row.appendChild(
      control(ctx, "button", "btn small" + (key === primaryOp ? " primary" : ""), a.label, {
        disabled: ctx.mode === "idle" && !a.enabled,
        title: a.title,
        onClick: () => runStep(ctx, { op: key }),
      })
    );
  }
  body.appendChild(row);

  if (list(git.remotes).length) {
    body.appendChild(h.el("p", "git-fresh" + (ctx.step.stale ? " is-stale" : ""), ctx.step.stale || refreshedLine(git, ctx.now)));
  } else body.appendChild(h.el("p", "git-fresh", "No remote yet, so nothing to sync. Add one with the line at the top."));
  return body;
}

// Mid-operation: one block that is the step, its files and its two buttons.
function opBlock(ctx) {
  const { git, h, on, step } = ctx;
  const box = h.el("div", "git-op git-step is-warn");
  box.setAttribute("role", "alert");
  box.appendChild(h.el("div", "git-step-kicker", "Next step"));
  box.appendChild(h.el("h3", "git-op-title", `${OP_WORDS[git.inProgress] || "An operation"} is in progress`));
  if (step.primary) {
    box.appendChild(h.el("p", "git-step-label", step.primary.label));
    if (step.primary.why) box.appendChild(h.el("p", "git-step-why", step.primary.why));
  }
  const conflicted = list(git.conflicted);
  if (conflicted.length) {
    const ul = h.el("ul", "git-op-files");
    for (const c of conflicted) {
      const li = h.el("li");
      li.appendChild(h.el("code", "md-code", c.path));
      li.appendChild(h.el("span", c.markers ? "git-op-left" : "git-op-clear", c.markers ? " · markers left" : " · resolved"));
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }
  const actions = h.el("div", "git-op-actions");
  const wording = { operation: git.inProgress };
  // Always offered: the file states are a snapshot from the agent's last
  // look, and someone who fixed a file in their editor has no other way to
  // say so. `plan continue` checks the files on disk itself.
  const clean = conflicted.every((c) => c.markers === false);
  actions.appendChild(
    control(ctx, "button", clean ? "btn primary" : "btn", "Continue", {
      title: clean ? undefined : "Fixed them in your editor? Plan2Code checks the files again before it continues.",
      onClick: () => on.send("continue", {}, wording),
    })
  );
  const abort = step.secondary.find((s) => s.op === "abort");
  actions.appendChild(
    control(ctx, "button", "btn danger", abort ? abort.label : `Abort the ${opName(git.inProgress)}`, {
      onClick: () => on.send("abort", {}, wording),
    })
  );
  box.appendChild(actions);
  return box;
}

function prBlock(ctx) {
  const { git, board, h, on } = ctx;
  const cur = currentRow(git);
  const bases = list(git.branches)
    .filter((b) => b && !b.remote && (!cur || b.name !== cur.name))
    .map((b) => b.name);
  // One base for both the link and the picker, so they can never disagree: a
  // pick that has since gone falls back to the default, and a default that is
  // only on the remote is still offered.
  const base = bases.includes(board.base) ? board.base : git.defaultBranch;
  if (base && !bases.includes(base)) bases.unshift(base);
  const link = boardPrLink(git, base);
  if (!link) return null;
  const box = h.el("div", "git-pr");
  if (link.needsKind) {
    if (!link.host) return null;
    box.appendChild(h.el("span", "git-pr-ask", `Which host is ${link.host}?`));
    for (const [kind, label] of Object.entries(PR_HOST_LABELS)) {
      box.appendChild(control(ctx, "button", "btn small", label, { onClick: () => on.pickPrHost(link.host, kind) }));
    }
    return box;
  }
  if (!link.url || !/^https:\/\//i.test(link.url)) return null;
  box.appendChild(prLink(ctx, link.url));
  box.appendChild(copy(ctx, link.url, "btn small"));
  if (bases.length) {
    const label = h.el("label", "git-pr-base", "into ");
    const sel = control(ctx, "select", null, null, {
      onChange: () => {
        board.base = sel.value;
        on.redraw();
      },
    });
    sel.id = "git-pr-base";
    for (const name of bases) {
      const o = h.el("option", null, name);
      o.value = name;
      sel.appendChild(o);
    }
    sel.value = base;
    label.appendChild(sel);
    box.appendChild(label);
  }
  return box;
}
