// Plan2Code Web Console - the git board's rules: branch order, names, buttons, replies, next step and tabs.
//
// Everything the board decides from a state.git snapshot (git-repo.mjs ->
// snapshot()) lives here so it is tested without a browser: how the branch
// list is ordered and folded, whether a new branch name is free and where a
// new branch can start, which branches the clean-up offers, which action
// buttons show and which are enabled, the plain sentence each button sends
// the agent, the "Last refreshed" line, which files start ticked in the
// commit dialog, the pull-request link, the suggested next step and the tab
// that owns it, each tab's badge, and how busy the board is and which
// controls that allows. app.js only renders what these say. No DOM access at
// module scope and only one import: the page and `node --test` both import
// this file.

import { prUrl } from "./pr-url.js";

export const BRANCH_TYPES = Object.freeze(["feature", "fix", "chore", "docs", "refactor", "test"]);
export const REMOTE_FOLD = 50;
// Matches under a search are capped too, or one fold draws thousands of rows.
const QUERY_CAP = 200;
export const UNTRACKED_TICK_LIMIT = 200;

export const PR_HOST_LABELS = Object.freeze({
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  azure: "Azure DevOps",
  none: "None",
});

const list = (v) => (Array.isArray(v) ? v : []);
const blank = (v) => typeof v !== "string" || v.trim() === "";

// Milliseconds of a row's last commit; -Infinity when missing or unreadable, so it sorts last.
function lastTime(row) {
  const t = Date.parse(row && row.last && row.last.at);
  return Number.isNaN(t) ? -Infinity : t;
}

const newestFirst = (a, b) => {
  const ta = lastTime(a);
  const tb = lastTime(b);
  if (ta === tb) return 0;
  return tb > ta ? 1 : -1;
};

/** The local row for the checked-out branch, or null. */
export function currentRow(git) {
  return list(git && git.branches).find((b) => b && b.current && !b.remote) || null;
}

/* ------------------------------------------------------------ branches */

/**
 * `{ top, remoteOnly }`: local rows with the current branch first, then the
 * default branch (once, when it is also the current one), then the rest by
 * last commit, newest first; remote-only rows newest first. Never mutates.
 */
export function orderBranches(branches) {
  const rows = list(branches).filter(Boolean);
  const local = rows.filter((b) => !b.remote);
  const current = local.find((b) => b.current) || null;
  const def = local.find((b) => b.default && b !== current) || null;
  const rest = local.filter((b) => b !== current && b !== def).sort(newestFirst);
  const top = [...(current ? [current] : []), ...(def ? [def] : []), ...rest];
  const remoteOnly = rows.filter((b) => b.remote).sort(newestFirst);
  return { top, remoteOnly };
}

/** Rows whose name, `remote/name` (remote-only rows) or last subject contain `query`, ignoring case. */
export function filterBranches(rows, query) {
  if (blank(query)) return rows;
  const q = query.trim().toLowerCase();
  return list(rows).filter((b) => {
    const fields = [b.name, b.remote ? `${b.remote}/${b.name}` : "", b.last && b.last.subject];
    return fields.some((f) => typeof f === "string" && f.toLowerCase().includes(q));
  });
}

/**
 * The remote-only section: `{ shown, hidden, open }`. Without a query the
 * first REMOTE_FOLD rows show (all with showAll) and `hidden` counts the
 * rest; a query shows every match and opens the section.
 */
export function foldRemote(rows, { showAll = false, query = "" } = {}) {
  const all = list(rows);
  if (!blank(query)) {
    // A query also caps what it draws: a monorepo remote can match thousands.
    const matches = filterBranches(all, query);
    const shown = showAll ? matches : matches.slice(0, QUERY_CAP);
    return { shown, hidden: matches.length - shown.length, open: true };
  }
  const shown = showAll ? all.slice() : all.slice(0, REMOTE_FOLD);
  return { shown, hidden: all.length - shown.length, open: false };
}

/* ---------------------------------------------------------- new branch */

/** `<type>/<desc>`; "" with no description. */
export function composeBranchName({ type, description } = {}) {
  const kind = blank(type) ? "feature" : type.trim();
  const desc = String(description || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return desc ? `${kind}/${desc}` : "";
}

// The first rule `git check-ref-format --branch` would break, as a sentence; null when none.
function refFormatProblem(name) {
  if (name === "@") return 'A branch cannot be named just "@".';
  // git refuses it as a branch name (git switch -c HEAD), as branch-check does.
  if (name === "HEAD") return 'A branch cannot be named "HEAD".';
  if (name.startsWith("-")) return "Branch names cannot start with a dash.";
  if (name.includes(" ")) return "Branch names cannot contain spaces.";
  if (name.includes("..")) return 'Branch names cannot contain "..".';
  if (name.includes("@{")) return 'Branch names cannot contain "@{".';
  if (name.includes("\\")) return "Branch names cannot contain a backslash.";
  const special = name.match(/[~^:?*[]/);
  if (special) return `Branch names cannot contain "${special[0]}".`;
  if ([...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) {
    return "Branch names cannot contain control characters.";
  }
  if (name.endsWith("/")) return 'Branch names cannot end with "/".';
  if (name.endsWith(".")) return 'Branch names cannot end with ".".';
  const parts = name.split("/");
  if (parts.some((p) => p === "")) return 'Branch names cannot start with "/" or contain "//".';
  if (parts.some((p) => p.startsWith("."))) return 'No part of a branch name can start with ".".';
  if (parts.some((p) => p.endsWith(".lock"))) return 'No part of a branch name can end with ".lock".';
  return null;
}

/**
 * Whether `name` can be created: the first of empty, invalid (with a
 * reason), local (already a local branch), remote (a remote-only branch),
 * nested (it and a local branch would be folders of each other) or free.
 */
export function nameStatus(name, git) {
  if (blank(name)) return { kind: "empty" };
  const reason = refFormatProblem(name);
  if (reason) return { kind: "invalid", reason };
  const rows = list(git && git.branches).filter(Boolean);
  const locals = rows.filter((b) => !b.remote);
  const local = locals.find((b) => b.name === name);
  if (local) return { kind: "local", branch: local.name };
  // The board shows a remote-only branch as origin/name, so that is taken too.
  const remote = rows.find((b) => b.remote && (b.name === name || `${b.remote}/${b.name}` === name));
  if (remote) return { kind: "remote", remote: remote.remote, branch: remote.name };
  const nested = locals.find((b) => name.startsWith(`${b.name}/`) || b.name.startsWith(`${name}/`));
  if (nested) return { kind: "nested", clash: nested.name };
  return { kind: "free" };
}

/**
 * Where a new branch can start: `{ preset, here, options }`. origin/<default>
 * when that remote branch exists, else the local default, else the current
 * branch (or, detached, the commit). A commit from a detached HEAD belongs on
 * the commit it was made at.
 */
export function createSources(git, commit = false) {
  const g = git || {};
  const def = g.defaultBranch;
  const rows = list(g.branches).filter(Boolean);
  const h = g.head || {};
  const originDef =
    def && rows.some((b) => (b.remote === "origin" && b.name === def) || (!b.remote && b.upstream === `origin/${def}`))
      ? `origin/${def}`
      : null;
  const localDef = def && rows.some((b) => !b.remote && b.name === def) ? def : null;
  const here = h.branch || h.detached || null;
  const preset = (commit && h.detached) || originDef || localDef || here || "HEAD";
  return { preset, here, options: [...new Set([originDef, localDef, here, preset].filter(Boolean))] };
}

/* ------------------------------------------------------------- cleanup */

/**
 * The clean-up panel's groups, `{ merged, gone }`: local branches merged into
 * the default, and those whose remote copy is deleted. Never the current or
 * the default branch; a branch in both shows once, under gone, the way the
 * confirm that follows (cleanup-list) names it.
 */
export function cleanupGroups(git) {
  const locals = list(git && git.branches).filter((b) => b && !b.remote && !b.current && !b.default);
  return { merged: locals.filter((b) => b.merged && !b.gone), gone: locals.filter((b) => b.gone) };
}

/* ------------------------------------------------------------- buttons */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const button = (shown, enabled, label, title) => ({ shown, enabled: shown && enabled, label, ...(title ? { title } : {}) });

/**
 * Every board button as `{ shown, enabled, label, title? }`. Pull is enabled
 * only with an upstream to pull from; Push shows with an upstream, Publish
 * without one. `busy` grays everything out but Done; an operation in
 * progress hides everything but Done (its banner carries Abort / Continue).
 */
export function boardActions(git, { busy = false } = {}) {
  const g = git || {};
  const head = g.head || {};
  const changes = g.changes || {};
  const count = Number(changes.count) || 0;
  const heldBack = Number(changes.heldBack) || 0;
  const hasCommits = g.hasCommits !== false;
  const hasRemote = list(g.remotes).length > 0;
  const detached = hasCommits && !head.branch;
  const ahead = Number(head.ahead) || 0;
  const free = !busy;

  const done = button(true, true, "Done");
  const hidden = (label) => button(false, false, label);

  if (g.inProgress) {
    return {
      refresh: hidden("Refresh"),
      pull: hidden("Pull"),
      push: hidden("Push"),
      publish: hidden("Publish"),
      commit: hidden("Commit"),
      cleanup: hidden("Clean up"),
      done,
    };
  }

  const commitLabel = !hasCommits
    ? "Make the first commit"
    : `Commit ${plural(count, "file", "files")}${heldBack > 0 ? ` · ${heldBack} held back` : ""}`;
  const commit = button(count > 0, free, commitLabel);

  if (!hasCommits) {
    return {
      refresh: button(true, free, "Refresh", "Look at this folder again"),
      pull: hidden("Pull"),
      push: hidden("Push"),
      publish: hidden("Publish"),
      commit,
      cleanup: hidden("Clean up"),
      done,
    };
  }

  const notOnBranch = "Not on a branch: switch to one first";
  // Shown without a remote too: it is how edits made outside reach the board
  // (the agent re-reads the folder; with a remote it fetches first).
  const refresh = button(true, free, "Refresh", hasRemote ? undefined : "Look at this folder again");

  // An upstream whose remote copy was deleted is no upstream: nothing to pull
  // from or push to, and Publish (which plan publish allows again) is the way.
  const live = Boolean(head.upstream) && !head.gone;
  let pull;
  if (detached) pull = button(hasRemote, false, "Pull", notOnBranch);
  else if (head.upstream && head.gone) pull = button(hasRemote, false, "Pull", "Its remote copy was deleted: publish it again");
  else if (!head.upstream) pull = button(hasRemote, false, "Pull", "Nothing to pull from yet: publish first");
  else pull = button(hasRemote, free, "Pull");

  const showPush = hasRemote && live && !detached;
  const push =
    ahead > 0
      ? button(showPush, free, `Push · ${ahead} to push`)
      : button(showPush, false, "Push", "Nothing to push");

  const showPublish = hasRemote && !live;
  const publish = detached ? button(showPublish, false, "Publish", notOnBranch) : button(showPublish, free, "Publish");

  const cleanable = list(g.branches).some((b) => b && !b.remote && !b.current && !b.default && (b.merged || b.gone));
  const cleanup = button(!!g.defaultBranch && cleanable, free, "Clean up");

  return { refresh, pull, push, publish, commit, cleanup, done };
}

/**
 * Whether the board is still waiting on the agent: a card send not yet
 * settled, or a board click at `sentAt` (ms) with no agent post since
 * (`updatedAt`, the state's last post, ISO). Collecting a click takes
 * milliseconds, so "uncollected" alone leaves the bar live while the agent
 * runs git. An agent gone quiet (`adrift`) releases the lock.
 */
export function boardAwaiting({ sentAt = null, updatedAt = null, cardsAwaiting = 0, adrift = false } = {}) {
  if (adrift) return false;
  if (cardsAwaiting > 0) return true;
  if (!sentAt) return false;
  const posted = Date.parse(updatedAt);
  return !(posted > sentAt);
}

/* ------------------------------------------------------------- replies */

const names = (v) => list(v).filter((s) => typeof s === "string" && s);

// "these 3 files: a, b, c" or "this file: a".
function filePhrase(files, count) {
  const n = Number.isInteger(count) ? count : files.length;
  const shown = files.length ? `: ${files.join(", ")}` : "";
  return n === 1 ? `this file${shown}` : `these ${n} files${shown}`;
}

// Nothing ticked, only .gitignore picks: the commit takes .gitignore alone.
const ignoreOnly = (f) => !names(f.files).length && !Number(f.count) && names(f.ignore).length > 0;

/** The plain instruction a board button sends the agent, one sentence per op. */
export function gitReply(op, fields = {}) {
  const f = fields || {};
  switch (op) {
    case "refresh":
      return "Refresh.";
    case "pull":
      return "Pull.";
    case "push":
      return "Push.";
    case "publish":
      // No remote named: there are several, and the agent asks which.
      return f.remote ? `Publish to ${f.remote}.` : "Publish.";
    case "switch":
      return `Switch to ${f.branch}.`;
    case "create": {
      const start = `Create ${f.name} from ${f.from}.`;
      if (f.then !== "commit") return start;
      const ignore = names(f.ignore);
      if (ignoreOnly(f)) return `${start} Then add ${ignore.join(", ")} to .gitignore and commit just .gitignore.`;
      const tail = ignore.length ? ` Add ${ignore.join(", ")} to .gitignore.` : "";
      return `${start} Then commit ${filePhrase(names(f.files), f.count)}.${tail}`;
    }
    case "delete":
      return `Delete ${f.branch}.`;
    case "cleanup": {
      const branches = names(f.branches);
      const n = Number.isInteger(f.count) ? f.count : branches.length;
      return `Clean up ${plural(n, "branch", "branches")}${branches.length ? `: ${branches.join(", ")}` : ""}.`;
    }
    case "commit": {
      const ignore = names(f.ignore);
      if (ignoreOnly(f)) return `Add ${ignore.join(", ")} to .gitignore and commit just .gitignore.`;
      const tail = ignore.length ? ` Add ${ignore.join(", ")} to .gitignore.` : "";
      return `Commit ${filePhrase(names(f.files), f.count)}.${tail}`;
    }
    case "abort":
      return `Abort the ${f.operation === "am" ? "git am" : f.operation || "rebase"}.`;
    case "continue":
      return `Continue the ${f.operation === "am" ? "git am" : f.operation || "rebase"}.`;
    case "pr-host":
      if (f.kind === "none" || !Object.hasOwn(PR_HOST_LABELS, f.kind)) return "This host is none of those.";
      return `This host is ${PR_HOST_LABELS[f.kind]}.`;
    case "done":
      return "I'm done.";
    default:
      return `${op}.`;
  }
}

/* ---------------------------------------------------------------- time */

const UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

let rtf = null;

/** "2 hr. ago" style age of `iso`, in its largest whole unit; "" for an unreadable date. */
export function relativeAge(iso, now = Date.now()) {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (iso === null || iso === undefined || iso === "" || Number.isNaN(t) || !Number.isFinite(Number(now))) return "";
  rtf = rtf || new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
  const seconds = (t - Number(now)) / 1000;
  const unit = UNITS.find(([, size]) => Math.abs(seconds) >= size);
  if (!unit) return rtf.format(0, "second");
  return rtf.format(Math.round(seconds / unit[1]), unit[0]);
}

/** The board's footer line: when the remotes were last fetched, and whether the last try failed. */
export function refreshedLine(git, now = Date.now()) {
  const g = git || {};
  const age = g.lastFetch ? relativeAge(g.lastFetch, now) : "";
  const line = age ? `Last refreshed ${age}` : "Never refreshed";
  return g.refreshFailed ? `${line} · refresh failed` : line;
}

/* -------------------------------------------------------------- commit */

/**
 * The paths ticked when the commit dialog opens. Staged files win: when any
 * file is staged, exactly those. Otherwise every file that is not risky,
 * plus each untracked folder of at most UNTRACKED_TICK_LIMIT files.
 */
export function commitTicks(changes) {
  const files = list(changes && changes.files).filter((f) => f && typeof f.path === "string");
  const staged = files.filter((f) => f.staged);
  if (staged.length) return new Set(staged.map((f) => f.path));
  const ticks = new Set(files.filter((f) => !f.risky).map((f) => f.path));
  for (const dir of list(changes && changes.untrackedDirs)) {
    if (dir && typeof dir.path === "string" && Number(dir.files) <= UNTRACKED_TICK_LIMIT) ticks.add(dir.path);
  }
  return ticks;
}

/* ------------------------------------------------------- pull requests */

/**
 * The pull-request link for the current branch into `base` (the default
 * branch unless the picker chose another): `{ url, needsKind, host }`, where
 * needsKind means the host's kind is unknown and the person must name it
 * (url is null then). null when the branch is not pushed, is gone upstream,
 * is the default branch, or its remote or the base is missing.
 */
export function boardPrLink(git, base) {
  const cur = currentRow(git);
  if (!cur || !cur.upstream || cur.gone || cur.default) return null;
  const target = base || (git && git.defaultBranch);
  if (!target) return null;
  const remote = list(git.remotes).find((r) => r && r.name === cur.upstreamRemote);
  if (!remote) return null;
  const needsKind = remote.kind === null || remote.kind === undefined;
  return {
    url: needsKind ? null : prUrl(remote, { base: target, head: cur.name }),
    needsKind,
    host: remote.host || null,
  };
}

/* ----------------------------------------------------------- next step */

export const GIT_TABS = Object.freeze([
  Object.freeze({ id: "changes", label: "Changes" }),
  Object.freeze({ id: "branches", label: "Branches" }),
  Object.freeze({ id: "sync", label: "Sync" }),
]);

const TAB_IDS = new Set(GIT_TABS.map((t) => t.id));

// The tab each suggested step lives on. Anything not listed is Sync's.
const STEP_TAB = Object.freeze({
  commit: "changes",
  "create-commit": "changes",
  ignore: "changes",
  create: "branches",
  cleanup: "branches",
});

const tabOf = (step) => (step && STEP_TAB[step.op]) || "sync";

const STALE_MS = 60 * 60 * 1000;

const files = (n) => plural(n, "file", "files");
const branchCount = (n) => plural(n, "branch", "branches");

// Held-back (risky) paths: secrets and big files, never counted toward Commit.
const heldPaths = (git) => list(git.changes && git.changes.files).filter((f) => f && f.risky && typeof f.path === "string").map((f) => f.path);

// Local branches merged into the default or gone upstream, never the current or default one.
// None without a default branch: boardActions() offers no Clean up then.
const sweepable = (git) =>
  git.defaultBranch ? list(git.branches).filter((b) => b && !b.remote && !b.current && !b.default && (b.merged || b.gone)) : [];

// Every step whose rule matches, in rule order (first match wins).
function matches(git) {
  const head = git.head || {};
  const held = heldPaths(git).length;
  const count = Math.max(0, (Number(git.changes && git.changes.count) || 0) - held);
  const cur = currentRow(git);
  const onDefault = Boolean(head.branch) && head.branch === git.defaultBranch;
  const hasRemote = list(git.remotes).length > 0;
  const live = Boolean(head.upstream) && !head.gone;
  const remoteName = (cur && cur.upstreamRemote) || "the remote";
  const out = [];

  // 1. An operation stopped part-way.
  if (git.inProgress) {
    const left = list(git.conflicted).filter((c) => c && c.markers).length;
    out.push(
      left
        ? { op: "fix", label: "Fix the files", why: `${files(left)} still ${left === 1 ? "has" : "have"} conflict markers.` }
        : { op: "continue", label: "Continue", why: "Every conflict is resolved." }
    );
    out.push({ op: "abort", label: `Abort the ${git.inProgress === "am" ? "git am" : git.inProgress}`, why: "Put everything back as it was." });
    return out;
  }
  // 2. Nothing committed yet.
  if (git.hasCommits === false) {
    out.push({ op: "commit", label: "Make the first commit", why: `Nothing saved yet. ${files(count)} ready.` });
    return out;
  }
  // 3. Detached HEAD.
  if (!head.branch) out.push({ op: "create", label: "Make a branch here", why: `You're on commit ${head.detached || "an unknown commit"}, not a branch.` });
  // 4. Uncommitted changes, held-back files left out.
  if (count > 0) {
    if (onDefault) {
      out.push({ op: "create-commit", label: `Start a branch for ${files(count)}`, why: `You're on ${head.branch}. Work usually goes on its own branch.` });
      out.push({ op: "commit", label: `Commit on ${head.branch}`, why: "Commit straight to the default branch.", forced: true });
    } else {
      out.push({ op: "commit", label: `Commit ${files(count)}`, why: `${files(count)} changed on ${head.branch || "this commit"}.` });
    }
  }
  // 5. Behind, 6. ahead.
  const behind = Number(head.behind) || 0;
  const ahead = Number(head.ahead) || 0;
  if (live && behind > 0) out.push({ op: "pull", label: "Pull", why: `${remoteName === "the remote" ? "The remote" : remoteName} has ${plural(behind, "commit", "commits")} you don't.` });
  if (live && ahead > 0) out.push({ op: "push", label: `Push ${ahead}`, why: `${plural(ahead, "commit", "commits")} not on ${remoteName} yet.` });
  // 7. Never published, or its remote copy was deleted.
  if (head.branch && hasRemote && !live) {
    out.push({ op: "publish", label: "Publish", why: head.gone ? `${head.branch}'s remote copy was deleted.` : `${head.branch} isn't on the remote yet.` });
  }
  // 8. Pushed, not the default branch, and a link that can open.
  if (live && !onDefault) {
    const link = boardPrLink(git, git.defaultBranch);
    if (link && link.url) out.push({ op: "pr", label: "Open pull request", why: "Pushed. Ready for review?", url: link.url });
  }
  // 9. Branches to clean up.
  const sweep = sweepable(git).length;
  if (sweep) out.push({ op: "cleanup", label: `Clean up ${branchCount(sweep)}`, why: `${branchCount(sweep)} already merged or deleted on the remote.` });
  return out;
}

// The held-back line and the .gitignore offer that fills an empty secondary slot.
function heldOut(git) {
  const held = heldPaths(git);
  if (!held.length) return { held: null, ignore: null };
  const what = held.length === 1 ? "`" + held[0] + "`" : `${held.length} held-back files`;
  return {
    held: held.length === 1 ? `${what} held back` : `${held.length} files held back`,
    ignore: { op: "ignore", label: `Add ${what} to .gitignore`, why: `Keep ${held.length === 1 ? "it" : "them"} out of every commit.`, files: held },
  };
}

// "Checked 3 hr. ago — Refresh?" when a remote exists and the last fetch is over an hour old or unknown.
function staleLine(git, now) {
  if (!list(git.remotes).length) return null;
  const at = Date.parse(git.lastFetch);
  if (!Number.isNaN(at) && now - at <= STALE_MS) return null;
  const age = git.lastFetch ? relativeAge(git.lastFetch, now) : "";
  return age ? `Checked ${age} — Refresh?` : "Never checked — Refresh?";
}

const withTab = (step) => (step ? { ...step, tab: tabOf(step) } : step);

/**
 * The board's suggested next step: `{ primary, secondary, stale, held, line,
 * tab }`. `primary` is the first matching rule or null; `secondary` an array
 * with at most one quieter step (the default-branch commit, else the next
 * match, else the held-back .gitignore offer), or the two quiet actions when
 * there is no primary. `stale` never changes the step. Every step carries the
 * `tab` it lives on, and `tab` is the one that owns the suggestion.
 */
export function nextStep(git, { now = Date.now() } = {}) {
  const g = git || {};
  const all = matches(g);
  const { held, ignore } = heldOut(g);
  const head = g.head || {};
  const stale = staleLine(g, now);
  if (!all.length) {
    const branch = head.branch || "this commit";
    const checked = g.lastFetch ? relativeAge(g.lastFetch, now) : "";
    const line = list(g.remotes).length
      ? `All caught up on ${branch}${checked ? ` · checked ${checked}` : ""}`
      : `Nothing to commit on ${branch} · no remote yet`;
    const secondary = [ignore || { op: "create", label: "New branch" }, { op: "refresh", label: "Refresh" }].map(withTab);
    return { primary: null, secondary, stale, held, line, tab: ignore ? "changes" : "sync" };
  }
  const [first, ...rest] = all;
  const primary = withTab(first);
  const second = rest.find((s) => s.forced) || rest[0] || ignore;
  return { primary, secondary: second ? [withTab(second)] : [], stale, held, line: primary.why, tab: primary.tab };
}

/* -------------------------------------------------------------- badges */

/**
 * What each tab has waiting: `{ changes, branches, sync }`, each null or
 * `{ kind, text, label, next }` (kind "count", "dot" or "warn"; `label` is
 * for the tab's accessible name). `next` marks the tab owning the next step
 * when there is a primary; that tab always carries a badge. Mid-operation
 * only Sync is badged, with a warning.
 */
export function tabBadges(git, { now = Date.now(), stepTab = null } = {}) {
  const g = git || {};
  const head = g.head || {};
  const out = { changes: null, branches: null, sync: null };
  if (g.inProgress) {
    out.sync = { kind: "warn", text: "!", label: "operation in progress", next: false };
  } else {
    const held = heldPaths(g).length;
    const count = Math.max(0, (Number(g.changes && g.changes.count) || 0) - held);
    if (count) out.changes = { kind: "count", text: String(count), label: `${count} waiting`, next: false };
    else if (held) out.changes = { kind: "dot", text: "·", label: "held-back files", next: false };

    const sweep = sweepable(g).length;
    if (sweep) out.branches = { kind: "count", text: String(sweep), label: `${sweep} to clean up`, next: false };

    const live = Boolean(head.upstream) && !head.gone;
    const ahead = Number(head.ahead) || 0;
    const behind = Number(head.behind) || 0;
    if (live && (ahead || behind)) {
      const text = [ahead ? `↑${ahead}` : null, behind ? `↓${behind}` : null].filter(Boolean).join(" ");
      const label = [ahead ? `${ahead} to push` : null, behind ? `${behind} to pull` : null].filter(Boolean).join(", ");
      out.sync = { kind: "count", text, label, next: false };
    } else if (list(g.remotes).length && head.branch && !live && g.hasCommits !== false) {
      out.sync = { kind: "count", text: "↑", label: "not published", next: false };
    } else if (staleLine(g, now)) {
      out.sync = { kind: "count", text: "?", label: "not checked lately", next: false };
    }
  }
  const step = nextStep(g, { now });
  const owner = TAB_IDS.has(stepTab) ? stepTab : step.tab;
  if (step.primary && TAB_IDS.has(owner)) {
    const b = out[owner] || { kind: "dot", text: "·", label: "" };
    out[owner] = { ...b, next: true, label: b.label ? `${b.label}, next step` : "next step" };
  }
  return out;
}

/* ---------------------------------------------------------------- busy */

/**
 * How busy the board is, most restrictive first: "offline" (the server is
 * gone, or the last click is not picked up yet), "running" (a git command or
 * the agent's turn), "card" (a question of Plan2Code's waits), "idle".
 */
export function busyMode({ running = false, cardWaiting = false, gone = false, pending = false } = {}) {
  if (gone || pending) return "offline";
  if (running) return "running";
  if (cardWaiting) return "card";
  return "idle";
}

/**
 * Whether a control of `role` works in `mode`: "nav" (switching tabs, search,
 * folds) always; "action" (anything that sends, ticks, picks, copies or opens
 * a panel) only when idle; "done" (Done with git) when idle or a card waits.
 */
export function controlAllowed(mode, role) {
  if (role === "nav") return true;
  if (role === "action") return mode === "idle";
  if (role === "done") return mode === "idle" || mode === "card";
  return false;
}

/**
 * The tab to show. A click of theirs that landed, and arriving at the board,
 * go to the next step's tab; a reload and a change they did not click for
 * keep the tab they had.
 */
export function pickTab({ current = null, stepTab, reason } = {}) {
  const step = TAB_IDS.has(stepTab) ? stepTab : "sync";
  if (reason === "landed" || reason === "arrival") return step;
  return TAB_IDS.has(current) ? current : step;
}
