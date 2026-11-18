// The app page: the top bar, the console dashboard in an iframe, and the
// agent's terminal panel, docked right by default (or at the bottom on
// request) with a drag handle.

import { mountTerminal } from './terminal.js';
import { TERMINAL_FONT_DEFAULT, UPDATE_RECHECK_MS, reasonSentence, releaseNotesUrl, confirmButtons, endedView, friendlyError, releaseAfterCheck, shortcutAction, shortcutFromMessage, shortcutLabel, tipWithShortcut, trapTab, waitingView, attentionSignal, barFit, looksFromMessage, splitterAria, splitterFraction, terminalTitle, barNextSteps, commandSegments, continueKeys, defaultRightFraction, folderName, lastAgentNotice, menuStep, pageDetailsLine, pageNotShownView, pickDefaultAgent, plainCommandText, taskbarSwitch, windowTitleFor, deadConsoleAction, folderPickerRows, loopBanner, loopLocks, loopStopLabels, loopWindowTitle, helloRetryAction, retryLabel, RETRY_AFTER_SECONDS } from './meter.js';

const { invoke, Channel } = window.__TAURI__.core;

// The window opens hidden (tauri.conf.json) and is shown once the first frame
// has painted, so there is no blank or wrongly colored flash. theme-early.js
// shows it anyway after a few seconds, should this module never get here.
function showWindowWhenPainted() {
  const show = () => window.__TAURI__.window.getCurrentWindow().show().catch(() => {});
  requestAnimationFrame(() => requestAnimationFrame(show));
}
showWindowWhenPainted();

const projectMenuBtn = document.getElementById('project-menu-button');
const projectNameEl = document.getElementById('project-name');
const projectPathEl = document.getElementById('project-path');
const projectMenu = document.getElementById('project-menu');
const agentMenuBtn = document.getElementById('agent-menu-button');
const agentMenu = document.getElementById('agent-menu');
const agentMenuHeadEl = document.getElementById('agent-menu-head');
const agentMenuMoreEl = document.getElementById('agent-menu-more');
const moreMenu = document.getElementById('more-menu');
const termTitleEl = document.getElementById('term-title');
const agentDotEl = document.getElementById('agent-dot');
const agentNameEl = document.getElementById('agent-name');
const agentEndedEl = document.getElementById('agent-ended');
const agentBypassEl = document.getElementById('agent-bypass');
const agentModelEl = document.getElementById('agent-model');
const agentNoneEl = document.getElementById('agent-none');
const agentStatusEl = document.getElementById('agent-status');
const restartBtn = document.getElementById('agent-restart');
const loopBannerEl = document.getElementById('loop-banner');
const loopTitleEl = document.getElementById('loop-title');
const loopDetailEl = document.getElementById('loop-detail');
const loopPipsEl = document.getElementById('loop-pips');
const loopHintEl = document.getElementById('loop-hint');
const loopSpecEl = document.getElementById('loop-spec');
const loopElapsedEl = document.getElementById('loop-elapsed');
const loopRetriesEl = document.getElementById('loop-retries');
const loopStopAfterBtn = document.getElementById('loop-stop-after');
const loopStopNowBtn = document.getElementById('loop-stop-now');
const loopErrorEl = document.getElementById('loop-error');
const loopRetryBtn = document.getElementById('loop-retry');
// Whether Stop after this phase is on, as the last state said; a press asks for the opposite.
let loopStopAfterOn = false;
// True while an Implementation Loop runs: New Session stays hidden meanwhile.
let loopRunning = false;
let loopStep = '';
// Whether this loop's one-time typing note was shown; a new loop resets it.
let loopTypingNoted = false;
const LOOP_TYPING_NOTE = 'A loop is running. Typing here can derail the phase it is working on.';
const LOOP_TYPING_NOTE_MS = 8000;
const changeAgentBtn = document.getElementById('change-agent');
const changeProjectBtn = document.getElementById('change-project');
const barRowEl = document.getElementById('bar-row');
const launchCard = document.getElementById('launch-card');
const launchAgentEl = document.getElementById('launch-agent');
const launchMissingEl = document.getElementById('launch-missing');
const launchWarningEl = document.getElementById('launch-agents-warning');
const launchModelEl = document.getElementById('launch-model');
const launchModelRowEl = document.getElementById('launch-model-row');
const launchEffortRow = document.getElementById('launch-effort-row');
const launchEffortEl = document.getElementById('launch-effort');
const launchBypassEl = document.getElementById('launch-bypass');
const launchBypassWarningEl = document.getElementById('launch-bypass-warning');
const launchStartBtn = document.getElementById('launch-start');
const folderPickerEl = document.getElementById('folder-picker');
const folderPickerPanelEl = document.getElementById('folder-picker-panel');
const folderPickerListEl = document.getElementById('folder-picker-list');
const folderPickerErrorEl = document.getElementById('folder-picker-error');
const folderPickerCancelBtn = document.getElementById('folder-picker-cancel');
const firstRunEl = document.getElementById('first-run');
const firstRunListEl = document.getElementById('first-run-list');
const firstRunStartBtn = document.getElementById('first-run-start');
const launchNoticeEl = document.getElementById('launch-notice');
const setupCloseBtn = document.getElementById('setup-close');
const nextStepEl = document.getElementById('next-step');
const nextStepTextEl = document.getElementById('next-step-text');
const nextStepBtn = document.getElementById('next-step-button');
const nextStepMoreEl = document.getElementById('next-step-more');
const frame = document.getElementById('console-frame');
const stateBox = document.getElementById('dashboard-state');
const statePlannyEl = document.getElementById('dashboard-state-planny');
const stateText = document.getElementById('dashboard-state-text');
const stateButton = document.getElementById('dashboard-state-button');
const stateCancelEl = document.getElementById('dashboard-state-cancel');
const stateSecondaryEl = document.getElementById('dashboard-state-secondary');
const stateDetailsEl = document.getElementById('dashboard-state-details');
const workspaceEl = document.getElementById('workspace');
const termPanel = document.getElementById('term-panel');
const termHandle = document.getElementById('term-handle');
const termDockBtn = document.getElementById('term-dock');
const termMaximizeBtn = document.getElementById('term-maximize');
const termCollapseBtn = document.getElementById('term-collapse');
const termBadgeEl = document.getElementById('term-badge');
const stateBusyEl = document.getElementById('dashboard-state-busy');
const stateToggleEl = document.getElementById('dashboard-state-toggle');
const appMenuBtn = document.getElementById('app-menu-button');
const appMenu = document.getElementById('app-menu');
const nextStepNotesEl = document.getElementById('next-step-notes');
const confirmModalEl = document.getElementById('confirm-modal');
const confirmPanelEl = document.getElementById('confirm-panel');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmBodyEl = document.getElementById('confirm-body');
const confirmActionsEl = document.getElementById('confirm-actions');
const confirmCancelBtn = document.getElementById('confirm-cancel');
const confirmPrimaryBtn = document.getElementById('confirm-primary');

// Cmd on a Mac, Ctrl elsewhere: for the shortcuts and the tooltips that name them.
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

const STATUS_POLL_MS = 5000;
const BADGE_POLL_MS = 2000;
const MIN_PANE = 0.10;
const MAX_PANE = 0.60;
const MAXIMIZED_PANE = 0.80;
// Below this share of the window, a collapsed-or-small pane can hide a
// question the agent is quietly waiting on.
const SMALL_PANE = 0.15;
const QUIET_BADGE_MS = 10000;

// Only the bar's fallback, before (or without) agent_availability: the launch
// card and the bar otherwise read each agent's label from that list.
const FALLBACK_LABELS = { claude: 'Claude Code', devin: 'Devin', codex: 'Codex' };
const agentLabel = (id) => (agentAvailability[id] && agentAvailability[id].label) || FALLBACK_LABELS[id] || id || '';
// Devin's model ids already carry their effort (`swe-2-high`); only these two
// take a separate effort, at the levels their own CLI documents.
const EFFORT_OPTIONS = {
  claude: ['low', 'medium', 'high', 'xhigh', 'max'],
  codex: ['low', 'medium', 'high'],
};

// What the Rust agent host last said: idle, running or ended.
let agent = { state: 'idle', kind: null, generation: 0 };
const agentActive = () => agent.state === 'running';

const terminal = await mountTerminal(document.getElementById('term'), {
  onInput: (data) => {
    if (agentActive()) {
      noteTypingDuringLoop();
      invoke('agent_input', { data });
    }
  },
  onResize: (cols, rows) => {
    if (agentActive()) invoke('agent_resize', { cols, rows });
  },
  // Ctrl or Cmd with plus, minus or 0: remembered for the next launch.
  onFontSize: (size) => {
    invoke('save_terminal_font_size', { size }).catch(() => {
      // A settings file that cannot be written must not stop the zoom.
    });
  },
  // A link the agent printed, opened in the default browser (http and https only).
  onLink: (uri) => openLink(uri),
  // The shell's own shortcuts, typed with the terminal focused: handled here, never typed to the agent.
  onShortcut: (event) => {
    const id = shortcutAction(event, { mac: IS_MAC, inTerminal: true });
    if (!id) return false;
    runShortcut(id);
    return true;
  },
  onCopyOnSelect: (on) => {
    invoke('set_copy_on_select', { on }).catch(() => {
      // Not saved: the choice holds until the app closes.
    });
  },
});

// Opens a web link in the default browser through the opener plugin; anything that is not
// http or https is refused here as well as by the plugin's own scope.
function openLink(url) {
  if (!/^https?:\/\//i.test(String(url))) return;
  invoke('plugin:opener|open_url', { url }).catch((error) => {
    setAgentError(error, 'open that link');
  });
}

// One channel for the page's life: the agent's output arrives as bytes and its
// state changes as objects, across restarts too.
const agentChannel = new Channel();
agentChannel.onmessage = (message) => {
  if (message instanceof ArrayBuffer) {
    terminal.write(new Uint8Array(message));
    lastOutputAt = Date.now();
    updateBadge();
  } else if (message && typeof message === 'object' && 'state' in message) {
    applyAgentState(message);
  }
};

function applyAgentState(next, { skipReset } = {}) {
  const wasEnded = agent.state === 'ended';
  // A new generation is a fresh agent: it starts on a clean screen. Skipped
  // when catching up to an agent that was already running before this page
  // mounted (a reload): its replayed output, not a blank screen, belongs here,
  // and the channel that delivers it races this call, not waits for it.
  const freshScreen = next.generation !== agent.generation && !skipReset;
  if (freshScreen) {
    terminal.reset();
    lastOutputAt = Date.now();
  }
  agent = next;
  const label = agentLabel(agent.kind);
  const active = agentActive();

  const ended = agent.state === 'ended';
  if (active) {
    // Only ever auto-*hides* the card (the agent just started); it must
    // never auto-*show* it on 'ended' or 'idle' — that is Change agent's
    // job alone, so the card does not pop up over the dashboard uninvited.
    launchCard.hidden = true;
    hideFirstRun();
  }
  // One rule throughout: New Session and the agent menu while running or
  // ended (New Session keeps the previous agent, model, effort and mode);
  // Change agent, in that menu, only once ended, when there is a real choice
  // to make again.
  restartBtn.hidden = loopRunning || !(active || ended);
  changeAgentBtn.hidden = !ended;
  // Checked mode needs no marker; bypass always gets the "checks off" badge
  // on the agent, for exactly as long as that agent runs.
  const bypassActive = active && agent.mode === 'bypass';
  agentMenuBtn.hidden = !(active || ended);
  agentNoneEl.hidden = active || ended;
  agentNameEl.textContent = active || ended ? label || 'The agent' : '';
  termTitleEl.textContent = terminalTitle(active || ended ? label || 'The agent' : '');
  agentDotEl.className = `agent-dot${active ? (bypassActive ? ' is-warn' : ' is-ok') : ''}`;
  const endedWords = ended ? endedView(agent.reason) : null;
  agentEndedEl.hidden = !ended;
  if (endedWords) agentEndedEl.textContent = endedWords.bar;
  // The model and effort the app started it with, when it knows them: an agent
  // on its own default model has none to show, and an effort needs a model.
  const modelText = agent.model ? (agent.effort ? `${agent.model} · ${agent.effort}` : agent.model) : '';
  agentModelEl.textContent = active || ended ? modelText : '';
  agentModelEl.hidden = !agentModelEl.textContent;
  agentModelEl.title = agentModelEl.textContent ? `Started on ${agentModelEl.textContent}` : '';
  agentBypassEl.hidden = !bypassActive;
  renderAgentMenuHead(label || 'The agent', { active, ended, bypassActive });
  if (agentMenu.hidden === false && agentMenuBtn.hidden) closeBarMenus();
  restartBtn.title = tipWithShortcut(ended ? 'Start a fresh agent on the same brief' : 'Replace the agent with a fresh one, on a fresh context window', 'new-session', IS_MAC);
  // The agent is back (a fresh generation, running): the restart message stays
  // on screen (restarting() below) until its dashboard page is announced.
  if (restarting && freshScreen && agent.state === 'running') {
    terminal.write('\r\n\r\n[Fresh agent started. Waiting for the dashboard...]\r\n\r\n');
  }

  if (ended) {
    // The why sits beside the agent's menu; the menu says the rest.
    setAgentStatus(endedWords.sentence);
    // A failed Restart clears the screen too, so it says so again.
    if (!wasEnded || freshScreen) {
      terminal.write(`\r\n[${label || 'The agent'} ${endedWords.sentence}. Press New Session in the bar to start a fresh one.]\r\n`);
    }
  } else {
    // After a Restart the bar says what it left for the dashboard, if anything.
    setAgentStatus(agent.briefNote || '');
  }
  updateBadge();
}

// The short line after the agent's menu: an ended agent's reason or a
// Restart's brief note (quiet), or something that went wrong (in red).
let statusDetails = '';

function setAgentStatus(text, { error = false, details = '' } = {}) {
  agentStatusEl.replaceChildren(...commandNodes(text));
  agentStatusEl.title = plainCommandText(text);
  agentStatusEl.classList.toggle('is-error', error && Boolean(text));
  // A long line is cut at the bar's width: it opens in full (with the raw text, when there is one) on a press.
  statusDetails = details;
  const pressable = Boolean(text) && (error || Boolean(details));
  agentStatusEl.classList.toggle('is-pressable', pressable);
  if (pressable) {
    agentStatusEl.setAttribute('role', 'button');
    agentStatusEl.tabIndex = 0;
  } else {
    agentStatusEl.setAttribute('role', 'status');
    agentStatusEl.removeAttribute('tabindex');
  }
}

// An error from the shell or the app's Rust side, in plain words with its next step; the raw
// text stays behind a press on the line (meter.js friendlyError).
function setAgentError(raw, action) {
  const friendly = friendlyError(raw, action);
  setAgentStatus(friendly.text, { error: true, details: friendly.details });
}

function openStatusDetails() {
  if (!agentStatusEl.classList.contains('is-pressable')) return;
  void confirmModal({ title: 'What the bar said', lines: [{ kind: 'text', text: agentStatusEl.textContent }, ...(statusDetails ? [{ kind: 'code', text: statusDetails }] : [])], cancel: 'Close', primary: null });
}
agentStatusEl.addEventListener('click', openStatusDetails);
agentStatusEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openStatusDetails();
  }
});

// A message's nodes, each command it marks with backticks in a <code>
// (meter.js commandSegments): built as text nodes, never parsed as markup.
function commandNodes(text) {
  return commandSegments(text).map((part) => {
    if (!part.code) return part.text;
    const code = document.createElement('code');
    code.textContent = part.text;
    return code;
  });
}

// The first key typed in the terminal while a loop runs: a note beside the agent,
// once per loop, gone after a few seconds. The key itself is always delivered.
function noteTypingDuringLoop() {
  if (!loopRunning || loopTypingNoted) return;
  loopTypingNoted = true;
  setAgentStatus(LOOP_TYPING_NOTE);
  setTimeout(() => {
    if (agentStatusEl.textContent === LOOP_TYPING_NOTE) setAgentStatus('');
  }, LOOP_TYPING_NOTE_MS);
}

// The agent menu's first lines: what the agent is doing and, while it runs,
// which permission mode it started with.
function renderAgentMenuHead(label, { active, ended, bypassActive }) {
  const name = document.createElement('b');
  name.textContent = label;
  if (active) {
    const mode = document.createElement('span');
    if (bypassActive) {
      mode.className = 'is-warn';
      mode.textContent = 'off';
    } else {
      mode.textContent = 'on';
    }
    agentMenuHeadEl.replaceChildren(name, ' is running', document.createElement('br'), 'Permission checks are ', mode);
    if (bypassActive) agentMenuHeadEl.append(': it runs commands and changes files without asking');
  } else if (ended) {
    agentMenuHeadEl.replaceChildren(name, ` ${endedView(agent.reason).sentence}`, document.createElement('br'), 'Nothing starts until you press New Session.');
  } else {
    agentMenuHeadEl.replaceChildren();
  }
}

// The bar's three menus (project, agent, and the "+N more" list of pending
// steps). They hang outside the bar row, fixed under their trigger, so the
// row's overflow never clips them. Clicking anywhere else (the console frame
// and the terminal too), Escape or a resize closes them.
let openBarMenu = null;

const barMenus = () => [[projectMenuBtn, projectMenu], [agentMenuBtn, agentMenu], [nextStepMoreEl, moreMenu], [appMenuBtn, appMenu]];

function closeBarMenus() {
  for (const [button, menu] of barMenus()) {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  openBarMenu = null;
}

// A menu's items that can take focus now: shown and not off.
function barMenuItems(menu) {
  return [...menu.querySelectorAll('[role="menuitem"]')].filter((item) => !item.hidden && !item.disabled);
}

function toggleBarMenu(button, menu) {
  const wasOpen = openBarMenu === menu;
  closeBarMenus();
  if (wasOpen) return;
  menu.hidden = false;
  const at = button.getBoundingClientRect();
  const left = Math.max(8, Math.min(at.left, window.innerWidth - menu.offsetWidth - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${at.bottom + 4}px`;
  button.setAttribute('aria-expanded', 'true');
  openBarMenu = menu;
  // Focus goes into the menu: its first item, or the menu itself (tabindex
  // -1) when every item is hidden or off, so Escape still hears the keyboard.
  const [first] = barMenuItems(menu);
  (first || menu).focus();
}

// Up, Down, Home and End move between a menu's items (meter.js menuStep).
function onBarMenuKey(event) {
  const items = barMenuItems(event.currentTarget);
  const next = menuStep(event.key, items.indexOf(document.activeElement), items.length);
  if (next === null) return;
  event.preventDefault();
  items[next].focus();
}

projectMenuBtn.onclick = () => toggleBarMenu(projectMenuBtn, projectMenu);
agentMenuBtn.onclick = () => toggleBarMenu(agentMenuBtn, agentMenu);
nextStepMoreEl.onclick = () => toggleBarMenu(nextStepMoreEl, moreMenu);
appMenuBtn.onclick = () => toggleBarMenu(appMenuBtn, appMenu);
appMenu.addEventListener('keydown', onBarMenuKey);
projectMenu.addEventListener('keydown', onBarMenuKey);
agentMenu.addEventListener('keydown', onBarMenuKey);
moreMenu.addEventListener('keydown', onBarMenuKey);
document.addEventListener('pointerdown', (event) => {
  if (!openBarMenu) return;
  if (barMenus().some(([button, menu]) => menu.contains(event.target) || button.contains(event.target))) return;
  closeBarMenus();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !openBarMenu) return;
  const [trigger] = barMenus().find(([, menu]) => menu === openBarMenu);
  closeBarMenus();
  trigger.focus();
});
window.addEventListener('blur', closeBarMenus);
window.addEventListener('resize', closeBarMenus);

// A narrow window drops parts of the bar instead of scrolling it: the model
// text first, then the status line (meter.js barFit), each moving into the
// agent menu. Measured with everything showing, so a wider window brings them
// back; redone when the row's size or its parts change.
let fitQueued = false;

function fitBar() {
  fitQueued = false;
  barRowEl.classList.remove('no-model', 'no-status');
  const model = agentModelEl.hidden ? 0 : agentModelEl.offsetWidth;
  const status = agentStatusEl.textContent ? agentStatusEl.offsetWidth : 0;
  // Only an agent's menu can hold them, so with none the row keeps everything.
  const fit = agentMenuBtn.hidden ? { model: true, status: true } : barFit({ available: barRowEl.clientWidth, needed: barRowEl.scrollWidth, model, status });
  const dropModel = !fit.model && model > 0;
  const dropStatus = !fit.status && status > 0;
  barRowEl.classList.toggle('no-model', dropModel);
  barRowEl.classList.toggle('no-status', dropStatus);
  const lines = [];
  if (dropModel) lines.push(`Started on ${agentModelEl.textContent}`);
  if (dropStatus) lines.push(agentStatusEl.textContent);
  agentMenuMoreEl.replaceChildren(...lines.flatMap((line, i) => (i ? [document.createElement('br'), line] : [line])));
}

function scheduleFitBar() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(fitBar);
}

new ResizeObserver(scheduleFitBar).observe(barRowEl);
new MutationObserver(scheduleFitBar).observe(barRowEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });

// True from a confirmed Restart until the fresh agent's dashboard page is
// announced (showAnnounced below): the frame stays blanked with a message the
// whole time, since the restarted agent must boot and run the skill again
// before anything can show.
let restarting = false;

async function confirmRestart(onYes) {
  if (agent.state !== 'running') {
    onYes();
    return;
  }
  const yes = await confirmModal({
    title: 'Restart the agent on a fresh context window?',
    lines: [{ kind: 'text', text: 'What the agent was doing is not saved.' }],
    primary: 'New Session',
    danger: true,
  });
  if (!yes) return;
  restarting = true;
  currentUrl = null;
  frameReady = false;
  showState('The agent is restarting on a fresh context window. Please wait for the dashboard to load.');
  onYes();
}

// Shows the agent's terminal: expands a collapsed pane (its own button, so
// focus and the saved setting come too), else just gives it the keyboard.
function showTerminal() {
  if (paneCollapsed) termCollapseBtn.click();
  else terminal.focus();
}

// What the launch card offers for each agent: whether its CLI was found on
// PATH (else how to install it) and whether it takes its own effort. The list
// keeps the order Rust sent (built-ins, then custom agents); the map is by id.
let agentList = [];
let agentAvailability = {};
// What was skipped in agents.json, shown under the picker.
let agentWarnings = [];

// `refresh` (Check again) also has the app work its PATH out again, so a CLI
// whose installer added a new folder is found without a restart.
async function loadAgentAvailability(refresh = false) {
  try {
    const result = await invoke('agent_availability', { refresh });
    agentList = result.agents || [];
    agentWarnings = result.warnings || [];
    agentAvailability = Object.fromEntries(agentList.map((entry) => [entry.id, entry]));
  } catch {
    // Nothing to show is not a reason to block the card: Start just tries it.
    agentList = [];
    agentWarnings = [];
    agentAvailability = {};
  }
}

// The launch card's agent choices, from the availability list. With nothing
// to list (the check failed) the fixed options in index.html stay as they are.
function populateAgentSelect(selected) {
  if (agentList.length === 0) return;
  launchAgentEl.replaceChildren(
    ...agentList.map((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.label || entry.id;
      return option;
    })
  );
  if (selected) launchAgentEl.value = selected;
}

// Pick the agent to start on and show the card's state for it.
function applyDefaultAgent(remembered) {
  // The saved (last used) agent is gone but another works: one line, then
  // carry on (FR-13). lastAgentNotice gives the pick it names.
  const using = lastAgentNotice(agentList, remembered);
  launchNoticeEl.hidden = !using;
  if (using) launchNoticeEl.textContent = `${agentLabel(remembered)} (last used) was not found, using ${agentLabel(using)}`;
  populateAgentSelect(pickDefaultAgent(agentList, remembered));
  refreshLaunchCard();
}

// A button that opens a built-in agent's install page in the browser.
function installPageButton(id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'agent-link';
  button.textContent = 'Install page';
  button.onclick = () => {
    invoke('open_install_page', { id }).catch((error) => {
      setAgentError(error, 'open the install page');
    });
  };
  return button;
}

// Where the setup page was opened from, while it is up: the screen to return
// to when it closes or reports agent-found. Null: no setup page up.
let setupReturn = null;

// The Set up an agent button, shown wherever the app says "no agent" (FR-17).
function setupButton(returnTo) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'setup-agent-btn';
  btn.textContent = 'Set up an agent';
  btn.onclick = () => openAgentSetup(returnTo);
  return btn;
}

// Open the console's agent-less setup page in this window (FR-15, FR-17). No
// poll timer: a dead setup page needs no reconnect, and the Back button still
// returns.
async function openAgentSetup(returnTo) {
  try {
    const session = await invoke('console_setup_start');
    setupReturn = returnTo;
    hideState();
    hideFirstRun();
    hideLaunchCard();
    markConsoleAlive();
    consoleKnown = true;
    setupCloseBtn.hidden = false;
    loadFrame(session.url);
  } catch (error) {
    // A missing console.mjs means the skills install itself is gone (FR-16): friendlyError says so.
    const text = String(error);
    setAgentError(text.includes('console.mjs') ? `the web console is not installed: ${text}` : text, 'open the setup page');
  }
}

// The setup page is done: it found an agent (agent-found carries its id) or
// the person pressed Back. Return to where the app was, recheck the agents,
// and pick the found one on the launch card for the person to press Start
// (FR-14, FR-17).
async function finishSetup(foundId) {
  if (setupReturn === null) return;
  const returnTo = setupReturn;
  setupReturn = null;
  setupCloseBtn.hidden = true;
  currentUrl = null;
  frameReady = false;
  frame.src = 'about:blank';
  invoke('console_stop').catch(() => {});
  await loadAgentAvailability(true);
  applyDefaultAgent(foundId || (appState && appState.lastAgent) || launchAgentEl.value);
  if (returnTo === 'first-run' && appState) showFirstRun(appState);
  else showLaunchCard();
}

// Re-read the agents from disk (a CLI installed or a custom agent added since),
// then redraw whatever shows them and pick the default again.
async function checkAgentsAgain() {
  await loadAgentAvailability(true);
  applyDefaultAgent((appState && appState.lastAgent) || launchAgentEl.value);
  if (!firstRunEl.hidden && appState) renderFirstRun(appState);
}

function refreshLaunchCard() {
  const kind = launchAgentEl.value;
  const info = agentAvailability[kind];
  const installed = info ? info.installed : true;
  launchStartBtn.disabled = !installed;
  launchMissingEl.hidden = installed;
  launchMissingEl.replaceChildren();
  if (!installed) {
    if (!agentList.some((a) => a.installed)) {
      launchMissingEl.append('No agent found. ', setupButton('launch-card'));
    } else if (info && info.state === 'outside') {
      // Found on the saved PATH, in npm's folder or an install folder, but
      // not on PATH itself: setup, not a fresh install.
      launchMissingEl.append(`${agentLabel(kind)} was found${info.folder ? ` in ${info.folder}` : ''}, but it is not on PATH. `, setupButton('launch-card'));
    } else {
      launchMissingEl.append(`${agentLabel(kind)} was not found on PATH.`);
      if (info && !info.custom) {
        launchMissingEl.append(' Install it: ');
        const code = document.createElement('code');
        code.textContent = info.installHint || '';
        launchMissingEl.append(code, installPageButton(kind));
      }
    }
  }
  launchWarningEl.hidden = agentWarnings.length === 0;
  launchWarningEl.textContent = agentWarnings.map((warning) => `agents.json: ${warning}`).join('\n');
  // The model dropdown lists what the `plan2code` launcher would ask with:
  // built-ins get the shipped + user models.json merge from Rust, customs
  // their own agents.json models. An empty list hides the row, like the
  // launcher's skipped model question; the first option passes no flag, so
  // the agent runs on its own (last-used) model.
  const models = (info && info.models) || [];
  launchModelEl.replaceChildren();
  const noModel = document.createElement('option');
  noModel.value = '';
  noModel.textContent = "Default (the agent's own model)";
  launchModelEl.append(noModel);
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label ? `${model.id}: ${model.label}` : model.id;
    launchModelEl.append(option);
  }
  launchModelRowEl.hidden = models.length === 0;
  // A model the launcher picked (--model) sticks only while it is listed.
  if (appState && models.some((model) => model.id === appState.launchModel)) launchModelEl.value = appState.launchModel;
  const levels = info && info.custom ? [] : EFFORT_OPTIONS[kind] || [];
  launchEffortRow.hidden = levels.length === 0;
  launchEffortEl.replaceChildren();
  const def = document.createElement('option');
  def.value = '';
  def.textContent = 'Default';
  launchEffortEl.append(def);
  for (const level of levels) {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = level[0].toUpperCase() + level.slice(1);
    launchEffortEl.append(option);
  }
}

launchAgentEl.onchange = refreshLaunchCard;
launchBypassEl.onchange = () => {
  launchBypassWarningEl.hidden = !launchBypassEl.checked;
};

function showLaunchCard() {
  hideState();
  hideFirstRun();
  refreshLaunchCard();
  launchCard.hidden = false;
}

function hideLaunchCard() {
  launchCard.hidden = true;
}

// One row of the first-run checklist: a pass/fail mark, a title and a detail
// line (plain text or a built node, such as the CLI-by-CLI list).
function firstRunRow(pass, title, detail) {
  const row = document.createElement('li');
  row.className = `first-run-row ${pass ? 'is-pass' : 'is-fail'}`;
  const mark = document.createElement('span');
  mark.className = 'first-run-mark';
  mark.textContent = pass ? '✓' : '!';
  // Read out as words: a bare check or exclamation mark says nothing to a screen reader.
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', pass ? 'Ready' : 'Needs attention');
  const body = document.createElement('div');
  body.className = 'first-run-body';
  const titleEl = document.createElement('div');
  titleEl.className = 'first-run-title';
  titleEl.textContent = title;
  body.append(titleEl);
  if (detail) {
    const detailEl = document.createElement('div');
    detailEl.className = 'first-run-detail';
    if (typeof detail === 'string') detailEl.append(...commandNodes(detail));
    else detailEl.append(detail);
    body.append(detailEl);
  }
  row.append(mark, body);
  return row;
}

// Node is always a pass here: `main()` on the Rust side already exits before
// the window opens on anything else (Task 1.7), so this row is a confirmation,
// never a way to recover from a real failure.
function renderFirstRun(state) {
  firstRunListEl.replaceChildren();
  const nodeDetail = `${state.nodeVersion || 'found'} (18 or newer)${state.nodeBinary ? `: ${state.nodeBinary}` : ''}`;
  firstRunListEl.append(firstRunRow(true, 'Node.js', nodeDetail));

  const agentsKnown = agentList;
  const anyAgentInstalled = agentsKnown.length === 0 || agentsKnown.some((a) => a.installed);
  const agentsDetail = document.createElement('span');
  if (agentsKnown.length === 0) {
    agentsDetail.textContent = 'Could not check.';
  } else if (!anyAgentInstalled) {
    agentsDetail.append('No agent found. ', setupButton('first-run'));
  } else {
    agentsKnown.forEach((a, i) => {
      if (i > 0) agentsDetail.append(', ');
      agentsDetail.append(`${a.label}: ${a.installed ? a.path : 'not found'}`);
    });
  }
  firstRunListEl.append(firstRunRow(anyAgentInstalled, 'An agent CLI', agentsDetail));

  firstRunListEl.append(firstRunRow(Boolean(state.projectDir), 'Project folder', state.projectDir || 'not chosen yet'));

  const skillsOk = Boolean(state.skillsVersion);
  const skillsDetail = skillsOk ? `v${state.skillsVersion}` : 'not found; run `plan2code update`';
  firstRunListEl.append(firstRunRow(skillsOk, 'Plan2Code skills', skillsDetail));

  firstRunStartBtn.disabled = !(anyAgentInstalled && state.projectDir && skillsOk);
}

function showFirstRun(state) {
  hideState();
  hideLaunchCard();
  renderFirstRun(state);
  firstRunEl.hidden = false;
}

function hideFirstRun() {
  firstRunEl.hidden = true;
}

firstRunStartBtn.onclick = async () => {
  hideFirstRun();
  try {
    await invoke('save_first_run_done');
  } catch {
    // Not remembered is not fatal: the checklist just shows again next launch.
  }
  showLaunchCard();
};

async function startAgent(event) {
  if (event) event.preventDefault();
  const kind = launchAgentEl.value;
  const model = launchModelEl.value || null;
  const info = agentAvailability[kind];
  const effort = !(info && info.custom) && (EFFORT_OPTIONS[kind] || []).length > 0 ? launchEffortEl.value || null : null;
  const mode = launchBypassEl.checked ? 'bypass' : 'checked';
  setAgentStatus('');
  beginWait('Waiting for the agent to open the dashboard...');
  const { cols, rows } = terminal.size();
  try {
    await invoke('agent_start', { kind, model, effort, mode, cols, rows });
    terminal.focus();
  } catch (error) {
    endWait();
    setAgentError(error, 'start the agent');
    showLaunchCard();
  }
}

async function agentAction(command) {
  try {
    await invoke(command);
    terminal.focus();
  } catch (error) {
    setAgentError(error, 'do that');
  }
}

launchCard.addEventListener('submit', startAgent);
setupCloseBtn.onclick = () => finishSetup();
restartBtn.onclick = () => confirmRestart(() => agentAction('agent_restart'));
// Only ever enabled once the agent has ended: nothing active to lose, so no confirm.
changeAgentBtn.onclick = () => {
  closeBarMenus();
  showLaunchCard();
};

// The pane's shape: which edge it docks to, its share of the window when it
// is neither collapsed nor maximized (dragging and the settings file both
// deal in that share, never in pixels), and whether it is collapsed.
// Maximized is a transient view, never saved: the pane comes back at its
// last saved share on the next launch.
let paneDock = 'bottom';
let paneFraction = 0.25;
let paneCollapsed = false;
let paneMaximized = false;

const paneExtent = () => (paneDock === 'right' ? window.innerWidth : window.innerHeight);

function setButtonLabel(button, label, tip) {
  button.setAttribute('aria-label', label);
  button.title = tip;
}

// What a double-click on the splitter returns to: the share a first run starts
// with (docked right, wide enough to keep the console's aside beside it).
const defaultPaneFraction = () => (paneDock === 'right' ? defaultRightFraction(window.innerWidth, { minFraction: MIN_PANE, maxFraction: MAX_PANE }) : 0.25);

function applyPaneLayout() {
  workspaceEl.classList.toggle('dock-right', paneDock === 'right');
  termPanel.classList.toggle('collapsed', paneCollapsed);
  termHandle.hidden = paneCollapsed;
  const sizeProp = paneDock === 'right' ? 'width' : 'height';
  const otherProp = paneDock === 'right' ? 'height' : 'width';
  termPanel.style[otherProp] = '';
  if (paneCollapsed) {
    termPanel.style[sizeProp] = '';
  } else {
    const fraction = paneMaximized ? MAXIMIZED_PANE : paneFraction;
    termPanel.style[sizeProp] = `${Math.round(paneExtent() * fraction)}px`;
  }
  // Icon buttons: what each does, in words, for a screen reader and a tooltip.
  termDockBtn.dataset.dock = paneDock;
  setButtonLabel(termDockBtn, paneDock === 'right' ? 'Dock the terminal at the bottom' : 'Dock the terminal on the right', paneDock === 'right' ? 'Dock at the bottom' : 'Dock on the right');
  setButtonLabel(termMaximizeBtn, paneMaximized ? 'Restore the terminal size' : 'Make the terminal larger', paneMaximized ? 'Restore the size' : 'Make it larger');
  termMaximizeBtn.setAttribute('aria-pressed', String(paneMaximized));
  setButtonLabel(termCollapseBtn, paneCollapsed ? 'Show the terminal' : 'Collapse the terminal', tipWithShortcut(paneCollapsed ? 'Show the terminal' : 'Collapse', 'toggle-terminal', IS_MAC));
  termCollapseBtn.setAttribute('aria-pressed', String(paneCollapsed));
  // The splitter reads as a slider of the panel's share of the window.
  termHandle.setAttribute('aria-orientation', paneDock === 'right' ? 'vertical' : 'horizontal');
  const aria = splitterAria(paneMaximized ? MAXIMIZED_PANE : paneFraction, { min: MIN_PANE, max: paneMaximized ? MAXIMIZED_PANE : MAX_PANE });
  termHandle.setAttribute('aria-valuenow', String(aria.now));
  termHandle.setAttribute('aria-valuemin', String(aria.min));
  termHandle.setAttribute('aria-valuemax', String(aria.max));
  termHandle.setAttribute('aria-valuetext', `${aria.now}% of the window`);
  updateBadge();
  tellTerminalState();
}

// The console page's What to check lines make "terminal" a button while the
// pane is collapsed, so the page hears the state on its hello (`force`) and
// whenever it changes, never on every drag of the handle.
let toldCollapsed = null;

function tellTerminalState(force = false) {
  if (!force && toldCollapsed === paneCollapsed) return;
  toldCollapsed = paneCollapsed;
  if (frame.contentWindow) frame.contentWindow.postMessage({ plan2code: 'terminal-state', collapsed: paneCollapsed }, '*');
}

function savePaneSettings() {
  invoke('save_term_panel', { dock: paneDock, fraction: paneFraction, collapsed: paneCollapsed }).catch(() => {
    // A settings file that cannot be written must not stop the pane from working.
  });
}

termDockBtn.onclick = () => {
  paneDock = paneDock === 'right' ? 'bottom' : 'right';
  applyPaneLayout();
  savePaneSettings();
};
termMaximizeBtn.onclick = () => {
  paneMaximized = !paneMaximized;
  applyPaneLayout();
};
termCollapseBtn.onclick = () => {
  paneCollapsed = !paneCollapsed;
  if (!paneCollapsed) terminal.focus();
  applyPaneLayout();
  savePaneSettings();
};

// Dragging the handle sets the panel's share of the window, along whichever
// edge it is docked to.
termHandle.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  termHandle.setPointerCapture(event.pointerId);
  termHandle.classList.add('is-dragging');
  termHandle.focus();
});
termHandle.addEventListener('pointermove', (event) => {
  if (!termHandle.hasPointerCapture(event.pointerId)) return;
  const extent = paneExtent();
  const wanted = paneDock === 'right' ? window.innerWidth - event.clientX : window.innerHeight - event.clientY;
  const clamped = Math.min(Math.max(wanted, extent * MIN_PANE), extent * MAX_PANE);
  paneFraction = clamped / extent;
  paneMaximized = false;
  applyPaneLayout();
});
function endHandleDrag(event) {
  if (termHandle.hasPointerCapture(event.pointerId)) termHandle.releasePointerCapture(event.pointerId);
  termHandle.classList.remove('is-dragging');
  savePaneSettings();
}
termHandle.addEventListener('pointerup', endHandleDrag);
termHandle.addEventListener('pointercancel', endHandleDrag);
// Keyboard: arrows resize in 2% steps, Home and End go to the smallest and
// largest share (meter.js splitterFraction).
termHandle.addEventListener('keydown', (event) => {
  const next = splitterFraction(event.key, paneMaximized ? MAXIMIZED_PANE : paneFraction, paneDock, { min: MIN_PANE, max: MAX_PANE });
  if (next === null) return;
  event.preventDefault();
  paneFraction = next;
  paneMaximized = false;
  applyPaneLayout();
  savePaneSettings();
});
// Double-click: back to the default share.
termHandle.addEventListener('dblclick', () => {
  paneFraction = defaultPaneFraction();
  paneMaximized = false;
  applyPaneLayout();
  savePaneSettings();
});

// When the pane is collapsed or small, the agent's own status line can keep
// redrawing while it is really waiting on a prompt no one is watching: a
// stretch of no new output at all is the giveaway.
let lastOutputAt = Date.now();

// The pill's press: show the terminal and put the keyboard in it. A pane that
// was only small (not collapsed) grows to a share where a prompt can be read.
termBadgeEl.onclick = () => {
  if (paneCollapsed) {
    // The click lays the pane out before it returns, so the terminal can take focus after it.
    termCollapseBtn.click();
    terminal.focus();
    return;
  }
  if (!paneMaximized && paneFraction < SMALL_PANE * 2) {
    paneFraction = Math.max(paneFraction, defaultPaneFraction());
    applyPaneLayout();
    savePaneSettings();
  }
  terminal.focus();
};

function updateBadge() {
  const small = paneCollapsed || (!paneMaximized && paneFraction < SMALL_PANE);
  const quiet = agentActive() && Date.now() - lastOutputAt >= QUIET_BADGE_MS;
  termBadgeEl.hidden = !(small && quiet);
}

// The frame is "showing" only once the console page itself says so (it posts a
// hello to its parent when it draws). The frame's own load event also fires for
// an error page, so it proves nothing: a blocked or dead frame must not look
// like a loaded one.
const HELLO_WAIT_MS = 8000;
let currentUrl = null;
let frameReady = false;
let helloTimer = null;
// Nothing has shown here yet: no agent has opened the dashboard. No polling,
// no "reconnect" button makes sense until that first page lands.
let consoleKnown = false;

function loadFrame(url) {
  currentUrl = url;
  frameReady = false;
  // The page going away takes its taskbar dot with it; the new one tells its own.
  clearAttention();
  // And a game it had in full screen.
  setGameFull(false);
  clearTimeout(helloTimer);
  helloTimer = setTimeout(onNoHello, HELLO_WAIT_MS);
  frame.src = url;
}

function clearAttention() {
  invoke('clear_attention_cmd').catch(() => {});
}

// What the console page may ask of this window. Each is a named request with
// no free text, so the page can never type anything but "continue", and the
// taskbar's two take only their fixed words and a boolean (meter.js).
window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  const kind = event.data && event.data.plan2code;
  if (kind === 'console-ready') {
    frameReady = true;
    pageFailures = 0;
    clearTimeout(helloTimer);
    hideState();
    // The Desktop app switch in its User Preferences shows what app.json holds.
    const on = !appState || appState.taskbarSignal !== false;
    event.source.postMessage({ plan2code: 'taskbar-state', on }, '*');
    tellTerminalState(true);
  } else if (kind === 'attention') {
    const signal = attentionSignal(event.data);
    if (signal) invoke('set_attention', { signal }).catch(() => {});
  } else if (kind === 'agent-found') {
    const id = typeof event.data.id === 'string' ? event.data.id : '';
    void finishSetup(id || null);
  } else if (kind === 'taskbar') {
    const on = taskbarSwitch(event.data);
    if (on === null) return;
    if (appState) appState.taskbarSignal = on;
    invoke('set_taskbar_signal', { on }).catch(() => {});
  } else if (kind === 'activities-full') {
    const on = taskbarSwitch(event.data);
    if (on !== null) setGameFull(on);
  } else if (kind === 'shortcut') {
    // A key the page swallowed (the console's frame has the keyboard): only an id from the table.
    const id = shortcutFromMessage(event.data);
    if (id) runShortcut(id);
  } else if (kind === 'agent-continue') {
    typeContinue();
  } else if (kind === 'terminal-open') {
    // The status line's terminal button: expands a collapsed pane, the same
    // way its own button does (focus and the saved setting included).
    if (paneCollapsed) termCollapseBtn.click();
  } else if (kind === 'new-session') {
    // The bar's own button, so the press is confirmed exactly the same way.
    if (!restartBtn.hidden) restartBtn.click();
  } else if (kind === 'looks') {
    const looks = looksFromMessage(event.data);
    if (looks) applyLooks(looks, { save: true });
  } else if (kind === 'loop-facts') {
    // The setup screen asks what agent a loop would use. The answer is facts
    // only; the page never sends the app any setup value.
    const source = event.source;
    invoke('loop_facts')
      .then((facts) => source.postMessage({ plan2code: 'loop-facts', facts }, '*'))
      .catch(() => {});
  } else if (kind === 'loop-resume' || kind === 'loop-ask' || kind === 'loop-fix' || kind === 'loop-finalize') {
    // Fixed requests, no free text: the page answers with ok or the error.
    const source = event.source;
    const command = { 'loop-resume': 'loop_resume', 'loop-ask': 'loop_ask', 'loop-fix': 'loop_fix', 'loop-finalize': 'loop_finalize' }[kind];
    invoke(command)
      .then(() => source.postMessage({ plan2code: `${kind}-result`, ok: true, error: null }, '*'))
      .catch((error) => source.postMessage({ plan2code: `${kind}-result`, ok: false, error: String(error) }, '*'));
  } else if (kind === 'loop-dashboard') {
    // The loop end screen's way home: a fresh dashboard session in the frame.
    const source = event.source;
    invoke('loop_dashboard')
      .then((info) => {
        source.postMessage({ plan2code: 'loop-dashboard-result', ok: true, error: null }, '*');
        if (info && info.url) {
          showState('Opening the dashboard...');
          loadFrame(info.url);
        }
      })
      .catch((error) => source.postMessage({ plan2code: 'loop-dashboard-result', ok: false, error: String(error) }, '*'));
  } else if (kind === 'loop-notify-test') {
    // Send a test: no values at all. The app reads the saved setup itself and
    // asks the person to confirm in its own dialog.
    const source = event.source;
    invoke('loop_notify_test')
      .then((sent) => source.postMessage({ plan2code: 'loop-notify-test-result', ok: true, sent, error: null }, '*'))
      .catch((error) =>
        source.postMessage({ plan2code: 'loop-notify-test-result', ok: false, sent: false, error: String(error) }, '*')
      );
  } else if (kind === 'loop-start') {
    // Start: a spec folder name only. The app validates it, reads the saved
    // setup itself and asks the person to confirm in its own dialog.
    const source = event.source;
    const spec = typeof event.data.spec === 'string' ? event.data.spec : '';
    invoke('loop_start', { spec })
      .then((started) => source.postMessage({ plan2code: 'loop-start-result', ok: true, started, error: null }, '*'))
      .catch((error) =>
        source.postMessage({ plan2code: 'loop-start-result', ok: false, error: String(error) }, '*')
      );
  }
});

// An Activities game in full screen: the console's frame is laid over the
// bar and the terminal (over, not instead of, so the terminal keeps its size
// and the agent sees no resize), and the window goes full screen. Off, both
// go back; the window leaves full screen only if this put it there.
let fullByGame = false;

function setGameFull(on) {
  document.body.classList.toggle('console-full', on);
  const win = window.__TAURI__.window.getCurrentWindow();
  if (on) {
    win
      .isFullscreen()
      .then((already) => {
        if (already) return;
        fullByGame = true;
        return win.setFullscreen(true);
      })
      .catch(() => {});
  } else if (fullByGame) {
    fullByGame = false;
    win.setFullscreen(false).catch(() => {});
  }
}

// Its "Not running... type continue" line, pressed: the keystrokes
// continueKeys names, each on its own a moment after the last, so an agent
// that treats one burst of input as a paste still reads the Enter as a submit.
const ENTER_AFTER_MS = 120;

function typeContinue() {
  if (!agentActive()) return;
  continueKeys(agent.kind)
    .reduce(
      (typed, data, i) =>
        typed
          .then(() => (i ? new Promise((resolve) => setTimeout(resolve, ENTER_AFTER_MS)) : null))
          .then(() => invoke('agent_input', { data })),
      Promise.resolve()
    )
    .catch((error) => {
      setAgentError(error, 'type continue');
    });
}

// The theme and highlight color, as the console page last sent them (the
// resolved theme, and the four shades fill, soft, ink, line for each theme).
// The shell wears them: data-theme on <html> picks the tokens' light or dark
// set, the accent custom properties are the person's own, the xterm theme and
// the OS title bar follow. Both are kept for the next launch, which theme-early.js
// reads before the first paint.
const THEME_KEY = 'p2c-app:theme';
const ACCENT_KEY = 'p2c-app:accent';
const ACCENT_VARS = ['--accent', '--accent-soft', '--accent-ink', '--accent-line'];

function applyLooks({ theme, light, dark }, { save = false } = {}) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  const shades = theme === 'light' && light ? light : dark;
  ACCENT_VARS.forEach((name, i) => root.style.setProperty(name, shades[i]));
  if (save) {
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(ACCENT_KEY, JSON.stringify({ light, dark }));
    } catch {
      // Not remembered is fine: the stylesheet's defaults show until a page loads.
    }
  }
  // The terminal reads the tokens, so it goes last.
  terminal.applyTheme();
  setWindowTheme(theme);
}

// The OS title bar follows the shell's theme (Tauri's window theme). A platform
// that ignores it leaves the bar as it was.
function setWindowTheme(theme) {
  try {
    window.__TAURI__.window.getCurrentWindow().setTheme(theme).catch(() => {});
  } catch {
    // An older runtime without setTheme: the title bar keeps the system's look.
  }
}

// A relaunch: theme-early.js already put the saved theme on <html> before the
// first paint; the terminal and the title bar catch up here.
terminal.applyTheme();
setWindowTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

// No hello in time: ask the console why, and say so with a way forward.
async function onNoHello() {
  if (frameReady || !consoleKnown || restarting) return;
  // A page that does not answer cannot say it is done needing the person.
  clearAttention();
  // The next phase's console is on its way; the poll says so instead. Look
  // again later all the same: dropped for good, a page that never said hello
  // left its message on screen with no way out once the step moved on.
  if (helloRetryAction({ loopRunning, loopStep }) === 'rearm') {
    helloTimer = setTimeout(onNoHello, HELLO_WAIT_MS);
    return;
  }
  let status = null;
  try {
    status = await invoke('console_status');
  } catch {
    // The status check itself failed; treat it as a console that is not answering.
  }
  if (!status || status.state !== 'running') {
    showState('The console stopped, so the page could not show.', 'Reconnect the console', reconnectConsole);
  } else {
    // Counted per run of trouble: a hello or a new page starts it again.
    pageFailures += 1;
    const view = pageNotShownView(pageFailures);
    const actions = { reload: reloadPage, reconnect: stopAndReconnect };
    const secondary = view.secondary ? { label: view.secondary.label, onClick: actions[view.secondary.action] } : null;
    const details = pageDetailsLine({ url: currentUrl || status.url, health: status.state });
    showState(view.text, view.primary.label, actions[view.primary.action], undefined, { secondary, details });
  }
}

// Times in a row the console ran but its page did not show (pageNotShownView).
let pageFailures = 0;

function reloadPage() {
  showState('Reloading the page...');
  loadFrame(currentUrl);
}

// Stop, then start: a console that runs but serves no page is started fresh
// on the same session, not just asked again.
async function stopAndReconnect() {
  try {
    await invoke('console_stop');
  } catch {
    // Nothing to stop is fine: reconnectConsole starts a fresh one either way.
  }
  await reconnectConsole();
}

// A waiting message that offers a way out after a countdown: the button shows
// disabled, counting down, then turns into `buttonLabel`'s plain retry.
let retryTimer = null;

function stopRetryCountdown() {
  clearInterval(retryTimer);
  retryTimer = null;
  stateButton.disabled = false;
}

// One automatic Try reconnecting per run of trouble (cleared when a new page is announced).
let autoReconnected = false;

// What the message box shows now, as showState was asked for it (null once
// hidden).
let shownState = null;

// `secondary` is a second, plain button ({ label, onClick }); `details` a
// muted line under the buttons.
function showState(text, buttonLabel, onButton, onCancel, options = {}) {
  const { tired = false, retryAfter = 0, autoRetry = false, secondary = null, details = '', rawDetails = '' } = options;
  // One busy style for every wait: a spinner over the words when nothing can be pressed yet.
  const busy = options.busy !== undefined ? options.busy : !buttonLabel && !onCancel;
  // The poll repeats the same waiting message every tick: that must not
  // restart a countdown that is already running (or its button).
  if (retryAfter > 0 && !stateBox.hidden && stateText.textContent === text && stateButton.textContent.startsWith('Try reconnecting')) return;
  shownState = { text, buttonLabel, onButton, onCancel, options };
  stopRetryCountdown();
  hideLaunchCard();
  hideFirstRun();
  // statePlannyEl is an <svg>: unlike HTMLElement, it does not reflect the
  // `.hidden` property to the attribute, so toggling the property alone left
  // `hidden` in the markup forever. The attribute itself always works.
  statePlannyEl.toggleAttribute('hidden', !tired);
  // Plain Planny is the first frame's "Starting Plan2Code"; the coffee break adds the mug.
  statePlannyEl.classList.toggle('is-plain', !tired);
  statePlannyEl.setAttribute('viewBox', tired ? '0 7 29 23' : '0 7 22 23');
  stateText.textContent = text;
  stateButton.hidden = !buttonLabel;
  stateButton.textContent = buttonLabel || '';
  stateButton.onclick = onButton || null;
  stateCancelEl.hidden = !onCancel;
  stateCancelEl.onclick = onCancel || null;
  stateSecondaryEl.hidden = !secondary;
  stateSecondaryEl.textContent = secondary ? secondary.label : '';
  stateSecondaryEl.onclick = secondary ? secondary.onClick : null;
  stateBusyEl.hidden = !busy;
  // A friendly error keeps its raw text behind Details; a bug-report line (details) shows as it is.
  stateDetailsEl.hidden = !details;
  stateDetailsEl.textContent = details || rawDetails;
  stateToggleEl.hidden = !rawDetails || Boolean(details);
  stateToggleEl.setAttribute('aria-expanded', 'false');
  stateBox.hidden = false;
  if (retryAfter > 0 && buttonLabel) {
    let left = retryAfter;
    stateButton.disabled = true;
    stateButton.textContent = retryLabel(left);
    retryTimer = setInterval(() => {
      left -= 1;
      stateButton.textContent = retryLabel(left);
      if (left <= 0) {
        stopRetryCountdown();
        // The button is on now: press it once for the person. If that try
        // fails, the button stays for them.
        if (autoRetry && onButton) {
          autoReconnected = true;
          onButton();
        }
      }
    }, 1000);
  }
}

// A raw error as a sentence with its next step and a Details link (meter.js friendlyError).
function showErrorState(raw, action, buttonLabel, onButton, onCancel) {
  const friendly = friendlyError(raw, action);
  showState(friendly.text, buttonLabel, onButton, onCancel, { rawDetails: friendly.details });
}

stateToggleEl.onclick = () => {
  const open = stateDetailsEl.hidden;
  stateDetailsEl.hidden = !open;
  stateToggleEl.setAttribute('aria-expanded', String(open));
};

// While the agent starts and the dashboard has not opened: after ~12 s the pane stops saying
// "waiting" alone and says where to look (meter.js waitingView), and an agent that ended gets
// Change agent beside it.
let waitStartedAt = 0;
let waitTimer = null;
let waitKey = '';

function beginWait(text) {
  waitStartedAt = Date.now();
  waitKey = '';
  showState(text, undefined, undefined, undefined, { waiting: true });
  clearInterval(waitTimer);
  waitTimer = setInterval(tickWait, 1000);
}

function endWait() {
  clearInterval(waitTimer);
  waitTimer = null;
}

function tickWait() {
  // Gone from the screen (the dashboard came, or something else spoke): nothing left to time.
  if (stateBox.hidden || !shownState || !shownState.options.waiting) {
    endWait();
    return;
  }
  const view = waitingView({ waitedMs: Date.now() - waitStartedAt, agentState: agent.state });
  const key = view.still ? `${view.text}|${view.changeAgent}` : '';
  if (!view.still || key === waitKey) return;
  waitKey = key;
  showState(view.text, 'Show the terminal', showTerminal, undefined, {
    waiting: true,
    busy: !view.changeAgent,
    secondary: view.changeAgent ? { label: 'Change agent', onClick: showLaunchCard } : null,
  });
}

function hideState() {
  endWait();
  stopRetryCountdown();
  stateBox.hidden = true;
  shownState = null;
}

let pollTimer = null;

// Only once the agent has opened a page: brings an idle or dead console back
// on its own session. The app never opens a dashboard on its own (the agent
// does, by running the skill), so there is nothing to start before that.
async function reconnectConsole() {
  markConsoleAlive();
  showState('Reconnecting to the console...');
  try {
    const info = await invoke('console_start');
    loadFrame(info.url);
  } catch (error) {
    showErrorState(error, 'reach the console', 'Retry', reconnectConsole);
    // An old console cannot be framed: the fix is the skills update, so offer it.
    if (String(error).includes('too old')) setVersionState({ kind: 'too-old' });
  }
}

// Health check on a timer. A console that dies after its page showed (it idles
// out, or something ended it) is brought back on the same session, a few times
// at most; before the page ever showed, the person decides with a button.
const RECONNECT_LIMIT = 3;
let reconnects = 0;

async function pollConsole() {
  try {
    const status = await invoke('console_status');
    if (status.state === 'running') {
      markConsoleAlive();
      return;
    }
    const action = deadConsoleAction({ loopRunning, loopStep, frameReady, reconnects, limit: RECONNECT_LIMIT });
    if (action === 'wait-for-phase') {
      // Covers the old phase's page and its "Lost contact" until the new one
      // says hello. Never over a question the box is already asking.
      if (stateCancelEl.hidden) showState(loopDetailEl.textContent, 'Try reconnecting', reconnectConsole, undefined, { retryAfter: RETRY_AFTER_SECONDS, autoRetry: !autoReconnected });
      return;
    }
    markConsoleDead();
    if (action === 'reconnect') {
      reconnects += 1;
      showState('The console stopped. Reconnecting...');
      await reconnectConsole();
    } else if (action === 'no-hello') {
      onNoHello();
    }
  } catch {
    // A failed check is not proof the console died; look again next tick.
  }
}

// Once, at start: when the app and the installed skills are on different versions the bar
// says so and offers Update skills. Nothing runs until that button is pressed.
async function checkVersions() {
  try {
    const status = await invoke('version_status');
    if (!status.mismatch) return;
    // Skills ahead of this app: another Update skills run cannot help, so
    // that state offers no button.
    setVersionState({ kind: status.skills_ahead ? 'ahead' : 'mismatch', skills: status.skills, app: status.app });
  } catch {
    // No version to compare is no reason to nag.
  }
}

// At start, and again every few hours (the app stays open for days), never waited on: is a newer
// Plan2Code release out on GitHub? The Rust side asks (the same tag lookup the web console uses) and
// answers `{ latest, problem }`: the newer version, or a sentence when the check could not run (git
// missing), or neither when the app is current. An update already running is never replaced.
async function checkNewRelease() {
  try {
    setNewRelease(releaseAfterCheck(newRelease, await invoke('check_new_release')));
  } catch {
    // No answer is no reason to nag.
  }
}

// "Update and restart": the installer runs unpinned (the newest release) through the same progress
// line as Update skills, then the app restarts itself, guarded by the quit check. A failure leaves
// this app running, with the reason in the bar and the old command as the fallback.
async function updateAndRestart() {
  if (!newRelease || !newRelease.latest) return;
  const latest = newRelease.latest;
  setNewRelease({ latest, updating: '' });
  const progress = new Channel();
  progress.onmessage = (line) => {
    if (line && newRelease && newRelease.updating !== undefined) setNewRelease({ latest, updating: line });
  };
  try {
    await invoke('update_to_newest', { progress });
  } catch (error) {
    setNewRelease({ latest, failed: reasonSentence(error) });
    return;
  }
  await restartApp(latest);
}

// The respawn itself. With an agent or a loop running the person is asked first (the quit check):
// "asking" leaves the app up, so the bar then offers Restart Plan2Code for when they are ready.
async function restartApp(latest = newRelease && newRelease.latest) {
  if (latest) setNewRelease({ latest, updating: 'Restarting Plan2Code...' });
  try {
    const outcome = await invoke('restart_app', { confirmed: false });
    if (outcome === 'asking' && latest) setNewRelease({ latest, restartNeeded: true });
  } catch (error) {
    if (latest) setNewRelease({ latest, failed: reasonSentence(error) });
    else setAgentError(error, 'restart Plan2Code');
  }
}

// After the restart: "Updated to vX", once, for a short while.
async function showUpdatedTo() {
  try {
    const status = await invoke('version_status');
    const now = status.app || null;
    // The same version after the restart: the installer kept the old app (no desktop app file in
    // that release yet), so it is not "Updated to".
    if (now && appState && appState.updatedFrom && now === appState.updatedFrom) {
      notReplaced = now;
      updatedTo = null;
    } else {
      updatedTo = now;
      notReplaced = null;
    }
  } catch {
    updatedTo = null;
    notReplaced = null;
  }
  renderNextStep();
  setTimeout(() => {
    updatedTo = null;
    notReplaced = null;
    renderNextStep();
  }, UPDATED_NOTE_MS);
}

// The About dialog and Check for updates, from the bar's menu.
async function showAbout() {
  let status = null;
  try {
    status = await invoke('version_status');
  } catch {
    // The dialog still opens, with what it can say.
  }
  const lines = [{ kind: 'text', text: status && status.app ? `This is Plan2Code v${status.app}.` : 'Plan2Code desktop app.' }];
  if (status && status.skills) lines.push({ kind: 'text', text: `The installed skills are v${status.skills}.` });
  const notes = status && status.app && (await confirmModal({ title: 'About Plan2Code', lines, primary: 'Release notes', cancel: 'Close', safeFirst: true }));
  if (notes) openLink(releaseNotesUrl(status.app));
  else if (!status || !status.app) void confirmModal({ title: 'About Plan2Code', lines, cancel: 'Close', primary: null });
}

async function checkUpdatesNow() {
  let result = null;
  try {
    result = await invoke('check_new_release');
  } catch {
    // Said below.
  }
  setNewRelease(releaseAfterCheck(newRelease, result));
  if (result && result.latest) return;
  const text = result ? result.problem || 'Plan2Code is up to date.' : 'Could not check for updates.';
  void confirmModal({ title: 'Check for updates', lines: [{ kind: 'text', text }], cancel: 'Close', primary: null });
}

async function updateSkills() {
  setVersionState({ kind: 'updating', line: 'Updating Plan2Code...' });
  const progress = new Channel();
  progress.onmessage = (line) => {
    if (line && versionState && versionState.kind === 'updating') setVersionState({ kind: 'updating', line });
  };
  try {
    const outcome = await invoke('update_skills', { progress });
    setVersionState(
      outcome.status.mismatch
        ? { kind: 'remains', skills: outcome.status.skills, app: outcome.status.app }
        : { kind: 'updated' }
    );
  } catch (error) {
    setVersionState({ kind: 'failed', error: String(error) });
  }
}

// After an update: stop the old console first, so the new skills are really
// picked up, then bring a fresh one back on the same session.
async function restartConsole() {
  try {
    await invoke('console_stop');
  } catch {
    // Nothing to stop is fine: reconnectConsole starts a fresh one either way.
  }
  setVersionState(null);
  await reconnectConsole();
}

// A page the agent's `console.mjs open` asked this window to show. Which page
// it is shows inside the frame itself (the console's own badge and title),
// not repeated here.
function showAnnounced(notice) {
  endWait();
  restarting = false;
  // A new page is a new start: the budget is per run of trouble, not per launch.
  reconnects = 0;
  autoReconnected = false;
  if (!consoleKnown) {
    consoleKnown = true;
    if (!pollTimer) pollTimer = setInterval(pollConsole, STATUS_POLL_MS);
  }
  markConsoleAlive();
  if (notice.url !== currentUrl) {
    // A new page gets its own Reload the page before "still did not load".
    pageFailures = 0;
    showState('Opening the page...');
    loadFrame(notice.url);
  }
}

window.__TAURI__.event.listen('console-page', (event) => showAnnounced(event.payload));

// "45s", "12m", "1h 12m": whole units, the largest two at most.
function formatElapsed(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// The Implementation Loop's banner across the window, drawn from the app's
// loop-state. It lives here and not in the console page because a loop runs
// across many sessions: the page changes under it, and this does not.
let loopTimer = null;
let loopStartedAt = 0;

function tickLoopElapsed() {
  loopElapsedEl.textContent = formatElapsed(Date.now() - loopStartedAt);
}

function setLoopTitle(title) {
  window.__TAURI__.window.getCurrentWindow().setTitle(title).catch(() => {});
}

// The app ending the loop's last agent ended that agent's console too, so the
// page holding the stop or finish card has to be brought back, at once and
// whatever the budget says: it is the one thing the person came back to read.
async function showLoopEnd() {
  reconnects = 0;
  try {
    const status = await invoke('console_status');
    if (status.state === 'dead') await reconnectConsole();
  } catch {
    // The poll looks again on its next tick.
  }
}

// Change project and Change agent are off while a loop runs, with the reason on
// them; the app refuses them too.
function applyLoopLocks(state) {
  const { locked, reason } = loopLocks(state);
  for (const button of [changeProjectBtn, changeAgentBtn]) {
    button.disabled = locked;
    button.title = locked ? reason : button === changeProjectBtn ? tipWithShortcut('Change project', 'change-project', IS_MAC) : '';
  }
}

// Asks the app what the loop is doing: a reloaded window has missed every
// loop-state event so far, and one sent between the first ask and the listener
// is caught by asking again once it listens.
async function syncLoopState() {
  // The reply and the loop-state event travel apart: an event that landed while
  // the question was out is newer than the answer, which then is dropped.
  const seen = loopEventSeq;
  try {
    const state = await invoke('loop_state');
    if (seen !== loopEventSeq) return;
    // No loop and none drawn: nothing to redraw. One drawn that is gone: it ended.
    if (state) applyLoopState(state);
    else if (loopRunning) applyLoopState({ running: false });
  } catch {
    // The next loop-state event tells it.
  }
}

function applyLoopState(state) {
  if (!state || !state.running) {
    const wasRunning = loopRunning;
    loopRunning = false;
    loopStep = '';
    if (wasRunning) showLoopEnd();
    clearInterval(loopTimer);
    loopTimer = null;
    loopBannerEl.hidden = true;
    applyLoopLocks({ running: false });
    setLoopTitle(windowTitleFor(projectPathEl.textContent));
    // New Session's visibility is applyAgentState's rule alone.
    applyAgentState(agent, { skipReset: true });
    return;
  }
  if (!loopRunning) loopTypingNoted = false;
  loopRunning = true;
  const stepBefore = loopStep;
  loopStep = state.step || '';
  restartBtn.hidden = true;
  applyLoopLocks(state);
  const banner = loopBanner(state);
  loopBannerEl.hidden = false;
  loopBannerEl.dataset.tone = banner.tone;
  // Only a change of words: this is a live region, and screen readers read it out.
  if (loopTitleEl.textContent !== banner.title) loopTitleEl.textContent = banner.title;
  if (loopDetailEl.textContent !== banner.detail) loopDetailEl.textContent = banner.detail;
  // A phase starting: look at the console now, so its waiting message and
  // countdown begin at once, not at the next status poll.
  if (loopStep === 'Starting' && stepBefore !== 'Starting' && consoleKnown) void pollConsole();
  loopHintEl.textContent = banner.hint;
  loopSpecEl.textContent = state.specName || '';
  loopPipsEl.replaceChildren(
    ...banner.pips.map((kind, i) => {
      const pip = document.createElement('span');
      pip.className = `loop-pip ${kind}`;
      pip.title = `Phase ${i + 1}`;
      return pip;
    })
  );
  setLoopTitle(loopWindowTitle(projectPathEl.textContent, state));
  const stopLabels = loopStopLabels(state);
  loopStopAfterOn = !!state.stopAfterPhase;
  loopStopAfterBtn.disabled = stopLabels.afterDisabled;
  loopStopAfterBtn.textContent = stopLabels.afterText;
  loopStopNowBtn.disabled = stopLabels.nowDisabled;
  // A good state means the last press went through.
  hideLoopError();
  const retries = Number(state.retriesUsed) || 0;
  loopRetriesEl.hidden = retries <= 0;
  loopRetriesEl.textContent = retries === 1 ? '1 retry' : `${retries} retries`;
  loopStartedAt = Number(state.startedAtMs) || Date.now();
  tickLoopElapsed();
  if (!loopTimer) loopTimer = setInterval(tickLoopElapsed, 1000);
}

let loopEventSeq = 0;
window.__TAURI__.event
  .listen('loop-state', (event) => {
    loopEventSeq += 1;
    applyLoopState(event.payload);
  })
  .then(syncLoopState, () => {});

// A press that fails shows why next to the buttons, with a Retry for the same press.
let loopRetryAction = null;
let loopErrorRaw = '';
loopErrorEl.tabIndex = 0;
const openLoopError = () => {
  void confirmModal({ title: 'What went wrong', lines: [{ kind: 'text', text: loopErrorEl.textContent }, ...(loopErrorRaw ? [{ kind: 'code', text: loopErrorRaw }] : [])], cancel: 'Close', primary: null });
};
loopErrorEl.addEventListener('click', openLoopError);
loopErrorEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openLoopError();
  }
});
function hideLoopError() {
  loopErrorEl.hidden = true;
  loopErrorEl.textContent = '';
  loopErrorRaw = '';
  loopRetryBtn.hidden = true;
  loopRetryAction = null;
}
function pressLoop(command, args) {
  const press = () =>
    invoke(command, args).then(hideLoopError, (e) => {
      // In plain words, with the raw text behind a press on the line.
      const friendly = friendlyError(String(e && e.message ? e.message : e), 'do that');
      loopErrorEl.textContent = friendly.text;
      loopErrorEl.title = friendly.details;
      loopErrorRaw = friendly.details;
      loopErrorEl.hidden = false;
      loopRetryBtn.hidden = false;
      loopRetryAction = press;
    });
  return press();
}
loopRetryBtn.onclick = () => {
  if (loopRetryAction) loopRetryAction();
};
loopStopAfterBtn.onclick = () => pressLoop('loop_stop_after_phase', { on: !loopStopAfterOn });
loopStopNowBtn.onclick = async () => {
  const yes = await confirmModal({
    title: 'End the agent now?',
    lines: [{ kind: 'text', text: "This phase's changes stay uncommitted." }],
    primary: 'Stop now',
    danger: true,
  });
  if (yes) pressLoop('loop_stop_now');
};

// The right end of the bar: whether the console stopped answering and where
// the skills stand against this app, drawn as one next step (meter.js
// barNextSteps decides which, and its button), with the rest as "+N more".
let consoleDead = false;
let versionState = null;
let newRelease = null;
const NEXT_STEP_ACTIONS = { reconnect: reconnectConsole, 'restart-console': restartConsole, update: updateSkills, 'update-restart': () => updateAndRestart(), 'restart-app': () => restartApp() };
const UPDATED_NOTE_MS = 20000;
let updatedTo = null;
let notReplaced = null;
let nextStepAction = null;

function renderNextStep() {
  const steps = barNextSteps({ consoleDead, version: versionState, newRelease, updatedTo, notReplaced });
  nextStepEl.hidden = steps.length === 0;
  const [first, ...rest] = steps;
  nextStepTextEl.replaceChildren(...commandNodes(first ? first.text : ''));
  nextStepTextEl.title = first ? plainCommandText(first.title) : '';
  nextStepTextEl.className = first ? `is-${first.tone}${first.busy ? ' is-busy' : ''}` : '';
  nextStepAction = first && first.action ? NEXT_STEP_ACTIONS[first.action] : null;
  nextStepBtn.hidden = !nextStepAction;
  nextStepBtn.disabled = false;
  nextStepBtn.textContent = first && first.label ? first.label : '';
  // "What's new": the release page, in the default browser.
  const notes = first && first.link ? first.link : null;
  nextStepNotesEl.hidden = !notes;
  nextStepNotesEl.onclick = notes ? () => openLink(notes.url) : null;
  nextStepMoreEl.hidden = rest.length === 0;
  nextStepMoreEl.textContent = `+${rest.length} more`;
  nextStepMoreEl.setAttribute('aria-label', `${rest.length} more ${rest.length === 1 ? 'step' : 'steps'}`);
  renderMoreMenu(rest);
}

// The other pending steps, each with its full sentence (a failed update's
// last line included) and its own action, when it has one.
function renderMoreMenu(rest) {
  moreMenu.replaceChildren(
    ...rest.map((step) => {
      const row = document.createElement('div');
      row.className = 'more-step';
      const text = document.createElement('p');
      text.className = `is-${step.tone}`;
      text.replaceChildren(...commandNodes(step.title));
      row.append(text);
      const action = step.action ? NEXT_STEP_ACTIONS[step.action] : null;
      if (action && step.label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        button.textContent = step.label;
        button.onclick = () => {
          closeBarMenus();
          action();
        };
        row.append(button);
      }
      if (step.link) {
        const link = document.createElement('button');
        link.type = 'button';
        link.setAttribute('role', 'menuitem');
        link.textContent = step.link.label;
        link.onclick = () => {
          closeBarMenus();
          openLink(step.link.url);
        };
        row.append(link);
      }
      return row;
    })
  );
  if (rest.length === 0 && openBarMenu === moreMenu) closeBarMenus();
}

function setVersionState(next) {
  versionState = next;
  renderNextStep();
}

function setNewRelease(next) {
  newRelease = next;
  renderNextStep();
}

function markConsoleAlive() {
  consoleDead = false;
  renderNextStep();
}

function markConsoleDead() {
  consoleDead = true;
  renderNextStep();
}

nextStepBtn.onclick = () => {
  if (!nextStepAction) return;
  // Pressed once per step: whatever it starts draws the next state itself.
  nextStepBtn.disabled = true;
  nextStepAction();
};

function setProjectDir(dir) {
  // The bar names the folder; its menu holds the full path.
  projectNameEl.textContent = folderName(dir);
  projectMenuBtn.title = dir;
  projectPathEl.textContent = dir;
  projectMenuBtn.hidden = !dir;
  // So two or more windows read apart in the taskbar without opening each
  // one: a setTitle that fails (an old Tauri runtime, say) just leaves the
  // static "Plan2Code" title from tauri.conf.json, never breaks the start.
  window.__TAURI__.window.getCurrentWindow().setTitle(windowTitleFor(dir)).catch(() => {});
}

// The state `main()` read at startup: the folder picker and the first-run
// checklist both need it once a folder lands, after the fact.
let appState = null;

// The open folder picker's way back to its caller (null while none is open).
let folderPickerResolve = null;

function hideFolderPicker() {
  folderPickerEl.hidden = true;
  folderPickerEl.classList.remove('is-dialog');
  folderPickerListEl.replaceChildren();
}

function closeFolderPicker(dir) {
  const resolve = folderPickerResolve;
  folderPickerResolve = null;
  hideFolderPicker();
  if (resolve) resolve(dir);
}

// The picker's error in plain words; the raw text stays as its tooltip (meter.js friendlyError).
function setFolderPickerError(raw, action) {
  const friendly = raw ? friendlyError(raw, action) : { text: '', details: '' };
  folderPickerErrorEl.textContent = friendly.text;
  folderPickerErrorEl.title = friendly.details;
  folderPickerErrorEl.hidden = !friendly.text;
}

function folderPickerButtons() {
  return [...folderPickerListEl.querySelectorAll('.folder-picker-row')];
}

// One picker for a bare start (`dialog: false`, full screen) and Change
// project (`dialog: true`, over the page, with Cancel and Escape). Choose a
// folder runs the OS dialog; a recent row opens that folder. Resolves with
// the folder opened, or null when the person cancels the dialog. A canceled
// OS dialog comes back here, and an error shows inline with the rows usable.
async function showFolderPicker({ dialog }) {
  if (folderPickerResolve) closeFolderPicker(null);
  stopRetryCountdown();
  stateBox.hidden = true;
  if (!dialog) {
    hideLaunchCard();
    hideFirstRun();
  }
  setFolderPickerError('');
  folderPickerCancelBtn.hidden = !dialog;
  folderPickerEl.classList.toggle('is-dialog', dialog);
  if (dialog) folderPickerPanelEl.setAttribute('aria-modal', 'true');
  else folderPickerPanelEl.removeAttribute('aria-modal');
  // The project already open is left out by the command itself.
  let recent = [];
  try {
    recent = (await invoke('recent_folders')) || [];
  } catch (error) {
    setFolderPickerError(error, 'read the recent folders');
  }
  folderPickerListEl.replaceChildren(
    ...folderPickerRows(recent).map((row) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `folder-picker-row is-${row.kind}`;
      const label = document.createElement('span');
      label.className = 'folder-picker-label';
      label.textContent = row.label;
      button.append(label);
      if (row.detail) {
        const detail = document.createElement('span');
        detail.className = 'folder-picker-detail';
        detail.textContent = row.detail;
        button.append(detail);
      }
      button.onclick = () => chooseFolderRow(row, button, dialog);
      li.append(button);
      return li;
    })
  );
  folderPickerEl.hidden = false;
  folderPickerButtons()[0].focus();
  return new Promise((resolve) => {
    folderPickerResolve = resolve;
  });
}

// One row pressed: the OS dialog for Choose a folder (`change_project` from
// Change project, which tears the old project down), else that recent
// folder. Nothing chosen keeps the picker up, focus back on the row.
async function chooseFolderRow(row, button, dialog) {
  const buttons = folderPickerButtons();
  buttons.forEach((b) => { b.disabled = true; });
  folderPickerCancelBtn.disabled = true;
  setFolderPickerError('');
  let dir = null;
  try {
    if (row.kind === 'browse') dir = await invoke(dialog ? 'change_project' : 'pick_project_folder');
    else dir = await invoke('open_recent_folder', { dir: row.dir });
  } catch (error) {
    setFolderPickerError(error, row.kind === 'browse' ? 'open the folder picker' : `open ${row.dir}`);
  }
  buttons.forEach((b) => { b.disabled = false; });
  folderPickerCancelBtn.disabled = false;
  if (dir) {
    closeFolderPicker(dir);
    return;
  }
  button.focus();
}

folderPickerCancelBtn.onclick = () => closeFolderPicker(null);
// Escape is heard on the document: a click on the backdrop or the heading
// leaves focus on the page, where a listener on the picker never sees it.
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.key !== 'Escape' || folderPickerEl.hidden) return;
  if (folderPickerCancelBtn.hidden || folderPickerCancelBtn.disabled) return;
  event.preventDefault();
  closeFolderPicker(null);
});
folderPickerEl.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const buttons = folderPickerButtons();
  const at = buttons.indexOf(document.activeElement);
  if (at < 0) return;
  event.preventDefault();
  const next = event.key === 'ArrowDown' ? Math.min(at + 1, buttons.length - 1) : Math.max(at - 1, 0);
  buttons[next].focus();
});

// A bare start: the picker, full screen, until a folder is opened.
async function chooseStartFolder() {
  const dir = await showFolderPicker({ dialog: false });
  if (!dir) return;
  setProjectDir(dir);
  if (appState) appState.projectDir = dir;
  afterProjectKnown();
}

// Once a project folder is known: the first-run checklist (once, until it
// passes) or straight to the launch card.
function afterProjectKnown() {
  if (appState && !appState.firstRunDone) {
    showFirstRun(appState);
  } else {
    showLaunchCard();
  }
}

// Switches to a folder picked in the folder picker's dialog: the Rust side
// tears the old project's agent and console down before the new one is
// remembered, so nothing from it carries over. Cancel (or Escape) leaves
// the current project as it was; the folder already open is not listed.
async function doChangeProject() {
  try {
    const dir = await showFolderPicker({ dialog: true });
    if (!dir) {
      // Cancel leaves the page as it was: a running agent gets the keyboard
      // back, and a dashboard still on screen is never covered.
      if (agentActive() || frameReady) hideState();
      else afterProjectKnown();
      if (agentActive()) terminal.focus();
      return;
    }
    setProjectDir(dir);
    if (appState) appState.projectDir = dir;
    restarting = false;
    currentUrl = null;
    frameReady = false;
    afterProjectKnown();
  } catch (error) {
    showErrorState(error, 'switch project', 'Try again', doChangeProject);
  }
}

async function changeProject() {
  if (agentActive()) {
    const yes = await confirmModal({
      title: 'Stop the running agent and switch to a different project?',
      lines: [{ kind: 'text', text: 'What the agent was doing is not saved.' }],
      primary: 'Change project',
      danger: true,
    });
    if (!yes) return;
  }
  doChangeProject();
}

changeProjectBtn.onclick = () => {
  closeBarMenus();
  changeProject();
};

// The launcher passed `--agent`: start it at once, on its model, with the
// same bypass flags the terminal launcher itself always runs that agent with
// (it offers no permission-mode choice of its own).
async function autoStartAgent(state) {
  launchAgentEl.value = state.autoStart;
  if (typeof state.launchModel === 'string' && state.launchModel) launchModelEl.value = state.launchModel;
  setAgentStatus('');
  beginWait('Starting the agent...');
  const { cols, rows } = terminal.size();
  try {
    await invoke('agent_start', {
      kind: state.autoStart,
      model: state.launchModel || null,
      effort: null,
      mode: 'bypass',
      cols,
      rows,
    });
    terminal.focus();
  } catch (error) {
    endWait();
    setAgentError(error, 'start the agent');
    showLaunchCard();
  }
}

// A page that just mounted registers its output channel and, if an agent
// already ran before it (a reload, or this is the window's first paint
// after one survived a restart), gets its recent output replayed onto a
// clean xterm at once instead of starting blank.
async function recoverAfterReload(snapshot) {
  applyAgentState(snapshot, { skipReset: true });
  terminal.focus();
  hideState();
  consoleKnown = true;
  if (!pollTimer) pollTimer = setInterval(pollConsole, STATUS_POLL_MS);
  try {
    const status = await invoke('console_status');
    if (status.state === 'running' && status.url) {
      loadFrame(status.url);
    } else {
      onNoHello();
    }
  } catch {
    onNoHello();
  }
}

// --- The one confirm dialog (A10) -------------------------------------------------------------
// Drawn here, outside the page's frame, so the page can never fake one. `lines` are
// { kind: 'text' | 'code' | 'callout', text }; the safe button comes first and has focus, the
// named danger verb last (meter.js confirmButtons). Resolves true for the primary, false for
// Cancel or Escape. A null `primary` makes it a plain notice with one Close button.
let confirmResolve = null;
let confirmReturnFocus = null;
// The id of the Rust request on screen ('' for the shell's own), so the Rust side can take it back.
let confirmShownId = '';
const shellParts = () => ['bar', 'loop-banner', 'workspace'].map((id) => document.getElementById(id)).filter(Boolean);

function confirmModal({ title, lines = [], primary = 'OK', cancel = 'Cancel', danger = false, safeFirst = true, id = '' }) {
  if (confirmResolve) closeConfirm(false);
  return new Promise((resolve) => {
    confirmResolve = resolve;
    confirmShownId = id;
    confirmReturnFocus = document.activeElement;
    confirmTitleEl.textContent = title;
    confirmBodyEl.replaceChildren(
      ...lines.map((line) => {
        const item = typeof line === 'string' ? { kind: 'text', text: line } : line;
        if (item.kind === 'code') {
          const pre = document.createElement('pre');
          pre.textContent = item.text;
          return pre;
        }
        const p = document.createElement('p');
        if (item.kind === 'callout') p.className = 'confirm-callout';
        p.replaceChildren(...commandNodes(item.text));
        return p;
      })
    );
    confirmCancelBtn.textContent = cancel;
    confirmPrimaryBtn.hidden = !primary;
    confirmPrimaryBtn.textContent = primary || '';
    confirmPrimaryBtn.classList.toggle('is-danger', Boolean(danger));
    const layout = confirmButtons({ safeFirst: primary ? safeFirst : true });
    confirmActionsEl.replaceChildren(...layout.order.map((which) => (which === 'cancel' ? confirmCancelBtn : confirmPrimaryBtn)));
    // The rest of the shell is out of reach while it asks.
    for (const part of shellParts()) part.inert = true;
    confirmModalEl.hidden = false;
    (layout.focus === 'cancel' ? confirmCancelBtn : confirmPrimaryBtn).focus();
  });
}

function closeConfirm(answer) {
  const resolve = confirmResolve;
  confirmResolve = null;
  confirmShownId = '';
  confirmModalEl.hidden = true;
  for (const part of shellParts()) part.inert = false;
  const back = confirmReturnFocus;
  confirmReturnFocus = null;
  if (back && back.isConnected && typeof back.focus === 'function') back.focus();
  if (resolve) resolve(answer);
}

confirmCancelBtn.onclick = () => closeConfirm(false);
confirmPrimaryBtn.onclick = () => closeConfirm(true);
// Escape is heard on the document, in the capture phase, while the modal is up: a click on the scrim
// leaves focus on the page, where a listener on the modal never sees it, and nothing behind the modal
// (the folder picker, a bar menu) may take the same key.
document.addEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape' || confirmModalEl.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeConfirm(false);
  },
  true
);
confirmModalEl.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    const buttons = [...confirmActionsEl.querySelectorAll('button')].filter((b) => !b.hidden);
    const next = trapTab(event.shiftKey, buttons.indexOf(document.activeElement), buttons.length);
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus();
  }
});

// The Rust side asks for a confirm too (the loop start, and the quit check outside Windows): it sends
// the same fields and waits for confirm_answer. Only the fields below are read. When it gives up
// waiting (confirm-cancel) the modal it asked for goes away too.
window.__TAURI__.event.listen('confirm-cancel', (event) => {
  if (typeof event.payload === 'string' && event.payload && event.payload === confirmShownId) closeConfirm(false);
});
window.__TAURI__.event
  .listen('confirm-request', async (event) => {
  const req = event.payload || {};
  if (typeof req.id !== 'string' || typeof req.title !== 'string') return;
  const lines = Array.isArray(req.lines) ? req.lines.filter((l) => l && typeof l.text === 'string').map((l) => ({ kind: ['code', 'callout'].includes(l.kind) ? l.kind : 'text', text: l.text })) : [];
  const yes = await confirmModal({
    id: req.id,
    title: req.title,
    lines,
    primary: typeof req.primary === 'string' ? req.primary : 'OK',
    cancel: typeof req.cancel === 'string' ? req.cancel : 'Cancel',
    danger: req.danger === true,
    safeFirst: req.safeFirst !== false,
  });
  invoke('confirm_answer', { id: req.id, yes }).catch(() => {});
  })
  // Rust asks through the OS box until the page says it is listening.
  .then(() => invoke('confirm_ready').catch(() => {}), () => {});

// --- Shortcuts and the bar's "..." menu (A11) -----------------------------------------------
function runShortcut(id) {
  if (!confirmModalEl.hidden) return;
  closeBarMenus();
  if (id === 'toggle-terminal') {
    termCollapseBtn.click();
    if (paneCollapsed) frame.focus();
  } else if (id === 'focus-console') {
    frame.focus();
  } else if (id === 'focus-terminal') {
    showTerminal();
  } else if (id === 'new-session') {
    if (!restartBtn.hidden) restartBtn.click();
  } else if (id === 'change-project') {
    // Not over the bare start's own folder picker: Cancel there would leave no project at all.
    if (!changeProjectBtn.disabled && folderPickerEl.hidden) changeProjectBtn.click();
  } else if (id === 'preferences') {
    // The console's own dialog: it opens when a page is showing.
    if (frameReady && frame.contentWindow) frame.contentWindow.postMessage({ plan2code: 'open-preferences' }, '*');
  }
}

// Keys pressed anywhere in the shell itself (the bar, the panes' edges). The terminal's own go through
// its key handler (and have the default prevented by then), the console frame's through a message.
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented) return;
  const inTerminal = Boolean(event.target && event.target.closest && event.target.closest('#term'));
  const id = shortcutAction(event, { mac: IS_MAC, inTerminal });
  if (!id) return;
  event.preventDefault();
  runShortcut(id);
});

document.getElementById('app-about').onclick = () => {
  closeBarMenus();
  void showAbout();
};
document.getElementById('app-check-updates').onclick = () => {
  closeBarMenus();
  void checkUpdatesNow();
};
// Help is the console's own dialog, so it needs a page on screen.
function openHelp() {
  if (frameReady && frame.contentWindow) frame.contentWindow.postMessage({ plan2code: 'open-help' }, '*');
  else void confirmModal({ title: 'Help', lines: [{ kind: 'text', text: 'Help opens with the dashboard. Start an agent first, then press ? in the dashboard.' }], cancel: 'Close', primary: null });
}
document.getElementById('app-help').onclick = () => {
  closeBarMenus();
  openHelp();
};
// The macOS menu bar's own items (main.rs build_mac_menu) do the same as the "..." menu.
window.__TAURI__.event.listen('app-menu', (event) => {
  if (event.payload === 'about') void showAbout();
  else if (event.payload === 'check-updates') void checkUpdatesNow();
  else if (event.payload === 'help') openHelp();
});
document.getElementById('app-quit').onclick = () => {
  closeBarMenus();
  invoke('request_quit').catch((error) => setAgentError(error, 'quit'));
};

async function main() {
  let state;
  try {
    state = await invoke('app_state');
  } catch (error) {
    showErrorState(error, 'read the app state', 'Retry', main);
    return;
  }
  appState = state;
  if (typeof state.launchModel === 'string' && state.launchModel) launchModelEl.value = state.launchModel;
  if (state.termPanel) {
    paneDock = state.termPanel.dock === 'right' ? 'right' : 'bottom';
    paneFraction = state.termPanel.fraction;
    paneCollapsed = Boolean(state.termPanel.collapsed);
  } else {
    // Nothing saved yet: start docked right, wide enough to keep the
    // console's own side-by-side panels from stacking, where the window
    // allows it.
    paneDock = 'right';
    paneFraction = defaultRightFraction(window.innerWidth, { minFraction: MIN_PANE, maxFraction: MAX_PANE });
    savePaneSettings();
  }
  applyPaneLayout();
  terminal.setFontSize(Number.isInteger(state.terminalFontSize) ? state.terminalFontSize : TERMINAL_FONT_DEFAULT);
  terminal.setCopyOnSelect(Boolean(state.copyOnSelect));
  termTitleEl.title = `Focus the terminal (${shortcutLabel('focus-terminal', IS_MAC)}); focus the dashboard (${shortcutLabel('focus-console', IS_MAC)})`;
  if (state.updatedFrom) void showUpdatedTo();
  await loadAgentAvailability();
  applyDefaultAgent(state.lastAgent);
  setInterval(updateBadge, BADGE_POLL_MS);
  checkVersions();
  checkNewRelease();
  setInterval(checkNewRelease, UPDATE_RECHECK_MS);

  let reattach = null;
  try {
    reattach = await invoke('agent_reattach', { onOutput: agentChannel });
  } catch {
    // Nothing to reattach to is not fatal: carry on as a plain first paint.
  }
  // A reloaded window learns of a running loop before it draws the agent.
  await syncLoopState();
  if (reattach && reattach.state !== 'idle') {
    if (state.projectDir) setProjectDir(state.projectDir);
    await recoverAfterReload(reattach);
    return;
  }

  if (state.autoStart) {
    if (state.projectDir) setProjectDir(state.projectDir);
    await autoStartAgent(state);
    return;
  }
  if (state.projectDir) {
    setProjectDir(state.projectDir);
    // The checklist's Node.js row needs the check's result, which the app now
    // runs after the window opens.
    if (!state.firstRunDone) await awaitNodeStatus(state);
    afterProjectKnown();
  } else {
    chooseStartFolder();
  }
}

// The Node.js check runs in the background so the window opens at once:
// `nodeChecked` is false until it finishes, and a `node-status` event carries
// the same fields. Waits for it (at most NODE_WAIT_MS) and folds it into `state`.
const NODE_WAIT_MS = 15000;

async function awaitNodeStatus(state) {
  if (state.nodeChecked) return;
  await new Promise((resolve) => {
    let done = false;
    const finish = (report) => {
      if (done) return;
      done = true;
      if (report && typeof report === 'object') {
        state.nodeChecked = true;
        state.nodeVersion = report.version || null;
        state.nodeBinary = report.binary || null;
        state.nodeProblem = report.problem || null;
      }
      resolve();
    };
    window.__TAURI__.event.listen('node-status', (event) => finish(event.payload)).catch(() => finish(null));
    setTimeout(() => finish(null), NODE_WAIT_MS);
    // The check may have finished between the first read and the listener.
    invoke('app_state')
      .then((again) => {
        if (again.nodeChecked) finish({ version: again.nodeVersion, binary: again.nodeBinary, problem: again.nodeProblem });
      })
      .catch(() => {});
  });
}

main();
