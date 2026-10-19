// Plan2Code Web Console - the @name suggestions popover under a text box; defines only.
//
// Shared by the question cards and the Ask pane, so neither imports the other.

import { page } from "./state.js";
import { el } from "./render.js";
import { applyMention, mentionAt, matchNames } from "./mentions.js";
import { workspaceFolders } from "./selectors.js";

export function closeMentions() {
  if (!page.mentionPop) return;
  const { box, node } = page.mentionPop;
  node.remove();
  removeEventListener("scroll", placeMentions, true);
  box.setAttribute("aria-expanded", "false");
  box.removeAttribute("aria-activedescendant");
  page.mentionPop = null;
}

// Under the box, as wide as it, fixed to the viewport so no card's overflow
// can clip it; above it when the window has no room below (the Ask box sits
// at the bottom). A box that has been redrawn away takes the list with it.
function placeMentions() {
  if (!page.mentionPop) return;
  if (!page.mentionPop.box.isConnected) return closeMentions();
  const r = page.mentionPop.box.getBoundingClientRect();
  const node = page.mentionPop.node;
  node.style.left = Math.round(r.left) + "px";
  node.style.width = Math.round(r.width) + "px";
  const h = node.offsetHeight;
  const top = r.bottom + 4 + h <= innerHeight ? r.bottom + 4 : Math.max(4, r.top - 4 - h);
  node.style.top = Math.round(top) + "px";
}

function paintMentions() {
  const { node, box, matches, query } = page.mentionPop;
  node.replaceChildren();
  if (!matches.length) {
    node.appendChild(el("div", "mention-empty", `No folder called @${query} in the workspace`));
    box.removeAttribute("aria-activedescendant");
    return;
  }
  matches.forEach((name, i) => {
    const opt = el("div", "mention-opt" + (i === page.mentionPop.at ? " is-active" : ""), "@" + name);
    opt.id = "mention-opt-" + i;
    opt.setAttribute("role", "option");
    opt.setAttribute("aria-selected", String(i === page.mentionPop.at));
    // Held on mousedown, so the box keeps focus and the click can land.
    opt.addEventListener("mousedown", (e) => e.preventDefault());
    opt.addEventListener("click", () => pickMention(name));
    node.appendChild(opt);
  });
  box.setAttribute("aria-activedescendant", "mention-opt-" + page.mentionPop.at);
}

function pickMention(name) {
  if (!page.mentionPop) return;
  const { box, mention } = page.mentionPop;
  const next = applyMention(box.value, box.selectionStart, mention, name);
  closeMentions();
  box.value = next.text;
  box.setSelectionRange(next.caret, next.caret);
  // Whatever the box does with typing (drafts, staging, the counter) runs.
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

export function attachMentions(box) {
  box.setAttribute("aria-autocomplete", "list");
  box.setAttribute("aria-expanded", "false");
  box.setAttribute("aria-controls", "mention-pop");
  const update = () => {
    const mention =
      box.selectionStart === box.selectionEnd ? mentionAt(box.value, box.selectionStart) : null;
    const names = workspaceFolders().map((f) => f.name);
    const matches = mention ? matchNames(names, mention.query) : [];
    // Nothing to offer with only the original folder and no match; a bigger
    // workspace says plainly that the name is not in it.
    if (!mention || (!matches.length && names.length < 2)) {
      if (page.mentionPop && page.mentionPop.box === box) closeMentions();
      return;
    }
    if (!page.mentionPop || page.mentionPop.box !== box) {
      closeMentions();
      const node = el("div", "mention-pop");
      node.id = "mention-pop";
      node.setAttribute("role", "listbox");
      node.setAttribute("aria-label", "Workspace folders");
      document.body.appendChild(node);
      page.mentionPop = { box, node, at: 0, matches: [], mention: null, query: "" };
      addEventListener("scroll", placeMentions, true);
      box.setAttribute("aria-expanded", "true");
    }
    const same = page.mentionPop.matches.join("\n") === matches.join("\n");
    Object.assign(page.mentionPop, { matches, mention, query: mention.query, at: same ? page.mentionPop.at : 0 });
    paintMentions();
    placeMentions();
  };
  box.addEventListener("input", update);
  box.addEventListener("keyup", (e) => {
    if (!["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) update();
  });
  box.addEventListener("keydown", (e) => {
    if (!page.mentionPop || page.mentionPop.box !== box || e.isComposing) return;
    const { matches } = page.mentionPop;
    const stop = () => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    if (e.key === "Escape") {
      stop();
      return closeMentions();
    }
    if (!matches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      stop();
      page.mentionPop.at = (page.mentionPop.at + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length;
      return paintMentions();
    }
    if ((e.key === "Enter" || e.key === "Tab") && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      stop();
      pickMention(matches[page.mentionPop.at]);
    }
  });
  box.addEventListener("blur", () => {
    if (page.mentionPop && page.mentionPop.box === box) closeMentions();
  });
}
