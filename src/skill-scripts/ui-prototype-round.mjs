// ui-prototype-round.mjs: read and validate a round folder's round.json and
// variant files, against the contract in ui-prototype-contract.md (section 7).
//
// readRound(folder) returns { folder, facts, variants: [{ letter, name, file,
// content }] } or fails with EXIT.NOT_FOUND (a missing round.json or variant
// file) or EXIT.INVALID (anything malformed, the message naming the field or
// file).

import fs from "node:fs";
import path from "node:path";
import { EXIT, fail } from "./common.mjs";

export const KINDS = ["screen", "flow", "terminal"];
export const ITEMS = ["colors", "fonts", "spacing", "components", "layout"];
export const FONT_SETS = ["System UI", "Humanist", "Transitional", "Slab Serif", "Rounded Sans", "Monospace Code"];
export const SCREENS = ["Phone 390", "Tablet 820", "Desktop 1280"];
export const WINDOWS = ["80x24", "120x30", "160x48"];
export const PALETTES = ["Graphite", "Amber", "Phosphor", "Ocean"];
export const THEMES = ["light", "dark"];
export const STATES = ["ready", "empty", "loading", "error"];
export const LENGTHS = ["short", "typical", "long"];
export const LETTERS = ["A", "B", "C", "D", "E"];
export const MIN_VARIANTS = 2;
export const MAX_VARIANTS = 5;
export const MAX_EXTRAS = 6;
export const EXTRA_TYPES = ["slider", "pick", "toggle"];

/** A prototype's name: lowercase letters and digits joined by single hyphens. */
export const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXTRA_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/;
const WHOLE_PAGE_RE = /<\/?(?:html|head|body)\b/i;

const isText = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const oneOf = (list) => (v) => list.includes(v);
const between = (lo, hi) => (v) => isNum(v) && v >= lo && v <= hi;

// The dial starts, by kind: each key's check and what to say when it fails.
const SCREEN_STARTS = {
  screen: [oneOf(SCREENS), `one of ${SCREENS.join(", ")}`],
  theme: [oneOf(THEMES), `one of ${THEMES.join(", ")}`],
  accent: [(v) => isText(v) && COLOR_RE.test(v), "a color as #rrggbb"],
  neutral: [(v) => isText(v) && COLOR_RE.test(v), "a color as #rrggbb"],
  fontSet: [oneOf(FONT_SETS), `one of ${FONT_SETS.join(", ")}`],
  textSize: [between(12, 24), "a number of pixels from 12 to 24"],
  space: [between(0.5, 2), "a number from 0.5 to 2"],
  radius: [between(0, 32), "a number of pixels from 0 to 32"],
  state: [oneOf(STATES), `one of ${STATES.join(", ")}`],
  length: [oneOf(LENGTHS), `one of ${LENGTHS.join(", ")}`],
};
const TERMINAL_STARTS = {
  window: [oneOf(WINDOWS), `one of ${WINDOWS.join(", ")}`],
  theme: SCREEN_STARTS.theme,
  palette: [oneOf(PALETTES), `one of ${PALETTES.join(", ")}`],
  density: [between(1, 2), "a number from 1 to 2"],
  state: SCREEN_STARTS.state,
  length: SCREEN_STARTS.length,
};

export function startsSpec(kind) {
  return kind === "terminal" ? TERMINAL_STARTS : SCREEN_STARTS;
}

function invalid(error, message, next) {
  fail(EXIT.INVALID, error, message, next || "Fix round.json against ui-prototype-contract.md (section 7), then run assemble again.");
}

function checkStarts(where, starts, kind, { all }) {
  if (!starts || typeof starts !== "object" || Array.isArray(starts)) invalid("bad-starts", `${where} must be an object.`);
  const spec = startsSpec(kind);
  for (const key of Object.keys(starts)) {
    if (!Object.hasOwn(spec, key)) invalid("bad-starts", `${where}.${key} is not a dial for a ${kind} (allowed: ${Object.keys(spec).join(", ")}).`);
    const [ok, want] = spec[key];
    if (!ok(starts[key])) invalid("bad-starts", `${where}.${key} is ${JSON.stringify(starts[key])}; it must be ${want}.`);
  }
  if (all) {
    const missing = Object.keys(spec).filter((k) => !(k in starts));
    if (missing.length) invalid("bad-starts", `${where} is missing ${missing.join(", ")}.`);
  }
}

function checkItems(field, value) {
  if (!Array.isArray(value)) invalid("bad-field", `round.json "${field}" must be a list.`);
  for (const item of value) {
    if (!ITEMS.includes(item)) invalid("bad-field", `round.json "${field}" holds "${item}"; carry-over items are ${ITEMS.join(", ")}.`);
  }
}

function checkExtra(x, i) {
  const where = `extras[${i}]`;
  if (!x || typeof x !== "object" || Array.isArray(x)) invalid("bad-extra", `${where} must be an object.`);
  if (!isText(x.name) || !EXTRA_NAME_RE.test(x.name)) invalid("bad-extra", `${where}.name must be lowercase letters, digits and hyphens, starting with a letter.`);
  if (x.label !== undefined && !isText(x.label)) invalid("bad-extra", `${where}.label must be text.`);
  // The copied block writes "Extra, <label>: <value>" and is read back at the first colon.
  if (isText(x.label) && x.label.includes(":")) invalid("bad-extra", `${where}.label must have no colon in it.`);
  if (!EXTRA_TYPES.includes(x.type)) invalid("bad-extra", `${where}.type must be one of ${EXTRA_TYPES.join(", ")}.`);
  if (typeof x.look !== "boolean") invalid("bad-extra", `${where}.look must be true or false.`);
  if (x.type === "slider") {
    for (const k of ["min", "max", "step", "start"]) if (!isNum(x[k])) invalid("bad-extra", `${where}.${k} must be a number for a slider.`);
    if (!(x.min < x.max) || !(x.step > 0)) invalid("bad-extra", `${where} needs min below max and a step above 0.`);
    if (x.start < x.min || x.start > x.max) invalid("bad-extra", `${where}.start must lie between min and max.`);
  } else if (x.type === "pick") {
    if (!Array.isArray(x.choices) || x.choices.length < 2 || !x.choices.every((c) => isText(c) && c.trim() && !/["\\]/.test(c))) {
      invalid("bad-extra", `${where}.choices must be two or more texts without quotes or backslashes.`);
    }
    if (!x.choices.includes(x.start)) invalid("bad-extra", `${where}.start must be one of its choices.`);
  } else if (typeof x.start !== "boolean") {
    invalid("bad-extra", `${where}.start must be true or false for a toggle.`);
  }
}

/** Read a round folder and validate it. See the header for what it returns. */
export function readRound(folder) {
  const dir = path.resolve(folder);
  const file = path.join(dir, "round.json");
  if (!fs.existsSync(file)) {
    fail(EXIT.NOT_FOUND, "round-missing", `No round.json in ${dir}.`, "Write round.json into the round folder (ui-prototype-contract.md, section 7).");
  }
  let facts;
  try {
    facts = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    invalid("bad-json", `round.json does not parse as JSON: ${err.message}`);
  }
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) invalid("bad-json", "round.json must hold one JSON object.");

  for (const field of ["name", "round", "kind", "request", "direction", "carried", "freed", "notFound", "variants", "starts", "extras", "images", "fonts"]) {
    if (!(field in facts)) invalid("missing-field", `round.json has no "${field}" field.`);
  }
  if (!isText(facts.name) || !NAME_RE.test(facts.name)) invalid("bad-field", `round.json "name" must be lowercase letters and digits joined by single hyphens (got ${JSON.stringify(facts.name)}).`);
  if (!Number.isInteger(facts.round) || facts.round < 1) invalid("bad-field", `round.json "round" must be a whole number of 1 or more.`);
  if (!KINDS.includes(facts.kind)) invalid("bad-field", `round.json "kind" must be one of ${KINDS.join(", ")} (got ${JSON.stringify(facts.kind)}).`);
  if (!isText(facts.request) || !facts.request.trim()) invalid("bad-field", `round.json "request" must be text, not empty.`);
  if (!isText(facts.direction)) invalid("bad-field", `round.json "direction" must be text ("" when none).`);
  for (const field of ["carried", "freed", "notFound"]) checkItems(field, facts[field]);

  checkStarts("starts", facts.starts, facts.kind, { all: true });

  if (!Array.isArray(facts.extras)) invalid("bad-field", `round.json "extras" must be a list.`);
  if (facts.extras.length > MAX_EXTRAS) invalid("too-many-extras", `round.json has ${facts.extras.length} extras; at most ${MAX_EXTRAS} are allowed.`);
  facts.extras.forEach(checkExtra);
  const extraNames = facts.extras.map((x) => x.name);
  const dup = extraNames.find((n, i) => extraNames.indexOf(n) !== i);
  if (dup) invalid("bad-extra", `Two extras are named "${dup}".`);

  if (!Array.isArray(facts.images) || !facts.images.every((im) => im && isText(im.name) && isText(im.path))) {
    invalid("bad-field", `round.json "images" must be a list of { "name", "path" }.`);
  }
  if (!Array.isArray(facts.fonts) || !facts.fonts.every(isText)) invalid("bad-field", `round.json "fonts" must be a list of paths.`);

  if (!Array.isArray(facts.variants)) invalid("bad-field", `round.json "variants" must be a list.`);
  const n = facts.variants.length;
  if (n < MIN_VARIANTS || n > MAX_VARIANTS) {
    invalid("variant-count", `round.json has ${n} variant${n === 1 ? "" : "s"}; a round has ${MIN_VARIANTS} to ${MAX_VARIANTS}.`);
  }
  const variants = facts.variants.map((v, i) => {
    const where = `variants[${i}]`;
    if (!v || typeof v !== "object" || Array.isArray(v)) invalid("bad-variant", `${where} must be an object.`);
    if (v.letter !== LETTERS[i]) invalid("bad-variant", `${where}.letter must be "${LETTERS[i]}" (letters run A, B, C... in order).`);
    for (const k of ["name", "what"]) if (!isText(v[k]) || !v[k].trim()) invalid("bad-variant", `${where}.${k} must be text, not empty.`);
    if (!isText(v.file) || !FILE_RE.test(v.file)) invalid("bad-variant", `${where}.file must be a plain .html file name in the round folder.`);
    checkStarts(`${where}.starts`, v.starts ?? {}, facts.kind, { all: false });
    const abs = path.join(dir, v.file);
    if (!fs.existsSync(abs)) {
      fail(EXIT.NOT_FOUND, "variant-missing", `Variant ${v.letter}'s file ${v.file} is not in ${dir}.`, "Write the variant file, or fix its name in round.json.");
    }
    const content = fs.readFileSync(abs, "utf8");
    if (!content.trim()) invalid("bad-variant-file", `${v.file} (variant ${v.letter}) is empty.`, "Write the variant: one <style> block plus markup.");
    if (WHOLE_PAGE_RE.test(content)) {
      invalid("bad-variant-file", `${v.file} (variant ${v.letter}) holds an <html>, <head> or <body> tag.`, "A variant file is one <style> block plus markup; the page wraps it (ui-prototype-contract.md, section 6).");
    }
    return { letter: v.letter, name: v.name, file: v.file, content };
  });

  return { folder: dir, facts, variants };
}
