// Page tests for the Notepad: the top bar icon on every screen, the styled
// editor, autosave and what survives a reload or a restart, one notepad per
// folder, the page's content-security policy with the editor open, hostile
// Markdown, typing speed on a long note, the editor's two layers lining up,
// both themes, and the pictures: adding, deleting, the preview and the cap.
// Run with:
// node --test scripts/test-web-console-page-notepad.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test. Notes land in the file's throwaway NOTEPADS_DIR.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, drawn } from "./page-test-helpers.mjs";
import { backdate, cli, until } from "./web-console-test-helpers.mjs";
import {
  NOTEPAD_MAX_IMAGES,
  NOTE_MAX_BYTES,
  addImage,
  notepadFolder,
  notepadKey,
  readNotepad,
  removeImage,
  saveNote,
} from "../src/web-console/notepads.mjs";
import { NOT_LOADED, SAVE_DEBOUNCE_MS, errorSentence } from "../src/web-console/public/notepad.js";

const suite = pageSuite(test);

// A plan session on the person's turn.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

const input = (s) => s.page.locator("#notepad-editor .overtype-input");

// Opens the notepad and, unless told the note cannot load, waits until it has:
// the editor is read-only until then.
async function openNotepad(s, { loads = true } = {}) {
  await s.page.click("#btn-notepad");
  await s.page.locator("#notepad-modal[open]").waitFor();
  await input(s).waitFor();
  if (loads) await s.page.waitForFunction(() => !document.querySelector("#notepad-editor .overtype-input").readOnly);
}

async function closeNotepad(s) {
  await s.page.click("#notepad-close");
  await s.page.waitForFunction(() => !document.getElementById("notepad-modal").open);
}

// The editor's text once the page has read the note in: opening reads it from
// the server, so the first value can still be the empty editor.
async function shows(s, text) {
  await s.page.waitForFunction((want) => document.querySelector("#notepad-editor .overtype-input").value === want, text, { timeout: 5000 });
  return input(s).inputValue();
}

// The note on disk for the session's folder, as the store reads it.
const onDisk = (s) => readNotepad(s.project).text;

async function iconUsable(s, where) {
  const btn = s.page.locator("#btn-notepad");
  assert.ok(await btn.isVisible(), `the icon shows on ${where}`);
  assert.ok(await btn.isEnabled(), `the icon is usable on ${where}`);
  assert.equal(await btn.getAttribute("aria-label"), "Notepad");
  assert.equal(await btn.getAttribute("title"), "Notepad");
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
  assert.equal(await input(s).getAttribute("aria-label"), "Notepad text");
  await input(s).focus();
  await s.page.keyboard.type("# Shopping list\n\nSome **bold** text");
  const typedAt = Date.now();
  // Styled in place: the preview layer under the textarea holds a heading.
  await s.page.locator("#notepad-editor .overtype-preview h1").waitFor();
  assert.match(await s.page.locator("#notepad-editor .overtype-preview h1").innerText(), /Shopping list/);
  assert.equal(await s.page.locator("#notepad-editor .overtype-preview strong").count(), 1);

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
  await input(a).fill("Folder A's note");
  await until(() => onDisk(a) === "Folder A's note", 4000);
  await openNotepad(b);
  assert.equal(await input(b).inputValue(), "", "the second folder starts empty");
  await input(b).fill("Folder B's note");
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
  await s.context.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__violations.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber} ${e.sample}`),
    );
  });
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openNotepad(s);
  await input(s).focus();
  await s.page.keyboard.type(
    "# Title\n\n- a list with `code` and [a link](https://example.com)\n> quoted\n\n" +
      '<img src=x onerror="window.__pwned = 1">\n<script>window.__pwned2 = 1</script>\n' +
      '<a href="javascript:window.__pwned3 = 1">click</a>\n',
  );
  await until(() => onDisk(s).includes("__pwned3"), 4000);
  await s.page.waitForTimeout(300);
  const result = await s.page.evaluate(() => ({
    violations: window.__violations,
    pwned: [window.__pwned, window.__pwned2, window.__pwned3],
    imgs: document.querySelectorAll("#notepad-editor .overtype-preview img").length,
    scripts: document.querySelectorAll("#notepad-editor script").length,
    styleTag: Boolean(document.querySelector("style.overtype-styles")),
  }));
  assert.deepEqual(result.violations, [], "no content-security violations with the notepad open");
  assert.deepEqual(result.pwned, [undefined, undefined, undefined], "nothing typed ran");
  assert.equal(result.imgs, 0, "typed HTML stays text");
  assert.equal(result.scripts, 0);
  assert.equal(result.styleTag, false, "OverType injected no <style>");
  assert.deepEqual(consoleErrors.filter((e) => /Content.Security.Policy|Refused to/i.test(e)), []);
  // The heading is styled from the stylesheet the page ships.
  const h1 = await s.page.locator("#notepad-editor .overtype-preview h1").evaluate((el) => getComputedStyle(el).fontWeight);
  assert.ok(Number(h1) >= 600 || h1 === "bold", `the heading is bold (${h1})`);
});

// The editor redraws only the lines that changed (patchPreview in
// screens/notepad.js): about 90 ms a key at 200 KB on a quiet machine, against
// about 310 ms when every key redrew the whole note. The bar is higher than
// that because `npm test` runs every test file at once, which alone adds 50 ms
// or more; it still catches a slide back toward whole-note redraws.
const KEY_BUDGET_MS = 200;

test("typing into a 200 KB note keeps input-to-paint under the key budget on average", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const block = "## Heading\n\nSome **bold** text with `code` and a [link](https://example.com).\n\n- an item\n- another\n\n";
  saveNote(s.project, block.repeat(Math.ceil((200 * 1024) / block.length)));
  await openNotepad(s);
  await s.page.waitForFunction(() => document.querySelector("#notepad-editor .overtype-input").value.length > 200000);
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
    const ta = document.querySelector("#notepad-editor .overtype-input");
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
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

test("the textarea and the styled layer line up, line for line", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await input(s).fill(
    "# A heading\n## A smaller one\nPlain text with **bold**, *em* and `code`.\n> a quote\n- a list item\n\n" +
      "A long line that wraps: " + "word ".repeat(80) + "\nThe last line",
  );
  const m = await s.page.evaluate(() => {
    const ta = document.querySelector("#notepad-editor .overtype-input");
    const pv = document.querySelector("#notepad-editor .overtype-preview");
    const cs = (el) => getComputedStyle(el);
    const lineHeight = parseFloat(cs(ta).lineHeight);
    const lines = [...pv.children];
    const top0 = lines[0].getBoundingClientRect().top;
    return {
      lineHeight,
      count: lines.length,
      offsets: lines.map((el) => (el.getBoundingClientRect().top - top0) / lineHeight),
      heights: [ta.scrollHeight, pv.scrollHeight],
      fonts: [ta, pv, pv.querySelector("h1"), pv.querySelector("h2"), pv.querySelector("strong"), pv.querySelector("code")].map(
        (el) => `${cs(el).fontFamily} ${cs(el).fontSize}`,
      ),
      padding: [cs(ta).paddingTop, cs(pv).paddingTop, cs(ta).paddingLeft, cs(pv).paddingLeft],
    };
  });
  assert.equal(m.count, 8, "one preview line per text line");
  for (const [i, offset] of m.offsets.entries()) {
    assert.ok(Math.abs(offset - Math.round(offset)) < 0.05, `line ${i + 1} sits on the grid (${offset})`);
  }
  assert.ok(Math.abs(m.heights[0] - m.heights[1]) <= 1, `same height: ${m.heights.join(" vs ")}`);
  assert.equal(new Set(m.fonts).size, 1, `one font and size everywhere: ${[...new Set(m.fonts)].join(" | ")}`);
  assert.equal(m.padding[0], m.padding[1]);
  assert.equal(m.padding[2], m.padding[3]);
});

test("the editor follows the console's light and dark themes", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await openNotepad(s);
  await input(s).fill("# Heading\n\nText");
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
      const ta = document.querySelector("#notepad-editor .overtype-input");
      const pv = document.querySelector("#notepad-editor .overtype-preview");
      return {
        ink: probe(root.getPropertyValue("--ink")),
        accent: probe(root.getPropertyValue("--accent")),
        panel: probe(root.getPropertyValue("--panel"), "backgroundColor"),
        text: getComputedStyle(pv).color,
        heading: getComputedStyle(pv.querySelector("h1")).color,
        caret: getComputedStyle(ta).caretColor,
        background: getComputedStyle(document.querySelector("#notepad-editor .overtype-wrapper")).backgroundColor,
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

test("after edits anywhere, the styled layer matches a full redraw", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const block = "## Heading\n\nSome **bold** and a [link](https://example.com).\n\n- an item\n- another\n1. first\n2. second\n\n```js\nconst x = 1;\n```\n> quote\n";
  saveNote(s.project, block.repeat(40));
  await openNotepad(s);
  await s.page.waitForFunction(() => document.querySelector("#notepad-editor .overtype-input").value.length > 1000);
  // The layer on the page against one drawn from scratch from the same text.
  const matches = () =>
    s.page.evaluate(async () => {
      const { withoutStyleAttrs } = await import("/notepad.js");
      const ta = document.querySelector("#notepad-editor .overtype-input");
      const pv = document.querySelector("#notepad-editor .overtype-preview");
      const parser = ta.closest(".overtype-wrapper")._instance.constructor.MarkdownParser;
      const fresh = document.createElement("div");
      fresh.className = "overtype-preview";
      // Parsed into an inert template, so nothing in it reaches the page.
      const tpl = document.createElement("template");
      tpl.innerHTML = withoutStyleAttrs(parser.parse(ta.value, -1, false, undefined, false));
      fresh.append(tpl.content);
      // OverType shades code fences in pairs, in order, after drawing
      // (_applyCodeBlockBackgrounds): the fresh copy gets the same, so a stale
      // mark left on the page shows as a difference.
      const fences = fresh.querySelectorAll(".code-fence");
      for (let i = 0; i < fences.length - 1; i += 2) {
        for (const f of [fences[i], fences[i + 1]]) {
          f.parentElement.classList.add("code-block-line");
          f.style.display = "block";
        }
      }
      // An emptied style or class attribute looks exactly like none.
      const plain = (html) => html.replace(/ (style|class)=""/g, "");
      return plain(pv.innerHTML) === plain(fresh.innerHTML);
    });
  const at = (pos) =>
    s.page.evaluate((p) => {
      const ta = document.querySelector("#notepad-editor .overtype-input");
      const i = p < 0 ? ta.value.length + p : p;
      ta.focus();
      ta.setSelectionRange(i, i);
    }, pos);
  await at(0);
  await s.page.keyboard.type("# A new first line\n");
  assert.ok(await matches(), "typing at the top");
  await at(600);
  await s.page.keyboard.type("\n- a list item added in the middle\n[another link](https://example.org) ");
  assert.ok(await matches(), "typing in the middle, adding a link before others");
  await at(900);
  for (let i = 0; i < 30; i++) await s.page.keyboard.press("Backspace");
  assert.ok(await matches(), "deleting across lines");
  await at(-5);
  await s.page.keyboard.type("\n```\nopen fence at the end");
  assert.ok(await matches(), "an unclosed fence at the end");
  await s.page.keyboard.press("Control+a");
  await s.page.keyboard.press("Backspace");
  assert.ok(await matches(), "clearing it all");
  await s.page.keyboard.type("# Back again");
  assert.ok(await matches(), "typing into the empty note");
  // Four fences, two shaded blocks; deleting the first fence leaves three, and
  // the last one, kept from the drawing before, is no longer paired.
  // Ending on the last fence, so its line is the one kept unchanged.
  await s.page.keyboard.type("\n```\ncode\n```\ntext\n```\nmore\n```");
  assert.ok(await matches(), "two fenced blocks");
  const firstFence = await s.page.evaluate(() => document.querySelector("#notepad-editor .overtype-input").value.indexOf("```"));
  await at(firstFence + 4);
  for (let i = 0; i < 4; i++) await s.page.keyboard.press("Backspace");
  assert.ok(await matches(), "the first fence deleted, unpairing the last");
});

test("a note that cannot be read leaves the editor read-only, and nothing typed reaches the stored note", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  saveNote(s.project, "The real note");
  await s.page.route("**/notepad", (route) => (route.request().method() === "GET" ? route.abort() : route.continue()));
  await openNotepad(s, { loads: false });
  await s.page.waitForFunction((want) => document.getElementById("notepad-status").textContent === want, NOT_LOADED);
  assert.equal(await input(s).evaluate((el) => el.readOnly), true);
  await input(s).focus();
  await s.page.keyboard.type("typed into the empty editor");
  assert.equal(await input(s).inputValue(), "", "nothing could be typed");
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
  await input(s).fill(long);
  await s.page.waitForFunction(() => document.getElementById("notepad-status").textContent.startsWith("Too long to save"));
  await closeNotepad(s);
  await openNotepad(s);
  await s.page.waitForTimeout(300);
  assert.equal((await input(s).inputValue()).length, long.length, "the long text is still in the editor");
  assert.equal(onDisk(s), "Saved earlier", "and nothing over the cap was saved");
});

/* ------------------------------------------------------------ pictures */

// The stored pictures for the session's folder, and whether each of a
// picture's two files is on disk.
const stored = (s) => readNotepad(s.project).images;
const filesOf = (s, id) => {
  const dir = path.join(notepadFolder(s.project), "images");
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
      const ta = document.querySelector("#notepad-editor .overtype-input");
      if (kind === "paste") return !ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      ta.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
      const lit = document.getElementById("notepad-modal").classList.contains("is-drop");
      ta.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
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
  assert.equal(await input(s).inputValue(), "", "no picture landed in the text");

  const alts = await s.page.locator("#notepad-strip img").evaluateAll((imgs) => imgs.map((i) => i.alt));
  assert.deepEqual(alts, ["Notepad image 1", "Notepad image 2", "Notepad image 3"]);
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
  assert.deepEqual(srcs, ids.map((id) => `/notepad/images/${id}.thumb.jpg`));
  await s.page.waitForFunction(() => [...document.querySelectorAll("#notepad-strip img")].every((i) => i.complete && i.naturalWidth > 0));
});

test("a pasted text snippet still lands in the editor", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(s.url).origin });
  await openNotepad(s);
  await s.page.evaluate(() => navigator.clipboard.writeText("a pasted snippet"));
  await input(s).focus();
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
  assert.equal(await s.page.locator("#notepad-strip img").getAttribute("alt"), "Notepad image 1");
});

test("the preview opens at the clicked picture, steps and wraps, and Esc closes it before the Notepad", async (t) => {
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
  assert.equal(await s.page.evaluate(() => document.getElementById("notepad-modal").open), true, "the Notepad stays open");
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
  const row = list.locator(".cleanup-row").filter({ hasText: "Notepad for" });
  await row.waitFor();
  assert.equal(await row.count(), 1, "one item for the whole notepad");
  assert.equal((await row.locator("span").first().innerText()).trim(), "Notepad for " + path.resolve(s.project));
  assert.ok((await list.locator(".cleanup-summary").innerText()).includes("1 old notepad"), "the summary counts it as a notepad");
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
  await panel.getByRole("heading", { name: "Your notepad" }).waitFor();
  const text = await panel.innerText();
  for (const words of ["Notepad", "never sent to Plan2Code", "last save wins", "Cleanup"]) {
    assert.ok(text.includes(words), `the panel mentions ${words}`);
  }
});
