/* ML WEB — สลับหน้าตาม #hash และเริ่มระบบ */
(() => {
"use strict";
const A = App, $ = A.$;
const PAGES = ["home", "timer", "log", "plan", "tasks", "calendar", "profile"];

function route() {
  const h = location.hash.replace("#", "");
  const m = /^u\/([\w-]{1,128})$/.exec(h);
  const page = m ? "user" : PAGES.includes(h) ? h : "home", section = page === "user" ? "profile" : page;
  const changed = A.page !== page || A.pageParam !== (m ? m[1] : null);
  A.page = page; A.pageParam = m ? m[1] : null;
  document.body.dataset.page = section;
  document.querySelectorAll(".page").forEach(s => { s.hidden = s.dataset.page !== section; });
  document.querySelectorAll("[data-nav]").forEach(a => {
    if (a.dataset.nav === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  render();
  A.Timer.layout();
  if (changed) { window.scrollTo(0, 0); const h1 = document.querySelector(`.page[data-page="${page}"] h1`); if (h1) h1.focus({ preventScroll: true }); }
}
function render() { const fn = A.pages[A.page]; if (fn) fn(); renderStoreNote(); A.renderStreak(); if (A.syncPublic) A.syncPublic(); }

function renderStoreNote() {
  const m = {
    loading: "กำลังโหลดข้อมูล…",
    "db-cache": "กำลังซิงก์ข้อมูล…",
    slow: "ยังติดต่อที่เก็บข้อมูลไม่ได้ ข้อมูลที่เห็นอาจยังไม่ล่าสุด",
    db: "ข้อมูลเก็บไว้กับบัญชี Google ของคุณ เปิดจากคอมหรือมือถือก็เห็นชุดเดียวกัน",
    local: "โหมดทดลอง: ยังไม่ได้เชื่อม Firebase ข้อมูลเก็บไว้ในเบราว์เซอร์นี้เท่านั้น",
    error: `โหลดข้อมูลไม่สำเร็จ (${A.store.err}) ลองรีเฟรชหน้า`
  }[A.store.mode];
  $("storeNote").textContent = m || "";
}

// nav badge while timer runs
A.onTimer = () => {
  const s = A.Timer.info().status, nav = document.querySelector('[data-nav="timer"]');
  nav.classList.toggle("live", s === "running" || s === "paused" || s === "logging");
  if (A.page === "home") A.pages.home();
};
setInterval(() => { if (A.page === "home") A.pages.home(); }, 30000);

document.addEventListener("scenechange", () => { if (A.page === "home") A.pages.home(); });

A.onData = render;
window.addEventListener("hashchange", route);
// เริ่มแต่ละส่วนแยกกัน: ส่วนไหนพัง ส่วนอื่น (โดยเฉพาะการล็อกอิน) ยังทำงานต่อได้
if (window.__errs && __errs.length) showCrash(new Error(__errs[0]));
[route, () => A.startTimer(), () => A.Auth.start()].forEach(fn => { try { fn(); } catch (e) { showCrash(e); } });
})();

/* ถ้ามี error ให้บอกผู้ใช้ (ครั้งเดียว) แทนการค้างเงียบ พร้อมข้อความที่แคปส่งให้ผู้พัฒนาได้ */
function showCrash(e) {
  if (window.console) console.error(e);
  if (document.getElementById("crashBar")) return;
  const msg = (e && (e.message || e.reason && e.reason.message)) || String(e);
  const bar = document.createElement("div");
  bar.id = "crashBar"; bar.className = "crash-bar"; bar.setAttribute("role", "alert");
  const t = document.createElement("span");
  t.textContent = "เว็บโหลดไม่สมบูรณ์ ลองกด Ctrl+Shift+R (มือถือ: ปิดแท็บแล้วเปิดใหม่) ถ้ายังไม่หาย แคปแถบนี้ส่งให้ผู้พัฒนา · " + msg.slice(0, 160);
  const b = document.createElement("button"); b.type = "button"; b.textContent = "โหลดใหม่"; b.onclick = () => location.reload();
  bar.append(t, b); document.body.append(bar);
}
window.addEventListener("error", ev => { if (ev.filename && ev.filename.includes("/js/")) showCrash(ev.error || ev.message); });
