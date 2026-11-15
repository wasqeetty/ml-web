/* สายเรียน (SaiRian) — ข้อมูลกลาง, ที่เก็บข้อมูล และฟังก์ชันช่วย */
window.App = (() => {
"use strict";
const A = {};

/* ---------- helpers ---------- */
A.$ = id => document.getElementById(id);
A.el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
};
A.pad = n => String(n).padStart(2, "0");
A.dateKey = d => `${d.getFullYear()}-${A.pad(d.getMonth() + 1)}-${A.pad(d.getDate())}`;
A.parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
A.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
A.dow = d => (d.getDay() + 6) % 7;                 // จันทร์ = 0
A.daysUntil = key => Math.round((A.parseKey(key) - A.parseKey(A.dateKey(new Date()))) / 864e5);
A.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
A.lsGet = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } };
A.lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

A.TH_M = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
A.TH_MF = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
A.TH_D = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"];
A.TH_DS = ["จ","อ","พ","พฤ","ศ","ส","อา"];
A.thDate = d => `${d.getDate()} ${A.TH_M[d.getMonth()]}`;
A.thDateLong = d => `วัน${A.TH_D[A.dow(d)]}ที่ ${d.getDate()} ${A.TH_MF[d.getMonth()]} ${d.getFullYear() + 543}`;

/* ---------- state + store ---------- */
const COLS = ["sessions", "tasks", "slots", "subjects", "settings"];
A.COLS = COLS;
A.S = Object.fromEntries(COLS.map(c => [c, {}]));
A.store = { mode: "loading", err: "" };
A.onData = null;
let db = null, uidPath = "", unsubs = [], loadTimer = null;
const emit = () => { if (A.onData) A.onData(); };
const col = c => db.collection(`${uidPath}/${c}`);

// วิชาเริ่มต้นของผู้ใช้ใหม่ (เขียนครั้งเดียวตอนสร้างโปรไฟล์)
A.DEFAULT_SUBJECTS = {
  math: { name: "คณิตศาสตร์", color: 1, order: 0 },
  sci: { name: "วิทยาศาสตร์", color: 0, order: 1 },
  thai: { name: "ภาษาไทย", color: 2, order: 2 },
  eng: { name: "ภาษาอังกฤษ", color: 3, order: 3 }
};

/* เริ่มฟังข้อมูลของผู้ใช้คนนี้: Firestore ที่ users/<uid>/<collection> หรือ localStorage ในโหมดทดลอง */
A.initStore = uid => {
  A.stopStore();
  A.store.mode = "loading"; emit();
  if (!A.fdb) {
    A.store.mode = "local";
    COLS.forEach(c => { A.S[c] = A.lsGet("mlweb." + c, {}); });
    emit(); return;
  }
  db = A.fdb; uidPath = `users/${uid}`;
  const confirmed = new Set();
  loadTimer = setTimeout(() => { if (confirmed.size < COLS.length && A.store.mode !== "error") { A.store.mode = "slow"; emit(); } }, 10000);
  COLS.forEach(c => {
    unsubs.push(col(c).onSnapshot({ includeMetadataChanges: true }, snap => {
      const m = {}; snap.docs.forEach(x => { m[x.id] = x.data(); });
      A.S[c] = m;
      if (!snap.metadata.fromCache) confirmed.add(c);
      if (confirmed.size === COLS.length) { clearTimeout(loadTimer); A.store.mode = "db"; }
      else if (A.store.mode === "loading") A.store.mode = "db-cache";
      emit();
    }, err => { clearTimeout(loadTimer); A.store.mode = "error"; A.store.err = (err && err.code) || "unknown"; emit(); }));
  });
};
A.stopStore = () => {
  unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = [];
  clearTimeout(loadTimer); db = null; uidPath = "";
  COLS.forEach(c => { A.S[c] = {}; });
};

A.put = async (c, id, data) => {
  if (db) { await col(c).doc(id).set(data); return; }
  A.S[c] = { ...A.S[c], [id]: data }; A.lsSet("mlweb." + c, A.S[c]); emit();
};
A.del = async (c, id) => {
  if (db) { await col(c).doc(id).delete(); return; }
  const m = { ...A.S[c] }; delete m[id]; A.S[c] = m; A.lsSet("mlweb." + c, m); emit();
};
/* เขียนหลายรายการพร้อมกัน (ใช้ตอนตั้งค่าเริ่มต้นและนำเข้าข้อมูลเก่า) */
A.putMany = async items => {
  if (!db) { items.forEach(([c, id, data]) => { A.S[c] = { ...A.S[c], [id]: data }; A.lsSet("mlweb." + c, A.S[c]); }); emit(); return; }
  for (let i = 0; i < items.length; i += 400) {
    const b = A.fdb.batch();
    items.slice(i, i + 400).forEach(([c, id, data]) => b.set(col(c).doc(id), data));
    await b.commit();
  }
};
/* ผู้ใช้ใหม่: ถ้ายังไม่มีวิชาเลย ใส่วิชาเริ่มต้น (+ วิชาที่ชอบ) และเป้าหมาย */
A.seedIfEmpty = async fav => {
  let n;
  if (db) n = (await col("subjects").limit(1).get({ source: "server" }).catch(() => col("subjects").limit(1).get())).size;
  else n = Object.keys(A.S.subjects).length;
  if (n) return;
  const subs = { ...A.DEFAULT_SUBJECTS };
  if (fav && !Object.values(subs).some(s => s.name === fav)) subs.fav = { name: fav.slice(0, 40), color: 4, order: -1 };
  await A.putMany([...Object.entries(subs).map(([id, v]) => ["subjects", id, v]), ["settings", "main", { goalRounds: 1, goalDays: 5 }]]);
};

A.list = c => Object.entries(A.S[c]).map(([id, v]) => ({ ...v, id }));

/* ---------- toast with undo ---------- */
let toastT = null;
A.toast = (msg, undo) => {
  const t = A.$("toast"), b = A.$("toastUndo");
  A.$("toastMsg").textContent = msg;
  b.hidden = !undo;
  b.onclick = undo ? () => { t.classList.remove("show"); undo(); } : null;
  t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), undo ? 5000 : 2600);
};
A.fail = err => A.toast(`บันทึกไม่สำเร็จ (${(err && err.code) || "error"}) ลองอีกครั้ง`);

/* ---------- derived ---------- */
A.pref = A.lsGet("mlweb.pref", {});
A.savePref = () => A.lsSet("mlweb.pref", A.pref);
A.settings = () => ({ goalRounds: 1, goalDays: 5, ...(A.S.settings.main || {}) });
A.subjects = () => A.list("subjects").sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)));
A.subj = id => A.S.subjects[id] ? { ...A.S.subjects[id], id } : { id, name: "ไม่ระบุวิชา", color: 7 };
A.chip = id => { const s = A.subj(id); return A.el("span", { class: "chip" }, A.el("i", { class: "dot c" + (s.color | 0) }), s.name); };
A.fillSubjects = (sel, opts = {}) => {
  const keep = sel.value || opts.value || "";
  sel.textContent = "";
  if (opts.all) sel.append(A.el("option", { value: "", text: opts.all }));
  const list = A.subjects();
  list.forEach(s => sel.append(A.el("option", { value: s.id, text: s.name })));
  if (!list.length && !opts.all) sel.append(A.el("option", { value: "", text: "ยังไม่มีวิชา (เพิ่มได้ที่หน้าตารางเรียน)" }));
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
};
A.sessions = () => A.list("sessions").sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
A.byDay = () => {
  const m = {};
  A.list("sessions").forEach(s => { const x = m[s.date] || (m[s.date] = { count: 0, mins: 0 }); x.count++; x.mins += s.focusMin || 0; });
  return m;
};
A.streak = bd => {
  let d = new Date(); if (!bd[A.dateKey(d)]) d = A.addDays(d, -1);
  let n = 0; while (bd[A.dateKey(d)]) { n++; d = A.addDays(d, -1); }
  return n;
};
A.dueLabel = key => {
  const n = A.daysUntil(key);
  if (n < 0) return { text: `เลยกำหนด ${-n} วัน`, level: "over" };
  if (n === 0) return { text: "วันนี้", level: "over" };
  if (n === 1) return { text: "พรุ่งนี้", level: "soon" };
  return { text: `อีก ${n} วัน`, level: n <= 3 ? "soon" : "ok" };
};
A.KIND = { task: "To-do", assignment: "ส่งงาน", exam: "สอบ" };
A.PRIO = { high: "ด่วน", mid: "ปกติ", low: "ไม่รีบ" };
A.fmtHours = mins => { const h = mins / 60; return h % 1 === 0 ? String(h) : h.toFixed(1); };

return A;
})();
