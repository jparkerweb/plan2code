// Tests for plan2code-app/ui/meter.js and the app bar's own shape. Run with:
// node --test scripts/test-app-meter.mjs
//
// app.js itself cannot be imported here (it touches `document` and
// `window.__TAURI__` at module scope), which is why the bar's pure decisions
// live in their own module and the rest is checked as plain text, the same
// way the web console's own "shape" tests work.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { barNextSteps, folderName, windowTitleFor, NEXT_STEP_LABELS } from "../plan2code-app/ui/meter.js";
import { findBrowser, launchBrowser } from "./browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.join(HERE, "../plan2code-app/ui/index.html");
const APP_JS = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/app.js"), "utf8");
const INDEX_HTML = fs.readFileSync(INDEX_HTML_PATH, "utf8");

test("barNextSteps offers nothing while the console runs and the versions agree", () => {
  assert.deepEqual(barNextSteps(), []);
  assert.deepEqual(barNextSteps({ consoleDead: false, version: null }), []);
});

test("barNextSteps puts the most pressing step first: a done update, then a stopped console, then the skills", () => {
  const ids = (input) => barNextSteps(input).map((step) => step.id);
  assert.deepEqual(ids({ consoleDead: true }), ["console-dead"]);
  assert.deepEqual(ids({ version: { kind: "mismatch", skills: "3.0.0", app: "3.1.0" } }), ["mismatch"]);
  assert.deepEqual(ids({ consoleDead: true, version: { kind: "mismatch", skills: "3.0.0", app: "3.1.0" } }), ["console-dead", "mismatch"]);
  assert.deepEqual(ids({ consoleDead: true, version: { kind: "too-old" } }), ["console-dead", "too-old"]);
  assert.deepEqual(ids({ version: { kind: "updated" } }), ["updated"]);
});

test("only one control for reconnecting the console is ever offered: after an update, its Reconnect covers a stopped console too", () => {
  const steps = barNextSteps({ consoleDead: true, version: { kind: "updated" } });
  assert.deepEqual(steps.map((step) => step.action), ["restart-console"], "the plain reconnect steps aside for the one that stops the old console first");
});

test("each version state reads and acts as the old version bar did", () => {
  const [mismatch] = barNextSteps({ version: { kind: "mismatch", skills: "3.0.0", app: "3.1.0" } });
  assert.equal(mismatch.text, "Skills v3.0.0, app v3.1.0");
  assert.equal(mismatch.label, "Update skills");
  const [ahead] = barNextSteps({ version: { kind: "ahead", skills: "3.2.0", app: "3.1.0" } });
  assert.equal(ahead.action, null, "another Update skills run cannot help when the skills are ahead");
  assert.match(ahead.title, /newer than this app \(v3\.1\.0\)\. Get the new app\./);
  const [updating] = barNextSteps({ version: { kind: "updating", line: "Installing skills (4 of 9)" } });
  assert.deepEqual([updating.text, updating.busy, updating.action], ["Installing skills (4 of 9)", true, null], "no button while it runs");
  const [remains] = barNextSteps({ version: { kind: "remains", skills: "3.0.0", app: "3.1.0" } });
  assert.equal(remains.action, null);
  assert.equal(remains.title, "Updated, but the mismatch remains (skills v3.0.0, app v3.1.0).");
  const [failed] = barNextSteps({ version: { kind: "failed", error: "npm exited with code 1" } });
  assert.deepEqual([failed.tone, failed.title, failed.label], ["err", "npm exited with code 1", "Update skills"], "a failed update can be tried again");
  const [tooOld] = barNextSteps({ version: { kind: "too-old" } });
  assert.equal(tooOld.label, "Update skills", "an old console is fixed by the skills update");
});

test("every control that reconnects the console carries the same label, never 'Restart the console' or 'Start it again'", () => {
  assert.equal(NEXT_STEP_LABELS.reconnect, "Reconnect the console");
  assert.equal(NEXT_STEP_LABELS["restart-console"], "Reconnect the console");
  assert.doesNotMatch(APP_JS, /'Restart the console'|"Start it again"/, "no stale label text left in app.js");
});

test("app.js draws the bar's right end through barNextSteps, not a hand-rolled copy of its order", () => {
  assert.match(APP_JS, /const steps = barNextSteps\(\{ consoleDead, version: versionState \}\);/);
  for (const gone of ["console-again", "version-update", "permissions-note", "console-status", "project-dir"]) {
    assert.ok(!INDEX_HTML.includes(`id="${gone}"`), `index.html still has #${gone}`);
  }
});

test("the bar reads project menu, New Session, agent menu, with both menus outside the scrolling row", () => {
  const row = INDEX_HTML.slice(INDEX_HTML.indexOf('<div id="bar-row">'), INDEX_HTML.indexOf('<div id="project-menu"'));
  const at = (id) => row.indexOf(`id="${id}"`);
  assert.ok(at("project-menu-button") >= 0 && at("agent-restart") > at("project-menu-button"), "New Session follows the project menu");
  assert.ok(at("agent-menu-button") > at("agent-restart"), "New Session sits just left of the agent menu");
  assert.ok(!row.includes('id="project-menu"') && !row.includes('id="agent-menu"'), "the menus are not inside #bar-row, whose overflow would clip them");
  assert.match(INDEX_HTML, /<div id="agent-menu"[\s\S]*?<button id="change-agent" role="menuitem" hidden>/, "Change agent lives in the agent menu");
  assert.match(INDEX_HTML, /<div id="project-menu"[\s\S]*?<button id="change-project" role="menuitem">/, "Change project lives in the project menu");
});

test("folderName shows the project folder's own name, or the whole path when it has none", () => {
  assert.equal(folderName("C:\\git\\azw3-to-pdf"), "azw3-to-pdf");
  assert.equal(folderName("/home/me/plan2code/"), "plan2code");
  assert.equal(folderName("/"), "/");
  assert.equal(folderName(""), "");
});

test("the context-window meter is gone for good: no stray element, poll, or backend call left wired up", () => {
  for (const needle of ["bar-slot-meter", "context-group", "context-nudge", "context-restart", "Agent context"]) {
    assert.ok(!INDEX_HTML.includes(needle), `index.html still has ${needle}`);
  }
  for (const needle of ["agent_context", "pollMeter", "nudgeDue", "renderMeter", "nudgePercent"]) {
    assert.ok(!APP_JS.includes(needle), `app.js still has ${needle}`);
  }
});

test("windowTitleFor names the project folder after Plan2Code, so two or more windows read apart in a taskbar", () => {
  assert.equal(windowTitleFor("C:\\git\\azw3-to-pdf"), "Plan2Code - azw3-to-pdf");
  assert.equal(windowTitleFor("/home/me/projects/plan2code"), "Plan2Code - plan2code");
  assert.equal(windowTitleFor("C:\\git\\azw3-to-pdf\\"), "Plan2Code - azw3-to-pdf", "a trailing slash does not leave an empty last segment");
  assert.equal(windowTitleFor("/"), "Plan2Code", "a root with nothing after it has no folder name to show");
  assert.equal(windowTitleFor(""), "Plan2Code");
  assert.equal(windowTitleFor(null), "Plan2Code");
  assert.equal(windowTitleFor(undefined), "Plan2Code");
});

test("setProjectDir sets the OS window title through windowTitleFor, with a real permission to do so", () => {
  assert.match(APP_JS, /window\.__TAURI__\.window\.getCurrentWindow\(\)\.setTitle\(windowTitleFor\(dir\)\)/, "setProjectDir is the one place every project-dir change flows through");
  const caps = JSON.parse(fs.readFileSync(path.join(HERE, "../plan2code-app/src-tauri/capabilities/default.json"), "utf8"));
  assert.ok(caps.permissions.includes("core:window:allow-set-title"), "the capability to call setTitle must be granted, or the call is silently refused at runtime");
});

