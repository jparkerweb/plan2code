// Tests for plan2code-dead-code's scripts/dead-code.mjs: detection, running a
// tool, the output readers, narrow, the keep list, backup and restore, the
// saved report and the .gitignore check. See skill-script-helpers.mjs for how
// these run. No real dead-code tool is ever called: tools are stub files on a
// temp PATH, so the suite passes on a machine with none installed.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, SKILLS, runScript, tmp, write, read, gitInit, copyFixture, fixtureCleanup } from "./skill-script-helpers.mjs";

after(fixtureCleanup);

// The script runs from the built skill, beside the shared scripts it imports
// (skill-script-helpers.mjs rebuilds skills/ when this file loads it).
const SCRIPT = path.join(SKILLS, "plan2code-dead-code", "scripts", "dead-code.mjs");

const dc = await import(pathToFileURL(SCRIPT).href);
const FIXTURES = path.join(ROOT, "scripts", "fixtures", "dead-code");
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

// An empty folder as the whole PATH, so binaries installed on this machine
// never change what detect sees. pathDir replaces it with a folder of stubs.
const EMPTY_PATH = tmp("dead-code-empty-path");

/** Env additions that set PATH to exactly `dir`: every case variant of the key this process has is overridden, so the scrubbed copy keeps none of the machine's own. */
function withPath(dir, extra = {}) {
  const env = { ...extra };
  for (const key of Object.keys(process.env)) if (/^path$/i.test(key)) env[key] = dir;
  env.PATH = dir;
  return env;
}

/** dead-code.mjs from the built skill; `pathDir` makes that folder the whole PATH. */
function runDeadCode(args, { cwd, env, pathDir, input } = {}) {
  return runScript("plan2code-dead-code", "dead-code.mjs", args, { cwd, input, env: pathDir ? withPath(pathDir, env) : env });
}

/* ------------------------------------------------------------------ help */

test("dead-code --help names every command and every exit code", () => {
  const r = runDeadCode(["--help"]);
  assert.equal(r.code, 0, r.stderr);
  for (const command of ["detect", "run", "narrow", "keep", "backup", "restore", "report", "gitignore-check", "gitignore-add"]) {
    assert.match(r.stdout, new RegExp(`dead-code\\.mjs ${command}\\b`), command);
  }
  for (const exit of ["0 ok", "1 crash", "2 bad arguments", "3 not found", "4 invalid", "5 refused"]) assert.ok(r.stdout.includes(exit), exit);
  assert.match(r.stdout, /--dry-run/);
  assert.match(r.stdout, /PLAN2CODE_NOW/);
});

test("dead-code: an unknown command and a missing one exit 2", () => {
  const unknown = runDeadCode(["sweep"]);
  assert.equal(unknown.code, 2);
  assert.equal(unknown.json.error, "unknown-command");
  const missing = runDeadCode([]);
  assert.equal(missing.code, 2);
  assert.equal(missing.json.error, "missing-command");
});

/* ---------------------------------------------------------------- detect */

/** A tool stub on a stub PATH: a node script, wrapped so the shell finds it by name. */
function stub(dir, name, body) {
  const js = path.join(dir, `${name}-stub.mjs`);
  fs.writeFileSync(js, body);
  if (process.platform === "win32") {
    fs.writeFileSync(path.join(dir, `${name}.cmd`), `@"${process.execPath}" "${js}" %*\r\n@exit /b %errorlevel%\r\n`);
  } else {
    const sh = path.join(dir, name);
    fs.writeFileSync(sh, `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`);
    fs.chmodSync(sh, 0o755);
  }
}

/** A stub that prints a fixture and exits with `code`. */
const printing = (dir, name, fixtureName, code) =>
  stub(dir, name, `import fs from "node:fs";\nprocess.stdout.write(fs.readFileSync(${JSON.stringify(path.join(FIXTURES, fixtureName))}, "utf8"));\nprocess.exitCode = ${code};\n`);

test("detect: counts source files by language group and skips build and vendor folders", () => {
  const dir = tmp("dc-langs");
  for (const f of ["src/a.ts", "src/b.jsx", "app/c.py", "lib/d.rs", "e.go", "F.java", "g.kt", "h.cs", "i.rb", "j.php", "README.md"]) write(dir, f, "x\n");
  for (const f of ["node_modules/x/y.js", "dist/z.js", "vendor/v.php", ".venv/v.py", "target/t.rs", "specs/s.js", "specs--completed/s.js", "bin/b.cs", "obj/o.cs"]) write(dir, f, "x\n");
  const r = runDeadCode(["detect", "--root", dir], { pathDir: EMPTY_PATH });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.languages, [
    { id: "javascript", files: 2 },
    { id: "python", files: 1 },
    { id: "rust", files: 1 },
    { id: "go", files: 1 },
    { id: "java", files: 2 },
    { id: "csharp", files: 1 },
    { id: "ruby", files: 1 },
    { id: "php", files: 1 },
  ]);
  assert.equal(r.json.sourceFiles, 10);
  assert.equal(r.json.scope, ".");
  assert.equal(r.json.limit, 1500);
  assert.equal(r.json.overLimit, false);
  assert.deepEqual(r.json.tools, []);
});

test("detect: overLimit is true past --limit, and --scope counts only that folder", () => {
  const dir = tmp("dc-limit");
  for (const f of ["src/a.js", "src/b.js", "src/c.js", "src/d.js", "other/e.js"]) write(dir, f, "x\n");
  const scoped = runDeadCode(["detect", "--root", dir, "--scope", "src", "--limit", "3"], { pathDir: EMPTY_PATH });
  assert.equal(scoped.code, 0, scoped.stderr);
  assert.equal(scoped.json.scope, "src");
  assert.equal(scoped.json.sourceFiles, 4);
  assert.equal(scoped.json.overLimit, true);
  assert.equal(scoped.json.limit, 3);
  const under = runDeadCode(["detect", "--root", dir, "--scope", "src", "--limit", "4"], { pathDir: EMPTY_PATH });
  assert.equal(under.json.overLimit, false);
  assert.equal(runDeadCode(["detect", "--root", dir, "--limit", "0"]).code, 2);
});

test("detect: a --scope outside the root, or not a folder, exits 3", () => {
  const dir = tmp("dc-scope");
  write(dir, "src/a.js", "x\n");
  for (const scope of ["..", "../elsewhere", "missing", "src/a.js"]) {
    const r = runDeadCode(["detect", "--root", dir, "--scope", scope], { pathDir: EMPTY_PATH });
    assert.equal(r.code, 3, scope);
    assert.equal(r.json.error, "scope-not-found", scope);
  }
});

const MARKERS = [
  ["knip", { "knip.json": "{}" }, "knip.json", "knip-json"],
  ["knip", { "package.json": '{"devDependencies":{"knip":"^6.0.0"}}' }, "package.json devDependencies", "knip-json"],
  ["knip", { "package.json": '{"knip":{"entry":["src/main.ts"]}}' }, "package.json knip key", "knip-json"],
  ["vulture", { "pyproject.toml": "[project]\nname = 'x'\n\n[tool.vulture]\nmin_confidence = 80\n" }, "pyproject.toml [tool.vulture]", "vulture"],
  ["vulture", { "requirements-dev.txt": "pytest\nvulture==2.14\n" }, "requirements-dev.txt", "vulture"],
  ["cargo-check", { "Cargo.toml": "[package]\nname = 'x'\n" }, "Cargo.toml", "cargo-json"],
  ["pmd", { "pom.xml": "<plugin><artifactId>maven-pmd-plugin</artifactId></plugin>" }, "pom.xml maven-pmd-plugin", "sarif"],
  ["pmd", { "build.gradle": "plugins {\n  id 'pmd'\n}\n" }, "Gradle pmd plugin", "sarif"],
  ["pmd", { "config/pmd/ruleset.xml": "<ruleset/>" }, "config/pmd/ruleset.xml", "sarif"],
  ["spotbugs", { "build.gradle.kts": 'plugins { id("com.github.spotbugs") version "6.0.0" }\n' }, "build.gradle.kts spotbugs plugin", "sarif"],
  ["detekt", { "detekt.yml": "style:\n" }, "detekt.yml", "sarif"],
  ["psalm", { "psalm.xml": "<psalm/>" }, "psalm.xml", "sarif"],
  ["psalm", { "composer.json": '{"require-dev":{"vimeo/psalm":"^7"}}' }, "composer.json vimeo/psalm", "sarif"],
  ["rubocop", { ".rubocop.yml": "AllCops:\n" }, ".rubocop.yml", "agent"],
  ["debride", { Gemfile: "source 'https://rubygems.org'\ngem 'debride'\n" }, "Gemfile debride", "agent"],
  ["phpstan", { "phpstan.neon.dist": "parameters:\n" }, "phpstan.neon.dist", "agent"],
  ["error-prone", { "pom.xml": "<path><artifactId>error_prone_core</artifactId></path>" }, "pom.xml Error Prone", "agent"],
  ["java-compile", { "build.gradle": "apply plugin: 'java'\n" }, "build.gradle", "agent"],
  ["dotnet-build", { "App.csproj": "<Project/>" }, "App.csproj", "agent"],
];

test("detect: finds each tool by its own marker, never running or installing it", () => {
  for (const [id, files, marker, format] of MARKERS) {
    const dir = tmp(`dc-marker-${id}`);
    for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
    const r = runDeadCode(["detect", "--root", dir], { pathDir: EMPTY_PATH });
    assert.equal(r.code, 0, r.stderr);
    const found = r.json.tools.find((t) => t.id === id);
    assert.ok(found, `${id} from ${Object.keys(files).join(", ")}: got ${JSON.stringify(r.json.tools)}`);
    assert.equal(found.marker, marker, id);
    assert.equal(found.format, format, id);
    assert.equal(found.available, false, `${id} has no binary on the empty PATH`);
    assert.equal(typeof found.command, "string");
  }
});

test("detect: knip without node_modules/.bin/knip is unavailable, and its command never installs", () => {
  const dir = tmp("dc-knip");
  write(dir, "package.json", '{"devDependencies":{"knip":"^6.0.0"}}');
  const missing = runDeadCode(["detect", "--root", dir], { pathDir: EMPTY_PATH }).json.tools.find((t) => t.id === "knip");
  assert.equal(missing.available, false);
  assert.equal(missing.command, "npx --no-install knip --reporter json");
  write(dir, "node_modules/.bin/knip", "");
  const present = runDeadCode(["detect", "--root", dir], { pathDir: EMPTY_PATH }).json.tools.find((t) => t.id === "knip");
  assert.equal(present.available, true);
});

test("detect: tools found only on PATH, and Go deadcode only with go.mod and the binary", () => {
  const dir = tmp("dc-path");
  write(dir, "go.mod", "module x\n");
  write(dir, "main.go", "package main\n");
  assert.deepEqual(runDeadCode(["detect", "--root", dir], { pathDir: EMPTY_PATH }).json.tools, [], "no deadcode binary, no tool");
  const bin = tmp("dc-path-bin");
  stub(bin, "deadcode", "");
  stub(bin, "vulture", "");
  const r = runDeadCode(["detect", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(
    r.json.tools.map((t) => [t.id, t.marker, t.available]),
    [
      ["vulture", "vulture on PATH", true],
      ["go-deadcode", "go.mod and deadcode on PATH", true],
    ]
  );
});

test("detect: a SARIF tool's command shows a placeholder for the report file", () => {
  const dir = tmp("dc-sarif-cmd");
  write(dir, "psalm.xml", "<psalm/>");
  write(dir, "detekt.yml", "style:\n");
  const tools = runDeadCode(["detect", "--root", dir], { pathDir: EMPTY_PATH }).json.tools;
  assert.equal(tools.find((t) => t.id === "detekt").command, "detekt --input . --config detekt.yml --report sarif:<report.sarif>");
  assert.equal(tools.find((t) => t.id === "psalm").command, "psalm --find-unused-code --report=<report.sarif.json> .");
});

/* ------------------------------------------------------------------- run */

test("run: a vulture stub's exit 3 is findings, not a failure, and --scope filters the result", () => {
  const dir = tmp("dc-run-vulture");
  write(dir, "pyproject.toml", "[tool.vulture]\n");
  write(dir, "app/models.py", "import os\n");
  write(dir, "other/x.py", "\n");
  const bin = tmp("dc-run-vulture-bin");
  printing(bin, "vulture", "vulture.txt", 3);
  const r = runDeadCode(["run", "--tool", "vulture", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.json.tool, "vulture");
  assert.equal(r.json.format, "vulture");
  assert.equal(r.json.exit, 3);
  assert.equal(r.json.unparsed, false);
  assert.equal(r.json.skipped, 1);
  assert.equal(r.json.candidates.length, 4);
  assert.ok(r.json.tail.includes("this line is mangled"));
  assert.equal(typeof r.json.seconds, "number");

  const app = runDeadCode(["run", "--tool", "vulture", "--root", dir, "--scope", "app"], { pathDir: bin });
  assert.equal(app.code, 0, app.stderr);
  assert.equal(app.json.scope, "app");
  assert.equal(app.json.candidates.length, 4);
  const other = runDeadCode(["run", "--tool", "vulture", "--root", dir, "--scope", "other"], { pathDir: bin });
  assert.equal(other.code, 0, other.stderr);
  assert.deepEqual(other.json.candidates, []);
});

test("run: an exit the tool does not use for findings is a failure (exit 4) with the tail", () => {
  const dir = tmp("dc-run-fail");
  write(dir, "pyproject.toml", "[tool.vulture]\n");
  const bin = tmp("dc-run-fail-bin");
  stub(bin, "vulture", 'console.error("vulture: bad config");\nprocess.exitCode = 1;\n');
  const r = runDeadCode(["run", "--tool", "vulture", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 4);
  assert.equal(r.json.error, "tool-failed");
  assert.equal(r.json.exit, 1);
  assert.deepEqual(r.json.tail, ["vulture: bad config"]);
});

test("run: a timeout stops the tool and exits 4", () => {
  const dir = tmp("dc-run-timeout");
  write(dir, "pyproject.toml", "[tool.vulture]\n");
  const bin = tmp("dc-run-timeout-bin");
  stub(bin, "vulture", "setTimeout(() => {}, 20000);\n");
  const r = runDeadCode(["run", "--tool", "vulture", "--root", dir, "--timeout", "1"], { pathDir: bin });
  assert.equal(r.code, 4, r.stdout);
  assert.equal(r.json.error, "tool-timeout");
});

test("run: an unknown id exits 2; a tool not set up, or set up with no binary, exits 3", () => {
  const dir = tmp("dc-run-missing");
  write(dir, "pyproject.toml", "[tool.vulture]\n");
  assert.equal(runDeadCode(["run", "--tool", "sweeper", "--root", dir], { pathDir: EMPTY_PATH }).code, 2);
  assert.equal(runDeadCode(["run", "--root", dir], { pathDir: EMPTY_PATH }).code, 2);
  const notSetUp = runDeadCode(["run", "--tool", "knip", "--root", dir], { pathDir: EMPTY_PATH });
  assert.equal(notSetUp.code, 3);
  assert.equal(notSetUp.json.error, "tool-not-detected");
  const noBinary = runDeadCode(["run", "--tool", "vulture", "--root", dir], { pathDir: EMPTY_PATH });
  assert.equal(noBinary.code, 3);
  assert.equal(noBinary.json.error, "tool-unavailable");
});

test("run: a SARIF tool writes its report to a temp file the script reads back", () => {
  const dir = tmp("dc-run-pmd");
  write(dir, "pom.xml", "<plugin><artifactId>maven-pmd-plugin</artifactId></plugin>");
  const bin = tmp("dc-run-pmd-bin");
  // PMD exits 4 when it finds violations.
  stub(
    bin,
    "pmd",
    `import fs from "node:fs";\nconst a = process.argv.slice(2);\nfs.copyFileSync(${JSON.stringify(path.join(FIXTURES, "pmd.sarif"))}, a[a.indexOf("-r") + 1]);\nprocess.exitCode = 4;\n`
  );
  const r = runDeadCode(["run", "--tool", "pmd", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.json.format, "sarif");
  assert.equal(r.json.exit, 4);
  assert.equal(r.json.unparsed, false);
  assert.deepEqual(
    r.json.candidates.map((c) => [c.file, c.line, c.rule]),
    [
      ["src/main/java/app/Service.java", 42, "UnusedPrivateMethod"],
      ["src/main/java/app/Store.java", 7, "UnusedPrivateField"],
      ["src/main/java/app/Util.java", 3, "UseUtilityClass"],
    ]
  );
  // PMD's exit 5 (a file it could not parse) still writes the report.
  fs.writeFileSync(path.join(bin, "pmd-stub.mjs"), fs.readFileSync(path.join(bin, "pmd-stub.mjs"), "utf8").replace("process.exitCode = 4", "process.exitCode = 5"));
  const recoverable = runDeadCode(["run", "--tool", "pmd", "--root", dir], { pathDir: bin });
  assert.equal(recoverable.code, 0, recoverable.stderr + recoverable.stdout);
  assert.equal(recoverable.json.exit, 5);
  assert.equal(recoverable.json.candidates.length, 3);
});

test("detect: PMD runs only its unused-code rules, whatever ruleset the project keeps", () => {
  const dir = tmp("dc-pmd-rules");
  write(dir, "pmd-ruleset.xml", "<ruleset/>");
  const pmd = runDeadCode(["detect", "--root", dir], { pathDir: EMPTY_PATH }).json.tools.find((t) => t.id === "pmd");
  assert.equal(pmd.marker, "pmd-ruleset.xml");
  const rules = ["UnusedPrivateMethod", "UnusedPrivateField", "UnusedLocalVariable", "UnusedFormalParameter", "UnusedAssignment"].map((r) => `category/java/bestpractices.xml/${r}`).join(",");
  assert.equal(pmd.command, `pmd check -d . -R ${rules} -f sarif -r <report.sarif>`);
});

test("run: Knip's exit 1 is findings, read from its JSON report", () => {
  const dir = tmp("dc-run-knip");
  write(dir, "package.json", '{"devDependencies":{"knip":"^6.0.0"}}');
  write(dir, "node_modules/.bin/knip", "");
  const bin = tmp("dc-run-knip-bin");
  // The command is `npx --no-install knip --reporter json`; the stub stands in for npx.
  stub(
    bin,
    "npx",
    `import fs from "node:fs";\nif (process.argv.slice(2).join(" ") !== "--no-install knip --reporter json") { console.error("unexpected args"); process.exit(9); }\nprocess.stdout.write(fs.readFileSync(${JSON.stringify(path.join(FIXTURES, "knip.json"))}, "utf8"));\nprocess.exitCode = 1;\n`
  );
  const r = runDeadCode(["run", "--tool", "knip", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.json.exit, 1);
  assert.equal(r.json.format, "knip-json");
  assert.equal(r.json.unparsed, false);
  assert.equal(r.json.candidates.length, 7);
});

test("run: Psalm's SARIF is read back from its .sarif.json report, and exit 2 is findings", () => {
  const dir = tmp("dc-run-psalm");
  write(dir, "psalm.xml", "<psalm/>");
  const bin = tmp("dc-run-psalm-bin");
  stub(
    bin,
    "psalm",
    `import fs from "node:fs";\nimport { pathToFileURL } from "node:url";\nconst arg = process.argv.slice(2).find((a) => a.startsWith("--report="));\nconst report = arg.slice("--report=".length);\nif (!report.endsWith(".sarif.json")) process.exit(9);\nfs.writeFileSync(report, fs.readFileSync(${JSON.stringify(path.join(FIXTURES, "psalm.sarif"))}, "utf8").replace("file:///ROOT/", pathToFileURL(process.cwd()).href + "/"));\nprocess.exitCode = 2;\n`
  );
  const r = runDeadCode(["run", "--tool", "psalm", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.json.exit, 2);
  assert.equal(r.json.unparsed, false);
  assert.deepEqual(
    r.json.candidates.map((c) => [c.file, c.line, c.rule]),
    [
      ["src/Mailer.php", 18, "PossiblyUnusedMethod"],
      ["src/Legacy.php", 5, "UnusedClass"],
      ["src/Flow.php", 30, "UnreachableCode"],
    ]
  );
});

test("run: a tool in the agent format comes back unparsed with its output tail", () => {
  const dir = tmp("dc-run-agent");
  write(dir, ".rubocop.yml", "AllCops:\n");
  const bin = tmp("dc-run-agent-bin");
  stub(bin, "rubocop", 'console.log("app/models/user.rb:12:3: W: Lint/UnusedPrivateMethod: Private method legacy is unused.");\nprocess.exitCode = 1;\n');
  const r = runDeadCode(["run", "--tool", "rubocop", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.json.format, "agent");
  assert.equal(r.json.unparsed, true);
  assert.deepEqual(r.json.candidates, []);
  assert.deepEqual(r.json.tail, ["app/models/user.rb:12:3: W: Lint/UnusedPrivateMethod: Private method legacy is unused."]);
});

/* --------------------------------------------------------------- readers */

const cand = (file, line, name, kind, rule, message) => ({ file, line, name, kind, source: "tool", rule, message });

test("readers: SARIF from PMD, with a result that has no location counted in skipped", () => {
  const r = dc.readOutput("sarif", fixture("pmd.sarif"), "/proj");
  assert.equal(r.unparsed, false);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.candidates, [
    cand("src/main/java/app/Service.java", 42, "helper(String)", "unused", "UnusedPrivateMethod", "Avoid unused private methods such as 'helper(String)'."),
    cand("src/main/java/app/Store.java", 7, "cache", "unused", "UnusedPrivateField", "Avoid unused private fields such as 'cache'."),
    cand("src/main/java/app/Util.java", 3, "", "unknown", "UseUtilityClass", "This utility class has a non-private constructor"),
  ]);
});

test("readers: SARIF from Psalm, with a file: URI made relative to the root", () => {
  const root = tmp("dc-psalm-root");
  const text = fixture("psalm.sarif").replace("file:///ROOT/", `${pathToFileURL(root).href}/`);
  const r = dc.readOutput("sarif", text, root);
  assert.equal(r.unparsed, false);
  assert.deepEqual(r.candidates, [
    cand("src/Mailer.php", 18, "App\\Mailer::sendLater", "unused", "PossiblyUnusedMethod", "Cannot find any calls to method App\\Mailer::sendLater"),
    cand("src/Legacy.php", 5, "App\\Legacy", "unused", "UnusedClass", "Class `App\\Legacy` is never used"),
    cand("src/Flow.php", 30, "", "unreachable", "UnreachableCode", "Unreachable code"),
  ]);
  assert.equal(dc.readOutput("sarif", "{not json", root).unparsed, true);
});

test("readers: Knip JSON files, exports, types, enum and class members and duplicates", () => {
  const r = dc.readOutput("knip-json", `npm notice something\n${fixture("knip.json")}`, "/proj");
  assert.equal(r.unparsed, false);
  assert.equal(r.skipped, 1, "the export with no name");
  assert.deepEqual(r.candidates, [
    cand("src/old.ts", null, "", "file", "files", "Unused file"),
    cand("src/utils.ts", 12, "formatDate", "export", "exports", "Unused export formatDate"),
    cand("src/utils.ts", 3, "Options", "type", "types", "Unused type Options"),
    cand("src/utils.ts", 20, "Color.Purple", "enum-member", "enumMembers", "Unused enum member Color.Purple"),
    cand("src/utils.ts", 31, "Cache.flush", "class-member", "classMembers", "Unused class member Cache.flush"),
    cand("src/utils.ts", 40, "parse, default", "duplicate", "duplicates", "Unused duplicate parse, default"),
    cand("src/dead.ts", null, "", "file", "files", "Unused file"),
  ]);
  assert.equal(dc.readOutput("knip-json", "Knip crashed\n", "/proj").unparsed, true);
});

test("readers: vulture lines keep the confidence, and a mangled line is counted in skipped", () => {
  const r = dc.readOutput("vulture", fixture("vulture.txt"), "/proj");
  assert.equal(r.skipped, 1);
  assert.equal(r.unparsed, false);
  assert.deepEqual(r.candidates, [
    cand("app/models.py", 3, "os", "import", "vulture-import", "unused import 'os' (90% confidence)"),
    cand("app/models.py", 14, "legacy_total", "function", "vulture-function", "unused function 'legacy_total' (60% confidence)"),
    cand("app/views.py", 22, "retries", "variable", "vulture-variable", "unused variable 'retries' (60% confidence)"),
    cand("app/views.py", 40, "", "unreachable code", "vulture-unreachable-code", "unreachable code after 'return' (100% confidence)"),
  ]);
});

test("readers: cargo JSON keeps dead_code and unused_* once each, and a broken record is skipped", () => {
  const r = dc.readOutput("cargo-json", `   Compiling demo v0.1.0\n${fixture("cargo.ndjson")}`, "/proj");
  assert.equal(r.skipped, 1);
  assert.equal(r.unparsed, false);
  assert.deepEqual(r.candidates, [
    cand("src/lib.rs", 8, "old_helper", "function", "dead_code", "function `old_helper` is never used"),
    cand("src/main.rs", 1, "std::io", "unused_imports", "unused_imports", "unused import: `std::io`"),
    // One warning that groups two items: one candidate per primary span, named from the span.
    cand("src/net.rs", 2, "fmt", "unused_imports", "unused_imports", "unused imports: `fmt` and `io`"),
    cand("src/net.rs", 2, "io", "unused_imports", "unused_imports", "unused imports: `fmt` and `io`"),
    cand("src/model.rs", 4, "name", "field", "dead_code", "multiple fields are never read"),
    cand("src/model.rs", 5, "age", "field", "dead_code", "multiple fields are never read"),
  ]);
});

test("readers: Go deadcode lines, with a mangled line counted in skipped", () => {
  const r = dc.readOutput("go-deadcode", fixture("go-deadcode.txt"), "/proj");
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.candidates, [
    cand("internal/report/format.go", 12, "formatLegacy", "func", "deadcode", "unreachable func: formatLegacy"),
    cand("cmd/tool/main.go", 40, "(*server).shutdownOld", "func", "deadcode", "unreachable func: (*server).shutdownOld"),
  ]);
});

test("readers: output where every line is dropped comes back unparsed, and absolute paths are made relative", () => {
  assert.deepEqual(dc.readOutput("go-deadcode", "panic: something\ngoroutine 1\n", "/proj"), { candidates: [], skipped: 2, unparsed: true });
  assert.equal(dc.readOutput("agent", "anything", "/proj").unparsed, true);
  const root = tmp("dc-abs");
  const abs = path.join(root, "pkg", "a.py");
  const r = dc.readOutput("vulture", `${abs}:3: unused import 'os' (90% confidence)\n`, root);
  assert.equal(r.candidates[0].file, "pkg/a.py");
});

/* ---------------------------------------------------------------- narrow */

test("narrow: folders ranked by candidate count, ties by path, at --depth", () => {
  const dir = tmp("dc-narrow");
  const files = ["src/b/x.ts", "src/b/y.ts", "src/a/q.ts", "src/a/deep/r.ts", "lib/c.ts", "top.ts", "src/c/z.ts"];
  write(dir, "run.json", JSON.stringify({ ok: true, candidates: files.map((file) => ({ file })) }));
  const r = runDeadCode(["narrow", "--candidates", path.join(dir, "run.json")]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    folders: [
      { path: "src/a", candidates: 2 },
      { path: "src/b", candidates: 2 },
      { path: ".", candidates: 1 },
      { path: "lib", candidates: 1 },
      { path: "src/c", candidates: 1 },
    ],
    total: 7,
  });
  write(dir, "bare.json", JSON.stringify(files.map((file) => ({ file }))));
  const shallow = runDeadCode(["narrow", "--candidates", path.join(dir, "bare.json"), "--depth", "1"]);
  assert.deepEqual(shallow.json.folders, [
    { path: "src", candidates: 5 },
    { path: ".", candidates: 1 },
    { path: "lib", candidates: 1 },
  ]);
});

test("narrow: a missing file exits 3, invalid JSON or no candidates array exits 4", () => {
  const dir = tmp("dc-narrow-bad");
  assert.equal(runDeadCode(["narrow", "--candidates", path.join(dir, "none.json")]).code, 3);
  write(dir, "bad.json", "{not json");
  assert.equal(runDeadCode(["narrow", "--candidates", path.join(dir, "bad.json")]).code, 4);
  write(dir, "obj.json", '{"ok":true}');
  assert.equal(runDeadCode(["narrow", "--candidates", path.join(dir, "obj.json")]).code, 4);
  assert.equal(runDeadCode(["narrow"]).code, 2);
});

/* ------------------------------------------------------------- keep list */

const KEEP = ".plan2code-dead-code/keep.md";

/** A small project: two source files with declarations to keep. */
function keepProject(name) {
  const dir = tmp(name);
  write(dir, "src/a.js", "export function foo() {\n  return 1;\n}\n\nexport   function   bar() {}\n");
  write(dir, "src/b.js", "export const gone = 1;\n");
  return dir;
}

/** Every file under dir with its content, for "nothing was written" checks. */
function snapshot(dir) {
  const files = {};
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== ".git") walk(p);
      } else files[path.relative(dir, p).split(path.sep).join("/")] = fs.readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return files;
}

test("keep add: writes the keep table, and a second add for the same item replaces it", () => {
  const dir = keepProject("dc-keep-add");
  const first = runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "foo", "--line", "1", "--reason", "Called by the | plugin loader"], { cwd: dir });
  assert.equal(first.code, 0, first.stderr);
  assert.equal(first.json.replaced, false);
  assert.equal(first.json.entry.date, "2026-08-03");
  assert.match(first.json.entry.hash, /^[0-9a-f]{12}$/);
  const text = read(dir, KEEP);
  assert.match(text, /^# Dead Code keep list/);
  assert.match(text, /shared and safe to commit/);
  assert.match(text, /\| File \| Name \| Hash \| Reason \| Date \|/);
  assert.match(text, /\| src\/a\.js \| foo \| [0-9a-f]{12} \| Called by the \\\| plugin loader \| 2026-08-03 \|/);

  // Prose the person added survives a rewrite.
  fs.appendFileSync(path.join(dir, KEEP), "\nAsk the platform team before removing anything here.\n");
  const again = runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "foo", "--line", "1", "--reason", "Still needed"], { cwd: dir });
  assert.equal(again.json.replaced, true);
  const list = runDeadCode(["keep", "list"], { cwd: dir });
  assert.equal(list.json.exists, true);
  assert.deepEqual(
    list.json.entries.map((e) => [e.file, e.name, e.reason, e.state]),
    [["src/a.js", "foo", "Still needed", "current"]]
  );
  assert.match(read(dir, KEEP), /Ask the platform team/);
});

test("keep add: an empty reason exits 2, a missing line exits 3, and keep list with no file is empty", () => {
  const dir = keepProject("dc-keep-bad");
  for (const reason of ["", "   "]) {
    const r = runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "foo", "--line", "1", "--reason", reason], { cwd: dir });
    assert.equal(r.code, 2, JSON.stringify(reason));
    assert.equal(r.json.error, "missing-reason");
  }
  assert.equal(runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "foo", "--line", "99", "--reason", "x"], { cwd: dir }).code, 3);
  assert.equal(fs.existsSync(path.join(dir, KEEP)), false);
  const list = runDeadCode(["keep", "list"], { cwd: dir });
  assert.deepEqual([list.code, list.json.exists, list.json.entries], [0, false, []]);
  assert.equal(runDeadCode(["keep", "sweep"], { cwd: dir }).code, 2);
});

test("keep filter: hides a current entry, shows an edited one as wasKept, lists a deleted file as gone; --fresh shows all", () => {
  const dir = keepProject("dc-keep-filter");
  const add = (file, name, line, reason) => assert.equal(runDeadCode(["keep", "add", "--file", file, "--name", name, "--line", String(line), "--reason", reason], { cwd: dir }).code, 0);
  add("src/a.js", "foo", 1, "Plugin hook");
  add("src/a.js", "bar", 5, "Public API");
  add("src/b.js", "gone", 1, "Old reason");
  // A line added above foo moves it; only the edit to bar's line counts as a change.
  write(dir, "src/a.js", "// header\nexport function foo() {\n  return 1;\n}\n\nexport function bar(x) {}\n");
  fs.rmSync(path.join(dir, "src/b.js"));

  const candidates = [
    { file: "src/a.js", line: 2, name: "foo", kind: "export", source: "tool", rule: "exports", message: "" },
    { file: "src/a.js", line: 6, name: "bar", kind: "export", source: "tool", rule: "exports", message: "" },
    { file: "src/c.js", line: 1, name: "other", kind: "export", source: "tool", rule: "exports", message: "" },
  ];
  const r = runDeadCode(["keep", "filter"], { cwd: dir, input: JSON.stringify(candidates) });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.hidden.map((c) => [c.name, c.keptReason]), [["foo", "Plugin hook"]]);
  assert.deepEqual(r.json.shown.map((c) => [c.name, c.wasKept || false, c.keptReason || null]), [["bar", true, "Public API"], ["other", false, null]]);
  assert.equal(r.json.changed, 1);
  assert.deepEqual(r.json.kept, [
    { file: "src/a.js", name: "foo", reason: "Plugin hook" },
    { file: "src/a.js", name: "bar", reason: "Public API" },
    { file: "src/b.js", name: "gone", reason: "Old reason", gone: true },
  ]);
  const states = runDeadCode(["keep", "list"], { cwd: dir }).json.entries.map((e) => e.state);
  assert.deepEqual(states, ["current", "changed", "gone"]);

  // run's whole output works as input too; --fresh hides nothing but still counts the list.
  const fresh = runDeadCode(["keep", "filter", "--fresh"], { cwd: dir, input: JSON.stringify({ ok: true, candidates }) });
  assert.equal(fresh.json.fresh, true);
  assert.deepEqual(fresh.json.hidden, []);
  assert.equal(fresh.json.shown.length, 3);
  assert.equal(fresh.json.kept.length, 3);

  assert.equal(runDeadCode(["keep", "filter"], { cwd: dir, input: "not json" }).code, 4);
});

/* -------------------------------------------- keep matching by line hash */

// Two classes, each with a `save` method on a different line, and two
// identical `def save(self):` lines in a third class pair.
const SAVES = ["class A:", "    def save(self, path):", "        pass", "", "class B:", "    def save(self):", "        pass", "", "class C:", "    def save(self):", "        pass", ""].join("\n");

/** keep add for an item, asserting it worked; returns the row it wrote. */
function keepAt(dir, file, name, line, reason) {
  const args = ["keep", "add", "--file", file, "--line", String(line), "--reason", reason];
  if (name !== null) args.push("--name", name);
  const r = runDeadCode(args, { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  return r.json.entry;
}

/** A row appended to the keep table by hand (the table is the file's last block). */
function keepRowByHand(dir, { file, name, hash, reason }) {
  fs.appendFileSync(path.join(dir, KEEP), `| ${file} | ${name} | ${hash} | ${reason} | 2026-08-03 |\n`);
}

const filterKept = (dir, candidates) => {
  const r = runDeadCode(["keep", "filter"], { cwd: dir, input: JSON.stringify(candidates) });
  assert.equal(r.code, 0, r.stderr);
  return r.json;
};
const keepCand = (file, line, name) => ({ file, line, name, kind: "function", source: "tool", rule: "unused", message: "" });
const keepStates = (dir) => runDeadCode(["keep", "list"], { cwd: dir }).json.entries.map((e) => [e.hash, e.state]);

test("keep filter: keeping one of two same-named items in a file hides only that one", () => {
  const dir = tmp("dc-keep-same-name");
  write(dir, "m.py", SAVES);
  keepAt(dir, "m.py", "save", 2, "Called by the plugin host");
  const r = filterKept(dir, [keepCand("m.py", 2, "save"), keepCand("m.py", 6, "save")]);
  assert.deepEqual(r.hidden.map((c) => c.line), [2]);
  assert.deepEqual(r.shown.map((c) => [c.line, c.wasKept || false]), [[6, false]]);
});

test("keep filter: keeping one of two empty-name findings in a file hides only that one", () => {
  const dir = tmp("dc-keep-empty-name");
  write(dir, "u.py", "def f():\n    return 1\n    print('a')\n\ndef g():\n    return 2\n    print('b')\n");
  keepAt(dir, "u.py", null, 3, "Left for the debugger");
  const r = filterKept(dir, [keepCand("u.py", 3, ""), keepCand("u.py", 7, "")]);
  assert.deepEqual(r.hidden.map((c) => c.line), [3]);
  assert.deepEqual(r.shown.map((c) => c.line), [7]);
});

test("keep add on a repeated line writes #n, and keep filter tells the copies apart", () => {
  const dir = tmp("dc-keep-repeat");
  write(dir, "m.py", SAVES);
  const second = keepAt(dir, "m.py", "save", 10, "Second copy stays");
  assert.match(second.hash, /^[0-9a-f]{12}#2$/);
  assert.equal(second.hash, dc.declHash(dir, "m.py", 10).hash);
  const both = [keepCand("m.py", 6, "save"), keepCand("m.py", 10, "save")];
  const one = filterKept(dir, both);
  assert.deepEqual([one.hidden.map((c) => c.line), one.shown.map((c) => [c.line, c.wasKept || false])], [[10], [[6, false]]]);

  const first = dc.declHash(dir, "m.py", 6);
  assert.deepEqual([first.hash.endsWith("#1"), first.base, first.copies], [true, second.hash.slice(0, 12), 2]);
  keepRowByHand(dir, { file: "m.py", name: "save", hash: first.hash, reason: "First copy stays" });
  const two = filterKept(dir, both);
  assert.deepEqual([two.hidden.map((c) => [c.line, c.keptReason]), two.shown], [[[6, "First copy stays"], [10, "Second copy stays"]], []]);
});

test("keep filter: a kept item that moved down five lines stays hidden and reads current", () => {
  const dir = tmp("dc-keep-moved");
  write(dir, "m.py", SAVES);
  keepAt(dir, "m.py", "save", 2, "Plugin hook");
  write(dir, "m.py", "# one\n# two\n# three\n# four\n# five\n" + SAVES);
  const r = filterKept(dir, [keepCand("m.py", 7, "save"), keepCand("m.py", 11, "save")]);
  assert.deepEqual([r.hidden.map((c) => c.line), r.shown.map((c) => c.line)], [[7], [11]]);
  assert.deepEqual(keepStates(dir).map((s) => s[1]), ["current"]);
});

test("keep filter: a #n row whose copies drop to one reads changed and flags the copy left", () => {
  const dir = tmp("dc-keep-copy-gone");
  write(dir, "m.py", SAVES);
  keepAt(dir, "m.py", "save", 10, "Second copy stays");
  // Class B goes, so class C's save is now the only `def save(self):` line.
  write(dir, "m.py", SAVES.split("\n").slice(0, 4).concat(SAVES.split("\n").slice(8)).join("\n"));
  assert.deepEqual(keepStates(dir).map((s) => s[1]), ["changed"]);
  const r = filterKept(dir, [keepCand("m.py", 6, "save")]);
  assert.deepEqual([r.hidden, r.shown.map((c) => [c.line, c.wasKept, c.keptReason]), r.changed], [[], [[6, true, "Second copy stays"]], 1]);
});

test("keep filter: a plain row whose line now repeats reads changed and both copies are shown", () => {
  const dir = tmp("dc-keep-pasted");
  write(dir, "m.py", "class A:\n    def load(self):\n        pass\n");
  keepAt(dir, "m.py", "load", 2, "Loaded by name");
  fs.appendFileSync(path.join(dir, "m.py"), "\nclass B:\n    def load(self):\n        pass\n");
  assert.deepEqual(keepStates(dir).map((s) => s[1]), ["changed"]);
  const r = filterKept(dir, [keepCand("m.py", 2, "load"), keepCand("m.py", 6, "load")]);
  assert.deepEqual(r.hidden, []);
  assert.deepEqual(r.shown.map((c) => [c.line, c.wasKept, c.keptReason]), [[2, true, "Loaded by name"], [6, true, "Loaded by name"]]);
});

test("keep filter: a whole-file row hides the whole-file finding only, not an empty-name finding inside it", () => {
  const dir = keepProject("dc-keep-whole-only");
  assert.equal(runDeadCode(["keep", "add", "--file", "src/a.js", "--reason", "Loaded at runtime"], { cwd: dir }).code, 0);
  const r = filterKept(dir, [{ file: "src/a.js", line: null, name: "", kind: "file" }, keepCand("src/a.js", 2, "")]);
  assert.deepEqual(r.hidden.map((c) => [c.line, c.keptReason]), [[null, "Loaded at runtime"]]);
  assert.deepEqual(r.shown.map((c) => [c.line, c.wasKept || false]), [[2, false]]);
});

test("keep filter: a keep.md written in the old format loads, reads current and hides its item", () => {
  const dir = keepProject("dc-keep-old-format");
  const hash = dc.declHash(dir, "src/a.js", 1).hash;
  assert.match(hash, /^[0-9a-f]{12}$/);
  write(dir, KEEP, `# Dead Code keep list\n\n| File | Name | Hash | Reason | Date |\n| --- | --- | --- | --- | --- |\n| src/a.js | foo | ${hash} | Plugin hook | 2026-01-02 |\n`);
  assert.deepEqual(keepStates(dir), [[hash, "current"]]);
  const r = filterKept(dir, [keepCand("src/a.js", 1, "foo")]);
  assert.deepEqual([r.hidden.map((c) => c.keptReason), r.shown], [["Plugin hook"], []]);
});

test("keep filter: a line-less named finding matches a whole-file row kept with that name, a lined one does not", () => {
  const dir = keepProject("dc-keep-whole-named");
  const add = runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "foo", "--reason", "Whole module stays"], { cwd: dir });
  assert.equal(add.code, 0, add.stderr);
  assert.match(add.json.entry.hash, /^file:[0-9a-f]{12}$/);
  const r = filterKept(dir, [keepCand("src/a.js", null, "foo"), keepCand("src/a.js", 1, "foo")]);
  assert.deepEqual(r.hidden.map((c) => [c.line, c.keptReason]), [[null, "Whole module stays"]]);
  assert.deepEqual(r.shown.map((c) => [c.line, c.wasKept || false]), [[1, false]]);
});

test("keep filter: a candidate outside the project counts as line-less, so its file is never read", () => {
  const box = tmp("dc-keep-outside");
  write(box, "outside.js", "export function foo() {}\nexport function foo2() {}\n");
  const dir = path.join(box, "proj");
  write(dir, "src/a.js", "export function foo() {}\n");
  keepAt(dir, "src/a.js", "foo", 1, "Kept inside");
  // A row for line 2 of the outside file: read and hashed, line 1 would match no row and be
  // shown; treated as line-less, the candidate matches the row by name and is hidden.
  const line2 = dc.declHash(box, "outside.js", 2).hash;
  keepRowByHand(dir, { file: "../outside.js", name: "foo", hash: line2, reason: "Outside row" });
  const r = filterKept(dir, [keepCand("../outside.js", 1, "foo")]);
  assert.deepEqual([r.hidden.map((c) => [c.file, c.keptReason]), r.shown], [[["../outside.js", "Outside row"]], []]);
});

test("keep remove: takes an entry off, and exits 3 when it is not there", () => {
  const dir = keepProject("dc-keep-remove");
  runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "foo", "--line", "1", "--reason", "One"], { cwd: dir });
  runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "bar", "--line", "5", "--reason", "Two"], { cwd: dir });
  const r = runDeadCode(["keep", "remove", "--file", "src/a.js", "--name", "foo"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.removed.reason, "One");
  assert.deepEqual(runDeadCode(["keep", "list"], { cwd: dir }).json.entries.map((e) => e.name), ["bar"]);
  const missing = runDeadCode(["keep", "remove", "--file", "src/a.js", "--name", "foo"], { cwd: dir });
  assert.equal(missing.code, 3);
  assert.equal(missing.json.error, "not-kept");
});

// Two same-named methods whose declaration lines differ.
const TWO_SAVES = ["class A:", "    def save(self, path):", "        pass", "", "class B:", "    def save(self, other):", "        pass", ""].join("\n");
const keepRows = (dir) => runDeadCode(["keep", "list"], { cwd: dir }).json.entries;

test("keep add: two same-named items with different lines are kept as two current rows, and both are hidden", () => {
  const dir = tmp("dc-keep-add-two");
  write(dir, "m.py", TWO_SAVES);
  const a = keepAt(dir, "m.py", "save", 2, "Plugin hook");
  const add = runDeadCode(["keep", "add", "--file", "m.py", "--name", "save", "--line", "6", "--reason", "Called by name"], { cwd: dir });
  assert.equal(add.code, 0, add.stderr);
  assert.equal(add.json.replaced, false);
  assert.deepEqual(keepRows(dir).map((e) => [e.hash, e.state]), [[a.hash, "current"], [add.json.entry.hash, "current"]]);
  const r = filterKept(dir, [keepCand("m.py", 2, "save"), keepCand("m.py", 6, "save")]);
  assert.deepEqual([r.hidden.map((c) => c.line), r.shown], [[2, 6], []]);
});

test("keep add: two identical declaration lines are kept as #1 and #2", () => {
  const dir = tmp("dc-keep-add-copies");
  write(dir, "m.py", SAVES);
  const first = keepAt(dir, "m.py", "save", 6, "First copy");
  const second = keepAt(dir, "m.py", "save", 10, "Second copy");
  assert.match(first.hash, /^[0-9a-f]{12}#1$/);
  assert.equal(second.hash, `${first.hash.slice(0, 12)}#2`);
  assert.deepEqual(keepRows(dir).map((e) => [e.hash, e.state]), [[first.hash, "current"], [second.hash, "current"]]);
});

test("keep add: keeping an item again after its line changed replaces the stale row", () => {
  const dir = tmp("dc-keep-add-stale");
  write(dir, "m.py", "class A:\n    def save(self, path):\n        pass\n");
  keepAt(dir, "m.py", "save", 2, "Plugin hook");
  write(dir, "m.py", "class A:\n    def save(self, path, mode):\n        pass\n");
  assert.deepEqual(keepRows(dir).map((e) => e.state), ["changed"]);
  const again = runDeadCode(["keep", "add", "--file", "m.py", "--name", "save", "--line", "2", "--reason", "Still a plugin hook"], { cwd: dir });
  assert.equal(again.code, 0, again.stderr);
  assert.equal(again.json.replaced, true);
  assert.deepEqual(keepRows(dir).map((e) => [e.hash, e.reason, e.state]), [[again.json.entry.hash, "Still a plugin hook", "current"]]);
});

test("keep add: keeping an unchanged item again only updates its reason", () => {
  const dir = tmp("dc-keep-add-reason");
  write(dir, "m.py", TWO_SAVES);
  const first = keepAt(dir, "m.py", "save", 2, "Old reason");
  const again = runDeadCode(["keep", "add", "--file", "m.py", "--name", "save", "--line", "2", "--reason", "New reason"], { cwd: dir });
  assert.equal(again.json.replaced, true);
  assert.deepEqual(keepRows(dir).map((e) => [e.hash, e.reason]), [[first.hash, "New reason"]]);
});

test("keep remove: two rows sharing file and name exit 2 ambiguous-entry, listing both, and write nothing", () => {
  const dir = tmp("dc-keep-remove-ambiguous");
  write(dir, "m.py", TWO_SAVES);
  const a = keepAt(dir, "m.py", "save", 2, "Plugin hook");
  const b = keepAt(dir, "m.py", "save", 6, "Called by name");
  const before = fs.readFileSync(path.join(dir, KEEP));
  const r = runDeadCode(["keep", "remove", "--file", "m.py", "--name", "save"], { cwd: dir });
  assert.equal(r.code, 2);
  assert.equal(r.json.error, "ambiguous-entry");
  assert.match(r.json.message, /matches 2 keep entries/);
  for (const row of [a, b]) assert.ok(r.json.next.includes(`${row.hash} (${row.reason})`), r.json.next);
  assert.match(r.json.next, /--hash/);
  assert.match(r.json.next, /--line/);
  assert.ok(fs.readFileSync(path.join(dir, KEEP)).equals(before), "keep.md is unchanged byte for byte");
});

test("keep remove: --line and --hash each take off exactly the named row, and an unknown --hash exits 3", () => {
  const dir = tmp("dc-keep-remove-pick");
  write(dir, "m.py", TWO_SAVES);
  const a = keepAt(dir, "m.py", "save", 2, "Plugin hook");
  const b = keepAt(dir, "m.py", "save", 6, "Called by name");
  const byLine = runDeadCode(["keep", "remove", "--file", "m.py", "--name", "save", "--line", "6"], { cwd: dir });
  assert.equal(byLine.code, 0, byLine.stderr);
  assert.equal(byLine.json.removed.hash, b.hash);
  assert.deepEqual(keepRows(dir).map((e) => e.hash), [a.hash]);

  keepAt(dir, "m.py", "save", 6, "Called by name");
  const byHash = runDeadCode(["keep", "remove", "--file", "m.py", "--name", "save", "--hash", a.hash], { cwd: dir });
  assert.equal(byHash.code, 0, byHash.stderr);
  assert.equal(byHash.json.removed.reason, "Plugin hook");
  assert.deepEqual(keepRows(dir).map((e) => e.hash), [b.hash]);

  const unknown = runDeadCode(["keep", "remove", "--file", "m.py", "--name", "save", "--hash", "000000000000"], { cwd: dir });
  assert.equal(unknown.code, 3);
  assert.equal(unknown.json.error, "not-kept");
  assert.deepEqual(keepRows(dir).map((e) => e.hash), [b.hash]);

  const noLine = runDeadCode(["keep", "remove", "--file", "m.py", "--name", "save", "--line", "99"], { cwd: dir });
  assert.deepEqual([noLine.code, noLine.json.error], [3, "declaration-missing"]);
  // With both rows kept, --hash names A's row and --line names B's: both must match, so neither comes off.
  keepAt(dir, "m.py", "save", 2, "Plugin hook");
  const disagree = runDeadCode(["keep", "remove", "--file", "m.py", "--name", "save", "--hash", a.hash, "--line", "6"], { cwd: dir });
  assert.deepEqual([disagree.code, disagree.json.error], [3, "not-kept"]);
  assert.deepEqual(keepRows(dir).map((e) => e.hash), [b.hash, a.hash]);
});

/* ------------------------------------------------------ backup, restore */

/** The per-user backup folder name under the temp folder (the script adds the user id). */
const backupFolder = () => "plan2code-dead-code-" + (typeof process.getuid === "function" ? process.getuid() : os.userInfo().username.replace(/[^A-Za-z0-9._-]/g, "_"));
/** Point the script's temp folder (os.tmpdir) at `dir`. */
const tempEnv = (dir) => ({ TEMP: dir, TMP: dir, TMPDIR: dir });

test("backup: copies without moving, and a second call with --run extends the manifest", () => {
  const dir = keepProject("dc-backup");
  const temp = tmp("dc-backup-temp");
  const env = tempEnv(temp);
  const first = runDeadCode(["backup", "src/a.js"], { cwd: dir, env });
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.json.run, /^20260803-140500-[0-9a-f]{4}$/);
  assert.equal(path.resolve(first.json.dir), path.join(temp, backupFolder(), first.json.run));
  assert.ok(fs.existsSync(path.join(dir, "src/a.js")), "the source is still there");
  assert.equal(fs.readFileSync(path.join(first.json.dir, "files", "src", "a.js"), "utf8"), read(dir, "src/a.js"));

  // An edited file backed up again in the same run keeps its first copy.
  write(dir, "src/a.js", "edited\n");
  const second = runDeadCode(["backup", "src/a.js", "src/b.js", "--run", first.json.run], { cwd: dir, env });
  assert.equal(second.code, 0, second.stderr);
  assert.deepEqual(second.json.files.map((f) => f.path), ["src/b.js"]);
  assert.deepEqual(second.json.already, ["src/a.js"]);
  const manifest = JSON.parse(fs.readFileSync(path.join(first.json.dir, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.files.map((f) => f.path), ["src/a.js", "src/b.js"]);
  for (const f of manifest.files) assert.match(f.sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(fs.readFileSync(path.join(first.json.dir, "files", "src", "a.js"), "utf8"), "edited\n");
});

test("backup: a missing file exits 3 and copies nothing; a bad run id exits 2", () => {
  const dir = keepProject("dc-backup-missing");
  const temp = tmp("dc-backup-missing-temp");
  const r = runDeadCode(["backup", "src/a.js", "src/none.js", "--run", "r1"], { cwd: dir, env: tempEnv(temp) });
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "file-missing");
  assert.equal(fs.existsSync(path.join(temp, backupFolder(), "r1")), false);
  assert.equal(runDeadCode(["backup", "src/a.js", "--run", "../up"], { cwd: dir, env: tempEnv(temp) }).code, 2);
  assert.equal(runDeadCode(["backup"], { cwd: dir, env: tempEnv(temp) }).code, 2);
});

test("restore: brings back a deleted and a changed file, byte for byte", () => {
  const dir = keepProject("dc-restore");
  write(dir, "src/deep/c.js", "crlf\r\nline\r\n");
  const env = tempEnv(tmp("dc-restore-temp"));
  const before = snapshot(dir);
  const { run } = runDeadCode(["backup", "src/a.js", "src/deep/c.js"], { cwd: dir, env }).json;
  fs.rmSync(path.join(dir, "src/deep"), { recursive: true });
  write(dir, "src/a.js", "removed foo\n");

  const check = runDeadCode(["restore", "--run", run, "--verify"], { cwd: dir, env });
  assert.equal(check.code, 4);
  assert.deepEqual(check.json.mismatched.map((m) => m.path).sort(), ["src/a.js", "src/deep/c.js"]);

  const r = runDeadCode(["restore", "--run", run], { cwd: dir, env });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.restored.sort(), ["src/a.js", "src/deep/c.js"]);
  assert.deepEqual(r.json.mismatched, []);
  assert.deepEqual(snapshot(dir), before);
  const verify = runDeadCode(["restore", "--run", run, "--verify"], { cwd: dir, env });
  assert.equal(verify.code, 0);
  assert.deepEqual(verify.json.verified.sort(), ["src/a.js", "src/deep/c.js"]);
});

test("restore: --files puts back only those, --verify copies nothing, and a tampered copy exits 4 as mismatched", () => {
  const dir = keepProject("dc-restore-tamper");
  const env = tempEnv(tmp("dc-restore-tamper-temp"));
  const { run, dir: backupDir } = runDeadCode(["backup", "src/a.js", "src/b.js"], { cwd: dir, env }).json;
  write(dir, "src/a.js", "changed a\n");
  write(dir, "src/b.js", "changed b\n");

  const verify = runDeadCode(["restore", "--run", run, "--verify"], { cwd: dir, env });
  assert.equal(verify.code, 4);
  assert.equal(verify.json.ok, false);
  assert.equal(read(dir, "src/a.js"), "changed a\n", "--verify copied nothing");

  const one = runDeadCode(["restore", "--run", run, "--files", "src/b.js"], { cwd: dir, env });
  assert.deepEqual([one.code, one.json.restored], [0, ["src/b.js"]]);
  assert.equal(read(dir, "src/a.js"), "changed a\n");
  assert.equal(read(dir, "src/b.js"), "export const gone = 1;\n");

  fs.writeFileSync(path.join(backupDir, "files", "src", "a.js"), "tampered\n");
  const bad = runDeadCode(["restore", "--run", run], { cwd: dir, env });
  assert.equal(bad.code, 4);
  assert.equal(bad.json.ok, false);
  assert.deepEqual(bad.json.mismatched.map((m) => m.path), ["src/a.js"]);
  assert.match(bad.json.mismatched[0].reason, /backup copy damaged/);
  assert.deepEqual(bad.json.restored, ["src/b.js"]);
  assert.equal(read(dir, "src/a.js"), "changed a\n", "a damaged copy is never copied over the project file");
});

test("restore: a manifest path edited to point outside the project exits 5 and copies nothing", () => {
  const dir = keepProject("dc-restore-escape");
  const env = tempEnv(tmp("dc-restore-escape-temp"));
  const { run, dir: backupDir } = runDeadCode(["backup", "src/a.js", "src/b.js"], { cwd: dir, env }).json;
  write(dir, "src/a.js", "changed a\n");
  const manifestFile = path.join(backupDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  manifest.files[1].path = "../escaped.js";
  fs.mkdirSync(path.join(backupDir, "files", ".."), { recursive: true });
  fs.writeFileSync(path.join(backupDir, "escaped.js"), "export const gone = 1;\n");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));

  const r = runDeadCode(["restore", "--run", run], { cwd: dir, env });
  assert.equal(r.code, 5);
  assert.equal(r.json.error, "outside-root");
  assert.equal(fs.existsSync(path.join(path.dirname(dir), "escaped.js")), false);
  assert.equal(read(dir, "src/a.js"), "changed a\n", "nothing was copied");
});

test("a file inside the project whose name starts with .. is not outside it", () => {
  const dir = keepProject("dc-dotdot");
  write(dir, "..odd.js", "export const odd = 1;\n");
  const env = tempEnv(tmp("dc-dotdot-temp"));
  const backup = runDeadCode(["backup", "..odd.js"], { cwd: dir, env });
  assert.equal(backup.code, 0, backup.stderr);
  assert.deepEqual(backup.json.files.map((f) => f.path), ["..odd.js"]);
  assert.equal(runDeadCode(["keep", "add", "--file", "..odd.js", "--name", "odd", "--line", "1", "--reason", "r"], { cwd: dir }).code, 0);
});

test("restore: a run with no manifest, or a file it does not hold, exits 3", () => {
  const dir = keepProject("dc-restore-missing");
  const env = tempEnv(tmp("dc-restore-missing-temp"));
  assert.equal(runDeadCode(["restore", "--run", "20260101-000000-abcd"], { cwd: dir, env }).code, 3);
  const { run } = runDeadCode(["backup", "src/a.js"], { cwd: dir, env }).json;
  const r = runDeadCode(["restore", "--run", run, "--files", "src/b.js"], { cwd: dir, env });
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "not-backed-up");
  assert.equal(runDeadCode(["restore"], { cwd: dir, env }).code, 2);
});

test("a path outside the project root exits 5 for keep add, backup and restore", () => {
  const dir = keepProject("dc-outside");
  write(path.dirname(dir), `${path.basename(dir)}-sibling.js`, "x\n");
  const outside = `../${path.basename(dir)}-sibling.js`;
  const env = tempEnv(tmp("dc-outside-temp"));
  assert.equal(runDeadCode(["keep", "add", "--file", outside, "--name", "x", "--line", "1", "--reason", "r"], { cwd: dir }).code, 5);
  const backup = runDeadCode(["backup", outside], { cwd: dir, env });
  assert.equal(backup.code, 5);
  assert.equal(backup.json.error, "outside-root");
  const { run } = runDeadCode(["backup", "src/a.js"], { cwd: dir, env }).json;
  assert.equal(runDeadCode(["restore", "--run", run, "--files", outside], { cwd: dir, env }).code, 5);
  fs.rmSync(path.join(path.dirname(dir), `${path.basename(dir)}-sibling.js`), { force: true });
});

/* ---------------------------------------------------------------- report */

const FINDINGS = {
  scope: "src",
  mode: "verify",
  tool: "knip",
  ranFrom: "complete",
  hidden: 2,
  findings: [
    { file: "src/a.js", line: 3, name: "foo", kind: "export", source: "both", rule: "exports", label: "safe", callers: "none found", outcome: "removed" },
    { file: "src/b.js", line: null, name: "", kind: "file", source: "own", rule: null, label: "check", callers: [], outcome: "failed: npm test\nAssertionError | boom" },
    { file: "src/c.js", line: 9, name: "onLoad", kind: "function", source: "tool", rule: "exports", label: "warning", warningKind: "plugin or framework hook", outcome: "kept" },
  ],
};

const findingsFile = (dir, doc) => write(dir, "findings.json", JSON.stringify(doc));

test("report write: three sections in order with label, source, rule, reason and outcome, and a complete run says so", () => {
  const dir = tmp("dc-report");
  const r = runDeadCode(["report", "write", "--findings", findingsFile(dir, FINDINGS)], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.path, ".plan2code-dead-code/reports/DEAD-CODE-2026-08-03.md");
  const text = read(dir, r.json.path);
  assert.match(text, /^# Dead Code report/);
  assert.match(text, /\*\*Date:\*\* 2026-08-03/);
  assert.match(text, /\*\*Tool:\*\* knip/);
  assert.match(text, /\*\*Full search of our own:\*\* no/);
  assert.match(text, /1 Safe to remove, 1 Check first, 1 Warning/);
  assert.match(text, /1 removed, 1 failed, 1 kept/);
  assert.match(text, /\*\*Hidden by the keep list:\*\* 2/);
  const safe = text.indexOf("## Safe to remove");
  const check = text.indexOf("## Check first");
  const warning = text.indexOf("## Warning");
  assert.ok(safe > 0 && safe < check && check < warning, "Safe, Check first, Warning in order");
  assert.match(text, /\| Item \| Location \| Source \| Rule \| Reason \| Outcome \|/);
  assert.match(text, /\| foo \| src\/a\.js:3 \| both \| exports \| none found \| removed \|/);
  assert.match(text, /\| \(whole file\) \| src\/b\.js \| own search \| - \| - \| failed: npm test AssertionError \\\| boom \|/);
  assert.match(text, /\| onLoad \| src\/c\.js:9 \| tool \| exports \| plugin or framework hook \| kept \|/);
  assert.match(text, /This run was complete/);
  assert.doesNotMatch(text, /narrowed/);
});

test("report write: a narrowed run is stated as narrowed, and a stopped one as not complete", () => {
  const dir = tmp("dc-report-narrowed");
  const narrowed = runDeadCode(["report", "write", "--findings", findingsFile(dir, { ...FINDINGS, ranFrom: "narrowed", notChecked: "lib/ and test/" })], { cwd: dir });
  assert.equal(narrowed.code, 0, narrowed.stderr);
  const text = read(dir, narrowed.json.path);
  assert.match(text, /This run was narrowed, not complete: only `src` was checked\. Not checked: lib\/ and test\/\./);
  assert.doesNotMatch(text, /This run was complete/);
  const stopped = runDeadCode(["report", "write", "--findings", findingsFile(dir, { ...FINDINGS, mode: "own", tool: null, ranFrom: "stopped", findings: [] }), "--date", "2026-08-04"], { cwd: dir });
  assert.equal(stopped.code, 0, stopped.stderr);
  const stoppedText = read(dir, stopped.json.path);
  assert.match(stoppedText, /stopped before it finished, not complete/);
  assert.match(stoppedText, /\*\*Tool:\*\* no tool/);
  assert.match(stoppedText, /\*\*Full search of our own:\*\* yes/);
  assert.match(stoppedText, /## Safe to remove\n\nNone\./);
});

test("report write: a same-day report is refused without --replace; bad findings exit 3 or 4", () => {
  const dir = tmp("dc-report-again");
  const file = findingsFile(dir, FINDINGS);
  assert.equal(runDeadCode(["report", "write", "--findings", file], { cwd: dir }).code, 0);
  const again = runDeadCode(["report", "write", "--findings", file], { cwd: dir });
  assert.equal(again.code, 5);
  assert.equal(again.json.error, "report-exists");
  assert.match(again.json.message, /DEAD-CODE-2026-08-03\.md/);
  const replaced = runDeadCode(["report", "write", "--findings", findingsFile(dir, { ...FINDINGS, ranFrom: "narrowed" }), "--replace"], { cwd: dir });
  assert.equal(replaced.code, 0);
  assert.match(read(dir, replaced.json.path), /narrowed/);

  assert.equal(runDeadCode(["report", "write", "--findings", path.join(dir, "none.json")], { cwd: dir }).code, 3);
  const { ranFrom, ...noRanFrom } = FINDINGS;
  assert.ok(ranFrom);
  assert.equal(runDeadCode(["report", "write", "--findings", findingsFile(dir, noRanFrom), "--date", "2026-09-01"], { cwd: dir }).code, 4);
  assert.equal(runDeadCode(["report", "write", "--findings", findingsFile(dir, { ...FINDINGS, findings: [{ file: "a.js", label: "maybe" }] }), "--date", "2026-09-01"], { cwd: dir }).code, 4);
  assert.equal(runDeadCode(["report", "write", "--findings", file, "--date", "Aug 3"], { cwd: dir }).code, 2);
  assert.equal(runDeadCode(["report", "read"], { cwd: dir }).code, 2);
});

test("report write: a list of two or more tools prints Tools, one prints Tool, null prints no tool", () => {
  const dir = tmp("dc-report-tools");
  const cases = [
    [["knip", "vulture"], /\*\*Tools:\*\* knip, vulture/, "2026-08-10"],
    [["knip"], /\*\*Tool:\*\* knip\n/, "2026-08-11"],
    [null, /\*\*Tool:\*\* no tool/, "2026-08-12"],
  ];
  for (const [tool, line, date] of cases) {
    const r = runDeadCode(["report", "write", "--findings", findingsFile(dir, { ...FINDINGS, tool }), "--date", date], { cwd: dir });
    assert.equal(r.code, 0, r.stderr);
    assert.match(read(dir, r.json.path), line);
  }
  assert.match(read(dir, ".plan2code-dead-code/reports/DEAD-CODE-2026-08-10.md"), /\*\*Found by:\*\* the tools' lists, verified by a caller search/);
  const one = read(dir, ".plan2code-dead-code/reports/DEAD-CODE-2026-08-11.md");
  assert.doesNotMatch(one, /\*\*Tools:\*\*/);
  assert.match(one, /\*\*Found by:\*\* the tool's list, verified by a caller search/);
});

test("report write: a tool that is not an id, a list of ids or null exits 4 and writes no report", () => {
  const dir = tmp("dc-report-bad-tool");
  const r = runDeadCode(["report", "write", "--findings", findingsFile(dir, { ...FINDINGS, tool: 3 }), "--date", "2026-08-13"], { cwd: dir });
  assert.equal(r.code, 4);
  assert.equal(r.json.error, "findings-invalid");
  assert.match(r.json.message, /tool must be a tool id, a list of ids, or null/);
  assert.equal(fs.existsSync(path.join(dir, ".plan2code-dead-code", "reports", "DEAD-CODE-2026-08-13.md")), false);
});

/* ------------------------------------------------------------- gitignore */

/** A committed git repo with a .gitignore that does not cover the reports. */
const gitProject = (name) =>
  copyFixture(name, "dead-code-git", (dir) => {
    const g = gitInit(dir);
    write(dir, ".gitignore", "node_modules/");
    write(dir, "src/a.js", "export const a = 1;\n");
    g("add", "-A");
    g("commit", "-q", "-m", "init");
  });

test("gitignore-check and gitignore-add on a git project: appends one line, never touching the others", () => {
  const dir = gitProject("dc-gitignore");
  const before = runDeadCode(["gitignore-check"], { cwd: dir });
  assert.equal(before.code, 0, before.stderr);
  assert.deepEqual([before.json.isGit, before.json.hasGitignore, before.json.ignored, before.json.line], [true, true, false, null]);
  const add = runDeadCode(["gitignore-add"], { cwd: dir });
  assert.equal(add.code, 0, add.stderr);
  assert.equal(add.json.added, true);
  assert.equal(read(dir, ".gitignore"), "node_modules/\n.plan2code-dead-code/reports/\n");
  const after = runDeadCode(["gitignore-check"], { cwd: dir });
  assert.deepEqual([after.json.ignored, after.json.line, after.json.file], [true, ".plan2code-dead-code/reports/", ".gitignore"]);
  const again = runDeadCode(["gitignore-add"], { cwd: dir });
  assert.deepEqual([again.json.added, again.json.already], [false, true]);
  assert.equal(read(dir, ".gitignore"), "node_modules/\n.plan2code-dead-code/reports/\n");
});

test("gitignore-check: reports/ in the state folder's .gitignore, or a wider rule git applies, counts as ignored", () => {
  const own = gitProject("dc-gitignore-own");
  write(own, ".plan2code-dead-code/.gitignore", "reports/\n");
  const r = runDeadCode(["gitignore-check"], { cwd: own });
  assert.deepEqual([r.json.ignored, r.json.line, r.json.file], [true, "reports/", ".plan2code-dead-code/.gitignore"]);
  const wide = gitProject("dc-gitignore-wide");
  write(wide, ".gitignore", ".plan2code-dead-code/\n");
  const w = runDeadCode(["gitignore-check"], { cwd: wide });
  assert.deepEqual([w.json.ignored, w.json.line], [true, null]);
});

test("gitignore-check and gitignore-add on a folder that is not a git repo", () => {
  const dir = tmp("dc-not-git");
  const env = { GIT_CEILING_DIRECTORIES: path.dirname(dir) };
  const r = runDeadCode(["gitignore-check"], { cwd: dir, env });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual([r.json.isGit, r.json.hasGitignore, r.json.ignored], [false, false, false]);
  const add = runDeadCode(["gitignore-add"], { cwd: dir, env });
  assert.equal(add.code, 5);
  assert.equal(add.json.error, "not-git");
  assert.equal(fs.existsSync(path.join(dir, ".gitignore")), false);
});

/* --------------------------------------------------------------- dry run */

test("--dry-run writes nothing for every writing command", () => {
  const dir = gitProject("dc-dry-run");
  write(dir, "src/a.js", "export function foo() {}\n");
  const temp = tmp("dc-dry-run-temp");
  const env = tempEnv(temp);
  // One real keep entry and one real backup, so remove and restore have something to act on.
  const keptHash = runDeadCode(["keep", "add", "--file", "src/a.js", "--name", "foo", "--line", "1", "--reason", "Kept"], { cwd: dir }).json.entry.hash;
  const { run } = runDeadCode(["backup", "src/a.js"], { cwd: dir, env }).json;
  write(dir, "src/a.js", "removed\n");
  const findings = findingsFile(tmp("dc-dry-run-findings"), FINDINGS);
  const project = snapshot(dir);
  const temps = snapshot(temp);

  const runs = {
    "keep add": ["keep", "add", "--file", "src/a.js", "--name", "removed", "--line", "1", "--reason", "Dry", "--dry-run"],
    "keep remove": ["keep", "remove", "--file", "src/a.js", "--name", "foo", "--dry-run"],
    "keep remove --hash": ["keep", "remove", "--file", "src/a.js", "--name", "foo", "--hash", keptHash, "--dry-run"],
    backup: ["backup", "src/a.js", "--dry-run"],
    "backup --run": ["backup", "src/a.js", "--run", "dry-run-id", "--dry-run"],
    restore: ["restore", "--run", run, "--dry-run"],
    "report write": ["report", "write", "--findings", findings, "--dry-run"],
    "gitignore-add": ["gitignore-add", "--dry-run"],
  };
  for (const [label, args] of Object.entries(runs)) {
    const r = runDeadCode(args, { cwd: dir, env });
    assert.equal(r.code, 0, `${label}: ${r.stderr}`);
    assert.equal(r.json.dryRun, true, label);
  }
  assert.deepEqual(snapshot(dir), project, "the project is unchanged");
  assert.deepEqual(snapshot(temp), temps, "the backups are unchanged");
  const preview = runDeadCode(runs["report write"], { cwd: dir, env }).json;
  assert.equal(preview.path, ".plan2code-dead-code/reports/DEAD-CODE-2026-08-03.md");
  assert.equal(preview.preview[0], "# Dead Code report");
});

test("readers: a cargo type alias keeps its full kind name", () => {
  const rec = { reason: "compiler-message", message: { code: { code: "dead_code" }, level: "warning", message: "type alias `Foo` is never used", spans: [{ file_name: "src/lib.rs", line_start: 2, line_end: 2, is_primary: true }] } };
  const r = dc.readOutput("cargo-json", JSON.stringify(rec), "/proj");
  assert.equal(r.candidates[0].kind, "type alias");
});

test("keep add without --line keeps a whole file, and keep filter hides it until the file changes", () => {
  const dir = keepProject("dc-keep-file");
  const add = runDeadCode(["keep", "add", "--file", "src/a.js", "--reason", "Loaded by name at runtime"], { cwd: dir });
  assert.equal(add.code, 0, add.stderr);
  assert.match(add.json.entry.hash, /^file:[0-9a-f]{12}$/);
  const cands = JSON.stringify([{ file: "src/a.js", line: null, name: "", kind: "file" }]);
  const filter = () => runDeadCode(["keep", "filter"], { cwd: dir, input: cands }).json;
  assert.deepEqual([filter().hidden.length, filter().shown.length], [1, 0]);
  fs.appendFileSync(path.join(dir, "src/a.js"), "// edited\n");
  const after = filter();
  assert.deepEqual([after.hidden.length, after.shown.length, after.shown[0].wasKept], [0, 1, true]);
});

test("--scope accepts a folder whose name starts with two dots", () => {
  const dir = keepProject("dc-scope-dots");
  fs.mkdirSync(path.join(dir, "..cache"));
  const r = runDeadCode(["detect", "--scope", "..cache"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.scope, "..cache");
});

test("keep remove: a whole-file entry comes off with --file alone, or with an empty --name", () => {
  const dir = keepProject("dc-keep-remove-file");
  runDeadCode(["keep", "add", "--file", "src/a.js", "--reason", "Loaded by name"], { cwd: dir });
  const first = runDeadCode(["keep", "remove", "--file", "src/a.js"], { cwd: dir });
  assert.equal(first.code, 0, first.stderr);
  assert.deepEqual(runDeadCode(["keep", "list"], { cwd: dir }).json.entries, []);
  runDeadCode(["keep", "add", "--file", "src/a.js", "--reason", "Loaded by name"], { cwd: dir });
  const second = runDeadCode(["keep", "remove", "--file", "src/a.js", "--name", ""], { cwd: dir });
  assert.equal(second.code, 0, second.stderr);
  assert.deepEqual(runDeadCode(["keep", "list"], { cwd: dir }).json.entries, []);
});

test("run: each tail line is capped at 400 characters", () => {
  const dir = tmp("dc-run-longline");
  write(dir, "pyproject.toml", "[tool.vulture]\n");
  const bin = tmp("dc-run-longline-bin");
  stub(bin, "vulture", 'console.log("x".repeat(5000));\nprocess.exitCode = 3;\n');
  const r = runDeadCode(["run", "--tool", "vulture", "--root", dir], { pathDir: bin });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.json.tail.length, 1);
  assert.equal(r.json.tail[0].length, 400);
});
