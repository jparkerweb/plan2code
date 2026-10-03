// Planny's wake-up on a freshly opened dashboard: he sits powered down centre
// stage until the first click or key, gets nudged awake (he rocks side to side
// for one snore), then about five seconds of him powering on, then a glide
// into the rail as the menu comes in.
//
// The beats before the glide are pure CSS (keyframes on delays under
// `.wake.booting`, see app.css). The glide is the one part CSS cannot know on
// its own, because it ends wherever the rail's Planny sits right now, so this
// measures it once and hands CSS a single transform through --wake-glide.
//
// No DOM access at module scope, so `node --test` can import it.

// When the glide starts, and when the run is over at the latest. The CSS
// delays are the beats before GLIDE_AT_MS; the glide itself is 0.6 s.
export const GLIDE_AT_MS = 4300;
export const DONE_AT_MS = 5000;

// Plays the wake-up and resolves `{ skipped }` once the dashboard is fully
// awake. He waits powered down until the first click or key anywhere, which
// nudges him (`.stirring`) and calls `stir()` -- the page's cue to play one
// full snore, since a browser only lets a page make noise after a real click
// or keypress. The boot starts once the promise `stir()` returns settles (at
// once without one), and calls `onStart()`, the page's cue for the boot-up
// sound. `onGlide({ instant })` is the page's cue to bring the menu in: called
// at the glide, or with `instant: true` if the run ends before one (a skip).
// From the nudge on, clicks and keys are swallowed, so the run always plays
// out to the end with its sound; only `skipEl` (the muted Skip button, or the
// Escape key, for anyone without a mouse) and `signal` aborting (the page
// leaving the dashboard, dormant or mid-run) cut it short, as a skip.
// `onSkip` is the page's cue to silence the intro sounds
// once a skip lands. Under reduced motion nothing is shown and it resolves at
// once.
export function playWake({ stage, bot, target, skipEl, stir, onStart, onGlide, onSkip, signal }) {
  return new Promise((resolve) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || signal?.aborted) {
      resolve({ skipped: false });
      return;
    }
    const timers = [];
    let glided = false;
    let over = false;

    const onGlideEnd = (e) => {
      if (e.target === bot && e.propertyName === "transform") end(false);
    };
    const skip = () => end(true);
    // The Skip button's events must reach it: the document handlers below run
    // in the capture phase, ahead of the button's own click.
    const hitsSkip = (e) => Boolean(skipEl && e.target instanceof Node && skipEl.contains(e.target));
    const onSkipClick = () => end(true);
    // Browser and OS shortcuts (reload, tab switch, devtools) still go through;
    // Escape skips, so the run can be left by keyboard too.
    const swallow = (e) => {
      if (hitsSkip(e)) return;
      if (e.key === "Escape") {
        onSkipClick();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
    };

    function glide() {
      glided = true;
      // Measured untransformed, as the sketch's glideToSlot() does: the
      // transform-origin is the drawing's top-left, so the move is the gap
      // between the two top-left corners and the scale is the width ratio.
      // The target's own box, not its bounding rect: the rail's Planny is
      // usually tilted mid-flight, and a tilted box measures wider than he
      // is. Centred on the rect, which the tilt barely moves.
      const from = bot.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const w = target.clientWidth || rect.width;
      const h = target.clientHeight || rect.height;
      const left = rect.left + (rect.width - w) / 2;
      const top = rect.top + (rect.height - h) / 2;
      const scale = from.width ? w / from.width : 1;
      bot.style.setProperty("--wake-glide", `translate(${left - from.left}px, ${top - from.top}px) scale(${scale})`);
      bot.addEventListener("transitionend", onGlideEnd);
      stage.classList.add("gliding");
      onGlide({ instant: false });
    }

    function end(skipped) {
      if (over) return;
      over = true;
      for (const t of timers) clearTimeout(t);
      document.removeEventListener("pointerdown", start, true);
      document.removeEventListener("keydown", start, true);
      document.removeEventListener("pointerdown", swallow, true);
      document.removeEventListener("keydown", swallow, true);
      bot.removeEventListener("transitionend", onGlideEnd);
      signal?.removeEventListener("abort", skip);
      skipEl?.removeEventListener("click", onSkipClick);
      if (skipped) onSkip?.();
      stage.hidden = true;
      stage.classList.remove("dormant", "stirring", "booting", "gliding");
      bot.style.removeProperty("--wake-glide");
      if (!glided) onGlide({ instant: true });
      resolve({ skipped });
    }

    // The waking click is the only input the run takes: from here on every
    // click and key is swallowed until it ends.
    function start(e) {
      if (hitsSkip(e)) return;
      if (e.key === "Escape") {
        onSkipClick();
        return;
      }
      e.preventDefault();
      document.removeEventListener("pointerdown", start, true);
      document.removeEventListener("keydown", start, true);
      stage.classList.replace("dormant", "stirring");
      document.addEventListener("pointerdown", swallow, true);
      document.addEventListener("keydown", swallow, true);
      Promise.resolve(stir?.()).then(boot);
    }

    function boot() {
      if (over) return;
      stage.classList.replace("stirring", "booting");
      onStart?.();
      timers.push(setTimeout(glide, GLIDE_AT_MS));
      // The glide's transitionend normally ends the run a touch earlier; this
      // is the fallback for a transition that never fires (a hidden tab).
      timers.push(setTimeout(() => end(false), DONE_AT_MS));
    }

    document.addEventListener("pointerdown", start, true);
    document.addEventListener("keydown", start, true);
    skipEl?.addEventListener("click", onSkipClick);
    signal?.addEventListener("abort", skip);
    stage.hidden = false;
    stage.classList.add("dormant");
  });
}
