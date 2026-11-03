// Plan2Code Web Console - the rules of ~/.plan2code/agents.json, the person's custom agent CLIs: reading the file, checking a save, naming an entry, building its command line and finding its command; defines only.
//
// The console is the file's only writer (routes.mjs, from User Preferences);
// the launcher and the desktop app read it with their own copies of these
// rules. scripts/fixtures/agents-cases.json pins all three to the same cases,
// so change a rule there first.
//
// Node built-ins only. No build step.

import fs from "node:fs";
import path from "node:path";

import { loadAgentList } from "./agent-lookup.mjs";
import { SHIPPED_AGENTS_FILE } from "./files.mjs";

// The built-in ids come from the shipped list (bin/agents.json), so adding a
// built-in agent needs no code change here. The hard-coded trio is only the
// fallback for a missing or unreadable file. Worked out once at load, never
// throws: a broken shipped file must not take the whole module down.
function shippedBuiltinIds() {
  try {
    const { builtins } = loadAgentList({ dir: path.dirname(SHIPPED_AGENTS_FILE) });
    const ids = builtins.map((a) => a && a.id).filter((id) => typeof id === "string" && id);
    if (ids.length) return ids;
  } catch {}
  return ["claude", "devin", "codex"];
}

export const BUILTIN_AGENT_IDS = shippedBuiltinIds();
export const AGENTS_SCHEMA = 1;
export const MAX_AGENTS = 50;

const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_NAME = 60;
const DEFAULT_PROMPT = "/plan2code";
const DEFAULT_MODEL_ARGS = ["--model", "{model}"];
const LIST_FIELDS = ["args", "bypassArgs", "modelArgs"];

/**
 * The file as the launcher and the app will use it: `raw` is its text (or the
 * parsed value; undefined or null when there is no file). Bad entries are
 * skipped and named in `warnings`, and a bad file means no agents. Never throws.
 */
export function normalizeAgents(raw) {
  const warnings = [];
  if (raw === undefined || raw === null) return { agents: [], warnings };
  let file = raw;
  if (typeof raw === "string") {
    try {
      file = JSON.parse(raw);
    } catch {
      return { agents: [], warnings: ["agents.json is not valid JSON, so no custom agents are used"] };
    }
  }
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    return { agents: [], warnings: ["agents.json is not an object, so no custom agents are used"] };
  }
  if (file.schema !== AGENTS_SCHEMA) {
    return { agents: [], warnings: [`agents.json has schema ${JSON.stringify(file.schema)}, not ${AGENTS_SCHEMA}, so no custom agents are used`] };
  }
  if (file.agents === undefined || file.agents === null) return { agents: [], warnings };
  if (!Array.isArray(file.agents)) return { agents: [], warnings: ["agents.json: agents is not a list, so no custom agents are used"] };

  let list = file.agents;
  if (list.length > MAX_AGENTS) {
    warnings.push(`agents.json lists ${list.length} agents; only the first ${MAX_AGENTS} are used`);
    list = list.slice(0, MAX_AGENTS);
  }
  const agents = [];
  const ids = new Set();
  const names = new Set();
  list.forEach((entry, index) => {
    const out = checkEntry(entry, ids, names);
    if (out.error) return warnings.push(`agents[${index}] skipped: ${out.error}`);
    ids.add(out.agent.id);
    names.add(out.agent.name.toLowerCase());
    agents.push(out.agent);
  });
  return { agents, warnings };
}

/**
 * What the form sends, checked before it is written: the same rules as
 * normalizeAgents, but the first failure comes back as { error, index, field }
 * instead of being skipped. An entry with no id gets one from its name.
 * Returns { agents } with every default filled.
 */
export function validateForSave(list) {
  if (!Array.isArray(list)) return { error: "agents must be a list", field: "agents" };
  if (list.length > MAX_AGENTS) return { error: `at most ${MAX_AGENTS} agents`, field: "agents" };
  // Ids the form already carries are fixed, so a new entry's id steers around them.
  const taken = list.map((entry) => (entry && typeof entry === "object" && typeof entry.id === "string" ? entry.id : "")).filter(Boolean);
  const agents = [];
  const ids = new Set();
  const names = new Set();
  for (let index = 0; index < list.length; index++) {
    let entry = list[index];
    if (entry && typeof entry === "object" && !Array.isArray(entry) && (entry.id === undefined || entry.id === null || entry.id === "")) {
      const id = makeId(typeof entry.name === "string" ? entry.name : "", taken);
      taken.push(id);
      entry = { ...entry, id };
    }
    const out = checkEntry(entry, ids, names);
    if (out.error) return { error: out.error, index, field: out.field };
    ids.add(out.agent.id);
    names.add(out.agent.name.toLowerCase());
    agents.push(out.agent);
  }
  return { agents };
}

// One entry against the rules: { agent } with the defaults filled and any
// unknown keys kept, or { error, field } naming the first thing wrong.
function checkEntry(entry, ids, names) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { error: "not an object", field: "" };
  const { id } = entry;
  if (typeof id !== "string" || !id) return { error: "id is missing", field: "id" };
  if (BUILTIN_AGENT_IDS.includes(id)) return { error: `id "${id}" belongs to a built-in agent`, field: "id" };
  if (!AGENT_ID.test(id)) return { error: `id "${id}" must be 1 to 32 lowercase letters, digits or dashes, starting with a letter or digit`, field: "id" };
  if (ids.has(id)) return { error: `id "${id}" is already used`, field: "id" };

  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (!name) return { error: "name is missing", field: "name" };
  if (name.length > MAX_NAME) return { error: `name is longer than ${MAX_NAME} characters`, field: "name" };
  if (names.has(name.toLowerCase())) return { error: `name "${name}" is already used`, field: "name" };

  const command = typeof entry.command === "string" ? entry.command.trim() : "";
  if (!command) return { error: "command is missing", field: "command" };

  const agent = { ...entry, id, name, command };
  for (const field of LIST_FIELDS) {
    const value = entry[field];
    if (value === undefined || value === null) {
      agent[field] = field === "modelArgs" ? [...DEFAULT_MODEL_ARGS] : [];
    } else if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
      return { error: `${field} must be a list of text`, field };
    } else agent[field] = [...value];
  }

  if (entry.prompt === undefined || entry.prompt === null) agent.prompt = DEFAULT_PROMPT;
  else if (typeof entry.prompt !== "string") return { error: "prompt must be text", field: "prompt" };

  if (entry.models === undefined || entry.models === null) agent.models = [];
  else if (!Array.isArray(entry.models)) return { error: "models must be a list", field: "models" };
  else {
    agent.models = [];
    const seen = new Set();
    for (const model of entry.models) {
      if (!model || typeof model !== "object" || typeof model.id !== "string") return { error: "every model in models needs an id", field: "models" };
      const modelId = model.id.trim();
      if (!modelId || seen.has(modelId)) continue;
      seen.add(modelId);
      const label = typeof model.label === "string" ? model.label.trim() : "";
      agent.models.push(label ? { id: modelId, label } : { id: modelId });
    }
  }
  return { agent };
}

/**
 * An id for a new entry: its name in kebab case ("agent" when nothing is
 * left), at most 32 characters, with -2, -3 ... on a clash with `taken` or a
 * built-in id.
 */
export function makeId(name, taken = []) {
  const used = new Set([...BUILTIN_AGENT_IDS, ...taken]);
  const base = trimDashes(
    String(name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32)
  ) || "agent";
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = trimDashes(base.slice(0, 32 - suffix.length)) + suffix;
    if (!used.has(id)) return id;
  }
}

function trimDashes(text) {
  return text.replace(/^-+|-+$/g, "");
}

/**
 * The arguments that start an entry, in order: `args` with {prompt} filled
 * (the prompt appended when no argument holds it), then `modelArgs` when a
 * model is chosen, then `bypassArgs` when checks are off. An argument that is
 * exactly `{bypass}` or `{model}` expands to the entry's `bypassArgs` /
 * `modelArgs` in place (nothing when off / unset) and that flag is no longer
 * appended at the end. `prompt` defaults to the entry's own; a blank one
 * drops an argument that is exactly {prompt}. Plain text in, plain text out:
 * no quoting for any shell.
 */
export function buildArgs(entry, { prompt, model, bypass } = {}) {
  const text = prompt === undefined ? (typeof entry.prompt === "string" ? entry.prompt : DEFAULT_PROMPT) : String(prompt ?? "");
  const blank = !text.trim();
  const modelArgs = entry.modelArgs || DEFAULT_MODEL_ARGS;
  const out = [];
  let placed = false;
  let hasBypass = false;
  let hasModel = false;
  for (const arg of entry.args || []) {
    if (arg === "{bypass}") {
      hasBypass = true;
      if (bypass) out.push(...(entry.bypassArgs || []));
      continue;
    }
    if (arg === "{model}") {
      hasModel = true;
      if (model) for (const m of modelArgs) out.push(m.split("{model}").join(model));
      continue;
    }
    if (arg.includes("{bypass}")) hasBypass = true;
    if (arg.includes("{model}")) hasModel = true;
    if (!arg.includes("{prompt}") && !arg.includes("{model}")) {
      out.push(arg);
      continue;
    }
    if (arg === "{prompt}" && blank) {
      placed = true;
      continue;
    }
    let next = arg;
    if (next.includes("{prompt}")) {
      placed = true;
      next = next.split("{prompt}").join(text);
    }
    if (next.includes("{model}")) next = next.split("{model}").join(model || "");
    out.push(next);
  }
  if (!placed && !blank) out.push(text);
  if (model && !hasModel) {
    for (const arg of modelArgs) out.push(arg.split("{model}").join(model));
  }
  if (bypass && !hasBypass) out.push(...(entry.bypassArgs || []));
  return out;
}

/**
 * Where `command` runs from, or null. A command with a path separator is
 * checked as a file; a bare name is looked for on PATH. On Windows each
 * PATHEXT extension is tried when the command has none, as the launcher's
 * findOnPath() does. Never runs anything.
 */
export function resolveCommand(command, { path: searchPath = process.env.PATH, pathext = process.env.PATHEXT } = {}) {
  const name = String(command ?? "").trim().replace(/^"(.*)"$/, "$1");
  if (!name) return null;
  const windows = process.platform === "win32";
  const extensions = windows ? (pathext || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean) : [];
  const tries = (file) => (windows && !path.extname(file) ? extensions.map((ext) => file + ext) : [file]);
  const isFile = (file) => {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  };

  if (name.includes("/") || (windows && name.includes("\\"))) {
    return tries(path.resolve(name)).find(isFile) || null;
  }
  for (const dir of String(searchPath || "").split(path.delimiter).filter(Boolean)) {
    const found = tries(path.join(dir.replace(/^"|"$/g, ""), name)).find(isFile);
    if (found) return found;
  }
  return null;
}
