#!/usr/bin/env node
// Plan2Code Web Console - the forwarding stub every skill carries.
//
// The console itself is installed once, under ~/.plan2code/console/<version>/,
// and shared by every skill. This file finds that copy through the
// `console-dir` pointer, checks it is the version this skill was built for,
// and runs it with the same arguments. Without a matching copy it prints one
// plain line and exits 5, so the agent can offer the terminal instead.
//
// install.js bakes the version in below when it builds the skill.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VERSION = "__PLAN2CODE_VERSION__";
const MISSING = "The Plan2Code console is missing or out of date. Run: plan2code update";

function sharedConsole() {
  const home = process.env.PLAN2CODE_CONSOLE_HOME || path.join(os.homedir(), ".plan2code", "console");
  // The installer always puts this version at <home>/<version>/, so look there first: console-dir
  // names whichever console opened last, which may be a source checkout or another version.
  const dirs = [path.join(home, VERSION)];
  try {
    const pointed = fs.readFileSync(path.join(home, "console-dir"), "utf8").trim();
    if (pointed) dirs.push(pointed);
  } catch {
    /* no pointer: the version folder alone */
  }
  for (const dir of dirs) {
    try {
      const entry = path.join(dir, "console.mjs");
      if (!fs.statSync(entry).isFile()) continue;
      if (fs.readFileSync(path.join(dir, "version.txt"), "utf8").trim() !== VERSION) continue;
      return entry;
    } catch {
      /* try the next place */
    }
  }
  return null;
}

const entry = sharedConsole();
if (!entry) {
  process.stderr.write(MISSING + "\n");
  process.exit(5);
}
// The shared console reads process.argv itself and sets its own exit code.
await import(pathToFileURL(entry).href);
