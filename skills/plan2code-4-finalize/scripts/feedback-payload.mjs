#!/usr/bin/env node
// feedback-payload.mjs: Finalize STEP 6.5, the community feedback submission.
//
// The payload is fixed data: metrics read from the METRICS_JSON comments the
// pipeline already wrote, task counts read from the phase files, the user's
// Step 5 answers read from overview.md's ## User Feedback table, the installed
// version, and a sha256 prefix of each prompt. None of it needs judgment, and
// the hashes cannot be computed by reading. The submission is a fixed tier
// sequence (gh, then the browser, then a printed URL). Both live here; the
// agent previews and asks for approval in between.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { EXIT, HERE, fail, out, parseArgs, run, readText, isDir, rel, compactDate, clock, version, phaseFiles } from "./common.mjs";

const USAGE = `
feedback-payload.mjs: build and submit the community feedback payload. JSON on stdout.

  node feedback-payload.mjs build <spec> --set verification_failures_found=N
        --set documentation_updates_needed=N [--truncate] [--root <dir>] [--out <dir>]
      <spec> is the archived spec (specs--completed/<name>, specs/<name> when
      Step 6 did not archive, or <name>). Reads
      its PLAN-DRAFT, overview.md and phase files, and the ## User Feedback
      table Step 5 appended. Writes payload.json and body.md to --out (default:
      a new folder in the OS temp dir) and prints the title, body, label, the
      browser URL and its size. --truncate shortens the free-text answers
      (rating_reason first, then what_went_well / what_went_poorly) until the
      URL fits 8 KB.

  node feedback-payload.mjs submit --from <dir> [--dry-run]
      Only after the user approved the preview. Tier 1: gh issue create.
      Tier 2: open the prefilled new-issue page in the browser (the user still
      clicks Submit). Tier 3: print the URL. Reports the tier that worked.
      Tiers 2 and 3 are skipped when the URL is over 8 KB (exit 4 oversize).

Exit: 0 ok · 2 bad arguments · 3 spec, feedback table or payload not found ·
4 the payload would be invalid (e.g. no rating), or gh failed and the URL is
too long for the other tiers · 5 a bare <name> exists in both specs/ and
specs--completed/ (pass the exact path).
`;

const REPO = "jparkerweb/plan2code";
const LABEL = "community-feedback";
const URL_LIMIT = 8192;

// Prompt keys the metrics pipeline cohorts on, and the skill each comes from.
const PROMPTS = {
  plan: "plan2code-1-plan",
  revise_plan: "plan2code-1b-revise-plan",
  document: "plan2code-2-document",
  implement: "plan2code-3-implement",
  finalize: "plan2code-4-finalize",
  init: "plan2code-init",
  init_update: "plan2code-init-update",
  quick_task: "plan2code-quick-task",
};

/**
 * The prompt's source text: an installed skill's SKILL.md minus the generated
 * frontmatter (the installer writes header + "\n\n" + source), or the repo's
 * src/<name>.md. Hashing either gives the same sha256 the metrics collector
 * computes from src/.
 */
function promptSource(name) {
  const skillMd = path.join(HERE, "..", "..", name, "SKILL.md");
  const text = readText(skillMd);
  if (text !== null) {
    const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n\r?\n/);
    return m ? text.slice(m[0].length) : text;
  }
  for (const candidate of [path.join(HERE, "..", "..", "..", "src", `${name}.md`), path.join(HERE, "..", "..", "src", `${name}.md`)]) {
    const t = readText(candidate);
    if (t !== null) return t;
  }
  return null;
}

function promptVersions() {
  const outV = {};
  for (const [key, name] of Object.entries(PROMPTS)) {
    const src = promptSource(name);
    outV[key] = src === null ? "sha256:missing" : crypto.createHash("sha256").update(src, "utf8").digest("hex").slice(0, 12);
  }
  return outV;
}

function metricsBlocks(text) {
  const blocks = [];
  for (const m of (text || "").matchAll(/<!--\s*METRICS_JSON\s+(\{[\s\S]*?\})\s*-->/g)) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {}
  }
  return blocks;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parseFeedbackTable(overview) {
  const sec = overview.match(/^## +User Feedback\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m);
  if (!sec) return null;
  const fields = {};
  for (const line of sec[1].split(/\r?\n/)) {
    if (!/^\s*\|/.test(line) || /^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    // Split on pipes that are not escaped (values escape theirs as \|).
    const cells = line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
    if (cells.length >= 2 && !/^field$/i.test(cells[0])) fields[cells[0].toLowerCase()] = cells.slice(1).join("|").trim();
  }
  return fields;
}

function phaseTasks(dir) {
  const c = { total: 0, complete: 0, assumed: 0, blocked: 0 };
  // The same files specs.mjs reads: a stale sibling like phase-1-old.md is not counted.
  for (const n of phaseFiles(dir).values()) {
    for (const line of (readText(path.join(dir, n)) || "").split(/\r?\n/)) {
      // The same task line specs.mjs counts: 2.3, 3.6a, or a named 1.T.
      const m = line.match(/^\s*[-*] \[(.)\]\s+\*\*Task\s+\d+\.(?:\d+|[A-Za-z]+)[a-z]*\b/);
      if (!m) continue;
      c.total++;
      if (/[xX]/.test(m[1])) c.complete++;
      else if (m[1] === "?") c.assumed++;
      else if (m[1] === "!") c.blocked++;
    }
  }
  return c;
}

function locateSpec(root, arg) {
  if (!arg) fail(EXIT.USAGE, "missing-spec", "Name the archived spec.", "Example: build specs--completed/user-auth");
  const p = arg.replace(/\\/g, "/").replace(/\/+$/, "");
  const candidates = p.includes("/") ? [path.resolve(root, p)] : [path.join(root, "specs--completed", p), path.join(root, "specs", p)];
  // A bare name in both places means Step 6 did not archive (the target
  // existed): specs--completed/<name> is an older run, so guessing would read
  // the wrong spec.
  if (candidates.length > 1 && candidates.every(isDir)) fail(EXIT.REFUSED, "ambiguous-spec", `Both specs/${p} and specs--completed/${p} exist.`, `Pass the exact path: specs/${p} when Step 6 did not archive this run, specs--completed/${p} when it did.`);
  const dir = candidates.find(isDir);
  if (!dir) fail(EXIT.NOT_FOUND, "spec-not-found", `No spec folder at ${candidates.map((c) => rel(root, c)).join(" or ")}.`, "Step 6 archives to specs--completed/<name>/; check the name.");
  return dir;
}

function urlFor(title, body) {
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${LABEL}`;
}

function render(payload) {
  const f = payload.user_feedback;
  const title = `[Feedback] v${payload.plan2code_version} - rating ${f.overall_rating}/10`;
  const pct = (v) => (v === null || v === undefined ? "n/a" : `${Math.round(v * 100)}%`);
  // The person's words are shown as text, never markup: a "<!--" in them must
  // not open a comment ahead of the payload's.
  const shown = (s) => String(s).replace(/</g, "&lt;");
  // Inside the comment, < and > are written as \u003c / \u003e: still valid JSON
  // that parses back to the same text, but a "-->" in an answer can no longer
  // end the comment (or the ingest regex) early.
  const json = JSON.stringify(payload).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const s1 = payload.step1 || {};
  const s2 = payload.step2 || {};
  const body = [
    "## Plan2Code run feedback",
    "",
    `- **Version:** ${payload.plan2code_version}`,
    `- **Rating:** ${f.overall_rating}/10`,
    `- **Planning confidence:** ${s1.final_confidence ?? "n/a"}`,
    `- **Tasks completed:** ${payload.step3.tasks_completed ?? "n/a"} of ${payload.step3.tasks_total ?? "n/a"} (${pct(payload.step3.task_completion_rate)})`,
    `- **Phases:** ${s2.phase_count ?? s1.phase_count ?? "n/a"}`,
    "",
    `**Reason:** ${shown(f.rating_reason)}`,
    "",
    `**Went well:** ${shown(f.what_went_well)}`,
    "",
    `**Went poorly:** ${shown(f.what_went_poorly)}`,
    "",
    `<!-- METRICS_JSON ${json} -->`,
    "",
  ].join("\n");
  return { title, body };
}

function sizeOf(title, body) {
  return Buffer.byteLength(urlFor(title, body), "utf8");
}

async function cmdBuild(args) {
  const root = path.resolve(args.root || ".");
  const dir = locateSpec(root, args._[1]);
  const sets = {};
  for (const kv of args.set || []) {
    const m = kv.match(/^([a-z_]+)=(\d+)$/);
    if (!m) fail(EXIT.USAGE, "bad-set", `--set ${kv} is not key=integer.`, "Example: --set verification_failures_found=1");
    if (!["verification_failures_found", "documentation_updates_needed"].includes(m[1])) fail(EXIT.USAGE, "bad-set", `--set ${m[1]} is not a field you supply.`, "Only verification_failures_found and documentation_updates_needed; the rest is read from the files.");
    sets[m[1]] = Number(m[2]);
  }
  const overview = readText(path.join(dir, "overview.md"));
  if (overview === null) fail(EXIT.NOT_FOUND, "no-overview", `${rel(root, dir)} has no overview.md.`, "The payload reads overview.md; check the archive.");
  const feedback = parseFeedbackTable(overview);
  if (!feedback) fail(EXIT.NOT_FOUND, "no-feedback", "overview.md has no ## User Feedback table.", "Step 5 appends it; with no feedback there is nothing to submit, so skip Step 6.5.");
  // As lenient as the metrics collector: field names any case, "8/10" reads as 8.
  const rating = parseInt(feedback.rating, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) fail(EXIT.INVALID, "bad-rating", `The User Feedback Rating "${feedback.rating ?? ""}" is not a whole number from 1 to 10.`, "Fix the Rating row in overview.md, then rebuild.");

  const drafts = fs.readdirSync(dir).filter((n) => /^PLAN-DRAFT-.*\.md$/i.test(n) && !/-prev\.md$/i.test(n)).sort();
  const draft = drafts.length ? readText(path.join(dir, drafts.at(-1))) : null;
  const plan = metricsBlocks(draft).find((b) => !b.step || b.step === "plan") || null;
  const overviewBlocks = metricsBlocks(overview);
  const doc = overviewBlocks.find((b) => b.step === "document") || null;
  const fin = overviewBlocks.find((b) => b.step === "finalize") || null;
  const tasks = phaseTasks(dir);
  const done = tasks.complete + tasks.assumed;
  const rate = tasks.total ? Number((done / tasks.total).toFixed(2)) : null;
  const bd = plan && plan.confidence_breakdown && typeof plan.confidence_breakdown === "object" ? plan.confidence_breakdown : null;
  const pick = (k) => (k in sets ? sets[k] : fin ? num(fin[k]) : null);
  const missing = ["verification_failures_found", "documentation_updates_needed"].filter((k) => pick(k) === null);
  if (missing.length) fail(EXIT.USAGE, "missing-set", `Pass ${missing.map((k) => `--set ${k}=N`).join(" and ")} (your Step 2 and Step 4 counts).`, "They are the same numbers Step 7's METRICS_JSON carries.");
  const name = path.basename(dir);

  const payload = {
    schema_version: "1.0",
    run_id: `run-${compactDate()}-${clock()}-${crypto.randomBytes(2).toString("hex")}`,
    plan2code_version: version() || "unknown",
    prompt_versions_short: promptVersions(),
    // A step with no METRICS_JSON block is null, which the ingest side reads as
    // "not present"; an object of nulls would be counted as present.
    step1: plan
      ? {
          final_confidence: num(plan.confidence ?? plan.final_confidence),
          confidence_breakdown: bd ? { requirements: num(bd.requirements), feasibility: num(bd.feasibility), integration: num(bd.integration), risk: num(bd.risk) } : null,
          clarification_rounds: num(plan.clarification_rounds),
          tech_stack_revision_rounds: num(plan.tech_stack_revision_rounds),
          verification_gaps_found: num(plan.verification_gaps_found),
          functional_requirements_count: num(plan.functional_requirements_count),
          non_functional_requirements_count: num(plan.non_functional_requirements_count),
          risk_count: num(plan.risk_count),
          phase_count: num(plan.phase_count),
        }
      : null,
    step2: doc
      ? {
          total_tasks: num(doc.total_tasks),
          phase_count: num(doc.phase_count),
          parallel_groups_identified: num(doc.parallel_groups_identified),
          requirement_coverage_percent: num(doc.requirement_coverage_percent),
          verification_items_added: num(doc.verification_items_added),
        }
      : null,
    step3: { task_completion_rate: rate, tasks_completed: done, tasks_total: tasks.total, blocker_count: tasks.blocked },
    step4: {
      completion_rate_at_audit: fin ? num(fin.completion_rate_at_audit) ?? rate : rate,
      verification_failures_found: pick("verification_failures_found"),
      documentation_updates_needed: pick("documentation_updates_needed"),
      archival_succeeded: /specs--completed$/.test(path.dirname(dir)) && !isDir(path.join(root, "specs", name)),
    },
    user_feedback: {
      overall_rating: rating,
      rating_reason: feedback.reason || "",
      what_went_well: feedback["went well"] || "",
      what_went_poorly: feedback["went poorly"] || "",
    },
  };

  let { title, body } = render(payload);
  const truncated = [];
  if (args.truncate) {
    // Each field keeps at least 40 characters of its own text. Every pass cuts
    // from the field's ORIGINAL text, so the loop always shortens and ends.
    for (const field of ["rating_reason", "what_went_well", "what_went_poorly"]) {
      const original = payload.user_feedback[field];
      let keep = original.length;
      while (sizeOf(title, body) > URL_LIMIT && keep > 40) {
        keep = Math.max(40, Math.floor(keep * 0.8));
        // Never cut between the two halves of a surrogate pair (an emoji): a
        // lone half makes encodeURIComponent throw.
        let end = keep;
        if (/[\uD800-\uDBFF]/.test(original[end - 1] || "")) end--;
        payload.user_feedback[field] = original.slice(0, end).trimEnd() + "...";
        ({ title, body } = render(payload));
        if (!truncated.includes(field)) truncated.push(field);
      }
    }
  }
  const outDir = path.resolve(args.out || fs.mkdtempSync(path.join(os.tmpdir(), "plan2code-feedback-")));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "payload.json"), JSON.stringify({ title, label: LABEL, payload }, null, 2));
  fs.writeFileSync(path.join(outDir, "body.md"), body);
  const url = urlFor(title, body);
  const bytes = Buffer.byteLength(url, "utf8");
  out({
    ok: true,
    dir: outDir,
    title,
    label: LABEL,
    body,
    payload,
    url,
    urlBytes: bytes,
    oversize: bytes > URL_LIMIT,
    ...(truncated.length ? { truncated } : {}),
    ...(bytes > URL_LIMIT && !args.truncate ? { next: "The browser and print tiers cap URLs near 8 KB: offer to shorten the free-text answers, then rebuild with --truncate. gh (tier 1) has no limit, but if gh fails, submit stops with exit 4 oversize instead of opening a cut-off page." } : {}),
    notes: [
      ...(plan ? [] : ["No plan METRICS_JSON in the PLAN-DRAFT: step1 is null (not present)."]),
      ...(doc ? [] : ["No document METRICS_JSON in overview.md: step2 is null (not present)."]),
    ],
  });
}

function tryGh(dir, title) {
  try {
    const url = execFileSync("gh", ["issue", "create", "--repo", REPO, "--title", title, "--body-file", path.join(dir, "body.md"), "--label", LABEL], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    }).trim();
    return { ok: true, url: url.split(/\s+/).find((s) => s.startsWith("https://")) || url };
  } catch (err) {
    return { ok: false, why: String((err.stderr || err.message || "").toString().trim().split("\n")[0] || "gh failed") };
  }
}

function openBrowser(url) {
  // No shell in between: a URL full of & and % survives intact.
  const [cmd, argv] =
    process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] :
    process.platform === "darwin" ? ["open", [url]] :
    ["xdg-open", [url]];
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, argv, { stdio: "ignore", detached: true });
      child.on("error", () => resolve(false));
      child.on("spawn", () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

async function cmdSubmit(args) {
  if (!args.from) fail(EXIT.USAGE, "missing-from", "--from <dir> is required (the dir `build` printed).", "Run build first.");
  const dir = path.resolve(args.from);
  const saved = readText(path.join(dir, "payload.json"));
  const body = readText(path.join(dir, "body.md"));
  if (saved === null || body === null) fail(EXIT.NOT_FOUND, "no-payload", `${dir} has no payload.json / body.md.`, "Run build first and pass the dir it printed.");
  const { title } = JSON.parse(saved);
  const url = urlFor(title, body);
  const urlBytes = Buffer.byteLength(url, "utf8");
  const oversize = urlBytes > URL_LIMIT;
  if (args["dry-run"]) {
    out({ ok: true, dryRun: true, urlBytes, oversize, tiers: [`gh issue create --repo ${REPO} --title "${title}" --body-file ${path.join(dir, "body.md")} --label ${LABEL}`, `open in browser: ${url.slice(0, 120)}...`, "print the URL"], ...(oversize ? { note: "The URL is over 8 KB: only tier 1 (gh) can submit this payload; tiers 2 and 3 would be skipped." } : {}) });
    return;
  }
  const gh = tryGh(dir, title);
  if (gh.ok) {
    out({ ok: true, tier: 1, issue: gh.url, message: `Feedback submitted: ${gh.url}` });
    return;
  }
  // The browser and print tiers cap URLs near 8 KB: an oversize URL would open
  // a page with the body cut off (or none at all), so do not offer it.
  if (oversize) fail(EXIT.INVALID, "oversize", `gh failed (${gh.why}) and the prefilled URL is ${urlBytes} bytes, over the ${URL_LIMIT}-byte limit of the browser and print tiers.`, "Offer to shorten the free-text answers and rebuild with --truncate, then submit again; or install gh and sign in (gh auth login) so tier 1 can submit it as is.");
  if (await openBrowser(url)) {
    // A launched opener is not proof a browser appeared (a headless or remote
    // session has none), so the URL always rides along.
    out({ ok: true, tier: 2, ghError: gh.why, url, message: "Asked the system to open the prefilled issue in the browser. If a page opened, the user still has to click Submit new issue (signed in to GitHub). If nothing opened, give them the url to open by hand (tier 3)." });
    return;
  }
  out({ ok: true, tier: 3, ghError: gh.why, url, message: "Please open this URL in your browser and click 'Submit new issue' to share your feedback." });
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { booleans: ["dry-run", "truncate"], values: ["root", "out", "from"], lists: ["set"] });
  const cmd = args._[0];
  if (cmd === "build") return cmdBuild(args);
  if (cmd === "submit") return cmdSubmit(args);
  fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: build, submit. Run with --help.");
});
