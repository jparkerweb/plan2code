// Web console tests, the shape of the source: no console file grows past
// 3,000 lines, and the files lib.mjs split into stand on their own.
// Run with: node --test scripts/test-web-console-shape.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT } from "./web-console-test-helpers.mjs";

const CONSOLE_DIR = path.join(ROOT, "src", "web-console");
const MAX_LINES = 3000;

// Every .mjs, .js and .css file under `dir` (vendored code aside), as paths
// relative to it with forward slashes.
function sourceFiles(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (p !== "public/vendor") out.push(...sourceFiles(dir, p));
    } else if (/\.(mjs|js|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

// A file's line count, as `wc -l` gives it for a file ending in a newline.
function lineCount(text) {
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

// The lines that name each file over the limit.
function oversized(dir) {
  return sourceFiles(dir)
    .map((p) => [p, lineCount(fs.readFileSync(path.join(dir, p), "utf8"))])
    .filter(([p, n]) => n > MAX_LINES)
    .map(([p, n]) => `${p} is ${n} lines, over the ${MAX_LINES}-line limit: split it by job`);
}

test("shape: no console file is over 3,000 lines", () => {
  assert.deepEqual(oversized(CONSOLE_DIR), []);
});

test("shape: the size check names the file that is too big", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-shape-"));
  try {
    fs.mkdirSync(path.join(dir, "public", "vendor"), { recursive: true });
    fs.writeFileSync(path.join(dir, "big.mjs"), "x\n".repeat(MAX_LINES + 1));
    fs.writeFileSync(path.join(dir, "edge.css"), "x\n".repeat(MAX_LINES));
    fs.writeFileSync(path.join(dir, "small.js"), "x\n");
    fs.writeFileSync(path.join(dir, "public", "vendor", "huge.js"), "x\n".repeat(MAX_LINES * 2));
    assert.deepEqual(oversized(dir), [`big.mjs is ${MAX_LINES + 1} lines, over the ${MAX_LINES}-line limit: split it by job`]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("shape: files.mjs still finds the console's own folder", async () => {
  const { HERE, PUBLIC_DIR } = await import("../src/web-console/files.mjs");
  assert.equal(path.basename(HERE), "web-console");
  assert.equal(PUBLIC_DIR, path.join(HERE, "public"));
});

test("shape: lib.mjs is gone, and every file it split into is there", () => {
  assert.equal(fs.existsSync(path.join(CONSOLE_DIR, "lib.mjs")), false, "src/web-console/lib.mjs still exists");
  for (const f of SPLIT_FILES) {
    const text = fs.readFileSync(path.join(CONSOLE_DIR, f), "utf8");
    assert.match(text, /^\/\/ Plan2Code Web Console - \S.*\.\n/, `${f} opens with a one-line job comment`);
  }
});

// Every page file but the entry (app.js) only defines things, so each one
// loads under plain Node with no page around it. Imported alone in a fresh
// process: one that reaches for `document` or `window` at load, or runs
// anything else that throws, is named with its first error line. One that
// starts a timer or a listener throws nothing but never exits: it is named too.
const LOAD_TIMEOUT_MS = 5000;
function pageLoadFailures(pub) {
  return sourceFiles(pub)
    .filter((p) => p.endsWith(".js") && p !== "app.js" && (!p.includes("/") || p.startsWith("screens/")))
    .flatMap((p) => {
      const url = pathToFileURL(path.join(pub, p)).href;
      const r = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(url)});`], {
        encoding: "utf8",
        timeout: LOAD_TIMEOUT_MS,
      });
      if (r.error && r.error.code === "ETIMEDOUT") return [`${p} does not load on its own: still running after load (a timer or listener started at module scope)`];
      if (r.status === 0) return [];
      const line = r.stderr.split("\n").find((l) => /Error/.test(l)) || r.stderr.trim().split("\n")[0];
      return [`${p} does not load on its own: ${line.trim()}`];
    });
}

test("shape: every page file but app.js only defines things, and loads under plain Node", () => {
  assert.deepEqual(pageLoadFailures(path.join(CONSOLE_DIR, "public")), []);
});

test("shape: the define-only check names a page file that touches the page at load", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-define-only-"));
  try {
    fs.mkdirSync(path.join(dir, "screens"));
    fs.mkdirSync(path.join(dir, "vendor"));
    fs.writeFileSync(path.join(dir, "package.json"), '{ "type": "module" }\n');
    fs.writeFileSync(path.join(dir, "app.js"), "document.title = 'the entry may';\n");
    fs.writeFileSync(path.join(dir, "fine.js"), "export const title = () => document.title;\n");
    fs.writeFileSync(path.join(dir, "screens", "eager.js"), "export const title = document.title;\n");
    fs.writeFileSync(path.join(dir, "screens", "ticks.js"), "setInterval(() => {}, 1000);\n");
    fs.writeFileSync(path.join(dir, "vendor", "lib.js"), "window.x = 1;\n");
    const failures = pageLoadFailures(dir);
    assert.equal(failures.length, 2, failures.join("\n"));
    assert.match(failures.find((f) => f.startsWith("screens/eager.js")), /does not load on its own: ReferenceError: document is not defined/);
    assert.match(failures.find((f) => f.startsWith("screens/ticks.js")), /does not load on its own: still running after load/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A screen reaches the rest of the page through ../state.js and the pure
// modules beside it, never through another screen: only core.js (the render
// loop, which draws every screen) imports screens, and only app.js (the
// entry) imports core.js. Each import that breaks that is named.
function pageImportProblems(pub) {
  const problems = [];
  for (const p of sourceFiles(pub).filter((f) => f.endsWith(".js") && (!f.includes("/") || f.startsWith("screens/")))) {
    const text = fs.readFileSync(path.join(pub, p), "utf8");
    for (const m of text.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm)) {
      const spec = m[1] || m[2] || m[3];
      if (!spec.startsWith(".")) continue;
      const target = path.posix.join(path.posix.dirname(p), spec);
      if (target === "screens/core.js" && p !== "app.js") problems.push(`${p} imports ${spec}: only app.js imports core.js`);
      else if (p.startsWith("screens/") && p !== "screens/core.js" && target.startsWith("screens/"))
        problems.push(`${p} imports ${spec}: a screen imports ../state.js and the modules beside it, never another screen`);
    }
  }
  return problems;
}

test("shape: a screen never imports another screen, and only app.js imports core.js", () => {
  assert.deepEqual(pageImportProblems(path.join(CONSOLE_DIR, "public")), []);
});

test("shape: the import check names a screen that imports another, and any file but app.js importing core.js", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-imports-"));
  try {
    fs.mkdirSync(path.join(dir, "screens"));
    const put = (rel, text) => fs.writeFileSync(path.join(dir, rel), text);
    put("app.js", 'import { render } from "./screens/core.js";\n');
    put("state.js", "export const page = {};\n");
    put("render.js", "export const el = () => null;\n");
    put("screens/core.js", 'import { a } from "./a.js";\nimport { page } from "../state.js";\n');
    put("screens/a.js", 'import { b } from "./b.js";\nimport { page } from "../state.js";\nimport { el } from "../render.js";\n');
    put("screens/b.js", 'import { page } from "../state.js";\n');
    put("screens/c.js", 'import { render } from "./core.js";\n');
    put("helper.js", 'import { render } from "./screens/core.js";\n');
    put("screens/d.js", 'import "./b.js";\n');
    assert.deepEqual(pageImportProblems(dir).sort(), [
      "helper.js imports ./screens/core.js: only app.js imports core.js",
      "screens/a.js imports ./b.js: a screen imports ../state.js and the modules beside it, never another screen",
      "screens/c.js imports ./core.js: only app.js imports core.js",
      "screens/d.js imports ./b.js: a screen imports ../state.js and the modules beside it, never another screen",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The page's CSP refuses style attributes, so one set from script is dropped
// on the floor in the browser. Every page module, wherever a split moves the
// code that draws.
test("shape: no page module sets a style attribute from script", () => {
  const pub = path.join(CONSOLE_DIR, "public");
  const offenders = sourceFiles(pub)
    .filter((p) => p.endsWith(".js"))
    .filter((p) => /setAttribute\(\s*["']style["']/.test(fs.readFileSync(path.join(pub, p), "utf8")));
  assert.deepEqual(offenders, []);
});

// Every URL the server's old `if` chain matched, in its order, so a route lost
// or moved in routes.mjs fails here by name: several match by prefix, and the
// token gate sits after the first two. SERVABLE stands for the page's own files
// and WORKSPACE_EDITS for /workspace/add, /edit and /remove. The git board has
// no routes of its own: its buttons are sends (`__git`), through /submit.
const ROUTE_ORDER = [
  "/health", "/s/", "/", "SERVABLE", "/overview", "/handoff", "/version", "/state", "/events", "/draft",
  "/looks", "/looks", "/subagents", "/pr-host", "/models", "/models", "/cleanup", "/upload",
  "/notepad", "/notepad/text", "/notepad/image", "/notepad/thumb", "/notepad/image/delete", "/notepad/tab",
  "/notepad/tab/rename", "/notepad/tab/delete", "/notepad/tab/order", "/notepad/tab/last", "/notepad/images/",
  "/attachments/", "/shots/", "/uploads/", "/submit", "/chat", "/chat/decision", "/workspace",
  "WORKSPACE_EDITS", "/workspace/scope", "/workspace/browse", "/cancel", "/ping", "/bye",
];

test("shape: routes.mjs lists every URL the server answers, in order", () => {
  const routes = fs.readFileSync(path.join(CONSOLE_DIR, "routes.mjs"), "utf8");
  const start = routes.indexOf("const ROUTES = [");
  const list = routes.slice(start, routes.indexOf("\n];", start));
  const entries = list
    .split("\n")
    .filter((line) => /^\s*\{/.test(line))
    .map((line) => (line.match(/path: "([^"]*)"|startsWith\("([^"]*)"\)|\b(SERVABLE|WORKSPACE_EDITS)\b/) || []).slice(1).find(Boolean));
  assert.deepEqual(entries, ROUTE_ORDER);
  const edits = routes.match(/const WORKSPACE_EDITS = \{([^}]*)\}/)[1];
  for (const p of ["/workspace/add", "/workspace/edit", "/workspace/remove"]) assert.ok(edits.includes(`"${p}"`), `${p} is a workspace edit`);
});

// Each file split out of lib.mjs, imported first and alone in a fresh
// process: a module-scope read of a value from a file still loading (an
// import cycle) throws here, naming the file, before it reaches a real run.
const SPLIT_FILES = ["files.mjs", "sessions.mjs", "scan.mjs", "patches.mjs", "inbox.mjs", "workspace.mjs", "settings.mjs"];

test("shape: every file split out of lib.mjs loads first and alone", () => {
  for (const f of SPLIT_FILES) {
    const url = pathToFileURL(path.join(CONSOLE_DIR, f)).href;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(url)});`], { encoding: "utf8" });
    assert.equal(r.status, 0, `${f} does not load on its own: ${r.stderr.trim().split("\n").find((l) => /Error/.test(l)) || r.stderr}`);
  }
});

// app.js is the entry and nothing else, so no test may read it as text: what a
// screen does is tested by driving the page, and what a screen file holds is
// read from that screen. A statement that both reads a file and names app.js
// is a read (a fetch of /app.js, or a fixture file called app.js, is not).
const SCRIPTS_DIR = path.join(ROOT, "scripts");

// parse-check.mjs only parses the entry, so it may name it.
const MAY_NAME_APP_JS = new Set(["parse-check.mjs"]);

// One statement that reads and names app.js, or a read helper handed it
// (`web("app.js")`, `publicSource("public/app.js")`), or a path to it
// under public/, in any file that also reads files.
function appJsReaders(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mjs") && f !== "test-web-console-shape.mjs" && !MAY_NAME_APP_JS.has(f))
    .filter((f) => {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      // A bare readFileSync/readFile only counts against the web console's
      // own public/app.js, named somewhere in the same statement: otherwise
      // this would also catch a test reading some other app.js entirely,
      // such as plan2code-app/ui/app.js (the desktop app's, a different file
      // with its own shape rules in its own test). publicSource() implies
      // the public dir by its own name, so any app.js it is handed counts.
      const oneStatement = text
        .split(";")
        .some(
          (statement) =>
            /["'/]app\.js["']/.test(statement) &&
            (/\bpublicSource\s*\(/.test(statement) || (/\b(readFileSync|readFile)\s*\(/.test(statement) && /\bpublic\b/.test(statement)))
        );
      const handedToAHelper = /\w\(\s*["'](?:(?:src\/web-console\/)?public\/)?app\.js["']\s*\)/.test(text);
      const publicPath = /["']public["']\s*,\s*["']app\.js["']|\bpublic\/app\.js/.test(text) && /\breadFile(Sync)?\b/.test(text);
      return oneStatement || handedToAHelper || publicPath;
    })
    .map((f) => `${f} reads public/app.js as text: test the behaviour in a page test, or read the screen file that holds it`);
}

test("shape: no test in scripts/ reads public/app.js as text", () => {
  assert.deepEqual(appJsReaders(SCRIPTS_DIR), []);
});

test("shape: the app.js check names the test file that reads it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-shape-"));
  try {
    fs.writeFileSync(path.join(dir, "test-fine.mjs"), 'const r = await fetch(base + "/app.js");\nfs.appendFileSync(path.join(d, "src", "app.js"), "x");\n');
    assert.deepEqual(appJsReaders(dir), []);
    fs.writeFileSync(path.join(dir, "test-reads-it.mjs"), 'const app = fs.readFileSync(path.join(ROOT, "public", "app.js"), "utf8");\n');
    assert.deepEqual(appJsReaders(dir), ["test-reads-it.mjs reads public/app.js as text: test the behaviour in a page test, or read the screen file that holds it"]);
    fs.rmSync(path.join(dir, "test-reads-it.mjs"));
    fs.writeFileSync(path.join(dir, "test-alias.mjs"), 'const web = (f) => fs.readFileSync(path.join(ROOT, "public", f), "utf8");\nconst app = web("app.js");\n');
    assert.deepEqual(appJsReaders(dir), ["test-alias.mjs reads public/app.js as text: test the behaviour in a page test, or read the screen file that holds it"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The stylesheet is many files under public/styles/, joined by the server into
// the one /app.css the page asks for. CSS_ORDER is the one place the cascade
// order is stated: every file in it exists, each once, and no file in the folder
// is left out of it or served on its own.
test("shape: CSS_ORDER names every file in public/styles/ once, and none is served on its own", async () => {
  const { CSS_ORDER, SERVABLE } = await import("../src/web-console/static.mjs");
  const dir = path.join(CONSOLE_DIR, "public", "styles");
  assert.ok(CSS_ORDER.length > 0, "CSS_ORDER lists files");
  assert.equal(new Set(CSS_ORDER).size, CSS_ORDER.length, "no file is listed twice");
  for (const f of CSS_ORDER) assert.ok(fs.existsSync(path.join(dir, f)), `CSS_ORDER lists ${f}, which is not in public/styles/`);
  const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith(".css")).sort();
  assert.deepEqual([...CSS_ORDER].sort(), onDisk, "public/styles/ holds exactly the files CSS_ORDER lists");
  for (const rel of SERVABLE) assert.ok(!rel.startsWith("styles/") && !CSS_ORDER.includes(rel), `${rel} must not be served on its own`);
});

// The files table in AGENTS-architecture.md gives every console file a row,
// so a contributor finds where a job lives without searching. A row's first
// cell names the file by its path under src/web-console/ (backticked; one cell
// may name several files, joined by "·").
const ARCHITECTURE_DOC = path.join(ROOT, ".agents-docs", "AGENTS-architecture.md");

// The paths the files table names, from the first cell of each table row.
function tableFiles(markdown) {
  const named = new Set();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cell = line.split("|")[1] || "";
    for (const m of cell.matchAll(/`([^`]+)`/g)) named.add(m[1]);
  }
  return named;
}

// One line per console file with no row in the table.
function undocumented(dir, markdown) {
  const named = tableFiles(markdown);
  return sourceFiles(dir)
    .filter((p) => !named.has(p))
    .map((p) => `${p} has no row in the files table of AGENTS-architecture.md: add one with its one-line job`);
}

test("shape: every console file has a row in the files table of AGENTS-architecture.md", () => {
  const problems = undocumented(CONSOLE_DIR, fs.readFileSync(ARCHITECTURE_DOC, "utf8"));
  assert.deepEqual(problems, []);
});

test("shape: the docs-table check names a file with no row, and passes one that has it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-docs-table-"));
  try {
    fs.mkdirSync(path.join(dir, "public"));
    fs.writeFileSync(path.join(dir, "a.mjs"), "");
    fs.writeFileSync(path.join(dir, "public", "b.js"), "");
    const table = "| File | Role |\n|---|---|\n| `a.mjs` | the first |\n";
    assert.deepEqual(undocumented(dir, table), [
      "public/b.js has no row in the files table of AGENTS-architecture.md: add one with its one-line job",
    ]);
    assert.deepEqual(undocumented(dir, `${table}| \`public/b.js\` · \`x.js\` | the second |\n`), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
