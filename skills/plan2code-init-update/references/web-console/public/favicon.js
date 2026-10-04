// Plan2Code Web Console - the tab icon's status bar.
//
// The favicon follows the status line with a bar along its bottom edge: dashed
// amber while Plan2Code is busy, solid green when it is the person's move,
// solid red when it needs attention, and none (the plain Planny) once the
// session is finished. It reads from the same calls
// renderStatus() already makes for Planny's mood, so the icon and the line
// beside him can never disagree. No DOM access at module scope: `node --test`
// imports this file.

// Planny exactly as public/favicon.svg draws him (a test keeps the two in
// step), minus the <svg> wrapper so the bar can be layered on top.
export const FAVICON_BODY = `<rect x="4" y="4.6" width="24" height="30" rx="5" fill="#fff4ef" stroke="#3b332c" stroke-width="2.2" />
  <path d="M16 9.8 L17.41 13.26 L21.14 13.53 L18.28 15.94 L19.17 19.57 L16 17.6 L12.83 19.57 L13.72 15.94 L10.86 13.53 L14.59 13.26 Z" fill="#ae4f2b" />
  <path d="M11.6 22.2 Q16 26.4 20.4 22.2" fill="none" stroke="#3b332c" stroke-width="1.8" stroke-linecap="round" />`;

// The bar's color per state. `plain` has none.
export const FAVICON_COLORS = Object.freeze({
  busy: "#f5a524",
  ready: "#22c55e",
  attention: "#e5484d",
});

/**
 * Which icon a status line calls for. `mood` and `spin` are what renderStatus()
 * handed to say(): `spin` marks something really happening at the other end
 * right now, so that is busy. A working mood without the spin is the stale
 * line ("has not checked in for a few minutes"), which, like adrift and gone,
 * needs attention. `point` is the person's move. A finished session is plain
 * unless it is visibly busy again (opening the dashboard, starting a review).
 */
export function faviconState({ mood, spin = false, finished = false } = {}) {
  if (spin) return "busy";
  if (finished) return "plain";
  if (mood === "adrift" || mood === "gone" || mood === "work") return "attention";
  if (mood === "point") return "ready";
  return "plain";
}

/**
 * The whole SVG for a state: Planny, plus a bar across the bottom edge, where
 * he is cropped anyway. Busy's bar is dashed on a white strip (a progress bar
 * mid-run) and the others solid, so busy differs by pattern as well as color:
 * amber and green are close to one color for red-green color-blind eyes.
 */
export function faviconSvg(state) {
  const color = FAVICON_COLORS[state];
  let badge = "";
  if (state === "busy") {
    badge = `\n  <rect x="0" y="27" width="32" height="5" fill="#ffffff" />\n  <path d="M1.5 29.5 L30.5 29.5" stroke="${color}" stroke-width="4" stroke-dasharray="4 2.5" />`;
  } else if (color) {
    badge = `\n  <rect x="0" y="27" width="32" height="5" rx="1" fill="${color}" />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  ${FAVICON_BODY}${badge}\n</svg>\n`;
}

let shown = "plain";

/**
 * Point the page's two icon links at `state`'s icon, only when it changed. The
 * SVG link takes the variant as a data URL; the PNG link, for browsers that
 * pick the bitmap, gets the same variant drawn through a canvas. Plain goes
 * back to the served files.
 */
export function setFavicon(state) {
  if (state === shown || typeof document === "undefined") return;
  shown = state;
  const svgLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  const pngLink = document.querySelector('link[rel="icon"][type="image/png"]');
  if (state === "plain") {
    if (svgLink) svgLink.href = "/favicon.svg";
    if (pngLink) pngLink.href = "/favicon.png";
    return;
  }
  const url = "data:image/svg+xml," + encodeURIComponent(faviconSvg(state));
  if (svgLink) svgLink.href = url;
  if (!pngLink) return;
  const img = new Image();
  img.onload = () => {
    // A newer state won the race while this one was loading.
    if (shown !== state) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      canvas.getContext("2d").drawImage(img, 0, 0, 64, 64);
      pngLink.href = canvas.toDataURL("image/png");
    } catch {}
  };
  img.src = url;
}
