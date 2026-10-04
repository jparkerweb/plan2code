#!/usr/bin/env node
// agents-md.mjs: the shape of a project's AGENTS.md, read from disk.
//
// Init and Init Update both start by establishing facts about AGENTS.md: does
// it exist, how long is it, which sections does it have, is it a single file
// or an index over .agents-docs/, which section files exist, which links are
// broken, which section files nothing links to. All of that is mechanical;
// what to write about it is not.

import fs from "node:fs";
import path from "node:path";
import { EXIT, fail, out, parseArgs, run, readText, isDir } from "./common.mjs";

const USAGE = `
agents-md.mjs: inspect AGENTS.md and .agents-docs/. JSON on stdout.

  node agents-md.mjs inspect [--root <dir>]
      exists, line count against the 500-line budget, structure
      (progressive or single-file), every ## section with its line count and
      its Details link, the always-inline sections, .agents-docs/ files with
      their breadcrumb check, broken links, orphan section files (no link from
      AGENTS.md).

  node agents-md.mjs filename "<Section Name>"
      The detail file for a section: AGENTS-<kebab-case>.md, its link line
      and its two header lines.

Exit: 0 ok (check "exists") · 2 bad arguments.
`;

const LIMIT = 500;
const ALWAYS_INLINE = ["Project Overview", "How to Use This File", "Keeping this file current", "Failure log"];
const BREADCRUMB = "> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.";

function kebab(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lineCount(text) {
  return text ? text.replace(/\r?\n$/, "").split(/\r?\n/).length : 0;
}

function sectionsOf(text) {
  const lines = text.split(/\r?\n/);
  const outList = [];
  let inFence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) inFence = !inFence;
    if (inFence) return;
    const m = l.match(/^## +(.+?)\s*$/);
    if (m) outList.push({ name: m[1].trim(), line: i + 1 });
  });
  outList.forEach((s, i) => {
    const end = i + 1 < outList.length ? outList[i + 1].line - 1 : lines.length;
    const body = lines.slice(s.line, end).join("\n");
    s.lines = end - s.line + 1;
    const link = body.match(/\]\((\.\/)?\.agents-docs\/([^)\s#]+)/);
    s.details = link ? `.agents-docs/${link[2]}` : null;
  });
  return outList;
}

function inspect(root) {
  const file = path.join(root, "AGENTS.md");
  const text = readText(file);
  const docsDir = path.join(root, ".agents-docs");
  const hasDocs = isDir(docsDir);
  const docFiles = hasDocs
    ? fs.readdirSync(docsDir).filter((n) => n.toLowerCase().endsWith(".md")).sort().map((n) => {
        const t = readText(path.join(docsDir, n)) || "";
        const lines = t.split(/\r?\n/);
        const h1 = lines.find((l) => /^# /.test(l));
        return {
          path: `.agents-docs/${n}`,
          lines: lineCount(t),
          title: h1 ? h1.replace(/^# +/, "").trim() : null,
          breadcrumb: lines.slice(0, 6).some((l) => l.trim() === BREADCRUMB || /^> Part of \[AGENTS\.md\]\(\.\.\/AGENTS\.md\)/.test(l.trim())),
          namedLikeConvention: /^AGENTS-[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(n),
        };
      })
    : [];
  if (text === null) {
    return { ok: true, root, exists: false, hasAgentsDocs: hasDocs, agentsDocs: docFiles, otherFiles: ["CLAUDE.md", "README.md", "PROJECT.md", "GEMINI.md", ".cursorrules", ".github/copilot-instructions.md"].filter((f) => fs.existsSync(path.join(root, f))) };
  }
  const sections = sectionsOf(text);
  const linked = new Set();
  for (const m of text.matchAll(/\]\((?:\.\/)?(\.agents-docs\/[^)\s#]+)/g)) linked.add(m[1]);
  const broken = [...linked].filter((l) => !fs.existsSync(path.join(root, l)));
  // A section file nothing in AGENTS.md links to is an orphan, unless another
  // section file links to it: that one is reached indirectly, and deleting it
  // would break a link, so it is reported apart and never offered for removal.
  const fromDocs = new Set();
  for (const d of docFiles) {
    const t = readText(path.join(root, d.path)) || "";
    for (const m of t.matchAll(/\]\((?:\.\/)?([^)\s#]+\.md)/g)) {
      const target = path.posix.normalize(path.posix.join(".agents-docs", m[1]));
      if (target !== d.path) fromDocs.add(target);
    }
  }
  const unlinked = docFiles.map((d) => d.path).filter((p) => !linked.has(p));
  const orphans = unlinked.filter((p) => !fromDocs.has(p));
  const indirect = unlinked.filter((p) => fromDocs.has(p));
  const inline = ALWAYS_INLINE.map((name) => {
    const s = sections.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return { name, present: !!s, splitOut: !!(s && s.details) };
  });
  const count = lineCount(text);
  return {
    ok: true,
    root,
    exists: true,
    lines: count,
    budget: `${count}/${LIMIT}`,
    nearLimit: count > LIMIT * 0.9,
    overLimit: count > LIMIT,
    structure: hasDocs ? "progressive" : "single-file",
    sections,
    alwaysInline: inline,
    hasAgentsDocs: hasDocs,
    agentsDocs: docFiles,
    brokenLinks: broken,
    orphans,
    indirect,
    problems: [
      ...broken.map((b) => `AGENTS.md links to ${b}, which does not exist`),
      ...orphans.map((o) => `${o} has no link from AGENTS.md (orphan: offer to remove it)`),
      ...inline.filter((s) => s.splitOut).map((s) => `${s.name} must stay inline in AGENTS.md but links out to a section file`),
      ...docFiles.filter((d) => !d.breadcrumb).map((d) => `${d.path} lacks the "> Part of [AGENTS.md](../AGENTS.md)" breadcrumb`),
      ...docFiles.filter((d) => !d.namedLikeConvention).map((d) => `${d.path} is not named AGENTS-<kebab-case>.md`),
    ],
  };
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { values: ["root"] });
  const cmd = args._[0];
  if (cmd === "inspect") {
    out(inspect(path.resolve(args.root || ".")));
    return;
  }
  if (cmd === "filename") {
    const name = args._.slice(1).join(" ").trim();
    if (!name) fail(EXIT.USAGE, "missing-name", "Give the section name.", 'Example: filename "Development Commands"');
    const slug = kebab(name);
    if (!slug) fail(EXIT.USAGE, "bad-name", `"${name}" has no letters or digits to name a file from.`, "Use the section's heading text.");
    const file = `.agents-docs/AGENTS-${slug}.md`;
    out({ ok: true, section: name, file, link: `Details: [${name}](./${file})`, header: [`# ${name}`, BREADCRUMB] });
    return;
  }
  fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: inspect, filename. Run with --help.");
});
