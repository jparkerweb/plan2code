// Plan2Code Web Console - serving the page's own files: the allow-list, types, caching and the accent colors.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { PUBLIC_DIR } from "./files.mjs";
import { ACCENTS, DEFAULT_ACCENT } from "./public/palette.js";

/* ------------------------------------------------------------ mime types */

export const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
};

// A hardcoded allow-list, not a filesystem lookup. Nothing to traverse.
export const SERVABLE = new Set([
  "app.js",
  "answers.js",
  "skills.js",
  "hops.js",
  "spec-states.js",
  "state.js",
  "doc-files.js",
  "send-state.js",
  "mention-box.js",
  "md-field.js",
  "uploads.js",
  "sound.js",
  "looks.js",
  "selectors.js",
  "strengths.js",
  "app.css",
  "render.js",
  "palette.js",
  "labels.js",
  "boot.js",
  "chat.js",
  "help.js",
  "tabs.js",
  "prefs.js",
  "starters.js",
  "workspace.js",
  "meter.js",
  "subagents.js",
  "mentions.js",
  "favicon.js",
  "app-bridge.js",
  "continue-button.js",
  "git-board.js",
  "git-board-view.js",
  "pr-url.js",
  "start-stop.mp3",
  "next.mp3",
  "insert.mp3",
  "sleeping.mp3",
  "bootup.mp3",
  "start-skill.mp3",
  "favicon.svg",
  "favicon.png",
  "screens/core.js",
  "screens/ending.js",
  "screens/loop-setup.js",
  "screens/docs.js",
  "screens/cards.js",
  "screens/starting.js",
  "screens/dashboard.js",
  "screens/git-host.js",
  "screens/looks.js",
  "screens/agents-view.js",
  "screens/agents/agents-data.js",
  "screens/agents/agents-list-editor.js",
  "screens/agents/agents-summary.js",
  "screens/agents/agents-form.js",
  "screens/agents/agents-strengths.js",
  "screens/prefs-dialog.js",
  "screens/cleanup.js",
  "screens/help-dialog.js",
  "screens/workspace.js",
  "screens/ask.js",
  "screens/notepad.js",
  "screens/activities.js",
  "screens/setup.js",
  "activities.js",
  "activities/snake.js",
  "activities/golf.js",
  "activities/golf-holes.js",
  "activities/golf-draw.js",
  "activities/golf-decor.js",
  "activities/golf-kit.js",
  "activities/golf-paint.js",
  "activities/golf-looks.js",
  "activities/golf-course-pirate.js",
  "activities/golf-course-cave.js",
  "activities/golf-course-dino.js",
  "activities/golf-course-candy.js",
  "activities/golf-course-space.js",
  "activities/golf-course-frost.js",
  "activities/golf-look-dino.js",
  "activities/golf-look-candy.js",
  "activities/golf-look-space.js",
  "activities/golf-look-frost.js",
  "activities/trails.js",
  "activities/bugs.js",
  "activities/drive.js",
  "activities/stack.js",
  "activities/bumper.js",
  "activities/bumper-draw.js",
  "activities/rapids.js",
  "activities/rapids-draw.js",
  "activities/flock.js",
  "activities/flock-draw.js",
  "activities/fuse.js",
  "activities/fuse-draw.js",
  "activities/hop.js",
  "activities/hop-draw.js",
  "activities/bounce.js",
  "activities/bounce-draw.js",
  "activities/bounce-roads.js",
  "activities/bounce-road.js",
  "activities/bounce-rivals.js",
  "activities/bounce-scenery.js",
  "activities/bounce-cars.js",
  "activities/ghoul-rush/ghoul.js",
  "activities/ghoul-rush/core/ghoul-tables.js",
  "activities/ghoul-rush/core/ghoul-kit.js",
  "activities/ghoul-rush/core/ghoul-planny.js",
  "activities/ghoul-rush/core/ghoul-monsters.js",
  "activities/ghoul-rush/core/ghoul-fight.js",
  "activities/ghoul-rush/core/ghoul-play.js",
  "activities/ghoul-rush/core/ghoul-window.js",
  "activities/ghoul-rush/draw/ghoul-draw.js",
  "activities/ghoul-rush/core/ghoul-rooms.js",
  "activities/ghoul-rush/stages/wing/ghoul-bones.js",
  "activities/ghoul-rush/stages/wing/ghoul-bones-draw.js",
  "activities/ghoul-rush/stages/graveyard/ghoul-graveyard.js",
  "activities/ghoul-rush/stages/graveyard/ghoul-graveyard-draw.js",
  "activities/ghoul-rush/stages/grounds/ghoul-grounds.js",
  "activities/ghoul-rush/stages/grounds/ghoul-grounds-draw.js",
  "activities/ghoul-rush/stages/chapel/ghoul-chapel.js",
  "activities/ghoul-rush/stages/chapel/ghoul-chapel-draw.js",
  "activities/ghoul-rush/stages/sanatorium/ghoul-sanatorium.js",
  "activities/ghoul-rush/stages/sanatorium/ghoul-sanatorium-draw.js",
  "activities/ghoul-rush/stages/village/ghoul-village.js",
  "activities/ghoul-rush/stages/village/ghoul-village-draw.js",
  "activities/ghoul-rush/stages/village/ghoul-village-world.js",
  "activities/ghoul-rush/stages/village/ghoul-village-wolf.js",
  "activities/ghoul-rush/stages/mine/ghoul-mine.js",
  "activities/ghoul-rush/stages/mine/ghoul-mine-draw.js",
  "activities/ghoul-rush/stages/mine/ghoul-mine-world.js",
  "activities/ghoul-rush/stages/mine/ghoul-mine-tommy.js",
  "activities/ghoul-rush/rides/cart/ghoul-cart.js",
  "activities/ghoul-rush/rides/cart/ghoul-cart-draw.js",
  "activities/ghoul-rush/rides/sled/ghoul-sled.js",
  "activities/ghoul-rush/rides/sled/ghoul-sled-draw.js",
  "activities/ghoul-rush/rides/banister/ghoul-banister.js",
  "activities/ghoul-rush/rides/banister/ghoul-banister-draw.js",
  "activities/ghoul-rush/rides/hearse/ghoul-hearse.js",
  "activities/ghoul-rush/rides/hearse/ghoul-hearse-draw.js",
  "activities/ghoul-rush/rides/wagon/ghoul-wagon.js",
  "activities/ghoul-rush/rides/wagon/ghoul-wagon-draw.js",
  "activities/ghoul-rush/rides/gurney/ghoul-gurney.js",
  "activities/ghoul-rush/rides/gurney/ghoul-gurney-draw.js",
  "activities/ghoul-rush/rides/pew/ghoul-pew.js",
  "activities/ghoul-rush/rides/lantern/ghoul-lantern.js",
  "activities/ghoul-rush/rides/lantern/ghoul-lantern-draw.js",
  "activities/ghoul-rush/rides/pew/ghoul-pew-draw.js",
  "activities/ghoul-rush/rides/pew/ghoul-pew-course.js",
  "activities/ghoul-rush/rides/pew/ghoul-pew-world.js",
  "activities/ghoul-rush/rides/mower/ghoul-mower.js",
  "activities/ghoul-rush/rides/mower/ghoul-mower-draw.js",
  "activities/ghoul-rush/rides/tray/ghoul-tray.js",
  "activities/ghoul-rush/rides/tray/ghoul-tray-draw.js",
  "activities/ghoul-rush/stages/carnival/ghoul-carnival.js",
  "activities/ghoul-rush/stages/carnival/ghoul-carnival-draw.js",
  "activities/ghoul-rush/stages/carnival/ghoul-carnival-world.js",
  "activities/ghoul-rush/stages/frozen/ghoul-frozen.js",
  "activities/ghoul-rush/stages/frozen/ghoul-frozen-draw.js",
  "activities/ghoul-rush/stages/frozen/ghoul-frozen-world.js",
  "activities/ghoul-rush/arms/ghoul-flare.js",
  "activities/ghoul-rush/stages/bog/ghoul-bog.js",
  "activities/ghoul-rush/stages/bog/ghoul-bog-draw.js",
  "activities/ghoul-rush/stages/marrow/ghoul-marrow.js",
  "activities/ghoul-rush/stages/marrow/ghoul-marrow-draw.js",
  "activities/ghoul-rush/rides/mat/ghoul-mat-room.js",
  "activities/ghoul-rush/rides/mat/ghoul-mat.js",
  "activities/ghoul-rush/rides/mat/ghoul-mat-draw.js",
  "activities/ghoul-rush/stages/marrow/ghoul-dollhouse-room.js",
  "activities/ghoul-rush/stages/marrow/ghoul-marrow-eye.js",
  "activities/ghoul-rush/stages/marrow/ghoul-marrow-eye-draw.js",
  "activities/ghoul-rush/rides/bonestair/ghoul-bonestair-room.js",
  "activities/ghoul-rush/rides/bonestair/ghoul-bonestair.js",
  "activities/ghoul-rush/rides/bonestair/ghoul-bonestair-draw.js",
  "activities/ghoul-rush/stages/marrow/ghoul-pit-room.js",
  "activities/ghoul-rush/stages/marrow/ghoul-marrow-heart.js",
  "activities/ghoul-rush/stages/marrow/ghoul-marrow-heart-draw.js",
  "activities/ghoul-rush/story/ghoul-ending.js",
  "activities/ghoul-rush/story/ghoul-ending-draw.js",
  "activities/ghoul-rush/draw/ghoul-picker-draw.js",
  "activities/ghoul-rush/core/ghoul-powers.js",
  "activities/ghoul-rush/arms/ghoul-arms.js",
  "activities/ghoul-rush/arms/ghoul-arms-draw.js",
  "activities/ghoul-rush/arms/ghoul-rockets.js",
  "activities/ghoul-rush/arms/ghoul-rockets-draw.js",
  "activities/ghoul-rush/arms/ghoul-pans.js",
  "activities/ghoul-rush/core/ghoul-run.js",
  "activities/ghoul-rush/core/ghoul-dice.js",
  "activities/ghoul-rush/core/ghoul-dice-draw.js",
  "activities/ghoul-rush/story/ghoul-gameover-draw.js",
  "activities/ghoul-rush/story/ghoul-intros.js",
  "activities/ghoul-rush/story/ghoul-intro-draw.js",
  "activities/ghoul-rush/story/ghoul-boss-intros.js",
  "activities/ghoul-rush/story/ghoul-bossintro-draw.js",
  "activities/ghoul-rush/story/ghoul-story.js",
  "activities/ghoul-rush/story/ghoul-story-draw.js",
  "activities/ghoul-rush/story/ghoul-sfx-story.js",
  "activities/ghoul-rush/core/ghoul-bonus.js",
  "activities/ghoul-rush/core/ghoul-bonus-draw.js",
  "activities/ghoul-rush/draw/ghoul-monsters-draw.js",
  "activities/pills.js",
  "activities/snake-sfx.js",
  "activities/snake-music.js",
  "activities/golf-sfx.js",
  "activities/trails-sfx.js",
  "activities/light-trails/1.mp3",
  "activities/light-trails/2.mp3",
  "activities/light-trails/3.mp3",
  "activities/light-trails/4.mp3",
  "activities/light-trails/5.mp3",
  "activities/flock-dash/1.mp3",
  "activities/flock-dash/2.mp3",
  "activities/flock-dash/3.mp3",
  "activities/flock-dash/4.mp3",
  "activities/flock-dash/5.mp3",
  "activities/bugs-sfx.js",
  "activities/drive-sfx.js",
  "activities/stack-sfx.js",
  "activities/bumper-sfx.js",
  "activities/rapids-sfx.js",
  "activities/flock-sfx.js",
  "activities/fuse-sfx.js",
  "activities/hop-sfx.js",
  "activities/bounce-sfx.js",
  "activities/ghoul-rush/sfx/ghoul-sfx.js",
  "activities/ghoul-rush/stages/graveyard/ghoul-sfx-graveyard.js",
  "activities/ghoul-rush/stages/grounds/ghoul-sfx-grounds.js",
  "activities/ghoul-rush/stages/chapel/ghoul-sfx-chapel.js",
  "activities/ghoul-rush/stages/sanatorium/ghoul-sfx-sanatorium.js",
  "activities/ghoul-rush/stages/village/ghoul-sfx-village.js",
  "activities/ghoul-rush/stages/mine/ghoul-sfx-mine.js",
  "activities/ghoul-rush/stages/carnival/ghoul-sfx-carnival.js",
  "activities/ghoul-rush/stages/frozen/ghoul-sfx-frozen.js",
  "activities/ghoul-rush/rides/sled/ghoul-sfx-sled.js",
  "activities/ghoul-rush/rides/banister/ghoul-sfx-banister.js",
  "activities/ghoul-rush/rides/hearse/ghoul-sfx-hearse.js",
  "activities/ghoul-rush/stages/bog/ghoul-sfx-bog.js",
  "activities/ghoul-rush/stages/marrow/ghoul-sfx-marrow.js",
  "activities/ghoul-rush/stages/marrow/ghoul-sfx-marrow-eye.js",
  "activities/ghoul-rush/stages/marrow/ghoul-sfx-marrow-heart.js",
  "activities/ghoul-rush/rides/mat/ghoul-sfx-mat.js",
  "activities/ghoul-rush/rides/bonestair/ghoul-sfx-bonestair.js",
  "activities/ghoul-rush/story/ghoul-sfx-ending.js",
  "activities/ghoul-rush/rides/wagon/ghoul-sfx-wagon.js",
  "activities/ghoul-rush/rides/gurney/ghoul-sfx-gurney.js",
  "activities/ghoul-rush/rides/pew/ghoul-sfx-pew.js",
  "activities/ghoul-rush/rides/lantern/ghoul-sfx-lantern.js",
  "activities/ghoul-rush/rides/mower/ghoul-sfx-mower.js",
  "activities/ghoul-rush/rides/tray/ghoul-sfx-tray.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-core.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-scenes.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-gfx.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw-kinds.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw-sets.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw-hud.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-ride-voices.js",
  "activities/ghoul-rush/rides/dark-ride/ghoul-sfx-ride.js",
  "activities/ghoul-rush/arms/ghoul-sfx-arms.js",
  "tones.js",
  "music.js",
  "notepad-tabs.js",
  "net.js",
  "notepad.js",
  "notepad-editor.js",
  "notepad-editor.css",
  "md-field.css",
  "vendor/marked.esm.js",
  "vendor/codemirror.esm.js",
]);

/* ------------------------------------------------------------ stylesheet */

// The page asks for one /app.css; it is these files under public/styles/,
// joined in this order, which is the one place the cascade order is stated.
// Layers first, then one file per screen, then responsive and print last so
// its overrides still come after everything they override. The files are not
// on SERVABLE: they reach the page only through /app.css.
export const CSS_ORDER = ["tokens.css", "shell.css", "planny.css", "pieces.css", "dashboard.css", "poses.css", "docs.css", "ask.css", "ending.css", "help.css", "looks.css", "prefs.css", "agents.css", "notepad.css", "activities.css", "git.css", "responsive.css"];

// The files joined with one newline between them (each file's own last newline
// is that one), as the server serves them before the accent rules. The test
// helper joins through this too, so a test can never read a different order.
export function joinedStyles() {
  const parts = CSS_ORDER.map((f) => fs.readFileSync(path.join(PUBLIC_DIR, "styles", f), "utf8").replace(/\n$/, ""));
  return Buffer.from(parts.join("\n") + "\n");
}

/* ---------------------------------------------------------------- assets */

// Read once per server, from memory after that. Held for the server's whole
// life on purpose: a skill reinstalled under a running session must not hand
// one page a new app.js beside the old answers.js it imports.
//
// Revalidated rather than stored: `no-cache` plus an ETag makes a reload a
// round of 304s instead of 400KB again. Every session is a new port, and so a
// new origin with a cold cache, which is why the first load is made cheap by
// other means (preload hints, the inline boot state) rather than by caching.
const assets = new Map();

// `npm run play` sets this so an edit to a page file shows on the next reload.
const FRESH = process.env.PLAN2CODE_CONSOLE_DEV === "1";

export const etagOf = (body) => `"${crypto.createHash("sha1").update(body).digest("base64url").slice(0, 20)}"`;

export function asset(rel) {
  let a = FRESH ? undefined : assets.get(rel);
  if (!a) {
    let body = rel === "app.css" ? joinedStyles() : fs.readFileSync(path.join(PUBLIC_DIR, rel));
    if (rel === "app.css") body = Buffer.concat([body, Buffer.from(accentCss())]);
    const etag = etagOf(body);
    a = { body, etag, type: TYPES[path.extname(rel)] || "application/octet-stream" };
    assets.set(rel, a);
  }
  return a;
}

// The saved highlight color, painted from the very first frame. The page's
// script owns the colors once it runs (applyLooks clears the attribute these
// hang off), but until then the only way to avoid flashing the default ocean
// at someone who picked violet is a stylesheet rule the server can switch on
// with an attribute: the CSP forbids inline styles, and the colors live in
// palette.js, so they are generated from there rather than copied into CSS.
function accentCss() {
  const vars = (shades) =>
    ["--accent", "--accent-soft", "--accent-ink", "--accent-line"].map((n, i) => `${n}:${shades[i]}`).join(";");
  let css = "\n/* Generated by server.mjs from palette.js: the saved accent before app.js runs. */\n";
  for (const [id, a] of Object.entries(ACCENTS)) {
    if (id === DEFAULT_ACCENT) continue;
    const sel = `:root[data-looks-accent="${id}"]`;
    css += `${sel}{${vars(a.light)}}\n`;
    css += `@media (prefers-color-scheme: dark){${sel}:not([data-theme="light"]){${vars(a.dark)}}}\n`;
    css += `${sel}[data-theme="dark"]{${vars(a.dark)}}\n`;
  }
  return css;
}
