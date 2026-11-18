#!/usr/bin/env node
// Renders scripts/social-card.html to docs/social-card.png (1200x630), the
// image the landing page's og:image points at (twitter:card falls back to it). Dev-only.
//
//   node scripts/make-social-card.mjs [--browser <path>]
//
// Rerun it after docs/screenshots/signoff-dark.webp changes. Needs
// playwright-core (a root devDependency) and a local Chrome or Edge.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser } from "./browser.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const flag = process.argv.indexOf("--browser");
const browser = await launchBrowser(flag > 0 ? { executablePath: process.argv[flag + 1] } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(ROOT, "scripts", "social-card.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const out = path.join(ROOT, "docs", "social-card.png");
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`wrote ${path.relative(ROOT, out)}`);
} finally {
  await browser.close();
}
