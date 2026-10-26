// Tests for the shared browser helper (scripts/browser.mjs) and the two dev
// scripts that launch a browser through it. Run with:
// node --test scripts/test-browser-helper.mjs
//
// The unit cases hand findBrowser() a fake `exists`, so they run anywhere. The
// live cases launch a real Chrome or Edge and skip when none is installed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("playwright-core is pinned exactly in the root devDependencies", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.devDependencies["playwright-core"], "1.64.1");
});

// A fake file system holding only `present`.
const only = (...present) => (p) => present.includes(p);

test("findBrowser picks Chrome, then Edge, and honors PLAN2CODE_TEST_BROWSER", async () => {
  const { findBrowser, BROWSER_PATHS } = await import("./browser.mjs");
  const chrome = BROWSER_PATHS.chrome[0];
  const edge = BROWSER_PATHS.msedge[0];

  assert.deepEqual(findBrowser({ env: {}, exists: only(edge) }), { channel: "msedge", path: edge });
  assert.deepEqual(findBrowser({ env: {}, exists: only(chrome, edge) }), { channel: "chrome", path: chrome });
  assert.deepEqual(findBrowser({ env: { PLAN2CODE_TEST_BROWSER: "msedge" }, exists: only(chrome, edge) }), { channel: "msedge", path: edge });
  assert.deepEqual(findBrowser({ env: { PLAN2CODE_TEST_BROWSER: "chrome" }, exists: only(edge) }), null);
  assert.deepEqual(findBrowser.checked, BROWSER_PATHS.chrome);
  assert.throws(() => findBrowser({ env: { PLAN2CODE_TEST_BROWSER: "firefox" }, exists: only(chrome) }), (e) => /chrome/.test(e.message) && /msedge/.test(e.message));

  assert.equal(findBrowser({ env: {}, exists: only() }), null);
  assert.deepEqual(findBrowser.checked, [...BROWSER_PATHS.chrome, ...BROWSER_PATHS.msedge]);
});

test("browserProblem says what is missing in one line of our own words", async () => {
  const { browserProblem } = await import("./browser.mjs");
  const found = { channel: "chrome", path: "C:\chrome.exe" };

  const oldNode = browserProblem({ nodeVersion: "18.19.0", found });
  assert.equal(oldNode, "Page tests need Node 20 or newer (this is 18.19.0). Users of Plan2Code still only need Node 18.");

  const checked = ["C:\a\chrome.exe", "/usr/bin/microsoft-edge"];
  const none = browserProblem({ nodeVersion: "24.12.0", found: null, checked });
  assert.match(none, /^Page tests need Chrome or Edge\. Looked in: /);
  for (const p of checked) assert.ok(none.includes(p), `names ${p}`);
  assert.ok(none.endsWith("Install either one, or set PLAN2CODE_TEST_BROWSER."));

  assert.equal(browserProblem({ nodeVersion: "24.12.0", found }), null);
  for (const line of [oldNode, none]) {
    assert.ok(!line.includes("\n"));
    assert.ok(!line.includes("playwright install"));
  }
});

test("launchBrowser fails with our one line when the forced browser is missing", async () => {
  const { launchBrowser, BROWSER_PATHS } = await import("./browser.mjs");
  const edgeOnly = only(BROWSER_PATHS.msedge[0]);
  await assert.rejects(launchBrowser({}, { env: { PLAN2CODE_TEST_BROWSER: "chrome" }, exists: edgeOnly }), (e) => {
    assert.equal(e.browserProblem, true);
    assert.match(e.message, /^Page tests need Chrome or Edge\. Looked in: /);
    assert.ok(!e.message.includes("\n"));
    return true;
  });
});

test("launchBrowser opens a page in the installed browser", async (t) => {
  const { launchBrowser, findBrowser } = await import("./browser.mjs");
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto("data:text/html,<p>ok</p>");
    assert.equal(await page.textContent("p"), "ok");
  } finally {
    await browser.close();
  }
});

// Width and height from a WebP file's first chunk (lossy VP8, lossless VP8L,
// or the extended VP8X header).
function webpSize(buf) {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  throw new Error(`unknown WebP chunk ${chunk}`);
}

const CAPTURE = path.join(ROOT, "scripts", "capture-screenshots.mjs");

test("capture-screenshots writes both themes as 2560x1600 WebP (slow)", { timeout: 120000 }, async (t) => {
  const { findBrowser } = await import("./browser.mjs");
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-shots-test-"));
  try {
    const r = spawnSync(process.execPath, [CAPTURE, "--only", "question", "--out", out], { encoding: "utf8", timeout: 110000 });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    for (const theme of ["light", "dark"]) {
      const buf = fs.readFileSync(path.join(out, `question-${theme}.webp`));
      assert.deepEqual(webpSize(buf), { width: 2560, height: 1600 });
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("capture-screenshots --compare refuses to write into docs/screenshots", () => {
  // A shot that does not exist: were the guard ever to break, the run would
  // stop at "Unknown shot" (which never names docs/screenshots) rather than
  // shoot every screen into the published folder.
  const argv = [CAPTURE, "--compare", "--only", "__no-such-shot__", "--out", path.join(ROOT, "docs", "screenshots")];
  const r = spawnSync(process.execPath, argv, { encoding: "utf8", timeout: 30000 });
  assert.notEqual(r.status, 0);
  const lines = r.stderr.trim().split("\n");
  assert.equal(lines.length, 1, r.stderr);
  assert.match(lines[0], /docs[\\/]screenshots/);
});

test("capture-screenshots --compare shoots the comparison-only screens (slow)", { timeout: 120000 }, async (t) => {
  const { findBrowser } = await import("./browser.mjs");
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-compare-test-"));
  try {
    const r = spawnSync(process.execPath, [CAPTURE, "--compare", "--only", "help", "--out", out], { encoding: "utf8", timeout: 110000 });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    for (const theme of ["light", "dark"]) assert.ok(fs.statSync(path.join(out, `help-${theme}.webp`)).size > 0);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
