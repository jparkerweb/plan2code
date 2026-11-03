// Plan2Code Web Console - the Help dialog's tab list and rules.
//
// The source of truth for which tabs Help has, in what order, and which one
// opens. The content itself is HTML in <template id="help-content">
// in index.html. No DOM access at module scope, and its one import is the
// data-only skills.js: the page and `node --test` both import this file.

import { SKILLS, isBuild } from "./skills.js";

const tab = (id, label, diagram) => Object.freeze({ id, label, diagram });

export const HELP_TABS = Object.freeze([
  tab("about", "What this page is", true),
  tab("stuck", "When something looks stuck", true),
  tab("around", "Finding your way around", true),
  tab("workspace", "Your workspace", false),
  tab("planny", "Reading Planny", true),
  tab("answering", "Answering questions", false),
  tab("sending", "Sending and what happens next", true),
  tab("notes", "Notes and attachments", false),
  tab("docs", "Documents and printing", false),
  tab("dashboard", "The dashboard", true),
  tab("meter", "Session meter", false),
  tab("build", "Watching a build", false),
  tab("loop", "Implementation Loop", true),
  tab("git", "The git board", false),
  tab("subagents", "Helpers (subagents)", false),
  tab("ask", "Ask a quick question", false),
  tab("activities", "Activities", false),
  tab("finishing", "Stopping and finishing", false),
  tab("prefs", "Keyboard and preferences", false),
  tab("setup", "Setting up an agent", false),
  tab("privacy", "Privacy and where things are saved", false),
]);

// Not labels.js's BUILD_WORKFLOWS: that one leaves out quick-task, which is a
// build as far as the person watching it is concerned. Every build in skills.js.
const HELP_BUILD_WORKFLOWS = new Set(SKILLS.filter((s) => isBuild(s.workflow)).map((s) => s.workflow));

// Which tab Help opens on, from where the person is. First match wins.
export function helpTabFor({ view, dashboard, gone, adrift, finished, workflow, workspace, meterRed } = {}) {
  const v = view || "";
  // Finished comes first: a finished session's server is stopped on purpose,
  // which also sets `gone`, and that is not something being stuck.
  if (finished || v === "end") return "finishing";
  if (gone || adrift) return "stuck";
  if (workspace) return "workspace";
  if (v === "ask") return "ask";
  if (v === "subagents") return "subagents";
  if (workflow === "setup") return "setup";
  if (dashboard && meterRed) return "meter";
  if (dashboard) return "dashboard";
  if (v === "overview" || v === "map" || v === "draft" || v.startsWith("doc:")) return "docs";
  if (workflow === "git") return "git";
  if (HELP_BUILD_WORKFLOWS.has(workflow)) return "build";
  return "about";
}

// The tab index a key moves to, or -1 when the key is not a tab key: the
// shared tab helper's, under the name Help and the git board import.
export { tabKeyTarget as helpKeyTarget } from "./tabs.js";
