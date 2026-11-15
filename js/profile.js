/* ML WEB — หน้าโปรไฟล์: ปรับแต่งปก/สี/คำแนะนำตัว, สถิติการเรียน, ฤดูที่สะสม, ป้ายรางวัล
   #profile = ของตัวเอง, #u/<uid> = ดูโปรไฟล์ที่เจ้าของเปิดแชร์ (การ์ดสาธารณะที่ profiles/<uid>) */
(() => {
"use strict";
const A = App, $ = A.$, el = A.el;

const COVERS = {
  dawn: "รุ่งเช้า", river: "แม่น้ำใส", sunset: "ยามเย็น", night: "คืนดาว", firefly: "หิ่งห้อย", sakura: "ใบไม้ผลิ"
};
const ACCENTS = ["#F08A4B", "#43D6C2", "#7FA2FF", "#C79BFF", "#FF84A8", "#9AD36A", "#F5C25B", "#62B4FF"];
const SEASON_KEYS = ["spring", "summer", "autumn", "winter", "rainy", "firefly"];
const WEEKS = 20;

const BADGES = [
  { id: "first",    mark: "1",   name: "หยดแรก",          desc: "เรียนจบรอบแรก",                    ok: s => s.rounds >= 1 },
  { id: "streak3",  mark: "3",   name: "เริ่มติดลม",        desc: "เรียนติดกัน 3 วัน",                ok: s => s.best >= 3 },
  { id: "streak7",  mark: "7",   name: "ครบสัปดาห์",       desc: "เรียนติดกัน 7 วัน",                ok: s => s.best >= 7 },
  { id: "streak30", mark: "30",  name: "หนึ่งเดือนไม่หยุด",  desc: "เรียนติดกัน 30 วัน",               ok: s => s.best >= 30 },
  { id: "hours10",  mark: "10ชม.", name: "สิบชั่วโมงแรก",     desc: "เรียนรวม 10 ชั่วโมง",              ok: s => s.hours >= 10 },
  { id: "hours50",  mark: "50ชม.", name: "ห้าสิบชั่วโมง",     desc: "เรียนรวม 50 ชั่วโมง",              ok: s => s.hours >= 50 },
  { id: "rounds50", mark: "50",  name: "ห้าสิบรอบ",        desc: "เรียนจบ 50 รอบ",                   ok: s => s.rounds >= 50 },
  { id: "seasons",  mark: "5",   name: "ครบทุกฤดู",        desc: "เจอครบ 5 ฤดูปกติ",                 ok: s => SEASON_KEYS.slice(0, 5).every(k => s.seasons[k]) },
  { id: "firefly",  mark: "✦",   name: "คืนหิ่งห้อย",       desc: "เจอฤดูหายาก คืนหิ่งห้อย",           ok: s => !!s.seasons.firefly },
  { id: "notes",    mark: "✎",   name: "นักสรุป",          desc: "จดสรุปหลังเรียน 10 รอบ",            ok: s => s.notes >= 10 },
  { id: "master",   mark: "★",   name: "สอนได้แล้ว",        desc: "ให้คะแนนความเข้าใจ 5/5 ครบ 5 รอบ",  ok: s => s.fives >= 5 }
];

/* ---------- ค่าที่ปลอดภัยเท่านั้น (การ์ดของคนอื่นอาจถูกแก้มา) ---------- */
const safeAccent = c => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : ACCENTS[0]);
const safeCover = c => (COVERS[c] ? c : "river");
const safePhoto = u => (typeof u === "string" && /^https:\/\/lh\d\.googleusercontent\.com\//.test(u) ? u : "");
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const num = v => (typeof v === "number" && isFinite(v) ? v : 0);

/* ---------- คำนวณสถิติจากบันทึกการเรียน ---------- */
function computeStats() {
  const sess = A.list("sessions"), bd = A.byDay();
  const keys = Object.keys(bd).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach(k => {
    const d = A.parseKey(k);
    run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  });
  const mins = sess.reduce((a, s) => a + (s.focusMin || 0), 0);
  const seasons = {}; sess.forEach(s => { if (SEASON_KEYS.includes(s.season)) seasons[s.season] = (seasons[s.season] || 0) + 1; });
  const bySub = {}; sess.forEach(s => { bySub[s.subjectId || ""] = (bySub[s.subjectId || ""] || 0) + (s.focusMin || 0); });
  const subjects = Object.entries(bySub).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, m]) => { const sb = A.subj(id); return { name: sb.name, color: sb.color | 0, mins: m }; });
  const from = A.dateKey(A.addDays(new Date(), -WEEKS * 7 - 7)), heat = {};
  keys.forEach(k => { if (k >= from) heat[k] = bd[k].mins; });
  const st = {
    streak: A.streak(bd), best, days: keys.length, rounds: sess.length,
    hours: Math.round(mins / 6) / 10, mins,
    avg: sess.length ? Math.round(sess.reduce((a, s) => a + (s.rating || 0), 0) / sess.length * 10) / 10 : 0,
    notes: sess.filter(s => (s.note || "").trim()).length, fives: sess.filter(s => (s.rating | 0) === 5).length,
    seasons, subjects, heat, since: keys[0] || ""
  };
  st.badges = BADGES.filter(b => b.ok(st)).map(b => b.id);
  return st;
}
/* การ์ดสาธารณะของคนอื่น: อ่านเฉพาะช่องที่รู้จัก แปลงชนิดให้ถูกก่อนใช้ */
function cleanStats(s) {
  s = s && typeof s === "object" ? s : {};
  const seasons = {}; SEASON_KEYS.forEach(k => { if (num((s.seasons || {})[k])) seasons[k] = num(s.seasons[k]); });
  const heat = {}; Object.entries(s.heat || {}).forEach(([k, v]) => { if (/^\d{4}-\d\d-\d\d$/.test(k)) heat[k] = num(v); });
  const st = {
    streak: num(s.streak), best: num(s.best), days: num(s.days), rounds: num(s.rounds), hours: num(s.hours), avg: num(s.avg),
    notes: num(s.notes), fives: num(s.fives), seasons, heat, since: /^\d{4}-\d\d-\d\d$/.test(s.since) ? s.since : "",
    subjects: (Array.isArray(s.subjects) ? s.subjects : []).slice(0, 5).map(x => ({ name: str(x && x.name, 40), color: Math.max(0, Math.min(7, num(x && x.color) | 0)), mins: num(x && x.mins) }))
  };
  st.badges = BADGES.filter(b => b.ok(st)).map(b => b.id);
  return st;
}

/* ---------- การ์ดสาธารณะ: เขียนเมื่อเจ้าของเปิดแชร์และมีอะไรเปลี่ยน ---------- */
function publicCard() {
  const p = A.profile, st = computeStats();
  return {
    nickname: str(p.nickname, 40), photoURL: safePhoto(A.user.photoURL), bio: str(p.bio, 160),
    cover: safeCover(p.cover), accent: safeAccent(p.accent), favSubject: str(p.favSubject, 40),
    interests: (p.interests || []).slice(0, 20).map(i => str(i, 30)),
    stats: { streak: st.streak, best: st.best, days: st.days, rounds: st.rounds, hours: st.hours, avg: st.avg,
             notes: st.notes, fives: st.fives, seasons: st.seasons, subjects: st.subjects, heat: st.heat, since: st.since }
  };
}
let lastCard = "", syncT = null, syncing = false;
A.syncPublic = () => {
  clearTimeout(syncT);
  syncT = setTimeout(async () => {
    if (syncing || !A.user || !A.profile || !["db", "local"].includes(A.store.mode)) return;
    const uid = A.user.uid;
    if (!A.profile.shared) {
      if (lastCard !== "off") { lastCard = "off"; await removeCard(uid).catch(() => {}); }
      return;
    }
    const card = publicCard(), s = JSON.stringify(card);
    if (s === lastCard) return;
    syncing = true;
    try { await writeCard(uid, { ...card, updatedAt: new Date().toISOString() }); lastCard = s; }
    catch (e) { /* ยังไม่ได้อัปเดตกฎใน Firebase หรือออฟไลน์: ลองใหม่รอบหน้า */ }
    finally { syncing = false; }
  }, 2500);
};
const writeCard = (uid, card) => A.fdb ? A.fdb.doc(`profiles/${uid}`).set(card) : Promise.resolve(A.lsSet("mlweb.public." + uid, card));
const removeCard = uid => A.fdb ? A.fdb.doc(`profiles/${uid}`).delete() : Promise.resolve(localStorage.removeItem("mlweb.public." + uid));
const readCard = async uid => {
  if (!A.fdb) return A.lsGet("mlweb.public." + uid, null);
  const snap = await A.fdb.doc(`profiles/${uid}`).get();
  return snap.exists ? snap.data() : null;
};
const shareURL = uid => `${location.origin}${location.pathname}#u/${uid}`;

/* ---------- ชิ้นส่วนหน้า ---------- */
const NS = "http://www.w3.org/2000/svg";
function waves() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 1200 120"); s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("class", "pv-waves"); s.setAttribute("aria-hidden", "true");
  ["M0 70 C150 40 300 100 450 70 S750 40 900 70 S1100 95 1200 70 V120 H0Z", "M0 90 C200 65 350 115 600 88 S950 70 1200 92 V120 H0Z"].forEach((d, i) => {
    const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); p.setAttribute("class", "w" + i); s.append(p);
  });
  return s;
}
function avatarEl(photo, nick) {
  const a = el("span", { class: "pv-ava" });
  if (photo) a.append(el("img", { src: photo, alt: "", referrerpolicy: "no-referrer" }));
  else a.append(el("span", { "aria-hidden": "true", text: (String(nick || "?").trim()[0] || "?").toUpperCase() }));
  return a;
}
function statTile(value, unit, label, cls) {
  return el("div", { class: "pv-stat" + (cls ? " " + cls : "") }, el("span", { class: "pv-sv" }, el("b", { text: value }), unit ? " " + unit : ""), el("span", { class: "pv-sl", text: label }));
}
function card(title, sub, ...kids) {
  return el("article", { class: "pv-card" }, el("div", { class: "pv-ch" }, el("h3", { text: title }), sub ? el("span", { class: "muted sm", text: sub }) : null), ...kids);
}
const thMonthYear = k => { const d = A.parseKey(k); return `${d.getDate()} ${A.TH_M[d.getMonth()]} ${d.getFullYear() + 543}`; };

function heatmap(heat) {
  const today = A.parseKey(A.dateKey(new Date()));
  const start = A.addDays(today, -A.dow(today) - (WEEKS - 1) * 7);
  const lvl = m => (m <= 0 ? 0 : m <= 25 ? 1 : m <= 50 ? 2 : m <= 100 ? 3 : 4);
  const grid = el("div", { class: "hm-grid", role: "img" });
  const months = el("div", { class: "hm-months", "aria-hidden": "true" });
  let total = 0, studied = 0, lastM = -1;
  for (let w = 0; w < WEEKS; w++) {
    const d0 = A.addDays(start, w * 7);
    months.append(el("span", { text: d0.getMonth() !== lastM && d0.getDate() <= 7 ? A.TH_M[d0.getMonth()] : "" }));
    if (d0.getDate() <= 7) lastM = d0.getMonth();
    for (let i = 0; i < 7; i++) {
      const d = A.addDays(d0, i), k = A.dateKey(d), m = heat[k] || 0, fut = d > today;
      if (m > 0) { total += m; studied++; }
      grid.append(el("i", { class: `hm l${fut ? "x" : lvl(m)}`, title: fut ? "" : `${A.thDate(d)} · ${m ? `เรียน ${m} นาที` : "ไม่ได้เรียน"}`, style: `grid-column:${w + 1};grid-row:${i + 1}` }));
    }
  }
  grid.setAttribute("aria-label", `ตารางวันที่เรียน ${WEEKS} สัปดาห์ล่าสุด เรียน ${studied} วัน รวม ${Math.round(total / 6) / 10} ชั่วโมง`);
  const legend = el("div", { class: "hm-legend", "aria-hidden": "true" }, "น้อย", ...[0, 1, 2, 3, 4].map(l => el("i", { class: "hm l" + l })), "มาก");
  const days = el("div", { class: "hm-days", "aria-hidden": "true" }, ...A.TH_DS.map((d, i) => el("span", { text: i % 2 ? "" : d })));
  return el("div", { class: "hm-wrap" }, el("div", { class: "hm-scroll" }, months, el("div", { class: "hm-body" }, days, grid)), legend);
}
function subjectBars(list) {
  if (!list.length) return el("p", { class: "empty", text: "ยังไม่มีข้อมูล เรียนจบรอบแรกแล้วจะขึ้นตรงนี้" });
  const max = Math.max(...list.map(s => s.mins), 1);
  return el("ul", { class: "pv-bars" }, list.map(s => el("li", {},
    el("span", { class: "pb-name" }, el("i", { class: "dot c" + (s.color | 0) }), s.name),
    el("span", { class: "pb-track" }, el("span", { class: "pb-fill c" + (s.color | 0), style: `width:${Math.max(4, s.mins / max * 100)}%` })),
    el("span", { class: "pb-val", text: s.mins >= 60 ? `${Math.round(s.mins / 6) / 10} ชม.` : `${s.mins} นาที` }))));
}
function seasonGrid(seasons) {
  return el("ul", { class: "pv-seasons" }, SEASON_KEYS.map(k => {
    const S = A.season(k) || { name: k }, n = seasons[k] || 0;
    return el("li", { class: "ps ps-" + k + (n ? "" : " locked") + (k === "firefly" ? " rare" : "") },
      el("span", { class: "ps-orb", "aria-hidden": "true" }),
      el("span", { class: "ps-name", text: S.name }),
      el("span", { class: "ps-n", text: n ? `เจอ ${n} ครั้ง` : "ยังไม่เจอ" }));
  }));
}
function badgeGrid(earned) {
  return el("ul", { class: "pv-badges" }, BADGES.map(b => {
    const ok = earned.includes(b.id);
    return el("li", { class: "bd" + (ok ? " on" : ""), title: b.desc },
      el("span", { class: "bd-medal" + (b.mark.length > 2 ? " sm" : ""), "aria-hidden": "true", text: b.mark }),
      el("span", { class: "bd-name", text: b.name }),
      el("span", { class: "bd-desc", text: ok ? "ได้แล้ว" : b.desc }));
  }));
}

/* ---------- วาดหน้า ---------- */
function view(d, owner) {
  const st = d.stats, root = el("div", { class: "pv cover-" + d.cover });
  root.style.setProperty("--acc", d.accent);
  const cover = el("div", { class: "pv-cover" }, el("span", { class: "pv-orb o1", "aria-hidden": "true" }), el("span", { class: "pv-orb o2", "aria-hidden": "true" }), waves());
  if (owner) {
    cover.append(el("div", { class: "pv-tools" },
      el("button", { type: "button", class: "pv-tool", id: "pvEdit", "aria-expanded": "false", "aria-controls": "pvPanel", onclick: togglePanel, text: "ปรับแต่งโปรไฟล์" }),
      el("button", { type: "button", class: "pv-tool", onclick: share, text: "แชร์" })));
  }
  root.append(cover);

  const ava = avatarEl(d.photo, d.nickname);
  if (st.streak) ava.append(el("span", { class: "pv-streak", title: `เรียนติดกัน ${st.streak} วัน` }, el("b", { text: st.streak }), "วัน"));
  const chips = el("div", { class: "pv-chips" });
  if (d.favSubject) chips.append(el("span", { class: "pv-chip fav" }, el("span", { class: "vh", text: "วิชาที่ชอบ " }), "♥ ", d.favSubject));
  d.interests.forEach(i => chips.append(el("span", { class: "pv-chip", text: i })));
  const head = el("div", { class: "pv-head" }, ava,
    el("div", { class: "pv-id" },
      el("h2", { class: "pv-nick", text: d.nickname || "ไม่มีชื่อ" }),
      owner && d.realName ? el("p", { class: "pv-private" }, `${d.realName}${d.age ? ` · ${d.age} ปี` : ""} `, el("span", { class: "pv-lock", text: "เห็นเฉพาะคุณ" })) : null,
      d.bio ? el("p", { class: "pv-bio", text: d.bio }) : owner ? el("p", { class: "pv-bio none", text: "ยังไม่มีคำแนะนำตัว กด “ปรับแต่งโปรไฟล์” เพื่อเขียน" }) : null,
      chips,
      el("p", { class: "pv-meta", text: st.since ? `เริ่มเรียนกับแม่น้ำตั้งแต่ ${thMonthYear(st.since)}` : "ยังไม่ได้เริ่มเรียนรอบแรก" })));
  root.append(head);
  if (owner) root.append(panel());

  root.append(el("div", { class: "pv-stats" },
    statTile(st.streak, "วัน", "เรียนติดกันตอนนี้", "hero"),
    statTile(st.best, "วัน", "ติดกันนานที่สุด"),
    statTile(st.days, "วัน", "วันที่เรียนทั้งหมด"),
    statTile(st.hours, "ชม.", "เวลาเรียนรวม"),
    statTile(st.rounds, "รอบ", "เรียนจบแล้ว"),
    statTile(st.avg ? st.avg.toFixed(1) : "–", st.avg ? "/ 5" : "", "ความเข้าใจเฉลี่ย")));

  root.append(el("div", { class: "pv-grid" },
    card("วันที่เรียน", `${WEEKS} สัปดาห์ล่าสุด`, heatmap(st.heat)),
    card("เวลาเรียนแยกตามวิชา", "5 วิชาที่เรียนมากสุด", subjectBars(st.subjects)),
    card("ฤดูที่สะสม", `${Object.keys(st.seasons).length} จาก ${SEASON_KEYS.length}`, seasonGrid(st.seasons)),
    card("ป้ายรางวัล", `ได้แล้ว ${st.badges.length} จาก ${BADGES.length}`, badgeGrid(st.badges))));
  return root;
}

/* ---------- แผงปรับแต่ง (เจ้าของเท่านั้น) ---------- */
let draft = null;
function panel() {
  const p = A.profile;
  draft = { cover: safeCover(p.cover), accent: safeAccent(p.accent), bio: str(p.bio, 160), shared: !!p.shared };
  const covers = el("div", { class: "pv-covers", role: "radiogroup", "aria-label": "ภาพปก" }, Object.entries(COVERS).map(([k, name]) => {
    const id = "pvc-" + k, inp = el("input", { type: "radio", name: "pvCover", id, value: k, class: "vh" }); inp.checked = k === draft.cover;
    inp.addEventListener("change", () => { draft.cover = k; preview(); });
    return el("span", { class: "pv-cv" }, inp, el("label", { for: id }, el("span", { class: "cv-thumb cover-" + k, "aria-hidden": "true" }), name));
  }));
  const accents = el("div", { class: "pv-accents", role: "radiogroup", "aria-label": "สีประจำตัว" }, ACCENTS.map((c, i) => {
    const id = "pva-" + i, inp = el("input", { type: "radio", name: "pvAcc", id, value: c, class: "vh" }); inp.checked = c === draft.accent;
    inp.addEventListener("change", () => { draft.accent = c; preview(); });
    return el("span", { class: "pv-ac" }, inp, el("label", { for: id, title: `สี ${i + 1}`, style: `--sw:${c}` }, el("span", { class: "vh", text: `สี ${i + 1}` })));
  }));
  const bio = el("textarea", { id: "pvBio", rows: "2", maxlength: "160", placeholder: "เช่น กำลังเตรียมสอบเข้า ชอบฟิสิกส์ที่สุด" }); bio.value = draft.bio;
  const cnt = el("span", { class: "pv-cnt muted sm", text: `${draft.bio.length}/160` });
  bio.addEventListener("input", () => { draft.bio = bio.value.slice(0, 160); cnt.textContent = `${draft.bio.length}/160`; });
  const sh = el("input", { type: "checkbox", id: "pvShare" }); sh.checked = draft.shared;
  sh.addEventListener("change", () => { draft.shared = sh.checked; });
  return el("section", { class: "pv-panel", id: "pvPanel", hidden: true, "aria-label": "ปรับแต่งโปรไฟล์" },
    el("div", { class: "pp-row" }, el("h4", { text: "ภาพปก" }), covers),
    el("div", { class: "pp-row" }, el("h4", { text: "สีประจำตัว" }), accents),
    el("div", { class: "pp-row" }, el("label", { for: "pvBio", class: "pp-lbl" }, "คำแนะนำตัว ", cnt), bio),
    el("div", { class: "pp-row pp-share" }, sh, el("label", { for: "pvShare" },
      el("b", { text: "ให้คนอื่นดูโปรไฟล์นี้ได้ผ่านลิงก์" }),
      el("span", { class: "muted sm", text: "จะเห็นแค่ชื่อเล่น รูป คำแนะนำตัว วิชาที่ชอบ ความสนใจ และสถิติการเรียน ไม่เห็นชื่อจริง อายุ อีเมล หรือบันทึกที่จดไว้ คนดูต้องล็อกอินก่อน" }))),
    el("div", { class: "actions" },
      el("button", { type: "button", class: "btn primary", onclick: savePanel, text: "บันทึก" }),
      el("button", { type: "button", class: "btn", onclick: () => renderOwn(true), text: "ยกเลิก" }),
      el("button", { type: "button", class: "link-btn", onclick: () => A.Auth.edit(), text: "แก้ชื่อ อายุ วิชาที่ชอบ ความสนใจ" })));
}
function preview() {
  const pv = document.querySelector(".pv"); if (!pv) return;
  pv.className = "pv own cover-" + draft.cover; pv.style.setProperty("--acc", draft.accent);
}
function togglePanel() {
  const p = $("pvPanel"), b = $("pvEdit"); p.hidden = !p.hidden; b.setAttribute("aria-expanded", String(!p.hidden));
  if (!p.hidden) p.querySelector("input:checked, input").focus();
}
async function savePanel() {
  const was = !!A.profile.shared;
  try {
    await A.Auth.saveProfile({ ...A.profile, cover: draft.cover, accent: draft.accent, bio: draft.bio.trim(), shared: draft.shared });
    lastCard = ""; A.syncPublic();
    A.toast(draft.shared && !was ? "บันทึกแล้ว เปิดให้ดูผ่านลิงก์แล้ว กด “แชร์” เพื่อคัดลอกลิงก์" : "บันทึกโปรไฟล์แล้ว");
    renderOwn(true);
  } catch (e) { A.toast(`บันทึกไม่สำเร็จ (${e.code || "error"})`); }
}
async function share() {
  if (!A.profile.shared) {
    A.toast("เปิด “ให้คนอื่นดูโปรไฟล์นี้ได้” ในปรับแต่งโปรไฟล์ก่อน");
    if ($("pvPanel").hidden) togglePanel();
    $("pvShare").focus(); return;
  }
  const url = shareURL(A.user.uid);
  try { if (navigator.share && matchMedia("(pointer:coarse)").matches) await navigator.share({ title: `โปรไฟล์ของ ${A.profile.nickname}`, url }); else { await navigator.clipboard.writeText(url); A.toast("คัดลอกลิงก์โปรไฟล์แล้ว"); } }
  catch (e) { if (e.name !== "AbortError") prompt("คัดลอกลิงก์นี้", url); }
}

/* ---------- หน้า ---------- */
function ownData() {
  const p = A.profile || {}, st = computeStats();
  return { nickname: p.nickname, realName: p.realName, age: p.age, bio: p.bio, cover: safeCover(p.cover), accent: safeAccent(p.accent),
           favSubject: p.favSubject, interests: p.interests || [], photo: safePhoto(A.user && A.user.photoURL), stats: st };
}
let ownKey = "";
function renderOwn(force) {
  const box = $("pfRoot");
  if (!A.user || !A.profile) { box.textContent = ""; return; }
  // ระหว่างเปิดแผงปรับแต่ง ไม่วาดทับ (กันสิ่งที่พิมพ์อยู่หาย)
  const open = $("pvPanel") && !$("pvPanel").hidden;
  if (open && force !== true) return;
  const d = ownData(), key = JSON.stringify(d);
  if (key === ownKey && box.querySelector(".pv.own") && force !== true) return;
  ownKey = key;
  $("pfH").textContent = `โปรไฟล์ของ ${d.nickname || ""}`;
  box.textContent = ""; const v = view(d, true); v.classList.add("own"); box.append(v); visited = "";
}
let visitSeq = 0, visited = "";
async function renderVisit(uid) {
  const box = $("pfRoot");
  if (A.user && uid === A.user.uid) { location.replace("#profile"); return; }
  if (uid === visited) return;
  const my = ++visitSeq; visited = uid; ownKey = "";
  box.textContent = ""; box.append(el("p", { class: "pv-msg", text: "กำลังโหลดโปรไฟล์…" }));
  let c = null, err = null;
  try { c = await readCard(uid); } catch (e) { err = e; }
  if (my !== visitSeq) return;
  box.textContent = "";
  if (!c) {
    box.append(el("div", { class: "pv-msg" }, el("h2", { class: "display sm", text: "ไม่พบโปรไฟล์นี้" }),
      el("p", { class: "muted", text: err ? "โหลดไม่สำเร็จ ลองใหม่อีกครั้ง" : "เจ้าของอาจยังไม่ได้เปิดให้คนอื่นดู หรือลิงก์ไม่ถูกต้อง" }),
      el("a", { class: "btn", href: "#profile", text: "ไปโปรไฟล์ของฉัน" })));
    return;
  }
  const d = { nickname: str(c.nickname, 40), bio: str(c.bio, 160), cover: safeCover(c.cover), accent: safeAccent(c.accent), favSubject: str(c.favSubject, 40),
              interests: (Array.isArray(c.interests) ? c.interests : []).slice(0, 20).map(i => str(i, 30)).filter(Boolean), photo: safePhoto(c.photoURL), stats: cleanStats(c.stats) };
  $("pfH").textContent = `โปรไฟล์ของ ${d.nickname}`;
  box.append(view(d, false));
}
A.pages.profile = () => renderOwn();
A.pages.user = () => renderVisit(A.pageParam);
})();
