#!/usr/bin/env node
// Captures the CSS the vendored OverType would inject, as a real stylesheet.
// Dev-only: lives in scripts/ so it never ships inside a skill.
//
//   node scripts/vendor-overtype.mjs
//
// The console's content-security policy (`style-src 'self'`) blocks the
// <style> OverType adds to the page, so the notepad sets
// `OverType.stylesInjected = true` and ships the same rules in
// src/web-console/public/styles/notepad.css instead. This script loads
// public/vendor/overtype.esm.js in a blank page, calls
// `OverType.injectStyles(true)` and writes what landed in
// `style.overtype-styles` between the header and the end marker below. The
// notepad's own rules, after the marker, are kept as they are. Run it again
// after upgrading the vendored file.
//
// Needs playwright-core (a root devDependency) and a local Chrome or Edge,
// launched through scripts/browser.mjs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browser.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, "src", "web-console", "public");
const VENDOR = path.join(PUBLIC, "vendor", "overtype.esm.js");
const OUT = path.join(PUBLIC, "styles", "notepad.css");

export const HEADER = "/* OverType 2.6.1 generated CSS: regenerate with node scripts/vendor-overtype.mjs */";
export const END_MARKER = "/* end OverType */";

// A made-up origin served from here, so the module loads as it does on the
// page: as a module, from a URL, with nothing else around it.
const ORIGIN = "http://overtype.invalid";

async function capture() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route(`${ORIGIN}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/overtype.esm.js") {
        return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(VENDOR) });
      }
      return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>OverType CSS</title>" });
    });
    await page.goto(`${ORIGIN}/`);
    return await page.evaluate(async (src) => {
      const { OverType } = await import(src);
      OverType.injectStyles(true);
      const style = document.querySelector("style.overtype-styles");
      return style ? style.textContent : null;
    }, `${ORIGIN}/overtype.esm.js`);
  } finally {
    await browser.close();
  }
}

// The generated block, then whatever followed the marker before (the
// notepad's own rules), or nothing on a first run. A stylesheet with rules but
// no marker is refused: rewriting it would delete them.
export function assemble(css, existing) {
  const at = existing.indexOf(END_MARKER);
  if (at === -1 && existing.trim()) {
    throw new Error(`notepad.css has no "${END_MARKER}" marker, so its own rules cannot be told apart: put the marker back, then run this again.`);
  }
  const own = at === -1 ? "" : existing.slice(at + END_MARKER.length);
  const body = css.trim().split("\n").map((line) => line.replace(/\s+$/, "")).join("\n");
  return `${HEADER}\n${body}\n${END_MARKER}${own || "\n"}`;
}

const css = await capture().catch((e) => {
  console.error(e.browserProblem ? e.message : `Could not capture OverType's CSS: ${e.message}`);
  process.exit(1);
});
if (!css) {
  console.error("OverType injected no style.overtype-styles element.");
  process.exit(1);
}
const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
let out;
try {
  out = assemble(css, existing);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
fs.writeFileSync(OUT, out);
console.log(`Wrote ${path.relative(ROOT, OUT)} (${css.length} characters of OverType CSS).`);
