// Plan2Code Web Console - where the console's files live, how they are written safely, and the argument parser both command lines share.
//
// Two directories with deliberately different durability:
//
//   runtime handle  os.tmpdir()/plan2code-console/<cwd-hash>/<sid>.json
//                   port, pid, token, url. Losing it on reboot is correct,
//                   because the server is gone too. (Jupyter's jpserver-<pid>.json pattern.)
//
//   session state   ~/.plan2code/console/sessions/<sid>/
//                   the request, the human's draft, the result, the event log.
//                   Deliberately NOT under specs/: that keeps the console clear of
//                   the metrics confidence scraper and the loop's completion-marker
//                   parser, and it survives a `git clean`.
//
// Node built-ins only. No build step.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pidAlive } from "./sessions.mjs";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.join(HERE, "public");

export const HOME_DIR =
  process.env.PLAN2CODE_CONSOLE_HOME ||
  path.join(os.homedir(), ".plan2code", "console");
export const SESSIONS_DIR = path.join(HOME_DIR, "sessions");

// The person's own settings (colors, theme), shared by every session. Lives in
// HOME_DIR rather than beside a session precisely because it is NOT session
// state: a browser ties localStorage to the origin, and the origin carries the
// ephemeral port, so the file under this dir is the only copy of a preference
// that survives the next session's new port.
// Model menus for the `plan2code` launcher. The shipped list (bin/models.json) is the
// authors' and is overwritten by every install; the user's additions (models.json) are
// theirs. The launcher reads both. PLAN2CODE_MODELS_DIR moves them, for tests.
export const PLAN2CODE_DIR = process.env.PLAN2CODE_MODELS_DIR || path.join(os.homedir(), ".plan2code");
export const SHIPPED_MODELS_FILE = path.join(PLAN2CODE_DIR, "bin", "models.json");
export const USER_MODELS_FILE = path.join(PLAN2CODE_DIR, "models.json");

export const LOOKS_FILE = path.join(HOME_DIR, "looks.json");

// The newest Plan2Code release tag, as last asked of GitHub (update-check.mjs),
// so every session within the hour reuses one lookup.
export const UPDATE_CHECK_FILE = path.join(HOME_DIR, "update-check.json");

// The runtime dir has to follow PLAN2CODE_CONSOLE_HOME too. Without that, a
// test run (or a second sandboxed instance) shares one handle directory with
// the real thing, and `stop --all` reaches outside its own world and kills a
// session someone is actually using.
export const RUNTIME_DIR = process.env.PLAN2CODE_CONSOLE_HOME
  ? path.join(process.env.PLAN2CODE_CONSOLE_HOME, "runtime")
  : path.join(os.tmpdir(), "plan2code-console");

export const SCHEMA = 1;

/* ------------------------------------------------------------------ args */

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > -1) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

/* ------------------------------------------------------------------- fs */

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Atomic replace. The waiter polls result.json and WILL land mid-write eventually.
//
// The retry loop is not paranoia: on Windows, antivirus and the search indexer
// hold transient locks that surface as EPERM/EBUSY from rename. It is intermittent,
// unreproducible on demand, and looks exactly like a logic bug. Retry from day one.
export function writeJsonAtomic(file, data) {
  const tmp = file + "." + process.pid + ".tmp";
  const body = JSON.stringify(data, null, 2);
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const fd = fs.openSync(tmp, "w");
      try {
        fs.writeFileSync(fd, body);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, file);
      return body;
    } catch (err) {
      lastErr = err;
      if (err.code !== "EPERM" && err.code !== "EBUSY" && err.code !== "EACCES") break;
      sleepSync(40 * (attempt + 1));
    }
  }
  try {
    fs.rmSync(tmp, { force: true });
  } catch {}
  throw lastErr;
}

// A cheap "has this file changed?" fingerprint: one stat instead of a read and
// a parse. An atomic write replaces the file, so a new write always moves at
// least one of these. "" for a file that is not there.
export function fileStamp(file) {
  try {
    const st = fs.statSync(file, { throwIfNoEntry: false });
    return st ? `${st.mtimeMs}:${st.size}:${st.ino}` : "";
  } catch {
    return "";
  }
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

export function appendEvent(dir, event) {
  const line = JSON.stringify({ at: nowIso(), ...event });
  fs.appendFileSync(path.join(dir, "events.ndjson"), line + "\n");
  return line;
}

/* ----------------------------------------------------- the state lock */

// state.json has two writers in two processes: console.mjs (`open` and `post`,
// the agent's side) and the server (`/submit` stamps the phase and records
// what was sent on each item). Each writer reads the file, changes it and
// writes it back, so two of them overlapping lose whichever wrote first. Every
// read-modify-write of state.json therefore runs under this lock, a file
// created with O_EXCL beside it. The sections it guards are a read, a merge
// and a write, milliseconds long, so a lock older than LOCK_STALE_MS, or one
// whose holder has died, is a crash left behind and is broken. The wait runs
// past the stale age, so a writer always gets in eventually.
export const STATE_LOCK_FILE = "state.json.lock";
const LOCK_STALE_MS = 5000;
const LOCK_WAIT_MS = 7000;

function lockStale(lock) {
  try {
    const st = fs.statSync(lock);
    if (Date.now() - st.mtimeMs > LOCK_STALE_MS) return true;
    const pid = Number.parseInt(fs.readFileSync(lock, "utf8"), 10);
    return Number.isInteger(pid) && pid > 0 && pid !== process.pid && !pidAlive(pid);
  } catch (err) {
    // Gone between the failed create and this look: free, so try again.
    return err.code === "ENOENT";
  }
}

// Run fn while holding the session's state lock, and release it however fn
// ends. fn must not call process.exit(): the release would never run, and the
// next writer would wait out the stale age.
export function withStateLock(dir, fn, lockName = STATE_LOCK_FILE) {
  const lock = path.join(dir, lockName);
  const deadline = Date.now() + LOCK_WAIT_MS;
  let fd = null;
  for (let attempt = 0; fd === null; attempt++) {
    try {
      fd = fs.openSync(lock, "wx");
    } catch (err) {
      // EPERM / EACCES: on Windows, a lock being deleted still blocks a create.
      if (!["EEXIST", "EPERM", "EACCES", "EBUSY"].includes(err.code)) throw err;
      if (Date.now() > deadline) throw new Error(`${lockName.replace(/.lock$/, "")} is busy with another writer; try again`);
      if (err.code === "EEXIST" && lockStale(lock)) {
        try {
          fs.rmSync(lock, { force: true });
        } catch {}
        continue;
      }
      sleepSync(Math.min(5 * (attempt + 1), 50));
    }
  }
  try {
    try {
      fs.writeSync(fd, String(process.pid));
    } finally {
      fs.closeSync(fd);
    }
    return fn();
  } finally {
    try {
      fs.rmSync(lock, { force: true });
    } catch {}
  }
}

// The one way to change state.json: under the lock, read it fresh, hand it to
// fn (null when there is no state yet, with the raw text beside it), and write
// back whatever fn returns. A null return writes nothing. Returns the written
// state and its text, or null.
export function updateState(dir, fn) {
  const file = path.join(dir, "state.json");
  return withStateLock(dir, () => {
    let text = null;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {}
    let state = null;
    try {
      state = text === null ? null : JSON.parse(text);
    } catch {}
    const next = fn(state, text);
    if (!next) return null;
    return { state: next, text: writeJsonAtomic(file, next) };
  });
}

export function sleepSync(ms) {
  // Node built-ins only, and this runs in short one-shot CLI commands.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function nowIso() {
  return new Date().toISOString();
}

// Every whole, parsable object line of an ndjson file, in order.
export function readJsonLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = text.split("\n");
  lines.pop(); // "" after a complete last line, or the half-written one
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry === "object") out.push(entry);
    } catch {}
  }
  return out;
}

// Append one JSON line to an ndjson file, returning what was stored.
export function appendJsonLine(file, stored) {
  let lead = "";
  try {
    const st = fs.statSync(file);
    // A fragment left by a crash mid-append must not swallow this line too.
    if (st.size > 0) {
      const fd = fs.openSync(file, "r");
      try {
        const b = Buffer.alloc(1);
        fs.readSync(fd, b, 0, 1, st.size - 1);
        if (b[0] !== 0x0a) lead = "\n";
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch {}
  const line = lead + JSON.stringify(stored) + "\n";
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.appendFileSync(file, line);
      return stored;
    } catch (err) {
      lastErr = err;
      if (err.code !== "EPERM" && err.code !== "EBUSY" && err.code !== "EACCES") break;
      sleepSync(40 * (attempt + 1));
    }
  }
  throw lastErr;
}
