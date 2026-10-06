#!/usr/bin/env node
// Start-up benchmark for the web console. Dev-only: lives in scripts/ so it
// never ships inside a skill.
//
//   node scripts/bench-web-console.mjs [--runs 7] [--workflow dashboard]
//        [--browser <path> | --browser none] [--cwd <repo>] [--json <out.json>]
//
// Every run starts from nothing, the way a person's first `/plan2code` does:
// no server, a fresh browser context (each session gets a new port, so a new
// origin, so the HTTP cache is always cold). It measures, from the moment the
// agent runs `console.mjs open`:
//
//   url        the CLI has printed the link (what the agent hands over)
//   cliExit    the CLI process has exited (when the agent's next step can start)
//   response   the browser has the page's HTML
//   fcp        first contentful paint: the person sees something
//   ready      the session is drawn from real state (the menu, or a question)
//
// plus the bytes and request count the page cost. Needs puppeteer-core in
// node_modules and a local Chrome or Edge for the browser columns; without
// them it still reports url/cliExit and an HTTP-only waterfall.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONSOLE_CLI = path.join(ROOT, "src", "web-console", "console.mjs");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : true;
}
const RUNS = Number(args.runs || 7);
const WORKFLOW = args.workflow || "dashboard";
const CWD = path.resolve(args.cwd || ROOT);

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-bench-"));
const ENV = { ...process.env, PLAN2CODE_CONSOLE_HOME: HOME, PLAN2CODE_NO_BROWSER: "1" };
// A fresh cached failure: the boot-time release check stays off the network,
// so a slow GitHub never colours the timings.
fs.writeFileSync(path.join(HOME, "update-check.json"), JSON.stringify({ checkedAt: Date.now(), latest: null }));

function findBrowser() {
  if (args.browser === "none") return null;
  if (typeof args.browser === "string") return args.browser;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// Resolves at the first stdout line carrying a url, and again at exit.
// --launch hook (default): `open` launches "the browser" the way it would for
// a person, through PLAN2CODE_BROWSER, and the hook just writes the link to
// a file; the bench points its ready-made tab there the instant it appears.
// That measures everything but the real browser's own start-up, which is
// about 900ms on Windows and runs alongside the rest.
// --launch url: navigate only once `open` prints the link. For comparing
// against versions of console.mjs that predate the hook.
const LAUNCH = args.launch || "hook";
// --browser-delay <ms>: how long "the browser" takes to show up after it is
// asked. 0 is a browser that is instant; ~900 is Chrome on Windows through
// `start`, measured on this machine, and is what a person actually waits.
const BROWSER_DELAY = Number(args["browser-delay"] || 0);
const OPEN_LOG = path.join(HOME, "opened.txt");

function runOpen() {
  fs.rmSync(OPEN_LOG, { force: true });
  const hook = LAUNCH === "hook";
  const env = hook
    ? { ...ENV, PLAN2CODE_NO_BROWSER: "", PLAN2CODE_BROWSER: `echo>>"${OPEN_LOG}"` }
    : ENV;
  const t0 = Date.now();
  const child = spawn(
    process.execPath,
    [CONSOLE_CLI, "open", "--workflow", WORKFLOW, "--title", "Bench", ...(hook ? [] : ["--no-open"])],
    { cwd: CWD, env, stdio: ["ignore", "pipe", "pipe"] }
  );
  let out = "";
  let err = "";
  let urlResolve;
  const urlP = new Promise((r) => (urlResolve = r));
  child.stdout.on("data", (c) => {
    out += c;
    const m = out.match(/"url":"([^"]+)"/);
    if (m) urlResolve({ url: m[1], at: Date.now() });
  });
  child.stderr.on("data", (c) => (err += c));
  const exitP = new Promise((r) =>
    child.on("exit", (code) => {
      urlResolve({ url: null, at: Date.now() });
      r({ code, at: Date.now(), out, err });
    })
  );
  // The moment "the browser" was asked to open, and with what.
  const openP = hook
    ? new Promise((resolve) => {
        const poll = setInterval(() => {
          let text = "";
          try {
            text = fs.readFileSync(OPEN_LOG, "utf8");
          } catch {}
          const m = text.match(/http:\/\/127\.0\.0\.1:\d+\/s\/[\w-]+\//);
          if (m) {
            clearInterval(poll);
            resolve({ url: m[0], at: Date.now() });
          }
        }, 2);
        exitP.then(() => setTimeout(() => (clearInterval(poll), resolve({ url: null, at: Date.now() })), 500));
      })
    : urlP;
  return { t0, urlP, exitP, openP };
}

function stopAll() {
  spawnSync(process.execPath, [CONSOLE_CLI, "stop", "--all"], { cwd: CWD, env: ENV });
}

async function httpWaterfall(url) {
  // What the page costs without a browser: the redirect, the HTML, every
  // asset it names, then the modules those import. Sequential levels, like a
  // browser without preload hints would discover them.
  const t = Date.now();
  const r1 = await fetch(url, { redirect: "manual" });
  const cookie = (r1.headers.get("set-cookie") || "").split(";")[0];
  const base = new URL(url).origin;
  const get = async (p) => {
    const res = await fetch(base + p, { headers: { cookie } });
    const body = Buffer.from(await res.arrayBuffer());
    return { p, status: res.status, bytes: body.length, text: body.toString("utf8") };
  };
  const html = await get("/");
  let bytes = html.bytes;
  let requests = 2;
  const seen = new Set();
  let level = [...html.text.matchAll(/(?:href|src)="(\/[^"#]+\.(?:css|js))"/g)].map((m) => m[1]);
  let levels = 1;
  while (level.length) {
    const fresh = level.filter((p) => !seen.has(p));
    fresh.forEach((p) => seen.add(p));
    if (!fresh.length) break;
    const got = await Promise.all(fresh.map(get));
    requests += got.length;
    bytes += got.reduce((n, g) => n + g.bytes, 0);
    level = got
      .filter((g) => g.p.endsWith(".js"))
      .flatMap((g) => [...g.text.matchAll(/from\s+"\.\/([^"]+)"/g)].map((m) => "/" + path.posix.join(path.posix.dirname(g.p.slice(1)), m[1])));
    levels++;
  }
  return { ms: Date.now() - t, bytes, requests, levels };
}

// --roundtrip: the two hops of a live session, rather than the start.
//   send  the person presses Send -> the agent's `wait` returns the answers
//   post  the agent runs `post` -> the page's stream delivers the new state
async function roundtrip() {
  const payload = path.join(HOME, "rt.json");
  const item = { id: "q1", kind: "text", title: "Anything", body: "Say something." };
  fs.writeFileSync(payload, JSON.stringify({ workflow: "pathfinder", items: [item], agent: { status: "waiting" } }));
  const out = spawnSync(process.execPath, [CONSOLE_CLI, "open", "--file", payload, "--no-open"], { cwd: CWD, env: ENV, encoding: "utf8" });
  const opened = JSON.parse(out.stdout.trim().split("\n").pop());
  const [, base, token] = opened.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  const headers = { cookie: `p2c_console_${new URL(base).port}=${token}`, "content-type": "application/json" };
  const sends = [];
  const posts = [];
  for (let i = -1; i < RUNS; i++) {
    // send: a waiter already sitting in its slice, then the press.
    const waiter = spawn(process.execPath, [CONSOLE_CLI, "wait", "--session", opened.sid, "--seconds", "30"], { cwd: CWD, env: ENV });
    const done = new Promise((r) => waiter.on("exit", () => r(Date.now())));
    await new Promise((r) => setTimeout(r, 700));
    const t = Date.now();
    await fetch(base + "/submit", { method: "POST", headers, body: JSON.stringify({ actions: [{ i: "q1", type: "answer", kind: "text", text: "x" + i }], reply: "x" }) });
    const sendMs = (await done) - t;

    // post: a page listening on the stream, then the agent's update.
    const ctrl = new AbortController();
    const res = await fetch(base + "/events", { headers, signal: ctrl.signal });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    await reader.read();
    const patch = path.join(HOME, "rt-patch.json");
    fs.writeFileSync(patch, JSON.stringify({ items: [{ id: "q1", status: "open", body: "Again " + i }], agent: { status: "waiting" } }));
    const tp = Date.now();
    spawnSync(process.execPath, [CONSOLE_CLI, "post", "--session", opened.sid, "--file", patch], { cwd: CWD, env: ENV });
    const postCli = Date.now() - tp;
    let buf = "";
    while (!buf.includes("Again " + i)) buf += dec.decode((await reader.read()).value);
    const postMs = Date.now() - tp;
    ctrl.abort();
    if (i >= 0) {
      sends.push(sendMs);
      posts.push({ total: postMs, cli: postCli });
    }
  }
  spawnSync(process.execPath, [CONSOLE_CLI, "stop", "--all"], { cwd: CWD, env: ENV });
  const med = (v) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
  console.log(`web console round trips, ${RUNS} runs`);
  console.log(`send -> wait returns     median ${med(sends)} ms  (min ${Math.min(...sends)}, max ${Math.max(...sends)})`);
  console.log(`post -> page has it      median ${med(posts.map((p) => p.total))} ms  (of which the post CLI ${med(posts.map((p) => p.cli))} ms)`);
  fs.rmSync(HOME, { recursive: true, force: true });
}

async function main() {
  if (args.roundtrip) return roundtrip();
  const browserPath = findBrowser();
  let puppeteer = null;
  if (browserPath) {
    try {
      puppeteer = (await import("puppeteer-core")).default;
    } catch {
      console.error("puppeteer-core not installed; browser columns skipped");
    }
  }
  const browser = puppeteer
    ? await puppeteer.launch({ executablePath: browserPath, headless: true, args: ["--no-first-run", "--no-default-browser-check"] })
    : null;

  const rows = [];
  // One throwaway run so disk caches and the Node binary are warm; the person
  // running this has run node before too.
  for (let i = -1; i < RUNS; i++) {
    stopAll();
    // The tab exists before the clock starts: a person's browser is already
    // running, and creating a context is the harness's cost, not the page's.
    const ctx = browser ? await browser.createBrowserContext() : null;
    const page = ctx ? await ctx.newPage() : null;
    const { t0, urlP, exitP, openP } = runOpen();
    const o = await openP;
    if (!o.url) {
      const e = await exitP;
      throw new Error(`open failed (${e.code}): ${e.err}`);
    }
    const row = { open: o.at - t0 };
    if (browser) {
      let bytes = 0;
      let requests = 0;
      page.on("response", async (res) => {
        requests++;
        try {
          bytes += (await res.buffer()).length;
        } catch {}
      });
      if (BROWSER_DELAY) await new Promise((r) => setTimeout(r, Math.max(0, o.at + BROWSER_DELAY - Date.now())));
      await page.goto(o.url, { waitUntil: "domcontentloaded" });
      const timing = await page.evaluate(async () => {
        // "ready" = drawn from real state: a dashboard card, a question card,
        // the starting screen or the waiting pane a real state produces.
        const readySel = ".dash-card, .card.question, .waiting-pane, .launching.starting, .handoff";
        await new Promise((resolve) => {
          const check = () => (document.querySelector(readySel) ? resolve() : requestAnimationFrame(check));
          check();
        });
        const readyAt = performance.timeOrigin + performance.now();
        // The real screen can be drawn before the first paint happens at all,
        // so wait for the paint rather than reading an entry not yet made.
        const fcp = await new Promise((resolve) => {
          const got = () => performance.getEntriesByName("first-contentful-paint")[0];
          if (got()) return resolve(got());
          new PerformanceObserver(() => got() && resolve(got())).observe({ type: "paint", buffered: true });
          setTimeout(() => resolve(got() || null), 3000);
        });
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          origin: performance.timeOrigin,
          fcp: fcp ? performance.timeOrigin + fcp.startTime : null,
          response: nav ? performance.timeOrigin + nav.responseEnd : null,
          ready: readyAt,
        };
      });
      // The origin here is the redirected document, so the 302 is inside
      // `response`, not before it.
      row.response = Math.round(timing.response - t0);
      row.fcp = timing.fcp ? Math.round(timing.fcp - t0) : null;
      row.ready = Math.round(timing.ready - t0);
      await new Promise((r) => setTimeout(r, 150));
      row.requests = requests;
      row.kb = Math.round(bytes / 1024);
      await ctx.close();
    }
    const e = await exitP;
    row.url = (await urlP).at - t0;
    row.cliExit = e.at - t0;
    if (!browser) Object.assign(row, await httpWaterfall(o.url));
    if (i >= 0) rows.push(row);
  }
  stopAll();
  if (browser) await browser.close();

  const cols = Object.keys(rows[0]);
  const stat = (k) => {
    const v = rows.map((r) => r[k]).filter((x) => typeof x === "number").sort((a, b) => a - b);
    if (!v.length) return null;
    return { median: v[Math.floor(v.length / 2)], min: v[0], max: v[v.length - 1] };
  };
  const summary = Object.fromEntries(cols.map((k) => [k, stat(k)]));
  console.log(`web console start-up, ${RUNS} runs, workflow=${WORKFLOW}, cwd=${CWD}`);
  console.log(`browser: ${browser ? browserPath : "none (HTTP-only waterfall)"}`);
  console.log("metric".padEnd(10) + "median".padStart(9) + "min".padStart(9) + "max".padStart(9));
  for (const k of cols) {
    const s = summary[k];
    if (!s) continue;
    const unit = k === "kb" ? " KB" : k === "requests" || k === "levels" ? "" : " ms";
    console.log(k.padEnd(10) + `${s.median}${unit}`.padStart(9) + `${s.min}`.padStart(9) + `${s.max}`.padStart(9));
  }
  if (args.json) fs.writeFileSync(path.resolve(args.json), JSON.stringify({ runs: rows, summary }, null, 2));
  fs.rmSync(HOME, { recursive: true, force: true });
}

main().catch((e) => {
  stopAll();
  console.error(e);
  process.exit(1);
});
