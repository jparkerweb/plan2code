// Plan2Code Web Console - question cards: every kind, the pager, settled and in-flight records; defines only.

import { hooks, page, redraw, stage, saveNow, setDraft } from "../state.js";
import {
  openItems,
  awaitingReply,
  finish,
  myTurn,
  isOpen,
  submittedInFlight,
  agentWorking,
  workingMs,
  patience,
  WORKING_GRACE_MS,
  topics,
  byId,
  docs,
  isGitBoard,
} from "../selectors.js";
import {
  lastOpenCard,
  nextOpenAfter,
  sentAnswer,
  recordedAnswer,
  answerLines,
  threadWho,
  threadText,
  noteAwaiting,
  submittedAwaiting,
  showKey,
  choiceAnswer,
  suggestionFrom,
  verdictText,
  handoffText,
  finishPaused,
} from "../answers.js";
import { el, md } from "../render.js";
import {
  sentAttachments,
  incomingFiles,
  attachFiles,
  attachRow,
  noteImages,
  attachTray,
} from "../uploads.js";
import { attachMentions } from "../mention-box.js";
import { TEMPLATE_WORKFLOWS, templatesFor, templateSwap } from "../starters.js";
import { looks } from "../looks.js";

const $ = (id) => document.getElementById(id);

// The question card currently on screen, so the quiet staging path can find its
// border and pill again without a DOM search. Replaced on every renderCard.
let cardMarks = null;

export function markFor(item) {
  // On a finished session an open item is frozen, not waiting: its send went
  // and can no longer be added to, or it was never answered and never can be.
  if (isOpen(item) && finish()) {
    return recordedAnswer(item)
      ? { glyph: "✓", cls: "done", label: "sent" }
      : { glyph: "○", cls: "open", label: "left unanswered" };
  }
  if (page.local.staged[item.id]) return { glyph: "●", cls: "staged", label: "ready to send" };
  if (isOpen(item) && ((page.local.sent && page.local.sent[item.id]) || submittedInFlight(item)))
    return { glyph: "◐", cls: "staged", label: "sent, waiting for Plan2Code" };
  if (!isOpen(item)) return { glyph: "✓", cls: "done", label: "answered" };
  return { glyph: "○", cls: "open", label: "waiting for you" };
}

// The session's own ending, as a page of its own at the top of the rail.
// A pause and a finish share the screen -- the hand-off card -- but not the
// name: "paused" is the word the stop playbook asks for in the headline, and
// it is the word the person was told to expect.
export function renderEndItem(fin) {
  const paused = finishPaused(fin);
  const box = el("div", "rail-group rail-end");
  const b = el("button", "rail-item");
  b.type = "button";
  b.setAttribute("aria-current", String(page.view === "end"));
  const mark = el("span", "rail-mark " + (paused ? "staged" : "done"), paused ? "❚❚" : "✓");
  mark.title = paused ? "session paused" : "session ended";
  b.appendChild(mark);
  b.appendChild(el("span", "rail-end-label", paused ? "Paused" : "Session ended"));
  b.addEventListener("click", () => {
    page.view = "end";
    redraw();
    $("main").focus();
  });
  box.appendChild(b);
  return box;
}

// A card that scrolls its own contents fades out at the bottom edge while
// there is more below: a finished screen's buttons, a long question's last
// options, otherwise sit past the fold looking like the card simply ends.
export function markMore() {
  for (const card of $("main").querySelectorAll(":scope > .card")) {
    card.classList.toggle("has-more", card.scrollHeight - card.scrollTop - card.clientHeight > 4);
  }
}

// One answer box per card grows into the card's free height: the text
// question's box, else a picked "Something else" box, else the card's note.
// Every other box keeps its ordinary height, and the notes panel beside the
// card is never a candidate.
function markGrowBox(card) {
  if (!card) return;
  const id = card.dataset.item;
  const areas = [...card.querySelectorAll("textarea")];
  // Not over the git board: the column there flows card and board at natural
  // height, so there is no free height for a box to grow into.
  const box = isGitBoard()
    ? null
    : areas.find((t) => t.id === "text-" + id) ||
      card.querySelector(".option.is-other.is-picked textarea.other-text") ||
      areas.find((t) => t.id === "note-" + id);
  // Only a box that stops being the one gives its fill back, so a keystroke
  // that re-marks the same box leaves its height alone.
  for (const n of areas) {
    if (n === box || !n.classList.contains("grow")) continue;
    n.classList.remove("grow");
    n.style.minHeight = "";
  }
  if (box) box.classList.add("grow");
  card.classList.toggle("has-grow", Boolean(box));
}

// The height the card's contents would take if nothing stretched them. Not
// scrollHeight: that never reads less than the card's own height, so a box
// shorter than the fill could never be told how much room it has.
function naturalHeight(card) {
  const last = card.lastElementChild;
  if (!last) return 0;
  const top = card.getBoundingClientRect().top + card.clientTop;
  return (
    last.getBoundingClientRect().bottom -
    top +
    card.scrollTop +
    parseFloat(getComputedStyle(last).marginBottom || "0") +
    parseFloat(getComputedStyle(card).paddingBottom || "0")
  );
}

// The fill is written as the box's min-height, which is what lets the drag
// handle only ever make it taller: resize: vertical alone cannot hold a floor
// that moves with the window. Below a 160px fill the card scrolls instead.
export function fitGrowBox() {
  const box = $("main").querySelector(":scope > .card.has-grow textarea.grow");
  if (!box) return;
  const card = box.closest(".card");
  const other = naturalHeight(card) - box.offsetHeight;
  const fill = Math.max(160, Math.floor(card.clientHeight - other));
  const now = parseFloat(box.style.minHeight) || 0;
  if (Math.abs(now - fill) > 1) box.style.minHeight = fill + "px";
}

// It watches the column, not the box. The box growing changes what the card
// scrolls, never the column's size, so resizing the box here can never set
// off another callback: the loop a box-watching observer would feed.
const growObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => (fitGrowBox(), markMore())) : null;

// To one question, at its top, with focus on the column.
function goToItem(id) {
  page.selected = id;
  page.view = "questions";
  redraw();
  const m = $("main");
  m.focus();
  m.scrollTop = 0;
}

// "Skip this one": staged as skipped, "Skipped" for a beat, then on to the
// next card that still needs the person, or to Send when this was the last.
// Anything the person does first (a click, a key) cancels the move.
let skipTimer = null;

function cancelSkipMove() {
  if (!skipTimer) return;
  clearTimeout(skipTimer);
  skipTimer = null;
  page.local.skipFlash = null;
}

function skipAndMoveOn(id) {
  cancelSkipMove();
  page.local.skipFlash = id;
  // A note already typed goes along: skipping the question is not retracting
  // the comment. Dropping it would leave the text in the box but out of the
  // send, which looks kept and is not.
  const cur = page.local.staged[id];
  stage(id, { type: "skip", skipped: true, ...(cur && cur.text ? { text: cur.text } : {}) });
  skipTimer = setTimeout(() => {
    skipTimer = null;
    page.local.skipFlash = null;
    const openIds = openItems().map((i) => i.id);
    const sent = Object.fromEntries(awaitingReply().map((i) => [i.id, true]));
    const next = lastOpenCard(openIds, page.local.staged, sent, id) ? null : nextOpenAfter(openIds, page.local.staged, sent, id);
    if (next) return goToItem(next);
    redraw();
    $("btn-send").focus();
  }, 250);
}

// Previous / next across the questions still waiting.
//
// The left rail already navigates, but it is a list of everything and it reads
// as a table of contents rather than as a way through. Someone working down
// three open questions should not have to aim at a 13px row to reach the next
// one. Settled questions are deliberately not in this walk: they are reference,
// not work, and the rail is where you go back to them.
export function buildPager(item) {
  // Once the session has ended nothing open can be sent, so a way "back to
  // what is waiting" would lead somewhere that goes nowhere.
  if (finish()) return null;
  // Theirs to answer, not just unanswered by the agent: a sent question
  // waiting on the other end is not a place this walk should stop.
  const open = myTurn();
  if (!open.length) return null;

  const go = (target) => goToItem(target.id);

  const row = el("nav", "pager");
  row.setAttribute("aria-label", "Move between the questions waiting");

  const at = open.findIndex((i) => i.id === item.id);
  if (at === -1) {
    // Reading something already settled. The only move that means anything
    // here is back to the work.
    const b = el("button", "btn small pager-btn next");
    b.type = "button";
    const box = el("span", "pager-label");
    box.appendChild(el("span", "pager-kicker", "Back to what is waiting"));
    box.appendChild(el("span", "pager-title", open[0].title));
    b.appendChild(box);
    b.appendChild(el("span", "pager-arrow", "→"));
    b.addEventListener("click", () => go(open[0]));
    row.className = "pager one";
    row.appendChild(b);
    return row;
  }

  if (open.length < 2) return null;

  // Once this question is answered, the step is the next unanswered one, not
  // Send. Send lighting up the moment a single answer is staged pulls people
  // into sending one question at a time, which is three round trips where the
  // workflow wanted one. So the emphasis moves to whichever neighbor still
  // needs them, and Send goes quiet until nothing does.
  const here = Boolean(page.local.staged[item.id]);
  const nextT = open[at + 1];
  const prevT = open[at - 1];
  // "Still needs them" is not the same as "not staged": a question already sent
  // is locked and waiting on the agent, so pointing at it as the step would
  // walk someone into a card they cannot act on.
  const needs = (t) => Boolean(t && !page.local.staged[t.id] && !(page.local.sent && page.local.sent[t.id]));
  const leadNext = here && needs(nextT);
  const leadPrev = here && !leadNext && needs(prevT);

  // An end of the queue is an empty slot, not a disabled button. A grayed
  // "Previous" pointing at nothing is a control that exists only to say no.
  const mk = (target, back, lead) => {
    if (!target) return el("span", "pager-slot");
    const b = el(
      "button",
      "btn small pager-btn " + (back ? "prev" : "next") + (lead ? " lead" : " ghost")
    );
    b.type = "button";
    const arrow = el("span", "pager-arrow", back ? "←" : "→");
    const box = el("span", "pager-label");
    box.appendChild(el("span", "pager-kicker", back ? "Previous" : "Next"));
    box.appendChild(el("span", "pager-title", target.title));
    if (back) {
      b.appendChild(arrow);
      b.appendChild(box);
    } else {
      b.appendChild(box);
      b.appendChild(arrow);
    }
    b.addEventListener("click", () => go(target));
    return b;
  };

  row.appendChild(mk(prevT, true, leadPrev));
  row.appendChild(el("span", "pager-count", `${at + 1} of ${open.length} waiting`));
  row.appendChild(mk(nextT, false, leadNext));
  return row;
}

// A notice is context for the question it sits beside, so it lives inside the
// one card rather than as a second one under it.
export function renderNotice(item) {
  const box = el("div", "card-note card-extra");
  box.appendChild(el("p", "note-kicker", "Note"));
  box.appendChild(el("h3", "note-title", item.title));
  box.appendChild(md(item.body, "md"));
  return box;
}

// An ANSWER that has been sent but not yet dealt with. Its controls are locked:
// the agent is mid-turn on exactly this question, so a change made now reaches
// nobody, and the change would then be deleted by the next state update.
//
// A send carrying only a note is not that. Someone who asks a question about
// the question before answering it has not answered it, and locking the form
// there leaves an open question that cannot be answered at all. The note is
// still shown as on its way, by the "Sent" pill and the rail mark.
function inFlightFor(item) {
  if (!isOpen(item) || finish()) return null;
  const sent = page.local.sent && page.local.sent[item.id];
  if (sentAnswer(sent)) return sent;
  // The send this tab no longer remembers (a reload, a resumed session, a
  // second tab) or one the agent took without settling the question: the
  // server's copy on the item is the same fact either way.
  const sub = submittedInFlight(item);
  return sub ? { value: sub, summary: "" } : null;
}

export function renderCard(item) {
  const staged = page.local.staged[item.id];
  const flight = inFlightFor(item);
  const card = el(
    "article",
    "card question" +
      (!isOpen(item) || finish() ? " is-answered" : staged ? " is-staged" : "") +
      (flight ? " is-inflight" : "")
  );

  // Which question this card is for, so a render can tell whether the card it
  // is replacing is the same one (keep the scroll) or a different one (start
  // at the top).
  card.dataset.item = item.id;

  const kicker = el("p", "card-kicker");
  fillKicker(kicker, item);
  card.appendChild(kicker);
  // Held so the quiet staging path can repaint the border and the pill without
  // rebuilding the card, which would take the textarea being typed into with it.
  cardMarks = { id: item.id, card, kicker };

  card.appendChild(el("h2", null, item.title));
  if (item.body) card.appendChild(md(item.body, "md prompt"));
  const link = docLink(item);
  if (link) card.appendChild(link);

  // An item still open on a finished session renders as the same record a
  // settled one does: the send it carries is the final word on it, because a
  // send can no longer go anywhere and the form would be a trap.
  if (!isOpen(item) || finish()) {
    renderSettled(card, item);
  } else if (flight) {
    renderInFlight(card, item, flight);
  } else {
    const build = BUILDERS[item.kind];
    if (build) build(card, item, staged);
  }

  if (item.required === false && isOpen(item) && !flight && !finish()) {
    const skipped = Boolean(staged && staged.skipped);
    // A small accent chip, like a comment box's quick answer ("No changes"),
    // rather than an underlined link that reads as fine print.
    const skip = el("button", "btn tiny", skipped ? "Do not skip" : "Skip this one");
    skip.type = "button";
    skip.style.marginTop = "16px";
    skip.addEventListener("click", () => (skipped ? stage(item.id, null) : skipAndMoveOn(item.id)));
    card.appendChild(skip);
    if (page.local.skipFlash === item.id) {
      card.classList.add("is-skip-flash");
      const flash = el("span", "skip-flash", "Skipped");
      flash.setAttribute("role", "status");
      card.appendChild(flash);
    }
  }

  if (isOpen(item) && !flight && !finish()) markGrowBox(card);
  return card;
}

function renderSettled(card, item) {
  const v = recordedAnswer(item);
  const lines = answerLines(item, v);
  const text = v && typeof v.text === "string" ? v.text.trim() : "";
  // Fall back to the last thing they said on this question, but only when there
  // is nothing else at all. Attaching a side note to a pick they also made
  // would misreport which of the two was the answer.
  let prose = text;
  let fromNote = false;
  if (!prose && !lines.length) {
    const mine = (item.thread || []).filter((m) => threadWho(m) === "user");
    if (mine.length) prose = threadText(mine[mine.length - 1]).trim();
    fromNote = Boolean(prose);
  }

  const nothing = !lines.length && !prose;
  const box = el("div", "answered" + (nothing ? " is-empty" : ""));
  const head = el("p", "answered-head");
  head.appendChild(el("span", "answered-mark", nothing ? "·" : "✓"));
  // A note is not an answer: say which it is.
  head.appendChild(el("span", null, nothing ? "No answer recorded" : fromNote ? "Your last note" : "Your answer"));
  box.appendChild(head);

  if (lines.length) {
    const ul = el("ul", "answered-values");
    for (const line of lines) ul.appendChild(el("li", null, line));
    box.appendChild(ul);
  }
  if (prose) box.appendChild(el("blockquote", "answered-text", prose));
  if (nothing) {
    box.appendChild(
      el(
        "p",
        "answered-none",
        isOpen(item)
          ? "The session ended before this was answered."
          : "This was answered somewhere other than this page, so there is nothing to show."
      )
    );
  }
  box.appendChild(
    el(
      "p",
      "answered-lock",
      isOpen(item)
        ? nothing
          ? "The session is over."
          : "The session is over, so this stands as it was sent."
        : "Locked. If this needs to change, say so in a note on a question that is still open, or in the terminal."
    )
  );
  card.appendChild(box);

  const context = SETTLED_CONTEXT[item.kind];
  if (context) context(card, item, v);
}

// The same record, in the moment between pressing Send and the agent replying.
//
// It is deliberately NOT an overlay over the page. The wait is when someone
// re-reads the document, looks ahead at what is coming, or catches up on a
// question they skimmed, and that reading is the whole reason this page beats
// the terminal. What has to stop is editing THIS question, because the agent is
// mid-turn on it: a change made now reaches nobody and is deleted by the next
// update. So the one card that cannot be acted on locks, and nothing else does.
function renderInFlight(card, item, flight) {
  const v = flight.value || null;
  const lines = answerLines(item, v);
  const text = v && typeof v.text === "string" ? v.text.trim() : "";

  const box = el("div", "answered is-sent");
  const head = el("p", "answered-head");
  head.appendChild(el("span", "answered-mark", "↑"));
  head.appendChild(el("span", null, "Sent"));
  box.appendChild(head);

  if (lines.length) {
    const ul = el("ul", "answered-values");
    for (const line of lines) ul.appendChild(el("li", null, line));
    box.appendChild(ul);
  } else if (!text && flight.summary) {
    // A send from an older page version, or a note with no answer attached.
    const ul = el("ul", "answered-values");
    ul.appendChild(el("li", null, flight.summary));
    box.appendChild(ul);
  }
  if (text) box.appendChild(el("blockquote", "answered-text", text));
  const note = noteAwaiting(item);
  const sub = submittedAwaiting(item);
  if (note && sub && note.at === sub.at) {
    if (note.text) box.appendChild(el("blockquote", "answered-text", note.text));
    const tray = sentAttachments(note);
    if (tray) box.appendChild(tray);
  }

  // Say which of the two it actually is. Once the agent has collected the send,
  // "waiting to be picked up" is no longer true, and a status line that lies is
  // worse than none.
  box.appendChild(
    el(
      "p",
      "answered-lock",
      page.pendingResult
        ? "Waiting for Plan2Code to pick this up. It unlocks by itself."
        : "Plan2Code is working on it. This unlocks by itself when it answers."
    )
  );
  card.appendChild(box);

  const context = SETTLED_CONTEXT[item.kind];
  if (context) context(card, item, v);

  // A stuck agent must not lock someone out of their own answer forever. This
  // is the card-level twin of the Send button's grace period, and it appears on
  // the same terms -- a send could actually go through. sendState() is not the
  // test here: it is also disabled for an empty payload, and clicking this is
  // what stages the payload it would send.
  const sendWouldGo =
    !finish() && !page.gone && !page.pendingResult && (!agentWorking() || workingMs() > patience(WORKING_GRACE_MS));
  if (sendWouldGo) {
    const undo = el("button", "linky", "Take this back and answer again");
    undo.type = "button";
    undo.style.marginTop = "16px";
    undo.addEventListener("click", () => {
      // Put the answer back as a staged one, exactly the state they were in
      // before they pressed Send. Sending clears `staged` and the field's
      // draft, so without this the button empties the box it offered to let
      // them edit, and a long answer has to be typed a second time.
      const back = sentAnswer(page.local.sent[item.id]);
      delete page.local.sent[item.id];
      // The server also records every send on the item (`submitted`), and that
      // record counts as in flight on its own: taking THIS send back has to
      // retract it too, or the card stays locked. Its `at` names the send, so
      // one made afterwards still counts.
      const sub = submittedAwaiting(item);
      if (sub) (page.local.retract = page.local.retract || {})[item.id] = sub.at || "any";
      if (back) {
        page.local.staged[item.id] = back;
      } else if (sub) {
        // The send came off the server's copy on the item, so its value goes
        // back on the form to be edited and sent again.
        const { at, ...rest } = sub;
        page.local.staged[item.id] = { type: "answer", ...rest };
      }
      saveNow();
      redraw();
    });
    card.appendChild(undo);
  }
}

// The question's own material, shown back as a record. No inputs at all: a
// disabled control still invites a click, a static mark does not.
function lockedOptions(card, item, keys) {
  if (!(item.options || []).length) return;
  const picked = new Set(keys);
  const list = el("ul", "options");
  for (const o of item.options) {
    const on = picked.has(o.k);
    const li = el("li", "option is-locked" + (on ? " is-recorded" : ""));
    li.appendChild(el("span", "option-mark" + (on ? " on" : ""), on ? "✓" : "·"));
    const body = el("div", "option-body");
    const head = el("div", "option-label");
    if (showKey(o.k, o.text)) head.appendChild(el("span", "option-key", o.k));
    head.appendChild(el("span", null, o.text));
    if (on) head.appendChild(el("span", "pill done", "Your answer"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));
    li.appendChild(body);
    list.appendChild(li);
  }
  card.appendChild(list);
}

function lockedSteps(card, item, v) {
  if (!(item.steps || []).length) return;
  const done = new Set((v && v.done) || []);
  const list = el("ol", "steps");
  item.steps.forEach((step, i) => {
    const li = el("li", "step is-locked");
    li.appendChild(el("span", "step-num", String(i + 1)));
    const on = done.has(i);
    li.appendChild(el("span", "option-mark" + (on ? " on" : ""), on ? "✓" : "·"));
    const body = el("div", "step-body");
    body.appendChild(md(typeof step === "string" ? step : step.text, "md"));
    li.appendChild(body);
    list.appendChild(li);
  });
  card.appendChild(list);
}

function lockedRows(card, item, v) {
  const rows = (v && Array.isArray(v.rows) && v.rows.length ? v.rows : item.rows) || [];
  if (!rows.length) return;
  const ul = el("ul", "rows");
  rows.forEach((row, i) => {
    const li = el("li", "row-item is-locked");
    li.appendChild(el("span", "row-order", String(i + 1)));
    const main = el("div", "row-main");
    main.appendChild(el("p", "row-title-static", row.title || ""));
    if (row.body) main.appendChild(el("div", "row-body", row.body));
    li.appendChild(main);
    ul.appendChild(li);
  });
  card.appendChild(ul);
}

function lockedSummary(card, item) {
  if (!item.summary) return;
  const box = el("div", "card-note");
  box.appendChild(md(item.summary, "md"));
  card.appendChild(box);
}

const SETTLED_CONTEXT = {
  choice: (card, item, v) => lockedOptions(card, item, v && v.k ? [v.k] : []),
  menu: (card, item, v) => lockedOptions(card, item, v && v.k ? [v.k] : []),
  multi: (card, item, v) => lockedOptions(card, item, (v && v.ks) || []),
  checklist: lockedSteps,
  list: lockedRows,
  recap: lockedSummary,
  review: lockedSummary,
};

/**
 * "Something else" as a real option in the radio group, for a single-choice
 * question.
 *
 * It used to be a plain field below the list, and typing in it MERGED the text
 * into whatever was already picked: choosing A and then writing why A is wrong
 * sent `a; A is wrong`, the pick first, the contradiction second. Nothing on
 * screen said that would happen, and the field's own words ("if none of the
 * above fit") promise the opposite.
 *
 * On a one-answer question these are alternatives, so they share a radio group
 * and the last thing touched wins. Qualifying a pick has its own home: the note
 * box beside the question, which travels as a comment rather than an answer.
 *
 * `multi` keeps the additive field below, where naming a third thing alongside
 * two ticked boxes is exactly right.
 */
function otherOption(list, item, staged, name) {
  if (item.allowOther === false) return;
  const id = "other-" + item.id;
  const on = Boolean(staged && !staged.k && staged.text);
  const li = el("li", "option is-other" + (on ? " is-picked" : ""));

  const radio = el("input");
  radio.type = "radio";
  radio.name = name;
  radio.checked = on;
  radio.setAttribute("aria-label", "Something else, in your own words");

  const body = el("div", "option-body");
  const head = el("div", "option-label");
  const label = el("label", null, "Something else, in your own words");
  label.htmlFor = id;
  head.appendChild(label);
  body.appendChild(head);

  const ta = el("textarea", "other-text");
  ta.id = id;
  ta.placeholder = "If none of the above fit, say what does.";
  // A draft survives picking a listed option, so switching back and forth
  // never costs someone the sentence they already wrote.
  ta.value = (on && staged.text) || page.local.drafts[id] || "";

  // Repaint the row highlights without a full render, which would rebuild this
  // textarea mid-keystroke. Setting the radio marks the rest of the group off
  // by itself; only the `is-picked` classes need saying out loud.
  const pick = (chosen) => {
    for (const node of list.children) node.classList.toggle("is-picked", node === chosen);
    // The quiet path never re-renders, so the growing box follows the pick here.
    markGrowBox(list.closest(".card"));
    fitGrowBox();
  };

  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    const v = ta.value.trim();
    if (v) {
      radio.checked = true;
      pick(li);
      stageQuiet(item.id, choiceAnswer({ text: v }));
    } else {
      radio.checked = false;
      pick(null);
      const cur = page.local.staged[item.id];
      if (cur && !cur.k) stageQuiet(item.id, null);
    }
    stagedChanged();
  });

  radio.addEventListener("change", () => {
    const v = ta.value.trim();
    pick(li);
    // Nothing written yet: drop the previous pick, since they have just said it
    // was not the answer, and put the cursor where the answer now goes.
    stageQuiet(item.id, choiceAnswer({ text: v }));
    stagedChanged();
    ta.focus();
  });

  body.appendChild(ta);
  li.appendChild(radio);
  li.appendChild(body);
  list.appendChild(li);
}

// The additive twin of otherOption, and the only caller left is `multi`, where
// naming a third thing alongside two ticked boxes is the point. The wording has
// to say that: "if none of the above fit" is the single-choice promise, and it
// would be a lie here, where what you write joins the ticks rather than
// replacing them.
function otherField(card, item, staged) {
  if (item.allowOther === false) return;
  const wrap = el("div", "field");
  const id = "other-" + item.id;
  const label = el("label", null, "Anything else, in your own words");
  label.htmlFor = id;
  wrap.appendChild(label);
  const ta = el("textarea");
  ta.id = id;
  ta.placeholder = "Optional. This adds to the ones you picked above; it does not replace them.";
  ta.value = (staged && staged.text) || page.local.drafts[id] || "";
  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    const cur = page.local.staged[item.id];
    if (ta.value.trim()) {
      stageQuiet(item.id, { ...(cur || { type: "answer", kind: item.kind }), text: ta.value.trim() });
    } else if (cur && cur.text) {
      const { text, ...rest } = cur;
      if (rest.k || (rest.ks && rest.ks.length)) stageQuiet(item.id, rest);
      else stageQuiet(item.id, null);
    }
    stagedChanged();
  });
  wrap.appendChild(ta);
  card.appendChild(wrap);
}

// Everything that has to catch up after a staged answer changed WITHOUT a full
// render, which is the path every text field takes.
//
// A full render is not an option here: renderMain() empties the column with
// replaceChildren(), and emptying a scrolled container resets its scrollTop, so
// the page would jump to the top on every keystroke. The pieces below are the
// ones that depend on a staged answer and hold no input, so they can be rebuilt
// mid-keystroke safely. Leaving them out is how the card sat with no border and
// the pager kept pointing the wrong way while the footer said "1 ready".
function stagedChanged() {
  hooks.renderFooter();
  hooks.renderSidebar();
  renderStagedMarks();
}

// The topic line, and the one pill that says where this question has got to.
function fillKicker(kicker, item) {
  const topic = topics().find((t) => t.id === item.topic);
  kicker.replaceChildren(document.createTextNode(topic ? topic.title : "Question"));

  let pill = null;
  if (!isOpen(item)) pill = el("span", "pill done", item.status === "skipped" ? "Skipped" : "Answered");
  // Frozen on a finished session: the send it carries is the record, and a
  // staged leftover can no longer be sent, so it earns no pill.
  else if (finish()) pill = recordedAnswer(item) ? el("span", "pill done", "Sent") : null;
  else if (page.local.staged[item.id]) pill = el("span", "pill staged", "Ready to send");
  else if ((page.local.sent && page.local.sent[item.id]) || submittedInFlight(item))
    pill = el("span", "pill staged", "Sent");
  if (!pill) return;
  pill.style.marginLeft = "8px";
  kicker.appendChild(pill);
}

function renderStagedMarks() {
  const item = byId(page.selected);
  if (!item || !cardMarks || cardMarks.id !== item.id || !cardMarks.card.isConnected) return;
  cardMarks.card.classList.toggle("is-staged", isOpen(item) && !finish() && Boolean(page.local.staged[item.id]));
  fillKicker(cardMarks.kicker, item);

  const main = $("main");
  const shown = main.querySelector(".pager");
  const next = buildPager(item);
  if (shown && next) shown.replaceWith(next);
  else if (shown) shown.remove();
  else if (next) {
    // Under its card, not under whatever follows it (the git board).
    const card = main.querySelector(":scope > .card, :scope > .git-board > .git-cards > .card");
    if (card) card.after(next);
    else main.appendChild(next);
  }
}

// Update staged state without a full re-render, so typing is never interrupted.
function stageQuiet(id, value) {
  if (value == null) delete page.local.staged[id];
  else page.local.staged[id] = value;
  saveNow();
}

// The next answer for a click, carrying over the words typed on the card. Note
// boxes stage quietly, without a render, so the `staged` a builder closed over
// at render time can be missing everything typed since: read the live answer
// when the click lands instead. A click that clears the pick while text is
// still in the box keeps the text as a note on its own (`bare`), the same shape
// the note box stages when nothing is picked.
function withNote(item, value, bare = { type: "answer", kind: item.kind }) {
  const cur = page.local.staged[item.id];
  const text = cur && cur.text;
  if (!text) return value;
  return value ? { ...value, text } : { ...bare, text };
}

// Unique per question and option, and the same on every render.
const optionId = (item, o, i) => `pick-${item.id}-${o.k || i}`;

function buildChoice(card, item, staged) {
  const list = el("ul", "options");
  const name = "opt-" + item.id;
  for (const [i, o] of (item.options || []).entries()) {
    const picked = staged && staged.k === o.k;
    const li = el("li", "option" + (picked ? " is-picked" : ""));
    const label = el("label");
    label.style.display = "contents";

    const radio = el("input");
    radio.type = "radio";
    radio.name = name;
    // An id so the control survives the render its own change() sets off:
    // withFocus finds the focused input by id and has nothing to go on without
    // one. Stable across renders because it is built from the question and the
    // option, not from a counter.
    radio.id = optionId(item, o, i);
    radio.value = o.k;
    radio.checked = Boolean(picked);
    // Without this the group reads out as "A", "B", "on": the letter is the
    // label's whole text content, and the last one has no label at all.
    radio.setAttribute("aria-label", o.k ? `${o.k}: ${o.text}` : o.text);
    // choiceAnswer drops any text that was typed below. On a one-answer
    // question a listed option and something in your own words are
    // alternatives, and sending both hands the agent an answer that argues
    // with itself.
    radio.addEventListener("change", () => stage(item.id, choiceAnswer({ k: o.k })));

    const body = el("div", "option-body");
    const head = el("div", "option-label");
    if (showKey(o.k, o.text)) head.appendChild(el("span", "option-key", o.k));
    head.appendChild(el("span", null, o.text));
    if (o.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));

    label.appendChild(radio);
    label.appendChild(body);
    li.appendChild(label);
    list.appendChild(li);
  }
  otherOption(list, item, staged, name);
  card.appendChild(list);
}

function buildMulti(card, item, staged) {
  const chosen = new Set((staged && staged.ks) || []);
  const list = el("ul", "options");
  for (const [i, o] of (item.options || []).entries()) {
    const on = chosen.has(o.k);
    const li = el("li", "option" + (on ? " is-picked" : ""));
    const label = el("label");
    label.style.display = "contents";

    const box = el("input");
    box.type = "checkbox";
    box.id = optionId(item, o, i);
    box.value = o.k;
    box.checked = on;
    box.setAttribute("aria-label", o.k ? `${o.k}: ${o.text}` : o.text);
    box.addEventListener("change", () => {
      const cur = page.local.staged[item.id];
      const next = new Set((cur && cur.ks) || []);
      if (box.checked) next.add(o.k);
      else next.delete(o.k);
      // Unticking the last box keeps what is written in "Anything else".
      stage(
        item.id,
        withNote(item, next.size ? { type: "answer", kind: "multi", ks: [...next] } : null, {
          type: "answer",
          kind: "multi",
          ks: [],
        })
      );
    });

    const body = el("div", "option-body");
    const head = el("div", "option-label");
    if (showKey(o.k, o.text)) head.appendChild(el("span", "option-key", o.k));
    head.appendChild(el("span", null, o.text));
    if (o.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));

    label.appendChild(box);
    label.appendChild(body);
    li.appendChild(label);
    list.appendChild(li);
  }
  card.appendChild(list);
  card.appendChild(el("p", "help", "Pick as many as apply."));
  renderPresets(card, item, staged);
  otherField(card, item, staged);
}

// Shortcuts that tick a named set in one go, for a long list where the usual
// answers are groups ("the serious ones", "all of them"): the review's fix
// list is the case it exists for. A preset only ticks boxes. The answer is
// still the ticks, so they can adjust after pressing one, and what reaches the
// agent is the same list it would have got from ticking by hand.
function renderPresets(card, item, staged) {
  const known = new Set((item.options || []).map((o) => o.k));
  const presets = (Array.isArray(item.presets) ? item.presets : [])
    .map((p) => ({ label: String((p && p.label) || "").trim(), ks: ((p && p.ks) || []).filter((k) => known.has(k)) }))
    .filter((p) => p.label && p.ks.length);
  if (!presets.length) return;
  const row = el("div", "btn-row presets");
  row.appendChild(el("span", "presets-label", "Quick pick:"));
  const now = new Set((staged && staged.ks) || []);
  for (const p of presets) {
    const on = p.ks.length === now.size && p.ks.every((k) => now.has(k));
    const b = el("button", "btn small" + (on ? " primary" : " ghost"), p.label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", () =>
      stage(
        item.id,
        withNote(item, on ? null : { type: "answer", kind: "multi", ks: [...p.ks] }, {
          type: "answer",
          kind: "multi",
          ks: [],
        })
      )
    );
    row.appendChild(b);
  }
  card.appendChild(row);
}

function buildText(card, item, staged) {
  const wrap = el("div", "field");
  const id = "text-" + item.id;
  const head = el("div", "field-head");
  const label = el("label", null, item.inputLabel || "Your answer");
  label.htmlFor = id;
  head.appendChild(label);
  wrap.appendChild(head);

  // Compiled once, here: a pattern that does not compile is treated as no
  // pattern at all, rather than throwing on every keystroke (and on Autofill)
  // and leaving the answer impossible to stage.
  let pattern = null;
  if (item.pattern) {
    try {
      pattern = new RegExp(item.pattern);
    } catch {}
  }
  const single = Boolean(pattern);
  const input = el(single ? "input" : "textarea");
  if (single) input.type = "text";
  input.id = id;
  input.placeholder = item.placeholder || "Type here. Plain language is fine.";
  input.value = (staged && staged.text) || page.local.drafts[id] || "";
  attachMentions(input);

  const err = el("p", "field-error");
  err.hidden = true;

  const suggestion = suggestionFrom(item);
  let fill = null;

  const check = () => {
    setDraft(id, input.value);
    // The offer only stands while the box is empty. Overwriting something
    // someone typed, from a button they meant to read rather than press, is
    // exactly the kind of loss this page is built to avoid.
    if (fill) fill.hidden = Boolean(input.value.trim());
    const v = input.value.trim();
    if (pattern && v) {
      // Live validation a terminal simply cannot do. Most often a kebab-case name.
      const ok = pattern.test(v);
      input.classList.toggle("invalid", !ok);
      err.hidden = ok;
      err.textContent = item.patternHint || "That is not a valid value.";
      if (!ok) {
        stageQuiet(item.id, null);
        stagedChanged();
        return;
      }
    } else {
      input.classList.remove("invalid");
      err.hidden = true;
    }
    stageQuiet(item.id, v ? { type: "answer", kind: "text", text: v } : null);
    stagedChanged();
  };
  input.addEventListener("input", check);

  if (suggestion) {
    fill = el("button", "btn tiny", "Autofill suggestion");
    fill.type = "button";
    fill.title = "Put the example into the box. It is yours to edit from there.";
    fill.hidden = Boolean(input.value.trim());
    fill.addEventListener("click", () => {
      input.value = suggestion;
      check();
      input.focus();
      try {
        input.setSelectionRange(suggestion.length, suggestion.length);
      } catch {}
    });
    head.appendChild(fill);
  }

  if (item.templates === "idea" && TEMPLATE_WORKFLOWS.includes(page.S.workflow)) {
    wrap.appendChild(templateRow(item, input, templatesFor(page.S.workflow, looks.role), check));
  }
  wrap.appendChild(input);
  // Fresh-idea boxes take files as context, the same ones the note pane holds,
  // and so does any box the page fills from a Notebook tab (Revise plan's
  // "What should change"), whose ticked pictures land here.
  if (!single && (TEMPLATE_WORKFLOWS.includes(page.S.workflow) || item.fill === "note")) {
    input.addEventListener("paste", (e) => {
      const files = incomingFiles(e.clipboardData && e.clipboardData.files);
      if (!files.length) return;
      if (!e.clipboardData.getData("text/plain")) e.preventDefault();
      attachFiles(item.id, files);
    });
    const under = attachRow(item.id, "Add files to this answer");
    under.classList.add("is-under");
    wrap.appendChild(under);
    const attached = noteImages(item.id);
    if (attached.length) wrap.appendChild(attachTray(item.id, attached));
  }
  if (item.help) wrap.appendChild(el("p", "help", item.help));
  wrap.appendChild(err);
  card.appendChild(wrap);
}

// The starter templates above a fresh-idea box. The chip choice lives only in
// local.drafts: what gets staged and sent is the box's text, never the id.
function templateRow(item, input, entries, check) {
  const key = "tpl-" + item.id;
  const row = el("div", "tpl-row");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Starter templates");
  let strip = null;

  const selectedEntry = () => entries.find((e) => e.id === page.local.drafts[key]) || entries[0];
  // The strip changes the card's height without resizing the column, so the
  // column's observer never hears of it: refit the growing box here.
  const dropStrip = () => {
    if (!strip) return;
    strip.remove();
    strip = null;
    fitGrowBox();
  };
  const chips = entries.map((entry) => {
    const chip = el("button", "tpl-chip", entry.label);
    chip.type = "button";
    if (entry.forYou) chip.appendChild(el("span", "tpl-pill", "For your role"));
    chip.addEventListener("click", () => pick(entry));
    row.appendChild(chip);
    return chip;
  });
  const paint = () => {
    const selected = selectedEntry();
    chips.forEach((chip, i) => chip.setAttribute("aria-pressed", String(entries[i] === selected)));
  };

  const apply = (entry, text) => {
    dropStrip();
    input.value = text;
    page.local.drafts[key] = entry.id;
    check();
    saveNow();
    paint();
    input.focus();
    const start = text.indexOf("[");
    const end = start < 0 ? -1 : text.indexOf("]", start);
    try {
      if (end > start) input.setSelectionRange(start, end + 1);
      else input.setSelectionRange(text.length, text.length);
    } catch {}
  };

  const pick = (entry) => {
    const selected = selectedEntry();
    if (entry === selected) return;
    const sw = templateSwap({ selectedText: selected.text, boxText: input.value, nextText: entry.text });
    if (!sw.confirm) {
      apply(entry, sw.text);
      return;
    }
    dropStrip();
    strip = el("div", "tpl-replace");
    strip.setAttribute("role", "alert");
    strip.appendChild(el("span", null, "Replace what you typed?"));
    const replace = el("button", "btn tiny primary", "Replace");
    replace.type = "button";
    replace.addEventListener("click", () => apply(entry, sw.text));
    const keep = el("button", "btn tiny ghost", "Keep mine");
    keep.type = "button";
    keep.addEventListener("click", () => {
      dropStrip();
      input.focus();
    });
    strip.append(replace, keep);
    row.after(strip);
    fitGrowBox();
  };

  paint();
  return row;
}

function buildConfirm(card, item, staged) {
  const row = el("div", "btn-row");
  const yesLabel = item.yesLabel || "Yes";
  const noLabel = item.noLabel || "No";

  // An unpicked yes is outlined in the accent, like a review's approve, unless
  // the card is dangerous: then it stays red.
  const mk = (label, yes, danger) => {
    const on = staged && staged.yes === yes;
    const b = el(
      "button",
      "btn" + (on ? " primary" : "") + (danger && !on ? " danger" : "") + (yes && !danger && !on ? " is-approve" : ""),
      label
    );
    b.type = "button";
    b.addEventListener("click", () =>
      stage(item.id, withNote(item, on ? null : { type: "answer", kind: "confirm", yes }))
    );
    return b;
  };
  row.appendChild(mk(yesLabel, true, item.danger));
  row.appendChild(mk(noLabel, false, false));
  card.appendChild(row);

  if (item.consequences) {
    // "is-consequences": the command here is what Yes runs, so no "paste it
    // into the Ask tab" nudge under it (app.css).
    const note = el("div", "card-note is-consequences");
    note.appendChild(md(item.consequences, "md"));
    card.appendChild(note);
  }
  if (Array.isArray(item.files) && item.files.length) card.appendChild(filesTable(item.files));
  commentField(card, item, "Anything to add?");
}

// A collapsed list of the files a confirm is about ({ path, state } rows), so
// "15 files" can be opened up and read before the person says yes.
function filesTable(files) {
  const box = el("details", "card-files");
  box.appendChild(el("summary", "", `Show the ${files.length} file${files.length === 1 ? "" : "s"}`));
  const table = el("table", "md-table");
  const head = el("tr");
  head.appendChild(el("th", "", "State"));
  head.appendChild(el("th", "", "File"));
  table.appendChild(head);
  for (const f of files) {
    if (!f || typeof f.path !== "string") continue;
    const row = el("tr");
    row.appendChild(el("td", "", typeof f.state === "string" ? f.state : ""));
    row.appendChild(el("td", "", f.path));
    table.appendChild(row);
  }
  box.appendChild(table);
  return box;
}

function buildRecap(card, item, staged) {
  // The recap is not optional: a click captured the pick, this captures the
  // agreement. Rendered as a document so it reads like a summary, not a form.
  if (item.summary) {
    const box = el("div", "card-note");
    box.appendChild(md(item.summary, "md"));
    card.appendChild(box);
  }
  const row = el("div", "btn-row");
  const okOn = staged && staged.ok === true;
  const fixOn = staged && staged.ok === false;

  const ok = el("button", "btn" + (okOn ? " primary" : " is-approve"), item.yesLabel || "Yes, that is right");
  ok.type = "button";
  ok.addEventListener("click", () => stage(item.id, okOn ? null : { type: "answer", kind: "recap", ok: true }));

  const fix = el("button", "btn" + (fixOn ? " primary" : ""), item.noLabel || "Not quite");
  fix.type = "button";
  fix.addEventListener("click", () =>
    stage(item.id, fixOn ? null : { type: "answer", kind: "recap", ok: false })
  );

  row.appendChild(ok);
  row.appendChild(fix);
  card.appendChild(row);

  if (fixOn) commentField(card, item, "What should it say instead?", true);
}

// A question that is about a document says so on the card, with a way to it.
// The tab row does the same job, but nobody reads a tab row as part of the
// question in front of them: people ticked the review's fix list blind, never
// having noticed the findings sat one tab over.
function docLink(item) {
  const doc = item.doc && docs().find((d) => d.id === item.doc);
  if (!doc) return null;
  const open = el("button", "btn small", `Read “${doc.title || "the document"}” in full`);
  open.type = "button";
  open.style.marginTop = "14px";
  open.addEventListener("click", () => {
    page.view = "doc:" + doc.id;
    redraw();
  });
  return open;
}

function buildReview(card, item, staged) {
  if (item.summary) {
    const box = el("div", "card-note");
    box.appendChild(md(item.summary, "md"));
    card.appendChild(box);
  }
  if (item.nothingYet !== false) {
    const safe = el("p", "help");
    safe.style.marginTop = "14px";
    safe.textContent =
      item.nothingYet || "Nothing has been changed yet. This only happens once you approve it.";
    card.appendChild(safe);
  }

  const verdicts = item.verdicts || [
    { id: "approve", label: "Looks good, go ahead" },
    { id: "changes", label: "I want changes" },
  ];
  const row = el("div", "btn-row");
  for (const v of verdicts) {
    const on = staged && staged.verdict === v.id;
    // A picked danger verdict stays red (filled), so choosing "Abort" never
    // reads like choosing the safe default. An unpicked approve or yes (Build
    // it, Archive it) is outlined in the accent, so the main way forward
    // stands out.
    const forward = v.id === "approve" || v.id === "yes";
    const b = el(
      "button",
      "btn" + (on ? (v.danger ? " danger is-on" : " primary") : v.danger ? " danger" : forward ? " is-approve" : ""),
      verdictText(v)
    );
    b.type = "button";
    b.addEventListener("click", () =>
      stage(item.id, withNote(item, on ? null : { type: "answer", kind: "review", verdict: v.id }))
    );
    row.appendChild(b);
  }
  card.appendChild(row);

  // Every gate in the workflow accepts "or describe any issues", so approval
  // and feedback are one submit, never two.
  commentField(card, item, "Notes, questions, or what to change");
}

function buildChecklist(card, item, staged) {
  const doneSet = new Set((staged && staged.done) || []);
  // Built from the live answer, so a note typed since the render rides along.
  // Nothing ticked, no state and no note is no answer at all: stage nothing
  // rather than an empty one that would still count as ready to send.
  const commitList = (change) => {
    const cur = page.local.staged[item.id];
    const next = { ...(cur || {}), type: "answer", kind: "checklist", ...change };
    // A tick or a state IS the answer, so it ends a skip staged earlier:
    // left in place, `skipped` would collapse the reply to "skip" while the
    // card showed ticked steps on their way.
    delete next.skipped;
    const empty = !(next.done && next.done.length) && !next.state && !next.text;
    stage(item.id, empty ? null : next);
  };
  const list = el("ol", "steps");
  (item.steps || []).forEach((step, i) => {
    const li = el("li", "step");
    const box = el("input");
    box.type = "checkbox";
    box.id = `step-${item.id}-${i}`;
    box.checked = doneSet.has(i);
    box.addEventListener("change", () => {
      const cur = page.local.staged[item.id];
      const next = new Set((cur && cur.done) || []);
      if (box.checked) next.add(i);
      else next.delete(i);
      commitList({ done: [...next] });
    });
    const label = el("label");
    label.htmlFor = box.id;
    label.style.flex = "1";
    label.appendChild(md(typeof step === "string" ? step : step.text, "md"));
    li.appendChild(el("span", "step-num", String(i + 1)));
    li.appendChild(box);
    li.appendChild(label);
    list.appendChild(li);
  });
  card.appendChild(list);

  const states = [
    { id: "done", label: "All done" },
    { id: "blocked", label: "I am stuck" },
    { id: "help", label: "I need help" },
    { id: "defer", label: "Later" },
  ];
  const row = el("div", "btn-row");
  for (const s of states) {
    const on = staged && staged.state === s.id;
    const b = el("button", "btn" + (on ? " primary" : ""), s.label);
    b.type = "button";
    b.addEventListener("click", () => commitList({ state: on ? null : s.id }));
    row.appendChild(b);
  }
  card.appendChild(row);
  commentField(card, item, item.valuesLabel || "Anything you were asked to write down");
}

function buildMenu(card, item, staged) {
  const list = el("ul", "options");
  const name = "menu-" + item.id;
  for (const [i, o] of (item.options || []).entries()) {
    const picked = staged && staged.k === o.k;
    const li = el("li", "option" + (picked ? " is-picked" : ""));
    const label = el("label");
    label.style.display = "contents";
    const radio = el("input");
    radio.type = "radio";
    radio.name = name;
    // The same id buildChoice gives its radios: withFocus finds the focused
    // input by id after the render this change() sets off, and without one a
    // keyboard user arrowing through the menu lands on <body> every time.
    radio.id = optionId(item, o, i);
    radio.value = o.k;
    radio.checked = Boolean(picked);
    // Under the app a fresh start is the bar's New Session, so say that.
    const text = page.inApp && o.fresh === true ? "Start New Session" : o.text;
    radio.setAttribute("aria-label", o.k ? `${o.k}: ${text}` : text);
    radio.addEventListener("change", () => stage(item.id, { type: "answer", kind: "menu", k: o.k }));
    const body = el("div", "option-body");
    const head = el("div", "option-label");
    head.appendChild(el("span", null, text));
    if (o.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));
    label.appendChild(radio);
    label.appendChild(body);
    li.appendChild(label);
    list.appendChild(li);
  }
  card.appendChild(list);

  if (item.command) {
    const note = el("div", "card-note");
    note.appendChild(el("p", "help", "To pick this up in a fresh session, run:"));
    note.appendChild(md("```\n" + handoffText({ command: item.command }) + "\n```", "md"));
    card.appendChild(note);
  }
}

function buildList(card, item, staged) {
  // Reorder, rename, remove. The agent proposed a breakdown; this is where a
  // person who knows the work fixes it before it becomes the plan.
  //
  // Every handler re-reads the rows at the moment it fires rather than closing
  // over the array from render time. A reorder replaces that array, so a stale
  // closure would quietly undo the reorder the next time a rename committed.
  // A name still being typed counts too: the tool buttons below keep the
  // field's focus (their mousedown is canceled), so its `change` has not
  // fired yet when they act, and the re-render would otherwise drop it.
  const ul = el("ul", "rows");
  const baseRows = () => {
    const cur = page.local.staged[item.id];
    return (cur && cur.rows) || (item.rows || []).map((r) => ({ ...r }));
  };
  const liveRows = () =>
    baseRows().map((r) => {
      const input = ul.querySelector(`input.row-title[data-row="${CSS.escape(String(r.id))}"]`);
      const typed = input ? input.value.trim() : null;
      return typed != null && typed !== r.title ? { ...r, title: typed } : r;
    });
  const rows = liveRows();
  // The first click on a tool after a rename used to land on a node the
  // rename's re-render had already replaced, and do nothing.
  const keepFocus = (b) => b.addEventListener("mousedown", (e) => e.preventDefault());
  let dragIndex = null;

  const commit = (next) => stage(item.id, withNote(item, { type: "answer", kind: "list", rows: next }));

  rows.forEach((row, i) => {
    const li = el("li", "row-item");
    li.draggable = true;

    li.addEventListener("dragstart", () => {
      dragIndex = i;
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      li.classList.add("drop-target");
    });
    li.addEventListener("dragleave", () => li.classList.remove("drop-target"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drop-target");
      if (dragIndex === null || dragIndex === i) return;
      const next = liveRows();
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      commit(next);
    });

    const handle = el("button", "row-handle", "⠿");
    handle.type = "button";
    handle.title = "Drag to reorder";
    handle.setAttribute("aria-label", `Move “${row.title}”`);
    li.appendChild(handle);
    li.appendChild(el("span", "row-order", String(i + 1)));

    const main = el("div", "row-main");
    // A real input rather than contenteditable: it is reachable by keyboard and
    // by a screen reader, it has a stable id so withFocus() can restore the
    // caret across a re-render, and `change` fires only when the value actually
    // changed, which stops a rename from re-entering render on every blur.
    const title = el("input", "row-title");
    title.type = "text";
    title.id = `row-${item.id}-${row.id}`;
    title.value = row.title || "";
    title.setAttribute("aria-label", "Name");
    title.dataset.row = String(row.id);
    // Staged as it is typed (quietly, no re-render, so the caret stays): a
    // Ctrl+Enter, a Send, or an agent post landing mid-word all see the new
    // name, where `change` alone only fired on blur and they did not.
    title.addEventListener("input", () => {
      const next = baseRows();
      const at = next.findIndex((r) => r.id === row.id);
      if (at === -1) return;
      next[at] = { ...next[at], title: title.value.trim() };
      const untouched =
        next.length === (item.rows || []).length && next.every((r, i) => r.id === item.rows[i].id && r.title === item.rows[i].title);
      stageQuiet(item.id, untouched && !page.local.staged[item.id] ? null : withNote(item, { type: "answer", kind: "list", rows: next }));
      hooks.renderFooter();
      renderStagedMarks();
    });
    title.addEventListener("change", () => {
      const next = baseRows();
      const at = next.findIndex((r) => r.id === row.id);
      if (at === -1) return;
      const value = title.value.trim();
      if (value === next[at].title) return;
      next[at] = { ...next[at], title: value };
      commit(next);
    });
    main.appendChild(title);
    if (row.body) main.appendChild(el("div", "row-body", row.body));
    li.appendChild(main);

    const tools = el("div", "row-tools");
    const up = el("button", "btn ghost small", "↑");
    up.type = "button";
    up.title = "Move up";
    up.disabled = i === 0;
    up.addEventListener("click", () => {
      const next = liveRows();
      const at = next.findIndex((r) => r.id === row.id);
      if (at <= 0) return;
      [next[at - 1], next[at]] = [next[at], next[at - 1]];
      commit(next);
    });
    const down = el("button", "btn ghost small", "↓");
    down.type = "button";
    down.title = "Move down";
    down.disabled = i === rows.length - 1;
    down.addEventListener("click", () => {
      const next = liveRows();
      const at = next.findIndex((r) => r.id === row.id);
      if (at === -1 || at === next.length - 1) return;
      [next[at + 1], next[at]] = [next[at], next[at + 1]];
      commit(next);
    });
    const del = el("button", "btn ghost small", "×");
    del.type = "button";
    del.title = "Remove";
    del.setAttribute("aria-label", `Remove “${row.title}”`);
    del.addEventListener("click", () => commit(liveRows().filter((r) => r.id !== row.id)));
    up.setAttribute("aria-label", `Move “${row.title}” up`);
    down.setAttribute("aria-label", `Move “${row.title}” down`);
    for (const b of [up, down, del]) keepFocus(b);
    tools.appendChild(up);
    tools.appendChild(down);
    tools.appendChild(del);
    li.appendChild(tools);

    ul.appendChild(li);
  });
  card.appendChild(ul);

  const row = el("div", "btn-row");
  const add = el("button", "btn small", "Add one");
  add.type = "button";
  keepFocus(add);
  add.addEventListener("click", () =>
    commit([...liveRows(), { id: "new-" + Date.now(), title: "New item", body: "" }])
  );
  row.appendChild(add);
  if (staged) {
    const reset = el("button", "linky", "Put it back how it was");
    reset.type = "button";
    // Puts the rows back; a note typed below stays.
    reset.addEventListener("click", () => stage(item.id, withNote(item, null)));
    row.appendChild(reset);
  }
  card.appendChild(row);
  card.appendChild(el("p", "help", "Drag to reorder, click a name to rename it."));
  const quick = [{ label: "No changes", text: "no changes" }];
  // Only a plan's breakdown is phases; a list card elsewhere is something else.
  if (PHASE_WORKFLOWS.includes(page.S.workflow)) quick.push({ label: "Combine phases", text: COMBINE_PHASES });
  commentField(card, item, "Anything else about this breakdown?", false, quick);
}

const PHASE_WORKFLOWS = ["plan", "revise-plan"];
const COMBINE_PHASES =
  "Combine phases where possible to simplify and reduce the total number of phases, while still keeping a clear separation of concerns.";

function commentField(card, item, labelText, required, quickAnswers = []) {
  const wrap = el("div", "field");
  const id = "note-" + item.id;
  const label = el("label", null, labelText);
  label.htmlFor = id;
  wrap.appendChild(label);
  const quicks = quickAnswers.map(({ label, text }) => {
    const b = el("button", "btn tiny quick-answer", label);
    b.type = "button";
    b.title = "Fill in \"" + text + "\"";
    wrap.appendChild(b);
    return [b, text];
  });
  const ta = el("textarea");
  ta.id = id;
  ta.placeholder = required ? "Tell Plan2Code what to change." : "Optional.";
  ta.value = (page.local.staged[item.id] && page.local.staged[item.id].text) || page.local.drafts[id] || "";
  attachMentions(ta);
  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    const cur = page.local.staged[item.id];
    if (cur) {
      const next = { ...cur, text: ta.value.trim() || undefined };
      // Emptying the box of a note-only answer leaves nothing to send, so it
      // unstages rather than counting as ready.
      const empty = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
      const bare = Object.keys(next).every((k) => k === "type" || k === "kind" || empty(next[k]));
      stageQuiet(item.id, bare ? null : next);
    } else if (ta.value.trim())
      stageQuiet(item.id, { type: "answer", kind: item.kind, text: ta.value.trim() });
    stagedChanged();
  });
  wrap.appendChild(ta);
  for (const [b, text] of quicks)
    b.addEventListener("click", () => {
      ta.value = text;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.focus();
    });
  card.appendChild(wrap);
}

// Every builder above may assume its question is OPEN and has no answer in
// flight. renderCard is the only caller and routes the other two states to
// renderSettled and renderInFlight, which draw a record rather than a form.
// The builders used to carry their own half of that job, in `!isOpen` branches
// that no longer run; keeping them would have meant two renderings of a settled
// answer, one of them untested and wrong.
const BUILDERS = {
  choice: buildChoice,
  multi: buildMulti,
  text: buildText,
  confirm: buildConfirm,
  recap: buildRecap,
  review: buildReview,
  checklist: buildChecklist,
  menu: buildMenu,
  list: buildList,
};

// The listeners that keep the cards honest, wired once at start-up: the fade at
// a card's cut edge, the growing note box, and taking back a pending skip.
export function wireCards() {
  $("main").addEventListener("scroll", markMore, { capture: true, passive: true });
  growObserver?.observe($("main"));
  document.addEventListener("pointerdown", cancelSkipMove, true);
  document.addEventListener("keydown", cancelSkipMove, true);
}
