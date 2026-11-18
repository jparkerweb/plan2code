// The terminal panel: an xterm instance. It knows nothing about agents; the
// page decides what goes in and where the keystrokes and size changes go.
// Needs xterm.js and addon-fit.js loaded first (they set window.Terminal and
// window.FitAddon), and withGlobalTauri for window.__TAURI__.

import { TERMINAL_FONT_DEFAULT, clipboardAction, hexToRgba, terminalAnsi, terminalFontStep } from './meter.js';

// The same platform test app.js uses for its shortcuts.
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

const { invoke } = window.__TAURI__.core;

// A token's value as the page resolves it now (the theme and highlight are
// custom properties on <html>), or `fallback` when it is not set.
function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// The xterm theme from the shell's tokens: panel and ink for the screen, the
// highlight for the cursor and selection, and the theme's own ANSI palette.
function buildTheme() {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const accent = token('--accent', '#619fe5');
  return {
    ...terminalAnsi(theme),
    background: token('--panel', theme === 'light' ? '#ffffff' : '#201d1a'),
    foreground: token('--ink', theme === 'light' ? '#1d1a17' : '#f0ece5'),
    cursor: accent,
    cursorAccent: token('--panel', theme === 'light' ? '#ffffff' : '#201d1a'),
    selectionBackground: hexToRgba(accent, 0.35),
  };
}

// `onLink(uri)` opens a link the agent printed (the shell hands it to the opener, http and https
// only); `onShortcut(event)` is true when the shell took the key (meter.js shortcutAction);
// `copyOnSelect` is the saved preference and `onCopyOnSelect(on)` saves a change to it.
export async function mountTerminal(container, { onInput, onResize, onFontSize, onLink, onShortcut, copyOnSelect = false, onCopyOnSelect }) {
  // Windows' pseudo-terminal rewraps lines itself; xterm needs to know the
  // backend and build to cope with that.
  const platform = await invoke('platform_info');
  const windowsPty = platform.os === 'windows'
    ? { backend: 'conpty', buildNumber: platform.windowsBuild }
    : undefined;

  const term = new window.Terminal({
    cursorBlink: true,
    // The console's own mono stack, so the terminal and the page read as one.
    fontFamily: token('--mono', 'Consolas, Menlo, "DejaVu Sans Mono", monospace'),
    fontSize: TERMINAL_FONT_DEFAULT,
    theme: buildTheme(),
    // An agent written for a dark screen can print colors that vanish on white.
    minimumContrastRatio: 4.5,
    scrollback: 5000,
    windowsPty,
  });
  const fit = new window.FitAddon.FitAddon();
  term.loadAddon(fit);
  // URLs an agent prints become links; a click opens them through the shell's opener.
  if (window.WebLinksAddon && onLink) {
    term.loadAddon(new window.WebLinksAddon.WebLinksAddon((event, uri) => {
      event.preventDefault();
      onLink(uri);
    }));
  }
  term.open(container);
  fit.fit();

  // Keystrokes and pasted text go on as typed.
  term.onData((data) => onInput(data));

  // A size change in the page becomes a size change in the pseudo-terminal.
  // The window's own resize event and the container's ResizeObserver both
  // fire for the same change, and a drag can fire either one many times a
  // second: `fit.fit()` stays immediate (cheap, local, keeps the screen
  // looking right as it happens), but the pty resize call is debounced to
  // one, on the settled size, so xterm and the pty always end up agreeing.
  const RESIZE_DEBOUNCE_MS = 100;
  let resizeTimer = null;
  const refit = () => {
    fit.fit();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      onResize(term.cols, term.rows);
    }, RESIZE_DEBOUNCE_MS);
  };
  window.addEventListener('resize', refit);
  new ResizeObserver(refit).observe(container);

  // A new text size: refit at once, so the pty is told the new columns and rows.
  function setFontSize(size) {
    if (term.options.fontSize === size) return;
    term.options.fontSize = size;
    refit();
  }

  // Copy on selection is a preference (off on Windows and macOS, on for Linux by default: the
  // Rust side's serde default): an unconditional copy replaced whatever the person had copied.
  let copyOnSelectOn = Boolean(copyOnSelect);
  term.onSelectionChange(() => {
    if (!copyOnSelectOn) return;
    const text = term.getSelection();
    if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  });

  function copySelection() {
    const text = term.getSelection();
    if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }
  // Paste goes through term.paste(): bracketed when the agent asked for it, one write, and a
  // multi-line paste lands as a paste, not as typed lines.
  function pasteClipboard() {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) term.paste(text);
      })
      .catch(() => {});
  }

  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;
    // Ctrl or Cmd with plus, minus or 0 zooms the text; the keys never reach the agent.
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const size = terminalFontStep(event.key, term.options.fontSize);
      if (size !== null) {
        setFontSize(size);
        if (onFontSize) onFontSize(size);
        return false;
      }
    }
    // The shell's own shortcuts (meter.js SHORTCUTS) never reach the agent.
    if (onShortcut && onShortcut(event)) {
      event.preventDefault();
      return false;
    }
    // Ctrl+C copies while text is selected and is the interrupt otherwise (the Windows Terminal
    // rule; on a Mac it is always the interrupt); Ctrl+Shift+C and Cmd+C always copy.
    // preventDefault on the paste keys: the browser's own paste event would otherwise reach the
    // terminal a second time.
    const action = clipboardAction(event, term.hasSelection(), { mac: IS_MAC });
    if (action === 'copy') {
      copySelection();
      // A plain Ctrl+C that copied clears the selection (as Windows Terminal does), so the next
      // Ctrl+C is the interrupt again instead of copying the same text over and over.
      if (event.ctrlKey && !event.shiftKey) term.clearSelection();
      event.preventDefault();
      return false;
    }
    if (action === 'paste') {
      event.preventDefault();
      pasteClipboard();
      return false;
    }
    return true;
  });

  // A small right-click menu: Copy, Paste, Clear, and the copy-on-select switch.
  const menu = document.getElementById('term-menu');
  if (menu) {
    wireContextMenu(container, menu, {
      hasSelection: () => term.hasSelection(),
      copy: copySelection,
      paste: pasteClipboard,
      clear: () => term.clear(),
      copyOnSelect: () => copyOnSelectOn,
      toggleCopyOnSelect: () => {
        copyOnSelectOn = !copyOnSelectOn;
        if (onCopyOnSelect) onCopyOnSelect(copyOnSelectOn);
      },
      focus: () => term.focus(),
    });
  }

  return {
    size: () => ({ cols: term.cols, rows: term.rows }),
    // A fresh agent starts on a clean screen.
    reset() {
      term.reset();
      fit.fit();
    },
    write: (data) => term.write(data),
    focus: () => term.focus(),
    setFontSize,
    setCopyOnSelect(on) {
      copyOnSelectOn = Boolean(on);
    },
    paste: pasteClipboard,
    // Rebuilds the colors and the font from the tokens as they are now: called
    // whenever the console says the theme or highlight changed.
    applyTheme() {
      term.options.theme = buildTheme();
      const family = token('--mono', '');
      if (family && term.options.fontFamily !== family) {
        term.options.fontFamily = family;
        refit();
      }
    },
  };
}

// The context menu: Copy, Paste, Clear and the copy-on-select switch. It opens at the pointer,
// closes on a press elsewhere, Escape, a resize or a blur, and takes focus on its first enabled row.
function wireContextMenu(container, menu, actions) {
  const close = () => {
    menu.hidden = true;
  };
  const open = (x, y) => {
    const rows = [
      ['Copy', actions.hasSelection(), actions.copy],
      ['Paste', true, actions.paste],
      ['Clear', true, actions.clear],
    ];
    menu.replaceChildren();
    for (const [label, enabled, run] of rows) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = label;
      button.disabled = !enabled;
      button.onclick = () => {
        close();
        run();
        actions.focus();
      };
      menu.append(button);
    }
    menu.append(document.createElement('hr'));
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('role', 'menuitemcheckbox');
    toggle.setAttribute('aria-checked', String(actions.copyOnSelect()));
    const state = document.createElement('span');
    state.className = 'term-menu-key';
    state.textContent = actions.copyOnSelect() ? 'On' : 'Off';
    toggle.append('Copy when I select', state);
    toggle.onclick = () => {
      close();
      actions.toggleCopyOnSelect();
      actions.focus();
    };
    menu.append(toggle);
    menu.hidden = false;
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - menu.offsetWidth - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - menu.offsetHeight - 4))}px`;
    const first = [...menu.querySelectorAll('button')].find((b) => !b.disabled);
    if (first) first.focus();
  };
  container.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    open(event.clientX, event.clientY);
  });
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('button')].filter((b) => !b.disabled);
    const at = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      actions.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(at + step + items.length) % items.length].focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) close();
  });
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
}
