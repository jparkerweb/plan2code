// Runs page test files the way CI does: the PLAN2CODE_* app variables are
// unset first, because inherited from the desktop app (or an agent running
// inside it) they fail about a dozen unrelated tests. Files run through
// node-test.mjs, so its cap of one file per spare core applies. Extra
// arguments (such as --test-name-pattern "<name>") pass straight through.
// Usage: npm run test:page -- scripts/test-web-console-page-layout.mjs

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const env = { ...process.env };
for (const name of Object.keys(env)) if (name.startsWith("PLAN2CODE_") && /^PLAN2CODE_(IN_APP|APP_|EMBED_ORIGIN|CONSOLE_SID|LOOP_STRENGTH)/.test(name)) delete env[name];

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: npm run test:page -- <scripts/test-web-console-page-*.mjs ...> [--test-name-pattern <name>]");
  process.exit(2);
}
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), "node-test.mjs");
const r = spawnSync(process.execPath, [runner, ...args], { env, stdio: "inherit" });
process.exit(r.status ?? 1);
