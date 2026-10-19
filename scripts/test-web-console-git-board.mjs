// Web console tests, the tabbed git board's rules: next step, tabs, badges, busy.
// Run with: node --test scripts/test-web-console-git-board.mjs
//
// Every sample repo state the Pathfinder sketches moved between lives in
// scripts/fixtures/git-board-states.mjs, each with the next step it must
// produce. The rules are pure (git-board.js), so no browser is needed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JOURNEYS, NOW, STATES } from "./fixtures/git-board-states.mjs";
import {
  BRANCH_TYPES,
  GIT_TABS,
  busyMode,
  commitTicks,
  controlAllowed,
  createSources,
  gitReply,
  nextStep,
  pickTab,
  tabBadges,
} from "../src/web-console/public/git-board.js";
import { drawGitBoard } from "../src/web-console/public/git-board-view.js";

const VIEW_SRC = fs.readFileSync(new URL("../src/web-console/public/git-board-view.js", import.meta.url), "utf8");

const MODES = ["offline", "running", "card", "idle"];
const ROLES = ["nav", "action", "done"];
const TAB_IDS = GIT_TABS.map((t) => t.id);

const step = (id) => nextStep(STATES[id].git, { now: NOW });
const badges = (id) => {
  const s = step(id);
  return tabBadges(STATES[id].git, { now: NOW, stepTab: s.tab });
};

test("git board rules: every sample state gives its expected primary, secondary and tab", () => {
  for (const [id, s] of Object.entries(STATES)) {
    const n = nextStep(s.git, { now: NOW });
    const got = [n.primary ? n.primary.op : null, n.secondary[0] ? n.secondary[0].op : null];
    assert.deepEqual(got, s.expect, `${id}: primary and secondary`);
    assert.equal(n.tab, s.expectTab, `${id}: owning tab`);
    if (s.expectLine) assert.equal(n.line, s.expectLine, `${id}: line`);
    assert.ok(n.secondary.length <= (n.primary ? 1 : 2), `${id}: at most one secondary beside a primary`);
    for (const st of [n.primary, ...n.secondary].filter(Boolean)) assert.ok(TAB_IDS.includes(st.tab), `${id}: ${st.op} has a tab`);
  }
});

test("git board rules: every journey names states that exist", () => {
  for (const j of JOURNEYS) for (const id of j.states) assert.ok(STATES[id], `${j.id} names ${id}`);
});

test("git board rules: held-back files never drive the step, and fill an empty secondary with the ignore offer", () => {
  const held = step("e-held-only");
  assert.equal(held.primary, null);
  assert.deepEqual(held.secondary.map((s) => s.op), ["ignore", "refresh"]);
  assert.equal(held.secondary[0].label, "Add `.env.local` to .gitignore");
  assert.deepEqual(held.secondary[0].files, [".env.local"]);
  assert.equal(held.held, "`.env.local` held back");
  assert.equal(held.tab, "changes");

  const dirty = step("cp-dirty");
  assert.equal(dirty.primary.label, "Commit 3 files", "4 changes minus the held-back .env.local");
  assert.equal(dirty.held, "`.env.local` held back");

  const two = nextStep({
    ...STATES["e-held-only"].git,
    changes: {
      count: 2,
      heldBack: 2,
      files: [
        { path: ".env.local", state: "new", risky: true },
        { path: "dump.sql", state: "new", risky: true },
      ],
      untrackedDirs: [],
    },
  }, { now: NOW });
  assert.equal(two.held, "2 files held back");
  assert.equal(two.secondary[0].label, "Add 2 held-back files to .gitignore");
  assert.equal(two.secondary[0].why, "Keep them out of every commit.");
  assert.equal(held.secondary[0].why, "Keep it out of every commit.");
});

test("git board rules: no default branch means no clean-up step or badge, as boardActions() offers none", () => {
  const git = STATES["e-gone"].git;
  assert.equal(step("e-gone").secondary[0].op, "cleanup");
  const noDefault = { ...git, defaultBranch: null, branches: git.branches.map((b) => ({ ...b, default: false, merged: false, gone: b.current ? b.gone : b.name === "chore/bump-deps" })) };
  const n = nextStep(noDefault, { now: NOW });
  assert.ok(![n.primary, ...n.secondary].some((s) => s && s.op === "cleanup"));
  assert.equal(tabBadges(noDefault, { now: NOW, stepTab: n.tab }).branches, null);
});

test("git board badges: no 'not published' badge before the first commit, even with a remote", () => {
  const git = { ...STATES["e-first-commit"].git, remotes: STATES["cp-dirty"].git.remotes, lastFetch: STATES["cp-dirty"].git.lastFetch };
  const n = nextStep(git, { now: NOW });
  assert.equal(n.primary.op, "commit");
  assert.equal(tabBadges(git, { now: NOW, stepTab: n.tab }).sync, null);
});

test("git board rules: the stale line never changes the step, and needs a remote", () => {
  const fresh = step("e-caught-up");
  const stale = step("e-stale");
  assert.equal(fresh.stale, null);
  assert.equal(stale.stale, "Checked 3 hr. ago — Refresh?");
  assert.deepEqual(stale.primary, fresh.primary);
  assert.deepEqual(stale.secondary.map((s) => s.op), fresh.secondary.map((s) => s.op));
  assert.equal(step("e-no-remote").stale, null);
  const never = nextStep({ ...STATES["e-caught-up"].git, lastFetch: null }, { now: NOW });
  assert.equal(never.stale, "Never checked — Refresh?");
});

test("git board rules: no remote reads 'Nothing to commit … no remote yet', and still offers Refresh", () => {
  const n = step("e-no-remote");
  assert.equal(n.line, "Nothing to commit on main · no remote yet");
  assert.deepEqual(n.secondary.map((s) => [s.op, s.label]), [["create", "New branch"], ["refresh", "Refresh"]]);
});

test("git board rules: a pushed branch on an unknown host gets no pull request step", () => {
  const git = STATES["pc-pushed"].git;
  const unknown = { ...git, remotes: git.remotes.map((r) => ({ ...r, kind: null })) };
  assert.equal(step("pc-pushed").primary.op, "pr");
  assert.ok(step("pc-pushed").primary.url.startsWith("https://"));
  const n = nextStep(unknown, { now: NOW });
  assert.notEqual(n.primary && n.primary.op, "pr");
  assert.ok(![n.primary, ...n.secondary].some((s) => s && s.op === "pr"));
});

test("git board rules: mid-operation, Fix the files while markers remain, then Continue, Abort once", () => {
  const fix = step("pc-conflict");
  assert.equal(fix.primary.label, "Fix the files");
  assert.equal(fix.secondary[0].label, "Abort the rebase");
  assert.equal(step("pc-resolved").primary.op, "continue");
  const am = nextStep({ ...STATES["pc-resolved"].git, inProgress: "am" }, { now: NOW });
  assert.equal(am.secondary[0].label, "Abort the git am");
});

test("git board rules: on the default branch, a branch is suggested and committing there is the secondary", () => {
  const n = step("nb-main-dirty");
  assert.equal(n.primary.label, "Start a branch for 2 files");
  assert.equal(n.secondary[0].label, "Commit on main");
  assert.equal(n.secondary[0].tab, "changes");
});

test("git board badges: each tab badges what it has waiting, and the next step's tab is filled", () => {
  const dirty = badges("cp-dirty");
  assert.deepEqual([dirty.changes.text, dirty.changes.kind, dirty.changes.next], ["3", "count", true]);
  assert.equal(dirty.changes.label, "3 waiting, next step");
  assert.equal(dirty.branches.text, "2");
  assert.equal(dirty.branches.next, false);
  assert.equal(dirty.sync, null);

  const held = badges("e-held-only");
  assert.deepEqual([held.changes.kind, held.changes.text, held.changes.next], ["dot", "·", false], "no primary, so no filled badge");

  assert.equal(badges("e-many-branches").branches.text, "40");
  assert.equal(badges("pc-diverged").sync.text, "↑1 ↓3");
  assert.equal(badges("pc-diverged").sync.label, "1 to push, 3 to pull, next step");
  assert.equal(badges("nb-unpublished").sync.text, "↑");
  assert.equal(badges("e-gone").sync.text, "↑");
  assert.equal(badges("e-stale").sync.text, "?");
  assert.equal(badges("e-caught-up").sync, null);

  const conflict = badges("pc-conflict");
  assert.equal(conflict.sync.kind, "warn");
  assert.equal(conflict.sync.text, "!");
  assert.equal(conflict.changes, null);
  assert.equal(conflict.branches, null);
});

test("git board badges: a tab owning the step with nothing of its own gets a filled dot", () => {
  const b = badges("cp-pushed");
  assert.deepEqual([b.sync.kind, b.sync.text, b.sync.next], ["dot", "·", true]);
  assert.equal(b.sync.label, "next step");
});

test("git board busy: offline beats running beats a waiting card", () => {
  for (let bits = 0; bits < 16; bits++) {
    const f = { running: Boolean(bits & 1), cardWaiting: Boolean(bits & 2), gone: Boolean(bits & 4), pending: Boolean(bits & 8) };
    const want = f.gone || f.pending ? "offline" : f.running ? "running" : f.cardWaiting ? "card" : "idle";
    assert.equal(busyMode(f), want, JSON.stringify(f));
  }
  assert.equal(busyMode(), "idle");
});

test("git board busy: nav always works, actions only when idle, Done with git while idle or a card waits", () => {
  const want = {
    nav: { offline: true, running: true, card: true, idle: true },
    action: { offline: false, running: false, card: false, idle: true },
    done: { offline: false, running: false, card: true, idle: true },
  };
  for (const role of ROLES) for (const mode of MODES) assert.equal(controlAllowed(mode, role), want[role][mode], `${role} in ${mode}`);
  assert.equal(controlAllowed("idle", "nonsense"), false);
});

test("git board tabs: a landed click and arriving go to the step's tab; reload and background keep yours", () => {
  for (const current of ["changes", "branches", "sync"]) {
    assert.equal(pickTab({ current, stepTab: "branches", reason: "landed" }), "branches");
    assert.equal(pickTab({ current, stepTab: "branches", reason: "arrival" }), "branches");
    assert.equal(pickTab({ current, stepTab: "branches", reason: "reload" }), current);
    assert.equal(pickTab({ current, stepTab: "branches", reason: "background" }), current);
  }
  for (const current of [null, "nonsense"]) {
    assert.equal(pickTab({ current, stepTab: "changes", reason: "reload" }), "changes");
    assert.equal(pickTab({ current, stepTab: "changes", reason: "background" }), "changes");
  }
  assert.equal(pickTab({ current: null, stepTab: null, reason: "arrival" }), "sync");
});

/* ------------------------------------------------------------ the view */

// The node API git-board-view.js may use (its header comment, phase 2 Task
// 2.1), and nothing else: touching any other property throws, so the view
// cannot drift onto something the real DOM has and this fake does not.
const NODE_API = new Set([
  "appendChild", "append", "replaceChildren", "setAttribute", "removeAttribute", "addEventListener", "classList",
  "className", "id", "type", "value", "checked", "disabled", "textContent", "placeholder", "title", "open", "href",
  "target", "rel", "tabIndex",
]);
// What the test itself reads off a recorded node.
const TEST_ONLY = new Set(["tag", "children", "attrs", "listeners", "parent", "classes", "text"]);

function fakeNode(tag) {
  const n = {
    tag, children: [], attrs: {}, listeners: {}, parent: null, classes: new Set(), text: "",
    id: "", type: "", value: "", checked: false, disabled: false, placeholder: "", title: "", open: false,
    href: "", target: "", rel: "", tabIndex: 0,
    appendChild(c) {
      c.parent = proxy;
      n.children.push(c);
      return c;
    },
    append(...cs) {
      for (const c of cs) proxy.appendChild(c);
    },
    replaceChildren(...cs) {
      n.children = [];
      n.text = "";
      proxy.append(...cs);
    },
    setAttribute(k, v) {
      n.attrs[k] = String(v);
    },
    removeAttribute(k) {
      delete n.attrs[k];
    },
    addEventListener(type, fn) {
      (n.listeners[type] ||= []).push(fn);
    },
    classList: {
      add: (...c) => c.forEach((x) => n.classes.add(x)),
      remove: (...c) => c.forEach((x) => n.classes.delete(x)),
      toggle: (c, force) => {
        const on = force === undefined ? !n.classes.has(c) : Boolean(force);
        if (on) n.classes.add(c);
        else n.classes.delete(c);
        return on;
      },
      contains: (c) => n.classes.has(c),
    },
  };
  const proxy = new Proxy(n, {
    get(t, key) {
      if (typeof key !== "string" || TEST_ONLY.has(key)) return t[key];
      if (!NODE_API.has(key)) throw new Error(`the view used .${key}, which is not in its node API`);
      if (key === "className") return [...t.classes].join(" ");
      if (key === "textContent") return t.text + t.children.map((c) => c.textContent).join("");
      return t[key];
    },
    set(t, key, v) {
      if (typeof key === "string" && !NODE_API.has(key) && !TEST_ONLY.has(key)) throw new Error(`the view set .${key}, which is not in its node API`);
      if (key === "className") t.classes = new Set(String(v || "").split(/\s+/).filter(Boolean));
      else if (key === "textContent") {
        t.children = [];
        t.text = v == null ? "" : String(v);
      } else t[key] = v;
      return true;
    },
  });
  return proxy;
}

/** The helpers the view is handed, recording every node made. */
function fakeH() {
  const all = [];
  const el = (tag, className, text) => {
    const n = fakeNode(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    all.push(n);
    return n;
  };
  return { el, md: (text, cls) => el("div", cls, text), copyButton: (text, cls) => el("button", cls, "Copy"), all };
}

/** ctx.on, recording every call as [name, ...args]. */
function fakeOn() {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    send: rec("send"), redraw: rec("redraw"), pickTab: rec("pickTab"), openPanel: rec("openPanel"),
    closePanel: rec("closePanel"), pickPrHost: rec("pickPrHost"), persist: rec("persist"),
  };
}

// The Create prompt's fields as openCreate() in app.js seeds them.
const seedCreate = (git, commit = false) => ({
  from: createSources(git, commit).preset,
  type: BRANCH_TYPES[0],
  description: "",
  name: null,
  commit,
  files: commit ? [...commitTicks(git.changes)] : null,
  ignore: [],
});

// The panels each tab can draw; "create-commit" is the create panel in commit mode, on Changes.
const PANELS = { changes: [null, "commit", "create-commit"], branches: [null, "create", "cleanup"], sync: [null] };

function draw(id, { mode = "idle", tab = null, panel = null, create = null } = {}) {
  const s = STATES[id];
  const git = s.git;
  const step = nextStep(git, { now: NOW });
  const badges = tabBadges(git, { now: NOW, stepTab: step.tab });
  const board = {
    tab,
    panel: panel === "create-commit" ? "create" : panel,
    create: create || (panel === "create" ? seedCreate(git) : panel === "create-commit" ? seedCreate(git, true) : null),
    ticks: null, ignore: new Set(), sweep: null, query: "", showAll: false, remoteOpen: null, base: null,
  };
  const h = fakeH();
  const on = fakeOn();
  const out = drawGitBoard({
    git, board, now: NOW, mode, step, badges, notice: s.result || null, activity: s.busy || null,
    hasCard: false, offlineReason: "gone", h, on,
  });
  return { ...out, h, on, board, step };
}

function walk(node, out = []) {
  out.push(node);
  for (const c of node.children) walk(c, out);
  return out;
}

const isControl = (n) => ["button", "input", "select"].includes(n.tag) || (["a", "span"].includes(n.tag) && n.classes.has("git-pr-open"));
const controls = (node) => walk(node).filter(isControl);
const isOff = (n) => (n.tag === "span" ? n.attrs["aria-disabled"] === "true" : Boolean(n.disabled));
// A control's words: its own text, or for a bare box, the label around it.
const words = (n) => n.textContent.trim() || (n.parent && n.parent.tag === "label" ? n.parent.textContent.trim() : "");

function* everyRender(modes = ["idle", "running", "card", "offline"]) {
  for (const id of Object.keys(STATES)) {
    for (const mode of modes) {
      for (const tab of TAB_IDS) for (const panel of PANELS[tab]) yield { id, mode, tab, panel, r: draw(id, { mode, tab, panel }) };
    }
  }
}

test("git board view: no control leaks the busy lock, in any state, mode, tab or panel", () => {
  let checked = 0;
  for (const { id, mode, tab, panel, r } of everyRender()) {
    const where = `${id} · ${mode} · ${tab} · ${panel}`;
    const all = controls(r.node);
    for (const c of all) {
      const gate = c.attrs["data-gate"];
      assert.ok(["nav", "action", "done"].includes(gate), `${where}: "${words(c)}" (${c.tag}) has no data-gate`);
      const own = c.attrs["data-own"] === "true";
      if (!controlAllowed(mode, gate)) assert.ok(isOff(c), `${where}: "${words(c)}" is live while busy`);
      else assert.equal(isOff(c), own, `${where}: "${words(c)}" is ${isOff(c) ? "greyed with no reason of its own" : "live despite its own reason"}`);
      checked++;
    }
    const done = all.filter((c) => c.textContent === "Done with git");
    assert.equal(done.length, 1, `${where}: exactly one Done with git`);
    assert.equal(!done[0].disabled, mode === "idle" || mode === "card", `${where}: Done with git live only while idle or a card waits`);
  }
  assert.ok(checked > 1000, "the guard looked at the board's controls");
});

test("git board view: every function of today's board is reachable on some tab", () => {
  const texts = new Set();
  const ids = { select: new Set(), input: new Set() };
  const take = (r) => {
    for (const c of controls(r.node)) {
      texts.add(words(c));
      if (c.id && ids[c.tag]) ids[c.tag].add(c.id);
    }
  };
  for (const { r } of everyRender(["idle"])) take(r);
  // A name that is taken offers Switch to it.
  take(draw("cp-dirty", { tab: "branches", panel: "create", create: { ...seedCreate(STATES["cp-dirty"].git), name: "main" } }));

  // Exact, except the labels that carry a count ("Commit 3 files", "Show all 179").
  const has = (want, prefix = false) => [...texts].some((t) => t === want || (prefix && t.startsWith(`${want} `)));
  for (const want of [
    "Add to .gitignore", "Create branch", "New branch", "Create", "Switch", "Delete", "Choose which to clean up…",
    "Refresh", "Pull", "Publish", "Open pull request", "Copy", "Abort the rebase", "Continue", "Done with git",
    "Switch to it",
  ]) {
    assert.ok(has(want), `"${want}" is drawn somewhere`);
  }
  for (const want of ["Commit", "Show all", "Clean up", "Push"]) assert.ok(has(want, true), `"${want} …" is drawn somewhere`);
  for (const id of ["git-pr-base", "git-new-from", "git-new-type"]) assert.ok(ids.select.has(id), `select #${id}`);
  for (const id of ["git-search", "git-new-desc", "git-new-name"]) assert.ok(ids.input.has(id), `input #${id}`);

  for (const [id, s] of Object.entries(STATES)) {
    const head = draw(id).node.children.find((c) => c.tag === "header");
    if (s.git.head.branch) assert.ok(head.textContent.includes(s.git.head.branch), `${id}: the header names the branch`);
  }
  assert.ok(draw("e-no-remote").node.children[0].textContent.includes("git remote add origin <url>"));
});

test("git board view: pins on its source and on a few states", () => {
  for (const word of ["document", "window", "querySelector", "getBoundingClientRect", ".style"]) {
    assert.ok(!VIEW_SRC.includes(word), `git-board-view.js never names ${word}`);
  }
  const imports = [...VIEW_SRC.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./git-board.js"], "it imports only ./git-board.js");
  assert.doesNotMatch(VIEW_SRC, /\bimport\s*\(/, "and nothing dynamically");

  const conflict = controls(draw("pc-conflict").node).filter((c) => c.textContent.startsWith("Abort"));
  assert.equal(conflict.length, 1, "mid-rebase, Abort is offered once");

  const held = draw("e-held-only", { tab: "changes" });
  const strip = walk(held.node).find((n) => n.classes.has("git-step"));
  assert.ok(strip, "the step strip is on Changes");
  assert.ok(walk(strip).find((n) => n.classes.has("git-held")).textContent.includes("`.env.local` held back"));
  assert.ok(controls(strip).some((c) => c.textContent === "Add `.env.local` to .gitignore"), "the ignore offer is the secondary");

  const away = draw("cp-dirty", { tab: "sync" });
  const hint = walk(away.node).find((n) => n.classes.has("git-hint"));
  assert.ok(hint, "a tab that does not own the step points at it");
  assert.ok(hint.textContent.includes("Commit 3 files"));
  assert.ok(hint.textContent.startsWith("Next step is on Changes:"));
});

const click = (n) => n.listeners.click.forEach((fn) => fn());
const stepButtons = (r) => controls(walk(r.node).find((n) => n.classes.has("git-step")));

test("git board view: each step's click goes out as the board offers it", () => {
  const held = draw("e-held-only");
  click(stepButtons(held).find((c) => c.textContent.startsWith("Add ")));
  assert.deepEqual(held.on.calls, [["openPanel", "commit", { ignore: [".env.local"], ticks: [] }]]);

  const unpublished = draw("nb-unpublished");
  click(stepButtons(unpublished).find((c) => c.textContent === "Publish"));
  assert.deepEqual(unpublished.on.calls, [["send", "publish", { remote: "origin" }]]);

  const main = draw("nb-main-dirty");
  const [branch, onMain] = stepButtons(main);
  click(branch);
  click(onMain);
  assert.deepEqual(main.on.calls, [["openPanel", "create", { commit: true }], ["openPanel", "commit"]]);

  const away = draw("pc-conflict", { tab: "changes" });
  click(walk(away.node).find((n) => n.classes.has("git-hint")));
  assert.deepEqual(away.on.calls, [["pickTab", "sync"]]);

  const op = draw("pc-conflict");
  const opButtons = controls(walk(op.node).find((n) => n.classes.has("git-op")));
  opButtons.forEach(click);
  assert.deepEqual(op.on.calls, [["send", "continue", {}, { operation: "rebase" }], ["send", "abort", {}, { operation: "rebase" }]]);
});

test("git board view: a .gitignore-only pick commits just .gitignore, and never on a detached HEAD", () => {
  const ignoreHeld = (git) => ({ ...git, changes: STATES["e-held-only"].git.changes });
  const opened = (git) => {
    const step = nextStep(git, { now: NOW });
    const board = { tab: "changes", panel: "commit", create: null, ticks: new Set(), ignore: new Set([".env.local"]), sweep: null, query: "", showAll: false, remoteOpen: null, base: null };
    const h = fakeH();
    const on = fakeOn();
    const { node } = drawGitBoard({ git, board, now: NOW, mode: "idle", step, badges: tabBadges(git, { now: NOW, stepTab: step.tab }), notice: null, activity: null, h, on });
    return { node, on };
  };

  const onMain = opened(STATES["e-held-only"].git);
  const add = controls(onMain.node).find((c) => c.textContent === "Add 1 to .gitignore");
  assert.ok(add && !add.disabled);
  click(add);
  assert.deepEqual(onMain.on.calls, [["send", "commit", { files: [], ignore: [".env.local"] }]]);

  const detached = opened(ignoreHeld(STATES["e-detached"].git));
  assert.ok(!controls(detached.node).some((c) => c.textContent === "Add 1 to .gitignore"), "no commit straight onto a detached HEAD");
  const make = controls(detached.node).find((c) => c.textContent === "Create branch");
  assert.ok(make && !make.disabled, "the branch comes first, .gitignore pick and all");
  click(make);
  assert.deepEqual(detached.on.calls, [["openPanel", "create", { commit: true, files: [], ignore: [".env.local"] }]]);

  assert.equal(gitReply("commit", { files: [], ignore: [".env.local"] }), "Add .env.local to .gitignore and commit just .gitignore.");
  assert.equal(
    gitReply("create", { name: "fix/x", from: "a1b2c3d", then: "commit", files: [], ignore: [".env.local"] }),
    "Create fix/x from a1b2c3d. Then add .env.local to .gitignore and commit just .gitignore."
  );
  assert.equal(gitReply("commit", { files: ["a.js"], ignore: ["dist/"] }), "Commit this file: a.js. Add dist/ to .gitignore.");
});

test("git board host: the host draws the board only through drawGitBoard, and the server serves the view", () => {
  const host = fs.readFileSync(new URL("../src/web-console/public/screens/git-host.js", import.meta.url), "utf8");
  for (const gone of ["gitActionBar", "gitBranches", "smallButton", "gitHeader", "gitCommitPanel"]) {
    assert.ok(!host.includes(`function ${gone}(`), `git-host.js no longer defines ${gone}()`);
  }
  const drawCalls = [...host.matchAll(/\bdrawGitBoard\(/g)].length;
  assert.equal(drawCalls, 1, "one call to drawGitBoard");
  const body = host.slice(host.indexOf("function renderGitBoard("), host.indexOf("function rememberGitTabScroll("));
  assert.ok(body.includes("drawGitBoard("), "renderGitBoard is the one that calls it");
  const server = fs.readFileSync(new URL("../src/web-console/static.mjs", import.meta.url), "utf8");
  const servable = server.slice(server.indexOf("const SERVABLE = new Set(["), server.indexOf("]);", server.indexOf("const SERVABLE = new Set([")));
  assert.ok(servable.includes('"git-board-view.js"'), "SERVABLE includes git-board-view.js");
  assert.ok(servable.includes('"screens/git-host.js"'), "SERVABLE includes screens/git-host.js");
});

// The commit table's ticks and the click that re-seeds them are page tests now
// ("the commit table keeps the person's ticks across an agent post, and a click
// re-seeds them" and its neighbours in test-web-console-page-git.mjs).

test("git board docs: the agent prose, Help topic and readme describe the tabbed board", () => {
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  const notes = read("../src/web-console/notes/git.md");
  const finishing = notes.slice(notes.indexOf("**Finishing**"));
  assert.ok(finishing.includes("Done with git"), "notes/git.md Finishing names Done with git");
  assert.ok(finishing.includes("cancel"), "notes/git.md Finishing cancels an open card");
  assert.ok(!finishing.includes('"settle": ["<id>"]'), "the cancel rule never settles a card nothing was sent to");
  assert.ok(notes.includes("`files[]` may be empty"), "notes/git.md allows a .gitignore-only commit");
  assert.ok(read("../src/plan2code-git.md").includes("Done with git"), "plan2code-git.md names Done with git");
  const html = read("../src/web-console/public/index.html");
  const start = html.indexOf('<section class="help-panel" data-tab="git">');
  const help = html.slice(start, html.indexOf("</section>", start));
  for (const word of ["Changes", "Branches", "Sync", "Done with git"]) assert.ok(help.includes(word), `Help's git topic mentions ${word}`);
  for (const old of ["one board", "one page"]) assert.ok(!help.includes(old), `Help's git topic no longer says "${old}"`);
  assert.ok(!read("../.readme/web-console.md").includes("commits on one page"), "the readme no longer says commits on one page");
});
