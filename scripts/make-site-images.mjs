#!/usr/bin/env node
// Writes the 1280px-wide variants of the landing page's hero pictures next to
// the 2560px originals (`<name>-1280.webp`), for the page's srcset. Dev-only.
//
//   node scripts/make-site-images.mjs [--browser <path>]
//
// Rerun it after capture-screenshots.mjs. Playwright has no WebP encoder of
// its own, so the browser's canvas does the resize and the WebP export.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browser.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, "docs", "screenshots");
const HERO = ["dashboard-plan-dark", "question-dark", "build-dark", "signoff-dark"];

const flag = process.argv.indexOf("--browser");
const browser = await launchBrowser(flag > 0 ? { executablePath: process.argv[flag + 1] } : {});
try {
  const page = await browser.newPage();
  for (const name of HERO) {
    const src = "data:image/webp;base64," + fs.readFileSync(path.join(DIR, `${name}.webp`)).toString("base64");
    const data = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 1280;
      c.height = Math.round((img.naturalHeight * 1280) / img.naturalWidth);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/webp", 0.85).split(",")[1];
    }, src);
    const out = path.join(DIR, `${name}-1280.webp`);
    fs.writeFileSync(out, Buffer.from(data, "base64"));
    console.log(`${path.basename(out)}  ${Math.round(fs.statSync(out).size / 1024)} KB`);
  }
} finally {
  await browser.close();
}
