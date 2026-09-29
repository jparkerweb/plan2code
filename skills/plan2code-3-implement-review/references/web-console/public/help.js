// Plan2Code Web Console - the Help dialog's tab list and rules.
//
// The source of truth for which tabs Help has, in what order, and which one
// opens. The content itself is HTML in <template id="help-content">
// in index.html. No DOM access at module scope and no imports: the page and
// `node --test` both import this file.

const tab = (id, label, diagram) => Object.freeze({ id, label, diagram });

export const HELP_TABS = Object.freeze([
  tab("about", "What this page is", true),
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
  tab("ask", "Ask a quick question", false),
  tab("finishing", "Stopping and finishing", false),
  tab("stuck", "When something looks stuck", true),
  tab("prefs", "Keyboard and preferences", false),
  tab("privacy", "Privacy and where things are saved", false),
]);

// Not labels.js's BUILD_WORKFLOWS: that one leaves out quick-task, which is a
// build as far as the person watching it is concerned.
const HELP_BUILD_WORKFLOWS = new Set(["implement", "implement-review", "quick-task"]);

// Which tab Help opens on, from where the person is. First match wins.
export function helpTabFor({ view, dashboard, gone, adrift, finished, workflow, workspace, meterRed } = {}) {
  const v = view || "";
  // Finished comes first: a finished session's server is stopped on purpose,
  // which also sets `gone`, and that is not something being stuck.
  if (finished || v === "end") return "finishing";
  if (gone || adrift) return "stuck";
  if (workspace) return "workspace";
  if (v === "ask") return "ask";
  if (dashboard && meterRed) return "meter";
  if (dashboard) return "dashboard";
  if (v === "overview" || v.startsWith("doc:")) return "docs";
  if (HELP_BUILD_WORKFLOWS.has(workflow)) return "build";
  return "about";
}

// The tab index a key moves to, or -1 when the key is not a tab key.
export function helpKeyTarget(key, index, count) {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return -1;
  }
}
