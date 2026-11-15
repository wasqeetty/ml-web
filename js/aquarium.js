/* สายเรียน (SaiRian) — แม่น้ำของแต่ละคน (หน้าโปรไฟล์): มองจากด้านข้าง เห็นตลิ่งตามฤดูที่เลือก น้ำไหล และปลาที่ปล่อยไว้ว่ายไปมา */
(() => {
"use strict";
const A = window.App;

const SCENES = {
  "":      { name: "แม่น้ำปกติ", sky: ["#7FB8E8", "#D3E9F8"], hill: "#7FA38A", hill2: "#97B9A0", ground: "#5E8F4C", grass: "#79B05E", trees: ["#3C7D3A", "#4C8C3E"], wt: "#3E9BD0", wd: "#163F66", sun: 1 },
  spring:  { name: "ฤดูใบไม้ผลิ", sky: ["#9CC9EE", "#F9DCE8"], hill: "#A9BED0", hill2: "#C2D2DE", ground: "#7BAE5F", grass: "#93C474", trees: ["#F2A9C4", "#F7C6D8", "#E58FB0"], wt: "#4FA6D6", wd: "#1A5280", fall: "petal", sun: 1 },
  summer:  { name: "ฤดูร้อน", sky: ["#3E8FD8", "#C2E5FB"], hill: "#5F9470", hill2: "#7DAE86", ground: "#4C8C3A", grass: "#67A84A", trees: ["#2F6B34", "#3C7D3A", "#4C8C3E"], wt: "#2F9AD8", wd: "#0F4A78", sun: 1, hot: 1 },
  autumn:  { name: "ฤดูใบไม้ร่วง", sky: ["#E9A46A", "#F9DDB0"], hill: "#B58763", hill2: "#CDA27E", ground: "#9A7340", grass: "#B38A4E", trees: ["#D9762F", "#B8452A", "#E3A33F"], wt: "#4F86AC", wd: "#1A3F5E", fall: "leaf", sun: 1 },
  winter:  { name: "ฤดูหนาว", sky: ["#AFC4DA", "#EEF3F9"], hill: "#DDE6F0", hill2: "#EEF3F8", ground: "#E4EBF3", grass: "#F4F7FB", trees: ["#24423A", "#2E4D44"], pine: 1, snow: 1, wt: "#7FB6D8", wd: "#24547A", fall: "snow", ice: 1 },
  rainy:   { name: "ฤดูฝน", sky: ["#5F6E7A", "#A3B0BA"], hill: "#55646E", hill2: "#6E7D86", ground: "#3F6B45", grass: "#528058", trees: ["#2C5236", "#355E3E"], pine: 1, wt: "#56788C", wd: "#1C3344", fall: "rain" },
  firefly: { name: "คืนหิ่งห้อย", sky: ["#050A1A", "#142648"], hill: "#0F1F33", hill2: "#162A40", ground: "#13291D", grass: "#1D3D2A", trees: ["#0E241A", "#12301F"], wt: "#123A63", wd: "#04142A", fall: "firefly", night: 1 }
};
A.RIVER_SCENES = SCENES;

const rnd0 = s => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
const mod = (a, n) => ((a % n) + n) % n;

/* mount(canvas) → { set({season, fish}), stop() } */
A.Aquarium = canvas => {
  const g = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, S = SCENES[""], swimmers = [], raf = 0, last = 0, t0 = performance.now();
  const R = rnd0(7);
  const trees = Array.from({ length: 14 }, () => ({ x: R(), s: .7 + R() * .6, c: Math.floor(R() * 3) }));
  const weeds = Array.from({ length: 16 }, () => ({ x: R(), h: .5 + R() * .7, ph: R() * 6, c: R() }));
  const stones = Array.from({ length: 22 }, () => ({ x: R(), r: .4 + R() * .8, c: R() }));
  const streaks = Array.from({ length: 26 }, () => ({ x: R(), y: R(), l: .3 + R() * .7, sp: .5 + R() }));
  const bubbles = Array.from({ length: 14 }, () => ({ x: R(), ph: R(), sp: .5 + R() * .8, r: .6 + R() }));
  const parts = Array.from({ length: 46 }, () => ({ x: R(), y: R(), sp: R(), v: R() * 2 - 1 }));
  const stars = Array.from({ length: 50 }, () => ({ x: R(), y: R(), r: R() }));

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (reduced) frame(performance.now());
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  function set(o) {
    S = SCENES[o.season] || SCENES[""];
    const ids = (o.fish || []).filter(id => A.fish(id)).slice(0, 8);
    swimmers = ids.map((id, i) => {
      const r = rnd0(i * 17 + id.length * 5 + 3);
      return { id, x: r(), lane: .2 + (i % 4) * .2 + r() * .08, dir: r() < .5 ? -1 : 1, sp: .028 + r() * .025, ph: r() * 6, turn: 1 };
    });
    if (reduced) frame(performance.now());
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const skyH = H * .3, bankY = H * .4, wTop = H * .42;
    // ท้องฟ้า
    let gr = g.createLinearGradient(0, 0, 0, bankY); gr.addColorStop(0, S.sky[0]); gr.addColorStop(1, S.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, bankY + 2);
    if (S.night) stars.forEach(s => { g.fillStyle = `rgba(255,255,255,${.3 + .6 * Math.abs(Math.sin(t * .8 + s.r * 9))})`; g.fillRect(s.x * W, s.y * skyH * .9, 1.4, 1.4); });
    if (S.sun || S.night) {
      const sx = W * .82, sy = skyH * .42, sr = Math.max(10, H * .06);
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 4); sg.addColorStop(0, S.night ? "rgba(220,230,255,.5)" : S.hot ? "rgba(255,240,180,.8)" : "rgba(255,245,215,.65)"); sg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = sg; g.fillRect(sx - sr * 4, 0, sr * 8, bankY);
      g.fillStyle = S.night ? "#EEF2FF" : "#FFF6D8"; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    }
    // เนินเขา 2 ชั้น
    [[S.hill2, .2, .7, 1.3], [S.hill, .27, 1.1, 2.1]].forEach(([c, base, amp, fq]) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, bankY);
      for (let x = 0; x <= W + 10; x += 10) g.lineTo(x, H * base + Math.sin(x / W * Math.PI * fq + base * 9) * H * .05 * amp);
      g.lineTo(W, bankY); g.closePath(); g.fill();
    });
    // ตลิ่ง + ต้นไม้
    g.fillStyle = S.ground; g.fillRect(0, H * .33, W, wTop - H * .33 + 2);
    trees.forEach(tr => {
      const x = tr.x * W, by = H * .345, s = tr.s * H * .07, c = S.trees[tr.c % S.trees.length];
      g.fillStyle = "rgba(60,40,25,.85)"; g.fillRect(x - s * .08, by - s * .6, s * .16, s * .65);
      g.fillStyle = c;
      if (S.pine) { g.beginPath(); g.moveTo(x, by - s * 2); g.lineTo(x - s * .65, by - s * .4); g.lineTo(x + s * .65, by - s * .4); g.closePath(); g.fill(); }
      else { g.beginPath(); g.arc(x, by - s, s * .75, 0, Math.PI * 2); g.arc(x - s * .45, by - s * .7, s * .5, 0, Math.PI * 2); g.arc(x + s * .45, by - s * .7, s * .5, 0, Math.PI * 2); g.fill(); }
      if (S.snow) { g.fillStyle = "rgba(250,252,255,.95)"; g.beginPath(); g.arc(x, by - s * (S.pine ? 1.75 : 1.4), s * .35, Math.PI, 0); g.fill(); }
    });
    g.strokeStyle = S.grass; g.lineWidth = 1.4;
    for (let i = 0; i < W; i += 7) { const h = 3 + (i * 7 % 5); g.beginPath(); g.moveTo(i, wTop); g.lineTo(i + 1.5, wTop - h); g.stroke(); }
    // น้ำ
    gr = g.createLinearGradient(0, wTop, 0, H); gr.addColorStop(0, S.wt); gr.addColorStop(1, S.wd);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, wTop + Math.sin(x * .025 + t * 1.6) * 2.2);
    g.lineTo(W, H); g.closePath(); g.fill();
    if (S.ice) { g.strokeStyle = "rgba(240,248,255,.85)"; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, wTop + Math.sin(x * .025 + t * 1.6) * 2.2); g.stroke(); }
    // แสงลอดผิวน้ำ
    if (!S.night) for (let i = 0; i < 5; i++) {
      const x = mod(i * W * .23 + t * 6, W + 120) - 60, lg = g.createLinearGradient(0, wTop, 0, H * .95);
      lg.addColorStop(0, "rgba(255,255,255,.13)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.beginPath(); g.moveTo(x, wTop); g.lineTo(x + 26, wTop); g.lineTo(x + 70, H); g.lineTo(x + 20, H); g.closePath(); g.fill();
    }
    // กระแสน้ำไหล (ซ้าย ← ขวา)
    g.strokeStyle = "rgba(255,255,255,.16)"; g.lineCap = "round"; g.lineWidth = 1.2;
    streaks.forEach(s => { const x = W + 40 - mod(s.x * (W + 80) + t * 26 * s.sp, W + 80), y = wTop + 8 + s.y * (H - wTop - 16), l = 10 + s.l * 26;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); });
    // ก้อนหิน + สาหร่าย (หลัง)
    stones.forEach(s => { g.fillStyle = `rgba(${S.night ? "30,40,55" : "70,80,90"},${.5 + s.c * .3})`; g.beginPath(); g.ellipse(s.x * W, H - 3, 6 + s.r * 12, 4 + s.r * 6, 0, Math.PI, 0); g.fill(); });
    weeds.forEach((w, i) => { if (i % 2) return; drawWeed(w, t, H * .55); });
    // ปลา
    const dt = Math.min(.05, Math.max(0, (now - (last || now)) / 1000)); last = now;
    const fishH = H - wTop;
    swimmers.forEach(f => {
      const sp = A.fish(f.id), L = Math.max(22, Math.min(W * .14, fishH * .3)) * sp.size;
      if (!reduced) {
        f.x += f.dir * f.sp * dt * (sp.rarity === "legendary" ? .8 : 1);
        const m = (L / W) * .7;
        if (f.x > 1 + m) { f.dir = -1; } else if (f.x < -m) { f.dir = 1; }
      }
      const x = f.x * W, y = wTop + fishH * (.18 + f.lane * .62) + Math.sin(t * .9 + f.ph) * fishH * .04;
      A.drawFish(g, f.id, x, y, L, t + f.ph, { dir: f.dir, phase: f.ph });
    });
    weeds.forEach((w, i) => { if (!(i % 2)) return; drawWeed(w, t, H * .45); });
    // ฟองอากาศ
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 1;
    bubbles.forEach(b => { const ph = mod(b.ph + t * .12 * b.sp, 1), y = H - ph * (H - wTop), x = b.x * W + Math.sin(t * 2 + b.ph * 9) * 4;
      g.globalAlpha = Math.sin(Math.PI * ph); g.beginPath(); g.arc(x, y, 1.5 + b.r * 2, 0, Math.PI * 2); g.stroke(); });
    g.globalAlpha = 1;
    // สิ่งที่ตก/ลอยตามฤดู
    if (S.fall) parts.forEach((p, i) => {
      if (S.fall === "rain") { const y = mod(p.y * H + t * (300 + p.sp * 160), H), x = mod(p.x * W + t * 60, W);
        g.strokeStyle = "rgba(210,225,255,.45)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 9); g.stroke(); return; }
      if (S.fall === "firefly") { if (i > 22) return; const x = p.x * W + Math.sin(t * .6 + i) * 14, y = H * (.12 + p.y * .32) + Math.cos(t * .8 + i) * 8, b = Math.pow((Math.sin(t * 2 + i * 1.7) + 1) / 2, 3);
        const fg = g.createRadialGradient(x, y, 0, x, y, 7); fg.addColorStop(0, `rgba(230,255,140,${b})`); fg.addColorStop(1, "rgba(230,255,140,0)"); g.fillStyle = fg; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); return; }
      const y = mod(p.y * wTop + t * (14 + p.sp * 16), wTop + 10) - 5, x = mod(p.x * W + Math.sin(t * .8 + p.v * 5) * 12 + t * 8, W);
      if (S.fall === "snow") { g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(x, y, 1.2 + p.sp * 1.6, 0, Math.PI * 2); g.fill(); return; }
      g.save(); g.translate(x, y); g.rotate(t * (1 + p.sp) + p.x * 6);
      g.fillStyle = S.fall === "leaf" ? S.trees[i % S.trees.length] : "#F7BCD2";
      g.beginPath(); g.ellipse(0, 0, S.fall === "leaf" ? 4 : 3, S.fall === "leaf" ? 2 : 1.7, 0, 0, Math.PI * 2); g.fill(); g.restore();
    });
  }
  function drawWeed(w, t, hmax) {
    const x = w.x * W, h = hmax * w.h * .5, sw = Math.sin(t * 1.2 + w.ph) * 8;
    g.strokeStyle = S.night ? "rgba(40,90,70,.8)" : `rgba(${60 + w.c * 30},${130 + w.c * 40},${80},.75)`; g.lineWidth = 3; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + sw, H - h * .5, x + sw * 1.6, H - h); g.stroke();
  }
  function loop(now) {
    if (!canvas.isConnected) { stop(); return; }
    raf = requestAnimationFrame(loop);
    if (document.hidden || now - last < 33) return;
    frame(now);
  }
  function stop() { cancelAnimationFrame(raf); ro.disconnect(); }
  resize();
  if (reduced) frame(performance.now()); else raf = requestAnimationFrame(loop);
  return { set, stop };
};
})();
