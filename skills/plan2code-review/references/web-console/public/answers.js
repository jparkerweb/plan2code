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

export function optionLabel(item, k) {
  const o = ((item && item.options) || []).find((x) => x.k === k);
  if (!o) return String(k);
  return o.k ? `${o.k} · ${o.text}` : o.text;
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
// flashing a placeholder until the script arrives.
export const WORKFLOW_LABEL = {
  dashboard: "Dashboard",
  init: "Setting up",
  "init-update": "Refreshing",
  pathfinder: "Pathfinder",
  plan: "Planning",
  "revise-plan": "Revising the plan",
  document: "Documenting",
  implement: "Building",
  "implement-review": "Building + review",
  review: "Review",
  "quick-task": "Quick task",
  finalize: "Wrapping up",
  handoff: "Handoff",
};

export function workflowLabel(workflow) {
  return WORKFLOW_LABEL[workflow] || workflow || "Session";
}

// The workflows that ship the console (install.js bundles it into every
// skill as `additionalReferences`). Any other next step has no browser page
// to open, and asking for one would send the next session looking for
// something that is not there.
export const CONSOLE_WORKFLOWS = [
  "/plan2code",
  "/plan2code-init",
  "/plan2code-init-update",
  "/plan2code-0-pathfinder",
  "/plan2code-quick-task",
  "/plan2code-1-plan",
  "/plan2code-1b-revise-plan",
  "/plan2code-2-document",
  "/plan2code-3-implement",
  "/plan2code-3-implement-review",
  "/plan2code-review",
  "/plan2code-4-finalize",
  "/plan2code-handoff",
];

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
export function homeButtonState({ workflow, finished = false, stopping = false, homeward = false, adrift = false, ...turn } = {}) {
  if (!workflow || workflow === "dashboard" || finished || stopping) return { hidden: true, disabled: true, title: "" };
  if (homeward && !adrift) return { hidden: false, disabled: true, title: "Opening the dashboard…" };
  const gate = turnGate(turn);
  return {
    hidden: false,
    disabled: Boolean(gate),
    title: gate ? HOME_TITLES[gate] : "Back to the dashboard. Your place is saved first.",
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
  const withOverview = (cmd) => (dir ? `${cmd} ${dir}/overview.md` : cmd);
  switch (workflow) {
    case "dashboard":
      return "/plan2code";
    case "init":
      return "/plan2code-init";
    case "init-update":
      return "/plan2code-init-update";
    case "plan":
      return "/plan2code-1-plan";
    case "quick-task":
      return "/plan2code-quick-task";
    case "document":
      return withOverview("/plan2code-2-document");
    case "implement":
      return withOverview("/plan2code-3-implement");
    case "implement-review":
      return withOverview("/plan2code-3-implement-review");
    case "review":
      return "/plan2code-review";
    case "revise-plan":
      return withOverview("/plan2code-1b-revise-plan");
    case "finalize":
      return withOverview("/plan2code-4-finalize");
    case "handoff":
      return "/plan2code-handoff";
    default:
      return dir ? `/plan2code-0-pathfinder ${dir}/pathfinder` : "/plan2code-0-pathfinder";
  }
}

/* ------------------------------------------------ after a build is done */

// What the two buttons on a finished build's hand-off reach the agent as. They
// go in `reply` like any typed message, so the same caution applies as to the
// other session phrases: plain words, nothing Pathfinder would read as a brief.
export const REVIEW_REPLY =
  "Review what was just built before I go: run the focused code review on this session's changes, here on the page.";
export const DONE_REPLY = "No review, thanks. I am done: close the session.";
export const DASHBOARD_REPLY = "Take me back to the dashboard, right here in this session.";

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
// action so the launched skill knows which spec it was picked for.
export const SKILL_CATALOG = [
  {
    skill: "plan2code-init",
    command: "/plan2code-init",
    workflow: "init",
    group: "setup",
    chip: "Set up",
    title: "Set up this project",
    blurb: "Reads your project and writes AGENTS.md, the guide every later step works from.",
    about:
      "Plan2Code reads the whole project: how it is organized, how it runs, and where the sharp edges are. Then it writes AGENTS.md, the guide every later step steers by. It asks a few questions as it goes, so nothing important gets guessed. Run this once per project, or again when the project has moved on.",
  },
  {
    skill: "plan2code-init-update",
    command: "/plan2code-init-update",
    workflow: "init-update",
    group: "setup",
    chip: "Set up",
    title: "Refresh AGENTS.md",
    blurb: "Brings AGENTS.md and its notes up to date with what the project has learned lately.",
    about:
      "The project moved on since AGENTS.md was written: new commands, new habits, new gotchas. This re-reads the project, asks what changed, and folds it into AGENTS.md and the notes beside it. Cheaper than a fresh setup, and whatever is still right is kept.",
  },
  {
    skill: "plan2code-0-pathfinder",
    command: "/plan2code-0-pathfinder",
    workflow: "pathfinder",
    group: "pipeline",
    chip: "Step 0",
    spec: true,
    title: "Pathfinder",
    blurb: "A foggy idea becomes a clear list of decisions, settled one question at a time.",
    about:
      "You have a rough idea and a lot of unknowns. Pathfinder asks one question at a time: who it is for, what it must do, what could go wrong. Each answer is written down in a spec folder. It ends with a list of decisions clear enough to plan from, and nothing gets built yet.",
  },
  {
    skill: "plan2code-1-plan",
    command: "/plan2code-1-plan",
    workflow: "plan",
    group: "pipeline",
    chip: "Step 1",
    spec: true,
    title: "Plan",
    blurb: "Requirements, technical design and your approval: the shape of what gets built.",
    about:
      "Turns what you bring into a real plan: a finished Pathfinder map, a folder of design notes, or just the idea in your head. You get requirements, a technical design, a phase-by-phase breakdown, and a final version to approve before anything is built. This is where 'what are we building' becomes 'how it gets built'.",
  },
  {
    skill: "plan2code-1b-revise-plan",
    command: "/plan2code-1b-revise-plan",
    workflow: "revise-plan",
    group: "pipeline",
    chip: "Step 1b",
    spec: true,
    title: "Revise the plan",
    blurb: "Requirements changed mid-build? Adjust the plan without starting over.",
    about:
      "Requirements moved mid-build: a feature added, a rule dropped, a deadline pulled in. This adjusts the existing spec for the change, shows you what it affects, and only rewrites what actually has to move. The approved plan stays the plan.",
  },
  {
    skill: "plan2code-2-document",
    command: "/plan2code-2-document",
    workflow: "document",
    group: "pipeline",
    chip: "Step 2",
    spec: true,
    title: "Document",
    blurb: "The plan becomes a checklist of small tasks, grouped into phases, that a developer can just do.",
    about:
      "Writes the plan as numbered phase files. Each phase is a checklist of tasks small enough to just do, with the details a builder needs right there. This is the file the build step works from, and the thing a later session can pick up cold.",
  },
  {
    skill: "plan2code-3-implement",
    command: "/plan2code-3-implement",
    workflow: "implement",
    group: "pipeline",
    chip: "Step 3",
    spec: true,
    title: "Implement",
    blurb: "Builds the next phase, task by task, with a report and your sign-off at the end.",
    about:
      "Builds the next phase of the spec. Tasks get checked off one by one, with progress and the occasional decision landing on this page as it goes. It ends with a report of what was built and a sign-off card you approve before the phase counts as done.",
  },
  {
    skill: "plan2code-3-implement-review",
    command: "/plan2code-3-implement-review",
    workflow: "implement-review",
    group: "pipeline",
    chip: "Step 3",
    spec: true,
    title: "Implement + review",
    blurb: "One phase built, then a careful review of the changes, then your sign-off. All in one run.",
    about:
      "The same build as Implement, with a review folded in before sign-off. The phase is built, then a fresh pass hunts for problems in exactly what changed, you pick what gets fixed, and only then does the sign-off card arrive.",
  },
  {
    skill: "plan2code-4-finalize",
    command: "/plan2code-4-finalize",
    workflow: "finalize",
    group: "pipeline",
    chip: "Step 4",
    spec: true,
    title: "Finalize",
    blurb: "Checks the work, writes the summary, files the specs away and suggests the commit message.",
    about:
      "The closer. Checks every task against the spec, makes sure the build actually works, writes the summary into overview.md, updates the project docs, and suggests the commit message. Run it when the feature is done. It leaves the project tidy behind it.",
  },
  {
    skill: "plan2code-quick-task",
    command: "/plan2code-quick-task",
    workflow: "quick-task",
    group: "extra",
    chip: "Utility",
    title: "Quick task",
    blurb: "Too small for the full process? A quick plan, then it just builds it.",
    about:
      "A fix, a tweak, a small feature. Not worth a spec folder. Describe it, confirm the one-line plan, and it builds it right there, with a report at the end. The fast lane for work the full process would over-plan.",
  },
  {
    skill: "plan2code-review",
    command: "/plan2code-review",
    workflow: "review",
    group: "extra",
    chip: "Utility",
    title: "Review",
    blurb: "A second opinion on the changes. Problems ranked, and you pick what gets fixed.",
    about:
      "A fresh-eyes pass over what changed: bugs, gaps, and the things the builder was too close to see. Problems come back ranked with a suggestion each, you pick which ones get fixed, and it fixes them.",
  },
  {
    skill: "plan2code-handoff",
    command: "/plan2code-handoff",
    workflow: "handoff",
    group: "extra",
    chip: "Utility",
    title: "Handoff",
    blurb: "Pack this conversation into a document a fresh session can pick up cold.",
    about:
      "Writes down everything a new session would need, as a single document: what was decided, what is done, what is left. Use it when a conversation got long, a machine changed, or tomorrow-you deserves the context today-you has.",
  },
];

// A workflow by the name its dashboard card gives it ("Implement"), for the
// screens that speak of it as a thing being started rather than as a badge.
export function workflowTitle(workflow) {
  const entry = SKILL_CATALOG.find((e) => e.workflow === workflow);
  return entry ? entry.title : workflowLabel(workflow);
}

// Every skill gets its own Planny on the starting and waiting screens, drawn
// as a <template data-pose> in index.html. A skill that is a variant of
// another borrows its pose. Anything else (the dashboard) keeps the flight.
export const START_POSES = [
  "init",
  "pathfinder",
  "plan",
  "document",
  "implement",
  "finalize",
  "quick-task",
  "review",
  "handoff",
];

const POSE_ALIASES = { "init-update": "init", "revise-plan": "plan", "implement-review": "implement" };

export function startPose(workflow) {
  const pose = POSE_ALIASES[workflow] || workflow;
  return START_POSES.includes(pose) ? pose : null;
}

export function catalogEntry(skill) {
  return SKILL_CATALOG.find((e) => e.skill === skill) || null;
}

/* ------------------------------------------- dashboard card availability */

// What the picker shows next to a spec's name — the pipeline position the
// server's scan worked out, in plain words.
export const SPEC_STATE_LABELS = {
  exploring: "Exploring",
  mapped: "Ready to plan",
  planned: "Ready to document",
  documented: "Ready to build",
  building: "Building",
  built: "Ready to finalize",
  unrecognized: "Files on disk",
};

// The card each spec state exists to light up. Used as the fallback for the
// "Suggested" pill when the agent's menu payload names nothing.
const NEXT_FOR_STATE = {
  exploring: "plan2code-0-pathfinder",
  mapped: "plan2code-1-plan",
  planned: "plan2code-2-document",
  documented: "plan2code-3-implement",
  building: "plan2code-3-implement",
  built: "plan2code-4-finalize",
};

const ON = { on: true };
const off = (reason) => ({ on: false, reason });

/**
 * Whether a catalog card is clickable for the current picker selection.
 *
 * `scan` is the server's project scan ({ hasAgents, specs }); `sel` is the
 * picked spec object or null for "start from scratch". A spec whose files
 * match no pipeline shape ("unrecognized") behaves like no spec at all for
 * availability — but its folder still goes along on a Pathfinder or Plan
 * launch, since the files may be reference docs.
 *
 * Returns { on, reason?, next? } — `reason` is the one line a greyed card
 * shows, `next` marks the state's natural step.
 */
export function cardAvailability(entry, scan, sel) {
  const hasAgents = Boolean(scan && scan.hasAgents);
  const state = sel && sel.state && sel.state !== "unrecognized" ? sel.state : null;
  const next = sel ? Boolean(state) && NEXT_FOR_STATE[state] === entry.skill : entry.skill === "plan2code-0-pathfinder";

  switch (entry.skill) {
    case "plan2code-init":
      return hasAgents ? off("AGENTS.md is already written. Refresh it instead.") : ON;
    case "plan2code-init-update":
      return hasAgents ? ON : off("Needs an AGENTS.md. Set the project up first.");
    case "plan2code-quick-task":
    case "plan2code-review":
    case "plan2code-handoff":
      return ON;
    case "plan2code-0-pathfinder":
      if (!state || state === "exploring") return { ...ON, next };
      return off("This spec is already past the questions");
    case "plan2code-1-plan":
      if (state === "exploring") return off("Pathfinder is not finished with this spec yet");
      if (state === "documented" || state === "building" || state === "built")
        return off("The plan is written. Revise it instead if it moved.");
      return { ...ON, next };
    case "plan2code-1b-revise-plan":
      if (state === "documented" || state === "building") return ON;
      return off(state === "built" ? "The spec is fully built" : "Needs a spec that is already written up");
    case "plan2code-2-document":
      if (state === "planned") return { ...ON, next };
      if (state === "documented" || state === "building" || state === "built")
        return off("The phases are already written up");
      return off("Needs a drafted plan first");
    case "plan2code-3-implement":
    case "plan2code-3-implement-review":
      if (state === "documented" || state === "building") return { ...ON, next };
      return off(state === "built" ? "All tasks are already done" : "Needs the phase checklists written up first");
    case "plan2code-4-finalize":
      if (state === "built") return { ...ON, next };
      return off("Needs a spec that is fully built");
    default:
      return ON;
  }
}

export function cardPresentation(entry, scan, sel, menu = {}) {
  const availability = cardAvailability(entry, scan, sel);
  const specs = scan && Array.isArray(scan.specs) ? scan.specs : [];
  const initial = specs.length ? Boolean(sel && sel.dir === specs[0].dir) : !sel;
  const requested = initial && typeof menu.recommend === "string" ? catalogEntry(menu.recommend) : null;
  const recommendation = requested && cardAvailability(requested, scan, sel).on ? requested.skill : null;
  const recommended = availability.on && (recommendation ? entry.skill === recommendation : availability.next);
  const supplied = initial && menu.details && typeof menu.details[entry.skill] === "string" ? menu.details[entry.skill] : "";
  const detail = availability.on && supplied ? supplied : !initial && availability.next && sel && sel.detail ? sel.detail : "";
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

// A note as `reply` lines, one indented `Image:` or `File:` line per
// attachment in the order attached, so the agent can open each path with its
// file-read tool. An image-only note reads exactly as it always did.
export function noteReplyLines(title, text, attachments) {
  const list = attachments || [];
  const anyFile = list.some((a) => attachmentKind(a) === "file");
  const said = text || (list.length ? (anyFile ? "(attachments only)" : "(images only)") : "");
  return [
    `Note on ${title}: ${said}`,
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
