// Tests for the skill-script plumbing (installer) and the shared scripts in src/skill-scripts/.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, SKILLS, NOW, runScript, tmp, write, read, gitInit, phase } from "./skill-script-helpers.mjs";

/* ================================================================ install */

test("every skill with scripts ships common.mjs and version.json; dashboard ships none", () => {
  const withScripts = fs.readdirSync(SKILLS).filter((s) => fs.existsSync(path.join(SKILLS, s, "scripts")));
  assert.ok(withScripts.length >= 11, `expected most skills to carry scripts, got ${withScripts.join(", ")}`);
  for (const s of withScripts) {
    for (const f of ["common.mjs", "version.json"]) assert.ok(fs.existsSync(path.join(SKILLS, s, "scripts", f)), `${s}/scripts/${f}`);
  }
  assert.ok(!fs.existsSync(path.join(SKILLS, "plan2code", "scripts")), "the dashboard needs no scripts");
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8")).version;
  assert.equal(JSON.parse(fs.readFileSync(path.join(SKILLS, "plan2code-4-finalize", "scripts", "version.json"), "utf8")).version, v);
});

test("every script a SKILL.md (or a reference it ships) runs exists beside it, and answers --help", () => {
  for (const skill of fs.readdirSync(SKILLS)) {
    const dir = path.join(SKILLS, skill);
    const texts = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (e.name !== "web-console" && e.name !== "scripts") walk(p);
        } else if (e.name.endsWith(".md")) texts.push(fs.readFileSync(p, "utf8"));
      }
    };
    walk(dir);
    const named = new Set();
    for (const t of texts) for (const m of t.matchAll(/<S>\/([a-z-]+\.mjs)/g)) named.add(m[1]);
    for (const script of named) {
      const p = path.join(dir, "scripts", script);
      assert.ok(fs.existsSync(p), `${skill} names <S>/${script} but scripts/${script} is not shipped`);
      const r = spawnSync(process.execPath, [p, "--help"], { encoding: "utf8" });
      assert.equal(r.status, 0, `${skill}/${script} --help`);
      assert.match(r.stdout, /Exit:/, `${skill}/${script} --help documents its exit codes`);
    }
  }
});

test("scripts are self-contained: built-ins and siblings only", () => {
  for (const dir of [path.join(ROOT, "src", "skill-scripts"), ...fs.readdirSync(path.join(ROOT, "src")).filter((n) => n.endsWith("-scripts")).map((n) => path.join(ROOT, "src", n))]) {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
      const t = fs.readFileSync(path.join(dir, f), "utf8");
      for (const m of t.matchAll(/^import .* from "([^"]+)";$/gm)) {
        assert.ok(m[1].startsWith("node:") || m[1] === "./common.mjs", `${f} imports ${m[1]}`);
      }
      assert.ok(!/[\u0000-\u0008]/.test(t), `${f} contains a control character (an escape lost in an edit?)`);
    }
  }
});

/* ================================================================ specs.mjs */

const OVERVIEW = `# Lunch vote

## Phase Checklist

- [x] **[Phase 1: Data model](./phase-1.md)** - 3 tasks.
- [/] [Phase 2: API](./phase-2.md) _(2 tasks)_
- [ ] **Phase 3 — Web UI** — see [phase-3.md](./phase-3.md)
- [ ] [Phase 4: Docs](./phase-4.md): readme **[Milestone 1]**

## Parallel Execution Groups

| Group | Phases | Reason |
|-------|--------|--------|
| A | 3, 4 | Separate files |
| B (sequential) | 1, 2 | Not parallel |

## Quick Reference
`;

function specFixture() {
  const root = tmp("specs");
  write(root, "AGENTS.md", "# AGENTS.md\n");
  write(root, "specs/lunch-vote/overview.md", OVERVIEW);
  write(root, "specs/lunch-vote/PLAN-DRAFT-20260801.md", "# Plan\n\n**Status:** Complete\n");
  write(root, "specs/lunch-vote/phase-1.md", phase(1, "Complete", [["x", "1.1"], ["x", "1.2"], ["x", "1.T"]]));
  write(root, "specs/lunch-vote/phase-2.md", phase(2, "In Progress", [["x", "2.1"], [" ", "2.2"]]));
  write(root, "specs/lunch-vote/phase-3.md", phase(3, "Not Started", [[" ", "3.1"], [" ", "3.2"], [" ", "3.2a"], [" ", "3.4"]], "\n## Phase Testing\n\n- [ ] Run unit tests\n"));
  write(root, "specs/lunch-vote/phase-4.md", phase(4, "Not Started", [["!", "4.1"], ["?", "4.2"]]));
  write(root, "specs/idea-only/pathfinder/map.md", "# Map\n\n**Status:** Working\n");
  write(root, "specs--completed/old-one/overview.md", "# Old\n");
  return root;
}

test("specs list: active specs with state, drafts and archives, never specs--completed", () => {
  const root = specFixture();
  const r = runScript("plan2code-1-plan", "specs.mjs", ["list", "--root", root]);
  assert.equal(r.code, 0, r.stderr);
  const names = r.json.specs.map((s) => s.name).sort();
  assert.deepEqual(names, ["idea-only", "lunch-vote"]);
  const lv = r.json.specs.find((s) => s.name === "lunch-vote");
  assert.equal(lv.state, "building");
  assert.deepEqual(lv.planDrafts, [{ file: "PLAN-DRAFT-20260801.md", archived: false, status: "Complete" }]);
  assert.equal(lv.phaseFiles, 4);
  assert.deepEqual(r.json.completed, ["old-one"]);
  assert.equal(r.json.hasAgents, true);
});

test("specs status: checklist formats, groups, task markers, numbering, totals, checks", () => {
  const root = specFixture();
  const r = runScript("plan2code-3-implement", "specs.mjs", ["status", "specs/lunch-vote/overview.md", "--root", root]);
  assert.equal(r.code, 0, r.stderr);
  const j = r.json;
  assert.deepEqual(j.phases.map((p) => [p.number, p.name, p.checklist]), [
    [1, "Data model", "complete"],
    [2, "API", "in-progress"],
    [3, "Web UI", "pending"],
    [4, "Docs", "pending"],
  ]);
  assert.deepEqual(j.parallelGroups.map((g) => [g.id, g.phases]), [["A", [3, 4]]], "a group labelled sequential is not a parallel group");
  assert.deepEqual(j.totals, { total: 11, complete: 4, assumed: 1, pending: 5, "in-progress": 0, blocked: 1, unknown: 0, completed: 5, incomplete: 5 });
  assert.equal(j.completionPercent, 45);
  assert.equal(j.phases[0].tasks.total, 3, "a named testing task (1.T) counts");
  assert.equal(j.phases[0].goal, "Phase 1 builds the thing.");
  const codes = j.checks.map((c) => c.code);
  assert.ok(j.checks.some((c) => c.code === "task-numbering" && /expected 3\.3, found 3\.4/.test(c.message)), JSON.stringify(j.checks));
  assert.ok(!codes.includes("criteria-checkbox"), "a Phase Testing checkbox block is the template's own");
  assert.ok(j.checks.some((c) => c.code === "unchecked-with-done-tasks" && /Phase 4/.test(c.message)), "an assumed [?] task counts as done, so a [ ] phase holding one is flagged");
  assert.equal(j.next.action, "ask-resume");
  assert.equal(j.next.phase.number, 2);
  assert.deepEqual(j.pending.map((p) => p.number), [2, 3, 4]);
});

test("specs status: the implement selection table", () => {
  const root = specFixture();
  const ov = (m1, m2, m3, m4) => OVERVIEW.replace("- [x] **[Phase 1", `- [${m1}] **[Phase 1`).replace("- [/] [Phase 2", `- [${m2}] [Phase 2`).replace("- [ ] **Phase 3", `- [${m3}] **Phase 3`).replace("- [ ] [Phase 4", `- [${m4}] [Phase 4`);
  const next = (...m) => {
    write(root, "specs/lunch-vote/overview.md", ov(...m));
    return runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json.next;
  };
  assert.deepEqual(next("x", "x", " ", " ").action, "choose");
  assert.deepEqual(next("x", "x", " ", " ").options.map((o) => o.number), [3, 4]);
  assert.ok(next("x", "x", "/", "/").warning, "all options already [/] warns about duplicated work");
  assert.equal(next("x", " ", " ", " ").action, "auto-start");
  assert.equal(next("x", "x", "x", " ").action, "auto-start");
  assert.equal(next("x", "x", "x", "x").action, "none");
  assert.equal(next("x", "x", "x", "x").reason, "every phase is complete");
});

test("specs status: drift between the checklist and the phase files is an error", () => {
  const root = specFixture();
  write(root, "specs/lunch-vote/overview.md", OVERVIEW.replace("- [/] [Phase 2", "- [x] [Phase 2"));
  write(root, "specs/lunch-vote/phase-5.md", phase(5, "Not Started", [[" ", "5.1"]]));
  const j = runScript("plan2code-1b-revise-plan", "specs.mjs", ["status", "lunch-vote", "--root", root]).json;
  assert.ok(j.checks.some((c) => c.code === "checked-with-open-tasks" && /Phase 2/.test(c.message)));
  assert.ok(j.checks.some((c) => c.code === "missing-checklist-row" && /phase-5/.test(c.message)));
});

test("specs status: errors are actionable and exit-coded", () => {
  const root = specFixture();
  const miss = runScript("plan2code-1-plan", "specs.mjs", ["status", "nope", "--root", root]);
  assert.equal(miss.code, 3);
  assert.equal(miss.json.error, "spec-not-found");
  assert.match(miss.json.next, /specs\.mjs list/);
  assert.equal(runScript("plan2code-1-plan", "specs.mjs", ["frobnicate"]).code, 2);
  assert.equal(runScript("plan2code-1-plan", "specs.mjs", ["status", "lunch-vote", "--bogus"]).code, 2);
  const archived = runScript("plan2code-4-finalize", "specs.mjs", ["mark", "specs--completed/old-one", "--phase", "1", "--to", "done", "--root", root]);
  assert.equal(archived.code, 5);
});

test("specs mark: transitions, the no-reset rule, dry-run and idempotence", () => {
  const root = specFixture();
  const S = (...a) => runScript("plan2code-3-implement", "specs.mjs", [...a, "--root", root]);
  const dry = S("mark", "lunch-vote", "--phase", "3", "--to", "in-progress", "--dry-run");
  assert.equal(dry.code, 0);
  assert.equal(dry.json.changed, true);
  assert.match(read(root, "specs/lunch-vote/overview.md"), /- \[ \] \*\*Phase 3/, "dry-run writes nothing");
  assert.equal(S("mark", "lunch-vote", "--phase", "3", "--to", "in-progress").code, 0);
  assert.match(read(root, "specs/lunch-vote/overview.md"), /- \[\/\] \*\*Phase 3 — Web UI\*\* — see/, "only the marker changes");
  assert.equal(S("mark", "lunch-vote", "--phase", "3", "--to", "in-progress").json.changed, false);
  const reset = S("mark", "lunch-vote", "--phase", "3", "--to", "open");
  assert.equal(reset.code, 5);
  assert.equal(reset.json.error, "no-reset");
  const done = S("mark", "lunch-vote", "--phase", "2", "--to", "done");
  assert.equal(done.code, 0);
  assert.match(read(root, "specs/lunch-vote/overview.md"), /- \[x\] \[Phase 2: API\]/);
  assert.match(read(root, "specs/lunch-vote/phase-2.md"), /^\*\*Status:\*\* Complete$/m);
  assert.equal(S("mark", "lunch-vote", "--phase", "9", "--to", "done").code, 3);
  assert.equal(S("mark", "lunch-vote", "--phase", "1", "--to", "open").code, 0, "re-opening a complete phase (revise-plan) is allowed");
});

test("specs metrics: document and finalize comments, judgment fields from --set", () => {
  const root = specFixture();
  const S = (...a) => runScript("plan2code-2-document", "specs.mjs", [...a, "--root", root]);
  assert.equal(S("metrics", "lunch-vote", "--step", "document").code, 2, "verification_items_added is the agent's number");
  write(root, "specs/lunch-vote/phase-3.md", read(root, "specs/lunch-vote/phase-3.md") + "\n<!-- VERIFICATION: Added (FR-2) -->\n");
  const doc = S("metrics", "lunch-vote", "--step", "document", "--set", "verification_items_added=1");
  assert.equal(doc.code, 0, doc.stderr);
  assert.equal(doc.json.comment, '<!-- METRICS_JSON {"step": "document", "total_tasks": 11, "tasks_per_phase": [3, 2, 4, 2], "phase_count": 4, "parallel_groups_identified": 1, "verification_items_added": 1} -->');
  assert.equal(doc.json.verificationCommentsFound, 1);
  assert.equal(S("metrics", "lunch-vote", "--step", "finalize").code, 2);
  const fin = S("metrics", "lunch-vote", "--step", "finalize", "--set", "verification_failures_found=1", "--set", "documentation_updates_needed=2");
  assert.equal(fin.json.comment, '<!-- METRICS_JSON {"step": "finalize", "completion_rate_at_audit": 0.45, "tasks_completed": 5, "tasks_total": 11, "verification_failures_found": 1, "documentation_updates_needed": 2} -->');
});

test("specs archive: dry-run, move, refuse to clobber", () => {
  const root = specFixture();
  const S = (...a) => runScript("plan2code-4-finalize", "specs.mjs", [...a, "--root", root]);
  const dry = S("archive", "lunch-vote", "--dry-run");
  assert.equal(dry.code, 0);
  assert.ok(dry.json.files.includes("overview.md"));
  assert.ok(fs.existsSync(path.join(root, "specs/lunch-vote")));
  const moved = S("archive", "lunch-vote");
  assert.equal(moved.code, 0, moved.stdout);
  assert.equal(moved.json.sourceRemoved, true);
  assert.equal(moved.json.filesAtTarget, dry.json.files.length);
  assert.ok(fs.existsSync(path.join(root, "specs--completed/lunch-vote/phase-4.md")));
  write(root, "specs/idea-only/x.md", "x");
  fs.mkdirSync(path.join(root, "specs--completed/idea-only"));
  const clash = S("archive", "idea-only");
  assert.equal(clash.code, 5);
  assert.ok(fs.existsSync(path.join(root, "specs/idea-only/x.md")), "nothing moved on refusal");
  const after = S("status", "specs--completed/lunch-vote");
  assert.equal(after.code, 0, "status reads an archived spec (Finalize after Step 6)");
});

/* ============================================================ commit-msg.mjs */

test("commit-msg: ticket from the branch, the three -m flags, subject rules", () => {
  const repo = tmp("commit");
  const g = gitInit(repo, "feature/PCWEB-10968-export-csv");
  write(repo, "a.txt", "a");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  const C = (...a) => runScript("plan2code-review", "commit-msg.mjs", a, { cwd: repo });
  const ok = C("--subject", "Add the export endpoint", "--add-all");
  assert.equal(ok.code, 0, ok.stderr);
  assert.equal(ok.json.ticket, "PCWEB-10968");
  assert.equal(ok.json.command, 'git add -A && git commit -m "Add the export endpoint" -m "PCWEB-10968" -m "AI Assisted"');
  assert.equal(ok.json.message, "Add the export endpoint\n\nPCWEB-10968\nAI Assisted");
  assert.equal(C("--subject", "x".repeat(101)).code, 4);
  assert.equal(C("--subject", 'say "hi"').code, 4);
  assert.equal(C("--subject", "costs $5").code, 4);
  assert.equal(C().code, 2);
  assert.match(C("--subject", "Fix it", "--files", "src/a.ts", "--files", "my file.md").json.command, /^git add -- src\/a\.ts 'my file\.md' && git commit/);
  g("checkout", "-q", "-b", "chore/no-ticket-here");
  const none = C("--subject", "Fix it");
  assert.equal(none.code, 4);
  assert.equal(none.json.error, "no-ticket");
  assert.equal(C("--subject", "Fix it", "--ticket", "ABC-1").json.ticket, "ABC-1");
  assert.equal(C("--subject", "Fix it", "--ticket", "abc-1").code, 4);
  g("checkout", "-q", "-b", "PROJ2-7_underscore");
  assert.equal(C("--subject", "Fix it").json.ticket, "PROJ2-7");
  const notRepo = runScript("plan2code-review", "commit-msg.mjs", ["--subject", "x"], { cwd: tmp("norepo") });
  assert.equal(notRepo.code, 3);
});

/* ============================================================ agent-files.mjs */

test("agent-files: detect, apply only what was chosen, rules folders, idempotent", () => {
  const root = tmp("agentfiles");
  write(root, "AGENTS.md", "# AGENTS.md\n");
  write(root, "CLAUDE.md", Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n") + "\n");
  write(root, "GEMINI.md", "# Gemini\nshort\n");
  write(root, ".github/copilot-instructions.md", "copilot\n");
  write(root, ".cursor/rules/a.md", "a\n");
  write(root, ".cursor/rules/b.md", "b\n");
  const A = (...a) => runScript("plan2code-init", "agent-files.mjs", [...a, "--root", root]);
  const d = A("detect");
  assert.equal(d.code, 0);
  assert.deepEqual(d.json.found.map((f) => f.id), ["CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md", ".cursor/rules"]);
  assert.equal(d.json.found[0].lines, 12);
  assert.equal(d.json.found[0].custom, true);
  assert.equal(d.json.found[1].custom, false);
  assert.match(d.json.warnings[0], /CLAUDE\.md has custom content/);
  const dry = A("apply", "CLAUDE.md", "--dry-run");
  assert.equal(dry.code, 0);
  assert.match(read(root, "CLAUDE.md"), /^line 0/, "dry-run writes nothing");
  assert.equal(A("apply", "CLAUDE.md", ".cursor/rules/", ".github/copilot-instructions.md").code, 0);
  assert.match(read(root, "CLAUDE.md"), /CRITICAL — MANDATORY FIRST STEP: You MUST read \[AGENTS\.md\]\(\.\/AGENTS\.md\)/);
  assert.match(read(root, ".github/copilot-instructions.md"), /^# Copilot Instructions\n\nSee \[AGENTS\.md\]\(\.\.\/AGENTS\.md\)/);
  for (const f of ["CLAUDE.md", ".github/copilot-instructions.md"]) {
    assert.match(read(root, f), /for complete project documentation including:\n- Development commands and setup\n[\s\S]*- Keeping this file current \/ Failure log\n- Section details in \.agents-docs\//, `${f} uses the bullet-list pointer`);
  }
  assert.deepEqual(fs.readdirSync(path.join(root, ".cursor/rules")), ["reference.md"]);
  assert.match(read(root, ".cursor/rules/reference.md"), /\]\(\.\.\/\.\.\/AGENTS\.md\)/);
  assert.match(read(root, "GEMINI.md"), /^# Gemini/, "unchosen files are untouched");
  const again = A("apply", "CLAUDE.md");
  assert.deepEqual(again.json.actions, [{ action: "unchanged", path: "CLAUDE.md" }]);
  assert.equal(A("detect").json.found.find((f) => f.id === "CLAUDE.md").alreadyPointer, true);
  fs.writeFileSync(path.join(root, "CLAUDE.md"), read(root, "CLAUDE.md").replace(/\n/g, "\r\n"));
  assert.equal(A("detect").json.found.find((f) => f.id === "CLAUDE.md").alreadyPointer, true, "a CRLF copy of the pointer still counts");
  assert.equal(A("apply", "GEMINI.md", "nope.md").code, 3);
  fs.rmSync(path.join(root, "AGENTS.md"));
  assert.equal(A("apply", "--all").code, 3);
  const empty = runScript("plan2code-init", "agent-files.mjs", ["detect", "--root", tmp("none")]);
  assert.deepEqual(empty.json.found, []);
  assert.match(empty.json.note, /skip this step silently/);
});

/* ============================================================== agents-md.mjs */

test("agents-md: structure, budget, orphans, broken links, inline rules", () => {
  const root = tmp("agentsmd");
  write(root, "AGENTS.md", [
    "# AGENTS.md", "", "## Project Overview", "", "Thing.", "",
    "## Architecture", "", "Summary.", "", "Details: [Architecture](./.agents-docs/AGENTS-architecture.md)", "",
    "## Testing", "", "Details: [Testing](./.agents-docs/AGENTS-testing.md)", "",
    "## Failure log", "", "Details: [Git](./.agents-docs/AGENTS-git.md)", "",
    "```", "## not a heading inside a fence", "```", "",
  ].join("\n"));
  write(root, ".agents-docs/AGENTS-architecture.md", "# Architecture\n> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.\n");
  write(root, ".agents-docs/AGENTS-git.md", "# Git\nno breadcrumb\n");
  write(root, ".agents-docs/AGENTS-orphan.md", "# Orphan\n> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.\n");
  const r = runScript("plan2code-init-update", "agents-md.mjs", ["inspect", "--root", root]);
  assert.equal(r.code, 0, r.stderr);
  const j = r.json;
  assert.equal(j.structure, "progressive");
  assert.equal(j.budget, `${j.lines}/500`);
  assert.deepEqual(j.sections.map((s) => s.name), ["Project Overview", "Architecture", "Testing", "Failure log"]);
  assert.deepEqual(j.brokenLinks, [".agents-docs/AGENTS-testing.md"]);
  assert.deepEqual(j.orphans, [".agents-docs/AGENTS-orphan.md"]);
  assert.ok(j.problems.some((p) => /Failure log must stay inline/.test(p)));
  assert.ok(j.problems.some((p) => /AGENTS-git\.md lacks the/.test(p)));
  const missing = runScript("plan2code-init", "agents-md.mjs", ["inspect", "--root", tmp("noagents")]);
  assert.equal(missing.json.exists, false);
  const fn = runScript("plan2code-init", "agents-md.mjs", ["filename", "Development Commands"]);
  assert.equal(fn.json.file, ".agents-docs/AGENTS-development-commands.md");
  assert.equal(fn.json.link, "Details: [Development Commands](./.agents-docs/AGENTS-development-commands.md)");
});

/* ============================================================ review-scope.mjs */

test("review-scope: base detection, committed + staged + untracked, doc share", () => {
  const repo = tmp("scope");
  const g = gitInit(repo, "main");
  write(repo, "src/a.js", "1\n2\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  g("checkout", "-q", "-b", "feature/X-1-thing");
  write(repo, "src/a.js", "1\n2\n3\n");
  write(repo, "README.md", "# r\n");
  g("add", "-A");
  g("commit", "-q", "-m", "work");
  write(repo, "docs/new.md", "a\nb\n");
  write(repo, "src/b.js", "x\n");
  g("add", "src/b.js");
  const r = runScript("plan2code-review", "review-scope.mjs", [], { cwd: repo });
  assert.equal(r.code, 0, r.stderr);
  const j = r.json;
  assert.equal(j.base, "main");
  assert.equal(j.branch, "feature/X-1-thing");
  assert.deepEqual(j.files.map((f) => [f.path, f.status.join("+")]), [["docs/new.md", "untracked"], ["README.md", "committed"], ["src/a.js", "committed"], ["src/b.js", "staged"]]);
  assert.deepEqual(j.counts, { files: 4, lines: 5, added: 5, deleted: 0, docs: 2, code: 2 });
  assert.equal(j.mix, "mixed");
  assert.equal(j.commits.length, 1);
  assert.equal(j.empty, false);
  assert.equal(runScript("plan2code-review", "review-scope.mjs", ["--base", "nope"], { cwd: repo }).code, 3);
  assert.equal(runScript("plan2code-review", "review-scope.mjs", [], { cwd: tmp("plain") }).code, 3);
});

/* ================================================= verification regressions */

test("specs: duplicate phase files and checklist rows are reported, and mark will not guess", () => {
  const root = specFixture();
  write(root, "specs/lunch-vote/phase-1-old.md", "# Old\n");
  write(root, "specs/lunch-vote/overview.md", OVERVIEW.replace("- [/] [Phase 2: API](./phase-2.md) _(2 tasks)_", "- [/] [Phase 2: API](./phase-2.md) _(2 tasks)_\n- [ ] Phase 2 again"));
  const j = runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json;
  assert.equal(j.phases[0].file, "phase-1.md", "the exact phase-N.md wins over phase-1-old.md");
  assert.ok(j.checks.some((c) => c.code === "duplicate-phase-file" && /phase-1-old\.md/.test(c.message)));
  assert.ok(j.checks.some((c) => c.code === "duplicate-checklist-row" && /Phase 2/.test(c.message)));
  const m = runScript("plan2code-3-implement", "specs.mjs", ["mark", "lunch-vote", "--phase", "2", "--to", "done", "--root", root]);
  assert.equal(m.code, 5);
  assert.equal(m.json.error, "duplicate-row");
});

test("specs: group ranges expand, chains are not parallel, [?] phases count as done, a blocked phase is skipped aloud", () => {
  const root = specFixture();
  const groups = (cells) => OVERVIEW.replace("| A | 3, 4 | Separate files |", cells);
  write(root, "specs/lunch-vote/overview.md", groups("| A | 2-4 | Separate files |"));
  assert.deepEqual(runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json.parallelGroups[0].phases, [2, 3, 4]);
  write(root, "specs/lunch-vote/overview.md", groups("| A | 3 → 4 | 4 needs 3 |"));
  assert.deepEqual(runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json.parallelGroups, []);
  write(root, "specs/lunch-vote/overview.md", OVERVIEW.replace("- [/] [Phase 2", "- [?] [Phase 2").replace("- [ ] **Phase 3", "- [?] **Phase 3").replace("- [ ] [Phase 4", "- [?] [Phase 4"));
  const done = runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json;
  assert.equal(done.next.reason, "every phase is complete");
  assert.deepEqual(done.pending, []);
  write(root, "specs/lunch-vote/overview.md", OVERVIEW.replace("- [/] [Phase 2", "- [!] [Phase 2"));
  const skip = runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json.next;
  assert.equal(skip.action, "choose");
  assert.deepEqual(skip.skipped.map((p) => p.number), [2]);
  assert.match(skip.warning, /skipping Phase 2 \[blocked\]/);
});

test("specs: blocked tasks may stand at approval; a re-opened phase is normal; done warns on unfinished work", () => {
  const root = specFixture();
  write(root, "specs/lunch-vote/phase-1.md", phase(1, "Complete", [["x", "1.1"], ["!", "1.2"]]));
  let j = runScript("plan2code-1b-revise-plan", "specs.mjs", ["status", "lunch-vote", "--root", root]).json;
  assert.ok(!j.checks.some((c) => c.code === "checked-with-open-tasks"), JSON.stringify(j.checks));
  assert.ok(j.checks.some((c) => c.code === "approved-with-blocked"));
  write(root, "specs/lunch-vote/phase-1.md", phase(1, "Complete", [["x", "1.1"], ["x", "1.2"], [" ", "1.3"]]));
  const reopen = runScript("plan2code-1b-revise-plan", "specs.mjs", ["mark", "lunch-vote", "--phase", "1", "--to", "open", "--root", root]);
  assert.deepEqual(reopen.json.changes.map((c) => c.to), ["[ ]", "In Progress"]);
  j = runScript("plan2code-1b-revise-plan", "specs.mjs", ["status", "lunch-vote", "--root", root]).json;
  assert.ok(j.checks.some((c) => c.code === "partly-done-unchecked" && c.level === "info"));
  const done = runScript("plan2code-3-implement", "specs.mjs", ["mark", "lunch-vote", "--phase", "2", "--to", "done", "--root", root]);
  assert.deepEqual(done.json.unfinished, ["2.2"]);
  assert.match(done.json.warning, /unfinished/);
});

test("specs: --set cannot override computed fields; empty overview exists; uncounted task lines are flagged", () => {
  const root = specFixture();
  assert.equal(runScript("plan2code-2-document", "specs.mjs", ["metrics", "lunch-vote", "--step", "document", "--set", "verification_items_added=1", "--set", "total_tasks=99", "--root", root]).code, 2);
  write(root, "specs/lunch-vote/phase-2.md", read(root, "specs/lunch-vote/phase-2.md") + "- [ ] **Task 2.4A:** odd\n1. [ ] **Task 2.5:** numbered\n");
  const j = runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json;
  assert.equal(j.checks.filter((c) => c.code === "uncounted-task").length, 2);
  write(root, "specs/lunch-vote/overview.md", "");
  const e = runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json;
  assert.equal(e.overview, "overview.md");
  assert.ok(e.checks.some((c) => c.code === "no-checklist"));
  assert.ok(!e.checks.some((c) => c.code === "no-overview"));
});

test("commit-msg: a repo with no commits, stray arguments, and paths quoted for every shell", () => {
  const repo = tmp("commit2");
  gitInit(repo, "feature/PCWEB-12-x");
  const C = (...a) => runScript("plan2code-review", "commit-msg.mjs", a, { cwd: repo });
  assert.equal(C("--subject", "Add x").json.ticket, "PCWEB-12", "no commits yet");
  const stray = C("--subject", "Fix", "--files", "a.js", "b.js");
  assert.equal(stray.code, 2);
  assert.equal(stray.json.error, "stray-argument");
  assert.equal(C("--subject", "Fix", "--files", "src\\a.js", "--files", "my $file.md").json.command.split(" && ")[0], "git add -- src/a.js 'my $file.md'");
  assert.equal(C("--subject", "Fix", "--files", "it's.md").code, 4);
});

test("review-scope: non-ASCII paths, empty untracked files, .txt is not a doc", () => {
  const repo = tmp("scope2");
  const g = gitInit(repo, "main");
  write(repo, "a.js", "1\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  write(repo, "café.md", "a\nb\n");
  write(repo, "empty.js", "");
  write(repo, "requirements.txt", "x\n");
  const j = runScript("plan2code-review", "review-scope.mjs", [], { cwd: repo }).json;
  const byPath = Object.fromEntries(j.files.map((f) => [f.path, f]));
  assert.equal(byPath["café.md"].added, 2);
  assert.equal(byPath["empty.js"].added, 0);
  assert.equal(j.counts.docs, 1, "only café.md is a doc");
});

test("agents-md and agent-files: indirect links are not orphans, accents fold, Cursor .mdc rules are replaced", () => {
  const root = tmp("agents2");
  write(root, "AGENTS.md", "# AGENTS.md\n\n## Architecture\n\nDetails: [A](./.agents-docs/AGENTS-architecture.md)\n");
  write(root, ".agents-docs/AGENTS-architecture.md", "# Architecture\n> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.\n\nSee [deep](./AGENTS-deep.md).\n");
  write(root, ".agents-docs/AGENTS-deep.md", "# Deep\n> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.\n");
  const j = runScript("plan2code-init-update", "agents-md.mjs", ["inspect", "--root", root]).json;
  assert.deepEqual(j.orphans, []);
  assert.deepEqual(j.indirect, [".agents-docs/AGENTS-deep.md"]);
  assert.equal(runScript("plan2code-init", "agents-md.mjs", ["filename", "Café Ünïcode"]).json.file, ".agents-docs/AGENTS-cafe-unicode.md");
  write(root, ".cursor/rules/style.mdc", "---\nalwaysApply: true\n---\nrule\n");
  const d = runScript("plan2code-init", "agent-files.mjs", ["detect", "--root", root]).json;
  assert.deepEqual(d.found.find((f) => f.id === ".cursor/rules").files.map((f) => f.path), [".cursor/rules/style.mdc"]);
  runScript("plan2code-init", "agent-files.mjs", ["apply", ".cursor/rules", "--root", root]);
  assert.deepEqual(fs.readdirSync(path.join(root, ".cursor/rules")), ["reference.md"]);
});

/* ================================================== code-review regressions */

test("agent-files: an entry that is AGENTS.md through a link is never written through", () => {
  const root = tmp("agentlink");
  const agents = "# AGENTS.md\n\nThe real instructions.\n";
  write(root, "AGENTS.md", agents);
  fs.linkSync(path.join(root, "AGENTS.md"), path.join(root, "CLAUDE.md"));
  write(root, "GEMINI.md", Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n") + "\n");
  const A = (...a) => runScript("plan2code-init", "agent-files.mjs", [...a, "--root", root]);
  const d = A("detect").json;
  assert.equal(d.found.find((f) => f.id === "CLAUDE.md").linkedToAgents, true, "a hard link to AGENTS.md is AGENTS.md");
  assert.equal(d.found.find((f) => f.id === "GEMINI.md").linkedToAgents, false);
  assert.ok(!d.warnings.some((w) => /CLAUDE\.md/.test(w)), "a linked entry is not warned as custom content");
  const refused = A("apply", "CLAUDE.md", "GEMINI.md");
  assert.equal(refused.code, 5);
  assert.equal(refused.json.error, "linked-to-agents");
  assert.match(refused.json.next, /already serves AGENTS\.md/);
  assert.equal(read(root, "AGENTS.md"), agents, "refused before anything was written");
  assert.match(read(root, "GEMINI.md"), /^line 0/, "a refusal writes nothing at all");
  const all = A("apply", "--all");
  assert.equal(all.code, 0, all.stderr);
  assert.ok(all.json.actions.some((a) => a.action === "skipped-linked" && a.path === "CLAUDE.md"));
  assert.deepEqual(all.json.updated, ["GEMINI.md"]);
  assert.equal(read(root, "AGENTS.md"), agents, "--all skips the linked entry");
  assert.match(read(root, "GEMINI.md"), /^# GEMINI\.md\n\nSee \[AGENTS\.md\]/);

  // Symlinks need admin (or Developer Mode) on Windows: run this part only where they work.
  const sroot = tmp("agentsym");
  write(sroot, "AGENTS.md", agents);
  write(sroot, "shared/other.md", "someone else's file\n");
  try {
    fs.symlinkSync(path.join(sroot, "AGENTS.md"), path.join(sroot, "CLAUDE.md"));
    fs.symlinkSync(path.join(sroot, "shared/other.md"), path.join(sroot, "GEMINI.md"));
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EACCES") return;
    throw err;
  }
  const S = (...a) => runScript("plan2code-init", "agent-files.mjs", [...a, "--root", sroot]);
  assert.equal(S("detect").json.found.find((f) => f.id === "CLAUDE.md").linkedToAgents, true);
  assert.equal(S("apply", "CLAUDE.md").code, 5);
  assert.equal(S("apply", "GEMINI.md").code, 0);
  assert.equal(read(sroot, "shared/other.md"), "someone else's file\n", "a symlink to another file is replaced, not written through");
  assert.equal(fs.lstatSync(path.join(sroot, "GEMINI.md")).isSymbolicLink(), false);
  assert.equal(read(sroot, "AGENTS.md"), agents);
});

test("agent-files: a CRLF checkout of a pointer is still the pointer", () => {
  const root = tmp("agentcrlf");
  write(root, "AGENTS.md", "# AGENTS.md\n");
  write(root, "GEMINI.md", "x\n");
  write(root, ".windsurf/rules/a.md", "a\n");
  const A = (...a) => runScript("plan2code-init", "agent-files.mjs", [...a, "--root", root]);
  assert.equal(A("apply", "--all").code, 0);
  for (const f of ["GEMINI.md", ".windsurf/rules/reference.md"]) write(root, f, read(root, f).replace(/\n/g, "\r\n"));
  const d = A("detect").json;
  assert.equal(d.found.find((f) => f.id === "GEMINI.md").alreadyPointer, true);
  assert.equal(d.found.find((f) => f.id === ".windsurf/rules").alreadyPointer, true);
  assert.deepEqual(A("apply", "GEMINI.md", ".windsurf/rules").json.actions.map((a) => a.action), ["unchanged", "unchanged"]);
  assert.match(read(root, "GEMINI.md"), /\r\n/, "an unchanged CRLF pointer is left as it is");
});

test("specs mark: a plain or bold Status: line is updated; a missing one is reported", () => {
  const root = specFixture();
  const S = (...a) => runScript("plan2code-3-implement", "specs.mjs", [...a, "--root", root]);
  write(root, "specs/lunch-vote/phase-3.md", phase(3, "x", [["x", "3.1"]]).replace("**Status:** x", "Status: In Progress"));
  const plain = S("mark", "lunch-vote", "--phase", "3", "--to", "done");
  assert.equal(plain.code, 0, plain.stderr);
  assert.match(read(root, "specs/lunch-vote/phase-3.md"), /^Status: Complete$/m, "the plain form is kept as written");
  assert.ok(!plain.json.warning);
  write(root, "specs/lunch-vote/phase-4.md", phase(4, "x", [["x", "4.1"]]).replace("**Status:** x", "- **Status**: Not Started"));
  assert.equal(S("status", "lunch-vote").json.phases[3].status, "Not Started");
  assert.equal(S("mark", "lunch-vote", "--phase", "4", "--to", "done").code, 0);
  assert.match(read(root, "specs/lunch-vote/phase-4.md"), /^- \*\*Status\*\*: Complete$/m);
  write(root, "specs/lunch-vote/phase-2.md", phase(2, "x", [["x", "2.1"]]).replace("**Status:** x\n", ""));
  const none = S("mark", "lunch-vote", "--phase", "2", "--to", "done");
  assert.equal(none.code, 0);
  assert.match(none.json.warning, /phase-2\.md has no Status line, so only the Phase Checklist checkbox changed/);
  assert.match(read(root, "specs/lunch-vote/overview.md"), /- \[x\] \[Phase 2: API\]/);
});

test("specs: only a folder directly under specs/ is a spec; archive verification fails loudly", () => {
  const root = specFixture();
  write(root, "src/app.js", "x\n");
  const S = (...a) => runScript("plan2code-4-finalize", "specs.mjs", [...a, "--root", root]);
  for (const arg of [".", "./src", "./specs", "specs/lunch-vote/.."]) {
    const r = S("archive", arg, "--dry-run");
    assert.equal(r.code, 5, `archive ${arg}: ${r.stdout}`);
    assert.equal(r.json.error, "not-a-spec");
    assert.match(r.json.next, /specs\/<name>/);
  }
  assert.ok(fs.existsSync(path.join(root, "specs/lunch-vote/overview.md")));
  assert.equal(S("archive", "./specs/lunch-vote", "--dry-run").code, 0);
  assert.equal(S("archive", path.join(root, "specs", "lunch-vote"), "--dry-run").code, 0, "an absolute path under specs/ is fine");
  assert.equal(S("status", "specs--completed/old-one").code, 0, "a read may name an archived spec");
  assert.equal(S("status", "./src").json.error, "not-a-spec");
});

test("specs: an em dash in a group range expands like a hyphen", () => {
  const root = specFixture();
  write(root, "specs/lunch-vote/overview.md", OVERVIEW.replace("| A | 3, 4 | Separate files |", "| A | 2\u20144 | Separate files |"));
  assert.deepEqual(runScript("plan2code-3-implement", "specs.mjs", ["status", "lunch-vote", "--root", root]).json.parallelGroups[0].phases, [2, 3, 4]);
});

test("commit-msg: @ and - paths are quoted, git add ends its options, risky subjects are refused, add and commit apart", () => {
  const repo = tmp("commit3");
  gitInit(repo, "feature/PCWEB-12-x");
  const C = (...a) => runScript("plan2code-review", "commit-msg.mjs", a, { cwd: repo });
  const files = C("--subject", "Fix", "--files", "@types/x.d.ts", "--files", "-weird.md", "--files", "src/a@b.js");
  assert.equal(files.code, 0, files.stderr);
  assert.equal(files.json.add, "git add -- '@types/x.d.ts' '-weird.md' src/a@b.js");
  assert.equal(files.json.commit, 'git commit -m "Fix" -m "PCWEB-12" -m "AI Assisted"');
  assert.equal(files.json.command, `${files.json.add} && ${files.json.commit}`);
  assert.equal(C("--subject", "Fix", "--add-all").json.add, "git add -A");
  const bare = C("--subject", "Fix").json;
  assert.equal(bare.add, null);
  assert.equal(bare.command, bare.commit);
  for (const bad of ["back\\slash", "wow!", "a\rb", "say \u201Chi\u201D"]) {
    assert.equal(C("--subject", bad).code, 4, JSON.stringify(bad));
  }
  assert.equal(C("--subject", "wow!").json.error, "unsafe-subject");
  assert.equal(C("--subject", "Fix", "--files", "it\u2019s.md").json.error, "unsafe-path");
});

test("review-scope: no main or master is no-base unless the repo has no commits; a move up a level keeps one slash", () => {
  const repo = tmp("scope3");
  const g = gitInit(repo, "develop");
  write(repo, "d/sub/f.txt", "1\n");
  write(repo, "top/h.txt", "3\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  g("checkout", "-q", "-b", "feature/X-2-thing");
  write(repo, "src/new.js", "x\n");
  g("add", "-A");
  g("commit", "-q", "-m", "feature work");
  const R = (...a) => runScript("plan2code-review", "review-scope.mjs", a, { cwd: repo });
  const none = R();
  assert.equal(none.code, 3);
  assert.equal(none.json.error, "no-base");
  assert.match(none.json.next, /--base <trunk>/);
  const dev = R("--base", "develop");
  assert.equal(dev.code, 0, dev.stderr);
  assert.deepEqual(dev.json.files.map((f) => f.path), ["src/new.js"]);
  g("mv", "d/sub/f.txt", "d/f.txt");
  g("mv", "top/h.txt", "h.txt");
  const moved = R("--base", "develop").json.files.map((f) => f.path);
  assert.ok(moved.includes("d/f.txt") && moved.includes("h.txt"), JSON.stringify(moved));
  assert.ok(!moved.some((p) => p.includes("//") || p.startsWith("/")), JSON.stringify(moved));
  const fresh = tmp("scope4");
  gitInit(fresh, "develop");
  write(fresh, "a.js", "1\n");
  const unborn = runScript("plan2code-review", "review-scope.mjs", [], { cwd: fresh });
  assert.equal(unborn.code, 0, unborn.stderr);
  assert.equal(unborn.json.base, null);
  assert.match(unborn.json.note, /No commits yet/);
  assert.deepEqual(unborn.json.files.map((f) => f.path), ["a.js"]);
});
