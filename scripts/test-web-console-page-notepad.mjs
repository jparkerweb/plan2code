// Page tests for the Notebook: the top bar icon on every screen, the tabs (made
// by naming them, renamed, reordered, deleted after two confirms), the live
// Markdown editor, autosave per tab and what survives a reload or a restart,
// one notepad per folder, the page's content-security policy with the editor
// open, hostile Markdown, typing speed on a long note, both themes, and the
// pictures: adding, deleting, the preview and the cap.
// Run with:
// node --test scripts/test-web-console-page-notepad.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test. Notes land in the file's throwaway NOTEPADS_DIR.
//
// The editor lives in the open shadow root of `.notepad-cm-host`: Playwright's
// CSS locators pierce it, `page.evaluate` code reaches in through `shadowRoot`,
// and the text is read from the editor's own state (`docText`), since lines
// the cursor is not on draw without their Markdown marks.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, drawn } from "./page-test-helpers.mjs";
import { JPEG, backdate, cli, until } from "./web-console-test-helpers.mjs";
import {
  LEGACY_TAB_ID,
  NOTEPAD_MAX_IMAGES,
  NOTE_MAX_BYTES,
  addImage as addImageTo,
  createTab,
  defaultTabId,
  deleteTab,
  listTabs,
  notepadFolder,
  notepadKey,
  readNotepad,
  removeImage as removeImageFrom,
  saveNote as saveNoteTo,
} from "../src/web-console/notepads.mjs";
import { NOT_LOADED, SAVE_DEBOUNCE_MS, errorSentence } from "../src/web-console/public/notepad.js";

const suite = pageSuite(test);

// The store calls here name the tab they use: the last one, with Notes made
// first when the notepad has none.
const openTab = (folder) => defaultTabId(folder) ?? createTab(folder, "Notes").id;
const saveNote = (folder, text) => saveNoteTo(folder, openTab(folder), text);
const addImage = (folder, buf) => addImageTo(folder, openTab(folder), buf);
const removeImage = (folder, id) => removeImageFrom(folder, openTab(folder), id);

// A plan session on the person's turn.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

// The editor's editable surface (the locator pierces the shadow root).
const input = (s) => s.page.locator("#notepad-editor .cm-content");

// The editor's whole text.
const docText = (s) =>
  s.page.evaluate(async () => {
    const { EditorView } = await import("/vendor/codemirror.esm.js");
    const content = document.querySelector(".notepad-cm-host").shadowRoot.querySelector(".cm-content");
    return EditorView.findFromDOM(content).state.doc.toString();
  });

// Replaces the text the way typing does: through the editor, so autosave runs.
const setDoc = (s, text) =>
  s.page.evaluate(async (t) => {
    const { EditorView } = await import("/vendor/codemirror.esm.js");
    const content = document.querySelector(".notepad-cm-host").shadowRoot.querySelector(".cm-content");
    const view = EditorView.findFromDOM(content);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t }, selection: { anchor: t.length } });
  }, text);

// Opens the notepad and, unless told the note cannot load, waits until it has:
// the editor is read-only until then. A notepad with no tab gets Notes first,
// unless `tabs: false`, since an empty one shows the empty state instead.
async function openNotepad(s, { loads = true, tabs = true } = {}) {
  if (tabs && !listTabs(s.project).tabs.length) createTab(s.project, "Notes");
  await s.page.click("#btn-notepad");
  await s.page.locator("#notepad-modal[open]").waitFor();
  if (tabs) await input(s).waitFor();
  if (loads && tabs) {
    await s.page.waitForFunction(() => {
      const c = document.querySelector(".notepad-cm-host")?.shadowRoot?.querySelector(".cm-content");
      return Boolean(c) && c.getAttribute("aria-readonly") !== "true";
    });
  }
}

async function closeNotepad(s) {
  await s.page.click("#notepad-close");
  await s.page.waitForFunction(() => !document.getElementById("notepad-modal").open);
}

// The editor's text once the page has read the note in: opening reads it from
// the server, so the first value can still be the empty editor.
async function shows(s, text) {
  await until(async () => (await docText(s)) === text, 5000);
  return docText(s);
}

// Types as a person does, into the end of the text.
async function typeInto(s, text) {
  await input(s).click();
  await s.page.keyboard.press("Control+End");
  await s.page.keyboard.type(text);
}

// The note on disk for the session's folder (its last tab), as the store reads it.
const onDisk = (s) => readNotepad(s.project).text;

// Records content-security violations from now on; the getter lists them.
async function watchViolations(s) {
  await s.context.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__violations.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber} ${e.sample}`),
    );
  });
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  return () => s.page.evaluate(() => window.__violations);
}

async function iconUsable(s, where) {
  const btn = s.page.locator("#btn-notepad");
  assert.ok(await btn.isVisible(), `the icon shows on ${where}`);
  assert.ok(await btn.isEnabled(), `the icon is usable on ${where}`);
  assert.equal(await btn.getAttribute("aria-label"), "Notebook");
  assert.equal(await btn.getAttribute("title"), "Notebook");
}

test("the notepad icon shows on the dashboard, a skill session and a finished screen", async (t) => {
  const dash = await openSession(await suite.browser(), { t, workflow: "dashboard" });
  await iconUsable(dash, "the dashboard");

  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await iconUsable(s, "a skill session");
  // Right of Stop session and Subagents, in the same row.
  const order = await s.page.evaluate(() =>
    [...document.querySelectorAll(".topbar-row.second .row-left > button")].map((b) => b.id),
  );
  assert.ok(order.indexOf("btn-notepad") > order.indexOf("btn-stop"), order.join(", "));
  assert.equal(order.indexOf("btn-notepad"), order.indexOf("btn-subagents") + 1, order.join(", "));

  s.post({ settle: true, finish: { headline: "The plan is done", body: "All written down." } });
  await s.page.locator(".handoff, .end-pane, #main").first().waitFor();
  await s.page.waitForFunction(() => document.getElementById("btn-stop").hidden);
  await iconUsable(s, "the finished screen");
  await openNotepad(s);
});

test("typing Markdown styles it in place, saves within two seconds, and survives close, reload and a restart", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  assert.equal(await input(s).getAttribute("aria-label"), "Notebook text");
  await typeInto(s, "# Shopping list\n\nSome **bold** text");
  const typedAt = Date.now();
  // Styled in place: the heading line is drawn large, the bold run bold.
  await s.page.locator("#notepad-editor .cm-h1").waitFor();
  assert.match(await s.page.locator("#notepad-editor .cm-h1").innerText(), /Shopping list/);
  const sizes = await s.page.evaluate(() => {
    const root = document.querySelector(".notepad-cm-host").shadowRoot;
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    return { heading: px(root.querySelector(".cm-h1")), body: px(root.querySelector(".cm-content")) };
  });
  assert.ok(sizes.heading > sizes.body * 1.4, `the heading is larger than the text (${sizes.heading}px against ${sizes.body}px)`);
  assert.equal(await s.page.locator("#notepad-editor .cm-strong").count(), 1);

  await until(() => onDisk(s) === "# Shopping list\n\nSome **bold** text", 4000);
  assert.ok(Date.now() - typedAt < 2000, `saved ${Date.now() - typedAt} ms after the last key`);
  await s.page.waitForFunction(() => document.getElementById("notepad-status").textContent === "Saved");

  // Close flushes at once, without waiting out the debounce.
  await s.page.keyboard.type("\nmore");
  await s.page.click("#notepad-close");
  const closedAt = Date.now();
  await until(() => onDisk(s).endsWith("\nmore"), 4000);
  assert.ok(Date.now() - closedAt < SAVE_DEBOUNCE_MS, `flushed ${Date.now() - closedAt} ms after close`);
  assert.equal(await s.page.evaluate(() => document.activeElement && document.activeElement.id), "btn-notepad");

  const expected = "# Shopping list\n\nSome **bold** text\nmore";
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openNotepad(s);
  assert.equal(await shows(s, expected), expected, "a reload shows the saved note");

  // A server restart (the agent's open --resume) keeps it too.
  cli(["stop", "--session", s.sid], { cwd: s.project });
  await until(async () => !(await s.answers()), 5000);
  const resumed = cli(["open", "--resume", s.sid, "--no-open", "--workflow", "plan"], { cwd: s.project }).json;
  s.url = resumed.url;
  await s.page.goto(s.url, { waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openNotepad(s);
  assert.equal(await shows(s, expected), expected, "a restarted server shows the saved note");
});

test("two sessions in two folders keep two separate notepads", async (t) => {
  const a = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const b = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(a);
  await setDoc(a, "Folder A's note");
  await until(() => onDisk(a) === "Folder A's note", 4000);
  await openNotepad(b);
  assert.equal(await docText(b), "", "the second folder starts empty");
  await setDoc(b, "Folder B's note");
  await until(() => onDisk(b) === "Folder B's note", 4000);
  assert.equal(onDisk(a), "Folder A's note");
  // Reopening each shows its own.
  await closeNotepad(a);
  await openNotepad(a);
  assert.equal(await shows(a, "Folder A's note"), "Folder A's note");
});

test("the editor breaks no content-security rule, and hostile Markdown runs nothing", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const consoleErrors = [];
  s.page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  const violations = await watchViolations(s);
  await openNotepad(s);
  await typeInto(
    s,
    "# Title\n\n- a list with `code` and [a link](https://example.com)\n> quoted\n\n" +
      '<img src=x onerror="window.__pwned = 1">\n<script>window.__pwned2 = 1</script>\n' +
      '<a href="javascript:window.__pwned3 = 1">click</a>\n',
  );
  await until(() => onDisk(s).includes("__pwned3"), 4000);
  await s.page.waitForTimeout(300);
  const result = await s.page.evaluate(() => {
    const root = document.querySelector(".notepad-cm-host").shadowRoot;
    return {
      pwned: [window.__pwned, window.__pwned2, window.__pwned3],
      // CodeMirror's own empty spacer images (aria-hidden) beside widgets are not typed HTML.
      imgs: root.querySelectorAll("img:not(.cm-widgetBuffer)").length,
      scripts: root.querySelectorAll("script").length,
      styleTags: root.querySelectorAll("style").length + document.querySelectorAll("style").length,
    };
  });
  assert.deepEqual(await violations(), [], "no content-security violations with the notepad open");
  assert.deepEqual(result.pwned, [undefined, undefined, undefined], "nothing typed ran");
  assert.equal(result.imgs, 0, "typed HTML stays text");
  assert.equal(result.scripts, 0);
  assert.equal(result.styleTags, 0, "the editor added no <style> element");
  assert.deepEqual(consoleErrors.filter((e) => /Content.Security.Policy|Refused to/i.test(e)), []);
  // The heading is styled from the stylesheet the page ships.
  const h1 = await s.page.locator("#notepad-editor .cm-h1").evaluate((el) => getComputedStyle(el).fontWeight);
  assert.ok(Number(h1) >= 600 || h1 === "bold", `the heading is bold (${h1})`);
});

// The editor redraws only the lines in view, so a key costs the same at 200 KB
// as at 2 KB: about 25 ms on a quiet machine (OverType, which it replaced,
// took about 95). The bar is higher than that because `npm test` runs every
// test file at once, which alone adds 50 ms or more; it still catches a slide
// back toward whole-note redraws.
const KEY_BUDGET_MS = 200;

test("typing into a 200 KB note keeps input-to-paint under the key budget on average", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const block = "## Heading\n\nSome **bold** text with `code` and a [link](https://example.com).\n\n- an item\n- another\n\n";
  saveNote(s.project, block.repeat(Math.ceil((200 * 1024) / block.length)));
  await openNotepad(s);
  await until(async () => (await docText(s)).length > 200000, 5000);
  await input(s).click();
  await s.page.keyboard.press("Control+End");
  await s.page.evaluate(() => {
    window.__lags = [];
    window.addEventListener(
      "keydown",
      () => {
        const t0 = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => window.__lags.push(performance.now() - t0)));
      },
      { capture: true },
    );
  });
  // `npm test` runs every test file at once, and a round that lands in another
  // file's busiest moment measures the machine rather than the editor: the
  // best of up to three rounds is the editor's number.
  const averages = [];
  for (let round = 0; round < 3; round++) {
    await s.page.evaluate(() => (window.__lags = []));
    await s.page.keyboard.type("typing at the end of a long note", { delay: 60 });
    await s.page.waitForTimeout(200);
    const lags = await s.page.evaluate(() => window.__lags);
    assert.ok(lags.length >= 20, `measured ${lags.length} keys`);
    averages.push(lags.reduce((a, b) => a + b, 0) / lags.length);
    if (averages.at(-1) < KEY_BUDGET_MS) break;
  }
  const best = Math.min(...averages);
  assert.ok(best < KEY_BUDGET_MS, `average input-to-paint ${averages.map((a) => a.toFixed(1)).join(", ")} ms`);
});

test("the editor follows the console's light and dark themes", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await setDoc(s, "# Heading\n\nText");
  await s.page.locator("#notepad-editor .cm-h1").waitFor();
  const colours = (theme) =>
    s.page.evaluate((th) => {
      document.documentElement.setAttribute("data-theme", th);
      const root = getComputedStyle(document.documentElement);
      const probe = (value, prop = "color") => {
        const el = document.createElement("span");
        el.style[prop] = value;
        document.body.appendChild(el);
        const out = getComputedStyle(el)[prop];
        el.remove();
        return out;
      };
      const shadow = document.querySelector(".notepad-cm-host").shadowRoot;
      const content = shadow.querySelector(".cm-content");
      return {
        ink: probe(root.getPropertyValue("--ink")),
        accent: probe(root.getPropertyValue("--accent")),
        panel: probe(root.getPropertyValue("--panel"), "backgroundColor"),
        text: getComputedStyle(content).color,
        heading: getComputedStyle(shadow.querySelector(".cm-h1")).color,
        caret: getComputedStyle(content).caretColor,
        background: getComputedStyle(shadow.querySelector(".cm-editor")).backgroundColor,
      };
    }, theme);
  const light = await colours("light");
  const dark = await colours("dark");
  for (const [name, c] of Object.entries({ light, dark })) {
    assert.equal(c.text, c.ink, `${name}: text in the console's ink`);
    assert.equal(c.heading, c.accent, `${name}: headings in the highlight colour`);
    assert.equal(c.caret, c.accent, `${name}: the caret in the highlight colour`);
    assert.equal(c.background, c.panel, `${name}: the editor on the panel colour`);
  }
  assert.notEqual(light.text, dark.text, "the two themes differ");
  assert.notEqual(light.background, dark.background);
});

test("headings grow, bullets draw, and marks come back on the line the cursor is on", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  saveNote(s.project, "# Big\n\n## Smaller\n\n- one\n- two\n\nplain\n");
  await openNotepad(s);
  await until(async () => (await docText(s)).startsWith("# Big"), 5000);
  const lines = () =>
    s.page.evaluate(() => {
      const root = document.querySelector(".notepad-cm-host").shadowRoot;
      return [...root.querySelectorAll(".cm-line")].map((l) => ({ text: l.textContent, size: parseFloat(getComputedStyle(l).fontSize) }));
    });
  // The cursor starts on line 1 (the "# Big" heading): its mark shows, the
  // second heading's does not.
  let seen = await lines();
  assert.equal(seen[0].text, "# Big");
  assert.equal(seen[2].text, "Smaller", "off the cursor line the mark is hidden");
  assert.ok(seen[0].size > seen[2].size && seen[2].size > seen[7].size, `heading sizes step down: ${seen.map((l) => l.size).join(", ")}`);
  assert.ok(seen[4].text.startsWith("•") || !seen[4].text.startsWith("-"), `a bullet is drawn, not a hyphen: "${seen[4].text}"`);
  // Click the second heading: its mark comes back.
  await s.page.locator("#notepad-editor .cm-h2").click();
  seen = await lines();
  assert.equal(seen[2].text, "## Smaller");
  assert.equal(seen[0].text, "Big");
});

test("a note that cannot be read leaves the editor read-only, and nothing typed reaches the stored note", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  saveNote(s.project, "The real note");
  await s.page.route("**/notepad", (route) => (route.request().method() === "GET" ? route.abort() : route.continue()));
  await s.page.click("#btn-notepad");
  await s.page.locator("#notepad-modal[open]").waitFor();
  await input(s).waitFor();
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent === want, NOT_LOADED);
  assert.equal(await input(s).getAttribute("aria-readonly"), "true");
  await input(s).click();
  await s.page.keyboard.type("typed into the empty editor");
  assert.equal(await docText(s), "", "nothing could be typed");
  await s.page.waitForTimeout(SAVE_DEBOUNCE_MS + 400);
  assert.equal(onDisk(s), "The real note");
  // Once it can be read, reopening loads it and the editor opens up.
  await s.page.unroute("**/notepad");
  await closeNotepad(s);
  await openNotepad(s);
  assert.equal(await shows(s, "The real note"), "The real note");
});

test("a note too long to save keeps its text when the notepad is closed and opened again", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  saveNote(s.project, "Saved earlier");
  await openNotepad(s);
  await shows(s, "Saved earlier");
  const long = "x".repeat(NOTE_MAX_BYTES) + " and some more";
  await setDoc(s, long);
  await s.page.waitForFunction(() => document.getElementById("notepad-status").textContent.startsWith("Too long to save"));
  await closeNotepad(s);
  await openNotepad(s);
  await s.page.waitForTimeout(300);
  assert.equal((await docText(s)).length, long.length, "the long text is still in the editor");
  assert.equal(onDisk(s), "Saved earlier", "and nothing over the cap was saved");
});

/* ------------------------------------------------------------------ tabs */

const tabButtons = (s) => s.page.locator("#notepad-tabs .notepad-tab");
const tabNamed = (s, name) => s.page.locator("#notepad-tabs .notepad-tab", { hasText: new RegExp(`^${name}$`) });
const tabNames = (s) => tabButtons(s).evaluateAll((bs) => bs.map((b) => b.textContent));
const selectedName = (s) => s.page.locator('#notepad-tabs .notepad-tab[aria-selected="true"]').evaluateAll((bs) => bs.map((b) => b.textContent));
const status = (s) => s.page.locator("#notepad-status").textContent();
const idOf = (s, name) => listTabs(s.project).tabs.find((tab) => tab.name === name)?.id;
// The x beside a tab's name: the current tab's, or the one named.
const X_SELECTED = '#notepad-tabs .notepad-tab[aria-selected="true"] + .notepad-tab-x';
const xOf = (s, name) => s.page.locator(`#notepad-tabs .notepad-tab-x[aria-label="Delete ${name}"]`);
const nameError = (s) => s.page.locator("#notepad-name-error").textContent();

// Makes a tab through the page: the button, the name form, Enter.
async function newTab(s, name, shown = name) {
  await s.page.click("#notepad-tab-new");
  await s.page.locator("#notepad-name-dlg[open]").waitFor();
  await s.page.fill("#notepad-name", name);
  await s.page.keyboard.press("Enter");
  await s.page.waitForFunction((n) => [...document.querySelectorAll("#notepad-tabs .notepad-tab")].some((b) => b.textContent === n && b.getAttribute("aria-selected") === "true"), shown);
  await s.page.waitForFunction(() => !document.getElementById("notepad-name-dlg").open);
}

// A notepad in its first shape: meta.json v1, note.md and images/ at the top.
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
function legacyNotepad(folder, note) {
  const dir = notepadFolder(folder);
  fs.mkdirSync(path.join(dir, "images"), { recursive: true });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ v: 1, folder: path.resolve(folder), created: "2026-01-01T00:00:00.000Z" }));
  fs.writeFileSync(path.join(dir, "note.md"), note);
  for (const id of [U1, U2]) fs.writeFileSync(path.join(dir, "images", id + ".jpg"), JPEG);
  fs.writeFileSync(path.join(dir, "images", U1 + ".thumb.jpg"), JPEG);
  return dir;
}

test("an old notepad opens as one tab, Notes, with its text and pictures, and reading it writes nothing", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const dir = legacyNotepad(s.project, "old note\n");
  const before = fs.readdirSync(dir).sort();
  await openNotepad(s, { tabs: false });
  await input(s).waitFor();
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li").length === 2);
  assert.deepEqual(await tabNames(s), ["Notes"]);
  assert.deepEqual(await selectedName(s), ["Notes"]);
  assert.equal(await shows(s, "old note\n"), "old note\n");
  assert.equal(await s.page.locator("#notepad-empty").isHidden(), true);
  assert.deepEqual(fs.readdirSync(dir).sort(), before, "opening it moved and wrote nothing");
  // The first edit moves it into the Notes tab.
  await typeInto(s, "more");
  await until(() => fs.existsSync(path.join(dir, "tabs.json")), 4000);
  await until(() => readNotepad(s.project, LEGACY_TAB_ID).text === "old note\nmore", 4000);
  assert.equal(fs.existsSync(path.join(dir, "note.md")), false, "the top-level note moved into the tab");
  assert.equal(readNotepad(s.project, LEGACY_TAB_ID).images.length, 2, "and so did the pictures");
});

test("New tab asks for a name, refuses a bad or duplicate one, and Escape backs out", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const violations = await watchViolations(s);
  await openNotepad(s);
  await s.page.click("#notepad-tab-new");
  await s.page.locator("#notepad-name-dlg[open]").waitFor();
  assert.equal(await s.page.locator("#notepad-name-label").textContent(), "Name this tab");
  assert.equal(await s.page.evaluate(() => document.activeElement.id), "notepad-name", "the field has the focus");
  assert.equal(await s.page.inputValue("#notepad-name"), "");

  await s.page.keyboard.press("Enter");
  assert.equal(await nameError(s), "Give the tab a name.");
  await s.page.fill("#notepad-name", "   ");
  await s.page.click("#notepad-name-save");
  assert.equal(await nameError(s), "Give the tab a name.");
  await s.page.fill("#notepad-name", "x".repeat(41));
  await s.page.keyboard.press("Enter");
  assert.match(await nameError(s), /40 characters or fewer/);
  await s.page.fill("#notepad-name", "nOtEs");
  await s.page.keyboard.press("Enter");
  assert.equal(await nameError(s), errorSentence("duplicate-name"));
  assert.deepEqual(await tabNames(s), ["Notes"], "nothing was made");
  assert.equal(listTabs(s.project).tabs.length, 1);

  // Escape closes the form, not the Notebook, and gives the focus back.
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("notepad-name-dlg").open);
  assert.equal(await s.page.evaluate(() => document.getElementById("notepad-modal").open), true);
  assert.equal(await s.page.evaluate(() => document.activeElement.id), "notepad-tab-new");
  // Cancel does the same.
  await s.page.click("#notepad-tab-new");
  await s.page.click("#notepad-name-cancel");
  await s.page.waitForFunction(() => !document.getElementById("notepad-name-dlg").open);

  await newTab(s, "  Big   ideas ", "Big ideas");
  assert.deepEqual(await tabNames(s), ["Notes", "Big ideas"]);
  assert.deepEqual(await selectedName(s), ["Big ideas"]);
  assert.equal(await docText(s), "", "the new tab starts empty");
  assert.equal(await input(s).getAttribute("aria-readonly"), null, "and can be typed in");
  assert.deepEqual(listTabs(s.project).tabs.map((tab) => tab.name), ["Notes", "Big ideas"]);
  assert.deepEqual(await violations(), []);
});

test("each tab keeps its own text and pictures, and switching never saves into the wrong tab", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const violations = await watchViolations(s);
  await openNotepad(s);
  await typeInto(s, "notes text");
  await newTab(s, "Ideas");
  const notes = idOf(s, "Notes");
  const ideas = idOf(s, "Ideas");
  await until(() => readNotepad(s.project, notes).text === "notes text", 4000);
  await typeInto(s, "ideas text");
  // Switch at once, before the debounce: the text still goes to Ideas.
  await tabNamed(s, "Notes").click();
  assert.equal(await shows(s, "notes text"), "notes text");
  assert.equal(readNotepad(s.project, ideas).text, "ideas text", "typed just before the switch, saved into its own tab");
  assert.equal(readNotepad(s.project, notes).text, "notes text", "and not into the other");

  await typeInto(s, " (edited)");
  await tabNamed(s, "Ideas").click();
  assert.equal(await shows(s, "ideas text"), "ideas text");
  assert.equal(readNotepad(s.project, notes).text, "notes text (edited)");
  assert.equal(await selectedName(s).then((n) => n.join()), "Ideas");

  // A picture added to Ideas is not in Notes.
  const png = await s.page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 40;
    c.getContext("2d").fillRect(0, 0, 40, 40);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    let bin = "";
    for (const b of new Uint8Array(await blob.arrayBuffer())) bin += String.fromCharCode(b);
    return btoa(bin);
  });
  await s.page.setInputFiles("#notepad-file", { name: "p.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await until(() => readNotepad(s.project, ideas).images.length === 1, 5000);
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li.is-ready").length === 1);
  assert.equal(readNotepad(s.project, notes).images.length, 0);
  await tabNamed(s, "Notes").click();
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li").length === 0);
  await tabNamed(s, "Ideas").click();
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li.is-ready").length === 1);
  const src = await s.page.locator("#notepad-strip img").getAttribute("src");
  assert.match(src, new RegExp(`^/notepad/images/${ideas}/`), "the picture's address names its tab");

  // A save that cannot reach the server keeps you on the tab, with why.
  await s.page.route("**/notepad/text*", (route) => route.abort());
  await typeInto(s, " unsaved");
  await tabNamed(s, "Notes").click();
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent.includes(want), "Not saved yet, so staying on this tab.");
  assert.deepEqual(await selectedName(s), ["Ideas"], "still on the tab with the unsaved text");
  assert.equal(await docText(s), "ideas text unsaved");
  await s.page.unroute("**/notepad/text*");
  await until(() => readNotepad(s.project, ideas).text === "ideas text unsaved", 40000);
  await tabNamed(s, "Notes").click();
  assert.equal(await shows(s, "notes text (edited)"), "notes text (edited)");

  // The last tab is remembered across a reload.
  await tabNamed(s, "Ideas").click();
  await until(() => listTabs(s.project).last === ideas, 4000);
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openNotepad(s);
  assert.deepEqual(await selectedName(s), ["Ideas"]);
  assert.equal(await shows(s, "ideas text unsaved"), "ideas text unsaved");
  assert.deepEqual(await violations(), []);
});

test("Double-click opens the rename modal with the name selected; F2 works too, and there is no Rename button", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await newTab(s, "Ideas");
  const ideas = idOf(s, "Ideas");

  assert.equal(await s.page.locator("#notepad-tab-rename, #notepad-tab-tools").count(), 0, "the bottom toolbar is gone");
  await tabNamed(s, "Ideas").dblclick();
  await s.page.locator("#notepad-name-dlg[open]").waitFor();
  assert.equal(await s.page.locator("#notepad-name-label").textContent(), "Rename this tab");
  assert.equal(await s.page.inputValue("#notepad-name"), "Ideas");
  assert.equal(await s.page.evaluate(() => document.getElementById("notepad-name").selectionEnd - document.getElementById("notepad-name").selectionStart), 5, "the name is selected");
  // Its own name is not a duplicate; another tab's is.
  await s.page.keyboard.press("Enter");
  await s.page.waitForFunction(() => !document.getElementById("notepad-name-dlg").open);
  await tabNamed(s, "Ideas").dblclick();
  await s.page.fill("#notepad-name", "notes");
  await s.page.keyboard.press("Enter");
  assert.equal(await nameError(s), errorSentence("duplicate-name"));
  await s.page.fill("#notepad-name", "Plans");
  await s.page.keyboard.press("Enter");
  await s.page.waitForFunction(() => !document.getElementById("notepad-name-dlg").open);
  assert.deepEqual(await tabNames(s), ["Notes", "Plans"]);
  assert.equal(listTabs(s.project).tabs.find((tab) => tab.id === ideas).name, "Plans");
  assert.equal(await s.page.evaluate(() => document.activeElement.textContent), "Plans", "the focus is back on the tab");

  // F2 on a focused tab, and a double-click.
  await tabNamed(s, "Plans").focus();
  await s.page.keyboard.press("F2");
  await s.page.locator("#notepad-name-dlg[open]").waitFor();
  assert.equal(await s.page.inputValue("#notepad-name"), "Plans");
  await s.page.keyboard.press("Escape");
  await tabNamed(s, "Notes").dblclick();
  await s.page.locator("#notepad-name-dlg[open]").waitFor();
  assert.equal(await s.page.inputValue("#notepad-name"), "Notes");
  assert.deepEqual(await selectedName(s), ["Notes"], "double-click picked the tab it renames");
});

// A drag the way the browser sends one: the events, in order, with one shared
// DataTransfer, so the page's handlers see what a person's drag would.
const drag = (s, from, to, { kind = "tab" } = {}) =>
  s.page.evaluate(
    ({ from, to, kind }) => {
      const tabs = [...document.querySelectorAll("#notepad-tabs .notepad-tab")];
      const source = tabs.find((b) => b.textContent === from);
      const target = tabs.find((b) => b.textContent === to);
      const dt = new DataTransfer();
      if (kind === "text") dt.setData("text/plain", "dragged text");
      const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
      if (kind === "tab") fire(source, "dragstart");
      fire(target, "dragover");
      const marked = target.classList.contains("is-drop-before");
      fire(target, "drop");
      if (kind === "tab") fire(source, "dragend");
      return marked;
    },
    { from, to, kind },
  );

test("tabs reorder by drag only, and the order is kept", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  for (const name of ["Ideas", "Plans", "Done"]) await newTab(s, name);
  assert.deepEqual(await tabNames(s), ["Notes", "Ideas", "Plans", "Done"]);
  const order = () => listTabs(s.project).tabs.map((tab) => tab.name);

  // No buttons and no Alt+Arrow: a drag is the only way to move a tab.
  assert.equal(await s.page.locator("#notepad-tab-left, #notepad-tab-right").count(), 0);
  await tabNamed(s, "Done").focus();
  await s.page.keyboard.press("Alt+ArrowLeft");
  await s.page.waitForTimeout(300);
  assert.equal(order().join(), "Notes,Ideas,Plans,Done", "Alt+Arrow moved nothing");
  // Arrows only move the focus, with or without Alt, and never the tab.
  assert.equal(await s.page.evaluate(() => document.activeElement.textContent), "Plans");
  await s.page.keyboard.press("ArrowLeft");
  assert.equal(await s.page.evaluate(() => document.activeElement.textContent), "Ideas");
  assert.equal(order().join(), "Notes,Ideas,Plans,Done");

  // Drag: the target shows a mark, the dragged tab lands just before it.
  assert.equal(await drag(s, "Done", "Notes"), true, "the target is marked while dragged over");
  await until(() => order().join() === "Done,Notes,Ideas,Plans", 4000);
  assert.deepEqual(await tabNames(s), ["Done", "Notes", "Ideas", "Plans"]);
  assert.equal(await s.page.locator("#notepad-tabs .is-drop-before").count(), 0, "the mark is gone after the drop");

  // Text dragged over a tab does nothing.
  const posted = [];
  s.page.on("request", (r) => r.url().includes("/notepad/tab/order") && posted.push(r.url()));
  assert.equal(await drag(s, "Plans", "Ideas", { kind: "text" }), false);
  await s.page.waitForTimeout(300);
  assert.equal(order().join(), "Done,Notes,Ideas,Plans");
  assert.equal(posted.length, 0);

  // Reopened, the order stands.
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openNotepad(s);
  assert.deepEqual(await tabNames(s), ["Done", "Notes", "Ideas", "Plans"]);
});

test("Delete asks twice, Escape backs out of either, and only the second confirm removes the tab and its folder", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const violations = await watchViolations(s);
  await openNotepad(s);
  await typeInto(s, "keep me");
  await newTab(s, "Ideas");
  await typeInto(s, "doomed text");
  const ideas = idOf(s, "Ideas");
  const folder = path.join(notepadFolder(s.project), "tabs", ideas);
  await until(() => readNotepad(s.project, ideas).text === "doomed text", 4000);
  addImageTo(s.project, ideas, JPEG);
  addImageTo(s.project, ideas, JPEG);
  await tabNamed(s, "Notes").click();
  await tabNamed(s, "Ideas").click();
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li").length === 2);

  const panel = s.page.locator("#notepad-delete");
  const text = () => s.page.locator("#notepad-delete-text").textContent();
  await s.page.click(X_SELECTED);
  await panel.waitFor({ state: "visible" });
  assert.equal(await text(), "This deletes the tab Ideas, its text and its 2 pictures. This cannot be undone.");
  assert.equal(await s.page.evaluate(() => document.activeElement.textContent), "Keep tab", "Keep tab has the focus");
  assert.equal(await s.page.locator("#notepad-delete-go").textContent(), "Delete tab…");
  // Keep tab: nothing happens.
  await s.page.click("#notepad-delete-keep");
  await panel.waitFor({ state: "hidden" });
  assert.equal(fs.existsSync(folder), true);
  assert.equal(await s.page.evaluate(() => document.activeElement.textContent), "Ideas");

  // Step one then Escape: nothing deleted, and the Notebook stays open.
  await s.page.click(X_SELECTED);
  await s.page.click("#notepad-delete-go");
  assert.equal(await text(), "Really delete Ideas for good?");
  assert.equal(await s.page.locator("#notepad-delete-go").textContent(), "Yes, delete it");
  assert.equal(await s.page.evaluate(() => document.activeElement.textContent), "Keep tab", "Keep tab has the focus on the second step too");
  await s.page.keyboard.press("Escape");
  await panel.waitFor({ state: "hidden" });
  assert.equal(await s.page.evaluate(() => document.getElementById("notepad-modal").open), true);
  assert.equal(fs.existsSync(folder), true);
  // Escape at the first step too.
  await s.page.click(X_SELECTED);
  await s.page.keyboard.press("Escape");
  await panel.waitFor({ state: "hidden" });
  assert.equal(fs.existsSync(folder), true);

  // Both confirms: gone, with its folder, and the neighbour is shown.
  await s.page.click(X_SELECTED);
  await s.page.click("#notepad-delete-go");
  await s.page.click("#notepad-delete-go");
  await until(() => !fs.existsSync(folder), 4000);
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-tabs .notepad-tab").length === 1);
  assert.deepEqual(await selectedName(s), ["Notes"]);
  assert.equal(await shows(s, "keep me"), "keep me");
  assert.equal(listTabs(s.project).last, idOf(s, "Notes"), "the neighbour became the last tab");

  // Delete the last tab: the empty state, with the focus on its button.
  await s.page.click(X_SELECTED);
  await s.page.click("#notepad-delete-go");
  await s.page.click("#notepad-delete-go");
  await s.page.locator("#notepad-empty").waitFor({ state: "visible" });
  assert.equal(await s.page.locator("#notepad-body").isHidden(), true, "the editor and pictures are hidden");
  assert.equal(await s.page.locator("#notepad-empty").innerText().then((x) => x.startsWith("No tabs yet. Make one to start writing.")), true);
  assert.equal(await s.page.evaluate(() => document.activeElement.id), "notepad-empty-new");
  assert.equal(listTabs(s.project).tabs.length, 0);
  // Reopened, still empty; a new tab from the empty state works.
  await closeNotepad(s);
  await openNotepad(s, { tabs: false });
  await s.page.locator("#notepad-empty").waitFor({ state: "visible" });
  await s.page.click("#notepad-empty-new");
  await s.page.fill("#notepad-name", "Fresh");
  await s.page.keyboard.press("Enter");
  await s.page.locator("#notepad-body").waitFor({ state: "visible" });
  assert.deepEqual(await tabNames(s), ["Fresh"]);
  assert.deepEqual(await violations(), []);
});

test("text typed into a tab that is then deleted is never saved, and a tab deleted elsewhere leaves the bar with why", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await newTab(s, "Ideas");
  const ideas = idOf(s, "Ideas");
  const saves = [];
  s.page.on("request", (r) => r.url().includes("/notepad/text") && saves.push(r.url()));
  await typeInto(s, "typed then deleted");
  await s.page.click(X_SELECTED);
  await s.page.click("#notepad-delete-go");
  await s.page.click("#notepad-delete-go");
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-tabs .notepad-tab").length === 1);
  await s.page.waitForTimeout(SAVE_DEBOUNCE_MS + 500);
  assert.equal(saves.filter((u) => u.includes("tab=" + ideas)).length, 0, "no save was sent for the deleted tab");
  assert.equal(fs.existsSync(path.join(notepadFolder(s.project), "tabs", ideas)), false);

  // Deleted from another page: picking it says so and shows what is left.
  await newTab(s, "Elsewhere");
  const elsewhere = idOf(s, "Elsewhere");
  await tabNamed(s, "Notes").click();
  deleteTab(s.project, elsewhere);
  await tabNamed(s, "Elsewhere").click();
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent.includes(want), errorSentence("no-such-tab"));
  assert.deepEqual(await tabNames(s), ["Notes"]);
});

test("a double-click or an x acts on the tab it was made on, even when another is showing", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await newTab(s, "Ideas");
  const notes = idOf(s, "Notes");
  assert.deepEqual(await selectedName(s), ["Ideas"]);

  // Double-click on Notes while Ideas shows: Notes is picked and is the one renamed.
  await tabNamed(s, "Notes").dblclick();
  await s.page.locator("#notepad-name-dlg[open]").waitFor();
  assert.equal(await s.page.inputValue("#notepad-name"), "Notes");
  await until(async () => (await selectedName(s)).join() === "Notes", 4000);
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("notepad-name-dlg").open);
  assert.equal(listTabs(s.project).tabs.find((tab) => tab.id === notes).name, "Notes", "Escape left the name alone");

  // The x on Ideas while Notes shows: the question names Ideas, and Keep leaves both.
  await xOf(s, "Ideas").click();
  await s.page.locator("#notepad-delete").waitFor({ state: "visible" });
  assert.match(await s.page.locator("#notepad-delete-text").textContent(), /^This deletes the tab Ideas,/);
  await s.page.click("#notepad-delete-keep");
  await s.page.locator("#notepad-delete").waitFor({ state: "hidden" });
  assert.deepEqual(await tabNames(s), ["Notes", "Ideas"], "nothing was deleted");

  // Both confirms on the x of the tab that is not showing now remove that one.
  await tabNamed(s, "Notes").click();
  await until(async () => (await selectedName(s)).join() === "Notes", 4000);
  await xOf(s, "Ideas").click();
  await s.page.click("#notepad-delete-go");
  await s.page.click("#notepad-delete-go");
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-tabs .notepad-tab").length === 1);
  assert.deepEqual(await tabNames(s), ["Notes"]);
});

test("when the tab after a delete cannot be loaded, the deleted text is not left on screen", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await typeInto(s, "notes text");
  await newTab(s, "Ideas");
  await typeInto(s, "doomed text");
  const ideas = idOf(s, "Ideas");
  await until(() => readNotepad(s.project, ideas).text === "doomed text", 4000);
  // The neighbour's read fails, as if the connection dropped right after the delete.
  await s.page.route("**/notepad?tab=*", (route) => route.abort());
  await s.page.click(X_SELECTED);
  await s.page.click("#notepad-delete-go");
  await s.page.click("#notepad-delete-go");
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-tabs .notepad-tab").length === 1);
  await s.page.waitForFunction(() => document.getElementById("notepad-status").textContent.length > 0);
  assert.equal(await docText(s), "", "the deleted tab's text is gone from the editor");
  assert.equal(await input(s).getAttribute("aria-readonly"), "true", "and the editor does not take typing it would never save");
  await s.page.unroute("**/notepad?tab=*");
});

/* ------------------------------------------------------------ pictures */


// The stored pictures for the session's folder, and whether each of a
// picture's two files is on disk.
const stored = (s) => readNotepad(s.project).images;
const filesOf = (s, id) => {
  const dir = path.join(notepadFolder(s.project), "tabs", openTab(s.project), "images");
  return [fs.existsSync(path.join(dir, id + ".jpg")), fs.existsSync(path.join(dir, id + ".thumb.jpg"))];
};

const thumbs = (s) => s.page.locator("#notepad-strip > li");
const readyCount = (s, n) =>
  s.page.waitForFunction((want) => document.querySelectorAll("#notepad-strip > li.is-ready").length === want, n, { timeout: 5000 });

// A small PNG drawn in the page, as base64: a real picture for reencode() to
// decode, one colour per call so the pictures differ.
const pngBase64 = (s, colour) =>
  s.page.evaluate(async (fill) => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 200;
    const ctx = c.getContext("2d");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 320, 200);
    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
    let bin = "";
    for (const b of new Uint8Array(await blob.arrayBuffer())) bin += String.fromCharCode(b);
    return btoa(bin);
  }, colour);

const pngFile = async (s, colour, name = "shot.png") => ({ name, mimeType: "image/png", buffer: Buffer.from(await pngBase64(s, colour), "base64") });

async function addViaButton(s, colour) {
  const before = stored(s).length;
  await s.page.setInputFiles("#notepad-file", await pngFile(s, colour));
  await until(() => stored(s).length === before + 1 && filesOf(s, stored(s).at(-1).id).every(Boolean), 5000);
  await readyCount(s, before + 1);
}

// A synthetic paste or drop of one PNG, sent to the editor, where a person's
// would land. A paste answers whether the page took it from the editor, a
// drop whether the dialog lit up while it was dragged over.
const sendPicture = (s, kind, colour) =>
  s.page.evaluate(
    async ({ kind, fill }) => {
      const c = document.createElement("canvas");
      c.width = 240;
      c.height = 160;
      const ctx = c.getContext("2d");
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, 240, 160);
      const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "pasted.png", { type: "image/png" }));
      const ta = document.querySelector(".notepad-cm-host").shadowRoot.querySelector(".cm-content");
      if (kind === "paste") return !ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true, composed: true }));
      ta.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true, composed: true }));
      const lit = document.getElementById("notepad-modal").classList.contains("is-drop");
      ta.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, composed: true }));
      return lit;
    },
    { kind, fill: colour },
  );

test("Add image, paste and drop each add a thumbnail whose files are on disk and which survives closing", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  assert.equal(await thumbs(s).count(), 0);

  await addViaButton(s, "#c33");

  assert.equal(await sendPicture(s, "paste", "#3c3"), true, "the paste was taken from the editor");
  await until(() => stored(s).length === 2 && filesOf(s, stored(s)[1].id).every(Boolean), 5000);

  assert.equal(await sendPicture(s, "drop", "#33c"), true, "the dialog lit up while a picture was dragged over it");
  await until(() => stored(s).length === 3 && filesOf(s, stored(s)[2].id).every(Boolean), 5000);
  await readyCount(s, 3);
  assert.equal(await s.page.locator("#notepad-modal.is-drop").count(), 0, "the highlight is gone after the drop");
  assert.equal(await docText(s), "", "no picture landed in the text");

  const alts = await s.page.locator("#notepad-strip img").evaluateAll((imgs) => imgs.map((i) => i.alt));
  assert.deepEqual(alts, ["Notebook image 1", "Notebook image 2", "Notebook image 3"]);
  const xs = await s.page.locator("#notepad-strip .notepad-thumb-delete").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
  assert.deepEqual(xs, ["Delete image 1", "Delete image 2", "Delete image 3"]);

  // Closed and opened again, the strip is drawn from the stored pictures,
  // oldest first, each from its stored thumbnail.
  const ids = stored(s).map((img) => img.id);
  await closeNotepad(s);
  await openNotepad(s);
  // Until the re-read lands, the strip still shows the thumbnails made here.
  await s.page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll("#notepad-strip img")];
    return imgs.length === 3 && imgs.every((i) => new URL(i.src).pathname.startsWith("/notepad/images/"));
  });
  const srcs = await s.page.locator("#notepad-strip img").evaluateAll((imgs) => imgs.map((i) => new URL(i.src).pathname));
  assert.deepEqual(srcs, ids.map((id) => `/notepad/images/${openTab(s.project)}/${id}.thumb.jpg`));
  await s.page.waitForFunction(() => [...document.querySelectorAll("#notepad-strip img")].every((i) => i.complete && i.naturalWidth > 0));
});

test("a pasted text snippet still lands in the editor", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(s.url).origin });
  await openNotepad(s);
  await s.page.evaluate(() => navigator.clipboard.writeText("a pasted snippet"));
  await input(s).click();
  await s.page.keyboard.press("Control+V");
  await shows(s, "a pasted snippet");
  await until(() => onDisk(s) === "a pasted snippet", 4000);
  assert.equal(stored(s).length, 0, "no picture was added");
  assert.equal(await thumbs(s).count(), 0);
});

test("the X asks first: Keep keeps the picture, Delete removes both its files", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await addViaButton(s, "#c33");
  await addViaButton(s, "#3c3");
  const [first, second] = stored(s).map((img) => img.id);

  await s.page.click("#notepad-strip li:nth-child(1) .notepad-thumb-delete");
  await s.page.locator(".notepad-ask").waitFor();
  assert.match(await s.page.locator(".notepad-ask").innerText(), /Delete this image\?/);
  assert.equal(await s.page.evaluate(() => document.activeElement.textContent), "Keep", "Keep has the focus");
  assert.deepEqual(filesOf(s, first), [true, true], "one click deleted nothing");
  // Enter on the focused button keeps it.
  await s.page.keyboard.press("Enter");
  await s.page.waitForFunction(() => !document.querySelector(".notepad-ask"));
  await readyCount(s, 2);
  assert.deepEqual(filesOf(s, first), [true, true]);

  await s.page.click("#notepad-strip li:nth-child(1) .notepad-thumb-delete");
  await s.page.click(".notepad-ask-delete");
  await until(() => !filesOf(s, first).some(Boolean), 4000);
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li").length === 1);
  assert.deepEqual(stored(s).map((img) => img.id), [second]);
  assert.equal(await s.page.locator("#notepad-strip img").getAttribute("alt"), "Notebook image 1");
});

test("the preview opens at the clicked picture, steps and wraps, and Esc closes it before the Notebook", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  for (const colour of ["#c33", "#3c3", "#33c"]) await addViaButton(s, colour);
  const urls = stored(s).map((img) => img.url);
  const shown = () =>
    s.page.evaluate(() => ({
      src: new URL(document.getElementById("notepad-preview-img").src).pathname,
      count: document.getElementById("notepad-preview-count").textContent,
    }));

  await s.page.click("#notepad-strip li:nth-child(2) .notepad-thumb-open");
  await s.page.locator("#notepad-preview[open]").waitFor();
  assert.deepEqual(await shown(), { src: urls[1], count: "2 of 3" });
  await s.page.waitForFunction(() => {
    const i = document.getElementById("notepad-preview-img");
    return i.complete && i.naturalWidth > 0;
  });
  await s.page.keyboard.press("ArrowRight");
  assert.deepEqual(await shown(), { src: urls[2], count: "3 of 3" });
  await s.page.keyboard.press("ArrowRight");
  assert.deepEqual(await shown(), { src: urls[0], count: "1 of 3" }, "Next wraps to the first");
  await s.page.keyboard.press("ArrowLeft");
  assert.deepEqual(await shown(), { src: urls[2], count: "3 of 3" }, "Previous wraps to the last");
  await s.page.click("#notepad-preview-prev");
  assert.deepEqual(await shown(), { src: urls[1], count: "2 of 3" });
  await s.page.click("#notepad-preview-next");
  assert.deepEqual(await shown(), { src: urls[2], count: "3 of 3" });

  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("notepad-preview").open);
  assert.equal(await s.page.evaluate(() => document.getElementById("notepad-modal").open), true, "the Notebook stays open");
  assert.equal(
    await s.page.evaluate(() => document.activeElement.closest("li") === document.querySelector("#notepad-strip li:nth-child(2)")),
    true,
    "the focus is back on the thumbnail it opened from",
  );
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("notepad-modal").open);

  // One picture: nothing to step to.
  for (const id of stored(s).slice(1).map((img) => img.id)) removeImage(s.project, id);
  await openNotepad(s);
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li").length === 1);
  await s.page.click("#notepad-strip .notepad-thumb-open");
  await s.page.locator("#notepad-preview[open]").waitFor();
  assert.equal(await s.page.locator("#notepad-preview-prev").isVisible(), false);
  assert.equal(await s.page.locator("#notepad-preview-next").isVisible(), false);
  assert.equal(await s.page.locator("#notepad-preview-count").innerText(), "1 of 1");
});

test("past the cap, what fits is added and the cap sentence stays up; the 201st alone is refused", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  // The store checks only the JPEG signature, so a stub stands in for 199.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0xff, 0xd9]);
  for (let i = 0; i < NOTEPAD_MAX_IMAGES - 1; i++) addImage(s.project, jpeg);
  await openNotepad(s);
  await s.page.waitForFunction((n) => document.querySelectorAll("#notepad-strip > li").length === n, NOTEPAD_MAX_IMAGES - 1);
  const status = () => s.page.locator("#notepad-status").textContent();

  // Two for one place: the first lands, and the sentence outlives its upload.
  await s.page.setInputFiles("#notepad-file", [await pngFile(s, "#c33", "fits.png"), await pngFile(s, "#3c3", "too-many.png")]);
  await until(() => stored(s).length === NOTEPAD_MAX_IMAGES && filesOf(s, stored(s).at(-1).id).every(Boolean), 5000);
  await s.page.waitForFunction((n) => document.querySelectorAll("#notepad-strip > li.is-ready").length === n, NOTEPAD_MAX_IMAGES);
  assert.ok((await status()).includes(errorSentence("too-many")), `still says the cap: "${await status()}"`);

  await s.page.setInputFiles("#notepad-file", await pngFile(s, "#33c", "one-more.png"));
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent.includes(want), errorSentence("too-many"));
  assert.equal(await thumbs(s).count(), NOTEPAD_MAX_IMAGES);
  assert.equal(stored(s).length, NOTEPAD_MAX_IMAGES);
});

const isPath = (want) => (url) => url.pathname === want;

test("a failed upload shows Retry, which sends only what did not land and keeps the focus on the thumbnail", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  // The picture lands, its thumbnail does not.
  await s.page.route(isPath("/notepad/thumb"), (route) => route.abort(), { times: 1 });
  await s.page.setInputFiles("#notepad-file", await pngFile(s, "#c33"));
  await s.page.locator("#notepad-strip li.is-failed .notepad-retry").waitFor();
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent.includes(want), errorSentence(null));
  assert.equal(stored(s).length, 1);
  const { id } = stored(s)[0];
  assert.deepEqual(filesOf(s, id), [true, false]);

  await s.page.locator(".notepad-retry").focus();
  await s.page.keyboard.press("Enter");
  await readyCount(s, 1);
  await until(() => filesOf(s, id).every(Boolean), 4000);
  assert.deepEqual(stored(s).map((img) => img.id), [id], "Retry did not store the picture twice");
  assert.equal(await s.page.evaluate(() => Boolean(document.activeElement.closest("#notepad-strip li"))), true, "the focus stayed on the thumbnail");
  await s.page.waitForFunction(() => document.getElementById("notepad-status").textContent === "", null, { timeout: 4000 });

  // A picture the server turned away for good is taken off, with why.
  await s.page.route(isPath("/notepad/image"), (route) => route.fulfill({ status: 413, contentType: "application/json", body: '{"error":"too-large"}' }), { times: 1 });
  await s.page.setInputFiles("#notepad-file", await pngFile(s, "#3c3"));
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent.includes(want), errorSentence("too-large"));
  await s.page.waitForFunction(() => document.querySelectorAll("#notepad-strip > li").length === 1);
  assert.equal(stored(s).length, 1);
});

test("a delete that fails keeps the thumbnail and says why", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await addViaButton(s, "#c33");
  const { id } = stored(s)[0];
  await s.page.route(isPath("/notepad/image/delete"), (route) => route.abort(), { times: 1 });
  await s.page.click("#notepad-strip .notepad-thumb-delete");
  await s.page.click(".notepad-ask-delete");
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent.includes(want), errorSentence(null));
  await s.page.waitForFunction(() => !document.querySelector(".notepad-ask"));
  assert.equal(await thumbs(s).count(), 1);
  assert.deepEqual(filesOf(s, id), [true, true]);
  assert.equal(await s.page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Delete image 1", "the focus is back on the X");
});

/* ------------------------------------------------- Cleanup, phone, Help */

// Every file and folder under `dir`, and `dir` itself, moved `days` back.
function backdateAll(dir, days) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) backdateAll(p, days);
    else backdate(p, days);
  }
  backdate(dir, days);
}

test("User Preferences, Cleanup offers a month-old notepad by its folder and removes it", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  saveNote(s.project, "an old idea");
  backdateAll(notepadFolder(s.project), 31);
  // Here the notepads folder sits in the console home (NOTEPADS_DIR), where
  // Cleanup would list it as a stray once everything in it is old; a notepad
  // written today keeps it in use, as the real ~/.plan2code/notepads is never
  // inside the console folder.
  const other = path.join(s.project, "elsewhere");
  saveNote(other, "today");
  t.after(() => fs.rmSync(notepadFolder(other), { recursive: true, force: true }));

  await s.page.click("#btn-looks");
  await s.page.click("#cleanup-scan");
  const list = s.page.locator("#cleanup-list");
  const row = list.locator(".cleanup-row").filter({ hasText: "Notebook for" });
  await row.waitFor();
  assert.equal(await row.count(), 1, "one item for the whole notepad");
  assert.equal((await row.locator("span").first().innerText()).trim(), "Notebook for " + path.resolve(s.project));
  assert.ok((await list.locator(".cleanup-summary").innerText()).includes("1 old notebook"), "the summary counts it as a notepad");
  assert.equal(await list.locator(".cleanup-row").filter({ hasText: "notepads/" }).count(), 0, "the notepads folder is no stray");
  assert.equal(fs.existsSync(notepadFolder(s.project)), true, "a scan only looks");

  await s.page.click("#cleanup-delete");
  await s.page.waitForFunction(() => /^Deleted /.test(document.getElementById("cleanup-status").textContent));
  assert.equal(fs.existsSync(notepadFolder(s.project)), false, "the whole notepad folder went");
  assert.equal(readNotepad(s.project).text, "");
  assert.ok(!fs.readdirSync(path.dirname(notepadFolder(s.project))).includes(notepadKey(s.project)));
});

test("the notepad works at phone width: full screen, nothing wider than the window, fingertip-sized controls", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.setViewportSize({ width: 390, height: 844 });
  const noSideScroll = async (where) => {
    const { sw, iw } = await s.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    assert.ok(sw <= iw, `${where}: the page is ${sw}px wide in a ${iw}px window`);
  };
  const box = (sel) => s.page.locator(sel).first().boundingBox();
  await noSideScroll("the session");
  assert.ok((await box("#btn-notepad")).width >= 44, "the icon is a fingertip wide");

  await openNotepad(s);
  await addViaButton(s, "#c33");
  await noSideScroll("the notepad");
  const modal = await box("#notepad-modal");
  assert.deepEqual([modal.x, modal.y, modal.width, modal.height], [0, 0, 390, 844], "the notepad fills the screen");
  const inner = await s.page.$eval("#notepad-modal", (m) => ({ sw: m.scrollWidth, cw: m.clientWidth }));
  assert.ok(inner.sw <= inner.cw, `the dialog scrolls sideways: ${inner.sw} > ${inner.cw}`);
  for (const sel of ["#notepad-add", "#notepad-close"]) assert.ok((await box(sel)).height >= 44, `${sel} is a fingertip tall`);
  const x = await box(".notepad-thumb-delete");
  assert.ok(x.width >= 30 && x.height >= 30, "the X is big enough to tap");
  const strip = await box("#notepad-strip");
  assert.ok(strip.width > 300, "the pictures get the full width under Add image");

  await s.page.click(".notepad-thumb-open");
  await s.page.locator("#notepad-preview[open]").waitFor();
  await noSideScroll("the preview");
  const img = await box("#notepad-preview-img");
  assert.ok(img.x >= 0 && img.x + img.width <= 390, "the picture fits the window");
  assert.ok((await box("#notepad-preview-close")).height >= 44);
});

test("Help's Getting around panel describes the notepad", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.click("#btn-about");
  await s.page.locator("#help-modal").waitFor();
  await s.page.click("#help-tab-around");
  const panel = s.page.locator("#help-panel-around");
  await panel.getByRole("heading", { name: "Your notebook" }).waitFor();
  const text = await panel.innerText();
  for (const words of ["Notebook", "never sent to Plan2Code", "last save wins", "Cleanup"]) {
    assert.ok(text.includes(words), `the panel mentions ${words}`);
  }
});
