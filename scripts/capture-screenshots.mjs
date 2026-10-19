#!/usr/bin/env node
// Screenshots of the web console for the docs. Dev-only: lives in scripts/ so
// it never ships inside a skill.
//
//   node scripts/capture-screenshots.mjs [--only <shot>] [--browser <path>]
//        [--out <dir>] [--compare]
//
// Every shot is staged with no agent: a throwaway sample project called
// `task-api`, a throwaway console home (PLAN2CODE_CONSOLE_HOME), then
// `console.mjs open` and `post` with the payloads in scripts/screenshots/.
// Each screen is saved light and dark, at 1280x800 and twice the pixel
// density, as `<out>/<shot>-light.webp` and `<out>/<shot>-dark.webp`.
// The shots use the console's Ocean highlight rather than its default orange:
// it is the console's nearest to the Plan2Code blue the site and README use.
//
// Shots: dashboard, dashboard-utilities, question, doc, build, signoff, finish, ask, git.
// --compare adds workspace, stop, delete, help, prefs and cleanup: screens the
// docs never show, for checking a change by eye against a "before" set. Its
// --out must be outside docs/screenshots/, so the set is never published.
//
// --snapshot <file> (used by scripts/css-snapshot.mjs) takes no pictures: it
// writes every element's computed style, per screen, theme and width, to <file>.
// It sees what these shots stage: choice, multi, text, review and confirm cards;
// a checklist, list, recap or menu card is not staged, so a rule only they use
// is not covered.
//
// Needs playwright-core (a root devDependency, so `npm install` brings it) and
// a local Chrome or Edge, launched through scripts/browser.mjs. Playwright has
// no WebP screenshots, so each shot is taken over CDP. Writes nothing outside
// its temp folders and --out.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browser.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONSOLE_CLI = path.join(ROOT, "src", "web-console", "console.mjs");
const PAYLOADS = path.join(ROOT, "scripts", "screenshots");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : true;
}
const OUT = path.resolve(args.out || path.join(ROOT, "docs", "screenshots"));
const QUALITY = 85;
const WARN_KB = 300;
const THEMES = ["light", "dark"];

// Which workflow each shot opens under, which payloads it posts in order,
// which tab it is captured on (by the tab's label; none means the first tab),
// and where to scroll first: `scrollTo` is put at the top of the view and
// `mustShow` has to end up wholly inside it (none means the top).
const SHOTS = {
  // The suggested card sits below the fold at 1280x800, and it is the point of
  // the shot. Starting at the "Hide unavailable" switch keeps the spec picker's
  // cut out of frame and the card in it.
  dashboard: {
    workflow: "dashboard",
    posts: ["dashboard"],
    scrollTo: ".dash-toggle",
    mustShow: ".dash-card:has(.pill.suggested)",
  },
  // The utility cards sit even lower: scroll until the Git card is the
  // last row in frame ("cmd:" picks a card by its command).
  "dashboard-utilities": {
    workflow: "dashboard",
    posts: ["dashboard"],
    scrollTo: "cmd:/plan2code-git",
    mustShow: "cmd:/plan2code-git",
  },
  question: { workflow: "plan", posts: ["question"] },
  doc: { workflow: "plan", posts: ["doc"], tab: "What we've agreed" },
  build: { workflow: "implement", posts: ["build"], tab: "Phase 3 tasks" },
  signoff: { workflow: "implement", posts: ["signoff"] },
  finish: { workflow: "implement", posts: ["signoff", "finish"] },
  ask: { workflow: "plan", posts: ["question"], ask: "Where are tasks paged?" },
  // The git board draws itself from a real repository, so this shot runs in
  // its own git sample project; the post only hands the board back to you.
  git: { workflow: "git", posts: ["git"], repo: true },
};

// --compare only: the screens the docs never show, shot so a change to the
// console can be checked against a "before" set by eye. `open` runs on the
// page after every load and clicks through to the screen. Never published.
const COMPARE_SHOTS = {
  // The confirm dialog, with the handoff choice beside plain stop.
  stop: {
    workflow: "implement",
    posts: ["stop"],
    open: async (page) => {
      await page.click("#btn-stop");
      await page.waitForSelector("#stop-modal[open]", { timeout: 10000 });
    },
  },
  // The first step of a spec chip's delete.
  delete: {
    workflow: "dashboard",
    posts: ["delete"],
    open: async (page) => {
      await page.locator(".spec-chip-del").first().click({ force: true });
      await page.waitForSelector("#delete-modal[open]", { timeout: 10000 });
    },
  },
  // Help on its first tab, whatever topic it opened on.
  help: {
    workflow: "plan",
    posts: ["help"],
    open: async (page) => {
      await page.click("#btn-about");
      await page.locator("#help-tabs .help-tab").first().click();
      await page.waitForSelector("#help-modal[open]", { timeout: 10000 });
    },
  },
  prefs: {
    workflow: "plan",
    posts: ["prefs"],
    open: async (page) => {
      await page.click("#btn-looks");
      await page.waitForSelector("#looks-modal[open]", { timeout: 10000 });
    },
  },
  // Preferences scrolled to Cleanup once its scan has answered.
  cleanup: {
    workflow: "plan",
    posts: ["cleanup"],
    open: async (page) => {
      await page.click("#btn-looks");
      await page.waitForSelector("#looks-modal[open]", { timeout: 10000 });
      await page.locator(".looks-cleanup").scrollIntoViewIfNeeded();
      await page.click("#cleanup-scan");
      await page.waitForFunction(() => document.getElementById("cleanup-status").textContent.trim() !== "", null, { timeout: 15000 }).catch(() => {});
    },
  },
  // The panel open with two folders: the project and a sibling added once.
  // Last, since the console remembers the folder for the project and every
  // later shot's footer would count it.
  workspace: {
    workflow: "plan",
    posts: ["workspace"],
    open: async (page) => {
      const extra = makeExtraFolder();
      await page.evaluate(async (dir) => {
        const now = await (await fetch("/workspace", { cache: "no-store" })).json();
        if ((now.folders || []).length < 2) {
          await fetch("/workspace/add", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ path: dir, name: "task-web", description: "The web app that calls the API" }),
          });
        }
      }, extra);
      await page.click("#footer-where");
      await page.waitForSelector("#workspace-modal[open] #workspace-list li:nth-child(2)", { timeout: 10000 });
    },
  },
};

// On Windows the temp dir sits under the user's profile, and the page can
// show the project's path, so the sample project goes at the drive root
// instead. Elsewhere the temp dir carries no username. Each run makes its own
// folder there (p2c-shots-XXXXXX), so it never deletes anything it did not
// create and two runs never share one.
const SCRATCH_ROOT = process.platform === "win32" ? path.parse(os.tmpdir()).root : os.tmpdir();
let SCRATCH = null;
let HOME = null;
let ENV = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function phaseFile(n, name, tasks, done) {
  const lines = tasks.map((t, i) => `- [${done ? "x" : " "}] **Task ${n}.${i + 1}:** ${t}`).join("\n");
  return `# Phase ${n}: ${name}\n\n**Status:** ${done ? "Complete" : "Not Started"}\n\n## Tasks\n\n${lines}\n`;
}

// A neutral project the console scans as mid-build: Phases 1 and 2 done,
// Phases 3 and 4 still to do.
function makeSampleProject() {
  const project = path.join(SCRATCH, "task-api");
  const spec = path.join(project, "specs", "task-api");
  fs.mkdirSync(spec, { recursive: true });
  fs.writeFileSync(
    path.join(project, "AGENTS.md"),
    "# AGENTS.md\n\nA REST API for a team's tasks, on Fastify, Postgres and Zod.\n\n## Development Commands\n\n- `npm start` runs the API\n- `npm test` runs the tests\n"
  );
  fs.writeFileSync(
    path.join(spec, "overview.md"),
    [
      "# Task API",
      "",
      "**Status:** In Progress",
      "",
      "## Summary",
      "",
      "A REST API for a team's tasks: create, list, update and delete them, with filters by status and assignee and cursor paging.",
      "",
      "## Phase Checklist",
      "",
      "- [x] Phase 1: Project setup ([phase-1.md](./phase-1.md))",
      "- [x] Phase 2: Data model ([phase-2.md](./phase-2.md))",
      "- [ ] Phase 3: API endpoints ([phase-3.md](./phase-3.md))",
      "- [ ] Phase 4: Authentication ([phase-4.md](./phase-4.md))",
      "",
    ].join("\n")
  );
  // The file the Ask shot's answer points at.
  fs.mkdirSync(path.join(project, "src", "tasks"), { recursive: true });
  fs.writeFileSync(
    path.join(project, "src", "tasks", "paginate.js"),
    [
      "// Cursor paging for GET /tasks: up to 50 tasks a page, oldest first.",
      "export function paginate(tasks, cursor, limit = 50) {",
      "  const start = cursor ? tasks.findIndex((t) => t.id === cursor) + 1 : 0;",
      "  const page = tasks.slice(start, start + limit);",
      "  return { tasks: page, nextCursor: page.length === limit ? page[page.length - 1].id : null };",
      "}",
      "",
    ].join("\n")
  );
  fs.writeFileSync(path.join(spec, "phase-1.md"), phaseFile(1, "Project setup", ["Scaffold the Fastify app", "Add the Postgres connection", "Add the test runner"], true));
  fs.writeFileSync(
    path.join(spec, "phase-2.md"),
    phaseFile(2, "Data model", ["Add the tasks table and its migration", "Add the task model", "Add status and assignee indexes", "Seed sample tasks"], true)
  );
  fs.writeFileSync(
    path.join(spec, "phase-3.md"),
    phaseFile(3, "API endpoints", ["Add GET /tasks with cursor paging", "Add POST /tasks", "Add PATCH /tasks/:id", "Add DELETE /tasks/:id"], false)
  );
  fs.writeFileSync(
    path.join(spec, "phase-4.md"),
    phaseFile(4, "Authentication", ["Add API keys", "Require a key on every route", "Scope tasks to the key's team"], false)
  );
  return project;
}

// The Workspace shot's second folder, beside the sample project.
function makeExtraFolder() {
  const dir = path.join(SCRATCH, "task-web");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), "# task-web\n\nThe web app that lists and edits a team's tasks.\n");
  return dir;
}

function git(cwd, ...gitArgs) {
  const r = spawnSync("git", gitArgs, { cwd, env: ENV, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(" ")} failed: ${(r.stderr || "").trim()}`);
}

// The git shot's project: the same sample in a repository whose feature branch
// is pushed to a local bare "origin" and has three changes to commit, so the
// board opens on Changes with Commit as the next step. It sits in its own
// folder so the other shots never see a repository.
let GIT_PROJECT = null;
function makeGitProject() {
  if (GIT_PROJECT) return GIT_PROJECT;
  const parent = path.join(SCRATCH, "git");
  fs.mkdirSync(parent, { recursive: true });
  const origin = path.join(parent, "origin.git");
  git(parent, "init", "--bare", "--initial-branch=main", origin);
  const prev = SCRATCH;
  SCRATCH = parent;
  const project = makeSampleProject();
  SCRATCH = prev;
  const id = ["-c", "user.name=Sam Rivera", "-c", "user.email=sam@example.com", "-c", "commit.gpgsign=false"];
  git(project, "init", "--initial-branch=main");
  git(project, "remote", "add", "origin", origin);
  git(project, "add", "-A");
  git(project, ...id, "commit", "-m", "Scaffold the task API and its specs");
  git(project, "push", "-u", "origin", "main");
  git(project, "switch", "-c", "feature/task-endpoints");
  fs.writeFileSync(path.join(project, "src", "tasks", "routes.js"), "// The /tasks routes.\nexport default async function routes(app) {}\n");
  git(project, "add", "-A");
  git(project, ...id, "commit", "-m", "Register the /tasks routes plugin");
  git(project, "push", "-u", "origin", "feature/task-endpoints");
  // A fetch stamps FETCH_HEAD, so the board says "Last refreshed" rather than "Never".
  git(project, "fetch", "origin");
  fs.appendFileSync(path.join(project, "src", "tasks", "paginate.js"), "\nexport const MAX_LIMIT = 50;\n");
  fs.writeFileSync(path.join(project, "src", "tasks", "schema.js"), "// The Zod schema for a task.\nexport const taskSchema = {};\n");
  fs.appendFileSync(path.join(project, "specs", "task-api", "phase-3.md"), "\n<!-- Task 3.1 in progress -->\n");
  GIT_PROJECT = project;
  return project;
}

function cli(cwd, ...cliArgs) {
  const r = spawnSync(process.execPath, [CONSOLE_CLI, ...cliArgs], { cwd, env: ENV, encoding: "utf8" });
  const line = (r.stdout || "").trim().split("\n").pop() || "";
  let out = null;
  try {
    out = JSON.parse(line);
  } catch {}
  return { code: r.status, out, err: r.stderr };
}

function post(project, sid, name) {
  const r = cli(project, "post", "--session", sid, "--file", path.join(PAYLOADS, name + ".json"));
  if (r.code !== 0) throw new Error(`post ${name}.json failed (${r.code}): ${r.err.trim()}`);
}

// Opens a session for the shot and posts its payloads. Returns { sid, url }.
function stage(project, spec) {
  const r = cli(project, "open", "--workflow", spec.workflow, "--no-open");
  if (r.code !== 0 || !r.out || !r.out.url) throw new Error(`open failed (${r.code}): ${r.err.trim()}`);
  for (const name of spec.posts) post(project, r.out.sid, name);
  return { sid: r.out.sid, url: r.out.url };
}

// Waits for the page to draw real state, then lets the animations finish
// (the dashboard's wake-up is the longest).
async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForSelector(".dash-card, .card, .handoff, .ask-pane, .doc, .git-board", { timeout: 15000 }).catch(() => {});
  await sleep(args.snapshot ? 1800 : 3500);
}

async function openTab(page, label) {
  await page.evaluate((text) => {
    const tab = [...document.querySelectorAll("#views .view-tab")].find((b) => b.firstChild && b.firstChild.textContent.trim() === text);
    if (tab) tab.click();
  }, label);
  await sleep(600);
}

async function scrollTo(page, { scrollTo: top, mustShow }) {
  const problem = await page.evaluate(
    ([topSel, showSel]) => {
      const find = (sel) =>
        sel.startsWith("cmd:")
          ? [...document.querySelectorAll(".dash-card")].find((c) => c.querySelector(".dash-card-cmd")?.textContent.trim() === sel.slice(4))
          : document.querySelector(sel);
      const node = find(topSel);
      if (!node) return `nothing matched ${topSel}, captured from the top`;
      node.scrollIntoView({ block: topSel.startsWith("cmd:") ? "end" : "start", behavior: "instant" });
      if (!showSel) return null;
      const show = find(showSel);
      if (!show) return `nothing matched ${showSel}`;
      const r = show.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight ? null : `${showSel} is not wholly in view`;
    },
    [top, mustShow || null]
  );
  if (problem) console.log(`  warning: ${problem}`);
  await sleep(300);
}

// The properties that change how a stylesheet move would look.
const SNAP_PROPS = [
  "display", "position", "top", "right", "bottom", "left", "width", "height", "min-width", "max-width", "min-height", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "color", "background-color", "background-image", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-top-left-radius",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform",
  "gap", "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "justify-content", "align-self",
  "overflow-x", "overflow-y", "opacity", "visibility", "transform", "z-index", "box-shadow", "cursor", "pointer-events", "white-space",
  "content", "outline-style", "transform-origin", "fill", "stroke",
];
// Recorded after the properties above, for every element: what names its animation.
// A property a running animation is moving is recorded as "~" (it differs from run
// to run), so a rule that adds or removes an animation shows in these fields instead.
const SNAP_ANIMATION = ["animation-name", "animation-duration", "animation-delay", "animation-iteration-count", "animation-timing-function", "animation-direction", "animation-fill-mode"];

const SNAP = {};

async function snapshotNow(page) {
  return page.evaluate(
    ([props, animation]) => {
      const out = {};
      const seen = new Map();
      for (const el of document.querySelectorAll("*")) {
        const parent = el.parentElement;
        const key = parent ? (seen.get(parent) || "") : "";
        const sib = parent ? [...parent.children].indexOf(el) : 0;
        const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".") : "";
        const path = (parent ? key + ">" : "") + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "") + "[" + sib + "]";
        seen.set(el, path);
        const cs = getComputedStyle(el);
        const moving = new Set();
        for (const a of el.getAnimations ? el.getAnimations() : []) {
          for (const kf of a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : []) {
            for (const k of Object.keys(kf)) if (!["offset", "easing", "composite", "computedOffset"].includes(k)) moving.add(k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
          }
        }
        out[path] = props.map((p) => (moving.has(p) ? "~" : cs.getPropertyValue(p))).concat(animation.map((p) => cs.getPropertyValue(p))).join("|");
      }
      return out;
    },
    [SNAP_PROPS, SNAP_ANIMATION]
  );
}

async function snapshotShot(page, name, theme) {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(1500);
    SNAP[`${name}/${theme}/${w}`] = await snapshotNow(page);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

async function shoot(page, name) {
  const written = [];
  // Math.random picks Planny's mood variants; pinned so two runs draw the same page.
  if (args.snapshot) await page.addInitScript(() => { Math.random = () => 0.5; });
  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme });
    // The theme is applied at load, so reload rather than trust a live switch.
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
    if (page.__tab) await openTab(page, page.__tab);
    if (page.__scroll && page.__scroll.scrollTo) await scrollTo(page, page.__scroll);
    if (page.__open) {
      await page.__open(page);
      await sleep(600);
    }
    if (args.snapshot) {
      await snapshotShot(page, name, theme);
      continue;
    }
    const file = path.join(OUT, `${name}-${theme}.webp`);
    const cdp = await page.context().newCDPSession(page);
    // Without a clip the capture comes out in CSS pixels; a clip of the
    // viewport at scale 2 is the twice-density shot (byte for byte what
    // Playwright's own PNG screenshot takes).
    const clip = { x: 0, y: 0, width: 1280, height: 800, scale: 2 };
    const { data } = await cdp.send("Page.captureScreenshot", { format: "webp", quality: QUALITY, captureBeyondViewport: false, clip });
    await cdp.detach();
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`${path.basename(file)}  ${kb} KB`);
    if (kb > WARN_KB) console.log(`  warning: ${path.basename(file)} is over ${WARN_KB} KB`);
    written.push(file);
  }
  return written;
}

// Opens the page for a staged session and saves both themes.
async function capture(browser, url, name, { tab, scrollTo: top, mustShow, open }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    page.__tab = tab || null;
    page.__scroll = { scrollTo: top, mustShow };
    page.__open = open || null;
    return await shoot(page, name);
  } finally {
    await ctx.close();
  }
}

// The Ask shot: a question typed and sent on the page, collected with `chat`
// the way an agent would, and answered with a posted reply.
async function captureAsk(browser, project, sid, url, question) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    await openTab(page, "Ask");
    await page.waitForSelector("#ask-input:not([disabled])", { timeout: 10000 });
    await page.locator("#ask-input").pressSequentially(question);
    await page.evaluate(() => {
      const send = [...document.querySelectorAll(".ask-composer button")].find((b) => b.textContent.trim() === "Send");
      if (send) send.click();
    });

    let entry = null;
    for (let i = 0; i < 40 && !entry; i++) {
      const r = cli(project, "chat", "--session", sid);
      if (r.code === 0 && r.out && r.out.chat) entry = r.out.chat.find((c) => c.kind === "message");
      if (!entry) await sleep(250);
    }
    if (!entry) throw new Error("the Ask question never reached the console");

    const reply = path.join(HOME, "ask-reply.json");
    fs.writeFileSync(
      reply,
      JSON.stringify({
        chat: {
          replies: [
            {
              id: "r" + entry.seq,
              re: entry.seq,
              conversation: entry.conversation,
              md: "Paging is in `src/tasks/paginate.js`. It reads the `cursor` query parameter, returns up to 50 tasks and a `nextCursor`, and `GET /tasks` calls it on every request.",
            },
          ],
        },
        agent: { status: "waiting" },
      })
    );
    const r = cli(project, "post", "--session", sid, "--file", reply);
    if (r.code !== 0) throw new Error(`posting the Ask reply failed (${r.code}): ${r.err.trim()}`);
    await sleep(1000);
    page.__tab = "Ask";
    return await shoot(page, "ask");
  } finally {
    await ctx.close();
  }
}

async function main() {
  const docs = path.join(ROOT, "docs", "screenshots");
  const fold = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
  if (args.compare && (fold(OUT) === fold(docs) || fold(OUT).startsWith(fold(docs) + path.sep))) {
    fail(`--compare never writes into ${path.relative(ROOT, docs)}: pass --out with a folder outside it.`);
  }
  const table = args.compare ? { ...SHOTS, ...COMPARE_SHOTS } : SHOTS;
  const names = args.only ? [args.only] : Object.keys(table);
  for (const n of names) if (!table[n]) fail(`Unknown shot "${n}". Shots: ${Object.keys(table).join(", ")}`);

  SCRATCH = fs.mkdtempSync(path.join(SCRATCH_ROOT, "p2c-shots-"));
  HOME = path.join(SCRATCH, "console-home");
  ENV = { ...process.env, PLAN2CODE_CONSOLE_HOME: HOME, PLAN2CODE_NO_BROWSER: "1" };
  fs.mkdirSync(HOME, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  let browser = null;
  let project = null;
  try {
    project = makeSampleProject();
    // A saved role keeps the dashboard's "pick your role" banner out of shot,
    // and the Ocean highlight is the console's nearest to the Plan2Code blue
    // the landing page uses.
    fs.writeFileSync(path.join(HOME, "looks.json"), JSON.stringify({ looks: { role: "engineer", accent: "ocean", welcomeSeen: true } }));
    browser = await launchBrowser({
      ...(typeof args.browser === "string" ? { executablePath: args.browser } : {}),
      args: ["--no-first-run", "--no-default-browser-check", "--mute-audio"],
    });
    for (const name of names) {
      const where = table[name].repo ? makeGitProject() : project;
      const { sid, url } = stage(where, table[name]);
      try {
        if (table[name].ask) await captureAsk(browser, where, sid, url, table[name].ask);
        else await capture(browser, url, name, table[name]);
      } finally {
        cli(where, "stop", "--session", sid);
      }
    }
    if (args.snapshot) fs.writeFileSync(path.resolve(String(args.snapshot)), JSON.stringify(SNAP));
  } finally {
    if (browser) await browser.close();
    if (project) cli(project, "stop", "--all");
    removeScratch();
  }
}

// `stop` signals the server and returns without waiting for it to exit, and
// on Windows a server still closing holds its log open. Retry the delete, and
// never let a failed cleanup replace the run's own result or error.
function removeScratch() {
  try {
    fs.rmSync(SCRATCH, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (e) {
    console.log(`warning: could not remove ${SCRATCH} (${e.code || e.message}); delete it by hand`);
  }
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
