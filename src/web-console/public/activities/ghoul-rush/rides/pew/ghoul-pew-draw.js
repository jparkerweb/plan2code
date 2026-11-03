// Plan2Code Web Console - Ghoul Rush's Holy Roller, its drawing: the Chapel's runaway pew seen from behind, an endless-runner down the nave in three lanes. The whole field is drawn by this ride's own art (`field`, in pseudo-3D by ghoul-pew-world.js) the way the Carnival's dark ride draws its gallery; ghoul-draw.js hands it the frame and then draws the hearts, the cards, the banner and the HUD pills on top.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain data;
// pewArt(d) takes ghoul-draw.js's drawing helpers (`d`) and hands back the pack the usual way plus `field`, so
// this file never reaches back into it (it reads only the rules' numbers from ghoul-pew.js). Everything of
// the ride's own is read off `round.runner` (see ghoul-pew.js) and the room's `ride`; the events leave
// short-lived bits in the view's `fx` (floats, bursts and rings in field units, y counted up from the field's bottom).

import { SOUL_SHARE, V0, V_MAX, soulShare, soulTotal } from "./ghoul-pew.js";
import { HOR, LW, worldArt } from "./ghoul-pew-world.js";

const freeze = (o) => Object.freeze(o);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const look = (o) => freeze({ pack: "pew", custom: true, noMoon: true, pit: "#07040c", ...o });
export const LOOKS = freeze({
  pew: look({ wallTop: "#0c0816", wallLow: "#1c1230", paper: "#2a1c40", wainscot: "#1a1020", floorTop: "#6a6070", floor: "#2e2834", floorEdge: "#0c0a10", shelf: "#4a3220", shelfTop: "#8a6440", window: "#d8a0f0", decor: "pews", color: "#f0c870", dark: 0.3 }),
});

// How each new kind sounds, by act (the sounds in ghoul-sfx-pew.js).
export const VOICES = freeze({
  pew: freeze({
    lane: "ghoulPewLane", bump: "ghoulPewBump", jump: "ghoulPewJump", land: "ghoulPewLand", slide: "ghoulPewSlide", dive: "ghoulPewDive",
    soul: "ghoulPewSoul", halo: "ghoulPewHalo", crash: "ghoulPewCrash", check: "ghoulPewCheck", finish: "ghoulPewFinish", speed: "ghoulPewSpeed",
  }),
  pewgarg: freeze({ warn: "ghoulPewGargWarn", drop: "ghoulPewGargDrop", chip: "ghoulPewGargChip", hit: "ghoulPewGargHit" }),
  pewbell: freeze({ ring: "ghoulPewBell" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  pewLane: ["pew", "lane"],
  pewBump: ["pew", "bump"],
  pewJump: ["pew", "jump"],
  pewLand: ["pew", "land"],
  pewSlide: ["pew", "slide"],
  pewDive: ["pew", "dive"],
  pewSoul: ["pew", "soul"],
  pewHalo: ["pew", "halo"],
  pewCrash: ["pew", "crash"],
  pewCheck: ["pew", "check"],
  pewFinish: ["pew", "finish"],
  pewSpeed: ["pew", "speed"],
  pewGargWarn: ["pewgarg", "warn"],
  pewGargDrop: ["pewgarg", "drop"],
  pewGargChip: ["pewgarg", "chip"],
  pewGargHit: ["pewgarg", "hit"],
  pewBell: ["pewbell", "ring"],
});
export const LOSE_WORDS = freeze({
  pewPillar: "Ran into a pillar", pewConfessional: "Into a confessional", pewCrosswise: "Crashed into a pew", pewKneeler: "Tripped on a kneeler",
  pewCandle: "Hit a candle stand", pewFlagstone: "Cracked on a flagstone", pewHatch: "Fell down a crypt hatch", pewCenser: "Censer to the head",
  pewBanner: "Banner to the face", pewBeam: "Struck by a beam", pewGargoyle: "Flattened by a gargoyle",
});
export const LOSE_SOUNDS = freeze({
  pewPillar: ["thud", 0.55, 0.8],
  pewConfessional: ["thud", 0.5, 0.9],
  pewCrosswise: ["thud", 0.5, 1],
  pewKneeler: ["thud", 0.5, 1.1],
  pewCandle: ["clank", 0.5, 1.1],
  pewFlagstone: ["ghoulRockLand", 0.5, 0.9],
  pewHatch: ["ghoulPitFall", 0.55, 1],
  pewCenser: ["clank", 0.5, 0.8],
  pewBanner: ["thud", 0.4, 1.2],
  pewBeam: ["smash", 0.5, 0.8],
  pewGargoyle: ["crunch", 0.55, 0.7],
});

// The progress track along the field's top: the ride, its checkpoints and where the pew is.
export const BAR = freeze({ x0: 22, x1: 74, y: 3 });

export function pewArt(d) {
  const { label, GOLD, say } = d;
  const world = worldArt(d);
  const pewOf = (round) => (round && round.runner && round.runner.id === "pew" ? round.runner : null);

  // The still layers never draw this room (the field is the ride's), so they only get the nave's dark.
  function backdrop(ctx, v, lk, x0, x1) {
    ctx.fillStyle = lk.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  const ground = () => {};
  const shelf = () => {};
  const lights = () => {};
  const dim = () => 0;

  /* ----------------------------------------------------------- the frame */

  // The whole field: the nave in pseudo-3D, the ride's own HUD strip, then the effects the events left.
  function field(ctx, v) {
    const { round, g } = v;
    const c = pewOf(round);
    if (!c) return;
    const R = round.spec.ride;
    const you = round.you;
    ctx.save();
    if (v.shake) ctx.translate(v.shake.x * 0.6, v.shake.y * 0.6);
    world.paint(ctx, v);
    ctx.restore();
    const Y = (y) => g.FIELD_H - y;
    // The progress track with its checkpoints and the pew on it.
    const { x0, x1, y } = BAR;
    const p = clamp((you.x - round.spec.start) / (R.finish - round.spec.start), 0, 1);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#05060f";
    ctx.fillRect(x0 - 0.6, y - 0.9, x1 - x0 + 1.2, 1.8);
    ctx.globalAlpha = 1;
    const speedK = clamp((c.v - V0) / (V_MAX - V0), 0, 1);
    ctx.fillStyle = speedK > 0.66 ? "#ff8a4a" : speedK > 0.33 ? "#ffd36a" : "#7fd0ff";
    ctx.fillRect(x0, y - 0.45, (x1 - x0) * p, 0.9);
    for (const cx of R.checks) {
      const k = (cx - round.spec.start) / (R.finish - round.spec.start);
      ctx.fillStyle = cx <= you.x ? "#7dffa0" : "#cdbfe6";
      ctx.fillRect(x0 + (x1 - x0) * k - 0.15, y - 1.1, 0.3, 2.2);
    }
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * p, y, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Souls on the left, the combo on the right.
    label(ctx, `SOULS ${c.got}/${soulTotal(R)}`, 3, 6.2, 2, soulShare(R, c) >= SOUL_SHARE ? "#7dffa0" : "#f0e8d8", "left");
    if (c.combo > 1) {
      const pop = 1 + Math.max(0, 1 - (v.fx.clock - (v.fx.pewPop || -1e4)) / 220) * 0.3;
      label(ctx, `x${c.mult}  ${c.combo} IN A ROW`, g.FIELD_W - 3, 6.4, 2.1 * pop, c.mult > 1 ? GOLD : "#f0e8d8", "right");
    }
    if (c.magnet > 0) label(ctx, "HALO", g.FIELD_W - 3, 9.6, 1.7, "#ffd75a", "right");
    // Floats, bursts and rings that events left (field units, y up).
    for (const q of v.fx.parts) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, Y(q.y) - q.size / 2, q.size, q.size);
    }
    for (const r of v.fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 0.5 * (1 - k) + 0.15;
      ctx.beginPath();
      ctx.arc(r.x, Y(r.y), r.r0 + k * r.grow, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Where the pew is on the screen (x) and a height over its feet (y up from the field's bottom).
  const heroX = (lane) => 48 + (lane - 1) * 0.45 * LW;

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE (a soul's tick climbs with the combo).
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    if ((e.type === "pewSlide" || e.type === "pewLane") && !gateOnce(fx, `${e.type}Ms`, 90)) return true;
    if (e.type === "pewSoul") tone(VOICES.pew.soul, 0.28, 1 + 0.05 * Math.min(12, (e.combo || 1) - 1) + 0.12 * ((e.mult || 1) - 1));
    else say(tone, voice[0], voice[1], e.type === "pewSpeed" ? 0.4 : 0.5);
    const x = heroX(e.lane === undefined ? 1 : e.lane);
    const fy = 54 - 36;
    switch (e.type) {
      case "pewJump":
        burst(x, 54 - 6, "#b89a78", 5, 7, 300);
        break;
      case "pewLand":
        burst(x, 54 - 7, "#b0a4b8", e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(180, 0.5);
        break;
      case "pewBump":
        shake(160, 0.5);
        burst(x + (e.dir || 0) * 5, 54 - 14, "#cfd2e6", 5, 6, 260);
        break;
      case "pewSoul":
        burst(heroX(e.lane), fy - (e.h || 1.5) * 2, "#ffd36a", 2, 5, 240);
        if (e.up) {
          fx.pewPop = fx.clock;
          ring(48, 54 - 22, "#ffd36a", 1, 9, 500);
          float(48, 54 - 14, `Combo x${e.mult}`, GOLD, 2.6);
        }
        break;
      case "pewHalo":
        ring(48, 54 - 24, "#ffd75a", 1, 14, 600);
        float(48, 54 - 16, "Halo!", GOLD, 2.6);
        break;
      case "pewCrash":
        shake(340, 1);
        flash("#ffe0a8", 220);
        burst(x, 54 - 16, e.what === "garg" ? "#8a96bc" : "#8a5a36", 18, 17, 520);
        if (e.lost > 5) float(48, 54 - 16, "Combo lost", "#cdbfe6", 2);
        break;
      case "pewCheck":
        float(48, 54 - 34, "Checkpoint", GOLD, 2.4);
        ring(48, 54 - 30, "#7dffa0", 1, 10, 500);
        break;
      case "pewFinish":
        shake(260, 0.7);
        burst(48, 54 - 24, "#ffd36a", 24, 14, 600);
        float(48, 54 - 30, e.share >= SOUL_SHARE ? "Amen! A full choir" : "Amen!", GOLD, 2.8);
        break;
      case "pewSpeed":
        ring(48, 54 - HOR, "#9ab0ff", 4, 40, 520);
        float(48, 54 - 40, "Faster!", "#ffb02e", 2.2);
        break;
      case "pewGargWarn":
        shake(120, 0.25);
        break;
      case "pewGargDrop":
        shake(200, 0.55);
        burst(heroX(e.lane), 54 - 22, "#8a96bc", 10, 9, 420);
        break;
      case "pewGargChip":
        burst(heroX(e.lane), 54 - 24, "#8a96bc", 6, 8, 300);
        break;
      case "pewGargHit":
        burst(heroX(e.lane), 54 - 24, "#8a96bc", 14, 14, 480);
        float(heroX(e.lane), 54 - 28, `+${e.points}`, GOLD, 2.2);
        break;
      case "pewBell":
        ring(heroX(e.lane), 54 - 26, "#ffd36a", 1, 14, 700);
        float(48, 54 - 30, e.stunned > 0 ? `+${e.points} Stunned!` : `+${e.points}`, GOLD, 2.4);
        break;
      default:
        break;
    }
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    dim,
    monsters: freeze({}),
    bosses: freeze({}),
    missiles: freeze({}),
    hazards: freeze({}),
    powers: freeze({}),
    lights,
    react,
    field,
  });
}
