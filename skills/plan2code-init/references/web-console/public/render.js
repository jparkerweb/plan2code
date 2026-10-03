// Markdown to DOM, safely.
//
// The rule this file exists to enforce: NO HTML STRING IS EVER PRODUCED.
// We take marked's token tree and build nodes with createElement/textContent.
//
// Why that matters more than it looks: this page is same-origin with a server
// that reads and writes the user's files and holds the session cookie. Script
// running here could post arbitrary answers back to the agent, which would then
// act on them with the agent's full tool permissions. And the markdown is only
// nominally agent-authored: in practice the agent is summarising a dependency
// README, a scraped page, a PR description, a log. Treat it as hostile.
//
// Building nodes rather than parsing a string makes injection structurally
// impossible instead of filtered, so there is nothing for a sanitiser bypass to
// bypass. `html` tokens render as visible text, on purpose.

import { marked } from "./vendor/marked.esm.js";

// A bare `/` path stays on this origin; `//host` (and `/\host`, which browsers
// read the same way) is protocol-relative and would not, so it is refused.
const SAFE_PROTOCOL = /^(https?:|mailto:|#|\/(?![/\\]))/i;

function safeHref(href) {
  if (!href) return null;
  const trimmed = String(href).trim();
  // Blocks javascript: and data: hrefs before they can reach the DOM, and a
  // protocol-relative `//host` (or `/\host`), which leaves the page for another site.
  return SAFE_PROTOCOL.test(trimmed) ? trimmed : null;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function inlineInto(parent, tokens) {
  for (const t of tokens || []) {
    switch (t.type) {
      case "text":
        // Nested inline tokens (a link inside emphasis, say) arrive here.
        if (t.tokens && t.tokens.length) inlineInto(parent, t.tokens);
        else parent.appendChild(document.createTextNode(t.text ?? t.raw ?? ""));
        break;
      case "escape":
        parent.appendChild(document.createTextNode(t.text));
        break;
      case "strong": {
        const n = el("strong");
        inlineInto(n, t.tokens);
        parent.appendChild(n);
        break;
      }
      case "em": {
        const n = el("em");
        inlineInto(n, t.tokens);
        parent.appendChild(n);
        break;
      }
      case "del": {
        const n = el("s");
        inlineInto(n, t.tokens);
        parent.appendChild(n);
        break;
      }
      case "codespan":
        parent.appendChild(el("code", "md-code", t.text));
        break;
      case "br":
        parent.appendChild(document.createElement("br"));
        break;
      case "link": {
        const href = safeHref(t.href);
        if (!href) {
          inlineInto(parent, t.tokens);
          break;
        }
        const a = el("a");
        a.href = href;
        a.rel = "noopener noreferrer";
        if (/^https?:/i.test(href)) a.target = "_blank";
        if (t.title) a.title = t.title;
        inlineInto(a, t.tokens);
        parent.appendChild(a);
        break;
      }
      case "image": {
        const src = safeHref(t.href);
        if (!src) {
          parent.appendChild(document.createTextNode(t.text || ""));
          break;
        }
        const img = el("img", "md-img");
        img.src = src;
        img.alt = t.text || "";
        parent.appendChild(img);
        break;
      }
      default:
        // Includes `html`: rendered as literal text, never parsed.
        parent.appendChild(document.createTextNode(t.raw ?? t.text ?? ""));
    }
  }
}

// What a fenced code block offers beside Copy, from its first non-empty line:
// `'run'` gets a Run it button (git commands — the one kind a person keeps
// copying into Ask by hand), `'hint'` a muted note that pasting it into Ask
// may get the agent to run it, and `null` nothing extra. A leading `/` is a
// skill command for a new conversation, never a terminal command, so it gets
// neither.
const COMMAND_WORDS =
  /^(git|node|npm|npx|pnpm|yarn|bun|deno|python3?|pip3?|brew|curl|wget|docker|kubectl|terraform|make|cmake|cargo|go|java|mvn|gradle|gh|aws|az|gcloud|jq|ssh|scp|rsync|chmod|chown|mkdir|cp|mv|rm|ls|cd|cat|echo|export|source|bash|sh|zsh|fish|pwsh|powershell|cmd|systemctl|service|apt|apt-get|dnf|yum|pacman|tar|unzip|zip)\b/i;

export function runHint(text) {
  const firstLine = (text || "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine || firstLine.startsWith("/")) return null;
  if (/^git(\s|$)/.test(firstLine)) return "run";
  if (firstLine.startsWith("#!")) return "hint";
  return COMMAND_WORDS.test(firstLine) ? "hint" : null;
}

function blockInto(parent, tokens) {
  for (const t of tokens || []) {
    switch (t.type) {
      case "space":
        break;
      case "heading": {
        const level = Math.min(6, Math.max(2, (t.depth || 1) + 1)); // never an h1: the page owns that
        const h = el("h" + level, "md-h");
        inlineInto(h, t.tokens);
        parent.appendChild(h);
        break;
      }
      case "paragraph": {
        const p = el("p", "md-p");
        inlineInto(p, t.tokens);
        parent.appendChild(p);
        break;
      }
      case "text": {
        const p = el("p", "md-p");
        if (t.tokens) inlineInto(p, t.tokens);
        else p.textContent = t.text || "";
        parent.appendChild(p);
        break;
      }
      case "blockquote": {
        const q = el("blockquote", "md-quote");
        blockInto(q, t.tokens);
        parent.appendChild(q);
        break;
      }
      case "code": {
        const wrap = el("div", "md-pre-wrap");
        const pre = el("pre", "md-pre");
        // textContent, so a fenced block containing markup is inert.
        pre.appendChild(el("code", null, t.text));
        wrap.appendChild(copyButton(t.text, "md-copy"));
        const hint = runHint(t.text);
        if (hint === "run") {
          const run = el("button", "md-run", "Run it");
          run.type = "button";
          wrap.appendChild(run);
        }
        wrap.appendChild(pre);
        if (hint === "hint") {
          wrap.appendChild(el("p", "md-run-hint", "The agent may be able to run this — paste it into the Ask tab"));
        }
        parent.appendChild(wrap);
        break;
      }
      case "hr":
        parent.appendChild(el("hr", "md-hr"));
        break;
      case "list": {
        const list = el(t.ordered ? "ol" : "ul", "md-list");
        if (t.ordered && typeof t.start === "number" && t.start !== 1) list.start = t.start;
        for (const item of t.items || []) {
          const li = el("li", "md-li" + (item.task ? " is-task" : ""));
          if (item.task) {
            const box = el("span", "md-task" + (item.checked ? " is-done" : ""));
            box.textContent = item.checked ? "✓" : "·";
            box.setAttribute("aria-label", item.checked ? "done" : "not done");
            li.appendChild(box);
          }
          blockInto(li, item.tokens);
          list.appendChild(li);
        }
        parent.appendChild(list);
        break;
      }
      case "table": {
        const scroll = el("div", "md-table-wrap");
        const table = el("table", "md-table");
        const thead = el("thead");
        const hr = el("tr");
        (t.header || []).forEach((cell, i) => {
          const th = el("th");
          if (t.align && t.align[i]) th.style.textAlign = t.align[i];
          inlineInto(th, cell.tokens);
          hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = el("tbody");
        for (const row of t.rows || []) {
          const tr = el("tr");
          row.forEach((cell, i) => {
            const td = el("td");
            if (t.align && t.align[i]) td.style.textAlign = t.align[i];
            inlineInto(td, cell.tokens);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        scroll.appendChild(table);
        parent.appendChild(scroll);
        break;
      }
      default: {
        // Unknown or raw html block: show the source, do not interpret it.
        const p = el("p", "md-p");
        p.textContent = t.raw ?? t.text ?? "";
        parent.appendChild(p);
      }
    }
  }
}

/** Render markdown into a fresh element. Returns the element. */
export function md(source, className = "md") {
  const host = el("div", className);
  if (!source) return host;
  let tokens;
  try {
    tokens = marked.lexer(String(source));
  } catch {
    host.appendChild(el("p", "md-p", String(source)));
    return host;
  }
  blockInto(host, tokens);
  return host;
}

/** Render markdown into an existing element, replacing its contents. */
export function mdInto(node, source) {
  node.replaceChildren();
  const rendered = md(source);
  while (rendered.firstChild) node.appendChild(rendered.firstChild);
  return node;
}

// The page's only clipboard action, in one place. writeText can be refused --
// a browser that has not granted the permission, a page that was not focused
// when the click landed -- and a button that silently does nothing is worse
// than one that says what to press instead.
//
// It lives here rather than in app.js because app.js imports this file and not
// the other way round, and a fenced code block needed it first.
//
// copyText() is the action itself: `button` reads "Copied" for a moment, then
// `label` again. `label` may be a function, read when the moment is up, for a
// button whose text can change in the meantime. `onRefused` is what the caller
// offers instead when the browser says no -- usually a selection to press
// Ctrl+C on.
async function copyText(text, button, label, onRefused) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = typeof label === "function" ? label() : label), 1400);
  } catch {
    onRefused();
  }
}

function selectContents(node) {
  try {
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {}
}

function copyButton(text, className, source) {
  const b = el("button", className || "btn small", "Copy");
  b.type = "button";
  b.addEventListener("click", () =>
    copyText(text, b, "Copy", () => {
      // "Press Ctrl+C" on its own asks them to copy a selection that does not
      // exist. Select the text for them, so the instruction is one they can
      // actually follow.
      const node = source || b.parentNode.querySelector("pre, code");
      if (node) selectContents(node);
      b.textContent = "Press Ctrl+C";
    })
  );
  return b;
}

export { el, copyButton, copyText, selectContents };
