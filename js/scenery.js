/* ML WEB — พื้นหลังฉากแม่น้ำ
   • ฤดูสุ่มวันละครั้ง (จากวันที่ ทุกเครื่องเห็นเหมือนกัน) และแต่ละฤดูมีแม่น้ำ ภูเขา ต้นไม้ คนละแบบ
   • แสงตามเวลาจริง: เช้าตรู่ → กลางวัน → ยามเย็น → กลางคืน (มีพระจันทร์ ดาว แสงเหนือ หิ่งห้อย)
   • ชั้นนิ่ง (ฟ้า / แผ่นดิน) วาดใหม่เมื่อปรับขนาดจอหรือทุก 5 นาที ชั้นเคลื่อนไหววาด ~30fps
     และหยุดเมื่อแท็บซ่อนหรืออยู่ในโหมดโฟกัส */
(() => {
"use strict";
const cv = document.getElementById("scenery");
if (!cv) return;
const cx = cv.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- utils ---------- */
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, al = 1) => `rgba(${c.map(v => Math.round(Math.max(0, Math.min(255, v)))).join(",")},${al})`;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.max(0, Math.min(1, x));
const pad = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ---------- ฤดู: แต่ละฤดูมีแม่น้ำของตัวเอง ---------- */
const SEASONS = {
  spring: { name: "ฤดูใบไม้ผลิ", hy: .52, mtn: ["#A9BED0", "#86A0B4", "#64836F"], peaks: false, groundFar: "#86AE6A", ground: "#5E8F4C",
    trees: ["#F2A9C4", "#F7C6D8", "#6A9C58"], pine: false, water: "#5E9CC8",
    river: t => ({ x: .5 + .22 * Math.sin(t * 4.2 + .3) * (.3 + .7 * t), w: .004 + .24 * t * t }),
    dots: ["#FFFFFF", "#F7C6D8", "#FBE38A"], fall: "petal", nightFx: "firefly" },
  summer: { name: "ฤดูร้อน", hy: .47, mtn: ["#9BB3CC", "#7090AA", "#3F6B4A"], peaks: true, capFar: true, groundFar: "#64A048", ground: "#3F7E33",
    trees: ["#2F6B34", "#3C7D3A", "#4C8C3E"], pine: false, water: "#3C8ECB",
    river: t => ({ x: .44 + .1 * Math.sin(t * 2 + 1), w: .03 + .44 * Math.pow(t, 1.5) }),
    dots: ["#FAD650", "#FFFFFF"], fall: null, nightFx: "firefly" },
  autumn: { name: "ฤดูใบไม้ร่วง", hy: .56, mtn: ["#CDA494", "#A9735E", "#7A4A3A"], peaks: false, groundFar: "#A47D44", ground: "#7E5C30",
    trees: ["#D9762F", "#B8452A", "#E3A33F", "#C9612C"], pine: false, water: "#5A86A8",
    river: t => ({ x: .56 + .17 * Math.sin(t * 5.5 + 1.2) * (.2 + .8 * t), w: .002 + .15 * t * t }),
    dots: ["#C9612C", "#E3A33F", "#B8452A"], fall: "leaf", nightFx: null },
  winter: { name: "ฤดูหนาว", hy: .5, mtn: ["#EEF3F9", "#CFDBE8", "#A3B6CB"], peaks: true, snow: true, groundFar: "#E4EBF3", ground: "#D5DFEA",
    trees: ["#24423A", "#2E4D44"], pine: true, water: "#86BCDB", ice: true,
    river: t => ({ x: .5 + .25 * Math.sin(t * 3 + 2.4) * (.25 + .75 * t), w: .003 + .22 * t * t }),
    dots: null, fall: "snow", nightFx: "aurora" },
  rainy: { name: "ฤดูฝน", hy: .5, mtn: ["#7C8B95", "#5E6D77", "#41525A"], peaks: false, groundFar: "#4E7C52", ground: "#355E3B",
    trees: ["#2C5236", "#355E3E"], pine: true, water: "#56788C", overcast: true, waterfall: true,
    river: t => ({ x: .3 + .3 * t + .06 * Math.sin(t * 6), w: .006 + .28 * t * t }),
    dots: null, fall: "rain", nightFx: null }
};
const ORDER = ["spring", "summer", "autumn", "winter", "rainy"];
function seasonOf(key) { let h = 2166136261; for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16; return ORDER[(h >>> 0) % ORDER.length]; }

/* ---------- แสงตามเวลาจริง ---------- */
const LIGHTS = {
  night:  { name: "กลางคืน", sky: ["#04060F", "#0A1128", "#152246", "#22335E"], amb: .3, tint: "#22305A", glow: "#9FB4E6" },
  dawn:   { name: "เช้าตรู่", sky: ["#1E2450", "#5A4C86", "#D88A9A", "#F7C2A2"], amb: .78, tint: "#F2B6A8", glow: "#FFC8A8" },
  day:    { name: "กลางวัน", sky: ["#2C6CB6", "#5B98D6", "#A6CBEA", "#E2EEF7"], amb: 1, tint: "#FFFFFF", glow: "#FFF6E0" },
  golden: { name: "ยามเย็น", sky: ["#1B1A40", "#5A3A6E", "#D9806C", "#F8C98E"], amb: .8, tint: "#F2A070", glow: "#FFD3A0" }
};
const KEYS = [[0, "night"], [5, "night"], [6.4, "dawn"], [8.4, "day"], [16, "day"], [18, "golden"], [19.5, "night"], [24, "night"]];
function lightAt(h) {
  let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
  const [ha, ka] = KEYS[i], [hb, kb] = KEYS[i + 1], t = clamp01((h - ha) / (hb - ha));
  const A = LIGHTS[ka], B = LIGHTS[kb];
  return {
    key: t < .5 ? ka : kb, name: (t < .5 ? A : B).name,
    sky: A.sky.map((c, j) => mixA(hex(c), hex(B.sky[j]), t)),
    amb: lerp(A.amb, B.amb, t), tint: mixA(hex(A.tint), hex(B.tint), t), glow: mixA(hex(A.glow), hex(B.glow), t),
    night: clamp01(1 - (lerp(A.amb, B.amb, t) - .3) / .5)            // 0 กลางวัน → 1 กลางคืน
  };
}
const NIGHT = hex("#080C1E");

/* ---------- state ---------- */
let W = 0, H = 0, dpr = 1, hy = 0, skyL = null, landL = null, SZ = null, L = null, hour = 12, stamp = "";
const rx = t => W * SZ.river(t).x;
const rw = t => W * SZ.river(t).w + 2;
const ry = t => hy + (H - hy) * t;
const shade = (c, k = 1) => { const lit = mixA(hex(c), L.tint, .12 * (1 - L.night)); return mixA(lit, NIGHT, (1 - L.amb) * k); };
function bodyPos() {
  // ดวงอาทิตย์ 6–19 น. / ดวงจันทร์ 19–6 น. เดินโค้งข้ามฟ้า
  const sun = hour >= 6 && hour < 19.3, span = sun ? 13.3 : 10.7;
  const prog = sun ? (hour - 6) / span : ((hour - 19.3 + 24) % 24) / span;
  return { sun, x: W * (.12 + .76 * prog), y: hy - Math.sin(Math.PI * clamp01(prog)) * hy * .72 + 10 };
}

/* ---------- ชั้นนิ่ง ---------- */
function build() {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(1.5, window.devicePixelRatio || 1);
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const now = new Date(); hour = now.getHours() + now.getMinutes() / 60;
  // สุ่มฤดูใหม่ทุกชั่วโมง (ทุกเครื่องได้ฤดูเดียวกันในชั่วโมงเดียวกัน) และไม่ให้ซ้ำกับชั่วโมงก่อน
  const hk = d => `${dayKey(d)}|${d.getHours()}`;
  let sk = seasonOf(hk(now));
  if (sk === seasonOf(hk(new Date(now.getTime() - 3600e3)))) sk = ORDER[(ORDER.indexOf(sk) + 1) % ORDER.length];
  // ช่องทดสอบ: localStorage "mlweb.sceneTest" = {"season":"winter","hour":22}
  try { const ov = JSON.parse(localStorage.getItem("mlweb.sceneTest") || "null"); if (ov) { if (SEASONS[ov.season]) sk = ov.season; if (ov.hour != null) hour = +ov.hour; } } catch (e) {}
  SZ = SEASONS[sk]; L = lightAt(hour);
  hy = H * (W / H < .9 ? SZ.hy - .06 : SZ.hy);
  stamp = `${dayKey(now)}|${Math.floor(hour * 12)}`;
  window.SceneInfo = { season: sk, seasonName: SZ.name, phase: L.key, phaseName: L.name };
  document.dispatchEvent(new Event("scenechange"));

  const mk = () => { const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, g]; };
  let g; [skyL, g] = mk(); drawSky(g); [landL, g] = mk(); drawLand(g);
}

function drawSky(g) {
  const rnd = rng(11);
  const sky = g.createLinearGradient(0, 0, 0, hy);
  L.sky.forEach((c, i) => sky.addColorStop(i / (L.sky.length - 1), css(SZ.overcast ? mixA(c, [96, 106, 118], .5 * (1 - L.night * .5)) : c)));
  g.fillStyle = sky; g.fillRect(0, 0, W, hy + 4);
  const starA = clamp01(L.night * 1.2 - .15) * (SZ.overcast ? .25 : 1);
  if (starA > 0) for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${(.2 + rnd() * .7) * starA})`; const s = rnd() < .92 ? 1 : 1.8; g.fillRect(rnd() * W, rnd() * hy * .7, s, s); }
  const b = bodyPos();
  const gl = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, H * (b.sun ? .6 : .35));
  gl.addColorStop(0, css(L.glow, b.sun ? .7 : .35)); gl.addColorStop(.2, css(L.glow, b.sun ? .25 : .1)); gl.addColorStop(1, css(L.glow, 0));
  g.fillStyle = gl; g.fillRect(0, 0, W, hy + 4);
  const R = Math.max(10, H * (b.sun ? .03 : .026));
  if (b.sun) { g.fillStyle = css(mixA(L.glow, [255, 255, 255], .5), SZ.overcast ? .45 : .95); g.beginPath(); g.arc(b.x, b.y, R, 0, Math.PI * 2); g.fill(); }
  else { g.fillStyle = `rgba(236,240,255,${SZ.overcast ? .4 : .95})`; g.beginPath(); g.arc(b.x, b.y, R, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(180,190,215,.35)"; [[-.3, -.2, .22], [.25, .15, .16], [-.05, .35, .12]].forEach(([a, c, s]) => { g.beginPath(); g.arc(b.x + a * R, b.y + c * R, s * R, 0, Math.PI * 2); g.fill(); }); }
  // เมฆ
  const nc = SZ.overcast ? 14 : 6, cr = rng(23);
  for (let i = 0; i < nc; i++) {
    const x = cr() * W, y = hy * (.1 + cr() * .55), w = W * (.12 + cr() * .2), h = w * .22;
    const base = SZ.overcast ? [120, 128, 140] : [255, 255, 255];
    const col = mixA(mixA(base, L.glow, .35), NIGHT, L.night * .75);
    const cg = g.createRadialGradient(x, y, 0, x, y, w / 2);
    cg.addColorStop(0, css(col, SZ.overcast ? .55 : .28)); cg.addColorStop(1, css(col, 0));
    g.save(); g.translate(x, y); g.scale(1, h / (w / 2)); g.translate(-x, -y); g.fillStyle = cg; g.beginPath(); g.arc(x, y, w / 2, 0, Math.PI * 2); g.fill(); g.restore();
  }
}

function drawLand(g) {
  const rnd = rng(77);
  // ภูเขา 3 ชั้น
  SZ.mtn.forEach((col, k) => {
    const s = rng(100 + k * 7 + ORDER.indexOf(window.SceneInfo.season) * 31);
    const ph = [s() * 6, s() * 6, s() * 6], amp = H * (SZ.peaks ? .1 + .045 * (2 - k) : .05 + .03 * k), by = hy + k * H * .008;
    const ridge = u => SZ.peaks
      ? by - amp * (.35 + .55 * Math.pow(Math.abs(Math.sin(u * (2.2 + k) + ph[0])), .7) + .1 * Math.sin(u * 13 + ph[1]))
      : by - amp * (.55 + .25 * Math.sin(u * (3 + k) + ph[0]) + .15 * Math.sin(u * (9 + k * 2) + ph[1]) + .05 * Math.sin(u * 27 + ph[2]));
    g.fillStyle = css(shade(col, .9 + k * .05), k === 0 ? .9 : 1);
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 6; x += 5) g.lineTo(x, ridge(x / W));
    g.lineTo(W, H); g.closePath(); g.fill();
    if (SZ.snow || (SZ.capFar && k === 0)) {           // หิมะบนยอด
      g.save(); g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 6; x += 5) g.lineTo(x, ridge(x / W)); g.lineTo(W, H); g.closePath(); g.clip();
      g.fillStyle = css(shade("#FFFFFF", .8), .85); g.fillRect(0, by - amp * 1.05, W, amp * (SZ.snow ? .45 : .3)); g.restore();
    }
    const mist = g.createLinearGradient(0, by - amp * .5, 0, by + 6);
    mist.addColorStop(0, css(L.glow, 0)); mist.addColorStop(1, css(mixA(L.glow, [255, 255, 255], .4), (.24 - k * .05) * (1 - L.night * .5)));
    g.fillStyle = mist; g.fillRect(0, by - amp * .5, W, amp * .5 + 6);
  });
  // พื้นดิน
  const gr = g.createLinearGradient(0, hy, 0, H);
  gr.addColorStop(0, css(shade(SZ.groundFar))); gr.addColorStop(1, css(mixA(shade(SZ.ground), NIGHT, .35)));
  g.fillStyle = gr; g.fillRect(0, hy, W, H - hy);
  // จุดดอกไม้ / ใบไม้บนพื้น
  if (SZ.dots) for (let i = 0; i < 220; i++) {
    const t = .08 + Math.pow(rnd(), .8) * .92, side = rnd() < .5 ? -1 : 1, x = rx(t) + side * (rw(t) + 6 + rnd() * W * .45);
    g.fillStyle = css(shade(SZ.dots[i % SZ.dots.length]), .8); const s = .8 + t * 3; g.beginPath(); g.arc(x, ry(t), s, 0, Math.PI * 2); g.fill();
  }
  // น้ำตก (ฤดูฝน) ไหลจากหน้าผาซ้ายลงต้นแม่น้ำ
  if (SZ.waterfall) {
    const fx = rx(.04), top = hy - H * .15, cw = W * .13;
    // หน้าผาหินโค้งๆ ขอบไม่เรียบ มีต้นไม้บนยอด
    g.fillStyle = css(mixA(shade("#46524F"), NIGHT, .15)); g.beginPath(); g.moveTo(fx - cw, hy + 8);
    g.bezierCurveTo(fx - cw * .9, top + H * .05, fx - cw * .55, top - H * .01, fx - cw * .2, top);
    for (let i = 0; i <= 8; i++) g.lineTo(fx - cw * .2 + i * cw * .07, top - H * .006 * Math.sin(i * 2.3) - H * .004 * i);
    g.bezierCurveTo(fx + cw * .55, top + H * .02, fx + cw * .8, hy - H * .03, fx + cw, hy + 8); g.closePath(); g.fill();
    g.fillStyle = css(mixA(shade(SZ.trees[0]), NIGHT, .25));
    for (let i = 0; i < 9; i++) { const x = fx - cw * .25 + i * cw * .075, y = top - H * .004 * i, h = H * (.02 + .012 * (i % 3)); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * .3, y + 2); g.lineTo(x - h * .3, y + 2); g.closePath(); g.fill(); }
    // สายน้ำตกหลายเส้น จางลงด้านล่างเป็นละออง
    for (let i = 0; i < 5; i++) {
      const x = fx - W * .008 + i * W * .004, w = W * (.003 + (i % 2) * .002);
      const wf = g.createLinearGradient(0, top, 0, hy);
      wf.addColorStop(0, css(mixA(shade("#E6F1F6"), [255, 255, 255], .2), .9)); wf.addColorStop(1, css(shade("#E6F1F6"), .35));
      g.fillStyle = wf; g.fillRect(x, top - H * .004 * 3, w, hy - top + 6);
    }
    const sprayG = g.createRadialGradient(fx, hy, 0, fx, hy, W * .05);
    sprayG.addColorStop(0, css(shade("#FFFFFF"), .45)); sprayG.addColorStop(1, css(shade("#FFFFFF"), 0));
    g.fillStyle = sprayG; g.beginPath(); g.ellipse(fx, hy, W * .05, H * .02, 0, 0, Math.PI * 2); g.fill();
  }
  // ตัวแม่น้ำ
  const wc = hex(SZ.water), horizon = L.sky[L.sky.length - 1];
  const wg = g.createLinearGradient(0, hy, 0, H);
  wg.addColorStop(0, css(mixA(horizon, [255, 255, 255], .1))); wg.addColorStop(.25, css(mixA(mixA(wc, horizon, .45), NIGHT, (1 - L.amb) * .6)));
  wg.addColorStop(1, css(mixA(mixA(wc, [10, 30, 60], .4), NIGHT, (1 - L.amb) * .8)));
  g.fillStyle = wg; g.beginPath();
  for (let i = 0; i <= 90; i++) { const t = i / 90; g.lineTo(rx(t) - rw(t), ry(t)); }
  for (let i = 90; i >= 0; i--) { const t = i / 90; g.lineTo(rx(t) + rw(t), ry(t)); }
  g.closePath(); g.fill();
  const b = bodyPos();                                  // เงาดวงอาทิตย์/ดวงจันทร์ในน้ำ
  g.save(); g.clip();
  const col = g.createLinearGradient(0, hy, 0, hy + (H - hy) * .75);
  col.addColorStop(0, css(mixA(L.glow, [255, 255, 255], .3), SZ.overcast ? .2 : .55)); col.addColorStop(1, css(L.glow, 0));
  g.fillStyle = col; g.fillRect(b.x - W * .05, hy, W * .1, H); g.restore();
  if (SZ.ice) { g.strokeStyle = css(shade("#F4F9FF"), .9); g.lineWidth = 3;
    [-1, 1].forEach(sd => { g.beginPath(); for (let i = 0; i <= 90; i++) { const t = i / 90; g.lineTo(rx(t) + sd * rw(t), ry(t)); } g.stroke(); }); }
  // ต้นไม้ริมตลิ่ง
  const tree = (x, y, h, c, i) => {
    g.fillStyle = css(c);
    if (SZ.pine) {
      g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * .28, y); g.lineTo(x - h * .28, y); g.closePath(); g.fill();
      if (SZ.snow) { g.fillStyle = css(shade("#FFFFFF", .8), .9); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * .12, y - h * .58); g.lineTo(x - h * .12, y - h * .58); g.closePath(); g.fill(); }
    } else {
      g.fillRect(x - h * .04, y - h * .45, h * .08, h * .45);
      g.beginPath(); g.arc(x, y - h * .6, h * .32, 0, Math.PI * 2); g.arc(x - h * .2, y - h * .48, h * .22, 0, Math.PI * 2); g.arc(x + h * .2, y - h * .5, h * .24, 0, Math.PI * 2); g.fill();
    }
  };
  const trees = [];
  for (let i = 0; i < 180; i++) {
    const t = .03 + Math.pow(rnd(), 1.3) * .65, side = rnd() < .5 ? -1 : 1;
    trees.push([t, rx(t) + side * (rw(t) + 4 + rnd() * W * (.02 + .3 * t)), (5 + rnd() * 9) * (.3 + t * 5), i]);
  }
  trees.sort((a, b) => a[0] - b[0]).forEach(([t, x, h, i]) => tree(x, ry(t) + 2, h, mixA(shade(SZ.trees[i % SZ.trees.length]), NIGHT, Math.min(.5, t * .5) + (SZ.pine ? 0 : .05)), i));
  // เนินด้านหน้าสองฝั่ง
  const fg = mixA(shade(SZ.ground), NIGHT, .55);
  [true, false].forEach(left => {
    g.fillStyle = css(fg); g.beginPath(); g.moveTo(left ? 0 : W, H);
    for (let i = 0; i <= 40; i++) {
      const t = .68 + i / 40 * .32, edge = left ? rx(t) - rw(t) - 8 : rx(t) + rw(t) + 8;
      const lim = left ? Math.min(edge, W * (.16 + (1 - t) * .5)) : Math.max(edge, W * (.84 - (1 - t) * .5));
      g.lineTo(lim + Math.sin(i * .9) * 5, ry(t));
    }
    g.lineTo(left ? 0 : W, ry(.68)); g.closePath(); g.fill();
  });
  for (let i = 0; i < 22; i++) { const left = i % 2 === 0, x = left ? rnd() * W * .2 : W - rnd() * W * .2; tree(x, ry(.7 + rnd() * .1) + 4, 40 + rnd() * 70, mixA(fg, NIGHT, .2), i); }
}

/* ---------- ชั้นเคลื่อนไหว ---------- */
const R2 = rng(9);
const glints = Array.from({ length: 90 }, () => ({ u: (R2() * 2 - 1) * .85, t0: R2(), sp: .028 + R2() * .03 }));
const mists = Array.from({ length: 5 }, () => ({ x: R2(), y: R2() * .06 - .01, w: .35 + R2() * .3, sp: .004 + R2() * .006, al: .07 + R2() * .06 }));
const birds = Array.from({ length: 4 }, () => ({ x: R2(), y: .2 + R2() * .2, sp: .006 + R2() * .006, ph: R2() * 6 }));
const parts = Array.from({ length: 90 }, () => ({ a: R2(), r: R2(), v: R2() * 2 - 1, sp: R2() }));
const flies = Array.from({ length: 36 }, () => ({ t: .1 + R2() * .6, side: R2() < .5 ? -1 : 1, off: R2(), ph: R2() * 30 }));

function frame(time) {
  const s = time / 1000, mod = (a, n) => ((a % n) + n) % n;
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.drawImage(skyL, 0, 0);
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // แสงเหนือ (ฤดูหนาวกลางคืน) อยู่หลังภูเขา
  if (SZ.nightFx === "aurora" && L.night > .3) {
    const a = (L.night - .3) / .7;
    for (let k = 0; k < 3; k++) {
      const g = cx.createLinearGradient(0, hy * .1, 0, hy * .75);
      g.addColorStop(0, `rgba(120,90,255,0)`); g.addColorStop(.5, `rgba(${k === 1 ? "140,120,255" : "80,255,170"},${.22 * a})`); g.addColorStop(1, `rgba(80,255,170,0)`);
      cx.fillStyle = g; cx.beginPath();
      for (let x = 0; x <= W; x += 12) cx.lineTo(x, hy * (.18 + k * .1) + Math.sin(x / W * 5 + s * .25 + k * 2) * hy * .08);
      for (let x = W; x >= 0; x -= 12) cx.lineTo(x, hy * (.58 + k * .06) + Math.sin(x / W * 4 + s * .2 + k) * hy * .06);
      cx.closePath(); cx.fill();
    }
  }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.drawImage(landL, 0, 0);
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // หมอก
  mists.forEach(m => {
    const x = ((m.x + s * m.sp) % 1.6 - .3) * W, y = hy + m.y * H, w = m.w * W, h = H * .05;
    const g = cx.createRadialGradient(x, y, 0, x, y, w / 2);
    g.addColorStop(0, css(mixA(L.glow, [255, 255, 255], .5), m.al * (1 - L.night * .4))); g.addColorStop(1, css(L.glow, 0));
    cx.save(); cx.translate(x, y); cx.scale(1, h / (w / 2)); cx.translate(-x, -y); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, w / 2, 0, Math.PI * 2); cx.fill(); cx.restore();
  });
  // ประกายน้ำไหลเข้าหาคนดู
  cx.lineCap = "round";
  const gc = mixA(L.glow, [255, 255, 255], .5);
  glints.forEach(p => {
    const t = (p.t0 + s * p.sp * (.4 + p.t0)) % 1, tt = t * t;
    const x = rx(tt) + p.u * rw(tt), y = ry(tt), len = 2 + 34 * tt;
    cx.strokeStyle = css(gc, Math.sin(Math.PI * t) * (.22 + .45 * (1 - Math.abs(p.u))) * (SZ.overcast ? .6 : 1));
    cx.lineWidth = .8 + tt * 1.6; cx.beginPath(); cx.moveTo(x - len / 2, y); cx.lineTo(x + len / 2, y); cx.stroke();
  });
  // ฟองน้ำตก
  if (SZ.waterfall) {
    const fx = rx(.04), top = hy - H * .15;
    cx.strokeStyle = "rgba(255,255,255,.6)"; cx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { const y = top + mod(s * 110 + i * 19, hy - top); const x = fx - W * .006 + (i % 5) * W * .004; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y + 9); cx.stroke(); }
    const fy = hy + 4; for (let i = 0; i < 6; i++) { const ph = mod(s * .8 + i / 6, 1); cx.strokeStyle = `rgba(255,255,255,${(1 - ph) * .5})`; cx.beginPath(); cx.ellipse(fx, fy, 6 + ph * 26, (6 + ph * 26) * .25, 0, 0, Math.PI * 2); cx.stroke(); }
  }
  // สิ่งที่ตก/ลอยตามฤดู
  const f = SZ.fall;
  if (f) parts.forEach((p, i) => {
    if (f === "rain") {
      const sp = 520 + p.sp * 240, y = mod(p.r * H + s * sp, H + 30) - 15, x = mod(p.a * W + s * sp * .22, W + 20) - 10;
      cx.strokeStyle = `rgba(210,225,255,${.38 - L.night * .1})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - 3, y - 13); cx.stroke();
      if (i % 4 === 0) { const t = .2 + p.r * .8, x2 = rx(t) + p.v * rw(t) * .8, ph = mod(s * 1.3 + p.a, 1);
        cx.strokeStyle = `rgba(255,255,255,${(1 - ph) * .35})`; cx.beginPath(); cx.ellipse(x2, ry(t), (2 + ph * 10) * (.4 + t), (2 + ph * 10) * (.4 + t) * .3, 0, 0, Math.PI * 2); cx.stroke(); }
      return;
    }
    const snow = f === "snow", sp = snow ? 16 + p.sp * 24 : 22 + p.sp * 26;
    const y = mod(p.r * H + s * sp, H + 20) - 10, x = mod(p.a * W + Math.sin(s * .8 + p.v * 6) * 16 + s * (snow ? 5 : 12), W + 20) - 10, sz = .7 + p.sp * .9;
    if (snow) { cx.fillStyle = `rgba(255,255,255,${.8 - L.night * .2})`; cx.beginPath(); cx.arc(x, y, 1.2 + p.sp * 2, 0, Math.PI * 2); cx.fill(); return; }
    const col = f === "leaf" ? shade(SZ.trees[i % SZ.trees.length], .6) : shade("#F7BCD2", .6);
    cx.save(); cx.translate(x, y); cx.rotate(s * (1 + p.sp) * 1.4 + p.a * 6); cx.fillStyle = css(col, .9);
    cx.beginPath(); cx.ellipse(0, 0, (f === "leaf" ? 5 : 3.5) * sz, (f === "leaf" ? 2.4 : 2) * sz, 0, 0, Math.PI * 2); cx.fill(); cx.restore();
  });
  // หิ่งห้อย (ใบไม้ผลิ/ร้อน กลางคืน)
  if (SZ.nightFx === "firefly" && L.night > .4) {
    const a = (L.night - .4) / .6;
    flies.forEach(q => {
      const x = rx(q.t) + q.side * (rw(q.t) + 10 + q.off * W * .2) + Math.sin(s * .7 + q.ph) * 12, y = ry(q.t) - 8 - q.off * 20 + Math.cos(s * .9 + q.ph) * 8;
      const b = Math.pow((Math.sin(s * 2.1 + q.ph) + 1) / 2, 3) * a, r = 5 + q.t * 8;
      const gr = cx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(230,255,150,${b})`); gr.addColorStop(1, "rgba(230,255,150,0)");
      cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
    });
  }
  // นก (กลางวัน/เช้า/เย็น ไม่ใช่วันฝน)
  if (L.night < .5 && !SZ.overcast) {
    cx.strokeStyle = css(mixA([30, 24, 40], NIGHT, L.night), .7); cx.lineWidth = 1.4;
    birds.forEach(bd => { const x = ((bd.x + s * bd.sp) % 1.2 - .1) * W, y = bd.y * hy, fl = Math.sin(s * 5 + bd.ph) * 3;
      cx.beginPath(); cx.moveTo(x - 7, y - 2 - fl); cx.quadraticCurveTo(x - 3, y - 3, x, y); cx.quadraticCurveTo(x + 3, y - 3, x + 7, y - 2 - fl); cx.stroke(); });
  }
}

let last = 0, rt = null;
function loop(ts) {
  requestAnimationFrame(loop);
  if (document.hidden || document.documentElement.classList.contains("locked")) return;
  if (ts - last < 33) return;           // ~30fps พอสำหรับฉากช้าๆ ประหยัดแบตเตอรี่
  last = ts; frame(ts);
}
build(); frame(performance.now());
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { build(); frame(performance.now()); }, 150); });
// ทุก 5 นาที เช็กว่าแสงหรือวันเปลี่ยนหรือยัง
setInterval(() => { const n = new Date(), k = `${dayKey(n)}|${Math.floor((n.getHours() + n.getMinutes() / 60) * 12)}`; if (k !== stamp) { build(); if (reduced) frame(performance.now()); } }, 60000);
if (!reduced) requestAnimationFrame(loop);
})();
