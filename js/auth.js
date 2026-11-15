/* ML WEB — เข้าสู่ระบบด้วย Google (Firebase Auth) + แบบฟอร์มแนะนำตัว + เมนูบัญชี
   ไม่มี config → โหมดทดลอง: ปุ่ม Google จะสร้างผู้ใช้จำลองในเบราว์เซอร์นี้ */
(() => {
"use strict";
const A = App, $ = A.$, el = A.el;
const CFG = window.FIREBASE_CONFIG;
const FB = !!(CFG && CFG.apiKey && window.firebase);
let auth = null;
A.fdb = null;
A.user = null; A.profile = null;
A.mode = FB ? "firebase" : "local";

if (FB) {
  firebase.initializeApp(CFG);
  auth = firebase.auth();
  A.fdb = firebase.firestore();
  A.fdb.enablePersistence({ synchronizeTabs: true }).catch(() => {});   // ใช้ออฟไลน์ได้ ถ้าเบราว์เซอร์รองรับ
}

const SUBJECTS = ["คณิตศาสตร์", "ฟิสิกส์", "เคมี", "ชีววิทยา", "ภาษาไทย", "ภาษาอังกฤษ", "สังคมศึกษา", "ประวัติศาสตร์", "คอมพิวเตอร์", "ศิลปะ", "ดนตรี", "พลศึกษา"];
const INTERESTS = ["AI / Machine Learning", "เขียนโปรแกรม", "หุ่นยนต์", "ดาราศาสตร์", "สิ่งแวดล้อม", "เกม", "ดนตรี", "วาดรูป", "ถ่ายรูป", "อ่านหนังสือ", "กีฬา", "ทำอาหาร", "ภาษาต่างประเทศ", "ธุรกิจ"];

/* ---------- หน้าจอ gate ---------- */
function gate(state) {
  document.documentElement.classList.toggle("gated", !!state);
  $("gate").hidden = !state;
  $("gLoad").hidden = state !== "load";
  $("gLogin").hidden = state !== "login";
  $("gProfile").hidden = state !== "profile";
  const h = state === "login" ? $("gLoginH") : state === "profile" ? $("gProfH") : null;
  if (h) h.focus({ preventScroll: true });
  if (state) window.scrollTo(0, 0);
}
const initial = s => (String(s || "").trim()[0] || "?").toUpperCase();
function avatar(img, init, u) {
  if (u && u.photoURL) { img.src = u.photoURL; img.hidden = false; init.textContent = ""; }
  else { img.hidden = true; img.removeAttribute("src"); init.textContent = initial(A.profile ? A.profile.nickname : u && u.displayName); }
}

/* ---------- ข้อความ error ภาษาคน ---------- */
function authMsg(e) {
  const c = (e && e.code) || "";
  if (c === "auth/unauthorized-domain") return "โดเมนนี้ยังไม่ได้อนุญาตใน Firebase (Authentication → Settings → Authorized domains)";
  if (c === "auth/network-request-failed") return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง";
  if (c === "auth/operation-not-allowed") return "ยังไม่ได้เปิดการล็อกอินด้วย Google ใน Firebase (Authentication → Sign-in method)";
  if (c === "auth/user-disabled") return "บัญชีนี้ถูกปิดการใช้งาน";
  return `เข้าสู่ระบบไม่สำเร็จ (${c || "error"}) ลองใหม่อีกครั้ง`;
}

/* ---------- เข้าสู่ระบบ / ออกจากระบบ ---------- */
const LOCAL_USER = "mlweb.localUser", LOCAL_PROFILE = "mlweb.profile";
$("gGoogle").addEventListener("click", async () => {
  const btn = $("gGoogle"); $("gErr").textContent = ""; btn.disabled = true;
  try {
    if (!FB) { const u = { uid: "local", displayName: "ผู้ทดสอบ", email: "โหมดทดลอง", photoURL: "" }; A.lsSet(LOCAL_USER, u); await onUser(u); return; }
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    try { await auth.signInWithPopup(p); }
    catch (e) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code)) await auth.signInWithRedirect(p);
      else throw e;
    }
  } catch (e) {
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") $("gErr").textContent = authMsg(e);
  } finally { btn.disabled = false; }
});
async function signOut() {
  closeMenu();
  const ts = A.Timer.info().status;
  if (FB && (ts === "running" || ts === "paused") && !confirm("กำลังจับเวลาอยู่ ถ้าออกจากระบบตอนนี้ รอบนี้จะหายไปและไม่ถูกนับ ออกเลยไหม")) return;
  if (FB && ts === "logging" && !confirm("รอบที่เรียนจบยังไม่ได้กดบันทึก ถ้าออกจากระบบตอนนี้ รอบนี้จะหายไป ออกเลยไหม")) return;
  if (!FB) { localStorage.removeItem(LOCAL_USER); await onUser(null); return; }
  gate("load");
  // ล้างข้อมูลที่ค้างในเครื่อง (สำเนาออฟไลน์ของ Firestore + ตัวจับเวลา + ค่าที่จำไว้) กันคนใช้เครื่องต่อมาเห็น
  try { A.stopStore(); await auth.signOut(); } catch (e) {}
  try { localStorage.removeItem("mlweb.timer"); localStorage.removeItem("mlweb.pref"); } catch (e) {}
  try { await A.fdb.terminate(); await A.fdb.clearPersistence(); } catch (e) {}
  location.reload();
}
$("acctOut").addEventListener("click", signOut);
$("pfOut").addEventListener("click", signOut);

/* ---------- สถานะผู้ใช้ ---------- */
let seq = 0;
async function onUser(u) {
  const my = ++seq;
  A.user = u; A.profile = null;
  if (!u) { A.stopStore(); renderAcct(); gate("login"); A.onData && A.onData(); return; }
  gate("load");
  try {
    if (FB) { const snap = await A.fdb.doc(`users/${u.uid}`).get(); A.profile = (snap.exists && snap.data().profile) || null; }
    else A.profile = A.lsGet(LOCAL_PROFILE, null);
  } catch (e) {
    if (my !== seq) return;
    $("gLoad").textContent = `โหลดข้อมูลบัญชีไม่สำเร็จ (${e.code || "error"}) ลองรีเฟรชหน้า`;
    return;
  }
  if (my !== seq) return;
  A.initStore(u.uid);
  renderAcct();
  if (!A.profile) openProfile(false); else enter();
}
function enter() { gate(null); renderAcct(); A.onData && A.onData(); }

/* ---------- แบบฟอร์มแนะนำตัว ---------- */
let editing = false, extraInts = [];
function chip(type, name, value, checked) {
  const id = `${name}-${value}`.replace(/[^\w฀-๿-]/g, "_");
  const inp = el("input", { type, name, id, value, class: "vh" }); inp.checked = !!checked;
  return el("span", { class: "pick-i" }, inp, el("label", { for: id, text: value }));
}
function openProfile(isEdit) {
  editing = isEdit;
  const u = A.user, p = A.profile || {};
  $("gSteps").hidden = isEdit;
  $("gHi").textContent = isEdit ? "แก้ไขโปรไฟล์" : `สวัสดี ${u.displayName || ""}`.trim();
  $("gProfH").textContent = isEdit ? "ข้อมูลของฉัน" : "แนะนำตัวหน่อย";
  $("pfSaveTxt").textContent = isEdit ? "บันทึก" : "เริ่มใช้งาน";
  $("pfCancel").hidden = !isEdit; $("pfOut").hidden = isEdit;
  avatar($("gAvatar"), $("gAvaInit"), u);
  $("pfReal").value = p.realName || (isEdit ? "" : u.displayName || "");
  $("pfNick").value = p.nickname || "";
  $("pfAge").value = p.age || "";
  const fav = p.favSubject || "";
  const sb = $("pfSubj"); sb.textContent = "";
  SUBJECTS.forEach(s => sb.append(chip("radio", "pfSubjR", s, s === fav)));
  $("pfSubjOther").value = fav && !SUBJECTS.includes(fav) ? fav : "";
  const ints = p.interests || [];
  extraInts = ints.filter(i => !INTERESTS.includes(i));
  renderInts(ints);
  $("pfErr").textContent = "";
  gate("profile");
}
function renderInts(checked) {
  const box = $("pfInt"); box.textContent = "";
  [...INTERESTS, ...extraInts].forEach(i => box.append(chip("checkbox", "pfIntC", i, checked.includes(i))));
}
const checkedInts = () => [...document.querySelectorAll('input[name="pfIntC"]:checked')].map(i => i.value);
$("pfSubjOther").addEventListener("input", e => { if (e.target.value.trim()) document.querySelectorAll('input[name="pfSubjR"]').forEach(r => { r.checked = false; }); });
$("pfSubj").addEventListener("change", () => { $("pfSubjOther").value = ""; });
function addInterest() {
  const v = $("pfIntNew").value.trim().slice(0, 30);
  if (!v) { $("pfIntNew").focus(); return; }
  const cur = checkedInts();
  if (![...INTERESTS, ...extraInts].includes(v)) extraInts.push(v);
  if (!cur.includes(v)) cur.push(v);
  renderInts(cur); $("pfIntNew").value = ""; $("pfIntNew").focus();
}
$("pfIntAdd").addEventListener("click", addInterest);
$("pfIntNew").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addInterest(); } });
$("pfCancel").addEventListener("click", () => enter());

$("profF").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("pfErr"), realName = $("pfReal").value.trim(), nickname = $("pfNick").value.trim(), age = Math.round(+$("pfAge").value);
  const favR = document.querySelector('input[name="pfSubjR"]:checked');
  const favSubject = ($("pfSubjOther").value.trim() || (favR ? favR.value : "")).slice(0, 40);
  const interests = checkedInts().slice(0, 20);
  const bad = (msg, id) => { err.textContent = msg; if (id) $(id).focus(); };
  if (!realName) return bad("ใส่ชื่อจริงก่อน", "pfReal");
  if (!nickname) return bad("ใส่ชื่อเล่นก่อน", "pfNick");
  if (!(age >= 5 && age <= 100)) return bad("ใส่อายุเป็นตัวเลข 5–100", "pfAge");
  if (!favSubject) return bad("เลือกวิชาที่ชอบ 1 วิชา หรือพิมพ์เอง", "pfSubjOther");
  if (!interests.length) return bad("เลือกความสนใจอย่างน้อย 1 อย่าง", "pfIntNew");
  err.textContent = "";
  const now = new Date().toISOString();
  const profile = { ...(A.profile || {}), realName: realName.slice(0, 80), nickname: nickname.slice(0, 40), age, favSubject, interests,
                    photoURL: A.user.photoURL || "", createdAt: (A.profile && A.profile.createdAt) || now, updatedAt: now };
  const btn = $("pfSave"); btn.disabled = true;
  try {
    const first = !A.profile;
    await saveProfile(profile);
    if (first) await A.seedIfEmpty(favSubject);
    enter();
    A.toast(first ? `ยินดีต้อนรับ ${nickname} เริ่มเรียนรอบแรกได้เลย` : "บันทึกโปรไฟล์แล้ว");
    if (first) location.hash = "home";
  } catch (e2) { err.textContent = `บันทึกไม่สำเร็จ (${e2.code || "error"}) ลองอีกครั้ง`; }
  finally { btn.disabled = false; }
});

/* ---------- เมนูบัญชีบนแถบด้านบน ---------- */
function renderAcct() {
  const u = A.user;
  $("acct").hidden = !u;
  if (!u) return;
  avatar($("acctImg"), $("acctInit"), u);
  $("acctName").textContent = A.profile ? `${A.profile.nickname} · ${A.profile.realName}` : (u.displayName || "");
  $("acctMail").textContent = u.email || "";
}
function closeMenu() { $("acctMenu").hidden = true; $("acctBtn").setAttribute("aria-expanded", "false"); }
$("acctBtn").addEventListener("click", e => {
  e.stopPropagation();
  const m = $("acctMenu"); m.hidden = !m.hidden; $("acctBtn").setAttribute("aria-expanded", String(!m.hidden));
});
document.addEventListener("click", e => { if (!$("acct").contains(e.target)) closeMenu(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("acctMenu").hidden) { closeMenu(); $("acctBtn").focus(); } });
$("acctEdit").addEventListener("click", () => { closeMenu(); openProfile(true); });
$("acctProfile").addEventListener("click", () => closeMenu());

/* นำเข้าข้อมูลจากไฟล์ส่งออกของเวอร์ชันเก่า: { sessions: {id: {...}}, tasks: {...}, slots, subjects, settings } */
$("acctImport").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; closeMenu();
  if (!f) return;
  try {
    const data = JSON.parse(await f.text()), items = [];
    A.COLS.forEach(c => { const m = data[c]; if (m && typeof m === "object") Object.entries(m).forEach(([id, v]) => { if (v && typeof v === "object" && /^[\w.-]{1,120}$/.test(id)) items.push([c, id, v]); }); });
    if (!items.length) { A.toast("ไม่พบข้อมูลที่นำเข้าได้ในไฟล์นี้"); return; }
    const n = c => items.filter(i => i[0] === c).length;
    if (!confirm(`นำเข้า ${n("sessions")} บันทึก ${n("tasks")} งาน ${n("slots")} คาบเรียน ${n("subjects")} วิชา เข้าบัญชีนี้? (รายการที่ id ซ้ำจะถูกเขียนทับ)`)) return;
    await A.putMany(items);
    A.toast(`นำเข้าแล้ว ${items.length} รายการ`);
  } catch (err) { A.toast(`นำเข้าไม่สำเร็จ (${err.code || err.message || "error"})`); }
});

async function saveProfile(profile) {
  const p = { ...profile, updatedAt: new Date().toISOString() };
  if (FB) await A.fdb.doc(`users/${A.user.uid}`).set({ profile: p });
  else A.lsSet(LOCAL_PROFILE, p);
  A.profile = p; renderAcct();
}

/* ---------- เริ่ม ---------- */
A.Auth = {
  edit() { openProfile(true); },
  saveProfile,
  start() {
    gate("load");
    if (FB) {
      auth.getRedirectResult().catch(e => { $("gErr").textContent = authMsg(e); });
      auth.onAuthStateChanged(u => { onUser(u ? { uid: u.uid, displayName: u.displayName || "", email: u.email || "", photoURL: u.photoURL || "" } : null); });
    } else {
      $("gNote").textContent = "โหมดทดลอง: ยังไม่ได้ตั้งค่า Firebase กดปุ่มนี้จะเข้าเป็นผู้ใช้จำลอง ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น";
      onUser(A.lsGet(LOCAL_USER, null));
    }
  }
};
})();
