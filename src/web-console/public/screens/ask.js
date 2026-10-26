// Plan2Code Web Console - the Ask chat, the Subagents tab, and attaching files to notes.

import { page, saveNow, redraw, freshChat, hooks, scrollMemory, setDraft } from "../state.js";
import { chatOffline, chatView, sendState as chatSendState, newestReplyId, CHAT_MAX_CHARS, nextAbout, CHAT_MAX_ATTACHMENTS, contextOptions } from "../chat.js";
import { finish, activity, agentAdrift, isDashboard, selSpec, byId, isOpen } from "../selectors.js";
import { el, md, isMac, lightDismiss, shortTime } from "../render.js";
import { startersFor } from "../starters.js";
import { looks } from "../looks.js";
import { thumbs, uploadUrl, docChip, attachTray, CHAT_IMAGES, attachFiles, incomingFiles, deleteUrl, sentAttachments, noteImages, attachRow } from "../uploads.js";
import { attachMentions } from "../mention-box.js";
import { pickerAccept, attachmentKind, noteAwaiting, threadWho, threadText } from "../answers.js";
import { postJson } from "../net.js";
import { CHECKIN_LINE, helperRows, showSwitch, switchLabel, defaultInstruction, PATHFINDER_RESEARCH_LINE, STRENGTHS, DEFAULT_STRENGTH, STRENGTH_HELP } from "../subagents.js";

const $ = (id) => document.getElementById(id);

// The Quick question chat's page-local state, gone on a reload (the frame's
// own `chat` block, the Ask tab's dot and the rest are on `page`, state.js).
let chatSending = false;

let chatResetting = false;

let askPaintedOffline = false;

export const declineOpen = new Map();

const deciding = new Set();

// The frame's chat block, with `offline` worked out now rather than when the
// frame was sent: the agent comes and goes between frames, and /ping keeps
// agentLastSeen current. The frame's own verdict stands when there is no clock.
function askFrame() {
  const base = page.chatFrame || { conversation: 0, messages: [], typed: 0, limit: 10, offline: false };
  if (!page.S || !page.agentLastSeen) return base;
  const offline = chatOffline({
    finish: finish(),
    agent: page.S.agent,
    agentLastSeenMs: Date.parse(page.agentLastSeen),
    now: Date.now(),
  });
  return { ...base, offline };
}

export function askState() {
  const frame = askFrame();
  const shown = chatView(frame, { pendingSends: page.local.chat.pending, agentActivity: activity() });
  const pendingSendCount = shown.rows.filter((r) => r.pending && !r.failed).length;
  return { frame, view: shown, send: chatSendState({ frameChat: frame, gone: page.gone, pendingSendCount }) };
}

// The conversation a send belongs to. The page's own record wins over the
// frame for the moment after a 409 stale, before the new frame lands.
const askConversation = () => page.local.chat.conversation ?? askFrame().conversation;

export function renderAsk(main) {
  const { frame, view: v, send: ss } = askState();
  // Anything drawn here has been seen: no dot for it later.
  const newest = newestReplyId(frame);
  if (newest && page.local.chat.lastSeenReplyId !== newest) {
    page.local.chat.lastSeenReplyId = newest;
    saveNow();
  }
  page.chatDot = false;
  askPaintedOffline = ss.state === "offline";

  const pane = el("section", "ask-pane");
  const head = el("div", "ask-head");
  head.appendChild(el("h2", null, "Quick question"));
  head.appendChild(el("span", "ask-counter", v.counterText));
  const reset = el("button", "btn small ghost", "New conversation");
  reset.type = "button";
  reset.disabled = ss.state === "offline" || chatResetting;
  reset.addEventListener("click", newConversation);
  head.appendChild(reset);
  pane.appendChild(head);

  const list = el("div", "ask-list");
  list.setAttribute("role", "log");
  list.setAttribute("aria-live", "polite");
  if (!v.rows.length) list.appendChild(askStarters(ss));
  const notes = new Map(v.rows.filter((r) => r.kind === "decision").map((r) => [r.re, r.text]));
  for (const r of v.rows) list.appendChild(askRow(r, ss, notes));
  pane.appendChild(list);
  pane.appendChild(askComposer(ss));
  main.appendChild(pane);

  // Back where the person left the list, unless something new arrived (or it
  // is the first look), which brings the newest row into view.
  const saved = scrollMemory.get("ask");
  const grew = v.rows.length > page.askRowCount;
  page.askRowCount = v.rows.length;
  list.scrollTop = !saved || grew ? list.scrollHeight : saved.top;
}

// An empty conversation offers a few questions for this step, the role's
// first. A click only fills the box: nothing is ever sent for the person.
function askStarters(ss) {
  const box = el("div", "ask-starters");
  box.appendChild(el("p", "ask-starters-lead", "Not sure what to ask? Try one of these:"));
  for (const starter of startersFor(page.S.workflow, looks.role, { hasContext: Boolean(page.local.chat.about) })) {
    const b = el("button", "ask-starter", starter.text);
    b.type = "button";
    b.disabled = !ss.canType;
    b.addEventListener("click", () => {
      page.local.chat.draft = starter.text;
      saveNow();
      redraw();
      const ta = $("ask-input");
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    box.appendChild(b);
  }
  return box;
}

function askRow(r, ss, notes) {
  if (r.kind === "decision") {
    const row = el("div", "ask-row decision");
    row.appendChild(el("p", "ask-decision", r.decision !== "approve" ? "You declined the edit." : r.done ? "You approved the edit." : "You approved the edit, please wait..."));
    if (r.text) row.appendChild(el("p", "ask-text", r.text));
    return row;
  }
  if (r.kind === "agent") {
    const row = el("div", "ask-row agent");
    row.appendChild(el("div", "msg-who", "Plan2Code"));
    row.appendChild(md(r.md, "md"));
    if (r.proposal) row.appendChild(askProposal(r, ss, notes.get(r.id)));
    if (Array.isArray(r.changed) && r.changed.length) {
      const ul = el("ul", "ask-changed");
      for (const c of r.changed) {
        const li = el("li");
        li.appendChild(el("code", null, c.file));
        li.appendChild(el("span", "ask-changed-count", ` +${c.added} −${c.removed}`));
        ul.appendChild(li);
      }
      row.appendChild(ul);
    }
    return row;
  }
  const row = el("div", "ask-row person" + (r.pending ? " pending" : ""));
  if (r.about && r.about.label) row.appendChild(el("p", "ask-about", "About: " + r.about.label));
  row.appendChild(el("p", "ask-text", r.text));
  const hasImages = r.images && r.images.length;
  const hasFiles = r.files && r.files.length;
  if (hasImages || hasFiles) {
    const tray = el("div", "attach-tray");
    for (const img of r.images || []) {
      const fig = el("figure", "attach-thumb is-ready");
      const pic = el("img");
      pic.src = thumbs.get(img.key) || uploadUrl(img);
      pic.alt = img.name || "image";
      fig.appendChild(pic);
      tray.appendChild(fig);
    }
    for (const file of r.files || []) tray.appendChild(docChip(file, "ready"));
    row.appendChild(tray);
  }
  if (r.pending && r.failed) {
    const fail = el("p", "ask-waiting ask-failed", "Not sent — retry");
    const retry = el("button", "btn tiny", "Retry");
    retry.type = "button";
    retry.disabled = ss.state === "offline" || chatSending;
    retry.addEventListener("click", () => retryChat(r.tempId));
    fail.appendChild(retry);
    row.appendChild(fail);
  } else if (r.pending) {
    row.appendChild(el("p", "ask-waiting", "Sending…"));
  } else if (r.waiting) {
    const wait = el("p", "ask-waiting");
    // Picked up and still answering: the ring says so, unless the agent has
    // gone quiet, when a turning ring would pass a dead session for a slow one.
    if (r.working && ss.state !== "offline" && !agentAdrift()) {
      const spin = el("span", "spinner tiny");
      spin.setAttribute("aria-hidden", "true");
      wait.appendChild(spin);
    }
    wait.appendChild(el("span", null, r.waitingText));
    row.appendChild(wait);
    if (r.activity) row.appendChild(el("p", "ask-waiting", "Right now: " + r.activity));
  }
  return row;
}

function askProposal(r, ss, note) {
  const box = el("div", "ask-proposal");
  box.appendChild(el("p", "note-kicker", "Proposed change"));
  box.appendChild(md(r.proposal.summary, "md"));
  const files = el("ul", "ask-proposal-files");
  for (const f of r.proposal.files || []) {
    const li = el("li");
    li.appendChild(el("code", null, f));
    files.appendChild(li);
  }
  box.appendChild(files);

  if (r.decided) {
    box.appendChild(el("p", "ask-decided " + r.decided, r.decided === "approve" ? "Approved" : "Declined"));
    if (note) box.appendChild(el("p", "help", note));
    return box;
  }
  const busy = deciding.has(r.id) || ss.state === "offline";
  const row = el("div", "ask-proposal-actions");
  const approve = el("button", "btn small primary", "Approve");
  approve.type = "button";
  approve.disabled = busy;
  approve.addEventListener("click", () => decideChat(r.id, "approve", ""));
  row.appendChild(approve);
  if (!declineOpen.has(r.id)) {
    const decline = el("button", "btn small ghost", "Decline");
    decline.type = "button";
    decline.disabled = busy;
    decline.addEventListener("click", () => {
      declineOpen.set(r.id, "");
      redraw();
      $("decline-" + r.id)?.focus();
    });
    row.appendChild(decline);
  } else {
    const input = el("input");
    input.type = "text";
    input.id = "decline-" + r.id;
    input.placeholder = "Why not? (optional)";
    input.maxLength = CHAT_MAX_CHARS;
    input.value = declineOpen.get(r.id) || "";
    input.addEventListener("input", () => declineOpen.set(r.id, input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      decideChat(r.id, "decline", input.value);
    });
    row.appendChild(input);
    const go = el("button", "btn small", "Send decline");
    go.type = "button";
    go.disabled = busy;
    go.addEventListener("click", () => decideChat(r.id, "decline", declineOpen.get(r.id) || ""));
    row.appendChild(go);
  }
  box.appendChild(row);
  if (deciding.has(r.id)) box.appendChild(el("p", "help", "Sent. It will show here once Plan2Code has it."));
  return box;
}

const COUNTER_FROM = 3500;

function askComposer(ss) {
  const comp = el("div", "ask-composer");
  const about = page.local.chat.about;
  if (about) {
    const chip = el("div", "ask-about-chip");
    chip.appendChild(el("span", null, "About: " + about.label));
    const x = el("button", "attach-remove", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Send without this");
    x.addEventListener("click", () => {
      Object.assign(page.local.chat, nextAbout(page.local.chat, { type: "drop" }));
      saveNow();
      redraw();
    });
    chip.appendChild(x);
    comp.appendChild(chip);
  }
  if (page.local.chat.images.length) comp.appendChild(attachTray(CHAT_IMAGES, page.local.chat.images));

  const ta = el("textarea");
  ta.id = "ask-input";
  ta.placeholder = "Ask anything about this project";
  ta.value = page.local.chat.draft || "";
  ta.disabled = !ss.canType;
  ta.setAttribute("aria-label", "Your question");
  attachMentions(ta);
  comp.appendChild(ta);

  const row = el("div", "ask-actions");
  const add = el("button", "btn small ghost", "+ Attach file");
  add.type = "button";
  add.setAttribute("aria-label", "Add files to this question");
  add.disabled = !ss.canType || page.local.chat.images.length >= CHAT_MAX_ATTACHMENTS;
  const picker = el("input");
  picker.type = "file";
  picker.accept = pickerAccept();
  picker.multiple = true;
  picker.hidden = true;
  add.addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    attachFiles(CHAT_IMAGES, picker.files);
    picker.value = "";
  });
  row.appendChild(add);
  row.appendChild(picker);
  if (!page.local.chat.about) row.appendChild(addContext(ss));

  // Where the counter sits, the reason Send is off when it cannot be typed in:
  // the limit, the last question still waiting, or nobody there to answer.
  const counter = el("span", "ask-count");
  if (!ss.canType) {
    const cls = ss.state === "offline" ? "is-offline" : ss.state === "limit" ? "is-limit" : "is-waiting";
    row.appendChild(el("p", "ask-disabled-note " + cls, ss.text));
  } else {
    row.appendChild(counter);
    const hint = el("span", "ask-send-hint");
    hint.appendChild(el("kbd", null, isMac() ? "⌘" : "Ctrl"));
    hint.appendChild(document.createTextNode(" + "));
    hint.appendChild(el("kbd", null, "Enter"));
    row.appendChild(hint);
  }

  const go = el("button", "btn small primary", "Send");
  go.type = "button";
  row.appendChild(go);
  comp.appendChild(row);
  if (page.chatError) comp.appendChild(el("p", "ask-error", page.chatError));

  const held = () => page.local.chat.images.some((img) => img.status !== "ready");
  const sync = () => {
    const len = ta.value.length;
    counter.textContent = len >= COUNTER_FROM ? `${len} / ${CHAT_MAX_CHARS}` : "";
    counter.classList.toggle("is-over", len > CHAT_MAX_CHARS);
    go.disabled = !ss.canType || chatSending || !ta.value.trim() || len > CHAT_MAX_CHARS || held();
  };
  sync();
  ta.addEventListener("input", () => {
    page.local.chat.draft = ta.value;
    saveNow();
    sync();
  });
  // Ctrl/Cmd+Enter sends and a plain Enter is a line break. Every Enter stops
  // here, so the page-wide Ctrl+Enter never sends the question cards from this box.
  ta.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.stopPropagation();
    if (!(e.ctrlKey || e.metaKey) || e.isComposing) return;
    e.preventDefault();
    if (!go.disabled) sendChat();
  });
  ta.addEventListener("paste", (e) => {
    const files = incomingFiles(e.clipboardData && e.clipboardData.files);
    if (!files.length || !ss.canType) return;
    if (!e.clipboardData.getData("text/plain")) e.preventDefault();
    attachFiles(CHAT_IMAGES, files);
  });
  const canDrop = (e) => ss.canType && e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  const onOver = (e) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    comp.classList.add("is-dropping");
  };
  comp.addEventListener("dragenter", onOver);
  comp.addEventListener("dragover", onOver);
  comp.addEventListener("dragleave", (e) => {
    if (!comp.contains(e.relatedTarget)) comp.classList.remove("is-dropping");
  });
  comp.addEventListener("drop", (e) => {
    comp.classList.remove("is-dropping");
    if (!canDrop(e)) return;
    e.preventDefault();
    attachFiles(CHAT_IMAGES, e.dataTransfer.files);
  });
  go.addEventListener("click", sendChat);
  return comp;
}

const CONTEXT_KIND = { card: "Question", section: "Section", spec: "Spec" };

// + Add context: the only way a message gets an `about`. A menu of the last
// three places visited, then This spec, built fresh on every render.
function addContext(ss) {
  const wrap = el("span", "ask-context");
  const spec = isDashboard() ? selSpec() : page.S && page.S.specDir ? { dir: page.S.specDir } : null;
  const options = contextOptions(page.local.chat, spec);
  const btn = el("button", "btn small ghost", "+ Add context");
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.disabled = !ss.canType || !options.length;
  if (!options.length) btn.title = "Visit a question or a document section first";
  wrap.appendChild(btn);

  let menu = null;
  const outside = (e) => {
    if (!wrap.contains(e.target)) close();
  };
  // Focus moves before the menu goes: removing the focused item fires a
  // focusout of its own, which would otherwise re-enter here.
  const close = (refocus) => {
    if (!menu) return;
    const gone = menu;
    menu = null;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    if (refocus) btn.focus();
    gone.remove();
  };
  const open = () => {
    menu = el("div", "ask-context-menu");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Add context");
    for (const option of options) {
      const item = el("button", "ask-context-item");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.appendChild(el("span", "ask-context-label", option.label));
      item.appendChild(el("span", "ask-context-kind", CONTEXT_KIND[option.kind] || ""));
      item.addEventListener("click", () => {
        close();
        Object.assign(page.local.chat, nextAbout(page.local.chat, { type: "pick", about: option }));
        saveNow();
        redraw();
      });
      menu.appendChild(item);
    }
    // A press inside the menu never moves focus. Safari (and Firefox on
    // macOS) do not focus a clicked button, so the press would blur the
    // focused item to nowhere and the focusout below would close the menu
    // before the click landed.
    menu.addEventListener("mousedown", (e) => e.preventDefault());
    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll('[role="menuitem"]')];
      const at = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        items[(at + step + items.length) % items.length].focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        items[e.key === "Home" ? 0 : items.length - 1].focus();
      }
    });
    wrap.appendChild(menu);
    btn.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outside, true);
    menu.querySelector('[role="menuitem"]').focus();
  };
  btn.addEventListener("click", () => (menu ? close() : open()));
  wrap.addEventListener("focusout", (e) => {
    if (menu && !wrap.contains(e.relatedTarget)) close();
  });
  return wrap;
}

const CHAT_ERRORS = {
  stale: "A new conversation started. Your message is still here — press Send again.",
  "too-long": `That message is over ${CHAT_MAX_CHARS.toLocaleString()} characters. Shorten it and send again.`,
  image: "One of the images could not be attached. Remove it and try again.",
  file: "One of the files could not be attached. Remove it and try again.",
};

async function sendChat() {
  const text = (page.local.chat.draft || "").trim();
  const { send: ss } = askState();
  if (!text || chatSending || !ss.canType || text.length > CHAT_MAX_CHARS) return;
  if (page.local.chat.images.some((img) => img.status !== "ready")) return;
  const ofKind = (kind) => page.local.chat.images.filter((a) => attachmentKind(a) === kind);
  const pend = {
    tempId: crypto.randomUUID(),
    text,
    about: page.local.chat.about,
    images: ofKind("image").map(({ key, path, name, url }) => ({ key, path, name, url })),
    files: ofKind("file").map(({ key, path, name, size }) => ({ key, path, name, size })),
  };
  page.local.chat.pending.push(pend);
  saveNow();
  await postChat(pend);
}

function retryChat(tempId) {
  const pend = page.local.chat.pending.find((p) => p.tempId === tempId);
  if (!pend || chatSending) return;
  pend.failed = false;
  saveNow();
  postChat(pend);
}

async function postChat(pend) {
  chatSending = true;
  page.chatError = "";
  redraw();
  let res = null;
  let body = {};
  try {
    res = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: pend.text,
        about: pend.about || undefined,
        images: pend.images.length ? pend.images.map(({ path, name }) => ({ path, name })) : undefined,
        files: pend.files && pend.files.length ? pend.files.map(({ path, name }) => ({ path, name })) : undefined,
        conversation: askConversation(),
      }),
    });
    body = await res.json().catch(() => ({}));
  } catch {
    res = null;
  }
  chatSending = false;
  const still = page.local.chat.pending.find((p) => p.tempId === pend.tempId);
  if (!res) {
    if (still) still.failed = true;
  } else if (res.ok) {
    if (still) still.seq = body.seq;
    // What was sent leaves the composer, and the context leaves with it: a
    // follow-up is a general question unless it is picked again.
    Object.assign(page.local.chat, nextAbout(page.local.chat, { type: "sent" }));
    if ((page.local.chat.draft || "").trim() === pend.text) {
      page.local.chat.draft = "";
      page.local.chat.images = [];
    }
  } else {
    page.local.chat.pending = page.local.chat.pending.filter((p) => p.tempId !== pend.tempId);
    if (body.error === "stale" && typeof body.conversation === "number") page.local.chat.conversation = body.conversation;
    // A limit or offline refusal needs no words: the disabled composer says why.
    if (body.error !== "limit" && body.error !== "offline") {
      page.chatError = CHAT_ERRORS[body.error] || "That message could not be sent. Try again.";
    }
  }
  saveNow();
  redraw();
}

async function newConversation() {
  // One reset at a time: a second press would only come back stale and put
  // an error under the clean conversation the first one opened.
  if (chatResetting) return;
  chatResetting = true;
  redraw();
  let res = null;
  let body = {};
  try {
    res = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reset: true, conversation: askConversation() }),
    });
    body = await res.json().catch(() => ({}));
  } catch {}
  if (res && res.ok) {
    // An explicit fresh start: the unsent draft and its pictures go too.
    for (const img of page.local.chat.images) if (img.id) fetch(deleteUrl(img), { method: "DELETE" }).catch(() => {});
    page.local.chat = { ...freshChat(), history: page.local.chat.history, about: null, conversation: body.conversation };
    page.chatError = "";
    page.askRowCount = 0;
    declineOpen.clear();
  } else if (body.error === "stale" && typeof body.conversation === "number") {
    page.local.chat.conversation = body.conversation;
    page.chatError = "A new conversation had already started.";
  } else if (body.error !== "offline") {
    page.chatError = "A new conversation could not be started. Try again.";
  }
  chatResetting = false;
  saveNow();
  redraw();
}

async function decideChat(re, decision, text) {
  if (deciding.has(re)) return;
  deciding.add(re);
  page.chatError = "";
  redraw();
  let ok = false;
  let body = {};
  try {
    const res = await fetch("/chat/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ re, decision, text: text.trim() || undefined, conversation: askConversation() }),
    });
    ok = res.ok;
    body = await res.json().catch(() => ({}));
  } catch {}
  // Kept in `deciding` on success: the buttons stay off until the frame
  // brings the decision back, rather than flashing live again in between.
  if (ok) declineOpen.delete(re);
  else {
    deciding.delete(re);
    page.chatError =
      body.error === "stale"
        ? "That proposal belongs to an earlier conversation."
        : "That decision could not be sent. Try again.";
  }
  redraw();
}

export function renderAside() {
  const aside = $("aside");
  // Redrawing empties the panel, which drops its scroll to the top. An image
  // upload redraws two or three times while the person watches its tray, so
  // the place is kept while the same question stays on screen.
  const place = aside.dataset.item === String(page.selected) ? aside.scrollTop : 0;
  aside.replaceChildren();
  aside.dataset.item = String(page.selected);
  // The end page is about the session, not any one question: the notes that
  // belong to a question stay on its own page.
  const item = page.view === "end" ? null : byId(page.selected);
  if (!item) {
    // The menu has no questions, so no notes either: the pane stays empty.
    if (!isDashboard()) aside.appendChild(el("p", "aside-empty", "Pick a question to see its notes."));
    return;
  }
  // Off the question's own page (a doc tab, Ask) "this" points at nothing on
  // screen, so the pane names the question a note here will go to.
  const onQuestion = page.view === "questions" || page.view === "end";
  aside.appendChild(el("h2", null, onQuestion ? "Notes on this" : `Notes on “${item.title || "this question"}”`));

  const thread = item.thread || [];
  if (!thread.length && !(isOpen(item) && !finish() && noteAwaiting(item))) {
    aside.appendChild(
      el(
        "p",
        "aside-empty",
        isOpen(item) && !finish()
          ? "No back and forth yet. Anything you type here goes with your next send."
          : "Nothing was said about this one."
      )
    );
  }
  // A note that has been sent but not yet picked up: marked as waiting, so the
  // send is seen to have gone, until the agent replies. The server writes the
  // note into the thread as it arrives; a session from before that has only
  // `sentNote`, which gets a box of its own below.
  const waiting = isOpen(item) && !finish() ? noteAwaiting(item) : null;
  let waitingShown = false;
  for (const m of thread) {
    const mine = threadWho(m) === "user";
    const pending = Boolean(waiting && mine && m.at && m.at === waiting.at);
    if (pending) waitingShown = true;
    const box = el("div", "msg" + (mine ? " you" : "") + (pending ? " pending" : ""));
    const who = el("div", "msg-who");
    who.appendChild(el("span", null, mine ? "You" : "Plan2Code"));
    if (pending) who.appendChild(el("span", null, "Sent, waiting for Plan2Code"));
    else if (m.at) who.appendChild(el("span", null, shortTime(m.at)));
    box.appendChild(who);
    const text = threadText(m);
    if (text) box.appendChild(md(text, "md"));
    const tray = mine ? sentAttachments(m) : null;
    if (tray) box.appendChild(tray);
    aside.appendChild(box);
  }

  if (waiting && !waitingShown) {
    const box = el("div", "msg you pending");
    const who = el("div", "msg-who");
    who.appendChild(el("span", null, "You"));
    who.appendChild(el("span", null, "Sent, waiting for Plan2Code"));
    box.appendChild(who);
    if (waiting.text) box.appendChild(md(waiting.text, "md"));
    const tray = sentAttachments(waiting);
    if (tray) box.appendChild(tray);
    aside.appendChild(box);
  }

  // A finished session has nobody left for a note to reach, so the box would
  // be a place to type words that go nowhere.
  if (!isOpen(item) || finish()) {
    aside.scrollTop = place;
    return;
  }

  const wrap = el("div", "field");
  const id = "thread-" + item.id;
  const label = el("label", null, "Add a note, attach a file, or ask something");
  label.htmlFor = id;
  wrap.appendChild(label);

  const attached = noteImages(item.id);
  wrap.appendChild(attachRow(item.id, "Add files to this note"));

  if (attached.length) wrap.appendChild(attachTray(item.id, attached));

  const ta = el("textarea");
  ta.id = id;
  ta.placeholder = "Goes with your next send. It does not answer the question.";
  ta.value = page.local.drafts[id] || "";
  attachMentions(ta);
  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    hooks.renderFooter();
  });
  ta.addEventListener("paste", (e) => {
    const files = incomingFiles(e.clipboardData && e.clipboardData.files);
    if (!files.length) return;
    // A copy from some apps carries the picture and its text together; the
    // text still pastes as it always did.
    if (!e.clipboardData.getData("text/plain")) e.preventDefault();
    attachFiles(item.id, files);
  });
  wrap.appendChild(ta);
  aside.appendChild(wrap);
  aside.scrollTop = place;
}

// The helpers the agent reported, as it last posted them. Everything here is
// the agent's text, so it goes in as text, never as markup.
export function renderSubagents(main) {
  const card = el("section", "card sa-card");
  card.appendChild(el("h2", null, "Subagents"));
  card.appendChild(el("p", "help", CHECKIN_LINE));
  const { alone, rows } = helperRows(page.S.helpers);
  if (alone) {
    card.appendChild(
      el("p", "sa-alone", "Working alone: your agent has no way to start helpers here, so it is doing this skill's work itself.")
    );
    main.appendChild(card);
    return;
  }
  const list = el("ul", "sa-list");
  for (const row of rows) {
    const item = el("li", "sa-row");
    const head = el("div", "sa-head");
    head.appendChild(el("strong", "sa-title", row.title));
    const pill = el("span", "pill sa-pill is-" + row.state);
    if (row.state === "running") {
      const spin = el("span", "spinner tiny");
      spin.setAttribute("aria-hidden", "true");
      pill.appendChild(spin);
    }
    pill.appendChild(document.createTextNode(row.stateLabel));
    head.appendChild(pill);
    item.appendChild(head);
    item.appendChild(el("p", "sa-ask", row.ask));
    if (row.strengthLine) {
      // Badges for the eye, the plain line for screen readers and the tooltip.
      const strength = el("p", "sa-strength");
      strength.setAttribute("aria-label", row.strengthLine);
      strength.title = row.strengthLine;
      for (const badge of row.badges) {
        const chip = el("span", `sa-badge is-${badge.kind} lvl-${badge.level}`);
        chip.setAttribute("aria-hidden", "true");
        if (badge.level) {
          const bars = el("span", "sa-bars");
          for (let i = 1; i <= 3; i++) bars.appendChild(el("i", i <= badge.level ? "on" : null));
          chip.appendChild(bars);
        }
        chip.appendChild(document.createTextNode(badge.label));
        strength.appendChild(chip);
      }
      item.appendChild(strength);
    }
    if (row.result) item.appendChild(el("p", "sa-result", row.result));
    list.appendChild(item);
  }
  card.appendChild(list);
  main.appendChild(card);
}

// Shown only where the skill opts in and the agent's console copy can deliver
// it. Lit while helpers are on; a click opens the dialog, never toggles.
export function renderSubagentsButton() {
  const btn = $("btn-subagents");
  const offer = showSwitch(page.subagentsFrame);
  btn.hidden = !offer;
  if (!offer) return;
  const label = switchLabel(page.subagentsFrame);
  btn.setAttribute("aria-pressed", String(Boolean(page.subagentsFrame.on)));
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.disabled = page.gone;
}

// The Subagents dialog, filled from the frame each time it opens. A null
// instruction is the shipped default, shown as its text so it can be edited.
export function openSubagents() {
  if (!showSwitch(page.subagentsFrame)) return;
  const on = Boolean(page.subagentsFrame.on);
  for (const radio of document.querySelectorAll('input[name="subagents-on"]')) {
    radio.checked = radio.value === (on ? "on" : "off");
  }
  $("subagents-instruction").value = page.subagentsFrame.instruction ?? defaultInstruction(page.S.workflow);
  $("subagents-max").value = String(page.subagentsFrame.max);
  const strength = STRENGTHS.includes(page.subagentsFrame.strength) ? page.subagentsFrame.strength : DEFAULT_STRENGTH;
  for (const radio of document.querySelectorAll('input[name="subagents-strength"]')) radio.checked = radio.value === strength;
  syncStrengthHelp();
  $("subagents-checkin").textContent = CHECKIN_LINE;
  const research = $("subagents-research");
  research.textContent = PATHFINDER_RESEARCH_LINE;
  research.hidden = page.S.workflow !== "pathfinder";
  $("subagents-status").textContent = "";
  $("subagents-save").disabled = false;
  syncSubagentsFields();
  $("subagents-modal").showModal();
  const checked = document.querySelector('input[name="subagents-on"]:checked');
  if (checked) checked.focus();
}

// Instruction, "at most" and strength only mean anything with helpers on, so
// they are inert under Work alone (kept as picked, for when helpers go back on).
export function syncSubagentsFields() {
  const picked = document.querySelector('input[name="subagents-on"]:checked');
  const off = !picked || picked.value !== "on";
  for (const id of ["subagents-instruction", "subagents-max", "subagents-default"]) $(id).disabled = off;
  for (const radio of document.querySelectorAll('input[name="subagents-strength"]')) radio.disabled = off;
}

// The line under the strength radios explains the picked one.
function syncStrengthHelp() {
  const picked = document.querySelector('input[name="subagents-strength"]:checked');
  $("subagents-strength-help").textContent = STRENGTH_HELP[picked ? picked.value : DEFAULT_STRENGTH];
}

const SUBAGENTS_ERRORS = {
  max: "Pick a number from 1 to 20.",
  "too-long": "The instruction is over 2,000 characters.",
  strength: "That strength isn't one of the four choices.",
  "not-offered": "This skill doesn't use helpers.",
  bad: "That didn't save. Try again.",
};

const SUBAGENTS_LOST = "Lost contact with Plan2Code. Try again once it's back.";

export async function saveSubagents() {
  const save = $("subagents-save");
  const status = $("subagents-status");
  const picked = document.querySelector('input[name="subagents-on"]:checked');
  const text = $("subagents-instruction").value.trim();
  // The shipped default is stored as null, so a later release's wording
  // reaches everyone who never changed it.
  const instruction = text === defaultInstruction(page.S.workflow) ? null : text;
  const strength = document.querySelector('input[name="subagents-strength"]:checked');
  const body = {
    on: Boolean(picked && picked.value === "on"),
    instruction,
    max: Number($("subagents-max").value),
    strength: strength ? strength.value : DEFAULT_STRENGTH,
  };
  save.disabled = true;
  status.textContent = "";
  const res = await postJson("/subagents", body);
  save.disabled = false;
  // The next state frame redraws the button.
  if (res.status === 200) return $("subagents-modal").close();
  if (res.status === 400) status.textContent = SUBAGENTS_ERRORS[res.body && res.body.error] || SUBAGENTS_ERRORS.bad;
  else if (res.status === 403 || res.status === 0) status.textContent = SUBAGENTS_LOST;
  else status.textContent = SUBAGENTS_ERRORS.bad;
}

// Whether the agent coming or going has changed what the Ask pane painted,
// with no frame to say so (the page's clock asks, once a second).
export const askOfflineFlipped = () => (askState().send.state === "offline") !== askPaintedOffline;

// The Subagents dialog's buttons, and dropping files onto the notes panel.
export function wireAsk() {
  for (const radio of document.querySelectorAll('input[name="subagents-on"]')) radio.addEventListener("change", syncSubagentsFields);
  for (const radio of document.querySelectorAll('input[name="subagents-strength"]')) radio.addEventListener("change", syncStrengthHelp);
  lightDismiss($("subagents-modal"));
  $("btn-subagents").addEventListener("click", openSubagents);
  $("subagents-default").addEventListener("click", () => {
    $("subagents-instruction").value = defaultInstruction(page.S.workflow);
  });
  $("subagents-save").addEventListener("click", saveSubagents);
  $("subagents-cancel").addEventListener("click", () => $("subagents-modal").close());
  $("subagents-modal").addEventListener("close", () => $("btn-subagents").focus());

  // Dropping files onto the notes panel attaches them to the selected
  // question's note. Bound once here: the panel's contents are redrawn on every
  // render, the panel itself is not.
  {
    const aside = $("aside");
    const canDrop = (e) => {
      const item = page.view === "end" ? null : byId(page.selected);
      return (
        Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes("Files") &&
        item &&
        isOpen(item) &&
        !finish()
      );
    };
    const onOver = (e) => {
      if (!canDrop(e)) return;
      e.preventDefault();
      aside.classList.add("is-dropping");
    };
    aside.addEventListener("dragenter", onOver);
    aside.addEventListener("dragover", onOver);
    aside.addEventListener("dragleave", (e) => {
      // Moving between children fires dragleave too; only leaving the panel counts.
      if (!aside.contains(e.relatedTarget)) aside.classList.remove("is-dropping");
    });
    aside.addEventListener("drop", (e) => {
      aside.classList.remove("is-dropping");
      if (!canDrop(e)) return;
      e.preventDefault();
      attachFiles(page.selected, e.dataTransfer.files);
    });
  }
}
