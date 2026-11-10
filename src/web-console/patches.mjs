// Plan2Code Web Console - checking and merging an agent's patch into the session state.

import fs from "node:fs";
import path from "node:path";

import { checkHelpers } from "./public/subagents.js";
import { nowIso, SCHEMA } from "./files.mjs";
import { TASK_LINE_RE } from "./spec-files.mjs";

/* ----------------------------------------------------------- patch merge */

const APPEND_KEYS = new Set(["thread"]);

export function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * One form for every refusal, so a retry can be written from the message alone:
 * `item "q2" options: <what is wrong>. Like this: <the field done right>` for a
 * card, `finish: <what is wrong>. Like this: ...` for the rest. `where` is the
 * thing named (`item "q2"`, `doc "report"`), or "" for a top-level field;
 * `right` is a value, written as minified JSON, and left out when there is no
 * sensible example.
 */
export function rule(where, field, wrong, right) {
  const head = [where, field].filter(Boolean).join(" ");
  const text = String(wrong).replace(/\.\s*$/, "");
  return `${head}: ${text}.${right === undefined ? "" : ` Like this: ${JSON.stringify(right)}`}`;
}

// Reject prototype-pollution attempts before they reach the merge.
function guard(obj, where) {
  if (isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, "__proto__")) {
    throw new Error(rule("", where, '"__proto__" is not a valid key'));
  }
  return obj;
}

function mergeOne(target, patch, where) {
  const out = { ...(target || {}) };
  for (const [k, v] of Object.entries(guard(patch, where))) {
    if (v === null) delete out[k];
    else if (APPEND_KEYS.has(k) && Array.isArray(v)) out[k] = [...(out[k] || []), ...v];
    else out[k] = v;
  }
  return out;
}

// Merge a keyed collection: a known id merges one level, an unknown id appends.
// Named fields are replaced whole; thread appends.
function mergeKeyed(current, patchList, idKey, defaults, where) {
  const out = Array.isArray(current) ? current.map((x) => ({ ...x })) : [];
  for (const entry of patchList) {
    guard(entry, where);
    const id = entry[idKey];
    if (!id) throw new Error(rule("", where, `every entry needs "${idKey}"`, { [idKey]: where === "items" ? "q7" : "a1" }));
    const i = out.findIndex((x) => x[idKey] === id);
    if (entry._delete) {
      if (i !== -1) out.splice(i, 1);
    } else if (i === -1) out.push(mergeOne({ ...defaults, [idKey]: id }, entry, where));
    else out[i] = mergeOne(out[i], entry, where);
  }
  return out;
}

// Every default the console fills, so a patch leaves these out (overview.md,
// Data Model; the card in console.md lists the same ones, keep the two in step):
//   new item   status "open", required true, allowOther true, options [], thread []
//   new doc    version 1, stale false, blocks []            (DOC_DEFAULTS, below)
//   a block's  state: the page reads a missing one as "settled"
//   a review item's verdicts: the page offers approve / changes when it has none
//   option     k: "A", "B", "C"... by position, when no option of the item has
//              one (letterOptions(), below)
// Not defaulted, by choice: a topic's status, and `settle: true` on every post
// (it would close a pick that still owes its recap).
const ITEM_DEFAULTS = {
  status: "open",
  required: true,
  allowOther: true,
  options: [],
  thread: [],
};

// A, B, C... Z, then AA, AB... by position.
function optionKey(i) {
  return i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
}

/**
 * Give the options a patch sends their keys by position when none has one.
 * Every option keyed is left alone; some keyed and some not is refused, naming
 * the item. Only the options in this patch: stored ones are never re-lettered.
 */
function letterOptions(patchList) {
  return patchList.map((entry) => {
    if (!isPlainObject(entry) || !entry.id || !Array.isArray(entry.options) || !entry.options.length) return entry;
    if (!entry.options.every(isPlainObject)) return entry;
    const keyed = entry.options.filter((o) => o.k != null && o.k !== "").length;
    if (keyed === entry.options.length) return entry;
    if (keyed > 0) {
      throw new Error(
        rule(
          `item "${entry.id}"`,
          "options",
          'some options have "k" and some do not. Give every option a "k", or none to have them lettered A, B, C',
          { options: [{ text: "CSV" }, { text: "Excel" }] },
        ),
      );
    }
    return { ...entry, options: entry.options.map((o, i) => ({ ...o, k: optionKey(i) })) };
  });
}

// The question a card asks. If a patch rewrites any of these on a known id, it
// is a new question wearing an old id.
const QUESTION_FIELDS = ["kind", "title", "body", "options", "steps", "rows", "summary", "doc", "verdicts"];

/**
 * Merge item patches by id, and keep a reused id from inheriting the person's
 * old answer. `submitted` is the server's record of what they sent to the
 * PREVIOUS question. When a patch changes what an item asks and doesn't itself
 * settle it, that record (and any stale `answer`) is dropped, so the page shows
 * the new question as open instead of "Sent, waiting for Plan2Code" forever.
 */
function dropStaleSubmissions(currentItems, before, patchList, stands = new Set()) {
  const merged = mergeKeyed(currentItems, patchList, "id", ITEM_DEFAULTS, "items");
  for (const entry of patchList) {
    const prev = (before || []).find((x) => x.id === entry.id);
    // The person's note landed on this question (`noted`, set by the server).
    // It stays until the agent deals with the question: rewords it, settles it,
    // or says in the patch that the question stands as it is.
    if (prev && prev.noted) {
      const reworded = ["title", "body", "options"].some(
        (f) => f in entry && JSON.stringify(entry[f]) !== JSON.stringify(prev[f]),
      );
      const settled = entry.status === "answered" || entry.status === "skipped" || "answer" in entry;
      const item = merged.find((x) => x.id === entry.id);
      if (item && (reworded || settled || stands.has(entry.id))) delete item.noted;
    }
    // A whole new question under an answered card's id is not a typo fix: the
    // card would stay answered and nothing would be left for the person, who
    // sees a dead page. Refuse it so the agent picks a new id on the spot.
    // A change of kind is not this case: the merge below reopens it as a new
    // question on its own, so nothing stays answered.
    if (
      prev &&
      (prev.status === "answered" || prev.status === "skipped") &&
      !("status" in entry) &&
      !("answer" in entry) &&
      (!("kind" in entry) || entry.kind === prev.kind) &&
      "title" in entry &&
      entry.title !== prev.title &&
      (("body" in entry && entry.body !== prev.body) ||
        ("options" in entry && JSON.stringify(entry.options) !== JSON.stringify(prev.options)))
    ) {
      throw new Error(
        rule(
          `item "${entry.id}"`,
          "id",
          `was already used for the answered question "${prev.title}", so this new question ("${entry.title}") would stay answered and the person would see nothing to answer. Give it a new id, or set status to "reopened" to ask the old one again`,
          { id: "q12", kind: entry.kind || prev.kind, title: entry.title },
        ),
      );
    }
    if (!prev || (prev.submitted === undefined && prev.answer === undefined)) continue;
    const rewritten = QUESTION_FIELDS.some(
      (f) => f in entry && JSON.stringify(entry[f]) !== JSON.stringify(prev[f]),
    );
    const settles = entry.status === "answered" || entry.status === "skipped" || "answer" in entry;
    // A settled question edited in place (a typo in its body) stays settled; only an
    // explicit reopen turns it into a new question.
    const wasSettled = prev.status === "answered" || prev.status === "skipped";
    // A different kind is never a typo fix: a multi turned confirm is another question.
    const kindChanged = "kind" in entry && entry.kind !== prev.kind;
    const reopens = entry.status === "open" || entry.status === "reopened" || kindChanged;
    // An explicit reopen counts as asking again even with the question's
    // words unchanged (the notes reopen with a status and a thread reply):
    // the last send stops being in flight, and its note moves to the thread.
    if ((!rewritten && !reopens) || settles || (wasSettled && !reopens)) continue;
    const item = merged.find((x) => x.id === entry.id);
    if (wasSettled && !("status" in entry)) item.status = "open";
    // What they wrote with that answer ("I want changes: rename tally") is the
    // context for the question being asked again, so it moves into the thread
    // rather than leaving with the record.
    const said = prev.submitted && typeof prev.submitted.text === "string" ? prev.submitted.text.trim() : "";
    const thread = Array.isArray(item.thread) ? item.thread : [];
    if (said && !thread.some((m) => m && m.who === "user" && String(m.text || "").trim() === said)) {
      item.thread = [...thread.filter((m) => !(m && m.who === "agent" && m.at === undefined)), { who: "user", text: said, at: prev.submitted.at }, ...thread.filter((m) => m && m.who === "agent" && m.at === undefined)];
    }
    if (!("submitted" in entry)) delete item.submitted;
    delete item.answer;
  }
  return merged;
}

// A thread entry is `{ who, text }`, and the page reads nothing else. Models
// borrow the shape of the replies and doc blocks they also write, so `from` /
// `role` and `md` / `body` / `content` are lifted into place: left as they came,
// each became a "Plan2Code" bubble with nothing in it. An entry with no words
// at all is refused. The person's own notes are recorded by the server when
// they send, so an agent that echoes one back is not shown it twice.
const THREAD_TEXT_KEYS = ["text", "md", "body", "content"];
const THREAD_RIGHT = { thread: [{ who: "agent", text: "..." }] };

function normalizeThreads(patchList, currentItems) {
  return patchList.map((entry) => {
    if (!isPlainObject(entry) || entry.thread == null) return entry;
    if (!Array.isArray(entry.thread)) throw new Error(rule(`item "${entry.id}"`, "thread", "must be an array", THREAD_RIGHT));
    const prev = (currentItems || []).find((x) => x && x.id === entry.id);
    const said = new Set(
      ((prev && prev.thread) || []).filter((m) => m && m.who === "user").map((m) => String(m.text || "").trim()),
    );
    const thread = [];
    for (const m of entry.thread) {
      if (!isPlainObject(m)) throw new Error(rule(`item "${entry.id}"`, "thread", "entries must be objects", THREAD_RIGHT));
      guard(m, "thread");
      const key = THREAD_TEXT_KEYS.find((k) => typeof m[k] === "string" && m[k].trim());
      if (!key) {
        throw new Error(rule(`item "${entry.id}"`, "thread", 'an entry has no "text"; the page shows nothing else', THREAD_RIGHT));
      }
      const { from, role, md, body, content, ...rest } = m;
      const who = (m.who || from || role) === "user" ? "user" : "agent";
      const text = m[key];
      if (who === "user" && said.has(text.trim())) continue;
      thread.push({ ...rest, who, text });
    }
    return { ...entry, thread };
  });
}

const DOC_DEFAULTS = { version: 1, stale: false, blocks: [] };

// Blocks merge by id like docs do, so a patch that only settles a block's
// state keeps its text. Blocks left out of the patch stay as they are.
function mergeDocs(current, patchList) {
  // A doc's version only moves forward. One going back is a stale or copied
  // payload (last phase's progress script, say), and the page would quietly
  // show the old content under the new run's name.
  for (const entry of patchList) {
    if (!isPlainObject(entry) || typeof entry.version !== "number") continue;
    const prev = (current || []).find((d) => d && d.id === entry.id);
    if (prev && typeof prev.version === "number" && entry.version < prev.version) {
      throw new Error(
        rule(
          `doc "${entry.id}"`,
          "version",
          `the page is at version ${prev.version}; this patch sends ${entry.version}. Versions only go up: leave it out, or bump it, and check the payload is the current one`,
          { version: prev.version + 1 },
        ),
      );
    }
  }
  const merged = mergeKeyed(current, patchList, "id", DOC_DEFAULTS, "docs");
  for (const entry of patchList) {
    if (!Array.isArray(entry.blocks)) continue;
    const doc = merged.find((d) => d.id === entry.id);
    if (!doc) continue;
    const prev = (current || []).find((d) => d.id === entry.id);
    doc.blocks = mergeKeyed(prev?.blocks, entry.blocks, "id", {}, "blocks");
    // A known doc whose content moved, sent with no version, is the next
    // version: the agent no longer has to track what the page holds, and a
    // repost of unchanged content is not a new version.
    if (prev && typeof entry.version !== "number" && typeof prev.version === "number") {
      const text = (blocks) => JSON.stringify((blocks || []).map((b) => [b.id, b.md, b.state, b.image, b.alt]));
      if (text(prev.blocks) !== text(doc.blocks)) doc.version = prev.version + 1;
    }
  }
  return merged;
}

/**
 * `settle` in a patch: the cards the person just answered, marked answered
 * with what they sent as the answer. `true` takes every open card from the
 * latest send (one send stamps every card it carries with the same `at`); a
 * list names the cards. An item the same patch settles itself keeps the
 * agent's own answer: settle only fills in what the patch left out.
 */
function settleItems(items, settle, patchItems, collected) {
  if (settle === undefined || settle === false) return items;
  if (settle !== true && !(Array.isArray(settle) && settle.every((id) => typeof id === "string"))) {
    throw new Error(rule("", "settle", "must be true or a list of item ids", { settle: ["q2"] }));
  }
  const sent = (items || []).filter((i) => i && i.submitted && typeof i.submitted === "object");
  let ids;
  if (settle === true && collected && Array.isArray(collected.ids)) {
    // The send `wait` last handed over (state.collected, written as it was
    // collected): a later send the person made meanwhile is not the agent's yet.
    ids = sent.filter((i) => isOpen(i) && collected.ids.includes(i.id)).map((i) => i.id);
  } else if (settle === true) {
    const latest = sent.filter(isOpen).map((i) => String(i.submitted.at || "")).sort().pop();
    ids = sent.filter((i) => isOpen(i) && String(i.submitted.at || "") === latest).map((i) => i.id);
  } else {
    for (const id of settle) {
      // The same patch reopening it has already let go of what was sent; the
      // reopen wins below, so naming it is not an error.
      const reopening = (patchItems || []).some((e) => e && e.id === id && (e.status === "open" || e.status === "reopened"));
      if (!reopening && !sent.some((i) => i.id === id)) throw new Error(rule("", "settle", `"${id}" has nothing sent to settle`, { settle: true }));
    }
    ids = settle;
  }
  const own = new Map((patchItems || []).filter(isPlainObject).map((e) => [e.id, e]));
  return items.map((item) => {
    if (!ids.includes(item.id)) return item;
    const entry = own.get(item.id) || {};
    // The same patch reopening it (a `changes` verdict answered by a reworked
    // report) means it is not settled: no answer is recorded over the reopen.
    if (entry.status === "open" || entry.status === "reopened") return item;
    const { at, kind, ...answer } = item.submitted;
    // A settled card has been dealt with, so a note on it no longer holds
    // anything up, even when it is reopened later.
    const { noted: _noted, ...settled } = item;
    return {
      ...settled,
      // A "Skip this one" send settles as skipped, not as an answer.
      status: "status" in entry ? item.status : answer.skipped === true ? "skipped" : "answered",
      ...("answer" in entry ? {} : { answer }),
    };
  });
}

// A question the patch puts in front of the person: new, or reopened.
function asksSomething(patchItems, before) {
  return (patchItems || []).some((e) => {
    if (!isPlainObject(e) || e._delete || e.kind === "notice") return false;
    const prev = (before || []).find((x) => x && x.id === e.id);
    if (!prev) return e.kind !== undefined && (e.status === undefined || e.status === "open");
    return e.status === "reopened" || (e.status === "open" && !isOpen(prev));
  });
}

/**
 * The agent block after a patch, with the rule kept here rather than in every
 * prompt: a patch that asks a question and says nothing of the status hands
 * the turn over (a question stops the work). `quietMinutes` stays put: the
 * page only counts it while working, and a build that asked a question goes
 * back to the same long tasks once it is answered.
 */
function settleAgent(next, patch, before) {
  const said = isPlainObject(patch.agent) ? patch.agent : null;
  const saidStatus = said && "status" in said;
  // A finish ends the working stretch too (nothing may still be running at
  // one): a pause posted without a wait would otherwise sit at "working".
  const finishes = isPlainObject(patch.finish);
  if (!saidStatus && (finishes || asksSomething(patch.items, before.items))) {
    next.agent = { ...(next.agent || {}), status: "waiting" };
  }
  return next;
}

/**
 * Doc blocks that name a file get their `md` from disk: a build's phase file
 * re-posted after every task was the biggest thing an agent typed, and every
 * word of it was already on disk. `{ "id": "body", "file": "specs/x/phase-3.md" }`
 * reads the file; `"select": "tasks"` keeps only its task checkbox lines; a doc
 * with `"refresh": true` re-reads every file block it already has. Paths are
 * relative to the worktree and must stay inside it. Runs in the CLI before
 * the merge, so applyPatch itself never touches the disk.
 */
export const DOC_FILE_MAX = 512 * 1024;

export function resolveDocFiles(patch, state, worktree) {
  if (!isPlainObject(patch) || !Array.isArray(patch.docs)) return patch;
  const root = path.resolve(worktree || state.worktree || process.cwd());
  const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
  const FILE_RIGHT = { id: "b4", file: "specs/<idea>/overview.md" };
  const read = (file, select, docId, blockId) => {
    const bad = (wrong) => new Error(rule(`doc "${docId}" block "${blockId}"`, "file", wrong, FILE_RIGHT));
    if (typeof file !== "string" || !file.trim()) throw bad("must be a path");
    const abs = path.resolve(root, file);
    let real;
    try {
      real = fs.realpathSync.native(abs);
    } catch {
      throw bad(`no file at ${file}`);
    }
    const rootReal = (() => {
      try {
        return fs.realpathSync.native(root);
      } catch {
        return root;
      }
    })();
    // path.relative, not a prefix test: a worktree at a drive root ends in a
    // separator already, and win32's relative() folds case itself.
    const rel = path.relative(fold(rootReal), fold(real));
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw bad(`${file} is outside the project`);
    const stat = fs.statSync(real);
    if (!stat.isFile()) throw bad(`${file} is not a file`);
    if (stat.size > DOC_FILE_MAX) throw bad(`${file} is larger than ${DOC_FILE_MAX / 1024} KB`);
    const text = fs.readFileSync(real, "utf8").replace(/\r\n/g, "\n");
    if (select === undefined) return text;
    if (select !== "tasks") throw new Error(rule(`doc "${docId}" block "${blockId}"`, "select", 'only takes "tasks"', { id: blockId, file, select: "tasks" }));
    const tasks = text.split("\n").filter((l) => TASK_LINE_RE.test(l)).map((l) => l.trim());
    if (!tasks.length) throw new Error(rule(`doc "${docId}" block "${blockId}"`, "select", `${file} has no task lines to select`, { id: blockId, file }));
    return tasks.join("\n");
  };
  const docs = patch.docs.map((entry) => {
    if (!isPlainObject(entry)) return entry;
    const { refresh, ...rest } = entry;
    let blocks = Array.isArray(rest.blocks) ? rest.blocks : undefined;
    if (refresh === true) {
      const prev = (state.docs || []).find((d) => d && d.id === entry.id);
      const named = new Set((blocks || []).map((b) => b && b.id));
      const again = ((prev && prev.blocks) || [])
        .filter((b) => b && typeof b.file === "string" && !named.has(b.id))
        .map((b) => ({ id: b.id, file: b.file, ...(b.select ? { select: b.select } : {}) }));
      if (!again.length && !blocks) throw new Error(rule(`doc "${entry.id}"`, "refresh", "found no file blocks to re-read", { id: entry.id, blocks: [FILE_RIGHT] }));
      blocks = [...(blocks || []), ...again];
    } else if (refresh !== undefined) throw new Error(rule(`doc "${entry.id}"`, "refresh", "must be true", { id: entry.id, refresh: true }));
    if (!blocks) return rest;
    const prevBlocks = (state.docs || []).find((d) => d && d.id === entry.id)?.blocks || [];
    return {
      ...rest,
      blocks: blocks.map((b) => {
        if (!isPlainObject(b)) return b;
        const prevBlock = prevBlocks.find((x) => x && x.id === b.id);
        if (b.file === undefined || b.file === null) {
          // Typed text over a block that was a file: it stops being one, so a
          // later refresh cannot overwrite it and the prose scan sees it.
          return "md" in b && prevBlock && typeof prevBlock.file === "string" ? { ...b, file: null, select: null } : b;
        }
        // A file named again without `select` is the whole file, now and on
        // every refresh: an older select must not linger in the merge.
        const select = "select" in b ? b.select : null;
        return { state: prevBlock?.state || "settled", ...b, select, md: read(b.file, select ?? undefined, entry.id, b.id) };
      }),
    };
  });
  return { ...patch, docs };
}

/**
 * Image blocks: `{ "id", "image": "shots/run.png", "alt": "..." }` shows a
 * screenshot the agent saved under the session's `shots/` folder (Show me it
 * working). The path resolves against the session folder and must land, after
 * `realpath`, directly inside `<session>/shots/` under a plain name, so the page
 * can only ever be pointed at the agent's own pictures. The bytes decide the
 * type, as checkDocument() does for documents: a text file renamed `.png` is
 * refused. Stored session-relative; an image block never carries `md` or `file`.
 * Runs in the CLI beside resolveDocFiles(), so applyPatch never touches the disk.
 */
export const SHOTS_DIR_NAME = "shots";
export const SHOT_MAX = 5 * 1024 * 1024;
export const SHOT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(png|jpe?g|webp)$/i;

// What an image's first bytes say it is ("png", "jpeg", "webp"), or null.
export function shotType(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export function resolveDocImages(patch, state, dir) {
  if (!isPlainObject(patch) || !Array.isArray(patch.docs)) return patch;
  const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
  const shotsDir = path.join(path.resolve(dir), SHOTS_DIR_NAME);
  const IMAGE_RIGHT = { id: "b5", image: "shots/run.png", alt: "..." };
  const check = (image, docId, blockId) => {
    const at = `doc "${docId}" block "${blockId}"`;
    if (typeof image !== "string" || !image.trim()) throw new Error(rule(at, "image", "must be a path", IMAGE_RIGHT));
    const bad = (wrong) => new Error(rule(at, "image", `${image} ${wrong}`, IMAGE_RIGHT));
    let real;
    try {
      real = fs.realpathSync.native(path.resolve(dir, image));
    } catch {
      throw bad(`does not exist. Save it under the session's ${SHOTS_DIR_NAME}/ folder first`);
    }
    let realShots;
    try {
      realShots = fs.realpathSync.native(shotsDir);
    } catch {
      realShots = shotsDir;
    }
    const name = path.basename(real);
    if (fold(path.dirname(real)) !== fold(realShots)) {
      throw bad(`is outside the session's ${SHOTS_DIR_NAME}/ folder (${shotsDir}); only pictures saved there can be shown`);
    }
    if (!SHOT_NAME.test(name)) throw bad("needs a plain name: letters, digits, dots, dashes or underscores, ending .png, .jpg, .jpeg or .webp");
    const stat = fs.statSync(real);
    if (!stat.isFile()) throw bad("is not a file");
    if (stat.size > SHOT_MAX) throw bad(`is larger than ${SHOT_MAX / 1024 / 1024} MB`);
    const ext = path.extname(name).slice(1).toLowerCase();
    const want = ext === "jpg" ? "jpeg" : ext;
    if (shotType(fs.readFileSync(real)) !== want) throw bad(`is not a ${want.toUpperCase()} image (its bytes say otherwise)`);
    return `${SHOTS_DIR_NAME}/${name}`;
  };
  const docs = patch.docs.map((entry) => {
    if (!isPlainObject(entry) || !Array.isArray(entry.blocks)) return entry;
    const prevBlocks = (state.docs || []).find((d) => d && d.id === entry.id)?.blocks || [];
    return {
      ...entry,
      blocks: entry.blocks.map((b) => {
        if (!isPlainObject(b)) return b;
        const prevBlock = prevBlocks.find((x) => x && x.id === b.id);
        if (b.image === undefined || b.image === null) {
          // Text or a file over what was an image: it stops being one.
          return ("md" in b || "file" in b) && prevBlock && typeof prevBlock.image === "string" ? { ...b, image: null, alt: null } : b;
        }
        if (("md" in b && b.md != null) || ("file" in b && b.file != null)) {
          throw new Error(rule(`doc "${entry.id}" block "${b.id}"`, "image", 'an image block cannot also carry "md" or "file"', IMAGE_RIGHT));
        }
        if (b.alt != null && typeof b.alt !== "string") throw new Error(rule(`doc "${entry.id}" block "${b.id}"`, "alt", "must be text", IMAGE_RIGHT));
        return { state: prevBlock?.state || "settled", ...b, image: check(b.image, entry.id, b.id), md: null, file: null };
      }),
    };
  });
  return { ...patch, docs };
}

/**
 * Apply an agent patch to the session state.
 *
 * Scalars replace, `null` deletes, `agent`/`headline` merge one level,
 * `items`/`topics`/`docs` merge by id, and so do a doc's `blocks`. The agent
 * sends only what changed: a whole-file rewrite would put the entire state
 * back into the agent's context on every turn, and the state grows with the
 * session.
 */
const HELPERS_RIGHT = { helpers: [{ id: "h1", title: "Read the plan", ask: "Summarize the plan", state: "running" }] };
const CHAT_RIGHT = { chat: { replies: [{ re: 12, md: "..." }] } };

export function applyPatch(state, patch) {
  guard(patch, "patch");
  patch = liftActivity(patch);
  const { settle, ...rest } = patch;
  patch = rest;
  const next = { ...state };
  // `loop` is the page lock and the in-app gate: only `open` (--loop) sets or
  // clears it, never a patch.
  if (Object.hasOwn(patch, "loop")) throw new Error(rule("", "loop", "is set by open --loop, not by a patch"));
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      // The loop's report fields are set, never deleted: a null here would
      // strip the app's criteria or an already-posted report.
      if (["loopExpect", "loopOutcome", "loopEnd"].includes(k)) throw new Error(rule("", k, "cannot be deleted by a patch"));
      delete next[k];
      continue;
    }
    switch (k) {
      case "agent":
      case "headline":
        next[k] = mergeOne(next[k], v, k);
        break;
      case "items":
        if (!Array.isArray(v)) throw new Error(rule("", "items", "must be an array", { items: [{ id: "q7", kind: "text", title: "Name" }] }));
        {
          // `stands: true` says "the question is still right after the note". It
          // only clears `noted`, so it is never stored.
          const stands = new Set();
          const list = v.map((entry) => {
            if (!isPlainObject(entry) || !("stands" in entry)) return entry;
            if (typeof entry.stands !== "boolean") {
              throw new Error(rule(`item "${entry.id}"`, "stands", "must be true or false", { stands: true }));
            }
            if (entry.stands) stands.add(entry.id);
            const { stands: _stands, ...rest } = entry;
            return rest;
          });
          next.items = dropStaleSubmissions(next.items, state.items, normalizeThreads(letterOptions(list), state.items), stands);
          break;
        }
      case "topics":
        if (!Array.isArray(v)) throw new Error(rule("", "topics", "must be an array", { topics: [{ id: "t2", title: "How it behaves", status: "current" }] }));
        next.topics = mergeKeyed(next.topics, v, "id", {}, "topics");
        break;
      case "helpers":
        // The agent's report of its helpers, for the page's Subagents tab.
        // Only `post` writes it; the server's /submit never touches it.
        if (!Array.isArray(v)) throw new Error(rule("", "helpers", "must be an array", HELPERS_RIGHT));
        if (!v.every(isPlainObject)) throw new Error(rule("", "helpers", "entries must be objects, each { id, title, ask, state }", HELPERS_RIGHT));
        next.helpers = mergeKeyed(next.helpers, v, "id", {}, "helpers");
        // A real helper report supersedes the working-alone marker, whether it
        // arrives after one or beside one.
        if (next.helpers.some((h) => isPlainObject(h) && h.alone !== true))
          next.helpers = next.helpers.filter((h) => !(isPlainObject(h) && h.alone === true));
        break;
      case "docs":
        if (!Array.isArray(v)) throw new Error(rule("", "docs", "must be an array", { docs: [{ id: "report", title: "Report", blocks: [{ id: "b1", md: "..." }] }] }));
        next.docs = mergeDocs(next.docs, v);
        break;
      case "chat": {
        // The agent's side of the Quick question chat. The person's side is
        // the inbox, which only the server writes; nothing else lives here.
        if (!isPlainObject(v)) throw new Error(rule("", "chat", "must be an object", CHAT_RIGHT));
        guard(v, "chat");
        const extra = Object.keys(v).filter((key) => key !== "replies");
        if (extra.length) throw new Error(rule("", "chat", `only takes "replies" (not ${extra.map((key) => `"${key}"`).join(", ")})`, CHAT_RIGHT));
        const chat = { ...(next.chat || {}) };
        if (v.replies != null) {
          if (!Array.isArray(v.replies)) throw new Error(rule("", "chat.replies", "must be an array", CHAT_RIGHT));
          // A reply with no id is named for the message it answers (`r<seq>`),
          // so a repeat delivery re-posted the same way replaces, never doubles.
          const named = v.replies.map((r) =>
            isPlainObject(r) && (r.id === undefined || r.id === "") && Number.isInteger(r.re) ? { ...r, id: `r${r.re}` } : r,
          );
          chat.replies = mergeKeyed(chat.replies, named, "id", {}, "chat.replies");
        }
        next.chat = chat;
        break;
      }
      case "loopOutcome":
        // The skill's one report of a phase built under the loop. The shape is
        // checked by validate(); here only who may send it, and how often.
        if (!state.loop?.driving) {
          throw new Error(rule("", "loopOutcome", "is only accepted in a loop session; a resume without --loop unlocked it, so run open --resume <sid> --workflow <yours> --loop, then post this again"));
        }
        if (state.loopOutcome !== undefined) throw new Error(rule("", "loopOutcome", "was already posted for this session"));
        next.loopOutcome = v;
        break;
      case "loopExpect":
        // The app's judging criteria for the run's report: a `loopOutcome` is
        // held to them in validate(), so a report missing a required piece is
        // refused here while the agent can still fix it. The app owns the
        // field and stamps once per session (an unlock or a hop clears it
        // first); a second stamp, from anyone, is refused while the first is
        // valid, but a corrupt stored stamp can be overwritten. An early
        // self-stamp only weakens this early check: the driver's verdict is
        // unchanged.
        if (!state.loop?.driving) throw new Error(rule("", "loopExpect", "is only accepted in a loop session"));
        if (isPlainObject(state.loopExpect) && loopExpectProblems(state.loopExpect).length === 0) throw new Error(rule("", "loopExpect", "was already stamped for this session"));
        if (state.loopOutcome !== undefined) throw new Error(rule("", "loopExpect", "came after the run's report; post it while the phase builds"));
        next.loopExpect = v;
        break;
      case "loopEnd":
        // The app's word on how the loop ended; a later one replaces the earlier.
        next.loopEnd = v;
        break;
      default:
        next[k] = v;
    }
  }
  if (settle !== undefined) next.items = settleItems(next.items || [], settle, patch.items, state.collected);
  // A question put to the person over a standing ending means the work went
  // on past it: the finish card would gray the form out, and the person has
  // no way to answer. The ending comes down unless this patch posts its own.
  if (next.finish && !Object.hasOwn(patch, "finish") && asksSomething(patch.items, state.items)) {
    delete next.finish;
  }
  refuseQuestionPastNote(state, next);
  refuseQuestionPastAnswers(state, next, patch);
  return stampTimes(state, settleAgent(next, patch, state));
}

/**
 * A question the person put a note on (`noted`, set by the server) stays in
 * front of them until the agent deals with it. A new question asked past it
 * would be buried behind a card the reply may have made moot, so the patch
 * that adds one must also reword, delete or confirm (`stands`) every noted
 * card. Only a new open required question counts: a reply alone, an optional
 * card or a notice asks nothing new. A finish ends the session, and the
 * dashboard draws no cards, so neither is held to it.
 */
function refuseQuestionPastNote(before, next) {
  if (next.finish != null || next.workflow === "dashboard" || !Array.isArray(next.items)) return;
  const noted = next.items.filter((i) => isPlainObject(i) && i.noted === true && isOpen(i));
  if (!noted.length) return;
  const had = new Set((Array.isArray(before.items) ? before.items : []).map((i) => i && i.id));
  const asksNew = next.items.some(
    (i) => isPlainObject(i) && !had.has(i.id) && i.required !== false && i.kind !== "notice" && i.noted !== true && isOpen(i),
  );
  if (!asksNew) return;
  // A note not yet replied to is named too: validate() never runs after this
  // throw, and the agent would otherwise fix one and be refused for the other.
  throw new Error(
    noted
      .flatMap((i) => [
        ...(lastWordIsTheirs(i) ? [unansweredNote(i)] : []),
        rule(
          `item "${i.id}"`,
          "noted",
          'has a note from the person that you answered in the thread: reword it, delete it ("_delete": true) or send "stands": true, in the same patch that adds a new question',
          { id: i.id, stands: true },
        ),
      ])
      .join("\n"),
  );
}

/**
 * The cards the person just sent (`state.collected.ids`, written when `wait`
 * handed the send over) are the agent's to settle. A patch that asks a new
 * question while one of them is still open, untouched and unsettled, leaves
 * two cards in front of the person, and the page can land on the old, already
 * answered one (seen in the Dead Code skill: the first and second questions
 * stayed in the list after they were answered). So the patch that adds a new
 * open required question must also settle each of them (`settle: true`),
 * reword it, reopen it, delete it or say it `stands`. A finish ends the
 * session and the dashboard draws no cards, so neither is held to it.
 */
function refuseQuestionPastAnswers(before, next, patch) {
  if (next.finish != null || next.workflow === "dashboard" || !Array.isArray(next.items)) return;
  const ids = Array.isArray(before.collected?.ids) ? before.collected.ids : [];
  if (!ids.length) return;
  const had = new Set((Array.isArray(before.items) ? before.items : []).map((i) => i && i.id));
  const asksNew = next.items.some(
    (i) => isPlainObject(i) && !had.has(i.id) && i.required !== false && i.kind !== "notice" && isOpen(i),
  );
  if (!asksNew) return;
  // `stands` keeps a card open on purpose; an `answer` in the patch is the agent settling it with its own reading (see settleItems).
  const dealt = new Set((patch.items || []).filter((e) => isPlainObject(e) && (e.stands === true || "answer" in e)).map((e) => e.id));
  const left = next.items.filter(
    (i) => isPlainObject(i) && ids.includes(i.id) && i.kind !== "notice" && isOpen(i) && isPlainObject(i.submitted) && !dealt.has(i.id),
  );
  if (!left.length) return;
  throw new Error(
    left
      .map((i) =>
        rule(
          `item "${i.id}"`,
          "settle",
          'was answered in the send you just collected and is still open: settle it in the same patch that adds a new question, with "settle": true (or a list of ids), or reword it, reopen it ("status": "reopened"), delete it ("_delete": true) or send "stands": true',
          { settle: true },
        ),
      )
      .join("\n"),
  );
}

// The person had the last word in a card's thread: their note waits for a reply.
function lastWordIsTheirs(item) {
  const thread = Array.isArray(item.thread) ? item.thread : [];
  const last = thread[thread.length - 1];
  return isPlainObject(last) && last.who === "user";
}

function unansweredNote(item) {
  return rule(`item "${item.id}"`, "thread", "has an unanswered note from the person; reply in its thread in this patch", {
    id: item.id,
    thread: [{ who: "agent", text: "..." }],
  });
}

// `activity` belongs under `agent`, which is the only place the page reads it.
// Sent at the top level it would be stored where nothing looks, and the page
// would sit on its starting screen while the skill works.
function liftActivity(patch) {
  if (!Object.prototype.hasOwnProperty.call(patch, "activity")) return patch;
  const { activity, ...rest } = patch;
  if (rest.agent === null) return rest;
  const agent = isPlainObject(rest.agent) ? rest.agent : {};
  return { ...rest, agent: "activity" in agent ? agent : { ...agent, activity } };
}

// The agent never writes a timestamp. Models do not reliably know the time,
// and a wrong `since` makes the page's elapsed counters nonsense.
function stampTimes(before, next) {
  const now = nowIso();
  if (next.agent) {
    // A status change starts its own clock: `since` merged along from the
    // last status would date a fresh working turn to when the session opened.
    const changed = !before.agent || before.agent.status !== next.agent.status;
    if (changed) next.agent = { ...next.agent, since: now };
    else if (!next.agent.since) next.agent = { ...next.agent, since: before.agent?.since || now };
  }
  if (Array.isArray(next.items)) {
    for (const entry of next.items) {
      if (Array.isArray(entry.thread)) {
        for (const m of entry.thread) if (!m.at) m.at = now;
      }
    }
  }
  if (Array.isArray(next.docs)) {
    for (const d of next.docs) {
      const prev = (before.docs || []).find((x) => x.id === d.id);
      if (!prev || prev.version !== d.version) d.at = d.at || now;
    }
  }
  next.updatedAt = now;
  return next;
}

/* --------------------------------------------------------- house rules */

export const ITEM_KINDS = new Set([
  "choice",
  "multi",
  "text",
  "confirm",
  "recap",
  "review",
  "checklist",
  "menu",
  "list",
  "notice",
]);

// grilling.md keeps an explicit do-not-say list: this bookkeeping vocabulary is
// internal and must never reach the human. In the terminal that is a prompt rule
// the model can drift from. Routing through a server makes it mechanical.
const JARGON = [
  /\bgrill(ing|ed)?\b/i,
  /\bfrontier\b/i,
  /\bfog\b/i,
  /\bHITL\b/,
  /\bAFK\b/,
  /\bdurable\b/i,
  /Locked:/,
  /Blocked by:/,
  /\bState:\s/,
];

// Completion markers refused outright, so agent text can never fake a done
// signal; pathfinder forbids them under specs/. The other copy is LOOP_TOKENS
// in src/skill-scripts/common.mjs: the console is not a skill script and
// cannot import it, so keep the two in step.
const FORBIDDEN_TOKENS =
  /\b(TASK_COMPLETE|PHASE_COMPLETE|ALL_TASKS_COMPLETE|IMPLEMENTATION_COMPLETE|SPEC_COMPLETE|WORK_COMPLETE)\b/;

// plan2code-metrics scrapes the confidence breakdown from a rendered doc, so a
// label and score it reads must not appear in agent text. The shapes live in
// metrics-pattern.json beside this file; the skill scripts' copy is SCRAPE in
// src/skill-scripts/common.mjs and the collector's is
// plan2code-metrics/src/metrics-pattern.json. A test fails when they drift.
const METRICS_BAIT = JSON.parse(fs.readFileSync(new URL("./metrics-pattern.json", import.meta.url), "utf8")).breakdown.map((b) => ({
  name: b.name,
  re: new RegExp(b.source, b.flags),
}));

// The marker and metrics-bait scan on its own, for agent text that never
// reaches state.json (a post's `run` / `folderIssue`). Problems as sentences.
export function proseProblems(prose, subject = "text") {
  const problems = [];
  const marker = prose.match(FORBIDDEN_TOKENS);
  if (marker) {
    problems.push(
      rule("", subject, `contains a loop completion marker (${marker[0]}); these are reserved. Reword it`, marker[0].toLowerCase().replaceAll("_", " ")),
    );
  }
  for (const { name, re } of METRICS_BAIT) {
    const bait = prose.match(re);
    if (!bait) continue;
    problems.push(
      rule("", subject, `contains ${JSON.stringify(bait[0].trim())}; the metrics collector scrapes that pattern. Hyphenate it or reword`, `${name}-score ${bait[1]}`),
    );
    break;
  }
  return problems;
}

// Every string under a value, with where it sits: `${base}` then .key and [i]
// steps, so a scan can say which field an offending word is in.
function walkStrings(value, base, visit) {
  if (typeof value === "string") visit(value, base);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${base}[${i}]`, visit));
  else if (isPlainObject(value)) for (const [k, v] of Object.entries(value)) walkStrings(v, base ? `${base}.${k}` : k, visit);
}

export const MAX_OPEN_REQUIRED = 3;

const OPTIONS_RIGHT = { options: [{ text: "CSV" }, { text: "Excel" }] };
const OPTION_RIGHT = { text: "CSV", detail: "Opens in any spreadsheet" };
const VERDICTS_RIGHT = {
  verdicts: [
    { id: "approve", label: "Approve" },
    { id: "changes", label: "Request changes" },
  ],
};
const TITLE_RIGHT = { title: "Export format" };
const FINISH_RIGHT = { finish: { headline: "Paused: waiting on you", command: "/plan2code-1-plan" } };
const HELPER_RIGHT = { helpers: [{ id: "h1", title: "Read the plan", ask: "Summarize the plan", state: "running" }] };

// `problem` with the field done right appended, for a message that came from
// shared code (public/subagents.js) and has no example of its own.
const likeThis = (problem, right) => rule("", "", problem, right).replace(/^: /, "");

/**
 * Validate a merged state before it is written.
 *
 * Returns an array of human-readable problems, each in rule()'s form: the item
 * or field it is about, what is wrong, and the field done right. An empty array
 * means the patch is good. These checks turn four prose rules into mechanical
 * ones.
 */
export function validate(state) {
  const problems = [];

  if (!Array.isArray(state.items)) {
    return [rule("", "items", "must be an array", { items: [{ id: "q7", kind: "text", title: "Name" }] })];
  }

  const ids = new Set();
  for (const item of state.items) {
    const at = `item "${item.id}"`;
    if (!item.id) problems.push(rule("", "items", 'an entry has no "id". Every new question gets a new id', { id: "q7" }));
    if (ids.has(item.id)) problems.push(rule(at, "id", "is used twice. Every new question gets a new id", { id: "q8" }));
    ids.add(item.id);

    if (!ITEM_KINDS.has(item.kind)) {
      problems.push(rule(at, "kind", `unknown kind "${item.kind}" (one of: ${[...ITEM_KINDS].join(", ")})`, { kind: "choice" }));
    }
    if (typeof item.title !== "string" || !item.title.trim()) {
      problems.push(rule(at, "title", "needs a plain-English title", TITLE_RIGHT));
    } else {
      for (const re of JARGON) {
        if (re.test(item.title)) {
          problems.push(
            rule(
              at,
              "title",
              `contains internal vocabulary (${re.source}). Titles are read by people who have never seen this workflow`,
              TITLE_RIGHT,
            ),
          );
          break;
        }
      }
    }
    if ((item.kind === "choice" || item.kind === "multi") && !Array.isArray(item.options)) {
      problems.push(rule(at, "options", `is a ${item.kind} and needs "options"`, OPTIONS_RIGHT));
    }
    if ((item.kind === "choice" || item.kind === "multi") && Array.isArray(item.options)) {
      item.options.forEach((o, i) => {
        if (!isPlainObject(o) || typeof o.k !== "string" || !o.k.trim()) {
          problems.push(
            rule(at, "options", `option ${i + 1} has no usable "k" (its key, a string like "A"). Give every option a "k", or none to have them lettered A, B, C`, OPTIONS_RIGHT),
          );
        } else if (typeof o.text !== "string" || !o.text.trim()) {
          problems.push(
            rule(at, "options", `option "${o.k}" needs "text" (the label) and optionally "detail". Options use "text"/"detail", not "label"/"desc"`, OPTION_RIGHT),
          );
        }
      });
    }
    if (item.verdicts != null) {
      if (!Array.isArray(item.verdicts) || !item.verdicts.length) {
        problems.push(rule(at, "verdicts", "must be a non-empty array of { id, label }", VERDICTS_RIGHT));
      } else {
        for (const v of item.verdicts) {
          if (!v || typeof v.id !== "string" || !v.id.trim()) {
            problems.push(rule(at, "verdicts", 'a verdict has no "id"', VERDICTS_RIGHT));
          } else if (typeof v.label !== "string" || !v.label.trim()) {
            problems.push(rule(at, "verdicts", `verdict "${v.id}" needs a "label" (the button text). Verdicts use "label", not "text"`, VERDICTS_RIGHT));
          }
        }
      }
    }
    if (item.templates != null && (item.kind !== "text" || item.templates !== "idea")) {
      problems.push(rule(at, "templates", 'only a text item can carry it, and its only value is "idea"', { kind: "text", templates: "idea" }));
    }
    // The box the page fills from a Notebook tab picked at Start.
    if (item.fill != null && (item.kind !== "text" || item.fill !== "note")) {
      problems.push(rule(at, "fill", 'only a text item can carry it, and its only value is "note"', { kind: "text", fill: "note" }));
    }
    // The page compiles it as the person types, and a pattern that does not
    // compile throws there, on every keystroke, with nothing on screen to say why.
    if (item.pattern != null) {
      const patternRight = { pattern: "^[a-z0-9-]+$", patternHint: "kebab-case" };
      if (typeof item.pattern !== "string") {
        problems.push(rule(at, "pattern", "must be a string holding a JavaScript regular expression", patternRight));
      } else {
        try {
          new RegExp(item.pattern);
        } catch (e) {
          problems.push(rule(at, "pattern", `is not a valid JavaScript regular expression: ${e.message}`, patternRight));
        }
      }
    }
    const recs = (item.options || []).filter((o) => o && o.recommended);
    if (recs.length > 1) {
      problems.push(rule(at, "options", `${recs.length} options are marked recommended; at most one`, [{ text: "A", recommended: true }, { text: "B" }]));
    }
    // Which cards the Implementation Loop answers itself; the page draws them.
    if (item.handledBy != null) {
      if (item.handledBy !== "loop") problems.push(rule(at, "handledBy", 'can only be "loop"', { handledBy: "loop" }));
      else if (!state.loop?.driving) problems.push(rule(at, "handledBy", "is only valid in a loop session", { handledBy: null }));
    }
  }

  // The loop's reports: the app's criteria, the skill's outcome and the
  // app's ending.
  if (state.loopExpect !== undefined) problems.push(...loopExpectProblems(state.loopExpect));
  if (state.loopOutcome !== undefined) problems.push(...loopOutcomeProblems(state.loopOutcome, state.loopExpect));
  if (state.loopEnd !== undefined) problems.push(...loopEndProblems(state.loopEnd, state));

  // A note on a card is unanswered the moment no agent words follow it in its
  // thread. Once that is true, no patch may move past it except one that
  // finally replies: deleting the item drops it from state.items before this
  // check ever sees it, and the session's own ending is exempt because
  // nothing further is coming to answer into.
  if (state.finish == null) {
    for (const item of state.items) {
      if (lastWordIsTheirs(item)) problems.push(unansweredNote(item));
    }
  }

  // The dashboard's page is the menu: a card posted there is drawn nowhere,
  // yet counts as open (and keeps Stop live for a question nobody can see).
  if (state.workflow === "dashboard" && state.items.some((i) => isOpen(i))) {
    problems.push(
      rule("", "items", "the dashboard draws no question cards. Post its menu (and agent), and launch the skill a question belongs to", {
        menu: { note: "...", recommend: "plan2code-init" },
      }),
    );
  }

  // A notice asks nothing (the git board keeps its result line open all
  // session), so it never takes one of the three slots.
  const openRequired = state.items.filter((i) => i.required !== false && i.kind !== "notice" && isOpen(i));
  if (openRequired.length > MAX_OPEN_REQUIRED) {
    problems.push(
      rule(
        "",
        "items",
        `${openRequired.length} questions are open at once (${openRequired.map((i) => i.id).join(", ")}). The cap is ${MAX_OPEN_REQUIRED} ` +
          `(the ceiling is the person's attention, not the screen's). Send the rest after these are answered, or mark some "required": false`,
        { id: openRequired[openRequired.length - 1].id, required: false },
      ),
    );
  }

  // The session's own ending. Absent for every session that is still running,
  // so only its shape is checked, never its presence. The command is optional:
  // a finish with no command is a finished session with nothing left to run,
  // and the page points at the dashboard instead of a next step.
  const fin = state.finish;
  if (fin != null) {
    // The page would warn about losing work after the session ended (FR-13).
    if (typeof state.stopWarning === "string" && state.stopWarning.trim()) {
      problems.push(
        rule("", "finish", `"stopWarning" is still set ("${state.stopWarning}"), so the page would warn about losing work after the session ended. Clear it in the same patch`, {
          stopWarning: "",
          finish: { headline: "Paused: <what is saved>", command: "/<the skill to resume>" },
        }),
      );
    }
    if (typeof fin !== "object" || Array.isArray(fin)) {
      problems.push(rule("", "finish", "must be an object", FINISH_RIGHT));
    } else {
      if (typeof fin.headline !== "string" || !fin.headline.trim()) {
        problems.push(rule("", "finish.headline", "needs a plain-English headline saying what just happened", { finish: { headline: "Phase 3 is done" } }));
      }
      if (fin.command != null && (typeof fin.command !== "string" || !fin.command.trim())) {
        problems.push(rule("", "finish.command", "must be a non-empty string, or left out when there is nothing to run", { finish: { command: "/plan2code-1-plan" } }));
      } else if (fin.command != null && (fin.command.includes("<") || fin.command.includes(">"))) {
        // A rendered command is copied and run verbatim. A leftover
        // placeholder reaches someone who has no way to know what fills it.
        problems.push(
          rule("", "finish.command", `still has a placeholder in it ("${fin.command}"). Fill it in`, {
            finish: { command: "/plan2code-3-implement specs/lunch-vote/overview.md" },
          }),
        );
      }
      if (fin.console != null && typeof fin.console !== "boolean") {
        problems.push(rule("", "finish.console", "must be true or false (or left out, to follow the command)", { finish: { console: true } }));
      }
      if (fin.dashboard != null && typeof fin.dashboard !== "boolean") {
        problems.push(rule("", "finish.dashboard", "must be true or false (or left out: no dashboard button)", { finish: { dashboard: true } }));
      }
      if (fin.commit != null && typeof fin.commit !== "boolean") {
        problems.push(rule("", "finish.commit", "must be true or false (or left out: no commit button)", { finish: { commit: true } }));
      }
      // (The pause test is the page's finishPaused() in public/answers.js: keep them in step.)
      // Update CHANGELOG first: only the builds that end on a commit and have
      // no sign-off to put it on. An implementation phase never offers it. A
      // pause ignores it.
      if (fin.changelog != null && typeof fin.changelog !== "boolean") {
        problems.push(rule("", "finish.changelog", "must be true or false (or left out: no changelog button)", { finish: { changelog: true } }));
      } else if (fin.changelog === true && !/^\s*paused\b/i.test(String(fin.headline || "")) && !["quick-task", "finalize"].includes(state.workflow)) {
        problems.push(rule("", "finish.changelog", "is only for a finished quick-task or finalize", { finish: { changelog: null } }));
      }
      // The review offer on a finished build: true, or an object carrying the
      // button's heading. The heading is read by the person, so it faces the
      // same vocabulary check as a title.
      if (fin.review != null && typeof fin.review !== "boolean") {
        if (typeof fin.review !== "object" || Array.isArray(fin.review)) {
          problems.push(rule("", "finish.review", 'must be true, false, or { "label": "..." }', { finish: { review: { label: "Review the code" } } }));
        } else if (fin.review.label != null) {
          if (typeof fin.review.label !== "string") {
            problems.push(rule("", "finish.review.label", "must be a string", { finish: { review: { label: "Review the code" } } }));
          } else {
            const hit = JARGON.find((re) => re.test(fin.review.label));
            if (hit) problems.push(rule("", "finish.review.label", `contains internal vocabulary (${hit.source})`, { finish: { review: { label: "Review the code" } } }));
          }
        }
      }
      for (const re of JARGON) {
        if (typeof fin.headline === "string" && re.test(fin.headline)) {
          problems.push(rule("", "finish.headline", `contains internal vocabulary (${re.source})`, { finish: { headline: "Phase 3 is done" } }));
          break;
        }
      }
    }
  }

  // How long a silence is normal while the agent works (a build task). Bounded,
  // because the page stops calling a quiet agent stuck for this long, and a
  // huge number would hide a session that really has died.
  const quiet = state.agent && state.agent.quietMinutes;
  if (quiet != null && (typeof quiet !== "number" || !(quiet > 0) || quiet > 60)) {
    problems.push(rule("", "agent.quietMinutes", "must be a number of minutes between 1 and 60 (or null to clear it)", { agent: { quietMinutes: 15 } }));
  }
  // The page reads exactly two: anything else would leave it guessing whose
  // turn it is.
  if (state.agent && state.agent.status != null && !["working", "waiting"].includes(state.agent.status)) {
    problems.push(rule("", "agent.status", `must be "working" or "waiting" (not "${state.agent.status}")`, { agent: { status: "working" } }));
  }
  if (state.agent && state.agent.activity != null && typeof state.agent.activity !== "string") {
    problems.push(rule("", "agent.activity", "must be a short sentence saying what you are doing", { agent: { activity: "Reading the plan" } }));
  }

  // Open gates only: an approval already given (last phase's sign-off) is a
  // record, and must not stop the next phase from asking for its own.
  const gates = state.items.filter((i) => i.gate && i.gate.authoritative && isOpen(i));
  if (gates.length > 1) {
    problems.push(
      rule(
        "",
        "items",
        `${gates.length} authoritative approval gates are open (${gates.map((g) => g.id).join(", ")}). Only one workflow may own sign-off at a time`,
        { id: gates[gates.length - 1].id, gate: null },
      ),
    );
  }

  // An image block's alt text is its caption, read by the same newcomers a
  // title is.
  for (const d of state.docs || []) {
    for (const b of (isPlainObject(d) && Array.isArray(d.blocks) ? d.blocks : [])) {
      if (!isPlainObject(b) || typeof b.image !== "string" || typeof b.alt !== "string") continue;
      const hit = JARGON.find((re) => re.test(b.alt));
      if (hit) {
        problems.push(
          rule(`doc "${d.id}" block "${b.id}"`, "alt", `contains internal vocabulary (${hit.source})`, { id: b.id, image: b.image, alt: "The finished screen" }),
        );
      }
    }
  }

  // Scan what the AGENT wrote, never what the person typed. `submitted` is the
  // server's record of an answer someone pressed Send on; if their own words
  // happened to contain "TASK_COMPLETE" or "Risk 3", every later agent patch
  // would be rejected and the session would wedge with no way out. Scanned one
  // string at a time so a refusal names the item and field it found the word in.
  const scan = (value, prefix) =>
    walkStrings(value, "", (str, where) => problems.push(...proseProblems(str, [prefix, where].filter(Boolean).join(" "))));
  for (const { submitted, sentNote, thread, ...rest } of state.items) {
    const item = {
      ...rest,
      thread: Array.isArray(thread) ? thread.filter((m) => !m || m.who !== "user") : thread,
    };
    scan(item, `item "${item.id}"`);
  }
  // A doc block read from a file (`file`) is the file's own words, already on
  // disk: the agent cannot reword it, and refusing it would wedge every post
  // that refreshes it. Only what the agent typed is scanned.
  for (const d of state.docs || []) {
    if (!isPlainObject(d)) continue;
    const typed = Array.isArray(d.blocks) ? { ...d, blocks: d.blocks.filter((b) => !(isPlainObject(b) && typeof b.file === "string")) } : d;
    scan(typed, `doc "${d.id}"`);
  }
  scan(state.finish || {}, "finish");
  scan(state.menu || {}, "menu");

  // The agent's report of its helpers: the shape the page draws from
  // (subagents.js), then the same prose scan as everything else it writes.
  if (state.helpers != null) {
    problems.push(...checkHelpers(state.helpers).map((p) => likeThis(p, HELPER_RIGHT)));
    for (const helper of Array.isArray(state.helpers) ? state.helpers : []) {
      if (!isPlainObject(helper)) continue;
      for (const field of ["title", "ask", "result"]) {
        if (typeof helper[field] === "string") {
          problems.push(...proseProblems(helper[field], `helper "${helper.id}" ${field}`));
        }
      }
    }
  }

  // A finish ends the session, and a helper still shown as running would sit
  // on the Subagents tab, spinning, after everything is over.
  if (state.finish != null && Array.isArray(state.helpers)) {
    const running = state.helpers.filter((h) => isPlainObject(h) && h.state === "running").map((h) => h.id);
    if (running.length) {
      problems.push(
        rule("", "finish", `helper ${running.map((id) => `"${id}"`).join(", ")} still shows as running: post each one as done or failed first, or in the same patch`, {
          helpers: [{ id: running[0], state: "done" }],
        }),
      );
    }
  }

  return problems;
}

export function isOpen(item) {
  return item.status === "open" || item.status === "reopened";
}

/* ------------------------------------------------------ the loop's reports */

const LOOP_LEVELS = ["critical", "warning", "suggestion"];
const LOOP_REASONS = ["tests", "findings", "blocked", "conflict", "other"];
const LOOP_CAN = ["resume", "ask", "fix", "finalize", "dashboard"];
const TASK_ID = /^\d+\.\d+$/;

// A one-line path that stays inside the project: not absolute, no `..` step.
const relativePath = (f) =>
  typeof f === "string" && f.length > 0 && !/[\r\n]/.test(f) && !path.isAbsolute(f) && !/^[A-Za-z]:/.test(f) && !f.replaceAll("\\", "/").split("/").includes("..");
const isNonNegInt = (n) => Number.isInteger(n) && n >= 0;
const isPosInt = (n) => Number.isInteger(n) && n > 0;
// One line of 1..max characters.
const oneLine = (s, max) => typeof s === "string" && s.length >= 1 && s.length <= max && !/[\r\n]/.test(s);

/**
 * Problems with a `loopExpect` (the app's judging criteria for the run's
 * report), as sentences naming the field; an empty array when it is good.
 */
export function loopExpectProblems(e) {
  const p = [];
  if (!isPlainObject(e)) return ["loopExpect must be an object"];
  if (typeof e.review !== "boolean") p.push("loopExpect.review must be true or false");
  if (e.fix !== "smart" && !(Array.isArray(e.fix) && e.fix.every((l) => LOOP_LEVELS.includes(l)))) {
    p.push(`loopExpect.fix must be "smart" or an array of ${LOOP_LEVELS.join(", ")}`);
  }
  if (typeof e.guess !== "boolean") p.push("loopExpect.guess must be true or false");
  return p;
}

/**
 * Problems with a `loopOutcome` (what the skill reports after building a phase
 * under the loop), as sentences naming the field; an empty array when it is
 * good. Rules are the overview's API section; house rules 4 and 5 apply to
 * every string. `expect` is the app's `loopExpect`, when the session holds
 * one: the report is then also held to what this loop asked for.
 */
export function loopOutcomeProblems(o, expect) {
  const p = [];
  const bad = (field, rule) => p.push(`loopOutcome.${field} ${rule}`);
  if (!isPlainObject(o)) return ["loopOutcome must be an object"];
  const prose = (field, s) => {
    if (typeof s === "string") p.push(...proseProblems(s, `loopOutcome.${field}`));
  };
  if (!isPosInt(o.phase)) bad("phase", "must be a positive integer");
  if (o.result !== "passed" && o.result !== "failed") bad("result", 'must be "passed" or "failed"');
  if (o.result === "passed") {
    if (o.reason !== null) bad("reason", "must be null when the phase passed");
  } else if (o.result === "failed" && !LOOP_REASONS.includes(o.reason)) {
    bad("reason", `must be one of ${LOOP_REASONS.join(", ")} when the phase failed`);
  }
  if (!oneLine(o.summary, 200)) bad("summary", "must be one line of 1 to 200 characters");
  else prose("summary", o.summary);

  if (!isPlainObject(o.tests)) bad("tests", "must be an object { ran, passed, summary }");
  else {
    if (typeof o.tests.ran !== "boolean") bad("tests.ran", "must be true or false");
    if (typeof o.tests.passed !== "boolean") bad("tests.passed", "must be true or false");
    if (typeof o.tests.summary !== "string" || /[\r\n]/.test(o.tests.summary)) bad("tests.summary", "must be a one-line string");
    else prose("tests.summary", o.tests.summary);
  }

  if (!isPlainObject(o.review)) bad("review", "must be an object { ran, recheck, left, unfixed }");
  else {
    const r = o.review;
    if (typeof r.ran !== "boolean") bad("review.ran", "must be true or false");
    if (typeof r.recheck !== "boolean") bad("review.recheck", "must be true or false");
    if (!isPlainObject(r.left)) bad("review.left", "must be an object { critical, warning, suggestion }");
    else for (const level of LOOP_LEVELS) if (!isNonNegInt(r.left[level])) bad(`review.left.${level}`, "must be a non-negative integer");
    if (r.triage !== undefined) {
      const t = r.triage;
      if (!isPlainObject(t)) bad("review.triage", "must be an object { ran, skipped } when present");
      else {
        if (typeof t.ran !== "boolean") bad("review.triage.ran", "must be true or false");
        if (!Array.isArray(t.skipped)) bad("review.triage.skipped", "must be an array");
        else {
          if (t.skipped.length > 50) bad("review.triage.skipped", "can hold at most 50 entries");
          t.skipped.forEach((u, i) => {
            const at = `review.triage.skipped[${i}]`;
            if (!isPlainObject(u)) return bad(at, "must be an object { level, title, file, reason }");
            if (!LOOP_LEVELS.includes(u.level)) bad(`${at}.level`, `must be one of ${LOOP_LEVELS.join(", ")}`);
            if (typeof u.title !== "string" || !u.title.trim() || /[\r\n]/.test(u.title)) bad(`${at}.title`, "must be a non-empty one-line string");
            else prose(`${at}.title`, u.title);
            if (typeof u.file !== "string" || /[\r\n]/.test(u.file)) bad(`${at}.file`, "must be a one-line string");
            else prose(`${at}.file`, u.file);
            if (!oneLine(u.reason, 200)) bad(`${at}.reason`, "must be one line of 1 to 200 characters");
            else prose(`${at}.reason`, u.reason);
          });
        }
      }
    }
    if (!Array.isArray(r.fixed)) bad("review.fixed", "must be an array (empty when nothing was fixed)");
    else {
      if (r.fixed.length > 50) bad("review.fixed", "can hold at most 50 entries");
      r.fixed.forEach((u, i) => {
        if (!isPlainObject(u)) return bad(`review.fixed[${i}]`, "must be an object { level, title, file? }");
        if (!LOOP_LEVELS.includes(u.level)) bad(`review.fixed[${i}].level`, `must be one of ${LOOP_LEVELS.join(", ")}`);
        if (typeof u.title !== "string" || !u.title.trim() || /[\r\n]/.test(u.title)) bad(`review.fixed[${i}].title`, "must be a non-empty one-line string");
        else prose(`review.fixed[${i}].title`, u.title);
        if (u.file !== undefined && (typeof u.file !== "string" || /[\r\n]/.test(u.file))) bad(`review.fixed[${i}].file`, "must be a one-line string when present");
        else prose(`review.fixed[${i}].file`, u.file);
      });
    }
    if (!Array.isArray(r.unfixed)) bad("review.unfixed", "must be an array");
    else {
      if (r.unfixed.length > 50) bad("review.unfixed", "can hold at most 50 entries");
      r.unfixed.forEach((u, i) => {
        if (!isPlainObject(u)) return bad(`review.unfixed[${i}]`, "must be an object { level, title, file? }");
        if (!LOOP_LEVELS.includes(u.level)) bad(`review.unfixed[${i}].level`, `must be one of ${LOOP_LEVELS.join(", ")}`);
        if (typeof u.title !== "string" || !u.title.trim() || /[\r\n]/.test(u.title)) bad(`review.unfixed[${i}].title`, "must be a non-empty one-line string");
        else prose(`review.unfixed[${i}].title`, u.title);
        if (u.file !== undefined && (typeof u.file !== "string" || /[\r\n]/.test(u.file))) bad(`review.unfixed[${i}].file`, "must be a one-line string when present");
        else prose(`review.unfixed[${i}].file`, u.file);
      });
    }
  }

  if (!isPlainObject(o.tasks)) bad("tasks", "must be an object { blocked, assumed }");
  else {
    for (const key of ["blocked", "assumed"]) {
      const list = o.tasks[key];
      if (!Array.isArray(list) || !list.every((t) => typeof t === "string" && TASK_ID.test(t))) {
        bad(`tasks.${key}`, 'must be an array of task ids like "2.4"');
      }
    }
  }

  if (!Array.isArray(o.conflicts) || !o.conflicts.every((c) => typeof c === "string" && !/[\r\n]/.test(c))) {
    bad("conflicts", "must be an array of one-line strings");
  } else o.conflicts.forEach((c, i) => prose(`conflicts[${i}]`, c));

  if (!Array.isArray(o.decisions)) bad("decisions", "must be an array of one-line strings (empty when there were none)");
  else {
    if (o.decisions.length > 50) bad("decisions", "can hold at most 50 entries");
    o.decisions.forEach((d, i) => {
      if (!oneLine(d, 200)) bad(`decisions[${i}]`, "must be one line of 1 to 200 characters");
      else prose(`decisions[${i}]`, d);
    });
  }

  if (!oneLine(o.subject, 100)) bad("subject", "must be one line of 1 to 100 characters");
  else prose("subject", o.subject);

  // A report that misses what the app said it would judge by is refused here,
  // while the run can still do the step and repost, rather than stopping the
  // phase on the driver's verdict later. The driver checks the criteria only
  // on a "passed" report, so a "failed" one always lands (its reason is the
  // phase's own word).
  if (isPlainObject(expect) && o.result === "passed") {
    if (isPlainObject(o.tests) && o.tests.ran === true && o.tests.passed === false) {
      bad("tests.passed", "must be true on a passed report: the app refuses failed tests");
    }
    if (expect.review === true && isPlainObject(o.review)) {
      if (o.review.ran === false) bad("review.ran", "must be true: this loop asked for a review");
      if (expect.fix === "smart") {
        if (!isPlainObject(o.review.triage) || o.review.triage.ran !== true) {
          bad("review.triage.ran", "must be true: Smart pick requires the triage and its skipped list in the report");
        } else if (Array.isArray(o.review.triage.skipped) && o.review.triage.skipped.some((u) => isPlainObject(u) && u.level === "critical")) {
          bad("review.triage.skipped", "must not hold a skipped Critical: the app stops the phase on one");
        }
      }
      const chosen = expect.fix === "smart" ? LOOP_LEVELS : Array.isArray(expect.fix) ? expect.fix : [];
      if (chosen.length > 0 && o.review.recheck === false) {
        bad("review.recheck", "must be true: findings at the loop's chosen levels need the re-check");
      }
      // The driver's `leftover()`: the counter and the unfixed list, whichever
      // is larger; a leftover at a chosen Critical or Warning fails the phase.
      const left = (level) =>
        Math.max(o.review.left?.[level] || 0, (Array.isArray(o.review.unfixed) ? o.review.unfixed : []).filter((u) => isPlainObject(u) && u.level === level).length);
      for (const level of ["critical", "warning"]) {
        if (chosen.includes(level) && left(level) > 0) bad(`review.left.${level}`, "must be 0: a leftover at a chosen level fails the phase");
      }
    }
    // The report's own claim only: the `[?]` marks in the spec stay the
    // driver's call (`specs.mjs status`), which this post-time check cannot see.
    if (expect.guess === false && isPlainObject(o.tasks) && Array.isArray(o.tasks.assumed) && o.tasks.assumed.length > 0) {
      bad("tasks.assumed", "must be empty: this loop does not allow best guesses");
    }
  }
  return p;
}

/**
 * Problems with a `loopEnd` (the app's word on how the loop ended), given the
 * merged state so `evidence` can be checked against the docs on the page.
 */
export function loopEndProblems(e, state) {
  const p = [];
  const bad = (field, rule) => p.push(`loopEnd.${field} ${rule}`);
  if (!isPlainObject(e)) return ["loopEnd must be an object"];
  const prose = (field, s) => {
    if (typeof s === "string") p.push(...proseProblems(s, `loopEnd.${field}`));
  };
  if (e.kind !== "stopped" && e.kind !== "finished") bad("kind", 'must be "stopped" or "finished"');
  if (!oneLine(e.line, 200)) bad("line", "must be one line of 1 to 200 characters");
  else prose("line", e.line);
  if (e.evidence !== undefined) {
    if (typeof e.evidence !== "string" || !(state?.docs || []).some((d) => d && d.id === e.evidence)) {
      bad("evidence", "must be the id of a doc on the page");
    }
  }
  if (!Array.isArray(e.phases)) bad("phases", "must be an array");
  else {
    e.phases.forEach((ph, i) => {
      if (!isPlainObject(ph)) return bad(`phases[${i}]`, "must be an object { n, name, commit, unfixed, retries }");
      if (!isPosInt(ph.n)) bad(`phases[${i}].n`, "must be a positive integer");
      if (typeof ph.name !== "string" || /[\r\n]/.test(ph.name)) bad(`phases[${i}].name`, "must be a one-line string");
      else prose(`phases[${i}].name`, ph.name);
      if (ph.commit !== null && !(typeof ph.commit === "string" && /^[0-9a-f]{4,40}$/i.test(ph.commit))) bad(`phases[${i}].commit`, "must be a short hex hash or null");
      if (!isNonNegInt(ph.unfixed)) bad(`phases[${i}].unfixed`, "must be a non-negative integer");
      if (!isNonNegInt(ph.retries)) bad(`phases[${i}].retries`, "must be a non-negative integer");
      for (const key of ["fixed", "skipped", "left", "assumed", "decisions"]) {
        if (ph[key] !== undefined && !isNonNegInt(ph[key])) bad(`phases[${i}].${key}`, "must be a non-negative integer when present");
      }
    });
  }
  if (!Array.isArray(e.uncommitted) || !e.uncommitted.every(relativePath)) {
    bad("uncommitted", "must be an array of relative paths (no leading slash or drive, no .. step, one line each)");
  } else if (e.uncommitted.length > 200) bad("uncommitted", "can hold at most 200 paths");
  else e.uncommitted.forEach((f, i) => prose(`uncommitted[${i}]`, f));
  if (!Array.isArray(e.can) || !e.can.every((c) => LOOP_CAN.includes(c))) {
    bad("can", `must be an array with entries from ${LOOP_CAN.join(", ")}`);
  }
  // `reason` (the stop screen's short heading) and `recommend` (the one button
  // drawn as primary) are optional: an older app sends neither.
  if (e.reason !== undefined) {
    if (!oneLine(e.reason, 200)) bad("reason", "must be one line of 1 to 200 characters");
    else prose("reason", e.reason);
  }
  if (e.phase !== undefined && !isPosInt(e.phase)) bad("phase", "must be a positive integer");
  if (e.recommend !== undefined && e.recommend !== null) {
    const offered = Array.isArray(e.can) ? e.can : [];
    if (!["resume", "fix", "finalize"].includes(e.recommend) || !offered.includes(e.recommend)) {
      bad("recommend", "must be resume, fix or finalize, and one of can");
    }
  }
  return p;
}

// Loop mode adds four optional keys that a blank state does not hold (absent,
// not null): `loop: { driving: true, strength? }` (set by `open --loop`), `loopExpect`
// (the app's judging criteria), `loopOutcome` (the skill's report) and
// `loopEnd` (the app's ending).
export function blankState({ sid, workflow, title, project, specDir }) {
  return {
    schema: SCHEMA,
    sid,
    workflow: workflow || "pathfinder",
    title: title || "Session",
    project,
    specDir: specDir || "",
    created: nowIso(),
    phase: "collecting",
    agent: { status: "working", since: nowIso() },
    headline: { stage: "", cleared: 0, total: 0, confidence: "", note: "" },
    topics: [],
    items: [],
    docs: [],
  };
}

/**
 * A resume that passes through the dashboard (a finished skill going back to
 * it, or a launch from its menu), or into Git from any skill
 * (Commit it now, Changelog's hand-off), is a new skill taking the page over, so it
 * starts from a blank page: the last skill's questions, sections, docs,
 * helpers, headline and ending are its record on disk, not the next skill's
 * opening.
 * Only the session's identity and the Ask tab's conversation carry across:
 * the agent's chat replies stay beside the messages in `chat.ndjson`, which
 * a hop never touches, or every question asked before it would read as
 * unanswered. `workspace.json`, `ledger.ndjson` and the cursors live beside
 * `state.json`, so the workspace and the meter outlive every hop.
 */
export function switchWorkflow(state, { workflow, title, specDir }) {
  const next = { ...blankState({ sid: state.sid, project: state.project, workflow, title, specDir }), created: state.created };
  // A blank state holds no `loop`, `loopExpect`, `loopOutcome` or `loopEnd`,
  // so a hop never carries them over; `open --loop` stamps `loop` again after
  // the switch, and the app restamps `loopExpect` on its next look.
  for (const key of ["loop", "loopExpect", "loopOutcome", "loopEnd"]) delete next[key];
  if (state.chat) next.chat = state.chat;
  return next;
}
