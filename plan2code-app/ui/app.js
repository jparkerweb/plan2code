// The app page: the top bar, the console dashboard in an iframe, and the
// agent's terminal panel docked at the bottom with a drag handle.

import { mountTerminal } from './terminal.js';
import { attentionSignal, barNextSteps, continueKeys, defaultRightFraction, folderName, pickDefaultAgent, taskbarSwitch, windowTitleFor } from './meter.js';

const { invoke, Channel } = window.__TAURI__.core;

const projectMenuBtn = document.getElementById('project-menu-button');
const projectNameEl = document.getElementById('project-name');
const projectPathEl = document.getElementById('project-path');
const projectMenu = document.getElementById('project-menu');
const agentMenuBtn = document.getElementById('agent-menu-button');
const agentMenu = document.getElementById('agent-menu');
const agentMenuHeadEl = document.getElementById('agent-menu-head');
const agentDotEl = document.getElementById('agent-dot');
const agentNameEl = document.getElementById('agent-name');
const agentEndedEl = document.getElementById('agent-ended');
const agentBypassEl = document.getElementById('agent-bypass');
const agentNoneEl = document.getElementById('agent-none');
const agentStatusEl = document.getElementById('agent-status');
const restartBtn = document.getElementById('agent-restart');
const changeAgentBtn = document.getElementById('change-agent');
const changeProjectBtn = document.getElementById('change-project');
const barRowEl = document.getElementById('bar-row');
const launchCard = document.getElementById('launch-card');
const launchAgentEl = document.getElementById('launch-agent');
const launchMissingEl = document.getElementById('launch-missing');
const launchWarningEl = document.getElementById('launch-agents-warning');
const launchModelEl = document.getElementById('launch-model');
const launchModelListEl = document.getElementById('launch-model-list');
const launchEffortRow = document.getElementById('launch-effort-row');
const launchEffortEl = document.getElementById('launch-effort');
const launchBypassEl = document.getElementById('launch-bypass');
const launchBypassWarningEl = document.getElementById('launch-bypass-warning');
const launchStartBtn = document.getElementById('launch-start');
const firstRunEl = document.getElementById('first-run');
const firstRunListEl = document.getElementById('first-run-list');
const firstRunStartBtn = document.getElementById('first-run-start');
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
const workspaceEl = document.getElementById('workspace');
const termPanel = document.getElementById('term-panel');
const termHandle = document.getElementById('term-handle');
const termDockBtn = document.getElementById('term-dock');
const termMaximizeBtn = document.getElementById('term-maximize');
const termCollapseBtn = document.getElementById('term-collapse');
const termBadgeEl = document.getElementById('term-badge');

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
    if (agentActive()) invoke('agent_input', { data });
  },
  onResize: (cols, rows) => {
    if (agentActive()) invoke('agent_resize', { cols, rows });
  },
});

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
  restartBtn.hidden = !(active || ended);
  changeAgentBtn.hidden = !ended;
  // Checked mode needs no marker; bypass always gets the "checks off" badge
  // on the agent, for exactly as long as that agent runs.
  const bypassActive = active && agent.mode === 'bypass';
  agentMenuBtn.hidden = !(active || ended);
  agentNoneEl.hidden = active || ended;
  agentNameEl.textContent = active || ended ? label || 'The agent' : '';
  agentDotEl.className = `agent-dot${active ? (bypassActive ? ' is-warn' : ' is-ok') : ''}`;
  agentEndedEl.hidden = !ended;
  agentBypassEl.hidden = !bypassActive;
  renderAgentMenuHead(label || 'The agent', { active, ended, bypassActive });
  if (agentMenu.hidden === false && agentMenuBtn.hidden) closeBarMenus();
  restartBtn.title = ended ? 'Start a fresh agent on the same brief' : 'Replace the agent with a fresh one, on a fresh context window';
  // The agent is back (a fresh generation, running): the restart message stays
  // on screen (restarting() below) until its dashboard page is announced.
  if (restarting && freshScreen && agent.state === 'running') {
    terminal.write('\r\n\r\n[Fresh agent started. Waiting for the dashboard...]\r\n\r\n');
  }

  if (ended) {
    // The why sits beside the agent's menu; the menu says the rest.
    setAgentStatus(agent.reason);
    // A failed Restart clears the screen too, so it says so again.
    if (!wasEnded || freshScreen) {
      terminal.write(`\r\n[${label || 'The agent'} ended: ${agent.reason}. Press New Session in the bar to start a fresh one.]\r\n`);
    }
  } else {
    // After a Restart the bar says what it left for the dashboard, if anything.
    setAgentStatus(agent.briefNote || '');
  }
  updateBadge();
}

// The short line after the agent's menu: an ended agent's reason or a
// Restart's brief note (quiet), or something that went wrong (in red).
function setAgentStatus(text, { error = false } = {}) {
  agentStatusEl.textContent = text;
  agentStatusEl.title = text;
  agentStatusEl.classList.toggle('is-error', error && Boolean(text));
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
    agentMenuHeadEl.replaceChildren(name, ` ended: ${agent.reason}`, document.createElement('br'), 'Nothing starts until you press New Session.');
  } else {
    agentMenuHeadEl.replaceChildren();
  }
}

// The bar's two menus (project, agent). They hang outside the scrolling bar
// row, fixed under their trigger, so the row's overflow never clips them.
// Clicking anywhere else (the console frame and the terminal too), Escape,
// a resize or a scroll of the row all close them.
let openBarMenu = null;

function closeBarMenus() {
  for (const [button, menu] of [[projectMenuBtn, projectMenu], [agentMenuBtn, agentMenu]]) {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  openBarMenu = null;
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
}

projectMenuBtn.onclick = () => toggleBarMenu(projectMenuBtn, projectMenu);
agentMenuBtn.onclick = () => toggleBarMenu(agentMenuBtn, agentMenu);
document.addEventListener('pointerdown', (event) => {
  if (!openBarMenu) return;
  if (openBarMenu.contains(event.target) || projectMenuBtn.contains(event.target) || agentMenuBtn.contains(event.target)) return;
  closeBarMenus();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !openBarMenu) return;
  const trigger = openBarMenu === projectMenu ? projectMenuBtn : agentMenuBtn;
  closeBarMenus();
  trigger.focus();
});
window.addEventListener('blur', closeBarMenus);
window.addEventListener('resize', closeBarMenus);
barRowEl.addEventListener('scroll', closeBarMenus);

// True from a confirmed Restart until the fresh agent's dashboard page is
// announced (showAnnounced below): the frame stays blanked with a message the
// whole time, since the restarted agent must boot and run the skill again
// before anything can show.
let restarting = false;

function confirmRestart(onYes) {
  if (agent.state !== 'running') {
    onYes();
    return;
  }
  showState(
    'Restart the agent on a fresh context window?',
    'New Session',
    () => {
      restarting = true;
      currentUrl = null;
      frameReady = false;
      showState('The agent is restarting on a fresh context window. Please wait for the dashboard to load.');
      onYes();
    },
    () => (frameReady ? hideState() : showState('No dashboard has loaded yet.')),
    { tired: true }
  );
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
      setAgentStatus(`Could not open the install page: ${error}`, { error: true });
    });
  };
  return button;
}

// Shown when no agent CLI is installed, in the first-run checklist and on the
// launch card: what an agent CLI is, each built-in's install command and page,
// and a way to look again once one is installed.
function noAgentExplainer() {
  const box = document.createElement('div');
  box.className = 'agent-explainer';
  const intro = document.createElement('p');
  intro.className = 'agent-explainer';
  intro.textContent = 'An agent CLI is the AI coding assistant Plan2Code runs for you in its terminal. None was found on PATH. Install one of these:';
  const list = document.createElement('ul');
  for (const entry of agentList.filter((a) => !a.custom)) {
    const item = document.createElement('li');
    item.append(`${entry.label}: `);
    const code = document.createElement('code');
    code.textContent = entry.installHint || '';
    item.append(code, installPageButton(entry.id));
    list.append(item);
  }
  const other = document.createElement('p');
  other.className = 'agent-explainer';
  other.textContent = 'Already use another agent CLI? Add it in User Preferences under Agents.';
  const check = document.createElement('button');
  check.type = 'button';
  check.textContent = 'Check again';
  check.onclick = checkAgentsAgain;
  box.append(intro, list, other, check);
  return box;
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
      launchMissingEl.append(noAgentExplainer());
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
  // A custom agent has no separate effort, and offers its models as
  // suggestions in the (still free-text) model field.
  launchModelListEl.replaceChildren();
  for (const model of (info && info.custom && info.models) || []) {
    const option = document.createElement('option');
    option.value = model.id;
    if (model.label) option.label = model.label;
    launchModelListEl.append(option);
  }
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
  const body = document.createElement('div');
  body.className = 'first-run-body';
  const titleEl = document.createElement('div');
  titleEl.className = 'first-run-title';
  titleEl.textContent = title;
  body.append(titleEl);
  if (detail) {
    const detailEl = document.createElement('div');
    detailEl.className = 'first-run-detail';
    if (typeof detail === 'string') detailEl.textContent = detail;
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
  const nodeDetail = `${state.nodeVersion || 'found'} (18 or newer)${state.nodeBinary ? ` — ${state.nodeBinary}` : ''}`;
  firstRunListEl.append(firstRunRow(true, 'Node.js', nodeDetail));

  const agentsKnown = agentList;
  const anyAgentInstalled = agentsKnown.length === 0 || agentsKnown.some((a) => a.installed);
  const agentsDetail = document.createElement('span');
  if (agentsKnown.length === 0) {
    agentsDetail.textContent = 'Could not check.';
  } else if (!anyAgentInstalled) {
    agentsDetail.append(noAgentExplainer());
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
  const model = launchModelEl.value.trim() || null;
  const info = agentAvailability[kind];
  const effort = !(info && info.custom) && (EFFORT_OPTIONS[kind] || []).length > 0 ? launchEffortEl.value || null : null;
  const mode = launchBypassEl.checked ? 'bypass' : 'checked';
  setAgentStatus('');
  showState('Waiting for the agent to open the dashboard');
  const { cols, rows } = terminal.size();
  try {
    await invoke('agent_start', { kind, model, effort, mode, cols, rows });
    terminal.focus();
  } catch (error) {
    setAgentStatus(`Could not start the agent: ${error}`, { error: true });
    showLaunchCard();
  }
}

async function agentAction(command) {
  try {
    await invoke(command);
    terminal.focus();
  } catch (error) {
    setAgentStatus(String(error), { error: true });
  }
}

launchCard.addEventListener('submit', startAgent);
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
  termDockBtn.textContent = paneDock === 'right' ? 'Dock bottom' : 'Dock right';
  termMaximizeBtn.textContent = paneMaximized ? 'Restore' : 'Maximize';
  termMaximizeBtn.setAttribute('aria-pressed', String(paneMaximized));
  termCollapseBtn.textContent = paneCollapsed ? 'Expand' : 'Collapse';
  termCollapseBtn.setAttribute('aria-pressed', String(paneCollapsed));
  updateBadge();
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
termHandle.addEventListener('pointerup', (event) => {
  if (termHandle.hasPointerCapture(event.pointerId)) termHandle.releasePointerCapture(event.pointerId);
  savePaneSettings();
});

// When the pane is collapsed or small, the agent's own status line can keep
// redrawing while it is really waiting on a prompt no one is watching: a
// stretch of no new output at all is the giveaway.
let lastOutputAt = Date.now();

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
    clearTimeout(helloTimer);
    hideState();
    // The Desktop app switch in its User Preferences shows what app.json holds.
    const on = !appState || appState.taskbarSignal !== false;
    event.source.postMessage({ plan2code: 'taskbar-state', on }, '*');
  } else if (kind === 'attention') {
    const signal = attentionSignal(event.data);
    if (signal) invoke('set_attention', { signal }).catch(() => {});
  } else if (kind === 'taskbar') {
    const on = taskbarSwitch(event.data);
    if (on === null) return;
    if (appState) appState.taskbarSignal = on;
    invoke('set_taskbar_signal', { on }).catch(() => {});
  } else if (kind === 'agent-continue') {
    typeContinue();
  } else if (kind === 'new-session') {
    // The bar's own button, so the press is confirmed exactly the same way.
    if (!restartBtn.hidden) restartBtn.click();
  } else if (kind === 'looks') {
    applyAccent(event.data.accent, { save: true });
  }
});

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
      setAgentStatus(`Could not type continue: ${error}`, { error: true });
    });
}

// The person's highlight color, as the console page last sent it (its dark
// shades: fill, soft, ink, line), so the bar's buttons light in it too. Kept
// here for the next launch, which paints the bar before any page has loaded.
const ACCENT_KEY = 'p2c-app:accent';
const ACCENT_VARS = ['--accent', '--accent-soft', '--accent-ink', '--accent-line'];

function applyAccent(shades, { save = false } = {}) {
  if (!Array.isArray(shades) || shades.length !== ACCENT_VARS.length) return;
  if (!shades.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))) return;
  ACCENT_VARS.forEach((name, i) => document.documentElement.style.setProperty(name, shades[i]));
  if (!save) return;
  try {
    localStorage.setItem(ACCENT_KEY, JSON.stringify(shades));
  } catch {
    // Not remembered is fine: the stylesheet's default shows until a page loads.
  }
}

try {
  applyAccent(JSON.parse(localStorage.getItem(ACCENT_KEY)));
} catch {
  // Nothing saved, or storage is blocked: the stylesheet's default stands.
}

// No hello in time: ask the console why, and say so with a way forward.
async function onNoHello() {
  if (frameReady || !consoleKnown || restarting) return;
  // A page that does not answer cannot say it is done needing the person.
  clearAttention();
  let status = null;
  try {
    status = await invoke('console_status');
  } catch {
    // The status check itself failed; treat it as a console that is not answering.
  }
  if (!status || status.state !== 'running') {
    showState('The console stopped, so the page could not show.', 'Reconnect the console', reconnectConsole);
  } else {
    showState('The console is running but its page did not show in this window.', 'Reload the page', () => {
      showState('Reloading the page');
      loadFrame(currentUrl);
    });
  }
}

function showState(text, buttonLabel, onButton, onCancel, { tired = false } = {}) {
  hideLaunchCard();
  hideFirstRun();
  // statePlannyEl is an <svg>: unlike HTMLElement, it does not reflect the
  // `.hidden` property to the attribute, so toggling the property alone left
  // `hidden` in the markup forever. The attribute itself always works.
  statePlannyEl.toggleAttribute('hidden', !tired);
  stateText.textContent = text;
  stateButton.hidden = !buttonLabel;
  stateButton.textContent = buttonLabel || '';
  stateButton.onclick = onButton || null;
  stateCancelEl.hidden = !onCancel;
  stateCancelEl.onclick = onCancel || null;
  stateBox.hidden = false;
}

function hideState() {
  stateBox.hidden = true;
}

let pollTimer = null;

// Only once the agent has opened a page: brings an idle or dead console back
// on its own session. The app never opens a dashboard on its own (the agent
// does, by running the skill), so there is nothing to start before that.
async function reconnectConsole() {
  markConsoleAlive();
  showState('Reconnecting to the console');
  try {
    const info = await invoke('console_start');
    loadFrame(info.url);
  } catch (error) {
    showState(`The console could not be reached: ${error}`, 'Retry', reconnectConsole);
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
    markConsoleDead();
    if (frameReady && reconnects < RECONNECT_LIMIT) {
      reconnects += 1;
      showState('The console stopped. Reconnecting');
      await reconnectConsole();
    } else if (!frameReady) {
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
  restarting = false;
  if (!consoleKnown) {
    consoleKnown = true;
    if (!pollTimer) pollTimer = setInterval(pollConsole, STATUS_POLL_MS);
  }
  markConsoleAlive();
  if (notice.url !== currentUrl) {
    showState('Opening the page');
    loadFrame(notice.url);
  }
}

window.__TAURI__.event.listen('console-page', (event) => showAnnounced(event.payload));

// The right end of the bar: whether the console stopped answering and where
// the skills stand against this app, drawn as one next step (meter.js
// barNextSteps decides which, and its button), with the rest as "+N more".
let consoleDead = false;
let versionState = null;
const NEXT_STEP_ACTIONS = { reconnect: reconnectConsole, 'restart-console': restartConsole, update: updateSkills };
let nextStepAction = null;

function renderNextStep() {
  const steps = barNextSteps({ consoleDead, version: versionState });
  nextStepEl.hidden = steps.length === 0;
  const [first, ...rest] = steps;
  nextStepTextEl.textContent = first ? first.text : '';
  nextStepTextEl.title = first ? first.title : '';
  nextStepTextEl.className = first ? `is-${first.tone}${first.busy ? ' is-busy' : ''}` : '';
  nextStepAction = first && first.action ? NEXT_STEP_ACTIONS[first.action] : null;
  nextStepBtn.hidden = !nextStepAction;
  nextStepBtn.disabled = false;
  nextStepBtn.textContent = first && first.label ? first.label : '';
  nextStepMoreEl.hidden = rest.length === 0;
  nextStepMoreEl.textContent = `+${rest.length} more`;
  nextStepMoreEl.title = rest.map((step) => step.title).join('\n');
}

function setVersionState(next) {
  versionState = next;
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

// The state `main()` read at startup: `pickFolder()` and the first-run
// checklist both need it once a folder lands, after the fact.
let appState = null;

// Opens the OS folder picker. A canceled pick (or a failed one) lands on the
// "No project folder chosen" state with a button that tries again.
async function pickFolder() {
  try {
    const dir = await invoke('pick_project_folder');
    if (!dir) {
      showState('No project folder chosen', 'Choose folder', pickFolder);
      return;
    }
    setProjectDir(dir);
    if (appState) appState.projectDir = dir;
    afterProjectKnown();
  } catch (error) {
    showState(`Could not open the folder picker: ${error}`, 'Choose folder', pickFolder);
  }
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

// Switches to a folder picked fresh: the Rust side tears the old project's
// agent and console down before the new one is remembered, so nothing from
// it carries over. Picking nothing (canceled) leaves the current project as
// it was.
async function doChangeProject() {
  showState('Choose the new project folder...');
  try {
    const dir = await invoke('change_project');
    if (!dir) {
      if (agentActive()) hideState();
      else afterProjectKnown();
      return;
    }
    setProjectDir(dir);
    if (appState) appState.projectDir = dir;
    restarting = false;
    currentUrl = null;
    frameReady = false;
    afterProjectKnown();
  } catch (error) {
    showState(`Could not switch project: ${error}`, 'Try again', doChangeProject);
  }
}

function changeProject() {
  if (agentActive()) {
    showState(
      'Stop the running agent and switch to a different project? What it was doing is not saved.',
      'Change project',
      doChangeProject,
      () => (frameReady ? hideState() : showLaunchCard())
    );
    return;
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
  showState('Starting the agent...');
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
    setAgentStatus(`Could not start the agent: ${error}`, { error: true });
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

async function main() {
  let state;
  try {
    state = await invoke('app_state');
  } catch (error) {
    showState(`Could not read the app state: ${error}`, 'Retry', main);
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
  await loadAgentAvailability();
  applyDefaultAgent(state.lastAgent);
  setInterval(updateBadge, BADGE_POLL_MS);
  checkVersions();

  let reattach = null;
  try {
    reattach = await invoke('agent_reattach', { onOutput: agentChannel });
  } catch {
    // Nothing to reattach to is not fatal: carry on as a plain first paint.
  }
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
    afterProjectKnown();
  } else {
    pickFolder();
  }
}

main();
