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
import { attentionSignal, barNextSteps, continueKeys, defaultRightFraction, folderName, pickDefaultAgent, taskbarSwitch, windowTitleFor, deadConsoleAction, loopBanner, loopRunText, loopLocks, loopStopLabels, loopWindowTitle, CONSOLE_ASIDE_BREAKPOINT_PX, NEXT_STEP_LABELS, NEW_RELEASE_COMMAND } from "../plan2code-app/ui/meter.js";
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

test("a newer GitHub release is offered last, with the command to copy; a mismatch or a stopped console comes first", () => {
  const newRelease = { latest: "3.0.1" };
  const ids = (input) => barNextSteps(input).map((step) => step.id);
  assert.deepEqual(ids({ newRelease }), ["new-release"]);
  assert.deepEqual(ids({ consoleDead: true, version: { kind: "mismatch", skills: "3.0.0", app: "3.1.0" }, newRelease }), ["console-dead", "mismatch", "new-release"]);
  const [step] = barNextSteps({ newRelease });
  assert.equal(step.text, "Update available: v3.0.1");
  assert.equal(step.label, "Copy update command");
  assert.equal(step.action, "copy-update");
  assert.equal(NEW_RELEASE_COMMAND, "plan2code update");
  assert.deepEqual(barNextSteps({ newRelease: null }), [], "nothing newer, nothing shown");
});

test("after the copy the bar says what to do next; if the clipboard was refused it spells the command out", () => {
  const [copied] = barNextSteps({ newRelease: { latest: "3.0.1", copied: true } });
  assert.match(copied.text, /^Copied: run `plan2code update` in a terminal/);
  assert.equal(copied.action, null);
  const [manual] = barNextSteps({ newRelease: { latest: "3.0.1", manual: true } });
  assert.match(manual.text, /^Run `plan2code update` in a terminal/);
  assert.equal(manual.action, null);
});

test("the app asks once at start for a newer release, and the bar is wired to the copy action", () => {
  assert.match(APP_JS, /invoke\('check_new_release'\)/);
  assert.match(APP_JS, /'copy-update': copyUpdateCommand/);
  assert.match(APP_JS, /barNextSteps\(\{ consoleDead, version: versionState, newRelease \}\)/);
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
  assert.match(APP_JS, /const steps = barNextSteps\(\{ consoleDead, version: versionState, newRelease \}\);/);
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

// The console page's What to check lines make "terminal" a button while the
// pane is collapsed (core.js renderStatus), so it must hear the pane's state.
test("app.js tells the console page whether the terminal pane is collapsed, and expands only a collapsed pane on terminal-open", () => {
  const layout = APP_JS.slice(APP_JS.indexOf("function applyPaneLayout"), APP_JS.indexOf("function savePaneSettings"));
  assert.match(layout, /updateBadge\(\);\s+tellTerminalState\(\);\s+\}/, "every layout change is told");
  assert.match(layout, /plan2code: 'terminal-state', collapsed: paneCollapsed/, "a named message with one boolean");
  assert.match(layout, /if \(!force && toldCollapsed === paneCollapsed\) return;/, "only a change is told, not every drag");
  assert.match(APP_JS, /plan2code: 'taskbar-state', on \}, '\*'\);\s+tellTerminalState\(true\);/, "the page hears it on its hello");
  assert.match(APP_JS, /kind === 'terminal-open'\) \{[^}]*if \(paneCollapsed\) termCollapseBtn\.click\(\);/, "the pane's own button expands it");
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
// collapse button's text used to run horizontally off the edge of it
// (visible, unreadable). It now reads top-to-bottom instead.
test("docked right and collapsed, the terminal panel's View Agent Terminal button fits the strip instead of overflowing it", async (t) => {
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    page.on("pageerror", () => {}); // app.js calls into __TAURI__, absent here; the markup and CSS still load fine
    await page.goto(pathToFileURL(INDEX_HTML_PATH).href);
    await page.evaluate(() => {
      document.getElementById("workspace").classList.add("dock-right");
      document.getElementById("term-panel").classList.add("collapsed");
      document.getElementById("term-collapse").textContent = "View Agent Terminal";
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

test("pickDefaultAgent drops a remembered id the list no longer has, unless there is no list at all", () => {
  const none = AVAIL([["claude", false], ["devin", false], ["codex", false]]);
  // A custom agent deleted since: the picker could not show it, so the first entry it can.
  assert.equal(pickDefaultAgent(none, "gone"), "claude");
  // The availability check failed: the fixed options are on the card, the remembered id stands.
  assert.equal(pickDefaultAgent([], "devin"), "devin");
});

test("the launch card shows agents.json warnings, and Check again asks for a fresh PATH", () => {
  assert.match(INDEX_HTML, /<p id="launch-agents-warning" hidden><\/p>/);
  assert.match(APP_JS, /invoke\('agent_availability', \{ refresh \}\)/);
  assert.match(APP_JS, /async function checkAgentsAgain\(\) \{\n  await loadAgentAvailability\(true\);/);
});

// The console page's taskbar messages reach the app only as one of four fixed
// words or a boolean (attention.rs decides what they mean); app.js forwards
// them through these checks and nothing else.
test("attentionSignal passes only the four favicon states, and taskbarSwitch only a boolean", () => {
  for (const state of ["busy", "ready", "attention", "plain"]) {
    assert.equal(attentionSignal({ plan2code: "attention", state }), state);
  }
  for (const data of [{ state: "Ready" }, { state: "urgent" }, { state: "" }, { state: 1 }, {}, null, undefined]) {
    assert.equal(attentionSignal(data), null, `${JSON.stringify(data)} is not forwarded`);
  }
  assert.equal(taskbarSwitch({ on: true }), true);
  assert.equal(taskbarSwitch({ on: false }), false);
  for (const data of [{ on: "false" }, { on: 0 }, { on: null }, {}, null]) {
    assert.equal(taskbarSwitch(data), null, `${JSON.stringify(data)} is not forwarded`);
  }
});

test("app.js forwards attention and taskbar through those checks, and clears the dot on a new frame and a lost hello", () => {
  assert.match(APP_JS, /const signal = attentionSignal\(event\.data\);\s+if \(signal\) invoke\('set_attention', \{ signal \}\)/);
  assert.match(APP_JS, /const on = taskbarSwitch\(event\.data\);\s+if \(on === null\) return;/);
  assert.match(APP_JS, /invoke\('set_taskbar_signal', \{ on \}\)/);
  assert.match(APP_JS, /function loadFrame\(url\) \{[^}]*clearAttention\(\);[^}]*frame\.src = url;/);
  assert.match(APP_JS, /async function onNoHello\(\) \{\s+if \(frameReady \|\| !consoleKnown \|\| restarting\) return;[\s\S]{0,120}clearAttention\(\);/);
  assert.match(APP_JS, /plan2code: 'taskbar-state', on/, "the page hears the saved switch on its hello");
});

test("the loop banner says what the loop is doing at every moment", () => {
  const base = { phase: 2, phases: 4, phaseName: "API", step: "Build", stopAfterPhase: false, phaseRetried: false, previousPhase: null, previousCommitted: false };
  const said = (extra) => loopBanner({ ...base, ...extra });

  const running = said({});
  assert.equal(running.tone, "running");
  assert.equal(running.title, "Implementation loop running");
  assert.equal(running.detail, "Phase 2 of 4: API \u00b7 Build");
  assert.deepEqual(running.pips, ["done", "current", "todo", "todo"]);

  assert.equal(said({ phase: 1, step: "Starting" }).title, "Starting the loop");
  assert.equal(said({ phase: 1, step: "Starting" }).detail, "Opening a fresh agent for Phase 1 of 4: API.");
  assert.equal(said({ step: "Starting", previousPhase: 1, previousCommitted: true }).title, "Phase 1 done and committed");
  assert.equal(said({ step: "Starting", previousPhase: 1 }).title, "Phase 1 done", "commits off: claims none");
  assert.equal(said({ step: "Starting", previousPhase: 1, phaseRetried: true }).title, "Retrying Phase 2", "a retry is not a new phase");

  const waiting = said({ step: "Waiting on you" });
  assert.equal(waiting.tone, "waiting");
  assert.equal(waiting.title, "The loop needs your answer");
  assert.equal(said({ step: "Waiting on you", stopAfterPhase: true }).tone, "waiting", "a waiting question outranks a stop on its way");

  const stopping = said({ stopAfterPhase: true });
  assert.equal(stopping.title, "Stopping after this phase");
  assert.equal(stopping.tone, "running");

  assert.equal(said({ phaseName: "" }).detail, "Phase 2 of 4 \u00b7 Build");
  assert.deepEqual(said({ phase: 0, phases: 0 }).pips, []);
});

test("the loop banner names the strength and model a phase runs on, and nothing when the toggle is off", () => {
  const base = { phase: 3, phases: 5, phaseName: "API", step: "Build" };
  const said = (extra) => loopBanner({ ...base, ...extra }).detail;
  assert.equal(said({ strength: "thrifty", model: "sonnet", effort: "low" }), "Phase 3 of 5: API \u00b7 Build \u00b7 Thrifty (sonnet, low)");
  assert.equal(said({ strength: "best", model: "opus" }), "Phase 3 of 5: API \u00b7 Build \u00b7 Best (opus)");
  assert.equal(said({ strength: "balanced" }), "Phase 3 of 5: API \u00b7 Build \u00b7 Balanced");
  assert.equal(said({ strength: null, model: "opus", effort: "high" }), "Phase 3 of 5: API \u00b7 Build \u00b7 (opus, high)", "Match my session shows the launch model");
  assert.equal(said({ strength: null, model: null, effort: null }), "Phase 3 of 5: API \u00b7 Build", "toggle off or no model known: unchanged");
  assert.equal(said({}), "Phase 3 of 5: API \u00b7 Build");
  assert.equal(loopRunText({}), "");
});

test("Stop now turns the banner to Stopping, ahead of a question or a stop on its way", () => {
  const base = { phase: 2, phases: 4, phaseName: "API", step: "Build", stopAfterPhase: false, stopping: true };
  for (const extra of [{}, { step: "Waiting on you" }, { stopAfterPhase: true }, { step: "Starting" }]) {
    const banner = loopBanner({ ...base, ...extra });
    assert.equal(banner.title, "Stopping");
    assert.equal(banner.detail, "The agent is ending. Nothing more will be committed.");
    assert.equal(banner.tone, "running");
    assert.ok(banner.hint, "it has a hint");
  }
  assert.equal(loopBanner({ ...base, stopping: false }).title, "Implementation loop running");
});

test("the stop buttons: Stop after is a toggle, off on the last phase, and both are off while stopping", () => {
  const base = { stopAfterPhase: false, stopping: false, canStopAfter: true };
  assert.deepEqual(loopStopLabels(base), { afterText: "Stop after this phase", afterDisabled: false, nowDisabled: false });
  assert.deepEqual(loopStopLabels({ ...base, stopAfterPhase: true }), { afterText: "Cancel stop after this phase", afterDisabled: false, nowDisabled: false }, "it can be turned off again");
  assert.equal(loopStopLabels({ ...base, canStopAfter: false }).afterDisabled, true, "the last phase has nothing to stop after");
  assert.equal(loopStopLabels({ ...base, canStopAfter: false }).nowDisabled, false, "Stop now stays on the last phase");
  assert.equal(loopStopLabels({ stopAfterPhase: false }).afterDisabled, false, "a state without the field leaves it on");
  assert.deepEqual(loopStopLabels({ ...base, stopping: true }), { afterText: "Stop after this phase", afterDisabled: true, nowDisabled: true });
  assert.equal(loopStopLabels({ ...base, stopAfterPhase: true, stopping: true }).afterDisabled, true);
});

test("app.js sends the toggle's wish and shows a failed press with a Retry", () => {
  const app = fs.readFileSync(path.join(HERE, "..", "plan2code-app", "ui", "app.js"), "utf8");
  assert.match(app, /invoke\(command, args\)\.then\(hideLoopError/, "a good press clears the error");
  assert.match(app, /pressLoop\('loop_stop_after_phase', \{ on: !loopStopAfterOn \}\)/);
  assert.match(app, /pressLoop\('loop_stop_now'\)/);
  assert.match(app, /loopRetryBtn\.hidden = false/, "a failed press offers Retry");
  const html = fs.readFileSync(path.join(HERE, "..", "plan2code-app", "ui", "index.html"), "utf8");
  assert.match(html, /id="loop-error"[^>]*hidden/);
  assert.match(html, /id="loop-retry"[^>]*hidden/);
});

test("a console dead between a loop's phases waits for the next phase; any other gets the budget", () => {
  const base = { loopRunning: false, loopStep: "", frameReady: true, reconnects: 0, limit: 3 };
  assert.equal(deadConsoleAction({ ...base, loopRunning: true, loopStep: "Starting" }), "wait-for-phase");
  assert.equal(deadConsoleAction({ ...base, loopRunning: true, loopStep: "Starting", reconnects: 3 }), "wait-for-phase", "never counts against the budget");
  assert.equal(deadConsoleAction({ ...base, loopRunning: true, loopStep: "Build" }), "reconnect", "mid-phase the agent still needs its page");
  assert.equal(deadConsoleAction(base), "reconnect");
  assert.equal(deadConsoleAction({ ...base, reconnects: 3 }), "offer-button");
  assert.equal(deadConsoleAction({ ...base, frameReady: false }), "no-hello");
});

test("app.js refills the reconnect budget on a new page and brings the page back when a loop ends", () => {
  const app = fs.readFileSync(path.join(HERE, "..", "plan2code-app", "ui", "app.js"), "utf8");
  const announced = app.slice(app.indexOf("function showAnnounced"), app.indexOf("window.__TAURI__.event.listen('console-page'"));
  assert.match(announced, /reconnects = 0/, "a budget never refilled ran out by a loop's Phase 3 and the stop card was never seen");
  const applied = app.slice(app.indexOf("function applyLoopState"), app.indexOf("loopRunning = true;"));
  assert.match(applied, /if \(wasRunning\) showLoopEnd\(\)/);
  assert.match(app.slice(app.indexOf("async function showLoopEnd"), app.indexOf("function applyLoopState")), /reconnectConsole\(\)/);
});

test("the window title says a loop is running, and when it needs the person", () => {
  assert.equal(loopWindowTitle("C:/git/lunch", { phase: 2, phases: 7, step: "Build" }), "Loop: Phase 2 of 7 - lunch");
  assert.equal(loopWindowTitle("C:/git/lunch", { phase: 2, phases: 7, step: "Waiting on you" }), "Loop needs you: Phase 2 - lunch");
  assert.equal(loopWindowTitle("", { phase: 1, phases: 2, step: "Build" }), "Loop: Phase 1 of 2");
});

test("the loop banner and its stop buttons sit outside the bar, so nothing else competes with them", () => {
  const banner = INDEX_HTML.indexOf('id="loop-banner"');
  const barEnd = INDEX_HTML.indexOf("</header>");
  const workspace = INDEX_HTML.indexOf('<div id="workspace">');
  assert.ok(barEnd < banner && banner < workspace, "between the bar and the workspace");
  assert.ok(INDEX_HTML.indexOf('id="loop-stop-now"') > banner, "the stop buttons moved with it");
  assert.ok(!INDEX_HTML.includes('id="loop-strip"'));
  assert.match(INDEX_HTML, /id="loop-banner"[^>]*\bhidden\b/, "hidden until a loop runs");
  assert.match(INDEX_HTML, /role="status" aria-live="polite"/);
  assert.match(INDEX_HTML, /prefers-reduced-motion: reduce\) \{ #loop-dot/);
  assert.match(APP_JS, /listen\('loop-state'/);
});

test("loopLocks turns Change project and Change agent off, with one reason, only while a loop runs", () => {
  const on = loopLocks({ running: true, phase: 2, phases: 4 });
  assert.equal(on.locked, true);
  assert.equal(on.reason, "A loop is running. Stop it before you change the project or agent.");
  for (const state of [{ running: false }, {}, null, undefined]) {
    assert.deepEqual(loopLocks(state), { locked: false, reason: "" });
  }
});

test("the banner and stop buttons agree for a state carrying stopping, stopAfterPhase or the last phase", () => {
  const base = { running: true, phase: 2, phases: 4, phaseName: "API", step: "Build", stopAfterPhase: false, stopping: false, canStopAfter: true };
  const stopping = { ...base, stopping: true };
  assert.equal(loopBanner(stopping).title, "Stopping");
  assert.deepEqual(loopStopLabels(stopping), { afterText: "Stop after this phase", afterDisabled: true, nowDisabled: true });
  const after = { ...base, stopAfterPhase: true };
  assert.equal(loopBanner(after).title, "Stopping after this phase");
  assert.deepEqual(loopStopLabels(after), { afterText: "Cancel stop after this phase", afterDisabled: false, nowDisabled: false });
  const last = { ...base, canStopAfter: false };
  assert.equal(loopBanner(last).title, "Implementation loop running");
  assert.equal(loopStopLabels(last).afterDisabled, true);
});

test("app.js asks loop_state after attach and again once it listens, without calling a reload a loop's end", () => {
  assert.match(APP_JS, /async function syncLoopState\(\)[\s\S]*?invoke\('loop_state'\)/);
  assert.match(APP_JS, /\.listen\('loop-state'[\s\S]*?\.then\(syncLoopState/, "asked again once the listener is up");
  const attach = APP_JS.indexOf("invoke('agent_reattach'");
  const sync = APP_JS.indexOf("await syncLoopState()", attach);
  assert.ok(attach > 0 && sync > attach, "asked right after the reattach");
  assert.match(APP_JS, /const seen = loopEventSeq;[\s\S]*?if \(seen !== loopEventSeq\) return;/, "an event that landed while loop_state was out wins over its answer");
  assert.match(APP_JS, /else if \(loopRunning\) applyLoopState\(\{ running: false \}\)/, "no loop and none drawn redraws nothing");
  assert.match(APP_JS, /const wasRunning = loopRunning;[\s\S]*?if \(wasRunning\) showLoopEnd\(\)/, "only a drawn loop ends with the finish redraw");
});

test("app.js locks the change buttons through loopLocks and shows the typing note once per loop", () => {
  assert.match(APP_JS, /const \{ locked, reason \} = loopLocks\(state\);[\s\S]*?button\.disabled = locked/);
  assert.match(APP_JS, /applyLoopLocks\(\{ running: false \}\)/, "the ended branch gives them back");
  assert.match(APP_JS, /if \(!loopRunning\) loopTypingNoted = false/, "a new loop shows the note again");
  assert.ok(APP_JS.includes("noteTypingDuringLoop();\n      invoke('agent_input'"), "the note comes before, and never replaces, the delivery of the key");
  assert.ok(APP_JS.includes("A loop is running. Typing here can derail the phase it is working on."));
});

test("main.rs guards the window's agent and project commands, and registers loop_state", () => {
  const rust = fs.readFileSync(path.join(HERE, "..", "plan2code-app", "src-tauri", "src", "main.rs"), "utf8");
  const body = (name) => {
    const at = rust.indexOf(`fn ${name}(`);
    assert.ok(at > 0, `${name} exists`);
    return rust.slice(at, rust.indexOf("\n}\n", at));
  };
  for (const [name, what] of [["agent_start", "agent"], ["agent_restart", "agent"], ["change_project", "project"], ["pick_project_folder", "project"]]) {
    assert.ok(body(name).includes(`refuse_while_looping(&state, "${what}")?;`), `${name} refuses while a loop runs`);
  }
  assert.ok(!body("agent_input").includes("refuse_while_looping"), "typing stays open for a trust or login prompt");
  assert.match(rust, /generate_handler!\[[\s\S]*?loop_stop_now,\s*loop_state,/);
});
