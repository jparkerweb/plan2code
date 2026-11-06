// Plan2Code Web Console - the one button that wakes a quiet agent.
//
// Under the desktop app the agent's terminal is in the same window, so a press
// asks the app to type "continue" there (the app types that word and nothing
// else). A browser cannot reach a terminal, so those spots say what to type.

import { page } from "./state.js";
import { tellApp } from "./app-bridge.js";
import { el } from "./render.js";

// Held off for a few seconds after a press, so a double press does not send it twice.
const CONTINUE_HOLD_MS = 4000;

// Kept here, not on the button: a screen that redraws builds a fresh button,
// which must still be held off for the rest of the four seconds.
let heldUntil = 0;

/**
 * A button asking the app to type continue into the agent's terminal. `label`
 * is the button's words; the status line keeps its own small key look, the Ask
 * tab and the waiting screens say "Reconnect to agent".
 */
export function continueButton(label = "continue", cls = "agent-key agent-key-btn") {
  const btn = el("button", cls, label);
  btn.type = "button";
  btn.disabled = Date.now() < heldUntil;
  btn.title = "Type continue in the agent's terminal";
  btn.addEventListener("click", () => {
    btn.disabled = true;
    heldUntil = Date.now() + CONTINUE_HOLD_MS;
    tellApp("agent-continue");
    setTimeout(() => (btn.disabled = false), CONTINUE_HOLD_MS);
  });
  return btn;
}

/**
 * What a spot with no agent to talk to offers: the button under the app, and
 * under a browser a line telling the person to type continue in their terminal.
 * Null when there is nothing to offer.
 */
export function reconnectOffer(cls = "reconnect-offer") {
  if (page.inApp) return continueButton("Reconnect to agent", "btn small " + cls);
  const note = el("p", cls + " help");
  note.appendChild(document.createTextNode("To wake the agent, type "));
  note.appendChild(el("strong", "agent-key", "continue"));
  note.appendChild(document.createTextNode(" in your terminal."));
  return note;
}
