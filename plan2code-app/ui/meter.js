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
};

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
export function barNextSteps({ consoleDead = false, version = null } = {}) {
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
 * A project folder's own name, for the bar's project menu: the same last
 * segment the window title uses, or the whole path when there is none (a
 * root such as `/`), so the menu never shows an empty name.
 */
export function folderName(dir) {
  return lastSegment(dir) || String(dir || "").trim();
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
 * switch as a boolean. Anything else is null, and nothing is forwarded.
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
