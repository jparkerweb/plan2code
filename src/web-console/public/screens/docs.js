// Plan2Code Web Console - documents: tabs, blocks, print and download, and the brief button; defines only.

import { docs, agentWorking, workingMs, patience, WORKING_GRACE_MS, finish } from "../selectors.js";
import { el, md } from "../render.js";
import { downloadDocHtml, docSavedNote, downloadDoc, blockBody } from "../doc-files.js";
import { hooks, page, redraw } from "../state.js";

const $ = (id) => document.getElementById(id);
import { sendState } from "../send-state.js";
import { briefPhrase } from "../answers.js";

let docObserver = null;

// A brief is a Pathfinder thing: a plain-English report of the decisions made
// in a date range, the ones still open, and what happens next. It is the
// artifact someone takes to a meeting, and the reason a non-engineer is in this
// session at all, so it should not need knowing that you can type "brief" at a
// terminal to get one.
//
// The request travels as an ordinary send. The agent's own wait loop returns
// it, `reply` carries the range in the grammar its playbook already parses, and
// the finished brief comes back as a doc like any other.
const BRIEF_RANGES = {
  today: "today",
  "this week": "this week",
  full: "full",
};

function briefRange() {
  const picked = document.querySelector('input[name="brief-range"]:checked');
  const value = picked ? picked.value : "today";
  if (value !== "since") return { range: BRIEF_RANGES[value] || "today" };
  const on = $("brief-since").value;
  if (!on) return { problem: "Pick the date to count from, or choose another range." };
  if (on > localDay()) return { problem: "Pick a date that has already happened: a brief covers what was decided since then." };
  return { range: `since ${on}` };
}

function openBrief() {
  const why = $("brief-why");
  why.textContent = "";
  syncBriefDate();
  $("brief-modal").showModal();
}

// The date only means anything for "since", so it is dimmed and inert until
// that is the choice, rather than sitting there inviting a value it will ignore.
function syncBriefDate() {
  const picked = document.querySelector('input[name="brief-range"]:checked');
  const on = Boolean(picked && picked.value === "since");
  const row = document.querySelector(".since-row");
  const input = $("brief-since");
  row.classList.toggle("is-off", !on);
  input.disabled = !on;
  input.max = localDay();
}

// Today as YYYY-MM-DD in the person's own time zone, the shape a date input uses.
function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function sendBrief() {
  const choice = briefRange();
  const why = $("brief-why");
  if (choice.problem) {
    why.textContent = choice.problem;
    return;
  }
  const state = sendState();
  // The same guard the Send button uses. A brief is a turn like any other, and
  // two turns in flight is the one thing this protocol will not do.
  if (page.gone || page.pendingResult || (agentWorking() && workingMs() <= patience(WORKING_GRACE_MS))) {
    why.textContent = state.why || "Wait for Plan2Code to finish, then ask again.";
    return;
  }

  const go = $("brief-go");
  go.disabled = true;
  go.textContent = "Asking…";
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actions: [{ i: "__brief", type: "brief", range: choice.range }],
        reply: briefPhrase(choice.range),
      }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    $("brief-modal").close();
    hooks.banner("Asked for a brief. It will appear as a tab when it is written.", "good");
    setTimeout(() => hooks.banner(null), 5000);
    page.pendingResult = true;
    redraw();
  } catch (err) {
    if (err && err.pending) page.pendingResult = true;
    why.textContent =
      err && err.pending
        ? "Your last answers are still being picked up. Try again in a moment."
        : "That did not go through. Try again in a moment.";
  } finally {
    go.disabled = false;
    go.textContent = "Write the brief";
  }
}

export function renderBriefButton() {
  const btn = $("btn-brief");
  // Only Pathfinder has a brief playbook. Offering the button anywhere else
  // would send the agent a request it has no procedure for.
  const offer = page.S && page.S.workflow === "pathfinder";
  btn.hidden = !offer;
  // A finished (or paused) session has nobody to write it: the request would
  // wait on disk for a session that may never come.
  if (offer) btn.disabled = page.gone || page.pendingResult || Boolean(finish());
}

export function renderDoc(main, id) {
  const doc = docs().find((d) => d.id === id);
  if (!doc) {
    main.appendChild(el("p", "doc-empty", "That document is not ready yet."));
    return;
  }
  const head = el("div", "doc-head");
  head.appendChild(el("h2", null, doc.title || "Document"));
  head.appendChild(el("span", "doc-version", "v" + (doc.version || 1)));
  if (doc.stale) {
    head.appendChild(el("span", "pill staged", "Out of date"));
  }

  const tools = el("div", "doc-tools");
  tools.appendChild(backButton());
  // A brief is handed to people who were not in the room, so it gets a copy
  // that opens in any browser, formatting and all.
  if (doc.id === "brief") {
    const html = el("button", "btn small", "Save as HTML");
    html.type = "button";
    html.addEventListener("click", () => downloadDocHtml(doc));
    tools.appendChild(html);
  }
  tools.appendChild(printButton());

  if (doc.saved) {
    tools.appendChild(docSavedNote(doc));
  } else {
    const save = el("button", "btn small", "Download");
    save.type = "button";
    save.addEventListener("click", () => downloadDoc(doc));
    tools.appendChild(save);
  }
  head.appendChild(tools);

  main.appendChild(head);
  if (doc.note) main.appendChild(el("p", "help", doc.note));

  const blocks = doc.blocks || [];
  if (!blocks.length) {
    main.appendChild(el("p", "doc-empty", "Nothing written yet. It fills in as you answer."));
    return;
  }
  // The block nearest the top of the column is the section + Add context
  // offers after leaving this tab. Its label is its first heading.
  docObserver?.disconnect();
  if (page.docInView && page.docInView.docId !== doc.id) page.docInView = null;
  const boxes = [];
  const topmost = () => {
    const top = main.getBoundingClientRect().top;
    const box = boxes.find((x) => x.getBoundingClientRect().bottom > top + 1);
    if (!box) return;
    const heading = box.querySelector("h1, h2, h3, h4, h5, h6");
    page.docInView = {
      docId: doc.id,
      blockId: box.dataset.block,
      label: (heading && heading.textContent.trim()) || doc.title || "Document",
    };
  };
  docObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(topmost, { root: main, threshold: [0, 0.25, 0.5, 0.75, 1] }) : null;
  blocks.forEach((b, i) => {
    const box = el("div", "block " + (b.state || "settled"));
    box.dataset.block = b.id || String(i);
    boxes.push(box);
    docObserver?.observe(box);
    if (b.state === "assumed") {
      // Borrowed from grill-with-ui and the best idea in it: show plainly which
      // parts are still a guess, so nobody mistakes a placeholder for a decision.
      box.appendChild(el("span", "block-tag", "Assumed for now, still open"));
    }
    if (b.state === "draft") box.appendChild(el("span", "block-tag", "Draft"));
    box.appendChild(blockBody(b));
    main.appendChild(box);
  });
}

// The way home from a document, in the highlight color so it is the easiest
// thing to find after reading. A finished session's first tab is its finish
// screen, the same as the tab itself.
function backButton() {
  const flow = page.S.workflow;
  const home = flow === "dashboard" ? "Dashboard" : flow === "git" ? "Git" : "Questions";
  const back = el("button", "btn small back-home", "Back to " + home);
  back.type = "button";
  back.addEventListener("click", () => {
    page.view = finish() ? "end" : "questions";
    redraw();
    $("main").focus();
  });
  return back;
}

function printButton() {
  const print = el("button", "btn small", "Print");
  print.type = "button";
  // The print stylesheet drops everything that steers the session, so what
  // comes out is the document alone. "Save as PDF" in that dialog is also the
  // most portable save this page can offer.
  print.addEventListener("click", () => window.print());
  return print;
}

// The spec's overview.md, read-only and drawn through the same markdown path
// as every doc. No Download: the file is already on disk.
export function renderOverview(main) {
  const head = el("div", "doc-head");
  head.appendChild(el("h2", null, "Overview"));
  const tools = el("div", "doc-tools");
  tools.appendChild(backButton());
  tools.appendChild(printButton());
  head.appendChild(tools);
  main.appendChild(head);
  main.appendChild(el("p", "help", `${page.overview.key}/overview.md · read-only, straight from disk`));
  const box = el("div", "block settled");
  box.appendChild(md(page.overview.text, "md"));
  main.appendChild(box);
}

// The brief dialog's buttons, wired once at start-up.
export function wireDocs() {
  $("btn-brief").addEventListener("click", openBrief);
  $("brief-cancel").addEventListener("click", () => $("brief-modal").close());
  $("brief-go").addEventListener("click", sendBrief);
  for (const radio of document.querySelectorAll('input[name="brief-range"]')) {
    radio.addEventListener("change", syncBriefDate);
  }
}
