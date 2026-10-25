// Plan2Code Web Console - the few messages this page sends the desktop app that frames it; defines only.
//
// Each one is a named request with no free text in it, so the app decides what
// it does: a page can ask for "continue" to be typed, never for anything else.

/** True inside a frame: the desktop app's window, the only place that frames this page. */
export function framed() {
  return Boolean(window.parent) && window.parent !== window;
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
