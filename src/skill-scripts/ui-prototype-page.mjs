// ui-prototype-page.mjs: build a prototype page from a round and the shipped
// shell, and unpack a built page back into its round facts and variants.
//
// buildPage(round, shell, media) -> { html, parts: [{ what, bytes }] }
//   round: readRound()'s result; shell: { html, css, js, base } (the text of
//   shell.html, shell.css, shell.js and base.css); media (optional): the
//   variants and images from embedImages() and the rules from embedFonts().
//   parts come largest first.
// unpackPage(html) -> { facts, frames: { <letter>: { doc, content } }, outside }
//   or null when the text is not a prototype page. `outside` is the page with
//   every frame and the round facts taken out: the shell's own text.
// embedImages(round) and embedFonts(round) read only the files round.json
// lists, and turn them into data: URLs within LIMITS.

import fs from "node:fs";
import path from "node:path";
import { FONT_SETS } from "./ui-prototype-round.mjs";

const MB = 1024 * 1024;

// The limits, in one place: Finalize revisits the font numbers against a real project.
export const LIMITS = {
  image: 1 * MB, // one image; past it, a labeled placeholder
  allImages: 3 * MB, // every embedded image together; past it, a warning
  fontFiles: 4, // app font files; past either font limit, the fallback set
  fonts: 2 * MB, // app font files together
  ceiling: 5 * MB, // the whole page, a soft ceiling: a warning, never a stop
};

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const APP_FONT = "App font";
const APP_FAMILY = "P2C App Font";

const PLACEHOLDERS = {
  styles: "<!-- p2c:tool-styles -->",
  frames: "<!-- p2c:frames -->",
  script: "<!-- p2c:script -->",
};

const FRAME_RE = /<iframe class="p2c-frame" data-variant="([A-E])" sandbox="allow-same-origin" srcdoc="([^"]*)"><\/iframe>/g;
const FACTS_RE = /<script type="application\/json" id="p2c-round">([\s\S]*?)<\/script>/;
const BODY_OPEN = "<body>";
const BODY_CLOSE = "</body></html>";

const bytes = (text) => Buffer.byteLength(text, "utf8");

/** A count of bytes as short text: 1.2 MB, 340 KB. */
export function size(n) {
  return n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Escape text for a double-quoted attribute: & first, then ". */
export function escapeAttr(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** The inverse of escapeAttr, in one pass so neither replacement feeds the other. */
export function unescapeAttr(text) {
  return text.replace(/&(amp|quot);/g, (_, name) => (name === "amp" ? "&" : '"'));
}

/** Write JSON safe to sit inside a <script> element: every < as <. */
export function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The starting values for one variant: the shared starts with its own on top. */
export function startsFor(facts, letter) {
  const own = (facts.variants.find((v) => v.letter === letter) || {}).starts || {};
  return { ...facts.starts, ...own };
}

/** One variant's frame document: base.css, then the variant inside <body>. */
export function frameDocument(facts, letter, base, content) {
  const s = startsFor(facts, letter);
  const attrs = `data-p2c-theme="${s.theme}" data-p2c-state="${s.state}" data-p2c-length="${s.length}" data-p2c-kind="${facts.kind}"`;
  return `<!doctype html><html lang="en" ${attrs}><head><meta charset="utf-8"><style>\n${base}\n</style></head>${BODY_OPEN}${content}${BODY_CLOSE}`;
}

/** Replace one placeholder, failing loudly when the shell lacks it. */
function fill(html, marker, text) {
  const at = html.indexOf(marker);
  if (at === -1 || html.indexOf(marker, at + marker.length) !== -1) {
    throw new Error(`The page shell must hold ${marker} exactly once.`);
  }
  return html.slice(0, at) + text + html.slice(at + marker.length);
}

/* ------------------------------------------------------------------ images */

/** An image file's media type by its first bytes, or null when it is none of the four. */
export function imageType(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  const head = buf.subarray(0, 512).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^<svg[\s>]/i.test(head) || /^<\?xml[\s?]/i.test(head)) return "image/svg+xml";
  return null;
}

const xmlText = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The labeled stand-in for an image too large to embed, as a data: URL. */
export function placeholderUrl(name) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">` +
    `<rect x="1" y="1" width="318" height="178" fill="#e5e7eb" stroke="#9ca3af" stroke-dasharray="6 4"/>` +
    `<text x="160" y="84" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#374151">${xmlText(name)}</text>` +
    `<text x="160" y="106" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#6b7280">image too large to embed</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A listed file's bytes (its path read from the round folder), or null when it cannot be read. */
function readListed(folder, file) {
  try {
    return fs.readFileSync(path.resolve(folder, file));
  } catch {
    return null;
  }
}

/** A tag with its alt attribute set to `alt` (added when it has none). */
function setAlt(tag, alt) {
  const value = `"${alt.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
  const re = /(\salt\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]*)/i;
  if (re.test(tag)) return tag.replace(re, (_, pre) => pre + value);
  return tag.replace(/\s*\/?>$/, (end) => ` alt=${value}${end}`);
}

/**
 * Put round.images into the variants. Each image is decided by its first
 * bytes: a supported one up to LIMITS.image becomes a data: URL, a larger one
 * a labeled placeholder, anything else is skipped (src left empty, alt the
 * name). A name is matched as src="<name>" or src="p2c-image:<name>" (either
 * quote) on any tag, and as url(<name>) inside a <style> block. An SVG only
 * ever lands as a data: URL source, never as markup.
 * Returns { variants, images: [{ name, url, bytes, embedded }], warnings }.
 */
export function embedImages(round) {
  const warnings = [];
  const images = [];
  let variants = round.variants.map((v) => ({ ...v }));
  for (const entry of round.facts.images) {
    const buf = readListed(round.folder, entry.path);
    const type = buf ? imageType(buf) : null;
    let url = null;
    let embedded = false;
    if (!buf) {
      warnings.push(`Image ${entry.path} could not be read, so "${entry.name}" was skipped.`);
    } else if (!type) {
      warnings.push(`Image ${entry.path} is not a PNG, JPEG, WebP or SVG file, so "${entry.name}" was skipped.`);
    } else if (buf.length > LIMITS.image) {
      url = placeholderUrl(entry.name);
      warnings.push(`Image ${entry.path} is ${size(buf.length)}, over the 1 MB limit for one image, so "${entry.name}" shows as a labeled placeholder.`);
    } else {
      url = `data:${type};base64,${buf.toString("base64")}`;
      embedded = true;
    }
    images.push({ name: entry.name, url, bytes: buf ? buf.length : 0, embedded });

    const name = escapeRe(entry.name);
    const srcRe = new RegExp(`(\\ssrc\\s*=\\s*)(["'])(?:p2c-image:)?${name}\\2`, "i");
    const srcAll = new RegExp(srcRe.source, "gi");
    const urlRe = new RegExp(`url\\(\\s*(["']?)(?:p2c-image:)?${name}\\1\\s*\\)`, "gi");
    variants = variants.map((v) => {
      let n = 0;
      // A tag runs to the first `>` outside a quoted value, so `title="a > b"` before `src` is still one tag.
      let content = v.content.replace(/<[a-z](?:[^>"']|"[^"]*"|'[^']*')*>/gi, (tag) => {
        if (!srcRe.test(tag)) return tag;
        if (!url) return setAlt(tag.replace(srcAll, (_, pre, q) => pre + q + q), entry.name);
        return tag.replace(srcAll, (_, pre, q) => {
          n++;
          return pre + q + url + q;
        });
      });
      content = content.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, (block) =>
        block.replace(urlRe, () => {
          if (!url) return "none";
          n++;
          return `url("${url}")`;
        })
      );
      // How many times each image went into this variant, for the size report.
      return { ...v, content, uses: { ...v.uses, [entry.name]: n } };
    });
  }
  const shown = images.filter((i) => i.embedded);
  const total = shown.reduce((n, i) => n + i.bytes, 0);
  if (total > LIMITS.allImages) {
    const largest = [...shown].sort((a, b) => b.bytes - a.bytes)[0];
    warnings.push(`The images together are ${size(total)}, over the 3 MB limit for all images; the largest is "${largest.name}" (${size(largest.bytes)}).`);
  }
  return { variants, images, warnings };
}

/* ------------------------------------------------------------------- fonts */

/** A font file's format by its first bytes: [media type, CSS format()] or null. */
export function fontType(buf) {
  if (buf.length < 4) return null;
  const tag = buf.toString("latin1", 0, 4);
  if (tag === "wOF2") return ["font/woff2", "woff2"];
  if (tag === "wOFF") return ["font/woff", "woff"];
  if (tag === "OTTO") return ["font/otf", "opentype"];
  if (tag === "true" || (buf[0] === 0 && buf[1] === 1 && buf[2] === 0 && buf[3] === 0)) return ["font/ttf", "truetype"];
  return null;
}

/** The weight and style a font file's name says: a number from 100 to 900 or bold, and italic. */
export function fontFace(file) {
  const base = path.basename(file).toLowerCase();
  const num = base.match(/(?:^|[^0-9])([1-9]00)(?![0-9])/);
  return { weight: num ? num[1] : base.includes("bold") ? "700" : "normal", style: base.includes("italic") ? "italic" : "normal" };
}

/**
 * The app's own font from round.fonts: up to LIMITS.fontFiles files and
 * LIMITS.fonts bytes together, each a WOFF2, WOFF, TTF or OTF by its first
 * bytes, as @font-face rules for the family "P2C App Font", with
 * --p2c-font-set-app falling back to the round's own font set. Past a limit,
 * or with no usable file, nothing is embedded and the warning says the
 * closest system set is used. A terminal has no font dial: nothing embeds.
 * Returns { rules: [{ what, css }], appFont, warnings }.
 */
export function embedFonts(round) {
  const { facts } = round;
  if (!facts.fonts.length || facts.kind === "terminal") return { rules: [], appFont: false, warnings: [] };
  const fallback = facts.starts.fontSet;
  const warnings = [];
  const fallBack = (why) => {
    warnings.push(`${why}, so no app font was embedded and the closest system set, ${fallback}, is used.`);
    return { rules: [], appFont: false, warnings };
  };
  if (facts.fonts.length > LIMITS.fontFiles) return fallBack(`The round lists ${facts.fonts.length} font files, over the limit of ${LIMITS.fontFiles}`);
  const usable = [];
  for (const file of facts.fonts) {
    const buf = readListed(round.folder, file);
    const type = buf ? fontType(buf) : null;
    if (!buf) warnings.push(`Font ${file} could not be read and was skipped.`);
    else if (!type) warnings.push(`Font ${file} is not a WOFF2, WOFF, TTF or OTF file and was skipped.`);
    else usable.push({ file, buf, type });
  }
  if (!usable.length) return fallBack("No listed font file could be used");
  const total = usable.reduce((n, f) => n + f.buf.length, 0);
  if (total > LIMITS.fonts) return fallBack(`The font files together are ${size(total)}, over the 2 MB limit`);
  const rules = usable.map(({ file, buf, type: [mime, format] }) => {
    const { weight, style } = fontFace(file);
    return {
      what: `font ${path.basename(file)}`,
      css: `@font-face { font-family: "${APP_FAMILY}"; src: url(data:${mime};base64,${buf.toString("base64")}) format("${format}"); font-weight: ${weight}; font-style: ${style}; }`,
    };
  });
  const slug = (FONT_SETS.includes(fallback) ? fallback : FONT_SETS[0]).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  rules.push({ what: "base stylesheet", css: `:root { --p2c-font-set-app: "${APP_FAMILY}", var(--p2c-font-set-${slug}); }` });
  return { rules, appFont: true, warnings };
}

/* -------------------------------------------------------------------- page */

export function buildPage(round, shell, media = {}) {
  const { facts } = round;
  const variants = media.variants || round.variants;
  const images = (media.images || []).filter((i) => i.url);
  const rules = media.rules || [];
  const parts = [];
  const add = (what, n) => {
    const known = parts.find((p) => p.what === what);
    if (known) known.bytes += n;
    else parts.push({ what, bytes: n });
  };
  add("shell", bytes(shell.html) + bytes(shell.css) + bytes(shell.js));

  // The app font's rules sit in every frame's base styles, after base.css.
  const base = rules.length ? `${shell.base}\n${rules.map((r) => r.css).join("\n")}` : shell.base;
  const frames = variants.map((v) => {
    const empty = escapeAttr(frameDocument(facts, v.letter, base, ""));
    const full = escapeAttr(frameDocument(facts, v.letter, base, v.content));
    let shared = bytes(empty);
    for (const r of rules) {
      const n = bytes(escapeAttr(`\n${r.css}`));
      add(r.what, n);
      shared -= n;
    }
    add("base stylesheet", shared);
    let own = bytes(full) - bytes(empty);
    for (const im of images) {
      const n = (v.uses && v.uses[im.name]) || 0;
      if (!n) continue;
      add(`image ${im.name}`, n * bytes(im.url));
      own -= n * bytes(im.url);
    }
    add(`variant ${v.letter}`, own);
    return `<iframe class="p2c-frame" data-variant="${v.letter}" sandbox="allow-same-origin" srcdoc="${full}"></iframe>`;
  });

  const factsJson = scriptJson(facts);
  add("round facts", bytes(factsJson));

  if (/<\/script/i.test(shell.js)) throw new Error("shell.js must not hold a closing script tag.");
  if (/<\/style/i.test(shell.css)) throw new Error("shell.css must not hold a closing style tag.");

  // The frames go in last: variant text is the model's, and escapeAttr leaves
  // a comment such as <!-- p2c:script --> in it untouched, so no placeholder
  // search may run over it.
  let html = shell.html;
  html = fill(html, PLACEHOLDERS.styles, `<style>\n${shell.css}\n</style>`);
  html = fill(
    html,
    PLACEHOLDERS.script,
    `<script type="application/json" id="p2c-round">${factsJson}</script>\n<script>\n${shell.js}\n</script>`
  );
  html = fill(html, PLACEHOLDERS.frames, frames.join("\n"));
  parts.sort((a, b) => b.bytes - a.bytes);
  return { html, parts };
}

/** A built page with its round facts' `file` set to `file`; null when it is not a prototype page. */
export function withFile(html, file) {
  const m = FACTS_RE.exec(html);
  if (!m) return null;
  let facts;
  try {
    facts = JSON.parse(m[1]);
  } catch {
    return null;
  }
  facts.file = file;
  const open = m[0].slice(0, m[0].length - m[1].length - "</script>".length);
  return html.slice(0, m.index) + open + scriptJson(facts) + "</script>" + html.slice(m.index + m[0].length);
}

export function unpackPage(html) {
  const factsMatch = FACTS_RE.exec(html);
  if (!factsMatch) return null;
  let facts;
  try {
    facts = JSON.parse(factsMatch[1]);
  } catch {
    return null;
  }
  const frames = {};
  for (const m of html.matchAll(FRAME_RE)) {
    const doc = unescapeAttr(m[2]);
    const open = doc.indexOf(BODY_OPEN);
    const content = open !== -1 && doc.endsWith(BODY_CLOSE) ? doc.slice(open + BODY_OPEN.length, doc.length - BODY_CLOSE.length) : null;
    frames[m[1]] = { doc, content };
  }
  const outside = html.replace(FRAME_RE, "").replace(FACTS_RE, "");
  return { facts, frames, outside };
}
