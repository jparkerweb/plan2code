// Plan2Code Web Console - mini golf's course kit: the helpers every course file builds its holes with.
//
// Data only: no DOM. Every hole is drawn on a fixed course of COURSE_W by
// COURSE_H units, scaled to the board like Snake's fixed grid, so a resize
// never moves a ball. Each course lives in its own golf-course-<id>.js and
// builds its eighteen holes with hole() below; golf-holes.js lists them.
//
// A hole is { name, par, theme, quip, ground, liquid, tee, cup, outline,
// walls, bumpers, sand, ice, water, slopes, wells, bridges, spinners,
// tunnels, movers, gates, powerups, decor }:
//   theme      the course's id: the palette, the lighting and the gags
//   quip       a line shown as the hole starts
//   ground     how the green is drawn: "grass", "deck", "moss" or "stone",
//              or one a theme's look adds (golf-looks.js)
//   liquid     what the water is: "sea", "pool", "lava" or "chasm", or one a
//              theme's look adds (the rule is the same for all of them, a
//              stroke and back where the putt began)
//   tee, cup   points { x, y }
//   outline    the playing area as a polygon; its edges are the course edge,
//              and they lead the walls list
//   walls      line segments { x1, y1, x2, y2 }
//   bumpers    circles { x, y, r, look? } that kick the ball back faster
//   sand       polygons that slow the ball several times over
//   ice        polygons where the ball barely slows at all
//   water      polygons that cost a stroke, unless the ball is on a bridge
//   slopes     { points, push: { x, y }, look? }: a polygon that pushes the
//              ball each moment it is inside, in units per second per second
//              (ramps, currents, updrafts and conveyor belts too)
//   wells      { x, y, r, pull, look? }: a round pull toward (pull > 0) or
//              away from (pull < 0) its center, strongest at the center and
//              gone at r, in units per second per second; a well that pulls
//              in must have water or the cup at its center, so no ball ever
//              comes to rest inside one
//   bridges    rectangles { x, y, w, h }: safe ground over water
//   spinners   { x, y, arm, speed, look? }: a windmill-style bar through its
//              center, arm units each way, turning speed radians a second
//   tunnels    { a, b }: two mouths; entering one sends the ball out of the
//              other with its speed kept
//   movers     { x, y, r, dx, dy, period, phase?, look? }: a bumper that swings
//              dx, dy units each way from x, y, once every period ms
//   gates      { x1, y1, x2, y2, period, open, offset?, look? }: a wall that is
//              there for the last (1 - open) of every period ms
//   powerups   { x, y, kind }: a pad the rolling ball picks up, for its next
//              putt (the kinds are POWERUPS in golf.js)
//   decor      { kind, x, y, s? }: scenery that never touches the ball
// A polygon is a list of points { x, y }.

export const COURSE_W = 400;
export const COURSE_H = 300;

export const pt = (x, y) => ({ x, y });

export const rect = (x, y, w, h) => [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];

export const wall = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });

export const bump = (x, y, r, look) => (look ? { x, y, r, look } : { x, y, r });

export const pad = (x, y, kind) => ({ x, y, kind });

export const deco = (kind, x, y, s = 1) => ({ kind, x, y, s });

// The outline's edges, closing back to its first point.
const edges = (outline) => outline.map((p, i) => {
  const q = outline[(i + 1) % outline.length];
  return wall(p.x, p.y, q.x, q.y);
});

export function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

// Fills the empty lists and puts the outline's edges first among the walls.
// `theme`, `ground` and `liquid` are the course's own defaults; a hole's own
// def wins over them.
export function hole(def, { theme, ground = "grass", liquid = "sea" }) {
  return {
    name: def.name,
    par: def.par,
    theme,
    quip: def.quip || "",
    ground: def.ground || ground,
    liquid: def.liquid || liquid,
    tee: def.tee,
    cup: def.cup,
    outline: def.outline,
    walls: [...edges(def.outline), ...(def.walls || [])],
    bumpers: def.bumpers || [],
    sand: def.sand || [],
    ice: def.ice || [],
    water: def.water || [],
    slopes: def.slopes || [],
    wells: def.wells || [],
    bridges: def.bridges || [],
    spinners: def.spinners || [],
    tunnels: def.tunnels || [],
    movers: def.movers || [],
    gates: def.gates || [],
    powerups: def.powerups || [],
    decor: def.decor || [],
  };
}

// A course: its id (also its holes' theme), its name and card line, its
// voice (what the game says on it, see golf.js), and its eighteen holes, frozen.
// `cover` is the hole the course dashboard draws on its card (0 based).
export function course({ id, name, blurb, cover = 0, voice, holes }) {
  return freezeDeep({ id, name, blurb, cover, voice, holes });
}
