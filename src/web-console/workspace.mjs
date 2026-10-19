// Plan2Code Web Console - the session's extra folders, and the folders remembered per project and spec.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { defaultName, freeName, nameProblem } from "./public/workspace.js";
import { ensureDir, fileStamp, HOME_DIR, nowIso, readJson, withStateLock, writeJsonAtomic } from "./files.mjs";
import { remoteWarning } from "./sessions.mjs";
import { WORKSPACE_PICKER_PROMPT, pickFolder, pickerCommand } from "./picker.mjs";

export const WORKSPACE_FILE = "workspace.json";

/* -------------------------------------------------------- the workspace */

// The session's workspace.json, or null when the server has not made it yet.
export function readWorkspace(dir) {
  return readJson(path.join(dir, WORKSPACE_FILE), null);
}

// A fresh workspace: the original folder, named after itself, plus whatever
// was remembered for this folder and spec (rememberedWorkspace() below).
export function initialWorkspace(worktree, remembered = null) {
  const original = { id: "f0", path: worktree, name: defaultName(worktree), description: "", original: true };
  if (remembered && remembered.original) {
    if (remembered.original.name) original.name = remembered.original.name;
    if (remembered.original.description) original.description = remembered.original.description;
  }
  const added = ((remembered && remembered.folders) || []).map((f, i) => ({
    id: "f" + (i + 1),
    path: f.path,
    name: f.name,
    description: f.description || "",
    ...(f.nested ? { nested: true } : {}),
  }));
  return { version: 0, folders: [original, ...added], missing: [], changes: [], remote: "" };
}

/* ------------------------------------------------ remembered workspaces */

// The folder list outlives the console session: one file for the person,
// beside looks.json, keyed by the folder a session runs in and then by spec.
// Never under specs/: the paths are this machine's, and the server never
// writes into a project.
//
//   { "projects": { "<folded worktree>": {
//       "path": "<worktree>",
//       "project": { original, folders, at },          // no spec picked
//       "specs": { "specs/<name>": { original, folders, at } } } } }
//
// `original` holds the first folder's name and description only (its path is
// always the session's own); `folders` the added ones as { path, name,
// description, nested? }. Two writers, the server on every change and
// `console.mjs forget`, each a read-modify-write of one key.
export const WORKSPACES_FILE = path.join(HOME_DIR, "workspaces.json");

export const foldKey = (p) => {
  const resolved = path.resolve(String(p || ""));
  return process.platform === "win32" || process.platform === "darwin" ? resolved.toLowerCase() : resolved;
};

// `specs/<name>` with forward slashes and no trailing slash, or "" for none.
export function specKey(specDir) {
  return String(specDir || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

function readStore() {
  const saved = readJson(WORKSPACES_FILE, null);
  return saved && typeof saved.projects === "object" && saved.projects ? saved : { projects: {} };
}

/**
 * What was remembered for this folder and spec: `{ entry, from }`, where
 * `from` is "spec" when the spec has its own list, "project" when it falls
 * back to the project's (a spec's list starts as a copy of it), and null
 * when nothing was ever saved.
 */
export function rememberedWorkspace(worktree, specDir) {
  const project = readStore().projects[foldKey(worktree)];
  if (!project) return { entry: null, from: null };
  const spec = specKey(specDir);
  if (spec && project.specs && project.specs[spec]) return { entry: project.specs[spec], from: "spec" };
  return project.project ? { entry: project.project, from: "project" } : { entry: null, from: null };
}

// The workspace's folders as the store keeps them.
export function rememberable(ws) {
  const folders = (ws && ws.folders) || [];
  const first = folders.find((f) => f.original) || {};
  return {
    original: { name: first.name || "", description: first.description || "" },
    folders: folders
      .filter((f) => !f.original)
      .map((f) => ({ path: f.path, name: f.name, description: f.description || "", ...(f.nested ? { nested: true } : {}) })),
    at: nowIso(),
  };
}

// Every server and `console.mjs forget` writes the one file, so each
// read-modify-write holds this lock beside it.
const WORKSPACES_LOCK = "workspaces.json.lock";

// Save the list for this folder and spec ("" for the project's own).
export function rememberWorkspace(worktree, specDir, ws) {
  ensureDir(path.dirname(WORKSPACES_FILE));
  withStateLock(path.dirname(WORKSPACES_FILE), () => saveRemembered(worktree, specDir, ws), WORKSPACES_LOCK);
}

function saveRemembered(worktree, specDir, ws) {
  const store = readStore();
  const key = foldKey(worktree);
  const project = store.projects[key] || { path: path.resolve(worktree) };
  const spec = specKey(specDir);
  if (spec) project.specs = { ...(project.specs || {}), [spec]: rememberable(ws) };
  else project.project = rememberable(ws);
  store.projects[key] = project;
  writeJsonAtomic(WORKSPACES_FILE, store);
}

// Drop one spec's list (Finalize, once the spec is archived). True when there was one.
export function forgetWorkspace(worktree, specDir) {
  const spec = specKey(specDir);
  if (!spec || !fs.existsSync(WORKSPACES_FILE)) return false;
  return withStateLock(path.dirname(WORKSPACES_FILE), () => dropRemembered(worktree, spec), WORKSPACES_LOCK);
}

function dropRemembered(worktree, spec) {
  const store = readStore();
  const project = store.projects[foldKey(worktree)];
  if (!spec || !project || !project.specs || !project.specs[spec]) return false;
  delete project.specs[spec];
  writeJsonAtomic(WORKSPACES_FILE, store);
  return true;
}

// Single-writer rule: only the server may call this (server.mjs, through
// serverWorkspace() below).
export function writeWorkspace(dir, ws) {
  return writeJsonAtomic(path.join(dir, WORKSPACE_FILE), ws);
}

// What `open` hands the agent: names, paths and descriptions, nothing
// internal. `missing` names the folders that are gone, by their @name.
export function workspaceForAgent(ws) {
  const all = (ws && ws.folders) || [];
  const folders = all.map((f) => {
    const out = { name: f.name, path: f.path };
    if (f.description) out.description = f.description;
    if (f.original) out.original = true;
    return out;
  });
  const missing = ((ws && ws.missing) || []).map((id) => (all.find((f) => f.id === id) || {}).name).filter(Boolean);
  return missing.length ? { folders, missing } : { folders };
}

/* ---------------------------------------------------- the workspace cursor */

export const WORKSPACE_CURSOR_FILE = "workspace-cursor.json";

export function readWorkspaceCursor(dir) {
  const saved = readJson(path.join(dir, WORKSPACE_CURSOR_FILE), { version: 0 });
  const n = Number(saved && saved.version);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Never backwards, like writeCursor(): a killed `wait` may hand a change over
// twice, but never skips one.
export function writeWorkspaceCursor(dir, version) {
  writeJsonAtomic(path.join(dir, WORKSPACE_CURSOR_FILE), { version: Math.max(readWorkspaceCursor(dir), version) });
}

// The workspace changes the agent has not been handed yet.
export function pendingWorkspaceChanges(dir) {
  const cursor = readWorkspaceCursor(dir);
  return (readWorkspace(dir)?.changes || []).filter((c) => c.version > cursor);
}

/* ------------------------------------------------- the server's workspace */

/**
 * The workspace as the server keeps it: the cached read, every change the
 * page makes through the /workspace routes, the scope the dashboard picker
 * sets, and the missing-folder check. workspace.json has one writer, the
 * server; ledger.ndjson has one, console.mjs. Both are re-read only when
 * their file has moved.
 *
 * `ctx` is what this reads from the server: `dir` and `project` (fixed),
 * `worktree()` (the session's folder, null while unknown), `state()` (the
 * state as last read), `ledger()` (the ledger's entries) and `pushState()`.
 */
export function serverWorkspace(ctx) {
  const { dir, project } = ctx;
  const WORKSPACE_PATH = path.join(dir, WORKSPACE_FILE);
  const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";
  const foldPath = (p) => (FOLD_CASE ? p.toLowerCase() : p);

  let workspaceSeen = { stamp: null, ws: null };

  // The folder the session runs in: the state's own once it is written, else
  // the one `open` passed on the command line. Null while neither is known.
  const sessionWorktree = ctx.worktree;

  // The session's workspace, created with just the original folder when absent.
  function workspaceNow() {
    const stamp = fileStamp(WORKSPACE_PATH);
    if (stamp && stamp === workspaceSeen.stamp) return workspaceSeen.ws;
    const ws = (stamp && readWorkspace(dir)) || null;
    if (ws) {
      workspaceSeen = { stamp, ws };
      return ws;
    }
    const root = sessionWorktree();
    const scope = specKey(ctx.state()?.specDir);
    const remembered = root ? rememberedWorkspace(root, scope).entry : null;
    const fresh = { ...initialWorkspace(root || project, remembered), scope, remote: remoteWarning().remote || "" };
    // There but unreadable for now (a scanner's lock): never written over, and
    // never cached, so the next call reads it again.
    if (stamp) return workspaceSeen.ws || fresh;
    // Nor saved while the session's folder is unknown: the project is only a
    // guess (the main checkout, for a linked worktree), and the file, once
    // written, is what every later read trusts.
    if (!root) return fresh;
    try {
      saveWorkspace(fresh);
    } catch {}
    return fresh;
  }

  function saveWorkspace(ws) {
    writeWorkspace(dir, ws);
    workspaceSeen = { stamp: fileStamp(WORKSPACE_PATH), ws };
  }

  // One change: a new version, an entry in the change log the agent is handed,
  // the file, and every open page.
  function bumpWorkspace(ws, change, { remember = true } = {}) {
    ws.version = (ws.version || 0) + 1;
    ws.changes = [...(ws.changes || []), { ...change, version: ws.version }];
    saveWorkspace(ws);
    // Remembered for the next console session too. A folder gone missing or
    // found again is not a change of mind, so it is not saved.
    if (remember) rememberNow(ws);
    ctx.pushState();
  }

  function rememberNow(ws) {
    const root = sessionWorktree();
    if (!root) return;
    try {
      rememberWorkspace(root, ws.scope || "", ws);
    } catch {}
  }

  /**
   * Point the workspace at another spec ("" for the project's own list) and
   * swap in what was remembered there, logging each difference as a change so
   * the agent's cursor stays truthful. A spec with nothing saved starts from
   * the project's list (`seed: "project"`, the dashboard picker) or keeps the
   * list it has and saves it as the spec's (`seed: "current"`, a spec created
   * mid-run). Folders keep their ids when their path stays.
   */
  function setScope(ws, spec, seed = "project") {
    const root = sessionWorktree();
    const next = specKey(spec);
    if (!root || (ws.scope || "") === next) return false;
    const found = rememberedWorkspace(root, next);
    ws.scope = next;
    if (next && found.from !== "spec" && seed === "current") {
      saveWorkspace(ws);
      rememberNow(ws);
      ctx.pushState();
      return true;
    }
    const want = initialWorkspace(root, found.entry).folders;
    const byPath = new Map(ws.folders.map((f) => [foldPath(path.resolve(f.path)), f]));
    const kept = new Set();
    const folders = [];
    const changes = [];
    for (const w of want) {
      const have = w.original ? ws.folders.find((f) => f.original) : byPath.get(foldPath(path.resolve(w.path)));
      if (!have) {
        folders.push({ ...w, id: "pending" });
        changes.push({ kind: "added", name: w.name, path: w.path, description: w.description });
        continue;
      }
      kept.add(have);
      if (have.name !== w.name) changes.push({ kind: "renamed", from: have.name, name: w.name, path: have.path });
      if ((have.description || "") !== (w.description || "")) {
        changes.push({ kind: "described", name: w.name, path: have.path, description: w.description || "" });
      }
      folders.push({ ...have, name: w.name, description: w.description || "" });
    }
    for (const f of ws.folders) {
      if (!kept.has(f)) changes.unshift({ kind: "removed", name: f.name, path: f.path });
    }
    ws.folders = folders.filter((f) => f.id !== "pending");
    for (const f of folders.filter((f) => f.id === "pending")) ws.folders.push({ ...f, id: nextFolderId(ws) });
    ws.missing = (ws.missing || []).filter((id) => ws.folders.some((f) => f.id === id));
    if (!changes.length) {
      saveWorkspace(ws);
      ctx.pushState();
    }
    for (const c of changes) bumpWorkspace(ws, c, { remember: false });
    checkFolders(ws);
    return true;
  }

  // A spec posted mid-run (Pathfinder or Plan making its folder, a skill that
  // learns its spec late) takes the workspace with it.
  function followSpecDir(state) {
    const spec = specKey(state && state.specDir);
    if (!spec || !fileStamp(WORKSPACE_PATH)) return;
    const ws = workspaceNow();
    if ((ws.scope || "") !== spec) setScope(ws, spec, "current");
  }

  function isFolder(p) {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  }

  // A folder deleted on disk is marked missing, and unmarked when it comes back.
  function checkFolders(ws) {
    ws.missing = ws.missing || [];
    for (const f of ws.folders) {
      const there = isFolder(f.path);
      const marked = ws.missing.includes(f.id);
      if (!there && !marked) {
        ws.missing = [...ws.missing, f.id];
        bumpWorkspace(ws, { kind: "missing", name: f.name, path: f.path }, { remember: false });
      } else if (there && marked) {
        ws.missing = ws.missing.filter((id) => id !== f.id);
        bumpWorkspace(ws, { kind: "found", name: f.name, path: f.path }, { remember: false });
      }
    }
  }

  // What the agent reported it could not read during the current skill run:
  // folder-issue entries after the last launch, the latest per folder name.
  function folderIssues(entries) {
    let from = 0;
    entries.forEach((e, i) => e.kind === "launch" && (from = i + 1));
    const latest = new Map();
    for (const e of entries.slice(from)) {
      if (e.kind !== "folder-issue") continue;
      latest.set(e.name, { name: e.name, reason: e.reason, ...(e.hint ? { hint: e.hint } : {}) });
    }
    return [...latest.values()];
  }

  function workspaceView() {
    const { folders, missing, remote, scope } = workspaceNow();
    return { folders, missing: missing || [], remote: remote || "", scope: scope || "", issues: folderIssues(ctx.ledger()) };
  }

  // Whether child sits strictly under parent.
  function within(parent, child) {
    const rel = path.relative(foldPath(parent), foldPath(child));
    return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
  }

  const cleanDescription = (d) => (typeof d === "string" ? d.trim().slice(0, 200) : "");

  function nextFolderId(ws) {
    const ns = ws.folders.map((f) => Number.parseInt(String(f.id).slice(1), 10)).filter(Number.isInteger);
    return "f" + (Math.max(-1, ...ns) + 1);
  }

  // Each route below answers with [status, body]; validation always comes
  // before any change, so a refusal leaves the file as it was.
  function addFolder(ws, body) {
    const raw = typeof body.path === "string" ? body.path.trim().replace(/^(["'])(.*)\1$/, "$2").trim() : "";
    const input = raw.replace(/^~(?=$|[\\/])/, () => os.homedir());
    const resolved = raw ? path.resolve(sessionWorktree() || project, input) : "";
    if (!resolved || !isFolder(resolved)) return [400, { reason: "not-a-folder" }];
    const same = ws.folders.find((f) => foldPath(path.resolve(f.path)) === foldPath(resolved));
    if (same) return [400, { reason: "duplicate", name: same.name }];
    const nested = ws.folders.some((f) => within(f.path, resolved));
    const name = typeof body.name === "string" && body.name ? body.name : defaultName(resolved);
    if (nameProblem(name)) return [400, { reason: "bad-name" }];
    const taken = new Set(ws.folders.map((f) => f.name));
    if (taken.has(name)) return [400, { reason: "name-taken", suggest: freeName(name, taken) }];
    const entry = { id: nextFolderId(ws), path: resolved, name, description: cleanDescription(body.description), nested };
    ws.folders = [...ws.folders, entry];
    bumpWorkspace(ws, { kind: "added", name, path: resolved, description: entry.description });
    return [200, entry];
  }

  function editFolder(ws, body) {
    const entry = ws.folders.find((f) => f.id === body.id);
    if (!entry) return [404, { reason: "unknown" }];
    const rename = typeof body.name === "string" && body.name !== entry.name;
    if (rename) {
      if (nameProblem(body.name)) return [400, { reason: "bad-name" }];
      const taken = new Set(ws.folders.filter((f) => f !== entry).map((f) => f.name));
      if (taken.has(body.name)) return [400, { reason: "name-taken", suggest: freeName(body.name, taken) }];
    }
    const description = typeof body.description === "string" ? cleanDescription(body.description) : entry.description;
    if (rename) {
      const from = entry.name;
      entry.name = body.name;
      bumpWorkspace(ws, { kind: "renamed", from, name: entry.name, path: entry.path });
    }
    if (description !== entry.description) {
      entry.description = description;
      bumpWorkspace(ws, { kind: "described", name: entry.name, path: entry.path, description });
    }
    return [200, entry];
  }

  function removeFolder(ws, body) {
    const entry = ws.folders.find((f) => f.id === body.id);
    if (entry && entry.original) return [400, { reason: "original" }];
    if (!entry) return [404, { reason: "unknown" }];
    ws.folders = ws.folders.filter((f) => f !== entry);
    ws.missing = (ws.missing || []).filter((id) => id !== entry.id);
    bumpWorkspace(ws, { kind: "removed", name: entry.name, path: entry.path });
    return [200, { ok: true }];
  }

  // Where the picker opens: beside the last folder added, else the original.
  function pickerStart(ws) {
    const added = ws.folders.filter((f) => !f.original);
    return added.length ? path.dirname(added[added.length - 1].path) : ws.folders[0]?.path || sessionWorktree() || project;
  }

  // One picker at a time. Spawned, never spawnSync: the dialog can sit open for
  // minutes, and every poll, chat message and `wait` health check has to keep
  // being answered meanwhile.
  let pickerBusy = false;

  // Only ever answers with a path, as [status, body]: the page then adds it
  // through /workspace/add.
  function browse() {
    const ws = workspaceNow();
    if (ws.remote) return Promise.resolve([404, { reason: "no-picker" }]);
    if (pickerBusy) return Promise.resolve([409, { reason: "busy" }]);
    // Tests only: stands in for the person, so no dialog ever opens.
    const echo = process.env.PLAN2CODE_PICKER_ECHO;
    if (echo) return Promise.resolve([200, echo === "-" ? { cancelled: true } : { path: echo }]);
    const start = pickerStart(ws);
    if (!pickerCommand(start, WORKSPACE_PICKER_PROMPT)) return Promise.resolve([404, { reason: "no-picker" }]);
    pickerBusy = true;
    return pickFolder(start, WORKSPACE_PICKER_PROMPT)
      .then((picked) => (picked.error ? [500, { reason: "picker-failed" }] : [200, picked]))
      .catch(() => [500, { reason: "picker-failed" }])
      .finally(() => {
        pickerBusy = false;
      });
  }

  function bootWorkspace() {
    // Nothing to check yet: the first read once the state is written makes it.
    if (!sessionWorktree() && !fileStamp(WORKSPACE_PATH)) return;
    const ws = workspaceNow();
    const remote = remoteWarning().remote || "";
    if ((ws.remote || "") !== remote) {
      ws.remote = remote;
      saveWorkspace(ws);
    }
    checkFolders(ws);
    followSpecDir(ctx.state());
  }

  return {
    workspaceNow,
    workspaceView,
    setScope,
    followSpecDir,
    checkFolders,
    addFolder,
    editFolder,
    removeFolder,
    browse,
    bootWorkspace,
    // The stamp of the read the cache holds, for the frame's `have` key.
    stamp: () => workspaceSeen.stamp,
  };
}
