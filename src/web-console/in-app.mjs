// The desktop app's signal to an agent it runs: when the agent's own process
// carries these variables, `open` shows its page inside the app window instead
// of the system browser. Unset (every plain terminal), nothing here does anything.
//
//   PLAN2CODE_IN_APP        "1" turns it on
//   PLAN2CODE_CONSOLE_SID   (optional) a session to fall back on when the app cannot be asked
//   PLAN2CODE_APP_ANNOUNCE  this window's loopback URL to tell about a page
//   PLAN2CODE_APP_TOKEN     the token that URL wants
//
// Every value belongs to one app window, so two windows never meet.

import http from "node:http";

/** The signal, or null outside the app. */
export function inAppSignal(env = process.env) {
  if (env.PLAN2CODE_IN_APP !== "1") return null;
  return {
    sid: env.PLAN2CODE_CONSOLE_SID || "",
    announce: env.PLAN2CODE_APP_ANNOUNCE || "",
    token: env.PLAN2CODE_APP_TOKEN || "",
  };
}

function request(signal, method, path, body, timeoutMs) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(path, signal.announce);
    } catch {
      return resolve(null);
    }
    if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname)) {
      return resolve(null);
    }
    const headers = { "x-plan2code-token": signal.token };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(body);
    }
    const req = http.request(target, { method, timeout: timeoutMs, headers }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end(body);
  });
}

/**
 * The session the app's window shows right now, asked of the app: an agent's
 * environment is fixed when it starts, the window's session is not. "" when the
 * app has nothing to show yet or cannot be reached.
 */
export async function currentSession(signal, timeoutMs = 1500) {
  const res = await request(signal, "GET", "/session", undefined, timeoutMs);
  if (!res || res.status !== 200) return "";
  try {
    return String(JSON.parse(res.text)?.sid || "");
  } catch {
    return "";
  }
}

/**
 * Tell the app which page to show. Resolves true when the app answered 2xx,
 * false on any failure (no app listening, wrong token, a timeout): the caller
 * says so and prints the URL, it never falls back to a browser.
 */
export async function announcePage(signal, page, timeoutMs = 1500) {
  const res = await request(signal, "POST", "/page", JSON.stringify(page), timeoutMs);
  return Boolean(res && res.status >= 200 && res.status < 300);
}
