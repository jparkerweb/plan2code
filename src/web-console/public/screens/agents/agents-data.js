// Plan2Code Web Console - the agents view's pure data helpers.
//
// Everything the agents view computes without touching the page: draft keys,
// saved lookups, dirty checks, summary rows, an agent's shape on the way in
// or out. No DOM access and no imports at module scope, so the page and
// `node --test` both import this file.

// The CLIs the launcher reads a model list for, in table order (the shipped bin/agents.json list).
export const MODEL_CLIS = ["claude", "devin", "codex"];

// What the table calls each built-in, and the command it runs (the launcher's CLIS ids).
export const BUILT_IN = { claude: "Claude", devin: "Devin", codex: "Codex" };

// The built-ins that take an effort beside the model (agents.rs has_effort).
export const HAS_EFFORT = ["claude", "codex"];

// The loop's strength mapping as the page keeps it: the shipped rows and the
// person's own, each { <agent id>: { thrifty?, balanced?, best? } }.
export function emptyStrengths() {
  return { shipped: {}, user: {} };
}

// The agent a form's strengths belong to: a built-in's cli, an added agent's id.
// An agent not yet saved has no id, so nothing of anyone else's can be its rows.
export function strengthOwner(key) {
  if (key === "agent:new") return null;
  return key.startsWith("cli:") ? cliOf(key) : agentId(key);
}

export function emptyLists() {
  return Object.fromEntries(MODEL_CLIS.map((cli) => [cli, []]));
}

export function newAgent() {
  return { name: "", command: "", args: [], prompt: "/plan2code", bypassArgs: [], modelArgs: ["--model", "{model}"], models: [] };
}

export function normalizeAgent(agent) {
  for (const key of ["args", "bypassArgs", "modelArgs", "models"]) if (!Array.isArray(agent[key])) agent[key] = [];
  return agent;
}

// A form's draft key: "cli:<cli>" for a built-in's own models, "agent:<id>"
// for an added agent, "agent:new" for one being added.
export const cliOf = (key) => key.slice("cli:".length);
export const agentId = (key) => key.slice("agent:".length);

// What a draft is checked against in `saved`: a built-in's own models for a
// cli key, a fresh newAgent for "agent:new", the added agent for "agent:<id>".
export function savedEntry(saved, key) {
  if (key.startsWith("cli:")) return saved.user[cliOf(key)] || [];
  if (key === "agent:new") return newAgent();
  return saved.agents.find((a) => a.id === agentId(key));
}

// JSON with object keys sorted, so a label removed and typed back counts as unchanged.
export function canonical(value) {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v
  );
}

// `strengthDrafts` holds, per form key, the person's own strength rows once the
// fold changed them; absent means the fold was left alone.
export function isDirty(saved, drafts, key, strengthDrafts) {
  if (!drafts.has(key)) return false;
  if (canonical(drafts.get(key)) !== canonical(savedEntry(saved, key))) return true;
  const rows = strengthDrafts && strengthDrafts.get(key);
  if (rows === undefined) return false;
  const was = (saved.strengths && saved.strengths.user[strengthOwner(key)]) || {};
  return canonical(rows) !== canonical(was);
}

export function nameOf(saved, drafts, key) {
  if (key.startsWith("cli:")) return BUILT_IN[cliOf(key)];
  const draft = drafts.get(key);
  return String((draft && draft.name) || "").trim() || savedEntry(saved, key)?.name || "a new agent";
}

export function modelNames(list) {
  return list.map((m) => m.label || m.id);
}

// One row per agent, in order: the built-ins, then the added agents (the
// view appends the v3 orchestrator row itself).
export function summaryRows(saved) {
  return [
    ...MODEL_CLIS.map((cli) => ({
      key: "cli:" + cli,
      name: BUILT_IN[cli],
      command: cli,
      models: [...saved.shipped[cli], ...saved.user[cli]],
      noneShip: saved.shipped[cli].length === 0,
    })),
    ...saved.agents.map((a) => ({ key: "agent:" + a.id, name: a.name, command: a.command, models: a.models })),
  ];
}

// The state GET /agents already worked out for a summary row's entry:
// "ok" or "missing" as drawBadge understands them, or null when the entry
// carries no state (an older server), which falls back to a live check.
export function serverStateFor(saved, row) {
  const entry = row.key.startsWith("cli:")
    ? saved.builtins.find((b) => b.id === cliOf(row.key))
    : saved.agents.find((a) => a.id === agentId(row.key));
  if (!entry || !entry.state) return null;
  return entry.state === "found" ? "ok" : "missing";
}

// The list as the server wants it: blank rows and models without an id dropped.
export function cleanAgent(a) {
  return {
    ...a,
    args: a.args.filter((v) => v !== ""),
    bypassArgs: a.bypassArgs.filter((v) => v !== ""),
    modelArgs: a.modelArgs.filter((v) => v !== ""),
    models: a.models.filter((m) => m.id),
  };
}

// A template's shape as a new-agent draft, so its Use opens the same form
// a hand-typed agent gets, prefilled rather than saved behind the back.
export function templateDraft(t) {
  return {
    name: t.name,
    command: t.command,
    prompt: t.prompt || "/plan2code",
    args: t.args || [],
    bypassArgs: t.bypassArgs || [],
    modelArgs: t.modelArgs && t.modelArgs.length ? t.modelArgs : ["--model", "{model}"],
    models: [],
  };
}
