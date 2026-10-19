// Plan2Code Web Console - checking and merging an agent's patch into the session state.

import fs from "node:fs";
import path from "node:path";

import { checkHelpers } from "./public/subagents.js";
import { nowIso, SCHEMA } from "./files.mjs";
import { TASK_LINE_RE } from "./scan.mjs";

/* ----------------------------------------------------------- patch merge */

const APPEND_KEYS = new Set(["thread"]);

export function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Reject prototype-pollution attempts before they reach the merge.
function guard(obj, where) {
  if (isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, "__proto__")) {
    throw new Error(`"__proto__" is not a valid key (in ${where})`);
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
    if (!id) throw new Error(`every ${where} entry needs "${idKey}"`);
    const i = out.findIndex((x) => x[idKey] === id);
    if (entry._delete) {
      if (i !== -1) out.splice(i, 1);
    } else if (i === -1) out.push(mergeOne({ ...defaults, [idKey]: id }, entry, where));
    else out[i] = mergeOne(out[i], entry, where);
  }
  return out;
}

const ITEM_DEFAULTS = {
  status: "open",
  required: true,
  allowOther: true,
  options: [],
  thread: [],
};

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
function dropStaleSubmissions(currentItems, before, patchList) {
  const merged = mergeKeyed(currentItems, patchList, "id", ITEM_DEFAULTS, "items");
  for (const entry of patchList) {
    const prev = (before || []).find((x) => x.id === entry.id);
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

function normalizeThreads(patchList, currentItems) {
  return patchList.map((entry) => {
    if (!isPlainObject(entry) || entry.thread == null) return entry;
    if (!Array.isArray(entry.thread)) throw new Error(`item "${entry.id}" "thread" must be an array`);
    const prev = (currentItems || []).find((x) => x && x.id === entry.id);
    const said = new Set(
      ((prev && prev.thread) || []).filter((m) => m && m.who === "user").map((m) => String(m.text || "").trim()),
    );
    const thread = [];
    for (const m of entry.thread) {
      if (!isPlainObject(m)) throw new Error(`item "${entry.id}" thread entries must be objects`);
      guard(m, "thread");
      const key = THREAD_TEXT_KEYS.find((k) => typeof m[k] === "string" && m[k].trim());
      if (!key) {
        throw new Error(
          `item "${entry.id}" thread entry has no "text". Write { "who": "agent", "text": "<markdown>" }; the page shows nothing else.`,
        );
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
        `doc "${entry.id}" is at version ${prev.version} on the page; this patch sends version ${entry.version}. ` +
          "Versions only go up: bump it, and check the payload is the current one."
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
    throw new Error('"settle" must be true or a list of item ids');
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
      if (!reopening && !sent.some((i) => i.id === id)) throw new Error(`settle: "${id}" has nothing sent to settle`);
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
    return {
      ...item,
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
  const read = (file, select, docId) => {
    if (typeof file !== "string" || !file.trim()) throw new Error(`doc "${docId}": a block's "file" must be a path`);
    const abs = path.resolve(root, file);
    let real;
    try {
      real = fs.realpathSync.native(abs);
    } catch {
      throw new Error(`doc "${docId}": no file at ${file}`);
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
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`doc "${docId}": ${file} is outside the project`);
    const stat = fs.statSync(real);
    if (!stat.isFile()) throw new Error(`doc "${docId}": ${file} is not a file`);
    if (stat.size > DOC_FILE_MAX) throw new Error(`doc "${docId}": ${file} is larger than ${DOC_FILE_MAX / 1024} KB`);
    const text = fs.readFileSync(real, "utf8").replace(/\r\n/g, "\n");
    if (select === undefined) return text;
    if (select !== "tasks") throw new Error(`doc "${docId}": "select" only takes "tasks"`);
    const tasks = text.split("\n").filter((l) => TASK_LINE_RE.test(l)).map((l) => l.trim());
    if (!tasks.length) throw new Error(`doc "${docId}": ${file} has no task lines to select`);
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
      if (!again.length && !blocks) throw new Error(`doc "${entry.id}": "refresh" found no file blocks to re-read`);
      blocks = [...(blocks || []), ...again];
    } else if (refresh !== undefined) throw new Error(`doc "${entry.id}": "refresh" must be true`);
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
        return { state: prevBlock?.state || "settled", ...b, select, md: read(b.file, select ?? undefined, entry.id) };
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
  const check = (image, docId) => {
    if (typeof image !== "string" || !image.trim()) throw new Error(`doc "${docId}": an image block's "image" must be a path`);
    const where = `doc "${docId}": image ${image}`;
    let real;
    try {
      real = fs.realpathSync.native(path.resolve(dir, image));
    } catch {
      throw new Error(`${where} does not exist. Save it under the session's ${SHOTS_DIR_NAME}/ folder first.`);
    }
    let realShots;
    try {
      realShots = fs.realpathSync.native(shotsDir);
    } catch {
      realShots = shotsDir;
    }
    const name = path.basename(real);
    if (fold(path.dirname(real)) !== fold(realShots)) {
      throw new Error(`${where} is outside the session's ${SHOTS_DIR_NAME}/ folder (${shotsDir}); only pictures saved there can be shown.`);
    }
    if (!SHOT_NAME.test(name)) throw new Error(`${where}: name it with letters, digits, dots, dashes or underscores, ending .png, .jpg, .jpeg or .webp`);
    const stat = fs.statSync(real);
    if (!stat.isFile()) throw new Error(`${where} is not a file`);
    if (stat.size > SHOT_MAX) throw new Error(`${where} is larger than ${SHOT_MAX / 1024 / 1024} MB`);
    const ext = path.extname(name).slice(1).toLowerCase();
    const want = ext === "jpg" ? "jpeg" : ext;
    if (shotType(fs.readFileSync(real)) !== want) throw new Error(`${where} is not a ${want.toUpperCase()} image (its bytes say otherwise)`);
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
          throw new Error(`doc "${entry.id}": block "${b.id}" is an image; it cannot also carry "md" or "file"`);
        }
        if (b.alt != null && typeof b.alt !== "string") throw new Error(`doc "${entry.id}": block "${b.id}" "alt" must be text`);
        return { state: prevBlock?.state || "settled", ...b, image: check(b.image, entry.id), md: null, file: null };
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
export function applyPatch(state, patch) {
  guard(patch, "patch");
  patch = liftActivity(patch);
  const { settle, ...rest } = patch;
  patch = rest;
  const next = { ...state };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      delete next[k];
      continue;
    }
    switch (k) {
      case "agent":
      case "headline":
        next[k] = mergeOne(next[k], v, k);
        break;
      case "items":
        if (!Array.isArray(v)) throw new Error('"items" must be an array');
        next.items = dropStaleSubmissions(next.items, state.items, normalizeThreads(v, state.items));
        break;
      case "topics":
        if (!Array.isArray(v)) throw new Error('"topics" must be an array');
        next.topics = mergeKeyed(next.topics, v, "id", {}, "topics");
        break;
      case "helpers":
        // The agent's report of its helpers, for the page's Subagents tab.
        // Only `post` writes it; the server's /submit never touches it.
        if (!Array.isArray(v)) throw new Error('"helpers" must be an array');
        if (!v.every(isPlainObject)) throw new Error('"helpers" entries must be objects, each { id, title, ask, state }');
        next.helpers = mergeKeyed(next.helpers, v, "id", {}, "helpers");
        // A real helper report supersedes the working-alone marker, whether it
        // arrives after one or beside one.
        if (next.helpers.some((h) => isPlainObject(h) && h.alone !== true))
          next.helpers = next.helpers.filter((h) => !(isPlainObject(h) && h.alone === true));
        break;
      case "docs":
        if (!Array.isArray(v)) throw new Error('"docs" must be an array');
        next.docs = mergeDocs(next.docs, v);
        break;
      case "chat": {
        // The agent's side of the Quick question chat. The person's side is
        // the inbox, which only the server writes; nothing else lives here.
        if (!isPlainObject(v)) throw new Error('"chat" must be an object');
        guard(v, "chat");
        const extra = Object.keys(v).filter((key) => key !== "replies");
        if (extra.length) throw new Error(`"chat" only takes "replies" (not ${extra.map((key) => `"${key}"`).join(", ")})`);
        const chat = { ...(next.chat || {}) };
        if (v.replies != null) {
          if (!Array.isArray(v.replies)) throw new Error('"chat.replies" must be an array');
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
      default:
        next[k] = v;
    }
  }
  if (settle !== undefined) next.items = settleItems(next.items || [], settle, patch.items, state.collected);
  return stampTimes(state, settleAgent(next, patch, state));
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

// The loop parses these out of agent output; pathfinder forbids them under specs/.
// The other copy is LOOP_TOKENS in src/skill-scripts/common.mjs: the console is
// not a skill script and cannot import it, so keep the two in step.
const FORBIDDEN_TOKENS =
  /\b(TASK_COMPLETE|PHASE_COMPLETE|ALL_TASKS_COMPLETE|IMPLEMENTATION_COMPLETE|SPEC_COMPLETE|WORK_COMPLETE)\b/;

// plan2code-metrics scrapes confidence with patterns that do NOT require a
// percent sign, so a bare "Requirements 22" in a rendered doc can poison a run's
// metrics. Keep those four words away from bare numbers. The skill scripts'
// copy is SCRAPE in src/skill-scripts/common.mjs; keep the two in step.
const METRICS_BAIT = /\b(Requirements?|Feasibility|Integration|Risk)[:\s|]+\d{1,2}\b/;

// The marker and metrics-bait scan on its own, for agent text that never
// reaches state.json (a post's `run` / `folderIssue`). Problems as sentences.
export function proseProblems(prose, subject = "text") {
  const problems = [];
  if (FORBIDDEN_TOKENS.test(prose)) {
    problems.push(`${subject} contains a loop completion marker (${prose.match(FORBIDDEN_TOKENS)[0]}); the loop scans for these`);
  }
  if (METRICS_BAIT.test(prose)) {
    problems.push(
      `${subject} contains "${prose.match(METRICS_BAIT)[0]}" — the metrics collector scrapes that pattern. ` +
        `Hyphenate it (Requirements-clarity 22/25) or reword.`
    );
  }
  return problems;
}

export const MAX_OPEN_REQUIRED = 3;

/**
 * Validate a merged state before it is written.
 *
 * Returns an array of human-readable problems. An empty array means the patch
 * is good. These checks turn four prose rules into mechanical ones.
 */
export function validate(state) {
  const problems = [];

  if (!Array.isArray(state.items)) return ['"items" must be an array'];

  const ids = new Set();
  for (const item of state.items) {
    if (!item.id) problems.push("every item needs an id");
    if (ids.has(item.id)) problems.push(`duplicate item id "${item.id}"`);
    ids.add(item.id);

    if (!ITEM_KINDS.has(item.kind)) {
      problems.push(`item "${item.id}" has unknown kind "${item.kind}" (one of: ${[...ITEM_KINDS].join(", ")})`);
    }
    if (typeof item.title !== "string" || !item.title.trim()) {
      problems.push(`item "${item.id}" needs a plain-English title`);
    } else {
      for (const re of JARGON) {
        if (re.test(item.title)) {
          problems.push(
            `item "${item.id}" title contains internal vocabulary (${re.source}). Titles are read by people who have never seen this workflow.`
          );
          break;
        }
      }
    }
    if ((item.kind === "choice" || item.kind === "multi") && !Array.isArray(item.options)) {
      problems.push(`item "${item.id}" is a ${item.kind} and needs "options"`);
    }
    if ((item.kind === "choice" || item.kind === "multi") && Array.isArray(item.options)) {
      for (const o of item.options) {
        if (!o || typeof o.k !== "string" || !o.k.trim()) {
          problems.push(`item "${item.id}" has an option with no "k" (its key, like "A")`);
        } else if (typeof o.text !== "string" || !o.text.trim()) {
          problems.push(
            `item "${item.id}" option "${o.k}" needs "text" (the label) and optionally "detail". Options use "text"/"detail", not "label"/"desc".`
          );
        }
      }
    }
    if (item.verdicts != null) {
      if (!Array.isArray(item.verdicts) || !item.verdicts.length) {
        problems.push(`item "${item.id}" "verdicts" must be a non-empty array of { id, label }`);
      } else {
        for (const v of item.verdicts) {
          if (!v || typeof v.id !== "string" || !v.id.trim()) {
            problems.push(`item "${item.id}" has a verdict with no "id"`);
          } else if (typeof v.label !== "string" || !v.label.trim()) {
            problems.push(
              `item "${item.id}" verdict "${v.id}" needs a "label" (the button text). Verdicts use "label", not "text".`
            );
          }
        }
      }
    }
    if (item.templates != null && (item.kind !== "text" || item.templates !== "idea")) {
      problems.push(`item "${item.id}" has "templates": only a text item can carry it, and its only value is "idea".`);
    }
    // The page compiles it as the person types, and a pattern that does not
    // compile throws there, on every keystroke, with nothing on screen to say why.
    if (item.pattern != null) {
      if (typeof item.pattern !== "string") {
        problems.push(`item "${item.id}" "pattern" must be a string holding a JavaScript regular expression`);
      } else {
        try {
          new RegExp(item.pattern);
        } catch (e) {
          problems.push(`item "${item.id}" "pattern" is not a valid JavaScript regular expression: ${e.message}`);
        }
      }
    }
    const recs = (item.options || []).filter((o) => o.recommended);
    if (recs.length > 1) problems.push(`item "${item.id}" marks ${recs.length} options recommended; at most one`);
  }

  // The dashboard's page is the menu: a card posted there is drawn nowhere,
  // yet counts as open (and keeps Stop live for a question nobody can see).
  if (state.workflow === "dashboard" && state.items.some((i) => isOpen(i))) {
    problems.push(
      'The dashboard draws no question cards: post its "menu" (and "agent"), and launch the skill a question belongs to.'
    );
  }

  // A notice asks nothing (the git board keeps its result line open all
  // session), so it never takes one of the three slots.
  const openRequired = state.items.filter((i) => i.required !== false && i.kind !== "notice" && isOpen(i));
  if (openRequired.length > MAX_OPEN_REQUIRED) {
    problems.push(
      `${openRequired.length} questions are open at once. The cap is ${MAX_OPEN_REQUIRED} ` +
        `(the ceiling is the person's attention, not the screen's). ` +
        `Send the rest after these are answered, or mark some "required": false.`
    );
  }

  // The session's own ending. Absent for every session that is still running,
  // so only its shape is checked, never its presence. The command is optional:
  // a finish with no command is a finished session with nothing left to run,
  // and the page points at the dashboard instead of a next step.
  const fin = state.finish;
  if (fin != null) {
    if (typeof fin !== "object" || Array.isArray(fin)) {
      problems.push('"finish" must be an object');
    } else {
      if (typeof fin.headline !== "string" || !fin.headline.trim()) {
        problems.push('"finish" needs a plain-English "headline" saying what just happened');
      }
      if (fin.command != null && (typeof fin.command !== "string" || !fin.command.trim())) {
        problems.push('"finish.command" must be a non-empty string, or left out when there is nothing to run');
      } else if (fin.command != null && (fin.command.includes("<") || fin.command.includes(">"))) {
        // A rendered command is copied and run verbatim. A leftover
        // placeholder reaches someone who has no way to know what fills it.
        problems.push(`"finish.command" still has a placeholder in it ("${fin.command}"). Fill it in.`);
      }
      if (fin.console != null && typeof fin.console !== "boolean") {
        problems.push('"finish.console" must be true or false (or left out, to follow the command)');
      }
      if (fin.dashboard != null && typeof fin.dashboard !== "boolean") {
        problems.push('"finish.dashboard" must be true or false (or left out: no dashboard button)');
      }
      if (fin.commit != null && typeof fin.commit !== "boolean") {
        problems.push('"finish.commit" must be true or false (or left out: no commit button)');
      }
      // The review offer on a finished build: true, or an object carrying the
      // button's heading. The heading is read by the person, so it faces the
      // same vocabulary check as a title.
      if (fin.review != null && typeof fin.review !== "boolean") {
        if (typeof fin.review !== "object" || Array.isArray(fin.review)) {
          problems.push('"finish.review" must be true, false, or { "label": "..." }');
        } else if (fin.review.label != null) {
          if (typeof fin.review.label !== "string") {
            problems.push('"finish.review.label" must be a string');
          } else {
            const hit = JARGON.find((re) => re.test(fin.review.label));
            if (hit) problems.push(`"finish.review.label" contains internal vocabulary (${hit.source})`);
          }
        }
      }
      for (const re of JARGON) {
        if (typeof fin.headline === "string" && re.test(fin.headline)) {
          problems.push(`"finish.headline" contains internal vocabulary (${re.source})`);
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
    problems.push('"agent.quietMinutes" must be a number of minutes between 1 and 60 (or null to clear it)');
  }
  // The page reads exactly two: anything else would leave it guessing whose
  // turn it is.
  if (state.agent && state.agent.status != null && !["working", "waiting"].includes(state.agent.status)) {
    problems.push(`"agent.status" must be "working" or "waiting" (not "${state.agent.status}")`);
  }
  if (state.agent && state.agent.activity != null && typeof state.agent.activity !== "string") {
    problems.push('"agent.activity" must be a short sentence saying what you are doing');
  }

  // Open gates only: an approval already given (last phase's sign-off) is a
  // record, and must not stop the next phase from asking for its own.
  const gates = state.items.filter((i) => i.gate && i.gate.authoritative && isOpen(i));
  if (gates.length > 1) {
    problems.push(
      `${gates.length} authoritative approval gates are open (${gates
        .map((g) => g.id)
        .join(", ")}). Only one workflow may own sign-off at a time.`
    );
  }

  // An image block's alt text is its caption, read by the same newcomers a
  // title is.
  for (const d of state.docs || []) {
    for (const b of (isPlainObject(d) && Array.isArray(d.blocks) ? d.blocks : [])) {
      if (!isPlainObject(b) || typeof b.image !== "string" || typeof b.alt !== "string") continue;
      const hit = JARGON.find((re) => re.test(b.alt));
      if (hit) problems.push(`doc "${d.id}" image "${b.id}" alt text contains internal vocabulary (${hit.source})`);
    }
  }

  // Scan what the AGENT wrote, never what the person typed. `submitted` is the
  // server's record of an answer someone pressed Send on; if their own words
  // happened to contain "TASK_COMPLETE" or "Risk 3", every later agent patch
  // would be rejected and the session would wedge with no way out.
  const authored = state.items.map(({ submitted, sentNote, thread, ...rest }) => ({
    ...rest,
    thread: Array.isArray(thread) ? thread.filter((m) => !m || m.who !== "user") : thread,
  }));
  // A doc block read from a file (`file`) is the file's own words, already on
  // disk: the agent cannot reword it, and refusing it would wedge every post
  // that refreshes it. Only what the agent typed is scanned.
  const typedDocs = (state.docs || []).map((d) =>
    isPlainObject(d) && Array.isArray(d.blocks) ? { ...d, blocks: d.blocks.filter((b) => !(isPlainObject(b) && typeof b.file === "string")) } : d
  );
  const prose =
    JSON.stringify(authored) +
    JSON.stringify(typedDocs) +
    JSON.stringify(state.finish || {}) +
    JSON.stringify(state.menu || {});
  problems.push(...proseProblems(prose));

  // The agent's report of its helpers: the shape the page draws from
  // (subagents.js), then the same prose scan as everything else it writes.
  if (state.helpers != null) {
    problems.push(...checkHelpers(state.helpers));
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
    const running = state.helpers.filter((h) => isPlainObject(h) && h.state === "running").map((h) => `"${h.id}"`);
    if (running.length) {
      problems.push(`"finish" while helper ${running.join(", ")} still shows as running: post each one as done or failed first, or in the same patch`);
    }
  }

  return problems;
}

export function isOpen(item) {
  return item.status === "open" || item.status === "reopened";
}

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
 * Only the session's identity carries across. `workspace.json`,
 * `ledger.ndjson` and the cursors live beside `state.json`, so the workspace
 * and the meter outlive every hop.
 */
export function switchWorkflow(state, { workflow, title, specDir }) {
  return { ...blankState({ sid: state.sid, project: state.project, workflow, title, specDir }), created: state.created };
}
