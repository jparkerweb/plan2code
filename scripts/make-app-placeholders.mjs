#!/usr/bin/env node
// Writes labeled placeholder pictures for the desktop app and the Implementation
// Loop (docs/screenshots/app-*.webp, loop-*.webp) so the docs and the landing page
// carry their final markup before the owner has captured the real window.
// Replace each file with the real capture (same name, same 2560x1600 size);
// nothing else needs editing. The shot list (state, window size, theme) is in
// specs/polish-3-2/phase-11.md's completion summary. Dev-only.
//
//   node scripts/make-app-placeholders.mjs [--browser <path>] [--force]
//
// Never overwrites a file that exists unless --force: a real capture stays.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browser.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, "docs", "screenshots");
const SHOTS = [
  ["app-launch-dark", "The launch card", "Which agent, model and effort to start on"],
  ["app-terminal-dark", "The app with the terminal docked", "The dashboard beside the agent's terminal"],
  ["loop-setup-dark", "Implementation Loop setup", "The setup screen before a run"],
  ["loop-banner-dark", "The Loop mid-run", "The banner while a phase builds"],
  ["loop-stop-dark", "The Loop's stop screen", "Why it stopped, with the evidence"],
];

const force = process.argv.includes("--force");
const flag = process.argv.indexOf("--browser");
const browser = await launchBrowser(flag > 0 ? { executablePath: process.argv[flag + 1] } : {});
try {
  const page = await browser.newPage();
  for (const [name, title, line] of SHOTS) {
    const out = path.join(DIR, `${name}.webp`);
    if (fs.existsSync(out) && !force) {
      console.log(`${name}.webp exists, kept`);
      continue;
    }
    const data = await page.evaluate(
      ([t, l]) => {
        const c = document.createElement("canvas");
        c.width = 2560;
        c.height = 1600;
        const g = c.getContext("2d");
        g.fillStyle = "#171513";
        g.fillRect(0, 0, 2560, 1600);
        g.strokeStyle = "#46403a";
        g.setLineDash([24, 16]);
        g.lineWidth = 4;
        g.strokeRect(60, 60, 2440, 1480);
        g.fillStyle = "#f0ece5";
        g.textAlign = "center";
        g.font = "700 96px sans-serif";
        g.fillText(t, 1280, 740);
        g.fillStyle = "#b6afa3";
        g.font = "400 56px sans-serif";
        g.fillText(l, 1280, 840);
        g.fillStyle = "#e0a24a";
        g.font = "600 44px sans-serif";
        g.fillText("Placeholder: the real capture goes here", 1280, 960);
        return c.toDataURL("image/webp", 0.85).split(",")[1];
      },
      [title, line],
    );
    fs.writeFileSync(out, Buffer.from(data, "base64"));
    console.log(`${name}.webp  ${Math.round(fs.statSync(out).size / 1024)} KB`);
  }
} finally {
  await browser.close();
}
