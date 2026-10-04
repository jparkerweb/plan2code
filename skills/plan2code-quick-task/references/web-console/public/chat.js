// Plan2Code Web Console - the Quick question chat's shared rules.
//
// Imported by the server (its guards) and by the page (its composer), so the
// two can never disagree about a limit. No DOM access at module scope, and no
// imports but answers.js: the server and `node --test` import this file too.

import { MAX_ATTACHMENTS, STALE_MS, quietLimitMs } from "./answers.js";

// Typed messages per conversation. Approve / Decline and resets never count.
export const CHAT_LIMIT = 10;
export const CHAT_MAX_CHARS = 4000;
// Images and documents together. The old name stays for existing imports.
export const CHAT_MAX_ATTACHMENTS = MAX_ATTACHMENTS;
export const CHAT_MAX_IMAGES = CHAT_MAX_ATTACHMENTS;

export const CHAT_LIMIT_TEXT = "That's 10 questions in this conversation — start a new one to keep going.";
export const CHAT_OFFLINE_TEXT = "No agent available — wait for one to become available (your terminal might be working on a task or waiting a permission approval)";
export const CHAT_LAST_WAIT_TEXT = "That was the last question in this conversation — its answer will land here.";
export const CHAT_WAITING_TEXT = "Plan2Code will answer at its next check-in";
export const CHAT_WORKING_TEXT = "Plan2Code is working on the answer…";

const EMPTY_CHAT = { conversation: 0, messages: [], typed: 0, limit: CHAT_LIMIT, offline: false, pickedUp: 0 };
const chatOf = (frameChat) => ({ ...EMPTY_CHAT, ...(frameChat || {}) });

// Person messages in the frame, each marked with whether an agent reply comes
// after it. The server puts a reply straight after the entry it answers, so a
// reply further down also covers the follow-ups sent before it.
function answeredFlags(messages) {
  const flags = new Map();
  let replyLater = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.from === "agent") replyLater = true;
    else if (m.kind === "message") flags.set(m.seq, replyLater);
  }
  return flags;
}

/**
 * What the Ask pane draws, in order: the conversation from the frame, then
 * any send of this page's the server has not echoed yet.
 */
export function chatView(frameChat, ui = {}) {
  const chat = chatOf(frameChat);
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  const answered = answeredFlags(messages);
  const decisions = new Map(
    messages.filter((m) => m.from === "person" && m.kind === "decision").map((m) => [m.re, m.decision])
  );
  const activity = typeof ui.agentActivity === "string" ? ui.agentActivity.trim() : "";
  // The last seq the agent collected: an unanswered message at or below it is
  // in the agent's hands, not still waiting for a check-in.
  const pickedUp = Number.isInteger(chat.pickedUp) ? chat.pickedUp : 0;
  const rows = [];
  for (const m of messages) {
    if (m.from === "agent") {
      rows.push({
        kind: "agent",
        id: m.id,
        md: m.md,
        proposal: m.proposal || null,
        changed: m.changed || null,
        decided: decisions.get(m.id) || null,
      });
    } else if (m.kind === "decision") {
      rows.push({ kind: "decision", decision: m.decision, text: m.text || "", re: m.re });
    } else if (m.kind === "message") {
      const row = {
        kind: "person",
        seq: m.seq,
        text: m.text,
        about: m.about || null,
        images: m.images || [],
        files: m.files || [],
      };
      if (!answered.get(m.seq)) {
        row.waiting = true;
        row.working = m.seq <= pickedUp;
        row.waitingText = row.working ? CHAT_WORKING_TEXT : CHAT_WAITING_TEXT;
        if (activity) row.activity = activity;
      }
      rows.push(row);
    }
  }

  // A pending send is echoed once the server has it: by the seq its POST came
  // back with, or, while that response is still on its way, by its text
  // against a server message no other pending send has claimed.
  const serverPerson = messages.filter((m) => m.from === "person" && m.kind === "message");
  const serverSeqs = new Set(serverPerson.map((m) => m.seq));
  const claimed = new Set((ui.pendingSends || []).filter((p) => p.seq).map((p) => p.seq));
  for (const p of ui.pendingSends || []) {
    if (p.seq) {
      if (serverSeqs.has(p.seq)) continue;
    } else {
      const echo = serverPerson.find((m) => m.text === p.text && !claimed.has(m.seq));
      if (echo) {
        claimed.add(echo.seq);
        continue;
      }
    }
    rows.push({
      kind: "person",
      pending: true,
      tempId: p.tempId,
      text: p.text,
      about: p.about || null,
      images: p.images || [],
      files: p.files || [],
      failed: Boolean(p.failed),
    });
  }

  return {
    conversation: chat.conversation,
    rows,
    counterText: `${chat.typed} of ${chat.limit}`,
    typed: chat.typed,
    limit: chat.limit,
  };
}

/**
 * Whether the composer can take a message, and what to say when it cannot.
 * Offline first, so a finished page never talks about the limit. The limit
 * lands once the 10th question is answered; until then the 10th is simply
 * waiting, and nothing more can be typed.
 */
export function sendState({ frameChat, gone, pendingSendCount = 0 }) {
  const chat = chatOf(frameChat);
  if (chat.offline || gone) return { state: "offline", text: CHAT_OFFLINE_TEXT, canType: false };
  if (chat.typed + pendingSendCount >= chat.limit) {
    const allAnswered = pendingSendCount === 0 && [...answeredFlags(chat.messages || []).values()].every(Boolean);
    if (allAnswered) return { state: "limit", text: CHAT_LIMIT_TEXT, canType: false };
    return { state: "ok", text: CHAT_LAST_WAIT_TEXT, canType: false };
  }
  return { state: "ok", text: "", canType: true };
}

const ABOUT_HISTORY = 3;

/**
 * What a message is about, attached on purpose. Visiting a question card, doc
 * section or spec only records it in `history` (the last 3 places, newest
 * first, one entry per place); `about` is set only when the person picks one
 * from + Add context, and × or a send clears it.
 *
 * The tracker is `{ history, about }`; each entry and `about` are
 * `{ kind, id, label }` (`about` may be null), in the exact shape POST /chat
 * takes. An old `{ about, frozen, dropped }` tracker normalises to an empty
 * history.
 */
export function nextAbout(prev, event) {
  const p = prev || {};
  const state = { history: Array.isArray(p.history) ? [...p.history] : [], about: p.about ?? null };
  const visit = (entry) => ({
    ...state,
    history: [entry, ...state.history.filter((h) => h.kind !== entry.kind || h.id !== entry.id)].slice(0, ABOUT_HISTORY),
  });
  switch (event && event.type) {
    case "card":
      return visit({ kind: "card", id: String(event.id), label: String(event.label || "") });
    case "section":
      return visit({ kind: "section", id: `${event.docId}#${event.blockId}`, label: String(event.label || "") });
    case "spec":
      return visit({ kind: "spec", id: String(event.dir), label: String(event.label || "") });
    case "pick":
      return event.about ? { ...state, about: event.about } : state;
    case "drop":
    case "sent":
      return { ...state, about: null };
    default:
      return state;
  }
}

// What + Add context lists: the recent places, then "This spec" unless it is
// already one of them.
export function contextOptions(state, spec) {
  const options = [...((state && state.history) || [])];
  if (spec && spec.dir && !options.some((o) => o.kind === "spec" && o.id === spec.dir)) {
    options.push({ kind: "spec", id: spec.dir, label: "This spec" });
  }
  return options;
}

const newestReply = (frameChat) => {
  const messages = chatOf(frameChat).messages || [];
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from === "agent") return messages[i];
  return null;
};

// The Ask tab's dot: a reply landed that the person has not seen.
export function unreadDot({ lastSeenReplyId, frameChat, viewIsAsk }) {
  if (viewIsAsk) return false;
  const reply = newestReply(frameChat);
  return Boolean(reply) && reply.id !== lastSeenReplyId;
}

export function newestReplyId(frameChat) {
  const reply = newestReply(frameChat);
  return reply ? reply.id : null;
}

// One chime per reply: only the moment the dot appears.
export function shouldChime(prevDot, nextDot) {
  return !prevDot && Boolean(nextDot);
}

// The page's own "has drifted away" threshold for an agent that is waiting.
const ADRIFT_MS = 3 * 60 * 1000;

/**
 * Whether nobody is there to answer a chat message. A finished session's agent
 * is often still listening through its last wait (the review and dashboard
 * buttons on the hand-off card live as long as it does), so finish alone does
 * not end the chat — going quiet does. Offline once the agent has been silent
 * longer than the page would tolerate before calling it stuck (working) or
 * adrift (anything else), which is also the only signal left once the server
 * is gone.
 */
export function chatOffline({ finish, agent, agentLastSeenMs, now }) {
  const silent = now - agentLastSeenMs;
  if (agent && agent.status === "working") return silent > quietLimitMs(agent, STALE_MS);
  return silent > quietLimitMs(agent, ADRIFT_MS);
}
