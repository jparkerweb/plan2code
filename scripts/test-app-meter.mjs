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
import { looksFromMessage, terminalFontStep, TERMINAL_FONT_DEFAULT, TERMINAL_FONT_MIN, TERMINAL_FONT_MAX, splitterFraction, splitterAria, terminalTitle, barFit, terminalAnsi, TERMINAL_ANSI, hexToRgba, helloRetryAction, retryLabel, RETRY_AFTER_SECONDS, attentionSignal, commandSegments, plainCommandText, menuStep, pageNotShownView, pageDetailsLine, redactSessionUrl, barNextSteps, continueKeys, defaultRightFraction, folderName, folderPickerRows, pickDefaultAgent, taskbarSwitch, windowTitleFor, deadConsoleAction, loopBanner, loopRunText, loopLocks, loopStopLabels, loopWindowTitle, CONSOLE_ASIDE_BREAKPOINT_PX, NEXT_STEP_LABELS, NEW_RELEASE_COMMAND, STILL_WAITING_MS, STILL_WAITING_TEXT, waitingView, friendlyError, endedView, confirmButtons, trapTab, SHORTCUTS, shortcutAction, shortcutLabel, tipWithShortcut, shortcutFromMessage, clipboardAction, releaseAfterCheck, releaseNotesUrl, reasonSentence, UPDATE_RECHECK_MS } from "../plan2code-app/ui/meter.js";
import { findBrowser, launchBrowser } from "./browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.join(HERE, "../plan2code-app/ui/index.html");
const APP_JS = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/app.js"), "utf8");
const INDEX_HTML = fs.readFileSync(INDEX_HTML_PATH, "utf8");
const METER_JS = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/meter.js"), "utf8");

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

test("a newer GitHub release is offered last, as Update and restart with a What's new link; a mismatch or a stopped console comes first", () => {
  const newRelease = { latest: "3.0.1" };
  const ids = (input) => barNextSteps(input).map((step) => step.id);
  assert.deepEqual(ids({ newRelease }), ["new-release"]);
  assert.deepEqual(ids({ consoleDead: true, version: { kind: "mismatch", skills: "3.0.0", app: "3.1.0" }, newRelease }), ["console-dead", "mismatch", "new-release"]);
  const [step] = barNextSteps({ newRelease });
  assert.equal(step.text, "Update available: v3.0.1");
  assert.equal(step.label, "Update and restart");
  assert.equal(step.action, "update-restart");
  assert.deepEqual(step.link, { label: "What's new", url: "https://github.com/jparkerweb/plan2code/releases/tag/v3.0.1" });
  assert.equal(releaseNotesUrl("v3.0.1"), step.link.url, "a leading v is not doubled");
  assert.equal(NEW_RELEASE_COMMAND, "plan2code update", "still the fallback command a failed update names");
  assert.deepEqual(barNextSteps({ newRelease: null }), [], "nothing newer, nothing shown");
});

test("the update states: running shows its line and no button, a failure keeps the app up and says why, an installed one offers the restart", () => {
  const [running] = barNextSteps({ newRelease: { latest: "3.2.0", updating: "Installing skills (4 of 9)" } });
  assert.deepEqual([running.text, running.busy, running.action, running.link ?? null], ["Installing skills (4 of 9)", true, null, null]);
  const [starting] = barNextSteps({ newRelease: { latest: "3.2.0", updating: "" } });
  assert.equal(starting.text, "Updating to v3.2.0...", "a first line before the installer says anything");
  const [failed] = barNextSteps({ newRelease: { latest: "3.2.0", failed: "The update did not finish: npm exited with code 1." } });
  assert.deepEqual([failed.text, failed.tone, failed.action, failed.label], ["Update failed", "err", "update-restart", "Update and restart"], "it can be tried again");
  assert.match(failed.title, /^The update did not finish: npm exited with code 1\. Plan2Code is still running as it was\./, "the reason, in full, for the tooltip and the list");
  assert.match(failed.title, /run `plan2code update` in a terminal/, "the old way stays as the fallback");
  const [restart] = barNextSteps({ newRelease: { latest: "3.2.0", restartNeeded: true } });
  assert.deepEqual([restart.text, restart.action, restart.label, restart.tone], ["Updated to v3.2.0", "restart-app", "Restart Plan2Code", "ok"]);
  const [problem] = barNextSteps({ newRelease: { problem: "Could not check for updates: git was not found on PATH." } });
  assert.deepEqual([problem.id, problem.text, problem.action], ["update-check", "Could not check for updates", null], "a missing git is said, not silent");
  assert.match(problem.title, /git was not found/);
  const [same] = barNextSteps({ notReplaced: "3.1.0" });
  assert.deepEqual([same.id, same.text, same.tone, same.action], ["not-replaced", "App not replaced", "warn", null], "the same version after a restart is not 'Updated to'");
  assert.match(same.title, /no desktop app for this system yet, so Plan2Code is still on v3\.1\.0\./);
  const [after] = barNextSteps({ updatedTo: "3.2.0" });
  assert.deepEqual([after.id, after.text, after.tone, after.action], ["updated-to", "Updated to v3.2.0", "ok", null]);
});

test("releaseAfterCheck: a recheck never replaces a running or finished update, finds a version, reports a problem and clears an old one", () => {
  assert.deepEqual(releaseAfterCheck(null, { latest: "3.2.0", problem: null }), { latest: "3.2.0" });
  assert.deepEqual(releaseAfterCheck(null, { latest: null, problem: "Could not check for updates: git was not found on PATH." }), { problem: "Could not check for updates: git was not found on PATH." });
  assert.equal(releaseAfterCheck({ latest: "3.2.0" }, { latest: null, problem: null }), null, "current now: the old notice goes");
  assert.equal(releaseAfterCheck({ problem: "x" }, { latest: null, problem: null }), null);
  const running = { latest: "3.2.0", updating: "Installing" };
  assert.equal(releaseAfterCheck(running, { latest: "3.2.0" }), running, "an update that runs is left alone");
  const waiting = { latest: "3.2.0", restartNeeded: true };
  assert.equal(releaseAfterCheck(waiting, { latest: "3.3.0" }), waiting, "so is one waiting for its restart");
  assert.equal(releaseAfterCheck(null, null), null, "no answer, nothing to show");
  assert.equal(UPDATE_RECHECK_MS, 4 * 60 * 60 * 1000, "every few hours, not once per launch");
});

test("reasonSentence keeps the installer's reason readable: a capital and a full stop", () => {
  assert.equal(reasonSentence("the update did not finish: npm exited with code 1"), "The update did not finish: npm exited with code 1.");
  assert.equal(reasonSentence("Already a sentence."), "Already a sentence.");
  assert.equal(reasonSentence("  two   spaces "), "Two spaces.");
  assert.equal(reasonSentence(""), "The update did not finish.");
});

test("the app asks at start and every few hours for a newer release, and the bar is wired to Update and restart", () => {
  assert.match(APP_JS, /invoke\('check_new_release'\)/);
  assert.match(APP_JS, /setInterval\(checkNewRelease, UPDATE_RECHECK_MS\)/);
  assert.match(APP_JS, /'update-restart': \(\) => updateAndRestart\(\)/);
  assert.match(APP_JS, /'restart-app': \(\) => restartApp\(\)/);
  assert.doesNotMatch(APP_JS, /copyUpdateCommand|'copy-update'/, "the copy-the-command flow is gone");
  const update = APP_JS.slice(APP_JS.indexOf("async function updateAndRestart"), APP_JS.indexOf("async function restartApp"));
  assert.match(update, /invoke\('update_to_newest', \{ progress \}\)/, "the unpinned update, through the progress channel");
  assert.match(update, /setNewRelease\(\{ latest, failed: reasonSentence\(error\) \}\);\s*\n\s*return;/, "a failure returns before any restart");
  const restart = APP_JS.slice(APP_JS.indexOf("async function restartApp"), APP_JS.indexOf("async function showUpdatedTo"));
  assert.match(restart, /invoke\('restart_app', \{ confirmed: false \}\)/, "the quit check guards the respawn");
  assert.match(APP_JS, /if \(state\.updatedFrom\) void showUpdatedTo\(\);/, "Updated to vX once after the restart");
  const noted = APP_JS.slice(APP_JS.indexOf("async function showUpdatedTo"), APP_JS.indexOf("// The About dialog"));
  assert.match(noted, /now === appState\.updatedFrom[\s\S]*?notReplaced = now;/, "an unchanged version is said so, never 'Updated to' it");
  assert.match(APP_JS, /barNextSteps\(\{ consoleDead, version: versionState, newRelease, updatedTo, notReplaced \}\)/);
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
  assert.match(APP_JS, /const steps = barNextSteps\(\{ consoleDead, version: versionState, newRelease, updatedTo, notReplaced \}\);/);
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

test("folderPickerRows puts Choose a folder first, then the recent folders in the order given", () => {
  assert.deepEqual(folderPickerRows([]), [{ kind: "browse", label: "Choose a folder..." }]);
  const rows = folderPickerRows([
    { dir: "C:\\git\\b", name: "b" },
    { dir: "/home/me/a", name: "a" },
  ]);
  assert.deepEqual(rows, [
    { kind: "browse", label: "Choose a folder..." },
    { kind: "folder", dir: "C:\\git\\b", label: "b", detail: "C:\\git\\b" },
    { kind: "folder", dir: "/home/me/a", label: "a", detail: "/home/me/a" },
  ]);
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

test("the Restart confirmation is the shell modal, with New Session as its danger verb and Cancel first", () => {
  const confirmRestart = APP_JS.slice(APP_JS.indexOf("async function confirmRestart"), APP_JS.indexOf("function showTerminal"));
  assert.match(confirmRestart, /await confirmModal\(\{\s*title: 'Restart the agent on a fresh context window\?'/);
  assert.match(confirmRestart, /primary: 'New Session',\s*\n\s*danger: true,/);
  assert.doesNotMatch(confirmRestart, /showState\(\s*'Restart the agent/, "no longer drawn over the dashboard pane");
  // The first frame is "Starting Plan2Code" with a plain Planny (no mug); showState hides or restyles it from then on.
  assert.match(INDEX_HTML, /<svg id="dashboard-state-planny" class="is-plain"[^>]*>/, "the plain Planny is in the markup, visible");
  assert.doesNotMatch(INDEX_HTML, /<svg id="dashboard-state-planny"[^>]*hidden>/);
  assert.match(INDEX_HTML, /<div id="dashboard-state">\s*[\s\S]*?<p id="dashboard-state-text">Starting Plan2Code<\/p>/, "visible from the first frame, saying so");
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
test("docked right and collapsed, the terminal panel's pill and expand button fit the strip instead of overflowing it", async (t) => {
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    page.on("pageerror", () => {}); // app.js calls into __TAURI__, absent here; the markup and CSS still load fine
    await page.goto(pathToFileURL(INDEX_HTML_PATH).href);
    await page.evaluate(() => {
      document.getElementById("workspace").classList.add("dock-right");
      document.getElementById("term-panel").classList.add("collapsed");
      document.getElementById("term-collapse").setAttribute("aria-pressed", "true");
      document.getElementById("term-badge").hidden = false;
    });
    const fit = await page.evaluate(() => {
      const panel = document.getElementById("term-panel").getBoundingClientRect();
      const measure = (id) => {
        const el = document.getElementById(id);
        const box = el.getBoundingClientRect();
        return { writingMode: getComputedStyle(el).writingMode, overflowsWidth: el.scrollWidth > el.clientWidth, spills: box.right > panel.right + 0.5 || box.left < panel.left - 0.5 };
      };
      return { pill: measure("term-badge"), expand: measure("term-collapse"), titleShown: getComputedStyle(document.getElementById("term-title")).display !== "none" };
    });
    assert.equal(fit.pill.writingMode, "vertical-rl", "the pill's label runs top-to-bottom, not sideways");
    assert.equal(fit.pill.overflowsWidth, false, "the pill's text does not overflow its own box");
    assert.equal(fit.pill.spills, false, "the pill does not spill past the collapsed panel's edge");
    assert.equal(fit.expand.spills, false, "the expand button does not spill past the collapsed panel's edge");
    assert.equal(fit.titleShown, false, "the title has no room in the strip");
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

test("a page that said no hello is looked at again while a loop starts a phase, and the retry button counts down", () => {
  assert.equal(helloRetryAction({ loopRunning: true, loopStep: "Starting" }), "rearm", "the poll covers Starting, but nothing may drop the check for good");
  assert.equal(helloRetryAction({ loopRunning: true, loopStep: "Build" }), "check");
  assert.equal(helloRetryAction({ loopRunning: false, loopStep: "Starting" }), "check");
  assert.equal(retryLabel(10), "Try reconnecting in 10s");
  assert.equal(retryLabel(1), "Try reconnecting in 1s");
  assert.equal(retryLabel(0), "Try reconnecting");
  assert.equal(retryLabel(-3), "Try reconnecting");
  assert.equal(RETRY_AFTER_SECONDS, 10);
});

test("app.js re-arms the hello check and offers Try reconnecting on the loop's waiting message", () => {
  const app = fs.readFileSync(path.join(HERE, "..", "plan2code-app", "ui", "app.js"), "utf8");
  const noHello = app.slice(app.indexOf("async function onNoHello"), app.indexOf("function showState"));
  assert.match(noHello, /helloRetryAction\(/);
  assert.match(noHello, /setTimeout\(onNoHello, HELLO_WAIT_MS\)/, "a swallowed hello check is armed again");
  assert.match(app, /showState\(loopDetailEl\.textContent[^)]*retryAfter/s, "the loop's wait for a phase's page offers the button");
  assert.doesNotMatch(app, /showState\('Opening the page'[^)]*retryAfter/s, "onNoHello swaps that message at 8s, so a 10s countdown there never finishes");
  assert.match(app, /loopStep === 'Starting' && stepBefore !== 'Starting' && consoleKnown\) void pollConsole\(\)/, "a phase starting looks at the console at once, so the countdown does not wait for the next poll");
});

test("app.js tries Try reconnecting once by itself when its countdown ends, once per run of trouble", () => {
  const app = fs.readFileSync(path.join(HERE, "..", "plan2code-app", "ui", "app.js"), "utf8");
  const show = app.slice(app.indexOf("function showState"), app.indexOf("function hideState"));
  assert.match(show, /autoRetry/, "showState takes an autoRetry option");
  assert.match(show, /if \(left <= 0\) \{[^}]*onButton/s, "the countdown's end runs the button's action itself");
  assert.match(app, /showState\(loopDetailEl\.textContent[^)]*autoRetry: !autoReconnected/s, "the loop's wait for a phase's page tries once");
  const announced = app.slice(app.indexOf("function showAnnounced"), app.indexOf("window.__TAURI__.event.listen('console-page'"));
  assert.match(announced, /autoReconnected = false/, "each new page gets its own automatic try");
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
  for (const [name, what] of [["agent_start", "agent"], ["agent_restart", "agent"], ["change_project", "project"], ["pick_project_folder", "project"], ["open_recent_folder", "project"]]) {
    assert.ok(body(name).includes(`refuse_while_looping(&state, "${what}")?;`), `${name} refuses while a loop runs`);
  }
  assert.ok(!body("agent_input").includes("refuse_while_looping"), "typing stays open for a trust or login prompt");
  assert.match(rust, /generate_handler!\[[\s\S]*?loop_stop_now,\s*loop_state,/);
});

// The string literals of a JavaScript source (quoted and template text), with
// comments and regular expressions skipped: enough of a tokenizer for the
// shell's own files, which the test below holds to the em dash rule (the same
// rule quit_prompt.rs's tests hold its strings to).
function stringLiterals(source) {
  const out = [];
  const braces = []; // one entry per open `${`, holding the brace depth inside it
  let i = 0;
  let last = ""; // the last significant code character, to tell a regex from a division
  const regexCanStart = () => last === "" || "(,=:[!&|?{};+-*%<>~^".includes(last) || /\b(return|typeof|case|in|of)$/.test(source.slice(Math.max(0, i - 7), i));
  const readTemplate = () => {
    let text = "";
    while (i < source.length) {
      const c = source[i];
      if (c === "\\") {
        text += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "`") {
        i += 1;
        out.push(text);
        return;
      }
      if (c === "$" && source[i + 1] === "{") {
        i += 2;
        out.push(text);
        braces.push(0);
        return;
      }
      text += c;
      i += 1;
    }
  };
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      i = source.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (c === "/" && next === "*") {
      i = source.indexOf("*/", i + 2) + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let text = "";
      while (j < source.length && source[j] !== c) {
        if (source[j] === "\\") {
          text += source.slice(j, j + 2);
          j += 2;
        } else {
          text += source[j];
          j += 1;
        }
      }
      out.push(text);
      i = j + 1;
      last = c;
      continue;
    }
    if (c === "`") {
      i += 1;
      readTemplate();
      last = "`";
      continue;
    }
    if (c === "/" && regexCanStart()) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && (inClass || source[j] !== "/")) {
        if (source[j] === "\\") j += 1;
        else if (source[j] === "[") inClass = true;
        else if (source[j] === "]") inClass = false;
        j += 1;
      }
      i = j + 1;
      while (/[a-z]/i.test(source[i] || "")) i += 1;
      last = "/";
      continue;
    }
    if (braces.length && c === "{") braces[braces.length - 1] += 1;
    if (braces.length && c === "}") {
      if (braces[braces.length - 1] === 0) {
        braces.pop();
        i += 1;
        readTemplate();
        last = "`";
        continue;
      }
      braces[braces.length - 1] -= 1;
    }
    last = c;
    i += 1;
  }
  return out;
}

test("stringLiterals finds the strings and skips comments and regular expressions", () => {
  const sample = [
    "// a comment \u2014 here",
    "const a = 'one'; /* \u2014 */ const b = \"two\";",
    "const re = /'not a string'/g;",
    "const t = `x ${a ? 'in' : `deep ${b}`} y`;",
    "const half = 4 / 2; const c = 'after / division';",
  ].join("\n");
  assert.deepEqual(stringLiterals(sample), ["one", "two", "x ", "in", "deep ", "", " y", "after / division"]);
  assert.ok(stringLiterals("const s = 'bad \u2014 dash';").some((text) => text.includes("\u2014")), "a dash inside a string is seen");
  assert.ok(stringLiterals("const s = `bad ${x} \u2014 dash`;").some((text) => text.includes("\u2014")), "and inside template text after a placeholder");
});

test("no string in the shell's meter.js or app.js holds an em dash (U+2014)", () => {
  for (const [name, source, probe] of [["meter.js", METER_JS, "Reload the page"], ["app.js", APP_JS, "Reloading the page..."]]) {
    const strings = stringLiterals(source);
    assert.ok(strings.length > 50, `${name}: the tokenizer read its strings (${strings.length})`);
    assert.ok(strings.includes(probe), `${name}: the scan reaches the messages it guards`);
    for (const text of strings) assert.ok(!text.includes("\u2014"), `${name}: ${text}`);
  }
});

test("the first-run checklist's Node row joins version and path with a colon", () => {
  assert.match(APP_JS, /const nodeDetail = `\$\{state\.nodeVersion \|\| 'found'\} \(18 or newer\)\$\{state\.nodeBinary \? `: \$\{state\.nodeBinary\}` : ''\}`;/);
});

test("commandSegments puts each backticked command in its own piece, and plainCommandText quotes it for a tooltip", () => {
  assert.deepEqual(commandSegments("not found; run `plan2code update`"), [
    { text: "not found; run ", code: false },
    { text: "plan2code update", code: true },
  ]);
  assert.deepEqual(commandSegments("Run `a` then `b`."), [
    { text: "Run ", code: false },
    { text: "a", code: true },
    { text: " then ", code: false },
    { text: "b", code: true },
    { text: ".", code: false },
  ]);
  assert.deepEqual(commandSegments("plain"), [{ text: "plain", code: false }]);
  assert.deepEqual(commandSegments("a stray ` stays"), [{ text: "a stray ` stays", code: false }]);
  assert.deepEqual(commandSegments(""), []);
  assert.deepEqual(commandSegments(null), []);
  assert.equal(plainCommandText("Run `plan2code update` in a terminal."), 'Run "plan2code update" in a terminal.');
  const [failed] = barNextSteps({ newRelease: { latest: "3.0.1", failed: "The update did not finish." } });
  assert.ok(commandSegments(failed.title).some((part) => part.code && part.text === NEW_RELEASE_COMMAND), "a failed update names the command it falls back to, marked as one");
});

test("app.js draws commands in <code> for the bar's next step, the agent status line and the checklist, never as literal backticks", () => {
  assert.match(APP_JS, /function commandNodes\(text\) \{[\s\S]*?document\.createElement\('code'\)[\s\S]*?code\.textContent = part\.text;/, "built as nodes, not parsed markup");
  assert.match(APP_JS, /nextStepTextEl\.replaceChildren\(\.\.\.commandNodes\(/);
  assert.match(APP_JS, /nextStepTextEl\.title = first \? plainCommandText\(first\.title\)/);
  assert.match(APP_JS, /agentStatusEl\.replaceChildren\(\.\.\.commandNodes\(text\)\)/);
  assert.match(APP_JS, /agentStatusEl\.title = plainCommandText\(text\)/);
  assert.match(APP_JS, /if \(typeof detail === 'string'\) detailEl\.append\(\.\.\.commandNodes\(detail\)\)/);
  assert.doesNotMatch(APP_JS, /nextStepTextEl\.textContent =|agentStatusEl\.textContent = text/, "no plain-text path left beside them");
});

test("menuStep moves through a menu's items: Up and Down wrap, Home and End go to the ends", () => {
  assert.equal(menuStep("ArrowDown", -1, 3), 0, "from outside the items, Down takes the first");
  assert.equal(menuStep("ArrowUp", -1, 3), 2, "and Up the last");
  assert.equal(menuStep("ArrowDown", 0, 3), 1);
  assert.equal(menuStep("ArrowDown", 2, 3), 0, "Down wraps");
  assert.equal(menuStep("ArrowUp", 0, 3), 2, "Up wraps");
  assert.equal(menuStep("Home", 2, 3), 0);
  assert.equal(menuStep("End", 0, 3), 2);
  assert.equal(menuStep("ArrowDown", 0, 1), 0, "one item stays put");
  assert.equal(menuStep("ArrowDown", -1, 0), null, "nothing to move to");
  assert.equal(menuStep("a", 0, 3), null, "any other key is left alone");
  assert.equal(menuStep("Enter", 0, 3), null);
});

test("opening a bar menu focuses its first item, and Up, Down, Home and End move between items", () => {
  const toggle = APP_JS.slice(APP_JS.indexOf("function toggleBarMenu"), APP_JS.indexOf("projectMenuBtn.onclick"));
  assert.match(toggle, /const \[first\] = barMenuItems\(menu\);\s*\(first \|\| menu\)\.focus\(\);/, "the first item, or the menu itself when none can take focus");
  assert.match(APP_JS, /function barMenuItems\(menu\) \{[\s\S]*?\[role="menuitem"\][\s\S]*?!item\.hidden && !item\.disabled/);
  assert.match(APP_JS, /menuStep\(event\.key, items\.indexOf\(document\.activeElement\), items\.length\)/);
  assert.match(APP_JS, /projectMenu\.addEventListener\('keydown', onBarMenuKey\);/);
  assert.match(APP_JS, /agentMenu\.addEventListener\('keydown', onBarMenuKey\);/);
  for (const id of ["project-menu", "agent-menu"]) {
    assert.match(INDEX_HTML, new RegExp(`<div id="${id}"[^>]*role="menu"[^>]*tabindex="-1"`), `#${id} can hold focus when every item is off`);
  }
});

test("the checklist's marks and the quiet dot are named for a screen reader", () => {
  const row = APP_JS.slice(APP_JS.indexOf("function firstRunRow"), APP_JS.indexOf("function renderFirstRun"));
  assert.match(row, /mark\.setAttribute\('role', 'img'\);/);
  assert.match(row, /mark\.setAttribute\('aria-label', pass \? 'Ready' : 'Needs attention'\);/);
  // The quiet mark is a labeled pill in words, a button that opens the terminal.
  assert.match(INDEX_HTML, /<button id="term-badge" type="button"[^>]*>Agent may need you<\/button>/);
});

test("the shell has one :focus-visible ring, from the tokens", () => {
  const rings = INDEX_HTML.match(/[^{}\n]*:focus-visible[^{]*\{[^}]*outline[^}]*\}/g) || [];
  assert.equal(rings.length, 1, rings.join("\n"));
  assert.match(rings[0], /outline: 2px solid var\(--focus-ring, var\(--accent\)\)/);
  assert.match(rings[0], /\[role="separator"\]/, "the splitter wears the same ring, not the global blue one");
  assert.match(INDEX_HTML, /#loop-banner \{[^}]*--focus-ring: var\(--banner-color\)/, "the loop banner keeps its own ring color through the token");
});

test("every confirm goes through the shell modal: New Session, Stop now and Change project, with nothing drawn over the dashboard", () => {
  assert.doesNotMatch(APP_JS, /leaveConfirm|shownStateNow/, "the in-page confirm's put-it-back code is gone with the confirm");
  const stop = APP_JS.slice(APP_JS.indexOf("loopStopNowBtn.onclick"), APP_JS.indexOf("function renderNextStep"));
  assert.match(stop, /await confirmModal\(\{\s*title: 'End the agent now\?'/);
  assert.match(stop, /primary: 'Stop now',\s*\n\s*danger: true,/);
  const change = APP_JS.slice(APP_JS.indexOf("async function changeProject"), APP_JS.indexOf("changeProjectBtn.onclick"));
  assert.match(change, /await confirmModal\(\{\s*title: 'Stop the running agent and switch to a different project\?'/);
  assert.match(change, /if \(!yes\) return;/, "Cancel changes nothing");
  assert.doesNotMatch(APP_JS, /showState\('No dashboard has loaded yet\./, "no bare-line state is left to land in");
  const show = APP_JS.slice(APP_JS.indexOf("function showState"), APP_JS.indexOf("function showErrorState"));
  assert.match(show, /shownState = \{ text, buttonLabel, onButton, onCancel, options \};/);
  assert.match(APP_JS, /function hideState\(\) \{[^}]*shownState = null;/);
});

test("pageNotShownView: Reload the page first, then 'still did not load' with Reconnect the console first", () => {
  const first = pageNotShownView(1);
  assert.equal(first.text, "The console is running but its page did not show in this window.");
  assert.deepEqual(first.primary, { action: "reload", label: "Reload the page" });
  assert.equal(first.secondary, null);
  for (const n of [2, 3, 7]) {
    const again = pageNotShownView(n);
    assert.equal(again.text, "The page still did not load.");
    assert.deepEqual(again.primary, { action: "reconnect", label: "Reconnect the console" });
    assert.deepEqual(again.secondary, { action: "reload", label: "Reload the page" });
  }
  assert.equal(pageNotShownView(2).primary.label, NEXT_STEP_LABELS.reconnect, "the same label as every other reconnect");
});

test("pageDetailsLine carries the session URL with its key hidden and the last health check", () => {
  assert.equal(redactSessionUrl("http://127.0.0.1:51234/s/AbC_123-xyz"), "http://127.0.0.1:51234/s/...");
  assert.equal(redactSessionUrl("http://127.0.0.1:51234/s/AbC/?x=1"), "http://127.0.0.1:51234/s/.../?x=1");
  assert.equal(redactSessionUrl("http://127.0.0.1:51234/"), "http://127.0.0.1:51234/");
  assert.equal(redactSessionUrl(null), "");
  assert.equal(pageDetailsLine({ url: "http://127.0.0.1:5000/s/secret", health: "running" }), "Details: session http://127.0.0.1:5000/s/...; health check: running");
  assert.equal(pageDetailsLine({ url: null, health: null }), "Details: session none; health check: no answer");
});

test("app.js counts page failures in a row, offers stop-then-start, and shows the Details line", () => {
  const noHello = APP_JS.slice(APP_JS.indexOf("async function onNoHello"), APP_JS.indexOf("function showState"));
  assert.match(noHello, /pageFailures \+= 1;\s*const view = pageNotShownView\(pageFailures\);/);
  assert.match(noHello, /const actions = \{ reload: reloadPage, reconnect: stopAndReconnect \};/);
  assert.match(noHello, /pageDetailsLine\(\{ url: currentUrl \|\| status\.url, health: status\.state \}\)/);
  assert.match(noHello, /showState\(view\.text, view\.primary\.label, actions\[view\.primary\.action\], undefined, \{ secondary, details \}\)/);
  assert.match(noHello, /async function stopAndReconnect\(\) \{[\s\S]*?invoke\('console_stop'\)[\s\S]*?await reconnectConsole\(\);/, "stop, then start");
  assert.match(APP_JS, /kind === 'console-ready'\) \{\s*frameReady = true;\s*pageFailures = 0;/, "a hello ends the run of failures");
  const announced = APP_JS.slice(APP_JS.indexOf("function showAnnounced"), APP_JS.indexOf("window.__TAURI__.event.listen('console-page'"));
  assert.match(announced, /pageFailures = 0;/, "a new page starts over");
  assert.match(INDEX_HTML, /<button id="dashboard-state-secondary" hidden><\/button>/);
  assert.match(INDEX_HTML, /<p id="dashboard-state-details" hidden><\/p>/);
  assert.match(INDEX_HTML, /#dashboard-state-details \{[^}]*color: var\(--ink-3\)/, "muted");
});

// ---- Phase 9: the shell shares the console's tokens and theme ----

const SHADES_LIGHT = ["#206cc3", "#ecf2f9", "#ffffff", "#9ab4d3"];
const SHADES_DARK = ["#619fe5", "#1a2533", "#0c1117", "#3d5978"];

test("looksFromMessage takes the resolved theme with both shade sets, and nothing that does not match their shapes", () => {
  assert.deepEqual(looksFromMessage({ plan2code: "looks", accent: SHADES_DARK, theme: "light", light: SHADES_LIGHT, dark: SHADES_DARK }), { theme: "light", light: SHADES_LIGHT, dark: SHADES_DARK });
  assert.deepEqual(looksFromMessage({ theme: "dark", light: SHADES_LIGHT, dark: SHADES_DARK }).theme, "dark");
  assert.deepEqual(looksFromMessage({ accent: SHADES_DARK }), { theme: "dark", light: null, dark: SHADES_DARK }, "a page that predates the theme keeps the shell dark in its highlight");
  for (const bad of [
    null, undefined, "dark", 7, [], {},
    { theme: "system", light: SHADES_LIGHT, dark: SHADES_DARK },
    { theme: "dark", light: SHADES_LIGHT },
    { theme: "dark", dark: SHADES_DARK },
    { theme: "dark", light: SHADES_LIGHT, dark: ["#619fe5", "#1a2533", "#0c1117"] },
    { theme: "dark", light: SHADES_LIGHT, dark: ["#619fe5", "#1a2533", "#0c1117", "red"] },
    { theme: "dark", light: SHADES_LIGHT, dark: ["#619fe5", "#1a2533", "#0c1117", "#3d5978; x:y"] },
    { theme: "dark", light: SHADES_LIGHT, dark: ["#619fe5", "#1a2533", "#0c1117", 5] },
    { accent: ["#619fe5", "red", "#0c1117", "#3d5978"] },
  ]) assert.equal(looksFromMessage(bad), null, JSON.stringify(bad));
});

test("the shell applies the looks message through meter.js and keeps the theme beside the accent for the next launch", () => {
  assert.match(APP_JS, /const looks = looksFromMessage\(event\.data\);\s+if \(looks\) applyLooks\(looks, \{ save: true \}\);/);
  assert.match(APP_JS, /root\.setAttribute\('data-theme', theme\);/);
  assert.match(APP_JS, /localStorage\.setItem\(THEME_KEY, theme\);\s+localStorage\.setItem\(ACCENT_KEY, JSON\.stringify\(\{ light, dark \}\)\);/);
  assert.match(APP_JS, /terminal\.applyTheme\(\);\s+setWindowTheme\(theme\);/, "the terminal and the OS title bar follow every change");
  assert.match(APP_JS, /getCurrentWindow\(\)\.setTheme\(theme\)/);
  assert.doesNotMatch(APP_JS, /applyAccent/, "the dark-only accent path is gone");
  const early = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/theme-early.js"), "utf8");
  assert.match(early, /p2c-app:theme/);
  assert.match(early, /p2c-app:accent/);
  assert.match(INDEX_HTML, /<script src="theme-early\.js"><\/script>/, "a classic script in the head, so it runs before the first paint");
  assert.ok(INDEX_HTML.indexOf("theme-early.js") < INDEX_HTML.indexOf("<style>"));
  assert.match(APP_JS, /getCurrentWindow\(\)\.show\(\)/, "the window opens hidden and is shown on the first paint");
  const conf = JSON.parse(fs.readFileSync(path.join(HERE, "../plan2code-app/src-tauri/tauri.conf.json"), "utf8"));
  const win = conf.app.windows[0];
  assert.equal(win.visible, false);
  assert.equal(win.maximized, undefined, "maximizing is left to the first run in main.rs");
  assert.ok(win.minWidth >= 900 && win.minHeight >= 500);
  assert.match(win.backgroundColor, /^#[0-9a-f]{6}$/i);
});

test("the console's looks message carries the resolved theme and both shade sets", () => {
  const looksJs = fs.readFileSync(path.join(HERE, "../src/web-console/public/looks.js"), "utf8");
  assert.match(looksJs, /tellApp\("looks", \{ accent: ACCENTS\[looks\.accent\]\.dark, theme: effectiveTheme\(\), light: ACCENTS\[looks\.accent\]\.light, dark: ACCENTS\[looks\.accent\]\.dark \}\);/);
  const screen = fs.readFileSync(path.join(HERE, "../src/web-console/public/screens/looks.js"), "utf8");
  assert.match(screen, /matchMedia\("\(prefers-color-scheme: dark\)"\)\.addEventListener\("change", \(\) => \{\s+if \(looks\.theme === "system"\) \{\s+applyLooks\(\);/, "a system theme flip re-runs applyLooks, which tells the shell; looks.js adds no second listener");
  assert.doesNotMatch(looksJs, /addEventListener\("change"/);
});

test("the shell takes its colors from the console's tokens.css, copied by vendor.mjs, and holds no literal color", () => {
  const vendor = fs.readFileSync(path.join(HERE, "../plan2code-app/scripts/vendor.mjs"), "utf8");
  assert.match(vendor, /'\.\.\/src\/web-console\/public\/styles\/tokens\.css', 'tokens\.css'/);
  const link = INDEX_HTML.indexOf('href="vendor/tokens.css"');
  assert.ok(link > 0 && link < INDEX_HTML.indexOf("<style>"), "linked before the shell's own styles");
  const css = INDEX_HTML.slice(INDEX_HTML.indexOf("<style>"), INDEX_HTML.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, "no hex color left in the styles");
  assert.doesNotMatch(css, /\brgba?\(/, "no rgb color left in the styles");
  assert.doesNotMatch(css, /:root\s*\{[^}]*--(panel|ink|accent)\b/, "the dark token block is gone");
});

test("the terminal's font steps stay inside the saved range and the keys reach nothing else", () => {
  assert.equal(TERMINAL_FONT_DEFAULT, 13);
  assert.equal(terminalFontStep("+", 13), 14);
  assert.equal(terminalFontStep("=", 13), 14);
  assert.equal(terminalFontStep("-", 13), 12);
  assert.equal(terminalFontStep("0", 20), 13);
  assert.equal(terminalFontStep("+", TERMINAL_FONT_MAX), TERMINAL_FONT_MAX);
  assert.equal(terminalFontStep("-", TERMINAL_FONT_MIN), TERMINAL_FONT_MIN);
  assert.equal(terminalFontStep("a", 13), null);
  assert.equal(terminalFontStep("_", 13), null, "Ctrl+Shift+minus is a readline undo, left to the agent");
  assert.equal(terminalFontStep("ArrowUp", 13), null);
  assert.equal(terminalFontStep("+", NaN), 14, "no size yet steps from the default");
  const term = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/terminal.js"), "utf8");
  assert.match(term, /\(event\.ctrlKey \|\| event\.metaKey\) && !event\.altKey/);
  assert.match(term, /terminalFontStep\(event\.key, term\.options\.fontSize\)/);
  assert.match(APP_JS, /invoke\('save_terminal_font_size', \{ size \}\)/);
  assert.match(APP_JS, /terminal\.setFontSize\(Number\.isInteger\(state\.terminalFontSize\)/);
});

// WCAG contrast of one #rrggbb against another.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("the terminal's two ANSI palettes hold sixteen colors each and stay readable on the panel they sit on", () => {
  const names = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite"];
  const tokens = fs.readFileSync(path.join(HERE, "../src/web-console/public/styles/tokens.css"), "utf8");
  const panels = { light: /:root \{[\s\S]*?--panel: (#[0-9a-f]{6})/.exec(tokens)[1], dark: /@media \(prefers-color-scheme: dark\) \{[\s\S]*?--panel: (#[0-9a-f]{6})/.exec(tokens)[1] };
  for (const theme of ["light", "dark"]) {
    const palette = terminalAnsi(theme);
    assert.deepEqual(Object.keys(palette), names, theme);
    for (const name of names) {
      assert.match(palette[name], /^#[0-9a-f]{6}$/i);
      // ANSI black on a dark screen is a background shade by nature.
      if (theme === "dark" && name === "black") continue;
      const ratio = contrast(palette[name], panels[theme]);
      assert.ok(ratio >= (name === "brightBlack" ? 4.4 : 3), `${theme} ${name} ${palette[name]} on ${panels[theme]} is only ${ratio.toFixed(2)}:1`);
    }
  }
  assert.equal(terminalAnsi("system"), TERMINAL_ANSI.dark, "anything but light is dark");
  assert.equal(hexToRgba("#619fe5", 0.35), "rgba(97, 159, 229, 0.35)");
  assert.equal(hexToRgba("nope", 0.5), "rgba(128, 128, 128, 0.5)");
  const term = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/terminal.js"), "utf8");
  assert.match(term, /fontFamily: token\('--mono'/, "the console's mono stack");
  assert.match(term, /term\.options\.theme = buildTheme\(\)/, "reapplied on every looks message");
  assert.match(term, /cursor: accent/);
});

test("the splitter steps by 2% along the dock, clamps, and Home and End go to the ends", () => {
  const opts = { min: 0.1, max: 0.6 };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(splitterFraction("ArrowUp", 0.25, "bottom", opts), 0.27);
  near(splitterFraction("ArrowDown", 0.25, "bottom", opts), 0.23);
  near(splitterFraction("ArrowLeft", 0.25, "right", opts), 0.27);
  near(splitterFraction("ArrowRight", 0.25, "right", opts), 0.23);
  assert.equal(splitterFraction("ArrowLeft", 0.25, "bottom", opts), null, "the other axis is not its key");
  assert.equal(splitterFraction("ArrowUp", 0.25, "right", opts), null);
  assert.equal(splitterFraction("Home", 0.25, "bottom", opts), 0.1);
  assert.equal(splitterFraction("End", 0.25, "right", opts), 0.6);
  assert.equal(splitterFraction("ArrowUp", 0.6, "bottom", opts), 0.6);
  assert.equal(splitterFraction("ArrowDown", 0.1, "bottom", opts), 0.1);
  assert.equal(splitterFraction("a", 0.25, "bottom", opts), null);
  assert.deepEqual(splitterAria(0.254, opts), { now: 25, min: 10, max: 60 });
});

test("the splitter is a keyboard-usable separator with a 6px hit area and a 1px line", () => {
  assert.match(INDEX_HTML, /<div id="term-handle" role="separator" aria-orientation="horizontal"[^>]*aria-valuenow="25"[^>]*tabindex="0"/);
  assert.match(INDEX_HTML, /#workspace:not\(\.dock-right\) #term-handle \{ height: 6px;/);
  assert.match(INDEX_HTML, /#workspace\.dock-right #term-handle \{ width: 6px;/);
  assert.match(INDEX_HTML, /#term-handle::after \{[^}]*background: var\(--rule\)/);
  assert.match(INDEX_HTML, /#term-handle:hover::after, #term-handle:focus-visible::after, #term-handle\.is-dragging::after \{ background: var\(--accent\); \}/);
  assert.match(APP_JS, /termHandle\.addEventListener\('keydown'[\s\S]*?splitterFraction\(event\.key,/);
  assert.match(APP_JS, /termHandle\.addEventListener\('dblclick', \(\) => \{\s+paneFraction = defaultPaneFraction\(\);/);
  assert.match(APP_JS, /termHandle\.setAttribute\('aria-orientation', paneDock === 'right' \? 'vertical' : 'horizontal'\);/);
});

test("the terminal toolbar has a title, labeled icon buttons and a labeled pill that opens the terminal", () => {
  assert.equal(terminalTitle("Claude Code"), "Terminal \u00b7 Claude Code");
  assert.equal(terminalTitle(""), "Terminal");
  assert.equal(terminalTitle(), "Terminal");
  assert.match(INDEX_HTML, /<span id="term-title">Terminal<\/span>/);
  for (const id of ["term-dock", "term-maximize", "term-collapse"]) {
    const tag = new RegExp(`<button id="${id}" class="term-icon"[^>]*aria-label="[^"]+"[^>]*title="[^"]+"`);
    assert.match(INDEX_HTML, tag, `#${id} is an icon button that names itself`);
  }
  assert.doesNotMatch(APP_JS, /term(Dock|Maximize|Collapse)Btn\.textContent/, "no changing text on the three buttons");
  assert.match(APP_JS, /termTitleEl\.textContent = terminalTitle\(/);
  assert.match(APP_JS, /termBadgeEl\.onclick = \(\) => \{\s+if \(paneCollapsed\) \{[^}]*?termCollapseBtn\.click\(\);\s+terminal\.focus\(\);\s+return;\s+\}/, "a collapsed terminal expands, then takes the focus once its layout is back");
  assert.match(APP_JS, /terminal\.focus\(\);\s+\};/);
});

test("a small pane docked right keeps its whole toolbar inside it when the pill shows", async (t) => {
  if (!findBrowser()) return t.skip("no Chrome or Edge installed");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
    page.on("pageerror", () => {});
    await page.goto(pathToFileURL(INDEX_HTML_PATH).href);
    await page.evaluate(() => {
      document.getElementById("workspace").classList.add("dock-right");
      document.getElementById("term-panel").style.width = "192px";
      document.getElementById("term-badge").hidden = false;
      document.getElementById("term-title").textContent = "Terminal \u00b7 Claude Code";
    });
    const spill = await page.evaluate(() => {
      const panel = document.getElementById("term-panel").getBoundingClientRect();
      return ["term-dock", "term-maximize", "term-collapse", "term-badge"].map((id) => ({ id, past: document.getElementById(id).getBoundingClientRect().right - panel.right }));
    });
    for (const { id, past } of spill) assert.ok(past <= 0.5, `#${id} spills ${past}px past the panel's edge`);
  } finally {
    await browser.close();
  }
});

test("barFit drops the model text first, then the status line, and only when the row is too narrow", () => {
  assert.deepEqual(barFit({ available: 900, needed: 800, model: 200, status: 150 }), { model: true, status: true });
  assert.deepEqual(barFit({ available: 800, needed: 800, model: 200, status: 150 }), { model: true, status: true }, "exactly fitting is fitting");
  assert.deepEqual(barFit({ available: 700, needed: 800, model: 200, status: 150 }), { model: false, status: true });
  assert.deepEqual(barFit({ available: 500, needed: 800, model: 200, status: 150 }), { model: false, status: false });
  assert.deepEqual(barFit({ available: 500, needed: 800 }), { model: false, status: false }, "no parts measured, none claimed");
});

test("the top bar collapses instead of scrolling, and +N more is a button that lists the other steps", () => {
  assert.doesNotMatch(INDEX_HTML, /#bar-row \{[^}]*overflow-x: auto/, "no sideways scrolling row");
  assert.match(INDEX_HTML, /#bar-row\.no-model #agent-model, #bar-row\.no-status #agent-status \{ display: none; \}/);
  assert.match(APP_JS, /new ResizeObserver\(scheduleFitBar\)\.observe\(barRowEl\);/);
  assert.match(APP_JS, /barFit\(\{ available: barRowEl\.clientWidth, needed: barRowEl\.scrollWidth, model, status \}\)/);
  assert.doesNotMatch(APP_JS, /barRowEl\.addEventListener\('scroll'/);
  assert.match(INDEX_HTML, /<button id="next-step-more" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="more-menu" hidden><\/button>/);
  assert.match(INDEX_HTML, /<div id="more-menu" class="bar-dropdown" role="menu"[^>]*tabindex="-1" hidden><\/div>/);
  assert.match(APP_JS, /nextStepMoreEl\.onclick = \(\) => toggleBarMenu\(nextStepMoreEl, moreMenu\);/);
  const more = APP_JS.slice(APP_JS.indexOf("function renderMoreMenu"), APP_JS.indexOf("function setVersionState"));
  assert.match(more, /commandNodes\(step\.title\)/, "the full sentence, a failed update's last line included");
  assert.match(more, /NEXT_STEP_ACTIONS\[step\.action\]/, "each step's own action");
  assert.doesNotMatch(APP_JS, /nextStepMoreEl\.title =/, "no longer only in a tooltip");
});

test("the Node.js check's result reaches the page after the window opens, and the first-run checklist waits for it", () => {
  assert.match(APP_JS, /async function awaitNodeStatus\(state\) \{\s+if \(state\.nodeChecked\) return;/);
  assert.match(APP_JS, /event\.listen\('node-status', \(event\) => finish\(event\.payload\)\)/);
  assert.match(APP_JS, /if \(!state\.firstRunDone\) await awaitNodeStatus\(state\);\s+afterProjectKnown\(\);/);
  const main = fs.readFileSync(path.join(HERE, "../plan2code-app/src-tauri/src/main.rs"), "utf8");
  assert.match(main, /spawn_node_check\(app\.handle\(\)\.clone\(\)\)/, "the check runs off the main thread");
  assert.match(main, /app\.emit\("node-status"/);
});

// ---- Phase 10: waits, friendly errors, the confirm modal, shortcuts, links and the clipboard ----

test("waitingView: quiet for 12 s, then says where to look; an ended agent says so at once with Change agent", () => {
  assert.equal(STILL_WAITING_MS, 12000);
  assert.deepEqual(waitingView({ waitedMs: 0, agentState: "running" }), { still: false, text: null, showTerminal: false, changeAgent: false });
  assert.equal(waitingView({ waitedMs: STILL_WAITING_MS - 1, agentState: "running" }).still, false);
  const late = waitingView({ waitedMs: STILL_WAITING_MS, agentState: "running" });
  assert.deepEqual(late, { still: true, text: STILL_WAITING_TEXT, showTerminal: true, changeAgent: false });
  assert.equal(STILL_WAITING_TEXT, "Still waiting. The agent may be asking you something in its terminal.");
  const ended = waitingView({ waitedMs: 500, agentState: "ended" });
  assert.deepEqual([ended.still, ended.showTerminal, ended.changeAgent], [true, true, true], "no need to wait 12 s for an agent that is gone");
});

test("friendlyError maps each known raw message to a sentence with a next step and keeps the raw text for Details", () => {
  const cases = [
    ["console open printed no JSON: Error: spawn", /did not start properly.*Reconnect the console/],
    ["console open failed: node: command not found", /could not be opened/],
    ["console stop failed: busy", /did not stop cleanly/],
    ["the web console is not installed (looked in $PLAN2CODE_CONSOLE_DIR, a and b)", /skills are missing.*plan2code update/],
    ["The installed Plan2Code console is too old to show inside the app. Press Update skills, then try again.", /too old for this app.*Update skills/],
    ["no agent has been started", /no agent to restart yet/],
    ["no project folder chosen", /Choose a project folder first/],
    ["an agent is already running for this project", /already running.*New Session/],
    ["could not start the agent: spawn ENOENT", /could not start.*installed/],
    ["Could not do that: no agent has been started", /no agent to restart yet/],
    ["busy", /console is busy/],
  ];
  for (const [raw, pattern] of cases) {
    const out = friendlyError(raw);
    assert.match(out.text, pattern, raw);
    assert.equal(out.details, raw, `the raw text is kept behind Details: ${raw}`);
    assert.match(out.text, /[.]$/, "a sentence");
    assert.doesNotMatch(out.text, /^[a-z]/, "no lowercase raw text as the headline");
  }
});

test("friendlyError words an unknown error by what was being done, and an empty one as nothing", () => {
  assert.deepEqual(friendlyError("EPERM: operation not permitted", "start the agent"), { text: "Could not start the agent. Try again.", details: "EPERM: operation not permitted" });
  assert.deepEqual(friendlyError("weird", ""), { text: "That did not work. Try again.", details: "weird" });
  assert.deepEqual(friendlyError("", "x"), { text: "", details: "" });
  assert.deepEqual(friendlyError(null), { text: "", details: "" });
  assert.deepEqual(friendlyError(new Error("boom"), "do that"), { text: "Could not do that. Try again.", details: "Error: boom" });
});

test("endedView: exit code 0 is 'closed normally' and the bar no longer says 'ended' for it", () => {
  assert.deepEqual(endedView("exited with code 0"), { bar: "closed", sentence: "closed normally", normal: true });
  assert.deepEqual(endedView("exited with code 2"), { bar: "ended", sentence: "stopped with an error (exit code 2)", normal: false });
  assert.equal(endedView("was ended by a signal (SIGKILL)").sentence, "was ended from outside the app (SIGKILL)");
  assert.equal(endedView("stopped: pty gone").sentence, "ended: stopped: pty gone");
  assert.equal(endedView("").sentence, "ended");
  assert.match(APP_JS, /endedView\(agent\.reason\)/, "the bar, the menu and the terminal line all read the same words");
  assert.doesNotMatch(APP_JS, /ended: \$\{agent\.reason\}/, "no raw reason pasted into the terminal line or the menu");
});

test("app.js shows raw errors through friendlyError, never as 'Could not ...: ${error}' text", () => {
  assert.doesNotMatch(APP_JS, /Could not (?:start the agent|open the install page|open the setup page|type continue|switch project|read the app state): \$\{/, "the old raw-text sites are gone");
  assert.doesNotMatch(APP_JS, /The console could not be reached: \$\{/);
  assert.doesNotMatch(APP_JS, /Could not (?:read the recent folders|open the folder picker|open \$\{row\.dir\}): \$\{/, "the folder picker's errors are in plain words too");
  assert.match(APP_JS, /setFolderPickerError\(error, 'read the recent folders'\)/);
  assert.doesNotMatch(APP_JS, /Could not do that: \$\{/);
  assert.match(APP_JS, /function showErrorState\(raw, action, buttonLabel, onButton, onCancel\) \{\s*const friendly = friendlyError\(raw, action\);/);
  assert.match(APP_JS, /showErrorState\(error, 'reach the console', 'Retry', reconnectConsole\)/);
  assert.match(APP_JS, /setAgentError\(error, 'start the agent'\)/);
  assert.match(INDEX_HTML, /<button id="dashboard-state-toggle"[^>]*>Details<\/button>/, "the raw text sits behind Details");
  assert.match(APP_JS, /agentStatusEl\.addEventListener\('click', openStatusDetails\)/, "a press on the bar's error opens it in full");
});

test("one busy style for every wait, and the wait timer: waits start through beginWait and end when the page arrives", () => {
  assert.match(APP_JS, /const busy = options\.busy !== undefined \? options\.busy : !buttonLabel && !onCancel;/);
  assert.match(APP_JS, /beginWait\('Waiting for the agent to open the dashboard\.\.\.'\)/);
  assert.match(APP_JS, /beginWait\('Starting the agent\.\.\.'\)/);
  assert.match(APP_JS, /function showAnnounced\(notice\) \{\s*endWait\(\);/);
  const tick = APP_JS.slice(APP_JS.indexOf("function tickWait"), APP_JS.indexOf("function hideState"));
  assert.match(tick, /waitingView\(\{ waitedMs: Date\.now\(\) - waitStartedAt, agentState: agent\.state \}\)/);
  assert.match(tick, /'Show the terminal', showTerminal/);
  assert.match(tick, /label: 'Change agent'/);
  for (const line of ["Reconnecting to the console...", "Opening the page...", "Reloading the page...", "Opening the dashboard...", "The console stopped. Reconnecting..."]) {
    assert.ok(APP_JS.includes(`'${line}'`), `progress line shares the ellipsis: ${line}`);
  }
});

test("confirmButtons puts the safe button first with focus and the danger verb last; trapTab wraps in both directions", () => {
  assert.deepEqual(confirmButtons(), { order: ["cancel", "primary"], focus: "cancel" });
  assert.deepEqual(confirmButtons({ safeFirst: true }), { order: ["cancel", "primary"], focus: "cancel" });
  assert.deepEqual(confirmButtons({ safeFirst: false }), { order: ["primary", "cancel"], focus: "primary" });
  assert.equal(trapTab(false, 0, 2), 1);
  assert.equal(trapTab(false, 1, 2), 0, "forward from the last wraps to the first");
  assert.equal(trapTab(true, 0, 2), 1, "back from the first wraps to the last");
  assert.equal(trapTab(false, -1, 2), 0, "focus outside comes in at the first");
  assert.equal(trapTab(true, -1, 2), 1);
  assert.equal(trapTab(false, 0, 0), null);
});

test("the confirm modal is an alertdialog in the shell, outside the frame, with the rest of the shell inert while it asks", () => {
  assert.match(INDEX_HTML, /<div id="confirm-modal" hidden>\s*<div id="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" tabindex="-1">/);
  assert.ok(INDEX_HTML.indexOf('id="confirm-modal"') > INDEX_HTML.indexOf('<section id="term-panel"'), "a sibling after the workspace (and its frame), never inside either");
  const modal = APP_JS.slice(APP_JS.indexOf("function confirmModal"), APP_JS.indexOf("// The Rust side asks for a confirm too"));
  assert.match(modal, /for \(const part of shellParts\(\)\) part\.inert = true;/);
  assert.match(modal, /for \(const part of shellParts\(\)\) part\.inert = false;/);
  assert.match(modal, /event\.key !== 'Escape' \|\| confirmModalEl\.hidden[\s\S]*?stopImmediatePropagation\(\);\s*closeConfirm\(false\)/, "Escape cancels, heard on the document in the capture phase so a scrim click does not lose it");
  assert.match(APP_JS, /if \(event\.defaultPrevented \|\| event\.key !== 'Escape' \|\| folderPickerEl\.hidden\) return;/, "and a handled Escape never closes the folder picker behind it");
  assert.match(APP_JS, /listen\('confirm-cancel'/, "the Rust side can take a request back");
  assert.match(modal, /confirmButtons\(\{ safeFirst: primary \? safeFirst : true \}\)/);
  assert.match(modal, /\(layout\.focus === 'cancel' \? confirmCancelBtn : confirmPrimaryBtn\)\.focus\(\)/, "focus goes to the safe button");
  assert.match(modal, /\{ kind: 'callout'|item\.kind === 'callout'/, "an amber callout line is allowed");
  assert.match(modal, /document\.createElement\('pre'\)/, "and a code block");
  assert.match(INDEX_HTML, /#confirm-body \.confirm-callout \{[^}]*--stage/, "the callout is amber");
  assert.match(APP_JS, /listen\('confirm-request'/, "Rust's own confirms (loop start, the quit check) arrive as requests");
  assert.match(APP_JS, /invoke\('confirm_answer', \{ id: req\.id, yes \}\)/);
});

test("shortcutAction: Ctrl or Cmd with the table's keys, never with Alt, and the other platform's modifier is no chord", () => {
  const key = (k, mods = {}) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });
  assert.deepEqual(SHORTCUTS.map((s) => s.id), ["toggle-terminal", "focus-console", "focus-terminal", "new-session", "change-project", "preferences"]);
  for (const [k, id, mods] of [["`", "toggle-terminal", {}], ["1", "focus-console", {}], ["2", "focus-terminal", {}], ["N", "new-session", { shiftKey: true }], ["o", "change-project", {}], [",", "preferences", {}]]) {
    assert.equal(shortcutAction(key(k, { ctrlKey: true, ...mods })), id, `Ctrl+${k}`);
    assert.equal(shortcutAction(key(k, { metaKey: true, ...mods }), { mac: true }), id, `Cmd+${k}`);
    assert.equal(shortcutAction(key(k, { metaKey: true, ...mods })), null, `Cmd is no chord on Windows or Linux: ${k}`);
    assert.equal(shortcutAction(key(k, { ctrlKey: true, ...mods }), { mac: true }), null, `Ctrl is no chord on a Mac: ${k}`);
    assert.equal(shortcutAction(key(k, { ctrlKey: true, altKey: true, ...mods })), null, `Alt cancels it: ${k}`);
  }
  assert.equal(shortcutAction(key("n", { ctrlKey: true })), null, "New Session needs Shift (plain Ctrl+N is not taken)");
  assert.equal(shortcutAction(key("`", { ctrlKey: true, shiftKey: true })), null);
  assert.equal(shortcutAction(key("w", { ctrlKey: true })), null);
  assert.equal(shortcutAction(null), null);
});

test("Ctrl+O in the terminal on Windows and Linux stays the agent's own (Claude Code's transcript); a Mac and the page still get Change project", () => {
  const ctrlO = { key: "o", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
  assert.equal(shortcutAction(ctrlO, { inTerminal: true }), null);
  assert.equal(shortcutAction(ctrlO, { inTerminal: false }), "change-project");
  assert.equal(shortcutAction({ ...ctrlO, ctrlKey: false, metaKey: true }, { mac: true, inTerminal: true }), "change-project");
  assert.equal(shortcutAction({ ...ctrlO, key: "`" }, { inTerminal: true }), "toggle-terminal", "every other chord works from the terminal");
});

test("shortcut tooltips name the chord for the platform, and the page can only ask for an id in the table", () => {
  assert.equal(shortcutLabel("new-session"), "Ctrl+Shift+N");
  assert.equal(shortcutLabel("new-session", true), "Cmd+Shift+N");
  assert.equal(shortcutLabel("toggle-terminal"), "Ctrl+`");
  assert.equal(shortcutLabel("preferences", true), "Cmd+,");
  assert.equal(shortcutLabel("nope"), "");
  assert.equal(tipWithShortcut("Change project", "change-project"), "Change project (Ctrl+O)");
  assert.equal(tipWithShortcut("x", "nope"), "x");
  assert.equal(shortcutFromMessage({ plan2code: "shortcut", id: "new-session" }), "new-session");
  for (const bad of [{ id: "rm -rf" }, { id: 3 }, {}, null, undefined]) assert.equal(shortcutFromMessage(bad), null);
});

test("the console page's forwarded keys are the shell's table: the same ids, keys and Shift", async () => {
  const bridge = await import(pathToFileURL(path.join(HERE, "../src/web-console/public/app-bridge.js")).href);
  assert.deepEqual(
    bridge.SHORTCUT_KEYS.map(({ id, key, shift }) => ({ id, key, shift })),
    SHORTCUTS.map(({ id, key, shift }) => ({ id, key, shift }))
  );
  assert.equal(bridge.shortcutIdFor({ key: "2", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, false), "focus-terminal");
  assert.equal(bridge.shortcutIdFor({ key: "2", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, true), null);
  const core = fs.readFileSync(path.join(HERE, "../src/web-console/public/screens/core.js"), "utf8");
  assert.match(core, /tellApp\("shortcut", \{ id \}\)/);
  assert.match(core, /onAppMessage\("open-preferences"/);
  assert.match(core, /onAppMessage\("open-help"/);
  assert.match(APP_JS, /kind === 'shortcut'/);
  assert.match(APP_JS, /postMessage\(\{ plan2code: 'open-preferences' \}/);
});

test("app.js routes the shortcuts from every focus position: the terminal's key handler, the shell's document and the page's message", () => {
  assert.match(APP_JS, /onShortcut: \(event\) => \{\s*const id = shortcutAction\(event, \{ mac: IS_MAC, inTerminal: true \}\);/);
  assert.match(APP_JS, /document\.addEventListener\('keydown', \(event\) => \{\s*if \(event\.defaultPrevented\) return;[\s\S]*?shortcutAction\(event, \{ mac: IS_MAC, inTerminal \}\)/);
  const term = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/terminal.js"), "utf8");
  assert.match(term, /if \(onShortcut && onShortcut\(event\)\) \{\s*event\.preventDefault\(\);\s*return false;/, "the terminal never types a shell shortcut to the agent");
  assert.match(APP_JS, /if \(!changeProjectBtn\.disabled && folderPickerEl\.hidden\) changeProjectBtn\.click\(\);/, "Change project is not run over the bare start's own picker");
  assert.match(APP_JS, /tipWithShortcut\(paneCollapsed \? 'Show the terminal' : 'Collapse', 'toggle-terminal', IS_MAC\)/, "shown in tooltips");
});

test("the '...' menu: About, Check for updates, Help and Quit, in the bar's menu pattern", () => {
  assert.match(INDEX_HTML, /<button id="app-menu-button" class="bar-menu"[^>]*aria-haspopup="menu"[^>]*aria-controls="app-menu"/);
  const menu = INDEX_HTML.slice(INDEX_HTML.indexOf('id="app-menu"'), INDEX_HTML.indexOf('id="more-menu"'));
  assert.deepEqual([...menu.matchAll(/role="menuitem">([^<]+)</g)].map((m) => m[1]), ["About Plan2Code", "Check for updates", "Help", "Quit"]);
  assert.match(APP_JS, /\[appMenuBtn, appMenu\]/, "it opens, closes and takes focus like the other bar menus");
  assert.match(APP_JS, /invoke\('request_quit'\)/);
  assert.match(APP_JS, /openLink\(releaseNotesUrl\(status\.app\)\)/, "release notes through the opener");
});

test("links open through the opener plugin, http and https only; the terminal's links and What's new use it", () => {
  const open = APP_JS.slice(APP_JS.indexOf("function openLink"), APP_JS.indexOf("function openLink") + 400);
  assert.match(open, /\^https\?:/, "anything else is refused before it is sent");
  assert.match(open, /invoke\('plugin:opener\|open_url', \{ url \}\)/);
  assert.match(APP_JS, /onLink: \(uri\) => openLink\(uri\)/);
  assert.match(INDEX_HTML, /<script src="vendor\/addon-web-links\.js"><\/script>/);
  const term = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/terminal.js"), "utf8");
  assert.match(term, /new window\.WebLinksAddon\.WebLinksAddon\(\(event, uri\) => \{\s*event\.preventDefault\(\);\s*onLink\(uri\);/);
  const caps = JSON.parse(fs.readFileSync(path.join(HERE, "../plan2code-app/src-tauri/capabilities/default.json"), "utf8"));
  const opener = caps.permissions.find((p) => p && p.identifier === "opener:allow-open-url");
  assert.deepEqual(opener.allow.map((a) => a.url).sort(), ["http://*", "https://*"], "scoped to web links");
  assert.ok(!caps.permissions.includes("opener:default"), "not the default set (mailto, tel, reveal in folder)");
});

test("clipboardAction: Ctrl+C copies only with a selection (else it is the interrupt), Ctrl+Shift+C and Cmd+C always copy, Ctrl/Cmd+V pastes", () => {
  const ev = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });
  assert.equal(clipboardAction(ev("c", { ctrlKey: true }), true), "copy");
  assert.equal(clipboardAction(ev("c", { ctrlKey: true }), false), null, "no selection: the interrupt goes to the agent");
  assert.equal(clipboardAction(ev("C", { ctrlKey: true, shiftKey: true }), false), "copy");
  assert.equal(clipboardAction(ev("c", { metaKey: true }), false), "copy");
  assert.equal(clipboardAction(ev("v", { ctrlKey: true }), false), "paste");
  assert.equal(clipboardAction(ev("V", { ctrlKey: true, shiftKey: true }), false), "paste");
  assert.equal(clipboardAction(ev("v", { metaKey: true }), false), "paste");
  assert.equal(clipboardAction(ev("c", { ctrlKey: true, altKey: true }), true), null);
  assert.equal(clipboardAction(ev("c"), true), null);
  assert.equal(clipboardAction(ev("x", { ctrlKey: true }), true), null);
  // On a Mac, Ctrl+C is always the interrupt, selection or not; Cmd+C and Ctrl+Shift+C still copy.
  assert.equal(clipboardAction(ev("c", { ctrlKey: true }), true, { mac: true }), null);
  assert.equal(clipboardAction(ev("c", { metaKey: true }), true, { mac: true }), "copy");
  assert.equal(clipboardAction(ev("C", { ctrlKey: true, shiftKey: true }), true, { mac: true }), "copy");
  assert.equal(clipboardAction(null, true), null);
});

test("the terminal pastes once and in brackets, copies on select only by preference, and has a Copy / Paste / Clear menu", () => {
  const term = fs.readFileSync(path.join(HERE, "../plan2code-app/ui/terminal.js"), "utf8");
  assert.match(term, /term\.paste\(text\)/, "bracketed paste, not onInput(text)");
  assert.doesNotMatch(term, /if \(text\) onInput\(text\)/, "the old unbracketed paste is gone");
  assert.match(term, /if \(action === 'paste'\) \{\s*event\.preventDefault\(\);/, "the browser's own paste event is stopped, so it cannot land a second time");
  assert.match(term, /if \(event\.ctrlKey && !event\.shiftKey\) term\.clearSelection\(\);/, "a plain Ctrl+C that copied clears the selection, so the next one is the interrupt");
  assert.match(term, /if \(!copyOnSelectOn\) return;/, "no unconditional clipboard write on every selection");
  assert.match(term, /\['Copy', actions\.hasSelection\(\), actions\.copy\],\s*\['Paste', true, actions\.paste\],\s*\['Clear', true, actions\.clear\]/);
  assert.match(INDEX_HTML, /<div id="term-menu" role="menu"/);
  assert.match(APP_JS, /terminal\.setCopyOnSelect\(Boolean\(state\.copyOnSelect\)\)/);
  assert.match(APP_JS, /invoke\('save_copy_on_select', \{ on \}\)|invoke\('set_copy_on_select', \{ on \}\)/);
});
