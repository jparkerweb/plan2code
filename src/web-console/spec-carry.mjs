// Plan2Code Web Console - the spec a desktop app's New Session carries over to its fresh dashboard.

import fs from "node:fs";
import path from "node:path";

import { HOME_DIR } from "./files.mjs";
import { foldKey } from "./workspace.mjs";

// One short-lived file, written by the app just before the fresh agent starts
// and read once by the new dashboard's page:
//
//   { "project": "<worktree>", "spec": "specs/<name>", "at": <epoch ms> }
//
// Beside looks.json, never under specs/. It is only a hint: the page uses it
// when that spec is on the new dashboard's picker, and ignores it otherwise.
export const SPEC_CARRY_FILE = path.join(HOME_DIR, "spec-carry.json");

// An old hint must not preselect a spec in a session the person opens much later.
export const SPEC_CARRY_MAX_AGE_MS = 10 * 60 * 1000;

const SPEC_KEY = /^specs\/[^/\\.][^/\\]*$/;

/**
 * The spec dir the app left for `project`, or null. The file is removed on any
 * read that finds it, so one New Session hints one dashboard: a stale or
 * other-folder hint is dropped too, never kept for a later session.
 */
export function takeSpecCarry(project, now = Date.now(), file = SPEC_CARRY_FILE) {
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  if (!entry || typeof entry !== "object") return null;
  const mine = typeof entry.project === "string" && project && foldKey(entry.project) === foldKey(project);
  // Another window's hint stays for that window's dashboard.
  if (!mine) {
    return Number.isFinite(entry.at) && now - entry.at <= SPEC_CARRY_MAX_AGE_MS ? null : (fs.rmSync(file, { force: true }), null);
  }
  fs.rmSync(file, { force: true });
  const fresh = Number.isFinite(entry.at) && now - entry.at <= SPEC_CARRY_MAX_AGE_MS;
  return fresh && typeof entry.spec === "string" && SPEC_KEY.test(entry.spec) ? entry.spec : null;
}
