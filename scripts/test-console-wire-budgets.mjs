// Byte budgets for what the web console costs an agent.
//
// The console's wire format was trimmed on purpose (specs/console-wire-format):
// a small card (`console.md`), topic files read only when their moment comes,
// and CLI outputs that carry only what the agent acts on. This suite keeps it
// that way. It counts bytes, never tokens, so it needs no tokenizer and no
// network, and it never calls a model.
//
// Each budget is the after-run size plus 10 percent, rounded up to the next 100
// bytes. A failure names the file or output, its size and its budget. Either
// trim what grew, or raise the budget here on purpose, in the same change, so
// the growth is a decision someone made and reviewed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cli, payload, sessionUrl, BASE, WEB_CONSOLE_DIR, lastLine } from "./web-console-test-helpers.mjs";

// The desktop app's own variables change what `open` prints. Undefined drops
// a variable from the spawned CLI's environment.
const OUTSIDE_APP = Object.fromEntries(
  ["PLAN2CODE_IN_APP", "PLAN2CODE_APP_TOKEN", "PLAN2CODE_APP_VERSION", "PLAN2CODE_APP_ANNOUNCE", "PLAN2CODE_EMBED_ORIGIN", "PLAN2CODE_CONSOLE_SID"].map((k) => [k, undefined])
);

export const BUDGETS = {
  // The card an agent reads once per session.
  card: { "console.md": 9700 },
  // Each topic file under notes/, read when its workflow starts.
  notes: {
    "changelog.md": 1400,
    "dead-code.md": 4250,
    "diagnose.md": 2700,
    "document.md": 400,
    "finalize.md": 2000,
    "git.md": 6500,
    "handoff.md": 300,
    "implement.md": 5700,
    "init.md": 300,
    "loop.md": 11600,
    "pathfinder.md": 2400,
    "plan.md": 800,
    "pr-prep.md": 4500,
    "quick-task.md": 4100,
    "review.md": 1000,
    "revise-plan.md": 1200,
    "test.md": 5400,
    "xray.md": 2500,
  },
  // One printed line each, for a session with one choice card.
  outputs: {
    open: 800,
    post: 100,
    waitIdle: 100,
    waitSend: 100,
  },
};

const bytes = (s) => Buffer.byteLength(s, "utf8");

function within(label, size, budget, hint) {
  assert.ok(
    size <= budget,
    `${label} is ${size} bytes, over its budget of ${budget}. Trim it, or raise the budget in scripts/test-console-wire-budgets.mjs on purpose in this same change.${hint ? ` ${hint}` : ""}`
  );
}

test("the card stays within its byte budget", () => {
  for (const [file, budget] of Object.entries(BUDGETS.card)) {
    within(`src/web-console/${file}`, fs.statSync(path.join(WEB_CONSOLE_DIR, file)).size, budget);
  }
});

test("every notes file has a budget and stays within it", () => {
  const dir = path.join(WEB_CONSOLE_DIR, "notes");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  for (const file of files) {
    assert.ok(file in BUDGETS.notes, `src/web-console/notes/${file} has no budget: add one to BUDGETS.notes in scripts/test-console-wire-budgets.mjs`);
    within(`src/web-console/notes/${file}`, fs.statSync(path.join(dir, file)).size, BUDGETS.notes[file]);
  }
});

test("a budgeted notes file still exists", () => {
  const dir = path.join(WEB_CONSOLE_DIR, "notes");
  for (const file of Object.keys(BUDGETS.notes)) {
    assert.ok(fs.existsSync(path.join(dir, file)), `BUDGETS.notes lists notes/${file}, which no longer exists: remove its line`);
  }
});

test("a sample session's outputs stay within their byte budgets", async () => {
  const open = cli(["open", "--file", payload("budget-open.json", BASE), "--no-open"], { env: OUTSIDE_APP });
  const sid = open.json.sid;
  try {
    assert.equal(open.status, 0, open.stderr);
    within("`open` output", bytes(lastLine(open.stdout)), BUDGETS.outputs.open);

    const item = { id: "budget-q", kind: "choice", title: "Pick one", body: "Which?", options: [{ text: "CSV" }, { text: "Excel" }] };
    const post = cli(["post", "--session", sid, "--file", payload("budget-post.json", { items: [item] })], { env: OUTSIDE_APP });
    assert.equal(post.status, 0, post.stderr);
    within("`post` output", bytes(lastLine(post.stdout)), BUDGETS.outputs.post);

    const idle = cli(["wait", "--session", sid, "--seconds", "5"], { env: OUTSIDE_APP });
    assert.equal(idle.status, 10, idle.stderr);
    within("`wait` output with nobody answered", bytes(lastLine(idle.stdout)), BUDGETS.outputs.waitIdle);

    await sendAndWait(sid, open.json.url);
  } finally {
    cli(["stop", "--session", sid, "--force"], { env: OUTSIDE_APP, expectFail: true });
  }
});

async function sendAndWait(sid, url) {
  const s = sessionUrl(url);
  const res = await fetch(`${s.base}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
    body: JSON.stringify({ actions: [{ i: "budget-q", type: "answer", kind: "choice", k: "A" }], reply: "Pick one: a" }),
  });
  assert.equal(res.status, 200);
  const wait = cli(["wait", "--session", sid, "--seconds", "10"], { env: OUTSIDE_APP });
  assert.equal(wait.status, 0, wait.stderr);
  within("`wait` output with an answer", bytes(lastLine(wait.stdout)), BUDGETS.outputs.waitSend);
}
