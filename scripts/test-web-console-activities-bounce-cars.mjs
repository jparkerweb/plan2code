// Web console tests, Bounce Road's cars: every style draws with finite numbers under every option, inside the reach carReach() gives (the w by h box with no options), with balanced save and restore, Planny's star in the color given, an unknown style as a sedan, and colors in any spelling.
// Run with: node --test scripts/test-web-console-activities-bounce-cars.mjs
//
// No browser: a stub 2D context follows the transform the drawing sets up
// and records every point it draws through, as in
// scripts/test-web-console-activities-rapids.mjs.

import "./seed-random.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { CAR_STYLES, MARGINS, STYLE_NAMES, carLength, carReach, drawCarBody, drawCarShadow, rgbOf, shade, styleOf } from "../src/web-console/public/activities/bounce-cars.js";

/* ------------------------------------------------------------- helpers */

// A 2D context that keeps the current transform (translate, scale, rotate,
// save and restore), records each point drawn through it in the caller's
// space, each fill's color, each filled shape's color and bounds (`shapes`),
// every call's arguments and every property set, and flags any number that
// is not finite.
function recorder() {
  const log = { points: [], fills: [], shapes: [], calls: [], bad: [], saves: 0, restores: 0, depth: 0, minDepth: 0 };
  let path = [];
  const bounds = (pts) => ({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) });
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const state = { fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1, globalAlpha: 1 };
  const at = (x, y) => {
    const p = [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    log.points.push(p);
    path.push(p);
  };
  const box = (x, y, w, h) => {
    at(x, y);
    at(x + w, y);
    at(x, y + h);
    at(x + w, y + h);
  };
  const check = (name, args) => {
    for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) log.bad.push(`${name}(${args.join(", ")})`);
  };
  const methods = {
    save() {
      stack.push({ m: [...m], ...state });
      log.saves += 1;
      log.depth += 1;
    },
    restore() {
      const s = stack.pop();
      if (s) {
        m = s.m;
        Object.assign(state, { fillStyle: s.fillStyle, strokeStyle: s.strokeStyle, lineWidth: s.lineWidth, globalAlpha: s.globalAlpha });
      }
      log.restores += 1;
      log.depth -= 1;
      log.minDepth = Math.min(log.minDepth, log.depth);
    },
    translate(x, y) {
      m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    },
    scale(x, y) {
      m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]];
    },
    rotate(a) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]];
    },
    beginPath() {
      path = [];
    },
    moveTo: at,
    lineTo: at,
    quadraticCurveTo(cx, cy, x, y) {
      at(cx, cy);
      at(x, y);
    },
    bezierCurveTo(ax, ay, bx, by, x, y) {
      at(ax, ay);
      at(bx, by);
      at(x, y);
    },
    rect: box,
    roundRect: box,
    fillRect(x, y, w, h) {
      const keep = path;
      path = [];
      box(x, y, w, h);
      log.fills.push(state.fillStyle);
      log.shapes.push({ style: state.fillStyle, points: path.length, ...bounds(path) });
      path = keep;
    },
    strokeRect: box,
    arc(x, y, r) {
      box(x - r, y - r, r * 2, r * 2);
    },
    ellipse(x, y, rx, ry) {
      box(x - rx, y - ry, rx * 2, ry * 2);
    },
    fillText(text, x, y) {
      at(x, y);
    },
    fill() {
      log.fills.push(state.fillStyle);
      if (path.length) log.shapes.push({ style: state.fillStyle, points: path.length, ...bounds(path) });
    },
  };
  const ctx = new Proxy(state, {
    get: (t, name) => {
      if (name in methods) {
        return (...args) => {
          check(name, args);
          log.calls.push([name, ...args]);
          return methods[name](...args);
        };
      }
      if (name in t) return t[name];
      return (...args) => {
        check(name, args);
        log.calls.push([name, ...args]);
      };
    },
    set: (t, name, value) => {
      if (typeof value === "number" && !Number.isFinite(value)) log.bad.push(`${String(name)} = ${value}`);
      if (typeof value === "string" && /NaN|undefined|Infinity/.test(value)) log.bad.push(`${String(name)} = ${value}`);
      log.calls.push(["set", name, value]);
      t[name] = value;
      return true;
    },
  });
  return { ctx, log };
}

const draw = (style, opts) => {
  const { ctx, log } = recorder();
  drawCarBody(ctx, style, opts);
  return log;
};

// Every combination of the options worth telling apart.
// The points drawCarShadow() draws for the same options.
function recordShadow(style, opts) {
  const { ctx, log } = recorder();
  drawCarShadow(ctx, style, opts);
  assert.equal(log.saves, log.restores);
  return log.points;
}

function* combos() {
  for (const squash of [0, 0.5, 1]) {
    for (const tilt of [-1, 0, 1]) {
      for (const air of [0, 0.6, 1]) {
        for (const flags of [0, 1, 2, 3]) {
          yield {
            arms: ["wheel", "up", "down", undefined][(flags + Math.round(squash * 2)) % 4],
            squash,
            tilt,
            air,
            lights: flags === 1 || flags === 3,
            boost: flags >= 2,
            brake: flags === 2,
            siren: flags === 3 ? 480 : undefined,
            damage: [0, 0.4, 0.7, 1][(flags + Math.round(tilt + 1)) % 4],
            clock: 1234 + flags * 77,
          };
        }
      }
    }
  }
}

const EPS = 1e-6;

/* --------------------------------------------------------------- tests */

test("the styles: at least the thirteen asked for, frozen, each with a natural length", () => {
  for (const name of ["planny", "hatch", "sedan", "coupe", "muscle", "pickup", "van", "truck", "police", "racer", "taxi", "jeep", "monster"]) {
    assert.ok(STYLE_NAMES.includes(name), name);
  }
  assert.deepEqual(STYLE_NAMES, Object.keys(CAR_STYLES));
  assert.ok(Object.isFrozen(CAR_STYLES) && Object.isFrozen(STYLE_NAMES));
  for (const name of STYLE_NAMES) {
    const s = CAR_STYLES[name];
    assert.ok(Object.isFrozen(s) && Object.isFrozen(s.body) && Object.isFrozen(s.wheels.at), name);
    assert.ok(s.aspect > 1 && s.aspect < 3, name);
    assert.equal(carLength(name), s.aspect);
    assert.equal(carLength(name, 4), 4 * s.aspect);
  }
});

test("every style under every option draws only finite numbers, with balanced save and restore", () => {
  for (const name of STYLE_NAMES) {
    for (const opts of combos()) {
      for (const [w, h] of [
        [4.2, 7],
        [6, 12],
        [0.5, 0.8],
      ]) {
        const log = draw(name, { ...opts, w, h, color: "#3a7", accent: "#ffd84a", star: "#ff4fa3" });
        assert.deepEqual(log.bad, [], `${name} ${JSON.stringify(opts)}`);
        assert.ok(log.saves > 0, name);
        assert.equal(log.saves, log.restores, `${name} ${JSON.stringify(opts)}`);
        assert.equal(log.minDepth, 0, `${name} restores past its own save`);
        assert.ok(log.points.length > 20, name);
      }
    }
  }
});

test("with no options a car stays inside its w by h box", () => {
  for (const name of STYLE_NAMES) {
    for (const [w, h] of [
      [4.2, 7],
      [6, 12],
      [3, 3],
    ]) {
      // No shadow allowance here: the shadow is the one thing that leaves
      // the box at rest, so leave it out by checking everything after it.
      const log = draw(name, { w, h });
      const r = carReach(name, { w, h });
      assert.equal(r.left, w / 2);
      assert.equal(r.top, h / 2);
      // The resting shadow is offset a little down and right, so it alone
      // reaches past the right and bottom edges, by the documented amount.
      assert.ok(Math.abs(r.right - (w / 2 + w * 0.04)) < EPS, name);
      assert.ok(Math.abs(r.bottom - (h / 2 + h * 0.05)) < EPS, name);
      // The first four points are the shadow's; everything after is the car.
      for (const [x, y] of log.points.slice(4)) {
        assert.ok(Math.abs(x) <= w / 2 + EPS, `${name} ${w}x${h}: x ${x}`);
        assert.ok(Math.abs(y) <= h / 2 + EPS, `${name} ${w}x${h}: y ${y}`);
      }
    }
  }
});

test("every option keeps a car inside the reach carReach() gives, at natural and odd sizes, and the reach inside the documented margins", () => {
  for (const name of STYLE_NAMES) {
    for (const [w, h] of [
      [4.2, carLength(name, 4.2)],
      [4, 4],
      [3, 12],
      [8, 5],
    ]) {
      for (const opts of combos()) {
        for (const shadow of [true, false]) {
          const all = { ...opts, w, h, shadow };
          const r = carReach(name, all);
          if (shadow) for (const [x, y] of recordShadow(name, all)) assert.ok(x <= r.right + EPS && y <= r.bottom + EPS, `${name} shadow`);
          for (const [x, y] of draw(name, all).points) {
            assert.ok(x >= -r.left - EPS && x <= r.right + EPS, `${name} ${JSON.stringify(all)}: x ${x} outside ${-r.left}..${r.right}`);
            assert.ok(y >= -r.top - EPS && y <= r.bottom + EPS, `${name} ${JSON.stringify(all)}: y ${y} outside ${-r.top}..${r.bottom}`);
          }
          // The header's numbers: at most a lift of 0.35, a squash of 0.2
          // wide, beams 1.3 h ahead and 0.35 w aside, a flame 0.45 h behind,
          // a shadow 0.44 w right and 0.4 h down.
          const k = 1 + MARGINS.lift;
          const sx = 1 + MARGINS.squashW;
          assert.ok(r.left <= (w / 2 + w * 0.35) * sx * k + EPS);
          assert.ok(r.top <= (h / 2 + h * 1.3) * k + EPS);
          assert.ok(r.bottom <= Math.max((h / 2 + h * 0.45) * k, h * 0.4 + (h / 2) * sx) + EPS);
          assert.ok(r.right <= Math.max(r.left, w * 0.44 + (w / 2) * sx) + EPS);
        }
      }
    }
  }
});

test("a car in the air is bigger and its shadow further down and right", () => {
  const low = carReach("sedan", { w: 4, h: 8 });
  const high = carReach("sedan", { w: 4, h: 8, air: 1 });
  assert.ok(Math.abs(high.left - 2 * 1.35) < EPS);
  assert.ok(Math.abs(high.top - 4 * 1.35) < EPS);
  assert.ok(high.right > low.right && high.bottom > low.bottom);
  // The shadow is the first shape drawn: its middle sits down and right.
  const log = draw("sedan", { w: 4, h: 8, air: 1 });
  const [[x0, y0], , , [x1, y1]] = log.points;
  assert.ok(Math.abs((x0 + x1) / 2 - 4 * 0.44) < EPS);
  assert.ok(Math.abs((y0 + y1) / 2 - 8 * 0.4) < EPS);
});

test("Planny's car fills his ten point star eye in the star color, and other cars do not use it", () => {
  // Neither the default star blue nor the paint, so only the star can match.
  const star = "#e0457b";
  const eyes = (log, color) => log.shapes.filter((s) => s.points === 10 && s.style === color);
  for (const arms of ["wheel", "up", "down"]) {
    for (const squash of [0, 1]) {
      const log = draw("planny", { star, arms, squash, color: "#206cc3" });
      assert.equal(eyes(log, star).length, 1, `${arms} ${squash}`);
      // Nothing but the star is filled in its color.
      assert.equal(log.shapes.filter((s) => s.style === star).length, 1, `${arms} ${squash}`);
    }
  }
  for (const name of STYLE_NAMES.filter((n) => n !== "planny")) assert.ok(!draw(name, { star }).fills.includes(star), name);
  // With no star given, the eye is still a ten point star, in the default blue.
  assert.equal(eyes(draw("planny", { color: "#c0392b" }), "#206cc3").length, 1);
});

test("an unknown style draws as a sedan, and a style object is used as given", () => {
  const sedan = draw("sedan", { w: 4, h: 8, color: "#123456" }).calls;
  for (const style of ["nope", undefined, null, 7, { body: 1 }]) assert.deepEqual(draw(style, { w: 4, h: 8, color: "#123456" }).calls, sedan, String(style));
  assert.equal(styleOf("nope"), CAR_STYLES.sedan);
  assert.equal(styleOf(CAR_STYLES.van), CAR_STYLES.van);
  assert.deepEqual(draw(CAR_STYLES.taxi, { w: 4, h: 8 }).calls, draw("taxi", { w: 4, h: 8 }).calls);
  assert.equal(carLength("nope"), CAR_STYLES.sedan.aspect);
});

test("colors in #abc, #aabbcc, rgb() or nonsense all draw, alike when they name one color", () => {
  assert.deepEqual(rgbOf("#abc"), [0xaa, 0xbb, 0xcc]);
  assert.deepEqual(rgbOf("#AABBCC"), [0xaa, 0xbb, 0xcc]);
  assert.deepEqual(rgbOf("rgb(170, 187, 204)"), [0xaa, 0xbb, 0xcc]);
  assert.equal(rgbOf("banana"), null);
  assert.equal(rgbOf(undefined), null);
  assert.equal(rgbOf(""), null);
  assert.equal(rgbOf("red"), null);
  assert.deepEqual(rgbOf("#aabbcc80"), [0xaa, 0xbb, 0xcc]);
  assert.deepEqual(rgbOf("rgba(170, 187, 204, 0.5)"), [0xaa, 0xbb, 0xcc]);
  assert.ok(Object.isFrozen(rgbOf("#abc")));
  assert.equal(shade("#abc"), "#aabbcc");
  assert.equal(shade("#abc", NaN), "#aabbcc");
  assert.equal(shade("#abc", "x"), "#aabbcc");
  assert.equal(shade("#abc", 0), "#aabbcc");
  assert.equal(shade("#000000", 0.5), "#808080");
  assert.equal(shade("#ffffff", -1), "#000000");
  for (const name of STYLE_NAMES) {
    const short = draw(name, { color: "#abc", accent: "#f00", star: "#0f0" }).calls;
    assert.deepEqual(draw(name, { color: "#aabbcc", accent: "#ff0000", star: "#00ff00" }).calls, short, name);
    assert.deepEqual(draw(name, { color: "rgb(170, 187, 204)", accent: "rgba(255, 0, 0, 1)", star: "rgb(0,255,0)" }).calls, short, name);
    assert.deepEqual(draw(name, { color: "#aabbccff", accent: "#ff0000ff", star: "rgba(0, 255, 0, 0.9)" }).calls, short, name);
    for (const color of ["", "red"]) assert.deepEqual(draw(name, { color, accent: color, star: color }).calls, draw(name, {}).calls, `${name} ${color}`);
    // A color it cannot read falls back to the style's own paint.
    const odd = draw(name, { color: "banana", accent: 12, star: null });
    assert.deepEqual(odd.bad, [], name);
    assert.deepEqual(odd.calls, draw(name, {}).calls, name);
    for (const c of odd.fills) assert.match(String(c), /^(#[0-9a-f]{6}|rgba?\([\d., ]+\))$/, `${name}: ${c}`);
  }
});

test("nonsense numbers are clamped or ignored, never drawn", () => {
  for (const name of STYLE_NAMES) {
    const log = draw(name, { w: NaN, h: -3, squash: Infinity, tilt: "left", air: -1, damage: 5, siren: NaN, clock: Infinity, number: NaN });
    assert.deepEqual(log.bad, [], name);
    assert.equal(log.saves, log.restores);
    // No options at all, or null, is the default car.
    assert.deepEqual(draw(name, null).calls, draw(name, {}).calls, name);
    assert.deepEqual(draw(name, undefined).calls, draw(name, {}).calls, name);
    assert.deepEqual(carReach(name, null), carReach(name, {}), name);
    assert.deepEqual(recordShadow(name, null), recordShadow(name, {}), name);
    // A size of 0 or below is missing, not a speck.
    for (const bad of [0, -2]) {
      assert.deepEqual(draw(name, { w: bad, h: bad }).calls, draw(name, {}).calls, `${name} ${bad}`);
      assert.deepEqual(carReach(name, { w: bad }), carReach(name, {}), `${name} ${bad}`);
    }
  }
});

test("the racer's number stays a number of at most two digits", () => {
  const text = (opts) => draw("racer", opts).calls.find((c) => c[0] === "fillText");
  assert.equal(text({})[1], "7");
  assert.equal(text({ number: 123 })[1], "99");
  assert.equal(text({ number: -4 })[1], "0");
  assert.equal(text({ number: 41.6 })[1], "42");
  // And a width it is squeezed to, so even two wide digits stay on the roundel.
  assert.ok(text({ number: 88 })[4] > 0);
});

test("drawCarShadow draws just the shadow drawCarBody draws, and shadow: false leaves it out", () => {
  for (const name of STYLE_NAMES) {
    for (const opts of [{}, { air: 1 }, { squash: 1, w: 6, h: 9 }]) {
      const alone = recordShadow(name, opts);
      assert.equal(alone.length, 4);
      assert.deepEqual(draw(name, opts).points.slice(0, 4), alone, name);
      const bare = draw(name, { ...opts, shadow: false });
      assert.deepEqual(bare.points, draw(name, opts).points.slice(4), name);
      assert.equal(bare.saves, bare.restores);
    }
    // Without its shadow a resting car stays inside its box exactly.
    assert.deepEqual(carReach(name, { w: 4, h: 7, shadow: false }), { left: 2, right: 2, top: 3.5, bottom: 3.5 });
  }
});

test("nothing is drawn over a lit brake lamp", () => {
  const overlap = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
  for (const name of STYLE_NAMES) {
    for (const opts of [{ brake: true }, { brake: true, siren: 300 }, { brake: true, boost: true, tilt: 1 }]) {
      const { shapes } = draw(name, opts);
      const lit = shapes.map((s, i) => [s, i]).filter(([s]) => s.style === "#ff3a2a");
      assert.ok(lit.length > 0, name);
      for (const [lamp, i] of lit) {
        for (const later of shapes.slice(i + 1)) assert.ok(!overlap(lamp, later), `${name} ${JSON.stringify(opts)}: ${later.style} over the brake lamp`);
      }
    }
  }
});

test("a siren puts a light bar on every style, open cars included", () => {
  for (const name of STYLE_NAMES) {
    assert.ok(draw(name, { siren: 0 }).fills.includes("#ff2d2d"), name);
    if (name !== "police") assert.ok(!draw(name, {}).fills.includes("#ff2d2d"), name);
  }
});

test("the siren alternates its lit side on the clock, and a car with no clock stays still", () => {
  const a = draw("police", { siren: 0 }).fills;
  const b = draw("police", { siren: 200 }).fills;
  assert.notDeepEqual(a, b);
  assert.deepEqual(draw("police", { siren: 0 }).fills, a);
  // The same moment draws the same frame: nothing random.
  for (const name of STYLE_NAMES) assert.deepEqual(draw(name, { boost: true, damage: 1, squash: 1, clock: 500 }).calls, draw(name, { boost: true, damage: 1, squash: 1, clock: 500 }).calls, name);
});

test("braking lights the taillights and a boost draws a flame behind the tail", () => {
  for (const name of STYLE_NAMES) {
    assert.ok(draw(name, { brake: true }).fills.includes("#ff3a2a"), name);
    assert.ok(!draw(name, {}).fills.includes("#ff3a2a"), name);
    const h = carLength(name, 4.2);
    const behind = (log) => Math.max(...log.points.slice(4).map(([, y]) => y));
    assert.ok(behind(draw(name, { boost: true, w: 4.2, h })) > h / 2 + h * 0.2, name);
  }
});

test("the source keeps to the house rules: no em dash, no shadowBlur, no Math.random, no imports", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/web-console/public/activities/bounce-cars.js", import.meta.url), "utf8");
  assert.ok(!src.includes(String.fromCharCode(0x2014)));
  const code = src.split(String.fromCharCode(10)).filter((line) => !line.trim().startsWith("//"));
  assert.ok(!code.some((line) => /shadowBlur|Math[.]random|^import /.test(line)));
});
