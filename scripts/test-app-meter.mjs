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
import { barNextSteps, continueKeys, defaultRightFraction, folderName, pickDefaultAgent, windowTitleFor, CONSOLE_ASIDE_BREAKPOINT_PX, NEXT_STEP_LABELS } from "../plan2code-app/ui/meter.js";
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

// Claude Code holds typed text as a queued message while its turn is busy,
// and the continue button only shows once the agent stopped checking in, so
// by then the turn is stuck and the queued word would never send by itself.
test("continueKeys types continue and Enter, and under Claude Code also its send-now chord (ctrl+x ctrl+s)", () => {
  assert.deepEqual(continueKeys("claude"), ["continue", "\r", "\x18\x13"]);
  for (const kind of ["devin", "codex", null, undefined, "something-new"]) {
    assert.deepEqual(continueKeys(kind), ["continue", "\r"], `${kind} gets the plain word and Enter`);
  }
});

test("app.js types the continue button's keystrokes through continueKeys, for the running agent's kind", () => {
  const typeContinue = APP_JS.slice(APP_JS.indexOf("function typeContinue"), APP_JS.indexOf("function typeContinue") + 800);
  assert.match(typeContinue, /continueKeys\(agent\.kind\)/, "the keystrokes come from continueKeys");
  assert.doesNotMatch(typeContinue, /data: 'continue'/, "no hand-typed word left beside it");
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

test("the launch card's permission-mode tick starts checked (off), matching the plain terminal launcher's own always-off default", () => {
  assert.match(
    INDEX_HTML,
    /<input id="launch-bypass" type="checkbox" checked>/,
    "the checkbox markup itself must carry `checked`, not something app.js sets later"
  );
  // The warning sentence starts visible along with it: no `hidden` attribute on this element.
  assert.match(INDEX_HTML, /<p id="launch-bypass-warning">Permission checks will be off/);
  // Nothing in app.js resets it back to unchecked on every card show.
  assert.doesNotMatch(APP_JS, /launchBypassEl\.checked\s*=\s*false/, "no reset back to unchecked anywhere");
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

test("app.js never sets statePlannyEl.hidden directly: SVGElement does not reflect that property to the attribute", () => {
  assert.doesNotMatch(APP_JS, /statePlannyEl\.hidden\s*=/, "must use toggleAttribute, not the .hidden property, on an <svg>");
  assert.match(APP_JS, /statePlannyEl\.toggleAttribute\('hidden', !tired\)/);
});

test("the Restart confirmation no longer claims unsaved work, and offers New Session with the tired Planny", () => {
  const confirmRestart = APP_JS.slice(APP_JS.indexOf("function confirmRestart"), APP_JS.indexOf("function confirmRestart") + 600);
  assert.doesNotMatch(confirmRestart, /not saved/, "not always true, so it is gone from this dialog specifically");
  assert.match(confirmRestart, /'Restart the agent on a fresh context window\?',\s*\n\s*'New Session',/);
  assert.match(confirmRestart, /\{ tired: true \}/, "the confirm dialog asks for the tired Planny");
  assert.match(INDEX_HTML, /<svg id="dashboard-state-planny"[^>]*hidden>/, "the tired Planny starts hidden in the markup");
});

test("defaultRightFraction gives the terminal a roomy width when the window has space for it, down to the floor when it does not", () => {
  const opts = { minFraction: 0.1, maxFraction: 0.6 };
  // Plenty of room: the ideal 440px pane, well inside both the console's own
  // 1080px minimum and the 0.6 ceiling.
  assert.equal(defaultRightFraction(1920, opts), 440 / 1920);
  // Just enough room for the console at 1080px and nothing more for the pane
  // than that leaves: the pane shrinks to fit, never pushing the console under.
  assert.equal(defaultRightFraction(1200, opts), 120 / 1200);
  // No room at all for the console's own 1080px minimum: the pane's floor
  // wins rather than vanishing to 0 or going negative.
  assert.equal(defaultRightFraction(1000, opts), 0.1);
  // The ceiling still applies even with abundant width.
  assert.equal(defaultRightFraction(3000, { minFraction: 0.1, maxFraction: 0.1 }), 0.1);
  assert.equal(CONSOLE_ASIDE_BREAKPOINT_PX, 1080, "matches responsive.css's own breakpoint");
});

test("with nothing saved yet, app.js starts the terminal docked right via defaultRightFraction, not the bottom default", () => {
  assert.match(APP_JS, /paneDock = 'right';\s*\n\s*paneFraction = defaultRightFraction\(/, "the no-saved-state branch sets dock right");
  assert.match(APP_JS, /\} else \{[\s\S]{0,200}paneDock = 'right'/, "this only runs when state.termPanel is absent, never overriding a saved choice");
});

// Docked right and collapsed, the terminal panel is a 28px-wide strip: the
// Expand/Collapse button's text used to run horizontally off the edge of it
// (visible, unreadable). It now reads top-to-bottom instead.
test("docked right and collapsed, the terminal panel's Expand button fits the strip instead of overflowing it", async (t) => {
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    page.on("pageerror", () => {}); // app.js calls into __TAURI__, absent here; the markup and CSS still load fine
    await page.goto(pathToFileURL(INDEX_HTML_PATH).href);
    await page.evaluate(() => {
      document.getElementById("workspace").classList.add("dock-right");
      document.getElementById("term-panel").classList.add("collapsed");
      document.getElementById("term-collapse").textContent = "Expand";
    });
    const fit = await page.evaluate(() => {
      const el = document.getElementById("term-collapse");
      return {
        writingMode: getComputedStyle(el).writingMode,
        overflowsWidth: el.scrollWidth > el.clientWidth,
        overflowsPanel: el.getBoundingClientRect().right > document.getElementById("term-panel").getBoundingClientRect().right,
      };
    });
    assert.equal(fit.writingMode, "vertical-rl", "the label is set to run top-to-bottom, not sideways");
    assert.equal(fit.overflowsWidth, false, "the label text does not overflow its own box");
    assert.equal(fit.overflowsPanel, false, "the button does not spill past the collapsed panel's edge");
  } finally {
    await browser.close();
  }
});

test("toggling the tired Planny <svg>'s hidden attribute the way app.js does actually shows and hides it", async (t) => {
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
    page.on("pageerror", () => {});
    await page.goto(pathToFileURL(INDEX_HTML_PATH).href);
    // Setting the .hidden *property* on an <svg> does not reflect to the
    // attribute the way it does on an HTMLElement; app.js uses
    // toggleAttribute for exactly this reason. This exercises that real path.
    const shown = await page.evaluate(() => {
      document.getElementById("dashboard-state").hidden = false; // a plain div: the .hidden property works fine here
      const el = document.getElementById("dashboard-state-planny");
      el.toggleAttribute("hidden", false);
      return { display: getComputedStyle(el).display, rect: el.getBoundingClientRect() };
    });
    assert.notEqual(shown.display, "none", "toggleAttribute(false) makes it visible");
    assert.ok(shown.rect.width > 0 && shown.rect.height > 0, "it actually takes up space, not just display != none");
    const hiddenAgain = await page.evaluate(() => {
      const el = document.getElementById("dashboard-state-planny");
      el.toggleAttribute("hidden", true);
      return getComputedStyle(el).display;
    });
    assert.equal(hiddenAgain, "none", "toggleAttribute(true) hides it again");
  } finally {
    await browser.close();
  }
});

test("continueKeys gives a custom agent id the plain word and Enter", () => {
  assert.deepEqual(continueKeys("my-aider"), ["continue", "\r"]);
});

const AVAIL = (spec) =>
  spec.map(([id, installed, custom = false]) => ({ id, label: id, installed, custom }));

test("pickDefaultAgent keeps the remembered agent when it is installed, custom ones included", () => {
  const list = AVAIL([["claude", true], ["devin", true], ["codex", true], ["mine", true, true]]);
  assert.equal(pickDefaultAgent(list, "codex"), "codex");
  assert.equal(pickDefaultAgent(list, "mine"), "mine");
});

test("pickDefaultAgent falls back to the first installed built-in, then the first installed custom agent", () => {
  assert.equal(pickDefaultAgent(AVAIL([["claude", false], ["devin", false], ["codex", true]]), null), "codex");
  assert.equal(pickDefaultAgent(AVAIL([["claude", false], ["devin", true], ["codex", true]]), "claude"), "devin");
  assert.equal(pickDefaultAgent(AVAIL([["claude", false], ["devin", false], ["codex", false], ["mine", true, true]]), "claude"), "mine");
});

test("pickDefaultAgent with nothing installed returns the remembered id, else the first entry, else null", () => {
  const none = AVAIL([["claude", false], ["devin", false], ["codex", false]]);
  assert.equal(pickDefaultAgent(none, "devin"), "devin");
  assert.equal(pickDefaultAgent(none, null), "claude");
  assert.equal(pickDefaultAgent([], null), null);
});
