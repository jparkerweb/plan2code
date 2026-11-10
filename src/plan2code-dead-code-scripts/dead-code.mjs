#!/usr/bin/env node
// dead-code.mjs: find a project's dead-code tool, run it and read its output,
// for the Dead Code skill.
//
// The repeatable steps live here: which tool the project already has (by a
// config file, a build-file entry or a binary on PATH), running it with a
// timeout, and turning its output into a list of candidates; then the state a
// run keeps: the shared keep list, backups with a checked restore, the saved
// report and the .gitignore line for it. Judgment stays with the agent: it
// verifies every candidate with a caller search, labels it and runs every
// removal. This script never installs a tool and never deletes source.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EXIT, fail, out, parseArgs, run, isDir, readText, now, isoDate, compactDate, clock, eol } from "./common.mjs";
import { runCheck } from "./run-check.mjs";

const USAGE = `
dead-code.mjs: find, run and read a project's dead-code tool. JSON on stdout.
It never installs a tool and never deletes source.

  node dead-code.mjs detect [--scope <dir>] [--root <dir>] [--limit 1500]
  node dead-code.mjs run --tool <id> [--scope <dir>] [--timeout 300] [--root <dir>]
  node dead-code.mjs narrow --candidates <file> [--depth 2]
  node dead-code.mjs keep list [--root <dir>]
  node dead-code.mjs keep add --file <f> [--name <n>] [--line <l>] --reason <r> [--root <dir>] [--dry-run]
  node dead-code.mjs keep remove --file <f> [--name <n>] [--hash <h>] [--line <l>] [--root <dir>] [--dry-run]   (no --name for a whole file)
  node dead-code.mjs keep filter [--fresh] [--root <dir>]   (candidates JSON on stdin)
  node dead-code.mjs backup <files...> [--run <id>] [--root <dir>] [--dry-run]
  node dead-code.mjs restore --run <id> [--files <f>...] [--verify] [--root <dir>] [--dry-run]
  node dead-code.mjs report write --findings <file> [--date YYYY-MM-DD] [--replace] [--root <dir>] [--dry-run]
  node dead-code.mjs gitignore-check [--root <dir>]
  node dead-code.mjs gitignore-add [--root <dir>] [--dry-run]

detect     Counts source files under --scope (default: the whole project) by
           language group (javascript, python, rust, go, java, csharp, ruby,
           php) and finds the dead-code tools the project already has, from
           config files, build-file entries and binaries on PATH. It never
           runs or installs a tool. Prints { ok, root, scope, languages:
           [{ id, files }], sourceFiles, overLimit, limit, tools: [{ id,
           language, marker, available, command, format }] }. overLimit is
           true when sourceFiles is above --limit.
run        Runs one detected tool (--tool <id> from detect) in the project
           root through the shell, stopping it and every process it started
           after --timeout seconds. A tool's own "findings found" exit code
           is a normal result. Prints { ok, tool, format, exit, seconds,
           candidates, unparsed, skipped, tail }. Each candidate is { file,
           line, name, kind, source: "tool", rule, message }; rule is the
           tool's own rule id. Candidates are kept only under --scope. A
           tool in the agent format, or output no reader can read, comes back
           with unparsed: true and the output's last lines in tail.
narrow     Groups a candidates file (the candidates array run printed, or the
           whole run output) by the first --depth folder levels. Prints
           { ok, folders: [{ path, candidates }], total }, the folders with
           the most candidates first, ties by path.
keep       The shared keep list, .plan2code-dead-code/keep.md (tracked, safe
           to commit): a table | File | Name | Hash | Reason | Date |. Hash
           is <12 hex>, the first 12 hex of the sha256 of the item's
           declaration line, trimmed with whitespace runs collapsed;
           <12 hex>#<n> when that line repeats in the file (the n-th identical
           line, from the top); or file:<12 hex> for a whole file, hashed over
           its full text. Rows are told apart by file, name and hash. What
           the hash cannot see: which identical copy a #n row means once a
           copy is added, removed or moved above it while the file still has
           at least n copies.
  list     Prints { ok, exists, path, entries: [{ file, name, hash, reason,
           date, state }] }. state is current (a plain hash while exactly
           one line of the file has it; a #n hash while the line repeats
           and copy n exists; a whole file while its text is unchanged),
           changed (not current, but the file still names the item) or
           gone (the file is missing or no longer names it). A #n row
           stays current while the file has at least n copies, so after a
           copy above it is added, removed or moved it points at whichever
           copy is now the n-th.
  add      Keeps the item declared at --line (no --line and no --name: the
           whole file). A row with the same file, name and hash is replaced
           (its reason updated), and so is a same-named row that is no longer
           current (the code changed since); a same-named row with another
           hash that is still current is a different item and stays. --reason
           is required and cannot be empty (exit 2). Prints { ok, entry,
           replaced, path }.
  remove   Takes off the entry with --file and --name (exit 3 not-kept when
           none is there). --hash <h> keeps only the row with that exact
           hash; --line <l> only the row matching the declaration on line l
           now (exit 3 declaration-missing when the file has no such line);
           both may be passed and must both match. Several rows left: exit 2
           ambiguous-entry, nothing written, the hint listing each row's hash
           and reason. Prints { ok, removed, path }.
  filter   Reads a candidates array (or run's output) on stdin. Prints { ok,
           fresh, shown, hidden, kept: [{ file, name, reason, gone? }],
           changed }. A candidate with a line matches the entry with its
           file, name and its own line's hash (#n included); one with no
           line matches by file and name, and a whole-file entry hides only
           the whole-file finding (no line, no name). A current entry hides
           its candidate (hidden carries keptReason); a changed entry does
           not, and the candidate is in shown with wasKept: true and
           keptReason (also when no entry has its hash but a same-named one
           is changed); changed counts those. --fresh hides nothing. kept
           lists every entry either way.
backup     Copies files (relative to the root, inside it, else exit 5) to
           <temp>/plan2code-dead-code/<run>/files/ and records each one's
           path, size and sha256 in <run>/manifest.json. --run adds to that
           run (a file it already holds keeps its first copy and is listed
           in already); without it a new id is made. A missing file exits 3
           and copies nothing. Prints { ok, run, dir, files, already }.
restore    Copies a run's files (all, or --files) back over the project,
           making folders for deleted files, then checks each against the
           manifest. A backup copy that no longer matches the manifest is
           never copied: it is listed in mismatched and the project file is
           left as it is. Prints { ok, run, restored, mismatched: [{ path,
           reason }] }; any mismatch exits 4 with ok: false. --verify copies
           nothing and only checks (verified lists the matches). A run with
           no manifest exits 3; a manifest path outside the project exits 5
           before anything is copied. Never deletes.
report     write: .plan2code-dead-code/reports/DEAD-CODE-<date>.md from
           --findings, a JSON file { scope, mode, tool, ranFrom, findings,
           hidden?, notChecked? }. mode: verify (the tool's list checked by
           a caller search), full (plus a full search of our own) or own (no
           tool). tool: the tool's id, a list of ids when several ran, or
           null. ranFrom: complete, narrowed or stopped; the report never
           calls a narrowed or stopped run complete. hidden: how many
           items the keep list hid. notChecked: what a narrowed or stopped
           run left out. Each finding: { file, line, name, kind, source,
           rule, label (safe|check|warning), warningKind, callers,
           outcome }. A report already there for the
           date exits 5 unless --replace. Prints { ok, path }; --dry-run adds
           preview, the first lines.
gitignore-check
           Prints { ok, isGit, hasGitignore, ignored, line, file }: ignored
           when .gitignore holds .plan2code-dead-code/reports/ (or
           .plan2code-dead-code/.gitignore holds reports/), or git
           check-ignore says another rule covers it.
gitignore-add
           Appends .plan2code-dead-code/reports/ to the root .gitignore
           (made if missing; no other line is touched). Not a git repo: exit
           5. Already ignored: added: false, already: true.

Writing commands take --dry-run and then write nothing. PLAN2CODE_NOW pins
the clock.

Exit: 0 ok · 1 crash · 2 bad arguments, or a keep remove that matches
several entries · 3 not found (a scope outside the project, a tool that is
not detected or did not start, a missing file, a keep entry or backup run
that is not there) · 4 invalid input, a tool that failed or timed out, or a
restore that does not match · 5 refused (a path outside the project, a
report already there, gitignore-add outside git).
`;

// An engineering default, not a measured one: past this many source files the
// skill asks the person to narrow first (FR-7). Revisit once real runs show
// how long the caller search takes on big projects.
export const NARROW_LIMIT = 1500;

const DEFAULT_TIMEOUT = 300;
const MAX_TIMEOUT = 86400;
const TAIL_LINES = 60;
const TAIL_LINE_CAP = 400;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  "build",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
  "bin",
  "obj",
  "specs",
  "specs--completed",
]);

const LANGUAGES = [
  { id: "javascript", exts: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"] },
  { id: "python", exts: [".py"] },
  { id: "rust", exts: [".rs"] },
  { id: "go", exts: [".go"] },
  { id: "java", exts: [".java", ".kt", ".kts"] },
  { id: "csharp", exts: [".cs"] },
  { id: "ruby", exts: [".rb"] },
  { id: "php", exts: [".php"] },
];
const LANGUAGE_OF = new Map(LANGUAGES.flatMap((l) => l.exts.map((e) => [e, l.id])));

/* ----------------------------------------------------------------- paths */

const slash = (p) => p.split(path.sep).join("/");

/** The project root: --root, or the current folder. Must exist. */
function projectRoot(rootArg) {
  const root = path.resolve(rootArg || ".");
  if (!isDir(root)) fail(EXIT.NOT_FOUND, "root-missing", `${root} is not a folder.`, "Pass --root <project folder>, or run from the project root.");
  return root;
}

/** --scope as a forward-slash path relative to root ("." for the whole project); a folder under root or exit 3. */
function projectScope(root, scopeArg) {
  if (!scopeArg) return ".";
  const abs = path.resolve(root, scopeArg);
  const relative = path.relative(root, abs);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !isDir(abs)) {
    fail(EXIT.NOT_FOUND, "scope-not-found", `--scope ${scopeArg} is not a folder under ${root}.`, "Pass a folder inside the project, or leave --scope out for the whole project.");
  }
  return slash(relative) || ".";
}

/** A tool's path as forward slashes relative to root; absolute and file: paths are made relative. */
function projectPath(root, p) {
  let file = String(p).trim();
  if (/^file:/i.test(file)) {
    try {
      file = fileURLToPath(file);
    } catch {
      file = decodeURIComponent(file.replace(/^file:\/*/i, ""));
    }
  }
  if (path.isAbsolute(file) || /^[A-Za-z]:[\\/]/.test(file)) file = path.relative(root, file);
  return file.replace(/\\/g, "/").replace(/^\.\//, "");
}

const underScope = (scope, file) => scope === "." || file === scope || file.startsWith(`${scope}/`);

/** Quote a path for the shell when it needs it. */
const shellPath = (p) => (/^<[\w.]+>$/.test(p) || /^[\w./:\\-]+$/.test(p) ? p : `"${p}"`);

// Stands in for the temp report file in the commands detect prints (left unquoted).
const SARIF_FILE = "<report.sarif>";

/* -------------------------------------------------------------- counting */

/** Source files under dir by language group, skipping SKIP_DIRS, dot-folders (build and cache output such as .next) and coverage, and never following links. */
function countSources(dir) {
  const counts = new Map();
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".") && entry.name !== "coverage") stack.push(path.join(d, entry.name));
      } else if (entry.isFile()) {
        const lang = LANGUAGE_OF.get(path.extname(entry.name).toLowerCase());
        if (lang) counts.set(lang, (counts.get(lang) || 0) + 1);
      }
    }
  }
  const languages = LANGUAGES.filter((l) => counts.has(l.id)).map((l) => ({ id: l.id, files: counts.get(l.id) }));
  return { languages, sourceFiles: languages.reduce((n, l) => n + l.files, 0) };
}

/* ------------------------------------------------------------ tool table */

/**
 * A binary on PATH, by name. On Windows each PATHEXT extension is tried, so a
 * test can fake a tool with a stub file on a temp PATH.
 * Returns the full path, or null.
 */
export function onPath(name, env = process.env) {
  const dirs = (env.PATH || env.Path || "").split(path.delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? (env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (process.platform !== "win32") fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {}
    }
  }
  return null;
}

/** What detection reads from the project, read once. */
function projectFacts(root) {
  const text = (rel) => readText(path.join(root, rel)) || "";
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  let pkg = null;
  try {
    pkg = JSON.parse(text("package.json") || "null");
  } catch {}
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(root);
  } catch {}
  const builds = ["pom.xml", "build.gradle", "build.gradle.kts"].filter(exists);
  const buildText = builds.map(text).join("\n");
  return { text, exists, pkg, rootEntries, builds, buildText, composer: text("composer.json"), gemfile: text("Gemfile") };
}

const firstExisting = (facts, names) => names.find((n) => facts.exists(n)) || null;

/**
 * Every tool the script knows. marker(facts) names what was found (or null);
 * available(facts) says whether it can run here; command(scope, sarif, facts)
 * is the shell command run from the project root. findingExits are the exit
 * codes the tool uses for "found something", which are not failures.
 * SARIF flags were checked against each tool's documentation (see the
 * phase-1 notes): PMD -f sarif -r, SpotBugs -sarif=, detekt --report
 * sarif:, Psalm --report=<file>.sarif.json. RuboCop has no built-in SARIF
 * formatter, so it runs in the agent format.
 */
const TOOLS = [
  {
    id: "knip",
    language: "javascript",
    format: "knip-json",
    findingExits: [1],
    marker(f) {
      const file = firstExisting(f, ["knip.json", "knip.jsonc", ".knip.json", ".knip.jsonc", "knip.ts"]);
      if (file) return file;
      const pkg = f.pkg || {};
      if (pkg.dependencies && pkg.dependencies.knip) return "package.json dependencies";
      if (pkg.devDependencies && pkg.devDependencies.knip) return "package.json devDependencies";
      if (pkg.knip) return "package.json knip key";
      return null;
    },
    available: (f) => f.exists("node_modules/.bin/knip") || f.exists("node_modules/.bin/knip.cmd"),
    // --no-install: npx must never download a tool into the person's project (NFR-1).
    command: () => "npx --no-install knip --reporter json",
  },
  {
    id: "vulture",
    language: "python",
    format: "vulture",
    findingExits: [3],
    marker(f) {
      if (/^\s*\[tool\.vulture\]/m.test(f.text("pyproject.toml"))) return "pyproject.toml [tool.vulture]";
      const listed = [...f.rootEntries.filter((n) => /^requirements.*\.txt$/i.test(n)).sort(), "setup.cfg", "tox.ini"].find((n) => /\bvulture\b/i.test(f.text(n)));
      if (listed) return listed;
      return onPath("vulture") ? "vulture on PATH" : null;
    },
    available: () => Boolean(onPath("vulture")),
    command: (scope) => `vulture ${shellPath(scope)}`,
  },
  {
    id: "cargo-check",
    language: "rust",
    format: "cargo-json",
    findingExits: [],
    marker: (f) => (f.exists("Cargo.toml") ? "Cargo.toml" : null),
    available: () => Boolean(onPath("cargo")),
    command: () => "cargo check --message-format=json --all-targets",
  },
  {
    id: "go-deadcode",
    language: "go",
    format: "go-deadcode",
    findingExits: [],
    // deadcode has no config file: present only as a binary on PATH.
    marker: (f) => (f.exists("go.mod") && onPath("deadcode") ? "go.mod and deadcode on PATH" : null),
    available: () => Boolean(onPath("deadcode")),
    command: () => "deadcode ./...",
  },
  {
    id: "pmd",
    language: "java",
    format: "sarif",
    // 4: violations found. 5: a recoverable error (a file PMD could not
    // parse); the report is still written.
    findingExits: [4, 5],
    marker(f) {
      const ruleset = pmdRuleset(f);
      if (ruleset) return ruleset;
      if (/maven-pmd-plugin/.test(f.buildText)) return "pom.xml maven-pmd-plugin";
      if (/(id\s*\(?\s*["']pmd["']|apply\s+plugin\s*:\s*["']pmd["']|^\s*pmd\s*\{)/m.test(f.buildText)) return "Gradle pmd plugin";
      return onPath("pmd") ? "pmd on PATH" : null;
    },
    available: () => Boolean(onPath("pmd")),
    // Only PMD's unused-code rules: a general ruleset (the project's own, or
    // quickstart.xml) would bury them under style findings.
    command: (scope, sarif) => `pmd check -d ${shellPath(scope)} -R ${PMD_RULES} -f sarif -r ${shellPath(sarif)}`,
  },
  {
    id: "spotbugs",
    language: "java",
    format: "sarif",
    findingExits: [],
    marker(f) {
      if (/spotbugs/i.test(f.buildText)) return `${f.builds.find((b) => /spotbugs/i.test(f.text(b)))} spotbugs plugin`;
      return onPath("spotbugs") ? "spotbugs on PATH" : null;
    },
    available: () => Boolean(onPath("spotbugs")),
    command: (scope, sarif) => `spotbugs -textui -sarif=${shellPath(sarif)} ${shellPath(scope)}`,
  },
  {
    id: "detekt",
    language: "java",
    format: "sarif",
    findingExits: [2],
    marker(f) {
      const config = firstExisting(f, ["detekt.yml", "config/detekt/detekt.yml", "config/detekt.yml"]);
      if (config) return config;
      if (/detekt/i.test(f.buildText)) return "Gradle detekt plugin";
      return onPath("detekt") ? "detekt on PATH" : null;
    },
    available: () => Boolean(onPath("detekt")),
    command(scope, sarif, f) {
      const config = firstExisting(f, ["detekt.yml", "config/detekt/detekt.yml", "config/detekt.yml"]);
      return `detekt --input ${shellPath(scope)}${config ? ` --config ${shellPath(config)}` : ""} --report sarif:${shellPath(sarif)}`;
    },
  },
  {
    id: "psalm",
    language: "php",
    format: "sarif",
    findingExits: [2],
    marker(f) {
      const config = firstExisting(f, ["psalm.xml", "psalm.xml.dist"]);
      if (config) return config;
      if (/"vimeo\/psalm"/.test(f.composer)) return "composer.json vimeo/psalm";
      return onPath("psalm") ? "psalm on PATH" : null;
    },
    available: (f) => Boolean(vendorBin(f, "psalm") || onPath("psalm")),
    // Psalm picks the report format by the file's extension.
    command: (scope, sarif, f) => `${vendorBin(f, "psalm") || "psalm"} --find-unused-code --report=${shellPath(psalmReport(sarif))} ${shellPath(scope)}`,
    reportFile: (sarif) => psalmReport(sarif),
  },
  {
    id: "rubocop",
    language: "ruby",
    // No built-in SARIF formatter in RuboCop (its formatter list has none), so
    // the agent reads its output.
    format: "agent",
    findingExits: [1],
    marker(f) {
      if (f.exists(".rubocop.yml")) return ".rubocop.yml";
      if (/['"]rubocop['"]/.test(f.gemfile)) return "Gemfile rubocop";
      return onPath("rubocop") ? "rubocop on PATH" : null;
    },
    available: () => Boolean(onPath("rubocop")),
    command: (scope) => `rubocop --only Lint/UnusedPrivateMethod,Lint/UselessAssignment ${shellPath(scope)}`,
  },
  {
    id: "debride",
    language: "ruby",
    format: "agent",
    findingExits: [],
    marker(f) {
      if (/['"]debride['"]/.test(f.gemfile)) return "Gemfile debride";
      return onPath("debride") ? "debride on PATH" : null;
    },
    available: () => Boolean(onPath("debride")),
    command: (scope) => `debride ${shellPath(scope)}`,
  },
  {
    id: "phpstan",
    language: "php",
    format: "agent",
    findingExits: [1],
    marker(f) {
      const config = firstExisting(f, ["phpstan.neon", "phpstan.neon.dist", "phpstan.dist.neon"]);
      if (config) return config;
      if (/"phpstan\/phpstan"/.test(f.composer)) return "composer.json phpstan/phpstan";
      return onPath("phpstan") ? "phpstan on PATH" : null;
    },
    available: (f) => Boolean(vendorBin(f, "phpstan") || onPath("phpstan")),
    // Level 4 is where PHPStan's unused private member rules start.
    command: (scope, sarif, f) => `${vendorBin(f, "phpstan") || "phpstan"} analyse --level 4 --no-progress ${shellPath(scope)}`,
  },
  {
    id: "error-prone",
    language: "java",
    format: "agent",
    findingExits: [],
    marker: (f) => (/error_prone|errorprone/i.test(f.buildText) ? `${f.builds.find((b) => /error_prone|errorprone/i.test(f.text(b)))} Error Prone` : null),
    available: (f) => Boolean(javaCompile(f)),
    // Error Prone runs inside the project's own compile.
    command: (scope, sarif, f) => javaCompile(f) || "mvn -q compile",
  },
  {
    id: "java-compile",
    language: "java",
    format: "agent",
    findingExits: [],
    marker: (f) => (f.builds.length ? f.builds[0] : null),
    available: (f) => Boolean(javaCompile(f)),
    command: (scope, sarif, f) => javaCompile(f) || "mvn -q compile",
  },
  {
    id: "dotnet-build",
    language: "csharp",
    format: "agent",
    findingExits: [],
    marker: (f) => f.rootEntries.filter((n) => /\.(sln|slnx|csproj)$/i.test(n)).sort()[0] || null,
    available: () => Boolean(onPath("dotnet")),
    command: () => "dotnet build",
  },
];
const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

const PMD_RULES = ["UnusedPrivateMethod", "UnusedPrivateField", "UnusedLocalVariable", "UnusedFormalParameter", "UnusedAssignment"]
  .map((rule) => `category/java/bestpractices.xml/${rule}`)
  .join(",");

/** A PMD ruleset file the project keeps (a sign PMD is set up), or null. */
function pmdRuleset(f) {
  const named = f.rootEntries.filter((n) => /pmd.*\.xml$/i.test(n)).sort()[0];
  if (named) return named;
  for (const dir of ["config/pmd", "pmd"]) {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(f.root, dir));
    } catch {}
    const xml = entries.filter((n) => n.toLowerCase().endsWith(".xml")).sort()[0];
    if (xml) return `${dir}/${xml}`;
  }
  return null;
}

/** Psalm's report path: the SARIF file with a .sarif.json extension. */
const psalmReport = (sarif) => (sarif === SARIF_FILE ? "<report.sarif.json>" : sarif.replace(/\.sarif$/, ".sarif.json"));

/** A Composer-installed binary (vendor/bin/<name>) as a native relative path, or null. */
function vendorBin(f, name) {
  const win = process.platform === "win32";
  const rel = `vendor/bin/${name}${win ? ".bat" : ""}`;
  return f.exists(rel) ? path.join("vendor", "bin", name + (win ? ".bat" : "")) : null;
}

/** The project's own Java or Kotlin compile command, or null when it cannot run here. */
function javaCompile(f) {
  const win = process.platform === "win32";
  if (f.builds.some((b) => b.startsWith("build.gradle"))) {
    if (f.exists(win ? "gradlew.bat" : "gradlew")) return `${win ? "gradlew.bat" : "./gradlew"} classes`;
    if (onPath("gradle")) return "gradle classes";
  }
  if (f.builds.includes("pom.xml") && onPath("mvn")) return "mvn -q compile";
  return null;
}

/** Every tool whose marker is found, in TOOLS order. */
function detectTools(root, scope) {
  const facts = { ...projectFacts(root), root };
  const found = [];
  for (const tool of TOOLS) {
    const marker = tool.marker(facts);
    if (!marker) continue;
    found.push({
      id: tool.id,
      language: tool.language,
      marker,
      available: Boolean(tool.available(facts)),
      command: tool.command(scope, SARIF_FILE, facts),
      format: tool.format,
    });
  }
  return { facts, found };
}

/* --------------------------------------------------------------- readers */

const nonEmptyLines = (text) => String(text || "").split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());

/** The first quoted symbol in a message: `x`, 'x', "x" or a curly-quoted one. */
function quotedName(text) {
  const m = String(text || "").match(/`([^`]+)`|'([^']+)'|"([^"]+)"|‘([^’]+)’|“([^”]+)”/);
  return m ? m.slice(1).find((g) => g !== undefined) : "";
}

/** The item a message ends on ("... to method App\Mailer::sendLater"), or "": a tool that quotes nothing still names it last. */
function trailingName(text) {
  const m = String(text || "").trim().match(/\b(?:method|function|property|class|constant|field|variable)\s+([\w\\]+(?:::\$?\w+)?)\.?$/i);
  return m ? m[1] : "";
}

/**
 * SARIF 2.1.0: one candidate per runs[].results[] with a location. kind comes
 * from the rule id (Unused, Unreachable, Dead), else "unknown".
 */
export function readSarif(text, root = process.cwd()) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { candidates: [], skipped: 0, unparsed: true };
  }
  const candidates = [];
  let skipped = 0;
  for (const runEntry of Array.isArray(doc && doc.runs) ? doc.runs : []) {
    for (const result of Array.isArray(runEntry && runEntry.results) ? runEntry.results : []) {
      const loc = result && Array.isArray(result.locations) ? result.locations[0] : null;
      const physical = loc && loc.physicalLocation;
      const uri = physical && physical.artifactLocation && physical.artifactLocation.uri;
      if (!uri) {
        skipped++;
        continue;
      }
      const rule = result.ruleId || (result.rule && result.rule.id) || null;
      const message = (result.message && (result.message.text || result.message.markdown)) || "";
      const kind = /unused/i.test(rule || "") ? "unused" : /unreachable/i.test(rule || "") ? "unreachable" : /dead/i.test(rule || "") ? "dead" : "unknown";
      candidates.push({
        file: projectPath(root, uri),
        line: (physical.region && physical.region.startLine) || null,
        name: quotedName(message) || trailingName(message),
        kind,
        source: "tool",
        rule,
        message,
      });
    }
  }
  return { candidates, skipped };
}

const KNIP_KINDS = { exports: "export", types: "type", enumMembers: "enum-member", classMembers: "class-member", duplicates: "duplicate" };

/** The items of one Knip issue type: an array, or an object of arrays keyed by parent (enum or class). */
function knipItems(value) {
  if (Array.isArray(value)) return value.map((v) => ({ item: v, parent: null }));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([parent, list]) => (Array.isArray(list) ? list.map((v) => ({ item: v, parent })) : []));
  return [];
}

/**
 * Knip's --reporter json: unused files become kind "file", and each issue's
 * exports, types, enumMembers, classMembers and duplicates become candidates
 * with rule set to the issue type.
 */
export function readKnip(text, root = process.cwd()) {
  // npx may print notices around the report; the report is the JSON object line.
  let doc = null;
  for (const line of [String(text || "").trim(), ...nonEmptyLines(text).filter((l) => l.trim().startsWith("{"))]) {
    try {
      doc = JSON.parse(line);
      break;
    } catch {}
  }
  if (!doc || typeof doc !== "object") return { candidates: [], skipped: 0, unparsed: true };
  const candidates = [];
  let skipped = 0;
  const seenFiles = new Set();
  const addFile = (file) => {
    const f = projectPath(root, file);
    if (seenFiles.has(f)) return;
    seenFiles.add(f);
    candidates.push({ file: f, line: null, name: "", kind: "file", source: "tool", rule: "files", message: "Unused file" });
  };
  for (const file of Array.isArray(doc.files) ? doc.files : []) {
    if (typeof file === "string") addFile(file);
    else if (file && file.name) addFile(file.name);
    else skipped++;
  }
  for (const issue of Array.isArray(doc.issues) ? doc.issues : []) {
    if (!issue || typeof issue.file !== "string") {
      skipped++;
      continue;
    }
    if (issue.files === true || (Array.isArray(issue.files) && issue.files.length)) addFile(issue.file);
    for (const [type, kind] of Object.entries(KNIP_KINDS)) {
      for (const { item, parent } of knipItems(issue[type])) {
        // A duplicates entry is a group of names exported twice.
        const group = Array.isArray(item) ? item : [item];
        const names = group.map((g) => (g && typeof g === "object" ? g.name : g)).filter((n) => typeof n === "string" && n);
        if (!names.length) {
          skipped++;
          continue;
        }
        const first = group.find((g) => g && typeof g === "object") || {};
        const name = parent ? `${parent}.${names.join(", ")}` : names.join(", ");
        candidates.push({
          file: projectPath(root, issue.file),
          line: Number.isInteger(first.line) ? first.line : null,
          name,
          kind,
          source: "tool",
          rule: type,
          message: `Unused ${kind.replace("-", " ")} ${name}`,
        });
      }
    }
  }
  return { candidates, skipped };
}

const VULTURE_LINE = /^(.+?):(\d+): (.+?) \((\d+)% confidence[^)]*\)$/;

/** vulture: `path:line: unused <kind> '<name>' (<n>% confidence)`, and its unreachable-code lines. */
export function readVulture(text, root = process.cwd()) {
  const candidates = [];
  let skipped = 0;
  for (const line of nonEmptyLines(text)) {
    const m = line.match(VULTURE_LINE);
    if (!m) {
      skipped++;
      continue;
    }
    const what = m[3];
    const unused = what.match(/^unused (.+?) '(.+)'$/);
    const kind = unused ? unused[1] : /^unreachable code/.test(what) ? "unreachable code" : what.replace(/'.*$/, "").trim();
    candidates.push({
      file: projectPath(root, m[1]),
      line: Number(m[2]),
      // An unreachable-code line quotes the statement before it, not a symbol.
      name: unused ? unused[2] : kind === "unreachable code" ? "" : quotedName(what),
      kind,
      source: "tool",
      rule: `vulture-${kind.replace(/\s+/g, "-")}`,
      message: `${what} (${m[4]}% confidence)`,
    });
  }
  return { candidates, skipped };
}

/**
 * cargo check --message-format=json: compiler-message records whose code is
 * dead_code or unused_*, at the primary span. Lines that are not JSON records
 * (cargo's own progress text) are not findings and are not counted.
 */
export function readCargo(text, root = process.cwd()) {
  const candidates = [];
  let skipped = 0;
  const seen = new Set();
  for (const line of nonEmptyLines(text)) {
    if (!line.trim().startsWith("{")) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (!record || record.reason !== "compiler-message") continue;
    const message = record.message || {};
    const code = message.code && message.code.code;
    if (!code || !(code === "dead_code" || code.startsWith("unused_"))) continue;
    // rustc groups items in one warning ("unused imports: `fmt` and `io`"),
    // one primary span per item: each becomes its own candidate.
    const primaries = (Array.isArray(message.spans) ? message.spans : []).filter((s) => s && s.is_primary && s.file_name);
    if (!primaries.length) {
      skipped++;
      continue;
    }
    const text = message.message || "";
    const kind = code === "dead_code" ? deadCodeKind(text) : code;
    for (const span of primaries) {
      const file = projectPath(root, span.file_name);
      // --all-targets builds a crate more than once and repeats each warning.
      const key = `${file}:${span.line_start}:${span.column_start}:${code}:${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const name = spanText(span) || (primaries.length === 1 ? quotedName(text) : "");
      candidates.push({ file, line: span.line_start || null, name, kind, source: "tool", rule: code, message: text });
    }
  }
  return { candidates, skipped };
}

/** The item a dead_code warning names: "function `x` is never used" and "multiple fields are never read" give function and field. */
function deadCodeKind(text) {
  const head = text.includes("`") ? text.split("`")[0] : (text.match(/^(.+?) (?:is|are) never\b/) || [])[1] || "";
  return (
    head
      .trim()
      .replace(/^multiple\s+/, "")
      .replace(/aliases$/, "alias")
      .replace(/(?<!(?:s|alia))s$/, "") || "item"
  );
}

/** The highlighted text of a one-line cargo span (the item's name), or "". */
function spanText(span) {
  const t = Array.isArray(span.text) ? span.text[0] : null;
  if (!t || typeof t.text !== "string" || !Number.isInteger(t.highlight_start) || !Number.isInteger(t.highlight_end)) return "";
  if (span.line_start !== span.line_end) return "";
  return t.text.slice(t.highlight_start - 1, t.highlight_end - 1).trim();
}

const GO_DEADCODE_LINE = /^(.+?):(\d+):(\d+): unreachable func: (.+)$/;

/** Go deadcode: `path:line:col: unreachable func: Name`. */
export function readGoDeadcode(text, root = process.cwd()) {
  const candidates = [];
  let skipped = 0;
  for (const line of nonEmptyLines(text)) {
    const m = line.match(GO_DEADCODE_LINE);
    if (!m) {
      skipped++;
      continue;
    }
    candidates.push({ file: projectPath(root, m[1]), line: Number(m[2]), name: m[4].trim(), kind: "func", source: "tool", rule: "deadcode", message: `unreachable func: ${m[4].trim()}` });
  }
  return { candidates, skipped };
}

const READERS = { sarif: readSarif, "knip-json": readKnip, vulture: readVulture, "cargo-json": readCargo, "go-deadcode": readGoDeadcode };

/** Read a tool's output; output where every line was dropped comes back unparsed. */
export function readOutput(format, text, root) {
  const reader = READERS[format];
  if (!reader) return { candidates: [], skipped: 0, unparsed: true };
  const result = reader(text, root);
  const unparsed = Boolean(result.unparsed) || (result.candidates.length === 0 && result.skipped > 0);
  return { candidates: result.candidates, skipped: result.skipped, unparsed };
}

/* ------------------------------------------------------------- keep file */

// The shared keep list (FR-13): tracked in the person's project, safe to
// commit. One table row per kept item; prose around the table is the
// person's and is never rewritten.
export const STATE_DIR = ".plan2code-dead-code";
const KEEP_REL = `${STATE_DIR}/keep.md`;
const KEEP_COLUMNS = ["File", "Name", "Hash", "Reason", "Date"];
const KEEP_HEADER_LINE = /^\|\s*File\s*\|\s*Name\s*\|\s*Hash\s*\|\s*Reason\s*\|\s*Date\s*\|\s*$/i;
const KEEP_INTRO = [
  "# Dead Code keep list",
  "",
  "This list is shared and safe to commit. Each row is code the Dead Code skill found unused that was kept on purpose, with the reason. A kept item stays hidden in later runs until its declaration line changes; take a row out to have it checked again.",
  "",
];

/** A table cell: one line, pipes escaped. */
const cell = (value) => String(value ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
/** A table row's cells, split on unescaped pipes and unescaped. */
const rowCells = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

/** Where the keep table sits in the file's lines: { header, end } (end exclusive), or null. */
function keepTableSpan(lines) {
  const header = lines.findIndex((l) => KEEP_HEADER_LINE.test(l));
  if (header === -1) return null;
  let end = header + 1;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  return { header, end };
}

/** The keep list: { entries: [{ file, name, hash, reason, date }], path, exists }. A missing file or one with no table has no entries. */
export function readKeep(root) {
  const file = path.join(root, KEEP_REL);
  const text = readText(file);
  if (text === null) return { entries: [], path: file, exists: false };
  const lines = text.split(/\r?\n/);
  const span = keepTableSpan(lines);
  const entries = [];
  if (span) {
    for (const line of lines.slice(span.header + 1, span.end)) {
      if (/^\|[\s:|-]+\|?\s*$/.test(line.trim())) continue; // the separator row
      const [f = "", name = "", hash = "", reason = "", date = ""] = rowCells(line);
      if (!f) continue;
      entries.push({ file: f.replace(/\\/g, "/"), name, hash, reason, date });
    }
  }
  return { entries, path: file, exists: true };
}

/** The keep table's lines for `entries`. */
function keepTable(entries) {
  return [
    `| ${KEEP_COLUMNS.join(" | ")} |`,
    `| ${KEEP_COLUMNS.map(() => "---").join(" | ")} |`,
    ...entries.map((e) => `| ${[e.file, e.name, e.hash, e.reason, e.date].map(cell).join(" | ")} |`),
  ];
}

/** The keep file's text with its table set to `entries`, keeping any prose; `current` null builds a new file. */
function keepText(current, entries) {
  if (current === null) return [...KEEP_INTRO, ...keepTable(entries), ""].join("\n");
  const nl = eol(current);
  const lines = current.split(/\r?\n/);
  const span = keepTableSpan(lines);
  if (span) lines.splice(span.header, span.end - span.header, ...keepTable(entries));
  else {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push("", ...keepTable(entries), "");
  }
  return lines.join(nl);
}

/** Rewrite the keep table (creating the folder and the file on first write). Returns the file's path. */
export function writeKeep(root, entries) {
  const file = path.join(root, KEEP_REL);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, keepText(readText(file), entries));
  return file;
}

/** Marks a keep hash that covers a whole file (an unused file has no declaration line). */
const WHOLE_FILE = "file:";

/** A declaration line as the hash sees it: trimmed, whitespace runs collapsed. */
const normalizeDecl = (line) => line.trim().replace(/\s+/g, " ");
const hashOf = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);

/** Every line's base hash (normalized, 12 hex), so a file is hashed once per command. */
export const lineHashes = (text) => text.split(/\r?\n/).map((l) => hashOf(normalizeDecl(l)));

/** A keep hash split into its 12-hex base and occurrence number: "a1b2c3d4e5f6#2" is { base, n: 2 }; any other string (a plain or file: hash) has n null. */
export function splitHash(hash) {
  const m = /^([0-9a-f]{12})#([1-9]\d*)$/.exec(String(hash));
  return m ? { base: m[1], n: Number(m[2]) } : { base: String(hash), n: null };
}

/** The keep hash of line `line` (1-based) given a file's lineHashes: the base, plus "#n" when the line repeats (n counts identical lines from the top). null for a line the file does not have. */
function hashAt(hashes, line) {
  if (!Number.isInteger(line) || line < 1 || line > hashes.length) return null;
  const base = hashes[line - 1];
  let copies = 0;
  let n = 0;
  hashes.forEach((h, i) => {
    if (h !== base) return;
    copies++;
    if (i < line) n++;
  });
  return { hash: copies > 1 ? `${base}#${n}` : base, base, copies };
}

/**
 * A file's declaration line as the keep list stores it: { hash, base, copies,
 * missing }. base is the first 12 hex of the sha256 of the normalized line;
 * copies is how many lines of the file share that base. hash is base for a
 * line unique in its file, and base#n for the n-th (1-based, top to bottom)
 * of several identical lines. missing (hash "") when the file or line is gone.
 */
export function declHash(root, file, line) {
  const text = readText(path.resolve(root, file));
  const at = text === null ? null : hashAt(lineHashes(text), line);
  if (!at) return { hash: "", missing: true };
  return { ...at, missing: false };
}

/**
 * A kept entry against the code now. The table holds no line number, so a
 * moved declaration is still found. A plain hash is current while exactly one
 * line of the file has it (a plain row means a line unique in its file); a
 * base#n hash is current while at least two lines share the base and copy n
 * exists. A whole-file hash is current while the file's text is unchanged.
 * Otherwise: changed when the file still names the item, gone when the file
 * is missing or no longer names it. `cached` ({ text, hashes }, or null for a
 * missing file) saves a read when the caller has the file already.
 */
export function keepState(root, entry, cached) {
  if (cached === null) return "gone";
  const text = cached ? cached.text : readText(path.resolve(root, entry.file));
  if (text === null) return "gone";
  if (String(entry.hash).startsWith(WHOLE_FILE)) return WHOLE_FILE + hashOf(text) === entry.hash ? "current" : "changed";
  if (entry.hash) {
    const hashes = cached ? cached.hashes : lineHashes(text);
    const { base, n } = splitHash(entry.hash);
    const copies = hashes.filter((h) => h === base).length;
    if (n === null ? copies === 1 : copies >= 2 && copies >= n) return "current";
  }
  // Knip names a member "Parent.member" and a duplicate group "a, b": any part found counts.
  const parts = String(entry.name || "")
    .split(/[\s,]+/)
    .map((p) => p.split(".").pop())
    .filter(Boolean);
  return parts.some((p) => text.includes(p)) ? "changed" : "gone";
}

/**
 * A file argument as a forward-slash path relative to root. A path that
 * resolves outside the project exits 5: the script reads and writes only
 * inside the project it was pointed at.
 */
function insideRoot(root, file) {
  if (!isInsideRoot(root, file)) fail(EXIT.REFUSED, "outside-root", `${file} is not a file inside ${slash(root)}.`, "Pass paths relative to the project root, inside it.");
  const abs = path.resolve(root, String(file));
  return { abs, rel: slash(path.relative(root, abs)) };
}

/** Whether a file argument resolves to a path inside root (insideRoot's test, without exiting). */
function isInsideRoot(root, file) {
  const relative = path.relative(root, path.resolve(root, String(file)));
  // ".." as a whole segment only: a file named "..foo.js" is inside the project.
  return !(!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative));
}

/* -------------------------------------------------------------- commands */

function wholeNumber(value, flag, fallback, max = Infinity) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) fail(EXIT.USAGE, "bad-number", `--${flag} needs a whole number from 1${max === Infinity ? " up" : ` to ${max}`}, got "${value}".`, "Run with --help for usage.");
  return n;
}

function noPositionals(args, command) {
  if (args._.length) fail(EXIT.USAGE, "unexpected-argument", `Unexpected argument "${args._[0]}" for ${command}.`, "Run with --help for usage.");
}

function cmdDetect(argv) {
  const args = parseArgs(argv, { values: ["scope", "root", "limit"] });
  noPositionals(args, "detect");
  const root = projectRoot(args.root);
  const scope = projectScope(root, args.scope);
  const limit = wholeNumber(args.limit, "limit", NARROW_LIMIT);
  const { languages, sourceFiles } = countSources(path.join(root, scope));
  const { found } = detectTools(root, scope);
  out({ ok: true, root: slash(root), scope, languages, sourceFiles, overLimit: sourceFiles > limit, limit, tools: found });
}

function tailLines(text) {
  const lines = String(text || "").split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  // Cap each line, as run-check.mjs does: one cargo JSON record is several KB.
  return lines.slice(-TAIL_LINES).map((l) => (l.length > TAIL_LINE_CAP ? l.slice(0, TAIL_LINE_CAP) : l));
}

async function cmdRun(argv) {
  const args = parseArgs(argv, { values: ["tool", "scope", "timeout", "root"] });
  noPositionals(args, "run");
  if (!args.tool) fail(EXIT.USAGE, "missing-tool", "run needs --tool <id>.", "Run detect and pass one of its tools[].id.");
  const tool = TOOL_BY_ID.get(args.tool);
  if (!tool) fail(EXIT.USAGE, "unknown-tool", `There is no tool "${args.tool}".`, `Pass one of: ${TOOLS.map((t) => t.id).join(", ")}.`);
  const root = projectRoot(args.root);
  const scope = projectScope(root, args.scope);
  const timeout = wholeNumber(args.timeout, "timeout", DEFAULT_TIMEOUT, MAX_TIMEOUT);
  const { facts, found } = detectTools(root, scope);
  const detected = found.find((t) => t.id === tool.id);
  if (!detected) fail(EXIT.NOT_FOUND, "tool-not-detected", `${tool.id} is not set up in this project.`, "Run detect and pick one of the tools it lists, or search for callers without a tool.");
  if (!detected.available) fail(EXIT.NOT_FOUND, "tool-unavailable", `${tool.id} is set up (${detected.marker}) but cannot run here.`, "Its binary is not installed; never install it. Search for callers without a tool.");

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-dead-code-"));
  try {
    const sarif = path.join(work, "report.sarif");
    const log = path.join(work, "output.log");
    const cmd = tool.command(scope, sarif, facts);
    // run-check.mjs owns the spawn, the timeout and the process-tree kill.
    const result = await runCheck({ cmd, cwd: root, timeout, log });
    const output = readText(log) || "";
    const base = { tool: tool.id, format: tool.format, exit: result.exit, seconds: result.seconds, tail: tailLines(output) };
    if (result.outcome === "not-started") fail(EXIT.NOT_FOUND, "tool-not-started", `${tool.id} did not start (${result.reason}).`, "Check the tool is installed in the project; never install it. Search for callers without a tool.", base);
    if (result.outcome === "timeout") fail(EXIT.INVALID, "tool-timeout", `${tool.id} was stopped after ${timeout} seconds.`, "Run it again with a longer --timeout, narrow --scope, or search for callers without a tool.", base);
    if (result.outcome === "failed" && !tool.findingExits.includes(result.exit)) fail(EXIT.INVALID, "tool-failed", `${tool.id} failed with exit ${result.exit}.`, "Read tail for the cause; fix the tool's setup or search for callers without a tool.", base);

    let read;
    if (tool.format === "agent") read = { candidates: [], skipped: 0, unparsed: true };
    else if (tool.format === "sarif") {
      const report = readText(tool.reportFile ? tool.reportFile(sarif) : sarif);
      read = report === null ? { candidates: [], skipped: 0, unparsed: true } : readOutput("sarif", report, root);
    } else read = output.trim() ? readOutput(tool.format, output, root) : { candidates: [], skipped: 0, unparsed: false };
    const candidates = read.candidates.filter((c) => underScope(scope, c.file));
    out({ ok: true, ...base, scope, candidates, unparsed: read.unparsed, skipped: read.skipped });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function cmdNarrow(argv) {
  const args = parseArgs(argv, { values: ["candidates", "depth"] });
  noPositionals(args, "narrow");
  if (!args.candidates) fail(EXIT.USAGE, "missing-candidates", "narrow needs --candidates <file>.", "Save run's output (or its candidates array) to a file and pass it.");
  const depth = wholeNumber(args.depth, "depth", 2);
  const text = readText(path.resolve(args.candidates));
  if (text === null) fail(EXIT.NOT_FOUND, "candidates-missing", `Cannot read ${args.candidates}.`, "Pass the file you saved run's output to.");
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    fail(EXIT.INVALID, "candidates-invalid", `${args.candidates} is not valid JSON (${err.message}).`, "Save run's JSON output unchanged.");
  }
  const list = Array.isArray(doc) ? doc : doc && Array.isArray(doc.candidates) ? doc.candidates : null;
  if (!list) fail(EXIT.INVALID, "candidates-invalid", `${args.candidates} holds no candidates array.`, "Pass run's output, or its candidates array.");
  const counts = new Map();
  for (const c of list) {
    const parts = String((c && c.file) || "").replace(/\\/g, "/").split("/").filter(Boolean);
    const folder = parts.slice(0, -1).slice(0, depth).join("/") || ".";
    counts.set(folder, (counts.get(folder) || 0) + 1);
  }
  const folders = [...counts].map(([p, candidates]) => ({ path: p, candidates })).sort((a, b) => b.candidates - a.candidates || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  out({ ok: true, folders, total: list.length });
}

/* ------------------------------------------------------------ keep list */

function keepList(argv) {
  const args = parseArgs(argv, { values: ["root"] });
  noPositionals(args, "keep list");
  const root = projectRoot(args.root);
  const keep = readKeep(root);
  const entries = keep.entries.map((e) => ({ ...e, state: keepState(root, e) }));
  out({ ok: true, exists: keep.exists, path: KEEP_REL, entries });
}

function keepAdd(argv) {
  const args = parseArgs(argv, { booleans: ["dry-run"], values: ["root", "file", "name", "line", "reason"] });
  noPositionals(args, "keep add");
  if (!args.file || !String(args.file).trim()) fail(EXIT.USAGE, "missing-file", "keep add needs --file.", "Pass --file and --reason, and --name and --line for an item inside the file.");
  const named = String(args.name || "").trim();
  const wholeFile = args.line === undefined;
  if (wholeFile && !named) {
    // no name and no line: a whole unused file, kept by its path
  } else if (!wholeFile && !String(args.line).trim()) fail(EXIT.USAGE, "missing-line", "keep add needs a value for --line.", "Pass the line the declaration is on, or leave --line out to keep the whole file.");
  // FR-13: every kept item carries the person's reason.
  if (!args.reason || !String(args.reason).trim()) fail(EXIT.USAGE, "missing-reason", "keep add needs a --reason, and it cannot be empty.", "Ask the person why the item stays, and pass their words as --reason.");
  const root = projectRoot(args.root);
  const { rel } = insideRoot(root, args.file);
  let hash;
  if (wholeFile) {
    const text = readText(path.resolve(root, rel));
    if (text === null) fail(EXIT.NOT_FOUND, "file-missing", `${rel} is not a file in the project.`, "Pass a file that exists.");
    hash = WHOLE_FILE + hashOf(text);
  } else {
    const line = wholeNumber(args.line, "line");
    const decl = declHash(root, rel, line);
    if (decl.missing) fail(EXIT.NOT_FOUND, "declaration-missing", `${rel} has no line ${line}.`, "Pass the item's file and the line its declaration is on now.");
    hash = decl.hash;
  }
  const entry = { file: rel, name: named, hash, reason: String(args.reason).replace(/\s+/g, " ").trim(), date: isoDate() };
  const keep = readKeep(root);
  // Rows are told apart by file, name and hash: a same-named row with another
  // hash that is still current is a different item and stays. The same item
  // (same hash) or a stale same-named row (code changed since) is replaced.
  const entries = keep.entries.filter((e) => !(e.file === entry.file && e.name === entry.name && (e.hash === entry.hash || keepState(root, e) !== "current")));
  const replaced = entries.length !== keep.entries.length;
  entries.push(entry);
  if (args["dry-run"]) return out({ ok: true, dryRun: true, entry, replaced, path: KEEP_REL });
  writeKeep(root, entries);
  out({ ok: true, entry, replaced, path: KEEP_REL });
}

function keepRemove(argv) {
  const args = parseArgs(argv, { booleans: ["dry-run"], values: ["root", "file", "name", "hash", "line"] });
  noPositionals(args, "keep remove");
  // A whole-file entry is stored with name "", so --name may be left out or empty.
  if (!args.file || !String(args.file).trim()) fail(EXIT.USAGE, "missing-file", "keep remove needs --file.", "Pass the --file and --name of the entry, as keep list prints them (no --name for a whole file).");
  const root = projectRoot(args.root);
  const file = String(args.file).trim().replace(/\\/g, "/").replace(/^\.\//, "");
  const name = String(args.name ?? "").trim();
  const keep = readKeep(root);
  let matches = keep.entries.filter((e) => e.file === file && e.name === name);
  if (args.hash !== undefined) {
    const hash = String(args.hash).trim();
    matches = matches.filter((e) => e.hash === hash);
  }
  if (args.line !== undefined) {
    const line = wholeNumber(args.line, "line");
    const decl = declHash(root, insideRoot(root, file).rel, line);
    if (decl.missing) fail(EXIT.NOT_FOUND, "declaration-missing", `${file} has no line ${line}.`, "Pass the item's file and the line its declaration is on now.");
    matches = matches.filter((e) => e.hash === decl.hash);
  }
  if (!matches.length) fail(EXIT.NOT_FOUND, "not-kept", `${file} ${name} is not on the keep list.`, "Run keep list for the entries as they are written.");
  // Several rows share this file and name: never guess which one is meant.
  if (matches.length > 1) {
    const rows = matches.map((e) => `${e.hash} (${e.reason})`).join("; ");
    fail(EXIT.USAGE, "ambiguous-entry", `${file} ${name} matches ${matches.length} keep entries.`, `Rows: ${rows}. Pass --hash <h> or --line <l> to pick one.`);
  }
  const removed = matches[0];
  if (args["dry-run"]) return out({ ok: true, dryRun: true, removed, path: KEEP_REL });
  writeKeep(root, keep.entries.filter((e) => e !== removed));
  out({ ok: true, removed, path: KEEP_REL });
}

/** A JSON candidates array (or run's whole output) from stdin. */
function readCandidatesStdin() {
  let text = "";
  try {
    text = fs.readFileSync(0, "utf8");
  } catch {}
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    fail(EXIT.INVALID, "candidates-invalid", `stdin is not valid JSON (${text.trim() ? err.message : "it was empty"}).`, "Pipe the candidates array (or run's output) into keep filter.");
  }
  const list = Array.isArray(doc) ? doc : doc && Array.isArray(doc.candidates) ? doc.candidates : null;
  if (!list) fail(EXIT.INVALID, "candidates-invalid", "stdin holds no candidates array.", "Pipe the candidates array (or run's output) into keep filter.");
  return list;
}

/**
 * Split candidates by the keep list. A candidate with a line matches the row
 * for its file and name whose hash is its own line's hash (with #n when that
 * line repeats), so a kept item never hides a different one with the same
 * name. A line-less candidate with no name matches only a whole-file row; a
 * line-less named one matches its file and name (a line row first, else a
 * whole-file row kept with that name). A current row hides its
 * candidate; a changed one does not, and the candidate comes back marked
 * wasKept with the old reason so it is looked at again (also when no row
 * matches its hash but a same-named row is changed). --fresh hides nothing.
 * kept always lists every entry, so the count stays visible. Each file is
 * read and hashed at most once, and a candidate outside the root is never
 * read (it counts as line-less).
 */
function keepFilter(argv) {
  const args = parseArgs(argv, { booleans: ["fresh"], values: ["root"] });
  noPositionals(args, "keep filter");
  const root = projectRoot(args.root);
  const candidates = readCandidatesStdin();
  const norm = (file) => String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
  const cache = new Map();
  const load = (file) => {
    if (!cache.has(file)) {
      const text = readText(path.resolve(root, file));
      cache.set(file, text === null ? null : { text, hashes: lineHashes(text) });
    }
    return cache.get(file);
  };
  const entries = readKeep(root).entries.map((e) => ({ ...e, state: keepState(root, e, load(norm(e.file))) }));
  const keyOf = (file, name) => `${norm(file)}\u0000${name || ""}`;
  const groups = new Map();
  for (const e of entries) {
    const key = keyOf(e.file, e.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const isWhole = (e) => String(e.hash).startsWith(WHOLE_FILE);
  /** The row a candidate answers to (with a line and no hash match, a changed same-named row so it is flagged), or undefined. */
  const matchOf = (c) => {
    const file = norm(c && c.file);
    const name = (c && c.name) || "";
    const group = groups.get(keyOf(file, name)) || [];
    const inside = file !== "" && isInsideRoot(root, file);
    if (inside && Number.isInteger(c.line)) {
      const cached = load(file);
      const at = cached && hashAt(cached.hashes, c.line);
      const exact = at && group.find((e) => !isWhole(e) && e.hash === at.hash);
      return exact || group.find((e) => !isWhole(e) && e.state === "changed");
    }
    // A named whole-file row (keep add --name without --line) still answers a line-less finding of that name.
    return name === "" ? group.find(isWhole) : group.find((e) => !isWhole(e)) || group.find(isWhole);
  };
  const shown = [];
  const hidden = [];
  let changed = 0;
  for (const c of candidates) {
    const entry = args.fresh ? null : matchOf(c);
    if (entry && entry.state === "current") hidden.push({ ...c, keptReason: entry.reason });
    else if (entry && entry.state === "changed") {
      shown.push({ ...c, wasKept: true, keptReason: entry.reason });
      changed++;
    } else shown.push(c);
  }
  const kept = entries.map((e) => ({ file: e.file, name: e.name, reason: e.reason, ...(e.state === "gone" ? { gone: true } : {}) }));
  out({ ok: true, fresh: Boolean(args.fresh), shown, hidden, kept, changed });
}

const KEEP_COMMANDS = { list: keepList, add: keepAdd, remove: keepRemove, filter: keepFilter };

function cmdKeep(argv) {
  const [sub, ...rest] = argv;
  const handler = KEEP_COMMANDS[sub];
  if (!handler) fail(EXIT.USAGE, sub ? "unknown-keep-command" : "missing-keep-command", sub ? `Unknown keep command "${sub}".` : "keep needs a command.", "One of: list, filter, add, remove. Run with --help for usage.");
  handler(rest);
}

/* ------------------------------------------------------ backup, restore */

// Backups live under the system temp folder, outside the project, so a failed
// run never leaves stray files in the person's repo (NFR-3). They are copies,
// never moves, and nothing here deletes them: the operating system cleans temp.
const backupsHome = () => path.join(os.tmpdir(), `plan2code-dead-code-${typeof process.getuid === "function" ? process.getuid() : os.userInfo().username.replace(/[^A-Za-z0-9._-]/g, "_")}`);

/** Make the per-user backup folder private (0700) and refuse one that is not a real folder owned by this user (exit 5). POSIX only; Windows temp is already per user. */
function privateHome(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch {}
  if (process.platform === "win32") return dir;
  let st = null;
  try {
    st = fs.lstatSync(dir);
  } catch {}
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  if (!st || !st.isDirectory() || st.isSymbolicLink() || (uid !== null && st.uid !== uid) || (st.mode & 0o077) !== 0) {
    fail(EXIT.REFUSED, "backup-folder-unsafe", `${slash(dir)} is not a private folder owned by you.`, "Remove or fix that folder (it should be mode 0700 and yours), then run backup again.");
  }
  return dir;
}
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function runId(value) {
  if (value === undefined) return `${compactDate()}-${clock()}-${crypto.randomBytes(2).toString("hex")}`;
  if (!RUN_ID.test(String(value)) || String(value).includes("..")) fail(EXIT.USAGE, "bad-run", `--run "${value}" is not a run id.`, "Pass the run id backup printed.");
  return String(value);
}

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const samePath = (a, b) => (process.platform === "win32" ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));

function readManifest(dir) {
  const text = readText(path.join(dir, "manifest.json"));
  if (text === null) return null;
  try {
    const doc = JSON.parse(text);
    if (doc && Array.isArray(doc.files)) return doc;
  } catch {}
  fail(EXIT.INVALID, "manifest-invalid", `${slash(path.join(dir, "manifest.json"))} is not a backup manifest.`, "Back the files up again under a new run id.");
}

/**
 * Copy files into <tmp>/plan2code-dead-code/<run>/files/ and record each
 * one's size and sha256 in the run's manifest. A file the run already holds
 * keeps its first copy: a later backup of it in the same run would otherwise
 * replace the original with an edited version.
 */
function cmdBackup(argv) {
  const args = parseArgs(argv, { booleans: ["dry-run"], values: ["root", "run"] });
  if (!args._.length) fail(EXIT.USAGE, "missing-files", "backup needs the files to copy.", "Pass each file the removal will change, relative to the project root.");
  const root = projectRoot(args.root);
  const run = runId(args.run);
  const dir = path.join(args["dry-run"] ? backupsHome() : privateHome(backupsHome()), run);
  const manifest = readManifest(dir) || { run, root: slash(root), created: now().toISOString(), files: [] };
  if (!samePath(manifest.root, root)) fail(EXIT.REFUSED, "other-project", `Run ${run} backs up ${manifest.root}, not ${slash(root)}.`, "Use a new run id for this project.");
  const files = [...new Set(args._.map((f) => insideRoot(root, f).rel))];
  // Every source is checked before anything is copied: a missing one writes nothing.
  for (const rel of files) {
    let stat = null;
    try {
      stat = fs.statSync(path.join(root, rel));
    } catch {}
    if (!stat || !stat.isFile()) fail(EXIT.NOT_FOUND, "file-missing", `${rel} is not a file in the project; nothing was backed up.`, "Back up only files that exist, before removing anything from them.");
  }
  const held = new Set(manifest.files.map((f) => f.path));
  const already = files.filter((rel) => held.has(rel));
  const added = files
    .filter((rel) => !held.has(rel))
    .map((rel) => {
      const src = path.join(root, rel);
      return { path: rel, size: fs.statSync(src).size, sha256: sha256File(src) };
    });
  if (args["dry-run"]) return out({ ok: true, dryRun: true, run, dir: slash(dir), files: added, already });
  for (const entry of added) {
    const copy = path.join(dir, "files", entry.path);
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.copyFileSync(path.join(root, entry.path), copy);
    if (sha256File(copy) !== entry.sha256) fail(EXIT.INVALID, "copy-unverified", `The backup copy of ${entry.path} does not match the file.`, "Nothing was removed yet; run backup again under a new run id.");
  }
  manifest.files.push(...added);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  out({ ok: true, run, dir: slash(dir), files: added, already });
}

/** Why a project file does not match its manifest entry, or null when it does. */
function mismatch(file, entry) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return "the file is missing";
  }
  if (!stat.isFile()) return "not a file";
  if (stat.size !== entry.size) return `size ${stat.size}, expected ${entry.size}`;
  if (sha256File(file) !== entry.sha256) return "content differs from the backup";
  return null;
}

/**
 * Copy a run's files back over the project (all, or --files) and check each
 * one against the manifest afterwards. --verify copies nothing and only
 * checks, so a put-back is confirmed before the next retry. Never deletes.
 */
function cmdRestore(argv) {
  const args = parseArgs(argv, { booleans: ["verify", "dry-run"], values: ["root", "run"], lists: ["files"] });
  if (!args.run) fail(EXIT.USAGE, "missing-run", "restore needs --run <id>.", "Pass the run id backup printed.");
  const root = projectRoot(args.root);
  const run = runId(args.run);
  const dir = path.join(args.verify || args["dry-run"] ? backupsHome() : privateHome(backupsHome()), run);
  const manifest = readManifest(dir);
  if (!manifest) fail(EXIT.NOT_FOUND, "run-missing", `There is no backup for run ${run}.`, "Pass the run id backup printed; restore never guesses.");
  if (!samePath(manifest.root, root)) fail(EXIT.REFUSED, "other-project", `Run ${run} backs up ${manifest.root}, not ${slash(root)}.`, "Run restore from the project the backup came from, or pass that --root.");
  // The manifest sits in the shared temp folder: every path in it must still
  // land inside the project before anything is copied (exit 5 otherwise).
  for (const e of manifest.files) {
    if (!e || typeof e.path !== "string" || !e.path) fail(EXIT.INVALID, "manifest-invalid", `Run ${run}'s manifest has an entry with no path.`, "Back the files up again under a new run id.");
    insideRoot(root, e.path);
  }
  const named = [...(args.files || []), ...args._];
  let entries = manifest.files;
  if (named.length) {
    const wanted = new Set(named.map((f) => insideRoot(root, f).rel));
    const unknown = [...wanted].filter((rel) => !manifest.files.some((e) => e.path === rel));
    if (unknown.length) fail(EXIT.NOT_FOUND, "not-backed-up", `Run ${run} holds no copy of ${unknown.join(", ")}.`, "Restore only files backup printed for this run.");
    entries = manifest.files.filter((e) => wanted.has(e.path));
  }
  if (args["dry-run"] && !args.verify) return out({ ok: true, dryRun: true, run, restored: [], wouldRestore: entries.map((e) => e.path), mismatched: [] });

  const restored = [];
  const verified = [];
  const mismatched = [];
  for (const entry of entries) {
    const target = path.join(root, entry.path);
    if (!args.verify) {
      // A damaged backup copy is reported and never copied over the project file.
      const damaged = mismatch(path.join(dir, "files", entry.path), entry);
      if (damaged) {
        mismatched.push({ path: entry.path, reason: `backup copy damaged (${damaged}); the project file was left as it is` });
        continue;
      }
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(dir, "files", entry.path), target);
      } catch (err) {
        mismatched.push({ path: entry.path, reason: `copy failed (${err.code || err.message})` });
        continue;
      }
    }
    const why = mismatch(target, entry);
    if (why) mismatched.push({ path: entry.path, reason: why });
    else (args.verify ? verified : restored).push(entry.path);
  }
  const result = { ok: mismatched.length === 0, run, ...(args.verify ? { verify: true, verified } : {}), restored, mismatched };
  if (mismatched.length) {
    out({ ...result, error: "mismatch", message: `${mismatched.length} file(s) do not match the backup: ${mismatched.map((m) => m.path).join(", ")}.`, next: "Stop the retries and tell the person which files are not back as they were." });
    process.stderr.write(`error: ${mismatched.length} file(s) do not match the backup\n`);
    process.exitCode = EXIT.INVALID;
    return;
  }
  out(result);
}

/* ---------------------------------------------------------------- report */

const REPORTS_REL = `${STATE_DIR}/reports`;
const LABELS = [
  { id: "safe", title: "Safe to remove" },
  { id: "check", title: "Check first" },
  { id: "warning", title: "Warning" },
];
// mode: how candidates were found. ranFrom: how much of the scope was checked (NFR-2).
const MODES = { verify: "the tool's list, verified by a caller search", full: "the tool's list plus a full search of our own", own: "a search of our own (no tool)" };
/** The Found by line, in the plural when several tools ran. */
const foundBy = (doc) => (Array.isArray(doc.tool) && doc.tool.length > 1 ? MODES[doc.mode].replace("the tool's list", "the tools' lists") : MODES[doc.mode]);
const RAN_FROM = ["complete", "narrowed", "stopped"];
const SOURCES = { tool: "tool", own: "own search", both: "both" };

/** The findings file, checked: { scope, mode, tool, ranFrom, findings, hidden, notChecked }. */
function readFindings(file) {
  const text = readText(path.resolve(file));
  if (text === null) fail(EXIT.NOT_FOUND, "findings-missing", `Cannot read ${file}.`, "Write the run's findings JSON to a file and pass it.");
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    fail(EXIT.INVALID, "findings-invalid", `${file} is not valid JSON (${err.message}).`, "Write the findings as JSON.");
  }
  const bad = (msg) => fail(EXIT.INVALID, "findings-invalid", `${file}: ${msg}`, "See --help for the findings file's fields.");
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) bad("expected an object with scope, mode, tool, ranFrom and findings.");
  if (!Array.isArray(doc.findings)) bad("findings must be an array.");
  const toolOk = doc.tool == null || typeof doc.tool === "string" || (Array.isArray(doc.tool) && doc.tool.every((t) => typeof t === "string"));
  if (!toolOk) bad("tool must be a tool id, a list of ids, or null.");
  if (!Object.hasOwn(MODES, doc.mode)) bad(`mode must be one of ${Object.keys(MODES).join(", ")}.`);
  // A report never calls a partial run complete: ranFrom is required.
  if (!RAN_FROM.includes(doc.ranFrom)) bad(`ranFrom must be one of ${RAN_FROM.join(", ")}.`);
  doc.findings.forEach((f, i) => {
    if (!f || typeof f !== "object" || !f.file) bad(`finding ${i + 1} has no file.`);
    if (!LABELS.some((l) => l.id === f.label)) bad(`finding ${i + 1} (${f.file}) has label "${f.label}"; use safe, check or warning.`);
  });
  return doc;
}

const textOf = (v) => (Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
const outcomeKey = (f) => (textOf(f.outcome).split(":")[0] || "no outcome").trim();

/** The report's Markdown. */
export function reportMarkdown(doc, date) {
  const scope = textOf(doc.scope) || ".";
  const findings = doc.findings;
  const count = (list, key) => {
    const counts = new Map();
    for (const f of list) counts.set(key(f), (counts.get(key(f)) || 0) + 1);
    return counts;
  };
  const byLabel = count(findings, (f) => f.label);
  const byOutcome = count(findings, outcomeKey);
  const hidden = Number.isInteger(doc.hidden) && doc.hidden > 0 ? doc.hidden : 0;
  const lines = [
    "# Dead Code report",
    "",
    `**Date:** ${date}`,
    "",
    "## Summary",
    "",
    `- **Scope:** ${scope === "." ? "the whole project" : `\`${scope}\``}`,
    Array.isArray(doc.tool) && doc.tool.length > 1 ? `- **Tools:** ${doc.tool.map(textOf).join(", ")}` : `- **Tool:** ${textOf(doc.tool) || "no tool"}`,
    `- **Found by:** ${foundBy(doc)}`,
    `- **Full search of our own:** ${doc.mode === "verify" ? "no" : "yes"}`,
    `- **Findings:** ${findings.length ? LABELS.map((l) => `${byLabel.get(l.id) || 0} ${l.title}`).join(", ") : "none"}`,
    `- **Outcomes:** ${byOutcome.size ? [...byOutcome].map(([k, n]) => `${n} ${k}`).join(", ") : "none"}`,
    `- **Hidden by the keep list:** ${hidden}`,
  ];
  for (const label of LABELS) {
    const group = findings.filter((f) => f.label === label.id);
    lines.push("", `## ${label.title}`, "");
    if (!group.length) {
      lines.push("None.");
      continue;
    }
    lines.push("| Item | Location | Source | Rule | Reason | Outcome |", "| --- | --- | --- | --- | --- | --- |");
    for (const f of group) {
      const item = textOf(f.name) || (f.kind === "file" ? "(whole file)" : "(unnamed)");
      const location = Number.isInteger(f.line) ? `${f.file}:${f.line}` : f.file;
      const reason = f.label === "warning" ? textOf(f.warningKind) || textOf(f.callers) : textOf(f.callers);
      lines.push(`| ${[item, location, SOURCES[f.source] || textOf(f.source), textOf(f.rule) || "-", reason || "-", textOf(f.outcome) || "-"].map((v) => cell(v) || "-").join(" | ")} |`);
    }
  }
  const notChecked = textOf(doc.notChecked);
  const closing = {
    complete: `This run was complete: every finding under ${scope === "." ? "the whole project" : `\`${scope}\``} was checked.`,
    narrowed: `This run was narrowed, not complete: only ${scope === "." ? "part of the project" : `\`${scope}\``} was checked.${notChecked ? ` Not checked: ${notChecked}.` : ""}`,
    stopped: `This run was stopped before it finished, not complete.${notChecked ? ` Not checked: ${notChecked}.` : ""}`,
  }[doc.ranFrom];
  lines.push("", "---", "", closing, "");
  return lines.join("\n");
}

function cmdReport(argv) {
  const [sub, ...rest] = argv;
  if (sub !== "write") fail(EXIT.USAGE, sub ? "unknown-report-command" : "missing-report-command", sub ? `Unknown report command "${sub}".` : "report needs a command.", "Run report write --findings <file>.");
  const args = parseArgs(rest, { booleans: ["dry-run", "replace"], values: ["root", "findings", "date"] });
  noPositionals(args, "report write");
  if (!args.findings) fail(EXIT.USAGE, "missing-findings", "report write needs --findings <file>.", "Write the run's findings JSON to a file and pass it.");
  if (args.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) fail(EXIT.USAGE, "bad-date", `--date "${args.date}" is not YYYY-MM-DD.`, "Pass a date like 2026-08-03, or leave --date out for today.");
  const root = projectRoot(args.root);
  const doc = readFindings(args.findings);
  const date = args.date || isoDate();
  const rel = `${REPORTS_REL}/DEAD-CODE-${date}.md`;
  const file = path.join(root, rel);
  if (fs.existsSync(file) && !args.replace) fail(EXIT.REFUSED, "report-exists", `${rel} already exists.`, "Ask the person whether to replace it, then pass --replace.", { path: rel });
  const text = reportMarkdown(doc, date);
  if (args["dry-run"]) return out({ ok: true, dryRun: true, path: rel, preview: text.split("\n").slice(0, 14) });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  out({ ok: true, path: rel });
}

/* ------------------------------------------------------------- gitignore */

const REPORTS_LINE = `${REPORTS_REL}/`;

/** git in root: { status, stdout }; status null when git could not start. */
const git = (root, ...args) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return { status: r.error ? null : r.status, stdout: r.stdout || "" };
};

/** Whether the reports folder is ignored: { isGit, hasGitignore, ignored, line, file }. */
function gitignoreState(root) {
  const isGit = git(root, "rev-parse", "--is-inside-work-tree").stdout.trim() === "true";
  const rootIgnore = readText(path.join(root, ".gitignore"));
  // The exact line: in the root .gitignore, or reports/ in the state folder's own .gitignore.
  const lineIn = (text, wanted) => (text === null ? null : text.split(/\r?\n/).find((l) => wanted.includes(l.trim().replace(/^\//, "").replace(/\/?$/, "/"))) || null);
  let line = lineIn(rootIgnore, [REPORTS_LINE]);
  let file = line ? ".gitignore" : null;
  if (!line) {
    line = lineIn(readText(path.join(root, STATE_DIR, ".gitignore")), ["reports/"]);
    if (line) file = `${STATE_DIR}/.gitignore`;
  }
  // Any other rule that covers the folder (a wider pattern) counts too.
  const checked = isGit && git(root, "check-ignore", "-q", REPORTS_LINE).status === 0;
  return { isGit, hasGitignore: rootIgnore !== null, ignored: Boolean(line) || checked, line: line ? line.trim() : null, file };
}

function cmdGitignoreCheck(argv) {
  const args = parseArgs(argv, { values: ["root"] });
  noPositionals(args, "gitignore-check");
  out({ ok: true, ...gitignoreState(projectRoot(args.root)) });
}

/** Append the reports line to the root .gitignore for the first-use offer; never touches other lines. */
function cmdGitignoreAdd(argv) {
  const args = parseArgs(argv, { booleans: ["dry-run"], values: ["root"] });
  noPositionals(args, "gitignore-add");
  const root = projectRoot(args.root);
  const state = gitignoreState(root);
  if (!state.isGit) fail(EXIT.REFUSED, "not-git", `${slash(root)} is not a git repository.`, "Skip the .gitignore offer: nothing here is committed.");
  if (state.ignored) return out({ ok: true, added: false, already: true, line: state.line, file: state.file });
  const file = path.join(root, ".gitignore");
  const current = readText(file);
  const nl = current === null ? "\n" : eol(current);
  const text = current === null || current === "" ? `${REPORTS_LINE}${nl}` : `${current}${/\r?\n$/.test(current) ? "" : nl}${REPORTS_LINE}${nl}`;
  if (args["dry-run"]) return out({ ok: true, dryRun: true, added: true, line: REPORTS_LINE, file: ".gitignore", created: current === null });
  fs.writeFileSync(file, text);
  out({ ok: true, added: true, line: REPORTS_LINE, file: ".gitignore", created: current === null });
}

const COMMANDS = {
  detect: cmdDetect,
  run: cmdRun,
  narrow: cmdNarrow,
  keep: cmdKeep,
  backup: cmdBackup,
  restore: cmdRestore,
  report: cmdReport,
  "gitignore-check": cmdGitignoreCheck,
  "gitignore-add": cmdGitignoreAdd,
};

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command) fail(EXIT.USAGE, "missing-command", "Name a command.", `One of: ${Object.keys(COMMANDS).join(", ")}. Run with --help for usage.`);
  const handler = COMMANDS[command];
  if (!handler) fail(EXIT.USAGE, "unknown-command", `Unknown command "${command}".`, `One of: ${Object.keys(COMMANDS).join(", ")}. Run with --help for usage.`);
  await handler(rest);
}

// Run as a script; imported (the tests import the readers), do nothing.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
