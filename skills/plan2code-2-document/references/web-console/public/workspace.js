// Plan2Code Web Console - the Workspace's naming and wording rules.
//
// The source of truth for what a folder may be called, the name a new folder
// gets by default, and the suggestion offered when a name is taken. Imported
// by the server (its guards), lib.mjs and the page, so they can never disagree.
// No DOM access at module scope and no imports: the page and `node --test`
// both import this file.

export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const NAME_MAX = 40;

const trimDashes = (s) => s.replace(/^-+|-+$/g, "");

/**
 * The name a folder gets before anyone renames it: its last path segment,
 * lowercased, with every run of other characters turned into one `-`.
 */
export function defaultName(folderPath) {
  const segments = String(folderPath || "")
    .split(/[\\/]/)
    .filter(Boolean);
  const last = segments.length ? segments[segments.length - 1] : "";
  const name = trimDashes(trimDashes(last.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, NAME_MAX));
  return name || "folder";
}

// null when the name can be used, "bad-name" when it cannot.
export function nameProblem(name) {
  if (typeof name !== "string" || !name || name.length > NAME_MAX || !NAME_PATTERN.test(name)) return "bad-name";
  return null;
}

/**
 * `base` when nobody has it, else the first free `base-2`, `base-3`, ...
 * `base` is shortened first so the suffixed name still fits NAME_MAX.
 */
export function freeName(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = trimDashes(base.slice(0, NAME_MAX - suffix.length)) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

// How many footer label tiers there are: the page tries 0..FOOTER_TIERS-1,
// widest first, until the text fits.
export const FOOTER_TIERS = 4;

/**
 * The footer's workspace label. `folders[0]` is the original folder.
 *   0  plan2code + 2 folders · main
 *   1  plan2code + 2 folders
 *   2  plan2code +2
 *   3  plan2code
 */
export function footerLabel({ folders, branch }, tier = 0) {
  const list = Array.isArray(folders) ? folders : [];
  const name = list.length ? list[0].name : "";
  const n = Math.max(0, list.length - 1);
  if (tier >= 3) return name;
  let label = name;
  if (n > 0) label += tier === 2 ? ` +${n}` : ` + ${n} ${n === 1 ? "folder" : "folders"}`;
  if (tier === 0 && branch) label += ` · ${branch}`;
  return label;
}

/**
 * The reply line an agent is handed for one workspace.json change entry
 * (`{ kind, name, path, description?, from? }`).
 */
export function changeLine(change) {
  const { kind, name, path, description, from } = change || {};
  switch (kind) {
    case "added":
      return `Workspace: added @${name} — ${path}` + (description ? ` (${description})` : "");
    case "renamed":
      return `Workspace: renamed @${from} to @${name} — ${path}`;
    case "described":
      return description
        ? `Workspace: @${name} is now described as "${description}"`
        : `Workspace: @${name} description cleared`;
    case "removed":
      return `Workspace: removed @${name} — ${path}`;
    case "missing":
      return `Workspace: @${name} is missing — ${path} no longer exists`;
    case "found":
      return `Workspace: @${name} is back — ${path}`;
    default:
      return `Workspace: @${name} changed — ${path}`;
  }
}
