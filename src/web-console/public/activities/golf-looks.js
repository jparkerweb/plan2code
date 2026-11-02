// Plan2Code Web Console - mini golf's course looks: how each newer course is drawn, by theme id.
//
// Pirate Cove and the Caves of Doom are drawn by golf-draw.js and
// golf-decor.js themselves; every other course brings a look, its own file
// golf-look-<id>.js, listed here under its course's id (the holes' theme).
// golf-draw.js and golf-decor.js ask the hole's look first and fall back to
// their own drawing for anything it leaves out. Drawing only, like them: a
// look keeps no state, draws in course units, and moves only with the
// round's clock (never Math.random()), so a paused frame stays still. Its
// helpers come from golf-paint.js.
//
// A look is { palette, liquids?, grounds?, rough?, tunnel?, lights?,
// bumpers?, movers?, spinners?, gates?, wells?, decor? }:
//   palette   the course's colors, laid over Pirate Cove's (THEMES in
//             golf-draw.js names every key): rough, roughMark, foam, shore,
//             turf, stripe, sand, speckle, ice, iceLine, wall, wallTop,
//             slope, arrow, bridge, plank, spinner, hub, portalA, portalB,
//             cup, flag, flagMark, pad, spy, banner, bannerLine, bannerInk,
//             bannerRound, and dark (0 for none, up to 0.8 for a cave's dark
//             round the ball), thickWalls and portals (true for swirling
//             tunnel mouths)
//   liquids   { <name>: { fill, ripple, glow, still?, bubbles? } }: the
//             look's own kinds of water (see LIQUIDS in golf-draw.js)
//   grounds   { <name>(ctx, p, course) }: fills the whole course box with a
//             ground cover; the outline is already its clip
//   rough(ctx, p, course)  marks over the backdrop beyond the green, after
//             it is filled with p.rough
//   tunnel(ctx, p, mouth, k, i, clock, r)  one tunnel mouth: k is 0 or 1
//             for its two ends, i the tunnel's place in the hole's list
//   lights(v) the glows a dark course adds round what it lights, as
//             [{ x, y, r, color }] (v is the frame's view)
//   bumpers, movers, spinners, gates, wells
//             { <look>(ctx, p, thing, clock) }: a prop's look by the name in
//             its `look` (or "default" for one with none). A bumper and a
//             mover are { x, y, r }; a spinner is its bar { x1, y1, x2, y2 }
//             through its center { x, y }; a gate is its wall plus `shut` and
//             `phase`, 0 to 1 through its period (`open` is where it shuts);
//             a well is { x, y, r, pull }
//   decor     { <kind>: { layer, light?, draw(ctx, p, d, clock) } }: scenery
//             as in golf-decor.js's DECOR: layer "low" (under the walls),
//             "high" (over the ball) or "glow" (over a dark course's dark),
//             and light { r, color } for the glow it casts in the dark

import dino from "./golf-look-dino.js";
import candy from "./golf-look-candy.js";
import space from "./golf-look-space.js";
import frost from "./golf-look-frost.js";

export const LOOKS = Object.freeze({ dino, candy, space, frost });
