// Fails when a scripts/test-*.mjs file is in neither list of scripts/test-lanes.json,
// is in both, or is named there but missing on disk. Prints the names and exits 1.
// Usage: node scripts/check-test-lanes.mjs [scriptsDir]  (the folder defaults to this one)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function checkLanes(dir) {
  const lanes = JSON.parse(fs.readFileSync(path.join(dir, "test-lanes.json"), "utf8"));
  const fast = lanes.fast || [];
  const skip = lanes.skipFast || [];
  const onDisk = fs.readdirSync(dir).filter((f) => /^test-.*\.mjs$/.test(f));
  const listed = new Set([...fast, ...skip]);
  const all = [...fast, ...skip];
  return {
    duplicates: [...new Set(all.filter((f, i) => all.indexOf(f) !== i && !(fast.includes(f) && skip.includes(f))))].sort(),
    unlisted: onDisk.filter((f) => !listed.has(f)).sort(),
    both: fast.filter((f) => skip.includes(f)).sort(),
    missing: [...listed].filter((f) => !onDisk.includes(f)).sort(),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.dirname(fileURLToPath(import.meta.url));
  const { unlisted, both, missing, duplicates } = checkLanes(dir);
  const out = [];
  if (unlisted.length) out.push(`In neither list of test-lanes.json (add each to fast or skipFast): ${unlisted.join(", ")}`);
  if (both.length) out.push(`In both lists: ${both.join(", ")}`);
  if (duplicates.length) out.push(`Listed twice in one list: ${duplicates.join(", ")}`);
  if (missing.length) out.push(`Named in test-lanes.json but not on disk: ${missing.join(", ")}`);
  if (out.length) {
    console.error(out.join("\n"));
    process.exit(1);
  }
  console.log("test-lanes.json lists every scripts/test-*.mjs once.");
}
