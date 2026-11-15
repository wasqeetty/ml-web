/* ML WEB — สลับหน้าตาม #hash และเริ่มระบบ */
(() => {
"use strict";
const A = App, $ = A.$;
const PAGES = ["home", "timer", "log", "plan", "tasks", "calendar"];

function route() {
  const h = location.hash.replace("#", "");
  const page = PAGES.includes(h) ? h : "home";
  const changed = A.page !== page;
  A.page = page;
  document.body.dataset.page = page;
  document.querySelectorAll(".page").forEach(s => { s.hidden = s.dataset.page !== page; });
  document.querySelectorAll("[data-nav]").forEach(a => {
    if (a.dataset.nav === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  render();
  A.Timer.layout();
  if (changed) { window.scrollTo(0, 0); const h1 = document.querySelector(`.page[data-page="${page}"] h1`); if (h1) h1.focus({ preventScroll: true }); }
}
function render() { const fn = A.pages[A.page]; if (fn) fn(); renderStoreNote(); A.renderStreak(); }

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
route();
A.startTimer();
A.Auth.start();
})();
