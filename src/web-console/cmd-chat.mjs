// Plan2Code Web Console - the `chat` command: hand over Quick questions now, never waiting.

import path from "node:path";

import { readJson } from "./files.mjs";
import { healthOk, listHandles, pidAlive } from "./sessions.mjs";
import { chatReplyLines, collectChat, deliverableChat } from "./inbox.mjs";
import { pendingWorkspaceChanges } from "./workspace.mjs";
import { changeLine } from "./public/workspace.js";
import { withSubagents, advanceSubagents, serverGone, advanceCursor, advanceWorkspace, chatSeqs, lineIfChanged, owedFlags, printOut } from "./cmd-post-wait.mjs";
import { duePointers, pointersForSend, rememberPointers } from "./pointers.mjs";

// The CLI's own pieces, handed over by console.mjs through useCli() before
// any command runs: console.mjs runs on import, so it cannot be imported back.
let print, mustSession, sessionProject;
export function useCli(cli) {
  ({ print, mustSession, sessionProject } = cli);
}

/* ----------------------------------------------------------------- chat */

// The instant check a build makes between tasks. Never sleeps, and never
// touches result.json: card sends stay with `wait`.
export async function cmdChat() {
  const dir = mustSession();
  const sid = path.basename(dir);
  const handle = listHandles(sessionProject(dir)).find((h) => h.sid === sid);
  if (!handle || !pidAlive(handle.pid) || !(await healthOk(handle))) {
    print(serverGone(sid));
    process.exitCode = 20;
    return;
  }
  const entries = deliverableChat(collectChat(dir, readJson(path.join(dir, "state.json")) || {}));
  const changes = pendingWorkspaceChanges(dir);
  const reply = [chatReplyLines(entries), ...changes.map(changeLine)].filter(Boolean).join("\n");
  const [out, subCursor] = withSubagents(dir, { reply });
  if (!entries.length && !changes.length && !subCursor) {
    print({});
    process.exitCode = 10;
    return;
  }
  const seqs = chatSeqs(entries);
  const topics = pointersForSend({}, readJson(path.join(dir, "state.json")) || {}, owedFlags(changes, subCursor), entries);
  const due = duePointers(dir, topics);
  printOut(dir, { ...out, ...(seqs.length ? { chat: seqs } : {}), ...(due.length ? { read: due } : {}), ...lineIfChanged(dir, handle.url) });
  rememberPointers(dir, topics);
  advanceCursor(dir, entries);
  advanceWorkspace(dir, changes);
  advanceSubagents(dir, subCursor);
  process.exitCode = 0;
}
