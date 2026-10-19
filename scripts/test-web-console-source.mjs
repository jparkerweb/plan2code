// Web console tests, favicon, update check, help and page-source pins.
// Run with: node --test scripts/test-web-console-source.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// The page's pure answer-shaping logic. app.js itself cannot be imported here
// (it touches `document` at module scope and starts a session on import), which
// is exactly why this lives in its own file.
import { cardAvailability, SKILL_CATALOG } from "../src/web-console/public/answers.js";
import { SKILLS } from "../src/web-console/public/skills.js";
import { HELP_TABS } from "../src/web-console/public/help.js";
import { FAVICON_BODY, FAVICON_COLORS, faviconState, faviconSvg } from "../src/web-console/public/favicon.js";
import {
  CACHE_MS,
  RELEASES_URL,
  REPO_URL,
  checkForUpdate,
  compareVersions,
  latestTag,
} from "../src/web-console/update-check.mjs";
import { runHint } from "../src/web-console/public/render.js";
import { applyPatch } from "../src/web-console/patches.mjs";
import { ROOT, cli, helpTemplate, sessionUrl } from "./web-console-test-helpers.mjs";
import { joinedCss } from "./css-helpers.mjs";

test("favicon: the dot follows the status line -- busy, ready, attention, plain", () => {
  // Anything with the spinning ring is busy, even a finished screen opening the dashboard.
  assert.equal(faviconState({ mood: "work", spin: true }), "busy");
  assert.equal(faviconState({ mood: "work", spin: true, finished: true }), "busy");
  assert.equal(faviconState({ mood: "point" }), "ready");
  // A working mood without the ring is the stale line; adrift and gone need a look too.
  assert.equal(faviconState({ mood: "work" }), "attention");
  assert.equal(faviconState({ mood: "adrift" }), "attention");
  assert.equal(faviconState({ mood: "gone" }), "attention");
  assert.equal(faviconState({ mood: "happy" }), "plain");
  assert.equal(faviconState({ mood: "done", finished: true }), "plain");
  assert.equal(faviconState({ mood: "point", finished: true }), "plain");
  assert.equal(faviconState(), "plain");
});

test("favicon: every variant is the served Planny plus a bottom bar, busy dashed and the rest solid", () => {
  const served = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "favicon.svg"), "utf8");
  const squash = (s) => s.replace(/\s+/g, " ").trim();
  assert.ok(squash(served).includes(squash(FAVICON_BODY)), "FAVICON_BODY is the drawing in public/favicon.svg");
  assert.equal(squash(faviconSvg("plain")), squash(served), "plain is the served file");
  for (const [state, color] of Object.entries(FAVICON_COLORS)) {
    const svg = faviconSvg(state);
    assert.ok(squash(svg).includes(squash(FAVICON_BODY)), state);
    assert.ok(svg.includes('y="27"'), `${state} has the bottom bar`);
    if (state === "busy") {
      // Dashed, not solid: pattern carries the difference as well as color.
      assert.ok(svg.includes(`stroke="${color}"`) && svg.includes("stroke-dasharray"), "busy is a dashed bar");
      assert.ok(!svg.includes(`fill="${color}"`), "busy is never a solid bar");
    } else {
      assert.ok(svg.includes(`fill="${color}"`), `${state} bar is solid ${color}`);
      assert.ok(!svg.includes("stroke-dasharray"), `${state} is not dashed`);
    }
  }
  assert.equal(new Set(Object.values(FAVICON_COLORS)).size, 3, "three distinct colors");
});

test("runHint: command words (git included) get the hint, the rest nothing", () => {
  assert.equal(runHint("git add -A && git commit -m \"x\""), "hint");
  assert.equal(runHint("\n\ngit status\n"), "hint");
  assert.equal(runHint("git"), "hint");
  assert.equal(runHint("node install.js --build-skills"), "hint");
  assert.equal(runHint("docker compose up"), "hint");
  assert.equal(runHint("#!/bin/bash\necho hi"), "hint");
  assert.equal(runHint("pws run.ps1"), null);
  assert.equal(runHint("/plan2code-3-implement specs/x/overview.md"), null);
  assert.equal(runHint("/plan2code"), null);
  assert.equal(runHint('{"a": 1}'), null);
  assert.equal(runHint("some prose, not a command"), null);
  assert.equal(runHint(""), null);
  assert.equal(runHint(null), null);
  // The first non-empty line decides: a git line after a blank one hints.
  assert.equal(runHint("   \ngit commit -m \"x\"\n"), "hint");
});

test("a reused item id does not inherit the previous answer's submitted record", async () => {
  const { applyPatch } = await import("../src/web-console/patches.mjs");
  const before = { items: [{ id: "q7", kind: "choice", title: "A", body: "old", status: "open", submitted: { at: "t", text: "old answer" } }] };
  const reworded = applyPatch(before, { items: [{ id: "q7", kind: "choice", title: "B", body: "new", status: "open" }] });
  assert.equal(reworded.items[0].submitted, undefined);
  assert.equal(reworded.items[0].status, "open");
  // Settling or threading the same question keeps the record.
  assert.ok(applyPatch(before, { items: [{ id: "q7", status: "answered", answer: { k: "A" } }] }).items[0].submitted);
  // A settled question with a typo fixed stays settled.
  const settled = { items: [{ id: "q7", kind: "choice", title: "A", body: "old", status: "answered", answer: { k: "A" }, submitted: { at: "t", k: "A" } }] };
  const edited = applyPatch(settled, { items: [{ id: "q7", body: "old, fixed" }] }).items[0];
  assert.deepEqual([edited.status, edited.answer, !!edited.submitted], ["answered", { k: "A" }, true]);
  assert.ok(applyPatch(before, { items: [{ id: "q7", thread: [{ who: "agent", text: "hi" }] }] }).items[0].submitted);
  // A settled id reused for a different kind of question opens as a new one, even with no status in the patch.
  const swapped = applyPatch(settled, { items: [{ id: "q7", kind: "confirm", title: "C", body: "new" }] }).items[0];
  assert.deepEqual([swapped.status, swapped.answer, swapped.submitted], ["open", undefined, undefined]);
});

test("unansweredChat lists delivered Quick questions that still have no reply", async () => {
  const { unansweredChat, appendChat, writeCursor } = await import("../src/web-console/inbox.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-chat-"));
  appendChat(dir, { kind: "reset", conversation: 1, workflow: "dashboard", reason: "start" });
  appendChat(dir, { kind: "message", conversation: 1, text: "run it" });
  assert.deepEqual(unansweredChat(dir, {}), [], "not handed over yet, so not owed");
  writeCursor(dir, 2);
  assert.deepEqual(unansweredChat(dir, {}), [2]);
  assert.deepEqual(unansweredChat(dir, { chat: { replies: [{ id: "r2", re: 2, conversation: 1, md: "done" }] } }), []);
});

/* ------------------------------------------------------- update check */

const REPO_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8")).version;

test("update check: compareVersions orders X.Y.Z numerically and refuses anything else", () => {
  assert.equal(compareVersions("2.4.3", "2.4.3"), 0);
  assert.equal(compareVersions("2.4.3", "2.5.0"), -1);
  assert.equal(compareVersions("3.0.0", "2.99.99"), 1);
  assert.equal(compareVersions("2.10.0", "2.9.9"), 1, "numeric, not string, order");
  for (const bad of ["2.4", "v2.4.3", "", undefined, "2.4.3-rc1"]) {
    assert.equal(compareVersions(bad, "2.4.3"), null, String(bad));
    assert.equal(compareVersions("2.4.3", bad), null, String(bad));
  }
});

test("update check: latestTag picks the highest vX.Y.Z, skipping peeled and non-release tags", () => {
  const out = [
    "aaa\trefs/tags/v2.4.3",
    "bbb\trefs/tags/v2.4.3^{}",
    "ccc\trefs/tags/v2.10.0",
    "ddd\trefs/tags/v2.10.0^{}",
    "eee\trefs/tags/v2.9.9",
    "fff\trefs/tags/v3.0.0-rc1",
    "ggg\trefs/tags/release-4",
    "hhh\trefs/tags/v9.0.0^{}",
  ].join("\n");
  assert.equal(latestTag(out), "2.10.0");
  assert.equal(latestTag(out.replace(/\n/g, "\r\n")), "2.10.0", "CRLF output");
  assert.equal(latestTag("fff\trefs/tags/v3.0.0-rc1\nggg\trefs/tags/release-4"), null);
  assert.equal(latestTag(""), null);
  assert.equal(latestTag(null), null);
  assert.equal(latestTag(42), null);
});

test("update check: the cache is reused for an hour, failures included, and rebuilt when stale or corrupt", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-update-"));
  const cacheFile = path.join(dir, "nested", "update-check.json");
  const now = 1_800_000_000_000;
  let calls = 0;
  const tags = (v) => async () => {
    calls++;
    return `abc\trefs/tags/v${v}\n`;
  };
  const read = () => JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  try {
    // No cache: asks, and writes what it found.
    assert.deepEqual(await checkForUpdate({ installed: "2.4.3", cacheFile, now, run: tags("2.5.0") }), {
      installed: "2.4.3",
      latest: "2.5.0",
      updateAvailable: true,
    });
    assert.equal(calls, 1);
    assert.deepEqual(read(), { checkedAt: now, latest: "2.5.0" });

    // Fresh: the runner is not called.
    const fresh = await checkForUpdate({ installed: "2.4.3", cacheFile, now: now + CACHE_MS - 1, run: tags("9.9.9") });
    assert.equal(fresh.latest, "2.5.0");
    assert.equal(calls, 1);

    // Equal or newer installed: no update.
    assert.equal((await checkForUpdate({ installed: "2.5.0", cacheFile, now, run: tags("9.9.9") })).updateAvailable, false);
    assert.equal((await checkForUpdate({ installed: "2.6.0", cacheFile, now, run: tags("9.9.9") })).updateAvailable, false);
    assert.equal(calls, 1);

    // Stale: asks again and rewrites.
    const stale = await checkForUpdate({ installed: "2.4.3", cacheFile, now: now + CACHE_MS, run: tags("2.6.0") });
    assert.equal(stale.latest, "2.6.0");
    assert.equal(calls, 2);
    assert.equal(read().checkedAt, now + CACHE_MS);

    // Corrupt: treated as stale.
    fs.writeFileSync(cacheFile, "{not json");
    assert.equal((await checkForUpdate({ installed: "2.4.3", cacheFile, now, run: tags("2.7.0") })).latest, "2.7.0");
    assert.equal(calls, 3);

    // A failed lookup is cached as null, and not retried within the hour.
    fs.rmSync(cacheFile);
    const failed = async () => {
      calls++;
      return null;
    };
    assert.equal(await checkForUpdate({ installed: "2.4.3", cacheFile, now, run: failed }), null);
    assert.equal(calls, 4);
    assert.deepEqual(read(), { checkedAt: now, latest: null });
    assert.equal(await checkForUpdate({ installed: "2.4.3", cacheFile, now: now + 1000, run: tags("9.9.9") }), null);
    assert.equal(calls, 4, "the cached failure is reused");

    // A runner that throws, or an unknown installed version, is null, never a throw.
    fs.rmSync(cacheFile);
    const boom = async () => {
      throw new Error("boom");
    };
    assert.equal(await checkForUpdate({ installed: "2.4.3", cacheFile, now, run: boom }), null);
    assert.equal(await checkForUpdate({ installed: "dev", cacheFile, now: now + CACHE_MS * 2, run: tags("2.5.0") }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("update check: the repo and Releases URLs are the plan2code repo's", () => {
  assert.equal(REPO_URL, "https://github.com/jparkerweb/plan2code.git");
  assert.equal(RELEASES_URL, "https://github.com/jparkerweb/plan2code/releases/");
});

test("update check: the frame carries update only when a newer release is cached, and /version names latest", async () => {
  const newer = `${Number(REPO_VERSION.split(".")[0]) + 1}.0.0`;
  for (const [latest, expectUpdate] of [
    [newer, true],
    [REPO_VERSION, false],
  ]) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-update-frame-"));
    const env = { PLAN2CODE_CONSOLE_HOME: home, PLAN2CODE_MODELS_DIR: path.join(home, "plan2code") };
    fs.writeFileSync(path.join(home, "update-check.json"), JSON.stringify({ checkedAt: Date.now(), latest }));
    const res = cli(["open", "--no-open", "--workflow", "dashboard"], { env });
    const s = sessionUrl(res.json.url);
    const get = async (pathname) =>
      (await fetch(`${s.base}${pathname}`, { headers: { cookie: s.cookie, connection: "close" } })).json();
    try {
      // The check answers just after boot; give it a moment either way.
      let frame;
      for (let i = 0; i < 20; i++) {
        frame = await get("/state");
        if (frame.update) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (expectUpdate) {
        assert.deepEqual(frame.update, { installed: REPO_VERSION, latest: newer });
      } else {
        assert.equal("update" in frame, false, "no update key when the installed version is current");
      }
      assert.deepEqual(await get("/version"), { version: REPO_VERSION, latest });
    } finally {
      cli(["stop", "--session", res.json.sid], { env });
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test("stop modal: handoff choice first, plain stop second, Keep going last, styled and wired", () => {
  const web = (f) => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", f), "utf8");
  const html = web("index.html");
  const css = joinedCss();
  const dialog = html.match(/<dialog class="modal" id="stop-modal"[^>]*>([\s\S]*?)<\/dialog>/);
  assert.ok(dialog, "index.html has the stop modal");
  const body = dialog[1];
  const at = (id) => body.indexOf(`id="${id}"`);
  assert.ok(at("stop-handoff") >= 0 && at("stop-handoff") < at("stop-go") && at("stop-go") < at("stop-cancel"), "handoff, plain stop, Keep going, in that order");
  assert.ok(body.includes("Stop with a handoff") && body.includes("Just stop and save"));
  assert.doesNotMatch(body, /\sstyle=|<script/i);
  assert.match(css, /\.stop-choice/, "app.css styles the choices");
  assert.match(css, /\.stop-choice:focus-visible/, "and gives them a focus outline");
  const help = helpTemplate().match(/<section class="help-panel" data-tab="finishing">([\s\S]*?)<\/section>/);
  assert.ok(help && help[1].includes("Stop with a handoff") && help[1].includes("Just stop and save") && help[1].includes("~/.plan2code/handoffs/"), "Help names both choices and where handoffs land");
});

// The dashboard's handoff chips, preview and their four actions. What they
// do on the page is held by the page tests in test-web-console-page-dashboard.mjs;
// this keeps the style, the modal markup and the Help.
test("dashboard handoffs: the style, the read dialog and the delete warning ship, and Help explains the chips", () => {
  const web = (f) => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", f), "utf8");
  const css = joinedCss();
  const html = web("index.html");

  assert.match(css, /\.spec-chip\.is-handoff/, "app.css styles handoff chips");
  assert.match(css, /\.handoff-preview\b/, "and the preview panel");

  const modal = html.match(/<dialog class="modal handoff-read" id="handoff-modal"[^>]*>([\s\S]*?)<\/dialog>/);
  assert.ok(modal, "index.html has #handoff-modal");
  assert.doesNotMatch(modal[1], /\sstyle=|<script/i);
  assert.ok(html.includes('id="delete-warn-handoff"'), "the delete dialog carries the handoff warning");

  const panel = helpTemplate().match(/<section class="help-panel" data-tab="dashboard">([\s\S]*?)<\/section>/);
  assert.ok(panel && panel[1].includes("Pick it up here") && panel[1].includes("30-day sweep"), "Help explains handoff chips");
});

// The sign-off card: Approve comes before Show me it working, and an unpicked
// approve verdict is outlined in the accent.
test("sign-off: approve leads show, and the approve button wears the accent", () => {
  const doc = (f) => fs.readFileSync(path.join(ROOT, "src", "web-console", f), "utf8");
  for (const f of ["notes/implement.md", "building-review.md"]) {
    const text = doc(f);
    const approve = text.indexOf('{ "id": "approve", "label": "Approve this phase" }');
    const show = text.indexOf('{ "id": "show", "label": "Show me it working" }');
    assert.ok(approve > 0 && show > approve, `${f} lists Approve this phase before Show me it working`);
  }
  assert.match(joinedCss(), /\.btn\.is-approve\s*\{[^}]*border-color:\s*var\(--accent\)/, "is-approve borders in the accent");
});

// A fixed bug's chip: a visible Delete, one confirm, and "bug fixed" said once.
// What the fixed bug's chip and Delete do on the page is held by the page tests
// in test-web-console-page-dashboard.mjs; this keeps the style and the Help.
test("bug fixed delete: the Delete button is styled and Help explains the one confirm", () => {
  const web = (f) => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", f), "utf8");
  const css = joinedCss();
  assert.match(css, /\.spec-chip-del-label\s*\{/, "app.css styles the Delete button");
  assert.match(css, /\.spec-chip-del-label:focus-visible/, "and gives it a focus outline");

  const panel = helpTemplate().match(/<section class="help-panel" data-tab="dashboard">([\s\S]*?)<\/section>/);
  assert.ok(panel && /fixed\s+bug[\s\S]*?Delete[\s\S]*?one\s+confirm/i.test(panel[1]), "Help says a fixed bug has its own Delete and needs one confirm");
});

test("update banner: the modal is in the page, with the exact command and no inline styles or scripts", () => {
  const html = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "index.html"), "utf8");
  const dash = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "screens", "dashboard.js"), "utf8");
  const dialog = html.match(/<dialog class="modal" id="update-modal" aria-labelledby="update-title">([\s\S]*?)<\/dialog>/);
  assert.ok(dialog, "index.html has the update modal");
  assert.doesNotMatch(dialog[1], /\sstyle=/);
  assert.doesNotMatch(dialog[1], /<script/i);
  const panel = helpTemplate().match(/<section class="help-panel" data-tab="dashboard">([\s\S]*?)<\/section>/);
  assert.ok(panel, "the help has a dashboard topic");
  assert.match(panel[1], /UPDATE AVAILABLE/, "the dashboard topic explains the banner");
  assert.doesNotMatch(panel[1], /\sstyle=/);
  assert.doesNotMatch(panel[1], /<script/i);
  assert.ok(dash.includes('"npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git"'), "the dashboard copies the exact command");
});

test("update banner: built only on the dashboard, dismissed per session, and Help's version links to Releases", () => {
  const dash = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "screens", "dashboard.js"), "utf8");
  const render = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "render.js"), "utf8");
  assert.match(dash, /"p2c-update-dismissed:" \+ page\.S\.sid/, "the dismissal is keyed by the session id");
  assert.match(render, /const RELEASES_URL = "https:\/\/github\.com\/jparkerweb\/plan2code\/releases\/";/);
  assert.match(render, /\.rel = "noopener noreferrer";/);
});

// The Changelog card sits left of Git, which sits left of Handoff, the last
// card. It is always clickable, and a launch from it resumes the session under
// its own workflow.
test("the Changelog card comes just before Git, Handoff is last, and Changelog is always on", () => {
  // The card order is skills.js's order.
  const skills = SKILLS.filter((s) => s.card).map((s) => s.skill);
  assert.equal(skills.indexOf("plan2code-changelog") + 1, skills.indexOf("plan2code-git"), "Changelog sits just before Git");
  assert.equal(skills.indexOf("plan2code-git") + 1, skills.indexOf("plan2code-handoff"), "Git sits just before Handoff");
  assert.equal(skills.at(-1), "plan2code-handoff", "Handoff is last");
  const entry = SKILL_CATALOG.find((e) => e.skill === "plan2code-changelog");
  assert.equal(entry.workflow, "changelog");
  assert.equal(entry.command, "/plan2code-changelog");
  for (const scan of [{ hasAgents: true, isGit: false }, { hasAgents: false }, null]) {
    assert.equal(cardAvailability(entry, scan, null).on, true);
  }
});

/* ------------------------------------------- getting started: stuck help and the finished screen */

const EM = String.fromCharCode(0x2014);
const publicSource = (name) => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", name), "utf8");

test("help: the stuck tab is second, with a callout and four symptom rows before the diagram", () => {
  assert.equal(HELP_TABS[0].id, "about");
  assert.equal(HELP_TABS[1].id, "stuck");
  const tpl = helpTemplate();
  const panel = tpl.match(/<section class="help-panel" data-tab="stuck">([\s\S]*?)<\/section>/)[1];
  assert.match(panel, /<div class="help-callout" role="note">/);
  assert.match(panel, /Check this first/);
  assert.match(panel, /look at your terminal/);
  assert.equal((panel.match(/class="help-row"/g) || []).length, 4, "four symptom rows");
  for (const part of ["You see", "Likely cause", "Do this"]) {
    assert.equal((panel.match(new RegExp(`<dt>${part}</dt>`, "g")) || []).length, 4, `each row has "${part}"`);
  }
  assert.ok(panel.indexOf("help-rows") < panel.indexOf("help-figure"), "the rows come before the diagram");
  assert.match(panel, /<svg class="help-callout-icon"[^>]*aria-hidden="true"/, "the icon is decoration");
});

test("help: privacy names the handoffs folder and preferences says Cleanup never offers it", () => {
  const tpl = helpTemplate();
  const privacy = tpl.match(/<section class="help-panel" data-tab="privacy">([\s\S]*?)<\/section>/)[1];
  const kept = privacy.slice(privacy.indexOf("<h4>What is kept, and where</h4>"));
  assert.match(kept, /(<code>)?~\/\.plan2code\/handoffs\/(<\/code>)?/, "privacy lists ~/.plan2code/handoffs/");
  assert.doesNotMatch(
    kept,
    /Everything lives under\s+<code>~\/\.plan2code\/console\/<\/code>/,
    "the lead no longer says everything lives under the console folder"
  );
  const prefs = tpl.match(/<section class="help-panel" data-tab="prefs">([\s\S]*?)<\/section>/)[1];
  const cleanup = prefs.slice(prefs.indexOf("<strong>Cleanup</strong>"), prefs.indexOf("<strong>Back to default</strong>"));
  assert.match(cleanup, /handoffs/, "the Cleanup text names the handoffs folder");
  assert.match(cleanup, /never\s+offered/, "the Cleanup text says the handoffs folder is never offered for removal");
});

test("help: the stuck tab is second, and openHelpOn only opens a tab that exists", () => {
  const app = publicSource("screens/help-dialog.js");
  assert.equal(HELP_TABS.findIndex((t) => t.id === "stuck"), 1, "the stuck tab is second");
  const opener = app.match(/function openHelpOn\(id\) \{([\s\S]*?)\n\}/);
  assert.ok(opener, "help-dialog.js has openHelpOn");
  assert.match(opener[1], /HELP_TABS\.some\(/, "openHelpOn only opens a tab that exists");
});

test("models: Codex is a model CLI on the server and the page, with its own tab", () => {
  const server = fs.readFileSync(path.join(ROOT, "src", "web-console", "routes.mjs"), "utf8");
  const app = publicSource("screens/looks.js");
  const html = publicSource("index.html");
  const list = (src) => JSON.parse(src.match(/const MODEL_CLIS = (\[[^\]]*\]);/)[1]);
  assert.deepEqual(list(server), ["claude", "devin", "codex"]);
  assert.deepEqual(list(app), list(server), "the page's tabs match the server's lists");
  assert.ok(!/for \(const cli of \["claude", "devin"\]\)/.test(app), "no loop over a hard-coded pair");
  const labels = { claude: "Claude", devin: "Devin", codex: "Codex" };
  for (const cli of list(app)) {
    assert.match(html, new RegExp(`id="models-tab-${cli}"[^>]*>${labels[cli]}</button>`), `${cli} has a tab`);
  }
  const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "launcher", "models.json"), "utf8"));
  for (const cli of list(server)) assert.ok(Array.isArray(shipped[cli]), `the launcher's models.json has ${cli}`);
});

test("getting started: the new help, status and finished-screen strings carry no em dash", () => {
  const tpl = helpTemplate();
  const stuck = tpl.match(/<section class="help-panel" data-tab="stuck">([\s\S]*?)<\/section>/)[1];
  const fresh = stuck.slice(0, stuck.indexOf("<h4>Not running, or not connected?</h4>"));
  assert.ok(!fresh.includes(EM), "the callout and rows have no em dash");
});
