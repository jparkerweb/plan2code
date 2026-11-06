// Turn CRLF line endings back into LF in the working tree.
//
// .gitattributes stores every text file as LF and checks it out as LF, so git
// itself never puts a CRLF on disk. Tools do: a Python script writing in text
// mode on Windows, an editor, a generator. A CRLF file still commits clean
// (git normalizes it), but until then it inflates scripts/validate-char-count.js,
// fills `git diff` and `git status` with warnings, and trips tests that read the
// raw bytes. This puts the working tree back the way git would check it out.
//
//   node scripts/fix-line-endings.mjs            fix every text file git sees
//   node scripts/fix-line-endings.mjs --check    list them, exit 1 if any
//   node scripts/fix-line-endings.mjs --hook     fix the one file a Claude Code
//                                                PostToolUse hook names on stdin
//   --root <dir>                                 work on another repo (tests)
//
// "Every text file git sees" is what is tracked plus what is untracked but not
// ignored, less anything .gitattributes marks binary or that holds a NUL byte.
// npm test runs the fix first (pretest), so every suite reads LF.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootAt = args.indexOf("--root");
const ROOT = path.resolve(rootAt >= 0 ? args[rootAt + 1] : path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const mode = args.includes("--hook") ? "hook" : args.includes("--check") ? "check" : "fix";

const git = (gitArgs, input) => execFileSync("git", ["-C", ROOT, ...gitArgs], { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// The repo's files that are tracked, or untracked and not ignored, relative to
// ROOT with forward slashes.
function repoFiles() {
  return git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
}

// The files .gitattributes marks binary (or -text), never to be touched.
function binaries(files) {
  if (!files.length) return new Set();
  const out = git(["check-attr", "-z", "--stdin", "binary", "text"], files.join("\0") + "\0").split("\0");
  const skip = new Set();
  for (let i = 0; i + 2 < out.length; i += 3) {
    const [file, attr, value] = [out[i], out[i + 1], out[i + 2]];
    if ((attr === "binary" && value === "set") || (attr === "text" && value === "unset")) skip.add(file);
  }
  return skip;
}

// Rewrites one file with LF endings if it has any CRLF. Returns whether it did.
function fixFile(abs, write) {
  let bytes;
  try {
    if (!fs.statSync(abs).isFile()) return false;
    bytes = fs.readFileSync(abs);
  } catch {
    return false;
  }
  if (bytes.includes(0) || !bytes.includes("\r\n")) return false;
  if (write) fs.writeFileSync(abs, bytes.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
  return true;
}

// The file a PostToolUse hook for Write or Edit names, fixed if it is a text
// file inside the repo that git would check out. Never fails the tool call.
function hook() {
  let file = "";
  try {
    const event = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
    file = (event.tool_input && (event.tool_input.file_path || event.tool_input.notebook_path)) || (event.tool_response && event.tool_response.filePath) || "";
  } catch {
    return;
  }
  if (!file) return;
  const abs = path.resolve(file);
  const rel = path.relative(ROOT, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return;
  const relGit = rel.split(path.sep).join("/");
  try {
    if (git(["check-ignore", "-q", "--no-index", relGit]) !== null) return;
  } catch {
    // check-ignore exits 1 when the path is not ignored: carry on.
  }
  if (binaries([relGit]).size) return;
  if (fixFile(abs, true)) process.stdout.write(`fix-line-endings: ${relGit} had CRLF line endings, now LF\n`);
}

if (mode === "hook") {
  try {
    hook();
  } catch {}
  process.exit(0);
}

const files = repoFiles();
const skip = binaries(files);
const found = files.filter((f) => !skip.has(f) && fixFile(path.join(ROOT, f), mode === "fix"));
if (mode === "check") {
  if (found.length) {
    console.error(`${found.length} file(s) have CRLF line endings (run: npm run fix:eol):`);
    for (const f of found) console.error(`  ${f}`);
    process.exit(1);
  }
  process.exit(0);
}
if (found.length) {
  console.log(`fix-line-endings: ${found.length} file(s) turned from CRLF to LF:`);
  for (const f of found) console.log(`  ${f}`);
}
