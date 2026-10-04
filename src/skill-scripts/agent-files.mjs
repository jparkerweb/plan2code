#!/usr/bin/env node
// agent-files.mjs: find other AI agents' config files and point them at AGENTS.md.
//
// Init and Init Update both end with the same step: detect CLAUDE.md, GEMINI.md,
// .cursorrules, the Copilot instructions and the Cursor / Windsurf rule folders,
// and (only for the ones the user confirms) replace each with a short pointer
// to AGENTS.md. Which files exist, how long they are, the relative path back to
// AGENTS.md and the replacement text are all fixed, so they live here.

import fs from "node:fs";
import path from "node:path";
import { EXIT, fail, out, parseArgs, run, readText, isDir } from "./common.mjs";

const USAGE = `
agent-files.mjs: detect AI agent config files and replace them with AGENTS.md pointers. JSON on stdout.

  node agent-files.mjs detect [--root <dir>]
      Every config file present, with its line count, whether it has custom
      content (more than 10 lines) and the pointer it would get.

  node agent-files.mjs apply <id> [<id> ...] [--root <dir>] [--dry-run]
  node agent-files.mjs apply --all [--root <dir>] [--dry-run]
      Replace the confirmed entries (ids from detect: CLAUDE.md, GEMINI.md,
      .cursorrules, .github/copilot-instructions.md, .cursor/rules,
      .windsurf/rules). A rules folder loses its .md files (and .mdc, for Cursor) and gets one
      reference.md. Only run this for entries the user confirmed.
      An entry that is AGENTS.md itself through a symlink or hard link
      (detect: linkedToAgents) is refused by id and skipped by --all
      ("skipped-linked"). A symlink to any other file is removed and replaced,
      never written through.

Exit: 0 ok · 2 bad arguments · 3 AGENTS.md missing or an id not present ·
5 refused (an entry linked to AGENTS.md).
`;

// id, title, where the pointer goes, and the relative path back to AGENTS.md.
const TARGETS = [
  { id: "CLAUDE.md", title: "CLAUDE.md", file: "CLAUDE.md", ref: "./AGENTS.md" },
  { id: "GEMINI.md", title: "GEMINI.md", file: "GEMINI.md", ref: "./AGENTS.md" },
  { id: ".cursorrules", title: ".cursorrules", file: ".cursorrules", ref: "./AGENTS.md" },
  { id: ".github/copilot-instructions.md", title: "Copilot Instructions", file: ".github/copilot-instructions.md", ref: "../AGENTS.md" },
  { id: ".cursor/rules", title: "Project Rules", dir: ".cursor/rules", ref: "../../AGENTS.md" },
  { id: ".windsurf/rules", title: "Project Rules", dir: ".windsurf/rules", ref: "../../AGENTS.md" },
];

const CUSTOM_LINES = 10;

// CLAUDE.md gets its own template: Claude Code auto-loads it, so it carries the
// directive that makes AGENTS.md the mandatory first read.
function claudeTemplate() {
  return [
    "# CLAUDE.md",
    "",
    "**CRITICAL — MANDATORY FIRST STEP: You MUST read [AGENTS.md](./AGENTS.md) before responding to ANY user message, including simple questions. Do NOT skip this step regardless of how trivial the request appears. No exceptions.**",
    "",
    "See AGENTS.md for complete project documentation including:",
    "- Development commands and setup",
    "- Architecture overview",
    "- Environment variables",
    "- Testing patterns",
    "- Deployment guides",
    "- Keeping this file current / Failure log",
    "- Section details in .agents-docs/",
    "",
    "This file exists for Claude Code auto-loading. All AI coding agents should reference AGENTS.md.",
    "",
  ].join("\n");
}

function referenceTemplate(title, ref) {
  return [
    `# ${title}`,
    "",
    `See [AGENTS.md](${ref}) for complete project documentation including:`,
    "- Development commands and setup",
    "- Architecture overview",
    "- Environment variables",
    "- Testing patterns",
    "- Deployment guides",
    "- Keeping this file current / Failure log",
    "- Section details in .agents-docs/",
    "",
  ].join("\n");
}

function templateFor(t) {
  return t.id === "CLAUDE.md" ? claudeTemplate() : referenceTemplate(t.title, t.ref);
}

// A CRLF checkout of a pointer file is still the pointer.
function lf(text) {
  return text === null ? null : text.replace(/\r\n/g, "\n");
}

const samePath = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);

// True when p is AGENTS.md itself: a symlink resolving to it, or a hard link to
// the same inode. Writing a pointer through either would replace AGENTS.md.
// Some platforms report ino 0 for every file, so 0 never counts as a match.
function isAgentsFile(p, agents) {
  try {
    if (samePath(fs.realpathSync.native(p), fs.realpathSync.native(agents))) return true;
    const a = fs.statSync(p, { bigint: true });
    const b = fs.statSync(agents, { bigint: true });
    return a.ino !== 0n && a.ino === b.ino && a.dev === b.dev;
  } catch {
    return false;
  }
}

function lineCount(text) {
  if (!text) return 0;
  return text.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function detect(root) {
  const agents = path.join(root, "AGENTS.md");
  const found = [];
  for (const t of TARGETS) {
    if (t.file) {
      const text = readText(path.join(root, t.file));
      if (text === null) continue;
      const lines = lineCount(text);
      found.push({
        id: t.id,
        title: t.title,
        files: [{ path: t.file, lines }],
        lines,
        custom: lines > CUSTOM_LINES,
        alreadyPointer: lf(text) === templateFor(t),
        linkedToAgents: isAgentsFile(path.join(root, t.file), agents),
        writes: t.file,
        pointsTo: t.ref,
      });
    } else {
      const dir = path.join(root, t.dir);
      if (!isDir(dir)) continue;
      // Cursor's own rule files are .mdc; leaving them would keep a second source of rules.
      const exts = t.id === ".cursor/rules" ? [".md", ".mdc"] : [".md"];
      const mds = fs.readdirSync(dir).filter((n) => exts.some((e) => n.toLowerCase().endsWith(e)) && !isDir(path.join(dir, n))).sort();
      if (!mds.length) continue;
      const files = mds.map((n) => ({ path: `${t.dir}/${n}`, lines: lineCount(readText(path.join(dir, n))) }));
      const lines = files.reduce((n, f) => n + f.lines, 0);
      found.push({
        id: t.id,
        title: t.title,
        files,
        lines,
        custom: files.some((f) => f.lines > CUSTOM_LINES),
        alreadyPointer: mds.length === 1 && mds[0] === "reference.md" && lf(readText(path.join(dir, "reference.md"))) === templateFor(t),
        linkedToAgents: mds.some((n) => isAgentsFile(path.join(dir, n), agents)),
        writes: `${t.dir}/reference.md`,
        deletes: files.map((f) => f.path).filter((p) => !p.endsWith("/reference.md")),
        pointsTo: t.ref,
      });
    }
  }
  return found;
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { booleans: ["dry-run", "all"], values: ["root"] });
  const cmd = args._[0];
  const root = path.resolve(args.root || ".");
  const hasAgents = fs.existsSync(path.join(root, "AGENTS.md"));

  if (cmd === "detect") {
    const found = detect(root);
    out({
      ok: true,
      root,
      hasAgents,
      found,
      warnings: found.filter((f) => f.custom && !f.alreadyPointer && !f.linkedToAgents).map((f) => `${f.id} has custom content that will be replaced (${f.lines} lines).`),
      ...(found.length ? {} : { note: "No AI agent config files found: skip this step silently." }),
    });
    return;
  }

  if (cmd !== "apply") fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: detect, apply. Run with --help.");
  if (!hasAgents) fail(EXIT.NOT_FOUND, "no-agents-md", "AGENTS.md does not exist, so there is nothing to point these files at.", "Create AGENTS.md first.");
  const ids = args._.slice(1);
  if (!args.all && !ids.length) fail(EXIT.USAGE, "nothing-selected", "Name the entries to replace, or pass --all.", "Use the ids `detect` printed, for the entries the user confirmed.");
  const found = detect(root);
  const chosen = args.all ? found : ids.map((id) => {
    const hit = found.find((f) => f.id === id.replace(/\\/g, "/").replace(/\/$/, ""));
    if (!hit) fail(EXIT.NOT_FOUND, "not-present", `"${id}" is not one of the detected entries (${found.map((f) => f.id).join(", ") || "none"}).`, "Run `detect` and use its ids.");
    return hit;
  });
  // Checked before anything is written, so a refusal leaves every file as it was.
  const linked = chosen.find((c) => c.linkedToAgents);
  if (linked && !args.all) {
    fail(EXIT.REFUSED, "linked-to-agents", `${linked.id} is AGENTS.md itself (via a symlink or hard link); replacing it would overwrite AGENTS.md with the pointer.`, `Leave ${linked.id} as it is: it already serves AGENTS.md. Rerun apply without it.`);
  }

  const actions = [];
  for (const entry of chosen) {
    if (entry.linkedToAgents) {
      actions.push({ action: "skipped-linked", path: entry.writes });
      continue;
    }
    const t = TARGETS.find((x) => x.id === entry.id);
    const content = templateFor(t);
    for (const del of entry.deletes || []) {
      actions.push({ action: "delete", path: del });
      if (!args["dry-run"]) fs.rmSync(path.join(root, del), { force: true });
    }
    const target = path.join(root, entry.writes);
    const changed = lf(readText(target)) !== content;
    actions.push({ action: changed ? "write" : "unchanged", path: entry.writes });
    if (changed && !args["dry-run"]) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // A symlink (or a hard link) to some other file is replaced, not written
      // through, so the file it shares content with is left alone.
      let st = null;
      try {
        st = fs.lstatSync(target);
      } catch {}
      if (st && (st.isSymbolicLink() || st.nlink > 1)) fs.rmSync(target, { force: true });
      fs.writeFileSync(target, content);
    }
  }
  out({ ok: true, root, dryRun: !!args["dry-run"], updated: chosen.filter((c) => !c.linkedToAgents).map((c) => c.id), actions });
});
