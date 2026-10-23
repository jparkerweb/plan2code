// The context meter's pure decisions, kept out of app.js so they can be
// imported and tested without a DOM or `window.__TAURI__` (app.js touches
// both at module scope, the same reason the web console keeps its own pure
// logic in answers.js rather than app.js).

/**
 * Whether `reading` (what the `agent_context` command returns) should fire
 * the Restart nudge at `nudgePercent`. Only a real or best-effort number
 * counts, per the context policy (pathfinder Question 11): an estimate is
 * not precise enough for "about 70%" to mean the window really is close to
 * full, so an estimate-only agent gets the meter but never the nudge.
 */
export function nudgeDue(reading, nudgePercent) {
  return (reading.kind === 'real' || reading.kind === 'besteffort') && reading.percent >= nudgePercent;
}
