// Plan2Code Web Console - is a newer Plan2Code release out?
//
// `git ls-remote --tags` needs no API token and no rate-limited REST call,
// rides on the person's own git and proxy setup, and the newest `vX.Y.Z`
// release tag is "latest". The server
// starts this at boot and never waits on it; the answer, failures included, is
// cached for an hour so a burst of sessions asks GitHub once.
//
// Nothing here reads, stores or sends a credential: git authenticates itself,
// with every prompt turned off so a missing login fails fast instead of
// opening a window nobody asked for.
//
// Node built-ins only.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const REPO_URL = "https://github.com/jparkerweb/plan2code.git";
export const RELEASES_URL = "https://github.com/jparkerweb/plan2code/releases/";
export const CACHE_MS = 60 * 60 * 1000;

const SEMVER = /^\d+\.\d+\.\d+$/;
const TAG_REF = /refs\/tags\/v(\d+\.\d+\.\d+)$/;

/** -1, 0 or 1 comparing two plain X.Y.Z versions numerically; null unless both are X.Y.Z. */
export function compareVersions(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !SEMVER.test(a) || !SEMVER.test(b)) return null;
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

/**
 * The highest `vX.Y.Z` tag in `git ls-remote --tags` output, without the `v`.
 * Peeled lines (`^{}`) never match, so an annotated tag counts once, and
 * pre-releases or other tag names are ignored. Null when nothing matches.
 */
export function latestTag(text) {
  if (typeof text !== "string") return null;
  let best = null;
  for (const line of text.split(/\r?\n/)) {
    const m = TAG_REF.exec(line.trim());
    if (m && (best === null || compareVersions(m[1], best) > 0)) best = m[1];
  }
  return best;
}

function readCache(cacheFile, now) {
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (!cached || typeof cached.checkedAt !== "number" || now - cached.checkedAt >= CACHE_MS) return undefined;
    return typeof cached.latest === "string" ? cached.latest : null;
  } catch {
    return undefined;
  }
}

function writeCache(cacheFile, data) {
  const tmp = cacheFile + "." + process.pid + ".tmp";
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, cacheFile);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {}
  }
}

/**
 * `git ls-remote --tags` against the repo: resolves its stdout, or null when
 * git is missing, fails, or is still going after `timeoutMs`. No shell, no
 * window, no prompt.
 */
export function runLsRemote({ timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };
    if (!process.env.GIT_SSH_COMMAND) env.GIT_SSH_COMMAND = "ssh -o BatchMode=yes";
    let child;
    try {
      child = spawn("git", ["ls-remote", "--tags", REPO_URL], {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        env,
      });
    } catch {
      return resolve(null);
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      done(null);
    }, timeoutMs);
    timer.unref?.();
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("error", () => done(null));
    child.on("close", (code) => done(code === 0 ? out : null));
  });
}

/**
 * Whether `installed` is behind the newest release: `{ installed, latest,
 * updateAvailable }`, or null when either version is unknown. Reuses a cache
 * under an hour old, and caches a failed lookup as `latest: null` so it is
 * not retried until the hour is up. Never throws.
 */
export async function checkForUpdate({ installed, cacheFile, now = Date.now(), run = runLsRemote }) {
  try {
    let latest = readCache(cacheFile, now);
    if (latest === undefined) {
      latest = latestTag(await run());
      writeCache(cacheFile, { checkedAt: now, latest });
    }
    const order = compareVersions(installed, latest);
    if (latest === null || order === null) return null;
    return { installed, latest, updateAvailable: order < 0 };
  } catch {
    return null;
  }
}
