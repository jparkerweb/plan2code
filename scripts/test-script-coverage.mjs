// Tests for plan2code-test's scripts/coverage.mjs: lcov and go tool cover -func
// output read into per-file numbers. See skill-script-helpers.mjs for how these
// run.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { runScript, tmp, write, fixtureCleanup } from "./skill-script-helpers.mjs";

after(fixtureCleanup);

const C = (cwd, ...a) => runScript("plan2code-test", "coverage.mjs", a, { cwd });

// What `node --test --experimental-test-coverage --test-reporter=lcov` writes:
// FN/FNDA/BRDA lines around the DA lines, relative paths, one file never run.
const NODE_LCOV = `TN:
SF:src/math.js
FN:1,add
FNDA:3,add
FNF:1
FNH:1
BRDA:2,0,0,1
BRF:1
BRH:1
DA:1,1
DA:2,3
DA:3,3
DA:4,1
LH:4
LF:4
end_of_record
TN:
SF:src/unused.js
FN:1,never
FNDA:0,never
FNF:1
FNH:0
DA:1,0
DA:2,0
DA:3,0
LH:0
LF:3
end_of_record
`;

test("coverage read --lcov: Node's lcov reporter, two files, one at 0 hits", () => {
  const dir = tmp("cov-node");
  write(dir, "lcov.info", NODE_LCOV);
  const r = C(dir, "read", "--lcov", "lcov.info");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    format: "lcov",
    files: [
      { file: "src/math.js", lines: 4, hit: 4, pct: 100 },
      { file: "src/unused.js", lines: 3, hit: 0, pct: 0 },
    ],
    total: { lines: 7, hit: 4, pct: 57.1 },
  });
});

test("coverage read --lcov: Jest's absolute Windows paths under the root become relative", () => {
  const dir = tmp("cov-jest");
  const lcov = [
    "TN:",
    "SF:C:\\work\\app\\src\\b\\view.ts",
    "DA:1,1",
    "DA:2,0",
    "DA:3,1",
    "LF:3",
    "LH:2",
    "end_of_record",
    "TN:",
    "SF:c:\\work\\app\\src\\a.ts",
    "DA:1,1",
    "LF:1",
    "LH:1",
    "end_of_record",
    "TN:",
    "SF:D:\\other\\lib.ts",
    "DA:1,0",
    "LF:1",
    "LH:0",
    "end_of_record",
    "",
  ].join("\r\n");
  write(dir, "coverage/lcov.info", lcov);
  const r = C(dir, "read", "--lcov", "coverage/lcov.info", "--root", "C:\\work\\app");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(
    r.json.files.map((f) => [f.file, f.pct]),
    [
      ["D:\\other\\lib.ts", 0],
      ["src/a.ts", 100],
      ["src/b/view.ts", 66.7],
    ]
  );
});

test("coverage read --lcov: a record without LF or LH counts its DA lines", () => {
  const dir = tmp("cov-nolf");
  write(dir, "lcov.info", "SF:lib/x.py\nDA:1,2\nDA:2,0\nDA:5,1\nend_of_record\nSF:lib/empty.py\nend_of_record\n");
  const r = C(dir, "read", "--lcov", "lcov.info");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.files, [
    { file: "lib/empty.py", lines: 0, hit: 0, pct: null },
    { file: "lib/x.py", lines: 3, hit: 2, pct: 66.7 },
  ]);
  assert.deepEqual(r.json.total, { lines: 3, hit: 2, pct: 66.7 });
});

test("coverage read --go-func: functions grouped by file, the module path dropped, total reported", () => {
  const dir = tmp("cov-go");
  write(dir, "go.mod", "module example.com/shop\n\ngo 1.22\n");
  write(
    dir,
    "cover.txt",
    [
      "example.com/shop/cart/cart.go:12:\t\tAdd\t\t100.0%",
      "example.com/shop/cart/cart.go:30:\t\tRemove\t\t33.4%",
      "example.com/shop/pay/pay.go:8:\t\tCharge\t\t0.0%",
      "total:\t\t\t\t(statements)\t\t52.6%",
      "",
    ].join("\n")
  );
  const r = C(dir, "read", "--go-func", "cover.txt");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    format: "go-func",
    files: [
      { file: "cart/cart.go", lines: null, hit: null, pct: 66.7 },
      { file: "pay/pay.go", lines: null, hit: null, pct: 0 },
    ],
    total: { lines: null, hit: null, pct: 52.6 },
  });
});

test("coverage read --go-func: a nested module's files read from its own folder", () => {
  const dir = tmp("cov-go-nested");
  write(dir, "go.mod", "module example.com/shop\n\ngo 1.22\n");
  write(dir, "tools/go.mod", "module example.com/shop/tools\n\ngo 1.22\n");
  write(dir, "cover.txt", "example.com/shop/tools/gen/gen.go:5:\t\tRun\t\t50.0%\nexample.com/shop/cart/cart.go:3:\t\tAdd\t\t100.0%\n");
  const r = C(dir, "read", "--go-func", "cover.txt");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.files.map((f) => f.file), ["cart/cart.go", "tools/gen/gen.go"]);
});

test("coverage read: a missing file is exit 3", () => {
  const dir = tmp("cov-missing");
  const r = C(dir, "read", "--lcov", "nope.info");
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "no-file");
});

test("coverage read: a file in neither format is exit 4", () => {
  const dir = tmp("cov-garbage");
  write(dir, "junk.txt", "PASS  src/a.test.js\nAll files | 80 | 70 |\n");
  for (const flag of ["--lcov", "--go-func"]) {
    const r = C(dir, "read", flag, "junk.txt");
    assert.equal(r.code, 4, flag);
    assert.equal(r.json.error, "unreadable-format", flag);
  }
});

test("coverage read: exactly one format flag is required", () => {
  const dir = tmp("cov-usage");
  assert.equal(C(dir, "read").code, 2);
  assert.equal(C(dir, "read", "--lcov", "a", "--go-func", "b").code, 2);
  assert.equal(C(dir).code, 2);
});

test("coverage read --lcov --cwd: a runner's relative paths get its folder in front", () => {
  const dir = tmp("cov-cwd");
  write(dir, "lcov.info", "SF:src/x.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record\nSF:D:/elsewhere/y.ts\nDA:1,0\nLF:1\nLH:0\nend_of_record\n");
  const r = C(dir, "read", "--lcov", "lcov.info", "--cwd", "./packages/api/");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(
    r.json.files.map((f) => f.file),
    ["D:/elsewhere/y.ts", "packages/api/src/x.ts"]
  );
});
