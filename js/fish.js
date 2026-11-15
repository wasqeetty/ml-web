/* สายเรียน (SaiRian) — ปลาที่สะสมได้: รายชื่อ ระดับความหายาก การสุ่ม และวิธีวาด (ใช้ทั้งหน้าจับเวลาและแม่น้ำในโปรไฟล์) */
(() => {
"use strict";
const A = window.App;

A.RARITY = {
  common:    { name: "ทั่วไป",      w: 55, color: "#A9B4C2", rank: 0 },
  uncommon:  { name: "ไม่ธรรมดา",   w: 27, color: "#9AD36A", rank: 1 },
  rare:      { name: "หายาก",       w: 12, color: "#62B4FF", rank: 2 },
  epic:      { name: "หายากมาก",    w: 5,  color: "#C79BFF", rank: 3 },
  legendary: { name: "ตำนาน",       w: 1,  color: "#F5C25B", rank: 4 }
};

/* h = ความสูงตัวเทียบความยาว, c1 = สีหลัง, c2 = สีท้อง, size = ขนาดเทียบปลาปกติ */
A.FISH = [
  { id: "siew", name: "ปลาซิว", rarity: "common", h: .3, c1: "#8FA3B5", c2: "#EEF3F7", fin: "#F2A65A", tail: "fork", dorsal: "small", pat: { t: "line", c: "#2B2F3A" }, size: .7,
    desc: "ตัวเล็ก ว่ายกันเป็นฝูงตามริมน้ำตื้น" },
  { id: "taphian", name: "ปลาตะเพียนเงิน", rarity: "common", h: .42, c1: "#93A3B4", c2: "#F4F6F8", fin: "#E86A5A", tail: "fork", dorsal: "small", pat: { t: "scale", c: "rgba(255,255,255,.55)" }, size: .9,
    desc: "ปลาประจำแม่น้ำไทย เกล็ดสีเงินวาววับ" },
  { id: "nil", name: "ปลานิล", rarity: "common", h: .46, c1: "#6F806A", c2: "#DCE1D2", fin: "#8F7470", tail: "round", dorsal: "spiky", pat: { t: "bars", c: "rgba(35,45,35,.32)", n: 5 }, size: .9,
    desc: "อึด เลี้ยงง่าย เจอได้แทบทุกแหล่งน้ำ" },
  { id: "tiger", name: "ปลาเสือตอ", rarity: "uncommon", h: .48, c1: "#D9A441", c2: "#F7E0A0", fin: "#C98B2E", tail: "round", dorsal: "spiky", pat: { t: "bars", c: "#1F1A14", n: 4, w: .1 }, size: .9,
    desc: "ลายพาดดำเหมือนเสือ ชอบหลบตามตอไม้ใต้น้ำ" },
  { id: "tapgold", name: "ปลาตะเพียนทอง", rarity: "uncommon", h: .42, c1: "#E0A030", c2: "#FFE7A6", fin: "#E5533D", tail: "fork", dorsal: "small", pat: { t: "scale", c: "rgba(255,240,190,.6)" }, size: .9,
    desc: "เกล็ดสีทองครีบแดง คนไทยถือเป็นปลามงคล" },
  { id: "bu", name: "ปลาบู่", rarity: "uncommon", h: .32, c1: "#7A6248", c2: "#DCC7A4", fin: "#8C7458", tail: "round", dorsal: "small", pat: { t: "spots", c: "#3E3024", n: 14 }, size: .85,
    desc: "นิ่งเก่ง ซุ่มอยู่ก้นแม่น้ำได้ทั้งวัน" },
  { id: "betta", name: "ปลากัด", rarity: "rare", h: .34, c1: "#2D3FB0", c2: "#7088F2", fin: "#D1335A", tail: "flow", dorsal: "flow", pat: { t: "shine", c: "rgba(160,190,255,.5)" }, size: .85,
    desc: "ครีบยาวพลิ้วสวย ปลาประจำชาติไทย" },
  { id: "koi", name: "ปลาคาร์ปโคอิ", rarity: "rare", h: .36, c1: "#F7F2EC", c2: "#FFFFFF", fin: "#F2E6DA", tail: "fan", dorsal: "small", pat: { t: "patch", c: "#E8452C", n: 3 }, whisk: 1, size: 1,
    desc: "ลายแดงขาวไม่ซ้ำกันสักตัว ว่ายช้าๆ อย่างสง่า" },
  { id: "puffer", name: "ปลาปักเป้า", rarity: "rare", round: 1, h: .82, c1: "#E8B930", c2: "#FFF2C4", fin: "#D9A21E", tail: "fan", dorsal: "small", pat: { t: "spots", c: "#7A5414", n: 10 }, size: .7,
    desc: "ตกใจทีไรพองตัวกลมเป็นลูกบอล" },
  { id: "angel", name: "ปลาเทวดา", rarity: "epic", h: .62, c1: "#C9CFD8", c2: "#F5F7FA", fin: "#D7DCE3", tail: "fan", dorsal: "tall", pat: { t: "bars", c: "#20232B", n: 3, w: .09 }, size: .9,
    desc: "ครีบบนล่างยาวเหมือนปีกนางฟ้า" },
  { id: "buek", name: "ปลาบึก", rarity: "epic", h: .3, c1: "#5E6B78", c2: "#CBD3DB", fin: "#4D5864", tail: "fork", dorsal: "small", pat: null, whisk: 2, size: 1.4,
    desc: "ปลาน้ำจืดยักษ์แห่งแม่น้ำโขง แม่น้ำกกไหลไปบรรจบแม่น้ำโขงที่เชียงราย" },
  { id: "hinghoi", name: "ปลาหิ่งห้อย", rarity: "epic", h: .36, c1: "#1C2B3A", c2: "#35495C", fin: "#2B4050", tail: "fork", dorsal: "small", pat: { t: "glowdots", c: "#E6FF8C", n: 9 }, glow: "#E6FF8C", size: .85,
    desc: "จุดเรืองแสงตามตัว โผล่มาเฉพาะแม่น้ำที่ใสสะอาด" },
  { id: "moon", name: "ปลาแสงจันทร์", rarity: "legendary", h: .4, c1: "#B9D6FF", c2: "#F4FAFF", fin: "rgba(220,236,255,.75)", tail: "flow", dorsal: "flow", pat: { t: "shine", c: "rgba(255,255,255,.7)" }, glow: "#9CC8FF", sparkle: 1, size: 1.05,
    desc: "ตำนานเล่าว่าว่ายขึ้นมาเฉพาะคืนที่แม่น้ำใสจนเห็นดวงจันทร์" },
  { id: "golden", name: "พญาปลาทอง", rarity: "legendary", h: .4, c1: "#F2B32E", c2: "#FFE9A0", fin: "#FFCF5A", tail: "flow", dorsal: "flow", pat: { t: "scale", c: "rgba(255,248,210,.7)" }, glow: "#FFD36A", whisk: 1, sparkle: 1, size: 1.15,
    desc: "ราชาแห่งแม่น้ำ ใครได้เจอถือว่าโชคดีมาก" }
];
const BY_ID = Object.fromEntries(A.FISH.map(f => [f.id, f]));
A.fish = id => BY_ID[id] || null;

/* สุ่มปลา: luck 0–1 (เรียนยาว/เรียนติดกันหลายวัน) เพิ่มน้ำหนักของระดับที่หายากกว่า */
A.pickFish = luck => {
  luck = Math.max(0, Math.min(1, luck || 0));
  const tiers = Object.entries(A.RARITY).map(([k, r]) => [k, r.w * (1 + r.rank * luck * 1.2)]);
  let x = Math.random() * tiers.reduce((a, t) => a + t[1], 0), tier = "common";
  for (const [k, w] of tiers) { x -= w; if (x < 0) { tier = k; break; } }
  const pool = A.FISH.filter(f => f.rarity === tier);
  return pool[Math.floor(Math.random() * pool.length)].id;
};
A.fishLuck = (focusMin, streak) => 0.5 * Math.min(1, (focusMin || 0) / 100) + 0.5 * Math.min(1, (streak || 0) / 14);

/* ---------- วาดปลา (มองจากด้านข้าง หัวหันไปทางขวา) ----------
   g: context, x,y: จุดกลาง, L: ความยาวตัว (px), t: เวลา (วินาที) ใช้ขยับหาง/ครีบ
   o.dir: 1 หันขวา, -1 หันซ้าย; o.alpha; o.silhouette: สีเงาทั้งตัว (ปลาที่ยังไม่ปลดล็อก/เงาปลา) */
function seeded(n) { let s = n * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
A.drawFish = (g, id, x, y, L, t, o = {}) => {
  const f = BY_ID[id]; if (!f) return;
  const sil = o.silhouette, dir = o.dir || 1, hh = L * f.h / 2, hl = L / 2;
  const wag = Math.sin(t * (f.tail === "flow" ? 4 : 7) + (o.phase || 0));
  g.save();
  g.globalAlpha = o.alpha == null ? 1 : o.alpha;
  g.translate(x, y); g.scale(dir, 1);
  const finC = sil || f.fin;

  if (f.glow && !sil) { g.shadowColor = f.glow; g.shadowBlur = L * .35; }

  // หาง
  g.fillStyle = finC;
  g.beginPath();
  const tx = -hl * (f.round ? .8 : .86), sway = wag * L * .06;
  if (f.tail === "fork") {
    g.moveTo(tx + L * .04, 0);
    g.quadraticCurveTo(tx - L * .12, -hh * .2 + sway, tx - L * .24, -hh * 1.05 + sway);
    g.quadraticCurveTo(tx - L * .14, sway * .5, tx - L * .24, hh * 1.05 + sway);
    g.quadraticCurveTo(tx - L * .12, hh * .2 + sway, tx + L * .04, 0);
  } else if (f.tail === "flow") {
    const ww = Math.sin(t * 3 + 1) * L * .05;
    g.moveTo(tx + L * .06, -hh * .3);
    g.bezierCurveTo(tx - L * .2, -hh * 1.6 + ww, tx - L * .5, -hh * 1.2 + sway, tx - L * .52, hh * .2 + sway + ww);
    g.bezierCurveTo(tx - L * .45, hh * 1.5 + sway, tx - L * .2, hh * 1.6 - ww, tx + L * .06, hh * .3);
  } else {                                            // round / fan
    const r = f.tail === "fan" ? 1.1 : .8;
    g.moveTo(tx + L * .04, -hh * .25);
    g.quadraticCurveTo(tx - L * .26, -hh * r + sway, tx - L * .22, sway);
    g.quadraticCurveTo(tx - L * .26, hh * r + sway, tx + L * .04, hh * .25);
  }
  g.closePath(); g.fill();

  // ครีบหลัง / ครีบท้อง
  g.beginPath();
  if (f.dorsal === "tall") {
    g.moveTo(-hl * .2, -hh * .7); g.quadraticCurveTo(-hl * .1, -hh * 2.2, -hl * .75, -hh * 1.9 + wag * 2); g.quadraticCurveTo(-hl * .5, -hh * .9, -hl * .55, -hh * .5);
    g.moveTo(-hl * .2, hh * .7); g.quadraticCurveTo(-hl * .1, hh * 2.2, -hl * .75, hh * 1.9 - wag * 2); g.quadraticCurveTo(-hl * .5, hh * .9, -hl * .55, hh * .5);
  } else if (f.dorsal === "flow") {
    g.moveTo(hl * .15, -hh * .85); g.bezierCurveTo(-hl * .1, -hh * 1.9, -hl * .7, -hh * 1.7 + wag * 2, -hl * .8, -hh * .6);
    g.moveTo(hl * .05, hh * .85); g.bezierCurveTo(-hl * .2, hh * 1.8, -hl * .6, hh * 1.6 - wag * 2, -hl * .75, hh * .6);
  } else if (f.dorsal === "spiky") {
    g.moveTo(hl * .2, -hh * .85);
    for (let i = 0; i <= 5; i++) { const px = hl * .2 - i * hl * .16; g.lineTo(px - hl * .05, -hh * (1.35 - i * .04)); g.lineTo(px - hl * .1, -hh * .9); }
  } else {
    g.moveTo(hl * .05, -hh * .9); g.quadraticCurveTo(-hl * .15, -hh * 1.55, -hl * .4, -hh * .85);
  }
  g.closePath(); g.fill();
  g.shadowBlur = 0;

  // ตัว
  g.beginPath();
  if (f.round) g.ellipse(0, 0, hl * .82, hh, 0, 0, Math.PI * 2);
  else {
    g.moveTo(hl, hh * .05);
    g.bezierCurveTo(hl * .95, -hh * .9, hl * .2, -hh * 1.05, -hl * .3, -hh * .85);
    g.bezierCurveTo(-hl * .7, -hh * .6, -hl * .86, -hh * .25, -hl * .9, 0);
    g.bezierCurveTo(-hl * .86, hh * .25, -hl * .7, hh * .6, -hl * .3, hh * .85);
    g.bezierCurveTo(hl * .2, hh * 1.05, hl * .95, hh * .9, hl, hh * .05);
  }
  g.closePath();
  if (sil) { g.fillStyle = sil; g.fill(); g.restore(); return; }
  const gr = g.createLinearGradient(0, -hh, 0, hh);
  gr.addColorStop(0, f.c1); gr.addColorStop(.55, f.c1); gr.addColorStop(1, f.c2);
  g.fillStyle = gr;
  if (f.glow) { g.shadowColor = f.glow; g.shadowBlur = L * .25; }
  g.fill(); g.shadowBlur = 0;

  // ลาย (ตัดให้อยู่ในตัวปลา)
  g.save(); g.clip();
  const p = f.pat, rnd = seeded(id.length * 31 + id.charCodeAt(0));
  if (p) {
    g.fillStyle = p.c; g.strokeStyle = p.c;
    if (p.t === "bars") for (let i = 0; i < p.n; i++) { const bx = hl * .55 - i * (hl * 1.5 / p.n); g.fillRect(bx - L * (p.w || .05) / 2, -hh, L * (p.w || .05), hh * 2); }
    else if (p.t === "line") { g.fillRect(-hl, -hh * .08, L * .95, hh * .2); }
    else if (p.t === "scale") { g.lineWidth = Math.max(.6, L * .012); for (let r = -1; r <= 1; r++) for (let c = 0; c < 6; c++) { g.beginPath(); g.arc(hl * .45 - c * hl * .24 + (r & 1) * hl * .12, r * hh * .45, L * .05, -1.2, 1.2); g.stroke(); } }
    else if (p.t === "spots") for (let i = 0; i < p.n; i++) { g.beginPath(); g.arc((rnd() * 1.6 - .9) * hl, (rnd() * 1.6 - .8) * hh, L * (.025 + rnd() * .02), 0, Math.PI * 2); g.fill(); }
    else if (p.t === "patch") for (let i = 0; i < p.n; i++) { g.beginPath(); g.ellipse(hl * (.45 - i * .55), (i % 2 ? .25 : -.35) * hh, L * (.13 + rnd() * .05), hh * (.55 + rnd() * .2), rnd(), 0, Math.PI * 2); g.fill(); }
    else if (p.t === "glowdots") { g.shadowColor = p.c; g.shadowBlur = L * .15; for (let i = 0; i < p.n; i++) { const tw = .55 + .45 * Math.sin(t * 2.4 + i * 1.7); g.globalAlpha = (o.alpha == null ? 1 : o.alpha) * tw; g.beginPath(); g.arc((rnd() * 1.5 - .8) * hl, (rnd() * 1.2 - .6) * hh, L * .028, 0, Math.PI * 2); g.fill(); } g.globalAlpha = o.alpha == null ? 1 : o.alpha; g.shadowBlur = 0; }
    else if (p.t === "shine") { const sg = g.createLinearGradient(-hl, -hh, hl, hh); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(.5 + .2 * Math.sin(t * 1.5), p.c); sg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = sg; g.fillRect(-hl, -hh, L, hh * 2); }
  }
  // เงาด้านล่าง + แสงด้านบน ให้ดูกลมนุ่ม
  const sh = g.createLinearGradient(0, -hh, 0, hh); sh.addColorStop(0, "rgba(255,255,255,.28)"); sh.addColorStop(.4, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,.12)");
  g.fillStyle = sh; g.fillRect(-hl, -hh, L, hh * 2);
  g.restore();

  // เส้นเหงือก + ครีบอก (กระพือ)
  g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = Math.max(.7, L * .015);
  g.beginPath(); g.arc(hl * (f.round ? .25 : .42), 0, hh * .55, -1.1, 1.1); g.stroke();
  g.fillStyle = finC; g.globalAlpha *= .9;
  g.beginPath(); g.ellipse(hl * .2, hh * .35, L * .1, L * .04, .6 + wag * .3, 0, Math.PI * 2); g.fill();
  g.globalAlpha = o.alpha == null ? 1 : o.alpha;

  // หนวด
  if (f.whisk) { g.strokeStyle = f.c1; g.lineWidth = Math.max(.8, L * .014); const wl = f.whisk === 2 ? L * .22 : L * .1;
    g.beginPath(); g.moveTo(hl * .95, hh * .2); g.quadraticCurveTo(hl + wl * .6, hh * .5 + wag * 2, hl + wl * .3, hh * .9 + wl * .4); g.stroke(); }

  // ตาโตน่ารัก + แก้มชมพู
  const ex = hl * (f.round ? .45 : .62), ey = -hh * (f.round ? .2 : .18), er = Math.max(1.6, L * (f.round ? .1 : .075));
  g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1A1C24"; g.beginPath(); g.arc(ex + er * .2, ey + er * .05, er * .62, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(ex + er * .38, ey - er * .25, er * .24, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,120,150,.35)"; g.beginPath(); g.ellipse(ex - er * .3, ey + er * 1.6, er * .8, er * .45, 0, 0, Math.PI * 2); g.fill();

  // ประกายรอบตัว (ระดับตำนาน)
  if (f.sparkle) {
    g.strokeStyle = "#fff"; g.lineWidth = Math.max(.8, L * .012);
    for (let i = 0; i < 4; i++) { const a = t * .8 + i * 1.6, rr = L * (.55 + .1 * Math.sin(t * 2 + i)), sx = Math.cos(a) * rr, sy = Math.sin(a) * rr * .6, tw = (Math.sin(t * 3 + i * 2) + 1) / 2, l = L * .04 * (.5 + tw);
      g.globalAlpha = (o.alpha == null ? 1 : o.alpha) * tw; g.beginPath(); g.moveTo(sx - l, sy); g.lineTo(sx + l, sy); g.moveTo(sx, sy - l); g.lineTo(sx, sy + l); g.stroke(); }
  }
  g.restore();
};
})();
