// Checks that every file carrying the product's version agrees, the desktop app's included:
// version.json, package.json, CHANGELOG.md's top heading, and the app's tauri.conf.json,
// package.json and Cargo.toml. The release-app workflow runs it before building, with
// --tag <the release tag>, so a release cannot ship an app that names another version.
//
//   node scripts/check-versions.mjs [--tag v3.0.0]
//
// Exit 0 when they agree, 1 when they do not (each file and its version is printed).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8")).version;
const CARGO_VERSION = /^\s*version\s*=\s*"([^"]+)"/m;
const CHANGELOG_HEADING = /^##\s+v?(\d+\.\d+\.\d+)\b/m;

/** Each file that carries the version, with how to read it. Paths are relative to the repo root. */
const SOURCES = [
  { file: "version.json", read: readJson },
  { file: "package.json", read: readJson },
  { file: "CHANGELOG.md", read: (file) => fs.readFileSync(file, "utf8").match(CHANGELOG_HEADING)?.[1] },
  { file: "plan2code-app/src-tauri/tauri.conf.json", read: readJson },
  { file: "plan2code-app/package.json", read: readJson },
  {
    file: "plan2code-app/src-tauri/Cargo.toml",
    // The first `version =` line is the [package] one; dependencies come after it.
    read: (file) => fs.readFileSync(file, "utf8").match(CARGO_VERSION)?.[1],
  },
];

/**
 * `{ ok, versions: [{ file, version }], problems: [string] }` for the tree at `root`. A file that
 * is missing or has no readable version is a problem, as is any disagreement, and a `tag`
 * (`v3.0.0` or `3.0.0`) that names another version.
 */
export function checkVersions(root = ROOT, { tag } = {}) {
  const versions = [];
  const problems = [];
  for (const { file, read } of SOURCES) {
    let version;
    try {
      version = read(path.join(root, file));
    } catch (error) {
      problems.push(`${file}: cannot be read (${error.code || error.message})`);
      continue;
    }
    if (!version) {
      problems.push(`${file}: no version found`);
      continue;
    }
    versions.push({ file, version });
  }
  const expected = versions.find((v) => v.file === "version.json")?.version;
  for (const { file, version } of versions) {
    if (expected && version !== expected) problems.push(`${file} says ${version}, version.json says ${expected}`);
  }
  if (tag && expected && tag.replace(/^v/, "") !== expected) {
    problems.push(`the release tag ${tag} names ${tag.replace(/^v/, "")}, version.json says ${expected}`);
  }
  return { ok: problems.length === 0, versions, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const tagAt = args.indexOf("--tag");
  const tag = tagAt >= 0 ? args[tagAt + 1] : undefined;
  if (tagAt >= 0 && !tag) {
    console.error("Usage: node scripts/check-versions.mjs [--tag v3.0.0]");
    process.exit(2);
  }
  const { ok, versions, problems } = checkVersions(ROOT, { tag });
  for (const { file, version } of versions) console.log(`${version.padEnd(10)} ${file}`);
  for (const problem of problems) console.error(`MISMATCH: ${problem}`);
  process.exit(ok ? 0 : 1);
}
