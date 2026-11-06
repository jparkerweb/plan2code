// The loop's strength rule, shared by the page and the server (strengths.mjs re-exports it).
// Turns Thrifty, Balanced and Best into a model (and effort) for one agent. Pure functions, no file reads: the caller passes the
// shipped and user mappings (the `strengths` key of models.json) and the
// agent's Models list. Held to scripts/fixtures/strength-cases.json; the Rust
// twin is `resolve_strengths` / `next_strength` in
// plan2code-app/src-tauri/src/models.rs, held to the same file.

export const STRENGTH_ORDER = ["thrifty", "balanced", "best"];
const EFFORTS = ["low", "medium", "high"];

// One row as the resolver keeps it, or null when the row is not usable: the
// model must be a string in `models`; an effort survives only when the agent
// takes one and it is low, medium or high.
function validRow(row, models, hasEffort) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  if (typeof row.model !== "string" || !models.includes(row.model)) return null;
  const out = { model: row.model };
  if (hasEffort && EFFORTS.includes(row.effort)) out.effort = row.effort;
  return out;
}

/**
 * { thrifty?, balanced?, best? } for one agent: per word the user's row if it is
 * valid, else the shipped row if it is valid. A word with neither is left out
 * (unmapped).
 */
export function resolveStrengths({ shipped, user, models, hasEffort } = {}) {
  const list = Array.isArray(models) ? models : [];
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const resolved = {};
  for (const word of STRENGTH_ORDER) {
    const row = validRow(obj(user)[word], list, !!hasEffort) || validRow(obj(shipped)[word], list, !!hasEffort);
    if (row) resolved[word] = row;
  }
  return resolved;
}

/** The first mapped word after `word` in STRENGTH_ORDER, else null. */
export function nextStrength(resolved, word) {
  const at = STRENGTH_ORDER.indexOf(word);
  if (at < 0) return null;
  const have = resolved && typeof resolved === "object" ? resolved : {};
  for (const next of STRENGTH_ORDER.slice(at + 1)) if (have[next]) return next;
  return null;
}
