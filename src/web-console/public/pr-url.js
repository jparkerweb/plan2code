// Plan2Code Web Console - the pull-request link for a branch.
//
// One pure builder for the four host shapes in the git-dashboard spec
// (overview.md -> Pull-request URL shapes). git-repo.mjs re-exports it for the
// snapshot, and the board's base picker rebuilds the link in the browser with
// the same code. No DOM access at module scope and no imports: the server,
// git-repo.mjs, the page and `node --test` all import this file.

// GitHub's compare path keeps the "/" in a branch name; each segment is
// encoded on its own.
const segments = (branch) => branch.split("/").map(encodeURIComponent).join("/");
const q = encodeURIComponent;

const SHAPES = {
  github: (web, base, head) => `${web}/compare/${segments(base)}...${segments(head)}?quick_pull=1`,
  gitlab: (web, base, head) =>
    `${web}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${q(head)}&merge_request%5Btarget_branch%5D=${q(base)}`,
  azure: (web, base, head) => `${web}/pullrequestcreate?sourceRef=${q(head)}&targetRef=${q(base)}`,
  bitbucket: (web, base, head) => `${web}/pull-requests/new?source=${q(head)}&dest=${q(base)}`,
};

/**
 * The "open a pull request" link for `head` into `base` on a remote, or null
 * when the host has no known shape (kind null or "none"), the remote has no
 * web address, or the result would not be an https: link.
 */
export function prUrl({ web, kind } = {}, { base, head } = {}) {
  const shape = SHAPES[kind];
  if (!shape || !web || !base || !head) return null;
  const url = shape(String(web).replace(/\/+$/, ""), base, head);
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
