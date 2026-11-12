// ui-prototype-block.mjs: read a pasted UI prototype choice block (the text
// the page's Copy button gives, ui-prototype-contract.md) into fields.
//
// parseBlock(text) -> { ok: true, fields } or { ok: false } when the first line
// is not the fixed one. A person may edit the block before pasting it, so a
// label this file does not know is kept in fields.unknown, never refused.

export const FIRST_LINE = "Plan2Code UI prototype choice";

// The dial lines, in the order the page writes them (screen, flow and terminal).
export const DIAL_LABELS = [
  "Screen size",
  "Window size",
  "Theme",
  "Accent color",
  "Neutral color",
  "Font set",
  "Text size",
  "Spacing",
  "Corners",
  "Palette",
  "Density",
  "State",
  "Content length",
];

const CHANGED_RE = /^(.*?)\s*\(changed from (.*)\)$/;
const PICK_RE = /^([A-E])\s+"(.*)"$/;

/** "value (changed from old)" -> { value, changedFrom } (changedFrom null when unchanged). */
function changed(text) {
  const m = text.match(CHANGED_RE);
  return m ? { value: m[1], changedFrom: m[2] } : { value: text, changedFrom: null };
}

/** `B "Split view"` -> { letter, name }; anything else keeps its text as the name. */
function pick(text) {
  const m = text.trim().match(PICK_RE);
  return m ? { letter: m[1], name: m[2] } : { letter: null, name: text.trim() };
}

/** "colors, fonts" -> ["colors", "fonts"]; "none" or "" -> []. */
function list(text) {
  const t = text.trim();
  return !t || t.toLowerCase() === "none" ? [] : t.split(/\s*,\s*/).filter(Boolean);
}

/** The pasted text's lines, with surrounding white space and code-fence lines taken off. */
function blockLines(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").trim().split("\n");
  while (lines.length && /^\s*(```|~~~)/.test(lines[0])) lines.shift();
  while (lines.length && /^\s*(```|~~~)/.test(lines[lines.length - 1])) lines.pop();
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

/** The block's text as it should be stored: fences and surrounding white space taken off. */
export function cleanBlock(text) {
  return blockLines(text).join("\n");
}

export function parseBlock(text) {
  const lines = blockLines(text);
  if (!lines.length || lines[0].trim() !== FIRST_LINE) return { ok: false };
  const fields = {
    prototype: null,
    file: null,
    round: null,
    chosen: null,
    others: [],
    carried: [],
    freed: [],
    direction: null,
    preset: null,
    dials: [],
    extras: [],
    note: null,
    unknown: [],
  };
  let last = null;
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.indexOf(":");
    if (at <= 0) {
      // A line with no label: the Note carries on onto it, otherwise it is kept as is.
      if (last === "note") fields.note += `\n${line}`;
      else fields.unknown.push({ label: null, value: line });
      continue;
    }
    const label = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    last = null;
    if (label === "Prototype") fields.prototype = value;
    else if (label === "File") fields.file = value;
    else if (label === "Round") fields.round = /^\d+$/.test(value) ? Number(value) : value;
    else if (label === "Chosen") {
      const m = value.match(/^(.*?)\s*\(others:\s*(.*)\)$/);
      fields.chosen = pick(m ? m[1] : value);
      fields.others = m ? m[2].split(/,\s*(?=[A-E]\s+")/).map(pick) : [];
    } else if (label === "Carried over") fields.carried = list(value);
    else if (label === "Freed up") fields.freed = list(value);
    else if (label === "Direction") fields.direction = value;
    else if (label === "Preset") fields.preset = value;
    else if (label === "Note") {
      fields.note = value;
      last = "note";
    } else if (DIAL_LABELS.includes(label)) fields.dials.push({ label, ...changed(value) });
    else if (/^Extra,\s*/.test(label)) fields.extras.push({ label: label.replace(/^Extra,\s*/, ""), ...changed(value) });
    else fields.unknown.push({ label, value });
  }
  return { ok: true, fields };
}
