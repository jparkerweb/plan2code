// Plan2Code Web Console - what the page reads off its state: the questions, the finish, the scan, who has the ball; defines only.
//
// Plain functions over `page` (state.js) that more than one screen asks the
// same question of, kept here so no screen has to import another to ask it.

import { page, redraw } from "./state.js";
import { boardAwaiting } from "./git-board.js";
import { defaultSpec, reviewOffer, dashboardOffer, submittedAwaiting, quietLimitMs } from "./answers.js";
import { activityLabel, workingLine } from "./labels.js";

export const WORKING_GRACE_MS = 5 * 60 * 1000;

// Two minutes with the agent mid-turn, three when it is merely meant to be
// listening. The difference is the cost of being wrong: a working agent that
// goes quiet is worth mentioning early, whereas the gap between `wait`
// returning and the next patch landing is ordinary and must not be called a
// failure. `wait` pokes /health every five seconds, so either threshold is
// many missed pokes, not a slow one.
const ADRIFT_MS = 3 * 60 * 1000;

export const items = () => (page.S && Array.isArray(page.S.items) ? page.S.items : []);

export const topics = () => (page.S && Array.isArray(page.S.topics) ? page.S.topics : []);

export const docs = () => (page.S && Array.isArray(page.S.docs) ? page.S.docs : []);

export const byId = (id) => items().find((i) => i.id === id);

export const isOpen = (i) => i.status === "open" || i.status === "reopened";

export const asked = () => items().filter((i) => i.kind !== "notice");

export const openItems = () => asked().filter(isOpen);

export const stagedCount = () => Object.keys(page.local.staged).length;

// The one thing the page could never know before: this session is OVER, and
// the agent said so rather than the page inferring it. Everything else here is
// a pause -- no open questions means "none right now", not "no more ever" --
// which is why the end of a session used to read as a lull that never lifted.
// A posted finish is the whole signal; its command is optional, because some
// sessions end with nothing left to run.
export const finish = () => (page.S && page.S.finish && typeof page.S.finish === "object" ? page.S.finish : null);

// The dashboard is the one workflow that is not a conversation: a menu of the
// skills, rendered from the page's own catalog, where a click IS the answer.
export const isDashboard = () => page.S && page.S.workflow === "dashboard";

// The git board is drawn by the page too, from the console's own read-only
// snapshot (state.git), with the agent's confirm and result cards above it.
export const isGitBoard = () => page.S && page.S.workflow === "git" && page.S.git;

// A board click or a card send stays with the agent until its next post
// (boardAwaiting in git-board.js), not just until `wait` collects it.
export function gitAwaiting() {
  if (!isGitBoard()) return false;
  return boardAwaiting({
    sentAt: page.local.gitSentAt || null,
    updatedAt: page.S.updatedAt || null,
    cardsAwaiting: awaitingReply().length,
    adrift: agentAdrift(),
  });
}

// The server's scan of the repo — AGENTS.md plus every spec under specs/,
// classified by pipeline stage and sorted most-recently-touched first.
export const scan = () => (page.S && page.S.scan) || null;

export const specList = () => {
  const sc = scan();
  return sc && Array.isArray(sc.specs) ? sc.specs : [];
};

// The spec the picker currently targets. Absent `specSel` means the picker
// has not been touched, so it defaults to the most recently touched spec
// still in play (defaultSpec: the server's list is already sorted, and a
// fixed bug is skipped). An explicit "start from scratch" is stored as null,
// which is different.
export const selSpec = () => {
  const specs = specList();
  if (!specs.length) return null;
  if (page.local.specSel === undefined) return defaultSpec(specs);
  return specs.find((s) => s.dir === page.local.specSel) || null;
};

// This checkout's unused handoffs (scan.handoffs, newest first). A handoff is
// picked in the same chip row as a spec, stored as `specSel = "handoff:<id>"`;
// selSpec() then reads as "no spec", and selHandoff() is the handoff itself,
// or null once it is gone from the scan (which also drops the stale pick).
export const handoffList = () => {
  const sc = scan();
  return sc && Array.isArray(sc.handoffs) ? sc.handoffs : [];
};

export const selHandoff = () => {
  if (typeof page.local.specSel !== "string" || !page.local.specSel.startsWith("handoff:")) return null;
  const id = page.local.specSel.slice("handoff:".length);
  const h = handoffList().find((x) => x.id === id) || null;
  if (!h) delete page.local.specSel;
  return h;
};

// The review a finished build offers, and where it has got to:
//   "open"   on offer, and a press would reach the agent
//   "asked"  pressed, and the agent has not taken it up yet
//   null     no offer, declined, or nobody left to take the press
// `local.afterBuild` remembers the press across a reload. It is cleared when
// the finish goes away, which is the agent taking the review up.
export function reviewPending() {
  const fin = finish();
  if (!fin || !reviewOffer(fin) || ["done", "dashboard", "commit"].includes(page.local.afterBuild)) return null;
  if (page.local.afterBuild === "review") return page.gone ? null : "asked";
  return page.gone ? null : "open";
}

// The dashboard offer on a finish, unless the person already said they are
// done: that send closes the session, so a button after it would go nowhere.
export const dashboardLive = (fin) => dashboardOffer(fin) && page.local.afterBuild !== "done";

// Whether the agent has collected this card's send: carried by the last
// collected send (state.collected), or sent before that collection.
export const sendCollected = (i, sub = i && i.submitted) => {
  const c = page.S && page.S.collected;
  if (!c || !sub) return false;
  if (Array.isArray(c.ids) && c.ids.includes(i.id)) return true;
  return Boolean(c.at && sub.at && String(sub.at) <= String(c.at));
};

// The durable half of `local.sent`: the server writes every send onto the
// item itself (`submitted`), so the send survives a reload, a resume onto a
// new port, and a second tab. It also covers an agent that took the answer
// and moved on without marking the item settled, which used to hand the
// question back looking as though the send never happened. `local.retract`
// is the person's "take it back" against exactly that send.
export const submittedInFlight = (i) => {
  const sub = submittedAwaiting(i);
  if (!sub) return null;
  // Collected, and the agent is back to waiting without settling it: it left
  // the card open on purpose (a pick that still owes its recap), so the send
  // is no longer with it, and nothing stays locked waiting on a reply.
  // Any send at or before the last collection was collected too, not only the
  // cards that last one carried.
  if (!page.pendingResult && !agentWorking() && sendCollected(i, sub)) return null;
  const r = page.local.retract && page.local.retract[i.id];
  if (r === "any" || (r != null && r === sub.at)) return null;
  return sub;
};

// Open questions whose send is with the agent: answers and notes alike. On a
// finished session there is nobody left to collect a send, so nothing is in
// flight either -- the item is a record of what was sent, not a live wait.
export const awaitingReply = () =>
  finish()
    ? []
    : openItems().filter((i) => (page.local.sent && page.local.sent[i.id]) || submittedInFlight(i));

// Open questions that are actually the person's to answer right now. An open
// question they have already sent is not one of those, and counting it as one
// is how the page ends up telling someone it is their turn while they are
// sitting waiting for a reply. A finished session ends everyone's turn:
// questions left open are moot, because a send can no longer go anywhere.
export const myTurn = () =>
  finish()
    ? []
    : openItems().filter((i) => !(page.local.sent && page.local.sent[i.id]) && !submittedInFlight(i));

export function agentWorking() {
  return page.S && page.S.agent && page.S.agent.status === "working";
}

export function workingMs() {
  if (!agentWorking() || !page.S.agent.since) return 0;
  return Date.now() - Date.parse(page.S.agent.since);
}

// The three silence thresholds below, stretched while the agent has said a
// long quiet stretch is normal (a build task). See quietLimitMs.
export const patience = (baseMs) => quietLimitMs(page.S && page.S.agent, baseMs);

// What the agent says it is doing right now, when it has said: "Task 3 of 9:
// the user service". Only meaningful while it is working. A build's line is
// rewritten (activityLabel() in labels.js) because agents trained on the old
// wording still write "Task 4.3 of 9", phase-numbered beside a bar that counts
// within the phase; the page puts it right rather than every prompt having to.
export function activity() {
  if (!agentWorking()) return "";
  const a = page.S.agent.activity;
  if (typeof a !== "string") return "";
  return activityLabel(a.trim(), page.S.workflow);
}

export const doingNow = () => workingLine(page.S && page.S.agent, page.S && page.S.headline, page.S && page.S.workflow);

// The OTHER end of the wire, and the one that was invisible.
//
// There are two connections here, not one. The page talks to a little server
// on this machine (`gone` covers that), and the server is polled by the agent
// sitting in `wait` (this covers that). The second is the one that actually
// breaks: a page left open pings every five seconds, which keeps the server
// well clear of its idle deadline, so the server happily outlives the agent
// for hours. Until now nothing said so unless the agent had also declared
// itself "working", and the normal state while someone answers is "waiting".
export function agentAdrift() {
  if (!page.agentLastSeen || page.gone || finish()) return false;
  return Date.now() - Date.parse(page.agentLastSeen) > patience(ADRIFT_MS);
}

// Answers that went nowhere: pressed Send, and nothing has collected them.
// They are safe -- the server wrote them to disk and the next session picks
// them up -- but "Sent. Waiting for Plan2Code." forever does not say that.
export const stranded = () => page.pendingResult && agentAdrift();

// The spec whose overview.md the Overview tab shows: the dashboard picker's
// selection on the dashboard, the session's own spec everywhere else.
export const overviewSpec = () => (isDashboard() ? selSpec()?.dir || "" : (page.S && page.S.specDir) || "");

// Fresh from disk every time, never cached: the file changes under a build,
// and the tab is only worth having if it shows what is there now. Repaints
// only when the tab would appear, vanish or show different text.
export async function loadOverview() {
  const spec = overviewSpec();
  let text = null;
  if (spec) {
    try {
      const res = await fetch("/overview?spec=" + encodeURIComponent(spec), { cache: "no-store" });
      if (res.status === 200) text = await res.text();
    } catch {}
  }
  // The selection moved on while this was in flight; its own fetch will land.
  if (spec !== overviewSpec()) return;
  const changed = page.overview.key !== spec || page.overview.text !== text;
  page.overview = { key: spec, text };
  if (changed) redraw();
}

// The workspace's folders, original first, or none before a frame has them.
export const workspaceFolders = () => (page.wsFrame && Array.isArray(page.wsFrame.folders) ? page.wsFrame.folders : []);
