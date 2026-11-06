// Plan2Code Web Console - Ghoul Rush's generic monsters, their drawing: the zombie and its kin, the huntsman, crawler, bat, ghost, skeleton, gourdling, hellhound, widow, wraith and spitter, and the two missiles they throw (a bone, a glob of acid).
//
// ghoul-draw.js plugs it in. monsterArt(d) takes ghoul-draw.js's own drawing
// helpers (`d`: ellipse, circle, line, rotate, turned, eye and the colors) and
// hands back one drawer per kind, `(ctx, v, m, x, y, t, flash)`, plus
// `drawBoneShape` and `drawGlob`, the way the stage packs' art does, so this
// file never reaches back into it. Everything is drawn in room units, y turned
// the right way up, from a view ghoul.js refills; anything that moves follows
// the view's clock, never Math.random().

export function monsterArt(d) {
  const { ellipse, circle, line, rotate, turned, eye, FLASH, BLOOD, BLOOD_DARK, ACID, BONE, EYE_RED, EYE_AMBER, EYE_PALE, EYE_SICK } = d;

  /* ----------------------------------------------------------- monsters */

  // A zombie: gaunt and hunched, torn shirt black with old blood, ribs showing,
  // the jaw hanging; it sprints bent nearly double once you are close.
  function drawZombie(ctx, v, m, x, y, t, flash) {
    const sprint = m.lurching;
    const lean = (sprint ? 0.34 : 0.12) * m.dir;
    const step = Math.sin(t / (sprint ? 55 : 150));
    const skin = flash ? FLASH : "#5d6b55";
    const d = m.dir;
    ctx.save();
    ctx.translate(x, y);
    rotate(ctx, lean);
    ctx.lineCap = "round";
    // Legs, one dragging.
    ctx.strokeStyle = flash ? FLASH : "#1c1814";
    ctx.lineWidth = 0.55;
    line(ctx, -0.5, -1.8, -0.5 + step * 0.6, 0);
    line(ctx, 0.5, -1.8, 0.6 - step * 0.3, -0.1);
    // Torso: a shirt in rags.
    ctx.fillStyle = flash ? FLASH : "#26211d";
    ctx.beginPath();
    ctx.moveTo(-1.2, -3.9);
    ctx.lineTo(1.2, -3.9);
    ctx.lineTo(1.1, -1.7);
    for (let k = 0; k <= 4; k++) ctx.lineTo(1.1 - k * 0.55, -1.7 + (k % 2 ? 0.45 : 0));
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = BLOOD_DARK;
      ellipse(ctx, 0.3 * d, -2.6, 0.65, 0.85);
      ctx.fill();
      ctx.strokeStyle = "#8a826e";
      ctx.lineWidth = 0.1;
      for (const k of [-3.2, -2.8, -2.4]) line(ctx, -0.8 * d, k, -0.1 * d, k + 0.1);
    }
    // Arms reaching, long fingers.
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.4;
    if (m.lift > 0.5 || m.scale) {
      // Climbing a pile or a wall: both arms up, clawing at the air.
      const claw = Math.sin(t / 90) * 0.5;
      line(ctx, d * 0.7, -3.6, d * (0.9 + claw * 0.4), -6.4);
      line(ctx, -d * 0.4, -3.5, -d * (0.5 - claw * 0.4), -6.1);
    } else {
      const reach = d * (2.7 + Math.sin(t / 130) * 0.3);
      line(ctx, d * 0.8, -3.5, reach, -3.7 + step * 0.2);
      line(ctx, d * 0.3, -3.2, reach - d * 0.4, -3.0 - step * 0.2);
      ctx.lineWidth = 0.12;
      for (const k of [-0.25, 0, 0.25]) {
        line(ctx, reach, -3.7 + step * 0.2, reach + d * 0.55, -3.7 + step * 0.2 + k);
        line(ctx, reach - d * 0.4, -3.0 - step * 0.2, reach + d * 0.1, -3.0 - step * 0.2 + k);
      }
    }
    // Head, lolling, the jaw open.
    ctx.fillStyle = skin;
    ellipse(ctx, d * 0.25, -4.6, 0.95, 1.1, 0.25 * d);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#3a4434";
      ellipse(ctx, -d * 0.35, -5.1, 0.45, 0.3);
      ctx.fill();
      ctx.fillStyle = "#0a0806";
      ellipse(ctx, d * 0.05, -4.85, 0.26, 0.3);
      ctx.fill();
      ellipse(ctx, d * 0.65, -4.85, 0.26, 0.3);
      ctx.fill();
      ctx.fillStyle = "#120404";
      ellipse(ctx, d * 0.4, -3.9, 0.4, 0.34 + 0.12 * Math.abs(Math.sin(t / 200)));
      ctx.fill();
      ctx.fillStyle = "#b8ae94";
      for (const k of [-0.2, 0, 0.2]) ctx.fillRect(d * 0.4 + k - 0.05, -4.2, 0.1, 0.15);
    }
    ctx.lineCap = "butt";
    ctx.restore();
    for (const ex of [0.05, 0.65]) {
      const [px, py] = turned(x, y, d * ex, -4.85, lean);
      eye(v, px, py, 0.09, EYE_RED);
    }
  }

  // A crawler: no legs left, dragging itself along on its arms.
  function drawCrawler(ctx, v, m, x, y, t, flash, g) {
    const d = m.dir;
    if (m.rise > 0) {
      // Coming up: the boards jump, a hand claws through.
      const p = 1 - m.rise / g.RISE_MS;
      ctx.fillStyle = "#1a1008";
      for (const k of [-1.4, 0, 1.4]) ctx.fillRect(x + k - 0.6, y - 0.6 - Math.abs(Math.sin(t / 40 + k)) * 0.7, 1.2, 0.4);
      ctx.strokeStyle = "#5d6b55";
      ctx.lineWidth = 0.4;
      line(ctx, x, y, x, y - p * 2.4);
      for (const k of [-0.45, -0.15, 0.15, 0.45]) line(ctx, x, y - p * 2.4, x + k, y - p * 2.4 - 0.6);
      return;
    }
    const step = Math.sin(t / 60);
    const skin = flash ? FLASH : "#55634d";
    // What it leaves behind.
    if (!flash) {
      ctx.strokeStyle = BLOOD;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(x - d * 1.4, y - 0.6);
      ctx.quadraticCurveTo(x - d * 2.4, y - 0.1 + step * 0.2, x - d * 3, y - 0.05);
      ctx.stroke();
    }
    ctx.fillStyle = skin;
    ellipse(ctx, x - d * 0.3, y - 0.9, 1.5, 0.7);
    ctx.fill();
    if (!flash) {
      ctx.strokeStyle = "#2c3426";
      ctx.lineWidth = 0.15;
      line(ctx, x - d * 1.6, y - 1.2, x + d * 0.8, y - 1.4);
    }
    // Arms hauling it forward.
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.35;
    ctx.lineCap = "round";
    for (const s of [0, Math.PI]) {
      const reach = Math.sin(t / 60 + s);
      ctx.beginPath();
      ctx.moveTo(x + d * 0.6, y - 1.1);
      ctx.lineTo(x + d * (1.3 + reach * 0.2), y - 1.9 - Math.max(0, reach) * 0.3);
      ctx.lineTo(x + d * (2.1 + reach * 0.5), y);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.fillStyle = skin;
    circle(ctx, x + d * 1.1, y - 1.6, 0.75);
    ctx.fill();
    ctx.fillStyle = "#0a0806";
    circle(ctx, x + d * 1.4, y - 1.3, 0.25);
    ctx.fill();
    eye(v, x + d * 1.05, y - 1.75, 0.08, EYE_RED);
    eye(v, x + d * 1.45, y - 1.75, 0.08, EYE_RED);
  }

  // A dark flyer's moonlit edge (the bat's, the wraith's; the Graveyard's
  // crow has its own), so its whole shape shows against a dark room: the
  // path stroked wide and faint before it is filled, so only the outer half of
  // the stroke shows past the fill.
  const RIM = "#a9b4cc";
  const RIM_ALPHA = 0.43;
  const RIM_W = 0.22;
  function rim(ctx) {
    ctx.save();
    ctx.globalAlpha = RIM_ALPHA;
    ctx.strokeStyle = RIM;
    ctx.lineWidth = RIM_W * 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  // A bat: black leather and finger bones, red eyes. Roosting, it hangs
  // wrapped in its wings, eyes shut. Its rim is laid first, under all of it.
  function drawBat(ctx, v, m, x, y, t, flash) {
    const body = flash ? FLASH : "#1e161c";
    if (!m.awake) {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(x, y - 2.2);
      ctx.quadraticCurveTo(x + 1, y - 1.2, x, y);
      ctx.quadraticCurveTo(x - 1, y - 1.2, x, y - 2.2);
      if (!flash) rim(ctx);
      ctx.fill();
      ctx.strokeStyle = body;
      ctx.lineWidth = 0.15;
      line(ctx, x - 0.2, y - 2.2, x - 0.2, y - 2.7);
      line(ctx, x + 0.2, y - 2.2, x + 0.2, y - 2.7);
      return;
    }
    const flap = Math.sin(t / 40);
    const wing = (s) => {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y - 0.9);
      ctx.lineTo(x + s * 1.6, y - 1.4 - flap * 1.2);
      ctx.lineTo(x + s * 2.7, y - 0.8 - flap * 1.3);
      ctx.lineTo(x + s * 2.2, y - 0.4 - flap * 0.5);
      ctx.lineTo(x + s * 1.7, y - 0.6 - flap * 0.3);
      ctx.lineTo(x + s * 1.2, y - 0.3);
      ctx.closePath();
    };
    const ears = () => {
      ctx.beginPath();
      ctx.moveTo(x - 0.5, y - 1.3);
      ctx.lineTo(x - 0.4, y - 2);
      ctx.lineTo(x - 0.1, y - 1.45);
      ctx.moveTo(x + 0.5, y - 1.3);
      ctx.lineTo(x + 0.4, y - 2);
      ctx.lineTo(x + 0.1, y - 1.45);
    };
    if (!flash) {
      for (const s of [-1, 1]) {
        wing(s);
        rim(ctx);
      }
      ellipse(ctx, x, y - 0.8, 0.75, 0.7);
      rim(ctx);
      ears();
      rim(ctx);
    }
    ctx.fillStyle = flash ? FLASH : "#140f14";
    for (const s of [-1, 1]) {
      wing(s);
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = "#3a2a30";
        ctx.lineWidth = 0.08;
        line(ctx, x + s * 0.6, y - 0.9, x + s * 2.7, y - 0.8 - flap * 1.3);
        line(ctx, x + s * 1.6, y - 1.4 - flap * 1.2, x + s * 1.7, y - 0.6 - flap * 0.3);
      }
    }
    ctx.fillStyle = body;
    ellipse(ctx, x, y - 0.8, 0.75, 0.7);
    ctx.fill();
    ears();
    ctx.fill();
    ctx.fillStyle = "#e8e0d0";
    ctx.fillRect(x - 0.22, y - 0.45, 0.1, 0.28);
    ctx.fillRect(x + 0.12, y - 0.45, 0.1, 0.28);
    eye(v, x - 0.28 + m.dir * 0.1, y - 0.95, 0.12, EYE_RED);
    eye(v, x + 0.28 + m.dir * 0.1, y - 0.95, 0.12, EYE_RED);
  }

  // A ghost: a long pale shape trailing to nothing, eyes hollow, the mouth
  // stretched in a scream it never stops.
  function drawGhost(ctx, v, m, x, y, t, flash) {
    const sight = v.ghostSight(m);
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * sight * 0.68;
    const bob = Math.sin(t / 300) * 0.3;
    const jit = sight > 0.9 && Math.floor(t / 70) % 9 === 0 ? 0.3 : 0;
    const cx = x + jit;
    ctx.fillStyle = flash ? FLASH : "#cfe3e6";
    ctx.beginPath();
    ctx.moveTo(cx - 1.4, y - 1.4 + bob);
    ctx.quadraticCurveTo(cx - 1.8, y - 3.4 + bob, cx, y - 4.4 + bob);
    ctx.quadraticCurveTo(cx + 1.8, y - 3.4 + bob, cx + 1.4, y - 1.4 + bob);
    for (let k = 0; k < 5; k++) {
      const wx = cx + 1.4 - (k + 0.5) * 0.56;
      ctx.quadraticCurveTo(wx + Math.sin(t / 110 + k) * 0.3, y + 0.6 + (k % 2) * 0.5 + bob, wx - 0.28, y - 0.9 + bob);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = was * sight * 0.35;
    ctx.strokeStyle = "#cfe3e6";
    ctx.lineWidth = 0.15;
    for (const s of [-1, 1]) line(ctx, cx + s * 1.2, y - 2.6 + bob, cx + s * 2.2, y - 1.6 + bob + Math.sin(t / 160 + s) * 0.4);
    ctx.globalAlpha = was * sight * 0.95;
    ctx.fillStyle = "#000000";
    ellipse(ctx, cx - 0.5 + m.dir * 0.15, y - 3.2 + bob, 0.3, 0.45);
    ctx.fill();
    ellipse(ctx, cx + 0.5 + m.dir * 0.15, y - 3.2 + bob, 0.3, 0.45);
    ctx.fill();
    ellipse(ctx, cx + m.dir * 0.15, y - 2 + bob, 0.32, 0.6 + Math.abs(Math.sin(t / 240)) * 0.2);
    ctx.fill();
    ctx.globalAlpha = was;
  }

  // A bone, spinning: a shaft with a knob at each end.
  function drawBoneShape(ctx, x, y, spin, size = 1) {
    ctx.save();
    ctx.translate(x, y);
    rotate(ctx, spin);
    ctx.fillStyle = BONE;
    ctx.fillRect(-0.9 * size, -0.18 * size, 1.8 * size, 0.36 * size);
    for (const s of [-1, 1]) {
      circle(ctx, s * 0.9 * size, -0.22 * size, 0.28 * size);
      ctx.fill();
      circle(ctx, s * 0.9 * size, 0.22 * size, 0.28 * size);
      ctx.fill();
    }
    ctx.restore();
  }

  // A glob of acid in flight, dripping.
  function drawGlob(ctx, x, y, clock) {
    ctx.fillStyle = "#4a6a10";
    ellipse(ctx, x, y, 0.8, 0.7);
    ctx.fill();
    ctx.fillStyle = ACID;
    ellipse(ctx, x - 0.15, y - 0.15, 0.55, 0.5);
    ctx.fill();
    ctx.fillRect(x - 0.1, y + 0.6, 0.2, 0.4 + Math.abs(Math.sin(clock / 90)) * 0.3);
  }

  function drawSkeleton(ctx, v, m, x, y, t, flash) {
    const ink = flash ? FLASH : BONE;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.35;
    ctx.lineCap = "round";
    line(ctx, x - 0.5, y - 2, x - 0.6, y);
    line(ctx, x + 0.5, y - 2, x + 0.6, y);
    // Spine and ribs.
    line(ctx, x, y - 2, x, y - 4);
    for (const k of [-3.6, -3.1, -2.6]) line(ctx, x - 0.9, y + k, x + 0.9, y + k);
    ctx.fillStyle = ink;
    ellipse(ctx, x, y - 1.9, 0.9, 0.35);
    ctx.fill();
    // Arms: one raised with a bone while it winds up.
    const up = m.windup > 0;
    line(ctx, x + m.dir * 0.8, y - 3.9, x + m.dir * 1.6, y - (up ? 5.6 : 2.6));
    line(ctx, x - m.dir * 0.8, y - 3.9, x - m.dir * 1.3, y - 2.6 + Math.sin(t / 300) * 0.2);
    if (up) drawBoneShape(ctx, x + m.dir * 1.7, y - 6, t / 80, 0.7);
    ctx.lineCap = "butt";
    // Skull.
    circle(ctx, x, y - 4.8, 0.95);
    ctx.fill();
    ctx.fillRect(x - 0.55, y - 4.3, 1.1, 0.6);
    ctx.fillStyle = "#0a0806";
    circle(ctx, x - 0.4 + m.dir * 0.15, y - 4.9, 0.3);
    ctx.fill();
    circle(ctx, x + 0.4 + m.dir * 0.15, y - 4.9, 0.3);
    ctx.fill();
    ctx.fillRect(x - 0.4, y - 4.05, 0.8, 0.12);
    eye(v, x - 0.4 + m.dir * 0.15, y - 4.9, up ? 0.13 : 0.1, up ? "#ff6a2a" : EYE_RED);
    eye(v, x + 0.4 + m.dir * 0.15, y - 4.9, up ? 0.13 : 0.1, up ? "#ff6a2a" : EYE_RED);
  }

  // A gourdling: a little rotten pumpkin on twig legs, fire in its face.
  function drawGourdling(ctx, v, m, x, y, t, flash) {
    const step = Math.sin(t / 50);
    ctx.strokeStyle = "#1e2a10";
    ctx.lineWidth = 0.3;
    line(ctx, x - 0.5, y - 0.6, x - 0.5 + step * 0.3, y);
    line(ctx, x + 0.5, y - 0.6, x + 0.5 - step * 0.3, y);
    ctx.fillStyle = flash ? FLASH : "#8a4a12";
    ellipse(ctx, x, y - 1.2, 1.1, 0.85);
    ctx.fill();
    ctx.fillStyle = "#3a1e08";
    ellipse(ctx, x - 0.5, y - 0.8, 0.35, 0.25);
    ctx.fill();
    ctx.fillStyle = "#1e2a10";
    ctx.fillRect(x - 0.1, y - 2.4, 0.2, 0.45);
    for (const s of [-1, 1]) eye(v, x + s * 0.45 + m.dir * 0.15, y - 1.35, 0.17, EYE_AMBER);
  }

  // A hellhound: a starved black dog, ribs and spines, eyes like coals. It
  // slinks low before it lunges, and stretches out in the air.
  function drawHound(ctx, v, m, x, y, t, flash) {
    const d = m.dir;
    const crouch = m.act === "crouch";
    const leap = m.act === "leap";
    const body = flash ? FLASH : "#3a1814";
    const low = crouch ? 0.7 : 0;
    const run = m.act === "prowl" ? Math.sin(t / 50) : 0;
    const tilt = leap ? -0.25 * d * Math.sign(m.vy || 1) : crouch ? 0.12 * d : 0;
    ctx.strokeStyle = body;
    ctx.lineWidth = 0.38;
    ctx.lineCap = "round";
    if (leap) {
      line(ctx, x + d * 1.1, y - 1.6, x + d * 2.4, y - 1.0);
      line(ctx, x + d * 0.8, y - 1.5, x + d * 2.2, y - 0.6);
      line(ctx, x - d * 1.1, y - 1.6, x - d * 2.3, y - 1.1);
      line(ctx, x - d * 0.8, y - 1.5, x - d * 2.1, y - 0.7);
    } else {
      for (const [lx, ph] of [[1.1, 0], [0.7, Math.PI], [-0.8, Math.PI / 2], [-1.2, -Math.PI / 2]]) {
        const swing = Math.sin(t / 50 + ph) * (run ? 0.6 : 0);
        line(ctx, x + d * lx, y - 1.4 + low, x + d * (lx + swing), y);
      }
    }
    // Body: lean, the ribs showing, spines down its back.
    ctx.fillStyle = body;
    ellipse(ctx, x, y - 1.7 + low, 1.8, 0.72, tilt);
    ctx.fill();
    if (!flash) {
      ctx.strokeStyle = "#7a3a2c";
      ctx.lineWidth = 0.1;
      for (const k of [-0.5, 0, 0.5]) line(ctx, x + k, y - 2.1 + low, x + k - d * 0.2, y - 1.3 + low);
      ctx.fillStyle = "#5a1a10";
      for (const k of [-1.1, -0.5, 0.1, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(x + k - 0.2, y - 2.3 + low);
        ctx.lineTo(x + k + d * 0.2, y - 2.9 + low);
        ctx.lineTo(x + k + 0.2, y - 2.3 + low);
        ctx.fill();
      }
    }
    // The tail, whipping.
    ctx.strokeStyle = body;
    ctx.lineWidth = 0.25;
    line(ctx, x - d * 1.7, y - 1.9 + low, x - d * 2.6, y - 2.4 + low + Math.sin(t / 90) * 0.4);
    // Head: a long skull of a snout, the jaw open to lunge.
    const hx = x + d * 2.0;
    const hy = y - 2.1 + low * 1.3;
    ctx.fillStyle = body;
    ellipse(ctx, hx, hy, 0.7, 0.55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + d * 0.4, hy - 0.35);
    ctx.lineTo(hx + d * 1.4, hy + 0.05);
    ctx.lineTo(hx + d * 0.4, hy + 0.3);
    ctx.fill();
    if (crouch || leap) {
      ctx.beginPath();
      ctx.moveTo(hx + d * 0.3, hy + 0.3);
      ctx.lineTo(hx + d * 1.2, hy + 0.85);
      ctx.lineTo(hx + d * 0.2, hy + 0.55);
      ctx.fill();
      ctx.fillStyle = "#e8e0d0";
      for (const k of [0.6, 0.9]) ctx.fillRect(hx + d * k - 0.05, hy + 0.2, 0.1, 0.25);
    }
    ctx.beginPath();
    ctx.moveTo(hx - d * 0.3, hy - 0.4);
    ctx.lineTo(hx - d * 0.5, hy - 1.2);
    ctx.lineTo(hx, hy - 0.5);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineCap = "butt";
    eye(v, hx + d * 0.25, hy - 0.15, crouch ? 0.2 : 0.14, EYE_AMBER);
  }

  // A widow: a black body the size of a dog, a red hourglass, eight legs. It
  // hangs on a thread from the ceiling until it drops.
  // A Runner is a zombie worn to a rake, a Glutton one swollen twice as wide
  // with its belly hanging out: the zombie, drawn squeezed or stretched.
  function drawZombieKin(ctx, v, m, x, y, t, flash) {
    const fat = m.kind === "glutton";
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fat ? 1.6 : 0.72, fat ? 1.08 : 1.04);
    drawZombie(ctx, v, m, 0, 0, t, flash);
    if (fat) {
      const d = m.dir;
      ctx.fillStyle = flash ? FLASH : "#6b7a60";
      ellipse(ctx, d * 0.35, -2.5, 1.15, 1.1);
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = "#3a4434";
        ctx.lineWidth = 0.1;
        line(ctx, d * 0.5, -2.6, d * 0.65, -2.4);
        ctx.fillStyle = BLOOD_DARK;
        ellipse(ctx, d * 0.1, -2.1, 0.3, 0.2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // A Huntsman: a widow's shape half as big again, hairy brown and banded,
  // running on the floor rather than hanging from the ceiling.
  function drawHuntsman(ctx, v, m, x, y, t, flash) {
    ctx.save();
    ctx.translate(x, y + (m.act === "crouch" ? 0.3 : 0));
    ctx.scale(1.5, m.act === "crouch" ? 1.15 : 1.4);
    drawSpider(ctx, v, m, 0, 0, t, flash);
    ctx.restore();
  }

  function drawSpider(ctx, v, m, x, y, t, flash) {
    const d = m.dir;
    const hunter = m.kind === "huntsman";
    const body = flash ? FLASH : hunter ? "#4e3a20" : "#120e12";
    if (!hunter && m.act !== "walk") {
      ctx.strokeStyle = "rgba(220, 220, 230, 0.45)";
      ctx.lineWidth = 0.08;
      line(ctx, x, 0, x, y - 1.8);
    }
    const walking = hunter ? m.act !== "leap" : m.act === "walk";
    ctx.strokeStyle = body;
    ctx.lineWidth = 0.18;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const ph = Math.sin(t / 45 + k * 1.6 + (s > 0 ? 0 : Math.PI)) * (walking ? 0.4 : 0.1);
        const kx = x + s * (0.2 + k * 0.25);
        const knee = walking ? y - 2.2 - k * 0.1 : y - 2.6;
        ctx.beginPath();
        ctx.moveTo(kx, y - 1.1);
        ctx.lineTo(kx + s * (1 + k * 0.2) + ph, knee);
        ctx.lineTo(kx + s * (1.6 + k * 0.45) + ph * 1.4, walking ? y : y - 0.6);
        ctx.stroke();
      }
    }
    ctx.fillStyle = body;
    ellipse(ctx, x - d * 0.6, y - 1.25, 1.2, 0.95);
    ctx.fill();
    ellipse(ctx, x + d * 0.7, y - 1.0, 0.65, 0.55);
    ctx.fill();
    if (!flash && hunter) {
      // Pale bands across its back.
      ctx.strokeStyle = "#b09068";
      ctx.lineWidth = 0.12;
      for (const k of [-0.5, 0, 0.5]) line(ctx, x - d * 0.6 + k, y - 2.05, x - d * 0.6 + k * 1.1, y - 0.6);
    } else if (!flash) {
      ctx.fillStyle = "#9a0a0a";
      ctx.beginPath();
      ctx.moveTo(x - d * 0.6 - 0.3, y - 1.75);
      ctx.lineTo(x - d * 0.6 + 0.3, y - 1.75);
      ctx.lineTo(x - d * 0.6, y - 1.3);
      ctx.lineTo(x - d * 0.6 + 0.3, y - 0.85);
      ctx.lineTo(x - d * 0.6 - 0.3, y - 0.85);
      ctx.lineTo(x - d * 0.6, y - 1.3);
      ctx.closePath();
      ctx.fill();
    }
    for (const [ex, ey, r] of [[0.85, -1.2, 0.11], [1.1, -1.1, 0.09], [0.75, -0.95, 0.07], [1.05, -0.9, 0.07]]) eye(v, x + d * ex, y + ey, r, EYE_RED);
  }

  // A wraith: a tattered hooded shroud with nothing inside but two cold eyes,
  // a faint rim around it (as a bat's). It shivers and gapes before it dives,
  // bony hands out.
  function drawWraith(ctx, v, m, x, y, t, flash) {
    if (m.act === "idle") return;
    const wind = m.act === "wind";
    const dive = m.act === "dive";
    const d = m.dir;
    const shiver = wind ? Math.sin(t / 18) * 0.25 : 0;
    ctx.save();
    ctx.translate(x + shiver, y);
    if (dive) rotate(ctx, Math.max(-0.7, Math.min(0.7, Math.atan2(-m.vy, Math.abs(m.vx) || 1) * d)));
    ctx.fillStyle = flash ? FLASH : "rgba(34, 40, 54, 0.94)";
    ctx.beginPath();
    ctx.moveTo(-1.4, -1.6);
    ctx.quadraticCurveTo(-1.5, -4.6, 0, -4.6);
    ctx.quadraticCurveTo(1.5, -4.6, 1.4, -1.6);
    for (let k = 0; k < 6; k++) {
      const sx = 1.4 - (k + 0.5) * (2.8 / 6);
      ctx.lineTo(sx + Math.sin(t / 100 + k) * 0.25 - d * (dive ? 0.8 : 0), 0.4 + (k % 2) * 0.9 + Math.sin(t / 130 + k * 2) * 0.3);
      ctx.lineTo(sx - 0.2, -0.8);
    }
    ctx.closePath();
    if (!flash) rim(ctx);
    ctx.fill();
    ctx.fillStyle = "#020204";
    ellipse(ctx, d * 0.25, -3.4, 0.75, 0.85);
    ctx.fill();
    if (wind || dive) {
      ctx.fillStyle = "#000000";
      ellipse(ctx, d * 0.3, -2.7, 0.3, 0.55);
      ctx.fill();
      ctx.strokeStyle = flash ? FLASH : "#9fb2c4";
      ctx.lineWidth = 0.16;
      for (const s of [-0.3, 0.3]) {
        line(ctx, d * 0.6, -2.4 + s, d * 2.2, -2.6 + s * 2);
        for (const f of [-0.25, 0, 0.25]) line(ctx, d * 2.2, -2.6 + s * 2, d * 2.8, -2.6 + s * 2 + f);
      }
    }
    ctx.restore();
    const big = wind ? 0.12 : 0.09;
    const color = wind ? "#e8f8ff" : EYE_PALE;
    eye(v, x + shiver + d * 0.0, y - 3.5, big, color);
    eye(v, x + shiver + d * 0.5, y - 3.5, big, color);
  }

  // A bloater: a swollen, veined body on stumps, swelling before it spits.
  function drawSpitter(ctx, v, m, x, y, t, flash, g) {
    const d = m.dir;
    const swell = m.windup > 0 ? 1 - m.windup / g.SPIT_WINDUP_MS : 0;
    const s = 1 + swell * 0.2 + Math.sin(t / 300) * 0.03;
    const skin = flash ? FLASH : "#7a8460";
    ctx.strokeStyle = flash ? FLASH : "#4a5038";
    ctx.lineWidth = 0.55;
    const step = Math.sin(t / 200) * 0.3;
    line(ctx, x - 0.8, y - 1.0, x - 0.8 + step, y);
    line(ctx, x + 0.8, y - 1.0, x + 0.8 - step, y);
    ctx.fillStyle = skin;
    ellipse(ctx, x, y - 2.4, 2.0 * s, 2.0 * s);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ellipse(ctx, x, y - 1.6, 1.8 * s, 1.1 * s);
      ctx.fill();
      ctx.strokeStyle = "#4a2a3a";
      ctx.lineWidth = 0.1;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x - 1.2 + k * 0.7, y - 3.8 * s + 1);
        ctx.quadraticCurveTo(x - 0.8 + k * 0.6, y - 2.6, x - 1.4 + k * 0.9, y - 1.2);
        ctx.stroke();
      }
      ctx.fillStyle = "#c8d06a";
      for (const [px, py, r] of [[-0.9, -3.2, 0.3], [0.7, -2.0, 0.25], [-0.2, -1.4, 0.2], [1.1, -3.4, 0.2]]) {
        circle(ctx, x + px * s, y + py * s, r);
        ctx.fill();
      }
    }
    // The head, small on all that, and its mouth, drooling.
    const hx = x + d * 0.6;
    const hy = y - 4.2 * s - 0.2;
    ctx.fillStyle = skin;
    ellipse(ctx, hx, hy, 0.75, 0.65);
    ctx.fill();
    ctx.fillStyle = "#1a2008";
    ellipse(ctx, hx + d * 0.35, hy + 0.25, 0.3, 0.2 + swell * 0.25);
    ctx.fill();
    ctx.fillStyle = ACID;
    ctx.fillRect(hx + d * 0.35 - 0.06, hy + 0.4, 0.12, 0.5 + swell * 0.9 + Math.abs(Math.sin(t / 150)) * 0.3);
    eye(v, hx + d * 0.05, hy - 0.2, 0.11, EYE_SICK);
    eye(v, hx + d * 0.45, hy - 0.2, 0.11, EYE_SICK);
  }

  return { drawZombie, drawZombieKin, drawHuntsman, drawCrawler, drawBat, drawGhost, drawSkeleton, drawHound, drawSpider, drawWraith, drawSpitter, drawGourdling, drawBoneShape, drawGlob };
}
