// Tests for plan2code-0-pathfinder's scripts/pathfinder.mjs.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SKILLS, NOW, runScript, tmp, write, read, gitInit, phase } from "./skill-script-helpers.mjs";

/* ============================================================ pathfinder.mjs */

const B = "> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.";

function q(name, { type = "grill · HITL", state = "open", blocked = "none", claimed = "none", resolved = "none", locked = "no", answer = null, evidence = null, skipResolved = false } = {}) {
  return [
    B, "", `# ${name}`, "", `Type: ${type}`, `State: ${state}`, `Blocked by: ${blocked}`, `Claimed: ${claimed}`,
    ...(skipResolved ? [] : [`Resolved: ${resolved}`]), `Locked: ${locked}`, "", "## Question", "", `What about ${name}?`, "",
    ...(answer ? ["## Answer", "", answer, ""] : []),
    ...(evidence ? ["## Evidence", "", evidence, ""] : []),
  ].join("\n");
}

const MAP = `${B}

# Map: audit-export

*Decisions live in \`questions/\` — one file each. This file is just the index.*

**Status:** Working
**Updated:** 2026-08-01
**Confidence:** Requirements-clarity 19/25 · Feasibility-technical 14/25 · Integration-points 20/25 · Risk-assessment 18/25

## Destination

A locked plan for exporting audit events.

## Ground rules

- \`AGENTS.md\` exists and governs.

## Question Checklist

<!-- Rebuilt from questions/ every session. -->

- [x] [Codebase context](./questions/00-codebase-context.md) — Node and Postgres; a long gist
  that wraps onto a second line. *(2026-08-01)*
- [ ] [Export format](./questions/01-export-format.md)
- [ ] [Row-count
  ceiling](./questions/02-row-count-ceiling.md)
- [ ] [Testing posture](./questions/03-testing-posture.md)
- [ ] [Delivery channel](./questions/04-delivery-channel.md)
- [ ] [Gone question](./questions/09-gone.md)

## Not yet specified

- How far back an export may reach.

## Out of scope

- Redesign of the schema.
`;

function mapFixture() {
  const root = tmp("pf");
  write(root, "AGENTS.md", "# AGENTS.md\n");
  const pf = "specs/audit-export/pathfinder";
  write(root, `${pf}/map.md`, MAP);
  write(root, `${pf}/questions/00-codebase-context.md`, q("Codebase context", { type: "legwork · AFK", state: "resolved", claimed: "2026-08-01 09:00", resolved: "2026-08-01", answer: "Node.\n\n**Gist:** Node and Postgres." }));
  // An answer under State: open (a crash after writing the answer): reconcile resolves it and backfills the date.
  write(root, `${pf}/questions/01-export-format.md`, q("Export format", { claimed: "2026-08-02 10:00", locked: "yes", answer: "**Decision.** CSV.\n\n**Rejected**\n\n- *JSONL* - recipients use Excel.\n\n**Gist:** CSV with a BOM.", skipResolved: true }));
  // A stale claim with no answer: reset.
  write(root, `${pf}/questions/02-row-count-ceiling.md`, q("Row-count ceiling", { type: "research · AFK", state: "claimed", claimed: "2026-08-02 11:00", evidence: "- half done" }));
  write(root, `${pf}/questions/03-testing-posture.md`, q("Testing posture"));
  write(root, `${pf}/questions/04-delivery-channel.md`, q("Delivery channel", { blocked: "02" }));
  write(root, `${pf}/questions/05-siem-push.md`, q("SIEM push", { state: "out-of-scope" }));
  return { root, pf };
}

test("pathfinder reconcile: files win, dates backfill, stale claims reset, rows keep their words", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  const dry = P("reconcile", "audit-export", "--dry-run");
  assert.equal(dry.code, 0, dry.stderr);
  assert.equal(read(root, `${pf}/map.md`), MAP, "dry-run writes nothing");
  const r = P("reconcile", "audit-export");
  assert.deepEqual(r.json.repairs.map((x) => [x.nn, x.repair]), [["01", "state-resolved"], ["01", "resolved-backfilled"], ["02", "stale-claim-reset"]]);
  assert.match(r.json.repairs[1].detail, /2026-08-02 \(from Claimed:\)/);
  assert.deepEqual(r.json.refire.map((x) => x.nn), ["02"], "research with no Research complete line is re-fired");
  assert.equal(r.json.refire[0].partialEvidence, true);
  const map = read(root, `${pf}/map.md`);
  assert.match(map, /- \[x\] \[Codebase context\]\(\.\/questions\/00-codebase-context\.md\) — Node and Postgres; a long gist\n  that wraps onto a second line\. \*\(2026-08-01\)\*/, "an unchanged row keeps its own wrapped text");
  assert.match(map, /- \[x\] \[Export format\]\(\.\/questions\/01-export-format\.md\) — CSV with a BOM\. \*\(2026-08-02\)\*/);
  assert.match(map, /- \[ \] \[Row-count\n  ceiling\]\(\.\/questions\/02-row-count-ceiling\.md\)/, "a wrapped link is still one row");
  assert.match(map, /- \[!\] \[Delivery channel\]\(\.\/questions\/04-delivery-channel\.md\) — Blocked by 02/);
  assert.match(map, /- \[-\] \[SIEM push\]\(\.\/questions\/05-siem-push\.md\) — out of scope, see below/);
  assert.ok(!map.includes("09-gone"), "a row with no file is dropped");
  assert.match(map, /<!-- Rebuilt from questions\/ every session\. -->/);
  const q1 = read(root, `${pf}/questions/01-export-format.md`);
  assert.match(q1, /State: resolved\nBlocked by: none\nClaimed: 2026-08-02 10:00\nResolved: 2026-08-02\nLocked: yes/, "Resolved: inserted in schema order");
  assert.match(read(root, `${pf}/questions/02-row-count-ceiling.md`), /State: open\nBlocked by: none\nClaimed: none/);
  const again = P("reconcile", "audit-export");
  assert.deepEqual([again.json.repairs.length, again.json.mapChanges.length, again.json.mapWritten], [0, 0, false], "idempotent");
});

test("pathfinder frontier, claim, resolve, rule-out", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  let f = P("frontier", `${pf}`).json;
  assert.deepEqual(f.frontier.map((x) => x.nn), ["02", "03"]);
  assert.deepEqual(f.blocked.map((x) => [x.nn, x.blockedBy.map((b) => b.nn)]), [["04", ["02"]]]);
  assert.equal(f.nextNN, "10", "09 was linked from the map before reconcile dropped its row: never reissued");
  assert.match(read(root, `${pf}/map.md`), /^\*\*Confidence:\*\*.*\n\*\*Next NN:\*\* 10$/m, "reconcile keeps the high-water mark at the end of the header block");
  assert.deepEqual(f.counts, { resolved: 2, total: 5, outOfScope: 1, fog: 1 });
  assert.deepEqual(f.drift, []);
  assert.equal(P("claim", "audit-export", "04").code, 5, "blocked");
  assert.equal(P("claim", "audit-export", "05").code, 5, "out of scope");
  assert.equal(P("claim", "audit-export", "77").code, 3);
  const c = P("claim", "audit-export", "2");
  assert.equal(c.code, 0, c.stderr);
  assert.equal(c.json.claimed, NOW);
  assert.match(read(root, `${pf}/questions/02-row-count-ceiling.md`), /State: claimed\nBlocked by: none\nClaimed: 2026-08-03 14:05/);
  assert.match(read(root, `${pf}/map.md`), /- \[\/\] \[Row-count\n  ceiling\]/);
  assert.equal(P("claim", "audit-export", "03").json.error, "claim-open", "one claim at a time");
  assert.equal(P("resolve", "audit-export", "02").json.error, "no-answer");
  const qp = path.join(root, pf, "questions/02-row-count-ceiling.md");
  fs.appendFileSync(qp, "\n## Answer\n\nFacts.\n");
  assert.equal(P("resolve", "audit-export", "02").json.error, "no-gist");
  fs.appendFileSync(qp, "\n**Gist:** 2M rows at the 99th percentile.\n");
  const res = P("resolve", "audit-export", "02");
  assert.equal(res.code, 0, res.stderr);
  assert.deepEqual(res.json.unblocked, [{ nn: "04", name: "Delivery channel" }]);
  const map = read(root, `${pf}/map.md`);
  assert.match(map, /- \[x\] \[Row-count ceiling\]\(\.\/questions\/02-row-count-ceiling\.md\) — 2M rows at the 99th percentile\. \*\(2026-08-03\)\*/);
  assert.match(map, /- \[ \] \[Delivery channel\]\(\.\/questions\/04-delivery-channel\.md\)\n/, "the Blocked by tail goes with the [!] marker");
  assert.match(map, /^\*\*Updated:\*\* 2026-08-03$/m);
  const ro = P("rule-out", "audit-export", "03", "--reason", "testing is owned elsewhere");
  assert.equal(ro.code, 0, ro.stderr);
  assert.match(read(root, `${pf}/questions/03-testing-posture.md`), /State: out-of-scope[\s\S]*## Question\n\nOut of scope: testing is owned elsewhere/);
  assert.match(read(root, `${pf}/map.md`), /## Out of scope\n\n- Redesign of the schema\.\n- \[Testing posture\]\(\.\/questions\/03-testing-posture\.md\) — testing is owned elsewhere/);
  assert.equal(P("rule-out", "audit-export", "04").code, 2, "--reason is required");
  assert.equal(P("rule-out", "audit-export", "00", "--reason", "x").code, 5, "a resolved decision is not ruled out");
});

test("pathfinder trail: exact footer for forms A, B and C", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  P("claim", "audit-export", "03");
  const b = P("trail", "audit-export", "--form", "B", "--item", "Q1 Types", "--item", "Q2 Cadence", "--text");
  assert.equal(b.code, 0, b.stderr);
  assert.equal(b.stdout, [
    "🧭 audit-export · Working · 2/5 cleared",
    "  START ●━●··○━◉··⊘··⊝ ····⚑",
    "  ● done · ◉ here · ○ open · ⊘ blocked · ⊝ out of scope · ⚑ destination · ~1 fog",
    "  1 Codebase context ✔ · 2 Export format ✔ · 3 Row-count ceiling · 4 Testing posture ◀ here",
    "  5 Delivery channel (blocked:3) · 6 SIEM push (out of scope)",
    "  Confidence: not yet — Feasibility still needs work.",
    "",
    "WAITING ON YOU · answer here, in this conversation:",
    "Q1 Types · Q2 Cadence",
    "",
  ].join("\n"));
  assert.equal(P("trail", "audit-export", "--form", "B").code, 2, "Form B names its items");
  assert.equal(P("trail", "audit-export", "--form", "B", "--item", "1", "--item", "2", "--item", "3", "--item", "4").code, 5, "three-probe cap");
  assert.equal(P("trail", "audit-export", "--form", "C").json.error, "claim-open", "no menu while a claim is open");
  const a = P("trail", "audit-export", "--form", "A", "--text").stdout;
  assert.ok(a.endsWith("NEXT STEP · start a new conversation and run:\n`/plan2code-0-pathfinder specs/audit-export/pathfinder --web`\n"), a);
  fs.appendFileSync(path.join(root, pf, "questions/03-testing-posture.md"), "\n## Answer\n\nUnit; `Run after each phase`; `Critical paths`.\n\n**Gist:** Unit tests, run after each phase.\n");
  P("resolve", "audit-export", "03");
  const c = P("trail", "audit-export", "--form", "C", "--resolved-this-session", "3");
  assert.equal(c.code, 0, c.stderr);
  assert.ok(c.json.text.endsWith("OR START FRESH · new conversation, paste:\n`/plan2code-0-pathfinder specs/audit-export/pathfinder --web`"));
  assert.deepEqual(c.json.menu.options.map((o) => o.label), ["Row-count ceiling", "Start fresh"]);
  assert.equal(c.json.menu.recommended, "Start fresh", "the checkpoint after ~3 decisions");
  assert.equal(P("trail", "audit-export", "--form", "C").json.menu.recommended, "Row-count ceiling");
});

test("pathfinder trail: a cleared map arrives; init first only while AGENTS.md is still missing", () => {
  const root = tmp("pfc");
  const pf = "specs/done/pathfinder";
  write(root, `${pf}/map.md`, MAP.replace("**Status:** Working", "**Status:** Cleared").replace("- `AGENTS.md` exists and governs.", "- `AGENTS.md` is absent; continued without it.").replace(/## Not yet specified\n\n- How far back an export may reach\.\n/, "## Not yet specified\n\n").replace("Feasibility-technical 14/25", "Feasibility-technical 22/25"));
  write(root, `${pf}/questions/00-codebase-context.md`, q("Codebase context", { state: "resolved", resolved: "2026-08-01", answer: "**Gist:** Node." }));
  write(root, `${pf}/questions/01-export-format.md`, q("Export format", { state: "resolved", resolved: "2026-08-02", answer: "**Gist:** CSV." }));
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "done");
  assert.equal(P("trail", "done", "--form", "A", "--text").stdout, [
    "🧭 done · Cleared · 2/2 cleared",
    "  START ●━●━⚑  arrived",
    "  Confidence: solid, but Requirements, Risk are borderline.",
    "",
    "NEXT STEP · start a new conversation and run:",
    "`/plan2code-init`, then `/plan2code-1-plan --web`",
    "",
  ].join("\n"));
  write(root, "AGENTS.md", "# AGENTS.md\n");
  assert.match(P("trail", "done", "--form", "A", "--text").stdout, /run:\n`\/plan2code-1-plan --web`\n$/);
  assert.equal(P("trail", "done", "--form", "C").code, 5, "no menu on a cleared map");
});

test("pathfinder gate: mechanical checks and hard caps", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  let g = P("gate", "audit-export").json;
  assert.equal(g.mechanicalPass, false);
  const failed = g.checks.filter((c) => !c.pass).map((c) => c.id);
  assert.deepEqual(failed, ["no-open-claimed-blocked", "fog-empty", "hard-caps", "scores-at-least-18"]);
  assert.ok(g.caps.some((c) => c.dimension === "Requirements" && /not resolved/.test(c.why)));
  assert.ok(g.caps.some((c) => c.dimension === "Risk" && /Export format records no consequences/.test(c.why)));
  assert.equal(g.planDraftPath, "specs/audit-export/PLAN-DRAFT-20260803.md");
  // Settle everything.
  const qd = path.join(root, pf, "questions");
  fs.writeFileSync(path.join(qd, "01-export-format.md"), q("Export format", { state: "resolved", resolved: "2026-08-02", locked: "yes", answer: "CSV.\n\n**Consequences**\n\n- Excel.\n\n**Gist:** CSV." }));
  fs.writeFileSync(path.join(qd, "02-row-count-ceiling.md"), q("Row-count ceiling", { type: "research · AFK", state: "resolved", resolved: "2026-08-02", answer: "**Gist:** 2M." }));
  fs.writeFileSync(path.join(qd, "03-testing-posture.md"), q("Testing posture", { state: "resolved", resolved: "2026-08-02", answer: "Unit and integration. `Dedicated phase only`. `Moderate (~60-80%)`.\n\n**Gist:** Unit." }));
  fs.writeFileSync(path.join(qd, "04-delivery-channel.md"), q("Delivery channel", { state: "resolved", resolved: "2026-08-03", blocked: "02", answer: "**Gist:** Link." }));
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace("- How far back an export may reach.\n", "").replace("Feasibility-technical 14/25", "Feasibility-technical 20/25"));
  P("reconcile", "audit-export");
  g = P("gate", "audit-export").json;
  assert.deepEqual(g.checks.filter((c) => !c.pass).map((c) => c.id), ["hard-caps"]);
  assert.match(g.caps[0].why, /research 02 Row-count ceiling is resolved with an empty ## Evidence/);
  fs.appendFileSync(path.join(qd, "02-row-count-ceiling.md"), "\n## Evidence\n\n- Query plan.\n\n**Research complete:** 2026-08-02\n");
  g = P("gate", "audit-export").json;
  assert.equal(g.mechanicalPass, true, JSON.stringify(g.checks));
  assert.ok(g.judgment.length >= 2, "the gate names what stays judgment");
});

test("pathfinder lint: loop tokens, checkboxes, reserved names, schema, cycles, scraper bait", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  let l = P("lint", "audit-export");
  assert.equal(l.code, 0, JSON.stringify(l.json.problems));
  const qd = path.join(root, pf, "questions");
  fs.appendFileSync(path.join(qd, "03-testing-posture.md"), "\n- [ ] a checkbox\nTASK_COMPLETE\n");
  fs.writeFileSync(path.join(qd, "06-loop-a.md"), q("Loop A", { blocked: "07" }));
  fs.writeFileSync(path.join(qd, "07-loop-b.md"), q("Loop B", { blocked: "06", type: "chat · HITL" }));
  write(root, `${pf}/overview.md`, "nope");
  write(root, `${pf}/briefs/brief-20260803.md`, "Requirements 18 and 90%\n");
  write(root, "specs/audit-export/PLAN-DRAFT-20260803.md", "**Charted by:** `/plan2code-0-pathfinder`\n**Confidence:** 85%\n| Requirements | 11 |\n");
  l = P("lint", "audit-export");
  assert.equal(l.code, 4);
  const msgs = l.json.problems.map((p) => `${p.file}: ${p.message}`).join("\n");
  for (const re of [/03-testing-posture\.md: has a checkbox/, /03-testing-posture\.md: contains the loop completion token TASK_COMPLETE/, /cycle 06 -> 07 -> 06|cycle 07 -> 06 -> 07/, /Type: "chat · HITL"/, /overview\.md is a reserved name/, /brief-20260803\.md: metrics-scraper bait \(bare Requirements/, /brief-20260803\.md: contains %/, /PLAN-DRAFT-20260803\.md: metrics-scraper bait \(overall confidence with %/, /PLAN-DRAFT-20260803\.md: metrics-scraper bait \(bare Requirements/]) {
    assert.match(msgs, re);
  }
});

test("pathfinder brief-data: range filtering, frontier notes, plain sections", () => {
  const { root } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  const today = P("brief-data", "audit-export").json;
  assert.equal(today.file, "specs/audit-export/pathfinder/briefs/brief-20260803.md");
  assert.deepEqual(today.decided, []);
  assert.equal(today.note, "No decisions were recorded in this period.");
  const full = P("brief-data", "audit-export", "--range", "full").json;
  assert.deepEqual(full.decided.map((d) => d.name), ["Codebase context", "Export format"]);
  assert.deepEqual(full.decided[1].rejected, ["*JSONL* - recipients use Excel."]);
  assert.equal(full.decided[1].hardToReverse, true);
  assert.equal(full.progress, "2 of 5 decisions made");
  assert.deepEqual(full.waiting, [{ name: "Delivery channel", waitingOn: ["Row-count ceiling"] }]);
  assert.deepEqual(full.fog, ["How far back an export may reach."]);
  assert.deepEqual(full.ruledOut, ["Redesign of the schema."]);
  assert.equal(full.confidence, "Confidence: not yet — Feasibility still needs work.");
  const since = P("brief-data", "audit-export", "--range", "since:2026-08-02").json;
  assert.deepEqual(since.decided.map((d) => d.name), ["Export format"]);
  assert.deepEqual(P("brief-data", "audit-export", "--range", "2026-08-01..2026-08-01").json.decided.map((d) => d.name), ["Codebase context"]);
  assert.equal(P("brief-data", "audit-export", "--range", "2026-08-05..2026-08-01").code, 2);
  assert.equal(P("brief-data", "audit-export", "--range", "yesterday").code, 2);
  assert.equal(P("brief-data", "nope").code, 3);
});

/* ================================================= verification regressions */

test("pathfinder: a ## Answer inside a fenced sketch is content, not an answer", () => {
  const { root, pf } = mapFixture();
  const qd = path.join(root, pf, "questions");
  fs.writeFileSync(path.join(qd, "03-testing-posture.md"), q("Testing posture", { type: "sketch · HITL", evidence: "```markdown\n## Answer\n\n**Gist:** fake\n```" }));
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  const r = P("reconcile", "audit-export");
  assert.ok(!r.json.repairs.some((x) => x.nn === "03"), JSON.stringify(r.json.repairs));
  assert.match(read(root, `${pf}/questions/03-testing-posture.md`), /State: open/);
});

test("pathfinder reconcile: an unrepairable file is skipped and named, nothing half-written, its row kept", () => {
  const { root, pf } = mapFixture();
  write(root, `${pf}/questions/07-bare.md`, `${B}\n\n# Bare\n\n## Answer\n\nYes.\n`);
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace("- [ ] [Gone question]", "- [ ] [Bare](./questions/07-bare.md)\n- [ ] [Gone question]"));
  const r = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["reconcile", "audit-export", "--root", root]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.findings.map((f) => [f.file, f.finding]), [["07-bare.md", "unrepairable"]]);
  assert.match(read(root, `${pf}/questions/01-export-format.md`), /State: resolved/, "the other repairs still landed");
  assert.equal(read(root, `${pf}/questions/07-bare.md`), `${B}\n\n# Bare\n\n## Answer\n\nYes.\n`, "left untouched");
  assert.ok(!r.json.mapChanges.some((c) => c.file === "07-bare.md"), JSON.stringify(r.json.mapChanges));
  assert.match(read(root, `${pf}/map.md`), /^- \[.\] \[Bare\]\(\.\/questions\/07-bare\.md\)$/m, "its row survives");
});

test("pathfinder reconcile: rows stay in place among grouping lines, a re-opened row loses its gist, stray claims clear", () => {
  const { root, pf } = mapFixture();
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace("- [ ] [Export format]", "### Group two\n\n- [x] [Export format]").replace("- [ ] [Export format](./questions/01-export-format.md)", "- [x] [Export format](./questions/01-export-format.md) — old gist *(2026-07-01)*"));
  fs.writeFileSync(path.join(root, pf, "questions/01-export-format.md"), q("Export format", { claimed: "2026-08-02 10:00" }));
  const r = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["reconcile", "audit-export", "--root", root]);
  assert.ok(r.json.repairs.some((x) => x.nn === "01" && x.repair === "stray-claim-cleared"));
  const map = read(root, `${pf}/map.md`);
  assert.match(map, /### Group two\n\n- \[ \] \[Export format\]\(\.\/questions\/01-export-format\.md\)\n/, "the group heading keeps its place and the row its old tail is gone");
});

test("pathfinder gate: testing posture by keyword (never from Rejected), research-style consequences count", () => {
  const { root, pf } = mapFixture();
  const qd = path.join(root, pf, "questions");
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  fs.writeFileSync(path.join(qd, "03-testing-posture.md"), q("Testing posture", { state: "resolved", resolved: "2026-08-02", answer: "Unit + integration, run after each phase, moderate coverage.\n\n**Gist:** Unit." }));
  fs.writeFileSync(path.join(qd, "01-export-format.md"), q("Export format", { state: "resolved", resolved: "2026-08-02", locked: "yes", answer: "### What this implies\n\n- Excel only.\n\n**Gist:** CSV." }));
  P("reconcile", "audit-export");
  let caps = P("gate", "audit-export").json.caps;
  assert.ok(!caps.some((c) => c.dimension === "Requirements"), JSON.stringify(caps));
  assert.ok(!caps.some((c) => c.dimension === "Risk"), JSON.stringify(caps));
  fs.writeFileSync(path.join(qd, "03-testing-posture.md"), q("Testing posture", { state: "resolved", resolved: "2026-08-02", answer: "Unit tests.\n\n**Rejected**\n\n- Run after each phase with Moderate coverage: too slow.\n\n**Gist:** Unit." }));
  caps = P("gate", "audit-export").json.caps;
  assert.ok(caps.some((c) => c.dimension === "Requirements" && /cadence/.test(c.why)), "a cadence named only as rejected does not count");
});

test("pathfinder: Form C needs a frontier; names come from the rows; NN is never handed out twice", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace("[Testing posture](", "[How we test]("));
  const c = P("trail", "audit-export", "--form", "C").json;
  assert.deepEqual(c.menu.options.map((o) => o.label), ["Row-count ceiling", "How we test", "Start fresh"]);
  fs.rmSync(path.join(root, pf, "questions/05-siem-push.md"));
  // Without the high-water line (an older map), the links alone still count.
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace(/^\*\*Next NN:\*\*.*\n/m, ""));
  assert.equal(P("frontier", "audit-export").json.nextNN, "06", "05 is still linked from the map");
  const qd = path.join(root, pf, "questions");
  fs.writeFileSync(path.join(qd, "02-row-count-ceiling.md"), q("Row-count ceiling", { blocked: "04" }));
  fs.writeFileSync(path.join(qd, "03-testing-posture.md"), q("Testing posture", { blocked: "04 (needs the channel)" }));
  P("reconcile", "audit-export");
  const none = P("trail", "audit-export", "--form", "C");
  assert.equal(none.code, 5);
  assert.equal(none.json.error, "no-frontier");
});

test("pathfinder lint: map %, brief scores and checkboxes, Planning Metrics in a pathfinder draft", () => {
  const { root, pf } = mapFixture();
  runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["reconcile", "audit-export", "--root", root]);
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8") + "\n80% sure.\n");
  write(root, `${pf}/briefs/brief-20260803.md`, "Solid at 22/25.\n- [ ] todo\n");
  write(root, "specs/audit-export/PLAN-DRAFT-20260803.md", "**Charted by:** `/plan2code-0-pathfinder`\n\n## Planning Metrics\n");
  const l = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["lint", "audit-export", "--root", root]).json;
  const msgs = l.problems.map((p) => `${p.level} ${p.message}`).join("\n");
  assert.match(msgs, /warn contains %; the map/);
  assert.match(msgs, /error contains a raw NN\/25 score/);
  assert.match(msgs, /error has a checkbox line/);
  assert.match(msgs, /error has a ## Planning Metrics section/);
});

test("pathfinder brief-data: calendar dates only, no future since, no NNs or links in what a brief prints", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  assert.equal(P("brief-data", "audit-export", "--range", "since:2026-13-99").json.error, "bad-date");
  assert.equal(P("brief-data", "audit-export", "--range", "since:2026-09-01").code, 2);
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace("- Redesign of the schema.", "- [SIEM push](./questions/05-siem-push.md) — not ours.\n- Nothing yet."));
  fs.writeFileSync(path.join(root, pf, "questions/04-delivery-channel.md"), q("Delivery channel", { blocked: "09" }));
  const j = P("brief-data", "audit-export", "--range", "full").json;
  assert.deepEqual(j.ruledOut, ["SIEM push — not ours."]);
  assert.deepEqual(j.waiting.find((w) => w.name === "Delivery channel").waitingOn, ["a question that no longer exists"]);
});

/* ===================================================== review-fix regressions */

test("pathfinder: claim, resolve and rule-out honour --dry-run", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  const snap = () => fs.readdirSync(path.join(root, pf, "questions")).map((n) => read(root, `${pf}/questions/${n}`)).concat(read(root, `${pf}/map.md`));
  const before = snap();
  const c = P("claim", "audit-export", "03", "--dry-run");
  assert.equal(c.code, 0, c.stderr);
  assert.deepEqual([c.json.dryRun, c.json.mapWritten], [true, false]);
  assert.deepEqual(snap(), before, "claim --dry-run leaves every file unchanged");
  fs.appendFileSync(path.join(root, pf, "questions/03-testing-posture.md"), "\n## Answer\n\nUnit.\n\n**Gist:** Unit.\n");
  const withAnswer = snap();
  const r = P("resolve", "audit-export", "03", "--dry-run");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual([r.json.dryRun, r.json.mapWritten], [true, false]);
  assert.deepEqual(snap(), withAnswer, "resolve --dry-run writes nothing");
  const o = P("rule-out", "audit-export", "02", "--reason", "not ours", "--dry-run");
  assert.equal(o.code, 0, o.stderr);
  assert.deepEqual([o.json.dryRun, o.json.mapWritten], [true, false]);
  assert.deepEqual(snap(), withAnswer, "rule-out --dry-run writes nothing");
  const real = P("claim", "audit-export", "02");
  assert.deepEqual([real.json.dryRun, real.json.mapWritten], [false, true]);
});

test("pathfinder: a deleted top NN is never reissued, linked from an answer or not", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  const qd = path.join(root, pf, "questions");
  const mp = path.join(root, pf, "map.md");
  // Start from a map with no high-water line and no stale 09 link: reconcile adds the line.
  fs.writeFileSync(mp, MAP.replace("- [ ] [Gone question](./questions/09-gone.md)\n", ""));
  fs.writeFileSync(path.join(qd, "06-subsumed.md"), q("Subsumed"));
  let r = P("reconcile", "audit-export");
  assert.deepEqual(r.json.mapChanges.find((c) => c.change === "next-nn"), { change: "next-nn", from: null, to: "07" });
  assert.match(read(root, `${pf}/map.md`), /^\*\*Next NN:\*\* 07$/m);
  // resolve.md: delete the subsumed file, reconcile drops its row, the absorbing answer links to it.
  fs.rmSync(path.join(qd, "06-subsumed.md"));
  fs.appendFileSync(path.join(qd, "04-delivery-channel.md"), "\n## Answer\n\nAbsorbed [Subsumed](./questions/06-subsumed.md).\n\n**Gist:** Link.\n");
  r = P("reconcile", "audit-export");
  assert.ok(r.json.mapChanges.some((c) => c.change === "row-dropped" && c.file === "06-subsumed.md"));
  assert.ok(!read(root, `${pf}/map.md`).includes("06-subsumed"), "the map no longer links it");
  assert.equal(P("frontier", "audit-export").json.nextNN, "07", "linked from an answer");
  // Even with the answer's link gone, the high-water mark holds.
  fs.writeFileSync(path.join(qd, "04-delivery-channel.md"), q("Delivery channel", { blocked: "02" }));
  assert.equal(P("frontier", "audit-export").json.nextNN, "07", "the **Next NN:** line");
  assert.equal(P("reconcile", "audit-export").json.nextNN, "07", "reconcile never lowers it");
  assert.equal(P("lint", "audit-export").code, 0, "lint accepts the line");
});

test("pathfinder: a name with brackets round-trips; reconcile is stable", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  write(root, `${pf}/questions/06-retention.md`, q("Retention [legal] hold"));
  for (let i = 0; i < 3; i++) assert.equal(P("reconcile", "audit-export").code, 0);
  const map = read(root, `${pf}/map.md`);
  assert.equal(map.split("\n").filter((l) => l.includes("06-retention.md")).length, 1, map);
  assert.match(map, /^- \[ \] \[Retention \[legal\] hold\]\(\.\/questions\/06-retention\.md\)$/m);
  assert.deepEqual(P("frontier", "audit-export").json.drift, []);
  assert.equal(P("reconcile", "audit-export").json.mapWritten, false);
});

test("pathfinder: an author's sub-bullet under a row survives resolve, rule-out and a marker change", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8")
    .replace("- [ ] [Testing posture](./questions/03-testing-posture.md)", "- [ ] [Testing posture](./questions/03-testing-posture.md)\n  - note: ask Dana first")
    .replace("- [ ] [Delivery channel](./questions/04-delivery-channel.md)", "- [ ] [Delivery channel](./questions/04-delivery-channel.md)\n  - note: depends on the volume\n    and wraps"));
  P("reconcile", "audit-export");
  let map = read(root, `${pf}/map.md`);
  assert.match(map, /- \[!\] \[Delivery channel\]\(\.\/questions\/04-delivery-channel\.md\) — Blocked by 02\n  - note: depends on the volume\n    and wraps\n/, "kept under a regenerated [!] row");
  P("claim", "audit-export", "03");
  fs.appendFileSync(path.join(root, pf, "questions/03-testing-posture.md"), "\n## Answer\n\nUnit.\n\n**Gist:** Unit tests only.\n");
  assert.equal(P("resolve", "audit-export", "03").code, 0);
  map = read(root, `${pf}/map.md`);
  assert.match(map, /- \[x\] \[Testing posture\]\(\.\/questions\/03-testing-posture\.md\) — Unit tests only\. \*\(2026-08-03\)\*\n  - note: ask Dana first\n/, "kept on resolve");
  assert.equal(P("rule-out", "audit-export", "04", "--reason", "not ours").code, 0);
  map = read(root, `${pf}/map.md`);
  assert.match(map, /- \[-\] \[Delivery channel\]\(\.\/questions\/04-delivery-channel\.md\) — out of scope, see below\n  - note: depends on the volume\n    and wraps\n/, "kept on rule-out");
  assert.deepEqual(P("frontier", "audit-export").json.drift, []);
});

test("pathfinder: AGENTS.md absent reads in the canonical and the skill's own wording", () => {
  for (const line of ["- `AGENTS.md` is absent.", "- No `AGENTS.md`.", "- No AGENTS.md; init skipped."]) {
    const { root, pf } = mapFixture();
    fs.rmSync(path.join(root, "AGENTS.md"));
    const mp = path.join(root, pf, "map.md");
    fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace("- `AGENTS.md` exists and governs.", line));
    const g = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["gate", "audit-export", "--root", root]).json;
    assert.deepEqual([g.agentsAbsent, g.initFirst], [true, true], line);
  }
});

test("pathfinder lint: a failure carries error, message and next, on stderr too", () => {
  const { root, pf } = mapFixture();
  runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["reconcile", "audit-export", "--root", root]);
  fs.appendFileSync(path.join(root, pf, "questions/03-testing-posture.md"), "\n- [ ] a checkbox\n");
  const l = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["lint", "audit-export", "--root", root]);
  assert.equal(l.code, 4);
  assert.deepEqual([l.json.ok, l.json.error, l.json.message, l.json.next], [false, "lint-failed", "lint found 1 error.", "Fix each error in problems, then rerun lint."]);
  assert.equal(l.json.errors, 1);
  assert.equal(l.json.problems.filter((p) => p.level === "error").length, 1);
  assert.match(l.stderr, /^error: lint found 1 error\.\nnext: Fix each error in problems, then rerun lint\.\n$/);
});

test("pathfinder lint: densely blocked questions check in linear time", () => {
  const root = tmp("pfd");
  const pf = "specs/dense/pathfinder";
  write(root, `${pf}/map.md`, MAP);
  write(root, `${pf}/questions/00-codebase-context.md`, q("Codebase context", { type: "legwork · AFK", state: "resolved", resolved: "2026-08-01", answer: "**Gist:** Node." }));
  for (let i = 1; i < 40; i++) {
    const nn = String(i).padStart(2, "0");
    const blocked = i === 1 ? "00" : [i - 1, i - 2].map((n) => String(n).padStart(2, "0")).join(", ");
    write(root, `${pf}/questions/${nn}-q${nn}.md`, q(`Q ${nn}`, { blocked }));
  }
  const t0 = Date.now();
  const l = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["lint", "dense", "--root", root]);
  const ms = Date.now() - t0;
  assert.ok(!(l.json.problems || []).some((p) => /cycle/.test(p.message)), JSON.stringify(l.json.problems));
  assert.ok(ms < 2000, `lint took ${ms} ms`);
  // A cycle is still found, once, in the same format.
  write(root, `${pf}/questions/01-q01.md`, q("Q 01", { blocked: "39" }));
  const c = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["lint", "dense", "--root", root]).json;
  const cycles = c.problems.filter((p) => /cycle/.test(p.message));
  assert.ok(cycles.length >= 1, JSON.stringify(c.problems));
  assert.match(cycles[0].message, /^Blocked by: cycle (\d\d)( -> \d\d)+ -> \1;/);
});

test("pathfinder: a one-digit NN is question 0N everywhere, and lint asks for the rename", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  write(root, `${pf}/questions/6-short.md`, q("Short"));
  write(root, `${pf}/questions/07-after.md`, q("After", { blocked: "06" }));
  P("reconcile", "audit-export");
  const f = P("frontier", "audit-export").json;
  assert.ok(f.frontier.some((x) => x.nn === "06" && x.name === "Short"), JSON.stringify(f.frontier));
  assert.deepEqual(f.blocked.find((x) => x.nn === "07").blockedBy, [{ nn: "06", name: "Short", state: "open" }]);
  assert.equal(P("claim", "audit-export", "6").json.nn, "06");
  const l = P("lint", "audit-export").json;
  assert.ok(l.problems.some((p) => p.level === "error" && /6-short\.md$/.test(p.file) && /rename it to 06-short\.md/.test(p.message)), JSON.stringify(l.problems));
});

test("pathfinder: a duplicate map row is reported as drift and dropped by name", () => {
  const { root, pf } = mapFixture();
  const P = (...a) => runScript("plan2code-0-pathfinder", "pathfinder.mjs", [...a, "--root", root]);
  P("reconcile", "audit-export");
  const mp = path.join(root, pf, "map.md");
  fs.writeFileSync(mp, fs.readFileSync(mp, "utf8").replace("- [ ] [Testing posture](./questions/03-testing-posture.md)", "- [ ] [Testing posture](./questions/03-testing-posture.md)\n- [ ] [Testing again](./questions/03-testing-posture.md)"));
  assert.ok(P("frontier", "audit-export").json.drift.includes("map row 03-testing-posture.md appears 2 times"));
  const r = P("reconcile", "audit-export");
  assert.deepEqual(r.json.mapChanges, [{ change: "row-dropped", file: "03-testing-posture.md", name: "Testing again", why: "duplicate row" }]);
  assert.equal(read(root, `${pf}/map.md`).split("\n").filter((l) => l.includes("03-testing-posture.md")).length, 1);
  assert.deepEqual(P("frontier", "audit-export").json.drift, []);
});

test("pathfinder lint: the chart.md map template lints clean", () => {
  const chart = fs.readFileSync(path.join(SKILLS, "plan2code-0-pathfinder", "references", "chart.md"), "utf8");
  const template = chart.split("## The `map.md` template")[1].match(/```markdown\r?\n([\s\S]*?)\r?\n```/)[1];
  assert.match(template, /^\*\*Next NN:\*\* \d+$/m, "the template carries the high-water line");
  const root = tmp("pft");
  write(root, "specs/audit-log-export/pathfinder/map.md", template + "\n");
  const l = runScript("plan2code-0-pathfinder", "pathfinder.mjs", ["lint", "audit-log-export", "--root", root]);
  assert.equal(l.code, 0, JSON.stringify(l.json.problems));
  assert.deepEqual([l.json.errors, l.json.warnings], [0, 0], JSON.stringify(l.json.problems));
});
