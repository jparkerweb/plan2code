// Start a real console and open its page in a real browser, for the page tests
// (scripts/test-web-console-page-*.mjs).
//
// One browser per test file (pageSuite), a fresh console session and browser
// context per test (openSession). Sessions run against the file's own console
// home from web-console-test-helpers.mjs, in a temp project unless a test
// names one. Any uncaught error on the page fails the test that opened it, so
// a later split that breaks a screen shows as a named error, not a blank page.

import fs from "node:fs";
import path from "node:path";
import { cli, payload, until, HOME, REMEMBERED } from "./web-console-test-helpers.mjs";
import { launchBrowser } from "./browser.mjs";

// `test` is node:test's test function (or any context with .after): the
// browser is launched the first time a test asks for it and closed once the
// file is done.
export function pageSuite(test) {
  let launching = null;
  test.after(async () => {
    if (launching) await (await launching).close();
  });
  return {
    browser: () => (launching ??= launchBrowser()),
  };
}

let projects = 0;
let payloads = 0;

// A fresh project folder under the file's console home, removed with it.
export function tempProject(files = {}) {
  const dir = path.join(HOME, "projects", `p${++projects}`);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Opens a console session the way an agent does (`console.mjs open`, then
// `post`), and its page in a new browser context. Resolves once the page has
// drawn from the session's real state, not the boot pane in the markup.
// `t` is the test's context: stop() is registered with t.after, so a failing
// test still cleans up, and a page error fails the test. `clock: true` gives
// the page Playwright's fake clock before it loads (s.page.clock), so a test
// can jump past the page's silence limits instead of sitting through them.
export async function openSession(browser, { t, workflow, payload: first, project, open = [], clock = false, env, init } = {}) {
  fs.rmSync(REMEMBERED, { force: true });
  const cwd = project || tempProject();
  const opened = cli(["open", "--workflow", workflow, "--no-open", ...open], { cwd, env }).json;
  const s = {
    sid: opened.sid,
    session: opened.session,
    url: opened.url,
    project: cwd,
    errors: [],
    context: null,
    page: null,
  };

  // The agent's side, run from the project like an agent would.
  s.post = (patch) => {
    const r = cli(["post", "--session", s.sid, "--file", payload(`page-post-${++payloads}.json`, patch)], { cwd });
    if (r.status !== 0) throw new Error(`post failed (${r.status}): ${r.stderr}`);
    return r.json;
  };
  s.wait = (seconds = 10) => {
    const r = cli(["wait", "--session", s.sid, "--seconds", String(seconds)], { cwd });
    return { code: r.status, ...(r.json || {}) };
  };
  // Whether the session's server still answers on its port.
  s.answers = async () => {
    try {
      await fetch(new URL("/health", s.url), { signal: AbortSignal.timeout(1000) });
      return true;
    } catch {
      return false;
    }
  };
  let stopped = false;
  s.stop = async () => {
    if (stopped) return;
    stopped = true;
    cli(["stop", "--session", s.sid], { cwd });
    if (s.context) await s.context.close().catch(() => {});
    await until(async () => !(await s.answers()), 5000);
  };
  t.after(async () => {
    await s.stop();
    if (s.errors.length) throw new Error(`uncaught error on the page: ${s.errors[0]}`);
  });

  if (first) s.post(first);
  s.context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (clock) await s.context.clock.install();
  // A script run before the page's own, such as a stand-in for the app's frame.
  if (init) await s.context.addInitScript(init);
  s.page = await s.context.newPage();
  // Playwright's own default (30s) assumes a dedicated machine: the whole
  // suite runs dozens of these pages at once, and a host under that load can
  // leave one of them waiting past 30s for its turn at the CPU to paint a
  // dropdown or settle a click, with nothing wrong in the page itself. Twice
  // the default still catches a genuinely broken page, just gives a busy host
  // room to breathe.
  s.page.setDefaultTimeout(60000);
  s.page.on("pageerror", (e) => s.errors.push(e.message));
  await s.page.goto(s.url, { waitUntil: "domcontentloaded" });
  await drawn(s.page);
  return s;
}

// The page has adopted a state frame: app.js has replaced the boot pane the
// markup ships with.
export async function drawn(page) {
  await page.waitForFunction(() => !document.querySelector("#main .boot-pane"), null, { timeout: 30000 });
}

// Presses Send on the page and collects the send the way an agent's `wait`
// does: the same JSON an agent receives.
export async function sendAndCollect(s) {
  await s.page.click("#btn-send");
  const got = s.wait(10);
  if (got.code !== 0) throw new Error(`nothing was sent (wait exit ${got.code}): ${got.message || ""}`);
  return got;
}

// The card for one item id.
export const itemCard = (page, id) => page.locator(`[data-item="${id}"]`).first();

// A locator's visible text, trimmed.
export const textOf = async (locator) => (await locator.innerText()).trim();

// The scroll offset of the first element matching `selector`.
export const scrollTopOf = (page, selector) => page.$eval(selector, (el) => el.scrollTop);

// Scrolls what `locator` names to `top` ("end" for its bottom), or as far as
// it goes when that is less, and returns where it landed. A redraw can replace
// the element between Playwright finding it and the scroll, and one not laid
// out yet cannot scroll, so it scrolls again until the element on the page
// holds a place past its top.
export async function scrollCard(locator, top) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const at = await locator.evaluate((el, want) => {
      if (!el.isConnected) return null;
      const max = el.scrollHeight - el.clientHeight;
      const target = want === "end" ? max : Math.min(want, max);
      el.scrollTop = target;
      return max > 0 && Math.abs(el.scrollTop - target) < 1 ? el.scrollTop : null;
    }, top);
    if (at !== null) return at;
    if (Date.now() > deadline) throw new Error(`the element never held a scroll to ${top}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

// The computed `props` of the element `locator` names. A redraw can replace the
// element between Playwright finding it and the read, and an element off the
// page reads "" for every style, so a read of one is taken again.
export async function stylesOf(locator, props) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const got = await locator.evaluate((x, ps) => (x.isConnected ? Object.fromEntries(ps.map((p) => [p, getComputedStyle(x)[p]])) : null), props);
    if (got) return got;
    if (Date.now() > deadline) throw new Error(`${props.join(", ")}: the element never stayed on the page long enough to read`);
    await new Promise((r) => setTimeout(r, 50));
  }
}
export const styleOf = async (locator, prop) => (await stylesOf(locator, [prop]))[prop];
