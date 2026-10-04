// Tests for plan2code-4-finalize's scripts/feedback-payload.mjs.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { ROOT, SKILLS, NOW, runScript, tmp, write, read, gitInit, phase } from "./skill-script-helpers.mjs";

/* ========================================================= feedback-payload.mjs */

test("feedback-payload: payload from the archive, real prompt hashes, size and truncation", () => {
  const root = tmp("fb");
  const spec = "specs--completed/lunch-vote";
  write(root, `${spec}/PLAN-DRAFT-20260801.md`, '# Plan\n\n<!-- METRICS_JSON {"confidence": 92, "clarification_rounds": 1, "functional_requirements_count": 5, "non_functional_requirements_count": 2, "risk_count": 3, "phase_count": 2, "verification_gaps_found": 0, "confidence_breakdown": {"requirements": 24, "feasibility": 23, "integration": 23, "risk": 22}} -->\n');
  write(root, `${spec}/overview.md`, '# O\n\n<!-- METRICS_JSON {"step": "document", "total_tasks": 3, "tasks_per_phase": [2, 1], "phase_count": 2, "parallel_groups_identified": 0, "verification_items_added": 1} -->\n\n## User Feedback\n| Field | Value |\n|-------|-------|\n| Rating | 8 |\n| Reason | Good \\| fast |\n| Went Well | Specs |\n| Went Poorly | Review |\n');
  write(root, `${spec}/phase-1.md`, phase(1, "Complete", [["x", "1.1"], ["x", "1.T"]]));
  write(root, `${spec}/phase-2.md`, phase(2, "Complete", [["!", "2.1"]]));
  const outDir = path.join(root, "out");
  const F = (...a) => runScript("plan2code-4-finalize", "feedback-payload.mjs", [...a, "--root", root]);
  assert.equal(F("build", "lunch-vote", "--out", outDir).code, 2, "the two judgment counts are required");
  const b = F("build", "lunch-vote", "--out", outDir, "--set", "verification_failures_found=1", "--set", "documentation_updates_needed=2");
  assert.equal(b.code, 0, b.stderr);
  const p = b.json.payload;
  assert.match(p.run_id, /^run-20260803-140500-[0-9a-f]{4}$/);
  assert.equal(p.plan2code_version, JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8")).version);
  const srcHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "src", "plan2code-1-plan.md"), "utf8")).digest("hex").slice(0, 12);
  assert.equal(p.prompt_versions_short.plan, srcHash, "the hash is the src prompt's, recovered from the installed SKILL.md");
  assert.ok(Object.values(p.prompt_versions_short).every((v) => /^[0-9a-f]{12}$/.test(v)));
  assert.deepEqual(p.step1.confidence_breakdown, { requirements: 24, feasibility: 23, integration: 23, risk: 22 });
  assert.equal(p.step1.final_confidence, 92);
  assert.equal(p.step2.total_tasks, 3);
  assert.deepEqual(p.step3, { task_completion_rate: 0.67, tasks_completed: 2, tasks_total: 3, blocker_count: 1 });
  assert.deepEqual(p.step4, { completion_rate_at_audit: 0.67, verification_failures_found: 1, documentation_updates_needed: 2, archival_succeeded: true });
  assert.deepEqual(p.user_feedback, { overall_rating: 8, rating_reason: "Good | fast", what_went_well: "Specs", what_went_poorly: "Review" });
  assert.equal(b.json.title, `[Feedback] v${p.plan2code_version} - rating 8/10`);
  assert.match(b.json.body, /<!-- METRICS_JSON \{"schema_version":"1\.0"/);
  assert.ok(!/[—]/.test(b.json.title), "no em dash in the issue title");
  assert.equal(b.json.oversize, false);
  assert.ok(fs.existsSync(path.join(outDir, "body.md")));
  // The ingest side parses the body back.
  const parsed = JSON.parse(b.json.body.match(/<!--\s*METRICS_JSON\s+(\{[\s\S]*?\})\s*-->/)[1]);
  assert.equal(parsed.schema_version, "1.0");
  // Oversize, then truncate.
  const ov = path.join(root, spec, "overview.md");
  fs.writeFileSync(ov, fs.readFileSync(ov, "utf8").replace("| Good \\| fast |", `| ${"long reason ".repeat(500)} |`));
  const big = F("build", "lunch-vote", "--out", outDir, "--set", "verification_failures_found=1", "--set", "documentation_updates_needed=2");
  assert.equal(big.json.oversize, true);
  assert.match(big.json.next, /--truncate/);
  const cut = F("build", "lunch-vote", "--out", outDir, "--set", "verification_failures_found=1", "--set", "documentation_updates_needed=2", "--truncate");
  assert.equal(cut.json.oversize, false);
  assert.deepEqual(cut.json.truncated, ["rating_reason"]);
  const dry = runScript("plan2code-4-finalize", "feedback-payload.mjs", ["submit", "--from", outDir, "--dry-run"]);
  assert.equal(dry.code, 0);
  assert.match(dry.json.tiers[0], /^gh issue create --repo jparkerweb\/plan2code .*--label community-feedback$/);
  assert.equal(dry.json.oversize, false);
  assert.equal(dry.json.urlBytes, cut.json.urlBytes);
  fs.writeFileSync(ov, "# O\n");
  assert.equal(F("build", "lunch-vote", "--set", "verification_failures_found=1", "--set", "documentation_updates_needed=2").code, 3, "no feedback table, nothing to submit");
});

/* ================================================= verification regressions */

test("feedback-payload: truncation always ends, '-->' survives ingest, lenient rating, absent steps are null", () => {
  const root = tmp("fb2");
  const spec = "specs--completed/x";
  const long = (w) => `${w} `.repeat(400).trim();
  // The visible answers carry markup that must stay text: a stray comment
  // opener, and a fake payload comment an ingest regex could match first.
  const fake = '<!-- METRICS_JSON {"schema_version":"1.0"} -->';
  const inputs = { rating_reason: `see {a} --> b <!-- x ${long("reason")}`, what_went_well: `${fake} ${long("well")}`, what_went_poorly: long("poorly") };
  write(root, `${spec}/overview.md`, `# O\n\n## User Feedback\n| field | value |\n|---|---|\n| rating | 8/10 |\n| reason | ${inputs.rating_reason} |\n| went well | ${inputs.what_went_well} |\n| went poorly | ${inputs.what_went_poorly} |\n`);
  write(root, `${spec}/phase-1.md`, phase(1, "Complete", [["x", "1.1"]]));
  const F = (...a) => runScript("plan2code-4-finalize", "feedback-payload.mjs", [...a, "--root", root]);
  const sets = ["--set", "verification_failures_found=0", "--set", "documentation_updates_needed=0"];
  assert.equal(F("build", "x", ...sets, "--set", "bogus=1").code, 2);
  // Untruncated, the first METRICS_JSON match is the real payload: its answers
  // come back exactly as typed, not the fake's bare schema_version.
  const whole = F("build", "x", ...sets, "--out", path.join(root, "whole"));
  assert.equal(whole.code, 0, whole.stderr);
  const first = JSON.parse(whole.json.body.match(/<!--\s*METRICS_JSON\s+(\{[\s\S]*?\})\s*-->/)[1]);
  assert.deepEqual(first.user_feedback, { overall_rating: 8, ...inputs });
  assert.equal(whole.json.body.split("<!--").length - 1, 1, "the payload's is the only comment that opens");
  assert.ok(!/<!--(?! METRICS_JSON \{"schema_version":"1\.0","run_id")/.test(whole.json.body), "no comment opens before the payload's");
  const r = spawnSync(process.execPath, [path.join(SKILLS, "plan2code-4-finalize", "scripts", "feedback-payload.mjs"), "build", "x", ...sets, "--truncate", "--out", path.join(root, "out"), "--root", root], { encoding: "utf8", timeout: 20000, env: { ...process.env, PLAN2CODE_NOW: NOW } });
  assert.equal(r.status, 0, "build --truncate finishes with every field long");
  const j = JSON.parse(r.stdout);
  assert.equal(j.oversize, false);
  assert.deepEqual(j.truncated, ["rating_reason", "what_went_well", "what_went_poorly"]);
  assert.equal(j.payload.user_feedback.overall_rating, 8, "8/10 reads as 8, field names in any case");
  assert.equal(j.payload.step1, null);
  assert.equal(j.payload.step2, null);
  // The ingest side's own extraction regex (plan2code-metrics collector.ts).
  const m = j.body.match(/<!--\s*METRICS_JSON\s+(\{[\s\S]*?\})\s*-->/);
  const back = JSON.parse(m[1]);
  assert.match(back.user_feedback.rating_reason, /^see \{a\} --> b <!-- x/);
  assert.equal(back.user_feedback.what_went_well, j.payload.user_feedback.what_went_well);
  assert.match(back.user_feedback.what_went_well, /^<!-- METRICS_JSON/, "the fake comment is still just text in the real payload");
  assert.ok(!/<!--(?! METRICS_JSON \{"schema_version":"1\.0","run_id")/.test(j.body), "no comment opens before the payload's");
});

test("feedback-payload: --truncate never splits an emoji", () => {
  const root = tmp("fb3");
  const spec = "specs--completed/x";
  const reason = "a" + "\u{1F44D}".repeat(400);
  write(root, `${spec}/overview.md`, `# O\n\n## User Feedback\n| Field | Value |\n|---|---|\n| Rating | 9 |\n| Reason | ${reason} |\n| Went Well | ok |\n| Went Poorly | none |\n`);
  write(root, `${spec}/phase-1.md`, phase(1, "Complete", [["x", "1.1"]]));
  const r = runScript("plan2code-4-finalize", "feedback-payload.mjs", ["build", "x", "--set", "verification_failures_found=0", "--set", "documentation_updates_needed=0", "--truncate", "--out", path.join(root, "out"), "--root", root]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.oversize, false);
  assert.deepEqual(r.json.truncated, ["rating_reason"]);
  const back = JSON.parse(r.json.body.match(/<!--\s*METRICS_JSON\s+(\{[\s\S]*?\})\s*-->/)[1]);
  assert.equal(back.user_feedback.rating_reason, r.json.payload.user_feedback.rating_reason);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(back.user_feedback.rating_reason), "no lone high surrogate");
  assert.match(back.user_feedback.rating_reason, /^a(\u{1F44D})+\.\.\.$/u);
});

test("feedback-payload: task counts read the same phase files specs.mjs does, never a stale sibling", () => {
  const root = tmp("fb5");
  const spec = "specs--completed/x";
  write(root, `${spec}/overview.md`, "# O\n\n## User Feedback\n| Field | Value |\n|---|---|\n| Rating | 7 |\n| Reason | r |\n| Went Well | w |\n| Went Poorly | p |\n");
  write(root, `${spec}/phase-1.md`, phase(1, "Complete", [["x", "1.1"], ["x", "1.2"]]));
  write(root, `${spec}/phase-1-old.md`, phase(1, "Not Started", [[" ", "1.1"], [" ", "1.2"], [" ", "1.3"]]));
  const r = runScript("plan2code-4-finalize", "feedback-payload.mjs", ["build", "x", "--set", "verification_failures_found=0", "--set", "documentation_updates_needed=0", "--out", path.join(root, "out"), "--root", root]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.payload.step3, { task_completion_rate: 1, tasks_completed: 2, tasks_total: 2, blocker_count: 0 });
  const m = runScript("plan2code-4-finalize", "specs.mjs", ["metrics", spec, "--step", "finalize", "--set", "verification_failures_found=0", "--set", "documentation_updates_needed=0", "--root", root]);
  assert.equal(m.code, 0, m.stderr);
  assert.equal(m.json.metrics.tasks_total, r.json.payload.step3.tasks_total);
  assert.equal(m.json.metrics.tasks_completed, r.json.payload.step3.tasks_completed);
});

test("feedback-payload: a bare name in both specs/ and specs--completed/ is ambiguous", () => {
  const root = tmp("fb4");
  const table = (rating) => `# O\n\n## User Feedback\n| Field | Value |\n|---|---|\n| Rating | ${rating} |\n| Reason | r |\n| Went Well | w |\n| Went Poorly | p |\n`;
  write(root, "specs--completed/x/overview.md", table(3));
  write(root, "specs/x/overview.md", table(7));
  const sets = ["--set", "verification_failures_found=0", "--set", "documentation_updates_needed=0"];
  const F = (...a) => runScript("plan2code-4-finalize", "feedback-payload.mjs", [...a, ...sets, "--out", path.join(root, "out"), "--root", root]);
  const bare = F("build", "x");
  assert.equal(bare.code, 5);
  assert.equal(bare.json.error, "ambiguous-spec");
  assert.match(bare.json.next, /specs\/x/);
  const live = F("build", "specs/x");
  assert.equal(live.code, 0, live.stderr);
  assert.equal(live.json.payload.user_feedback.overall_rating, 7, "the exact path reads this run, not the old archive");
  assert.equal(live.json.payload.step4.archival_succeeded, false);
});

test("feedback-payload: submit refuses an oversize URL when gh fails, and dry-run says so", () => {
  const root = tmp("fb5");
  write(root, "specs--completed/x/overview.md", `# O\n\n## User Feedback\n| Field | Value |\n|---|---|\n| Rating | 6 |\n| Reason | ${"long reason ".repeat(800)} |\n| Went Well | w |\n| Went Poorly | p |\n`);
  const outDir = path.join(root, "out");
  const b = runScript("plan2code-4-finalize", "feedback-payload.mjs", ["build", "x", "--set", "verification_failures_found=0", "--set", "documentation_updates_needed=0", "--out", outDir, "--root", root]);
  assert.equal(b.json.oversize, true);
  const dry = runScript("plan2code-4-finalize", "feedback-payload.mjs", ["submit", "--from", outDir, "--dry-run"]);
  assert.equal(dry.code, 0);
  assert.equal(dry.json.oversize, true);
  assert.equal(dry.json.urlBytes, b.json.urlBytes);
  // gh must never succeed here: no PATH but node's own folder (so gh is not
  // found), and should one turn up anyway, an empty config, no token and a
  // host that does not resolve.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(path|gh_|github_token$)/i.test(k)));
  Object.assign(env, { PATH: path.dirname(process.execPath), GH_CONFIG_DIR: tmp("fb5-gh"), GH_HOST: "gh.invalid", PLAN2CODE_NOW: NOW });
  const r = spawnSync(process.execPath, [path.join(SKILLS, "plan2code-4-finalize", "scripts", "feedback-payload.mjs"), "submit", "--from", outDir], { cwd: root, encoding: "utf8", timeout: 70000, env });
  assert.equal(r.status, 4, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.error, "oversize");
  assert.match(j.next, /--truncate/);
  assert.match(j.next, /gh/);
});
