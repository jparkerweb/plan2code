// glob.mjs: the small glob subset the test map uses, as RegExps.
//
// A library, no CLI. The test map's Paths cells hold globs, and every script
// that reads them (test-map.mjs, test-match.mjs) matches them the same way:
//
//   **      any number of path segments, including none
//   *       any characters except /
//   ?       one character except /
//   {a,b}   alternation, no nesting
//
// Everything else is literal. unsupported() names anything outside the subset
// so the test map can report it instead of matching it wrongly. Paths are
// forward-slash normalized; on Windows both sides are lower-cased, as file
// names there are case-insensitive.

const FOLD = process.platform === "win32";
const fold = (s) => (FOLD ? s.toLowerCase() : s);

/** Backslashes to /, a leading ./ dropped. */
export function toPosix(p) {
  return String(p).replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

/** A reason string for a glob outside the subset, or null when it is supported. */
export function unsupported(glob) {
  const g = String(glob);
  if (!g.trim()) return "empty glob";
  if (/[[\]]/.test(g)) return "character classes ([...]) are not supported";
  if (g.startsWith("!")) return "negation (!) is not supported";
  if (g.includes("***")) return "*** is not a glob; use ** for any folders";
  let depth = 0;
  for (const ch of g) {
    if (ch === "{") {
      if (++depth > 1) return "nested braces are not supported";
    } else if (ch === "}") {
      if (--depth < 0) return "a } has no matching {";
    }
  }
  if (depth !== 0) return "a { has no matching }";
  return null;
}

const escape = (s) => s.replace(/[.+^$()|\\/]/g, "\\$&");

// One alternative's text (no braces) to RegExp source.
function plain(text) {
  let src = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "*") {
      if (text[i + 1] === "*") {
        const before = i === 0 || text[i - 1] === "/";
        const after = i + 2 === text.length || text[i + 2] === "/";
        if (before && after) {
          if (text[i + 2] === "/") {
            src += "(?:[^/]*/)*"; // **/ : any folders, including none
            i += 2;
          } else if (i > 0) {
            src = src.replace(/\\\/$/, "") + "(?:/.*)?"; // /** at the end: the folder and everything in it
            i += 1;
          } else {
            src += ".*"; // a lone **
            i += 1;
          }
          continue;
        }
        i += 1; // ** inside a segment reads as *
      }
      src += "[^/]*";
    } else if (ch === "?") src += "[^/]";
    else src += escape(ch);
  }
  return src;
}

/** The glob as an anchored RegExp. Throws on a glob unsupported() rejects. */
export function globToRegExp(glob) {
  const why = unsupported(glob);
  if (why) throw new Error(`Unsupported glob "${glob}": ${why}`);
  const g = fold(toPosix(glob));
  let src = "";
  let i = 0;
  while (i < g.length) {
    const open = g.indexOf("{", i);
    if (open === -1) {
      src += g.slice(i);
      break;
    }
    src += g.slice(i, open);
    const close = g.indexOf("}", open);
    src += `\u0000${g.slice(open + 1, close)}\u0001`;
    i = close + 1;
  }
  // Brace groups are marked with \0 ... \1 so the text around them converts
  // as one piece (a ** next to a brace still sees its neighbors).
  const parts = src.split(/(\u0000[^\u0001]*\u0001)/);
  let out = "";
  for (const part of parts) {
    if (part.startsWith("\u0000")) out += `(?:${part.slice(1, -1).split(",").map(plain).join("|")})`;
    else out += plain(part);
  }
  return new RegExp(`^${out}$`);
}

/** Does the path match the glob? Unsupported globs match nothing. */
export function matchGlob(glob, p) {
  if (unsupported(glob)) return false;
  return globToRegExp(glob).test(fold(toPosix(p)));
}
