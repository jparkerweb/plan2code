// Plan2Code skill scripts: shared plumbing.
//
// Every script in a skill's scripts/ directory imports this file. It owns the
// conventions the SKILL.md prompts rely on, so they are identical everywhere:
//
//   stdout   one JSON object, always. `{ "ok": true, ... }` on success,
//            `{ "ok": false, "error": "<code>", "message": "...", "next": "..." }`
//            on a handled failure.
//   stderr   a one-line human diagnostic on failure (the same message + next).
//   exit     0 ok · 1 unexpected crash · 2 bad arguments · 3 not found ·
//            4 invalid input or a check that failed · 5 refused (would clobber
//            or break a rule).
//
// Node 18+ built-ins only, no build step: this ships inside every skill.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));

export const EXIT = { OK: 0, CRASH: 1, USAGE: 2, NOT_FOUND: 3, INVALID: 4, REFUSED: 5 };

export class CliError extends Error {
  constructor(exit, error, message, next) {
    super(message);
    this.exit = exit;
    this.error = error;
    this.next = next;
  }
}

/** Throw a handled failure: the run() wrapper prints it and sets the exit code. */
export function fail(exit, error, message, next) {
  throw new CliError(exit, error, message, next);
}

export function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

/**
 * Parse argv into { _: positionals, <flag>: value }.
 * `booleans` names flags that take no value; every other `--flag` takes the
 * next argument, and repeats of a flag listed in `lists` collect into an array.
 * `--flag=value` works too. Unknown flags are a usage error, so a typo never
 * silently changes behavior.
 */
export function parseArgs(argv, { booleans = [], values = [], lists = [] } = {}) {
  const known = new Set([...booleans, ...values, ...lists, "help"]);
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      args._.push(a);
      continue;
    }
    let name = a.slice(2);
    let value;
    const eq = name.indexOf("=");
    if (eq !== -1) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    if (!known.has(name)) {
      fail(EXIT.USAGE, "unknown-flag", `Unknown flag --${name}.`, "Run with --help for the flags this script takes.");
    }
    if (name === "help" || booleans.includes(name)) {
      args[name] = true;
      continue;
    }
    if (value === undefined) {
      if (i + 1 >= argv.length) {
        fail(EXIT.USAGE, "missing-value", `--${name} needs a value.`, "Run with --help for usage.");
      }
      value = argv[++i];
    }
    if (lists.includes(name)) (args[name] ||= []).push(value);
    else args[name] = value;
  }
  return args;
}

/**
 * Run a script's main(). Prints usage on --help, turns CliError into the JSON
 * failure shape plus an exit code, and anything else into exit 1 with the stack
 * on stderr. Sets process.exitCode rather than calling process.exit(), so
 * stdout is never cut off mid-write.
 */
export async function run(usage, main) {
  try {
    const argv = process.argv.slice(2);
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(usage.trim() + "\n");
      return;
    }
    await main(argv);
  } catch (err) {
    if (err instanceof CliError) {
      out({ ok: false, error: err.error, message: err.message, ...(err.next ? { next: err.next } : {}) });
      process.stderr.write(`error: ${err.message}${err.next ? `\nnext: ${err.next}` : ""}\n`);
      process.exitCode = err.exit;
      return;
    }
    process.stderr.write(`unexpected error: ${err && err.stack ? err.stack : err}\n`);
    out({ ok: false, error: "crash", message: String(err && err.message ? err.message : err) });
    process.exitCode = EXIT.CRASH;
  }
}

/* ------------------------------------------------------------------ time */

// PLAN2CODE_NOW ("YYYY-MM-DD HH:mm" or any Date-parsable string) pins the
// clock, for tests and for reproducing a run. Otherwise: the local clock, which
// is what "today" means to the person reading the date in their files.
export function now() {
  const pinned = process.env.PLAN2CODE_NOW;
  if (pinned) {
    const m = pinned.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    const d = new Date(pinned);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

const pad = (n) => String(n).padStart(2, "0");

/** YYYY-MM-DD */
export function isoDate(d = now()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYYMMDD */
export function compactDate(d = now()) {
  return isoDate(d).replace(/-/g, "");
}

/** YYYY-MM-DD HH:mm */
export function stamp(d = now()) {
  return `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HHMMSS */
export function clock(d = now()) {
  return `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/* ----------------------------------------------------------------- files */

export function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

export function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Write a file only when its content changes. Returns true when it wrote. */
export function writeIfChanged(file, content) {
  const current = readText(file);
  if (current === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

/** Normalise line endings for parsing; keep the original for writing back. */
export function eol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * phase-N.md per phase number. An exact phase-N.md always wins over a sibling
 * such as phase-1-old.md; more than one candidate is reported, never guessed.
 * Shared so every script that counts a spec's tasks reads the same files.
 */
export function phaseFiles(dir) {
  const files = new Map();
  const extra = new Map();
  for (const name of fs.readdirSync(dir).sort()) {
    const m = name.match(/^phase-(\d+)\b[^/]*\.md$/i);
    if (!m) continue;
    const n = Number(m[1]);
    const exact = new RegExp(`^phase-0*${n}\\.md$`, "i").test(name);
    if (!files.has(n)) files.set(n, name);
    else if (exact) {
      (extra.get(n) || extra.set(n, []).get(n)).push(files.get(n));
      files.set(n, name);
    } else (extra.get(n) || extra.set(n, []).get(n)).push(name);
  }
  files.extra = extra;
  return files;
}

/** Forward-slash path relative to root, for output the agent pastes into prompts. */
export function rel(root, p) {
  return path.relative(root, p).split(path.sep).join("/") || ".";
}

/* --------------------------------------------------------- the web console */

// The web console ships beside these scripts in every installed skill
// (references/web-console/), and in this repo it sits at src/web-console/. Its
// lib.mjs is the one home of the spec-state classifier and the loop-marker /
// metrics-bait scan, so the scripts import it rather than keep a second copy.
const CONSOLE_LIB_CANDIDATES = [
  path.join(HERE, "..", "references", "web-console", "lib.mjs"), // installed skill
  path.join(HERE, "..", "web-console", "lib.mjs"), // src/skill-scripts in the repo
];

let consoleLibPromise;
export function consoleLib() {
  consoleLibPromise ||= (async () => {
    for (const candidate of CONSOLE_LIB_CANDIDATES) {
      if (fs.existsSync(candidate)) return import(pathToFileURL(candidate).href);
    }
    fail(
      EXIT.NOT_FOUND,
      "console-lib-missing",
      `The web console's lib.mjs is not beside this script (looked in ${CONSOLE_LIB_CANDIDATES.join(", ")}).`,
      "The skill install is incomplete; reinstall the Plan2Code skills (node install.js)."
    );
  })();
  return consoleLibPromise;
}

/** The version these scripts shipped with (scripts/version.json, or the repo's). */
export function version() {
  for (const file of [path.join(HERE, "version.json"), path.join(HERE, "..", "..", "version.json")]) {
    const text = readText(file);
    if (!text) continue;
    try {
      const v = JSON.parse(text).version;
      if (typeof v === "string") return v;
    } catch {}
  }
  return null;
}
