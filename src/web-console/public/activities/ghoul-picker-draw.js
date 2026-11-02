// Plan2Code Web Console - Ghoul Rush's choice of stage, its drawing: a card for each stage offered, its picture (its rooms' walls and floor, its boss standing there), name, line and boss, and how to choose; and the stage select for testing (every stage, and each of its rooms).
//
// ghoul-draw.js plugs it in: pickerArt(d) takes ghoul-draw.js's own drawing
// helpers (`d`: lookOf, label, roundRect, circle, BOSS_ART, drawGourdFire and
// GOLD) and hands back drawPicker, drawSelect and stageColor, so this file
// never reaches back into it. Drawn in room units, y counted down from the field's top.

// How much taller than its box a boss is drawn (the Groundskeeper's hat and
// scythe rise past his head), so the picture leaves room for it.
const REACH = Object.freeze({ keeper: 1.15, choirmaster: 1.1, matron: 1.05, beast: 1.38, frostwidow: 1.0 });

export function pickerArt(d) {
  const { lookOf, label, roundRect, circle, BOSS_ART, drawGourdFire, GOLD } = d;

  // A stage's color: its boss room's.
  const stageColor = (st) => lookOf(st.rooms[st.rooms.length - 1]).color;

  // The night of a stage out in the gardens, in the box (x, y, w, wallH) down to
  // `floorY`: stars, the moon with its halo, a far wall of hedge and a near one
  // (each cut in blocks, its top lit, leaf flecks in rows), the boss room's
  // shed at the left with its window lit, and a little fog on the grass.
  function drawNight(ctx, look, den, x, y, w, wallH, floorY) {
    ctx.fillStyle = "#d6e4d0";
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = 0.3 + (i % 3) * 0.2;
      ctx.fillRect(x + (((i * 37) % 100) / 100) * w, y + (((i * 53) % 55) / 100) * wallH, 0.25, 0.25);
    }
    const mx = x + w * 0.84;
    const my = y + wallH * 0.24;
    const mr = Math.min(w, wallH) * 0.1;
    ctx.fillStyle = look.window;
    for (const [k, a] of [[2.8, 0.08], [1.9, 0.14], [1, 0.95]]) {
      ctx.globalAlpha = a;
      circle(ctx, mx, my, mr * k);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const [top, wide, dim] of [[y + wallH * 0.3, 7, 0.55], [y + wallH * 0.46, 5.2, 1]]) {
      for (let bx = x - 1, n = 0; bx < x + w; bx += wide, n++) {
        const t = top + (n % 3) * 0.6 - (n % 2) * 0.8;
        ctx.fillStyle = dim < 1 ? "#08180c" : "#0b2012";
        ctx.fillRect(bx, t, wide - 0.25, floorY - t);
        ctx.globalAlpha = 0.85 * dim;
        ctx.fillStyle = "#4f9640";
        ctx.fillRect(bx, t, wide - 0.25, 0.4);
        ctx.fillStyle = "#245a2a";
        for (let k = 0; k < 9; k++) ctx.fillRect(bx + ((k * 37 + n * 11) % 100) * 0.01 * (wide - 1.2), t + 0.9 + (k % 4) * 1.1 + ((k * 7 + n) % 3) * 0.3, 0.9, 0.4);
        ctx.globalAlpha = 1;
      }
    }
    // The shed.
    const sx = x + w * 0.04;
    ctx.fillStyle = "#1a120a";
    ctx.fillRect(sx, floorY - 6.4, 8.6, 6.4);
    ctx.fillStyle = "#3a2c22";
    ctx.beginPath();
    ctx.moveTo(sx - 0.8, floorY - 6.2);
    ctx.lineTo(sx + 0.6, floorY - 8.6);
    ctx.lineTo(sx + 8, floorY - 8.6);
    ctx.lineTo(sx + 9.4, floorY - 6.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e0a850";
    ctx.globalAlpha = 0.8;
    ctx.fillRect(sx + 4.6, floorY - 5, 2.8, 2.2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#8aa08a";
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = 0.07;
      ctx.beginPath();
      ctx.ellipse?.(x + w * (0.12 + k * 0.26), floorY - 1.2 - (k % 2), 7, 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The night over Hollow End Village, in the box (x, y, w, wallH) down to
  // `floorY`: stars, a huge gold moon rising behind a church spire, a row of
  // crooked timber-framed houses with lit windows, and a bare tree; the Beast
  // stands in front of it (drawStagePicture adds it).
  function drawVillage(ctx, den, x, y, w, wallH, floorY) {
    ctx.fillStyle = "#e9eeff";
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.25 + (i % 3) * 0.2;
      ctx.fillRect(x + (((i * 41) % 100) / 100) * w, y + (((i * 59) % 50) / 100) * wallH, 0.25, 0.25);
    }
    ctx.globalAlpha = 1;
    const mx = x + w * 0.66;
    const my = y + wallH * 0.36;
    const mr = Math.min(w, wallH) * 0.3;
    for (const [k, a, c] of [[1.9, 0.1, "#ffb860"], [1.4, 0.16, "#ffc870"], [1, 0.97, "#f3d08a"]]) {
      ctx.fillStyle = c;
      ctx.globalAlpha = a;
      circle(ctx, mx, my, mr * k);
      ctx.fill();
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#b8803a";
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.2, -0.32, 0.15], [0.12, 0.2, 0.26], [-0.34, 0.3, 0.12]]) {
      circle(ctx, mx + dx * mr, my + dy * mr, r * mr);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The church tower and spire, black against the moon.
    const cx = x + w * 0.5;
    ctx.fillStyle = "#14121e";
    ctx.fillRect(cx, floorY - wallH * 0.55, w * 0.07, wallH * 0.55);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.005, floorY - wallH * 0.55);
    ctx.lineTo(cx + w * 0.035, floorY - wallH * 0.97);
    ctx.lineTo(cx + w * 0.075, floorY - wallH * 0.55);
    ctx.fill();
    ctx.fillStyle = "#e8d8a8";
    circle(ctx, cx + w * 0.035, floorY - wallH * 0.44, w * 0.016);
    ctx.fill();
    // Houses: gabled, timbered, a window or two warm.
    [[0.02, 0.28, 0.46], [0.27, 0.22, 0.38], [0.76, 0.24, 0.42]].forEach(([at, hw, hh], i) => {
      const hx = x + w * at;
      const hwid = w * hw;
      const top = floorY - wallH * hh;
      ctx.fillStyle = "#3a3346";
      ctx.fillRect(hx, top, hwid, floorY - top);
      ctx.fillStyle = "#1c1510";
      for (let k = 0; k <= 3; k++) ctx.fillRect(hx + (hwid * k) / 3 - 0.15, top, 0.3, floorY - top);
      ctx.fillRect(hx, top + (floorY - top) * 0.5, hwid, 0.3);
      ctx.beginPath();
      ctx.moveTo(hx - 0.8, top);
      ctx.lineTo(hx + hwid * (0.45 + i * 0.05), top - hwid * 0.3);
      ctx.lineTo(hx + hwid + 0.8, top);
      ctx.fillStyle = "#1e1a28";
      ctx.fill();
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = (i + k) % 2 ? "#ffcf80" : "#0b0a12";
        ctx.fillRect(hx + hwid * (0.2 + k * 0.45), top + (floorY - top) * 0.18, hwid * 0.16, (floorY - top) * 0.22);
      }
    });
    // A bare tree.
    ctx.strokeStyle = "#0b0b14";
    ctx.lineWidth = 0.5;
    const tx = x + w * 0.92;
    ctx.beginPath();
    ctx.moveTo(tx, floorY);
    ctx.lineTo(tx, floorY - wallH * 0.42);
    ctx.moveTo(tx, floorY - wallH * 0.28);
    ctx.lineTo(tx - 4, floorY - wallH * 0.44);
    ctx.moveTo(tx, floorY - wallH * 0.34);
    ctx.lineTo(tx + 3.6, floorY - wallH * 0.5);
    ctx.stroke();
  }

  // The inside of a stage with stained glass (a look with `glass`), in the box
  // (x, y, w, wallH) down to `floorY`: courses of stone, two tall pointed
  // windows in the glass's colors between columns with their light across the
  // floor, a bank of organ pipes standing behind where the boss stands, rows
  // of pews at the front, and candles burning on the floor.
  function drawNave(ctx, den, x, y, w, wallH, floorY) {
    const colors = den.glass;
    const arch = (cx, base, aw, apex, spring) => {
      const hw = aw / 2;
      const rise = spring - apex;
      ctx.beginPath();
      ctx.moveTo(cx - hw, base);
      ctx.lineTo(cx - hw, spring);
      ctx.bezierCurveTo(cx - hw, spring - rise * 0.55, cx - hw * 0.25, apex + rise * 0.2, cx, apex);
      ctx.bezierCurveTo(cx + hw * 0.25, apex + rise * 0.2, cx + hw, spring - rise * 0.55, cx + hw, spring);
      ctx.lineTo(cx + hw, base);
      ctx.closePath();
    };
    // Courses of stone.
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    for (let r = 0; r * 3 < wallH; r++) {
      ctx.moveTo(x, y + r * 3);
      ctx.lineTo(x + w, y + r * 3);
      for (let bx = x + (r % 2) * 3; bx < x + w; bx += 6) {
        ctx.moveTo(bx, y + r * 3);
        ctx.lineTo(bx, y + r * 3 + 3);
      }
    }
    ctx.stroke();
    // The organ's pipes behind the boss, dim bronze.
    const n = 12;
    for (let k = 0; k < n; k++) {
      const px = x + w * 0.44 + k * ((w * 0.54) / n);
      const ph = wallH * (0.52 + 0.4 * (1 - Math.abs(k - (n - 1) / 2) / (n / 2)));
      const pw = (w * 0.54) / n - 0.3;
      ctx.fillStyle = k % 2 ? "#6a5430" : "#7c6338";
      ctx.fillRect(px, floorY - ph, pw, ph);
      ctx.fillStyle = "#c8a458";
      ctx.fillRect(px, floorY - ph, 0.35, ph);
      ctx.fillStyle = "#1a1208";
      ctx.fillRect(px + pw * 0.2, floorY - ph * 0.7, pw * 0.6, pw * 0.5);
      ctx.fillStyle = "#07060a";
      ctx.fillRect(px + 0.1, floorY - ph - 0.15, pw - 0.2, 0.3);
    }
    ctx.fillStyle = "rgba(10, 3, 5, 0.38)";
    ctx.fillRect(x + w * 0.44, y, w * 0.56, wallH);
    // Two windows between columns, their light on the floor.
    const ww = Math.min(w * 0.16, 6.4);
    const wh = wallH * 0.74;
    [0.1, 0.3].forEach((at, i) => {
      const wx = x + w * at + ww / 2;
      const wy = y + wallH * 0.1;
      arch(wx, wy + wh, ww, wy, wy + ww * 0.8);
      ctx.fillStyle = "#07060a";
      ctx.fill();
      ctx.save();
      arch(wx, wy + wh, ww, wy, wy + ww * 0.8);
      if (typeof ctx.clip === "function") ctx.clip();
      const rows = 6;
      const rh = (wh - ww * 0.8) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = colors[(r * 3 + c + i) % colors.length];
          ctx.fillRect(wx - ww / 2 + (ww * c) / 2, wy + ww * 0.8 + r * rh, ww / 2, rh + 0.05);
        }
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = colors[(i + 1) % colors.length];
      circle(ctx, wx, wy + ww * 0.5, ww * 0.28);
      ctx.fill();
      ctx.fillStyle = "#fff0b0";
      circle(ctx, wx, wy + ww * 0.5, ww * 0.1);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#0a0910";
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx, wy + wh);
      for (let r = 0; r <= rows; r++) {
        ctx.moveTo(wx - ww / 2, wy + ww * 0.8 + r * rh);
        ctx.lineTo(wx + ww / 2, wy + ww * 0.8 + r * rh);
      }
      ctx.stroke();
      ctx.restore();
      arch(wx, wy + wh, ww + 1, wy - 0.5, wy + ww * 0.8);
      ctx.strokeStyle = "#7a829c";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wy + wh);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.lineTo(wx + ww / 2 + w * 0.2, floorY);
      ctx.lineTo(wx - ww / 2 + w * 0.06, floorY);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // Columns between and beside the windows.
    for (const at of [0.02, 0.22, 0.42]) {
      ctx.fillStyle = "#4e5670";
      ctx.fillRect(x + w * at, y, 1.3, floorY - y);
      ctx.fillStyle = "#8a92ac";
      ctx.fillRect(x + w * at, y, 0.35, floorY - y);
      ctx.fillRect(x + w * at - 0.35, y + wallH * 0.06, 2, 0.5);
    }
    // Pews at the front, and candles on the floor.
    ctx.fillStyle = "#1a100c";
    for (let r = 0; r < 3; r++) ctx.fillRect(x, floorY - 1.6 - r * 1.3, w, 0.9 + r * 0.2);
    ctx.fillStyle = "#4a3220";
    for (let r = 0; r < 3; r++) ctx.fillRect(x, floorY - 1.6 - r * 1.3, w, 0.2);
    for (const at of [0.03, 0.4, 0.95]) {
      ctx.fillStyle = "#e8e0d0";
      ctx.fillRect(x + w * at, floorY - 4, 0.5, 2);
      ctx.fillStyle = "#ffb43c";
      ctx.globalAlpha = 0.25;
      circle(ctx, x + w * at + 0.25, floorY - 4.5, 1.3);
      ctx.fill();
      ctx.globalAlpha = 1;
      circle(ctx, x + w * at + 0.25, floorY - 4.5, 0.5);
      ctx.fill();
    }
  }

  // The inside of a ward (a look with `clinic`), in the box (x, y, w, wallH) down
  // to `floorY`: green-gray tile to the height of a man, two barred windows with
  // the moon's pale across the floor, a ceiling lamp and the cone it throws, a
  // glass-fronted medicine cabinet and an iron bed in front.
  function drawWard(ctx, den, x, y, w, wallH, floorY) {
    const dado = wallH * 0.4;
    ctx.fillStyle = den.wainscot;
    ctx.fillRect(x, floorY - dado, w, dado);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    for (let ty = floorY - dado; ty < floorY; ty += 2.2) {
      ctx.moveTo(x, ty);
      ctx.lineTo(x + w, ty);
    }
    for (let tx = x; tx < x + w; tx += 2.2) {
      ctx.moveTo(tx, floorY - dado);
      ctx.lineTo(tx, floorY);
    }
    ctx.stroke();
    ctx.fillStyle = "#6a9a86";
    ctx.fillRect(x, floorY - dado, w, 0.5);
    // Two windows with bars, the light of each across the floor.
    const ww = Math.min(w * 0.13, 5.4);
    const wh = wallH * 0.5;
    [0.1, 0.27].forEach((at, i) => {
      const wx = x + w * at;
      const wy = y + wallH * 0.12;
      ctx.fillStyle = den.wainscot;
      ctx.fillRect(wx - 0.4, wy - 0.4, ww + 0.8, wh + 0.8);
      ctx.fillStyle = "#08100e";
      ctx.fillRect(wx, wy, ww, wh);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = den.window;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1a1f1d";
      for (let k = 1; k < 4; k++) ctx.fillRect(wx + (ww * k) / 4 - 0.14, wy, 0.28, wh);
      ctx.fillRect(wx, wy + wh * 0.45, ww, 0.3);
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = den.window;
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.lineTo(wx + ww + w * 0.18, floorY);
      ctx.lineTo(wx + w * 0.05, floorY);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // The lamp and its cone.
    const lx = x + w * 0.5;
    ctx.fillStyle = "rgba(242, 240, 200, 0.1)";
    ctx.beginPath();
    ctx.moveTo(lx - 0.8, y + 3.4);
    ctx.lineTo(lx + 0.8, y + 3.4);
    ctx.lineTo(lx + w * 0.17, floorY);
    ctx.lineTo(lx - w * 0.17, floorY);
    ctx.fill();
    ctx.strokeStyle = "#2a2f2f";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + 2);
    ctx.stroke();
    ctx.fillStyle = "#4a5452";
    ctx.beginPath();
    ctx.moveTo(lx - 1.8, y + 3.4);
    ctx.quadraticCurveTo(lx - 1.5, y + 1.8, lx, y + 1.7);
    ctx.quadraticCurveTo(lx + 1.5, y + 1.8, lx + 1.8, y + 3.4);
    ctx.fill();
    ctx.fillStyle = "#f2f0c8";
    circle(ctx, lx, y + 3.6, 0.5);
    ctx.fill();
    // A medicine cabinet and an iron bed at the front.
    const cx = x + w * 0.36;
    ctx.fillStyle = "#9aa49e";
    ctx.fillRect(cx, floorY - 6.2, 4.6, 6.2);
    ctx.fillStyle = "#0a100e";
    ctx.fillRect(cx + 0.3, floorY - 5.8, 4, 5.4);
    ctx.fillStyle = "rgba(192, 232, 216, 0.25)";
    ctx.fillRect(cx + 0.3, floorY - 5.8, 4, 5.4);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = ["#6a9a62", "#b0803a", "#5a7aa0", "#c8c4a0"][k];
      ctx.fillRect(cx + 0.7 + k * 0.9, floorY - 4.6, 0.5, 1.3);
      ctx.fillRect(cx + 0.7 + k * 0.9, floorY - 2.4, 0.5, 1.1);
    }
    ctx.fillStyle = "#b8483e";
    ctx.fillRect(cx + 2.2, floorY - 6.1, 0.2, 0.6);
    ctx.fillRect(cx + 2.0, floorY - 5.9, 0.6, 0.2);
    const bx = x + w * 0.02;
    ctx.strokeStyle = "#2a2f2f";
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(bx, floorY);
    ctx.lineTo(bx, floorY - 6);
    ctx.moveTo(bx + 10, floorY);
    ctx.lineTo(bx + 10, floorY - 4);
    ctx.stroke();
    ctx.fillStyle = "#a8aca0";
    ctx.fillRect(bx, floorY - 2.6, 10, 1.2);
    ctx.fillStyle = "#d4d8cc";
    ctx.fillRect(bx, floorY - 2.6, 3.2, 0.6);
  }

  // The inside of a mine (a look with `mine`), in the box (x, y, w, wallH) down
  // to `floorY`: rough rock in strata with gold glinting in it, a timber prop
  // and cap beam at each side, a stringer along the roof, an oil lamp hanging
  // on a chain with its light on the rails, a tipped cart of ore, and the
  // rails along the floor.
  function drawMine(ctx, den, x, y, w, wallH, floorY) {
    ctx.strokeStyle = den.paper;
    ctx.lineWidth = 0.35;
    ctx.globalAlpha = 0.45;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const px = x + (w * i) / 10;
        const py = y + wallH * (0.22 + k * 0.2) + Math.sin(i * 1.3 + k * 2) * 0.7;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // The gold: a few flecks in the upper right.
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 3 ? "#e0a040" : "#fff0b0";
      const gx = x + w * (0.58 + ((i * 37) % 38) / 100);
      const gy = y + wallH * (0.1 + ((i * 53) % 45) / 100);
      ctx.fillRect(gx, gy, 0.5 + (i % 2) * 0.3, 0.5);
    }
    // The stringer under the roof, and two props with their cap beams and knees.
    ctx.fillStyle = "#1e130a";
    ctx.fillRect(x, y + 1, w, 1.6);
    ctx.fillStyle = den.shelfTop;
    ctx.fillRect(x, y + 1, w, 0.3);
    for (const [at, pw] of [[0.1, 1.3], [0.9, 1.7]]) {
      const px = x + w * at;
      ctx.fillStyle = "#1e130a";
      ctx.fillRect(px - pw / 2, y + 1, pw, floorY - y - 1);
      ctx.fillStyle = den.wainscot;
      ctx.fillRect(px - pw / 2 + 0.2, y + 1, pw * 0.55, floorY - y - 1);
      ctx.fillStyle = den.shelfTop;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px - pw / 2 + 0.25, y + 1, 0.22, floorY - y - 1);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#1e130a";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(px, y + 7);
      ctx.lineTo(px - 3.2, y + 2.6);
      ctx.moveTo(px, y + 7);
      ctx.lineTo(px + 3.2, y + 2.6);
      ctx.stroke();
    }
    // The lamp on its chain, and its light falling to the rails.
    const lx = x + w * 0.4;
    const ly = y + wallH * 0.34;
    ctx.fillStyle = "rgba(255, 190, 90, 0.13)";
    ctx.beginPath();
    ctx.moveTo(lx - 0.6, ly);
    ctx.lineTo(lx + 0.6, ly);
    ctx.lineTo(lx + w * 0.22, floorY);
    ctx.lineTo(lx - w * 0.22, floorY);
    ctx.fill();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#ffb050";
    circle(ctx, lx, ly, w * 0.1);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#6a6a74";
    ctx.lineWidth = 0.22;
    ctx.setLineDash?.([0.5, 0.35]);
    ctx.beginPath();
    ctx.moveTo(lx, y + 2.6);
    ctx.lineTo(lx, ly - 1.2);
    ctx.stroke();
    ctx.setLineDash?.([]);
    ctx.fillStyle = "#b08a3a";
    ctx.fillRect(lx - 0.9, ly - 1.2, 1.8, 0.4);
    ctx.fillStyle = "#ffcf70";
    ctx.fillRect(lx - 0.65, ly - 0.8, 1.3, 1.7);
    ctx.fillStyle = "#fff4c0";
    ctx.fillRect(lx - 0.25, ly - 0.4, 0.5, 0.9);
    ctx.fillStyle = "#b08a3a";
    ctx.fillRect(lx - 0.9, ly + 0.9, 1.8, 0.4);
    // The cart, tipped, with ore in it.
    const cx = x + w * 0.2;
    ctx.save();
    ctx.translate(cx, floorY - 0.6);
    ctx.rotate(-0.12);
    ctx.fillStyle = "#2a2a32";
    ctx.beginPath();
    ctx.moveTo(-2.8, -3.6);
    ctx.lineTo(2.8, -3.6);
    ctx.lineTo(2.2, 0);
    ctx.lineTo(-2.2, 0);
    ctx.fill();
    ctx.fillStyle = "#5a5a66";
    ctx.fillRect(-2.9, -3.8, 5.8, 0.5);
    ctx.fillStyle = "#e0a040";
    for (let k = 0; k < 4; k++) {
      circle(ctx, -1.6 + k * 1.1, -4 - (k % 2) * 0.3, 0.55);
      ctx.fill();
    }
    ctx.restore();
    // The rails, sleepers first.
    ctx.fillStyle = "#1c120a";
    for (let px = x + 0.8; px < x + w - 1; px += 2.6) ctx.fillRect(px, floorY - 0.7, 1.5, 0.7);
    ctx.fillStyle = "#6a6a76";
    ctx.fillRect(x, floorY - 0.9, w, 0.28);
    ctx.fillStyle = "#26262c";
    ctx.fillRect(x, floorY - 0.62, w, 0.18);
  }

  // The inside of the Big Top (a look with `carnival`), in the box (x, y, w, wallH)
  // down to `floorY`: striped canvas leaning in to a pole, a string of bulbs, a
  // spotlight, a puppet hanging on three strings, the ring's red and white curb on
  // the floor and, if the boss's own drawing is missing, the Ringmaster as a
  // silhouette with his top hat and whip.
  function drawCarnival(ctx, den, x, y, w, wallH, floorY) {
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? "#4a1c22" : "#8a1822";
      const bx = x + (w * i) / 12;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5 + (bx - (x + w * 0.5)) * 0.35, y);
      ctx.lineTo(x + w * 0.5 + (bx + w / 12 - (x + w * 0.5)) * 0.35, y);
      ctx.lineTo(bx + w / 12 + 0.05, floorY);
      ctx.lineTo(bx, floorY);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x, y, w, wallH * 0.3);
    // The pole.
    ctx.fillStyle = "#f2e8d0";
    ctx.fillRect(x + w * 0.5 - 0.7, y, 1.4, floorY - y);
    ctx.fillStyle = "#c01828";
    for (let yy = y; yy < floorY; yy += 2.4) ctx.fillRect(x + w * 0.5 - 0.7, yy, 1.4, 1.2);
    // The bulbs, swagged.
    const cols = ["#ffd36a", "#ff7ab8", "#7ad0ff", "#9aff8a"];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      ctx.fillStyle = cols[i % 4];
      circle(ctx, x + w * t, y + 2.6 + Math.sin(t * Math.PI) * 2.6, 0.42);
      ctx.fill();
    }
    // A spotlight pooled on the ring.
    ctx.fillStyle = "rgba(255, 244, 200, 0.16)";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.16, y);
    ctx.lineTo(x + w * 0.06, floorY);
    ctx.lineTo(x + w * 0.46, floorY);
    ctx.fill();
    // The puppet on its strings, from a gantry.
    const px = x + w * 0.27;
    const top = y + 1.6;
    ctx.strokeStyle = "#e8d8b8";
    ctx.lineWidth = 0.14;
    for (const [sx, tx, ty] of [[-1.4, 0, 6.2], [-0.2, -2.2, 9.4], [1.2, 2.2, 9.4]]) {
      ctx.beginPath();
      ctx.moveTo(px + sx, top);
      ctx.lineTo(px + tx, y + ty);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a3a46";
    ctx.fillRect(px - 2.4, top - 0.5, 4.8, 0.7);
    ctx.fillStyle = "#e8c040";
    circle(ctx, px, y + 7.6, 1.5);
    ctx.fill();
    ctx.fillStyle = "#c01828";
    ctx.fillRect(px - 1.6, y + 9.1, 3.2, 4);
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(px - 1.5, y + 13.1, 1.2, floorY - y - 13.4);
    ctx.fillRect(px + 0.3, y + 13.1, 1.2, floorY - y - 13.4);
    ctx.fillRect(px - 3.4, y + 9.6, 1.8, 0.7);
    ctx.fillRect(px + 1.6, y + 9.6, 1.8, 0.7);
    // The ring's curb.
    for (let xs = 0, i = 0; xs < w; xs += 2.4, i++) {
      ctx.fillStyle = i % 2 ? "#f2e8d0" : "#c01828";
      ctx.fillRect(x + xs, floorY - 0.7, Math.min(2.4, w - xs), 0.7);
    }
    if (!BOSS_ART.ringmaster) {
      const bx = x + w * 0.66;
      ctx.fillStyle = "#08040a";
      ctx.fillRect(bx - 1.3, floorY - 10, 2.6, 8);
      ctx.fillRect(bx - 1.1, floorY - 2.2, 0.9, 2.2);
      ctx.fillRect(bx + 0.2, floorY - 2.2, 0.9, 2.2);
      circle(ctx, bx, floorY - 11.2, 1.1);
      ctx.fill();
      ctx.fillRect(bx - 1.6, floorY - 12.2, 3.2, 0.3);
      ctx.fillRect(bx - 0.9, floorY - 14, 1.8, 1.9);
      ctx.strokeStyle = "#08040a";
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(bx + 1.2, floorY - 8);
      ctx.quadraticCurveTo(bx + 6, floorY - 12, bx + 8, floorY - 5);
      ctx.stroke();
    }
  }

  // The Frozen Lake (a look with `frozen`), in the box (x, y, w, wallH) down to
  // `floorY`: a moon over snowy pines, an aurora, a great web slung across the top
  // corner where the Widow waits, icicles under it, the ice's gloss and a black hole in it.
  function drawFrozen(ctx, den, x, y, w, wallH, floorY) {
    ctx.fillStyle = "#eef8ff";
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.3 + (i % 3) * 0.2;
      ctx.fillRect(x + (((i * 41) % 100) / 100) * w, y + (((i * 53) % 50) / 100) * wallH, 0.25, 0.25);
    }
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#4aff9a";
    ctx.fillRect(x + w * 0.1, y + wallH * 0.08, w * 0.5, wallH * 0.22);
    ctx.globalAlpha = 1;
    const mr = Math.min(w, wallH) * 0.09;
    for (const [k, a] of [[2.6, 0.08], [1.7, 0.14], [1, 0.95]]) {
      ctx.globalAlpha = a;
      ctx.fillStyle = "#eef8ff";
      circle(ctx, x + w * 0.2, y + wallH * 0.22, mr * k);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Two rows of pines, the snow on them.
    for (const [row, hgt, dim] of [[0, 0.42, 0.55], [1, 0.6, 1]]) {
      for (let px = x + w * (row ? 0.02 : 0.08); px < x + w; px += w * (row ? 0.16 : 0.12)) {
        const h = wallH * hgt * (0.8 + ((px * 7) % 5) * 0.06);
        ctx.fillStyle = dim < 1 ? "#08202a" : "#0b2a36";
        ctx.beginPath();
        ctx.moveTo(px - h * 0.2, floorY);
        ctx.lineTo(px, floorY - h);
        ctx.lineTo(px + h * 0.2, floorY);
        ctx.fill();
        ctx.fillStyle = `rgba(226, 242, 252, ${0.8 * dim})`;
        ctx.beginPath();
        ctx.moveTo(px - h * 0.12, floorY - h * 0.45);
        ctx.lineTo(px, floorY - h);
        ctx.lineTo(px + h * 0.12, floorY - h * 0.45);
        ctx.fill();
      }
    }
    // The Widow's web, across the top right, and the icicles hanging below it.
    ctx.strokeStyle = "rgba(226, 244, 255, 0.6)";
    ctx.lineWidth = 0.12;
    const wx = x + w;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.5 + i / 12);
      ctx.beginPath();
      ctx.moveTo(wx, y);
      ctx.lineTo(wx + Math.cos(a) * w * 0.7, y + Math.sin(a) * wallH * 0.8);
      ctx.stroke();
    }
    for (const r of [0.2, 0.36, 0.52]) {
      ctx.beginPath();
      ctx.arc(wx, y, w * r, Math.PI * 0.5, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(220, 242, 255, 0.85)";
    for (let i = 0; i < 9; i++) {
      const ix = x + (w * (i + 0.5)) / 9;
      ctx.beginPath();
      ctx.moveTo(ix - 0.35, y);
      ctx.lineTo(ix, y + 1 + ((i * 5) % 4) * 0.7);
      ctx.lineTo(ix + 0.35, y);
      ctx.fill();
    }
    // The ice: a glossy sheet with a black hole in it.
    ctx.fillStyle = "#9fdcf5";
    ctx.fillRect(x, floorY - 0.5, w, 0.5);
    ctx.fillStyle = "#020a14";
    ctx.fillRect(x + w * 0.42, floorY - 0.5, w * 0.12, 1.4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let i = 0; i < 6; i++) ctx.fillRect(x + w * (0.08 + i * 0.16), floorY - 0.4, 1.4, 0.12);
  }

  // A stage's picture, filling the box (x, y, w, h): its first room's wall,
  // paper and moonlit window over its boss room's floor (a chapel's two
  // windows of stained glass, a garden's night), and its boss standing there,
  // its eyes (and the Gourd's fire) lit.
  function drawStagePicture(ctx, v, st, x, y, w, h) {
    const look = lookOf(st.rooms[0]);
    const den = lookOf(st.rooms[st.rooms.length - 1]);
    const floorH = Math.min(4, h * 0.18);
    const floorY = y + h - floorH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    if (typeof ctx.clip === "function") ctx.clip();
    // The wall in bands, darkest at the top.
    const bands = 6;
    const wallH = floorY - y;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i < 2 ? look.wallTop : i < 4 ? look.wallLow : look.paper;
      ctx.fillRect(x, y + (wallH * i) / bands, w, wallH / bands + 0.1);
    }
    // A stage out in the gardens (a look with a `hedge`) is a night: stars, the
    // moon over two walls of clipped hedge and the boss room's shed, its
    // window lit; any other a wall with a tall window, the moon in it, its
    // light across the floor.
    const garden = Boolean(den.hedge);
    if (den.village) drawVillage(ctx, den, x, y, w, wallH, floorY);
    else if (den.mine) drawMine(ctx, den, x, y, w, wallH, floorY);
    else if (den.carnival) drawCarnival(ctx, den, x, y, w, wallH, floorY);
    else if (den.frozen) drawFrozen(ctx, den, x, y, w, wallH, floorY);
    else if (garden) drawNight(ctx, look, den, x, y, w, wallH, floorY);
    else if (den.glass) drawNave(ctx, den, x, y, w, wallH, floorY);
    else if (den.clinic) drawWard(ctx, den, x, y, w, wallH, floorY);
    else {
      ctx.fillStyle = look.wainscot;
      ctx.fillRect(x, floorY - wallH * 0.16, w, wallH * 0.16);
      const wx = x + w * 0.12;
      const wy = y + wallH * 0.14;
      const ww = Math.min(w * 0.18, 7);
      const wh = wallH * 0.5;
      ctx.fillStyle = "#05060a";
      ctx.fillRect(wx, wy, ww, wh);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = look.window;
      ctx.fillRect(wx + 0.3, wy + 0.3, ww - 0.6, wh - 0.6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f2efe2";
      circle(ctx, wx + ww * 0.62, wy + wh * 0.26, Math.min(ww, wh) * 0.2);
      ctx.fill();
      ctx.fillStyle = look.wallLow;
      ctx.fillRect(wx + ww / 2 - 0.2, wy, 0.4, wh);
      ctx.fillRect(wx, wy + wh * 0.5 - 0.2, ww, 0.4);
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = look.window;
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.lineTo(wx + ww + w * 0.3, floorY);
      ctx.lineTo(wx + w * 0.12, floorY);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = den.floorTop;
    ctx.fillRect(x, floorY, w, 0.6);
    ctx.fillStyle = den.floor;
    ctx.fillRect(x, floorY + 0.6, w, floorH);
    // The boss, as big as fits, a little right of the middle.
    const def = v.bosses[st.boss];
    const art = BOSS_ART[st.boss];
    if (def && art) {
      const k = Math.min((wallH * 0.86) / (def.h * (REACH[st.boss] || 1)), (w * 0.46) / def.w);
      const pic = { g: { FIELD_H: 0 }, clock: v.clock, spec: null, groundAt: () => 0, eyes: [] };
      const b = { kind: st.boss, x: 0, y: 0, w: def.w, h: def.h, hurt: 0, dir: -1, wait: Infinity, landX: 0, windup: 0, act: "", state: "fight", t: 0, hp: 1, max: 1, lit: true };
      ctx.save();
      ctx.translate(x + w * 0.64, floorY + 0.3);
      ctx.scale(k, k);
      art(ctx, pic, b);
      if (st.boss === "gourd") drawGourdFire(ctx, pic, b);
      const e = pic.eyes;
      for (let i = 0; i < e.length; i += 4) {
        ctx.fillStyle = e[i + 3];
        ctx.globalAlpha = 0.2;
        circle(ctx, e[i], e[i + 1], e[i + 2] * 2.4);
        ctx.fill();
        ctx.globalAlpha = 1;
        circle(ctx, e[i], e[i + 1], e[i + 2]);
        ctx.fill();
      }
      ctx.restore();
    }
    // The dark closing in from the edges.
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x, y, w, h * 0.12);
    ctx.fillRect(x, y, w * 0.06, h);
    ctx.fillRect(x + w * 0.94, y, w * 0.06, h);
    ctx.restore();
  }

  // The choice of stage, over the room just left: how many are cleared, a
  // card for each stage offered (its picture, name, line and boss), the one
  // picked out raised and edged in gold, and how to choose.
  const CARD_W = 40;
  const CARD_H = 37;
  const CARD_GAP = 6;
  function drawPicker(ctx, v) {
    const { g, round } = v;
    const W = g.FIELD_W;
    ctx.fillStyle = "rgba(4, 2, 6, 0.86)";
    ctx.fillRect(0, 0, W, g.FIELD_H);
    const done = round.cleared.length;
    const total = v.stages.length;
    const last = round.offer.length === 1;
    if (done) label(ctx, `STAGE ${done} OF ${total} CLEARED`, W / 2, 3.2, 2, GOLD, "center", W - 4);
    label(ctx, last ? "One way left" : done ? "Choose your way on" : "Choose your way in", W / 2, 7.4, 4, "#ffffff", "center", W - 4, true);
    const n = round.offer.length;
    const x0 = (W - (n * CARD_W + (n - 1) * CARD_GAP)) / 2;
    const top = 11;
    round.offer.forEach((id, i) => {
      const st = v.stageById(id);
      if (!st) return;
      const on = i === round.pick;
      const x = x0 + i * (CARD_W + CARD_GAP);
      const y = top - (on ? 0.8 : 0);
      roundRect(ctx, x, y, CARD_W, CARD_H, 1.2);
      ctx.fillStyle = "#120c14";
      ctx.fill();
      drawStagePicture(ctx, v, st, x + 1, y + 1, CARD_W - 2, 22);
      label(ctx, st.title, x + CARD_W / 2, y + 26.6, 3, stageColor(st), "center", CARD_W - 2, true);
      label(ctx, st.sub, x + CARD_W / 2, y + 30.4, 1.8, "#ffffff", "center", CARD_W - 2);
      const boss = v.bosses[st.boss];
      if (boss) label(ctx, `Boss: ${boss.name}`, x + CARD_W / 2, y + 34, 1.7, boss.color, "center", CARD_W - 2);
      if (!on) {
        roundRect(ctx, x, y, CARD_W, CARD_H, 1.2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fill();
      }
      roundRect(ctx, x, y, CARD_W, CARD_H, 1.2);
      ctx.strokeStyle = on ? GOLD : "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = on ? 0.45 + 0.15 * Math.sin(v.clock / 120) : 0.3;
      ctx.stroke();
    });
    ctx.globalAlpha = round.phaseMs > 0 ? 0.4 : 0.75 + 0.25 * Math.sin(v.clock / 200);
    label(ctx, last ? "Space or up to go on" : "Left and right to choose, space or up to go in", W / 2, top + CARD_H + 3.4, 2.1, "#ffffff", "center", W - 4);
    ctx.globalAlpha = 1;
  }

  // The stage select (the window's stage code, for testing), over the hall:
  // every stage down the left, the one picked out edged in gold; at the
  // right its picture, name and line, and a chip for each of its rooms, the
  // one picked out in gold; and how to choose. Past LIST_ONE stages the list
  // goes to two columns, its rows shorter to fit.
  const ROW_H = 5;
  const LIST_ONE = 8;
  function drawSelect(ctx, v) {
    const { g, round } = v;
    const sel = round.select;
    const W = g.FIELD_W;
    ctx.fillStyle = "rgba(4, 2, 6, 0.9)";
    ctx.fillRect(0, 0, W, g.FIELD_H);
    label(ctx, "Stage select", W / 2, 4, 3.6, "#ffffff", "center", W - 4, true);
    label(ctx, "PRACTICE: NO SCORE OR RECORD KEPT", W / 2, 7.6, 1.6, GOLD, "center", W - 4);
    const top = 10;
    const listX = 3;
    const listW = 35;
    const cols = v.stages.length > LIST_ONE ? 2 : 1;
    const perCol = Math.ceil(v.stages.length / cols);
    const rowH = Math.min(ROW_H, (g.FIELD_H - top - 5) / perCol);
    const colW = (listW - (cols - 1)) / cols;
    v.stages.forEach((st, i) => {
      const on = i === sel.at;
      const x = listX + Math.floor(i / perCol) * (colW + 1);
      const y = top + (i % perCol) * rowH;
      roundRect(ctx, x, y, colW, rowH - 0.8, 0.8);
      ctx.fillStyle = on ? "#2a1e2c" : "#120c14";
      ctx.fill();
      ctx.globalAlpha = on ? 1 : 0.7;
      label(ctx, `${i + 1}  ${st.title}`, x + 1.4, y + (rowH - 0.8) / 2, Math.min(2, rowH * 0.45), stageColor(st), "left", colW - 2.8, true);
      ctx.globalAlpha = 1;
      if (on) {
        roundRect(ctx, x, y, colW, rowH - 0.8, 0.8);
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 0.4 + 0.12 * Math.sin(v.clock / 120);
        ctx.stroke();
      }
    });
    const st = v.stages[sel.at];
    const px = listX + listW + 3;
    const pw = W - px - 3;
    roundRect(ctx, px, top, pw, 24, 1);
    ctx.fillStyle = "#120c14";
    ctx.fill();
    drawStagePicture(ctx, v, st, px + 0.6, top + 0.6, pw - 1.2, 22.8);
    label(ctx, st.title, px + pw / 2, top + 27, 2.8, stageColor(st), "center", pw, true);
    label(ctx, st.sub, px + pw / 2, top + 30.4, 1.7, "#ffffff", "center", pw);
    const n = st.rooms.length;
    const gap = 1;
    const cw = (pw - gap * (n - 1)) / n;
    st.rooms.forEach((id, i) => {
      const on = i === sel.room;
      const x = px + i * (cw + gap);
      const y = top + 32.6;
      roundRect(ctx, x, y, cw, 4.2, 0.7);
      ctx.fillStyle = on ? "#2a1e2c" : "#120c14";
      ctx.fill();
      const room = v.roomById(id);
      label(ctx, `${i + 1}`, x + cw / 2, y + 1.3, 1.5, on ? GOLD : "rgba(255, 255, 255, 0.6)", "center", cw - 0.6, true);
      label(ctx, room ? room.title : id, x + cw / 2, y + 3.1, 1.2, on ? "#ffffff" : "rgba(255, 255, 255, 0.6)", "center", cw - 0.6);
      roundRect(ctx, x, y, cw, 4.2, 0.7);
      ctx.strokeStyle = on ? GOLD : "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = on ? 0.35 : 0.2;
      ctx.stroke();
    });
    const boss = v.bosses[st.boss];
    if (boss) label(ctx, `Room ${n} is the boss: ${boss.name}`, px + pw / 2, top + 39, 1.5, boss.color, "center", pw);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(v.clock / 200);
    label(ctx, "Up and down: stage. Left and right: room. Space to go in", W / 2, g.FIELD_H - 2.6, 1.9, "#ffffff", "center", W - 4);
    ctx.globalAlpha = 1;
  }

  return Object.freeze({ drawPicker, drawSelect, stageColor });
}
