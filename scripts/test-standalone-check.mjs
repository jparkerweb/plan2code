// Standalone check: with PLAN2CODE_EMBED_ORIGIN unset the console page's
// Content-Security-Policy is byte for byte the value it always was. Guards
// the embed opt-in from ever narrowing or widening the default header.
// Shared setup: ./web-console-test-helpers.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { cookieFor, ENV, HOME, ROOT } from "./web-console-test-helpers.mjs";

const SERVER_JS = path.join(ROOT, "src", "web-console", "server.mjs");

const EXPECTED_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "font-src 'self'; connect-src 'self'; media-src 'self'; " +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

test("with PLAN2CODE_EMBED_ORIGIN unset the page CSP is the pre-embed string byte for byte", async () => {
  const dir = fs.mkdtempSync(path.join(HOME, "standalone-"));
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ sid: path.basename(dir), phase: "collecting" }));
  const env = { ...ENV };
  delete env.PLAN2CODE_EMBED_ORIGIN;
  const child = spawn(process.execPath, [SERVER_JS, `--session=${dir}`, "--token=t", `--project=${dir}`], {
    env,
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
    const base = `http://127.0.0.1:${ready.port}`;
    const res = await fetch(base + "/", { headers: { cookie: cookieFor(base, "t"), connection: "close" } });
    assert.equal(res.status, 200);
    await res.arrayBuffer();
    assert.equal(res.headers.get("content-security-policy"), EXPECTED_CSP);
  } finally {
    child.kill();
  }
});
