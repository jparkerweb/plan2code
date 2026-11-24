// Page tests for the page shell: what keeps the console page itself from
// scrolling (only its panels scroll), checked at wide and narrow window sizes.
// A change to src/web-console/public/styles/ or index.html needs only this
// file, not the whole page suites. Run with:
// npm run test:page -- scripts/test-web-console-page-layout.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession } from "./page-test-helpers.mjs";

const suite = pageSuite(test);

// A plan session on the person's turn: one text question and the agent listening.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

test("the page itself never scrolls: oversized content stays inside its own panel", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.locator("#main [data-item=\"q1\"]").first().waitFor();
  const page = await s.page.evaluate(() => {
    const big = document.createElement("div");
    big.style.cssText = "height: 5000px";
    document.querySelector(".main").append(big);
    const root = document.documentElement;
    const before = { scrollHeight: root.scrollHeight, innerHeight: innerHeight };
    scrollTo(0, 400);
    return {
      ...before,
      scrolled: scrollY,
      rootOverflow: getComputedStyle(root).overflowY,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      bodyHeight: Math.round(document.body.getBoundingClientRect().height),
    };
  });
  assert.equal(page.rootOverflow, "hidden", "the page root never scrolls");
  assert.equal(page.bodyOverflow, "hidden", "the body never scrolls");
  assert.equal(page.bodyHeight, page.innerHeight, "the body is exactly the window tall");
  assert.ok(page.scrollHeight <= page.innerHeight, "the page is never taller than the window (an absolutely placed bit in a panel stretched it)");
  assert.equal(page.scrolled, 0, "the page does not move when asked to scroll");
});

test("the one-column layout (900px and narrower) keeps its page scroll", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await s.page.setViewportSize({ width: 600, height: 700 });
  const narrow = await s.page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
  assert.equal(narrow, "visible", "its content sits under the first screen, so the lock must not apply");
});
