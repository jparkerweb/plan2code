// Plan2Code Web Console - the "Strengths in the loop" fold of an agent's form.
//
// Maps the loop's three words (Thrifty, Balanced, Best) to one of the agent's
// own models, and to an effort where the agent takes one. Choices are
// select-only from the agent's Models list. An untouched row follows what
// ships; only a row the person changed is kept in the form's strength draft
// (ctx.strengthDrafts, by form key), which the form's Save sends. The rule that
// reads a row is resolveStrengths, the same module the server uses.

import { el } from "../../render.js";
import { STRENGTH_ORDER, resolveStrengths } from "../../strengths.js";
import { canonical, strengthOwner } from "./agents-data.js";

const WORDS = { thrifty: "Thrifty", balanced: "Balanced", best: "Best" };
const EFFORTS = ["low", "medium", "high"];

function option(value, text) {
  const o = el("option", null, text);
  o.value = value;
  return o;
}

/**
 * The fold for the open form. `models` is the agent's Models list ({ id, label }
 * rows) or a function returning it, read at every redraw so a model added in the
 * same form shows up. `hasEffort` adds the effort select.
 */
export function strengthsFold(ctx, agentId, draft, { models, hasEffort }) {
  const key = ctx.openKey;
  const owner = agentId || strengthOwner(key);
  const shipped = (ctx.saved.strengths.shipped && ctx.saved.strengths.shipped[owner]) || {};
  const modelList = () => {
    const rows = typeof models === "function" ? models() : models;
    const seen = new Set();
    return (rows || []).filter((m) => m && m.id && !seen.has(m.id) && seen.add(m.id));
  };
  // The person's own rows: the draft once changed, else what is saved.
  const userRows = () => {
    const rows = ctx.strengthDrafts.has(key) ? ctx.strengthDrafts.get(key) : ctx.saved.strengths.user && ctx.saved.strengths.user[owner];
    return rows && typeof rows === "object" ? rows : {};
  };

  const details = el("details", "agent-fold prefs-agents-strengths");
  details.open = ctx.strengthsOpen;
  details.addEventListener("toggle", () => (ctx.strengthsOpen = details.open));
  details.appendChild(el("summary", null, "Strengths in the loop"));
  const body = el("div", "strength-body");
  details.appendChild(body);

  function setRow(word, row) {
    const next = { ...userRows() };
    if (row) next[word] = row;
    else delete next[word];
    ctx.strengthDrafts.set(key, next);
    ctx.edited();
  }

  function draw() {
    const active = document.activeElement;
    const back = active && body.contains(active) ? { word: active.closest("[data-word]")?.dataset.word, field: active.dataset.field } : null;
    body.replaceChildren();
    const list = modelList();
    if (!list.length) {
      body.appendChild(el("p", "help strength-empty", "Add a model under Models first"));
      return;
    }
    const base = { shipped, models: list.map((m) => m.id), hasEffort };
    const user = userRows();
    const resolved = resolveStrengths({ ...base, user });
    const dflt = resolveStrengths({ ...base, user: {} });

    for (const word of STRENGTH_ORDER) {
      const row = el("div", "strength-row");
      row.dataset.word = word;
      row.appendChild(el("span", "strength-word", WORDS[word]));

      const model = el("select");
      model.dataset.field = "model";
      model.setAttribute("aria-label", `${WORDS[word]} model`);
      // Nothing ships for this word: "not mapped" is a real choice. With a default,
      // clearing a row is Reset's job.
      if (!dflt[word]) model.appendChild(option("", "not mapped"));
      for (const m of list) model.appendChild(option(m.id, m.label && m.label !== m.id ? `${m.label} (${m.id})` : m.id));
      model.value = resolved[word] ? resolved[word].model : "";
      model.addEventListener("change", () => {
        if (!model.value) return setRow(word, null);
        const next = { model: model.value };
        if (hasEffort && resolved[word] && resolved[word].effort) next.effort = resolved[word].effort;
        setRow(word, canonical(next) === canonical(dflt[word]) ? null : next);
      });
      row.appendChild(model);

      if (hasEffort) {
        const effort = el("select");
        effort.dataset.field = "effort";
        effort.setAttribute("aria-label", `${WORDS[word]} effort`);
        effort.disabled = !resolved[word];
        effort.appendChild(option("", "no effort"));
        for (const e of EFFORTS) effort.appendChild(option(e, e));
        effort.value = (resolved[word] && resolved[word].effort) || "";
        effort.addEventListener("change", () => {
          const next = { model: resolved[word].model };
          if (effort.value) next.effort = effort.value;
          setRow(word, canonical(next) === canonical(dflt[word]) ? null : next);
        });
        row.appendChild(effort);
      }

      if (Object.prototype.hasOwnProperty.call(user, word)) {
        const reset = el("button", "btn small ghost strength-reset", "Reset");
        reset.type = "button";
        reset.dataset.field = "reset";
        reset.setAttribute("aria-label", `Reset ${WORDS[word]}`);
        reset.addEventListener("click", () => setRow(word, null));
        row.appendChild(reset);
      } else if (resolved[word]) {
        row.appendChild(el("span", "help strength-default", "default"));
      }
      body.appendChild(row);
    }

    const offered = STRENGTH_ORDER.filter((w) => resolved[w]).map((w) => WORDS[w]);
    body.appendChild(
      el(
        "p",
        "help strength-offer",
        offered.length ? `The loop will offer: ${offered.join(", ")}` : "The loop will not offer a strength for this agent until one is mapped."
      )
    );
    if (back) {
      // A Reset that was pressed is gone with its row's change: the model select takes the focus.
      const row = body.querySelector(`[data-word="${back.word}"]`);
      (row?.querySelector(`[data-field="${back.field}"]`) || row?.querySelector('[data-field="model"]'))?.focus();
    }
  }

  ctx.strengthsRefresh = draw;
  draw();
  return details;
}
