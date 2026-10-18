// Page tests for the Workspace dialog and @mentions: adding a folder from the
// footer label, what the next send tells the agent, and picking a folder from
// the list an @ opens in a note. Run with:
// node --test scripts/test-web-console-page-workspace.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pageSuite, openSession, itemCard, textOf } from "./page-test-helpers.mjs";
import { tempFolder } from "./web-console-test-helpers.mjs";

const suite = pageSuite(test);

// A plan session on the person's turn: one text question, the agent listening.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

// A folder named `datasets` in its own temp parent, so its @name is known.
function datasetsFolder() {
  const dir = path.join(tempFolder(), "datasets");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Opens Workspace from the footer label and adds `dir` by typing its path.
async function addFolderFromDialog(s, dir) {
  await s.page.locator("#footer-where").click();
  await s.page.locator("#workspace-modal[open]").waitFor();
  await s.page.locator("#workspace-path").fill(dir);
  await s.page.locator("#workspace-add").click();
  await s.page.locator("#workspace-add-msg.is-good").waitFor();
}

// What a person sees break: a folder that does not show in the dialog, or
// that the agent is never told about.
test("a folder added in Workspace is listed with its @name, and the next send tells the agent in its reply", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const dir = datasetsFolder();
  await addFolderFromDialog(s, dir);

  assert.equal(await textOf(s.page.locator("#workspace-add-msg")), "Added as @datasets.");
  const rows = s.page.locator("#workspace-list .ws-entry");
  assert.equal(await rows.count(), 2, "the project's own folder and the new one");
  const added = rows.filter({ hasText: "@datasets" });
  assert.equal(await added.count(), 1);
  assert.equal(await textOf(added.locator(".ws-path")), dir);
  assert.equal(await added.locator(".ws-original").count(), 0, "only the first folder is the original");
  assert.equal(await rows.first().locator(".ws-original").count(), 1);
  assert.equal(await s.page.locator("#workspace-path").inputValue(), "", "the path box empties after an add");

  await s.page.locator("#workspace-done").click();
  await s.page.locator("#workspace-modal[open]").waitFor({ state: "detached" });
  await itemCard(s.page, "q1").locator("textarea, input[type=text]").first().fill("audit-export");
  await s.page.click("#btn-send");
  const got = s.wait(10);
  assert.equal(got.code, 0, `nothing was sent (wait exit ${got.code})`);
  assert.ok(got.reply.includes("audit-export"), `the answer is in the reply: ${got.reply}`);
  assert.ok(got.reply.includes("Workspace: added @datasets"), `the Workspace line: ${got.reply}`);
  assert.ok(got.reply.includes(dir), `the Workspace line names the path: ${got.reply}`);
});

// What a person sees break: an @ that offers nothing, or a pick that leaves
// the box as it was.
test("an @ in a note offers the workspace's folders, and picking one writes its @name into the note", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await addFolderFromDialog(s, datasetsFolder());
  await s.page.locator("#workspace-done").click();
  await s.page.locator("#workspace-modal[open]").waitFor({ state: "detached" });

  const note = s.page.locator("#aside #thread-q1");
  await note.click();
  await note.pressSequentially("Look in @da");
  const pop = s.page.locator("#mention-pop");
  await pop.waitFor();
  const options = pop.locator(".mention-opt");
  assert.deepEqual(await options.allTextContents(), ["@datasets"], "only the folder that matches what was typed");
  await options.first().click();
  await pop.waitFor({ state: "detached" });
  assert.equal(await note.inputValue(), "Look in @datasets ");

  // A bare @ lists every folder, the project's own first.
  await note.pressSequentially("and @");
  await pop.waitFor();
  assert.equal(await pop.locator(".mention-opt").count(), 2);
  await s.page.keyboard.press("Escape");
  await pop.waitFor({ state: "detached" });
});
