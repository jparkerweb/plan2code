// The bar's pure decisions, kept out of app.js so they can be imported and
// tested without a DOM or `window.__TAURI__` (app.js touches both at module
// scope, the same reason the web console keeps its own pure logic in
// answers.js rather than app.js).

// The button label for each next-step action. Both ways of reconnecting the
// console read the same, wherever they come from.
export const NEXT_STEP_LABELS = {
  reconnect: 'Reconnect the console',
  'restart-console': 'Reconnect the console',
  update: 'Update skills',
  'update-restart': 'Update and restart',
  'restart-app': 'Restart Plan2Code',
};

// What a person can still run in a terminal to move to the newest release, the same line the
// web console's banner gives. The app updates itself ("Update and restart"); Update skills
// stays pinned to the app's own version, so this line is the fallback when that fails.
export const NEW_RELEASE_COMMAND = 'plan2code update';

/** The release notes page of a version, opened through the shell's link opener. */
export function releaseNotesUrl(version) {
  return `https://github.com/jparkerweb/plan2code/releases/tag/v${String(version).replace(/^v/, '')}`;
}

// How often the app asks again whether a newer release is out: it stays open for days.
export const UPDATE_RECHECK_MS = 4 * 60 * 60 * 1000;

/**
 * What the release check's answer (`{ latest, problem }`, from `check_new_release`) does to the
 * bar's release state `current` (the shape barNextSteps reads). An update that is running, or
 * done and waiting for its restart, is never replaced by a later check; a version found shows
 * "Update available"; a check that could not run (git missing) says so, once; current and no
 * problem clears an old "available" or "could not check" state.
 */
export function releaseAfterCheck(current, result) {
  if (current && (current.updating !== undefined || current.restartNeeded)) return current;
  const latest = result && typeof result.latest === 'string' && result.latest ? result.latest : '';
  const problem = result && typeof result.problem === 'string' && result.problem ? result.problem : '';
  if (latest) return { latest };
  if (problem) return { problem };
  return null;
}

/**
 * What the console page's **continue** button types into the agent's
 * terminal, one write each: the word, then Enter. Claude Code holds typed
 * text as a queued message while its turn is busy, and the button only shows
 * once the agent stopped checking in with the console, so by then the turn is
 * stuck and the queued word would never send by itself: for it, the send-now
 * chord (ctrl+x ctrl+s) follows. Any id it does not know (a custom agent)
 * gets the plain word and Enter.
 */
export function continueKeys(kind) {
  const keys = ['continue', '\r'];
  if (kind === 'claude') keys.push('\x18\x13');
  return keys;
}

/**
 * Which agent the launch card starts on, from `agent_availability`'s list
 * (built-ins first, then custom agents): the remembered id when it is
 * installed, else the first installed built-in, else the first installed
 * custom agent, else the remembered id or the first entry, so the card's
 * missing-agent line explains what is wrong instead of picking silently. A
 * remembered id the list no longer has (a custom agent deleted since) is not
 * kept, since the picker could not show it; with no list at all it is.
 */
export function pickDefaultAgent(availability, remembered) {
  const list = Array.isArray(availability) ? availability : [];
  const rememberedEntry = list.find((a) => a.id === remembered);
  if (rememberedEntry && rememberedEntry.installed) return remembered;
  const builtIn = list.find((a) => a.installed && !a.custom);
  if (builtIn) return builtIn.id;
  const custom = list.find((a) => a.installed && a.custom);
  if (custom) return custom.id;
  if (remembered && (rememberedEntry || list.length === 0)) return remembered;
  return list.length > 0 ? list[0].id : null;
}

/**
 * The one-line notice for the launch card when the remembered agent is gone
 * but another works (FR-13): the id the card picks instead, or null when the
 * remembered one still runs or nothing else does.
 */
export function lastAgentNotice(list, remembered) {
  const entries = Array.isArray(list) ? list : [];
  if (!remembered) return null;
  const hit = entries.find((a) => a.id === remembered);
  if (hit && hit.installed) return null;
  const using = pickDefaultAgent(entries, remembered);
  if (!using || using === remembered) return null;
  const usingEntry = entries.find((a) => a.id === using);
  return usingEntry && usingEntry.installed ? using : null;
}

/**
 * What the right end of the bar offers, most pressing first: the bar shows
 * the first step (short text plus its one button) and counts the rest as
 * "+N more". `consoleDead` is whether the console stopped answering;
 * `version` is the skills/app version state, or null when they agree:
 * `{ kind: 'mismatch' | 'ahead' | 'remains', skills, app }`,
 * `{ kind: 'updating', line }`, `{ kind: 'updated' }`, `{ kind: 'too-old' }`
 * or `{ kind: 'failed', error }`.
 *
 * Only one control for "reconnect the console" is ever offered: after an
 * update, its Reconnect (which stops the old console first, so the new skills
 * are really picked up) covers a console that has also stopped.
 */
export function barNextSteps({ consoleDead = false, version = null, newRelease = null, updatedTo = null, notReplaced = null } = {}) {
  const v = version || {};
  const steps = [];
  if (v.kind === 'updated') {
    steps.push({ id: 'updated', text: 'Skills updated', title: 'Updated. Reconnect the console to use the new version.', tone: 'ok', action: 'restart-console' });
  } else if (consoleDead) {
    steps.push({ id: 'console-dead', text: 'Console stopped', title: 'The console stopped, so the dashboard cannot show.', tone: 'err', action: 'reconnect' });
  }
  switch (v.kind) {
    case 'too-old':
      steps.push({ id: 'too-old', text: 'Console too old for this app', title: 'The installed console is too old for the app. Update skills to fix it.', tone: 'warn', action: 'update' });
      break;
    case 'mismatch':
      steps.push({ id: 'mismatch', text: `Skills v${v.skills}, app v${v.app}`, title: `The installed skills are v${v.skills}, this app is v${v.app}.`, tone: 'warn', action: 'update' });
      break;
    case 'updating': {
      const line = v.line || 'Updating Plan2Code...';
      steps.push({ id: 'updating', text: line, title: line, tone: 'warn', busy: true, action: null });
      break;
    }
    case 'remains':
      steps.push({ id: 'remains', text: `Still mismatched: skills v${v.skills}, app v${v.app}`, title: `Updated, but the mismatch remains (skills v${v.skills}, app v${v.app}).`, tone: 'warn', action: null });
      break;
    case 'failed':
      steps.push({ id: 'failed', text: 'Update failed', title: String(v.error || 'The update did not finish.'), tone: 'err', action: 'update' });
      break;
    case 'ahead':
      steps.push({ id: 'ahead', text: `Skills v${v.skills} are newer than this app`, title: `The installed skills are v${v.skills}, newer than this app (v${v.app}). Get the new app.`, tone: 'warn', action: null });
      break;
    default:
      break;
  }
  // Last: the pending fix for a mismatch or a stopped console comes before a release that is
  // merely out. `newRelease` is one of `{ latest }` (out), `{ latest, updating: line }`,
  // `{ latest, failed: reason }`, `{ latest, restartNeeded: true }` (installed, waiting for the
  // restart) or `{ problem }` (the check could not run); `updatedTo` is the version the app
  // restarted into, shown once.
  const rel = newRelease || {};
  const notes = rel.latest ? { label: "What's new", url: releaseNotesUrl(rel.latest) } : null;
  if (rel.latest) {
    const latest = rel.latest;
    if (rel.restartNeeded) {
      steps.push({ id: 'new-release', text: `Updated to v${latest}`, title: `Plan2Code v${latest} is installed. Restart Plan2Code to use it.`, tone: 'ok', action: 'restart-app', link: notes });
    } else if (rel.updating !== undefined) {
      const line = rel.updating || `Updating to v${latest}...`;
      steps.push({ id: 'new-release', text: line, title: line, tone: 'warn', busy: true, action: null });
    } else if (rel.failed) {
      steps.push({ id: 'new-release', text: 'Update failed', title: `${rel.failed} Plan2Code is still running as it was. You can try again, or run \`${NEW_RELEASE_COMMAND}\` in a terminal.`, tone: 'err', action: 'update-restart', link: notes });
    } else {
      steps.push({ id: 'new-release', text: `Update available: v${latest}`, title: `Plan2Code v${latest} is out. Update and restart installs it; nothing needs a terminal.`, tone: 'warn', action: 'update-restart', link: notes });
    }
  } else if (rel.problem) {
    steps.push({ id: 'update-check', text: 'Could not check for updates', title: String(rel.problem), tone: 'warn', action: null });
  }
  if (updatedTo) {
    steps.push({ id: 'updated-to', text: `Updated to v${updatedTo}`, title: `Plan2Code was updated to v${updatedTo}.`, tone: 'ok', action: null });
  }
  // The restart came back on the same version: the release has no desktop app file for this system
  // yet, so the installer kept the old one. Said once, instead of "Updated to" the unchanged version.
  if (notReplaced) {
    steps.push({ id: 'not-replaced', text: 'App not replaced', title: `The skills were updated, but this release has no desktop app for this system yet, so Plan2Code is still on v${notReplaced}.`, tone: 'warn', action: null });
  }
  return steps.map((step) => ({ ...step, label: step.action ? NEXT_STEP_LABELS[step.action] : null }));
}

// Below this many px of its own width, the console's "Notes on this" aside
// stacks under the main column instead of sitting beside it
// (src/web-console/public/styles/responsive.css's 1080px breakpoint).
export const CONSOLE_ASIDE_BREAKPOINT_PX = 1080;
// A roomy default width for the terminal docked at the side, before the
// console's own width is taken into account.
const IDEAL_RIGHT_PANE_PX = 440;

/**
 * The terminal panel's width, as a share of the window, for a first run with
 * nothing saved yet: docked right, at whatever width keeps the console's own
 * aside panel from stacking, down to `minFraction` when the window is too
 * narrow for both (its own minimum still wins over squeezing the console).
 */
export function defaultRightFraction(windowWidth, { minFraction, maxFraction, idealPanePx = IDEAL_RIGHT_PANE_PX, consoleMinPx = CONSOLE_ASIDE_BREAKPOINT_PX } = {}) {
  const roomForConsole = Math.max(0, windowWidth - consoleMinPx);
  const panePx = Math.min(idealPanePx, roomForConsole);
  const fraction = windowWidth > 0 ? panePx / windowWidth : minFraction;
  return Math.min(maxFraction, Math.max(minFraction, fraction));
}

/**
 * The OS window title for a project folder: its own name (the repo's, most
 * of the time) after "Plan2Code - ", so two or more windows read apart in a
 * taskbar without opening each to see which project is which. Trailing
 * slashes and a drive root (`C:\`, `/`) leave nothing to show, so that falls
 * back to the plain title rather than a trailing "Plan2Code - ".
 */
export function windowTitleFor(dir) {
  const name = lastSegment(dir);
  return name ? `Plan2Code - ${name}` : "Plan2Code";
}

/**
 * The window title while a loop runs, so its state shows in the taskbar too.
 */
export function loopWindowTitle(dir, state) {
  const name = lastSegment(dir);
  const what = state.step === "Waiting on you" ? `Loop needs you: Phase ${state.phase}` : `Loop: Phase ${state.phase} of ${state.phases}`;
  return name ? `${what} - ${name}` : what;
}

/**
 * What the loop banner says, from the app's `loop-state`: the one clear word on
 * what the loop is doing right now. `tone` is "running" or "waiting", `hint` the
 * line beside the phase pips and `pips` one "done", "current" or "todo" per phase
 * of the spec up to the last this run builds.
 */
export function loopBanner(state) {
  const { phase, phases, phaseName, step } = state;
  const named = phaseName ? `Phase ${phase} of ${phases}: ${phaseName}` : `Phase ${phase} of ${phases}`;
  const pips = Array.from({ length: Math.max(phases, 0) }, (_, i) => (i + 1 < phase ? "done" : i + 1 === phase ? "current" : "todo"));
  const base = { tone: "running", pips, hint: "Working on its own. You can walk away." };
  if (state.stopping) {
    return { ...base, title: "Stopping", detail: "The agent is ending. Nothing more will be committed.", hint: "The stop screen follows in a moment." };
  }
  if (step === "Waiting on you") {
    return { ...base, tone: "waiting", title: "The loop needs your answer", detail: `${named} is waiting on the question below.`, hint: "Nothing is lost while it waits." };
  }
  if (state.stopAfterPhase) {
    return { ...base, title: "Stopping after this phase", detail: `${named} finishes its checks and commit, then the loop stops.`, hint: "Stop now ends the agent at once." };
  }
  if (step === "Starting") {
    if (state.phaseRetried) return { ...base, title: `Retrying Phase ${phase}`, detail: `The agent crashed or went quiet, so a fresh one is picking up ${named}.` };
    if (state.previousPhase) {
      const how = state.previousCommitted ? "done and committed" : "done";
      return { ...base, title: `Phase ${state.previousPhase} ${how}`, detail: `Opening a fresh agent for ${named}.` };
    }
    return { ...base, title: "Starting the loop", detail: `Opening a fresh agent for ${named}.` };
  }
  const ran = loopRunText(state);
  const where = step ? `${named} \u00b7 ${step}` : named;
  return { ...base, title: "Implementation loop running", detail: ran ? `${where} \u00b7 ${ran}` : where };
}

/**
 * What the running phase runs on, from the app's `loop-state`: "Thrifty (sonnet,
 * low)" for a phase on a strength, "(opus, high)" for a Match my session phase
 * with a known model, and "" when the loop runs as it always did.
 */
export function loopRunText(state) {
  const model = state && typeof state.model === "string" ? state.model : "";
  const effort = model && state.effort ? `, ${state.effort}` : "";
  const word = state && typeof state.strength === "string" && state.strength ? state.strength[0].toUpperCase() + state.strength.slice(1) : "";
  if (word) return model ? `${word} (${model}${effort})` : word;
  return model ? `(${model}${effort})` : "";
}

/**
 * The two stop buttons from the app's `loop-state`: "Stop after this phase" is
 * a toggle (its label says what a press does), off on the last phase, and both
 * buttons are off once Stop now was pressed.
 */
export function loopStopLabels(state) {
  const stopping = Boolean(state.stopping);
  const on = Boolean(state.stopAfterPhase);
  return {
    afterText: on ? "Cancel stop after this phase" : "Stop after this phase",
    afterDisabled: stopping || (!on && state.canStopAfter === false),
    nowDisabled: stopping,
  };
}

/**
 * The bar's Change project and Change agent controls while a loop runs: off,
 * with one short reason on them. The app refuses both commands too.
 */
export function loopLocks(state) {
  const locked = Boolean(state && state.running);
  return { locked, reason: locked ? "A loop is running. Stop it before you change the project or agent." : "" };
}

/**
 * What the window does about a console that stopped answering. On Windows the
 * agent's console dies with the agent (the app ends the agent's whole Job
 * Object), so between a loop's phases a dead console is expected: the next
 * phase opens its own, and the loop itself stops if it never does. The budget
 * guards against a console that keeps dying, not against a long session.
 */
export function deadConsoleAction({ loopRunning, loopStep, frameReady, reconnects, limit }) {
  if (loopRunning && loopStep === "Starting") return "wait-for-phase";
  if (!frameReady) return "no-hello";
  return reconnects < limit ? "reconnect" : "offer-button";
}

/**
 * What the window does when a page's hello did not come in time. While a loop
 * starts a phase the poll words the wait, so the check is not run now, but it
 * must be armed again: dropped for good, a page that never says hello left the
 * center message on screen with no way out once the step moved on.
 */
export function helloRetryAction({ loopRunning, loopStep }) {
  return loopRunning && loopStep === "Starting" ? "rearm" : "check";
}

/**
 * A shell message that names a command marks it with backticks ("run
 * `plan2code update`"), and the shell draws each marked command in a <code>
 * instead of showing the backticks: the pieces, in order, each plain text or
 * a command. A backtick with no partner stays as it is.
 */
export function commandSegments(text) {
  const s = String(text ?? "");
  const parts = [];
  const marked = /`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = marked.exec(s))) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index), code: false });
    parts.push({ text: m[1], code: true });
    last = marked.lastIndex;
  }
  if (last < s.length) parts.push({ text: s.slice(last), code: false });
  return parts;
}

/**
 * The same message for a place that can only hold plain text (a tooltip):
 * each marked command in double quotes instead of backticks.
 */
export function plainCommandText(text) {
  return String(text ?? "").replace(/`([^`]+)`/g, '"$1"');
}

/**
 * Where Up, Down, Home and End move focus in one of the bar's menus of
 * `count` items, from item `at` (-1 when focus is on none of them): Up and
 * Down wrap around, Home and End go to the ends. Null for any other key, or
 * a menu with nothing to move to.
 */
export function menuStep(key, at, count) {
  if (!(count > 0)) return null;
  switch (key) {
    case "ArrowDown":
      return at < 0 ? 0 : (at + 1) % count;
    case "ArrowUp":
      return at < 0 ? count - 1 : (at - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * What the window says when the console runs but its page sent no hello in
 * time, by how many times in a row that has happened: the first time, Reload
 * the page; from the second on, "still" with Reconnect the console (stop,
 * then start) first and Reload the page beside it, since reloading alone
 * could land on the same message forever.
 */
export function pageNotShownView(failures) {
  const reload = { action: "reload", label: "Reload the page" };
  if (failures >= 2) {
    return {
      text: "The page still did not load.",
      primary: { action: "reconnect", label: NEXT_STEP_LABELS.reconnect },
      secondary: reload,
    };
  }
  return { text: "The console is running but its page did not show in this window.", primary: reload, secondary: null };
}

/**
 * The session URL with its sign-in key hidden: the address and port are what
 * a bug report needs, and the key opens the session.
 */
export function redactSessionUrl(url) {
  return String(url || "").replace(/\/s\/[^/?#]+/, "/s/...");
}

/**
 * The muted Details line under that message, for bug reports: the session
 * URL (its key hidden) and what the last health check said, which is a
 * `console_status` state ("running", "dead", "none") or null when the check
 * itself failed.
 */
export function pageDetailsLine({ url, health }) {
  const where = redactSessionUrl(url) || "none";
  return `Details: session ${where}; health check: ${health || "no answer"}`;
}

/** Seconds a waiting message stays before it offers Try reconnecting. */
export const RETRY_AFTER_SECONDS = 10;

/** The retry button's label: counting down, then plain. */
export function retryLabel(secondsLeft) {
  return secondsLeft > 0 ? `Try reconnecting in ${secondsLeft}s` : "Try reconnecting";
}

/**
 * A project folder's own name, for the bar's project menu: the same last
 * segment the window title uses, or the whole path when there is none (a
 * root such as `/`), so the menu never shows an empty name.
 */
export function folderName(dir) {
  return lastSegment(dir) || String(dir || "").trim();
}

/**
 * The folder picker's rows: Choose a folder first (the OS dialog), then one
 * row per recent folder from the `recent_folders` command, newest first,
 * named by the folder with its full path as the detail.
 */
export function folderPickerRows(recent) {
  return [
    { kind: 'browse', label: 'Choose a folder...' },
    ...(recent || []).map((r) => ({ kind: 'folder', dir: r.dir, label: r.name, detail: r.dir })),
  ];
}

function lastSegment(dir) {
  return String(dir || "")
    .trim()
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop();
}

/**
 * The console page's taskbar messages, checked here before anything reaches
 * the app (attention.rs decides what they mean). `attention` carries one of
 * the four states the page's favicon has; `taskbar` carries the Desktop app
 * switch as a boolean, and `activities-full` an Activities game going in or
 * out of full screen the same way (taskbarSwitch checks both). Anything else
 * is null, and nothing is forwarded.
 */
export const ATTENTION_STATES = Object.freeze(['busy', 'ready', 'attention', 'plain']);

export function attentionSignal(data) {
  const state = data && data.state;
  return ATTENTION_STATES.includes(state) ? state : null;
}

export function taskbarSwitch(data) {
  const on = data && data.on;
  return typeof on === 'boolean' ? on : null;
}

// The hex shapes the shell takes from the console's `looks` message: four
// #rrggbb shades (fill, soft, ink, line) per theme.
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const isShadeSet = (shades) => Array.isArray(shades) && shades.length === 4 && shades.every((c) => typeof c === 'string' && HEX_COLOR.test(c));

/**
 * What the shell takes from a `looks` message: `{ theme, light, dark }`, the
 * resolved theme ("light" or "dark") with both shade sets, or null for
 * anything that does not match those shapes (nothing is applied then). The
 * page's own sends carry them; a page that predates the theme sends only
 * `accent` (the dark shades), which keeps the shell dark with that highlight.
 */
export function looksFromMessage(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.theme === undefined && data.light === undefined && data.dark === undefined) {
    return isShadeSet(data.accent) ? { theme: 'dark', light: null, dark: data.accent } : null;
  }
  if (data.theme !== 'light' && data.theme !== 'dark') return null;
  if (!isShadeSet(data.light) || !isShadeSet(data.dark)) return null;
  return { theme: data.theme, light: [...data.light], dark: [...data.dark] };
}

// The terminal font's size steps, in px (Ctrl or Cmd with plus, minus, 0).
export const TERMINAL_FONT_DEFAULT = 13;
export const TERMINAL_FONT_MIN = 8;
export const TERMINAL_FONT_MAX = 32;

/**
 * The font size after a terminal zoom key, or null when the key is not one.
 * `+` and `=` (the unshifted plus) grow it, `-` shrinks it, `0` returns to the
 * default; the result stays within the saved setting's range. `_` is not one:
 * Ctrl+Shift+minus is the control-underscore undo of a readline prompt.

 */
export function terminalFontStep(key, size) {
  const current = Number.isFinite(size) ? size : TERMINAL_FONT_DEFAULT;
  let next;
  if (key === '+' || key === '=') next = current + 1;
  else if (key === '-') next = current - 1;
  else if (key === '0') next = TERMINAL_FONT_DEFAULT;
  else return null;
  return Math.min(TERMINAL_FONT_MAX, Math.max(TERMINAL_FONT_MIN, next));
}

// One arrow-key step of the splitter: 2% of the window.
export const SPLITTER_STEP = 0.02;

/**
 * The terminal panel's share of the window after a key on the splitter, or
 * null when the key is not one it uses. The arrow that points away from the
 * panel grows it (Up when docked at the bottom, Left when docked right), the
 * other shrinks it; Home goes to the smallest share and End to the largest.
 * Always within [min, max].
 */
export function splitterFraction(key, fraction, dock, { min, max, step = SPLITTER_STEP }) {
  const grow = dock === 'right' ? 'ArrowLeft' : 'ArrowUp';
  const shrink = dock === 'right' ? 'ArrowRight' : 'ArrowDown';
  let next;
  if (key === grow) next = fraction + step;
  else if (key === shrink) next = fraction - step;
  else if (key === 'Home') next = min;
  else if (key === 'End') next = max;
  else return null;
  return Math.min(max, Math.max(min, next));
}

/** The splitter's aria-valuenow, min and max as whole percents of the window. */
export function splitterAria(fraction, { min, max }) {
  return { now: Math.round(fraction * 100), min: Math.round(min * 100), max: Math.round(max * 100) };
}

/**
 * The terminal toolbar's title: "Terminal" and, when an agent is known, its
 * name after a middle dot.
 */
export function terminalTitle(agentName) {
  return agentName ? `Terminal · ${agentName}` : 'Terminal';
}

/**
 * Which optional parts of the top bar still fit. `needed` is the row's width
 * with everything showing, `available` the room it has, and `model` and `status`
 * the widths of the two parts that can leave. The model text goes first, then
 * the status line; both then live in the agent menu's head.
 */
export function barFit({ available, needed, model = 0, status = 0 }) {
  if (needed <= available) return { model: true, status: true };
  if (needed - model <= available) return { model: false, status: true };
  return { model: false, status: false };
}

// The terminal's ANSI palettes, one per theme, tuned against the panel color
// each sits on (--panel: #201d1a dark, #ffffff light): every color keeps at
// least 3:1 against it (the dim "bright black" 4.4:1 and up), and the light
// set is the dark set turned darker, since an agent's greens and yellows
// written for a dark screen wash out on white. The console's own state
// colors (--ok, --stage, --warn, --focus) are the green, yellow, red and blue.
export const TERMINAL_ANSI = Object.freeze({
  dark: Object.freeze({
    black: '#3a3632', red: '#f0897a', green: '#74c28f', yellow: '#e0ab4c', blue: '#6aa3ff', magenta: '#c49bea', cyan: '#6cc4b8', white: '#d9d3c8',
    brightBlack: '#8b8376', brightRed: '#f6a89c', brightGreen: '#93d6a9', brightYellow: '#edc578', brightBlue: '#8fb9ff', brightMagenta: '#d6b6f2', brightCyan: '#8fd8ce', brightWhite: '#f0ece5',
  }),
  light: Object.freeze({
    black: '#1d1a17', red: '#b3261e', green: '#2f6b45', yellow: '#8f620f', blue: '#1f5fbf', magenta: '#7a3fa8', cyan: '#1d6f68', white: '#6b645a',
    brightBlack: '#756e62', brightRed: '#c9372c', brightGreen: '#2f7d4f', brightYellow: '#9c6c10', brightBlue: '#2a74d6', brightMagenta: '#8d4fc0', brightCyan: '#237e77', brightWhite: '#4a443c',
  }),
});

/** The ANSI palette for a theme ("light" or "dark"; anything else is dark). */
export function terminalAnsi(theme) {
  return theme === 'light' ? TERMINAL_ANSI.light : TERMINAL_ANSI.dark;
}

/** `#rrggbb` as an `rgba()` string at `alpha`, for the terminal's selection color. */
export function hexToRgba(hex, alpha) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex).trim());
  if (!m) return `rgba(128, 128, 128, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

// --- Waits (A1) -------------------------------------------------------------

/** Milliseconds of waiting for the dashboard before the pane admits it is slow. */
export const STILL_WAITING_MS = 12000;
export const STILL_WAITING_TEXT = 'Still waiting. The agent may be asking you something in its terminal.';

/**
 * What the pane says while it waits for the agent to open the dashboard: nothing new for the
 * first ~12 s; after that, the "still waiting" line with a way to the terminal (an agent can
 * sit on its own prompt: trust this folder, a login, an update notice). An agent that already
 * ended gets its own line at once, with Change agent beside the terminal button.
 */
export function waitingView({ waitedMs = 0, agentState = 'running' } = {}) {
  if (agentState === 'ended') {
    return { still: true, text: 'The agent ended before it opened the dashboard.', showTerminal: true, changeAgent: true };
  }
  if (waitedMs >= STILL_WAITING_MS) return { still: true, text: STILL_WAITING_TEXT, showTerminal: true, changeAgent: false };
  return { still: false, text: null, showTerminal: false, changeAgent: false };
}

// --- Friendly errors (A9) ---------------------------------------------------

// Known raw messages (the handoff's A9 list and the Rust side's own texts), each a
// case-insensitive substring and the sentence that replaces it: what happened, then the
// next step. The raw text is kept for a Details view.
const FRIENDLY_ERRORS = [
  ['console open printed no json', 'The console did not start properly. Try Reconnect the console; if it keeps failing, run `plan2code update` in a terminal.'],
  ['console open failed', 'The console could not be opened. Try Reconnect the console; if it keeps failing, run `plan2code update` in a terminal.'],
  ['console stop failed', 'The console did not stop cleanly. Try Reconnect the console.'],
  ['the web console is not installed', "Plan2Code's skills are missing. Run `plan2code update` in a terminal, then reopen the app."],
  ['too old to show inside the app', 'The installed Plan2Code console is too old for this app. Press Update skills, then try again.'],
  ['no agent has been started', 'There is no agent to restart yet. Start one from the launch card first.'],
  ['no project folder chosen', 'Choose a project folder first: use Change project in the bar.'],
  ['an agent is already running for this project', 'An agent is already running for this project. Use New Session to replace it.'],
  ['not a folder', 'That is not a folder. Choose a folder instead.'],
  ['could not start the agent', 'The agent could not start. Check that it is installed (Set up an agent) and try again.'],
];

/**
 * The shell's error text as a sentence with a next step: `{ text, details }`. `details` is the raw
 * message, kept behind a "Details" link. `action` ("start the agent") words an unknown error:
 * "Could not start the agent. Try again." A "Could not do that: ..." wrapper is looked through to
 * the message inside. An empty input gives an empty text.
 */
export function friendlyError(raw, action = '') {
  const rawText = String(raw ?? '').trim();
  if (!rawText) return { text: '', details: '' };
  const inner = rawText.replace(/^could not do that:\s*/i, '');
  const lower = inner.toLowerCase();
  const hit = FRIENDLY_ERRORS.find(([needle]) => lower.includes(needle));
  if (hit) return { text: hit[1], details: rawText };
  if (lower === 'busy') return { text: 'The console is busy. Try again in a moment.', details: rawText };
  const sentence = action ? `Could not ${action}. Try again.` : 'That did not work. Try again.';
  return { text: sentence, details: rawText };
}

/**
 * How the bar and the terminal word an agent that ended, from the host's `reason`: exit code 0
 * is a normal close ("closed normally", bar word "closed"), anything else keeps "ended" with its
 * reason in plain words.
 */
export function endedView(reason) {
  const text = String(reason ?? '').trim();
  if (/^exited with code 0$/i.test(text)) return { bar: 'closed', sentence: 'closed normally', normal: true };
  const code = /^exited with code (\d+)$/i.exec(text);
  if (code) return { bar: 'ended', sentence: `stopped with an error (exit code ${code[1]})`, normal: false };
  const signal = /^was ended by a signal \((.+)\)$/i.exec(text);
  if (signal) return { bar: 'ended', sentence: `was ended from outside the app (${signal[1]})`, normal: false };
  return { bar: 'ended', sentence: text ? `ended: ${text}` : 'ended', normal: false };
}

// --- The confirm modal (A10) ------------------------------------------------

/**
 * The confirm modal's buttons: the safe button (Cancel, or "Stay" on the quit check) comes first
 * and takes focus, the named danger verb comes last. `safeFirst: false` is for a confirm whose
 * primary is the harmless one.
 */
export function confirmButtons({ safeFirst = true } = {}) {
  return safeFirst ? { order: ['cancel', 'primary'], focus: 'cancel' } : { order: ['primary', 'cancel'], focus: 'primary' };
}

/** Where Tab goes inside the modal: it wraps, so focus never leaves it. `at` is -1 when focus is outside. */
export function trapTab(shift, at, count) {
  if (!(count > 0)) return null;
  if (at < 0) return shift ? count - 1 : 0;
  return shift ? (at - 1 + count) % count : (at + 1) % count;
}

// --- Shortcuts (A11) --------------------------------------------------------

// The key-to-action table. `shift` is whether Shift is part of the chord.
export const SHORTCUTS = Object.freeze([
  { id: 'toggle-terminal', key: '`', shift: false, tip: 'Show or hide the terminal' },
  { id: 'focus-console', key: '1', shift: false, tip: 'Focus the dashboard' },
  { id: 'focus-terminal', key: '2', shift: false, tip: 'Focus the terminal' },
  { id: 'new-session', key: 'n', shift: true, tip: 'New Session' },
  { id: 'change-project', key: 'o', shift: false, tip: 'Change project' },
  { id: 'preferences', key: ',', shift: false, tip: 'Open User Preferences' },
]);

/**
 * The shell action a key press stands for, or null. The chord is Cmd on macOS and Ctrl elsewhere,
 * with no Alt. One exception: with the terminal focused on Windows and Linux, Ctrl+O is left to
 * the agent (Claude Code uses it for its transcript view); Change project stays in the menu.
 */
export function shortcutAction(event, { mac = false, inTerminal = false } = {}) {
  if (!event || event.altKey) return null;
  const chord = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!chord) return null;
  const key = String(event.key || '').toLowerCase();
  const hit = SHORTCUTS.find((s) => s.key === key && s.shift === Boolean(event.shiftKey));
  if (!hit) return null;
  if (hit.id === 'change-project' && inTerminal && !mac) return null;
  return hit.id;
}

/** A shortcut as the tooltip writes it: "Ctrl+Shift+N", or "Cmd+Shift+N" on a Mac. */
export function shortcutLabel(id, mac = false) {
  const hit = SHORTCUTS.find((s) => s.id === id);
  if (!hit) return '';
  const key = /^[a-z]$/.test(hit.key) ? hit.key.toUpperCase() : hit.key;
  return `${mac ? 'Cmd' : 'Ctrl'}+${hit.shift ? 'Shift+' : ''}${key}`;
}

/** A tooltip: the plain words, then the shortcut in parentheses. */
export function tipWithShortcut(text, id, mac = false) {
  const label = shortcutLabel(id, mac);
  return label ? `${text} (${label})` : text;
}

/**
 * The console page forwards the keys it swallows as `{ plan2code: 'shortcut', id }`; the shell takes
 * the id only when it is one of the table's, so the page can ask for nothing else.
 */
export function shortcutFromMessage(data) {
  const id = data && data.id;
  return typeof id === 'string' && SHORTCUTS.some((s) => s.id === id) ? id : null;
}

// --- Copy and paste (A5) ----------------------------------------------------

/**
 * What a key press does in the terminal's clipboard handling: "copy" (Ctrl+Shift+C, Cmd+C, and
 * Ctrl+C while text is selected, the Windows Terminal rule: with nothing selected Ctrl+C is the
 * interrupt and returns null), "paste" (Ctrl+V, Ctrl+Shift+V, Cmd+V), or null. With `mac`, a plain
 * Ctrl+C is always the interrupt, as in every macOS terminal: copy there is Cmd+C.
 */
export function clipboardAction(event, hasSelection, { mac = false } = {}) {
  if (!event || event.altKey) return null;
  const key = String(event.key || '').toLowerCase();
  if (key === 'c') {
    if (event.metaKey && !event.ctrlKey) return 'copy';
    if (event.ctrlKey && !event.metaKey) return event.shiftKey || (hasSelection && !mac) ? 'copy' : null;
    return null;
  }
  if (key === 'v' && (event.ctrlKey || event.metaKey)) return 'paste';
  return null;
}

/**
 * A raw failure as one sentence for the bar: the first letter capitalized and a full stop at the end
 * ("the update did not finish: npm exited with code 1" becomes "The update did not finish: npm exited
 * with code 1."), so the reason itself stays readable where friendlyError's generic line would hide it.
 */
export function reasonSentence(raw) {
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return 'The update did not finish.';
  const cap = text[0].toUpperCase() + text.slice(1);
  return /[.!?]$/.test(cap) ? cap : cap + '.';
}
