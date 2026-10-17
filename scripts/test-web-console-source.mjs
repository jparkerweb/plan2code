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
import { applyPatch } from "../src/web-console/lib.mjs";
import { ROOT, cli, helpTemplate, sessionUrl } from "./web-console-test-helpers.mjs";

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
  const { applyPatch } = await import("../src/web-console/lib.mjs");
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
  const { unansweredChat, appendChat, writeCursor } = await import("../src/web-console/lib.mjs");
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
  const app = web("app.js");
  const css = web("app.css");
  const dialog = html.match(/<dialog class="modal" id="stop-modal"[^>]*>([\s\S]*?)<\/dialog>/);
  assert.ok(dialog, "index.html has the stop modal");
  const body = dialog[1];
  const at = (id) => body.indexOf(`id="${id}"`);
  assert.ok(at("stop-handoff") >= 0 && at("stop-handoff") < at("stop-go") && at("stop-go") < at("stop-cancel"), "handoff, plain stop, Keep going, in that order");
  assert.ok(body.includes("Stop with a handoff") && body.includes("Just stop and save"));
  assert.doesNotMatch(body, /\sstyle=|<script/i);
  assert.match(css, /\.stop-choice/, "app.css styles the choices");
  assert.match(css, /\.stop-choice:focus-visible/, "and gives them a focus outline");
  const open = app.slice(app.indexOf("function openStopConfirm()"), app.indexOf("async function stopSession("));
  assert.ok(open.includes("stop-handoff") && open.includes("isDashboard()"), "openStopConfirm hides the handoff on the dashboard");
  assert.ok(app.includes("stopSession(true)") && app.includes("STOP_HANDOFF_REPLY") && app.includes("stopAction"), "app.js wires the handoff stop");
  const help = helpTemplate().match(/<section class="help-panel" data-tab="finishing">([\s\S]*?)<\/section>/);
  assert.ok(help && help[1].includes("Stop with a handoff") && help[1].includes("Just stop and save") && help[1].includes("~/.plan2code/handoffs/"), "Help names both choices and where handoffs land");
});

// The dashboard's handoff chips, preview and their four actions.
test("dashboard handoffs: dashed chips, a preview with four buttons, and the cards give way", () => {
  const web = (f) => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", f), "utf8");
  const app = web("app.js");
  const css = web("app.css");
  const html = web("index.html");
  const fn = (name, next) => app.slice(app.indexOf(`function ${name}(`), app.indexOf(next, app.indexOf(`function ${name}(`)));

  const picker = fn("renderSpecPicker", "\nfunction ");
  assert.ok(picker.includes("is-handoff") && picker.includes('"Handoff"'), "renderSpecPicker builds handoff chips");
  assert.ok(picker.includes('"handoff:"'), "a handoff is picked as handoff:<id>");
  const dash = fn("renderDashboard", "\n/* -----");
  assert.ok(dash.includes("handoffList()"), "renderDashboard shows the picker for handoffs alone");
  const early = dash.indexOf("renderHandoffPreview(");
  assert.ok(early > 0 && early < dash.indexOf("hideUnavailableToggle()"), "the preview returns before the toggle and the card groups");
  assert.match(app, /const selHandoff = \(\) =>/);
  assert.match(app, /startsWith\("handoff:"\)/);

  const preview = fn("renderHandoffPreview", "\nasync function ");
  for (const label of ["Pick it up here", "Read it all", "Copy for a new conversation", "Delete"]) {
    assert.ok(preview.includes(`"${label}"`), `the preview names ${label}`);
  }
  assert.ok(app.includes("pickupAction(") && app.includes('"/submit"'), "Pick it up here posts a __pickup to /submit");
  assert.ok(app.includes('"/handoff?id="'), "Read it all fetches /handoff?id=");
  assert.ok(app.includes("handoffCopyText("), "Copy puts the ready prompt on the clipboard");
  assert.ok(app.includes("deleteHandoffAction(") && app.includes("function openHandoffDelete("), "Delete reuses the confirm dialog");

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
  const app = doc("public/app.js");
  assert.match(app, /const forward = v\.id === "approve" \|\| v\.id === "yes";/, "approve and yes are the forward verdicts");
  assert.match(app, /forward \? " is-approve"/, "an unpicked forward verdict gets is-approve");
  assert.match(doc("public/app.css"), /\.btn\.is-approve\s*\{[^}]*border-color:\s*var\(--accent\)/, "is-approve borders in the accent");
});

// A fixed bug's chip: a visible Delete, one confirm, and "bug fixed" said once.
test("bug fixed delete: a promoted Delete on the chip and a one-step confirm", () => {
  const web = (f) => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", f), "utf8");
  const app = web("app.js");
  const fn = (name, next) => app.slice(app.indexOf(`function ${name}(`), app.indexOf(next, app.indexOf(`function ${name}(`)));

  const picker = fn("renderSpecPicker", "\nfunction ");
  assert.ok(picker.includes('"spec-chip-del-label"') && picker.includes('"Delete"'), "renderSpecPicker builds a Delete button for a fixed bug");
  assert.ok(picker.includes("chipDetail("), "the chip's detail line comes from chipDetail");
  assert.doesNotMatch(picker, /spec\.detail\b/, "never the scan's detail directly");

  const css = web("app.css");
  assert.match(css, /\.spec-chip-del-label\s*\{/, "app.css styles the Delete button");
  assert.match(css, /\.spec-chip-del-label:focus-visible/, "and gives it a focus outline");

  const step = fn("deleteStep", "\nasync function ");
  const fixedAt = step.indexOf('state === "fixed"');
  const revealAt = step.indexOf('$("delete-confirm").hidden = false');
  assert.ok(fixedAt > 0 && revealAt > 0 && fixedAt < revealAt, "deleteStep sends a fixed bug's delete before it would reveal the name step");
  const open = fn("openDeleteConfirm", "\nfunction ");
  assert.ok(open.includes('state === "fixed"') && open.includes("so this only clears the write-up"), "openDeleteConfirm sets up one step and the fixed warning");

  const panel = helpTemplate().match(/<section class="help-panel" data-tab="dashboard">([\s\S]*?)<\/section>/);
  assert.ok(panel && /fixed\s+bug[\s\S]*?Delete[\s\S]*?one\s+confirm/i.test(panel[1]), "Help says a fixed bug has its own Delete and needs one confirm");
});

test("update banner: the modal is in the page, with the exact command and no inline styles or scripts", () => {
  const html = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.js"), "utf8");
  const dialog = html.match(/<dialog class="modal" id="update-modal" aria-labelledby="update-title">([\s\S]*?)<\/dialog>/);
  assert.ok(dialog, "index.html has the update modal");
  assert.doesNotMatch(dialog[1], /\sstyle=/);
  assert.doesNotMatch(dialog[1], /<script/i);
  const panel = helpTemplate().match(/<section class="help-panel" data-tab="dashboard">([\s\S]*?)<\/section>/);
  assert.ok(panel, "the help has a dashboard topic");
  assert.match(panel[1], /UPDATE AVAILABLE/, "the dashboard topic explains the banner");
  assert.doesNotMatch(panel[1], /\sstyle=/);
  assert.doesNotMatch(panel[1], /<script/i);
  assert.ok(app.includes('"npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git"'), "app.js copies the exact command");
});

test("update banner: built only on the dashboard, dismissed per session, and Help's version links to Releases", () => {
  const app = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.js"), "utf8");
  const start = app.indexOf("function renderDashboard(main) {");
  assert.ok(start >= 0, "app.js has renderDashboard");
  const end = app.indexOf("\n}\n", start);
  const body = app.slice(start, end);
  assert.match(body, /"dash-nudge update-banner"/, "renderDashboard builds the banner");
  const outside = app.slice(0, start) + app.slice(end);
  assert.doesNotMatch(outside, /update-banner/, "no other code builds it");
  assert.match(app, /"p2c-update-dismissed:" \+ S\.sid/, "the dismissal is keyed by the session id");
  assert.match(app, /const RELEASES_URL = "https:\/\/github\.com\/jparkerweb\/plan2code\/releases\/";/);
  assert.match(app, /\.rel = "noopener noreferrer";/);
  const help = app.match(/async function renderHelpVersion\(\) \{([\s\S]*?)\n\}/);
  assert.ok(help, "app.js has renderHelpVersion");
  assert.match(help[1], /releasesLink\(/, "the help version is a Releases link");
});

// The Changelog card sits left of Git, which sits left of Handoff, the last
// card. It is always clickable, and a launch from it resumes the session under
// its own workflow.
test("the Changelog card comes just before Git, Handoff is last, and Changelog is always on", () => {
  const skills = SKILL_CATALOG.map((e) => e.skill);
  assert.equal(skills.indexOf("plan2code-changelog") + 1, skills.indexOf("plan2code-git"));
  assert.deepEqual(skills.slice(-3), ["plan2code-changelog", "plan2code-git", "plan2code-handoff"]);
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

// Every say(...) call in a source slice, as its top-level arguments (raw
// source text). String-aware, so commas and brackets inside a line are text.
function sayCalls(source) {
  const calls = [];
  let at = 0;
  while ((at = source.indexOf("say(", at)) !== -1) {
    if (/[\w.]/.test(source[at - 1] || "")) {
      at += 4;
      continue;
    }
    const args = [];
    let depth = 0;
    let quote = null;
    let start = at + 4;
    let i = start;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if ("([{".includes(ch)) depth++;
      else if (")]}".includes(ch)) {
        if (depth === 0) break;
        depth--;
      } else if (ch === "," && depth === 0) {
        args.push(source.slice(start, i).trim());
        start = i + 1;
      }
    }
    const last = source.slice(start, i).trim();
    if (last) args.push(last);
    calls.push(args);
    at = i;
  }
  return calls;
}

test("status line: the quiet, Not running and Not connected lines offer What to check, opening Help on the stuck tab", () => {
  const app = publicSource("app.js");
  assert.equal(HELP_TABS.findIndex((t) => t.id === "stuck"), 1, "the stuck tab is second");
  const opener = app.match(/function openHelpOn\(id\) \{([\s\S]*?)\n\}/);
  assert.ok(opener, "app.js has openHelpOn");
  assert.match(opener[1], /HELP_TABS\.some\(/, "openHelpOn only opens a tab that exists");
  const render = app.slice(app.indexOf("function renderStatus()"), app.indexOf("/* ---------------------------------------------------------------- brief */"));
  const sayDef = render.slice(render.indexOf("const say = ("), render.indexOf("text.replaceChildren("));
  assert.match(sayDef, /help\.textContent = "What to check"/);
  assert.match(sayDef, /help\.addEventListener\("click", \(\) => openHelpOn\("stuck"\)\)/, "the button opens Help on the stuck tab");
  const calls = sayCalls(render.slice(render.indexOf("text.replaceChildren(")));
  const checked = calls.filter((args) => args[4] && args[4] !== "false");
  for (const needle of ["Not connected. Your answers are saved.", "Still working on it.", "is not running. Your answers are saved", "is not running right now."]) {
    assert.ok(checked.some((args) => args.join(",").includes(needle)), `"${needle}" carries What to check`);
  }
  assert.ok(checked.some((args) => args[4] === "Boolean(hint)"), "the approval hint carries What to check");
  // Nothing else does: the finished, working and adrift lines stay plain.
  assert.equal(checked.length, 4, `four calls pass check, got: ${checked.map((a) => a[1]).join(" | ")}`);
});

test("finished screen: Before you close this waits while a hand-off they asked for is starting", () => {
  const app = publicSource("app.js");
  const handoff = app.slice(app.indexOf("function renderHandoff("));
  const body = handoff.slice(0, handoff.indexOf("\n}\n"));
  assert.match(body, /if \(!closeGuideHeld\(\)\) card\.appendChild\(renderCloseGuide\(shape, fin\)\)/);
  const held = app.match(/function closeGuideHeld\(\) \{([\s\S]*?)\n\}/);
  assert.ok(held, "app.js has closeGuideHeld");
  const run = (gone, afterBuild, pending) =>
    new Function("gone", "local", "reviewPending", held[1])(gone, { afterBuild }, () => pending);
  for (const kind of ["review", "commit", "dashboard"]) {
    assert.equal(run(false, kind, null), true, `held while ${kind} is starting`);
  }
  assert.equal(run(false, null, "asked"), true, "held while a review is asked");
  assert.equal(run(false, null, "open"), false, "shown while the review is only on offer");
  assert.equal(run(false, null, null), false, "shown on a plain finish");
  assert.equal(run(false, "done", null), false, "shown once they said they are done");
  assert.equal(run(true, "review", null), false, "shown once the server is gone: nothing is starting");
  // The press re-renders the page, and so does the finish going away, so the
  // panel follows the state.
  const send = app.slice(app.indexOf("async function sendAfterBuild("), app.indexOf("/* ------------------------------------------------------------- dashboard */"));
  assert.match(send, /local\.afterBuild = kind;[\s\S]*finally \{\s*render\(\);/);
  assert.match(app, /if \(!finish\(\) && local\.afterBuild\) \{\s*local\.afterBuild = null;/);
});

test("models: Codex is a model CLI on the server and the page, with its own tab", () => {
  const server = fs.readFileSync(path.join(ROOT, "src", "web-console", "server.mjs"), "utf8");
  const app = publicSource("app.js");
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

test("finished screen: every shape shows Before you close this, with three rows", () => {
  const app = publicSource("app.js");
  const handoff = app.slice(app.indexOf("function renderHandoff("));
  assert.match(handoff.slice(0, handoff.indexOf("\n}\n")), /card\.appendChild\(renderCloseGuide\(shape, fin\)\)/);
  const guide = app.slice(app.indexOf("function renderCloseGuide("), app.indexOf("function renderHandoff("));
  for (const label of ["Safe to close", "Start fresh", "Carry on", "Before you close this"]) {
    assert.ok(guide.includes(label), `the guide says "${label}"`);
  }
  assert.match(guide, /shape === "paused"/, "a pause changes the Start fresh sentence");
  assert.match(guide, /resume command/);
});

test("getting started: the new help, status and finished-screen strings carry no em dash", () => {
  const app = publicSource("app.js");
  const guide = app.slice(app.indexOf("const GUIDE_ICONS"), app.indexOf("function renderHandoff("));
  assert.ok(!guide.includes(EM), "the close guide has no em dash");
  const tpl = helpTemplate();
  const stuck = tpl.match(/<section class="help-panel" data-tab="stuck">([\s\S]*?)<\/section>/)[1];
  const fresh = stuck.slice(0, stuck.indexOf("<h4>Not running, or not connected?</h4>"));
  assert.ok(!fresh.includes(EM), "the callout and rows have no em dash");
});

test("a redraw keeps the place of whatever scrolls: question card, finished screen, doc column", () => {
  const app = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "app.js"), "utf8");
  const fn = app.slice(app.indexOf("function withFocus("), app.indexOf("// Scroll memory across tab switches."));
  assert.ok(fn.includes("const place = mainPlace();") && fn.includes("restoreMainPlace(place);"), "withFocus saves and restores the main column's place");
  assert.ok(!fn.includes('querySelector(".card.question")'), "not only a question card");
  const scrollers = app.match(/const MAIN_SCROLLERS = "([^"]+)"/);
  assert.ok(scrollers, "MAIN_SCROLLERS lists the column's scrolling children");
  for (const s of [".card", ".dash", ".waiting-pane"]) assert.ok(scrollers[1].includes(":scope > " + s), `${s} keeps its place`);
  const place = app.slice(app.indexOf("function mainPlace("), app.indexOf("function withFocus("));
  assert.match(place, /if \(drawnView === place\.key\) main\.scrollTop = place\.top;/, "the doc column comes back only on the same tab");
  assert.match(place, /scrollerKey\(inner\) === place\.key/, "a card comes back only while it shows the same thing");
  assert.match(place, /:scope > \.git-board/, "the git board keeps its own per-tab place");
});
