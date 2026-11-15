/* สายเรียน (SaiRian) — ห้องเรียน: สร้างห้อง เชิญเพื่อนด้วยรหัส/ลิงก์ ดูว่าใครเรียนไปเท่าไหร่ ใครกำลังเรียนอยู่ และกดดูแนวโน้มของเพื่อน
   #rooms          = ห้องที่เข้าร่วม
   #rooms/new      = สร้างห้อง
   #rooms/join     = ใส่รหัสเข้าห้อง
   #r/<roomId>     = ตารางอันดับในห้อง
   #r/<roomId>/<uid> = ดูเพื่อนคนหนึ่ง
   #join/<CODE>    = ลิงก์เชิญ

   ข้อมูลใน Firestore (กฎอยู่ใน firestore.rules):
   rooms/<roomId>                 { name, owner, code, createdAt }
   rooms/<roomId>/members/<uid>   สรุปการเรียนของสมาชิกคนนั้น (เจ้าตัวเขียนเอง): ชื่อเล่น รูป เวลาเรียนรายวัน 35 วัน สถานะกำลังเรียน …
   invites/<CODE>                 { roomId, name, owner } ใช้หาห้องจากรหัส
   users/<uid>/rooms/<roomId>     { name, joinedAt } รายชื่อห้องของฉัน
   ไม่มีชื่อจริง อายุ อีเมล บันทึกสรุป หรือรูปแม่น้ำ อยู่ในห้องเลย */
(() => {
"use strict";
const A = App, $ = A.$, el = A.el;

const MAX_MEMBERS = 30, MAX_ROOMS = 10, DAYS = 35;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";            // ไม่มี I O 0 1 ที่อ่านสับสน
const METRICS = { week: "สัปดาห์นี้", today: "วันนี้", total: "ทั้งหมด" };

/* ---------- ที่เก็บข้อมูล: Firestore จริง หรือจำลองใน localStorage (โหมดทดลอง) ---------- */
const fb = {
  get: async p => { const s = await A.fdb.doc(p).get(); return s.exists ? s.data() : null; },
  list: async p => (await A.fdb.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id })),
  batch: async ops => { const b = A.fdb.batch(); ops.forEach(([op, p, d]) => op === "set" ? b.set(A.fdb.doc(p), d) : b.delete(A.fdb.doc(p))); await b.commit(); },
  set: (p, d) => A.fdb.doc(p).set(d),
  onDoc: (p, cb, er) => A.fdb.doc(p).onSnapshot(s => cb(s.exists ? s.data() : null), er),
  onCol: (p, cb, er) => A.fdb.collection(p).onSnapshot(s => cb(s.docs.map(d => ({ ...d.data(), id: d.id }))), er),
  newId: () => A.fdb.collection("rooms").doc().id
};
const LK = "mlweb.fs", subs = new Set();
const lsAll = () => A.lsGet(LK, {});
const lsNotify = () => subs.forEach(s => s());
const kids = (all, p) => Object.keys(all).filter(k => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).map(k => ({ ...all[k], id: k.slice(p.length + 1) }));
const local = {
  get: async p => lsAll()[p] || null,
  list: async p => kids(lsAll(), p),
  batch: async ops => { const all = lsAll(); ops.forEach(([op, p, d]) => { if (op === "set") all[p] = JSON.parse(JSON.stringify(d)); else delete all[p]; }); A.lsSet(LK, all); lsNotify(); },
  set: async (p, d) => local.batch([["set", p, d]]),
  onDoc: (p, cb) => { const f = () => cb(lsAll()[p] || null); subs.add(f); setTimeout(f); return () => subs.delete(f); },
  onCol: (p, cb) => { const f = () => cb(kids(lsAll(), p)); subs.add(f); setTimeout(f); return () => subs.delete(f); },
  newId: () => "r" + A.uid() + A.uid()
};
window.addEventListener("storage", e => { if (e.key === LK) lsNotify(); });
const db = () => (A.fdb ? fb : local);

/* ---------- ตัวช่วย ---------- */
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const num = v => (typeof v === "number" && isFinite(v) ? v : 0);
const safePhoto = u => (typeof u === "string" && /^https:\/\/lh\d\.googleusercontent\.com\//.test(u) ? u : "");
const safeAccent = c => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "#F08A4B");
const todayKey = () => A.dateKey(new Date());
const weekStartKey = () => { const d = new Date(); return A.dateKey(A.addDays(d, -A.dow(d))); };
const fmtMin = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} ชม. ${r} น.` : `${h} ชม.`) : `${r} นาที`; };
const fmtShort = m => { m = Math.round(m); return `${Math.floor(m / 60)}:${A.pad(m % 60)}`; };
const errMsg = e => {
  const c = (e && e.code) || "";
  if (c === "permission-denied") return "ไม่มีสิทธิ์ (ถ้าเพิ่งอัปเดตเว็บ ผู้ดูแลอาจยังไม่ได้อัปเดตกฎใน Firebase)";
  if (c === "unavailable") return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง";
  return `ไม่สำเร็จ (${c || (e && e.message) || "error"})`;
};
const inviteURL = code => `${location.origin}${location.pathname}#join/${code}`;
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CHARS[b % CODE_CHARS.length]).join("");
const normCode = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/* อ่านข้อมูลสมาชิกจากห้อง (คนอื่นเขียนมา): เอาเฉพาะช่องที่รู้จัก แปลงชนิดก่อนใช้ */
function cleanMember(m) {
  const daily = {}; Object.entries(m.daily || {}).forEach(([k, v]) => { if (/^\d{4}-\d\d-\d\d$/.test(k) && num(v) > 0) daily[k] = Math.min(num(v), 24 * 60); });
  const lv = m.live && typeof m.live === "object" ? m.live : {};
  return {
    id: m.id, nickname: str(m.nickname, 40) || "ไม่มีชื่อ", photo: safePhoto(m.photoURL), accent: safeAccent(m.accent),
    daily, total: num(m.total), rounds: num(m.rounds), best: num(m.best), streakRaw: num(m.streak), lastDate: str(m.lastDate, 10),
    fishN: num(m.fishN), joinedAt: str(m.joinedAt, 30),
    subjects: (Array.isArray(m.subjects) ? m.subjects : []).slice(0, 5).map(x => ({ name: str(x && x.name, 40), color: Math.max(0, Math.min(7, num(x && x.color) | 0)), mins: num(x && x.mins) })),
    live: { s: str(lv.s, 10), ph: str(lv.ph, 10), sub: str(lv.sub, 40), end: num(lv.end), at: num(lv.at) }
  };
}
/* ตัวเลขที่คำนวณจากเวลาเรียนรายวัน (คิดตามวันของคนดู เลยไม่ค้างแม้เพื่อนยังไม่ได้เปิดเว็บวันนี้) */
function figures(m) {
  const tk = todayKey(), wk = weekStartKey();
  let week = 0; Object.entries(m.daily).forEach(([k, v]) => { if (k >= wk && k <= tk) week += v; });
  const yest = A.dateKey(A.addDays(new Date(), -1));
  const streak = m.lastDate === tk || m.lastDate === yest ? m.streakRaw : 0;
  return { today: m.daily[tk] || 0, week, total: m.total, streak };
}
/* สถานะตอนนี้: กำลังเรียน / พัก / หยุดไว้ (ถ้าข้อมูลเก่าเกินไปถือว่าไม่ได้เรียนแล้ว) */
function liveOf(m, now = Date.now()) {
  const l = m.live;
  if (l.s === "running" && l.end > now) {
    const left = Math.max(1, Math.ceil((l.end - now) / 60000));
    return l.ph === "break" ? { on: false, cls: "brk", text: `พักระหว่างรอบ · เหลืออีก ${left} นาที` }
                            : { on: true, cls: "on", text: `กำลังเรียน${l.sub ? ` ${l.sub}` : ""} · อีก ${left} นาทีจบรอบ` };
  }
  if (l.s === "paused" && now - l.at < 3 * 3600e3) return { on: false, cls: "pause", text: `หยุดไว้ชั่วคราว${l.sub ? ` · ${l.sub}` : ""}` };
  return null;
}

/* ---------- ข้อมูลของฉันที่ส่งเข้าห้อง ---------- */
/* ห้องที่ใช้อยู่ (เลือกได้ห้องเดียว): ตอนกดจับเวลา สถานะ "กำลังเรียน" จะขึ้นแค่ในห้องนี้ */
const activeId = () => {
  const id = A.pref.activeRoom || "";
  return !R.myRooms || R.myRooms.some(r => r.id === id) ? id : "";
};
function setActive(id) { A.pref.activeRoom = id || ""; A.savePref(); fillRoomPick(); A.Rooms.syncSoon(); }
const IDLE = { s: "idle", ph: "", sub: "", end: 0, at: 0 };
let lastLive = {};
function liveState(rid) {
  const i = A.Timer ? A.Timer.info() : { status: "idle" };
  const here = (i.status === "running" || i.status === "paused") && (i.roomId || "") === rid;
  const cur = here ? { s: i.status, ph: i.phase || "", sub: str(A.subj(i.subjectId || "").name, 40), end: Math.round((i.endsAt || 0) / 60000) * 60000 }
                   : { s: "idle", ph: "", sub: "", end: 0 };
  const prev = lastLive[rid];
  const same = prev && prev.s === cur.s && prev.ph === cur.ph && prev.sub === cur.sub && prev.end === cur.end;
  if (!same) lastLive[rid] = cur.s === "idle" ? IDLE : { ...cur, at: Date.now() };
  return lastLive[rid];
}
function myMember(rid) {
  const p = A.profile || {}, bd = A.byDay(), keys = Object.keys(bd).sort();
  const from = A.dateKey(A.addDays(new Date(), -(DAYS - 1)));
  const daily = {}; keys.forEach(k => { if (k >= from) daily[k] = bd[k].mins; });
  let best = 0, run = 0, prev = null;
  keys.forEach(k => { const d = A.parseKey(k); run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  const sess = A.list("sessions");
  const bySub = {}; sess.forEach(s => { bySub[s.subjectId || ""] = (bySub[s.subjectId || ""] || 0) + (s.focusMin || 0); });
  const subjects = Object.entries(bySub).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, m]) => { const sb = A.subj(id); return { name: str(sb.name, 40), color: sb.color | 0, mins: m }; });
  const fish = new Set(); sess.forEach(s => (A.sessFish ? A.sessFish(s) : []).forEach(id => fish.add(id)));
  return {
    nickname: str(p.nickname, 40), photoURL: safePhoto(A.user && A.user.photoURL), accent: safeAccent(p.accent),
    daily, total: sess.reduce((a, s) => a + (s.focusMin || 0), 0), rounds: sess.length,
    streak: A.streak(bd), best, lastDate: keys[keys.length - 1] || "", subjects, fishN: fish.size, live: liveState(rid || "")
  };
}

/* ---------- ห้องของฉัน: ฟังรายชื่อห้อง + สมาชิกของแต่ละห้อง ---------- */
const R = { uid: null, myRooms: null, rooms: {}, members: {}, mine: {}, err: {}, unsub: [] };
function reset() {
  R.unsub.forEach(u => { try { u(); } catch (e) {} });
  Object.assign(R, { uid: null, myRooms: null, rooms: {}, members: {}, mine: {}, err: {}, unsub: [] });
  roomUnsubs.forEach((u, k) => { try { u(); } catch (e) {} roomUnsubs.delete(k); });
  lastSent = {};
}
const roomUnsubs = new Map();
function ensureListening() {
  const uid = A.user && A.profile ? A.user.uid : null;
  if (uid === R.uid) return;
  reset();
  if (!uid) return;
  R.uid = uid;
  R.unsub.push(db().onCol(`users/${uid}/rooms`, list => {
    R.myRooms = list.sort((a, b) => String(a.joinedAt).localeCompare(String(b.joinedAt)));
    const ids = new Set(R.myRooms.map(r => r.id));
    roomUnsubs.forEach((u, rid) => { if (!ids.has(rid)) { try { u(); } catch (e) {} roomUnsubs.delete(rid); delete R.members[rid]; delete R.rooms[rid]; } });
    R.myRooms.forEach(r => watchRoom(r.id));
    rerender(); A.Rooms.sync();
  }, e => { R.myRooms = []; R.listErr = errMsg(e); rerender(); }));
}
/* ฟังห้องหนึ่ง: ข้อมูลห้อง + สมาชิก
   ถ้าโดนปฏิเสธ ลองใหม่อีกหลายครั้งก่อนสรุปว่าเข้าไม่ได้ เพราะตอนเพิ่งสร้าง/เพิ่งเข้าห้อง
   เครื่องเราเห็นห้องก่อนที่เซิร์ฟเวอร์จะบันทึกเสร็จ (ครั้งแรกจึงอาจโดนปฏิเสธทั้งที่เป็นสมาชิกแล้ว) */
function watchRoom(rid, attempt = 0) {
  if (roomUnsubs.has(rid)) return;
  let dead = false, u1 = null, u2 = null;
  const stop = () => { try { u1 && u1(); } catch (e) {} try { u2 && u2(); } catch (e) {} };
  const fail = e => {
    if (dead) return; dead = true; stop();
    if (attempt < 6) {                                              // 0.8 + 1.6 + 3.2 + 6.4 + 12.8 + 25.6 ≈ 50 วินาที
      const t = setTimeout(() => { roomUnsubs.delete(rid); if (R.uid) watchRoom(rid, attempt + 1); }, 800 * 2 ** attempt);
      roomUnsubs.set(rid, () => clearTimeout(t));
    } else { roomUnsubs.set(rid, () => {}); R.err[rid] = e; rerender(); }
  };
  u1 = db().onDoc(`rooms/${rid}`, d => { R.rooms[rid] = d || { gone: true }; delete R.err[rid]; rerender(); }, fail);
  u2 = db().onCol(`rooms/${rid}/members`, list => { R.members[rid] = list.map(cleanMember); R.mine[rid] = list.find(m => m.id === R.uid) || null; delete R.err[rid]; rerender(); }, fail);
  roomUnsubs.set(rid, () => { dead = true; stop(); });
}
/* เริ่มฟังห้องใหม่ตั้งแต่ต้น (หลังเข้าห้องสำเร็จ) */
function rewatch(rid) {
  const u = roomUnsubs.get(rid); if (u) { try { u(); } catch (e) {} roomUnsubs.delete(rid); }
  delete R.err[rid]; watchRoom(rid);
}

/* ---------- ส่งข้อมูลของฉันเข้าทุกห้อง (เฉพาะเมื่อมีอะไรเปลี่ยน) ---------- */
let lastSent = {}, syncT = null;
async function syncNow() {
  if (!R.uid || !R.myRooms || !A.user || !A.profile || !["db", "local"].includes(A.store.mode)) return;
  for (const r of R.myRooms) {
    const me = myMember(r.id), key = JSON.stringify(me);
    const raw = R.mine[r.id];
    if (!raw || R.err[r.id] || (R.rooms[r.id] && R.rooms[r.id].gone)) continue;      // ยังโหลดไม่เสร็จ / ถูกเอาออกจากห้องแล้ว
    if (lastSent[r.id] === key) continue;
    try { await db().set(`rooms/${r.id}/members/${R.uid}`, { ...me, code: raw.code, joinedAt: raw.joinedAt, updatedAt: new Date().toISOString() }); lastSent[r.id] = key; }
    catch (e) { /* ออฟไลน์หรือกฎยังไม่อัปเดต: ลองใหม่รอบหน้า */ }
  }
}

/* ---------- สร้าง / เข้า / ออก / ลบ ---------- */
async function createRoom(name) {
  if ((R.myRooms || []).length >= MAX_ROOMS) throw new Error(`อยู่ได้สูงสุด ${MAX_ROOMS} ห้อง`);
  const uid = A.user.uid, now = new Date().toISOString(), rid = db().newId();
  let lastErr = null;
  for (let i = 0; i < 4; i++) {                                    // รหัสซ้ำ (โอกาสน้อยมาก) → สุ่มใหม่
    const code = newCode();
    if (await db().get(`invites/${code}`).catch(() => null)) continue;
    try {
      await db().batch([
        ["set", `rooms/${rid}`, { name, owner: uid, code, createdAt: now }],
        ["set", `invites/${code}`, { roomId: rid, name, owner: uid }],
        ["set", `rooms/${rid}/members/${uid}`, { ...myMember(rid), code, joinedAt: now, updatedAt: now }],
        ["set", `users/${uid}/rooms/${rid}`, { name, joinedAt: now }]
      ]);
      setActive(rid); rewatch(rid);
      return rid;
    } catch (e) { lastErr = e; if (e.code !== "permission-denied") break; }
  }
  throw lastErr || new Error("สร้างห้องไม่สำเร็จ");
}
async function joinByCode(code) {
  const inv = await db().get(`invites/${code}`);
  if (!inv || !inv.roomId) throw new Error("ไม่พบห้องจากรหัสนี้ ลองตรวจรหัสอีกครั้ง");
  const uid = A.user.uid, rid = str(inv.roomId, 60);
  if ((R.myRooms || []).some(r => r.id === rid)) return rid;
  if ((R.myRooms || []).length >= MAX_ROOMS) throw new Error(`อยู่ได้สูงสุด ${MAX_ROOMS} ห้อง ออกจากห้องเก่าก่อน`);
  const now = new Date().toISOString(), name = str(inv.name, 40) || "ห้องเรียน";
  await db().batch([
    ["set", `rooms/${rid}/members/${uid}`, { ...myMember(rid), code, joinedAt: now, updatedAt: now }],
    ["set", `users/${uid}/rooms/${rid}`, { name, joinedAt: now }]
  ]);
  setActive(rid); rewatch(rid);
  const all = await db().list(`rooms/${rid}/members`).catch(() => []);
  if (all.length > MAX_MEMBERS) {                                   // ห้องเต็ม → ถอยออก
    await leaveRoom(rid).catch(() => {});
    throw new Error(`ห้องนี้เต็มแล้ว (${MAX_MEMBERS} คน)`);
  }
  return rid;
}
const leaveRoom = rid => (activeId() === rid && setActive(""), db().batch([["del", `rooms/${rid}/members/${A.user.uid}`], ["del", `users/${A.user.uid}/rooms/${rid}`]]));
async function deleteRoom(rid) {
  if (activeId() === rid) setActive("");
  const room = R.rooms[rid] || {}, members = await db().list(`rooms/${rid}/members`);
  await db().batch([
    ...members.filter(m => m.id !== A.user.uid).map(m => ["del", `rooms/${rid}/members/${m.id}`]),
    ["del", `rooms/${rid}/members/${A.user.uid}`],
    ...(room.code ? [["del", `invites/${room.code}`]] : []),
    ["del", `rooms/${rid}`],
    ["del", `users/${A.user.uid}/rooms/${rid}`]
  ]);
}
async function kick(rid, uid) { await db().batch([["del", `rooms/${rid}/members/${uid}`]]); }
async function newInvite(rid) {
  const room = R.rooms[rid]; if (!room) return;
  const code = newCode();
  await db().batch([
    ["set", `invites/${code}`, { roomId: rid, name: room.name, owner: A.user.uid }],
    ["set", `rooms/${rid}`, { ...room, code }],
    ...(room.code ? [["del", `invites/${room.code}`]] : [])
  ]);
}

/* ---------- ชิ้นส่วนหน้า ---------- */
function ava(m, size) {
  const a = el("span", { class: "rm-ava" + (size ? " " + size : ""), style: `--acc:${m.accent}` });
  if (m.photo) a.append(el("img", { src: m.photo, alt: "", referrerpolicy: "no-referrer", loading: "lazy" }));
  else a.append(el("span", { "aria-hidden": "true", text: (m.nickname.trim()[0] || "?").toUpperCase() }));
  return a;
}
function head(title, sub, ...tools) {
  return el("div", { class: "page-head rm-head" },
    el("div", {}, el("p", { class: "eyebrow", text: sub || "ห้องเรียน" }), el("h1", { class: "display sm", id: "rmH", tabindex: "-1", text: title })),
    tools.length ? el("div", { class: "rm-tools" }, ...tools) : null);
}
function needLogin(box) {
  box.append(el("div", { class: "glass rm-empty" }, el("p", { text: "ระบบห้องเรียนต้องเข้าสู่ระบบก่อน" })));
}
async function copyInvite(code) {
  const url = inviteURL(code), text = `มาเรียนด้วยกันในห้อง "${(R.rooms[A.pageParam] || {}).name || ""}" บนสายเรียน\nรหัสห้อง ${code}\n${url}`;
  try {
    if (navigator.share && matchMedia("(pointer:coarse)").matches) await navigator.share({ title: "ชวนเข้าห้องเรียน", text, url });
    else { await navigator.clipboard.writeText(url); A.toast("คัดลอกลิงก์เชิญแล้ว ส่งให้เพื่อนได้เลย"); }
  } catch (e) { if (e.name !== "AbortError") prompt("คัดลอกลิงก์นี้ส่งให้เพื่อน", url); }
}

/* ---------- #rooms : ห้องที่เข้าร่วม (+ ปุ่มไปสร้างห้อง / ใส่รหัส ซึ่งแยกไปอีกหน้า) ---------- */
let listKey = "";
function renderList(force) {
  const box = $("rmRoot");
  if (!A.user || !A.profile) { listKey = ""; box.textContent = ""; needLogin(box); return; }
  const act = activeId();
  const rows = (R.myRooms || []).map(r => {
    const mem = R.members[r.id] || [], room = R.rooms[r.id];
    const live = mem.filter(m => { const l = liveOf(m); return l && l.on; }).length;
    const sorted = mem.map(m => ({ m, f: figures(m) })).sort((a, b) => b.f.week - a.f.week);
    const rank = sorted.findIndex(x => x.m.id === R.uid) + 1;
    return { id: r.id, name: (room && room.name) || r.name, n: mem.length, live, rank, gone: !!(room && room.gone) || !!R.err[r.id], loaded: !!room, act: r.id === act };
  });
  const key = JSON.stringify([R.myRooms === null, rows, R.listErr || ""]);
  if (key === listKey && box.firstChild && force !== true) return;
  listKey = key; roomKey = ""; joinShown = ""; formShown = ""; box.textContent = "";
  box.append(head("ห้องเรียน", "เรียนไปด้วยกันกับเพื่อน"));

  box.append(el("div", { class: "rm-actions" },
    el("a", { class: "rm-act new", href: "#rooms/new" },
      el("span", { class: "rm-act-ic", "aria-hidden": "true", text: "+" }),
      el("span", {}, el("b", { text: "สร้างห้อง" }), el("small", { text: "ตั้งชื่อห้อง แล้วชวนเพื่อน" }))),
    el("a", { class: "rm-act join", href: "#rooms/join" },
      el("span", { class: "rm-act-ic", "aria-hidden": "true", text: "#" }),
      el("span", {}, el("b", { text: "ใส่รหัสเข้าห้อง" }), el("small", { text: "มีรหัส 6 ตัวจากเพื่อน" })))));

  const list = el("div", { class: "rm-list" });
  box.append(el("h2", { class: "rm-sec", text: `ห้องที่เข้าร่วม${rows.length ? ` (${rows.length})` : ""}` }), list);
  if (R.myRooms === null) { list.append(el("p", { class: "muted", text: "กำลังโหลดห้อง…" })); return; }
  if (R.listErr) { list.append(el("p", { class: "err", text: `โหลดรายชื่อห้องไม่สำเร็จ: ${R.listErr}` })); return; }
  if (!rows.length) { list.append(el("div", { class: "glass rm-empty" },
    el("p", { class: "rm-empty-t", text: "ยังไม่ได้เข้าห้องไหน" }),
    el("p", { class: "muted sm", text: "กด “สร้างห้อง” แล้วชวนเพื่อน หรือ “ใส่รหัสเข้าห้อง” ถ้าเพื่อนส่งรหัสมา" }))); return; }
  rows.forEach(r => list.append(el("a", { class: "glass rm-card" + (r.gone ? " gone" : "") + (r.act ? " act" : ""), href: `#r/${r.id}` },
    el("div", { class: "rm-card-t" },
      el("b", {}, r.name, r.act ? el("span", { class: "rm-using", text: "ห้องที่ใช้อยู่" }) : null),
      r.gone ? el("span", { class: "muted sm", text: "เข้าไม่ได้แล้ว (ห้องถูกลบหรือถูกเอาออก)" })
        : el("span", { class: "muted sm", text: r.loaded ? `${r.n} คน${r.rank ? ` · คุณอันดับ ${r.rank} สัปดาห์นี้` : ""}` : "กำลังโหลด…" })),
    r.gone || !r.live ? null : el("span", { class: "rm-live-n" }, el("i", { class: "rm-dot on", "aria-hidden": "true" }), `กำลังเรียน ${r.live} คน`))));
  if (rows.length > 1) box.append(el("p", { class: "muted sm", text: "ตอนจับเวลา สถานะ “กำลังเรียน” จะขึ้นเฉพาะห้องที่ใช้อยู่ เปลี่ยนห้องได้ที่หน้าจับเวลาหรือในหน้าห้อง เวลาเรียนรวมยังนับทุกห้อง" }));
}

/* ---------- #rooms/new และ #rooms/join : ฟอร์มแยกหน้า ---------- */
let formShown = "";
function renderForm() {
  const box = $("rmRoot"), kind = A.pageParam === "join" ? "join" : "new";
  if (!A.user || !A.profile) { formShown = ""; box.textContent = ""; needLogin(box); return; }
  if (formShown === kind && box.firstChild) return;
  formShown = kind; listKey = ""; roomKey = ""; joinShown = "";
  box.textContent = "";
  const back = el("a", { class: "btn sm", href: "#rooms", text: "← ห้องเรียน" });
  if (kind === "new") {
    const nameIn = el("input", { type: "text", id: "rmName", maxlength: "40", required: true, class: "rm-big-in", placeholder: "เช่น ม.5/2 ติวสอบกลางภาค", value: `ห้องของ ${A.profile.nickname || ""}`.trim() });
    const btn = el("button", { type: "submit", class: "cta" }, el("span", { text: "สร้างห้อง" }), el("i", { class: "cta-dot", "aria-hidden": "true" }, svgArrow()));
    const f = el("form", { class: "glass rm-form", onsubmit: async e => {
      e.preventDefault(); const name = nameIn.value.trim().slice(0, 40);
      if (!name) return nameIn.focus();
      btn.disabled = true;
      try { const rid = await createRoom(name); A.pref.rmFresh = rid; A.savePref(); location.hash = `r/${rid}`; }
      catch (err) { A.toast(err.code ? errMsg(err) : err.message); btn.disabled = false; }
    } },
      el("label", { for: "rmName", class: "rm-lbl", text: "ตั้งชื่อห้อง" }), nameIn,
      el("p", { class: "muted sm", text: `สร้างเสร็จจะได้รหัส 6 ตัวกับลิงก์ไว้ส่งให้เพื่อน ห้องละไม่เกิน ${MAX_MEMBERS} คน` }),
      el("div", { class: "actions" }, btn));
    box.append(head("สร้างห้อง", "ห้องเรียน", back), f);
    setTimeout(() => { nameIn.focus(); nameIn.select(); });
  } else {
    const codeIn = el("input", { type: "text", id: "rmCode", maxlength: "6", required: true, autocomplete: "off", autocapitalize: "characters", spellcheck: "false", inputmode: "text", placeholder: "ABC234", class: "rm-big-in rm-code-in" });
    codeIn.addEventListener("input", () => { codeIn.value = normCode(codeIn.value); });
    const btn = el("button", { type: "submit", class: "cta" }, el("span", { text: "เข้าห้อง" }), el("i", { class: "cta-dot", "aria-hidden": "true" }, svgArrow()));
    const f = el("form", { class: "glass rm-form", onsubmit: e => {
      e.preventDefault(); const code = normCode(codeIn.value);
      if (code.length !== 6) { A.toast("รหัสห้องมี 6 ตัว"); return codeIn.focus(); }
      location.hash = `join/${code}`;
    } },
      el("label", { for: "rmCode", class: "rm-lbl", text: "รหัสห้อง 6 ตัว" }), codeIn,
      el("p", { class: "muted sm", text: "ขอรหัสจากเพื่อนที่สร้างห้อง (กดปุ่ม “ชวนเพื่อน” ในห้องจะเห็นรหัส) หรือกดลิงก์เชิญที่เพื่อนส่งมาก็ได้" }),
      el("div", { class: "actions" }, btn));
    box.append(head("ใส่รหัสเข้าห้อง", "ห้องเรียน", back), f);
    setTimeout(() => codeIn.focus());
  }
}

/* ---------- #join/<CODE> ---------- */
let joinSeq = 0, joinShown = "";
async function renderJoin() {
  const box = $("rmRoot"), code = normCode(A.pageParam);
  if (!A.user || !A.profile) { joinShown = ""; box.textContent = ""; needLogin(box); return; }
  if (joinShown === code) return;
  joinShown = code; const my = ++joinSeq; listKey = ""; roomKey = ""; formShown = "";
  box.textContent = ""; box.append(head("ลิงก์เชิญเข้าห้อง", `รหัส ${code}`), el("p", { class: "muted", text: "กำลังหาห้อง…" }));
  let inv = null, err = null;
  try { inv = await db().get(`invites/${code}`); } catch (e) { err = e; }
  if (my !== joinSeq) return;
  box.textContent = "";
  if (!inv) {
    box.append(head("ไม่พบห้องนี้", `รหัส ${code}`), el("div", { class: "glass rm-empty" },
      el("p", { text: err ? errMsg(err) : "รหัสอาจผิด หรือเจ้าของห้องเปลี่ยนรหัสใหม่แล้ว ขอรหัสล่าสุดจากเพื่อนอีกครั้ง" }),
      el("a", { class: "btn", href: "#rooms", text: "ไปหน้าห้องเรียน" })));
    return;
  }
  const already = (R.myRooms || []).some(r => r.id === inv.roomId);
  const b = el("button", { type: "button", class: "cta", onclick: async () => {
    b.disabled = true;
    try { const rid = await joinByCode(code); A.toast("เข้าห้องแล้ว"); location.hash = `r/${rid}`; }
    catch (e) { A.toast(e.code ? errMsg(e) : e.message); b.disabled = false; }
  } }, el("span", { text: already ? "เปิดห้อง" : "เข้าร่วมห้องนี้" }), el("i", { class: "cta-dot", "aria-hidden": "true" }, svgArrow()));
  if (already) b.onclick = () => { location.hash = `r/${inv.roomId}`; };
  box.append(head(str(inv.name, 40) || "ห้องเรียน", "คุณได้รับคำเชิญ"), el("div", { class: "glass rm-join" },
    el("p", { text: "เข้าห้องแล้ว เพื่อนในห้องจะเห็นชื่อเล่น รูปโปรไฟล์ เวลาเรียน วิชาที่กำลังเรียน กราฟแนวโน้ม และจำนวนปลาที่สะสมของคุณ" }),
    el("p", { class: "muted sm", text: "ไม่เห็นชื่อจริง อายุ อีเมล บันทึกสรุป หรือรูปแม่น้ำ ออกจากห้องได้ทุกเมื่อ" }),
    el("div", { class: "actions" }, b, el("a", { class: "btn", href: "#rooms", text: "ยังไม่เข้า" }))));
}
function svgArrow() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", "M7 17L17 7M9 7h8v8"); s.append(p); return s;
}

/* ---------- #r/<roomId> : ตารางอันดับ ---------- */
let roomKey = "";
function renderRoom(force) {
  const box = $("rmRoot"), rid = A.pageParam, uidSel = A.pageParam2;
  if (!A.user || !A.profile) { roomKey = ""; box.textContent = ""; needLogin(box); return; }
  watchRoom(rid);
  const room = R.rooms[rid], mem = R.members[rid], err = R.err[rid];
  const metric = METRICS[A.pref.rmMetric] ? A.pref.rmMetric : "week";
  const minute = Math.floor(Date.now() / 60000);
  const key = JSON.stringify([rid, uidSel, room || null, mem || null, err ? err.code || "e" : "", metric, minute, A.pref.rmFresh === rid, activeId()]);
  if (key === roomKey && box.firstChild && force !== true) return;
  roomKey = key; listKey = ""; joinShown = ""; formShown = "";
  const focusTools = box.querySelector(".rm-seg button:focus") ? document.activeElement.dataset.m : null;
  box.textContent = "";
  if (err || (room && room.gone)) {
    box.append(head("เข้าห้องนี้ไม่ได้", "ห้องเรียน"), el("div", { class: "glass rm-empty" },
      el("p", { text: room && room.gone ? "ห้องนี้ถูกลบไปแล้ว" : "คุณไม่ได้เป็นสมาชิกห้องนี้แล้ว หรือยังไม่ได้เข้าร่วม" }),
      el("div", { class: "actions" },
        (R.myRooms || []).some(r => r.id === rid) ? el("button", { type: "button", class: "btn", onclick: async () => { await db().batch([["del", `users/${A.user.uid}/rooms/${rid}`]]).catch(() => {}); location.hash = "rooms"; }, text: "เอาออกจากรายการ" }) : null,
        el("a", { class: "btn", href: "#rooms", text: "กลับหน้าห้องเรียน" }))));
    return;
  }
  if (!room || !mem) { box.append(head("กำลังโหลดห้อง…", "ห้องเรียน")); return; }
  if (uidSel) return renderMember(box, rid, room, mem, uidSel);

  const isOwner = room.owner === R.uid, now = Date.now();
  const rows = mem.map(m => ({ m, f: figures(m), l: liveOf(m, now) }))
    .sort((a, b) => b.f[metric] - a.f[metric] || (b.l && b.l.on) - (a.l && a.l.on) || a.m.nickname.localeCompare(b.m.nickname));
  const liveN = rows.filter(r => r.l && r.l.on).length;
  const sum = k => rows.reduce((a, r) => a + r.f[k], 0);

  box.append(head(str(room.name, 40), `ห้องเรียน · ${mem.length} คน`,
    el("button", { type: "button", class: "btn sm", onclick: () => toggleInvite(), "aria-expanded": "false", id: "rmInvBtn", text: "ชวนเพื่อน" }),
    el("a", { class: "btn sm", href: "#rooms", text: "ห้องทั้งหมด" })));
  box.append(invitePanel(room, isOwner, rid));
  const using = activeId() === rid;
  box.append(el("div", { class: "rm-use" + (using ? " on" : "") },
    el("span", { class: "rm-use-t" }, using ? el("b", { text: "ห้องที่ใช้อยู่" }) : null,
      using ? " ตอนจับเวลา เพื่อนในห้องนี้จะเห็นว่าคุณกำลังเรียน" : "ห้องนี้ยังไม่ใช่ห้องที่ใช้อยู่ ตอนจับเวลาเพื่อนห้องนี้จะไม่เห็นว่าคุณกำลังเรียน"),
    el("span", { class: "rm-use-b" },
      using ? null : el("button", { type: "button", class: "btn sm", onclick: () => { setActive(rid); A.toast("เปลี่ยนเป็นห้องที่ใช้อยู่แล้ว"); renderRoom(true); }, text: "ใช้ห้องนี้" }),
      el("button", { type: "button", class: "btn primary sm", onclick: () => { setActive(rid); location.hash = "timer"; }, text: "เริ่มเรียนในห้องนี้" }))));

  box.append(el("div", { class: "rm-tiles" },
    tile(fmtMin(sum("week")), "ทั้งห้องเรียนสัปดาห์นี้"),
    tile(fmtMin(sum("today")), "ทั้งห้องเรียนวันนี้"),
    tile(String(liveN), "กำลังเรียนอยู่ตอนนี้", liveN ? "on" : "")));

  const seg = el("div", { class: "rm-seg", role: "group", "aria-label": "เรียงอันดับตาม" }, Object.entries(METRICS).map(([k, t]) =>
    el("button", { type: "button", "data-m": k, "aria-pressed": String(k === metric), onclick: () => { A.pref.rmMetric = k; A.savePref(); renderRoom(true); const b = box.querySelector(`.rm-seg [data-m="${k}"]`); if (b) b.focus(); }, text: t })));
  const max = Math.max(1, ...rows.map(r => r.f[metric]));
  const ol = el("ol", { class: "rm-board" });
  rows.forEach((r, i) => {
    const me = r.m.id === R.uid, v = r.f[metric];
    ol.append(el("li", { class: "rm-r" + (me ? " me" : "") + (i < 3 && v > 0 ? " top t" + (i + 1) : "") },
      el("a", { href: `#r/${rid}/${r.m.id}`, class: "rm-r-a", "aria-label": `${r.m.nickname}${me ? " (คุณ)" : ""} อันดับ ${i + 1} ${METRICS[metric]} ${fmtMin(v)}${r.l ? ` ${r.l.text}` : ""}` },
        el("span", { class: "rm-rank", "aria-hidden": "true", text: String(i + 1) }),
        el("span", { class: "rm-ava-w", "aria-hidden": "true" }, ava(r.m), r.l ? el("i", { class: "rm-dot " + r.l.cls }) : null),
        el("span", { class: "rm-who", "aria-hidden": "true" },
          el("b", {}, r.m.nickname, me ? el("span", { class: "rm-you", text: "คุณ" }) : null, room.owner === r.m.id ? el("span", { class: "rm-own", text: "เจ้าของห้อง" }) : null),
          el("span", { class: "rm-sub" + (r.l ? " " + r.l.cls : ""), text: r.l ? r.l.text : r.f.streak ? `เรียนติดกัน ${r.f.streak} วัน` : "ยังไม่ได้เรียนช่วงนี้" }),
          el("span", { class: "rm-bar" }, el("i", { style: `width:${v ? Math.max(3, v / max * 100) : 0}%;background:${r.m.accent}` }))),
        el("span", { class: "rm-val", "aria-hidden": "true" }, el("b", { text: fmtShort(v) }), el("small", { text: "ชม." })))));
  });
  box.append(el("section", { class: "glass rm-board-w", "aria-labelledby": "rmBoardH" },
    el("div", { class: "card-head" }, el("h2", { id: "rmBoardH", text: "อันดับเวลาเรียน" }), seg), ol,
    el("p", { class: "muted sm rm-note", text: "สัปดาห์นับวันจันทร์ถึงอาทิตย์ · นับเฉพาะรอบที่เรียนจบ · กดชื่อเพื่อนเพื่อดูแนวโน้ม" })));

  box.append(el("div", { class: "rm-foot" },
    isOwner
      ? el("button", { type: "button", class: "btn danger sm", onclick: async e => {
          if (!confirm(`ลบห้อง "${room.name}"? สมาชิกทุกคนจะถูกเอาออก และย้อนกลับไม่ได้`)) return;
          e.target.disabled = true;
          try { await deleteRoom(rid); A.toast("ลบห้องแล้ว"); location.hash = "rooms"; } catch (er) { A.toast(errMsg(er)); e.target.disabled = false; }
        }, text: "ลบห้องนี้" })
      : el("button", { type: "button", class: "btn danger sm", onclick: async e => {
          if (!confirm(`ออกจากห้อง "${room.name}"? เพื่อนในห้องจะไม่เห็นข้อมูลของคุณอีก`)) return;
          e.target.disabled = true;
          try { await leaveRoom(rid); A.toast("ออกจากห้องแล้ว"); location.hash = "rooms"; } catch (er) { A.toast(errMsg(er)); e.target.disabled = false; }
        }, text: "ออกจากห้อง" })));
  if (A.pref.rmFresh === rid) { delete A.pref.rmFresh; A.savePref(); toggleInvite(true); }
  if (focusTools) { const b = box.querySelector(`.rm-seg [data-m="${focusTools}"]`); if (b) b.focus(); }
}
function tile(v, label, cls) { return el("div", { class: "rm-tile" + (cls ? " " + cls : "") }, el("b", { text: v }), el("span", { text: label })); }
let invOpen = false;
function invitePanel(room, isOwner, rid) {
  const code = str(room.code, 6);
  const p = el("section", { class: "glass rm-inv", id: "rmInv", hidden: !invOpen, "aria-label": "ชวนเพื่อนเข้าห้อง" },
    el("div", { class: "rm-inv-code" }, el("span", { class: "muted sm", text: "รหัสห้อง" }), el("b", { text: code.split("").join(" ") })),
    el("div", { class: "rm-inv-r" },
      el("p", { class: "muted sm", text: "ส่งลิงก์ให้เพื่อนกด หรือบอกรหัสให้ไปใส่ที่หน้า ห้องเรียน → เข้าห้องด้วยรหัส" }),
      el("code", { class: "rm-url", text: inviteURL(code) }),
      el("div", { class: "actions" },
        el("button", { type: "button", class: "btn primary sm", onclick: () => copyInvite(code), text: "คัดลอก / แชร์ลิงก์" }),
        isOwner ? el("button", { type: "button", class: "btn sm", onclick: async e => {
          if (!confirm("เปลี่ยนรหัสใหม่? รหัสและลิงก์เก่าจะใช้ไม่ได้ (คนที่อยู่ในห้องแล้วไม่ได้รับผลกระทบ)")) return;
          e.target.disabled = true;
          try { await newInvite(rid); A.toast("เปลี่ยนรหัสห้องแล้ว"); } catch (er) { A.toast(errMsg(er)); e.target.disabled = false; }
        }, text: "เปลี่ยนรหัส" }) : null)));
  return p;
}
function toggleInvite(force) {
  const p = $("rmInv"), b = $("rmInvBtn"); if (!p) return;
  invOpen = force === true ? true : p.hidden;
  p.hidden = !invOpen; if (b) b.setAttribute("aria-expanded", String(invOpen));
}

/* ---------- #r/<roomId>/<uid> : ดูเพื่อน ---------- */
function renderMember(box, rid, room, mem, uid) {
  const m = mem.find(x => x.id === uid);
  if (!m) { box.append(head("ไม่พบสมาชิกคนนี้", str(room.name, 40)), el("a", { class: "btn", href: `#r/${rid}`, text: "กลับไปห้อง" })); return; }
  const f = figures(m), l = liveOf(m), me = uid === R.uid;
  const days = [...Array(30)].map((_, i) => { const k = A.dateKey(A.addDays(new Date(), i - 29)); return { k, v: m.daily[k] || 0 }; });
  const last7 = days.slice(-7).reduce((a, d) => a + d.v, 0), prev7 = days.slice(-14, -7).reduce((a, d) => a + d.v, 0);
  const studied = days.filter(d => d.v > 0).length;
  const trend = prev7 ? Math.round((last7 - prev7) / prev7 * 100) : null;
  const trendTxt = trend === null ? (last7 ? "เริ่มเรียนสัปดาห์นี้" : "7 วันล่าสุดยังไม่ได้เรียน") : trend > 0 ? `มากกว่า 7 วันก่อนหน้า ${trend}%` : trend < 0 ? `น้อยกว่า 7 วันก่อนหน้า ${-trend}%` : "เท่ากับ 7 วันก่อนหน้า";

  const top = el("div", { class: "glass rm-mhead", style: `--acc:${m.accent}` },
    el("span", { class: "rm-ava-w" }, ava(m, "lg"), l ? el("i", { class: "rm-dot " + l.cls, "aria-hidden": "true" }) : null),
    el("div", { class: "rm-mid" },
      el("h1", { class: "display sm", id: "rmH", tabindex: "-1" }, m.nickname, me ? el("span", { class: "rm-you", text: "คุณ" }) : null),
      el("p", { class: "rm-sub" + (l ? " " + l.cls : ""), text: l ? l.text : "ตอนนี้ไม่ได้เรียน" }),
      el("p", { class: "muted sm", text: `อยู่ในห้อง ${str(room.name, 40)}${m.joinedAt ? ` ตั้งแต่ ${A.thDate(new Date(m.joinedAt))}` : ""}` })),
    el("a", { class: "btn sm", href: `#r/${rid}`, text: "กลับไปห้อง" }));
  box.append(top);
  box.append(el("div", { class: "rm-tiles four" },
    tile(fmtMin(f.week), "สัปดาห์นี้"), tile(fmtMin(f.today), "วันนี้"),
    tile(`${f.streak} วัน`, "เรียนติดกันตอนนี้"), tile(fmtMin(f.total), "เวลาเรียนรวมทั้งหมด")));
  box.append(el("section", { class: "glass rm-chart-w", "aria-labelledby": "rmChH" },
    el("div", { class: "card-head" }, el("div", {}, el("h2", { id: "rmChH", text: "แนวโน้ม 30 วัน" }),
      el("p", { class: "muted sm", text: `เรียน ${studied} จาก 30 วัน · 7 วันล่าสุด ${fmtMin(last7)} (${trendTxt})` }))),
    chart(days, m.accent, m.nickname)));
  const subj = m.subjects.filter(s => s.mins > 0), smax = Math.max(1, ...subj.map(s => s.mins));
  box.append(el("div", { class: "rm-two" },
    el("section", { class: "glass rm-box" }, el("h2", { text: "วิชาที่เรียนมากที่สุด" }),
      subj.length ? el("ul", { class: "pv-bars" }, subj.map(s => el("li", {},
        el("span", { class: "pb-name" }, el("i", { class: "dot c" + s.color }), s.name),
        el("span", { class: "pb-track" }, el("span", { class: "pb-fill c" + s.color, style: `width:${Math.max(4, s.mins / smax * 100)}%` })),
        el("span", { class: "pb-val", text: fmtMin(s.mins) }))))
        : el("p", { class: "muted sm", text: "ยังไม่มีข้อมูล" })),
    el("section", { class: "glass rm-box" }, el("h2", { text: "สถิติอื่นๆ" }),
      el("ul", { class: "rm-facts" },
        el("li", {}, el("span", { text: "เรียนจบแล้ว" }), el("b", { text: `${m.rounds} รอบ` })),
        el("li", {}, el("span", { text: "ติดกันนานที่สุด" }), el("b", { text: `${m.best} วัน` })),
        el("li", {}, el("span", { text: "ปลาที่สะสม" }), el("b", { text: `${m.fishN} จาก ${A.FISH ? A.FISH.length : 14} ชนิด` }))),
      me ? null : el("a", { class: "btn sm", href: `#u/${uid}`, text: "ดูโปรไฟล์เต็ม (ถ้าเพื่อนเปิดแชร์ไว้)" }))));
  if (me) box.append(el("p", { class: "muted sm", text: "นี่คือสิ่งที่เพื่อนในห้องเห็นเกี่ยวกับคุณ" }));
  else if (room.owner === R.uid) box.append(el("div", { class: "rm-foot" }, el("button", { type: "button", class: "btn danger sm", onclick: async e => {
    if (!confirm(`เอา ${m.nickname} ออกจากห้อง? เขาเข้าใหม่ได้ถ้ามีรหัสห้อง (เปลี่ยนรหัสได้ที่ปุ่ม ชวนเพื่อน)`)) return;
    e.target.disabled = true;
    try { await kick(rid, uid); A.toast(`เอา ${m.nickname} ออกจากห้องแล้ว`); location.hash = `r/${rid}`; } catch (er) { A.toast(errMsg(er)); e.target.disabled = false; }
  }, text: "เอาออกจากห้อง" })));
}
/* กราฟแท่งเวลาเรียนรายวัน 30 วัน + เส้นค่าเฉลี่ยของวันที่เรียน */
function chart(days, color, nick) {
  const NS = "http://www.w3.org/2000/svg", P = { l: 40, r: 10, t: 26, b: 28 };
  const W = Math.round(Math.min(900, Math.max(320, (document.querySelector(".wrap") || document.body).clientWidth - 80))), H = Math.round(Math.max(180, Math.min(240, W * 0.42)));
  const lab = W < 520 ? 7 : 5;                                       // จอแคบ: ป้ายวันที่ห่างขึ้น
  const max = Math.max(60, ...days.map(d => d.v)), top = Math.ceil(max / 60) * 60;
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `0 0 ${W} ${H}`); s.setAttribute("class", "rm-chart"); s.setAttribute("role", "img");
  const tot = days.reduce((a, d) => a + d.v, 0), act = days.filter(d => d.v);
  s.setAttribute("aria-label", `เวลาเรียนรายวันของ ${nick} 30 วันล่าสุด รวม ${fmtMin(tot)} เรียน ${act.length} วัน`);
  const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); s.append(e); return e; };
  const y = v => P.t + (H - P.t - P.b) * (1 - v / top), bw = (W - P.l - P.r) / days.length;
  const steps = top / 60 <= 4 ? top / 60 : 4;
  for (let i = 0; i <= steps; i++) {
    const v = top * i / steps;
    mk("line", { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: "gl" });
    const t = mk("text", { x: P.l - 6, y: y(v) + 4, class: "ax", "text-anchor": "end" }); t.textContent = `${Math.round(v / 6) / 10}`;
  }
  const yl = mk("text", { x: P.l - 6, y: P.t - 12, class: "ax", "text-anchor": "end" }); yl.textContent = "ชม.";
  days.forEach((d, i) => {
    const x = P.l + i * bw, h = d.v ? Math.max(2, y(0) - y(d.v)) : 0;
    if (h) { const r = mk("rect", { x: x + bw * 0.16, y: y(0) - h, width: bw * 0.68, height: h, rx: 3, fill: color, class: "bar" });
      const tt = document.createElementNS(NS, "title"); tt.textContent = `${A.thDate(A.parseKey(d.k))}: ${fmtMin(d.v)}`; r.append(tt); }
    const dd = A.parseKey(d.k);
    if ((days.length - 1 - i) % lab === 0) { const t = mk("text", { x: x + bw / 2, y: H - 8, class: "ax", "text-anchor": "middle" }); t.textContent = i === days.length - 1 ? "วันนี้" : A.thDate(dd); }
  });
  if (act.length) {
    const avg = act.reduce((a, d) => a + d.v, 0) / act.length;
    mk("line", { x1: P.l, x2: W - P.r, y1: y(avg), y2: y(avg), class: "avg" });
    const t = mk("text", { x: P.l + 6, y: y(avg) - 6, class: "ax avg-t", "text-anchor": "start" }); t.textContent = `เฉลี่ยวันที่เรียน ${fmtMin(avg)}`;
  }
  return s;
}

/* ---------- ตัวเลือกห้องในหน้าจับเวลา ---------- */
function fillRoomPick() {
  const w = $("tRoomW"), sel = $("tRoom"); if (!w || !sel) return;
  const rooms = (R.myRooms || []).filter(r => !(R.rooms[r.id] && R.rooms[r.id].gone) && !R.err[r.id]);
  w.hidden = !rooms.length;
  if (!rooms.length) return;
  const info = A.Timer ? A.Timer.info() : { status: "idle" }, busy = info.status !== "idle";
  const want = busy ? info.roomId || "" : activeId();
  const sig = JSON.stringify([rooms.map(r => [r.id, (R.rooms[r.id] || {}).name || r.name]), want, busy]);
  if (sel.dataset.sig === sig) return;
  sel.dataset.sig = sig; sel.textContent = "";
  sel.append(el("option", { value: "", text: "ไม่เข้าห้อง (เรียนคนเดียว)" }));
  rooms.forEach(r => sel.append(el("option", { value: r.id, text: (R.rooms[r.id] || {}).name || r.name })));
  sel.value = rooms.some(r => r.id === want) ? want : "";
  sel.disabled = busy;
}
document.addEventListener("change", e => { if (e.target && e.target.id === "tRoom") setActive(e.target.value); });

/* ---------- เชื่อมกับแอป ---------- */
function homeNote() {
  const n = $("fRoomK"); if (!n) return;
  if (!R.myRooms) { n.textContent = ""; return; }
  if (!R.myRooms.length) { n.textContent = "เรียนกับเพื่อน"; return; }
  const live = new Set(); R.myRooms.forEach(r => (R.members[r.id] || []).forEach(m => { const l = m.id !== R.uid && liveOf(m); if (l && l.on) live.add(m.id); }));
  n.textContent = live.size ? `เพื่อนกำลังเรียน ${live.size} คน` : `${R.myRooms.length} ห้อง`;
}
function rerender() { if (A.page === "rooms") renderList(); else if (A.page === "room") renderRoom(); A.Rooms.sync(); }
setInterval(() => { if (A.page === "room") renderRoom(); else if (A.page === "rooms") renderList(); }, 30000);
A.Rooms = {
  reset,
  sync() { ensureListening(); homeNote(); fillRoomPick(); clearTimeout(syncT); syncT = setTimeout(syncNow, 2000); },
  activeId: () => activeId(),
  name: id => { const r = (R.myRooms || []).find(x => x.id === id); return id ? ((R.rooms[id] || {}).name || (r && r.name) || "") : ""; },
  syncSoon() { ensureListening(); fillRoomPick(); clearTimeout(syncT); syncT = setTimeout(syncNow, 400); }
};
A.pages.rooms = () => { ensureListening(); renderList(); };
A.pages.room = () => { ensureListening(); renderRoom(); };
A.pages.join = () => { ensureListening(); renderJoin(); };
A.pages.roomform = () => { ensureListening(); renderForm(); };
})();
