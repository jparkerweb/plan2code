// Runs the fast test lane: the files listed under `fast` in scripts/test-lanes.json,
// through node-test.mjs so its cap of one file per spare core applies.
// Usage: node scripts/test-fast.mjs  (or: npm run test:fast)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const lanes = JSON.parse(fs.readFileSync(path.join(here, "test-lanes.json"), "utf8"));
const files = lanes.fast.map((name) => path.join(here, name));

const r = spawnSync(process.execPath, [path.join(here, "node-test.mjs"), ...files], { cwd: process.cwd(), stdio: "inherit" });
process.exit(r.status ?? 1);
