// Plan2Code Web Console - a unified diff (changes.mjs diff) read into files, hunks and numbered lines; defines only.
//
// The Changes tab draws what this returns. It never throws: text it cannot
// read comes back as `{ files: [], tooLarge: false, bad: true }`, which the tab
// shows as its error state.

// The lines changes.mjs writes in place of a file's lines, and after the last
// file it kept whole when the change set was over its cap.
export const HIDDEN_LINE = "Lines hidden: this file may hold a secret.";
export const TOO_LARGE_LINE = "\\ No more lines shown: this change is too large to show in full.";

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

// A path git quoted ("a/with \"quote\".txt"): C escapes, octal bytes as UTF-8.
// Returns [path, rest of the line] or null.
function unquote(s) {
  if (s[0] !== '"') return null;
  const bytes = [];
  const enc = new TextEncoder();
  const named = { n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, '"': 34, "\\": 92 };
  let i = 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') return [new TextDecoder().decode(new Uint8Array(bytes)), s.slice(i + 1)];
    if (c === "\\") {
      const n = s[i + 1];
      if (/[0-7]/.test(n || "")) {
        const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1))[0];
        bytes.push(parseInt(oct, 8) & 0xff);
        i += 1 + oct.length;
        continue;
      }
      if (n in named) {
        bytes.push(named[n]);
        i += 2;
        continue;
      }
      return null;
    }
    // One whole character, so a surrogate pair stays one.
    const ch = String.fromCodePoint(s.codePointAt(i));
    bytes.push(...enc.encode(ch));
    i += ch.length;
  }
  return null;
}

const strip = (p, prefix) => (p.startsWith(prefix) ? p.slice(prefix.length) : p);

// The two paths of a `diff --git a/x b/y` line. Unquoted paths with spaces are
// ambiguous, so the halves are taken equal when they can be (the usual case:
// the same file on both sides); the ---, +++ and rename lines correct it later.
function gitLinePaths(rest) {
  if (rest[0] === '"') {
    const a = unquote(rest);
    if (!a) return null;
    const after = a[1].replace(/^ /, "");
    const b = after[0] === '"' ? unquote(after) : [after, ""];
    if (!b) return null;
    return [strip(a[0], "a/"), strip(b[0], "b/")];
  }
  const half = (rest.length - 1) / 2;
  if (Number.isInteger(half) && rest[half] === " " && rest.slice(0, half).slice(2) === rest.slice(half + 1).slice(2)) {
    return [strip(rest.slice(0, half), "a/"), strip(rest.slice(half + 1), "b/")];
  }
  const quotedB = rest.indexOf(' "b/');
  if (quotedB > 0) {
    const b = unquote(rest.slice(quotedB + 1));
    if (b) return [strip(rest.slice(0, quotedB), "a/"), strip(b[0], "b/")];
  }
  const at = rest.indexOf(" b/");
  if (at < 0) return null;
  return [strip(rest.slice(0, at), "a/"), strip(rest.slice(at + 1), "b/")];
}

// The path on a ---, +++, rename from or rename to line: quoted or plain, with
// the trailing tab git adds after a name holding a space dropped.
function linePath(raw) {
  const q = unquote(raw);
  if (q) return q[0];
  return raw.replace(/\t$/, "");
}

function newFile(paths) {
  return {
    path: paths[1],
    oldPath: paths[0],
    status: "modified",
    added: 0,
    removed: 0,
    binary: false,
    hidden: false,
    truncated: false,
    hunks: [],
  };
}

function finish(file, afterCut) {
  if (file.status !== "renamed") file.oldPath = null;
  if (afterCut && !file.hunks.length && !file.binary && !file.hidden) file.truncated = true;
  file.afterCut = afterCut;
  return file;
}

export function parseDiff(text) {
  const bad = { files: [], tooLarge: false, bad: true };
  if (typeof text !== "string") return bad;
  try {
    return readDiff(text);
  } catch {
    return bad;
  }
}

function readDiff(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const files = [];
  let tooLarge = false;
  let file = null;
  let fileAfterCut = false;
  let hunk = null;
  let oldNo = 0;
  let newNo = 0;
  let oldLeft = 0;
  let newLeft = 0;
  let lastWasLine = false;
  const close = () => {
    if (file) files.push(finish(file, fileAfterCut));
    file = null;
    hunk = null;
  };

  for (const line of lines) {
    // Inside a hunk, its counts decide: a line starting "+++" or "---" there
    // is a changed line, never a header.
    if (hunk && (oldLeft > 0 || newLeft > 0)) {
      const c = line[0];
      if (c === "+" && newLeft > 0) {
        hunk.lines.push({ kind: "add", oldNo: null, newNo: newNo++, text: line.slice(1) });
        newLeft--;
        file.added++;
        lastWasLine = true;
        continue;
      }
      if (c === "-" && oldLeft > 0) {
        hunk.lines.push({ kind: "del", oldNo: oldNo++, newNo: null, text: line.slice(1) });
        oldLeft--;
        file.removed++;
        lastWasLine = true;
        continue;
      }
      // An empty line stands for an empty context line some tools trim.
      if ((c === " " || line === "") && oldLeft > 0 && newLeft > 0) {
        hunk.lines.push({ kind: "ctx", oldNo: oldNo++, newNo: newNo++, text: line.slice(1) });
        oldLeft--;
        newLeft--;
        lastWasLine = true;
        continue;
      }
      if (c === "\\" && line !== TOO_LARGE_LINE && lastWasLine) {
        hunk.lines.push({ kind: "meta", oldNo: null, newNo: null, text: line });
        lastWasLine = false;
        continue;
      }
      // Anything else ends the hunk early and is read below.
      hunk = null;
    }

    if (line === TOO_LARGE_LINE) {
      close();
      tooLarge = true;
      continue;
    }
    if (line.startsWith("diff --git ")) {
      close();
      const paths = gitLinePaths(line.slice("diff --git ".length));
      if (!paths) throw new Error("unreadable diff header");
      file = newFile(paths);
      fileAfterCut = tooLarge;
      lastWasLine = false;
      continue;
    }
    if (!file) continue;
    // The marker after the last line of a file with no newline at its end.
    if (hunk && line[0] === "\\" && lastWasLine) {
      hunk.lines.push({ kind: "meta", oldNo: null, newNo: null, text: line });
      lastWasLine = false;
      continue;
    }
    const h = HUNK.exec(line);
    if (h) {
      oldNo = Number(h[1]);
      oldLeft = h[2] === undefined ? 1 : Number(h[2]);
      newNo = Number(h[3]);
      newLeft = h[4] === undefined ? 1 : Number(h[4]);
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
      lastWasLine = false;
      continue;
    }
    if (file.hunks.length) continue;
    // The extended header lines, before any hunk.
    if (line.startsWith("new file mode")) file.status = "added";
    else if (line.startsWith("deleted file mode")) file.status = "deleted";
    else if (line.startsWith("rename from ")) {
      file.status = "renamed";
      file.oldPath = linePath(line.slice("rename from ".length));
    } else if (line.startsWith("rename to ")) {
      file.status = "renamed";
      file.path = linePath(line.slice("rename to ".length));
    } else if (line.startsWith("--- ")) {
      const p = linePath(line.slice(4));
      if (p !== "/dev/null") file.oldPath = strip(p, "a/");
    } else if (line.startsWith("+++ ")) {
      const p = linePath(line.slice(4));
      if (p !== "/dev/null") file.path = strip(p, "b/");
    } else if (/^Binary files .* differ$/.test(line) || line === "GIT binary patch") file.binary = true;
    else if (line === HIDDEN_LINE) file.hidden = true;
  }
  close();
  // A change set too big for git to print at all comes as every file's name
  // first and the too-large line last (changes.mjs): no file follows the
  // line, and each file it names is listed only.
  if (tooLarge && !files.some((f) => f.afterCut)) {
    for (const f of files) if (!f.hunks.length && !f.binary && !f.hidden) f.truncated = true;
  }
  // A hidden or cut file has no lines to count: changes.mjs sends its counts as trailer lines.
  for (const line of lines) {
    const m = /^# counts: (\d+)\t(\d+)\t(.+)$/.exec(line);
    if (!m) continue;
    for (const f of files) {
      if (f.path === m[3] && !f.hunks.length) {
        f.added = Number(m[1]);
        f.removed = Number(m[2]);
      }
    }
  }
  for (const f of files) delete f.afterCut;
  // Text with no file section at all is not a diff.
  if (!files.length && text.trim()) return { files: [], tooLarge: false, bad: true };
  return { files, tooLarge };
}
