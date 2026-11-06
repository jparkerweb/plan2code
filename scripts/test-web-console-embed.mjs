// Web console tests: PLAN2CODE_EMBED_ORIGIN opt-in embed mode. With the
// variable unset the page's CSP keeps frame-ancestors 'none'; set to exactly
// one allowed origin it names that origin; set to anything else it is ignored
// and 'none' stands. Each case boots its own server with the variable in its
// environment. Shared setup: ./web-console-test-helpers.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { cookieFor, ENV, HOME, ROOT } from "./web-console-test-helpers.mjs";

const SERVER_JS = path.join(ROOT, "src", "web-console", "server.mjs");

// Boot a session server whose environment carries PLAN2CODE_EMBED_ORIGIN set
// to `origin` (or does not carry it at all when origin is undefined). Returns
// the child and its base URL; the caller always kills the child.
async function bootServer(origin) {
  const dir = fs.mkdtempSync(path.join(HOME, "embed-"));
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ sid: path.basename(dir), phase: "collecting" }));
  const env = { ...ENV };
  if (origin === undefined) delete env.PLAN2CODE_EMBED_ORIGIN;
  else env.PLAN2CODE_EMBED_ORIGIN = origin;
  const child = spawn(process.execPath, [SERVER_JS, `--session=${dir}`, "--token=t", `--project=${dir}`], {
    env,
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });
  const ready = await new Promise((resolve, reject) => {
    let buf = "";
    child.stdout.on("data", (c) => {
      buf += c;
      const line = buf.split("\n").find((l) => l.includes('"ready"'));
      if (line) resolve(JSON.parse(line));
    });
    child.on("exit", () => reject(new Error("server exited before it was ready")));
  });
  return { child, base: `http://127.0.0.1:${ready.port}` };
}

// Fetch the session page with its token cookie and resolve to the page's
// content-security-policy header.
async function cspWith(origin) {
  const { child, base } = await bootServer(origin);
  try {
    const res = await fetch(base + "/", { headers: { cookie: cookieFor(base, "t"), connection: "close" } });
    assert.equal(res.status, 200);
    await res.arrayBuffer();
    return res.headers.get("content-security-policy");
  } finally {
    child.kill();
  }
}

// Fetch the sign-in redirect and resolve to its set-cookie header.
async function cookieWith(origin) {
  const { child, base } = await bootServer(origin);
  try {
    const res = await fetch(`${base}/s/t/`, { redirect: "manual" });
    assert.equal(res.status, 302);
    await res.arrayBuffer();
    return res.headers.get("set-cookie");
  } finally {
    child.kill();
  }
}

test("with PLAN2CODE_EMBED_ORIGIN unset the header keeps frame-ancestors 'none'", async () => {
  const csp = await cspWith(undefined);
  assert.match(csp, /frame-ancestors 'none'$/);
});

test("each allowed origin is named in frame-ancestors", async () => {
  for (const origin of ["http://127.0.0.1:5173", "http://localhost:8080", "http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"]) {
    const csp = await cspWith(origin);
    assert.ok(csp.endsWith(`frame-ancestors ${origin}`), `${origin}: ${csp}`);
  }
});

test("the session cookie is Strict standalone and None; Secure under embed", async () => {
  const plain = await cookieWith(undefined);
  assert.match(plain, /SameSite=Strict/);
  assert.doesNotMatch(plain, /SameSite=None/);
  const embedded = await cookieWith("http://tauri.localhost");
  assert.match(embedded, /SameSite=None; Secure/);
});

test("anything but exactly one allowed origin keeps frame-ancestors 'none'", async () => {
  const rejected = [
    "https://example.com",
    "",
    "http://127.0.0.1:5173 https://example.com",
    "http://127.0.0.1:5173;evil",
    "http://127.0.0.1:0",
    "http://127.0.0.1:99999",
    "http://127.0.0.1",
    "https://127.0.0.1:443",
    "*",
  ];
  for (const origin of rejected) {
    const csp = await cspWith(origin);
    assert.match(csp, /frame-ancestors 'none'$/, `${JSON.stringify(origin)}: ${csp}`);
  }
});
