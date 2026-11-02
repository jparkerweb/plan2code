// Plan2Code Web Console - the few messages this page sends the desktop app that frames it, and which links it must open another way there; defines only.
//
// Each one is a named request with no free text in it, so the app decides what
// it does: a page can ask for "continue" to be typed, never for anything else.

/** True inside a frame: the desktop app's window, the only place that frames this page. */
export function framed() {
  return Boolean(window.parent) && window.parent !== window;
}

/**
 * True for a link that leaves the console for the web: http or https on
 * another origin. Inside the app those open through /open-link, since the
 * app's window opens no new ones; the console's own files stay put.
 */
export function linkLeavesPage(href, origin) {
  let url;
  try {
    url = new URL(href, origin);
  } catch {
    return false;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== origin;
}

/**
 * Call `handler(data)` for each `{ plan2code: kind, ... }` message the frame's
 * parent sends, and for nothing from anywhere else (another frame, the page
 * itself). The app's only answer today is `taskbar-state`.
 */
export function onAppMessage(kind, handler) {
  window.addEventListener("message", (event) => {
    if (!framed() || event.source !== window.parent) return;
    const data = event.data;
    if (data && typeof data === "object" && data.plan2code === kind) handler(data);
  });
}

/**
 * Hear the app's answers to the Implementation Loop's named requests:
 * `loop-facts` (what agent a loop would use), `loop-start-result`,
 * `loop-notify-test-result` and the three stop-screen results. `store` is the page object and `redraw` its
 * render; they are handed in so this file keeps importing nothing.
 */
export function wireLoopMessages(store, redraw) {
  onAppMessage("loop-facts", (data) => {
    store.loopFacts = data.facts && typeof data.facts === "object" ? data.facts : null;
    redraw();
  });
  onAppMessage("loop-start-result", (data) => {
    // Cancel in the app's confirm: nothing started, so the setup is as it was.
    if (data.ok === true && data.started === false) {
      store.loopStart = null;
      if (store.loopSetup) store.loopSetup.starting = false;
      redraw();
      return;
    }
    store.loopStart = { ok: data.ok === true, error: data.ok === true ? null : String(data.error || "The app did not start the loop.") };
    redraw();
  });
  onAppMessage("loop-notify-test-result", (data) => {
    store.loopNotifyTest = { waiting: false, ok: data.ok === true, sent: data.sent === true, error: data.ok === true ? null : String(data.error || "The app could not send the test.") };
    redraw();
  });
  for (const kind of ["loop-resume-result", "loop-fix-result", "loop-finalize-result"]) {
    onAppMessage(kind, (data) => {
      store.loopAction = { kind, ok: data.ok === true, error: data.ok === true ? null : String(data.error || "The app could not do that.") };
      redraw();
    });
  }
}

/**
 * Ask the app for what its bar's New Session button does, confirm and all.
 * `command`, when there is one, goes on the clipboard first so it can be
 * pasted into the new terminal; a refused copy loses nothing, the page still
 * shows it.
 */
export async function startNewSession(command = "") {
  if (command) {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      /* the command stays on the page to copy by hand */
    }
  }
  tellApp("new-session");
}

/** Post `message` to the frame's parent, as `{ plan2code: kind, ...extra }`; nothing outside a frame. */
export function tellApp(kind, extra = {}) {
  if (!framed()) return;
  try {
    window.parent.postMessage({ ...extra, plan2code: kind }, "*");
  } catch {
    /* no parent to tell */
  }
}
