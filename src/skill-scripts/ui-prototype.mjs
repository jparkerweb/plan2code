#!/usr/bin/env node
// ui-prototype.mjs: the UI Prototype skill's commands. The model writes a
// round (round.json plus one file per variant, to the contract in
// ui-prototype-contract.md); this script assembles the page around the
// shipped shell, checks it, opens it, reads a pasted choice back and saves it.
// The shell sits at ../references/ui-prototype-shell/ beside this file in a
// built skill.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EXIT, fail, out, parseArgs, run, readText, now, rel } from "./common.mjs";
import { readRound, STATES, LENGTHS, NAME_RE } from "./ui-prototype-round.mjs";
import { buildPage, unpackPage, embedImages, embedFonts, withFile, size, LIMITS, IMAGE_TYPES, APP_FONT } from "./ui-prototype-page.mjs";
import { draftsRoot, projectDrafts, roundFolder, pagePath, isInside, fold } from "./ui-prototype-drafts.mjs";
import { parseBlock, cleanBlock, FIRST_LINE } from "./ui-prototype-block.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHELL_DIR = path.join(HERE, "..", "references", "ui-prototype-shell");
const CEILING = LIMITS.ceiling;
const DRAFT_DAYS = 30;
const ROUND_DIR_RE = /^round-(\d+)$/;

const USAGE = `
ui-prototype.mjs: build, check, open and save UI prototype pages. JSON on stdout.

  node ui-prototype.mjs sweep --project <root>
      Delete this project's prototype drafts (round folders and pages under
      ~/.plan2code/prototypes/<project key>/) older than 30 days, then any
      prototype folder left empty. Prints { ok, draftsDir, removed }.

  node ui-prototype.mjs new-round --project <root> --name <name>
      Create the next round folder for a prototype in this project's drafts.
      Prints { ok, round, folder, page }: write round.json and the variant
      files into folder; assemble writes the page to page.

  node ui-prototype.mjs assemble --round <folder>
      Read <folder>/round.json and its variant files, embed the listed images
      and app fonts, build the page around the shipped shell and write it
      beside the folder as <name>-round-<N>.html (inside the drafts, also
      recorded as the page's File). Prints { ok, file, bytes, parts (largest
      first), warnings }.

  node ui-prototype.mjs check --file <page>
      Check a built page against the variant contract. Prints
      { ok, findings: [{ rule, variant, message }], bytes, overCeiling }.
      Rules: outside-link, script, state-missing, length-missing,
      value-unused, step-missing, frame-missing, image-type, image-size,
      image-missing. A page over the 5 MB soft ceiling sets overCeiling and
      is never a finding.

  node ui-prototype.mjs open --file <page> [--project <root>]
      Open a page (in the drafts, or under the project's specs/) in the
      default browser. Prints { ok, opened, path, reason }; nothing opens
      when NO_BROWSER or PLAN2CODE_NO_BROWSER is set or the session is remote.

  node ui-prototype.mjs read-block --project <root>
      Read a pasted choice block from stdin. Prints { ok, fields, latest,
      fileExists, saved }.

  node ui-prototype.mjs save --file <page> --spec <specs/name> --name <name>
                           --block <file> --request <text> --rejected <file>
                           [--replace] [--project <root>]
      Save a chosen draft page and its decisions file as
      specs/<spec>/prototypes/<name>.html and <name>.md, then remove that
      prototype's drafts. Prints { ok, html, md, removedDrafts }.

Exit: 0 ok, 1 crash, 2 bad arguments, 3 not found (round.json, a
variant file, a page, a block whose first line is not the fixed one),
4 invalid (malformed input, or check findings), 5 refused (a path outside
the allowed folders, an existing pair).
`;

/* --------------------------------------------------------------- the shell */

function loadShell() {
  const read = (name) => {
    const text = readText(path.join(SHELL_DIR, name));
    if (text === null) {
      fail(EXIT.NOT_FOUND, "shell-missing", `The page shell's ${name} is not in ${SHELL_DIR}.`, "The skill install is incomplete; reinstall the Plan2Code skills (node install.js).");
    }
    return text;
  };
  return { html: read("shell.html"), css: read("shell.css"), js: read("shell.js"), base: read("base.css") };
}

/* ---------------------------------------------------------------- assemble */

async function cmdAssemble(args) {
  if (!args.round) fail(EXIT.USAGE, "missing-flag", "assemble needs --round <folder>.", "Pass the round folder that holds round.json.");
  const round = readRound(args.round);
  const { facts } = round;
  let file = path.join(path.dirname(round.folder), `${facts.name}-round-${facts.round}.html`);
  // A round in the drafts: the page goes to pagePath() for its project key, and
  // its path is written into the facts so the Copy block's File line is right.
  const root = draftsRoot();
  // Compared case-folded where the file system ignores case, as isInside does,
  // so a path typed in another case never yields a key of "..".
  const [key, protoDir, roundDir, ...deeper] = path.relative(fold(root), fold(round.folder)).split(path.sep);
  if (isInside(root, round.folder) && key && key !== "..") {
    // In a folder new-round made, round.json must say the same name and round:
    // a copied round.json that kept an older number would overwrite that round's page.
    const n = deeper.length ? null : (roundDir || "").match(ROUND_DIR_RE);
    if (n && (facts.round !== Number(n[1]) || facts.name !== protoDir)) {
      fail(
        EXIT.INVALID,
        "round-mismatch",
        `round.json says "${facts.name}" round ${facts.round}, but its folder is "${protoDir}" round ${n[1]}.`,
        `Set "name" and "round" in round.json to the values new-round printed for this folder ("${protoDir}", ${n[1]}), then run assemble again.`,
      );
    }
    file = path.join(root, key, facts.name, `${facts.name}-round-${facts.round}.html`);
    facts.file = file;
  }

  const pictures = embedImages(round);
  const fonts = embedFonts(round);
  facts.appFont = fonts.appFont;
  // The dial starts on the app font only when fonts are carried over; freed, each variant keeps its own set.
  if (fonts.appFont && facts.carried.includes("fonts")) facts.starts.fontSet = APP_FONT;
  const { html, parts } = buildPage(round, loadShell(), { variants: pictures.variants, images: pictures.images, rules: fonts.rules });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);

  const bytes = Buffer.byteLength(html, "utf8");
  const warnings = [...pictures.warnings, ...fonts.warnings];
  if (bytes > CEILING) {
    const top = parts.slice(0, 3).map((p) => `${p.what} (${size(p.bytes)})`).join(", ");
    warnings.push(`The page is ${size(bytes)}, over the 5 MB soft ceiling; the largest parts are ${top}.`);
  }
  out({ ok: true, file, bytes, parts, warnings });
}

/* ------------------------------------------------------- sweep, new-round */

function projectRoot(args) {
  return path.resolve(args.project || process.cwd());
}

/** The newest modified time in a file or folder tree, never following a link. */
function newest(p) {
  const st = fs.lstatSync(p);
  let t = st.mtimeMs;
  if (st.isDirectory()) for (const name of fs.readdirSync(p)) t = Math.max(t, newest(path.join(p, name)));
  return t;
}

const lstat = (p) => {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
};

async function cmdSweep(args) {
  if (!args.project) fail(EXIT.USAGE, "missing-flag", "sweep needs --project <root>.", "Pass the project's root folder.");
  const draftsDir = projectDrafts(projectRoot(args));
  const removed = [];
  const st = lstat(draftsDir);
  if (!st || !st.isDirectory()) return out({ ok: true, draftsDir, removed });
  const cutoff = now().getTime() - DRAFT_DAYS * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(draftsDir)) {
    const folder = path.join(draftsDir, name);
    if (!lstat(folder)?.isDirectory()) continue;
    const page = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-round-\\d+\\.html$`);
    for (const entry of fs.readdirSync(folder)) {
      const p = path.join(folder, entry);
      const s = lstat(p);
      const isRound = s?.isDirectory() && ROUND_DIR_RE.test(entry);
      const isPage = s?.isFile() && page.test(entry);
      if ((isRound || isPage) && newest(p) < cutoff) {
        fs.rmSync(p, { recursive: true, force: true });
        removed.push(p);
      }
    }
    if (!fs.readdirSync(folder).length) {
      fs.rmdirSync(folder);
      removed.push(folder);
    }
  }
  out({ ok: true, draftsDir, removed });
}

/** The highest round number among a prototype's round folders and pages in the drafts, 0 when none. */
function highestRound(root, name) {
  const folder = path.join(projectDrafts(root), name);
  let names = [];
  try {
    names = fs.readdirSync(folder);
  } catch {}
  let top = 0;
  for (const entry of names) {
    const m = entry.match(ROUND_DIR_RE) || (entry.startsWith(`${name}-round-`) && entry.match(/-round-(\d+)\.html$/));
    if (m) top = Math.max(top, Number(m[1]));
  }
  return top;
}

async function cmdNewRound(args) {
  if (!args.project || !args.name) fail(EXIT.USAGE, "missing-flag", "new-round needs --project <root> and --name <name>.", "Pass the project's root folder and the prototype's name.");
  if (!NAME_RE.test(args.name)) fail(EXIT.INVALID, "bad-name", `"${args.name}" is not a prototype name.`, "Use lowercase letters and digits joined by single hyphens (invoices-screen).");
  const root = projectRoot(args);
  const round = highestRound(root, args.name) + 1;
  const folder = roundFolder(root, args.name, round);
  fs.mkdirSync(folder, { recursive: true });
  out({ ok: true, round, folder, page: pagePath(root, args.name, round) });
}

/* ------------------------------------------------------------------- check */

// The shared value groups each variant must draw from (contract section 1 and 4).
const GROUPS = {
  screen: {
    color: (n) => ["accent", "neutral", "bg", "surface", "text", "muted", "border", "on-accent"].includes(n),
    font: (n) => n === "font" || n === "text-size" || n.startsWith("font-set-"),
    spacing: (n) => n === "space" || /^space-[1-6]$/.test(n),
    corners: (n) => n === "radius",
  },
  terminal: {
    palette: (n) => ["term-bg", "term-fg", "term-accent"].includes(n),
    density: (n) => n === "density",
  },
};

function outsideLinks(text) {
  const t = text.replace(/\sxmlns(?::[\w-]+)?\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
  const hits = [];
  // A bare "file:" is ordinary text ("Attach file:"); "file://" is a link.
  const scheme = t.match(/\b(?:https?:|file:\/\/)[^\s"'<>)]*/i);
  if (scheme) hits.push(scheme[0]);
  // A protocol-relative URL wherever one can begin: an attribute, a srcset
  // candidate, a meta refresh, a CSS string. Right after "=", a quote or "("
  // any host counts (//localhost); after a space or comma only a dotted one,
  // so text such as " //TODO" in a terminal variant is not a link.
  const slashes = t.match(/(?:^|[\s,;])(\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'<>)]*)|[="'(](\/\/[a-z0-9-]+[^\s"'<>)]*)/im);
  if (slashes) hits.push(slashes[1] || slashes[2]);
  if (/@import\b/i.test(t)) hits.push("@import");
  // url(#id) points inside the same document (an SVG gradient) and loads nothing.
  const url = t.match(/url\(\s*(?!["']?\s*(?:data:|#))[^)]*\)/i);
  if (url) hits.push(url[0]);
  return hits;
}

/**
 * Every start tag in `markup` with its attributes, read the way an HTML parser
 * reads them: names end at whitespace, "/", ">" or "="; values are quoted
 * (where ">" is plain text) or unquoted. <style> blocks are skipped, so a CSS
 * selector never counts as markup, except inside <svg>: there <style> is not
 * raw text, and a tag written in it becomes a real element in the browser.
 */
function startTags(markup) {
  const html = markup.replace(/(<svg\b[\s\S]*?<\/svg\s*>)|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, (m, svg) => svg ?? "");
  const tags = [];
  const re = /<([a-z][^\s/>]*)/gi;
  let m;
  while ((m = re.exec(html))) {
    let i = re.lastIndex;
    const attrs = [];
    while (i < html.length && html[i] !== ">") {
      if (/[\s/]/.test(html[i])) {
        i++;
        continue;
      }
      let name = "";
      while (i < html.length && !/[\s/>=]/.test(html[i])) name += html[i++];
      while (i < html.length && /\s/.test(html[i])) i++;
      let value = "";
      if (html[i] === "=") {
        i++;
        while (i < html.length && /\s/.test(html[i])) i++;
        const quote = html[i];
        if (quote === '"' || quote === "'") {
          const end = html.indexOf(quote, i + 1);
          value = html.slice(i + 1, end === -1 ? html.length : end);
          i = end === -1 ? html.length : end + 1;
        } else {
          while (i < html.length && !/[\s>]/.test(html[i])) value += html[i++];
        }
      }
      if (name) attrs.push({ name: name.toLowerCase(), value });
    }
    tags.push({ name: m[1].toLowerCase(), attrs });
    re.lastIndex = i;
  }
  return tags;
}

function marked(tags, attr) {
  const found = new Set();
  for (const tag of tags) for (const a of tag.attrs) if (a.name === attr) for (const word of a.value.split(/\s+/)) if (word) found.add(word);
  return found;
}

function checkVariant(letter, content, kind) {
  const findings = [];
  const add = (rule, message) => findings.push({ rule, variant: letter, message });
  const tags = startTags(content);

  const links = outsideLinks(content);
  if (links.length) add("outside-link", `Variant ${letter} links outside the file (${links.join(", ")}); the page must load nothing from the network.`);

  const scripts = [];
  if (/<script\b/i.test(content)) scripts.push("a <script> tag");
  const handler = tags.flatMap((t) => t.attrs).find((a) => /^on[a-z]+$/.test(a.name));
  if (handler) scripts.push(`an ${handler.name} attribute`);
  if (/javascript:/i.test(content)) scripts.push("a javascript: link");
  if (scripts.length) add("script", `Variant ${letter} holds ${scripts.join(" and ")}; variants carry no script.`);

  const states = marked(tags, "data-p2c-when");
  const noState = STATES.filter((s) => !states.has(s));
  if (noState.length) add("state-missing", `Variant ${letter} draws no ${noState.join(", ")} state (mark its parts with data-p2c-when).`);

  const lengths = marked(tags, "data-p2c-text");
  const noLength = LENGTHS.filter((l) => !lengths.has(l));
  if (noLength.length) add("length-missing", `Variant ${letter} has no ${noLength.join(", ")} text (write varying text three times with data-p2c-text).`);

  const used = [...content.matchAll(/var\(\s*--p2c-([a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase());
  const groups = GROUPS[kind === "terminal" ? "terminal" : "screen"];
  const unused = Object.keys(groups).filter((g) => !used.some(groups[g]));
  if (unused.length) add("value-unused", `Variant ${letter} takes nothing from the shared ${unused.join(", ")} values; use them through var(--p2c-...).`);

  if (kind === "flow") {
    const steps = tags.filter((t) => t.attrs.some((a) => a.name === "data-p2c-step")).length;
    if (steps < 2) add("step-missing", `Variant ${letter} is a flow with ${steps} step${steps === 1 ? "" : "s"}; a flow needs at least two data-p2c-step screens.`);
  }

  // Every data: image in the frame: one of the four types, and 1 MB at most
  // once decoded. The too-large placeholder is a small SVG, so it always passes.
  const typeSeen = new Set();
  let oversize = 0;
  for (const m of content.matchAll(/data:(image\/[a-z0-9.+-]+)((?:;[^,;"'\s)]*)*),([^"'\s)<>]*)/gi)) {
    const type = m[1].toLowerCase();
    if (!IMAGE_TYPES.includes(type)) {
      if (!typeSeen.has(type)) add("image-type", `Variant ${letter} holds a ${type} image; only PNG, JPEG, WebP and SVG images go in a page.`);
      typeSeen.add(type);
      continue;
    }
    const data = m[3];
    let decoded;
    if (/;base64/i.test(m[2])) decoded = Math.floor((data.length * 3) / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
    else {
      try {
        decoded = Buffer.byteLength(decodeURIComponent(data), "utf8");
      } catch {
        decoded = data.length;
      }
    }
    if (decoded > LIMITS.image) oversize = Math.max(oversize, decoded);
  }
  if (oversize) add("image-size", `Variant ${letter} holds an image of ${size(oversize)}, over the 1 MB limit for one image; run assemble again so it becomes a placeholder.`);

  // A p2c-image: name assemble did not replace: it is not in round.json's images.
  const lost = [...new Set([...content.matchAll(/p2c-image:([^"'\s)<>]*)/gi)].map((m) => m[1]))];
  if (lost.length) add("image-missing", `Variant ${letter} names ${lost.length === 1 ? "an image" : "images"} round.json does not list (${lost.join(", ")}); list each under "images" or correct the name, then run assemble again.`);
  return findings;
}

async function cmdCheck(args) {
  if (!args.file) fail(EXIT.USAGE, "missing-flag", "check needs --file <page>.", "Pass the page assemble wrote.");
  const file = path.resolve(args.file);
  const html = readText(file);
  if (html === null) fail(EXIT.NOT_FOUND, "page-missing", `No page at ${file}.`, "Run assemble first, and pass the file it printed.");
  const page = unpackPage(html);
  if (!page) fail(EXIT.INVALID, "not-a-prototype", `${file} is not a UI prototype page (no round facts in it).`, "Pass a page written by assemble.");

  const findings = [];
  const pageLinks = outsideLinks(page.outside);
  if (pageLinks.length) findings.push({ rule: "outside-link", variant: null, message: `The page links outside the file (${pageLinks.join(", ")}).` });

  const letters = (page.facts.variants || []).map((v) => v.letter);
  for (const letter of letters) {
    const frame = page.frames[letter];
    if (!frame || frame.content === null) {
      findings.push({ rule: "frame-missing", variant: letter, message: `Variant ${letter} has no frame in the page; run assemble again.` });
      continue;
    }
    findings.push(...checkVariant(letter, frame.content, page.facts.kind));
  }

  const size = Buffer.byteLength(html, "utf8");
  out({ ok: findings.length === 0, findings, bytes: size, overCeiling: size > CEILING });
  if (findings.length) process.exitCode = EXIT.INVALID;
}

/* -------------------------------------------------------------------- open */

/** Why nothing should open here, or null when a browser may be launched. */
function noOpenReason() {
  if (process.env.NO_BROWSER || process.env.PLAN2CODE_NO_BROWSER) return "Opening a browser is turned off here (NO_BROWSER or PLAN2CODE_NO_BROWSER is set); open the file by hand.";
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return "This is a remote (SSH) session, so no browser can open on your screen; copy the file to your machine and open it there.";
  if (process.env.CODESPACES || process.env.REMOTE_CONTAINERS) return "This session runs in a remote container, so no browser can open on your screen; download the file and open it there.";
  return null;
}

/** Start the default browser on `file`, with no shell: null when it started, else the reason it did not. */
function launch(file) {
  const [cmd, argv] =
    process.platform === "win32"
      ? ["rundll32.exe", ["url.dll,FileProtocolHandler", pathToFileURL(file).href]]
      : process.platform === "darwin"
        ? ["open", [file]]
        : [process.env.BROWSER || "xdg-open", [file]];
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, argv, { detached: true, stdio: "ignore", windowsHide: true, shell: false });
    } catch (err) {
      resolve(`${cmd} could not be started: ${err.message}`);
      return;
    }
    child.once("error", (err) => resolve(`${cmd} could not be started: ${err.message}`));
    child.once("spawn", () => {
      child.unref();
      resolve(null);
    });
  });
}

/** True when `file` is an existing .html file in the drafts or under the project's specs/. */
function openable(root, file) {
  if (path.extname(file).toLowerCase() !== ".html") return false;
  if (!lstat(file)?.isFile()) return false;
  return isInside(draftsRoot(), file) || isInside(path.join(root, "specs"), file);
}

async function cmdOpen(args) {
  if (!args.file) fail(EXIT.USAGE, "missing-flag", "open needs --file <page>.", "Pass the page assemble wrote.");
  const file = path.resolve(args.file);
  if (!openable(projectRoot(args), file)) {
    fail(EXIT.REFUSED, "not-allowed", `${file} is not an existing .html page in the prototype drafts or under this project's specs/ folder.`, "Pass the page assemble or save wrote, and --project <root> when it sits under another project's specs/.", { path: file });
  }
  const held = noOpenReason();
  if (held) return out({ ok: true, opened: false, path: file, reason: held });
  const failed = await launch(file);
  out({ ok: true, opened: !failed, path: file, reason: failed });
}

/* -------------------------------------------------------------- read-block */

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const notABlock = () =>
  fail(EXIT.NOT_FOUND, "not-a-block", "That is not a UI prototype block", `The block starts with the line "${FIRST_LINE}"; ask the person to press Copy on the page and paste the whole block.`);

async function cmdReadBlock(args) {
  if (!args.project) fail(EXIT.USAGE, "missing-flag", "read-block needs --project <root>.", "Pass the project's root folder, and the block on stdin.");
  const parsed = parseBlock(readStdin());
  if (!parsed.ok) notABlock();
  const { fields } = parsed;
  const fileExists = typeof fields.file === "string" && fields.file !== "" && Boolean(lstat(path.resolve(projectRoot(args), fields.file))?.isFile());
  const top = fields.prototype && NAME_RE.test(fields.prototype) ? highestRound(projectRoot(args), fields.prototype) : 0;
  const latest = typeof fields.round === "number" && fields.round >= top;
  // Saved: the File line is under this project's own specs/ folder.
  const saved = typeof fields.file === "string" && fields.file !== "" && isInside(path.join(projectRoot(args), "specs"), path.resolve(projectRoot(args), fields.file));
  out({ ok: true, fields, latest, fileExists, saved });
}

/* -------------------------------------------------------------------- save */

const refuse = (error, message, next, extra) => fail(EXIT.REFUSED, error, message, next, extra);

/** A file flag's text, or a usage failure naming it. */
function readFlagFile(flag, file) {
  const text = readText(path.resolve(file));
  if (text === null) fail(EXIT.NOT_FOUND, "file-missing", `No file at ${file} (--${flag}).`, `Write the ${flag} text to a file and pass its path.`);
  return text;
}

async function cmdSave(args) {
  for (const flag of ["file", "spec", "name", "block", "request", "rejected"]) {
    if (args[flag] === undefined) fail(EXIT.USAGE, "missing-flag", `save needs --${flag}.`, "Run with --help for every flag save takes.");
  }
  const root = projectRoot(args);
  const source = path.resolve(args.file);
  if (!isInside(draftsRoot(), source) || !lstat(source)?.isFile()) {
    refuse("source-not-allowed", `${source} is not a page in the prototype drafts.`, "Save the page assemble wrote into the drafts (its File line).");
  }
  const spec = String(args.spec).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  const m = spec.match(/^specs\/([A-Za-z0-9._-]+)$/);
  if (!m || m[1] === "." || m[1] === "..") refuse("spec-not-allowed", `--spec must be specs/<one folder name> (got ${args.spec}).`, "Pass the spec folder as specs/<name>.");
  if (!NAME_RE.test(args.name)) refuse("bad-name", `"${args.name}" is not a prototype name.`, "Use lowercase letters and digits joined by single hyphens (invoices-screen).");

  // No link anywhere on the way down: specs/, the spec folder, prototypes/.
  const specsDir = path.join(root, "specs");
  const specDir = path.join(specsDir, m[1]);
  const protoDir = path.join(specDir, "prototypes");
  for (const dir of [specsDir, specDir, protoDir]) {
    const s = lstat(dir);
    if (s && !s.isDirectory()) refuse("spec-not-allowed", `${rel(root, dir)} is a link or a file, not a folder.`, "Save into a plain specs/<name>/ folder.");
  }
  const html = path.join(protoDir, `${args.name}.html`);
  const md = path.join(protoDir, `${args.name}.md`);
  if (!args.replace && (lstat(html) || lstat(md))) {
    refuse("exists", `${rel(root, html)} or ${rel(root, md)} already exists.`, "Ask the person whether to replace the saved prototype; run save again with --replace only when they say yes.", {
      html: rel(root, html),
      md: rel(root, md),
    });
  }
  // A target replaced with --replace must be a plain file: a link would carry the write outside specs/.
  for (const f of [html, md]) {
    const s = lstat(f);
    if (s && !s.isFile()) refuse("spec-not-allowed", `${rel(root, f)} is a link or a folder, not a file.`, "Remove it, or save under another --name.");
  }

  const block = readFlagFile("block", args.block);
  if (!parseBlock(block).ok) notABlock();
  const rejected = readFlagFile("rejected", args.rejected);
  const page = withFile(fs.readFileSync(source, "utf8"), html);
  if (page === null) fail(EXIT.INVALID, "not-a-prototype", `${source} is not a UI prototype page (no round facts in it).`, "Pass a page written by assemble.");

  const choice = cleanBlock(block)
    .split("\n")
    .map((line) => (/^File:/.test(line) ? `File: ${rel(root, html)}` : line))
    .join("\n");
  const notChosen = rejected
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("- ") ? l : `- ${l}`));
  const decisions = [
    "## Request",
    "",
    String(args.request).trim(),
    "",
    "## Choice",
    "",
    "```text",
    choice,
    "```",
    "",
    "## Not chosen",
    "",
    ...(notChosen.length ? notChosen : ["- None"]),
    "",
  ].join("\n");

  fs.mkdirSync(protoDir, { recursive: true });
  fs.writeFileSync(html, page);
  fs.writeFileSync(md, decisions);

  // That prototype's drafts go: its folder (every round and page), found as
  // the page's own folder, two levels under the drafts root.
  const removedDrafts = [];
  const folder = path.dirname(source);
  const depth = path.relative(fold(draftsRoot()), fold(folder)).split(path.sep).filter(Boolean).length;
  if (depth === 2 && isInside(draftsRoot(), folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
    removedDrafts.push(folder);
  } else {
    fs.rmSync(source, { force: true });
    removedDrafts.push(source);
  }
  out({ ok: true, html: rel(root, html), md: rel(root, md), removedDrafts });
}

/* -------------------------------------------------------------------- main */

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { booleans: ["replace"], values: ["round", "file", "project", "spec", "name", "block", "request", "rejected"] });
  const cmd = args._[0];
  const commands = { sweep: cmdSweep, "new-round": cmdNewRound, assemble: cmdAssemble, check: cmdCheck, open: cmdOpen, "read-block": cmdReadBlock, save: cmdSave };
  if (!commands[cmd]) {
    fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: sweep, new-round, assemble, check, open, read-block, save. Run with --help.");
  }
  await commands[cmd](args);
});
