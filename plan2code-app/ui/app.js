// The app page: the top bar, the console dashboard in an iframe, and the
// agent's terminal panel docked at the bottom with a drag handle.

import { mountTerminal } from './terminal.js';
import { nudgeDue } from './meter.js';

const { invoke, Channel } = window.__TAURI__.core;

const projectDirEl = document.getElementById('project-dir');
const agentNameEl = document.getElementById('agent-name');
const agentStatusEl = document.getElementById('agent-status');
const restartBtn = document.getElementById('agent-restart');
const changeAgentBtn = document.getElementById('change-agent');
const changeProjectBtn = document.getElementById('change-project');
const launchCard = document.getElementById('launch-card');
const launchAgentEl = document.getElementById('launch-agent');
const launchMissingEl = document.getElementById('launch-missing');
const launchModelEl = document.getElementById('launch-model');
const launchEffortRow = document.getElementById('launch-effort-row');
const launchEffortEl = document.getElementById('launch-effort');
const launchBypassEl = document.getElementById('launch-bypass');
const launchBypassWarningEl = document.getElementById('launch-bypass-warning');
const launchStartBtn = document.getElementById('launch-start');
const firstRunEl = document.getElementById('first-run');
const firstRunListEl = document.getElementById('first-run-list');
const firstRunStartBtn = document.getElementById('first-run-start');
const meterSlot = document.getElementById('bar-slot-meter');
const nudgeEl = document.getElementById('context-nudge');
const nudgeRestartBtn = document.getElementById('context-restart');
const versionEl = document.getElementById('version-update');
const versionTextEl = document.getElementById('version-update-text');
const versionBtn = document.getElementById('version-update-button');
const versionRestartBtn = document.getElementById('version-update-restart');
const consoleStatusEl = document.getElementById('console-status');
const permissionsNoteEl = document.getElementById('permissions-note');
const consoleAgainBtn = document.getElementById('console-again');
const frame = document.getElementById('console-frame');
const stateBox = document.getElementById('dashboard-state');
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
const currentPageEl = document.getElementById('current-page');

const STATUS_POLL_MS = 5000;
const METER_POLL_MS = 2000;
const BADGE_POLL_MS = 2000;
const MIN_PANE = 0.10;
const MAX_PANE = 0.60;
const MAXIMIZED_PANE = 0.80;
// Below this share of the window, a collapsed-or-small pane can hide a
// question the agent is quietly waiting on.
const SMALL_PANE = 0.15;
const QUIET_BADGE_MS = 10000;

const AGENT_LABELS = { claude: 'Claude Code', devin: 'Devin', codex: 'Codex' };
// Devin's model ids already carry their effort (`swe-2-high`); only these two
// take a separate effort, at the levels their own CLI documents.
const EFFORT_OPTIONS = {
  claude: ['low', 'medium', 'high', 'xhigh', 'max'],
  codex: ['low', 'medium', 'high'],
};

// What the Rust agent host last said: idle, running or ended.
let agent = { state: 'idle', kind: null, generation: 0 };
const agentActive = () => agent.state === 'running';

// The context percent that triggers the Restart suggestion, from the app's
// settings (main() reads it), and the agent run the suggestion was shown for:
// it appears once per run, not again after it is dismissed by a Restart.
let nudgePercent = 70;
let nudgeShownFor = null;

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
  const label = AGENT_LABELS[agent.kind] || '';
  const active = agentActive();

  agentNameEl.textContent = active ? label : '';
  if (active) {
    // Only ever auto-*hides* the card (the agent just started); it must
    // never auto-*show* it on 'ended' or 'idle' — that is Change agent's
    // job alone, so the card does not pop up over the dashboard uninvited.
    launchCard.hidden = true;
    hideFirstRun();
  }
  // One rule throughout: Restart while running or ended (it keeps the
  // previous agent, model, effort and mode); Change agent only once ended,
  // when there is a real choice to make again.
  restartBtn.hidden = !(active || agent.state === 'ended');
  changeAgentBtn.hidden = agent.state !== 'ended';
  // Checked mode needs no banner; bypass always gets one, naming the agent it
  // applies to, for exactly as long as that agent runs.
  const bypassActive = active && agent.mode === 'bypass';
  permissionsNoteEl.hidden = !bypassActive;
  permissionsNoteEl.textContent = bypassActive ? `Permission checks are off for ${label || 'the running agent'}` : '';
  restartBtn.title = agent.state === 'ended' ? 'Start a fresh agent on the same brief' : 'Replace the agent with a fresh one, on a fresh context window';
  if (freshScreen || agent.state !== 'running') nudgeEl.hidden = true;
  if (!agentActive()) renderMeter({ kind: 'unknown' });
  // The agent is back (a fresh generation, running): the restart message stays
  // on screen (restarting() below) until its dashboard page is announced.
  if (restarting && freshScreen && agent.state === 'running') {
    terminal.write('

[Fresh agent started. Waiting for the dashboard...]

');
  }

  if (agent.state === 'ended') {
    agentStatusEl.textContent = `${label || 'The agent'} ended: ${agent.reason}. Nothing starts until you press Restart.`;
    // A failed Restart clears the screen too, so it says so again.
    if (!wasEnded || freshScreen) {
      terminal.write(`\r\n[${label || 'The agent'} ended: ${agent.reason}. Press Restart in the bar to start a fresh one.]\r\n`);
    }
  } else {
    // After a Restart the bar says what it left for the dashboard, if anything.
    agentStatusEl.textContent = agent.briefNote || '';
  }
  agentStatusEl.title = agentStatusEl.textContent;
  updateBadge();
}

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
    'Restart the agent on a fresh context window? What it was doing is not saved.',
    'Restart',
    () => {
      restarting = true;
      currentUrl = null;
      frameReady = false;
      currentPageEl.textContent = '';
      showState('The agent is restarting on a fresh context window. Please wait for the dashboard to load.');
      onYes();
    },
    () => (frameReady ? hideState() : showState('No dashboard has loaded yet.'))
  );
}

// What the launch card offers for each agent: whether its CLI was found on
// PATH (else how to install it) and whether it takes its own effort.
let agentAvailability = {};

async function loadAgentAvailability() {
  try {
    const list = await invoke('agent_availability');
    agentAvailability = Object.fromEntries(list.map((entry) => [entry.id, entry]));
  } catch {
    // Nothing to show is not a reason to block the card: Start just tries it.
    agentAvailability = {};
  }
}

function refreshLaunchCard() {
  const kind = launchAgentEl.value;
  const info = agentAvailability[kind];
  const installed = info ? info.installed : true;
  launchStartBtn.disabled = !installed;
  launchMissingEl.hidden = installed;
  launchMissingEl.replaceChildren();
  if (!installed) {
    const label = (info && info.label) || AGENT_LABELS[kind] || kind;
    launchMissingEl.append(`${label} was not found on PATH. Install it: `);
    const code = document.createElement('code');
    code.textContent = (info && info.installHint) || '';
    launchMissingEl.append(code);
  }
  const levels = EFFORT_OPTIONS[kind] || [];
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

  const agentsKnown = Object.values(agentAvailability);
  const anyAgentInstalled = agentsKnown.length === 0 || agentsKnown.some((a) => a.installed);
  const agentsDetail = document.createElement('span');
  if (agentsKnown.length === 0) {
    agentsDetail.textContent = 'Could not check.';
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
  const effort = (EFFORT_OPTIONS[kind] || []).length > 0 ? launchEffortEl.value || null : null;
  const mode = launchBypassEl.checked ? 'bypass' : 'checked';
  agentStatusEl.textContent = '';
  showState('Waiting for the agent to open the dashboard');
  const { cols, rows } = terminal.size();
  try {
    await invoke('agent_start', { kind, model, effort, mode, cols, rows, onOutput: agentChannel });
    terminal.focus();
  } catch (error) {
    agentStatusEl.textContent = `Could not start the agent: ${error}`;
    showLaunchCard();
  }
}

async function agentAction(command) {
  try {
    await invoke(command);
    terminal.focus();
  } catch (error) {
    agentStatusEl.textContent = String(error);
  }
}

launchCard.addEventListener('submit', startAgent);
restartBtn.onclick = () => confirmRestart(() => agentAction('agent_restart'));
nudgeRestartBtn.onclick = () => confirmRestart(() => agentAction('agent_restart'));
// Only ever enabled once the agent has ended: nothing active to lose, so no confirm.
changeAgentBtn.onclick = () => showLaunchCard();

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
  clearTimeout(helloTimer);
  helloTimer = setTimeout(onNoHello, HELLO_WAIT_MS);
  frame.src = url;
}

window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  if (!event.data || event.data.plan2code !== 'console-ready') return;
  frameReady = true;
  clearTimeout(helloTimer);
  hideState();
});

// No hello in time: ask the console why, and say so with a way forward.
async function onNoHello() {
  if (frameReady || !consoleKnown || restarting) return;
  let status = null;
  try {
    status = await invoke('console_status');
  } catch {
    // The status check itself failed; treat it as a console that is not answering.
  }
  if (!status || status.state !== 'running') {
    showState('The console stopped, so the page could not show.', 'Restart the console', reconnectConsole);
  } else {
    showState('The console is running but its page did not show in this window.', 'Reload the page', () => {
      showState('Reloading the page');
      loadFrame(currentUrl);
    });
  }
}

function showState(text, buttonLabel, onButton, onCancel) {
  hideLaunchCard();
  hideFirstRun();
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
    if (String(error).includes('too old')) {
      versionTextEl.textContent = 'The installed console is too old for the app';
      versionEl.hidden = false;
    }
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

// The meter: a bar and a percent for a real or best-effort reading, a dashed
// bar with "about N%" and an "estimate" tag for an estimate, "unknown" when
// nothing is available. Built with DOM calls, never innerHTML.
function renderMeter(reading) {
  meterSlot.replaceChildren();
  // Left empty, not even an "unknown" label: #bar-slot-meter:empty hides it,
  // so the bar carries nothing until the reading means something.
  if (reading.kind === 'unknown') return;
  const label = document.createElement('span');
  const track = document.createElement('span');
  track.className = `meter-track ${reading.kind}`;
  const fill = document.createElement('span');
  fill.className = 'meter-fill';
  fill.style.width = `${reading.percent}%`;
  track.append(fill);
  label.textContent = reading.kind === 'estimate' ? `about ${reading.percent}%` : `${reading.percent}%`;
  meterSlot.append(track, label);
  if (reading.kind === 'estimate') {
    const tag = document.createElement('span');
    tag.className = 'meter-tag';
    tag.textContent = 'estimate';
    meterSlot.append(tag);
    meterSlot.title = 'Estimated from the text so far: the agent does not report its context size';
  } else if (reading.kind === 'besteffort') {
    meterSlot.title = 'Read from the agent\'s session log: undocumented, so it may stop working after an update';
  } else {
    meterSlot.title = 'How full the agent context is, as the agent reports it';
  }
}

// Every two seconds while an agent runs: draw the meter and, once per run,
// suggest a Restart when the context reaches the nudge percent.
async function pollMeter() {
  if (!agentActive()) return;
  try {
    // The reading may land after a Restart: only a reading for the same run counts.
    const { generation, state } = agent;
    const reading = await invoke('agent_context');
    if (agent.generation !== generation || agent.state !== state) return;
    renderMeter(reading);
    if (nudgeDue(reading, nudgePercent) && state === 'running' && nudgeShownFor !== generation) {
      nudgeShownFor = generation;
      nudgeEl.hidden = false;
    }
  } catch {
    // A failed read is not a reading: look again on the next tick.
  }
}

// Once, at start: when the app and the installed skills are on different versions the bar
// says so and offers Update skills. Nothing runs until that button is pressed.
async function checkVersions() {
  try {
    const status = await invoke('version_status');
    if (!status.mismatch) return;
    if (status.skills_ahead) {
      // The skills are ahead of this app: another Update skills run cannot help.
      versionTextEl.textContent = `The installed skills are v${status.skills}, newer than this app (v${status.app}). Get the new app.`;
      versionBtn.hidden = true;
    } else {
      versionTextEl.textContent = `Skills are v${status.skills}, this app is v${status.app}`;
      versionBtn.hidden = false;
    }
    versionEl.hidden = false;
  } catch {
    // No version to compare is no reason to nag.
  }
}

versionBtn.onclick = async () => {
  versionBtn.disabled = true;
  versionRestartBtn.hidden = true;
  versionTextEl.textContent = 'Updating Plan2Code...';
  const progress = new Channel();
  progress.onmessage = (line) => {
    if (line) versionTextEl.textContent = line;
  };
  try {
    const outcome = await invoke('update_skills', { progress });
    versionTextEl.textContent = outcome.status.mismatch
      ? `Updated, but the mismatch remains (skills v${outcome.status.skills}, app v${outcome.status.app}).`
      : 'Updated. Restart the console to use the new version.';
    versionBtn.hidden = true;
    versionRestartBtn.hidden = outcome.status.mismatch;
  } catch (error) {
    versionTextEl.textContent = String(error);
    versionBtn.disabled = false;
  }
};

versionRestartBtn.onclick = async () => {
  versionRestartBtn.disabled = true;
  try {
    await invoke('console_stop');
  } catch {
    // Nothing to stop is fine: reconnectConsole starts a fresh one either way.
  }
  versionEl.hidden = true;
  await reconnectConsole();
};

// A page the agent's `console.mjs open` asked this window to show.
const pageLabel = (workflow) => (workflow || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

function showAnnounced(notice) {
  restarting = false;
  currentPageEl.textContent = pageLabel(notice.workflow);
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

function markConsoleAlive() {
  consoleStatusEl.textContent = '';
  consoleAgainBtn.hidden = true;
}

function markConsoleDead() {
  consoleStatusEl.textContent = 'The console stopped.';
  consoleAgainBtn.hidden = false;
}

consoleAgainBtn.onclick = () => reconnectConsole();

function setProjectDir(dir) {
  projectDirEl.textContent = dir;
  projectDirEl.title = dir;
}

// The state `main()` read at startup: `pickFolder()` and the first-run
// checklist both need it once a folder lands, after the fact.
let appState = null;

// Opens the OS folder picker. A cancelled pick (or a failed one) lands on the
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
// it carries over. Picking nothing (cancelled) leaves the current project as
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
    currentPageEl.textContent = '';
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

changeProjectBtn.onclick = changeProject;

// The launcher passed `--agent`: start it at once, on its model, with the
// same bypass flags the terminal launcher itself always runs that agent with
// (it offers no permission-mode choice of its own).
async function autoStartAgent(state) {
  launchAgentEl.value = state.autoStart;
  if (typeof state.launchModel === 'string' && state.launchModel) launchModelEl.value = state.launchModel;
  agentStatusEl.textContent = '';
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
      onOutput: agentChannel,
    });
    terminal.focus();
  } catch (error) {
    agentStatusEl.textContent = `Could not start the agent: ${error}`;
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
  if (AGENT_LABELS[state.lastAgent]) launchAgentEl.value = state.lastAgent;
  if (typeof state.launchModel === 'string' && state.launchModel) launchModelEl.value = state.launchModel;
  if (Number.isInteger(state.contextNudgePercent)) nudgePercent = state.contextNudgePercent;
  if (state.termPanel) {
    paneDock = state.termPanel.dock === 'right' ? 'right' : 'bottom';
    paneFraction = state.termPanel.fraction;
    paneCollapsed = Boolean(state.termPanel.collapsed);
  }
  applyPaneLayout();
  await loadAgentAvailability();
  refreshLaunchCard();
  setInterval(pollMeter, METER_POLL_MS);
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
