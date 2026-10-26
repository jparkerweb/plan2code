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

/** Post `message` to the frame's parent, as `{ plan2code: kind, ...extra }`; nothing outside a frame. */
export function tellApp(kind, extra = {}) {
  if (!framed()) return;
  try {
    window.parent.postMessage({ ...extra, plan2code: kind }, "*");
  } catch {
    /* no parent to tell */
  }
}
