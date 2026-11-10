// Writes one version into every file that carries it, so a release never leaves one behind:
// version.json (and its releaseDate), the root package.json, README's "Version X.Y.Z" line, and
// under plan2code-app/: package.json, package-lock.json (two lines), src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml, fake-agent/Cargo.toml and Cargo.lock (the plan2code-app and fake-agent
// entries). It never touches CHANGELOG.md: write its heading by hand, then run this.
// `check-versions.mjs` is the reader of the same places and stays the judge.
//
//   node scripts/set-version.mjs [x.y.z] [--date YYYY-MM-DD] [--root <dir>]
//   npm run set-version [-- x.y.z]
//
// With no version on a terminal it shows the current one and asks (Enter takes the next patch);
// with no version and no terminal (a script, a pipe) it prints the usage line and exits 2.
// The release date defaults to today (local time). Every carrier is read and checked before any is
// written, so a file that has no version leaves the tree as it was. Exit 0 when written, 1 when a
// carrier could not be edited, 2 for bad arguments.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^\d+\.\d+\.\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d) => {
  if (!DATE.test(d)) return false;
  const at = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === d;
};

// Replace the first match of `pattern` (its first group is kept, then the new value, then its
// last group). A text edit, never a JSON round trip, so each file's formatting stays as it was.
function swap(text, pattern, value, what) {
  if (!pattern.test(text)) throw new Error(`no ${what} found`);
  return text.replace(pattern, (_, before, _old, after = "") => `${before}${value}${after}`);
}

const JSON_VERSION = /^(\s*"version"\s*:\s*")([^"]*)(")/m;
const CARGO_VERSION = /^(\s*version\s*=\s*")([^"]*)(")/m;

// A JSON file's top-level version, checked by parsing the result.
function jsonVersion(text, version, what) {
  const out = swap(text, JSON_VERSION, version, `${what} "version"`);
  if (JSON.parse(out).version !== version) throw new Error(`the first "version" in ${what} is not the top-level one`);
  return out;
}

const lockEntry = (name) => new RegExp(`(^name = "${name}"\\r?\\nversion = ")([^"]*)(")`, "m");

/** Each carrier: its path under the root and how to rewrite its text. */
const CARRIERS = [
  { file: "version.json", edit: (t, v, d) => swap(jsonVersion(t, v, "version.json"), /^(\s*"releaseDate"\s*:\s*")([^"]*)(")/m, d, "releaseDate") },
  { file: "package.json", edit: (t, v) => jsonVersion(t, v, "package.json") },
  { file: "README.md", edit: (t, v) => swap(t, /^(Version )(\d+\.\d+\.\d+)(\b)/m, v, '"Version X.Y.Z" line') },
  { file: "plan2code-app/package.json", edit: (t, v) => jsonVersion(t, v, "package.json") },
  { file: "plan2code-app/src-tauri/tauri.conf.json", edit: (t, v) => jsonVersion(t, v, "tauri.conf.json") },
  {
    file: "plan2code-app/package-lock.json",
    edit: (t, v) => {
      // The top-level version, then the one inside packages[""].
      let out = jsonVersion(t, v, "package-lock.json");
      const at = out.indexOf('"packages"');
      if (at < 0) throw new Error('no "packages" block found');
      const head = out.slice(0, at);
      const tail = swap(out.slice(at), JSON_VERSION, v, 'packages[""] "version"');
      out = head + tail;
      if (JSON.parse(out).packages?.[""]?.version !== v) throw new Error('packages[""].version was not updated');
      return out;
    },
  },
  { file: "plan2code-app/src-tauri/Cargo.toml", edit: (t, v) => swap(t, CARGO_VERSION, v, "version line") },
  { file: "plan2code-app/fake-agent/Cargo.toml", edit: (t, v) => swap(t, CARGO_VERSION, v, "version line") },
  {
    file: "plan2code-app/Cargo.lock",
    edit: (t, v) => swap(swap(t, lockEntry("plan2code-app"), v, "plan2code-app entry"), lockEntry("fake-agent"), v, "fake-agent entry"),
  },
];

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Write `version` into every carrier under `root`. Returns `{ ok, written: [file], problems: [string] }`;
 * nothing is written unless every carrier edits cleanly.
 */
export function setVersion(root, version, date = today()) {
  const problems = [];
  const staged = [];
  for (const { file, edit } of CARRIERS) {
    const full = path.join(root, file);
    try {
      const before = fs.readFileSync(full, "utf8");
      staged.push({ file, full, before, after: edit(before, version, date) });
    } catch (error) {
      problems.push(`${file}: ${error.code === "ENOENT" ? "file is missing" : error.message}`);
    }
  }
  if (problems.length) return { ok: false, written: [], problems };
  const written = [];
  try {
    for (const { file, full, before, after } of staged) {
      if (after !== before) fs.writeFileSync(full, after);
      written.push(file);
    }
  } catch (error) {
    // A write failed part way (permissions, a locked file): put back what was already written.
    for (const { file, full, before } of staged) if (written.includes(file)) fs.writeFileSync(full, before);
    return { ok: false, written: [], problems: [`write failed (${error.code || error.message}); restored the files already written`] };
  }
  return { ok: true, written, problems };
}

export const CARRIER_FILES = CARRIERS.map((c) => c.file);

// The next patch after `current` (x.y.z), or "" when `current` is not one.
export function nextPatch(current) {
  if (!SEMVER.test(current || "")) return "";
  const [major, minor, patch] = current.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

// Ask on the terminal until a valid x.y.z is typed. Enter takes the suggested next patch.
// Returns "" when the input ends (Ctrl+D, Ctrl+C) without one.
async function askVersion(root) {
  let current = "";
  try {
    current = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version || "";
  } catch {
    // No readable version.json: ask without a current version or a suggestion.
  }
  const suggested = nextPatch(current);
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, terminal: false });
  // The line iterator buffers what is typed and ends on Ctrl+D or Ctrl+C, where a pending
  // rl.question() would never settle and leave the process to exit on an unsettled await.
  const lines = rl[Symbol.asyncIterator]();
  rl.on("SIGINT", () => rl.close());
  try {
    if (current) console.log(`Current version: ${current}`);
    for (;;) {
      process.stdout.write(`New version (x.y.z)${suggested ? ` [${suggested}]` : ""}: `);
      const { value, done } = await lines.next();
      if (done) {
        process.stdout.write("\n");
        return "";
      }
      const picked = value.trim() || suggested;
      if (SEMVER.test(picked)) return picked;
      console.log(picked ? `"${picked}" is not x.y.z, for example 3.1.0.` : "Type a version, for example 3.1.0.");
    }
  } finally {
    rl.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at < 0) return undefined;
    const [, value] = args.splice(at, 2);
    return value ?? "";
  };
  const date = take("--date");
  const rootArg = take("--root");
  let [version, ...extra] = args;
  const usage = "Usage: node scripts/set-version.mjs [x.y.z] [--date YYYY-MM-DD] [--root <dir>]  (npm run set-version)";
  const root = rootArg ? path.resolve(rootArg) : ROOT;
  if (extra.length || (version !== undefined && !SEMVER.test(version)) || (date !== undefined && !validDate(date)) || rootArg === "") {
    console.error(usage);
    process.exit(2);
  }
  // No version given: ask for one on a terminal; a script or a pipe gets the usage line instead.
  if (version === undefined) {
    if (!process.stdin.isTTY) {
      console.error(usage);
      process.exit(2);
    }
    version = await askVersion(root);
    if (!version) {
      console.error("No version given. Nothing was written.");
      process.exit(2);
    }
  }
  const { ok, written, problems } = setVersion(root, version, date);
  if (!ok) {
    for (const problem of problems) console.error(`CANNOT SET: ${problem}`);
    console.error("Nothing was written.");
    process.exit(1);
  }
  for (const file of written) console.log(`${version.padEnd(10)} ${file}`);
  console.log(`Wrote ${version} to ${written.length} files. CHANGELOG.md is yours to edit; then run: node scripts/check-versions.mjs`);
}
