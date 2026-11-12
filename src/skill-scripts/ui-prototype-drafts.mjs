// ui-prototype-drafts.mjs: where a project's prototype drafts live.
//
// ~/.plan2code/prototypes/<project key>/<name>/round-N/   the round's files
// ~/.plan2code/prototypes/<project key>/<name>/<name>-round-N.html   its page
//
// The project key has the same shape as the web console's notepadKey(): the
// folder's base name as a slug, then the first 12 hex characters of the SHA-256
// of the resolved path (lowercased on Windows and Mac). It is computed here
// because a built skill has no console source beside it to import.

import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

const FOLDS_CASE = process.platform === "win32" || process.platform === "darwin";

/** A resolved path, lowercased where the file system ignores case. */
export const fold = (p) => {
  const resolved = path.resolve(String(p || ""));
  return FOLDS_CASE ? resolved.toLowerCase() : resolved;
};

/** <home>/.plan2code/prototypes */
export function draftsRoot() {
  return path.join(os.homedir(), ".plan2code", "prototypes");
}

/** The project's folder name under the drafts root: `<slug>-<12 hex>`. */
export function projectKey(root) {
  const slug =
    path
      .basename(path.resolve(String(root || "")))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "folder";
  const hash = crypto.createHash("sha256").update(fold(root)).digest("hex").slice(0, 12);
  return `${slug}-${hash}`;
}

/** This project's drafts folder. */
export function projectDrafts(root) {
  return path.join(draftsRoot(), projectKey(root));
}

/** <projectDrafts>/<name>/round-<N> */
export function roundFolder(root, name, round) {
  return path.join(projectDrafts(root), name, `round-${round}`);
}

/** <projectDrafts>/<name>/<name>-round-<N>.html */
export function pagePath(root, name, round) {
  return path.join(projectDrafts(root), name, `${name}-round-${round}.html`);
}

/** True only when the resolved child is the parent or sits under it. */
export function isInside(parent, child) {
  const rel = path.relative(fold(parent), fold(child));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}
