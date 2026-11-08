// Web console tests: hardening fixes (cookies per port, handle files, tokens
// that look like flags, failed writes, bad CLI input). Each test opens its own
// session. Shared setup: ./web-console-test-helpers.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "../src/web-console/files.mjs";
import { BASE, cli, consoleSession, cookieFor, ENV, HOME, payload, ROOT } from "./web-console-test-helpers.mjs";

const SERVER_JS = path.join(ROOT, "src", "web-console", "server.mjs");

test("another console's cookie beside ours does not lock this one out", async () => {
  const s = consoleSession(["--file", payload("cookie-pair.json", BASE)]);
  try {
    const token = s.opened.url.match(/\/s\/([^/]+)\//)[1];
    const port = Number(new URL(s.base).port);
    const other = `p2c_console_${port + 1}=someone-else`;
    const both = await fetch(s.base + "/state", { headers: { cookie: `${other}; ${cookieFor(s.base, token)}` } });
    assert.equal(both.status, 200);
    await both.arrayBuffer();
    const theirsOnly = await fetch(s.base + "/state", { headers: { cookie: other } });
    assert.equal(theirsOnly.status, 403);
    await theirsOnly.arrayBuffer();
    // The old shared name is no longer honored.
    const legacy = await fetch(s.base + "/state", { headers: { cookie: `p2c_console=${token}` } });
    assert.equal(legacy.status, 403);
    await legacy.arrayBuffer();
  } finally {
    cli(["stop", "--session", s.sid, "--force"]);
  }
});

test("a server removes its own handle file when it exits, and only its own", async () => {
  const project = fs.mkdtempSync(path.join(HOME, "handle-exit-"));
  const dir = fs.mkdtempSync(path.join(HOME, "handle-exit-session-"));
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ sid: path.basename(dir), phase: "collecting" }));
  const handleDir = path.join(HOME, "runtime");
  // A clean exit on request, the same on every platform: kill() on Windows is
  // TerminateProcess, which runs no exit hook at all. The preload stands in
  // for the idle deadline, whose process.exit() is what this hook is for.
  const preload = path.join(HOME, "exit-on-message.cjs");
  fs.writeFileSync(preload, 'process.on("message", (m) => { if (m === "exit") process.exit(0); });\n');
  const start = () =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["-r", preload, SERVER_JS, `--session=${dir}`, "--token=t", `--project=${project}`], {
        env: ENV,
        stdio: ["ignore", "pipe", "ignore", "ipc"],
        windowsHide: true,
      });
      let buf = "";
      child.stdout.on("data", (c) => {
        buf += c;
        if (buf.includes('"ready"')) resolve(child);
      });
      child.on("exit", () => reject(new Error("server exited before it was ready")));
    });
  const handleOf = () => {
    for (const bucket of fs.readdirSync(handleDir)) {
      const file = path.join(handleDir, bucket, path.basename(dir) + ".json");
      if (fs.existsSync(file)) return file;
    }
    return null;
  };
  const stopped = (child) => new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)));

  const first = await start();
  const file = handleOf();
  assert.ok(file, "the server wrote its handle");
  first.send("exit");
  await stopped(first);
  assert.equal(fs.existsSync(file), false, "an exit takes the handle with it");

  // A handle rewritten by a replacement server is left alone.
  const second = await start();
  const mine = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...mine, pid: process.pid }));
  second.send("exit");
  await stopped(second);
  assert.equal(fs.existsSync(file), true, "another process's handle survives this one's exit");
  fs.rmSync(file, { force: true });
});

// newToken() is base64url, so one token in 32 or so starts with "-", and
// some with "--". Passed as two words, parseArgs read it as the next flag.
test("a token that starts with -- survives the trip to the server", async () => {
  assert.equal(parseArgs(["--token", "--abc"]).token, true, "the two-word form is the hazard");
  const parsed = parseArgs(["--session=/s", "--token=--abc=d", "--project=/p", "--handoff"]);
  assert.deepEqual([parsed.session, parsed.token, parsed.project, parsed.handoff], ["/s", "--abc=d", "/p", true]);

  const dir = fs.mkdtempSync(path.join(HOME, "dash-token-"));
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ sid: path.basename(dir), phase: "collecting" }));

  // A server that ends up with no string token refuses to start at all.
  for (const tokenArgs of [[], ["--token", "--dashy"], ["--token="]]) {
    const res = spawnSync(process.execPath, [SERVER_JS, `--session=${dir}`, ...tokenArgs, `--project=${dir}`], {
      env: ENV,
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(res.status, 2, `refused: ${JSON.stringify(tokenArgs)}`);
    assert.match(res.stderr, /a token is required/);
  }

  const child = spawn(process.execPath, [SERVER_JS, `--session=${dir}`, "--token=--dashy", `--project=${dir}`], {
    env: ENV,
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });
  try {
    const ready = await new Promise((resolve, reject) => {
      let buf = "";
      child.stdout.on("data", (c) => {
        buf += c;
        const line = buf.split("\n").find((l) => l.includes('"ready"'));
        if (line) resolve(JSON.parse(line));
      });
      child.on("exit", () => reject(new Error("server exited before it was ready")));
    });
    assert.equal(ready.url, `http://127.0.0.1:${ready.port}/`, "the ready line carries no token");
    const res = await fetch(`${ready.url}s/--dashy/`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.ok(res.headers.get("set-cookie").startsWith(`p2c_console_${ready.port}=--dashy;`));
  } finally {
    child.kill();
  }
});

// The command line of a process is readable by anyone on the machine (ps,
// Task Manager), and server.log is the server's stdout. Neither may carry the
// session token: `open` hands it over in a one-shot file the server deletes.
function commandLineOf(pid) {
  const res =
    process.platform === "win32"
      ? spawnSync("powershell", ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`], {
          encoding: "utf8",
          windowsHide: true,
        })
      : spawnSync("ps", ["-o", "args=", "-p", String(pid)], { encoding: "utf8" });
  return String(res.stdout || "");
}

test("the session token is in neither the server's arguments nor server.log", async () => {
  const s = consoleSession(["--file", payload("token-off-argv.json", BASE)]);
  try {
    const token = s.opened.url.match(/\/s\/([^/]+)\//)[1];
    let handle = null;
    const runtime = path.join(HOME, "runtime");
    for (const bucket of fs.readdirSync(runtime)) {
      const file = path.join(runtime, bucket, s.sid + ".json");
      if (fs.existsSync(file)) handle = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    assert.ok(handle?.pid, "the server wrote its handle");
    assert.equal(handle.token, token, "the server took the token open made");

    const args = commandLineOf(handle.pid);
    assert.match(args, /server\.mjs/, "read the server's own command line");
    assert.match(args, /--token-file=server-token-/);
    assert.ok(!args.includes(token), "the token is not on the command line");

    const log = fs.readFileSync(path.join(s.session, "server.log"), "utf8");
    assert.match(log, /"ready"/, "the server logged its ready line");
    assert.ok(!log.includes(token), "the token is not in server.log");
    assert.deepEqual(
      fs.readdirSync(s.session).filter((f) => f.startsWith("server-token-")),
      [],
      "the one-shot token file is gone once read"
    );

    // The page still signs in with it.
    const res = await fetch(s.base + "/state", { headers: { cookie: cookieFor(s.base, token), connection: "close" } });
    assert.equal(res.status, 200);
    await res.arrayBuffer();
  } finally {
    cli(["stop", "--session", s.sid, "--force"]);
  }
});

test("a cancel that could not be written answers 500 and tells nobody", async () => {
  const s = consoleSession(["--file", payload("cancel-500.json", BASE)]);
  try {
    // A folder where the server's temp file goes, so the atomic write cannot
    // even start. (A folder at result.json itself reads as a pending result.)
    const blocker = path.join(s.session, `result.json.${s.opened.pid}.tmp`);
    fs.mkdirSync(blocker);
    fs.writeFileSync(path.join(blocker, "x"), "");
    const res = await s.send("/cancel", {});
    assert.equal(res.status, 500);
    await res.arrayBuffer();
    const events = fs.readFileSync(path.join(s.session, "events.ndjson"), "utf8");
    assert.doesNotMatch(events, /"type":"cancel"/, "no cancel event for a cancel that never landed");
    fs.rmSync(blocker, { recursive: true, force: true });
    assert.equal((await s.send("/cancel", {})).status, 200, "and once it can land, it does");
  } finally {
    cli(["stop", "--session", s.sid, "--force"]);
  }
});

test("wait refuses a --seconds that is not a number instead of spinning", () => {
  const s = consoleSession(["--file", payload("wait-seconds.json", BASE)]);
  try {
    for (const bad of ["abc", "NaN", ""]) {
      const res = cli(["wait", "--session", s.sid, `--seconds=${bad}`], { expectFail: true });
      assert.equal(res.status, 2, `--seconds=${bad}`);
      assert.match(res.stderr, /--seconds must be a number/);
    }
  } finally {
    cli(["stop", "--session", s.sid, "--force"]);
  }
});

test("a fresh open whose --file is refused leaves no session folder behind", () => {
  const sessionsDir = path.join(HOME, "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  const before = new Set(fs.readdirSync(sessionsDir));
  const unreadable = path.join(HOME, "not-json.json");
  fs.writeFileSync(unreadable, "{ nope");
  const tooMany = { items: [1, 2, 3, 4].map((n) => ({ id: "x" + n, kind: "text", title: "Question " + n, body: "b" })) };
  const cases = [
    [["--file", unreadable], 2],
    [["--file", path.join(HOME, "no-such-file.json")], 2],
    [["--file", payload("open-too-many.json", tooMany)], 3],
    [["--file", payload("open-bad-run.json", { run: { event: "nap", id: "x" } })], 3],
  ];
  for (const [extra, code] of cases) {
    const res = cli(["open", "--no-open", ...extra], { expectFail: true });
    assert.equal(res.status, code, extra.join(" "));
  }
  const after = fs.readdirSync(sessionsDir).filter((n) => !before.has(n));
  assert.deepEqual(after, [], "no orphan session folders");
});

// Show me it working: an image block may only point at a picture the agent
// saved directly inside the session's shots/ folder, and only a real one.
test("an image block outside the session's shots folder, or not an image, is refused", () => {
  const s = consoleSession(["--file", payload("shots-safety.json", BASE)]);
  try {
    const shots = path.join(s.session, "shots");
    fs.mkdirSync(shots, { recursive: true });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const outside = path.join(HOME, "outside-shot.png");
    fs.writeFileSync(outside, png);
    fs.writeFileSync(path.join(s.session, "beside.png"), png);
    fs.writeFileSync(path.join(shots, "renamed.png"), "just some text, not a picture\n");
    fs.writeFileSync(path.join(shots, "huge.png"), Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]));
    const cases = [
      ["../../outside-shot.png", /outside the session's shots\/ folder/],
      [outside, /outside the session's shots\/ folder/],
      ["beside.png", /outside the session's shots\/ folder/],
      ["shots/missing.png", /does not exist/],
      ["shots/renamed.png", /not a PNG image/],
      ["shots/huge.png", /larger than 5 MB/],
    ];
    let linked = false;
    try {
      fs.symlinkSync(outside, path.join(shots, "link.png"), "file");
      linked = true;
    } catch {
      // Windows without the symlink privilege: the realpath check is still covered by the cases above.
    }
    if (linked) cases.push(["shots/link.png", /outside the session's shots\/ folder/]);
    for (const [image, why] of cases) {
      const patch = { docs: [{ id: "shown", title: "Shown", blocks: [{ id: "b1", image, alt: "The page" }] }] };
      const res = cli(["post", "--session", s.sid, "--file", payload("shots-bad.json", patch)], { expectFail: true });
      assert.equal(res.status, 3, image);
      assert.match(res.stderr, why, image);
    }
    const both = { docs: [{ id: "shown", title: "Shown", blocks: [{ id: "b1", image: "shots/renamed.png", md: "x" }] }] };
    const res = cli(["post", "--session", s.sid, "--file", payload("shots-both.json", both)], { expectFail: true });
    assert.equal(res.status, 3);
    assert.match(res.stderr, /cannot also carry "md" or "file"/);
  } finally {
    cli(["stop", "--session", s.sid, "--force"]);
  }
});

// A route callback that threw used to run twice (readBody's catch fed the
// throw back in as a parse error) or leave the request hanging (readRaw). It
// now answers once with 400, runs once, and the throw still reaches the
// process's uncaughtException handler, which the real server logs. Run in a
// child so that rethrow lands on a handler like the server's, not the runner's.
test("a route callback that throws answers once with 400 and runs once", () => {
  const routes = path.join(ROOT, "src", "web-console", "routes.mjs");
  const script = `
    import http from "node:http";
    import { readBody, readRaw } from ${JSON.stringify(pathToFileURL(routes).href)};
    const caught = [];
    process.on("uncaughtException", (e) => caught.push(e.message));
    const calls = { body: 0, raw: 0 };
    const server = http.createServer((req, res) => {
      if (req.url === "/body") return readBody(req, res, () => { calls.body++; throw new Error("body boom"); });
      if (req.url === "/half") return readBody(req, res, () => { calls.body++; res.writeHead(200); res.write("x"); throw new Error("half boom"); });
      return readRaw(req, res, 1024, () => { calls.raw++; throw new Error("raw boom"); });
    });
    server.listen(0, "127.0.0.1", async () => {
      const base = "http://127.0.0.1:" + server.address().port;
      const out = {};
      for (const p of ["/body", "/raw", "/half"]) {
        const r = await fetch(base + p, { method: "POST", body: p === "/raw" ? "bytes" : "{}" });
        out[p] = { status: r.status, text: await r.text() };
      }
      await new Promise((r) => setTimeout(r, 50));
      process.stdout.write(JSON.stringify({ out, calls, caught }));
      server.close();
    });
  `;
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 15000, windowsHide: true });
  assert.equal(res.status, 0, res.stderr);
  const { out, calls, caught } = JSON.parse(res.stdout);
  assert.equal(out["/body"].status, 400);
  assert.match(out["/body"].text, /bad request/);
  assert.equal(out["/raw"].status, 400);
  assert.deepEqual([out["/half"].status, out["/half"].text], [200, "x"], "a started answer is ended, not answered twice");
  assert.deepEqual(calls, { body: 2, raw: 1 }, "each callback ran once");
  assert.deepEqual(caught.sort(), ["body boom", "half boom", "raw boom"], "every throw still reaches the process handler");
});

// ── The metrics scrape pattern: one shared source, no drift ──────────────────

test("the bait scanner, the skill scripts and the collector read one metrics pattern", async () => {
  const { SCRAPE } = await import("../src/skill-scripts/common.mjs");
  const shared = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "web-console", "metrics-pattern.json"), "utf8"));
  const collectorCopy = fs.readFileSync(path.join(ROOT, "plan2code-metrics", "src", "metrics-pattern.json"), "utf8");
  assert.equal(
    collectorCopy,
    fs.readFileSync(path.join(ROOT, "src", "web-console", "metrics-pattern.json"), "utf8"),
    "plan2code-metrics/src/metrics-pattern.json must be a byte-for-byte copy of src/web-console/metrics-pattern.json",
  );
  const bySource = (re) => `${re.source}/${re.flags}`;
  const scripts = new Map(SCRAPE.map((s) => [s.name, bySource(s.re)]));
  for (const c of shared.confidence) assert.equal(scripts.get(c.name), `${c.source}/${c.flags}`, `skill scripts' "${c.name}" drifted from the shared pattern`);
  for (const b of shared.breakdown) assert.equal(scripts.get(`bare ${b.name} + number`), `${b.source}/${b.flags}`, `skill scripts' ${b.name} pattern drifted from the shared pattern`);
  assert.equal(SCRAPE.length, shared.confidence.length + shared.breakdown.length);
});

test("an ordinary table row that pairs Risk with a number is accepted, the real scrape shapes are refused", async () => {
  const { proseProblems } = await import("../src/web-console/patches.mjs");
  for (const ok of [
    "| Risk | 3 | High |",
    "| Requirements | 7 | Medium | Owner |",
    "| R2 | Slow build | A risk to the plan | High |",
    "Risk-assessment 22/25",
  ]) {
    assert.deepEqual(proseProblems(ok), [], ok);
  }
  for (const bad of ["Risk: 3", "Risk 3", "Requirements 22 of 25", "| Requirements | 24 |", "| Integration | 23/25 |", "- Feasibility: 23"]) {
    const found = proseProblems(bad);
    assert.equal(found.length, 1, bad);
    assert.match(found[0], /metrics collector scrapes that pattern/);
  }
});
