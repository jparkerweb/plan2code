// Web console tests, the page's pure logic: hand-offs, resume commands, catalog, scan, roles, meter, workspace and subagent rules.
// Run with: node --test scripts/test-web-console-logic.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
// The page's pure answer-shaping logic. app.js itself cannot be imported here
// (it touches `document` at module scope and starts a session on import), which
// is exactly why this lives in its own file.
import {
  ALL_DONE_LEAD,
  ALL_DONE_REST,
  APPROVAL_HINT,
  APPROVAL_HINT_MS,
  APPROVAL_TIP,
  approvalHint,
  attachmentKind,
  DOC_TYPES,
  docExt,
  formatBytes,
  MAX_ATTACHMENTS,
  MAX_DOC_BYTES,
  pickerAccept,
  sortAttachments,
  cardAvailability,
  cardPresentation,
  defaultSpec,
  CATALOG_GROUPS,
  CONTINUE_IN_CONSOLE,
  CONSOLE_WORKFLOWS,
  DASHBOARD_COMMAND,
  DASHBOARD_NOTE,
  DASHBOARD_REPLY,
  dashboardOffer,
  DONE_REPLY,
  finishPaused,
  fitWithin,
  GIT_INIT_NOTE,
  handoffShape,
  handoffText,
  launchReply,
  launchTarget,
  deleteAction,
  deleteReply,
  chipDetail,
  deleteSummary,
  FIXED_REASON,
  isDeletableSpecDir,
  MAX_NOTE_IMAGES,
  noteAction,
  noteReplyLines,
  progressTotal,
  quietLimitMs,
  resumeCommand,
  REVIEW_REPLY,
  afterFinishButton,
  commitOffer,
  changelogOffer,
  continueOffer,
  continueReply,
  pendingNote,
  reviewOffer,
  SKILL_CATALOG,
  launchVariant,
  SPEC_STATE_LABELS,
  STALE_MS,
  STOP_REPLY,
  STOP_HANDOFF_REPLY,
  stopAction,
  pickupAction,
  pickupReply,
  deleteHandoffAction,
  deleteHandoffReply,
  handoffCopyText,
  handoffAge,
  verdictLabel,
  verdictText,
  lastOpenCard,
  nextOpenAfter,
} from "../src/web-console/public/answers.js";
import { chatView } from "../src/web-console/public/chat.js";
import { ACCENTS, DEFAULT_ACCENT, RETIRED_ACCENTS, accentId } from "../src/web-console/public/palette.js";
import {
  needsRoleNudge,
  normalizeRole,
  ROLE_NOT_SET,
  ROLES,
  STARTER_SET_FOR,
  STARTER_SETS,
  startersFor,
  TEMPLATE_ORDERS,
  TEMPLATE_WORKFLOWS,
  TEMPLATES,
  templatesFor,
  templateSwap,
} from "../src/web-console/public/starters.js";
import {
  changeLine,
  defaultName,
  FOOTER_TIERS,
  footerLabel,
  freeName,
  NAME_MAX,
  nameProblem,
} from "../src/web-console/public/workspace.js";
import {
  levelFor,
  breakdownFrom,
  meterView,
  pointsFrom,
  progressEntry,
  ANSWERS_PER_POINT,
  ringFraction,
  runPoints,
  tooltipFor,
  WEIGHTS,
  LAUNCH_LABELS,
  RUN_LABELS,
} from "../src/web-console/public/meter.js";
import {
  blockFor,
  CHECKIN_LINE,
  checkHelper,
  checkHelpers,
  cleanSetting,
  defaultInstruction,
  defaultSetting,
  effectiveInstruction,
  FRAME_LINES,
  helperRows,
  offered,
  offLine,
  showSwitch,
  showTab,
  SUBAGENT_WORKFLOWS,
  switchLabel,
} from "../src/web-console/public/subagents.js";
import { applyMention, matchNames, mentionAt } from "../src/web-console/public/mentions.js";
import {
  pickerCommand,
  pickFolder,
  WINDOWS_PICKER_SOURCE,
  WORKSPACE_PICKER_PROMPT,
} from "../src/web-console/picker.mjs";
import {
  appendLedger,
  attachmentName,
  checkDocument,
  insideGitRepo,
  pendingFiles,
  PROTECTED_CONSOLE_FILES,
  readLedger,
  repoRoots,
} from "../src/web-console/sessions.mjs";
import { scanProject, removeSpec, SPEC_STATES } from "../src/web-console/scan.mjs";
import { validate } from "../src/web-console/patches.mjs";
import { startsClean } from "../src/web-console/public/hops.js";
import { chatReplyLines } from "../src/web-console/inbox.mjs";
import {
  initialWorkspace,
  pendingWorkspaceChanges,
  readWorkspaceCursor,
  WORKSPACE_FILE,
  writeWorkspaceCursor,
} from "../src/web-console/workspace.mjs";
import {
  latestOpenCaps,
  readSubagentCursor,
  readSubagentSetting,
  resetSubagentCursor,
  writeSubagentCursor,
  writeSubagentSetting,
} from "../src/web-console/settings.mjs";
import { ROOT, HOME, cli, PDF, postPatch, ask } from "./web-console-test-helpers.mjs";
import { joinedCss } from "./css-helpers.mjs";

// Someone who worked the whole session in the browser should land back in it.
// Every Plan2Code skill ships a console, so the sentence goes on all of
// them: anything else would send the next session looking for a page that
// does not exist.
test("the copied hand-off asks for the console only where there is one", () => {
  const pf = "/plan2code-0-pathfinder specs/lunch-vote/pathfinder";
  assert.equal(handoffText({ command: pf }), `${pf} ${CONTINUE_IN_CONSOLE}`);
  assert.equal(handoffText({ command: "/plan2code-1-plan" }), "/plan2code-1-plan --web");
  assert.equal(handoffText({ command: "/plan2code-1-plan" }), `/plan2code-1-plan ${CONTINUE_IN_CONSOLE}`);

  assert.equal(handoffText({ command: "/plan2code-2-document" }), `/plan2code-2-document ${CONTINUE_IN_CONSOLE}`);
  assert.equal(handoffText({ command: "/plan2code-init" }), `/plan2code-init ${CONTINUE_IN_CONSOLE}`);
  // A prefix match, not a substring one.
  assert.equal(handoffText({ command: "/plan2code-1-planner" }), "/plan2code-1-planner");
});

// The dashboard and every step it launches ship the console too, so their
// next session lands back in the browser.
test("the hand-off asks for the console on every step that ships one, and nowhere else", () => {
  for (const cmd of [
    "/plan2code",
    "/plan2code-init",
    "/plan2code-init-update",
    "/plan2code-3-implement specs/lunch-vote/overview.md",
    "/plan2code-3-implement-review specs/lunch-vote/overview.md",
    "/plan2code-1b-revise-plan specs/lunch-vote/overview.md",
    "/plan2code-quick-task",
    "/plan2code-2-document specs/lunch-vote/overview.md",
    "/plan2code-review",
    "/plan2code-4-finalize specs/lunch-vote/overview.md",
    "/plan2code-handoff",
  ]) {
    assert.equal(handoffText({ command: cmd }), `${cmd} ${CONTINUE_IN_CONSOLE}`, cmd);
  }
  const commit = 'git add -A && git commit -m "Add the rate limiter" -m "AI Assisted"';
  assert.equal(handoffText({ command: commit }), commit, "a commit command is not a skill");
  // A prefix match, so a longer unrelated name must not pick up the sentence.
  assert.equal(handoffText({ command: "/plan2code-3-implementation" }), "/plan2code-3-implementation");
  assert.equal(handoffText({ command: "/plan2code-extra" }), "/plan2code-extra");
});

// Every CONSOLE_WORKFLOWS entry has to be a skill install.js really bundles
// the console into, or the copied sentence sends the next session looking for
// a page that does not exist.
test("every console workflow the page names ships the console", () => {
  for (const cmd of CONSOLE_WORKFLOWS) {
    const skill = cmd.slice(1);
    const dir = path.join(ROOT, "skills", skill, "references", "web-console");
    assert.ok(fs.existsSync(path.join(dir, "console.mjs")), `${skill} must bundle the console`);
    assert.ok(fs.existsSync(path.join(dir, "building.md")), `${skill} must bundle building.md`);
  }
});

// The dashboard draws its cards from the page's own catalog, so every card
// has to be filled in and launch into a real SKILL.md. Which skills have a
// card is held against install.js in test-web-console-skills.mjs.
test("every dashboard card is filled in and launches a real skill", () => {
  const skillsDir = path.join(ROOT, "skills");
  // The dashboard itself is the hub, not a card.
  assert.ok(!SKILL_CATALOG.some((e) => e.skill === "plan2code"), "the dashboard does not launch itself");

  for (const e of SKILL_CATALOG) {
    assert.ok(CATALOG_GROUPS.some((g) => g.id === e.group), `${e.skill}: unknown group ${e.group}`);
    for (const field of ["workflow", "chip", "title", "blurb"]) {
      assert.ok(e[field] && String(e[field]).trim(), `${e.skill}.${field} must be filled in`);
    }
    // The skill file the dashboard reads for the hand-off must exist.
    assert.ok(
      fs.existsSync(path.join(skillsDir, e.skill, "SKILL.md")),
      `${e.skill} has no SKILL.md to launch into`
    );
    // The launch reply is the human-readable record of the pick; like the
    // other session phrases it keeps clear of Pathfinder's brief words.
    assert.doesNotMatch(launchReply(e), /\b(brief|recap|minutes)\b/i);
    assert.ok(launchReply(e).includes(e.command), "the reply names the command it stands for");
  }
  // Every group with a card renders; an empty one is a heading over nothing.
  for (const g of CATALOG_GROUPS) {
    assert.ok(SKILL_CATALOG.some((e) => e.group === g.id), `group ${g.id} has no cards`);
  }
});

// The review button runs review.md inside the build's own session, so the
// skills that offer it have to carry review.md and its references.
test("the skills that run a review on the page carry the review", () => {
  for (const skill of ["plan2code-3-implement", "plan2code-quick-task", "plan2code-3-implement-review"]) {
    const refs = path.join(ROOT, "skills", skill, "references");
    for (const f of ["review.md", "dimensions.md", "false-positives.md", "session-end.md", "verification-protocol.md"]) {
      assert.ok(fs.existsSync(path.join(refs, f)), `${skill} must carry references/${f}`);
    }
  }
});

test("the hand-off sentence respects an explicit choice and is never doubled", () => {
  const pf = "/plan2code-0-pathfinder specs/x/pathfinder";
  assert.equal(handoffText({ command: pf, console: false }), pf, "they asked for the terminal");
  assert.equal(handoffText({ command: "/custom", console: true }), `/custom ${CONTINUE_IN_CONSOLE}`);
  // A --web flag states the choice already.
  const flagged = "/plan2code-1-plan --web a lunch voting app";
  assert.equal(handoffText({ command: flagged }), flagged);
});

test("the copied hand-off always uses --web, never the long sentence", () => {
  const pf = "/plan2code-0-pathfinder specs/x/pathfinder";
  assert.equal(handoffText({ command: `${pf} Use the web console for this session.` }), `${pf} --web`);
  assert.equal(handoffText({ command: `${pf} use the web console for this session` }), `${pf} --web`);
  assert.equal(handoffText({ command: `/custom Use the web console for this session.` }), "/custom --web");
  assert.equal(
    handoffText({ command: `${pf} Use the web console for this session.`, console: false }),
    pf,
    "they asked for the terminal"
  );
});

// Pathfinder reads these words in its argument as a request for a brief, so
// the sentence riding on the command must never contain one.
test("the hand-off sentence cannot be mistaken for a brief request", () => {
  assert.doesNotMatch(CONTINUE_IN_CONSOLE, /(brief|recap|minutes)/i);
});

// When the agent cannot answer a stop, the page offers the resume command
// itself, from the session state alone. It must never invent a path.
test("the page's own resume command is built only from what the session says", () => {
  assert.equal(resumeCommand({ workflow: "pathfinder", specDir: "specs/lunch-vote" }), "/plan2code-0-pathfinder specs/lunch-vote/pathfinder");
  assert.equal(resumeCommand({ workflow: "pathfinder", specDir: "specs\\lunch-vote\\" }), "/plan2code-0-pathfinder specs/lunch-vote/pathfinder");
  assert.equal(resumeCommand({ workflow: "pathfinder" }), "/plan2code-0-pathfinder");
  assert.equal(resumeCommand({ workflow: "pathfinder", specDir: "/etc/passwd" }), "/plan2code-0-pathfinder");
  assert.equal(resumeCommand({ workflow: "pathfinder", specDir: "specs/a/../../b" }), "/plan2code-0-pathfinder");
  assert.equal(resumeCommand({ workflow: "plan", specDir: "specs/x" }), "/plan2code-1-plan");

  assert.equal(resumeCommand({ workflow: "implement", specDir: "specs/x" }), "/plan2code-3-implement specs/x/overview.md");
  assert.equal(resumeCommand({ workflow: "implement" }), "/plan2code-3-implement");
  assert.equal(resumeCommand({ workflow: "implement", specDir: "../x" }), "/plan2code-3-implement");
  assert.equal(
    resumeCommand({ workflow: "implement-review", specDir: "specs/x/" }),
    "/plan2code-3-implement-review specs/x/overview.md"
  );
  assert.equal(resumeCommand({ workflow: "revise-plan", specDir: "specs/x" }), "/plan2code-1b-revise-plan specs/x/overview.md");
  assert.equal(resumeCommand({ workflow: "quick-task", specDir: "specs/x" }), "/plan2code-quick-task");
  assert.equal(resumeCommand({ workflow: "finalize", specDir: "specs/x" }), "/plan2code-4-finalize specs/x/overview.md");
  assert.equal(resumeCommand({ workflow: "finalize" }), "/plan2code-4-finalize");

  // The dashboard generation: the menu itself, the setup pair, and the
  // utilities all resume as their bare commands — none keep anything on disk
  // that a path would point at.
  assert.equal(resumeCommand({ workflow: "dashboard" }), "/plan2code");
  assert.equal(resumeCommand({ workflow: "init" }), "/plan2code-init");
  assert.equal(resumeCommand({ workflow: "init-update" }), "/plan2code-init-update");
  assert.equal(resumeCommand({ workflow: "document", specDir: "specs/x" }), "/plan2code-2-document specs/x/overview.md");
  assert.equal(resumeCommand({ workflow: "document" }), "/plan2code-2-document");
  assert.equal(resumeCommand({ workflow: "review" }), "/plan2code-review");
  assert.equal(resumeCommand({ workflow: "handoff" }), "/plan2code-handoff");
});

// resumeCommand() reads the entry's `resume`: one case per kind.
test("the resume command follows the entry's resume kind, and an unknown workflow resumes as Pathfinder", () => {
  // "overview"
  assert.equal(resumeCommand({ workflow: "document", specDir: "specs/lunch-vote" }), "/plan2code-2-document specs/lunch-vote/overview.md");
  assert.equal(resumeCommand({ workflow: "document" }), "/plan2code-2-document");
  // "folder"
  assert.equal(resumeCommand({ workflow: "pathfinder", specDir: "specs/lunch-vote" }), "/plan2code-0-pathfinder specs/lunch-vote/pathfinder");
  assert.equal(resumeCommand({ workflow: "pathfinder" }), "/plan2code-0-pathfinder");
  // null: a spec is ignored
  assert.equal(resumeCommand({ workflow: "review", specDir: "specs/lunch-vote" }), "/plan2code-review");
  // An old session's workflow the console no longer knows
  assert.equal(resumeCommand({ workflow: "made-up", specDir: "specs/lunch-vote" }), "/plan2code-0-pathfinder specs/lunch-vote/pathfinder");
  assert.equal(resumeCommand({}), "/plan2code-0-pathfinder");
});

test("a hop starts the page clean to or from the dashboard, into Git and between skills, but not out of Git or into Review", () => {
  assert.equal(startsClean("implement", "dashboard"), true);
  assert.equal(startsClean("dashboard", "plan"), true);
  assert.equal(startsClean("changelog", "git"), true);
  assert.equal(startsClean("finalize", "git"), true);
  // A launch from a finished screen (Continue here, Update CHANGELOG first)
  assert.equal(startsClean("plan", "document"), true);
  assert.equal(startsClean("quick-task", "changelog"), true);
  assert.equal(startsClean("finalize", "changelog"), true);
  assert.equal(startsClean("git", "changelog"), false);
  assert.equal(startsClean("git", "plan"), false);
  assert.equal(startsClean("implement", "review"), false);
  assert.equal(startsClean("git", "git"), false);
  assert.equal(startsClean("dashboard", "dashboard"), false);
  assert.equal(startsClean(undefined, "git"), false);
  assert.equal(startsClean("plan", undefined), false);
});

test("the review offer is read from true or a label, and absent otherwise", () => {
  assert.equal(reviewOffer({ command: "/x" }), null);
  assert.equal(reviewOffer({ command: "/x", review: false }), null);
  assert.equal(reviewOffer({ command: "/x", review: true }).label, "Review what was just built");
  assert.equal(reviewOffer({ command: "/x", review: { label: "  Review Phase 3  " } }).label, "Review Phase 3");
  assert.equal(reviewOffer({ command: "/x", review: { label: "" } }).label, "Review what was just built");
  assert.equal(reviewOffer(null), null);
});

// A pause has no flag on the finish: the stop playbook asks for a headline
// that says it is paused rather than done, and the rail's PAUSED item reads
// the same words the person does.
test("a pause is told apart from an ending by its headline", () => {
  assert.equal(finishPaused({ headline: "Paused — your answers so far are saved" }), true);
  assert.equal(finishPaused({ headline: "  paused, saved where we stopped" }), true);
  assert.equal(finishPaused({ headline: "The map is written" }), false);
  assert.equal(finishPaused({ headline: "The unpaused work is done" }), false, "paused inside a word is not the state");
  assert.equal(finishPaused({ headline: "Phase 3 is done" }), false);
  assert.equal(finishPaused({ command: "/x" }), false);
  assert.equal(finishPaused(null), false);
});

// A finish with no command has nothing left to run, and points at the
// dashboard instead of a next step. A pause always offers its resume command.
test("the hand-off shape follows the pause and the command", () => {
  assert.equal(handoffShape({ headline: "Done", command: "/plan2code-2-document" }), "next");
  assert.equal(handoffShape({ headline: "AGENTS.md is updated" }), "all-done");
  assert.equal(handoffShape({ headline: "Done", command: "  " }), "all-done");
  assert.equal(handoffShape({ headline: "Paused at Phase 4", command: "/plan2code-1-plan" }), "paused");
  assert.equal(handoffShape({ headline: "Paused here" }), "paused");
  assert.equal(
    `${ALL_DONE_LEAD} ${ALL_DONE_REST}`,
    "All done, nothing left to run. To start something else, run `/plan2code` in a new conversation to open the dashboard."
  );
  assert.equal(handoffText({ command: DASHBOARD_COMMAND }), "/plan2code --web");
});

// The dashboard button shows only when the agent opted in, and never on a
// pause, whichever finished shape it sits on.
test("the dashboard offer follows the flag and never shows on a pause", () => {
  assert.equal(dashboardOffer({ headline: "Done", command: "/plan2code-2-document" }), false);
  assert.equal(dashboardOffer({ headline: "Done", dashboard: false }), false);
  assert.equal(dashboardOffer({ headline: "Done", dashboard: "yes" }), false);
  assert.equal(dashboardOffer(null), false);
  assert.equal(dashboardOffer({ headline: "Done", command: "/plan2code-2-document", dashboard: true }), true);
  assert.equal(dashboardOffer({ headline: "AGENTS.md is updated", dashboard: true }), true);
  assert.equal(dashboardOffer({ headline: "Paused at Phase 4", command: "/plan2code-1-plan", dashboard: true }), false);
  assert.equal(
    DASHBOARD_NOTE,
    "This picks up in the same conversation. That's fine after a quick or small skill; after a long one, type `/clear` in your terminal and run `/plan2code` for a clean start."
  );
  for (const word of ["brief", "recap", "minutes"]) {
    assert.ok(!DASHBOARD_REPLY.toLowerCase().includes(word), `the reply must not say "${word}"`);
  }
});

// A build task can honestly run twenty minutes with nothing to post. The page
// stretches its "is it stuck?" thresholds only while the agent says it is
// working, never below the default, and never past an hour.
test("a quiet stretch stretches the stuck thresholds only while working", () => {
  const base = 2 * 60 * 1000;
  assert.equal(quietLimitMs(null, base), base);
  assert.equal(quietLimitMs({ status: "working" }, base), base);
  assert.equal(quietLimitMs({ status: "working", quietMinutes: 20 }, base), 20 * 60 * 1000);
  assert.equal(quietLimitMs({ status: "waiting", quietMinutes: 20 }, base), base, "a waiting agent is polling");
  assert.equal(quietLimitMs({ status: "working", quietMinutes: 1 }, base), base, "never below the default");
  assert.equal(quietLimitMs({ status: "working", quietMinutes: 500 }, base), 60 * 60 * 1000, "capped at an hour");
  assert.equal(quietLimitMs({ status: "working", quietMinutes: "soon" }, base), base);
});

// A build that grew tasks mid-phase can post cleared past total; the label
// must never read "7 of 5", so the total rises to meet it.
test("the progress label never reads above its total", () => {
  assert.equal(progressTotal(3, 5), 5);
  assert.equal(progressTotal(7, 5), 7);
  assert.equal(progressTotal(0, 0), 0);
  assert.equal(progressTotal("4", undefined), 4);
});

test("an image is shrunk to fit its long edge, aspect kept, never upscaled", () => {
  assert.equal(MAX_NOTE_IMAGES, 5);
  assert.deepEqual(fitWithin(4000, 3000, 2000), { w: 2000, h: 1500 });
  assert.deepEqual(fitWithin(1000, 3000, 2000), { w: 667, h: 2000 });
  assert.deepEqual(fitWithin(800, 600, 2000), { w: 800, h: 600 });
});

test("a note's action carries only each image's path and name, and no images key when it has none", () => {
  assert.equal("images" in noteAction("q3", "Gap here", []), false);
  const action = noteAction("q3", "Gap here", [
    { key: "k1", id: "i1", path: "C:\\x\\a.jpg", url: "/uploads/i1.jpg", name: "a.png", status: "ready" },
    { key: "k2", id: "i2", path: "C:\\x\\b.jpg", url: "/uploads/i2.jpg", name: "b.png", status: "ready" },
  ]);
  assert.deepEqual(action, {
    i: "q3",
    type: "comment",
    text: "Gap here",
    images: [
      { path: "C:\\x\\a.jpg", name: "a.png" },
      { path: "C:\\x\\b.jpg", name: "b.png" },
    ],
  });
});

test("a note's reply lines list one indented Image line per attachment", () => {
  assert.deepEqual(noteReplyLines("Layout", "Gap here", [{ path: "C:\\x\\a.jpg", name: "shot.png" }]), [
    "Note on Layout: Gap here",
    "  Image: C:\\x\\a.jpg (shot.png)",
  ]);
  assert.deepEqual(noteReplyLines("Layout", "", [{ path: "C:\\x\\a.jpg", name: "shot.png" }]), [
    "Note on Layout: (images only)",
    "  Image: C:\\x\\a.jpg (shot.png)",
  ]);
  assert.deepEqual(noteReplyLines("Layout", "Just words", []), ["Note on Layout: Just words"]);
});

test("a note with documents splits them into files, keeps attach order in its lines, and says attachments only", () => {
  const mixed = [
    { key: "k1", path: "C:\\x\\a.jpg", url: "/uploads/a.jpg", name: "shot.png", status: "ready" },
    { key: "k2", kind: "file", path: "C:\\x\\b.pdf", name: "spec.pdf", size: 10, status: "ready" },
    { key: "k3", kind: "image", path: "C:\\x\\c.jpg", name: "c.png", status: "ready" },
  ];
  assert.deepEqual(noteAction("q3", "See", mixed), {
    i: "q3",
    type: "comment",
    text: "See",
    images: [
      { path: "C:\\x\\a.jpg", name: "shot.png" },
      { path: "C:\\x\\c.jpg", name: "c.png" },
    ],
    files: [{ path: "C:\\x\\b.pdf", name: "spec.pdf" }],
  });
  assert.equal("files" in noteAction("q3", "See", [mixed[0]]), false, "an image-only note has no files key");
  assert.deepEqual(noteReplyLines("Layout", "", mixed), [
    "Note on Layout: (attachments only)",
    "  Image: C:\\x\\a.jpg (shot.png)",
    "  File: C:\\x\\b.pdf (spec.pdf)",
    "  Image: C:\\x\\c.jpg (c.png)",
  ]);
});

test("document helpers: the extension allow-list, the picker's accept, sizes, and the kind of an old entry", () => {
  assert.equal(MAX_ATTACHMENTS, 5);
  assert.equal(MAX_DOC_BYTES, 10 * 1024 * 1024);
  assert.equal(docExt("README.MD"), "md");
  assert.equal(docExt("x.PDF"), "pdf");
  assert.equal(docExt("archive.tar.gz"), null);
  assert.equal(docExt(".env"), null);
  assert.equal(docExt("Dockerfile"), null);
  assert.equal(docExt("trailing."), null);
  assert.equal(docExt("report.docx"), null);
  assert.ok(Object.keys(DOC_TYPES).every((ext) => ext === ext.toLowerCase()));
  const accept = pickerAccept();
  assert.ok(accept.startsWith("image/*,"));
  assert.ok(accept.split(",").includes(".pdf") && accept.split(",").includes(".md"));
  // Formatted in the machine's own locale, so the expected text is too: this
  // pins the unit and the rounding, not one language's spelling of them.
  const unit = (value, u, digits) =>
    new Intl.NumberFormat(undefined, { style: "unit", unit: u, maximumFractionDigits: digits }).format(value);
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), unit(2, "kilobyte", 0));
  assert.equal(formatBytes(1536), unit(2, "kilobyte", 0), "kilobytes round to whole numbers");
  assert.equal(formatBytes(3.5 * 1024 * 1024), unit(3.5, "megabyte", 1));
  assert.equal(attachmentKind({}), "image");
  assert.equal(attachmentKind({ kind: "file" }), "file");
});

test("sortAttachments goes by extension first, refuses by name, and keeps the order given", () => {
  const ts = { name: "a.ts", type: "video/mp2t", size: 10 };
  const md = { name: "n.md", type: "", size: 10 };
  const png = { name: "shot.png", type: "image/png", size: 10 };
  const docx = { name: "r.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 };
  const bigPdf = { name: "big.pdf", type: "application/pdf", size: MAX_DOC_BYTES + 1 };
  const pdf = { name: "ok.pdf", type: "application/pdf", size: MAX_DOC_BYTES };
  const jpg = { name: "b.jpg", type: "image/jpeg", size: 10 };
  const env = { name: ".env", type: "", size: 10 };
  const out = sortAttachments([ts, png, docx, md, bigPdf, pdf, jpg, env]);
  assert.deepEqual(out.docs, [ts, md, pdf], ".ts as video/mp2t and .md with no type are documents");
  assert.deepEqual(out.images, [png, jpg]);
  assert.deepEqual(out.refused, [
    { name: "r.docx", reason: "type" },
    { name: "big.pdf", reason: "too-large" },
    { name: ".env", reason: "type" },
  ]);
  assert.deepEqual(sortAttachments(undefined), { images: [], docs: [], refused: [] });
});

test("checkDocument trusts the bytes, not the name", () => {
  assert.equal(checkDocument(Buffer.from("%PDF-1.4 rest"), "pdf"), null);
  assert.equal(checkDocument(Buffer.from("%PDF"), "pdf"), "type");
  assert.equal(checkDocument(Buffer.from("hello"), "pdf"), "type");
  assert.equal(checkDocument(Buffer.from("# ok — ünïcode\n", "utf8"), "md"), null);
  assert.equal(checkDocument(Buffer.alloc(0), "txt"), null, "an empty text file is fine");
  assert.equal(checkDocument(Buffer.from([0x61, 0x00, 0x62]), "md"), "type");
  assert.equal(checkDocument(Buffer.from([0xc3, 0x28]), "csv"), "type");
  assert.equal(checkDocument(Buffer.from("x"), "docx"), "type");
  assert.equal(checkDocument(Buffer.from("x"), "constructor"), "type");
});

test("chat lines list documents after images, and chatView carries files on sent and pending rows", () => {
  const lines = chatReplyLines([
    {
      kind: "message",
      text: "Read these",
      images: [{ path: "/u/a.jpg", name: "a.png" }],
      files: [{ path: "/u/b.md", name: "b.md" }],
    },
  ]);
  assert.equal(lines, "Quick question: Read these\n  Image: /u/a.jpg (a.png)\n  File: /u/b.md (b.md)");
  const view = chatView(
    { conversation: 1, messages: [{ from: "person", kind: "message", seq: 1, text: "Read", files: [{ path: "/u/b.md", name: "b.md" }] }] },
    { pendingSends: [{ tempId: "t", text: "More", files: [{ path: "/u/c.pdf", name: "c.pdf" }] }] }
  );
  assert.deepEqual(view.rows[0].files, [{ path: "/u/b.md", name: "b.md" }]);
  assert.deepEqual(view.rows[0].images, []);
  assert.deepEqual(view.rows[1].files, [{ path: "/u/c.pdf", name: "c.pdf" }]);
});

// The soft approval line comes in at 30 s of a working agent's silence. A
// build's quietMinutes stretches it in step with the stale line, at a quarter
// of it, so the soft line always gets its turn before "has not checked in".
test("the approval hint appears after 30 s of a working agent's silence", () => {
  assert.equal(APPROVAL_HINT_MS, 30_000);
  assert.equal(approvalHint({ status: "waiting" }, 10 * 60 * 1000), "");
  assert.equal(approvalHint({ status: "working" }, 29_000), "");
  assert.equal(approvalHint({ status: "working" }, 30_000), APPROVAL_HINT);
  assert.equal(approvalHint({ status: "working", quietMinutes: 5 }, 74_000), "");
  assert.equal(approvalHint({ status: "working", quietMinutes: 5 }, 75_000), APPROVAL_HINT);
  for (const quietMinutes of [undefined, 5, 15, 60]) {
    const agent = { status: "working", quietMinutes };
    const stale = quietLimitMs(agent, STALE_MS);
    const firstHint = [0, 1, 2, 3, 4].map((q) => (stale * q) / 4).find((ms) => approvalHint(agent, ms));
    assert.ok(firstHint < stale, `the soft line comes before the stale message (quietMinutes ${quietMinutes})`);
  }
  assert.equal(approvalHint(null, 60_000), "");
  assert.ok(APPROVAL_TIP.includes("`auto` mode in Claude Code"));
  assert.ok(APPROVAL_TIP.includes("`smart` mode in Devin"));
});

test("the build's session phrases cannot be mistaken for a brief request", () => {
  assert.doesNotMatch(REVIEW_REPLY, /\b(brief|recap|minutes)\b/i);
  assert.doesNotMatch(DONE_REPLY, /\b(brief|recap|minutes)\b/i);
});

test("the stop request cannot be mistaken for a brief request", () => {
  assert.doesNotMatch(STOP_REPLY, /\b(brief|recap|minutes)\b/i);
});

test("handoff helpers: actions carry only the id, replies and copy text are plain, ages round at the boundaries", () => {
  const h = { id: "2026-10-17-1152-handoff", title: "Lunch vote" };
  assert.deepEqual(pickupAction(h), { i: "__pickup", type: "pickup", handoff: h.id });
  assert.deepEqual(deleteHandoffAction(h), { i: "__delete", type: "delete", handoff: h.id });
  assert.equal(pickupReply(h), 'Pick up the handoff "Lunch vote" right here in this session.');
  assert.equal(deleteHandoffReply(h), 'Delete the handoff "Lunch vote" for good, right here in this session.');
  const file = "/home/sam/.plan2code/handoffs/2026-10-17-1152-handoff.md";
  assert.equal(handoffCopyText(file), `Read the handoff at ${file} and carry on with its Next task.`);
  for (const line of [pickupReply(h), deleteHandoffReply(h), handoffCopyText(file)]) {
    assert.ok(!line.includes("—"), "no em dash");
    assert.doesNotMatch(line, /(brief|recap|minutes)/i);
  }
  const now = Date.parse("2026-10-17T12:00:00Z");
  const ago = (ms) => handoffAge(new Date(now - ms).toISOString(), now);
  assert.equal(ago(0), "just now");
  assert.equal(ago(59 * 1000), "just now");
  assert.equal(ago(60 * 1000), "1 min ago");
  assert.equal(ago(59 * 60 * 1000), "59 min ago");
  assert.equal(ago(60 * 60 * 1000), "1 h ago");
  assert.equal(ago(23 * 3600 * 1000), "23 h ago");
  assert.equal(ago(24 * 3600 * 1000), "1 day ago");
  assert.equal(ago(3 * 24 * 3600 * 1000), "3 days ago");
  assert.equal(handoffAge("not a date", now), "");
});

test("the stop-with-a-handoff request is its own plain line, and stopAction sets the flag only when asked", () => {
  assert.notEqual(STOP_HANDOFF_REPLY, STOP_REPLY);
  assert.match(STOP_HANDOFF_REPLY, /handoff/i);
  assert.doesNotMatch(STOP_HANDOFF_REPLY, /\b(brief|recap|minutes)\b/i);
  assert.ok(!STOP_HANDOFF_REPLY.includes("—"), "no em dash in a line that rides to the agent");
  assert.ok(!("handoff" in stopAction({})), "a plain stop carries no handoff key");
  assert.deepEqual(stopAction({}), { i: "__stop", type: "stop" });
  assert.equal(stopAction({ handoff: true }).handoff, true);
  assert.equal(stopAction({ handoff: true }).type, "stop");
});

// Nineteen highlight colors, four shades each, two themes: far too many to
// trust to eyeballing, and a failure here is a label nobody can read.
const hexLum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [hexLum(a), hexLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("every highlight color is readable in both themes", () => {
  const panel = { light: "#ffffff", dark: "#201d1a" };
  // Nineteen a row in the wide Preferences dialog, two rows at most.
  assert.ok(Object.keys(ACCENTS).length >= 32 && Object.keys(ACCENTS).length <= 38);
  assert.ok(ACCENTS[DEFAULT_ACCENT], "the default must be in the list");
  const names = new Set();
  for (const [id, a] of Object.entries(ACCENTS)) {
    assert.ok(!names.has(a.name), `duplicate name ${a.name}`);
    names.add(a.name);
    for (const theme of ["light", "dark"]) {
      const [fill, soft, ink, line] = a[theme];
      for (const c of a[theme]) assert.match(c, /^#[0-9a-f]{6}$/, `${id} ${theme}: ${c}`);
      assert.ok(contrast(ink, fill) >= 4.5, `${id} ${theme}: label on the fill is ${contrast(ink, fill).toFixed(2)}:1`);
      assert.ok(contrast(fill, soft) >= 4.5, `${id} ${theme}: badge text on the tint is ${contrast(fill, soft).toFixed(2)}:1`);
      assert.ok(contrast(line, panel[theme]) >= 1.8, `${id} ${theme}: border barely shows at ${contrast(line, panel[theme]).toFixed(2)}:1`);
    }
  }
});

test("a retired highlight color keeps its closest twin, an unknown one the default", () => {
  for (const [old, now] of Object.entries(RETIRED_ACCENTS)) {
    assert.ok(!ACCENTS[old], `${old} is retired, so it is not offered`);
    assert.ok(ACCENTS[now], `${old} maps to ${now}, which must exist`);
    assert.equal(accentId(old), now);
  }
  assert.equal(accentId("violet"), "violet");
  assert.equal(accentId("nope"), DEFAULT_ACCENT);
  assert.equal(accentId(undefined), DEFAULT_ACCENT);
});

/* ------------------------------------------------- the spec-aware dashboard */

// The console scans the repo itself, so the states the picker shows have to
// be read off real folder shapes — a fixture per stage, then the matrix that
// turns a stage into lit or grayed cards.
function fakeSpec(root, name, files) {
  const dir = path.join(root, "specs", name);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

test("the project scan reads each spec's pipeline stage off its files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-scan-"));
  try {
    fakeSpec(root, "exploring", {
      "pathfinder/map.md": "**Status:** Working\n",
      "pathfinder/questions/00-a.md": "State: resolved\n",
      "pathfinder/questions/01-b.md": "State: open\n",
    });
    fakeSpec(root, "mapped", {
      "pathfinder/map.md": "**Status:** Cleared\n",
      "pathfinder/questions/00-a.md": "State: resolved\n",
    });
    fakeSpec(root, "planned", { "PLAN-DRAFT-20260923.md": "# draft\n\n**Status:** Complete\n" });
    fakeSpec(root, "draft-mid-plan", {
      "PLAN-DRAFT-20260923.md": "# draft\n\n**Status:** Phase 3 Complete - Resume at Phase 4\n",
      "pathfinder/map.md": "**Status:** Cleared\n",
    });
    // The other Status forms specs.mjs accepts read the same, CRLF included.
    fakeSpec(root, "planned-bold-colon", { "PLAN-DRAFT-20260923.md": "# draft\n\n**Status**: Complete\n" });
    fakeSpec(root, "draft-mid-plan-bold-colon", {
      "PLAN-DRAFT-20260923.md": "# draft\r\n\r\n**Status**: Phase 3 Complete - Resume at Phase 4\r\n",
    });
    fakeSpec(root, "mapped-bold-colon", {
      "pathfinder/map.md": "**Status**: Cleared\n",
      "pathfinder/questions/00-a.md": "State: resolved\n",
    });
    fakeSpec(root, "documented", {
      "overview.md": "# spec\n",
      "phase-1.md": "- [ ] Task one\n- [ ] Task two\n",
      "phase-2.md": "- [ ] Task three\n",
    });
    fakeSpec(root, "building", {
      "overview.md": "# spec\n",
      "phase-1.md": "- [x] Task one\n- [ ] Task two\n",
    });
    fakeSpec(root, "built", {
      "overview.md": "# spec\n",
      "phase-1.md": "- [x] Task one\n- [x] Task two\n",
    });
    fakeSpec(root, "weird", { "DESIGN.md": "# notes\n" });
    fakeSpec(root, "diagnosed", { "DIAGNOSIS-20261016.md": "# Diagnosis: rows go missing\n\n**Status:** Diagnosed\n" });
    // Once planning starts on a diagnosed bug, the usual states win.
    fakeSpec(root, "diagnosed-then-planned", {
      "DIAGNOSIS-20261016.md": "# Diagnosis\n\n**Status:** Diagnosed\n",
      "PLAN-DRAFT-20261017.md": "# draft\n\n**Status:** Complete\n",
    });
    // Quick Task marks the write-up Fixed: a finished bug, not loose files.
    fakeSpec(root, "diagnosed-then-fixed", { "DIAGNOSIS-20261016.md": "# Diagnosis\n\n**Status:** Fixed\n" });
    // A fixed bug someone then started planning around is mid-plan again.
    fakeSpec(root, "fixed-then-conversation", {
      "DIAGNOSIS-20261016.md": "# Diagnosis\n\n**Status:** Fixed\n",
      "PLAN-CONVERSATION-20261017.md": "# conversation\n",
    });
    fs.writeFileSync(path.join(root, "AGENTS.md"), "# agents\n");

    const scan = scanProject(root);
    assert.equal(scan.hasAgents, true);
    const byName = Object.fromEntries(scan.specs.map((s) => [s.name, s]));
    for (const [name, state] of [
      ["exploring", "exploring"],
      ["mapped", "mapped"],
      ["planned", "planned"],
      ["draft-mid-plan", "mapped"],
      ["planned-bold-colon", "planned"],
      ["draft-mid-plan-bold-colon", "mapped"],
      ["mapped-bold-colon", "mapped"],
      ["documented", "documented"],
      ["building", "building"],
      ["built", "built"],
      ["weird", "unrecognized"],
      ["diagnosed", "diagnosed"],
      ["diagnosed-then-planned", "planned"],
      ["diagnosed-then-fixed", "fixed"],
      ["fixed-then-conversation", "mapped"],
    ]) {
      assert.ok(byName[name], `spec ${name} was scanned`);
      assert.equal(byName[name].state, state, `spec ${name}`);
      assert.ok(SPEC_STATES.has(byName[name].state));
      assert.ok(SPEC_STATE_LABELS[byName[name].state], `state ${state} has a picker label`);
    }
    assert.equal(byName.exploring.detail, "1 of 2 decisions made");
    assert.equal(byName.building.detail, "1 of 2 tasks done");
    assert.equal(byName["draft-mid-plan"].detail, "plan draft, resume at Phase 4");
    assert.equal(byName["draft-mid-plan-bold-colon"].detail, "plan draft, resume at Phase 4");
    assert.equal(byName.diagnosed.detail, "bug diagnosed, not fixed");
    assert.equal(byName["diagnosed-then-fixed"].detail, "bug fixed");
    for (const state of SPEC_STATES) assert.ok(SPEC_STATE_LABELS[state], `state ${state} has a picker label`);
    assert.equal(SPEC_STATE_LABELS.diagnosed, "Bug diagnosed");
    assert.equal(SPEC_STATE_LABELS.fixed, "Bug fixed");

    // A pathfinder folder with no map yet is still mid-exploration; a map
    // whose status line is missing or unreadable is too.
    fakeSpec(root, "no-map", { "pathfinder/questions/00-a.md": "State: open\n" });
    const scan2 = scanProject(root);
    assert.equal(scan2.specs.find((s) => s.name === "no-map").state, "exploring");

    // No AGENTS.md reads false, and a repo with no specs scans empty rather
    // than failing.
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-scan-empty-"));
    const scan3 = scanProject(empty);
    assert.equal(scan3.hasAgents, false);
    assert.deepEqual(scan3.specs, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Deleting a spec from the dashboard: the page offers only folders it can
// name exactly, and the agent's `delete-spec` refuses anything else on disk.
test("isDeletableSpecDir takes exactly specs/<one name>", () => {
  for (const ok of ["specs/lunch-vote", "specs/codebase-health", "specs/a b"]) {
    assert.equal(isDeletableSpecDir(ok), true, ok);
  }
  for (const bad of [
    "specs/../x",
    "specs/..",
    "specs/.",
    "specs/.hidden",
    "specs/a/b",
    "specs/",
    "specs",
    "specs--completed/x",
    "/specs/x",
    "C:/specs/x",
    "specs\\x",
    "other/x",
    "",
    undefined,
    null,
  ]) {
    assert.equal(isDeletableSpecDir(bad), false, String(bad));
  }
});

test("a delete is a session action naming the folder, and its reply says it is for good", () => {
  const spec = { dir: "specs/lunch-vote", name: "lunch-vote", state: "building", detail: "1 of 2 tasks done", files: 3, touched: 1 };
  assert.deepEqual(deleteAction(spec), { i: "__delete", type: "delete", spec: "specs/lunch-vote" });
  const reply = deleteReply(spec);
  assert.match(reply, /specs\/lunch-vote\//);
  assert.match(reply, /for good/);
  assert.doesNotMatch(reply, /\b(brief|recap|minutes)\b/i);
  const sum = deleteSummary(spec);
  assert.equal(sum.folder, "specs/lunch-vote/");
  assert.equal(sum.stage, `${SPEC_STATE_LABELS.building}: 1 of 2 tasks done`);
  assert.equal(sum.files, "3 files");
  assert.equal(sum.touched, 1);
  assert.equal(deleteSummary({ ...spec, files: 1 }).files, "1 file");
  assert.equal(deleteSummary({ ...spec, files: undefined }).files, "");
  assert.equal(deleteSummary({ ...spec, detail: "" }).stage, SPEC_STATE_LABELS.building);
});

test("a fixed bug says so once: on its chip, in the delete dialog and on its grayed cards", () => {
  const fixed = { dir: "specs/old-bug", name: "old-bug", state: "fixed", detail: "bug fixed", files: 1, touched: 1 };
  assert.equal(deleteSummary(fixed).stage, "Bug fixed");
  const building = { dir: "specs/lunch-vote", name: "lunch-vote", state: "building", detail: "1 of 2 tasks done" };
  assert.equal(deleteSummary(building).stage, `${SPEC_STATE_LABELS.building}: 1 of 2 tasks done`);
  assert.equal(chipDetail(fixed), "");
  assert.equal(chipDetail(building), "1 of 2 tasks done");
  assert.equal(chipDetail({ ...building, detail: undefined }), "");
  assert.match(FIXED_REASON, /Delete button/);
  assert.doesNotMatch(FIXED_REASON, /✕/);
});

test("scanProject counts each spec's files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-scan-files-"));
  try {
    fakeSpec(root, "three", { "overview.md": "# o\n", "phase-1.md": "- [ ] **Task 1.1:** a\n", "pathfinder/map.md": "# m\n" });
    fakeSpec(root, "one", { "DESIGN.md": "# d\n" });
    const byName = Object.fromEntries(scanProject(root).specs.map((s) => [s.name, s]));
    assert.equal(byName.three.files, 3);
    assert.equal(byName.one.files, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("removeSpec deletes one spec folder and refuses everything else", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-remove-spec-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-remove-outside-"));
  try {
    fakeSpec(root, "keep", { "overview.md": "# keep\n" });
    fakeSpec(root, "gone", { "overview.md": "# gone\n", "pathfinder/map.md": "# m\n" });
    fs.mkdirSync(path.join(root, "specs--completed", "old"), { recursive: true });
    fs.writeFileSync(path.join(outside, "precious.md"), "do not touch\n");

    assert.deepEqual(removeSpec(root, "specs/gone"), { ok: true, removed: "specs/gone" });
    assert.equal(fs.existsSync(path.join(root, "specs", "gone")), false);
    assert.equal(fs.existsSync(path.join(root, "specs", "keep", "overview.md")), true);

    for (const bad of ["specs/../specs--completed/old", "specs--completed/old", "specs/keep/pathfinder", "specs/missing", "specs"]) {
      assert.throws(() => removeSpec(root, bad), Error, bad);
    }
    assert.equal(fs.existsSync(path.join(root, "specs--completed", "old")), true);

    // A spec folder that is a link to somewhere else is refused, and what it
    // points at survives.
    fs.symlinkSync(outside, path.join(root, "specs", "linked"), "junction");
    assert.throws(() => removeSpec(root, "specs/linked"), /outside|link/i);
    assert.equal(fs.existsSync(path.join(outside, "precious.md")), true);

    // A file named like a spec is not a spec folder.
    fs.writeFileSync(path.join(root, "specs", "note.md"), "x\n");
    assert.throws(() => removeSpec(root, "specs/note.md"), /folder/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("delete-spec removes a spec from the worktree it runs in, and exits 3 with the reason when it refuses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-delete-cli-"));
  try {
    fakeSpec(root, "scratch", { "overview.md": "# s\n" });
    const done = cli(["delete-spec", "--spec", "specs/scratch"], { cwd: root });
    assert.equal(done.status, 0, done.stderr);
    assert.equal(done.json.ok, true);
    assert.equal(done.json.removed, "specs/scratch");
    assert.equal(fs.existsSync(path.join(root, "specs", "scratch")), false);

    const refused = cli(["delete-spec", "--spec", "specs/../AGENTS.md"], { cwd: root, expectFail: true });
    assert.equal(refused.status, 3);
    assert.equal(refused.json.ok, false);
    assert.ok(refused.json.message);

    const usage = cli(["delete-spec"], { cwd: root, expectFail: true });
    assert.equal(usage.status, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// The dashboard's Git card offers to start a repository when the folder
// is not one. The scan answers that from the filesystem, never from a git
// process, and a linked worktree (a .git file, not a folder) must count.
test("scanProject reports isGit for a repo, a subfolder, a linked worktree and a plain folder", () => {
  const saved = {};
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"]) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-isgit-"));
  try {
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, "sub"), { recursive: true });
    const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    git(repo, "init", "-q");
    git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x");
    git(repo, "worktree", "add", "-q", path.join(base, "wt"));
    const plain = path.join(base, "plain");
    fs.mkdirSync(plain);

    assert.equal(scanProject(repo).isGit, true);
    assert.equal(scanProject(path.join(repo, "sub")).isGit, true);
    assert.equal(fs.statSync(path.join(base, "wt", ".git")).isFile(), true, "a linked worktree's .git is a file");
    assert.equal(scanProject(path.join(base, "wt")).isGit, true);
    assert.equal(scanProject(plain).isGit, false);
    assert.equal(insideGitRepo(plain), false);

    // When git is steered by the environment, git decides: count it as a repo.
    process.env.GIT_DIR = path.join(plain, "nowhere");
    assert.equal(insideGitRepo(plain), true);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("the Git card stays clickable outside a repository and says what happens", () => {
  const entry = SKILL_CATALOG.find((e) => e.skill === "plan2code-git");
  const outside = cardAvailability(entry, { hasAgents: true, isGit: false }, null);
  assert.equal(outside.on, true);
  assert.equal(outside.note, GIT_INIT_NOTE);
  for (const scan of [{ hasAgents: true, isGit: true }, { hasAgents: true }, null]) {
    const a = cardAvailability(entry, scan, null);
    assert.equal(a.on, true);
    assert.equal(a.note, undefined);
  }
  const scan = { hasAgents: true, isGit: false, specs: [] };
  assert.equal(cardPresentation(entry, scan, null).detail, GIT_INIT_NOTE);
  // The agent's own detail line still wins over the note.
  const withSpec = { hasAgents: true, isGit: false, specs: [{ dir: "specs/x", name: "x", state: "building" }] };
  const menu = { details: { "plan2code-git": "Two changes ready" } };
  assert.equal(cardPresentation(entry, withSpec, withSpec.specs[0], menu).detail, "Two changes ready");
});

test("the Git card is never grayed", () => {
  const entry = SKILL_CATALOG.find((e) => e.skill === "plan2code-git");
  const clean = cardAvailability(entry, { hasAgents: true, isGit: true, pending: 0 }, null);
  assert.equal(clean.on, true);
  assert.equal(clean.reason, undefined);
  const dirty = cardAvailability(entry, { hasAgents: true, isGit: true, pending: 3 }, null);
  assert.deepEqual(dirty, { on: true, note: "3 files to commit" });
  assert.equal(pendingNote(1), "1 file to commit");
  // git could not say: stay clickable, and no repository still offers git init.
  assert.deepEqual(cardAvailability(entry, { hasAgents: true, isGit: true, pending: null }, null), { on: true });
  assert.equal(cardAvailability(entry, { hasAgents: true, isGit: false, pending: 0 }, null).note, GIT_INIT_NOTE);
});

test("pendingFiles counts changed and untracked paths, and says null outside a repository", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-pending-"));
  const git = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  const repo = path.join(base, "repo");
  const plain = path.join(base, "plain");
  fs.mkdirSync(repo);
  fs.mkdirSync(plain);
  try {
    if (git("init", "-q").status !== 0) return; // no git on this machine
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "T");
    assert.equal(pendingFiles(repo), 0, "an empty repository is clean");
    fs.writeFileSync(path.join(repo, "a.txt"), "a");
    git("add", "a.txt");
    git("commit", "-q", "-m", "first");
    assert.equal(pendingFiles(repo), 0);
    fs.writeFileSync(path.join(repo, "a.txt"), "changed");
    fs.writeFileSync(path.join(repo, "b.txt"), "new");
    assert.equal(pendingFiles(repo), 2, "one modified, one untracked");
    git("add", "b.txt");
    assert.equal(pendingFiles(repo), 2, "staged counts too");
    assert.equal(scanProject(repo).pending, 2);
    assert.equal(scanProject(plain).pending, null, "no repository, no count");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("the commit offer is read from finish.commit and a pause never carries it", () => {
  assert.equal(commitOffer({ headline: "Done", commit: true }), true);
  assert.equal(commitOffer({ headline: "Done", commit: false }), false);
  assert.equal(commitOffer({ headline: "Done" }), false);
  assert.equal(commitOffer({ headline: "Paused here", commit: true }), false);
  assert.equal(commitOffer(null), false);
});

test("the changelog offer is read from finish.changelog and a pause never carries it", () => {
  assert.equal(changelogOffer({ headline: "Done", changelog: true }), true);
  assert.equal(changelogOffer({ headline: "Done", changelog: false }), false);
  assert.equal(changelogOffer({ headline: "Done" }), false);
  assert.equal(changelogOffer({ headline: "Paused here", changelog: true }), false);
  assert.equal(changelogOffer(null), false);
});

test("Continue here is offered for a skill command, with the spec it names, and never for a pause or a non-skill", () => {
  const offer = (command, rest = {}) => continueOffer({ headline: "Done", command, ...rest });
  assert.deepEqual(offer("/plan2code-2-document"), { skill: "plan2code-2-document", workflow: "document", spec: undefined });
  assert.deepEqual(offer("/plan2code-2-document --web"), { skill: "plan2code-2-document", workflow: "document", spec: undefined });
  assert.deepEqual(offer("/plan2code-3-implement specs/lunch-vote/overview.md --web"), {
    skill: "plan2code-3-implement",
    workflow: "implement",
    spec: "specs/lunch-vote",
  });
  assert.deepEqual(offer("/plan2code-2-document specs/lunch-vote/PLAN-DRAFT-20261019.md"), {
    skill: "plan2code-2-document",
    workflow: "document",
    spec: "specs/lunch-vote",
  });
  assert.equal(offer("/plan2code-4-finalize specs--completed/old/overview.md").spec, undefined);
  assert.equal(offer("/plan2code-3-implement specs/lunch-vote/overview.md", { headline: "Paused at Phase 2" }), null);
  assert.equal(offer("/plan2code"), null);
  assert.equal(offer("/plan2code --web"), null);
  assert.equal(offer("git add -A && git commit -m x -m y"), null);
  assert.equal(offer("/not-a-plan2code-skill"), null);
  assert.equal(offer(""), null);
  assert.equal(continueOffer(null), null);
});

test("the Continue here reply names the skill and its spec like a dashboard launch, in plain words", () => {
  const reply = continueReply({ skill: "plan2code-3-implement", workflow: "implement", spec: "specs/lunch-vote" });
  assert.equal(reply, "Start Implement (/plan2code-3-implement) for specs/lunch-vote, right here in this session.");
  assert.equal(
    continueReply({ skill: "plan2code-2-document", workflow: "document" }),
    "Start Document (/plan2code-2-document), right here in this session."
  );
  assert.doesNotMatch(reply, /(brief|recap|minutes)/i);
});

test("one press on a finish locks every offer button, even after the agent collects it", () => {
  // Nothing pressed: live unless a send is still being picked up.
  assert.deepEqual(afterFinishButton(null, "commit", false), { asked: false, disabled: false });
  assert.deepEqual(afterFinishButton(null, "commit", true), { asked: false, disabled: true });
  // Review pressed and collected (pendingResult false): Commit and the
  // dashboard stay locked while the review runs, not just until pickup.
  assert.deepEqual(afterFinishButton("review", "review", false), { asked: true, disabled: true });
  assert.deepEqual(afterFinishButton("review", "commit", false), { asked: false, disabled: true });
  assert.deepEqual(afterFinishButton("review", "dashboard", false), { asked: false, disabled: true });
  assert.deepEqual(afterFinishButton("commit", "review", false), { asked: false, disabled: true });
});

test("a verdict's button text never renders blank", () => {
  assert.equal(verdictText({ id: "approve", label: "Approve it" }), "Approve it");
  assert.equal(verdictText({ id: "approve", text: "Approve it" }), "Approve it");
  assert.equal(verdictText({ id: "approve" }), "approve");
  const item = { verdicts: [{ id: "changes", text: "Needs changes" }] };
  assert.equal(verdictLabel(item, "changes"), "Needs changes");
  assert.equal(verdictLabel({}, "approve"), "Looks good, go ahead");
});

test("the dashboard matrix lights only the cards a spec state allows", () => {
  const scan = { hasAgents: true };
  const sel = (state) => ({ dir: "specs/x", name: "x", state });
  const entry = (skill) => {
    const own = SKILL_CATALOG.find((e) => e.skill === skill);
    return own || launchVariant(SKILL_CATALOG.find((e) => e.review === skill), true);
  };
  const on = (skill, sc, s) => cardAvailability(entry(skill), sc, s).on;

  // AGENTS.md gates the setup pair, whatever the picker holds.
  assert.equal(on("plan2code-init", scan, null), false);
  assert.equal(on("plan2code-init-update", scan, null), true);
  assert.equal(on("plan2code-init", { hasAgents: false }, null), true);
  assert.equal(on("plan2code-init-update", { hasAgents: false }, null), false);

  // Utilities are always on.
  for (const s of [null, sel("exploring"), sel("built"), sel("unrecognized")]) {
    for (const u of ["plan2code-quick-task", "plan2code-review", "plan2code-handoff"]) {
      assert.equal(on(u, scan, s), true, `${u} on for ${s && s.state}`);
    }
  }

  // No spec (or an unrecognized one): Pathfinder, Plan and the utilities.
  for (const s of [null, sel("unrecognized")]) {
    for (const skill of ["plan2code-0-pathfinder", "plan2code-1-plan"]) {
      assert.equal(on(skill, scan, s), true, `${skill} on for ${s && s.state}`);
    }
    for (const skill of [
      "plan2code-1b-revise-plan",
      "plan2code-2-document",
      "plan2code-3-implement",
      "plan2code-3-implement-review",
      "plan2code-4-finalize",
    ]) {
      assert.equal(on(skill, scan, s), false, `${skill} off for ${s && s.state}`);
    }
  }

  assert.equal(on("plan2code-0-pathfinder", scan, sel("exploring")), true);
  assert.equal(on("plan2code-1-plan", scan, sel("exploring")), false);
  assert.equal(on("plan2code-0-pathfinder", scan, sel("mapped")), false);
  assert.equal(on("plan2code-1-plan", scan, sel("mapped")), true);
  assert.equal(on("plan2code-2-document", scan, sel("planned")), true);
  for (const s of [sel("documented"), sel("building")]) {
    for (const skill of ["plan2code-3-implement", "plan2code-3-implement-review", "plan2code-1b-revise-plan"]) {
      assert.equal(on(skill, scan, s), true, `${skill} on for ${s.state}`);
    }
  }
  // Revise stays lit on a built spec: a change found in the last manual checks is still a plan change.
  assert.equal(on("plan2code-1b-revise-plan", scan, sel("built")), true);
  assert.equal(on("plan2code-4-finalize", scan, sel("built")), true);

  // A diagnosed bug: Quick Task (its next step) and Plan, never the build steps.
  for (const skill of ["plan2code-quick-task", "plan2code-1-plan", "plan2code-review", "plan2code-diagnose"]) {
    assert.equal(on(skill, scan, sel("diagnosed")), true, `${skill} on for a diagnosed bug`);
  }
  for (const skill of [
    "plan2code-0-pathfinder",
    "plan2code-1b-revise-plan",
    "plan2code-2-document",
    "plan2code-3-implement",
    "plan2code-3-implement-review",
    "plan2code-4-finalize",
  ]) {
    assert.equal(on(skill, scan, sel("diagnosed")), false, `${skill} off for a diagnosed bug`);
  }
  assert.equal(cardAvailability(entry("plan2code-quick-task"), scan, sel("diagnosed")).next, true);
  assert.ok(!cardAvailability(entry("plan2code-1-plan"), scan, sel("diagnosed")).next);
  assert.ok(!cardAvailability(entry("plan2code-quick-task"), scan, sel("building")).next);

  // Quick Task carries the folder only for a diagnosed bug; spec cards always do.
  assert.equal(launchTarget(entry("plan2code-quick-task"), sel("diagnosed")).dir, "specs/x");
  assert.equal(launchTarget(entry("plan2code-quick-task"), sel("building")), null);
  assert.equal(launchTarget(entry("plan2code-1-plan"), sel("diagnosed")).dir, "specs/x");
  assert.equal(launchTarget(entry("plan2code-review"), sel("diagnosed")), null);
  assert.equal(launchTarget(entry("plan2code-1-plan"), null), null);

  // A fixed bug is finished: no pipeline card, and Quick Task starts fresh.
  for (const skill of [
    "plan2code-0-pathfinder",
    "plan2code-1-plan",
    "plan2code-1b-revise-plan",
    "plan2code-2-document",
    "plan2code-3-implement",
    "plan2code-3-implement-review",
    "plan2code-4-finalize",
  ]) {
    const av = cardAvailability(entry(skill), scan, sel("fixed"));
    assert.equal(av.on, false, `${skill} off for a fixed bug`);
    assert.ok(av.reason, `${skill} says why it is off for a fixed bug`);
  }
  assert.equal(on("plan2code-quick-task", scan, sel("fixed")), true);
  assert.ok(!cardAvailability(entry("plan2code-quick-task"), scan, sel("fixed")).next);
  assert.equal(launchTarget(entry("plan2code-quick-task"), sel("fixed")), null);

  // A grayed card always says why, and a selected spec's next step is marked.
  assert.ok(cardAvailability(entry("plan2code-3-implement"), scan, sel("exploring")).reason);
  assert.equal(cardAvailability(entry("plan2code-3-implement"), scan, sel("documented")).next, true);
  assert.ok(!cardAvailability(entry("plan2code-1-plan"), scan, sel("documented")).next);
});

test("dashboard card presentation follows the current picker selection", () => {
  const scan = {
    hasAgents: true,
    specs: [
      { dir: "specs/current", name: "current", state: "documented", detail: "2 phases, 8 tasks ready" },
      { dir: "specs/planned", name: "planned", state: "planned", detail: "plan drafted" },
    ],
  };
  const menu = {
    recommend: "plan2code-3-implement",
    details: { "plan2code-3-implement": "Phase 1 of 2 is next" },
  };
  const entry = (skill) => SKILL_CATALOG.find((e) => e.skill === skill);

  const current = cardPresentation(entry("plan2code-3-implement"), scan, scan.specs[0], menu);
  assert.equal(current.recommended, true);
  assert.equal(current.detail, "Phase 1 of 2 is next");

  const stale = cardPresentation(entry("plan2code-3-implement"), scan, null, menu);
  assert.equal(stale.on, false);
  assert.equal(stale.recommended, false);
  assert.equal(stale.detail, "");

  const fresh = cardPresentation(entry("plan2code-0-pathfinder"), scan, null, menu);
  assert.equal(fresh.on, true);
  assert.equal(fresh.recommended, true);

  const planned = cardPresentation(entry("plan2code-2-document"), scan, scan.specs[1], menu);
  assert.equal(planned.on, true);
  assert.equal(planned.recommended, true);
  assert.equal(planned.detail, "plan drafted");
});

test("the picker never opens on a fixed bug", () => {
  const fixed = { dir: "specs/old-bug", name: "old-bug", state: "fixed", detail: "bug fixed" };
  const live = { dir: "specs/lunch-vote", name: "lunch-vote", state: "documented", detail: "2 phases, 8 tasks ready" };
  assert.equal(defaultSpec([fixed, live]), live);
  assert.equal(defaultSpec([live, fixed]), live);
  assert.equal(defaultSpec([fixed]), null);
  assert.equal(defaultSpec([]), null);
  assert.equal(defaultSpec(undefined), null);

  // The agent's recommendation describes the default pick, not the fixed bug
  // the server listed first.
  const entry = (skill) => SKILL_CATALOG.find((e) => e.skill === skill);
  const scan = { hasAgents: true, specs: [fixed, live] };
  const menu = { recommend: "plan2code-3-implement", details: { "plan2code-3-implement": "Phase 1 of 2 is next" } };
  const shown = cardPresentation(entry("plan2code-3-implement"), scan, live, menu);
  assert.equal(shown.recommended, true);
  assert.equal(shown.detail, "Phase 1 of 2 is next");
  // Only fixed bugs on disk: the default is "start from scratch".
  const onlyFixed = { hasAgents: true, specs: [fixed] };
  const fresh = cardPresentation(entry("plan2code-0-pathfinder"), onlyFixed, null, { recommend: "plan2code-0-pathfinder" });
  assert.equal(fresh.recommended, true);
});

test("the launch reply names the picked spec", () => {
  const e = SKILL_CATALOG.find((x) => x.skill === "plan2code-3-implement");
  assert.equal(
    launchReply(e, { dir: "specs/lunch-vote" }),
    "Start Implement (/plan2code-3-implement) for specs/lunch-vote, right here in this session."
  );
  assert.equal(launchReply(e), "Start Implement (/plan2code-3-implement), right here in this session.");
  assert.equal(launchReply(e, null), launchReply(e));
  assert.doesNotMatch(launchReply(e, { dir: "specs/x" }), /\b(brief|recap|minutes)\b/i);
});

/* ------------------------------------------------------ fast start path */

// The roots used to come from two `git rev-parse` processes, 150ms+ each on
// Windows, on every `open`. They are read off the filesystem now, and must
// land on exactly what git says, or sessions stop sharing a handle space.
test("repoRoots matches git for a repo, a subdirectory, a linked worktree and a plain folder", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-roots-"));
  const repo = path.join(base, "repo");
  fs.mkdirSync(path.join(repo, "sub", "deeper"), { recursive: true });
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  git(repo, "init", "-q");
  git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x");
  git(repo, "worktree", "add", "-q", path.join(base, "wt"));
  const plain = path.join(base, "plain");
  fs.mkdirSync(plain);

  const viaGit = (cwd) => {
    const [common, top] = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir", "--show-toplevel").split(/\r?\n/);
    return { project: fs.realpathSync(path.dirname(common)), worktree: fs.realpathSync(top) };
  };
  for (const cwd of [repo, path.join(repo, "sub", "deeper"), path.join(base, "wt")]) {
    const { project, worktree } = repoRoots(cwd);
    assert.deepEqual({ project, worktree }, viaGit(cwd), cwd);
  }
  // The worktree shares the main checkout's project key but scans its own disk.
  assert.equal(repoRoots(path.join(base, "wt")).project, repoRoots(repo).project);
  assert.notEqual(repoRoots(path.join(base, "wt")).worktree, repoRoots(repo).worktree);
  // Not a repository at all: both roots are the folder itself, spelled out in
  // full the way git spells a repo. The temp dir sits outside any checkout,
  // so the walk has nothing to find.
  const full = fs.realpathSync.native(plain);
  assert.deepEqual(repoRoots(plain), { project: full, worktree: full, branch: "" });
  fs.rmSync(base, { recursive: true, force: true });
});

/* ------------------------------------------------- roles and templates */

const ROLE_IDS = ROLES.map((r) => r.id);
const TEMPLATE_SET_SIZE = { pathfinder: 8, plan: 10, "quick-task": 10 };

test("normalizeRole keeps a known role and turns anything else into Not set", () => {
  for (const id of ROLE_IDS) assert.equal(normalizeRole(id), id);
  for (const v of ["none", undefined, null, 42, "ENGINEER", "cto"]) assert.equal(normalizeRole(v), ROLE_NOT_SET);
  assert.equal(ROLE_NOT_SET, "none");
  assert.deepEqual(ROLE_IDS, ["engineer", "pm", "architect", "designer", "qa", "em"]);
});

test("needsRoleNudge: only a missing role key nudges, whatever the value once it is there", () => {
  for (const looks of [null, undefined, {}, { theme: "dark" }]) assert.equal(needsRoleNudge(looks), true);
  for (const looks of [{ role: "none" }, { role: "pm" }, { role: "garbage" }]) assert.equal(needsRoleNudge(looks), false);
});

test("TEMPLATES: nineteen non-empty texts, the six Pathfinder and Plan share held once", () => {
  const ids = Object.keys(TEMPLATES);
  assert.equal(ids.length, 19);
  for (const id of ids) {
    assert.equal(TEMPLATES[id].id, id);
    assert.ok(TEMPLATES[id].text.trim(), `${id} has text`);
    assert.ok(!TEMPLATES[id].text.endsWith("\n"), `${id} has no trailing newline`);
  }
  const shared = TEMPLATE_ORDERS.pathfinder.engineer.filter((id) => TEMPLATE_ORDERS.plan.engineer.includes(id));
  assert.deepEqual(
    [...shared].sort(),
    ["design-decision", "engineering-spec", "integration", "product-requirements", "scoping-rollout", "test-strategy"]
  );
  const labels = Object.values(TEMPLATES).map((t) => t.label);
  assert.equal(new Set(labels).size, labels.length, "no template is held twice under another id");
  const textIn = (wf, id) => templatesFor(wf, "engineer").find((t) => t.id === id).text;
  for (const id of shared) {
    assert.equal(textIn("pathfinder", id), textIn("plan", id), `${id} reads the same in Pathfinder and Plan`);
  }
});

test("TEMPLATES: Markdown sections, a ## heading first and an answer under every heading", () => {
  for (const { id, text } of Object.values(TEMPLATES)) {
    const lines = text.split("\n");
    assert.ok(lines[0].startsWith("## "), `${id} opens on a ## heading`);
    lines.forEach((line, i) => {
      assert.equal(line, line.trimEnd(), `${id} line ${i + 1} has no trailing space`);
      if (!line.startsWith("## ")) return;
      assert.ok(line.slice(3).trim(), `${id} line ${i + 1} names its heading`);
      assert.ok(lines[i + 1]?.trim() && !lines[i + 1].startsWith("#"), `${id}: "${line}" has its answer on the next line`);
      if (i > 0) assert.equal(lines[i - 1], "", `${id}: a blank line comes before "${line}"`);
    });
    for (const l of lines) {
      assert.ok(!/^[A-Z][\w' ]*:\s*\[/.test(l), `${id}: "${l}" is a Markdown section, not a Label: [blank] line`);
      assert.ok(!/\S\s+[A-Z][\w' ]*:\s*\[/.test(l), `${id}: "${l}" puts one answer on a line`);
    }
  }
});

test("TEMPLATE_ORDERS: every role holds exactly its skill's set, and Quick Task never writes to specs/", () => {
  assert.deepEqual([...TEMPLATE_WORKFLOWS], ["pathfinder", "plan", "quick-task"]);
  for (const wf of TEMPLATE_WORKFLOWS) {
    const set = [...TEMPLATE_ORDERS[wf].engineer].sort();
    assert.deepEqual(Object.keys(TEMPLATE_ORDERS[wf]).sort(), [...ROLE_IDS].sort(), `${wf} has one order per role, no "none"`);
    for (const r of ROLE_IDS) {
      const order = TEMPLATE_ORDERS[wf][r];
      assert.equal(order.length, TEMPLATE_SET_SIZE[wf], `${wf}/${r} size`);
      assert.equal(new Set(order).size, order.length, `${wf}/${r} has no duplicates`);
      for (const id of order) assert.ok(TEMPLATES[id], `${wf}/${r}: ${id} exists`);
      assert.deepEqual([...order].sort(), set, `${wf}/${r} holds the same set`);
    }
  }
  for (const id of TEMPLATE_ORDERS["quick-task"].engineer) {
    assert.ok(!TEMPLATES[id].text.includes("specs/"), `${id} must not point at specs/`);
  }
});

test("templatesFor: Blank first, Not set reads as Engineer, and only a chosen role gets For your role", () => {
  for (const wf of TEMPLATE_WORKFLOWS) {
    const none = templatesFor(wf, "none");
    assert.deepEqual(none[0], { id: "blank", label: "Blank", text: "" });
    assert.equal(none.length, TEMPLATE_SET_SIZE[wf] + 1);
    const ids = (row) => row.map((t) => t.id);
    assert.deepEqual(ids(templatesFor(wf, "cto")), ids(none));
    assert.deepEqual(ids(templatesFor(wf, "engineer")), ids(none));
    assert.ok(none.every((t) => !t.forYou), "Not set marks nothing");
    assert.ok(templatesFor(wf, undefined).every((t) => !t.forYou), "an unknown role marks nothing");
    for (const r of ROLE_IDS) {
      const row = templatesFor(wf, r);
      assert.deepEqual(ids(row).slice(1), [...TEMPLATE_ORDERS[wf][r]]);
      assert.deepEqual(row.map((t) => Boolean(t.forYou)), row.map((_, i) => i === 1), `${wf}/${r} marks only the first template`);
    }
  }
  const row = templatesFor("plan", "pm");
  row[1].text = "changed";
  assert.notEqual(TEMPLATES[row[1].id].text, "changed", "fresh objects, never the constants");
  assert.deepEqual(templatesFor("document", "engineer"), []);
});

test("templateSwap: an empty or untouched box swaps silently, anything typed asks first", () => {
  const next = "Next template";
  assert.deepEqual(templateSwap({ selectedText: "A", boxText: "", nextText: next }), { text: next, confirm: false });
  assert.deepEqual(templateSwap({ selectedText: "A", boxText: "A", nextText: next }), { text: next, confirm: false });
  assert.deepEqual(templateSwap({ selectedText: "A", boxText: "   \n", nextText: next }), { text: next, confirm: false });
  assert.deepEqual(templateSwap({ selectedText: "A", boxText: "A and more", nextText: next }), { text: next, confirm: true });
  assert.deepEqual(templateSwap({ boxText: "typed", nextText: next }), { text: next, confirm: true });
  assert.deepEqual(templateSwap({}), { text: "", confirm: false });
});

/* ------------------------------- starters, validation and attachment names */

const CONSOLE_WORKFLOW_LIST = [
  "dashboard",
  "init",
  "init-update",
  "pathfinder",
  "quick-task",
  "plan",
  "revise-plan",
  "document",
  "implement",
  "implement-review",
  "review",
  "finalize",
  "handoff",
  "xray",
  "diagnose",
];

test("STARTER_SETS: 3 to 4 starters a set, one without context at least, known lead roles, unique ids", () => {
  const ids = new Set();
  for (const [setId, set] of Object.entries(STARTER_SETS)) {
    assert.ok(set.length >= 3 && set.length <= 4, `${setId} has 3 to 4 starters`);
    assert.ok(set.some((s) => !s.needsContext), `${setId} works with no context attached`);
    for (const s of set) {
      assert.ok(s.text.trim() && !s.text.includes("🔗"), `${s.id} has clean text`);
      for (const r of s.lead) assert.ok(ROLE_IDS.includes(r), `${s.id} leads for a real role (${r})`);
      assert.ok(!ids.has(s.id), `${s.id} is unique`);
      ids.add(s.id);
    }
  }
  for (const wf of CONSOLE_WORKFLOW_LIST) {
    const setId = Object.hasOwn(STARTER_SET_FOR, wf) ? STARTER_SET_FOR[wf] : "general";
    assert.ok(STARTER_SETS[setId], `${wf} resolves to a set`);
  }
  for (const wf of ["init", "init-update", "revise-plan", "finalize", "handoff"]) {
    assert.ok(!Object.hasOwn(STARTER_SET_FOR, wf), `${wf} uses general`);
  }
  const general = STARTER_SETS.general.map((s) => s.id);
  assert.deepEqual(startersFor("nonsense", "engineer", { hasContext: true }).map((s) => s.id).sort(), [...general].sort());
  assert.deepEqual(startersFor("constructor", "engineer").map((s) => s.id).sort(), [...general].sort());
});

test("startersFor: context starters wait for context, the role's leads come first, written order holds", () => {
  const needs = new Set(Object.values(STARTER_SETS).flat().filter((s) => s.needsContext).map((s) => s.id));
  for (const wf of CONSOLE_WORKFLOW_LIST) {
    for (const r of [...ROLE_IDS, "none"]) {
      assert.ok(startersFor(wf, r, { hasContext: false }).every((s) => !needs.has(s.id)), `${wf}/${r} without context`);
    }
  }
  assert.ok(startersFor("plan", "qa", { hasContext: true }).some((s) => needs.has(s.id)));
  assert.equal(startersFor("plan", "qa", { hasContext: true })[0].text, "How would we test this?");
  assert.deepEqual(startersFor("plan", "none", { hasContext: true }), startersFor("plan", "engineer", { hasContext: true }));
  assert.deepEqual(startersFor("plan", undefined), startersFor("plan", "engineer"));
  assert.deepEqual(
    startersFor("plan", "engineer", { hasContext: true }).map((s) => s.id),
    ["plan-files", "plan-test", "plan-risks", "plan-plain"],
    "Engineer leads for files and test, in written order"
  );
  assert.deepEqual(
    startersFor("plan", "em", { hasContext: true }).map((s) => s.id),
    ["plan-risks", "plan-plain", "plan-files", "plan-test"],
    "each group keeps written order"
  );
  const one = startersFor("build", "qa", { hasContext: true })[0];
  assert.deepEqual(Object.keys(one).sort(), ["id", "text"], "no lead or needsContext leaks out");
});

test("no starter steers the workflow: approve, skip, commit, run, execute, delete or answering a card", () => {
  const steering = /\b(approve|skip|commit|run|execute|delete|answer (the|this) card)\b/i;
  for (const s of Object.values(STARTER_SETS).flat()) assert.ok(!steering.test(s.text), `${s.id}: ${s.text}`);
});

test("validate: templates only as \"idea\", only on a text item", () => {
  const item = (extra) => ({ items: [{ id: "idea", kind: "text", title: "What's the idea?", ...extra }] });
  const message = 'item "idea" has "templates": only a text item can carry it, and its only value is "idea".';
  assert.deepEqual(validate(item({ templates: "idea" })), []);
  assert.deepEqual(validate(item({})), []);
  assert.ok(validate(item({ kind: "choice", options: [{ k: "A", text: "a" }], templates: "idea" })).includes(message));
  assert.ok(validate(item({ templates: "yes" })).includes(message));
});

test("attachmentName: slug of the original name, 8 characters of the upload id, the upload's own extension", () => {
  const up = (uuid, ext) => path.join(HOME, "sessions", "x", "uploads", `${uuid}${ext}`);
  const a = up("3f2b9c1e-8a4d-4f6e-9b7a-2c5d1e0f4a6b", ".jpg");
  assert.equal(attachmentName({ upload: a, name: "Header Shot.png" }), "header-shot-3f2b9c1e.jpg");
  assert.equal(attachmentName({ upload: up("7c1d0a4e-5b2f", ".PDF"), name: "" }), "attachment-7c1d0a4e.pdf");
  assert.equal(attachmentName({ upload: up("7c1d0a4e-5b2f", ".pdf"), name: "!!!.pdf" }), "attachment-7c1d0a4e.pdf");
  const long = attachmentName({ upload: a, name: `${"abcdefghi ".repeat(6)}.txt` });
  const slug = long.slice(0, -"-3f2b9c1e.jpg".length);
  assert.ok(slug.length <= 40, "cut to 40");
  assert.ok(!slug.endsWith("-"), "no trailing dash after the cut");
  assert.equal(slug, "abcdefghi-abcdefghi-abcdefghi-abcdefghi");
  const b = up("9a8b7c6d-0000-4000-8000-000000000000", ".jpg");
  assert.notEqual(attachmentName({ upload: a, name: "shot.png" }), attachmentName({ upload: b, name: "shot.png" }));
  assert.equal(attachmentName({ upload: a, name: "shot.png" }), attachmentName({ upload: a, name: "shot.png" }));
});

test("keep copies a cited upload into specs/<idea>/attachments/, reuses it, links from --from, and refuses what it should", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-keep-project-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-keep-outside-"));
  const keepSid = "20260927-120000-abcdef";
  const session = path.join(HOME, "sessions", keepSid);
  const uploads = path.join(session, "uploads");
  fs.mkdirSync(uploads, { recursive: true });
  fs.writeFileSync(path.join(session, "state.json"), JSON.stringify({ sid: keepSid, project }));
  const jpg = path.join(uploads, "3f2b9c1e-8a4d-4f6e-9b7a-2c5d1e0f4a6b.jpg");
  const pdf = path.join(uploads, "7c1d0a4e-5b2f-4e8a-9d3c-1f6e2b8a0c5d.pdf");
  fs.writeFileSync(jpg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  fs.writeFileSync(pdf, "%PDF-1.4 test");
  const keep = (extra) => cli(["keep", "--session", keepSid, ...extra], { expectFail: true });
  const attachments = path.join(project, "specs", "idea", "attachments");
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? [full, ...walk(full)] : [full];
    });
  const listing = () => [project, outside].flatMap(walk).sort();

  try {
    const first = keep(["--upload", jpg, "--name", "Header Shot.png", "--spec", "specs/idea"]);
    assert.equal(first.status, 0, first.stderr);
    const target = path.join(attachments, "header-shot-3f2b9c1e.jpg");
    assert.deepEqual(first.json, {
      ok: true,
      path: "specs/idea/attachments/header-shot-3f2b9c1e.jpg",
      link: "attachments/header-shot-3f2b9c1e.jpg",
      image: true,
      reused: false,
    });
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(jpg));

    const again = keep(["--upload", jpg, "--name", "Header Shot.png", "--spec", "specs/idea"]);
    assert.equal(again.status, 0, again.stderr);
    assert.equal(again.json.reused, true);
    assert.deepEqual(fs.readdirSync(attachments), ["header-shot-3f2b9c1e.jpg"]);

    const from = "specs/idea/pathfinder/questions/04-x.md";
    const nested = keep(["--upload", jpg, "--name", "Header Shot.png", "--spec", "specs/idea", "--from", from]);
    assert.equal(nested.json.link, "../../attachments/header-shot-3f2b9c1e.jpg");
    assert.equal(path.resolve(path.dirname(path.join(project, from)), nested.json.link), target);

    const doc = keep(["--upload", pdf, "--name", "api-spec.pdf", "--spec", "specs/idea"]);
    assert.equal(doc.status, 0, doc.stderr);
    assert.equal(doc.json.image, false);
    assert.equal(path.extname(doc.json.path), ".pdf");
    assert.ok(fs.existsSync(path.join(attachments, "api-spec-7c1d0a4e.pdf")));

    const events = fs.readFileSync(path.join(session, "events.ndjson"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(events.some((e) => e.type === "keep" && e.id === "3f2b9c1e-8a4d-4f6e-9b7a-2c5d1e0f4a6b" && e.path === first.json.path));

    const stray = path.join(outside, "stray.jpg");
    fs.writeFileSync(stray, "not an upload");
    const before = listing();
    const refusals = [
      [["--upload", stray, "--name", "s.jpg", "--spec", "specs/idea"], "upload is not in this session's uploads folder"],
      [["--upload", jpg, "--name", "s.jpg", "--spec", "../x"], "spec folder is outside the project"],
      [["--upload", jpg, "--name", "s.jpg", "--spec", path.join(outside, "specs", "idea")], "spec folder is outside the project"],
      [["--upload", path.join(uploads, "00000000-0000-4000-8000-000000000000.jpg"), "--name", "s.jpg", "--spec", "specs/idea"], "no such upload"],
    ];
    for (const [extra, message] of refusals) {
      const res = keep(extra);
      assert.equal(res.status, 3, `${extra.join(" ")}: ${res.stderr}`);
      assert.equal(res.stderr.trim(), `console: ${message}`);
    }
    assert.deepEqual(listing(), before, "no file written on a refusal");

    fs.mkdirSync(path.join(outside, "linked"));
    fs.symlinkSync(path.join(outside, "linked"), path.join(project, "specs", "linked"), "junction");
    const linked = keep(["--upload", jpg, "--name", "s.jpg", "--spec", "specs/linked/idea"]);
    assert.equal(linked.status, 3, linked.stderr);
    assert.equal(linked.stderr.trim(), "console: spec folder is outside the project");
    assert.deepEqual(fs.readdirSync(path.join(outside, "linked")), [], "nothing written through the link");

    assert.equal(keep(["--upload", jpg, "--spec", "specs/idea"]).status, 2);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(session, { recursive: true, force: true });
  }
});

/* ------------------------------------------ workspace, meter, mentions */

test("meter: levels, ring, fold and tooltip wording", () => {
  for (const p of [0, 4]) assert.equal(levelFor(p), "green", `${p} points`);
  for (const p of [5, 9]) assert.equal(levelFor(p), "yellow", `${p} points`);
  for (const p of [10, 15]) assert.equal(levelFor(p), "red", `${p} points`);
  assert.deepEqual([0, 6, 15, 20].map(ringFraction), [0, 0.4, 1, 1]);
  assert.equal(ringFraction(-3), 0);

  assert.equal(pointsFrom([{ kind: "launch", id: "L1", workflow: "plan" }]), 2);
  assert.equal(pointsFrom([{ kind: "launch", id: "L1", workflow: "pathfinder" }]), 0);
  assert.equal(pointsFrom([{ kind: "launch", id: "L1", workflow: "dashboard" }]), 0);
  assert.equal(pointsFrom([{ kind: "run", id: "L1:p1", event: "implement-review-phase" }]), 3);
  assert.equal(pointsFrom([{ kind: "run", id: "L1:review", event: "review" }]), 2, "a review run on the page after a build");
  assert.equal(
    pointsFrom([
      { kind: "run", id: "L1:p1", event: "implement-phase" },
      { kind: "run", id: "L1:p1", event: "implement-phase" },
    ]),
    2,
    "a duplicated id counts once"
  );
  assert.equal(pointsFrom([{ kind: "folder-issue", id: "L1:api", name: "api", reason: "denied" }]), 0);

  assert.equal(tooltipFor(1), "This session is fresh (1 point).");
  assert.match(tooltipFor(5), /getting long \(5 points\)/);
  assert.match(tooltipFor(10), /done a lot \(10 points\)/);
  assert.deepEqual(meterView([{ kind: "launch", id: "L1", workflow: "document" }]), {
    points: 2,
    level: "green",
    fraction: 2 / 15,
    words: "Session: fresh",
    tooltip: "This session is fresh (2 points).",
    items: [{ label: "Document started", points: 2 }],
  });
});

test("meter: the breakdown lists each scoring entry once and sums to the total", () => {
  const entries = [
    { kind: "launch", id: "L1", workflow: "dashboard" },
    { kind: "launch", id: "L2", workflow: "quick-task" },
    { kind: "run", id: "L2:phase-2", event: "implement-phase" },
    { kind: "run", id: "L2:phase-2", event: "implement-phase" },
    { kind: "run", id: "L2:handoff", event: "handoff" },
    { kind: "folder-issue", id: "L2:api", name: "api", reason: "denied" },
  ];
  assert.deepEqual(breakdownFrom(entries), [
    { label: "Quick task started", points: 1 },
    { label: "Implement phase built: phase-2", points: 2 },
  ]);
  assert.equal(pointsFrom(entries), breakdownFrom(entries).reduce((n, r) => n + r.points, 0));
  assert.deepEqual(breakdownFrom(null), []);
});

test("meter: a built phase scores by the tasks it completed", () => {
  // One point per 3 tasks, rounded up; Implement + Review adds 1 for the review.
  assert.deepEqual([1, 3, 4, 6, 9, 12, 18].map((n) => runPoints("implement-phase", n)), [1, 1, 2, 2, 3, 4, 6]);
  assert.deepEqual([1, 6, 12].map((n) => runPoints("implement-review-phase", n)), [2, 3, 5]);
  // No count, or a bad one, falls back to the flat weight.
  for (const bad of [undefined, 0, -2, 2.5, "9", 1000]) {
    assert.equal(runPoints("implement-phase", bad), WEIGHTS["implement-phase"], `tasks ${bad}`);
  }
  assert.equal(runPoints("review", 30), WEIGHTS.review, "tasks only scales a built phase");

  const entries = [
    { kind: "run", id: "L1:phase-1", event: "implement-phase", tasks: 3 },
    { kind: "run", id: "L2:phase-2", event: "implement-phase", tasks: 14 },
    { kind: "run", id: "L3:phase-3", event: "implement-review-phase", tasks: 1 },
  ];
  assert.deepEqual(breakdownFrom(entries), [
    { label: "Implement phase built: phase-1 (3 tasks)", points: 1 },
    { label: "Implement phase built: phase-2 (14 tasks)", points: 5 },
    { label: "Implement + Review phase built: phase-3 (1 task)", points: 2 },
  ]);
  assert.equal(levelFor(pointsFrom(entries)), "yellow", "one big phase can yellow a session alone");
});

test("meter: a build scores its tasks as it goes, and the approved phase takes the row over", () => {
  const run = (event, id, extra = {}) => ({ kind: "run", id: `L1:${id}`, event, workflow: "implement-review", ...extra });
  const ledger = [{ kind: "launch", id: "L1", workflow: "implement-review" }];
  const tick = (cleared) => {
    const e = progressEntry(ledger, "L1", "implement-review", cleared);
    if (e) ledger.push(e);
    return e;
  };
  assert.equal(tick(0), null, "the first build needs no reset");
  for (let n = 1; n <= 17; n++) tick(n);
  assert.equal(tick(17), null, "the same count posted again adds nothing");
  assert.equal(tick(9), null, "a lower count adds nothing");
  assert.deepEqual(breakdownFrom(ledger), [{ label: "Implement + Review: 17 tasks built so far", points: 6 }]);

  ledger.push(run("review", "review"));
  ledger.push(run("review", "review-again"));
  assert.equal(pointsFrom(ledger), 7, "the built-in review scores its 1 once, not a Review's 2");
  ledger.push(run("implement-review-phase", "phase-6", { tasks: 17 }));
  assert.deepEqual(breakdownFrom(ledger), [
    { label: "Implement + Review phase built: phase-6 (17 tasks)", points: 6 },
    { label: "Implement + Review: code review run", points: 1 },
  ], "the phase took its build's row over and left the review's point out");
  assert.equal(pointsFrom(ledger), 7);

  assert.equal(tick(17), null, "the finished phase's count posted again opens nothing");
  assert.equal(tick(2), null, "nor does a count before the next phase resets to 0");
  assert.equal(tick(0).tasks, 0);
  tick(2);
  assert.equal(pointsFrom(ledger), 8, "the next phase in the same run counts afresh");

  assert.equal(progressEntry([], "L1", "plan", 3), null, "only builds count progress");
  assert.equal(progressEntry([], "L1", "implement", 2.5), null);
  assert.equal(progressEntry([], "L1", "implement", 1000), null);
  // A phase that ends below its progress (blocked tasks) never takes points back.
  assert.equal(pointsFrom([
    { kind: "progress", id: "L1:b0:9", build: "L1:b0", workflow: "implement", tasks: 9 },
    { kind: "run", id: "L1:phase-1", event: "implement-phase", workflow: "implement", tasks: 5 },
  ]), 3);
  // Implement's own review verdict is an extra review and still scores 2.
  assert.equal(pointsFrom([{ kind: "run", id: "L1:review", event: "review", workflow: "implement" }]), 2);
});

test("meter: a build post's headline.cleared reaches the ledger as progress", () => {
  const res = cli(["open", "--workflow", "implement", "--title", "Meter: Phase 1", "--no-open"]);
  const s = { sid: res.json.sid, session: res.json.session };
  try {
    const points = () => meterView(readLedger(s.session)).points;
    assert.equal(postPatch(s, { headline: { stage: "Phase 1", cleared: 0, total: 7 } }).status, 0);
    assert.equal(postPatch(s, { headline: { cleared: 4 } }).status, 0);
    assert.equal(points(), 2, "4 tasks built so far");
    assert.equal(postPatch(s, { headline: { cleared: 4 } }).status, 0);
    assert.equal(readLedger(s.session).filter((e) => e.kind === "progress").length, 1, "a repeat writes nothing");
    assert.equal(postPatch(s, { headline: { cleared: 7 }, run: { event: "implement-phase", id: "phase-1", tasks: 7 } }).status, 0);
    assert.equal(points(), 3, "the phase's run took over: 7 tasks score 3, not 3 + 3");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("meter: answers score per skill run, one point per two, rounded down", () => {
  assert.equal(ANSWERS_PER_POINT, 2);
  const answer = (launch, i, workflow) => ({ kind: "answer", id: `${launch}:answer:t:${i}`, workflow });
  const entries = [
    { kind: "launch", id: "L1", workflow: "pathfinder" },
    ...["q1", "q2", "q3", "q4", "q5"].map((i) => answer("L1", i, "pathfinder")),
    { kind: "run", id: "L1:map", event: "pathfinder-chart" },
    { kind: "run", id: "L1:q1", event: "pathfinder-question" },
    { kind: "run", id: "L1:q6", event: "pathfinder-research" },
    { kind: "run", id: "L1:q6", event: "pathfinder-research" },
    { kind: "launch", id: "L2", workflow: "quick-task" },
    answer("L2", "c1", "quick-task"),
    answer("L2", "c1", "quick-task"),
    { kind: "launch", id: "L3", workflow: "plan" },
    answer("L3", "p1", "plan"),
  ];
  assert.deepEqual(breakdownFrom(entries), [
    { label: "5 answers in Pathfinder", points: 2 },
    { label: "Pathfinder map written: map", points: 2 },
    { label: "Pathfinder research done: q6", points: 1 },
    { label: "Quick task started", points: 1 },
    { label: "Plan started", points: 2 },
  ], "a duplicate id counts once, a lone answer scores nothing, a settled question scores nothing");
  const more = [...entries, answer("L3", "p2", "plan"), answer("L3", "p1-again", "plan")];
  assert.deepEqual(breakdownFrom(more).at(-1), { label: "3 answers in Plan", points: 1 });
  assert.equal(pointsFrom(more), 9);
});

test("workspace: default names, name rules and the free-name suggestion", () => {
  assert.equal(defaultName("C:\\git\\My Repo_v2"), "my-repo-v2");
  assert.equal(defaultName("/home/sam/api/"), "api");
  assert.equal(defaultName("!!!"), "folder");
  assert.equal(defaultName("x".repeat(60)).length, NAME_MAX);

  assert.equal(nameProblem("api-2"), null);
  for (const bad of ["Bad", "a--b", "", "a".repeat(41)]) assert.equal(nameProblem(bad), "bad-name", JSON.stringify(bad));

  assert.equal(freeName("api", new Set(["web"])), "api");
  assert.equal(freeName("api", new Set(["api", "api-2"])), "api-3");
  const long = "a".repeat(NAME_MAX);
  const suggested = freeName(long, new Set([long]));
  assert.equal(suggested.length, NAME_MAX);
  assert.ok(suggested.endsWith("-2"));
});

test("workspace: footer label tiers and change lines", () => {
  const one = { folders: [{ name: "plan2code" }], branch: "main" };
  assert.equal(FOOTER_TIERS, 4);
  assert.deepEqual(
    [0, 1, 2, 3].map((t) => footerLabel(one, t)),
    ["plan2code · main", "plan2code", "plan2code", "plan2code"]
  );
  const three = { folders: [{ name: "plan2code" }, { name: "api" }, { name: "web" }], branch: "main" };
  assert.deepEqual(
    [0, 1, 2, 3].map((t) => footerLabel(three, t)),
    ["plan2code + 2 folders · main", "plan2code + 2 folders", "plan2code +2", "plan2code"]
  );
  assert.equal(footerLabel({ folders: [{ name: "a" }, { name: "b" }], branch: "" }), "a + 1 folder");

  const p = "C:\\git\\api";
  assert.equal(changeLine({ kind: "added", name: "api", path: p }), `Workspace: added @api — ${p}`);
  assert.equal(
    changeLine({ kind: "added", name: "api", path: p, description: "the backend" }),
    `Workspace: added @api — ${p} (the backend)`
  );
  assert.equal(changeLine({ kind: "renamed", from: "api", name: "backend", path: p }), `Workspace: renamed @api to @backend — ${p}`);
  assert.equal(
    changeLine({ kind: "described", name: "api", path: p, description: "the backend" }),
    'Workspace: @api is now described as "the backend"'
  );
  assert.equal(changeLine({ kind: "described", name: "api", path: p, description: "" }), "Workspace: @api description cleared");
  assert.equal(changeLine({ kind: "removed", name: "api", path: p }), `Workspace: removed @api — ${p}`);
  assert.equal(changeLine({ kind: "missing", name: "api", path: p }), `Workspace: @api is missing — ${p} no longer exists`);
  assert.equal(changeLine({ kind: "found", name: "api", path: p }), `Workspace: @api is back — ${p}`);
});

test("mentions: find the @partial, rank names, splice a pick in", () => {
  assert.deepEqual(mentionAt("see @pay", 8), { start: 4, query: "pay" });
  assert.deepEqual(mentionAt("@", 1), { start: 0, query: "" });
  assert.deepEqual(mentionAt("(@we", 4), { start: 1, query: "we" });
  assert.equal(mentionAt("me@pay", 6), null);
  assert.equal(mentionAt("no mention", 10), null);

  const names = ["api", "web-api", "payments", "apex", "a1", "a2", "a3", "a4"];
  assert.deepEqual(matchNames(names, "api"), ["api", "web-api"]);
  const ranked = matchNames(names, "a");
  assert.equal(ranked.length, 6);
  assert.deepEqual(ranked.slice(0, 2), ["api", "apex"], "prefix matches first, in given order");

  const text = "look at @pa please";
  const out = applyMention(text, 11, mentionAt(text, 11), "payments");
  assert.equal(out.text, "look at @payments  please");
  assert.equal(out.caret, "look at @payments ".length);
});

/* ------------------------------------------------------ phase 3: the page */

test("skip: the last open card goes to Send, a middle one to the next unstaged, wrapping", () => {
  const open = ["q1", "q2", "q3", "q4"];
  // Skipping q2 with q3 still unanswered: on to q3.
  assert.equal(lastOpenCard(open, { q1: { k: "A" }, q2: { skipped: true } }, {}, "q2"), false);
  assert.equal(nextOpenAfter(open, { q1: { k: "A" }, q2: { skipped: true } }, {}, "q2"), "q3");
  // Skipping q4 with q1 still unanswered: wraps round to q1.
  assert.equal(nextOpenAfter(open, { q2: {}, q3: {}, q4: { skipped: true } }, {}, "q4"), "q1");
  // Everything else staged: q3 was the last, so Send.
  const rest = { q1: {}, q2: {}, q4: {}, q3: { skipped: true } };
  assert.equal(lastOpenCard(open, rest, {}, "q3"), true);
  assert.equal(nextOpenAfter(open, rest, {}, "q3"), null);
  // A sent card is waiting on the agent, not on the person.
  assert.equal(lastOpenCard(open, { q1: {}, q2: {} }, { q4: true }, "q3"), true);
  assert.equal(nextOpenAfter(open, { q1: {} }, { q2: true }, "q1"), "q3");
  // One card only.
  assert.equal(lastOpenCard(["q1"], {}, {}, "q1"), true);
  assert.equal(nextOpenAfter(["q1"], {}, {}, "q1"), null);
  // A current card no longer in the list starts from the top.
  assert.equal(nextOpenAfter(open, { q1: {} }, {}, "gone"), "q2");
});

test("page: the Workspace dialog, meter pill and new modules are in the page, with no inline styles or scripts", () => {
  const dir = path.join(ROOT, "src", "web-console", "public");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  for (const id of [
    "workspace-modal",
    "workspace-title",
    "workspace-list",
    "workspace-path",
    "workspace-browse",
    "workspace-add",
    "workspace-add-msg",
    "workspace-help",
    "workspace-done",
    "meter-pill",
    "meter-fill",
    "meter-words",
    "meter-pop",
    "meter-list",
    "meter-help",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `index.html must carry #${id}`);
  }
  assert.ok(html.includes("The folders the agent uses as context this session."), "the dialog explains itself");
  assert.match(html, /<button[^>]*class="meter-pill"[^>]*id="meter-pill"[^>]*\bhidden\b/, "the pill starts hidden");
  const pill = html.match(/<span class="meter-slot">[\s\S]*?<\/span>\s*<\/div>/);
  assert.ok(pill, "the pill sits in .ident");
  assert.ok(pill[0].includes('class="meter-track"') && pill[0].includes('class="meter-fill"'));
  for (const m of ["workspace.js", "meter.js", "mentions.js", "favicon.js"]) {
    assert.ok(html.includes(`rel="modulepreload" href="/${m}"`), `the page preloads ${m}`);
  }
  // The CSP refuses style attributes and inline script: the new markup has neither.
  const added = [
    html.match(/<dialog class="modal workspace"[\s\S]*?<\/dialog>/)[0],
    pill[0],
  ];
  for (const block of added) {
    assert.doesNotMatch(block, /\sstyle=/);
    assert.doesNotMatch(block, /<script/i);
    assert.doesNotMatch(block, /\son[a-z]+=/i, "no inline event handlers");
  }
});

test("page: the footer label opens the workspace instead of copying", () => {
  // The dashboard keeps the footer for the workspace label, minus the summary and Send.
  const css = joinedCss();
  assert.match(css, /\.footer\.is-dash \.footer-summary,\s*\.footer\.is-dash \.footer-actions \{ display: none; \}/);
  assert.match(css, /\.footer\.is-dash \.footer-where:not\(\[hidden\]\) \{ display: block;/, "narrow screens keep the label on the dashboard");
  // Every typing place offers @name suggestions: the Ask pane and the notes panel
  // (screens/ask.js) and the card note and text answer (screens/cards.js).
  const read = (f) => fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "screens", f), "utf8");
  const count = (text) => (text.match(/attachMentions\((ta|input)\);/g) || []).length;
  assert.equal(count(read("ask.js")) + count(read("cards.js")), 4, "Ask, card note, notes panel, text answer");
});

// The quoted flags between -NoProfile and -EncodedCommand, whichever quote style.
function pickerFlags(text) {
  const m = /["']-NoProfile["'][\s\S]*?["']-EncodedCommand["']/.exec(text);
  return m ? [...m[0].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]) : null;
}

test("picker: the workspace picker cannot drift from the launcher's", () => {
  const launcher = fs.readFileSync(path.join(ROOT, "src", "launcher", "plan2code.js"), "utf8");
  const picker = fs.readFileSync(path.join(ROOT, "src", "web-console", "picker.mjs"), "utf8");
  assert.ok(WINDOWS_PICKER_SOURCE.includes("Plan2CodeFolderPicker"));
  assert.ok(launcher.includes(WINDOWS_PICKER_SOURCE), "WINDOWS_PICKER_SOURCE is verbatim in the launcher");
  assert.deepEqual(pickerFlags(picker), pickerFlags(launcher));
  assert.deepEqual(pickerFlags(launcher), ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand"]);
  for (const fragment of ["choose folder with prompt", "--file-selection", "--directory", "--getexistingdirectory"]) {
    assert.ok(launcher.includes(fragment), `launcher has ${fragment}`);
    assert.ok(picker.includes(fragment), `picker has ${fragment}`);
  }
  const scriptLines = (text) => {
    const block = /const script = \[([\s\S]*?)\]\.join/.exec(text);
    assert.ok(block, "a PowerShell script array");
    return [...block[1].matchAll(/^\s*(["'])(.*)\1,\s*$/gm)].map((m) => m[2]);
  };
  const launcherScript = scriptLines(launcher);
  assert.ok(launcherScript.length > 10, "the launcher's script lines were found");
  assert.deepEqual(scriptLines(picker), launcherScript, "the PowerShell script is the launcher's, line for line");
  assert.equal(WORKSPACE_PICKER_PROMPT, "Choose a folder to add to the workspace");
});

function fakeSpawn(code, output) {
  return (command, args, options) => {
    assert.equal(options.windowsHide, true);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    setImmediate(() => {
      if (output) child.stdout.write(output);
      child.stdout.end();
      setImmediate(() => child.emit("close", code));
    });
    return child;
  };
}

test(
  "picker: pickFolder reads a pick, a cancel and a failure off the picker's exit",
  { skip: pickerCommand(os.tmpdir(), WORKSPACE_PICKER_PROMPT) ? false : "no folder picker on this machine" },
  async () => {
    const picked = path.join(os.tmpdir(), "picked");
    assert.deepEqual(await pickFolder(os.tmpdir(), "p", { spawnImpl: fakeSpawn(0, picked + "\n") }), { path: path.resolve(picked) });
    assert.deepEqual(await pickFolder(os.tmpdir(), "p", { spawnImpl: fakeSpawn(1, "") }), { cancelled: true });
    assert.deepEqual(await pickFolder(os.tmpdir(), "p", { spawnImpl: fakeSpawn(2, "") }), { error: "picker-failed" });
  }
);

test("ledger: a torn trailing line is skipped, then read once completed; an append after a fragment starts a new line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-ledger-"));
  try {
    const file = path.join(dir, "ledger.ndjson");
    assert.deepEqual(readLedger(dir), []);
    appendLedger(dir, { kind: "launch", id: "L1", workflow: "plan" });
    const line = JSON.stringify({ kind: "run", id: "L1:p1", event: "plan" });
    fs.appendFileSync(file, line.slice(0, 15));
    assert.deepEqual(readLedger(dir).map((e) => e.id), ["L1"], "a half-written line is not parsed");
    fs.appendFileSync(file, line.slice(15) + "\n");
    assert.deepEqual(readLedger(dir).map((e) => e.id), ["L1", "L1:p1"]);

    fs.appendFileSync(file, '{"kind":"run","id":"torn');
    const stored = appendLedger(dir, { kind: "launch", id: "L2", workflow: "document" });
    assert.ok(stored.at, "appendLedger stamps at");
    assert.deepEqual(readLedger(dir).map((e) => e.id), ["L1", "L1:p1", "L2"], "the fragment never swallows the next entry");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("workspace cursor never moves backwards, and only changes past it are pending", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-wscursor-"));
  try {
    assert.equal(readWorkspaceCursor(dir), 0);
    assert.deepEqual(pendingWorkspaceChanges(dir), [], "no workspace.json yet");
    const ws = initialWorkspace(dir);
    ws.version = 3;
    ws.changes = [1, 2, 3].map((version) => ({ kind: "added", name: `f${version}`, path: dir, version }));
    fs.writeFileSync(path.join(dir, WORKSPACE_FILE), JSON.stringify(ws));
    assert.deepEqual(pendingWorkspaceChanges(dir).map((c) => c.version), [1, 2, 3]);
    writeWorkspaceCursor(dir, 2);
    assert.deepEqual(pendingWorkspaceChanges(dir).map((c) => c.version), [3]);
    writeWorkspaceCursor(dir, 1);
    assert.equal(readWorkspaceCursor(dir), 2, "never backwards");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("subagents: only the seven opted-in workflows offer the switch", () => {
  for (const w of ["implement", "implement-review", "quick-task", "review", "pathfinder", "plan", "revise-plan"]) {
    assert.equal(offered(w), true, w);
    assert.ok(defaultInstruction(w).length > 0, `${w} has a default instruction`);
  }
  for (const w of ["dashboard", "document", "finalize", "init", "handoff", "constructor", "toString", undefined]) {
    assert.equal(offered(w), false, String(w));
    assert.equal(defaultInstruction(w), "");
  }
  assert.equal(Object.keys(SUBAGENT_WORKFLOWS).length, 7);
  assert.deepEqual(defaultSetting("review"), { workflow: "review", on: true, instruction: null, max: 3, strength: "balanced" });
  assert.equal(defaultSetting("document").on, false, "a skill without the switch is never on");
  assert.equal(effectiveInstruction({ workflow: "review", instruction: "  " }), defaultInstruction("review"));
  assert.equal(effectiveInstruction({ workflow: "review", instruction: " Mine " }), "Mine");
});

test("subagents: blockFor walks every switch transition, and never says off to an agent not told on", () => {
  const setting = (on, revision, extra = {}) => ({ workflow: "implement", on, instruction: null, max: 3, revision, ...extra });
  const none = { revision: 0, state: "none" };

  assert.equal(blockFor(setting(false, 1), none), null, "never on: nothing");
  assert.equal(blockFor(null, none), null, "no setting: nothing");

  const on = blockFor(setting(true, 2), none);
  assert.equal(on.lines[0], "Subagents: on (revision 2) — a console setting, not typed by the person.");
  assert.ok(!on.lines[0].includes("replaces"));
  assert.deepEqual(on.field, { state: "on", revision: 2, max: 3, instruction: defaultInstruction("implement"), strength: "balanced" });
  assert.deepEqual(on.cursor, { revision: 2, state: "on" });
  assert.equal(on.lines[on.lines.length - 1], "  At most 3 helpers at once.");
  for (const frame of FRAME_LINES) assert.ok(on.lines.includes("  " + frame), frame);

  const edit = blockFor(setting(true, 5, { instruction: "First line\n\nSecond line", max: 7 }), { revision: 4, state: "on" });
  assert.equal(edit.lines[0], "Subagents: on (revision 5, replaces revision 4) — a console setting, not typed by the person.");
  assert.ok(edit.lines.includes("  First line") && edit.lines.includes("  Second line"), "the instruction's own lines are indented");
  assert.ok(!edit.lines.some((line) => !line.trim()), "blank instruction lines are dropped");
  const nested = blockFor(setting(true, 2, { instruction: "- a\r\n  - b\n   \n" }), none);
  assert.deepEqual(nested.lines.slice(-4, -2), ["  - a", "    - b"], "the person's own indentation survives, CRLF and blank lines do not");
  assert.equal(edit.field.max, 7);
  for (const line of edit.lines.slice(1)) assert.match(line, /^ {2}\S/, "only the first line starts at column 0");

  const off = blockFor(setting(false, 6), { revision: 5, state: "on" });
  assert.deepEqual(off.lines, [offLine(6)]);
  assert.equal(off.lines[0], "Subagents: off (revision 6) — don't start new helpers for the rest of this session.");
  assert.deepEqual(off.cursor, { revision: 6, state: "off" });
  assert.equal(off.field.state, "off");

  assert.equal(blockFor(setting(false, 6), { revision: 6, state: "off" }), null, "same revision again: nothing");
  assert.equal(blockFor(setting(true, 6), { revision: 6, state: "on" }), null, "same revision while on: nothing");
  assert.equal(blockFor(setting(false, 3), { revision: 2, state: "off" }), null, "off after off: nothing");

  assert.equal(blockFor(setting(true, 6), none).lines[0], "Subagents: on (revision 6) — a console setting, not typed by the person.", "a reset cursor re-states on");
  assert.equal(blockFor(setting(false, 6), none), null, "a reset cursor with it off: nothing");
  assert.equal(blockFor({ ...setting(true, 9), workflow: "document" }, none), null, "a workflow that does not offer it: nothing");
});

test("subagents: the injected wording names no harness tool", () => {
  const texts = [...FRAME_LINES, ...Object.keys(SUBAGENT_WORKFLOWS).map(defaultInstruction), offLine(1)];
  for (const text of texts) {
    for (const tool of ["run_subagent", "subagent_type", "Task(", "spawn_agent", "/agents", "Agent tool"]) {
      assert.ok(!text.includes(tool), `"${text}" names ${tool}`);
    }
  }
});

// Guards NFR-1: the strength guidance and the wording the console injects speak
// in strength words only, never a model or vendor name, so they stay right on
// every harness and every model line-up.
const MODEL_NAMES = /\b(haiku|sonnet|opus|fable|gpt|o\d|codex|gemini|flash|pro|claude|anthropic|openai|google|swe-\d)\b/i;

test("subagents: the strength guidance and the injected wording name no model or vendor", () => {
  const texts = [
    fs.readFileSync(path.join(ROOT, "src", "shared-references", "helper-strength.md"), "utf8"),
    ...FRAME_LINES,
    ...Object.keys(SUBAGENT_WORKFLOWS).map(defaultInstruction),
  ];
  for (const text of texts) assert.doesNotMatch(text, MODEL_NAMES);
  assert.match("Start it on Sonnet at high effort.", MODEL_NAMES, "the check catches a model name");
});

test("subagents: cleanSetting accepts a good setting and names the field that fails", () => {
  assert.deepEqual(cleanSetting({ on: true, instruction: null, max: 3 }), { on: true, instruction: null, max: 3, strength: "balanced" });
  assert.deepEqual(cleanSetting({ on: false, instruction: "  Do it  ", max: 20, strength: "best" }), { on: false, instruction: "Do it", max: 20, strength: "best" });
  assert.equal(cleanSetting({ on: true, instruction: null, max: 3, strength: null }).strength, "balanced", "a null strength is the default");
  for (const strength of ["fast", "Balanced", 1, ""]) assert.deepEqual(cleanSetting({ on: true, instruction: null, max: 3, strength }), { error: "strength" }, String(strength));
  assert.equal(cleanSetting({ on: true, instruction: "", max: 1 }).instruction, null, "an empty instruction is the default");
  for (const max of [0, 21, 2.5, "3"]) assert.deepEqual(cleanSetting({ on: true, instruction: null, max }), { error: "max" }, String(max));
  assert.deepEqual(cleanSetting({ on: true, instruction: "x".repeat(2001), max: 3 }), { error: "too-long" });
  assert.deepEqual(cleanSetting({ on: "yes", instruction: null, max: 3 }), { error: "bad" });
  assert.deepEqual(cleanSetting({ on: true, instruction: 7, max: 3 }), { error: "bad" });
  assert.deepEqual(cleanSetting(null), { error: "bad" });
});

test("subagents: checkHelper and checkHelpers name the helper behind every problem", () => {
  const running = { id: "h1", title: "Read the store", ask: "Find the lock helpers", state: "running" };
  const done = { id: "h2", title: "Tests", ask: "Run the suite", state: "done", result: "All green" };
  assert.deepEqual(checkHelper(running), []);
  assert.deepEqual(checkHelper(done), []);
  assert.deepEqual(checkHelper({ id: "alone", alone: true }), []);
  assert.deepEqual(checkHelpers([running, done, { id: "alone", alone: true }]), []);

  const one = (entry) => {
    const problems = checkHelper(entry);
    assert.equal(problems.length, 1, JSON.stringify(problems));
    assert.match(problems[0], new RegExp(`helper "${entry.id}"`));
    return problems[0];
  };
  one({ ...running, title: undefined });
  assert.match(one({ ...running, state: "paused" }), /state must be running, done or failed/);
  one({ ...running, title: "t".repeat(81) });
  one({ ...running, ask: "a".repeat(401) });
  one({ ...done, result: "r".repeat(201) });

  const dupes = checkHelpers([running, { ...done, id: "h1" }]);
  assert.ok(dupes.some((p) => p === 'helper "h1": duplicate id'), dupes.join("; "));
  const alones = checkHelpers([{ id: "alone", alone: true }, { id: "alone", alone: true }]);
  assert.ok(alones.some((p) => /helper "alone": only one working-alone entry/.test(p)), alones.join("; "));
  assert.deepEqual(checkHelpers("nope"), ["helpers must be an array"]);
});

test("subagents: the page shows the switch only when offered and supported, and the tab only with a helper", () => {
  assert.equal(showSwitch(null), false);
  assert.equal(showSwitch({ offered: false, supported: true, on: true }), false);
  assert.equal(showSwitch({ offered: true, supported: false, on: true }), false);
  assert.equal(showSwitch({ offered: true, supported: true, on: false }), true);
  assert.equal(switchLabel({ on: true }), "Subagents: on");
  assert.equal(switchLabel({ on: false }), "Subagents: off");

  const on = { offered: true, supported: true, on: true };
  const off = { offered: true, supported: true, on: false };
  const helper = { id: "h1", title: "Research", ask: "Check the docs", state: "running" };
  assert.equal(showTab(on, []), false, "never an empty tab, even when on");
  assert.equal(showTab(on, undefined), false);
  assert.equal(showTab(off, [helper]), true, "a helper shows with the switch off (Pathfinder research)");
  assert.equal(showTab({ ...on, supported: false }, [helper]), false, "no tab where the switch cannot show");
  assert.ok(CHECKIN_LINE.includes("checks in, not live"));
});

test("subagents: helperRows labels each state, shows a result only once a helper ended, and collapses to working alone", () => {
  assert.deepEqual(helperRows([{ id: "alone", alone: true }]), { alone: true, rows: [] });
  assert.deepEqual(helperRows(undefined), { alone: false, rows: [] });
  // A stale working-alone entry must never hide a real helper (it can survive
  // in sessions written before the merge started dropping it).
  const mixed = helperRows([{ id: "alone", alone: true }, { id: "h9", title: "Late", ask: "a", state: "done", result: "ok" }]);
  assert.equal(mixed.alone, false);
  assert.deepEqual(mixed.rows.map((r) => r.id), ["h9"]);
  const { alone, rows } = helperRows([
    { id: "h1", title: "One", ask: "a", state: "running", result: "not yet" },
    { id: "h2", title: "Two", ask: "b", state: "done", result: "Found 2 call sites" },
    { id: "h3", title: "Three", ask: "c", state: "failed", result: "Timed out" },
  ]);
  assert.equal(alone, false);
  assert.deepEqual(rows.map((r) => [r.id, r.stateLabel]), [["h1", "Running"], ["h2", "Done"], ["h3", "Failed"]]);
  assert.equal("result" in rows[0], false, "a running helper has no result in its row");
  assert.equal(rows[1].result, "Found 2 call sites");
  assert.equal(rows[2].result, "Timed out");
});

test("subagents: helperRows turns a reported strength and effort into one line, and leaves it out when neither was reported", () => {
  const line = (extra) => helperRows([{ id: "h1", title: "One", ask: "a", state: "running", ...extra }]).rows[0];
  const cases = [
    [{ strength: "standard", effort: "medium" }, "Standard, medium effort"],
    [{ strength: "light" }, "Light"],
    [{ strength: "strongest", effort: "high" }, "Strongest, high effort"],
    [{ strength: "inherit", effort: "high" }, "Session model, high effort"],
    [{ strength: "inherit" }, "Session model"],
    [{ effort: "low" }, "Low effort"],
  ];
  for (const [extra, want] of cases) {
    const row = line(extra);
    assert.equal(row.strengthLine, want, JSON.stringify(extra));
    assert.equal(row.strength, extra.strength);
    assert.equal(row.effort, extra.effort);
  }
  for (const extra of [{}, { strength: "huge", effort: "max" }]) {
    const row = line(extra);
    for (const key of ["strengthLine", "badges", "strength", "effort"]) assert.equal(key in row, false, `${JSON.stringify(extra)}: no ${key}`);
  }
});

test("subagents: helperRows gives each reported strength and effort a badge ranked 1-3, and the session's own model rank 0", () => {
  const badges = (extra) => helperRows([{ id: "h1", title: "One", ask: "a", state: "running", ...extra }]).rows[0].badges;
  assert.deepEqual(badges({ strength: "standard", effort: "high" }), [
    { kind: "strength", label: "Standard", level: 2 },
    { kind: "effort", label: "High effort", level: 3 },
  ]);
  assert.deepEqual(badges({ strength: "light" }), [{ kind: "strength", label: "Light", level: 1 }]);
  assert.deepEqual(badges({ strength: "strongest", effort: "low" }).map((b) => b.level), [3, 1]);
  assert.deepEqual(badges({ strength: "inherit", effort: "medium" }), [
    { kind: "strength", label: "Session model", level: 0 },
    { kind: "effort", label: "Medium effort", level: 2 },
  ]);
});

test("page: the Subagents button sits right after Write a brief, and its dialog is in the page with no inline styles or scripts", () => {
  const html = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "index.html"), "utf8");
  const row = html.match(/<div class="row-left">([\s\S]*?)<\/div>\s*<div class="views-group">/);
  assert.ok(row, "index.html has the second row's left cluster");
  const ids = [...row[1].matchAll(/<button[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids[ids.indexOf("btn-brief") + 1], "btn-subagents", "the Subagents button follows Write a brief");
  assert.match(row[1], /<button[^>]*id="btn-subagents"[^>]*\bhidden\b/, "the button starts hidden");
  for (const part of ["sa-hub", "sa-node", "sa-link"]) assert.ok(row[1].includes(`class="${part}"`), `the icon has ${part}`);
  const dialog = html.match(/<dialog class="modal looks subagents" id="subagents-modal" aria-labelledby="subagents-title">([\s\S]*?)<\/dialog>/);
  assert.ok(dialog, "index.html has the Subagents dialog");
  for (const id of ["subagents-instruction", "subagents-default", "subagents-max", "subagents-checkin", "subagents-research", "subagents-status", "subagents-cancel", "subagents-save"]) {
    assert.ok(dialog[1].includes(`id="${id}"`), `the dialog carries #${id}`);
  }
  assert.doesNotMatch(dialog[1], /\sstyle=/);
  assert.doesNotMatch(dialog[1], /<script/i);
});

test("subagents: the store round-trips per project and workflow under the console home", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-subagents-home-"));
  try {
    const project = path.join(home, "My Repo");
    const script = `
      const lib = await import(${JSON.stringify(new URL("../src/web-console/settings.mjs", import.meta.url).href)});
      const project = ${JSON.stringify(project)};
      lib.saveSubagentStoreEntry(project, "implement", { on: true, instruction: "Mine", max: 5, strength: "best" });
      const flipped = project.replace(/My Repo$/, "MY REPO");
      console.log(JSON.stringify({
        file: lib.SUBAGENTS_FILE,
        saved: lib.subagentStoreEntry(project, "implement"),
        otherCase: lib.subagentStoreEntry(flipped, "implement"),
        unsaved: lib.subagentStoreEntry(project, "review"),
      }));
    `;
    const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, PLAN2CODE_CONSOLE_HOME: home },
      encoding: "utf8",
    });
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.file, path.join(home, "subagents.json"), "the store follows PLAN2CODE_CONSOLE_HOME");
    assert.deepEqual(out.saved, { on: true, instruction: "Mine", max: 5, strength: "best" });
    if (process.platform === "win32" || process.platform === "darwin") {
      assert.deepEqual(out.otherCase, out.saved, "a different-case path reads the same entry");
    }
    assert.deepEqual(out.unsaved, { on: true, instruction: null, max: 3, strength: "balanced" }, "nothing saved means on, at balanced");
    assert.ok(!fs.existsSync(path.join(home, "subagents.json.lock")), "the lock is released");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("subagents: the session setting and the cursor never go backwards, except a reset", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-subagents-"));
  try {
    assert.equal(readSubagentSetting(dir), null);
    writeSubagentSetting(dir, { workflow: "implement", on: true, instruction: null, max: 3, revision: 5 });
    writeSubagentSetting(dir, { workflow: "implement", on: false, instruction: null, max: 3, revision: 3 });
    assert.equal(readSubagentSetting(dir).revision, 5);
    assert.equal(readSubagentSetting(dir).on, false, "the rest of the setting is still written");
    fs.writeFileSync(path.join(dir, "subagents-setting.json"), JSON.stringify({ workflow: "implement", on: "yes", max: 3, revision: 1 }));
    assert.equal(readSubagentSetting(dir), null, "malformed reads null");

    assert.deepEqual(readSubagentCursor(dir), { revision: 0, state: "none" });
    writeSubagentCursor(dir, { revision: 4, state: "on" });
    writeSubagentCursor(dir, { revision: 2, state: "off" });
    assert.deepEqual(readSubagentCursor(dir), { revision: 4, state: "on" });
    resetSubagentCursor(dir);
    assert.deepEqual(readSubagentCursor(dir), { revision: 0, state: "none" });
    fs.writeFileSync(path.join(dir, "subagents-cursor.json"), JSON.stringify({ revision: 2, state: "maybe" }));
    assert.deepEqual(readSubagentCursor(dir), { revision: 0, state: "none" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("subagents: latestOpenCaps reads the last open event, skipping a torn line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-caps-"));
  const events = path.join(dir, "events.ndjson");
  try {
    assert.deepEqual(latestOpenCaps(dir), [], "no events yet");
    fs.writeFileSync(events, [{ type: "open", caps: ["subagents"] }, { type: "open" }].map((e) => JSON.stringify(e)).join("\n") + "\n");
    assert.deepEqual(latestOpenCaps(dir), [], "the latest open has no caps");
    fs.appendFileSync(events, JSON.stringify({ type: "post" }) + "\n" + JSON.stringify({ type: "open", caps: ["subagents"] }) + "\n");
    assert.deepEqual(latestOpenCaps(dir), ["subagents"]);
    fs.appendFileSync(events, '{"type":"open","ca');
    assert.deepEqual(latestOpenCaps(dir), ["subagents"], "a torn final line is ignored");
    assert.ok(PROTECTED_CONSOLE_FILES.has("subagents.json"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("initialWorkspace names the original folder after itself and marks it original", () => {
  const ws = initialWorkspace(path.join("C:", "git", "My Repo"));
  assert.equal(ws.version, 0);
  assert.equal(ws.folders.length, 1);
  assert.deepEqual(ws.folders[0], { id: "f0", path: path.join("C:", "git", "My Repo"), name: "my-repo", description: "", original: true });
  assert.deepEqual([ws.missing, ws.changes, ws.remote], [[], [], ""]);
});

// The meter's tables are built from skills.js plus the events that are not a
// skill's own. Held to their values when they were written by hand.
test("meter: the weights and labels built from the skill list are the ones written by hand before", () => {
  assert.deepEqual({ ...WEIGHTS }, {
    "pathfinder-chart": 2, "pathfinder-question": 0, "pathfinder-research": 1,
    plan: 2, "revise-plan": 1, document: 2, "implement-phase": 2, "implement-review-phase": 3,
    review: 2, "quick-task": 1, init: 2, "init-update": 2, finalize: 1, handoff: 0, git: 1,
    "git-commits": 0, "git-conflict": 1, changelog: 1, xray: 1, diagnose: 1,
  });
  assert.deepEqual({ ...LAUNCH_LABELS }, {
    plan: "Plan started", "revise-plan": "Revise plan started", document: "Document started",
    review: "Review started", "quick-task": "Quick task started", init: "Init started",
    "init-update": "Init update started", finalize: "Finalize started", git: "Git started",
    changelog: "Changelog started", xray: "X-ray started", diagnose: "Diagnose started",
  });
  assert.deepEqual({ ...RUN_LABELS }, {
    "pathfinder-chart": "Pathfinder map written", "pathfinder-question": "Pathfinder question settled",
    "pathfinder-research": "Pathfinder research done", plan: "Plan drafted", "revise-plan": "Plan revised",
    document: "Spec documented", "implement-phase": "Implement phase built",
    "implement-review-phase": "Implement + Review phase built", review: "Code review run",
    "quick-task": "Quick task built", init: "Init run", "init-update": "Init update run",
    finalize: "Finalize run", handoff: "Handoff written", git: "Git run", "git-commits": "Commits in Git",
    "git-conflict": "Git conflict help", changelog: "Changelog run", xray: "X-ray run", diagnose: "Diagnose run",
  });
  for (const t of [WEIGHTS, LAUNCH_LABELS, RUN_LABELS]) assert.ok(Object.isFrozen(t));
});
