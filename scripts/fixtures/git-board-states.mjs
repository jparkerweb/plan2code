// Git board fixture: canned state.git snapshots, one per journey step and edge case.
//
// A copy of specs/git-board-redesign/pathfinder/sketch-00/states.js, the repo
// states every Pathfinder sketch moved between. Shape follows
// src/web-console/git-repo.mjs snapshot(). `expect` is [primary op, secondary
// op] under the agreed next-step rules (nextStep() in git-board.js), and
// `expectTab` the tab that owns that step. Times are relative to a fixed NOW,
// so ages read the same on every run.

export const NOW = Date.parse("2026-10-14T12:00:00Z");
const ago = (mins) => new Date(NOW - mins * 60000).toISOString();

const ORIGIN = {
  name: "origin",
  url: "git@github.com:jparkerweb/plan2code.git",
  host: "github.com",
  web: "https://github.com/jparkerweb/plan2code",
  kind: "github",
};

const pr = (head) => `https://github.com/jparkerweb/plan2code/compare/main...${head}?expand=1`;

const last = (subject, author, mins) => ({ subject, author, at: ago(mins) });

function local(name, extra = {}) {
  return {
    name,
    current: false,
    default: name === "main",
    remote: null,
    upstream: `origin/${name}`,
    upstreamRemote: "origin",
    ahead: 0,
    behind: 0,
    gone: false,
    merged: false,
    last: last("Update README", "Justin Parker", 60 * 24),
    ...extra,
  };
}

function remoteOnly(name, subject, author, mins) {
  return { name, current: false, default: false, remote: "origin", upstream: null, upstreamRemote: null, ahead: null, behind: null, gone: false, merged: false, last: last(subject, author, mins) };
}

// The branches every journey shares; `current` and the current row's tracking are set per state.
function branches(current, row = {}) {
  const rows = [
    local("main", { last: last("Release 4.12.0", "Justin Parker", 60 * 5) }),
    local("feature/ABC-12001-export-csv", { last: last("Add CSV export button to the audit view", "Justin Parker", 40) }),
    local("feature/ABC-11980-audit-filter", { last: last("Filter audit events by actor", "Priya Raman", 60 * 26) }),
    local("fix/ABC-11890-null-ticket", { merged: true, last: last("Guard against a null ticket id", "Sam Okafor", 60 * 24 * 6) }),
    local("chore/bump-deps", { merged: true, last: last("Bump dev dependencies", "Justin Parker", 60 * 24 * 9) }),
    remoteOnly("feature/ABC-12010-sso-banner", "Show SSO expiry banner", "Dana Whitfield", 60 * 3),
    remoteOnly("docs/readme-console", "Document the console's Ask tab", "Priya Raman", 60 * 24 * 2),
  ];
  if (!rows.some((b) => b.name === current)) rows.splice(1, 0, local(current, { upstream: null, upstreamRemote: null, ahead: null, behind: null }));
  return rows.map((b) => (b.name === current && !b.remote ? { ...b, current: true, ...row } : b));
}

const NO_CHANGES = { count: 0, heldBack: 0, files: [], untrackedDirs: [] };

const DIRTY_FEATURE = {
  count: 4,
  heldBack: 1,
  files: [
    { path: "src/web-console/public/audit-export.js", state: "modified", staged: false, risky: false },
    { path: "src/web-console/public/app.css", state: "modified", staged: false, risky: false },
    { path: ".env.local", state: "new", staged: false, risky: true },
  ],
  untrackedDirs: [{ path: "scripts/fixtures/audit/", files: 6 }],
};

const DIRTY_MAIN = {
  count: 2,
  heldBack: 0,
  files: [
    { path: "src/web-console/public/login.js", state: "modified", staged: false, risky: false },
    { path: "scripts/test-login.mjs", state: "new", staged: false, risky: false },
  ],
  untrackedDirs: [],
};

function snap({ branch, ahead = 0, behind = 0, upstream, gone = false, changes = NO_CHANGES, inProgress = null, conflicted = [], lastFetch = ago(5), remotes = [ORIGIN], rows, prUrl = null, hasCommits = true, detached = null, rebasing }) {
  const up = upstream === undefined ? (branch ? `origin/${branch}` : null) : upstream;
  return {
    at: new Date(NOW).toISOString(),
    repo: true,
    hasCommits,
    head: { branch, detached, ...(rebasing ? { rebasing } : {}), upstream: up, gone, ahead: up ? ahead : null, behind: up ? behind : null },
    defaultBranch: "main",
    inProgress,
    conflicted,
    changes,
    remotes,
    lastFetch,
    refreshFailed: false,
    branches: rows || branches(branch, { upstream: up, upstreamRemote: up ? "origin" : null, ahead: up ? ahead : null, behind: up ? behind : null, gone }),
    prUrl,
  };
}

const EXPORT = "feature/ABC-12001-export-csv";
const LOGIN = "fix/ABC-12044-login-redirect";
const FILTER = "feature/ABC-11980-audit-filter";

/** The three journeys, in click order. */
export const JOURNEYS = [
  { id: "commit-push", title: "Commit & push", states: ["cp-dirty", "cp-committing", "cp-ahead", "cp-pushing", "cp-pushed"] },
  { id: "new-branch", title: "Start a new branch", states: ["nb-main-dirty", "nb-creating", "nb-unpublished", "nb-publishing", "nb-published"] },
  { id: "pull-conflict", title: "Recover from a pull conflict", states: ["pc-diverged", "pc-pulling", "pc-conflict", "pc-resolved", "pc-continuing", "pc-rebased", "pc-pushing", "pc-pushed"] },
];

/**
 * Every state: `git` (the snapshot), `journey` and `step` (or "edge"), `title`,
 * `expect` (primary op, secondary op or null), `expectTab` (the tab owning the
 * next step), `expectLine` where the line itself is pinned, `busy` (what is
 * running, when a git command is), `result` (the git-result notice after the
 * last action), and `on` (board op -> next state id) for the clicks a journey
 * takes.
 */
export const STATES = {
  /* Commit & push, on a published feature branch */
  "cp-dirty": {
    journey: "commit-push", step: 1, title: "4 changes on a feature branch (one held back)",
    git: snap({ branch: EXPORT, changes: DIRTY_FEATURE, prUrl: pr(EXPORT) }),
    expect: ["commit", "pr"],
    expectTab: "changes",
    on: { commit: "cp-committing" },
  },
  "cp-committing": {
    journey: "commit-push", step: 2, title: "Committing (busy)", busy: "Committing 3 files on feature/ABC-12001-export-csv",
    git: snap({ branch: EXPORT, changes: DIRTY_FEATURE, prUrl: pr(EXPORT) }),
    expect: ["commit", "pr"],
    expectTab: "changes",
    on: { done: "cp-ahead" },
  },
  "cp-ahead": {
    journey: "commit-push", step: 3, title: "Committed, 1 to push",
    result: { title: "Committed 3 files", body: "`9f3c2ab` Add CSV export button to the audit view. `.env.local` was held back." },
    git: snap({ branch: EXPORT, ahead: 1, changes: { count: 1, heldBack: 1, files: [DIRTY_FEATURE.files[2]], untrackedDirs: [] }, prUrl: pr(EXPORT) }),
    expect: ["push", "pr"],
    expectTab: "sync",
    on: { push: "cp-pushing" },
  },
  "cp-pushing": {
    journey: "commit-push", step: 4, title: "Pushing (busy)", busy: "Pushing 1 commit to origin",
    git: snap({ branch: EXPORT, ahead: 1, changes: { count: 1, heldBack: 1, files: [DIRTY_FEATURE.files[2]], untrackedDirs: [] }, prUrl: pr(EXPORT) }),
    expect: ["push", "pr"],
    expectTab: "sync",
    on: { done: "cp-pushed" },
  },
  "cp-pushed": {
    journey: "commit-push", step: 5, title: "Pushed, pull request ready",
    result: { title: "Pushed 1 commit to origin/feature/ABC-12001-export-csv", body: `\`9f3c2ab\`. [Open pull request](${pr(EXPORT)})` },
    git: snap({ branch: EXPORT, changes: { count: 1, heldBack: 1, files: [DIRTY_FEATURE.files[2]], untrackedDirs: [] }, prUrl: pr(EXPORT) }),
    expect: ["pr", "cleanup"],
    expectTab: "sync",
    on: {},
  },

  /* Start a new branch, from changes made on main */
  "nb-main-dirty": {
    journey: "new-branch", step: 1, title: "2 changes on main",
    git: snap({ branch: "main", changes: DIRTY_MAIN }),
    expect: ["create-commit", "commit"],
    expectTab: "changes",
    on: { "create-commit": "nb-creating", create: "nb-creating" },
  },
  "nb-creating": {
    journey: "new-branch", step: 2, title: "Creating the branch and committing (busy)", busy: "Creating fix/ABC-12044-login-redirect from origin/main, then committing 2 files",
    git: snap({ branch: "main", changes: DIRTY_MAIN }),
    expect: ["create-commit", "commit"],
    expectTab: "changes",
    on: { done: "nb-unpublished" },
  },
  "nb-unpublished": {
    journey: "new-branch", step: 3, title: "New branch with 1 commit, not published",
    result: { title: "Created fix/ABC-12044-login-redirect and committed 2 files", body: "`4e7d1c0` Redirect to the login page after SSO expiry." },
    git: snap({ branch: LOGIN, upstream: null }),
    expect: ["publish", "cleanup"],
    expectTab: "sync",
    on: { publish: "nb-publishing" },
  },
  "nb-publishing": {
    journey: "new-branch", step: 4, title: "Publishing (busy)", busy: "Publishing fix/ABC-12044-login-redirect to origin",
    git: snap({ branch: LOGIN, upstream: null }),
    expect: ["publish", "cleanup"],
    expectTab: "sync",
    on: { done: "nb-published" },
  },
  "nb-published": {
    journey: "new-branch", step: 5, title: "Published, pull request ready",
    result: { title: "Published fix/ABC-12044-login-redirect to origin", body: `[Open pull request](${pr(LOGIN)})` },
    git: snap({ branch: LOGIN, prUrl: pr(LOGIN) }),
    expect: ["pr", "cleanup"],
    expectTab: "sync",
    on: {},
  },

  /* Recover from a pull conflict */
  "pc-diverged": {
    journey: "pull-conflict", step: 1, title: "1 ahead, 3 behind",
    git: snap({ branch: FILTER, ahead: 1, behind: 3, prUrl: pr(FILTER) }),
    expect: ["pull", "push"],
    expectTab: "sync",
    on: { pull: "pc-pulling" },
  },
  "pc-pulling": {
    journey: "pull-conflict", step: 2, title: "Pulling (busy)", busy: "Pulling origin/feature/ABC-11980-audit-filter (rebase)",
    git: snap({ branch: FILTER, ahead: 1, behind: 3, prUrl: pr(FILTER) }),
    expect: ["pull", "push"],
    expectTab: "sync",
    on: { done: "pc-conflict" },
  },
  "pc-conflict": {
    journey: "pull-conflict", step: 3, title: "Rebase stopped on 2 conflicts, 1 with markers left",
    result: { title: "Pull stopped on 2 conflicts", body: "Replaying `b81e9d4` Filter audit events by actor (1 of 1). Plan2Code resolved `src/web-console/public/audit.js`; `src/web-console/public/audit.css` still has markers." },
    git: snap({
      branch: null, detached: "b81e9d4", rebasing: FILTER, upstream: null, inProgress: "rebase",
      conflicted: [
        { path: "src/web-console/public/audit.js", markers: false },
        { path: "src/web-console/public/audit.css", markers: true },
      ],
      rows: branches(FILTER, { ahead: 1, behind: 3 }),
    }),
    expect: ["fix", "abort"],
    expectTab: "sync",
    on: { continue: "pc-conflict", abort: "pc-diverged", fix: "pc-resolved" },
  },
  "pc-resolved": {
    journey: "pull-conflict", step: 4, title: "Every conflict resolved",
    git: snap({
      branch: null, detached: "b81e9d4", rebasing: FILTER, upstream: null, inProgress: "rebase",
      conflicted: [
        { path: "src/web-console/public/audit.js", markers: false },
        { path: "src/web-console/public/audit.css", markers: false },
      ],
      rows: branches(FILTER, { ahead: 1, behind: 3 }),
    }),
    expect: ["continue", "abort"],
    expectTab: "sync",
    on: { continue: "pc-continuing", abort: "pc-diverged" },
  },
  "pc-continuing": {
    journey: "pull-conflict", step: 5, title: "Continuing the rebase (busy)", busy: "Continuing the rebase",
    git: snap({
      branch: null, detached: "b81e9d4", rebasing: FILTER, upstream: null, inProgress: "rebase",
      conflicted: [
        { path: "src/web-console/public/audit.js", markers: false },
        { path: "src/web-console/public/audit.css", markers: false },
      ],
      rows: branches(FILTER, { ahead: 1, behind: 3 }),
    }),
    expect: ["continue", "abort"],
    expectTab: "sync",
    on: { done: "pc-rebased" },
  },
  "pc-rebased": {
    journey: "pull-conflict", step: 6, title: "Rebased, 1 to push",
    result: { title: "Pull finished", body: "1 commit replayed on top of origin. Resolved `audit.js` (kept both filters) and `audit.css` (you fixed it). 1 commit ready to push." },
    git: snap({ branch: FILTER, ahead: 1, prUrl: pr(FILTER) }),
    expect: ["push", "pr"],
    expectTab: "sync",
    on: { push: "pc-pushing" },
  },
  "pc-pushing": {
    journey: "pull-conflict", step: 7, title: "Pushing (busy)", busy: "Pushing 1 commit to origin",
    git: snap({ branch: FILTER, ahead: 1, prUrl: pr(FILTER) }),
    expect: ["push", "pr"],
    expectTab: "sync",
    on: { done: "pc-pushed" },
  },
  "pc-pushed": {
    journey: "pull-conflict", step: 8, title: "Pushed, pull request ready",
    result: { title: `Pushed 1 commit to origin/${FILTER}`, body: `\`c42d7e1\`. [Open pull request](${pr(FILTER)})` },
    git: snap({ branch: FILTER, prUrl: pr(FILTER) }),
    expect: ["pr", "cleanup"],
    expectTab: "sync",
    on: {},
  },

  /* Edges that break layouts */
  "e-caught-up": {
    journey: "edge", title: "All caught up on main",
    git: snap({ branch: "main", rows: branches("main").map((b) => ({ ...b, merged: false })) }),
    expect: [null, "create"],
    expectTab: "sync",
    expectLine: "All caught up on main · checked 5 min. ago",
    on: {},
  },
  "e-stale": {
    journey: "edge", title: "All caught up, but last checked 3 hours ago",
    git: snap({ branch: "main", lastFetch: ago(180), rows: branches("main").map((b) => ({ ...b, merged: false })) }),
    expect: [null, "create"],
    expectTab: "sync",
    expectLine: "All caught up on main · checked 3 hr. ago",
    on: { refresh: "e-caught-up" },
  },
  "e-held-only": {
    journey: "edge", title: "Caught up except a held-back file",
    git: snap({ branch: "main", changes: { count: 1, heldBack: 1, files: [{ path: ".env.local", state: "new", staged: false, risky: true }], untrackedDirs: [] }, rows: branches("main").map((b) => ({ ...b, merged: false })) }),
    expect: [null, "ignore"],
    expectTab: "changes",
    on: {},
  },
  "e-gone": {
    journey: "edge", title: "Remote copy deleted",
    git: snap({ branch: "feature/ABC-11702-old-banner", gone: true }),
    expect: ["publish", "cleanup"],
    expectTab: "sync",
    on: {},
  },
  "e-no-remote": {
    journey: "edge", title: "No remote at all",
    git: snap({ branch: "main", upstream: null, remotes: [], lastFetch: null, rows: [local("main", { current: true, upstream: null, upstreamRemote: null, ahead: null, behind: null })] }),
    expect: [null, "create"],
    expectTab: "sync",
    expectLine: "Nothing to commit on main · no remote yet",
    on: {},
  },
  "e-first-commit": {
    journey: "edge", title: "No commits yet",
    git: snap({
      branch: "main", hasCommits: false, upstream: null, remotes: [], lastFetch: null, rows: [],
      changes: { count: 3, heldBack: 0, files: [{ path: "README.md", state: "new", staged: false, risky: false }, { path: "package.json", state: "new", staged: false, risky: false }], untrackedDirs: [{ path: "src/", files: 12 }] },
    }),
    expect: ["commit", null],
    expectTab: "changes",
    on: {},
  },
  "e-detached": {
    journey: "edge", title: "Detached at a commit",
    git: snap({ branch: null, detached: "a1b2c3d", upstream: null, rows: branches("main").map((b) => ({ ...b, current: false })) }),
    expect: ["create", "cleanup"],
    expectTab: "branches",
    on: {},
  },
  "e-many-branches": {
    journey: "edge", title: "300 branches, 40 merged",
    git: snap({
      branch: "main",
      rows: [
        local("main", { current: true }),
        ...Array.from({ length: 120 }, (_, i) =>
          local(`feature/ABC-${11000 + i}-${["export", "filter", "banner", "login", "audit", "sso"][i % 6]}-${i}`, {
            merged: i < 40,
            ahead: i % 7 === 0 ? 2 : 0,
            behind: i % 5 === 0 ? 4 : 0,
            last: last(`Work on ABC-${11000 + i}`, ["Justin Parker", "Priya Raman", "Sam Okafor", "Dana Whitfield"][i % 4], 60 * (i + 1)),
          }),
        ),
        ...Array.from({ length: 179 }, (_, i) => remoteOnly(`feature/ABC-${12100 + i}-remote-${i}`, `Remote work ${i}`, "Dana Whitfield", 60 * 24 + i * 30)),
      ],
    }),
    expect: ["cleanup", null],
    expectTab: "branches",
    on: {},
  },
};
