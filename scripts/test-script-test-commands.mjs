// test-commands.mjs discover: one fixture per ecosystem, run from the built
// plan2code-init skill. See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runScript, tmp, write } from "./skill-script-helpers.mjs";

function discover(files) {
  const dir = tmp("cmds");
  for (const [rel, content] of Object.entries(files)) write(dir, rel, typeof content === "string" ? content : JSON.stringify(content));
  const r = runScript("plan2code-init", "test-commands.mjs", ["discover"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.ok, true);
  return r.json;
}

test("npm project: suite, lint, types and build checks", () => {
  const r = discover({ "package.json": { scripts: { test: "node --test", lint: "eslint .", typecheck: "tsc --noEmit", build: "tsc" } } });
  assert.deepEqual(r.suite, { cmd: "npm test", why: "package.json scripts.test" });
  assert.deepEqual(r.runners, [{ cmd: "npm test", cwd: ".", covers: ["**"] }]);
  assert.deepEqual(r.checks, [
    { kind: "lint", cmd: "npm run lint" },
    { kind: "types", cmd: "npm run typecheck" },
    { kind: "build", cmd: "npm run build" },
  ]);
  assert.deepEqual(r.coverage, [{ runner: "node", cmd: "node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=\"<out>\"", cwd: ".", reads: "lcov" }]);
  assert.equal(r.builtin, null);
});

test("the lockfile picks the package manager; tsconfig gives npx tsc", () => {
  const r = discover({ "package.json": { scripts: { test: "jest", lint: "eslint ." } }, "pnpm-lock.yaml": "", "tsconfig.json": "{}" });
  assert.equal(r.suite.cmd, "pnpm test");
  assert.deepEqual(r.checks, [
    { kind: "lint", cmd: "pnpm run lint" },
    { kind: "types", cmd: "npx tsc --noEmit" },
  ]);
  assert.equal(discover({ "package.json": { scripts: { test: "x" } }, "yarn.lock": "" }).suite.cmd, "yarn test");
  assert.equal(discover({ "package.json": { scripts: { test: "x" } }, "bun.lock": "" }).suite.cmd, "bun test");
});

test("npm's placeholder test script is no suite", () => {
  const r = discover({ "package.json": { scripts: { test: 'echo "Error: no test specified" && exit 1' } } });
  assert.equal(r.suite, null);
  assert.deepEqual(r.runners, []);
  assert.deepEqual(r.builtin, { language: "node", cmd: "node --test" });
});

test("npm workspaces array: one runner per package with a test script", () => {
  const r = discover({
    "package.json": { workspaces: ["packages/*"], scripts: { test: "npm test --workspaces" } },
    "packages/a/package.json": { scripts: { test: "node --test" } },
    "packages/b/package.json": { scripts: { test: "vitest" }, devDependencies: { vitest: "1", "@vitest/coverage-v8": "1" } },
    "packages/c/package.json": { scripts: {} },
  });
  assert.deepEqual(r.runners, [
    { cmd: "npm test", cwd: ".", covers: ["**"] },
    { cmd: "npm test", cwd: "packages/a", covers: ["packages/a/**"] },
    { cmd: "npm test", cwd: "packages/b", covers: ["packages/b/**"] },
  ]);
  assert.deepEqual(r.coverage.map((c) => [c.runner, c.cwd]), [["node", "packages/a"], ["vitest", "packages/b"]]);
});

test("pnpm workspace: packages lines and the { packages } form", () => {
  const r = discover({
    "package.json": { name: "root" },
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - \"libs/core\"\n  - '!apps/skip'\n",
    "apps/web/package.json": { scripts: { test: "vitest" } },
    "apps/skip/package.json": { scripts: { test: "vitest" } },
    "libs/core/package.json": { scripts: { test: "jest" } },
  });
  assert.equal(r.suite, null);
  assert.deepEqual(r.runners, [
    { cmd: "pnpm test", cwd: "apps/web", covers: ["apps/web/**"] },
    { cmd: "pnpm test", cwd: "libs/core", covers: ["libs/core/**"] },
  ], "a ! line excludes its folders");
  assert.deepEqual(r.coverage, [{ runner: "jest", cmd: "npx jest --coverage --coverageReporters=lcov", cwd: "libs/core", reads: "lcov" }]);
  const inline = discover({
    "package.json": { name: "root" },
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": "packages: ['apps/*', \"!apps/skip\"]\n",
    "apps/web/package.json": { scripts: { test: "vitest" } },
    "apps/skip/package.json": { scripts: { test: "vitest" } },
  });
  assert.deepEqual(inline.runners, [{ cmd: "pnpm test", cwd: "apps/web", covers: ["apps/web/**"] }], "an inline packages list works too");
  const obj = discover({ "package.json": { workspaces: { packages: ["pkgs/*"] } }, "pkgs/x/package.json": { scripts: { test: "t" } } });
  assert.deepEqual(obj.runners, [{ cmd: "npm test", cwd: "pkgs/x", covers: ["pkgs/x/**"] }]);
});

test("Go module with a nested second module", () => {
  const r = discover({ "go.mod": "module example.com/a\n", "main.go": "package main\n", "tools/go.mod": "module example.com/tools\n" });
  assert.deepEqual(r.runners, [
    { cmd: "go test ./...", cwd: ".", covers: ["**"] },
    { cmd: "go test ./...", cwd: "tools", covers: ["tools/**"] },
  ]);
  assert.deepEqual(r.coverage[0], { runner: "go", cmd: "go test -coverprofile=\"<out>\" ./... && go tool cover -func=\"<out>\"", cwd: ".", reads: "go-func" });
  assert.equal(r.builtin, null);
});

test("Cargo workspace: one runner at the root, members run from it", () => {
  const r = discover({
    "Cargo.toml": '[workspace]\nmembers = ["crates/a"]\n',
    "crates/a/Cargo.toml": '[package]\nname = "a"\n',
    "crates/a/src/lib.rs": "",
  });
  assert.deepEqual(r.runners, [{ cmd: "cargo test", cwd: ".", covers: ["**"] }]);
});

test("pytest project and plain Python project", () => {
  const py = discover({ "pyproject.toml": "[tool.pytest.ini_options]\naddopts = \"-q\"\n", "pkg/a.py": "" });
  assert.deepEqual(py.runners, [{ cmd: "python -m pytest", cwd: ".", covers: ["**"] }]);
  assert.deepEqual(py.coverage, [], "no pytest-cov, no coverage");
  const plain = discover({ "setup.cfg": "[metadata]\nname = x\n", "x/a.py": "" });
  assert.deepEqual(plain.runners, [{ cmd: "python -m unittest", cwd: ".", covers: ["**"] }]);
  const req = discover({ "tox.ini": "[tox]\n", "requirements-dev.txt": "pytest==8\n" });
  assert.equal(req.runners[0].cmd, "python -m pytest");
});

test(".NET project", () => {
  const r = discover({ "App.sln": "", "src/App/App.csproj": "<Project />", "tests/App.Tests/App.Tests.csproj": "<Project />" });
  assert.deepEqual(r.runners, [{ cmd: "dotnet test", cwd: ".", covers: ["**"] }]);
  assert.deepEqual(r.coverage, []);
});

test("Makefile-only project: make test is the suite and the root runner", () => {
  const r = discover({ Makefile: "build:\n\tcc a.c\n\ntest: build\n\t./run-tests\n" });
  assert.deepEqual(r.suite, { cmd: "make test", why: "Makefile test target" });
  assert.deepEqual(r.runners, [{ cmd: "make test", cwd: ".", covers: ["**"] }]);
  assert.equal(discover({ Makefile: "build:\n\tcc a.c\n" }).suite, null);
});

test("coverage is listed only with its add-on present", () => {
  const vitest = (extra) => discover({ "package.json": { scripts: { test: "vitest" }, devDependencies: { vitest: "1", ...extra } } });
  assert.deepEqual(vitest({ "@vitest/coverage-v8": "1" }).coverage, [{ runner: "vitest", cmd: "npx vitest run --coverage --coverage.reporter=lcov", cwd: ".", reads: "lcov" }]);
  assert.deepEqual(vitest({}).coverage, []);

  const pytest = (deps) => discover({ "pyproject.toml": `[project]\ndependencies = [${deps}]\n` });
  assert.deepEqual(pytest('"pytest", "pytest-cov"').coverage, [{ runner: "pytest", cmd: "python -m pytest --cov --cov-report=lcov:\"<out>\"", cwd: ".", reads: "lcov" }]);
  assert.deepEqual(pytest('"pytest"').coverage, []);
  const nested = discover({ "requirements-dev.txt": "pytest-cov\n", "svc/setup.cfg": "[tool:pytest]\n" });
  assert.deepEqual(nested.coverage, [{ runner: "pytest", cmd: "python -m pytest --cov --cov-report=lcov:\"<out>\"", cwd: "svc", reads: "lcov" }], "pytest-cov listed in a folder above the runner");

  const dotnet = (ref) => discover({ "App.Tests/App.Tests.csproj": `<Project><ItemGroup>${ref}</ItemGroup></Project>` });
  assert.deepEqual(dotnet('<PackageReference Include="coverlet.collector" Version="6" />').coverage, [{ runner: "dotnet", cmd: 'dotnet test --collect:"XPlat Code Coverage"', cwd: "App.Tests", reads: "lcov" }]);
  assert.deepEqual(dotnet("").coverage, []);
});

test("builtin: an empty Node project, a Python-only folder, and others in a mixed folder", () => {
  assert.deepEqual(discover({ "package.json": { name: "x" } }).builtin, { language: "node", cmd: "node --test" });
  assert.deepEqual(discover({ "a.py": "", "lib/b.py": "" }).builtin, { language: "python", cmd: "python -m unittest" });
  const mixed = discover({ "package.json": { name: "x" }, "index.js": "", "a.py": "", "b.py": "", "c.py": "" });
  assert.deepEqual(mixed.builtin, { language: "python", cmd: "python -m unittest", others: [{ language: "node", cmd: "node --test" }] });
  assert.equal(discover({ "README.md": "hi" }).builtin, null);
});

test("skipped folders are never walked; bad input is a usage error", () => {
  const r = discover({ "node_modules/x/go.mod": "module x\n", "vendor/y/Cargo.toml": "[package]\n", "a.txt": "" });
  assert.deepEqual(r.runners, []);
  const dir = tmp("cmds-bad");
  assert.equal(runScript("plan2code-init", "test-commands.mjs", ["list"], { cwd: dir }).code, 2);
  assert.equal(runScript("plan2code-init", "test-commands.mjs", ["discover", "--root", "nope"], { cwd: dir }).code, 3);
});
