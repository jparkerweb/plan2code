// Picks and launches the browser for page tests and the dev scripts. Dev-only:
// lives in scripts/ so it never ships inside a skill.
//
// The first installed of Chrome then Edge, through playwright-core (a root
// devDependency); PLAN2CODE_TEST_BROWSER=chrome or msedge forces one. Every
// failure is one line in our own words, never Playwright's install hint.

import fs from "node:fs";

// The fixed places each browser installs to, probed in order on every
// platform (a path that cannot exist here is simply not found).
export const BROWSER_PATHS = {
  chrome: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
  msedge: [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
  ],
};

const CHANNELS = Object.keys(BROWSER_PATHS);

// Returns { channel, path } for the first browser found, or null. Either way
// findBrowser.checked lists every path this call looked at.
export function findBrowser({ env = process.env, exists = fs.existsSync } = {}) {
  const forced = env.PLAN2CODE_TEST_BROWSER;
  if (forced && !CHANNELS.includes(forced)) {
    throw new Error(`PLAN2CODE_TEST_BROWSER must be ${CHANNELS.join(" or ")} (it is "${forced}").`);
  }
  findBrowser.checked = [];
  for (const channel of forced ? [forced] : CHANNELS) {
    for (const p of BROWSER_PATHS[channel]) {
      findBrowser.checked.push(p);
      if (exists(p)) return { channel, path: p };
    }
  }
  return null;
}
findBrowser.checked = [];

// null when page tests can run here, otherwise the one line that says why
// not. `checked` defaults to the paths the last findBrowser() call probed.
export function browserProblem({ nodeVersion = process.versions.node, found, checked = findBrowser.checked } = {}) {
  if (Number(nodeVersion.split(".")[0]) < 20) {
    return `Page tests need Node 20 or newer (this is ${nodeVersion}). Users of Plan2Code still only need Node 18.`;
  }
  if (!found) {
    return `Page tests need Chrome or Edge. Looked in: ${checked.join(", ")}. Install either one, or set PLAN2CODE_TEST_BROWSER.`;
  }
  return null;
}

// Launches the browser findBrowser() picks, headless. `options` go to
// Playwright's chromium.launch() as they are (an `executablePath` there skips
// the pick); `find` hands findBrowser() its env and exists, for tests. A
// problem rejects with an Error whose message is our one line and whose
// `browserProblem` is true, never Playwright's own launch text.
export async function launchBrowser(options = {}, find = {}) {
  const found = options.executablePath ? { channel: null, path: options.executablePath } : findBrowser(find);
  const problem = browserProblem({ found });
  if (problem) throw Object.assign(new Error(problem), { browserProblem: true });
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (e) {
    throw Object.assign(new Error("Page tests need playwright-core: run npm install.", { cause: e }), { browserProblem: true });
  }
  try {
    return await chromium.launch({
      executablePath: found.path,
      headless: true,
      args: ["--no-first-run", "--no-default-browser-check"],
      ...options,
    });
  } catch (e) {
    // Playwright's own text stays out of the message, but is kept as the
    // cause for whoever needs to debug a real launch failure.
    const line = `Page tests could not start the browser at ${found.path}. Install Chrome or Edge, or set PLAN2CODE_TEST_BROWSER.`;
    throw Object.assign(new Error(line, { cause: e }), { browserProblem: true });
  }
}
