// Plan2Code Web Console - hosts the git board: tabs, panels and what each click sends.

import { hooks, page, saveNow, redraw } from "../state.js";
import { GIT_TABS, busyMode, gitReply, pickTab, nextStep, tabBadges, createSources, BRANCH_TYPES, commitTicks, cleanupGroups } from "../git-board.js";
import { finish, agentWorking, agentAdrift, gitAwaiting, myTurn, byId, activity } from "../selectors.js";
import { drawGitBoard, activeTab } from "../git-board-view.js";
import { el, md, copyButton } from "../render.js";
import { helpKeyTarget } from "../help.js";
import { postJson } from "../net.js";

// The git board: drawn from state.git, which only console.mjs writes. A click
// never runs git here. It sends one `__git` action through /submit, and the
// agent confirms by card, runs the command and posts a `reread`, whose frame
// redraws the board. The rules live in git-board.js and the drawing in
// git-board-view.js; this is the host: the busy mode, the tab, the scroll,
// the keys, and the panels' state.

const $ = (id) => document.getElementById(id);

// What the person has typed or ticked on the board. Every state frame redraws
// the board from state.git, so this is what carries their place across it.
//   panel     the open panel: "create", "commit" or "cleanup", or null
//   create    the Create prompt's fields, while it is open
//   ticks     the commit table's ticked paths; ignore, its .gitignore toggles
//   sweep     the cleanup list's ticked branches
//   base      the pull-request base the picker chose
//   settled   cards the agent settled since the last click on the board
//   tab       the tab on show: "changes", "branches" or "sync", or null before the first draw
//   scroll    how far the column was scrolled on each tab, put back after each redraw
//   repickAt  when their last board click went out (ms): the first agent post
//             after it moves the board to the new next step's tab
export const board = {
  tab: null,
  scroll: { changes: 0, branches: 0, sync: 0 },
  repickAt: null,
  query: "",
  showAll: false,
  remoteOpen: null,
  panel: null,
  create: null,
  ticks: null,
  ignore: new Set(),
  sweep: null,
  base: null,
  settled: new Set(),
};

// The search, ticks and open panel are also kept in `local`, so a reload (and
// a skill hop back) restores them the way card drafts already do. Stale picks
// are harmless: the next send re-checks every path against the snapshot. The
// restore waits for the first draw: load() has not run when this module does.
const boardBlank = {
  tab: null,
  scroll: { changes: 0, branches: 0, sync: 0 },
  repickAt: null,
  query: "",
  showAll: false,
  remoteOpen: null,
  panel: null,
  create: null,
  ticks: null,
  sweep: null,
  base: null,
};

// Each reset gets its own scroll memory: boardBlank's must never be the one written to.
export const resetBoard = () => {
  Object.assign(board, boardBlank, { scroll: { ...boardBlank.scroll } });
  board.ignore.clear();
};

let boardHydrated = false;

// True from hydration until the first draw has picked its tab: that draw is a reload.
let boardReloaded = false;

const hydrateBoard = () => {
  boardHydrated = true;
  const g = page.local.gitBoard;
  if (!g) return;
  boardReloaded = true;
  Object.assign(board, boardBlank, {
    tab: GIT_TABS.some((t) => t.id === g.tab) ? g.tab : null,
    scroll: { changes: 0, branches: 0, sync: 0, ...(g.scroll || {}) },
    repickAt: typeof g.repickAt === "number" ? g.repickAt : null,
    query: g.query || "",
    showAll: Boolean(g.showAll),
    remoteOpen: g.remoteOpen ?? null,
    panel: g.panel || null,
    create: g.create || null,
    ticks: g.ticks ? new Set(g.ticks) : null,
    sweep: g.sweep ? new Set(g.sweep) : null,
    base: g.base || null,
    ignore: new Set(g.ignore || []),
  });
};

const persistBoard = () => {
  page.local.gitBoard = {
    tab: board.tab,
    scroll: { ...board.scroll },
    repickAt: board.repickAt,
    query: board.query,
    showAll: board.showAll,
    remoteOpen: board.remoteOpen,
    panel: board.panel,
    create: board.create,
    ticks: board.ticks ? [...board.ticks] : null,
    sweep: board.sweep ? [...board.sweep] : null,
    base: board.base,
    ignore: [...board.ignore],
  };
  saveNow();
};

// How busy the board is (busyMode in git-board.js). Running while a send is
// uncollected or the agent is mid-turn, and nothing queues. A "working" agent
// that has gone adrift lets go, as gitAwaiting() does: collecting a click
// marks it working, and an agent that died there must not leave the board
// locked for good. A question card of the agent's open in the card slot holds
// the board too: the card is the turn, and a board click sent beside it went
// alone while the staged answer waited for some later, unrelated send.
const gitMode = () =>
  busyMode({
    gone: page.gone,
    pending: page.pendingResult,
    running: Boolean(finish()) || (agentWorking() && !agentAdrift()) || gitAwaiting(),
    cardWaiting: myTurn().some((i) => i.kind !== "notice"),
  });

const gitLocked = () => gitMode() !== "idle";

// `wording` only shapes the sentence (the operation an Abort names, say); it
// is not part of the action.
async function sendGit(op, fields = {}, wording = {}) {
  if (page.gone || finish()) return;
  if (page.pendingResult) {
    hooks.banner("Your last click is still being picked up. One moment.", "info");
    page.pendingBannerUp = true;
    return;
  }
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actions: [{ i: "__git", type: "git", op, ...fields }],
        reply: gitReply(op, { ...fields, ...wording }),
      }),
    });
    if (res.status === 409) {
      page.pendingResult = true;
      hooks.banner("Your last click is still being picked up. One moment.", "info");
      page.pendingBannerUp = true;
      redraw();
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    board.settled.clear();
    board.panel = null;
    board.create = null;
    board.sweep = null;
    // The commit table is always on show: a click drops its picks, and the
    // redraw that follows re-seeds them from the snapshot the page already has.
    board.ticks = null;
    board.ignore = new Set();
    page.pendingResult = true;
    page.local.gitSentAt = Date.now();
    saveNow();
    // The draw after this persists it with the rest of the board.
    board.repickAt = page.local.gitSentAt;
    redraw();
  } catch {
    hooks.banner("That did not go through. Nothing was lost; try again.", "warn");
  }
}

// What the view may ask of the page. Built once: every handler reads the
// board and state.git at the moment of the click, not at the draw.
const gitOn = {
  send: sendGit,
  redraw: () => redraw(),
  pickTab: (id) => {
    board.tab = id;
    persistBoard();
    redraw();
  },
  openPanel: (name, opts) => openPanel(name, opts),
  closePanel: () => closePanel(),
  pickPrHost: (host, kind) => pickPrHost(host, kind),
  persist: () => persistBoard(),
};

// The tab drawn last, which the scroll listener files the column's place under.
let gitTabDrawn = null;

// FR-9: their own click that landed (an agent post after it went out) and
// arriving at the board go to the next step's tab; a reload and a change they
// did not click for keep the tab they had. A frame with no updatedAt has not
// landed: never re-pick on a guess.
function resolveGitTab(step) {
  const before = board.tab;
  let reason = "background";
  if (board.repickAt && page.S.updatedAt && Date.parse(page.S.updatedAt) > board.repickAt) {
    reason = "landed";
    board.repickAt = null;
  } else if (board.tab == null) reason = "arrival";
  else if (boardReloaded) reason = "reload";
  boardReloaded = false;
  board.tab = pickTab({ current: board.tab, stepTab: step.tab, reason });
  if (board.tab !== before || reason === "landed") persistBoard();
}

export function renderGitBoard(main, card = null, pager = null) {
  if (!boardHydrated) hydrateBoard();
  const git = page.S.git;
  const step = nextStep(git);
  resolveGitTab(step);
  const result = byId("git-result");
  const { node, cardSlot } = drawGitBoard({
    git,
    board,
    now: Date.now(),
    mode: gitMode(),
    offlineReason: page.gone ? "gone" : page.pendingResult ? "pending" : null,
    step,
    badges: tabBadges(git, { stepTab: step.tab }),
    notice: result && result.kind === "notice" ? result : null,
    activity: activity(),
    hasCard: Boolean(card),
    h: { el, md, copyButton },
    on: gitOn,
  });
  if (card) cardSlot.appendChild(card);
  if (pager) cardSlot.appendChild(pager);
  const tabs = node.querySelector(".git-tabs");
  if (tabs) tabs.addEventListener("keydown", gitTabKeys);
  // The column scrolls, not the board, and every redraw rebuilds the board,
  // so the column would land back at the top. Each tab keeps its own place,
  // so a tab switch opens where that tab was left.
  const tab = activeTab({ board, step });
  gitTabDrawn = tab;
  main.addEventListener("scroll", rememberGitTabScroll, { passive: true });
  main.appendChild(node);
  main.scrollTop = board.scroll[tab] || 0;
  persistBoard();
}

// The scroll listener on `main` for each tab's place, kept as a named function
// because renderGitBoard re-adds it on every redraw: adding the same listener
// twice is a no-op, where a fresh closure would pile up.
function rememberGitTabScroll() {
  const main = $("main");
  if (!gitTabDrawn || !main || !main.querySelector(":scope > .git-board")) return;
  board.scroll[gitTabDrawn] = main.scrollTop;
}

// Arrow keys, Home and End move between the tabs, as in the Help dialog. The
// board is redrawn, so focus goes to the new tab after the render.
function gitTabKeys(e) {
  const index = GIT_TABS.findIndex((t) => t.id === gitTabDrawn);
  const to = helpKeyTarget(e.key, Math.max(0, index), GIT_TABS.length);
  if (to < 0) return;
  e.preventDefault();
  board.tab = GIT_TABS[to].id;
  persistBoard();
  redraw();
  $(`git-tab-${board.tab}`)?.focus();
}

// The host is remembered for every project by the server (pr-hosts.json);
// the action that follows has the agent re-read, which rebuilds the link.
async function pickPrHost(host, kind) {
  if (gitLocked()) return;
  const res = await postJson("/pr-host", { host, kind });
  if (res.status !== 200) {
    hooks.banner("That could not be saved. Try again in a moment.", "warn");
    return;
  }
  // The save is durable; a state frame that landed mid-POST still wins.
  if (gitLocked()) return;
  sendGit("pr-host", { host, kind });
}

// Opening a panel moves to the tab that draws it, so a panel is never open
// on a hidden tab. `opts.ticks` / `opts.ignore` set the commit panel's picks
// (the held-back .gitignore offer opens it with nothing ticked).
function openPanel(name, opts = {}) {
  if (gitLocked()) return;
  const git = page.S.git;
  if (name === "commit") {
    board.tab = "changes";
    if (opts.ticks) board.ticks = new Set(opts.ticks);
    if (opts.ignore) board.ignore = new Set(opts.ignore);
    if (board.panel !== "commit") return openCommit(git);
    persistBoard();
    return redraw();
  }
  if (name === "create") {
    board.tab = opts.commit ? "changes" : "branches";
    // A branch for the commit takes what the commit table has ticked, not a fresh default.
    if (opts.commit && !opts.files) return openCreate(git, { ...opts, ...tablePicks(git) });
    return openCreate(git, opts);
  }
  if (name === "cleanup") {
    board.tab = "branches";
    return openCleanup(git);
  }
}

const closePanel = () => {
  board.panel = null;
  board.create = null;
  redraw();
};

// In commit mode the commit panel hands over what it would have sent (its
// ticked files and .gitignore picks, already checked against the snapshot);
// a detached commit, which never shows the panel, starts from commitTicks().
function openCreate(git, { commit = false, files = null, ignore = [] } = {}) {
  if (gitLocked()) return;
  // The agent's description is of the changes waiting: with none left (they
  // were committed since), it describes nothing on this tree.
  const pending = Number(page.S.git && page.S.git.changes && page.S.git.changes.count) || 0;
  const describe = pending && page.S.board && typeof page.S.board.describe === "string" ? page.S.board.describe : "";
  board.create = {
    from: createSources(git, commit).preset,
    type: BRANCH_TYPES[0],
    description: describe,
    name: null,
    commit,
    files: commit ? files || [...commitTicks(git.changes)] : null,
    ignore: commit ? ignore : [],
  };
  board.panel = "create";
  redraw();
  $("git-new-desc")?.focus();
}

// The commit table's picks, checked against the snapshot: `{ files, ignore }`.
// Seeded from commitTicks() when the table has not been drawn yet.
function tablePicks(git) {
  const ch = git.changes || {};
  const known = new Set([...(ch.files || []), ...(ch.untrackedDirs || [])].map((f) => f.path));
  const ticks = board.ticks || (board.ticks = commitTicks(ch));
  return { files: [...ticks].filter((p) => known.has(p)), ignore: [...board.ignore].filter((p) => known.has(p)) };
}

// The commit table is always on show, so opening its panel keeps what the
// person has already ticked; sendGit() re-seeds the picks after each click.
function openCommit(git) {
  if (gitLocked()) return;
  if (board.panel === "commit") return closePanel();
  const picks = tablePicks(git);
  // Detached: there is no branch to commit on, so the commit makes one.
  if (git.hasCommits !== false && !(git.head || {}).branch) return openCreate(git, { commit: true, ...picks });
  board.panel = "commit";
  board.create = null;
  redraw();
}

function openCleanup(git) {
  if (gitLocked()) return;
  if (board.panel === "cleanup") return closePanel();
  const { merged, gone } = cleanupGroups(git);
  board.sweep = new Set([...merged, ...gone].map((b) => b.name));
  board.panel = "cleanup";
  board.create = null;
  redraw();
}
