// Plan2Code Web Console - hands an http or https link to the person's default browser, for the page inside the desktop app; defines only.
//
// The app's webview opens no new windows, so a link the page shows there (Open
// pull request, a link in a doc, the feedback button) would do nothing. The
// page posts it to /open-link instead, and this opens it. Never through a
// shell: the link is the page's to name, so it travels as one argument to a
// program that only opens links.

import { spawn } from "node:child_process";

/** The link to open, normalized, or null when it is not a plain http or https link. */
export function linkToOpen(raw) {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
}

/** Opens `href` (from linkToOpen) in the default browser; false when it could not start one. */
export function openLink(href) {
  return launch(href, process.env.BROWSER);
}

/**
 * Opens a local file the server already checked (an absolute path, such as a
 * saved prototype's .html) with the system's default handler for its type,
 * which for a web page is the default browser; false when nothing started.
 */
export function openFile(file) {
  if (typeof file !== "string" || !file) return false;
  return launch(file, null);
}

// The system's own opener, handed one target as one argument, never a shell.
function launch(target, linuxOpener) {
  // Tests, and a person who turned the console's own browser launches off.
  if (process.env.NO_BROWSER || process.env.PLAN2CODE_NO_BROWSER) return true;
  const [cmd, args] =
    process.platform === "win32"
      ? ["rundll32.exe", ["url.dll,FileProtocolHandler", target]]
      : process.platform === "darwin"
        ? ["open", [target]]
        : [linuxOpener || "xdg-open", [target]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
