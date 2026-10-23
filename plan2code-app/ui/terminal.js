// The terminal panel: an xterm instance. It knows nothing about agents; the
// page decides what goes in and where the keystrokes and size changes go.
// Needs xterm.js and addon-fit.js loaded first (they set window.Terminal and
// window.FitAddon), and withGlobalTauri for window.__TAURI__.

const { invoke } = window.__TAURI__.core;

export async function mountTerminal(container, { onInput, onResize }) {
  // Windows' pseudo-terminal rewraps lines itself; xterm needs to know the
  // backend and build to cope with that.
  const platform = await invoke('platform_info');
  const windowsPty = platform.os === 'windows'
    ? { backend: 'conpty', buildNumber: platform.windowsBuild }
    : undefined;

  const term = new window.Terminal({
    cursorBlink: true,
    fontFamily: 'Consolas, Menlo, "DejaVu Sans Mono", monospace',
    fontSize: 13,
    scrollback: 5000,
    windowsPty,
  });
  const fit = new window.FitAddon.FitAddon();
  term.loadAddon(fit);
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

  // Copy on selection, and an explicit shortcut for it: Ctrl+C is the pty's
  // own interrupt, so Ctrl+Shift+C (Windows, Linux) or Cmd+C (macOS) copies
  // instead, without being typed. Ctrl+V / Cmd+V paste from the clipboard
  // explicitly, rather than depending on the hidden textarea's own native
  // paste making it through every webview the same way.
  term.onSelectionChange(() => {
    const text = term.getSelection();
    if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  });
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown' || !navigator.clipboard) return true;
    const key = event.key.toLowerCase();
    if (key === 'c' && ((event.ctrlKey && event.shiftKey) || (event.metaKey && !event.ctrlKey))) {
      const text = term.getSelection();
      if (text) navigator.clipboard.writeText(text).catch(() => {});
      return false;
    }
    if (key === 'v' && (event.ctrlKey || event.metaKey)) {
      navigator.clipboard
        .readText()
        .then((text) => {
          if (text) onInput(text);
        })
        .catch(() => {});
      return false;
    }
    return true;
  });

  return {
    size: () => ({ cols: term.cols, rows: term.rows }),
    // A fresh agent starts on a clean screen.
    reset() {
      term.reset();
      fit.fit();
    },
    write: (data) => term.write(data),
    focus: () => term.focus(),
  };
}
