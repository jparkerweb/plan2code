#!/usr/bin/env node
// The cheapest check for a stylesheet move: every element's computed style, on
// every screen the console has, in both themes, at desktop and phone width.
// Dev-only, not in `npm test`. Stages the screens the way
// scripts/capture-screenshots.mjs does (its --snapshot mode), so the sample
// project and payloads are the same.
//
//   node scripts/css-snapshot.mjs [--out <file>]       write a snapshot
//   node scripts/css-snapshot.mjs --compare <file>     take one now and print every difference
//
// Take a baseline before moving any rule, then compare after each move. Two
// runs in a row on the same stylesheet report nothing: Math.random is pinned,
// a property a running animation is moving is recorded as "~" (its animation
// fields are still compared), and heights within 4px are ignored (see jitter).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CAPTURE = path.join(ROOT, "scripts", "capture-screenshots.mjs");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : true;
}

function take(file) {
  // The screenshot script wants a folder to exist for --compare; nothing is written to it.
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-css-snap-"));
  try {
    const r = spawnSync(process.execPath, [CAPTURE, "--compare", "--snapshot", file, "--out", out], { stdio: ["ignore", "inherit", "inherit"] });
    if (r.status !== 0) {
      console.error("the snapshot run failed");
      process.exit(1);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

const NAMES = [
  "display", "position", "top", "right", "bottom", "left", "width", "height", "min-width", "max-width", "min-height", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "color", "background-color", "background-image", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-top-left-radius",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform",
  "gap", "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "justify-content", "align-self",
  "overflow-x", "overflow-y", "opacity", "visibility", "transform", "z-index", "box-shadow", "cursor", "pointer-events", "white-space",
  "content", "outline-style", "transform-origin", "fill", "stroke",
];
const ANIMATION = ["animation-name", "animation-duration", "animation-delay", "animation-iteration-count", "animation-timing-function", "animation-direction", "animation-fill-mode"];

// A growing answer box at phone width settles a few pixels either way from one
// run to the next with the same stylesheet; the heights it carries up the page
// (and the transform origin, which is half of one) are not a stylesheet's doing.
const JITTER = new Set(["height", "min-height", "transform-origin"]);
function jitter(name, a, b) {
  if (!JITTER.has(name)) return false;
  const na = a.match(/-?\d+(?:\.\d+)?/g);
  const nb = b.match(/-?\d+(?:\.\d+)?/g);
  return !!na && !!nb && na.length === nb.length && na.every((n, i) => Math.abs(n - nb[i]) <= 4);
}

function compare(before, after) {
  const diffs = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (!a || !b) {
      diffs.push(`${key}: screen ${a ? "missing from the new run" : "is new"}`);
      continue;
    }
    for (const el of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[el] === b[el] || el.includes("p.dock-say")) continue; // the one line of Planny that types itself in, so its width moves
      if (a[el] === undefined || b[el] === undefined) {
        diffs.push(`${key} ${el}: element ${a[el] === undefined ? "added" : "gone"}`);
        continue;
      }
      const x = a[el].split("|");
      const y = b[el].split("|");
      const names = NAMES.concat(ANIMATION);
      x.forEach((v, i) => {
        if (v !== y[i] && v !== "~" && y[i] !== "~" && !jitter(names[i], v, y[i])) diffs.push(`${key} ${el} ${names[i] ?? i}: ${v} -> ${y[i]}`);
      });
    }
  }
  return diffs;
}

if (args.compare === true) {
  console.error("usage: node scripts/css-snapshot.mjs --compare <snapshot file>   (or --out <file> to take one)");
  process.exit(1);
} else if (typeof args.compare === "string") {
  const tmp = path.join(os.tmpdir(), `p2c-css-snap-${process.pid}.json`);
  take(tmp);
  const diffs = compare(JSON.parse(fs.readFileSync(args.compare, "utf8")), JSON.parse(fs.readFileSync(tmp, "utf8")));
  fs.rmSync(tmp, { force: true });
  for (const d of diffs.slice(0, 200)) console.log(d);
  if (diffs.length > 200) console.log(`... and ${diffs.length - 200} more`);
  console.log(diffs.length ? `${diffs.length} difference(s)` : "no differences");
  process.exit(diffs.length ? 1 : 0);
} else {
  const out = path.resolve(typeof args.out === "string" ? args.out : "css-snapshot.json");
  take(out);
  console.log(`wrote ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
}
