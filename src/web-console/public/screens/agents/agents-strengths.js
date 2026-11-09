// Plan2Code Web Console - the "In the loop" panel of an agent's form.
//
// Maps the loop's three words (Thrifty, Balanced, Best) to one of the agent's
// own models, and to an effort where the agent takes one. The panel is two
// halves that stay in step: a summary box (one row per word: the model it
// resolves to, an effort select, and Reset or "default") and a pill set each
// model row carries, where tapping a word on a model makes it that word's pick.
// An untouched row follows what ships; only a row the person changed is kept in
// the form's strength draft (ctx.strengthDrafts, by form key), which the form's
// Save sends. The rule that reads a row is resolveStrengths, the same module the
// server uses.

import { el } from "../../render.js";
import { STRENGTH_ORDER, resolveStrengths } from "../../strengths.js";
import { canonical, strengthOwner } from "./agents-data.js";

export const WORDS = { thrifty: "Thrifty", balanced: "Balanced", best: "Best" };
const HINTS = { thrifty: "Quick, cheap steps", balanced: "The everyday pick", best: "The hardest steps" };
const EFFORTS = ["low", "medium", "high"];

function option(value, text) {
  const o = el("option", null, text);
  o.value = value;
  return o;
}

// A word as a colored chip: Thrifty, Balanced and Best get the rank colors.
export function wordChip(word) {
  return el("span", "tier t-" + word, WORDS[word]);
}

/**
 * The panel for the open form. `models` is the agent's Models list ({ id, label }
 * rows) or a function returning it, read at every redraw so a model added in the
 * same form shows up. `hasEffort` adds the effort select. Returns
 * { box, pills(id, label), refresh }: the summary box, a builder for one model's
 * pill set, and the redraw the form's edits call through ctx.strengthsRefresh.
 */
export function strengthsPanel(ctx, agentId, draft, { models, hasEffort }) {
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
  const state = () => {
    const list = modelList();
    const base = { shipped, models: list.map((m) => m.id), hasEffort };
    return { list, user: userRows(), resolved: resolveStrengths({ ...base, user: userRows() }), dflt: resolveStrengths({ ...base, user: {} }) };
  };
  const labelOf = (id) => {
    const m = modelList().find((x) => x.id === id);
    return m ? m.label || m.id : id;
  };

  const box = el("div", "strength-body prefs-agents-strengths");
  const pillSets = [];

  function setRow(word, row) {
    const next = { ...userRows() };
    if (row) next[word] = row;
    else delete next[word];
    ctx.strengthDrafts.set(key, next);
    ctx.edited();
  }

  function choose(word, id) {
    const { resolved, dflt } = state();
    const now = resolved[word];
    if (now && now.model === id) {
      // Tapping the pick again clears it only where nothing ships for the word;
      // with a default, putting it back is Reset's job.
      if (!dflt[word]) setRow(word, null);
      return;
    }
    const next = { model: id };
    if (hasEffort && now && now.effort) next.effort = now.effort;
    setRow(word, canonical(next) === canonical(dflt[word]) ? null : next);
  }

  function refresh() {
    const active = document.activeElement;
    const back = active && box.contains(active) ? active.closest("[data-word]")?.dataset.word : null;
    box.replaceChildren();
    const { list, user, resolved, dflt } = state();
    if (!list.length) {
      box.appendChild(el("p", "help strength-empty", "Add a model first, then choose which one the loop uses for each strength."));
    } else {
      for (const word of STRENGTH_ORDER) {
        const row = el("div", "strength-row");
        row.dataset.word = word;
        const label = el("span", "strength-word");
        label.append(wordChip(word), el("small", "help", HINTS[word]));
        row.appendChild(label);
        const pick = resolved[word];
        row.appendChild(el("span", pick ? "strength-model" : "strength-model none", pick ? labelOf(pick.model) : "not mapped"));
        if (hasEffort) {
          const effort = el("select");
          effort.dataset.field = "effort";
          effort.setAttribute("aria-label", `${WORDS[word]} effort`);
          effort.disabled = !pick;
          effort.appendChild(option("", "no effort"));
          for (const e of EFFORTS) effort.appendChild(option(e, e));
          effort.value = (pick && pick.effort) || "";
          effort.addEventListener("change", () => {
            const next = { model: pick.model };
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
        } else if (pick) {
          row.appendChild(el("span", "help strength-default", "default"));
        }
        box.appendChild(row);
      }
      const offered = STRENGTH_ORDER.filter((w) => resolved[w]).map((w) => WORDS[w]);
      box.appendChild(
        el(
          "p",
          "help strength-offer",
          offered.length ? `The loop will offer: ${offered.join(", ")}` : "The loop will not offer a strength for this agent until one is mapped."
        )
      );
    }
    for (const set of pillSets) {
      const now = state().resolved;
      for (const p of set.pills) p.btn.setAttribute("aria-pressed", String(Boolean(now[p.word] && now[p.word].model === set.id)));
    }
    if (back) {
      // A Reset that was pressed is gone with its change: the row's effort select, else its pick, takes the focus.
      const row = box.querySelector(`[data-word="${back}"]`);
      const target = row?.querySelector("select") || document.querySelector(`.strength-pill[data-word="${back}"][aria-pressed="true"]`);
      target?.focus();
    }
  }

  // One model's pill set: the three words as toggle buttons, one pressed per word.
  function pills(id, label) {
    const wrap = el("span", "strength-pills");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", `Use ${label} as`);
    const set = { id, pills: [] };
    const now = state().resolved;
    for (const word of STRENGTH_ORDER) {
      const btn = el("button", "strength-pill t-" + word, WORDS[word]);
      btn.type = "button";
      btn.dataset.word = word;
      btn.dataset.model = id;
      btn.setAttribute("aria-pressed", String(Boolean(now[word] && now[word].model === id)));
      btn.setAttribute("aria-label", `Use ${label} as ${WORDS[word]}`);
      btn.addEventListener("click", () => choose(word, id));
      set.pills.push({ btn, word });
      wrap.appendChild(btn);
    }
    pillSets.push(set);
    return wrap;
  }

  ctx.strengthsRefresh = refresh;
  refresh();
  return { box, pills, refresh };
}
