// Plan2Code Web Console - the `help` command: the CLI's usage and the contract's topic files.

import fs from "node:fs";
import path from "node:path";

import { HERE } from "./files.mjs";
import { WORKFLOWS, isBuild } from "./public/skills.js";

// The CLI's own pieces, handed over by console.mjs through useCli() before
// any command runs: console.mjs runs on import, so it cannot be imported back.
let args, print, die;
export function useCli(cli) {
  ({ args, print, die } = cli);
}

/* ----------------------------------------------------------------- help */

// The usage's workflow list, from skills.js: wrapped at the usage's width,
// continuation lines indented under the first name.
function workflowLines(width = 78) {
  const lead = "  workflows: ";
  const pad = " ".repeat(lead.length);
  const lines = [];
  let line = "";
  WORKFLOWS.forEach((w, i) => {
    const piece = i < WORKFLOWS.length - 1 ? `${w} ·` : w;
    const start = lines.length ? pad : lead;
    if (line && (start + line + " " + piece).length > width) {
      lines.push(start + line);
      line = piece;
    } else line = line ? `${line} ${piece}` : piece;
  });
  lines.push((lines.length ? pad : lead) + line);
  return lines.join("\n");
}

export function cmdHelp() {
  const topic = args._[0];
  if (topic !== undefined) return helpTopic(String(topic));
  process.stdout.write(`console.mjs — the Plan2Code web console. A detached server, a loopback
port, and the filesystem as transport; this CLI is the whole agent surface.

  open    [--file <payload.json>] [--workflow <w>] [--title "<t>"] [--spec <dir>]
          [--session|--resume <sid>] [--no-open] [--idle-ms <ms>]
          Start or resume a session and its server. Prints { ok, sid, session,
          url, terminalLine }, plus swept { sessions, scratch, handoffs } when
          old sessions, scratch files or handoffs were removed. Run it FIRST, before
          reading anything: the page shows a starting screen until your
          first post. --file is optional, and --title defaults to the
          project's folder name. Also prints workspace: { folders: [{ name,
          path, description?, original? }], missing? }, the folders this
          console session reads as context, addressed as @name. The list is
          remembered per folder and spec in workspaces.json beside looks.json.
          May also print subagents: { state, revision, max, instruction, strength } and
          a reply holding only its "Subagents: ..." lines, when a standing
          instruction (the page's Subagents switch) is owed to you.
  post    --session <sid> --file <patch.json | -> [--wait <N>]
          Merge a patch into the session. Prints terminalLine while the
          server is live. Exit 3 = rejected; stderr says why. --wait <N>
          then waits up to N seconds in the same command (two JSON lines;
          the exit code is the wait's). The patch may carry settle: true
          (or a list of item ids) to mark the latest send's cards answered
          with what was sent; doc blocks may carry file: "<path>" (and
          select: "tasks"), read from the project, and a doc refresh: true
          re-reads them. A doc's version moves up by itself. A patch may
          carry run: { event, id, tasks? } (session meter points) and folderIssue:
          { name, reason, hint? } (a workspace folder you could not read);
          both go to the ledger, never into the state. A patch may also
          carry helpers: [{ id, title, ask, state, result?, strength?,
          effort? }] or one { id: "alone", alone: true }, merged by id, for
          the Subagents tab (help subagents).
  wait    --session <sid> [--seconds <N>]
          A bounded wait slice, sized below your shell timeout. Exit 0 = the
          result is on stdout, 10 = still waiting ("Waiting on your answer
          in the web console"; call again), 20 = server gone (open --resume
          <sid>), 30 = cancelled. Exits 0 and 10 carry terminalLine.
          Exit 0 may carry "chat" (Quick questions); with no card send it
          is type: "chat" and actions is empty. Exit 0 may also carry
          "workspace" (changes since you last heard, each once, with a
          "Workspace: ..." line in reply); exit 10 counts them as
          pendingWorkspace, and a change alone never ends a slice.
          Exit 0 may also carry "subagents" (a console setting, not typed
          by the person, with its "Subagents: ..." lines last in reply); a
          setting change alone never ends a slice either. A hop
          (__launch, __dashboard, __commit, __changelog) carries resume, the exact
          open --resume command, and skillFile when installed. Collecting
          a send sets the page to working; a wait with a question open
          hands the turn back.
  chat    --session <sid>
          Collect Quick questions, workspace changes and a Subagents
          setting change now, never waiting, never touching card sends.
          Exit 0 = { chat, workspace, subagents?, reply, terminalLine },
          10 = none, 20 = server gone.
  terminalLine is "→ Look at the web console: <url>": end your terminal
  messages with it during a console session.
  keep    --session <sid> --upload <path> --name <name> --spec specs/<idea> [--from <file>]
          Copy a cited note attachment into specs/<idea>/attachments/. Prints
          { ok, path, link, image, reused }; exit 2 = bad usage, 3 = refused or
          missing. Paste link as it is.
  forget  --spec specs/<idea>
          Drop the workspace folders remembered for that spec, in this
          folder (Finalize, after archiving it). Prints { ok, spec, forgot };
          forgot is false when nothing was saved. Exit 2 = bad usage.
  delete-spec --spec specs/<name>
          Delete that spec folder for good (the dashboard's Delete button, a
          __delete action). Only an existing specs/<name> folder inside this
          worktree: never a link, never deeper, never specs--completed/.
          Prints { ok, removed }; exit 2 = bad usage, 3 = refused, with
          { ok: false, message } saying why. Nothing is touched on a refusal.
  handoff new --workflow <w> --skill <s> [--spec specs/<name>] [--title "<t>"] [--from-stop]
          Claim a handoff for this checkout in ~/.plan2code/handoffs/ (Stop
          with a handoff, the Handoff skill). Writes only <id>.json; you write
          the document at path. Prints { ok, id, path, meta }; exit 2 = bad
          usage, 3 = a bad value, with { ok: false, message } saying why.
  delete-handoff --handoff <id>
          Delete that handoff for good (a Handoff chip's Delete, a __delete
          action): <id>.md and <id>.json, only in ~/.plan2code/handoffs/,
          never a link. Prints { ok, removed }; exit 2 = bad usage, 3 =
          refused, with { ok: false, message } saying why. Nothing is touched
          on a refusal.
  status  [--session <sid>] [--all]
          One session, or (--all) every session on this machine, every project.
  stop    --session <sid> | --all
          Shut a session's server down. Always post finish first.

${workflowLines()}

  A session handed to you by the dashboard (a --session id): resume it with
  "open --resume <sid> --no-open --workflow <yours>" (the resume it carries) -- never a
  fresh "open", which would strand the page the person is watching.

  The contract is console.md beside this file, read once; the rest is
  read when its moment comes. help <topic> prints one; help topics lists
  them. Build sessions (${WORKFLOWS.filter(isBuild).join(", ")}) also read
  building.md.
`);
}

// The contract's topic files, by the name console.md's index gives them.
// Printing one saves an agent the path hunt: it already runs this CLI.
export const HELP_TOPICS = {
  console: "console.md",
  building: "building.md",
  "building-review": "building-review.md",
  finish: "console-finish.md",
  stop: "console-stop.md",
  attachments: "console-attachments.md",
  chat: "console-chat.md",
  workspace: "console-workspace.md",
  subagents: "console-subagents.md",
  launches: "console-launches.md",
  dashboard: "console-launches.md",
  meter: "console-meter.md",
  trouble: "console-trouble.md",
};
for (const f of fs.existsSync(path.join(HERE, "notes")) ? fs.readdirSync(path.join(HERE, "notes")) : []) {
  if (f.endsWith(".md")) HELP_TOPICS[f.slice(0, -3)] ??= `notes/${f}`;
}
HELP_TOPICS["init-update"] ??= HELP_TOPICS.init;
HELP_TOPICS["implement-review"] ??= HELP_TOPICS.implement;

function helpTopic(topic) {
  const names = Object.keys(HELP_TOPICS).sort();
  if (topic === "topics") {
    print({ topics: Object.fromEntries(names.map((n) => [n, HELP_TOPICS[n]])) });
    return;
  }
  const file = Object.hasOwn(HELP_TOPICS, topic) ? HELP_TOPICS[topic] : null;
  if (!file) die(`no help topic "${topic}". Topics: ${names.join(", ")}`, 2);
  process.stdout.write(fs.readFileSync(path.join(HERE, file), "utf8"));
}
