// Page tests for the Changes tab: a `diff` doc block (a .diff file saved in the
// session folder, changes.mjs diff) drawn as a file list and one unified diff,
// with its empty, error and loading states. Run with:
// node --test scripts/test-web-console-page-changes.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pageSuite, openSession, itemCard, textOf, styleOf, scrollCard } from "./page-test-helpers.mjs";

const suite = pageSuite(test);

// Five files: a modified one with two hunks, an added one, a binary one, a
// hidden one, then a file cut by the size cap.
const DIFF = [
  "diff --git a/src/app.js b/src/app.js",
  "index 1111111..2222222 100644",
  "--- a/src/app.js",
  "+++ b/src/app.js",
  "@@ -3,3 +3,4 @@ function start() {",
  " one",
  "-two",
  "+TWO",
  "+two and a half",
  " three",
  "@@ -20,2 +21,2 @@",
  "-gone",
  "+<b>not html</b>",
  " kept",
  "diff --git a/docs/new.md b/docs/new.md",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/docs/new.md",
  "@@ -0,0 +1,2 @@",
  "+# New",
  "+Hello.",
  "diff --git a/logo.png b/logo.png",
  "index 7777777..8888888 100644",
  "Binary files a/logo.png and b/logo.png differ",
  "diff --git a/.env b/.env",
  "index 9999999..aaaaaaa 100644",
  "Lines hidden: this file may hold a secret.",
  "\\ No more lines shown: this change is too large to show in full.",
  "diff --git a/big.txt b/big.txt",
  "# truncated: true",
  "# hidden: .env",
  "",
].join("\n");

// A sign-off card about the report, as Implement posts it.
const SIGNOFF = {
  id: "signoff",
  kind: "review",
  title: "Approve this phase",
  doc: "report",
  body: "Read the report, then approve it or say what to change.",
  verdicts: [
    { id: "approve", label: "Approve this phase" },
    { id: "changes", label: "I want changes" },
  ],
};
const REPORT = { id: "report", title: "Completion report", blocks: [{ id: "summary", md: "## Summary\n\nPhase 3 draws the Changes tab." }] };

// Opens an implement session whose Changes doc reads `text` from changes.diff.
async function withChanges(t, text, extra = {}) {
  const s = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "waiting" } } });
  fs.writeFileSync(path.join(s.session, "changes.diff"), text);
  s.post({
    docs: [REPORT, { id: "changes", title: "Changes", blocks: [{ id: "c1", diff: "changes.diff" }] }],
    agent: { status: "waiting" },
    ...extra,
  });
  return s;
}

const tab = (s, name) => s.page.locator("#views .view-tab", { hasText: new RegExp(`^${name}`) });

async function openChanges(s) {
  await tab(s, "Changes").click();
  await s.page.locator("#main .diff-view").waitFor();
}

// The rows of the diff pane as [old number, new number, mark, text].
async function paneRows(s) {
  return s.page.locator("#main .diff-pane .diff-line").evaluateAll((rows) =>
    rows.map((r) => [...r.children].map((c) => c.textContent))
  );
}

// Whether the element is fully inside the window.
async function inViewport(s, locator) {
  const box = await locator.boundingBox();
  const size = s.page.viewportSize();
  return Boolean(box) && box.y >= 0 && box.x >= 0 && box.y + box.height <= size.height && box.x + box.width <= size.width;
}

// What the person sees break: a tab that never shows, a list without its
// counts, or the wrong line numbers on the lines.
test("the Changes tab lists each file with its counts and draws the first file's lines numbered and marked", async (t) => {
  const s = await withChanges(t, DIFF);
  await tab(s, "Changes").waitFor();
  const tabs = await s.page.locator("#views .view-tab").allTextContents();
  const report = tabs.findIndex((x) => x.startsWith("Completion report"));
  assert.ok(report >= 0, `the report tab: ${tabs}`);
  assert.ok(tabs[report + 1].startsWith("Changes"), `the Changes tab sits beside the report tab: ${tabs}`);
  await openChanges(s);

  assert.equal(await textOf(s.page.locator("#main .diff-totals")), "5 files changed, +5 -2");
  assert.match(await textOf(s.page.locator("#main .diff-notice")), /too large to show in full/);
  const files = s.page.locator("#main .diff-file");
  assert.equal(await files.count(), 5);
  const first = files.nth(0);
  assert.equal(await textOf(first.locator(".diff-file-name strong")), "app.js");
  assert.equal(await textOf(first.locator(".diff-file-dir")), "src");
  assert.equal(await textOf(first.locator(".diff-plus")), "+3");
  assert.equal(await textOf(first.locator(".diff-minus")), "-2");
  assert.equal(await files.nth(1).locator(".diff-status").textContent(), "Added");
  assert.equal(await first.getAttribute("aria-selected"), "true", "the first file is picked");
  assert.equal(await s.page.locator("#main .diff-list").getAttribute("role"), "listbox");

  assert.deepEqual(await s.page.locator("#main .diff-hunk").allTextContents(), ["@@ -3,3 +3,4 @@ function start() {", "@@ -20,2 +21,2 @@"]);
  assert.deepEqual(await paneRows(s), [
    ["3", "3", "", "one"],
    ["4", "", "-", "two"],
    ["", "4", "+", "TWO"],
    ["", "5", "+", "two and a half"],
    ["5", "6", "", "three"],
    ["20", "", "-", "gone"],
    ["", "21", "+", "<b>not html</b>"],
    ["21", "22", "", "kept"],
  ]);
  // Diff text is never HTML: the tag stays text.
  assert.equal(await s.page.locator("#main .diff-pane b").count(), 0);
});

test("clicking a file or pressing the arrows swaps the diff, and binary, hidden and cut files show one plain line", async (t) => {
  const s = await withChanges(t, DIFF);
  await openChanges(s);
  const files = s.page.locator("#main .diff-file");
  const pane = s.page.locator("#main .diff-pane");

  await files.nth(1).click();
  await pane.locator(".diff-pane-path", { hasText: "docs/new.md" }).waitFor();
  assert.deepEqual(await paneRows(s), [
    ["", "1", "+", "# New"],
    ["", "2", "+", "Hello."],
  ]);
  assert.equal(await files.nth(1).getAttribute("aria-selected"), "true");
  assert.equal(await files.nth(0).getAttribute("aria-selected"), "false");

  const plain = [
    [2, "logo.png", "Binary file: no lines to show"],
    [3, ".env", "Lines hidden: this file may hold a secret"],
    [4, "big.txt", "Too large to show in full: this file is listed only"],
  ];
  for (const [i, name, line] of plain) {
    await files.nth(i).click();
    await pane.locator(".diff-pane-path", { hasText: name }).waitFor();
    assert.equal(await textOf(pane.locator(".diff-plain")), line, name);
    assert.equal(await pane.locator(".diff-line").count(), 0, `${name} shows no lines`);
  }

  // Arrow keys on the list move the pick.
  await s.page.locator("#main .diff-list").focus();
  await s.page.keyboard.press("ArrowUp");
  await pane.locator(".diff-pane-path", { hasText: ".env" }).waitFor();
  await s.page.keyboard.press("Home");
  await pane.locator(".diff-pane-path", { hasText: "src/app.js" }).waitFor();
  assert.equal(await files.nth(0).getAttribute("aria-selected"), "true");

  // The pick survives a redraw of the same block.
  await files.nth(1).click();
  s.post({ title: "Phase 3, again" });
  await s.page.waitForFunction(() => document.getElementById("title").textContent.includes("Phase 3, again"));
  await pane.locator(".diff-pane-path", { hasText: "docs/new.md" }).waitFor();
});

test("the empty state offers Check again, which sends the __changes action", async (t) => {
  const s = await withChanges(t, "");
  await openChanges(s);
  const empty = s.page.locator("#main .diff-empty");
  assert.equal(await textOf(empty.locator(".diff-state-msg")), "Nothing has changed since this run started.");
  await empty.getByRole("button", { name: "Check again" }).click();
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code})`);
  assert.ok(got.actions.some((a) => a.i === "__changes" && a.type === "changes"), JSON.stringify(got.actions));
  assert.match(got.reply, /Changes tab/);
});

// What the person sees break: a click on a finished session that leaves the
// page waiting for an agent who has gone.
test("on a finished session Check again sends nothing and says why", async (t) => {
  const s = await withChanges(t, "");
  s.post({ finish: { headline: "Phase 3 is done", body: "7 of 7 tasks." } });
  await s.page.waitForFunction(() => document.body.textContent.includes("Phase 3 is done"));
  await openChanges(s);
  const empty = s.page.locator("#main .diff-empty");
  await empty.getByRole("button", { name: "Check again" }).click();
  await empty.locator(".diff-state-why", { hasText: "This session is finished." }).waitFor();
  assert.equal(s.wait(2).code, 10, "nothing reached the agent");
});

test("a block with an error shows the reason and a Reload button that sends the __changes action", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "implement", payload: { agent: { status: "waiting" } } });
  s.post({ docs: [{ id: "changes", title: "Changes", blocks: [{ id: "c1", error: "No snapshot was taken at the start of this run." }] }] });
  await tab(s, "Changes").click();
  const box = s.page.locator("#main .diff-error");
  await box.waitFor();
  assert.equal(await textOf(box.locator(".diff-state-msg")), "The changes could not be read: No snapshot was taken at the start of this run.");
  await box.getByRole("button", { name: "Reload the changes" }).click();
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code})`);
  assert.ok(got.actions.some((a) => a.i === "__changes" && a.type === "changes"), JSON.stringify(got.actions));

  // A stale doc is still being read again: the loading rows show.
  fs.writeFileSync(path.join(s.session, "changes.diff"), DIFF);
  s.post({ docs: [{ id: "changes", stale: true, blocks: [{ id: "c1", diff: "changes.diff" }] }] });
  await s.page.locator("#main .diff-view.is-loading .diff-skel-row").first().waitFor();
});

// What the person sees break: a long diff pushing the way to the sign-off off
// the screen, or a long line widening the page.
test("a long diff scrolls inside its own pane, the way back to the sign-off stays in view, and the added rows differ by theme", async (t) => {
  const long = Array.from({ length: 640 }, (_, i) => `+line ${i + 1} ${i === 3 ? "x".repeat(600) : ""}`);
  const text = ["diff --git a/long.txt b/long.txt", "new file mode 100644", "--- /dev/null", "+++ b/long.txt", "@@ -0,0 +1,640 @@", ...long, ""].join("\n");
  const s = await withChanges(t, text, { items: [SIGNOFF] });
  await itemCard(s.page, "signoff").waitFor();
  await openChanges(s);
  const pane = s.page.locator("#main .diff-pane");
  assert.equal(await pane.locator(".diff-line").count(), 640);

  // The pane scrolls itself; the column and the page do not grow past the window.
  const sizes = await pane.evaluate((p) => ({ inner: p.scrollHeight > p.clientHeight, page: document.documentElement.scrollWidth <= window.innerWidth }));
  assert.ok(sizes.inner, "the diff pane scrolls inside itself");
  assert.ok(sizes.page, "a long line never gives the page a sideways scroll");
  // The pane itself scrolls sideways, so its scrollbar sits at the window's
  // edge of the pane, not under the file's last line.
  assert.ok(await pane.evaluate((p) => p.scrollWidth > p.clientWidth), "the long line scrolls inside the diff pane");
  await scrollCard(pane, "end");
  const back = s.page.locator("#main .doc-head .back-home");
  assert.ok(await inViewport(s, back), "Back to Questions stays in view with the diff scrolled to its end");
  assert.ok(await inViewport(s, pane), "the whole diff pane fits in the window");

  // One click from the Changes tab, the sign-off's verdicts are on screen.
  await back.click();
  const card = itemCard(s.page, "signoff");
  await card.waitFor();
  for (const name of ["Approve this phase", "I want changes"]) {
    assert.ok(await inViewport(s, card.getByRole("button", { name })), `${name} is inside the window`);
  }

  await openChanges(s);
  const added = s.page.locator("#main .diff-line.add").first();
  await s.page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  const light = await styleOf(added, "backgroundColor");
  await s.page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const dark = await styleOf(added, "backgroundColor");
  assert.notEqual(light, dark, "the added rows take the theme's own soft color");
  assert.notEqual(light, "rgba(0, 0, 0, 0)");
});
