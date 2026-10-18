// Plan2Code Web Console - how a session ends: the finished screen, its offers, Stop and the way home; defines only.

import { el, md, copyButton, textWithCode, SVG_NS } from "../render.js";
import {
  finishPaused,
  reviewOffer,
  commitOffer,
  handoffShape,
  ALL_DONE_LEAD,
  ALL_DONE_REST,
  handoffText,
  DASHBOARD_COMMAND,
  resumeCommand,
  afterFinishButton,
  DASHBOARD_NOTE,
  turnGate,
  homeButtonState,
  HOME_REPLY,
  stopAction,
  STOP_HANDOFF_REPLY,
  STOP_REPLY,
  REVIEW_REPLY,
  DONE_REPLY,
  DASHBOARD_REPLY,
  COMMIT_REPLY,
} from "../answers.js";
import { hooks, page, saveNow, redraw } from "../state.js";

const $ = (id) => document.getElementById(id);
import {
  dashboardLive,
  reviewPending,
  docs,
  finish,
  agentAdrift,
  agentWorking,
  awaitingReply,
  isDashboard,
} from "../selectors.js";
import { docSavedNote, downloadDoc } from "../doc-files.js";
import { pendingNotes } from "../uploads.js";

// The end of the session, and the only screen in this page whose job is to
// send someone somewhere else.
//
// It reads in three beats, because that is the order the questions arrive in:
// what just happened, the one thing to run, and where to run it. The command
// is the whole point, so its Copy button is always on show -- the one on a
// fenced code block only appears on hover, which is right for a sample buried
// in prose and useless for the single action a screen exists to offer. A
// finish with nothing left to run skips the last two beats: it gets a quiet
// pointer at the dashboard instead of a Next step block.
// "Before you close this": the three things someone looking at a finished
// screen wonders. Every finish shape gets it; a pause says where the place is
// kept, and a session with nothing left to run points at the dashboard alone.
const GUIDE_ICONS = {
  safe: ["M5 12.5 10 17.5 19 7"],
  fresh: ["M19.5 12a7.5 7.5 0 1 1-2.4-5.5", "M19.5 4v4.5H15"],
  carry: ["M5 12h13", "M13 6.5 18.5 12 13 17.5"],
};

function guideIcon(kind) {
  const wrap = el("span", `handoff-guide-icon is-${kind}`);
  wrap.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  for (const d of GUIDE_ICONS[kind]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  wrap.appendChild(svg);
  return wrap;
}

function renderCloseGuide(shape, fin = {}) {
  // A command that is not a skill (a finish's git commit) runs in a terminal,
  // not "in the new session".
  const shell = typeof fin.command === "string" && Boolean(fin.command.trim()) && !fin.command.trim().startsWith("/");
  const panel = el("section", "handoff-guide");
  panel.setAttribute("aria-labelledby", "handoff-guide-title");
  const title = el("h3", "handoff-guide-title", "Before you close this");
  title.id = "handoff-guide-title";
  panel.appendChild(title);
  const rows = [
    ["safe", "Safe to close", "This tab is only a window: whatever this session wrote is on disk, and nothing here needs you."],
    [
      "fresh",
      "Start fresh",
      shape === "paused"
        ? stopWarning()
          ? "Restart your agent window, or close the old session and start a new one. The command above starts it again."
          : "Restart your agent window, or close the old session and start a new one. Your saved place is picked up by the resume command above."
        : "Restart your agent window, or close the old session and start a new one. A new session starts from clean context. This one is full of this step's instructions, so continuing in it is slower and can confuse the next step.",
    ],
    [
      "carry",
      "Carry on",
      shape === "all-done"
        ? `In the new session, start from the dashboard with \`${DASHBOARD_COMMAND}\`.`
        : shell
          ? `Run the command above in your terminal, then start the next step from the dashboard with \`${DASHBOARD_COMMAND}\`.`
          : `Paste the command above in the new session, or start from the dashboard with \`${DASHBOARD_COMMAND}\`.`,
    ],
  ];
  const list = el("ul", "handoff-guide-rows");
  for (const [kind, label, text] of rows) {
    const row = el("li", "handoff-guide-row");
    row.appendChild(guideIcon(kind));
    const body = el("div", "handoff-guide-text");
    body.appendChild(el("strong", "handoff-guide-label", label));
    body.appendChild(document.createTextNode(" "));
    body.appendChild(textWithCode("span", "handoff-guide-line", text));
    row.appendChild(body);
    list.appendChild(row);
  }
  panel.appendChild(list);
  return panel;
}

// A review, a commit in Git or the dashboard the person just asked for is starting
// here, so the page is about to carry on rather than end.
function closeGuideHeld() {
  if (page.gone) return false;
  return ["review", "commit", "dashboard"].includes(page.local.afterBuild) || reviewPending() === "asked";
}

export function renderHandoff(fin) {
  const card = el("article", "card handoff");
  card.appendChild(el("p", "card-kicker", finishPaused(fin) ? "Session paused" : "Session ended"));
  card.appendChild(el("h2", null, fin.headline));
  if (fin.body) card.appendChild(md(fin.body, "md prompt"));

  // A finished build offers its review first, above the next step, because it
  // is the one thing on this screen that has to happen before they leave.
  const offer = reviewOffer(fin);
  if (offer && !["done", "dashboard", "commit"].includes(page.local.afterBuild)) {
    card.appendChild(renderReviewOffer(offer));
  }

  // The commit, right after the review: one press starts Git's commit flow here.
  if (commitOffer(fin) && !page.gone && page.local.afterBuild !== "done" && page.local.afterBuild !== "dashboard") {
    card.appendChild(renderCommitOffer());
  }

  // Three shapes: a next step to run, a pause with its resume command, or a
  // session with nothing left to run, which gets a quiet pointer at the
  // dashboard instead of a Next step block.
  const shape = handoffShape(fin);
  if (shape === "all-done") {
    const done = el("div", "handoff-done");
    done.appendChild(md(`${ALL_DONE_LEAD} ${ALL_DONE_REST}`, "md handoff-done-text"));
    const text = handoffText({ command: DASHBOARD_COMMAND });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small ghost handoff-copy", code));
    done.appendChild(row);
    // Once the server is gone, the row above already is the offer's fallback.
    if (dashboardLive(fin) && !page.gone) done.appendChild(renderDashboardOffer(true));
    card.appendChild(done);
  } else {
    // A pause always offers its resume command, even when the agent left it out.
    const command =
      String(fin.command || "").trim() || resumeCommand({ workflow: page.S.workflow, specDir: page.S.specDir });
    const step = el("div", "handoff-step");
    step.appendChild(el("p", "handoff-label", "Next step"));
    step.appendChild(
      el(
        "p",
        "handoff-where",
        fin.where ||
          (command.startsWith("/")
            ? "Run this in the terminal where you started Plan2Code, in a new conversation:"
            : "Run this in your terminal:")
      )
    );

    // Shown exactly as copied. Nothing goes on the clipboard that they cannot
    // read first: it is about to be pasted into a program with their files.
    const text = handoffText({ ...fin, command });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    step.appendChild(row);
    if (text !== command) {
      step.appendChild(
        el(
          "p",
          "handoff-note",
          "The --web at the end asks Plan2Code to open this page again, so you carry on here rather than in the terminal."
        )
      );
    }
    card.appendChild(step);

    // A finished (never paused) screen always names the way to the dashboard
    // from a new conversation, unless the offer's own fallback already does.
    if (shape === "next") {
      const offerDash = dashboardLive(fin);
      if (offerDash) card.appendChild(renderDashboardOffer(false));
      if (!(offerDash && page.gone)) {
        card.appendChild(
          textWithCode(
            "p",
            "handoff-fresh",
            `To start something else, run \`${DASHBOARD_COMMAND}\` in a new conversation.`
          )
        );
        const freshText = handoffText({ command: DASHBOARD_COMMAND });
        const freshRow = el("div", "handoff-command handoff-fresh-row");
        const freshCode = el("code", "handoff-code", freshText);
        freshRow.appendChild(freshCode);
        freshRow.appendChild(copyButton(freshText, "btn small ghost handoff-copy", freshCode));
        card.appendChild(freshRow);
      }
    }
  }

  // Not while a hand-off they just asked for is starting on this page: "Safe
  // to close" and "start a new one" would contradict the line above it. The
  // press re-renders the page, and so does the agent taking it up.
  if (!closeGuideHeld()) card.appendChild(renderCloseGuide(shape, fin));

  card.appendChild(
    el(
      "p",
      "handoff-close",
      reviewPending() === "open"
        ? "The review is optional. Skip it and nothing else here needs you."
        : "That is everything on this page."
    )
  );

  // What they were working on is on disk, but only the agent's copy is. This
  // is the last moment anyone is looking at this page, so the way to take the
  // document with them belongs here and not only behind a tab they may never
  // open again — unless the doc is `saved`, in which case the file itself is
  // already on disk and a download would be a second copy of it.
  const keep = docs().find((d) => d.id === fin.doc) || docs()[0];
  if (keep && (keep.blocks || []).length) {
    const tools = el("div", "handoff-tools");
    if (keep.saved) {
      tools.appendChild(docSavedNote(keep));
    } else {
      const save = el("button", "btn small", `Download ${keep.title || "the document"}`);
      save.type = "button";
      save.addEventListener("click", () => downloadDoc(keep));
      tools.appendChild(save);
    }
    card.appendChild(tools);
  }

  // Answers staged and never sent are lost the moment this page closes, and
  // this page's one promise is that nothing gets lost. Say so plainly rather
  // than letting them walk away from work they thought was safe.
  const stuck = Object.keys(page.local.staged).length;
  if (stuck) {
    card.appendChild(
      el(
        "p",
        "handoff-unsent",
        `${stuck} answer${stuck === 1 ? "" : "s"} here ${stuck === 1 ? "was" : "were"} never sent, ` +
          `and Plan2Code has finished. If ${stuck === 1 ? "it" : "they"} still matter, say so in the ` +
          `next session: nothing on this page will reach it now.`
      )
    );
  }
  return card;
}

// The review button, on the hand-off of a finished build (a finished quick
// task; an implementation phase gets its review offer earlier, as a verdict
// on the sign-off card).
//
// It is a request, not a command: the page cannot run a review, it asks the
// agent that is still sitting in its wait loop, the same way "Write a brief"
// does. So it is only offered while there is a server to carry the press, and
// once there is not, it turns into the command that does the same thing from
// the terminal instead of a button that would go nowhere.
function renderReviewOffer(offer) {
  const box = el("section", "review-offer");
  box.appendChild(el("p", "handoff-label", "Before you go"));
  box.appendChild(el("h3", "review-offer-title", offer.label));
  const { asked, disabled } = afterFinishButton(page.local.afterBuild, "review", page.pendingResult);

  if (page.gone) {
    box.appendChild(
      el(
        "p",
        "review-offer-text",
        asked
          ? "The session closed before the review could start. To run it now, use this in the terminal, in a new conversation:"
          : "This session has closed, so the review cannot start from here any more. To run it, use this in the terminal, in a new conversation:"
      )
    );
    const text = "/plan2code-review";
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    box.appendChild(row);
    return box;
  }

  box.appendChild(
    el(
      "p",
      "review-offer-text",
      "A careful review of the files this session changed: bugs, gaps against what was asked for, and anything risky. " +
        "The findings come back on this page and you choose which ones get fixed. Nothing changes until you do."
    )
  );
  const row = el("div", "btn-row");
  const go = el("button", "btn primary review-go", asked ? "Review requested…" : "Review it now");
  go.type = "button";
  go.disabled = disabled;
  go.addEventListener("click", () => sendAfterBuild("review"));
  row.appendChild(go);
  if (!asked) {
    const no = el("button", "btn ghost", "No thanks, I am done");
    no.type = "button";
    no.disabled = disabled;
    no.addEventListener("click", () => sendAfterBuild("done"));
    row.appendChild(no);
  }
  box.appendChild(row);
  return box;
}

// Commit what was just built without leaving the page. Like the review button
// it is a request to an agent still in its wait loop, so it is only drawn
// while the server is there; the command printed below stays for the terminal.
function renderCommitOffer() {
  const box = el("section", "review-offer");
  box.appendChild(el("p", "handoff-label", "Commit it"));
  box.appendChild(
    el(
      "p",
      "review-offer-text",
      "Git reads what changed, drafts the message and asks before it commits. It opens right here, on the git board."
    )
  );
  const { asked, disabled } = afterFinishButton(page.local.afterBuild, "commit", page.pendingResult);
  const row = el("div", "btn-row");
  const go = el("button", "btn primary", asked ? "Opening Git…" : "Commit it now");
  go.type = "button";
  go.disabled = disabled;
  go.addEventListener("click", () => sendAfterBuild("commit"));
  row.appendChild(go);
  box.appendChild(row);
  return box;
}

// The way back to the dashboard, on a finished screen whose agent opted in
// with `finish.dashboard`. Like the review button it is a request to an agent
// still in its wait loop, so once the server is gone it turns into the
// command that opens the dashboard from a new conversation instead.
function renderDashboardOffer(primary) {
  const box = el("section", "dashboard-offer");
  if (page.gone) {
    box.appendChild(
      el(
        "p",
        null,
        "This session has closed, so the button cannot reach Plan2Code any more. To open the dashboard, run this in a new conversation:"
      )
    );
    const text = handoffText({ command: DASHBOARD_COMMAND });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    box.appendChild(row);
    return box;
  }
  const { asked, disabled } = afterFinishButton(page.local.afterBuild, "dashboard", page.pendingResult);
  const go = el(
    "button",
    primary ? "btn primary" : "btn",
    asked ? "Opening the dashboard…" : "Back to the dashboard"
  );
  go.type = "button";
  go.disabled = disabled;
  go.addEventListener("click", () => sendAfterBuild("dashboard"));
  box.appendChild(go);
  box.appendChild(textWithCode("p", "dashboard-note", DASHBOARD_NOTE));
  return box;
}

// Any answer to a finished session's offers, as one send through the ordinary
// submit. Like a brief, it names no question: `__review`, `__commit`, `__done`
// and `__dashboard` are about the session.
const AFTER_FINISH_REPLIES = { review: REVIEW_REPLY, done: DONE_REPLY, dashboard: DASHBOARD_REPLY, commit: COMMIT_REPLY };

async function sendAfterBuild(kind) {
  if (page.gone || page.pendingResult || page.local.afterBuild) return;
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actions: [{ i: `__${kind}`, type: kind }],
        reply: AFTER_FINISH_REPLIES[kind],
      }),
    });
    if (res.status === 409) {
      page.pendingResult = true;
      hooks.banner("Your last answers are still being picked up. Try again in a moment.", "info");
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    page.local.afterBuild = kind;
    page.pendingResult = true;
    saveNow();
    const started = {
      review: "Review requested. It starts here in a moment.",
      dashboard: "Opening the dashboard. It appears here in a moment.",
      commit: "Opening Git. It appears here in a moment.",
    }[kind];
    if (started) {
      hooks.banner(started, "good");
      setTimeout(() => hooks.banner(null), 5000);
    }
  } catch {
    hooks.banner("That did not go through. Nothing was lost; try again.", "warn");
  } finally {
    redraw();
  }
}

let stoppingHidden = false;

// A stop is under way if this browser sent one, or if the server is holding
// one nobody has collected: the second covers a reload on a resumed session,
// a second tab, another machine.
export function stopInProgress() {
  return page.local.stopping || (page.pendingStop ? { at: 0, answers: 0 } : null);
}

export function renderStopButton() {
  const b = $("btn-stop");
  if (!page.S || finish()) {
    b.hidden = true;
    return;
  }
  b.hidden = false;
  if (stopInProgress()) {
    b.textContent = "Stopping…";
    b.disabled = false;
    b.title = "Show how the stop is going";
    return;
  }
  b.textContent = "Stop session";
  // Only on the person's turn, unless nothing is coming (see turnGate).
  const gate = turnGate({ gone: page.gone, pendingResult: page.pendingResult, waiting: agentHasTheBall() });
  // A way home in flight holds Stop back too, unless the agent went quiet
  // after collecting it: Stop's resume screen is then the only way out.
  b.disabled = Boolean(gate) || (Boolean(page.local.homeward) && !agentAdrift());
  b.title = {
    gone: "Not connected right now.",
    pending: "Your last answers are still being picked up. You can stop once they have been.",
    waiting: "Plan2Code is working on your answers. You can stop once it replies.",
  }[gate] || (stopWarning() ? "End this session. Work since the last save is not kept." : "Save your place and end this session. You get a command to pick it up later.");
}

// Plan2Code has the ball: it is working, or owes a reply to a send, and has
// not gone quiet. What both session buttons wait out.
function agentHasTheBall() {
  return (agentWorking() || awaitingReply().length > 0) && !agentAdrift();
}

// The triangle left of Stop session. Mid-workflow it is a stop that lands on
// the menu instead of a finish: the same staged answers ride along, the agent
// saves its place the same way, then resumes the session as the dashboard.
export function renderHomeButton() {
  const b = $("btn-home");
  const st = homeButtonState({
    workflow: page.S && page.S.workflow,
    finished: Boolean(page.S && finish()),
    stopping: Boolean(page.S && stopInProgress()),
    homeward: Boolean(page.local.homeward),
    adrift: Boolean(page.S) && agentAdrift(),
    gone: page.gone,
    pendingResult: page.pendingResult,
    waiting: Boolean(page.S) && agentHasTheBall(),
    warned: Boolean(page.S) && Boolean(stopWarning()),
  });
  b.hidden = st.hidden;
  b.disabled = st.disabled;
  b.title = st.title;
}

function openHomeConfirm() {
  const n = Object.keys(page.local.staged).length + pendingNotes().length;
  const warn = stopWarning();
  // With a warning, "your place is saved" is the one thing not true: the
  // warning says what is lost, and the button says the choice is theirs.
  $("home-blurb").textContent =
    (n === 1 ? "The answer you have ready goes with it. " : n ? `The ${n} answers you have ready go with it. ` : "") +
    (warn ? "Plan2Code takes you back to the dashboard." : "Your place is saved; you can resume it from the dashboard.");
  $("home-go").textContent = warn ? "Leave anyway" : "Back to the dashboard";
  $("home-warn").hidden = !warn;
  $("home-warn").textContent = warn;
  $("home-modal").showModal();
}

async function goHome() {
  const go = $("home-go");
  go.disabled = true;
  const payload = hooks.stagedPayload();
  payload.actions.push({ i: "__dashboard", type: "dashboard" });
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: payload.actions, reply: [...payload.replyLines, HOME_REPLY].join("\n") }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    hooks.markSent(payload);
    page.local.homeward = { at: Date.now() };
    saveNow();
    $("home-modal").close();
  } catch (err) {
    $("home-modal").close();
    // The server is holding an uncollected result: Send, Home and Stop all
    // need to read as busy until the frame or the ping says otherwise, same
    // as send() and sendAfterBuild() do on a 409.
    if (err && err.pending) page.pendingResult = true;
    hooks.banner(
      err && err.pending
        ? "Your last answers are still being picked up, so that could not go yet. Try again in a moment."
        : "That did not go through. Nothing was lost; try again.",
      "warn"
    );
  } finally {
    go.disabled = false;
    redraw();
  }
}

// Stopping now can lose answers: Planning writes nothing until its plan is
// done, and Pathfinder nothing until its map exists. The agent knows where it
// is and says so in `stopWarning`; Planning is assumed to lose answers unless
// the agent says otherwise, because that is true of most of it.
export function stopWarning() {
  if (typeof page.S.stopWarning === "string") return page.S.stopWarning.trim();
  if (page.S.workflow === "plan") {
    return "Planning only saves at set points along the way. Answers since the last save will not be kept, though you can go over them again next time.";
  }
  return "";
}

function openStopConfirm() {
  if (stopInProgress()) {
    stoppingHidden = false;
    return renderStopping();
  }
  const n = Object.keys(page.local.staged).length + pendingNotes().length;
  const warn = stopWarning();
  const dash = isDashboard();
  $("stop-blurb").textContent =
    (n === 1 ? "The answer you have ready goes with it. " : n ? `The ${n} answers you have ready go with it. ` : "") +
    (dash ? "Nothing has started yet, so there is nothing to save: this just ends the console session." : "");
  $("stop-blurb").hidden = !$("stop-blurb").textContent;
  $("stop-warn").hidden = !warn;
  $("stop-warn").textContent = warn;
  // The dashboard has nothing to hand off: one plain Stop. Elsewhere both
  // choices show, and "Just stop and save" turns into "Stop anyway" where
  // nothing is saved yet.
  $("stop-handoff").hidden = dash;
  const title = $("stop-go").querySelector(".stop-choice-title");
  const detail = $("stop-go").querySelector(".stop-choice-detail");
  if (dash) {
    title.textContent = "Stop";
    detail.textContent = "Ends the console session.";
  } else if (warn) {
    title.textContent = "Stop anyway";
    detail.textContent = "Ends the session now. What the warning above names is not kept.";
  } else {
    title.textContent = "Just stop and save";
    detail.textContent = "Saves what this step keeps on disk and gives you a command to resume. What we talked about is not kept.";
  }
  $("stop-modal").showModal();
}

async function stopSession(handoff = false) {
  const buttons = [$("stop-handoff"), $("stop-go")];
  for (const b of buttons) b.disabled = true;
  const payload = hooks.stagedPayload();
  payload.actions.push(stopAction({ handoff }));
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: payload.actions, reply: [...payload.replyLines, handoff ? STOP_HANDOFF_REPLY : STOP_REPLY].join("\n") }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    hooks.markSent(payload);
    page.local.stopping = { at: Date.now(), answers: payload.sentIds.size };
    saveNow();
    $("stop-modal").close();
    stoppingHidden = false;
  } catch (err) {
    $("stop-modal").close();
    if (err && err.pending) page.pendingResult = true;
    hooks.banner(
      err && err.pending
        ? "Your last answers are still being picked up, so the stop could not go yet. Try again in a moment."
        : "The stop did not go through. Nothing was lost; try again.",
      "warn"
    );
  } finally {
    for (const b of buttons) b.disabled = false;
    redraw();
  }
}

// The wrapping-up screen, derived every render from what the page already
// tracks: whether the request is collected, whether anyone is listening, and
// whether the finish has landed.
export function renderStopping() {
  const dlg = $("stopping-modal");
  const stopping = page.S && stopInProgress();
  if (!stopping) {
    if (dlg.open) dlg.close();
    return;
  }
  // The finish is the end of it: the hand-off card on the page says the rest.
  if (finish()) {
    page.local.stopping = null;
    saveNow();
    if (dlg.open) dlg.close();
    return;
  }

  const sent = stopping.answers;
  const collected = !page.pendingResult;
  // Nobody is coming: the server stopped with no finish, or the agent has not
  // checked in for minutes. The request and any answers are on disk either
  // way, and the next session collects them.
  const stuck = page.gone || agentAdrift();
  const steps = [
    { text: sent ? `Sent your ${sent === 1 ? "answer" : sent + " answers"} and the stop` : "Sent the stop", state: "done" },
    {
      text: collected ? "Plan2Code picked it up" : stuck ? "Plan2Code has not picked it up" : "Waiting for Plan2Code to pick it up",
      state: collected ? "done" : stuck ? "stuck" : "now",
    },
    { text: "Saving your place and writing the command to pick it up", state: collected ? (stuck ? "stuck" : "now") : "later" },
  ];
  const list = $("stop-steps");
  list.replaceChildren(
    ...steps.map((s) => {
      const li = el("li", "is-" + s.state);
      li.appendChild(
        s.state === "now"
          ? el("span", "spinner tiny")
          : el("span", "stop-mark", s.state === "done" ? "✓" : s.state === "stuck" ? "!" : "·")
      );
      li.appendChild(el("span", null, s.text));
      return li;
    })
  );

  const extra = $("stop-extra");
  extra.replaceChildren();
  if (stuck) {
    extra.appendChild(
      el(
        "p",
        "stop-note",
        page.gone
          ? "The session closed without saying how to pick it up. Your answers and the stop are saved, and the next session collects them. To carry on, run this in the terminal, in a new conversation (or alternatively run `/plan2code` to relaunch the dashboard):"
          : "Plan2Code is not running right now, so nothing new has been saved yet. Your answers and the stop are held, and the next session collects them. To carry on, run this in the terminal, in a new conversation (or alternatively run `/plan2code` to relaunch the dashboard):"
      )
    );
    const text = handoffText({ command: resumeCommand(page.S) });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    extra.appendChild(row);
  } else {
    extra.appendChild(
      el(
        "p",
        "stop-note",
        agentWorking() && !collected
          ? "Plan2Code is in the middle of something. It stops as soon as that is done."
          : "This usually takes a moment. You can close the tab if you need to: the command also appears in the terminal."
      )
    );
  }

  if (!stoppingHidden && !dlg.open) dlg.showModal();
}

// The top bar's way home and Stop, wired once at start-up.
export function wireEnding() {
  $("btn-home").addEventListener("click", openHomeConfirm);
  $("home-cancel").addEventListener("click", () => $("home-modal").close());
  $("home-go").addEventListener("click", goHome);
  $("btn-stop").addEventListener("click", openStopConfirm);
  $("stop-cancel").addEventListener("click", () => $("stop-modal").close());
  $("stop-handoff").addEventListener("click", () => stopSession(true));
  $("stop-go").addEventListener("click", () => stopSession(false));
  $("stopping-hide").addEventListener("click", () => {
    stoppingHidden = true;
    $("stopping-modal").close();
  });
  // Esc on a native dialog closes it without our say; count that as hiding, or
  // the next render would open it straight back up.
  $("stopping-modal").addEventListener("cancel", () => (stoppingHidden = true));
}

// The three stop-related controls, drawn again when the agent comes or goes.
export function renderStopControls() {
  renderStopButton();
  renderHomeButton();
  renderStopping();
}
