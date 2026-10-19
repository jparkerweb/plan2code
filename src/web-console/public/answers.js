// The page's pure logic: what the person answered, and what they asked for, in
// the words those things have to reach the agent as.
//
// Everything here is a pure function of an item and a value. That is the point
// of the file: app.js cannot be loaded outside a browser (it touches `document`
// at module scope and starts a session on import), so any logic that stays in
// it is logic no test can reach. Three defects in this exact code got as far as
// the screen before anyone noticed. It lives here so `node --test` can see it.
//
// No DOM, no `local`, no fetch. If a function in here needs any of those, it
// belongs in app.js instead.

import { FIXED_REASON, SKILLS, labelFor, skillByName, skillFor } from "./skills.js";
import { SPEC_STATES, stateFor } from "./spec-states.js";

/* ----------------------------------------------------- the sent answer */

/**
 * The value an in-flight send carries, or null if it carries no answer.
 *
 * A send can be a note on its own: someone asks a question about the question
 * before answering it. That still goes in `local.sent`, because the note really
 * is on its way, but it must NOT make the page treat the question as answered
 * and lock the form. They have not answered it yet, and locking them out is how
 * an open question becomes unanswerable.
 */
export function sentAnswer(sent) {
  return sent && sent.value ? sent.value : null;
}

/**
 * What the person settled on, for a question that is no longer open.
 *
 * `answer` is what the agent recorded when it settled the question. `submitted`
 * is what the server wrote down the moment Send was pressed. The second exists
 * because the first depends on the agent remembering to do it, and a card that
 * says "Settled" above an empty form is the worst thing this page can show.
 */
export function recordedAnswer(item) {
  const a = item && item.answer && typeof item.answer === "object" ? item.answer : null;
  const s = item && item.submitted && typeof item.submitted === "object" ? item.submitted : null;
  if (!a && !s) return null;
  return { ...(s || {}), ...(a || {}) };
}

/**
 * True when the agent wrote in the item's thread after the person's last send
 * and has not settled it: the question is being asked again, so what they sent
 * belongs back on the form rather than gone.
 */
export function agentRepliedAfterSend(item) {
  const s = item && item.submitted;
  if (!s || typeof s !== "object" || (item.answer && typeof item.answer === "object")) return false;
  const thread = Array.isArray(item.thread) ? item.thread : [];
  return thread.some((m) => m && threadWho(m) === "agent" && (!s.at || !m.at || m.at >= s.at));
}

/**
 * A send the person made that the agent never settled, still sitting on an
 * OPEN question.
 *
 * `local.sent` covers this while the same tab is alive; `submitted` is the
 * server's own record of the send and survives a reload, a resume onto a new
 * port, and a second tab. An open item that carries one, and has had no agent
 * reply since, is "sent, waiting on Plan2Code" — not a question still
 * waiting for them, which is what it reads as when an agent takes the answer
 * and moves on without marking the item settled.
 *
 * Two ways out, both meaning the question is theirs again:
 *
 *   - an agent message in the item's thread AFTER the send means the question
 *     is being asked again — the person gets a live form back, not a locked
 *     record of what they already said;
 *   - a recorded `answer` means the agent did settle it at some point (the
 *     status is just stale or the question was re-asked), so the leftover
 *     `submitted` is the old send, not one in flight.
 */
export function submittedAwaiting(item) {
  const s = item && item.submitted;
  if (!s || typeof s !== "object") return null;
  if (item.answer && typeof item.answer === "object") return null;
  const thread = Array.isArray(item.thread) ? item.thread : [];
  const replied = thread.some((m) => m && threadWho(m) === "agent" && (!s.at || !m.at || m.at >= s.at));
  return replied ? null : s;
}

/**
 * The note (and its attachments) the person last sent on an item, while the
 * agent has yet to say anything after it. The server records it as `sentNote`
 * on every send, so the page can show it in the Notes pane and in the Sent
 * box instead of letting it vanish into a send that shows no sign of arriving.
 * Any agent message from the send onwards, or one with no clock to compare,
 * means it has been picked up. The person's own entries never count: the
 * server writes their note into the thread as it arrives.
 */
export function noteAwaiting(item) {
  const n = item && item.sentNote;
  if (!n || typeof n !== "object") return null;
  const thread = Array.isArray(item.thread) ? item.thread : [];
  const picked = thread.some((m) => m && threadWho(m) === "agent" && (!n.at || !m.at || m.at >= n.at));
  return picked ? null : n;
}

/**
 * Who said a thread entry and what they said. The contract is `{ who, text }`
 * and the server lifts anything else into it, but sessions written before that
 * hold `{ from, md }` replies, which would otherwise draw as empty bubbles.
 */
export function threadWho(m) {
  return m && (m.who || m.from || m.role) === "user" ? "user" : "agent";
}

export function threadText(m) {
  if (!m) return "";
  for (const k of ["text", "md", "body", "content"]) if (typeof m[k] === "string" && m[k].trim()) return m[k];
  return "";
}

/* -------------------------------------------------------------- labels */

// A key worth showing: one or two letters or digits (A, 2) a person can say
// back in the terminal. A word key (commit-first, yes) is an id for the agent,
// and as a chip beside its own label it is noise.
export function showKey(k, text) {
  if (k == null) return false;
  const key = String(k);
  return /^[A-Za-z0-9]{1,2}$/.test(key) && key.toLowerCase() !== String(text || "").trim().toLowerCase();
}

export function optionLabel(item, k) {
  const o = ((item && item.options) || []).find((x) => x.k === k);
  if (!o) return String(k);
  return showKey(o.k, o.text) ? `${o.k} · ${o.text}` : o.text;
}

export function verdictLabel(item, id) {
  const list = (item && item.verdicts) || [
    { id: "approve", label: "Looks good, go ahead" },
    { id: "changes", label: "I want changes" },
  ];
  const v = list.find((x) => x.id === id);
  return v ? verdictText(v) : String(id);
}

// A verdict's button text. `label` is the contract; `text` is what menu
// options use, and an agent that borrows it must not get blank buttons.
export function verdictText(v) {
  return v.label || v.text || v.id;
}

export const CHECK_STATE_LABEL = {
  done: "All done",
  blocked: "I am stuck",
  help: "I need help",
  defer: "Later",
};

/**
 * The answer as lines to show back, in the page's words rather than the
 * agent's shorthand: "A · Run the setup first", not "a".
 */
export function answerLines(item, v) {
  const out = [];
  if (!v) return out;
  if (v.skipped) out.push("Skipped");
  if (v.k) out.push(optionLabel(item, v.k));
  if (Array.isArray(v.ks)) for (const k of v.ks) out.push(optionLabel(item, k));
  if (typeof v.yes === "boolean") out.push(v.yes ? item.yesLabel || "Yes" : item.noLabel || "No");
  if (typeof v.ok === "boolean") {
    out.push(v.ok ? item.yesLabel || "Yes, that is right" : item.noLabel || "Not quite");
  }
  if (v.verdict) out.push(verdictLabel(item, v.verdict));
  if (v.state) out.push(CHECK_STATE_LABEL[v.state] || String(v.state));
  if (Array.isArray(v.done) && v.done.length) {
    out.push(`Steps done: ${v.done.map((n) => n + 1).join(", ")}`);
  }
  if (Array.isArray(v.rows) && v.rows.length) {
    out.push(`${v.rows.length} steps, in the order you set`);
  }
  return out;
}

/**
 * A single-choice answer, which is one thing or the other and never both.
 *
 * Picking an option and then writing "none of these, because…" used to send
 * both, joined, with the pick first: an answer that argued with itself. The
 * rule lives here rather than in the two click handlers that apply it, so it
 * is one statement that a test can hold to.
 *
 * Returns null when there is nothing to stage, which is what "they have not
 * answered yet" looks like everywhere else in the page.
 */
export function choiceAnswer({ k, text } = {}) {
  if (k) return { type: "answer", kind: "choice", k };
  const said = String(text || "").trim();
  return said ? { type: "answer", kind: "choice", text: said } : null;
}

/* -------------------------------------------------------- the brief ask */

/**
 * The words a brief request reaches the agent as.
 *
 * This is not an answer, but it is the same kind of thing and it belongs to the
 * same rule: a string the agent parses, so it has to be exactly right, so it
 * has to be somewhere a test can see it. `range` is the Pathfinder brief
 * playbook's own grammar -- `today`, `this week`, `since <YYYY-MM-DD>`, `full`.
 */
export function briefPhrase(range) {
  const r = String(range || "today").trim();
  if (r === "full") return "Write a full brief.";
  if (r.startsWith("since ")) return `Write a brief covering everything ${r}.`;
  return `Write a brief for ${r}.`;
}

/* ---------------------------------------------------- the autofill text */

// A placeholder is a suggestion nobody can edit, and it vanishes the moment you
// type. On a question whose example is most of a good answer, retyping it is
// busywork, so offer it as a value instead. The lead-in ("For example:") is the
// agent talking about the example, not part of it, so it is stripped.
//
// Two rules keep the stripping from mangling a real answer:
//
//   The lead-in must be FOLLOWED by a separator. Without that, "Egypt office"
//   loses its "Eg" and "Exampled output" loses its "Example".
//
//   A bare hyphen only separates when it has space around it. "For example - a"
//   is a lead-in; the hyphen in "example-name-here" is part of the name, and a
//   kebab-case suggestion must survive intact for a field with a `pattern`.
//
// "Say" is deliberately not in the list: "Say when you need it by" is a
// question far more often than it is a preamble.
const EXAMPLE_LEAD =
  /^\s*(?:for\s+(?:example|instance)|examples?|such\s+as|e\.?\s?g\.?|i\.?\s?e\.?)(?:\s+-\s+|\s*[:,.]\s*|\s+)/i;

/**
 * The placeholder, as a value someone could accept as their own answer.
 * Empty string when there is nothing worth offering.
 */
export function suggestionFrom(item) {
  const raw = String((item && item.placeholder) || "").trim();
  if (!raw) return "";
  const stripped = raw.replace(EXAMPLE_LEAD, "").trim();
  if (!stripped) return "";
  // Recapitalise only when a lead-in was actually removed, and never on a
  // field with a shape to match: "audit-export" must not become "Audit-export".
  if (stripped !== raw && !item.pattern && /^[a-z]/.test(stripped)) {
    return stripped[0].toUpperCase() + stripped.slice(1);
  }
  return stripped;
}

/* ------------------------------------------------------ the hand-off */

// The badge each workflow wears. Shared with the server, which writes it into
// the page it serves so the first paint already names the session instead of
// flashing a placeholder until the script arrives. Derived from skills.js.
export const WORKFLOW_LABEL = Object.fromEntries(SKILLS.map((s) => [s.workflow, s.label]));

export function workflowLabel(workflow) {
  return labelFor(workflow) || workflow || "Session";
}

// The workflows that ship the console (install.js bundles it into every
// skill as `additionalReferences`). Any other next step has no browser page
// to open, and asking for one would send the next session looking for
// something that is not there. Derived from skills.js: every entry is one.
export const CONSOLE_WORKFLOWS = SKILLS.map((s) => s.command);

// Rides on the end of the command as part of the skill's argument. Every
// console skill takes it as the answer to "web console or terminal?" instead
// of asking again. It must stay clear of "brief", "recap" and "minutes":
// pathfinder reads any of those in its argument as a request for a brief.
export const CONTINUE_IN_CONSOLE = "--web";

// The long form the skills still accept. A command that carries it is copied
// with the flag instead, which is shorter and reads as the parameter it is.
const CONSOLE_SENTENCE = /\s*Use the web console for this session\.?/gi;

/**
 * What the Copy button on the finished screen puts on the clipboard.
 *
 * Someone who worked the whole session in the browser should land back in the
 * browser, not be asked the interface question as though they were new. The
 * `--web` flag goes on the same line as the command, because what follows a
 * slash command is its argument, and a pasted second line is not reliably that.
 * A command written with the long sentence is copied with the flag instead.
 *
 * `fin.console` overrides the inference either way; otherwise it follows from
 * whether the next step is a workflow that has a console at all.
 */
export function handoffText(fin) {
  const raw = String((fin && fin.command) || "").trim();
  if (!raw) return "";
  const cmd = raw.replace(CONSOLE_SENTENCE, "").trim();
  const capable =
    typeof fin.console === "boolean"
      ? fin.console
      : cmd !== raw || CONSOLE_WORKFLOWS.some((w) => cmd === w || cmd.startsWith(w + " "));
  // An agent that already wrote the flag should not get it twice.
  if (!capable || /(^|\s)--web\b/.test(cmd)) return cmd;
  return `${cmd} ${CONTINUE_IN_CONSOLE}`;
}

/**
 * A finish is a pause when its headline says so. There is no flag to read:
 * the stop playbook asks the agent to write "a headline that says it is
 * paused rather than done", so the page reads the same words the person
 * does. A session that ends on its own says nothing of the sort.
 */
export function finishPaused(fin) {
  return /^\s*paused\b/i.test(String((fin && fin.headline) || ""));
}

// The line a finished session shows when it has nothing left to run. Split so
// the page can render the backticked command as code; joined with a space they
// read as one sentence.
export const ALL_DONE_LEAD = "All done, nothing left to run.";
export const ALL_DONE_REST = "To start something else, run `/plan2code` in a new conversation to open the dashboard.";
export const DASHBOARD_COMMAND = "/plan2code";

/**
 * Which hand-off a finish gets: a pause always offers its resume command, a
 * finish with a command offers it as the next step, and one without has
 * nothing left to run.
 */
export function handoffShape(fin) {
  if (finishPaused(fin)) return "paused";
  return String((fin && fin.command) || "").trim() ? "next" : "all-done";
}

/* ------------------------------------------------------------ stopping */

// What a stop request reads as, the way a typed message would. It goes to the
// agent as part of `reply`, so the same caution applies as to the hand-off
// sentence: nothing Pathfinder would read as asking for a brief.
export const STOP_REPLY = "Stop here and save my place, so I can pick this up later.";

// The same request, with a handoff note written first. Same plain voice: the
// reply is read by the agent, and a word like "brief" would send Pathfinder
// off to write one.
export const STOP_HANDOFF_REPLY = "Stop here, save my place and write a handoff, so the dashboard can pick this up later.";

/** The `__stop` action; `handoff: true` only when the handoff choice was pressed. */
export function stopAction({ handoff } = {}) {
  return handoff ? { i: "__stop", type: "stop", handoff: true } : { i: "__stop", type: "stop" };
}

/**
 * Why a session-level button (Stop session, Back to the dashboard) cannot be
 * pressed right now, or null when it can. Both wait for the person's turn:
 * while Plan2Code has the ball it may be halfway through writing their last
 * answers into the files, and a request landing then is how a question ends up
 * half recorded. `waiting` is the caller's "the agent is working or a reply is
 * owed, and it has not gone adrift" -- an agent that has stopped checking in
 * never replies, and a button greyed out forever would lock the person in. An
 * uncollected send still blocks even then, because the server takes one at a
 * time.
 */
export function turnGate({ gone = false, pendingResult = false, waiting = false } = {}) {
  if (gone) return "gone";
  if (pendingResult) return "pending";
  if (waiting) return "waiting";
  return null;
}

// What the top bar's Back to the dashboard button reads as to the agent. It
// goes in `reply` like the stop, so the same caution applies: nothing
// Pathfinder would read as asking for a brief.
export const HOME_REPLY = "Save my place and take me back to the dashboard, right here in this session.";

const HOME_TITLES = {
  gone: "Not connected right now.",
  pending: "Your last answers are still being picked up. You can leave once they have been.",
  waiting: "Plan2Code is working on your answers. You can leave once it replies.",
};

/**
 * The top bar's Back to the dashboard button. Hidden on the dashboard itself,
 * on a finished screen (which carries its own way back) and while a stop is
 * under way; otherwise pressable on the person's turn, like Stop session.
 * Once pressed it waits for the page to turn, unless the agent has gone
 * adrift: then it comes back, and a second press is safe because the server
 * refuses a duplicate while the first is uncollected.
 */
export function homeButtonState({ workflow, finished = false, stopping = false, homeward = false, adrift = false, warned = false, ...turn } = {}) {
  if (!workflow || workflow === "dashboard" || finished || stopping) return { hidden: true, disabled: true, title: "" };
  if (homeward && !adrift) return { hidden: false, disabled: true, title: "Opening the dashboard…" };
  const gate = turnGate(turn);
  return {
    hidden: false,
    disabled: Boolean(gate),
    // With a stop warning up, the work since the last save is what leaving
    // loses: the tooltip says so rather than promising a saved place.
    title: gate ? HOME_TITLES[gate] : warned ? "Back to the dashboard. Work since the last save is not kept." : "Back to the dashboard. Your place is saved first.",
  };
}

/**
 * The resume command the PAGE can offer when the agent cannot: it stopped
 * listening, or went away without posting a finish. Built only from what the
 * session state says, never guessed.
 *
 * Pathfinder resumes from its folder, so it needs `specDir` (`specs/<idea>`),
 * which the workflow posts once the folder exists. Without one the bare
 * command still works: Pathfinder asks which idea. Planning finds its own
 * draft and takes no path. The implementation steps, Revision and
 * Finalization take the spec's overview.md, and without it they ask which
 * spec (or find the only one). A quick task keeps nothing on disk to resume
 * from, so its command starts it again.
 */
export function resumeCommand({ workflow, specDir } = {}) {
  const raw = String(specDir || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  // Only a real relative specs/ path. Anything else would be run verbatim by
  // someone with no way to tell it was wrong.
  const dir = /^specs\/[a-z0-9][a-z0-9._-]*$/i.test(raw) ? raw : "";
  // What follows the command is the entry's `resume` (skills.js). A workflow
  // the console does not know (an old session's) resumes as Pathfinder.
  const entry = skillFor(workflow) || skillFor("pathfinder");
  if (dir && entry.resume === "overview") return `${entry.command} ${dir}/overview.md`;
  if (dir && entry.resume === "folder") return `${entry.command} ${dir}/pathfinder`;
  return entry.command;
}

/* ------------------------------------------------ after a build is done */

// What the two buttons on a finished build's hand-off reach the agent as. They
// go in `reply` like any typed message, so the same caution applies as to the
// other session phrases: plain words, nothing Pathfinder would read as a brief.
export const REVIEW_REPLY =
  "Review what was just built before I go: run the focused code review on this session's changes, here on the page.";
export const DONE_REPLY = "No review, thanks. I am done: close the session.";
export const DASHBOARD_REPLY = "Take me back to the dashboard, right here in this session.";
export const COMMIT_REPLY = "Commit what was just built: open Git's commit flow, right here in this session.";

// Shown under the Back to the dashboard button: the press picks up in the same
// conversation, which carries a long skill's context into the next one.
export const DASHBOARD_NOTE =
  "This picks up in the same conversation. That's fine after a quick or small skill; after a long one, type `/clear` in your terminal and run `/plan2code` for a clean start.";

/**
 * Whether a finish offers the way back to the dashboard. The agent opts in
 * with `finish.dashboard: true`, so a skill that predates the button never
 * shows one nobody answers; a pause never offers it.
 */
export function dashboardOffer(fin) {
  return Boolean(fin && fin.dashboard === true && !finishPaused(fin));
}

/**
 * Whether a finish offers to commit what was just built from this page. The
 * agent opts in with `finish.commit: true` on a build that ended with a git
 * command; the press starts Git's commit flow in the same session, as the dashboard's
 * card does. A pause never offers it.
 */
export function commitOffer(fin) {
  return Boolean(fin && fin.commit === true && !finishPaused(fin));
}

/**
 * Whether a finish carries the offer to review what was just built. The agent
 * posts `finish.review` as `true` or as `{ "label": "..." }` on a finished
 * quick task (an implementation phase offers the review earlier, as a verdict
 * on its sign-off card).
 */
export function reviewOffer(fin) {
  const r = fin && fin.review;
  if (!r) return null;
  const label = typeof r === "object" && typeof r.label === "string" ? r.label.trim() : "";
  return { label: label || "Review what was just built" };
}

/**
 * One offer button on a finish (review, done, commit, dashboard). A press of
 * any of them is the session's one answer, so it locks every button until the
 * finish goes away, not just until the agent collects the send: `asked` is
 * the pressed one, which keeps its "requested…" label.
 */
export function afterFinishButton(afterBuild, kind, pendingResult) {
  return { asked: afterBuild === kind, disabled: Boolean(afterBuild) || Boolean(pendingResult) };
}

/* ------------------------------------------------------- the dashboard */

// The skills the dashboard offers, in the order it offers them. The page owns
// this list rather than the session state: the catalog is product UI, fixed
// for everyone, and the alternative — the agent posting it — would put a dozen
// cards of boilerplate through the patch channel every time the menu opened.
// `menu` in the state can still say what the agent knows: a `recommend` skill
// to highlight and a `details` line per card ("Phase 2 of 4 is next").
//
// `workflow` is the name the skill resumes the session under: the dashboard
// hands its session over, and this is what turns the page into that skill's
// console. A test holds this list against the skills install.js builds, so a
// new skill cannot ship without a card here.
export const CATALOG_GROUPS = [
  { id: "setup", title: "First, the project" },
  { id: "pipeline", title: "The steps, in order" },
  { id: "extra", title: "Useful any time" },
];

// `spec: true` marks the cards that take a spec folder as their target: when
// the picker has a spec selected, its `dir` rides along in the `__launch`
// action so the launched skill knows which spec it was picked for. Derived from
// skills.js: the entries with a card, in their order, each card's fields
// beside the skill's name, command and workflow.
export const SKILL_CATALOG = SKILLS.filter((s) => s.card).map((s) => ({
  skill: s.skill,
  command: s.command,
  workflow: s.workflow,
  ...(s.review ? { review: s.review } : {}),
  ...s.card,
}));

// A workflow by the name its dashboard card gives it ("Implement"), for the
// screens that speak of it as a thing being started rather than as a badge.
export function workflowTitle(workflow) {
  const entry = SKILL_CATALOG.find((e) => e.workflow === workflow);
  return entry ? entry.title : workflowLabel(workflow);
}

// Every skill gets its own Planny on the starting and waiting screens, drawn
// as a <template data-pose> in index.html. A skill that is a variant of
// another borrows its pose. Anything else (the dashboard) keeps the flight.
// Derived from skills.js: every pose an entry names, once.
export const START_POSES = [...new Set(SKILLS.map((s) => s.pose).filter(Boolean))];

export function startPose(workflow) {
  return skillFor(workflow)?.pose || null;
}

export function catalogEntry(skill) {
  const entry = skillByName(skill);
  if (!entry) return null;
  // A skill with no card of its own is launched from another's (Implement +
  // Review from Implement's Review box).
  const owner = entry.card ? entry : SKILLS.find((s) => s.review === entry.skill);
  return owner ? SKILL_CATALOG.find((e) => e.skill === owner.skill) : null;
}

/**
 * What a card launches: the card itself, or, when it has a Review box and the
 * box is ticked, the review skill's entry under the card's title.
 */
export function launchVariant(entry, withReview) {
  const alt = withReview && entry.review ? skillByName(entry.review) : null;
  return alt ? { ...entry, skill: alt.skill, workflow: alt.workflow, command: alt.command, title: alt.name } : entry;
}

/* ------------------------------------------- dashboard card availability */

// What the picker shows next to a spec's name — the pipeline position the
// server's scan worked out, in plain words. Derived from spec-states.js.
export const SPEC_STATE_LABELS = Object.fromEntries(Object.entries(SPEC_STATES).map(([name, s]) => [name, s.label]));

// The card each spec state exists to light up. Used as the fallback for the
// "Suggested" pill when the agent's menu payload names nothing. Derived from
// spec-states.js: the states that have one.
const NEXT_FOR_STATE = Object.fromEntries(
  Object.entries(SPEC_STATES)
    .filter(([, s]) => s.next)
    .map(([name, s]) => [name, s.next])
);

const ON = { on: true };
export const GIT_INIT_NOTE = "Not a git repository yet: it offers to start one";
export const pendingNote = (n) => `${n} file${n === 1 ? "" : "s"} to commit`;
const off = (reason) => ({ on: false, reason });
// Pathfinder's and Plan's reason on a fixed bug, kept on skills.js.
export { FIXED_REASON };

/**
 * The spec the picker opens on: the most recently touched one that is still
 * in play. A finished spec (a fixed bug) is never the default; with nothing
 * else on disk the picker opens on "start from scratch" (null). `lookup` is
 * stateFor unless a test hands in its own table.
 */
export function defaultSpec(specs, lookup = stateFor) {
  return (Array.isArray(specs) ? specs : []).find((s) => s && !lookup(s.state)?.finished) || null;
}

/**
 * The reassurance under "Starting up": a calm line at first, a pointer to the
 * terminal once the start has taken longer than ninety seconds.
 */
export function startingHint(elapsedMs) {
  return elapsedMs > 90000
    ? "Still getting ready. Your terminal has the play-by-play if you want to watch it there."
    : "This page fills in by itself the moment Plan2Code has something for you. No need to touch anything.";
}

/**
 * Whether the picker still shows the spec it opened on: `picked` is the
 * selected spec (or null for "start from scratch"), `first` the default one.
 * The agent's menu note describes that spec only, so another pick gets the
 * neutral line.
 */
export function onInitialPick(first, picked) {
  return first ? Boolean(picked && picked.dir === first.dir) : !picked;
}

/**
 * Which line the dashboard shows under its title: "agent" (the note the agent
 * posted), "looking" (the agent has not posted its menu yet and is working)
 * or "neutral".
 */
export function dashNoteKind({ menu, hasMenu, onInitial, working }) {
  if (menu && typeof menu.note === "string" && menu.note.trim() && onInitial) return "agent";
  if (!hasMenu && working) return "looking";
  return "neutral";
}

/**
 * Whether a catalog card is clickable for the current picker selection.
 *
 * `scan` is the server's project scan ({ hasAgents, isGit, pending, specs }); `sel` is the
 * picked spec object or null for "start from scratch". A spec whose files
 * match no pipeline shape ("unrecognized") behaves like no spec at all for
 * availability — but its folder still goes along on a Pathfinder or Plan
 * launch, since the files may be reference docs.
 *
 * Returns { on, reason?, note?, next? } — `reason` is the one line a greyed card
 * shows, `note` the one line a clickable card shows when there is something to
 * know before launching it, `next` marks the state's natural step. `lookup` is
 * stateFor unless a test hands in its own table.
 */
export function cardAvailability(entry, scan, sel, lookup = stateFor) {
  const hasAgents = Boolean(scan && scan.hasAgents);
  const state = sel && sel.state && sel.state !== "unrecognized" ? sel.state : null;
  const next = sel ? Boolean(state) && NEXT_FOR_STATE[state] === entry.skill : entry.skill === "plan2code-0-pathfinder";
  const rule = skillByName(entry.skill);
  if (!rule || !rule.states) return ON;

  // The three cards whose rules read the scan rather than the spec.
  if (entry.skill === "plan2code-init") return hasAgents ? off(rule.greyed.default) : ON;
  if (entry.skill === "plan2code-init-update") return hasAgents ? ON : off(rule.greyed.default);
  if (entry.skill === "plan2code-git") {
    // Never greyed: a clean tree still has branches to switch, pull and push.
    if (scan && scan.isGit === false) return { on: true, note: GIT_INIT_NOTE };
    if (scan && Number.isInteger(scan.pending) && scan.pending > 0) return { on: true, note: pendingNote(scan.pending) };
    return ON;
  }

  // Always on; a diagnosed bug is the one spec Quick Task is the next step for.
  if (rule.states === "any") return next ? { ...ON, next } : ON;
  // A state the table does not know is treated like files on disk.
  const taken = !sel || !sel.state ? "none" : lookup(sel.state) ? sel.state : "unrecognized";
  if (rule.states.includes(taken)) return rule.marksNext ? { ...ON, next } : ON;
  return off(rule.greyed[taken] || (lookup(taken)?.finished && rule.greyed.finished) || rule.greyed.default);
}

/**
 * The spec a card's launch carries: the picker's selection for the cards that
 * take a spec, and for Quick Task only a diagnosed bug, whose write-up it reads
 * first. Every other card launches untargeted.
 */
export function launchTarget(entry, sel) {
  if (!entry || !sel) return null;
  if (entry.spec) return sel;
  return entry.skill === "plan2code-quick-task" && sel.state === "diagnosed" ? sel : null;
}

export function cardPresentation(entry, scan, sel, menu = {}) {
  const availability = cardAvailability(entry, scan, sel);
  const first = defaultSpec(scan && scan.specs);
  const initial = first ? Boolean(sel && sel.dir === first.dir) : !sel;
  const requested = initial && typeof menu.recommend === "string" ? catalogEntry(menu.recommend) : null;
  const recommendation = requested && cardAvailability(requested, scan, sel).on ? requested.skill : null;
  const recommended = availability.on && (recommendation ? entry.skill === recommendation : availability.next);
  const supplied = initial && menu.details && typeof menu.details[entry.skill] === "string" ? menu.details[entry.skill] : "";
  const detail =
    availability.on && supplied
      ? supplied
      : availability.on && availability.note
        ? availability.note
        : !initial && availability.next && sel && sel.detail
          ? sel.detail
          : "";
  return { ...availability, recommended, detail };
}

/**
 * What a card click reaches the agent as, in `reply`. The action itself
 * carries `skill`, which is what the dashboard parses; this line is the
 * human-readable record of the ask. Like the other session phrases it keeps
 * clear of "brief", "recap" and "minutes", which Pathfinder would read as a
 * brief request.
 */
export function launchReply(entry, spec) {
  const target = spec && spec.dir ? ` for ${spec.dir}` : "";
  return `Start ${entry.title} (${entry.command})${target}, right here in this session.`;
}

/**
 * Deleting a spec from the picker. The page only names the folder; the agent
 * deletes it (`console.mjs delete-spec`, which runs scan.mjs's removeSpec() on
 * this same rule), because the console never writes into a project. A
 * deletable dir is exactly `specs/<one name>`: no deeper path, no `.` or `..`,
 * no dotfolder, no backslash, never specs--completed/.
 */
export function isDeletableSpecDir(dir) {
  return typeof dir === "string" && /^specs\/[^/\\]+$/.test(dir) && !/^specs\/\./.test(dir);
}

export function deleteAction(spec) {
  return { i: "__delete", type: "delete", spec: spec.dir };
}

export function deleteReply(spec) {
  return `Delete the spec folder ${spec.dir}/ for good, right here in this session.`;
}

// What the delete dialog says about the spec, from the scan alone. `touched`
// stays a number: the page formats it in the person's own locale.
// A handoff on the dashboard (scan.handoffs). The page sends only the id; the
// CLI reads the rest from the stored metadata. Plain wording, no em dashes:
// these lines are read by the agent.
export function pickupAction(h) {
  return { i: "__pickup", type: "pickup", handoff: h.id };
}
export function pickupReply(h) {
  return `Pick up the handoff "${h.title}" right here in this session.`;
}
export function deleteHandoffAction(h) {
  return { i: "__delete", type: "delete", handoff: h.id };
}
export function deleteHandoffReply(h) {
  return `Delete the handoff "${h.title}" for good, right here in this session.`;
}
export function handoffCopyText(file) {
  return `Read the handoff at ${file} and carry on with its Next task.`;
}
/** "just now", "12 min ago", "6 h ago", "3 days ago" for an ISO time. */
export function handoffAge(written, now = Date.now()) {
  const t = Date.parse(written);
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// The line under a spec's name on its chip. A finished spec's label already
// says it ("Bug fixed"), so the scan's "bug fixed" detail would only repeat it.
export function chipDetail(spec) {
  return stateFor(spec.state)?.finished ? "" : spec.detail || "";
}

export function deleteSummary(spec) {
  const label = SPEC_STATE_LABELS[spec.state] || spec.state || "";
  const detail = chipDetail(spec);
  const n = spec.files;
  return {
    folder: `${spec.dir}/`,
    stage: detail ? `${label}: ${detail}` : label,
    files: Number.isInteger(n) ? `${n} file${n === 1 ? "" : "s"}` : "",
    touched: Number.isFinite(spec.touched) && spec.touched > 0 ? spec.touched : null,
  };
}

export function staleLaunchFeedback(title, adrift) {
  if (!adrift) return null;
  return {
    kicker: "Saved",
    title: `${title || "Your workflow"} is saved and waiting`,
    quip: "Plan2Code is not running right now.",
    hint: "Return to the terminal and send any message. Plan2Code will collect this launch and continue here.",
  };
}

/* ------------------------------------------------------------ progress */

// The label must never read "7 of 5", whatever the agent posted: a build that
// grew tasks mid-phase can post a `cleared` past its `total`. Guarded here on
// the page only; the server takes the numbers as sent.
export function progressTotal(cleared, total) {
  return Math.max(Number(cleared) || 0, Number(total) || 0);
}

/* --------------------------------------------------------- attachments */

// Attachments on a note or a quick question: at most five, images and
// documents together. Images are re-encoded in the browser to a JPEG whose
// long edge fits IMAGE_LONG_EDGE, with a small data: URL copy for the tray.
// Documents upload byte for byte, and the server checks their contents itself.
export const MAX_ATTACHMENTS = 5;
export const MAX_NOTE_IMAGES = MAX_ATTACHMENTS;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

// The documents an agent can read with its own file tool, keyed by lower-case
// extension. A hard-coded list, like the server's TYPES: it is the picker's
// `accept`, the server's allow-list and the chip's label, so they can never
// disagree.
const textDoc = (label) => Object.freeze({ kind: "text", label });
export const DOC_TYPES = Object.freeze({
  md: textDoc("Markdown"),
  txt: textDoc("Text"),
  json: textDoc("JSON"),
  yaml: textDoc("YAML"),
  yml: textDoc("YAML"),
  toml: textDoc("TOML"),
  ini: textDoc("INI"),
  csv: textDoc("CSV"),
  tsv: textDoc("TSV"),
  log: textDoc("Log"),
  xml: textDoc("XML"),
  html: textDoc("HTML"),
  css: textDoc("CSS"),
  scss: textDoc("SCSS"),
  js: textDoc("JavaScript"),
  mjs: textDoc("JavaScript"),
  cjs: textDoc("JavaScript"),
  ts: textDoc("TypeScript"),
  tsx: textDoc("TypeScript"),
  jsx: textDoc("JavaScript"),
  py: textDoc("Python"),
  java: textDoc("Java"),
  cs: textDoc("C#"),
  go: textDoc("Go"),
  rs: textDoc("Rust"),
  rb: textDoc("Ruby"),
  php: textDoc("PHP"),
  sh: textDoc("Shell"),
  ps1: textDoc("PowerShell"),
  sql: textDoc("SQL"),
  pdf: Object.freeze({ kind: "pdf", label: "PDF" }),
});

// A file name's document extension, or null. A name whose only dot leads it
// (`.env`, `.gitignore`) has no extension: dotfiles are where secrets live.
export function docExt(name) {
  const s = String(name || "");
  const dot = s.lastIndexOf(".");
  if (dot <= 0 || dot === s.length - 1) return null;
  const ext = s.slice(dot + 1).toLowerCase();
  return Object.prototype.hasOwnProperty.call(DOC_TYPES, ext) ? ext : null;
}

// The file picker's `accept`: any image, plus every document extension.
export function pickerAccept() {
  return "image/*," + Object.keys(DOC_TYPES).map((ext) => "." + ext).join(",");
}

export function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: mb ? "megabyte" : "kilobyte",
    maximumFractionDigits: mb ? 1 : 0,
  }).format(mb ? bytes / (1024 * 1024) : bytes / 1024);
}

// An entry saved before documents existed has no `kind`: it is an image.
export function attachmentKind(entry) {
  return entry && entry.kind === "file" ? "file" : "image";
}

// Files the person picked, pasted or dropped, sorted by what they will be.
// The extension decides first: browsers report `""` for `.md` and
// `video/mp2t` for `.ts`, so `type` only settles what has no document
// extension. Each list keeps the order given.
export function sortAttachments(files) {
  const images = [];
  const docs = [];
  const refused = [];
  for (const file of files || []) {
    if (docExt(file.name)) {
      if (file.size > MAX_DOC_BYTES) refused.push({ name: file.name, reason: "too-large" });
      else docs.push(file);
    } else if (typeof file.type === "string" && file.type.startsWith("image/")) images.push(file);
    else refused.push({ name: file.name, reason: "type" });
  }
  return { images, docs, refused };
}

export const IMAGE_LONG_EDGE = 2000;
export const IMAGE_QUALITY = 0.85;
export const THUMB_EDGE = 160;

// Scaled so the longer side is at most `max`, aspect kept, never upscaled.
export function fitWithin(w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

// A note's action, its attachments split into `images` and `files`. Only
// `path` and `name` go: the page's own bookkeeping (`id`, `url`, `status`) is
// nothing the agent can use. A key with nothing in it is left out.
export function noteAction(id, text, attachments) {
  const action = { i: id, type: "comment", text };
  const list = attachments || [];
  const pick = (kind) => list.filter((a) => attachmentKind(a) === kind).map(({ path, name }) => ({ path, name }));
  const images = pick("image");
  const files = pick("file");
  if (images.length) action.images = images;
  if (files.length) action.files = files;
  return action;
}

// Typed text past its first line, indented, so only a real entry ever starts a
// reply line: a typed "Idea name: foo" or "  Image: C:\x" must not read as an
// answer or an attachment. Chat's lines already do this.
export function indentReply(text, pad = "  ") {
  return String(text).replace(/\r?\n/g, "\n" + pad);
}

// A note as `reply` lines, one indented `Image:` or `File:` line per
// attachment in the order attached, so the agent can open each path with its
// file-read tool. An image-only note reads exactly as it always did.
export function noteReplyLines(title, text, attachments) {
  const list = attachments || [];
  const anyFile = list.some((a) => attachmentKind(a) === "file");
  const said = text || (list.length ? (anyFile ? "(attachments only)" : "(images only)") : "");
  return [
    `Note on ${title}: ${indentReply(said)}`,
    ...list.map((a) => `  ${attachmentKind(a) === "file" ? "File" : "Image"}: ${a.path} (${a.name})`),
  ];
}

/* ------------------------------------------------------------ patience */

/**
 * How long the agent may go quiet before the page calls it stuck.
 *
 * Every workflow before the build steps was a conversation: the agent was
 * either thinking about a reply or sitting in `wait`, so two or three minutes
 * of silence really did mean something had gone wrong. A build is different.
 * One task can take twenty minutes of honest work with nothing to post, and a
 * page that said "has not checked in, look at your terminal" every time would
 * be crying wolf. So the agent says how long quiet is normal right now
 * (`agent.quietMinutes`), and it counts only while the agent is `working`: a
 * waiting agent is polling, and a silent poller is still a stuck one. Never
 * below the page's own threshold, and capped at an hour so a typo cannot hide
 * a dead session.
 */
export function quietLimitMs(agent, baseMs) {
  if (!agent || agent.status !== "working") return baseMs;
  const m = Number(agent.quietMinutes);
  if (!Number.isFinite(m) || m <= 0) return baseMs;
  return Math.max(baseMs, Math.min(m, 60) * 60 * 1000);
}

/* ---------------------------------------------------------- skip moves on */

// "Skip this one" moves the person on by itself. `staged` and `sent` are maps
// keyed by item id: a card staged or already sent no longer needs them.
const needsPerson = (id, staged, sent) => !(staged && staged[id]) && !(sent && sent[id]);

/** True when no open card other than `currentId` still needs the person. */
export function lastOpenCard(openIds, staged, sent, currentId) {
  return openIds.every((id) => id === currentId || !needsPerson(id, staged, sent));
}

/**
 * The next open card after `currentId` that still needs the person, wrapping
 * to the start; null when there is none.
 */
export function nextOpenAfter(openIds, staged, sent, currentId) {
  const at = openIds.indexOf(currentId);
  for (let step = 1; step <= openIds.length; step++) {
    const id = openIds[(at + step) % openIds.length];
    if (id !== currentId && needsPerson(id, staged, sent)) return id;
  }
  return null;
}

/* ------------------------------------------------------------ approvals */

// The page cannot see a harness's permission prompt, so it nudges instead: a
// quiet tip line where a session starts, and a soft line beside Planny once a
// working agent has gone quiet for a while. Mode names verified 2026-09-23.
export const APPROVAL_TIP =
  "Your agent may pause for approvals in the terminal. A hands-off mode (e.g. `auto` mode in Claude Code, `smart` mode in Devin) can help avoid that, but additional attention may still be required.";
export const APPROVAL_HINT = "Still working, or waiting on an approval in your terminal?";
export const APPROVAL_HINT_MS = 30_000;
// When a working agent's silence turns into "has not checked in".
export const STALE_MS = 2 * 60 * 1000;

// The soft line, shown before the stale message takes over. It sits at a fixed
// share of the stale limit (30 s of 2 min) rather than stretching on its own:
// stretched separately, a build's quietMinutes lifted both to the same moment
// and the soft line never showed where approvals stall most.
export function approvalHint(agent, quietMs) {
  if (!agent || agent.status !== "working") return "";
  const at = quietLimitMs(agent, STALE_MS) * (APPROVAL_HINT_MS / STALE_MS);
  return quietMs >= at ? APPROVAL_HINT : "";
}
