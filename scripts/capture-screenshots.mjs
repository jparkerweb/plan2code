#!/usr/bin/env node
// Screenshots of the web console for the docs. Dev-only: lives in scripts/ so
// it never ships inside a skill.
//
//   node scripts/capture-screenshots.mjs [--only <shot>] [--browser <path>]
//        [--out <dir>]
//
// Every shot is staged with no agent: a throwaway sample project called
// `task-api`, a throwaway console home (PLAN2CODE_CONSOLE_HOME), then
// `console.mjs open` and `post` with the payloads in scripts/screenshots/.
// Each screen is saved light and dark, at 1280x800 and twice the pixel
// density, as `<out>/<shot>-light.webp` and `<out>/<shot>-dark.webp`.
// The shots use the console's Ocean highlight rather than its default orange:
// it is the console's nearest to the Plan2Code blue the site and README use.
//
// Shots: dashboard, dashboard-utilities, question, doc, build, signoff, finish, ask.
//
// Needs puppeteer-core (`npm i --no-save puppeteer-core`, never added to
// package.json) and a local Chrome or Edge. Writes nothing outside its temp
// folders and --out.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
  // The utility cards sit even lower: scroll until the Git commit card is the
  // last row in frame ("cmd:" picks a card by its command).
  "dashboard-utilities": {
    workflow: "dashboard",
    posts: ["dashboard"],
    scrollTo: "cmd:/plan2code-git-commit",
    mustShow: "cmd:/plan2code-git-commit",
  },
  question: { workflow: "plan", posts: ["question"] },
  doc: { workflow: "plan", posts: ["doc"], tab: "What we've agreed" },
  build: { workflow: "implement", posts: ["build"], tab: "Phase 3 tasks" },
  signoff: { workflow: "implement", posts: ["signoff"] },
  finish: { workflow: "implement", posts: ["signoff", "finish"] },
  ask: { workflow: "plan", posts: ["question"], ask: "Where are tasks paged?" },
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

function findBrowser() {
  if (typeof args.browser === "string") return fs.existsSync(args.browser) ? args.browser : null;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
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
function stage(project, shot) {
  const spec = SHOTS[shot];
  const r = cli(project, "open", "--workflow", spec.workflow, "--no-open");
  if (r.code !== 0 || !r.out || !r.out.url) throw new Error(`open failed (${r.code}): ${r.err.trim()}`);
  for (const name of spec.posts) post(project, r.out.sid, name);
  return { sid: r.out.sid, url: r.out.url };
}

// Waits for the page to draw real state, then lets the animations finish
// (the dashboard's wake-up is the longest).
async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
  await page.waitForSelector(".dash-card, .card, .handoff, .ask-pane, .doc", { timeout: 15000 }).catch(() => {});
  await sleep(3500);
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
    (topSel, showSel) => {
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
    top,
    mustShow || null
  );
  if (problem) console.log(`  warning: ${problem}`);
  await sleep(300);
}

async function shoot(page, name) {
  const written = [];
  for (const theme of THEMES) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
    // The theme is applied at load, so reload rather than trust a live switch.
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
    if (page.__tab) await openTab(page, page.__tab);
    if (page.__scroll && page.__scroll.scrollTo) await scrollTo(page, page.__scroll);
    const file = path.join(OUT, `${name}-${theme}.webp`);
    await page.screenshot({ type: "webp", quality: QUALITY, path: file });
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`${path.basename(file)}  ${kb} KB`);
    if (kb > WARN_KB) console.log(`  warning: ${path.basename(file)} is over ${WARN_KB} KB`);
    written.push(file);
  }
  return written;
}

// Opens the page for a staged session and saves both themes.
async function capture(browser, url, name, { tab, scrollTo: top, mustShow }) {
  const ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    page.__tab = tab || null;
    page.__scroll = { scrollTo: top, mustShow };
    return await shoot(page, name);
  } finally {
    await ctx.close();
  }
}

// The Ask shot: a question typed and sent on the page, collected with `chat`
// the way an agent would, and answered with a posted reply.
async function captureAsk(browser, project, sid, url, question) {
  const ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    await openTab(page, "Ask");
    await page.waitForSelector("#ask-input:not([disabled])", { timeout: 10000 });
    await page.type("#ask-input", question);
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
  const names = args.only ? [args.only] : Object.keys(SHOTS);
  for (const n of names) if (!SHOTS[n]) fail(`Unknown shot "${n}". Shots: ${Object.keys(SHOTS).join(", ")}`);

  let puppeteer;
  try {
    puppeteer = (await import("puppeteer-core")).default;
  } catch {
    fail("puppeteer-core is not installed. Run: npm i --no-save puppeteer-core");
  }
  const browserPath = findBrowser();
  if (!browserPath) fail("No Chrome or Edge found. Pass one with --browser <path>.");

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
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: ["--no-first-run", "--no-default-browser-check", "--mute-audio"],
    });
    for (const name of names) {
      const { sid, url } = stage(project, name);
      try {
        if (SHOTS[name].ask) await captureAsk(browser, project, sid, url, SHOTS[name].ask);
        else await capture(browser, url, name, SHOTS[name]);
      } finally {
        cli(project, "stop", "--session", sid);
      }
    }
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
