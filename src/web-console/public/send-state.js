// Plan2Code Web Console - whether Send is available, and what its button says; defines only.

import {
  finish,
  stranded,
  agentWorking,
  myTurn,
  stagedCount,
  workingMs,
  patience,
  WORKING_GRACE_MS,
  openItems,
  agentAdrift,
} from "./selectors.js";
import { finishPaused } from "./answers.js";
import { page } from "./state.js";
import { pendingNotes } from "./uploads.js";

export function sendState() {
  // Before `gone`, and before the grace period that can re-enable a send. A
  // finished session has nobody left to send to, whatever the socket says.
  if (finish())
    return finishPaused(finish())
      ? { disabled: true, why: "This session is paused.", short: "Session paused" }
      : { disabled: true, why: "This session is finished.", short: "Session finished" };
  if (page.gone) return { disabled: true, why: "Not connected right now.", short: "Not connected" };
  // A send is still being collected. Blocking here is what keeps someone from
  // writing over answers nobody has read yet.
  if (page.pendingResult) {
    // The server refuses a second submit while one is uncollected, so this
    // stays disabled either way. Only the reason changes, and "one moment" is
    // a promise the page cannot keep once nothing is coming to collect them.
    return stranded()
      ? { disabled: true, why: "Saved, and waiting for Plan2Code to come back for them.", short: "Saved, not picked up" }
      : { disabled: true, why: "Your last answers are on their way. One moment.", short: "" };
  }
  if (agentWorking()) {
    // A question the agent left open while still working is still a question,
    // and its answer has nowhere better to wait than the server, which holds
    // a send until the agent next looks. The contract says to switch to
    // "waiting" before asking, but an agent that asks and carries on ("while
    // you decide") must not lock the person out of answering for up to an
    // hour of quietMinutes.
    if (myTurn().length && (stagedCount() || pendingNotes().length)) {
      return {
        disabled: false,
        why: "Plan2Code is still working. Your answers wait for it to look.",
        short: "Still working · it reads this next",
      };
    }
    const ms = workingMs();
    if (ms > patience(WORKING_GRACE_MS)) {
      // A stuck agent must not lock someone out of their own session, so the
      // hatch stays open -- but only once there is something to push through
      // it. Enabled with an empty payload, Send clicks as a no-op, and the
      // loud styling on a dead button reads as broken rather than available.
      // "A while", not the clock: the footer only redraws on events, so a
      // duration printed here freezes between them, and a frozen number
      // beside "is it stuck?" makes the page look like the thing it is
      // warning about. The exact time already ticks away in the dock.
      if (stagedCount() || pendingNotes().length) {
        return { disabled: false, why: "Plan2Code has been busy a while. You can send anyway.", short: "Busy · send anyway" };
      }
      return openItems().length
        ? {
            disabled: true,
            why: "Plan2Code has been busy a while. Answer something or add a note, and you can send anyway.",
            short: "Busy · a note unlocks Send",
          }
        : { disabled: true, why: "Plan2Code has been busy a while.", short: "Busy a while" };
    }
    return { disabled: true, why: "Wait for Plan2Code to finish.", short: agentAdrift() ? "Gone quiet" : "" };
  }
  if (!stagedCount() && !pendingNotes().length) return { disabled: true, why: "" };
  return { disabled: false, why: "" };
}
