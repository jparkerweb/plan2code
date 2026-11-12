// Page tests for the UI prototype shell: an assembled fixture page opened from
// file:// in a real Chrome or Edge, through scripts/browser.mjs. One browser
// for the file, a fresh context per test. Run with:
// node scripts/node-test.mjs scripts/test-ui-prototype-page.mjs
//
// The page is built by the built skill's assemble (skill-script-helpers.mjs
// rebuilds skills/ first), so these cover the three shell files as shipped.
// Nothing else parses shell.js: the "no console error" test is its parse check.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, runScript, tmp } from "./skill-script-helpers.mjs";
import { launchBrowser } from "./browser.mjs";

const FIXTURES = path.join(ROOT, "scripts", "fixtures", "ui-prototype");
const POLICY = "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'";

const madeDirs = [];
let browser = null;
after(async () => {
  if (browser) await browser.close();
  for (const dir of madeDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const roundJson = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name, "round.json"), "utf8"));

/**
 * Assemble a fixture round into a temp folder and open the page from file://.
 * Waits for window.p2c and for every frame's own document to be complete with
 * the dials written on its root. Returns { page, url, requests, errors }.
 */
async function openFixture(t, name, { width = 1400, height = 900, edit, permissions } = {}) {
  const dir = tmp(`ui-page-${name}`);
  madeDirs.push(dir);
  const round = path.join(dir, "round-1");
  fs.cpSync(path.join(FIXTURES, name), round, { recursive: true });
  if (edit) edit(round);
  const r = runScript("plan2code-ui-prototype", "ui-prototype.mjs", ["assemble", "--round", round]);
  assert.equal(r.code, 0, `assemble ${name}: ${r.stdout} ${r.stderr}`);

  browser ||= await launchBrowser();
  const context = await browser.newContext({ viewport: { width, height }, ...(permissions ? { permissions } : {}) });
  t.after(() => context.close());
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on("request", (q) => requests.push(q.url()));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  const url = pathToFileURL(r.json.file).href;
  await page.goto(url);
  await page.waitForFunction(() => {
    if (!window.p2c) return false;
    return [...document.querySelectorAll("iframe.p2c-frame")].every((f) => {
      const d = f.contentDocument;
      if (!d || d.readyState !== "complete" || !d.body || !d.body.children.length) return false;
      const root = d.documentElement;
      if (!root.hasAttribute("data-p2c-kind")) return false;
      return root.getAttribute("data-p2c-kind") === "terminal" || root.style.getPropertyValue("--p2c-screen-width") !== "";
    });
  });
  return { page, url, requests, errors, file: r.json.file };
}

/** Run fn(doc, letter) inside every frame's document; returns { <letter>: result }. */
function inFrames(page, fn, arg) {
  return page.evaluate(
    ([source, a]) => {
      const run = new Function("doc", "letter", "arg", `return (${source})(doc, letter, arg);`);
      const out = {};
      for (const f of document.querySelectorAll("iframe.p2c-frame")) out[f.dataset.variant] = run(f.contentDocument, f.dataset.variant, a);
      return out;
    },
    [fn.toString(), arg]
  );
}

/** A computed style value on every frame's root (custom properties trimmed). */
const rootValue = (page, prop) => inFrames(page, (doc, _l, p) => getComputedStyle(doc.documentElement).getPropertyValue(p).trim(), prop);
const rootAttr = (page, attr) => inFrames(page, (doc, _l, a) => doc.documentElement.getAttribute(a), attr);

/** Which frames are on show: { <letter>: true|false }. */
const shown = (page) =>
  page.evaluate(() => {
    const out = {};
    for (const f of document.querySelectorAll("iframe.p2c-frame")) out[f.dataset.variant] = getComputedStyle(f).visibility === "visible";
    return out;
  });

const every = (map, value) => Object.values(map).every((v) => v === value);
const pressed = (page, dial) => page.locator(`[data-dial="${dial}"] button[aria-pressed="true"]`).textContent();
const pickChoice = (page, dial, label) => page.locator(`[data-dial="${dial}"] button`, { hasText: label }).click();

/* ----------------------------------------------------- (a) policy and reach */

test("the frames render under the policy line, and the page's script reaches each frame's root", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content"), POLICY);
  const facts = roundJson("good-screen");
  assert.equal(await page.locator("iframe.p2c-frame").count(), facts.variants.length);
  for (const sandbox of await page.locator("iframe.p2c-frame").evaluateAll((els) => els.map((e) => e.getAttribute("sandbox")))) {
    assert.equal(sandbox, "allow-same-origin");
  }
  // The variant's own rules render: the frame's body takes base.css and the dial values.
  const accents = await rootValue(page, "--p2c-accent");
  assert.ok(every(accents, facts.starts.accent), JSON.stringify(accents));
  const fonts = await inFrames(page, (doc) => getComputedStyle(doc.body).fontSize);
  assert.ok(every(fonts, `${facts.starts.textSize}px`), JSON.stringify(fonts));
  // window.p2c is the page's one handle: state and apply().
  const handle = await page.evaluate(() => ({ keys: Object.keys(window.p2c).sort(), variant: window.p2c.state.variant, apply: typeof window.p2c.apply }));
  assert.deepEqual(handle, { keys: ["apply", "state"], variant: "A", apply: "function" });
  assert.equal(await page.title(), facts.name);
  assert.equal(await page.locator("#p2c-name").textContent(), facts.name);
});

/* --------------------------------------------- (b) no network, no console error */

for (const name of ["good-screen", "good-flow", "good-terminal", "hostile-text"]) {
  test(`${name}: no request but the page itself, and no console error`, async (t) => {
    const { page, url, requests, errors } = await openFixture(t, name);
    // Move through the page a little so the handlers run too.
    await page.click("#p2c-compare");
    await page.click("#p2c-compare");
    await page.locator('[role="tab"]').last().click();
    assert.deepEqual(errors, []);
    assert.deepEqual(
      requests.filter((u) => u !== url),
      [],
      "the page loaded nothing else"
    );
  });
}

/* ----------------------------------------------------------------- (c) tabs */

test("one tab per variant; a click or an arrow key shows only that frame, kept in step with the panel's pick", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const facts = roundJson("good-screen");
  const tabs = page.locator('#p2c-tabs [role="tab"]');
  assert.equal(await tabs.count(), facts.variants.length);
  for (const [i, v] of facts.variants.entries()) assert.equal((await tabs.nth(i).textContent()).replace(/\s+/g, " ").trim(), `${v.letter}${v.name}`);
  assert.deepEqual(await shown(page), { A: true, B: false, C: false });

  await tabs.nth(1).click();
  assert.deepEqual(await shown(page), { A: false, B: true, C: false });
  assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
  assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "false");
  assert.equal(await pressed(page, "variant"), "B");
  assert.equal(await page.evaluate(() => window.p2c.state.variant), "B");

  await page.keyboard.press("ArrowRight");
  assert.deepEqual(await shown(page), { A: false, B: false, C: true });
  assert.equal(await page.evaluate(() => document.activeElement.id), "p2c-tab-C");
  await page.keyboard.press("ArrowRight");
  assert.deepEqual(await shown(page), { A: true, B: false, C: false }, "the arrow wraps around");
  await page.keyboard.press("ArrowLeft");
  assert.deepEqual(await shown(page), { A: false, B: false, C: true });

  // The panel's pick moves the tabs too.
  await pickChoice(page, "variant", "B");
  assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
  assert.deepEqual(await shown(page), { A: false, B: true, C: false });
});

/* ------------------------------------------------------------ (d) every dial */

test("each core dial writes its value on every frame's root, and the tool's own look stays put", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const toolLook = () => page.evaluate(() => [document.body, document.getElementById("p2c-bar"), document.getElementById("p2c-panel")].map((e) => `${getComputedStyle(e).backgroundColor} ${getComputedStyle(e).fontFamily} ${getComputedStyle(e).fontSize}`));
  const before = await toolLook();

  await page.locator("#p2c-dial-theme").check();
  assert.ok(every(await rootAttr(page, "data-p2c-theme"), "dark"));
  assert.ok(every(await inFrames(page, (doc) => getComputedStyle(doc.documentElement).colorScheme), "dark"));

  await page.locator("#p2c-dial-accent").fill("#ff0000");
  assert.ok(every(await rootValue(page, "--p2c-accent"), "#ff0000"));
  const button = await inFrames(page, (doc) => (doc.querySelector(".inv button") ? getComputedStyle(doc.querySelector(".inv button")).backgroundColor : null));
  assert.equal(button.A, "rgb(255, 0, 0)", "a variant's own rule follows the accent");

  await page.locator("#p2c-dial-neutral").fill("#00aa00");
  assert.ok(every(await rootValue(page, "--p2c-neutral"), "#00aa00"));

  await page.locator("#p2c-dial-fontSet").selectOption("Slab Serif");
  const families = await inFrames(page, (doc) => getComputedStyle(doc.body).fontFamily);
  assert.ok(Object.values(families).every((f) => f.startsWith("Rockwell")), JSON.stringify(families));
  assert.equal(await page.locator('#p2c-dial-fontSet option[value="App font"]').count(), 0, "no App font without appFont in the round facts");

  await page.locator("#p2c-dial-textSize").fill("20");
  assert.ok(every(await inFrames(page, (doc) => getComputedStyle(doc.body).fontSize), "20px"));

  await page.locator("#p2c-dial-space").fill("1.5");
  assert.ok(every(await rootValue(page, "--p2c-space"), "1.5"));
  const pad = await inFrames(page, (doc) => (doc.querySelector(".inv") ? getComputedStyle(doc.querySelector(".inv")).paddingTop : null));
  assert.equal(pad.A, "36px", "--p2c-space-5 follows the spacing dial");

  await page.locator("#p2c-dial-radius").fill("20");
  assert.ok(every(await rootValue(page, "--p2c-radius"), "20px"));

  await pickChoice(page, "state", "Loading");
  assert.ok(every(await rootAttr(page, "data-p2c-state"), "loading"));
  await pickChoice(page, "length", "Very long");
  assert.ok(every(await rootAttr(page, "data-p2c-length"), "long"));

  await pickChoice(page, "screen", "Tablet 820");
  assert.ok(every(await rootValue(page, "--p2c-screen-width"), "820px"));

  const dials = await page.evaluate(() => Object.fromEntries(Object.entries(window.p2c.state.dials).map(([k, d]) => [k, [d.value, d.moved]])));
  assert.deepEqual(dials, {
    variant: ["A", false],
    screen: ["Tablet 820", true],
    theme: ["dark", true],
    accent: ["#ff0000", true],
    neutral: ["#00aa00", true],
    fontSet: ["Slab Serif", true],
    textSize: [20, true],
    space: [1.5, true],
    radius: [20, true],
    state: ["loading", true],
    length: ["long", true],
    "x-shadows": ["soft", false],
    "x-columns": [2, false],
    "x-dividers": [true, false],
  });
  assert.deepEqual(await toolLook(), before, "no dial touches the tool's own look");

  // The panel holds the dials in the planned order, the extras after them.
  const order = await page.locator("#p2c-panel-body [data-dial]").evaluateAll((rows) => rows.map((r) => r.dataset.dial));
  assert.deepEqual(order, ["variant", "screen", "theme", "accent", "neutral", "fontSet", "textSize", "space", "radius", "state", "length", "x-shadows", "x-columns", "x-dividers"]);
});

test("App font is offered only when the round facts say appFont, and writes the app font value", async (t) => {
  const dir = tmp("ui-page-appfont");
  madeDirs.push(dir);
  const src = path.join(dir, "good-app");
  fs.cpSync(path.join(FIXTURES, "good-screen"), src, { recursive: true });
  // The round facts are the page's own JSON: set appFont there after assembling.
  const round = path.join(dir, "round-1");
  fs.cpSync(src, round, { recursive: true });
  const r = runScript("plan2code-ui-prototype", "ui-prototype.mjs", ["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  // assemble writes "appFont":false itself when no font file was embedded, so
  // flip that key rather than adding a second one (the later key would win).
  const before = fs.readFileSync(r.json.file, "utf8");
  assert.match(before, /"appFont":false/, "the round facts carry appFont");
  const html = before.replace('"appFont":false', '"appFont":true');
  fs.writeFileSync(r.json.file, html);

  browser ||= await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(pathToFileURL(r.json.file).href);
  await page.waitForFunction(() => window.p2c);
  await page.locator("#p2c-dial-fontSet").selectOption("App font");
  const value = await page.evaluate(() => document.getElementById("p2c-frame-A").contentDocument.documentElement.style.getPropertyValue("--p2c-font"));
  assert.equal(value, "var(--p2c-font-set-app)");
});

/* ------------------------------------------------------------ (e) screen size */

test("Screen size: a variant's @media rule sees the chosen width, not the window's", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  await page.locator('#p2c-tabs [role="tab"]').nth(1).click();
  const tracks = async () => (await inFrames(page, (doc) => getComputedStyle(doc.querySelector(".split") || doc.body).gridTemplateColumns.split(" ").length)).B;
  const innerWidth = async () => page.evaluate(() => document.getElementById("p2c-frame-B").contentWindow.innerWidth);

  assert.equal(await innerWidth(), 1280);
  assert.equal(await tracks(), 2, "Desktop: the two-column rule");
  await pickChoice(page, "screen", "Phone 390");
  assert.equal(await innerWidth(), 390);
  assert.equal(await tracks(), 1, "Phone: the @media (max-width: 500px) rule matches");
  await pickChoice(page, "screen", "Tablet 820");
  assert.equal(await innerWidth(), 820);
  assert.equal(await tracks(), 2);
  assert.equal(await page.locator('[data-dial="screen"] .tool-scale').textContent(), "", "no scale shown while the frame fits");
});

test("Screen size: a frame wider than the stage is scaled down to fit, and the scale is shown", async (t) => {
  const { page } = await openFixture(t, "good-screen", { width: 1000, height: 800 });
  const fit = () =>
    page.evaluate(() => {
      const stage = document.getElementById("p2c-stage").getBoundingClientRect();
      const f = document.getElementById("p2c-frame-A").getBoundingClientRect();
      return { inside: f.left >= stage.left && f.right <= stage.right, inner: document.getElementById("p2c-frame-A").contentWindow.innerWidth };
    });
  assert.deepEqual(await fit(), { inside: true, inner: 1280 });
  assert.match(await page.locator('[data-dial="screen"] .tool-scale').textContent(), /^\d+%$/);
  await pickChoice(page, "screen", "Phone 390");
  assert.deepEqual(await fit(), { inside: true, inner: 390 });
  assert.equal(await page.locator('[data-dial="screen"] .tool-scale').textContent(), "");
});

/* ------------------------------------------------------- (f) states and length */

test("the States and Content length dials show exactly one state's parts and one length's text", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const visibleMarks = (attr) =>
    inFrames(
      page,
      (doc, _l, a) => {
        const seen = [];
        for (const el of doc.querySelectorAll(`[${a}]`)) if (getComputedStyle(el).display !== "none") seen.push(el.getAttribute(a));
        return seen;
      },
      attr
    );
  for (const [label, value] of [["Ready", "ready"], ["Empty", "empty"], ["Loading", "loading"], ["Error", "error"]]) {
    await pickChoice(page, "state", label);
    for (const [letter, marks] of Object.entries(await visibleMarks("data-p2c-when"))) {
      assert.ok(marks.length > 0, `${letter} shows a ${value} part`);
      assert.ok(marks.every((m) => m.split(" ").includes(value)), `${letter} at ${value}: ${marks.join(" | ")}`);
    }
  }
  for (const [label, value] of [["Short", "short"], ["Typical", "typical"], ["Very long", "long"]]) {
    await pickChoice(page, "length", label);
    for (const [letter, marks] of Object.entries(await visibleMarks("data-p2c-text"))) {
      assert.ok(marks.length > 0, `${letter} shows ${value} text`);
      assert.ok(marks.every((m) => m.split(" ").includes(value)), `${letter} at ${value}: ${marks.join(" | ")}`);
    }
  }
});

/* ----------------------------------------------------------- (g) Compare all */

test("Compare all shows every frame in a row, a click picks one, and a dial change reaches all", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const ids = await page.locator("iframe.p2c-frame").evaluateAll((els) => els.map((e) => e.id));
  await page.click("#p2c-compare");
  assert.equal(await page.locator("#p2c-compare").getAttribute("aria-pressed"), "true");
  assert.deepEqual(await shown(page), { A: true, B: true, C: true });
  const row = await page.evaluate(() => {
    const stage = document.getElementById("p2c-stage").getBoundingClientRect();
    const boxes = [...document.querySelectorAll("iframe.p2c-frame")].map((f) => f.getBoundingClientRect());
    const labels = [...document.querySelectorAll(".tool-label")].map((l) => ({ text: l.textContent, shown: !l.hidden, bottom: l.getBoundingClientRect().bottom }));
    return { stage: [stage.left, stage.right], boxes: boxes.map((b) => [b.left, b.right, b.top]), labels };
  });
  for (let i = 0; i < row.boxes.length; i++) {
    const [left, right, top] = row.boxes[i];
    assert.ok(left >= row.stage[0] && right <= row.stage[1], `frame ${i} fits the stage width`);
    if (i) assert.ok(left > row.boxes[i - 1][1], `frame ${i} sits right of the one before`);
    assert.ok(row.labels[i].shown && row.labels[i].bottom <= top + 1, `frame ${i} has its label above it`);
  }
  assert.deepEqual(
    row.labels.map((l) => l.text),
    roundJson("good-screen").variants.map((v) => `${v.letter}${v.name}`)
  );

  // A click on the third frame makes it current without leaving the row.
  const box = await page.locator("#p2c-frame-C").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await page.locator("#p2c-tab-C").getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#p2c-compare").getAttribute("aria-pressed"), "true");
  assert.deepEqual(await shown(page), { A: true, B: true, C: true });

  await page.locator("#p2c-dial-radius").fill("3");
  assert.ok(every(await rootValue(page, "--p2c-radius"), "3px"));

  await page.click("#p2c-compare");
  assert.deepEqual(await shown(page), { A: false, B: false, C: true }, "back to the single view of the current variant");
  assert.deepEqual(await page.locator("iframe.p2c-frame").evaluateAll((els) => els.map((e) => e.id)), ids, "the same frames, never re-created");
  // A frame moved or re-created would reload and lose its written values.
  assert.ok(every(await rootValue(page, "--p2c-radius"), "3px"));
});

/* ----------------------------------------------------------------- (h) panel */

test("the panel drags, never covers the top bar, hides to the Dials tab where it was and returns", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const panelBox = () => page.locator("#p2c-panel").boundingBox();
  const grip = async () => {
    const b = await page.locator("#p2c-panel-title").boundingBox();
    return { x: b.x + 10, y: b.y + b.height / 2 };
  };
  const dragBy = async (dx, dy) => {
    const g = await grip();
    await page.mouse.move(g.x, g.y);
    await page.mouse.down();
    await page.mouse.move(g.x + dx / 2, g.y + dy / 2);
    await page.mouse.move(g.x + dx, g.y + dy);
    await page.mouse.up();
  };

  const start = await panelBox();
  assert.ok(start.width <= 320, "the panel is at most 320px wide");
  await dragBy(300, 200);
  const moved = await panelBox();
  assert.ok(Math.abs(moved.x - start.x - 300) < 2 && Math.abs(moved.y - start.y - 200) < 2, JSON.stringify({ start, moved }));

  const barBottom = (await page.locator("#p2c-bar").boundingBox()).height;
  await dragBy(0, -2000);
  assert.ok((await panelBox()).y >= barBottom - 0.5, "the panel stops under the top bar");
  await dragBy(5000, 5000);
  const corner = await panelBox();
  const view = page.viewportSize();
  const handle = await page.locator("#p2c-panel-handle").boundingBox();
  assert.ok(corner.x + corner.width <= view.width + 0.5 && handle.y + handle.height <= view.height + 0.5, "the handle stays on screen");

  await dragBy(-400, -300);
  const before = await panelBox();
  await page.click("#p2c-hide");
  assert.equal(await page.locator("#p2c-panel").isVisible(), false);
  const tab = await page.locator("#p2c-dials-tab").boundingBox();
  assert.ok(tab && Math.abs(tab.x - before.x) < 1 && Math.abs(tab.y - before.y) < 1, "the Dials tab sits where the panel was");
  await page.click("#p2c-dials-tab");
  assert.equal(await page.locator("#p2c-dials-tab").isVisible(), false);
  const back = await panelBox();
  assert.ok(Math.abs(back.x - before.x) < 1 && Math.abs(back.y - before.y) < 1, "the panel returns where it was");
});

/* ------------------------------------------------------------------ (i) flow */

test("a flow lays each variant's screens in one row with their step labels, and the stage scrolls sideways", async (t) => {
  const { page } = await openFixture(t, "good-flow", { width: 1000, height: 800 });
  const facts = roundJson("good-flow");
  const steps = () =>
    inFrames(page, (doc) =>
      [...doc.querySelectorAll("[data-p2c-step]")].map((s) => {
        const r = s.getBoundingClientRect();
        return { label: getComputedStyle(s, "::before").content, top: r.top, left: r.left, right: r.right, width: r.width, viewport: doc.defaultView.innerWidth };
      })
    );
  const check = (all, width) => {
    for (const [letter, row] of Object.entries(all)) {
      assert.deepEqual(
        row.map((s) => s.label),
        ['"1. Account"', '"2. Team"', '"3. Done"'],
        letter
      );
      for (let i = 0; i < row.length; i++) {
        assert.equal(Math.round(row[i].width), width, `${letter} step ${i} is one screen wide`);
        assert.equal(row[i].top, row[0].top, `${letter} step ${i} is in the row`);
        if (i) assert.ok(row[i].left >= row[i - 1].right, `${letter} step ${i} follows the one before`);
      }
      assert.ok(row[row.length - 1].right <= row[0].viewport, `${letter}: the frame holds the whole row`);
    }
  };
  assert.equal(facts.starts.screen, "Phone 390");
  check(await steps(), 390);
  const scrolls = await page.evaluate(() => {
    const s = document.getElementById("p2c-stage");
    return s.scrollWidth > s.clientWidth;
  });
  assert.ok(scrolls, "the stage scrolls sideways");

  await pickChoice(page, "screen", "Tablet 820");
  check(await steps(), 820);
  await page.locator("#p2c-dial-space").fill("0.75");
  check(await steps(), 820);
});

test("a flow whose variants differ in steps scrolls only as far as the current row, and a variant's own row gap is measured", async (t) => {
  // Variant B gets a fourth step; variant A sets its own, wider gap between screens.
  const edit = (round) => {
    const b = path.join(round, "variant-b.html");
    fs.writeFileSync(b, fs.readFileSync(b, "utf8") + '\n<section class="step-b" data-p2c-step="4. Tour">\n  <h2>Take the tour</h2>\n</section>\n');
    const a = path.join(round, "variant-a.html");
    fs.writeFileSync(a, fs.readFileSync(a, "utf8").replace("<style>", '<style>\n  :root[data-p2c-kind="flow"] body { gap: 60px; }'));
  };
  const { page } = await openFixture(t, "good-flow", { width: 1000, height: 800, edit });
  const reach = () =>
    page.evaluate(() => {
      const stage = document.getElementById("p2c-stage");
      const current = document.querySelector("iframe.tool-current-frame");
      const doc = current.contentDocument;
      const steps = [...doc.querySelectorAll("[data-p2c-step]")];
      const last = steps[steps.length - 1].getBoundingClientRect();
      const padRight = parseFloat(getComputedStyle(doc.body).paddingRight);
      return { scroll: stage.scrollWidth, frameRight: current.offsetLeft + current.offsetWidth, steps: steps.length, spare: doc.defaultView.innerWidth - last.right - padRight };
    });
  const a = await reach();
  assert.equal(a.steps, 3);
  assert.ok(a.scroll <= a.frameRight + 16 + 1, `the stage scrolls no further than A's row: ${JSON.stringify(a)}`);
  assert.ok(Math.abs(a.spare) <= 1, `A's frame is exactly as wide as its row with its own gap: ${JSON.stringify(a)}`);
  await page.locator("#p2c-tab-B").click();
  const b = await reach();
  assert.equal(b.steps, 4);
  assert.ok(b.scroll > a.scroll, "B's longer row widens the scroll area once it is current");
  assert.ok(Math.abs(b.spare) <= 1, `B's frame is exactly as wide as its row: ${JSON.stringify(b)}`);
});

test("after the window shrinks, the frame is centered and scaled to the new stage, and a hidden panel's Dials tab stays on screen", async (t) => {
  const { page } = await openFixture(t, "good-screen", { width: 1400, height: 900 });
  // Hide the panel near the right edge of the wide window.
  const title = await page.locator("#p2c-panel-title").boundingBox();
  await page.mouse.move(title.x + 10, title.y + title.height / 2);
  await page.mouse.down();
  await page.mouse.move(title.x + 600, title.y + 400);
  await page.mouse.move(title.x + 2000, title.y + 600);
  await page.mouse.up();
  await page.click("#p2c-hide");

  await page.setViewportSize({ width: 960, height: 600 });
  // Wait for the resize to be laid out: the scale read-out appears once the frame no longer fits.
  await page.waitForFunction(() => document.querySelector('[data-dial="screen"] .tool-scale').textContent !== "");
  const fit = await page.evaluate(() => {
    const stage = document.getElementById("p2c-stage");
    const s = stage.getBoundingClientRect();
    const f = document.getElementById("p2c-frame-A").getBoundingClientRect();
    return { leftGap: f.left - s.left, rightGap: s.left + stage.clientWidth - f.right, scale: document.querySelector('[data-dial="screen"] .tool-scale').textContent, expected: Math.round(((stage.clientWidth - 32) / 1282) * 100) + "%", vbar: stage.clientWidth < s.width };
  });
  assert.ok(Math.abs(fit.leftGap - fit.rightGap) <= 1, `centered: ${JSON.stringify(fit)}`);
  assert.equal(fit.scale, fit.expected);
  assert.equal(fit.vbar, false, "no stray scroll bar after the shrink");

  const tab = await page.locator("#p2c-dials-tab").boundingBox();
  assert.ok(tab.x >= 0 && tab.x + tab.width <= 960 && tab.y + tab.height <= 600, `the Dials tab is on screen: ${JSON.stringify(tab)}`);
  await page.click("#p2c-dials-tab");
  const panel = await page.locator("#p2c-panel").boundingBox();
  assert.ok(panel.x >= 0 && panel.x + panel.width <= 960, `the panel returns on screen: ${JSON.stringify(panel)}`);
});

/* ---------------------------------------------------- Phase 3: the helpers */

const dialsOf = (page) => page.evaluate(() => Object.fromEntries(Object.entries(window.p2c.state.dials).map(([k, d]) => [k, d.value])));
const movedOf = (page) => page.evaluate(() => Object.fromEntries(Object.entries(window.p2c.state.dials).map(([k, d]) => [k, d.moved])));
const presetOf = (page) => page.evaluate(() => window.p2c.state.preset);
const resetShown = (page, dial) => page.locator(`[data-dial="${dial}"] .tool-reset-button`).isVisible();
const blockText = (page) => page.locator("#p2c-block").inputValue();
const expectedBlock = (name, file) => fs.readFileSync(path.join(FIXTURES, name, "expected-block.txt"), "utf8").replace(/\r?\n$/, "").replace("<FILE>", file);

/** Every look value on every frame's root, for "nothing else moved" checks. */
const looks = async (page) => {
  const out = {};
  for (const prop of ["--p2c-accent", "--p2c-neutral", "--p2c-font", "--p2c-text-size", "--p2c-space", "--p2c-radius", "--p2c-screen-width"]) out[prop] = await rootValue(page, prop);
  for (const attr of ["data-p2c-theme", "data-p2c-state", "data-p2c-length", "data-p2c-x-shadows", "data-p2c-x-columns", "data-p2c-x-dividers"]) out[attr] = await rootAttr(page, attr);
  return out;
};

/** An edit for openFixture: one more extra in the temp copy's round.json. */
const withExtra = (extra) => (round) => {
  const file = path.join(round, "round.json");
  const facts = JSON.parse(fs.readFileSync(file, "utf8"));
  facts.extras.push(extra);
  fs.writeFileSync(file, JSON.stringify(facts, null, 2));
};
const SPINNER = { name: "spinner", label: "Spinner", type: "pick", choices: ["dots", "line", "none"], start: "dots", look: true };
const PROGRESS = { name: "progress", label: "Progress bar", type: "toggle", start: true, look: false };

/* -------------------------------------------------------------- (a) presets */

test("each preset sets only spacing, text size and corners on every frame, and a hand move keeps the preset", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const facts = roundJson("good-screen");
  const own = Object.fromEntries(facts.variants.map((v) => [v.letter, `${v.starts.radius}px`]));
  const before = await looks(page);
  const order = await page.locator("#p2c-panel-body > *").evaluateAll((els) => els.map((e) => e.className));
  assert.deepEqual(order, ["tool-presets", "tool-dials", "tool-extras", "tool-panel-foot"], "presets on top, then the dials, Extras and the foot");
  assert.deepEqual(await page.locator(".tool-presets button").allTextContents(), ["Compact", "Balanced", "Airy", "Bold"]);
  assert.deepEqual(await page.locator(".tool-panel-foot button").allTextContents(), ["Reset everything", "Surprise me"]);

  const triples = { Compact: ["0.75", "14px", "4px"], Airy: ["1.5", "17px", "12px"], Bold: ["1.25", "20px", "16px"] };
  for (const [name, [space, size, radius]] of Object.entries(triples)) {
    await page.click(`#p2c-preset-${name.toLowerCase()}`);
    assert.ok(every(await rootValue(page, "--p2c-space"), space), `${name} spacing`);
    assert.ok(every(await rootValue(page, "--p2c-text-size"), size), `${name} text size`);
    assert.ok(every(await rootValue(page, "--p2c-radius"), radius), `${name} corners`);
    const now = await looks(page);
    for (const key of Object.keys(before)) {
      if (!["--p2c-space", "--p2c-text-size", "--p2c-radius"].includes(key)) assert.deepEqual(now[key], before[key], `${name} leaves ${key} alone`);
    }
    assert.equal(await presetOf(page), name);
    assert.equal(await page.locator(`#p2c-preset-${name.toLowerCase()}`).getAttribute("aria-pressed"), "true");
  }
  // Balanced is the round's own starts: the freed-up corners go back to each variant's own.
  await page.click("#p2c-preset-balanced");
  assert.ok(every(await rootValue(page, "--p2c-space"), "1"));
  assert.ok(every(await rootValue(page, "--p2c-text-size"), "16px"));
  assert.deepEqual(await rootValue(page, "--p2c-radius"), own);
  const moved = await movedOf(page);
  assert.deepEqual([moved.space, moved.textSize, moved.radius], [false, false, false]);
  assert.equal(await presetOf(page), "Balanced");

  await page.click("#p2c-preset-compact");
  await page.locator("#p2c-dial-textSize").fill("18");
  assert.equal(await presetOf(page), "Compact", "a hand move keeps the preset last clicked");
});

/* ---------------------------------------------------------------- (b) resets */

test("a moved dial shows its reset, the reset restores the start, and Reset everything restores all but the note", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const starts = await dialsOf(page);
  assert.equal(await resetShown(page, "textSize"), false, "no reset while the dial is at its start");
  await page.locator("#p2c-dial-textSize").fill("20");
  assert.equal(await resetShown(page, "textSize"), true);
  await page.locator('[data-dial="textSize"] .tool-reset-button').click();
  assert.equal((await dialsOf(page)).textSize, starts.textSize);
  assert.equal(await page.locator("#p2c-dial-textSize").inputValue(), String(starts.textSize), "the control shows the start again");
  assert.ok(every(await rootValue(page, "--p2c-text-size"), "16px"));
  assert.equal(await resetShown(page, "textSize"), false);

  await page.click("#p2c-preset-airy");
  await page.locator("#p2c-dial-theme").check();
  await page.locator("#p2c-dial-accent").fill("#ff0000");
  await pickChoice(page, "state", "Error");
  await pickChoice(page, "x-shadows", "strong");
  await page.locator("#p2c-tab-B").click();
  await page.click("#p2c-copy");
  await page.locator("#p2c-note").fill("keep this");
  assert.equal(await resetShown(page, "accent"), true);
  assert.equal(await page.locator('[data-dial="variant"] .tool-reset-button').count(), 0, "the variant pick has no reset");

  await page.click("#p2c-reset-all");
  const after = await dialsOf(page);
  assert.deepEqual({ ...after, variant: starts.variant, radius: starts.radius }, starts, "every dial back to its start");
  assert.equal(after.variant, "B", "Reset everything keeps the chosen variant");
  assert.equal(after.radius, 10, "the freed-up corners show B's own start");
  assert.ok(Object.entries(await movedOf(page)).every(([k, m]) => k === "variant" || m === false));
  assert.equal(await presetOf(page), null);
  assert.equal(await page.locator("#p2c-note").inputValue(), "keep this", "the Note box is left alone");
  assert.equal(await page.locator(".tool-reset-button:visible").count(), 0);
  assert.ok(every(await rootAttr(page, "data-p2c-theme"), "light"));
});

/* ------------------------------------------------------- (c) freed-up items */

test("a freed-up dial starts from each variant's own value, applies to all once moved, and its reset gives each its own back", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  const facts = roundJson("good-screen");
  assert.deepEqual(facts.freed, ["components"]);
  const own = Object.fromEntries(facts.variants.map((v) => [v.letter, `${v.starts.radius}px`]));
  const tag = page.locator('[data-dial="radius"] .tool-own');

  assert.deepEqual(await rootValue(page, "--p2c-radius"), own, "each frame holds its own variant's corners");
  assert.equal(await tag.isVisible(), true);
  assert.equal(await tag.textContent(), "each variant's own");
  assert.equal(await page.locator('[data-dial="accent"] .tool-own').count(), 0, "a carried-over item has no tag");
  assert.equal(await page.locator("#p2c-dial-radius").inputValue(), "4", "the control shows the current variant's value");
  await page.locator("#p2c-tab-C").click();
  assert.equal(await page.locator("#p2c-dial-radius").inputValue(), "16", "and follows the selected tab");

  await page.locator("#p2c-dial-radius").fill("20");
  assert.ok(every(await rootValue(page, "--p2c-radius"), "20px"), "once moved, one value on every frame");
  assert.equal(await tag.isVisible(), false);
  await page.locator("#p2c-tab-A").click();
  assert.equal(await page.locator("#p2c-dial-radius").inputValue(), "20");

  await page.locator('[data-dial="radius"] .tool-reset-button').click();
  assert.deepEqual(await rootValue(page, "--p2c-radius"), own, "the reset gives each variant its own back");
  assert.equal(await tag.isVisible(), true);
  assert.equal(await page.locator("#p2c-dial-radius").inputValue(), "4");
});

/* ----------------------------------------------------------------- (d) extras */

test("each extra control type writes its --p2c-x- value on every frame, and the Extras group folds", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  assert.ok(every(await rootValue(page, "--p2c-x-shadows"), "soft"));
  assert.ok(every(await rootValue(page, "--p2c-x-columns"), "2"));
  assert.ok(every(await rootValue(page, "--p2c-x-dividers"), "1"));

  await pickChoice(page, "x-shadows", "strong");
  assert.ok(every(await rootValue(page, "--p2c-x-shadows"), "strong"));
  assert.ok(every(await rootAttr(page, "data-p2c-x-shadows"), "strong"));
  await page.locator("#p2c-dial-x-columns").fill("3");
  assert.ok(every(await rootValue(page, "--p2c-x-columns"), "3"));
  assert.ok(every(await rootAttr(page, "data-p2c-x-columns"), "3"));
  await page.locator("#p2c-dial-x-dividers").uncheck();
  assert.ok(every(await rootValue(page, "--p2c-x-dividers"), "0"));
  assert.ok(every(await rootAttr(page, "data-p2c-x-dividers"), "off"));
  assert.equal(await resetShown(page, "x-columns"), true, "extras take part in resets");

  const extras = page.locator("#p2c-extras");
  assert.equal(await extras.evaluate((d) => d.open), true, "open to start");
  await page.locator("#p2c-extras > summary").click();
  assert.equal(await extras.evaluate((d) => d.open), false);
  assert.equal(await page.locator('[data-dial="x-shadows"]').isVisible(), false, "the group folds");
  await page.locator("#p2c-extras > summary").click();
  assert.equal(await page.locator('[data-dial="x-shadows"]').isVisible(), true);

  // A round with no extras has no group.
  const { page: flow } = await openFixture(t, "good-flow");
  assert.equal(await flow.locator("#p2c-extras").isVisible(), false);
});

/* ------------------------------------------------------------- (e) Surprise me */

test("with the random source fixed, Surprise me moves only the look dials and the look extras", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  await page.click("#p2c-preset-airy");
  await page.locator("#p2c-tab-B").click();
  await pickChoice(page, "screen", "Tablet 820");
  const before = await dialsOf(page);
  await page.evaluate(() => {
    window.p2c.random = () => 0.7;
  });
  await page.click("#p2c-surprise");
  const after = await dialsOf(page);
  for (const id of ["variant", "screen", "theme", "state", "length", "x-columns"]) assert.deepEqual(after[id], before[id], `${id} is not a look`);
  for (const id of ["accent", "neutral", "fontSet", "textSize", "space", "radius", "x-shadows", "x-dividers"]) assert.notDeepEqual(after[id], before[id], `${id} moved`);
  assert.deepEqual(
    [after.fontSet, after.textSize, after.space, after.radius, after["x-shadows"], after["x-dividers"]],
    ["Rounded Sans", 19, 1.25, 17, "strong", false]
  );
  assert.match(after.accent, /^#[0-9a-f]{6}$/);
  assert.match(after.neutral, /^#[0-9a-f]{6}$/);
  assert.equal(await presetOf(page), null, "Surprise me clears the preset");
  assert.ok(every(await rootValue(page, "--p2c-radius"), "17px"), "one value on every frame, the freed-up corners too");

  const { page: term } = await openFixture(t, "good-terminal", { edit: withExtra(SPINNER) });
  const tBefore = await dialsOf(term);
  await term.evaluate(() => {
    window.p2c.random = () => 0.7;
  });
  await term.click("#p2c-surprise");
  const tAfter = await dialsOf(term);
  const rest = (d) => ({ ...d, palette: 0, density: 0, "x-spinner": 0 });
  assert.deepEqual(rest(tAfter), rest(tBefore), "only the palette, density and look extras move");
  assert.deepEqual([tAfter.palette, tAfter.density, tAfter["x-spinner"]], ["Phosphor", 1.7, "none"]);
});

/* ------------------------------------------------------------ (f) the block */

/** The clipboard's text, line ends as LF: Chrome on Windows writes CRLF there. */
const clipboardText = async (page) => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");

/** Wait for the Copy status line, then return it. */
async function copyStatus(page) {
  await page.waitForFunction(() => document.getElementById("p2c-copy-status").textContent !== "");
  return page.locator("#p2c-copy-status").textContent();
}

// good-screen moves: Airy, tab B, Theme dark, Accent #d9480f, Shadows strong,
// Note "header from A" / "with these cards" on two lines.
test("good-screen: the copied block equals the stored text after the scripted moves, in the box and on the clipboard", async (t) => {
  const { page, file } = await openFixture(t, "good-screen", { permissions: ["clipboard-read", "clipboard-write"] });
  await page.click("#p2c-preset-airy");
  await page.locator("#p2c-tab-B").click();
  await page.locator("#p2c-dial-theme").check();
  await page.locator("#p2c-dial-accent").fill("#d9480f");
  await pickChoice(page, "x-shadows", "strong");
  await page.click("#p2c-copy");
  assert.equal(await page.locator("#p2c-copy-pop").isVisible(), true, "Copy opens the popover");
  await page.locator("#p2c-note").fill("header from A\nwith these cards");
  await page.evaluate(() => {
    document.getElementById("p2c-copy-status").textContent = "";
  });
  await page.click("#p2c-copy-block");
  const expected = expectedBlock("good-screen", file);
  assert.equal(await blockText(page), expected);
  assert.equal(await copyStatus(page), "Copied. Paste it into the conversation.");
  assert.equal(await clipboardText(page), expected);
  assert.equal(await page.locator("#p2c-copy-pop").isVisible(), true, "the popover stays open");
  assert.equal(await page.locator("#p2c-block").getAttribute("readonly"), "");
});

// good-flow moves: Compact, Screen size Tablet 820, State Empty, an added
// Progress bar extra turned off, Note "keep the rail".
test("good-flow: the copied block equals the stored text after the scripted moves", async (t) => {
  const { page, file } = await openFixture(t, "good-flow", { edit: withExtra(PROGRESS), permissions: ["clipboard-read", "clipboard-write"] });
  await page.click("#p2c-preset-compact");
  await pickChoice(page, "screen", "Tablet 820");
  await pickChoice(page, "state", "Empty");
  await page.locator("#p2c-dial-x-progress").uncheck();
  await page.click("#p2c-copy");
  await page.locator("#p2c-note").fill("keep the rail");
  await page.click("#p2c-copy-block");
  const expected = expectedBlock("good-flow", file);
  assert.equal(await blockText(page), expected);
  await copyStatus(page);
  assert.equal(await clipboardText(page), expected);
});

// good-terminal moves: Bold, Window size 80x24, Palette Ocean, an added
// Spinner extra set to line, Note "fewer lines while it runs".
test("good-terminal: the copied block equals the stored text after the scripted moves", async (t) => {
  const { page, file } = await openFixture(t, "good-terminal", { edit: withExtra(SPINNER), permissions: ["clipboard-read", "clipboard-write"] });
  await page.click("#p2c-preset-bold");
  await pickChoice(page, "window", "80x24");
  await pickChoice(page, "palette", "Ocean");
  await pickChoice(page, "x-spinner", "line");
  await page.click("#p2c-copy");
  await page.locator("#p2c-note").fill("fewer lines while it runs");
  await page.click("#p2c-copy-block");
  const expected = expectedBlock("good-terminal", file);
  assert.equal(await blockText(page), expected);
  await copyStatus(page);
  assert.equal(await clipboardText(page), expected);
});

test("with the clipboard refused, Copy says to select the text, and the block stays visible", async (t) => {
  const { page } = await openFixture(t, "good-screen");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
    document.execCommand = () => false;
  });
  await page.click("#p2c-copy");
  assert.equal(await copyStatus(page), "Select the text above and copy it.");
  assert.equal(await page.locator("#p2c-block").isVisible(), true);
  assert.match(await blockText(page), /^Plan2Code UI prototype choice\n/);
});

/* ------------------------------------------------- (g) nothing moved, no marks */

for (const name of ["good-screen", "good-flow", "good-terminal"]) {
  test(`${name}: the block with nothing moved has no change marks, no Preset and no Note line`, async (t) => {
    const { page, file } = await openFixture(t, name);
    await page.click("#p2c-copy");
    const block = await blockText(page);
    assert.doesNotMatch(block, /changed from/);
    assert.doesNotMatch(block, /^Preset:/m);
    assert.doesNotMatch(block, /^Note:/m);
    assert.ok(block.split("\n").includes(`File: ${file}`), "the File line names the page itself");
    assert.equal(/^Direction:/m.test(block), roundJson(name).direction !== "", "a Direction line only when the round has one");
  });
}

/* --------------------------------------------------------------- (h) terminal */

test("a terminal shows window, palette and density in place of the screen dials, and a window size change resizes the frame", async (t) => {
  const { page } = await openFixture(t, "good-terminal");
  const dials = await page.locator("#p2c-panel-body [data-dial]").evaluateAll((rows) => rows.map((r) => r.dataset.dial));
  assert.deepEqual(dials, ["variant", "window", "theme", "palette", "density", "state", "length"]);
  for (const gone of ["screen", "accent", "neutral", "fontSet", "textSize", "space", "radius"]) assert.ok(!dials.includes(gone), `no ${gone} dial`);

  // The title strip with the variant's name sits right above the frame.
  const strip = await page.evaluate(() => {
    const title = [...document.querySelectorAll(".tool-term-title")].find((e) => getComputedStyle(e).visibility === "visible");
    const frame = document.getElementById("p2c-frame-A").getBoundingClientRect();
    const r = title.getBoundingClientRect();
    return { text: title.textContent, near: Math.abs(frame.top - r.bottom) <= 1 && Math.abs(frame.left - r.left) <= 1 };
  });
  assert.deepEqual(strip, { text: "Progress lines", near: true });

  const size = () =>
    page.evaluate(() => {
      const doc = document.getElementById("p2c-frame-A").contentDocument;
      const probe = doc.createElement("span");
      probe.textContent = "0000000000";
      probe.style.cssText = "position:absolute;white-space:pre";
      doc.body.appendChild(probe);
      const ch = probe.getBoundingClientRect().width / 10;
      probe.remove();
      const cs = getComputedStyle(doc.body);
      return {
        w: doc.defaultView.innerWidth,
        h: doc.defaultView.innerHeight,
        ch,
        line: parseFloat(cs.lineHeight),
        padX: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
        padY: parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom),
      };
    });
  const holds = (s, cols, rows) => {
    assert.ok(Math.abs(s.w - (cols * s.ch + s.padX)) <= 1, `${cols} columns wide: ${JSON.stringify(s)}`);
    assert.ok(Math.abs(s.h - (rows * s.line + s.padY)) <= 1, `${rows} rows tall: ${JSON.stringify(s)}`);
  };
  holds(await size(), 120, 30);
  await pickChoice(page, "window", "80x24");
  const small = await size();
  holds(small, 80, 24);
  await pickChoice(page, "window", "160x48");
  const big = await size();
  holds(big, 160, 48);
  assert.ok(big.w > small.w && big.h > small.h);
  await page.locator("#p2c-dial-density").fill("2");
  holds(await size(), 160, 48);

  await pickChoice(page, "palette", "Amber");
  assert.ok(every(await rootValue(page, "--p2c-term-bg"), "#1a1408"), "the Amber palette's dark background");
});

/* ------------------------------------------------------- review regressions */

test("free text with line breaks stays on its own labeled line in the block", async (t) => {
  const edit = (round) => {
    const file = path.join(round, "round.json");
    const facts = JSON.parse(fs.readFileSync(file, "utf8"));
    facts.direction = "calm\nNote: not a note";
    facts.variants[0].name = "Dense\ntable";
    facts.extras[0].label = "Soft\nshadows";
    fs.writeFileSync(file, JSON.stringify(facts, null, 2));
  };
  const { page } = await openFixture(t, "good-screen", { edit });
  await page.click("#p2c-copy");
  const lines = (await blockText(page)).split("\n");
  assert.ok(lines.includes("Direction: calm Note: not a note"), lines.join(" | "));
  assert.ok(lines.includes('Chosen: A "Dense table" (others: B "Split view", C "Cards")'), lines.join(" | "));
  assert.ok(lines.includes("Extra, Soft shadows: soft"), lines.join(" | "));
  assert.ok(!lines.some((l) => l.startsWith("Note:")), "no line pretends to be the Note");
});

test("Surprise me never sets a slider past its max when the range is not a whole number of steps", async (t) => {
  const { page } = await openFixture(t, "good-screen", { edit: withExtra({ name: "lift", type: "slider", min: 0, max: 1, step: 0.35, start: 0, look: true }) });
  await page.evaluate(() => {
    window.p2c.random = () => 0.99;
  });
  await page.click("#p2c-surprise");
  const value = (await dialsOf(page))["x-lift"];
  assert.ok(value <= 1, `inside the range: ${value}`);
  assert.equal(value, 0.7);
  assert.ok(every(await rootValue(page, "--p2c-x-lift"), "0.7"));
});

test("Escape closes the Copy popover opened from the top bar", async (t) => {
  const { page } = await openFixture(t, "good-screen", { permissions: ["clipboard-read", "clipboard-write"] });
  await page.click("#p2c-copy");
  assert.equal(await page.locator("#p2c-copy-pop").isVisible(), true);
  assert.equal(await copyStatus(page), "Copied. Paste it into the conversation.");
  assert.equal(await page.evaluate(() => document.activeElement.id), "p2c-copy", "focus is still outside the popover");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#p2c-copy-pop").isVisible(), false);
  assert.equal(await page.locator("#p2c-copy").getAttribute("aria-expanded"), "false");
});
