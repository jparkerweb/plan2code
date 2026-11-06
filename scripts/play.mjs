#!/usr/bin/env node
// Open a console from src/ to try the Activities games while working on them.
// The server reads every page file fresh, so saving a game and reloading the
// page is the whole cycle: no build:skills, no reinstall. Open the die in the
// top bar to pick a game. The server stops itself 30 minutes after the page closes.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "web-console", "console.mjs");
const env = { ...process.env, PLAN2CODE_CONSOLE_DEV: "1" };
const run = spawnSync(process.execPath, [cli, "open"], { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
// `open` answers the agent in JSON; a person only needs the link.
let url;
try {
  url = JSON.parse(run.stdout).url;
} catch {
  process.stdout.write(run.stdout || "");
}
if (url) console.log(`Games from src/ at ${url}
Open the die in the top bar. Save a game file, then reload the page to see it.`);
process.exit(run.status ?? 1);
