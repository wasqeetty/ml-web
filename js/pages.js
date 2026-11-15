/* สายเรียน (SaiRian) — หน้า ภาพรวม / ตารางเรียน / งาน / ปฏิทิน / เส้นทาง ML */
(() => {
"use strict";
const A = App, $ = A.$, el = A.el;
const today = () => A.dateKey(new Date());
const empty = (text, link) => el("li", { class: "empty" }, text, link ? [" ", el("a", { href: link[0], text: link[1] })] : null);

/* ---------- shared: task row ---------- */
function toggleTask(t) {
  const { id, ...data } = t;
  const done = !t.done;
  A.put("tasks", id, { ...data, done, doneAt: done ? new Date().toISOString() : "" })
    .then(() => A.toast(done ? "ทำเสร็จแล้ว เก่งมาก" : "ย้ายกลับไปที่ยังไม่เสร็จ"))
    .catch(A.fail);
}
function deleteDoc(col, item, label) {
  const { id, ...data } = item;
  A.del(col, id).then(() => A.toast(`ลบ "${label}" แล้ว`, () => A.put(col, id, data).catch(A.fail))).catch(A.fail);
}
function taskRow(t, opts = {}) {
  const li = el("li", { class: "task" + (t.done ? " done" : "") });
  const cid = "chk-" + t.id + (opts.ctx || "");
  const cb = el("input", { type: "checkbox", id: cid, onchange: () => toggleTask(t) }); cb.checked = !!t.done;
  const meta = el("div", { class: "t-meta" }, A.chip(t.subjectId));
  if (t.kind !== "task") meta.append(el("span", { class: "kind k-" + t.kind, text: A.KIND[t.kind] }));
  if (t.due) {
    const d = A.dueLabel(t.due);
    meta.append(el("span", { class: "due" + (t.done ? "" : " lv-" + d.level), text: `${A.thDate(A.parseKey(t.due))} · ${t.done ? "เสร็จแล้ว" : d.text}` }));
  }
  if (t.priority === "high" && !t.done) meta.append(el("span", { class: "prio", text: A.PRIO.high }));
  li.append(cb, el("label", { for: cid, class: "t-body" }, el("span", { class: "t-title", text: t.title }), meta));
  if (!opts.noDelete) li.append(el("button", { type: "button", class: "icon-btn", "aria-label": `ลบ ${t.title}`, title: "ลบ", onclick: () => deleteDoc("tasks", t, t.title), text: "×" }));
  return li;
}
const PR = { high: 0, mid: 1, low: 2 };
const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (PR[a.priority] ?? 1) - (PR[b.priority] ?? 1);

/* ================= HOME (m1: หัวข้อ + การ์ดฟีเจอร์ที่เลื่อนได้) ================= */
function renderHome() {
  const now = new Date(), tk = today(), set = A.settings(), bd = A.byDay();
  $("hDate").textContent = (A.profile ? `สวัสดี ${A.profile.nickname}  ·  ` : "") + A.thDateLong(now) + (window.SceneInfo ? `  ·  ${window.SceneInfo.seasonName} ${window.SceneInfo.phaseName}` : "");
  const rounds = (bd[tk] || {}).count || 0, goal = Math.max(1, set.goalRounds | 0);
  const ti = A.Timer.info(), sub = $("hSub"), btn = $("hStartTxt");
  sub.textContent = "";
  if (ti.status === "running" || ti.status === "paused") {
    btn.textContent = "กลับไปที่แม่น้ำ";
    sub.append(ti.status === "paused" ? "หยุดไว้ " : ti.phase === "break" ? "กำลังพัก " : "กำลังเรียน ", A.chip(ti.subjectId), ` · เหลืออีก ${ti.remainMin} นาที`);
  } else if (ti.status === "logging") {
    btn.textContent = "ไปจดบันทึก"; sub.append("เรียนจบรอบแล้ว แม่น้ำใสแล้ว อย่าลืมจดบันทึก");
  } else {
    btn.textContent = rounds >= goal ? "เรียนเพิ่มอีกรอบ" : "เริ่มเรียน";
    sub.append(rounds >= goal ? `วันนี้ครบ ${rounds} รอบแล้ว เก่งมาก` : `วันนี้เรียนไป ${rounds} จาก ${goal} รอบ`);
  }

  // การ์ด: ข้อความสั้นๆ บอกสถานะ
  $("fTimerK").textContent = ti.status === "running" || ti.status === "paused" ? `กำลังจับเวลา · เหลือ ${ti.remainMin} นาที` : `วันนี้ ${rounds}/${goal} รอบ`;
  const tasks = A.list("tasks").filter(t => !t.done);
  const nextDl = tasks.filter(t => t.kind !== "task" && t.due).sort(byDue)[0];
  $("fCalK").textContent = nextDl ? `${nextDl.title} · ${A.dueLabel(nextDl.due).text}` : "ไม่มี deadline ค้างอยู่";
  const hm = `${A.pad(now.getHours())}:${A.pad(now.getMinutes())}`;
  const nextSlot = A.list("slots").filter(s => +s.day === A.dow(now) && s.end > hm).sort((a, b) => a.start.localeCompare(b.start))[0];
  $("fPlanK").textContent = nextSlot ? `${nextSlot.start <= hm ? "ตอนนี้" : nextSlot.start} · ${A.subj(nextSlot.subjectId).name}` : "วันนี้ไม่มีคาบแล้ว";
  const todo = tasks.filter(t => t.kind === "task"), dueToday = todo.filter(t => t.due && t.due <= tk).length;
  $("fTaskK").textContent = todo.length ? `ค้าง ${todo.length} งาน${dueToday ? ` · ถึงกำหนด ${dueToday}` : ""}` : "ไม่มีงานค้าง";
  const sess = A.sessions(), last = sess.find(s => s.riverImg);
  $("fLogK").textContent = sess.length ? `บันทึกแล้ว ${sess.length} รอบ` : "ยังไม่มีบันทึก";
  const img = $("fLogImg");
  if (last) { if (img.getAttribute("src") !== last.riverImg) img.src = last.riverImg; img.hidden = false; $("fLogArt").style.display = "none"; }
  else { img.hidden = true; $("fLogArt").style.display = ""; }

  const wk0 = A.addDays(now, -A.dow(now));
  let weekMins = 0, total = 0;
  for (let i = 0; i < 7; i++) { const x = bd[A.dateKey(A.addDays(wk0, i))]; if (x) weekMins += x.mins; }
  Object.values(bd).forEach(x => { total += x.mins; });
  $("sWeek").textContent = A.fmtHours(weekMins);
  $("sTotal").textContent = A.fmtHours(total);
  if ($("goalF").hidden) $("gRounds").value = goal;

  renderPending(tasks, tk);
  renderWeekDrops(bd, wk0, tk, goal, weekMins);
}

/* งานค้าง: เลยกำหนดก่อน แล้วเรียงตามวันที่ งานที่ไม่มีวันที่ไว้ท้าย */
function renderPending(open, tk) {
  const wk = A.dateKey(A.addDays(A.parseKey(tk), 7));
  const over = open.filter(t => t.due && t.due < tk).length;
  const dToday = open.filter(t => t.due === tk).length;
  const soon = open.filter(t => t.due && t.due > tk && t.due <= wk).length;
  const sum = $("pendSum"); sum.textContent = "";
  const badge = (n, label, cls) => n ? sum.append(el("span", { class: "p-badge " + cls }, el("b", { text: n }), label)) : null;
  badge(over, "เลยกำหนด", "lv-over"); badge(dToday, "ถึงกำหนดวันนี้", "lv-soon"); badge(soon, "ภายใน 7 วัน", "lv-ok");
  if (open.length) sum.append(el("span", { class: "p-badge" }, el("b", { text: open.length }), "ค้างทั้งหมด"));

  const ul = $("pendList"); ul.textContent = "";
  if (!open.length) { ul.append(empty("ไม่มีงานค้าง น้ำใสทั้งสาย", ["#tasks", "เพิ่มงาน"])); return; }
  const list = [...open].sort(byDue).slice(0, 5);
  list.forEach(t => ul.append(taskRow(t, { ctx: "-h", noDelete: true })));
  if (open.length > list.length) ul.append(el("li", { class: "more" }, el("a", { href: "#tasks", text: `อีก ${open.length - list.length} งาน` })));
}

/* หยดน้ำ 7 วันของสัปดาห์นี้: เติมน้ำตามจำนวนรอบเทียบกับเป้า */
const QUOTES = ["น้ำหยดลงหินทุกวัน หินยังกร่อน", "ช้าๆ ได้พร้าเล่มงาม", "ไม่ต้องเยอะ ขอแค่ได้เริ่ม", "เรียนวันละรอบ ดีกว่าอ่านรวดเดียวคืนก่อนสอบ",
                "วันไหนเหนื่อย เรียนรอบสั้นๆ ก็ยังนับ", "เข้าใจทีละนิด ดีกว่าจำทั้งหมดแล้วลืม", "แม่น้ำไม่ได้ใสในวันเดียว"];
function renderWeekDrops(bd, wk0, tk, goal, weekMins) {
  const ol = $("wkDrops"); ol.textContent = "";
  let days = 0;
  for (let i = 0; i < 7; i++) {
    const d = A.addDays(wk0, i), k = A.dateKey(d), n = (bd[k] || {}).count || 0;
    if (n) days++;
    const fill = Math.min(1, n / goal), state = k === tk ? " today" : k > tk ? " future" : "";
    ol.append(el("li", { class: "wd" + state + (n ? " wet" : ""), title: `${A.thDateLong(d)} · ${n ? `เรียน ${n} รอบ` : "ยังไม่ได้เรียน"}` },
      dropSvg(fill),
      el("span", { class: "wd-d", text: A.TH_DS[i] }),
      el("span", { class: "wd-n", text: n ? `${n} รอบ` : "–" })));
  }
  $("wkNote").textContent = days ? `เรียนแล้ว ${days} วัน · ${A.fmtHours(weekMins)} ชม.` : "ยังไม่ได้เริ่ม";
  const doy = Math.floor((A.parseKey(tk) - new Date(A.parseKey(tk).getFullYear(), 0, 1)) / 864e5);
  $("wkQuote").textContent = QUOTES[doy % QUOTES.length];
}
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
let dropN = 0;
function dropSvg(fill) {
  const id = "wdc" + (dropN++), shape = "M12 1.5C12 1.5 2.5 12.5 2.5 19a9.5 9.5 0 0 0 19 0C21.5 12.5 12 1.5 12 1.5z";
  const s = svgEl("svg", { viewBox: "0 0 24 30", "aria-hidden": "true" });
  const cp = svgEl("clipPath", { id }); cp.append(svgEl("path", { d: shape }));
  const defs = svgEl("defs", {}); defs.append(cp); s.append(defs);
  const top = 30 - 28.5 * fill;
  s.append(svgEl("rect", { class: "wd-fill", x: 0, y: top, width: 24, height: 30, "clip-path": `url(#${id})` }));
  s.append(svgEl("path", { class: "wd-shell", d: shape }));
  if (fill > 0) s.append(svgEl("path", { class: "s-shine", d: "M7.5 18.5a5 5 0 0 1 2.5-4.2" }));
  return s;
}

/* หยดน้ำนับวันติดกัน: น้ำในหยดเติมทีละ 1/5 ต่อวัน ครบ 5 วันเต็มหยดและฉลอง */
function streakStart(bd, n) { let d = new Date(); if (!bd[A.dateKey(d)]) d = A.addDays(d, -1); return A.dateKey(A.addDays(d, -(n - 1))); }
A.renderStreak = () => {
  const bd = A.byDay(), n = A.streak(bd), inCycle = n === 0 ? 0 : (n % 5 || 5);
  const studiedToday = !!bd[today()];
  $("streakN").textContent = n;
  $("streakFill").setAttribute("y", String(30 - 28.5 * inCycle / 5));
  const btn = $("streakBtn");
  btn.classList.toggle("dry", !studiedToday);
  const next = 5 - (n % 5);
  const label = n === 0 ? "ยังไม่มีวันติดกัน เรียนวันนี้เพื่อเริ่มเก็บหยดน้ำ"
    : `เรียนติดกัน ${n} วัน${studiedToday ? "" : " · วันนี้ยังไม่ได้เรียน"} · อีก ${next} วันครบ ${n + next} วัน`;
  btn.setAttribute("aria-label", label); btn.title = label;
  // ฉลองครั้งเดียวต่อหลัก 5 วันของสายวันติดกันนี้
  if (n > 0 && n % 5 === 0 && studiedToday && A.store.mode !== "loading") {
    const key = `${n}@${streakStart(bd, n)}`;
    if (A.pref.celebrated !== key && A.Timer.info().status === "idle") { A.pref.celebrated = key; A.savePref(); celebrate(n); }
  }
};
$("streakBtn").addEventListener("click", () => A.toast($("streakBtn").title));

function celebrate(n) {
  const box = $("celebrate");
  $("celN").textContent = n;
  $("celSub").textContent = n === 5 ? "เรียนต่อเนื่องครบ 5 วัน หยดน้ำหยดแรกเต็มแล้ว" : `เรียนต่อเนื่องครบ ${n} วัน เก็บหยดน้ำเต็มมาแล้ว ${n / 5} หยด`;
  box.hidden = false; $("celOk").focus();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("celRain"), g = cv.getContext("2d"), W = cv.width = innerWidth, H = cv.height = innerHeight;
  const drops = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: -Math.random() * H, v: 3 + Math.random() * 5, s: 4 + Math.random() * 6, hit: 0 }));
  const t0 = performance.now();
  (function tick(ts) {
    if (box.hidden) return;
    g.clearRect(0, 0, W, H);
    const fade = Math.max(0, 1 - (ts - t0 - 2600) / 900);
    drops.forEach(d => {
      if (!d.hit) { d.y += d.v; d.v += .12; if (d.y > H * (.72 + (d.x % 60) / 300)) d.hit = 1; }
      else d.hit += .04;
      g.globalAlpha = fade;
      if (d.hit) { if (d.hit < 1.6) { g.strokeStyle = `rgba(150,215,255,${(1.6 - d.hit) / 1.6})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(d.x, d.y, d.s * d.hit * 2.2, d.s * d.hit * .7, 0, 0, Math.PI * 2); g.stroke(); } return; }
      g.fillStyle = "rgba(150,215,255,.9)"; g.beginPath();
      g.moveTo(d.x, d.y - d.s * 1.4); g.quadraticCurveTo(d.x + d.s, d.y, d.x, d.y + d.s * .8); g.quadraticCurveTo(d.x - d.s, d.y, d.x, d.y - d.s * 1.4); g.fill();
    });
    if (fade > 0) requestAnimationFrame(tick);
  })(t0);
}
$("celOk").addEventListener("click", () => { $("celebrate").hidden = true; });
$("celebrate").addEventListener("keydown", e => { if (e.key === "Escape") $("celebrate").hidden = true; });

$("goalEdit").addEventListener("click", () => { const f = $("goalF"); f.hidden = !f.hidden; if (!f.hidden) $("gRounds").focus(); });
$("goalCancel").addEventListener("click", () => { $("goalF").hidden = true; });
$("goalF").addEventListener("submit", e => {
  e.preventDefault();
  const r = Math.min(6, Math.max(1, +$("gRounds").value || 1));
  A.put("settings", "main", { ...A.settings(), goalRounds: r }).then(() => { $("goalF").hidden = true; A.toast("ตั้งเป้าใหม่แล้ว"); }).catch(A.fail);
});
$("hStart").addEventListener("click", () => { location.hash = "timer"; });

/* ปุ่ม "+ เพิ่ม" เปิด/ปิดฟอร์ม */
function toggler(btnId, formId, focusId) {
  const b = $(btnId), f = $(formId);
  b.addEventListener("click", () => { f.hidden = !f.hidden; b.setAttribute("aria-expanded", String(!f.hidden)); if (!f.hidden) $(focusId).focus(); });
}
toggler("slotToggle", "slotF", "slDay");
toggler("taskToggle", "taskF", "tkTitle");

/* ================= PLAN (timetable + subjects) ================= */
function renderPlan() {
  A.fillSubjects($("slSubj"));
  const wk = $("week"); wk.textContent = "";
  const all = A.list("slots"), td = A.dow(new Date());
  for (let d = 0; d < 7; d++) {
    const list = all.filter(s => +s.day === d).sort((a, b) => a.start.localeCompare(b.start));
    const col = el("div", { class: "day" + (d === td ? " is-today" : "") + (list.length ? "" : " is-empty") },
      el("h3", {}, A.TH_D[d], d === td ? el("span", { class: "pill now", text: "วันนี้" }) : null));
    const ul = el("ul", { class: "slots" });
    if (!list.length) ul.append(el("li", { class: "empty", text: "ว่าง" }));
    list.forEach(s => ul.append(el("li", { class: "slot c" + (A.subj(s.subjectId).color | 0) },
      el("span", { class: "time", text: `${s.start}–${s.end}` }),
      el("span", { class: "s-name", text: A.subj(s.subjectId).name }),
      s.note ? el("span", { class: "s-note", text: s.note }) : null,
      el("button", { type: "button", class: "icon-btn", "aria-label": `ลบคาบ ${A.subj(s.subjectId).name} ${s.start}`, title: "ลบ", onclick: () => deleteDoc("slots", s, `${A.subj(s.subjectId).name} ${s.start}`), text: "×" }))));
    col.append(ul); wk.append(col);
  }
  const sl = $("subjList"); sl.textContent = "";
  const subs = A.subjects();
  if (!subs.length) sl.append(el("p", { class: "empty", text: "ยังไม่มีวิชา เพิ่มวิชาแรกได้ด้านล่าง" }));
  subs.forEach(s => sl.append(el("span", { class: "chip big" }, el("i", { class: "dot c" + (s.color | 0) }), s.name,
    el("button", { type: "button", class: "icon-btn sm", "aria-label": `ลบวิชา ${s.name}`, title: "ลบวิชา", onclick: () => deleteDoc("subjects", s, s.name), text: "×" }))));
}
$("slotF").addEventListener("submit", e => {
  e.preventDefault();
  const data = { day: +$("slDay").value, start: $("slStart").value, end: $("slEnd").value, subjectId: $("slSubj").value, note: $("slNote").value.trim().slice(0, 80) };
  const err = $("slErr");
  if (!data.subjectId) { err.textContent = "เลือกวิชาก่อน (ถ้ายังไม่มี เพิ่มวิชาได้ด้านล่าง)"; return; }
  if (!data.start || !data.end || data.end <= data.start) { err.textContent = "เวลาจบต้องหลังเวลาเริ่ม"; return; }
  err.textContent = "";
  A.put("slots", "sl-" + A.uid(), data).then(() => { $("slNote").value = ""; A.toast(`เพิ่มคาบวัน${A.TH_D[data.day]} ${data.start} แล้ว`); }).catch(A.fail);
});
$("subjF").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("sbName").value.trim().slice(0, 40);
  if (!name) { $("sbName").focus(); return; }
  const color = +((document.querySelector('input[name="sbColor"]:checked') || {}).value || 0);
  const order = A.subjects().reduce((m, s) => Math.max(m, s.order ?? 0), 0) + 1;
  A.put("subjects", "sb-" + A.uid(), { name, color, order }).then(() => { $("sbName").value = ""; A.toast(`เพิ่มวิชา ${name} แล้ว`); }).catch(A.fail);
});

/* ================= TASKS ================= */
function renderTasks() {
  A.fillSubjects($("tkSubj"));
  const tasks = A.list("tasks");
  const dl = $("dlList"); dl.textContent = "";
  const dOpen = tasks.filter(t => t.kind !== "task" && !t.done).sort(byDue);
  const dDone = tasks.filter(t => t.kind !== "task" && t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 5);
  if (!dOpen.length) dl.append(empty("ไม่มี deadline ที่ค้างอยู่ เพิ่มวันสอบหรือวันส่งงานได้จากฟอร์มด้านบน"));
  dOpen.forEach(t => dl.append(taskRow(t, { ctx: "-d" })));
  if (dDone.length) { dl.append(el("li", { class: "sep", text: "เสร็จแล้วล่าสุด" })); dDone.forEach(t => dl.append(taskRow(t, { ctx: "-d" }))); }
  $("dlCount").textContent = dOpen.length ? `${dOpen.length} รายการ` : "";

  const f = A.pref.todoFilter || "open", tk = today();
  document.querySelectorAll("#todoSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === f)));
  let list = tasks.filter(t => t.kind === "task");
  if (f === "open") list = list.filter(t => !t.done).sort(byDue);
  else if (f === "today") list = list.filter(t => !t.done && t.due && t.due <= tk).sort(byDue);
  else list = list.filter(t => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 30);
  const ul = $("todoList"); ul.textContent = "";
  if (!list.length) ul.append(empty(f === "done" ? "ยังไม่มีงานที่เสร็จ" : f === "today" ? "วันนี้ไม่มีงานที่ถึงกำหนด" : "ไม่มีงานค้าง เพิ่มงานใหม่ได้จากฟอร์มด้านบน"));
  list.forEach(t => ul.append(taskRow(t, { ctx: "-t" })));
}
document.querySelectorAll("#todoSeg button").forEach(b => b.addEventListener("click", () => { A.pref.todoFilter = b.dataset.f; A.savePref(); renderTasks(); }));
$("tkKind").addEventListener("change", () => { $("tkDueLbl").textContent = $("tkKind").value === "task" ? "กำหนดเสร็จ (ไม่บังคับ)" : "วันที่ (ต้องใส่)"; });
$("taskF").addEventListener("submit", e => {
  e.preventDefault();
  const data = { title: $("tkTitle").value.trim().slice(0, 140), kind: $("tkKind").value, subjectId: $("tkSubj").value, due: $("tkDue").value,
                 priority: $("tkPrio").value, done: false, doneAt: "", createdAt: new Date().toISOString() };
  const err = $("tkErr");
  if (!data.title) { err.textContent = "ใส่ชื่องานก่อน"; $("tkTitle").focus(); return; }
  if (data.kind !== "task" && !data.due) { err.textContent = "deadline ต้องมีวันที่"; $("tkDue").focus(); return; }
  err.textContent = "";
  A.put("tasks", "tk-" + A.uid(), data).then(() => { $("tkTitle").value = ""; $("tkDue").value = ""; A.toast(`เพิ่ม "${data.title}" แล้ว`); }).catch(A.fail);
});

/* ================= CALENDAR ================= */
function renderCalendar() {
  const tk = today();
  if (!A.pref.calMonth) A.pref.calMonth = tk.slice(0, 7);
  if (!A.pref.calSel) A.pref.calSel = tk;
  const [Y, M] = A.pref.calMonth.split("-").map(Number);
  $("calTitle").textContent = `${A.TH_MF[M - 1]} ${Y + 543}`;
  const first = new Date(Y, M - 1, 1), start = A.addDays(first, -A.dow(first));
  const last = new Date(Y, M, 0), weeks = Math.ceil((A.dow(first) + last.getDate()) / 7);
  const bd = A.byDay(), tasks = A.list("tasks").filter(t => t.due);
  const grid = $("cal"); grid.textContent = "";
  A.TH_DS.forEach(d => grid.append(el("div", { class: "cal-h", text: d })));
  for (let i = 0; i < weeks * 7; i++) {
    const d = A.addDays(start, i), k = A.dateKey(d), out = d.getMonth() !== M - 1;
    const n = (bd[k] || {}).count || 0, dues = tasks.filter(t => t.due === k);
    const marks = el("div", { class: "marks" });
    for (let j = 0; j < Math.min(n, 3); j++) marks.append(el("i", { class: "m-study" }));
    dues.filter(t => t.kind !== "task").slice(0, 2).forEach(t => marks.append(el("span", { class: "m-dl" + (t.done ? " done" : ""), text: t.title })));
    if (dues.some(t => t.kind === "task" && !t.done)) marks.append(el("i", { class: "m-todo" }));
    const more = dues.filter(t => t.kind !== "task").length - 2;
    if (more > 0) marks.append(el("span", { class: "m-more", text: `+${more}` }));
    const label = `${A.thDateLong(d)}${n ? ` เรียน ${n} รอบ` : ""}${dues.length ? ` มี ${dues.length} งาน` : ""}`;
    grid.append(el("button", { type: "button", class: "cal-d" + (out ? " out" : "") + (k === tk ? " today" : "") + (k === A.pref.calSel ? " sel" : ""), "aria-label": label, "aria-pressed": String(k === A.pref.calSel),
      onclick: () => { A.pref.calSel = k; A.savePref(); renderCalendar(); } }, el("span", { class: "dn", text: d.getDate() }), marks));
  }
  renderDay(A.pref.calSel);
}
function renderDay(k) {
  const d = A.parseKey(k), box = $("calDay"); box.textContent = "";
  box.append(el("h2", { text: A.thDateLong(d) }));
  const sess = A.sessions().filter(s => s.date === k).reverse();
  const tasks = A.list("tasks").filter(t => t.due === k);
  const slots = A.list("slots").filter(s => +s.day === A.dow(d)).sort((a, b) => a.start.localeCompare(b.start));
  const sec = (title, items) => { if (!items.length) return; box.append(el("h3", { text: title })); const ul = el("ul", { class: "day-list" }); items.forEach(i => ul.append(i)); box.append(ul); };
  sec("Deadline", tasks.filter(t => t.kind !== "task").map(t => taskRow(t, { ctx: "-c", noDelete: true })));
  sec("To-do ครบกำหนด", tasks.filter(t => t.kind === "task").map(t => taskRow(t, { ctx: "-c", noDelete: true })));
  sec("เรียนแล้ว", sess.map(noteRow));
  sec("ตามตารางเรียน", slots.map(s => el("li", { class: "slot-row" }, el("span", { class: "time", text: `${s.start}–${s.end}` }), A.chip(s.subjectId), s.note ? el("span", { class: "muted", text: s.note }) : null)));
  if (box.children.length === 1) box.append(el("p", { class: "empty", text: "วันนี้ว่าง ไม่มีงาน คาบเรียน หรือบันทึก" }));
}
function shiftMonth(n) { const [Y, M] = A.pref.calMonth.split("-").map(Number); const d = new Date(Y, M - 1 + n, 1); A.pref.calMonth = A.dateKey(d).slice(0, 7); A.savePref(); renderCalendar(); }
$("calPrev").addEventListener("click", () => shiftMonth(-1));
$("calNext").addEventListener("click", () => shiftMonth(1));
$("calToday").addEventListener("click", () => { const k = today(); A.pref.calMonth = k.slice(0, 7); A.pref.calSel = k; A.savePref(); renderCalendar(); });

/* ================= LOG (บันทึก) ================= */
function seasonTag(s) { const S = A.season(s.season); return S ? el("span", { class: "s-tag" + (S.rare ? " rare" : ""), text: S.name }) : null; }
function sessTime(s) { const dt = new Date(s.finishedAt); return isNaN(dt) ? s.date : `${A.thDate(dt)} ${A.pad(dt.getHours())}:${A.pad(dt.getMinutes())}`; }
function dots(s) { const r = Math.max(0, Math.min(5, s.rating | 0)); return el("span", { class: "dots", title: `เข้าใจ ${r}/5`, "aria-label": `เข้าใจ ${r} จาก 5`, text: "●".repeat(r) + "○".repeat(5 - r) }); }
function riverImg(s, cls) {
  return s.riverImg ? el("img", { class: cls, src: s.riverImg, alt: `ภาพแม่น้ำหลังเรียน ${A.subj(s.subjectId).name} ${sessTime(s)}`, loading: "lazy" })
                    : el("div", { class: cls + " river-ph sm", "aria-hidden": "true" });
}
// การ์ดใหญ่: หน้าบันทึก + แม่น้ำล่าสุดในหน้าหลัก
function riverFigure(s) {
  return el("figure", { class: "rcard" }, riverImg(s, "r-img"),
    el("figcaption", {},
      el("div", { class: "n-meta" }, el("span", { text: sessTime(s) }), A.chip(s.subjectId), dots(s), seasonTag(s)),
      s.topicTitle ? el("span", { class: "n-topic", text: s.topicTitle }) : null,
      el("p", { class: "n-text" + (s.note ? "" : " none"), text: s.note || "ไม่ได้จดสรุป" })));
}
// แถวเล็ก: ปฏิทิน
function noteRow(s) {
  return el("li", { class: "note-row" }, riverImg(s, "thumb"),
    el("div", { class: "nr-body" },
      el("div", { class: "n-meta" }, el("span", { text: sessTime(s) }), A.chip(s.subjectId), dots(s), seasonTag(s)),
      s.topicTitle ? el("span", { class: "n-topic", text: s.topicTitle }) : null,
      s.note ? el("p", { class: "n-text", text: s.note }) : null));
}
function renderLog() {
  const sel = $("logFilter"); A.fillSubjects(sel, { all: "ทุกวิชา" });
  const f = sel.value;
  const list = A.sessions().filter(s => !f || s.subjectId === f);
  const mins = list.reduce((a, s) => a + (s.focusMin || 0), 0);
  $("logSum").textContent = list.length ? `${list.length} รอบ · ${A.fmtHours(mins)} ชั่วโมง` : "";
  renderLogChart(list);
  const box = $("logGrid"); box.textContent = "";
  if (!list.length) { box.append(el("p", { class: "empty" }, "ยังไม่มีบันทึก เรียนจบรอบแรกแล้วภาพแม่น้ำกับสรุปของรอบนั้นจะมาอยู่ที่นี่ ", el("a", { href: "#timer", text: "ไปจับเวลา" }))); return; }
  list.slice(0, 120).forEach(s => box.append(riverFigure(s)));
}
$("logFilter").addEventListener("change", renderLog);

/* ---------- กราฟเส้น: เวลาเรียนต่อวัน / วันที่เรียนสะสม ---------- */
const fmtMin = m => m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ""}`;
const shortDay = d => `${A.TH_DS[A.dow(d)]}. ${A.thDate(d)}`;
let chartState = null;

function renderLogChart(list) {
  const metric = A.pref.chMetric === "days" ? "days" : "mins";
  const range = ["14", "30", "all"].includes(A.pref.chRange) ? A.pref.chRange : "30";
  document.querySelectorAll("#chMetric button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === metric)));
  document.querySelectorAll("#chRange button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === range)));

  const bd = {};
  list.forEach(s => { if (!s.date) return; const x = bd[s.date] || (bd[s.date] = { count: 0, mins: 0 }); x.count++; x.mins += s.focusMin || 0; });
  const keys = Object.keys(bd).sort(), tk = today(), end = A.parseKey(tk);

  // ตัวเลขสรุป
  const totalMin = keys.reduce((a, k) => a + bd[k].mins, 0);
  const sumRange = (from, to) => { let m = 0; for (let i = from; i <= to; i++) { const x = bd[A.dateKey(A.addDays(end, -i))]; if (x) m += x.mins; } return m; };
  const st = $("logStats"); st.textContent = "";
  const tile = (n, unit, label) => st.append(el("div", { class: "stat" }, el("span", { class: "st-l", text: label }), el("span", { class: "st-v" }, el("b", { text: n }), unit)));
  tile(keys.length, "วัน", keys.length ? `เรียนมาแล้ว · ตั้งแต่ ${A.thDate(A.parseKey(keys[0]))}` : "เรียนมาแล้ว");
  tile(A.streak(bd), "วัน", "ติดกันตอนนี้");
  tile(A.fmtHours(totalMin), "ชม.", "เวลารวม");
  tile(keys.length ? Math.round(totalMin / keys.length) : 0, "นาที", "เฉลี่ยต่อวันที่เรียน");

  const last7 = sumRange(0, 6), prev7 = sumRange(7, 13), diff = last7 - prev7;
  $("chartNote").textContent = !last7 && !prev7 ? "ยังไม่มีการเรียนใน 2 สัปดาห์ล่าสุด"
    : `7 วันล่าสุดเรียน ${fmtMin(last7)} ` + (diff > 0 ? `มากกว่า 7 วันก่อนหน้า ${fmtMin(diff)}` : diff < 0 ? `น้อยกว่า 7 วันก่อนหน้า ${fmtMin(-diff)}` : "เท่ากับ 7 วันก่อนหน้า");
  $("chartH").textContent = metric === "mins" ? "เวลาเรียนต่อวัน (นาที)" : "จำนวนวันที่เรียนสะสม";

  // จุดข้อมูลรายวัน
  let start = range === "all" ? (keys.length ? A.parseKey(keys[0]) : end) : A.addDays(end, -(+range - 1));
  if ((end - start) / 864e5 < 6) start = A.addDays(end, -6);
  const sk = A.dateKey(start);
  let cum = keys.filter(k => k < sk).length;
  const pts = [];
  for (let d = new Date(start); A.dateKey(d) <= tk; d = A.addDays(d, 1)) {
    const k = A.dateKey(d), x = bd[k] || { count: 0, mins: 0 };
    if (x.count) cum++;
    pts.push({ k, d: new Date(d), mins: x.mins, count: x.count, days: cum });
  }
  chartState = { pts, metric, empty: !keys.length };
  drawChart();

  // ตาราง (เฉพาะวันที่เรียน ใหม่สุดก่อน)
  const tb = $("chartTable"); tb.textContent = "";
  const rows = pts.filter(p => p.count).reverse();
  if (!rows.length) { tb.append(el("p", { class: "empty", text: "ช่วงนี้ยังไม่มีวันที่เรียน" })); return; }
  tb.append(el("table", {},
    el("thead", {}, el("tr", {}, ["วันที่", "รอบ", "เวลา", "วันที่เรียนสะสม"].map(h => el("th", { scope: "col", text: h })))),
    el("tbody", {}, rows.map(p => el("tr", {}, el("td", { text: A.thDateLong(p.d) }), el("td", { text: p.count }), el("td", { text: fmtMin(p.mins) }), el("td", { text: p.days }))))));
}

function niceStep(max, target) {
  const raw = max / target, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function drawChart() {
  const box = $("chart"); if (!chartState || !box.isConnected) return;
  const { pts, metric } = chartState, n = pts.length;
  const W = Math.max(220, Math.round(box.clientWidth || 600)), H = W < 520 ? 190 : 230;
  const P = { l: 40, r: 14, t: 14, b: 28 }, iw = W - P.l - P.r, ih = H - P.t - P.b;
  const val = p => metric === "mins" ? p.mins : p.days;
  const maxV = Math.max(...pts.map(val), metric === "mins" ? 30 : 3);
  const step = Math.max(metric === "mins" ? 10 : 1, niceStep(maxV, 3)), top = Math.ceil(maxV / step) * step;
  const X = i => P.l + (n === 1 ? iw / 2 : i * iw / (n - 1)), Y = v => P.t + ih - v / top * ih;
  box.textContent = "";
  box.dataset.w = W;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "ch-svg", role: "img", tabindex: "0",
    "aria-label": `${metric === "mins" ? "กราฟเวลาเรียนต่อวัน" : "กราฟจำนวนวันที่เรียนสะสม"} ${shortDay(pts[0].d)} ถึง ${shortDay(pts[n - 1].d)} ใช้ปุ่มลูกศรซ้ายขวาเพื่อดูแต่ละวัน` });
  const defs = svgEl("defs", {}), g = svgEl("linearGradient", { id: "chFill", x1: 0, y1: 0, x2: 0, y2: 1 });
  g.append(svgEl("stop", { offset: "0", class: "ch-s0" }), svgEl("stop", { offset: "1", class: "ch-s1" }));
  defs.append(g); svg.append(defs);

  // เส้นตารางแนวนอน + ป้ายแกน y
  for (let v = 0; v <= top + 1e-9; v += step) {
    svg.append(svgEl("line", { class: v === 0 ? "ch-base" : "ch-grid", x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v) }));
    const t = svgEl("text", { class: "ch-tick", x: P.l - 8, y: Y(v) + 4, "text-anchor": "end" }); t.textContent = v; svg.append(t);
  }
  // ป้ายแกน x: ประมาณ 5–6 ป้าย
  const every = Math.max(1, Math.ceil(n / (W < 520 ? 4 : 7)));
  pts.forEach((p, i) => {
    if ((n - 1 - i) % every) return;
    const t = svgEl("text", { class: "ch-tick", x: X(i), y: H - 8, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" });
    t.textContent = i === n - 1 ? "วันนี้" : A.thDate(p.d); svg.append(t);
  });

  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(val(p)).toFixed(1)}`).join("");
  svg.append(svgEl("path", { class: "ch-area", d: `${line}L${X(n - 1).toFixed(1)},${Y(0)}L${X(0).toFixed(1)},${Y(0)}Z` }));
  svg.append(svgEl("path", { class: "ch-line", d: line }));

  // จุดสุดท้าย + ค่า
  const lp = pts[n - 1], lx = X(n - 1), ly = Y(val(lp));
  svg.append(svgEl("circle", { class: "ch-dot", cx: lx, cy: ly, r: 4.5 }));

  // ชั้น hover
  const cross = svgEl("line", { class: "ch-cross", x1: 0, x2: 0, y1: P.t, y2: P.t + ih, visibility: "hidden" });
  const hdot = svgEl("circle", { class: "ch-dot", cx: 0, cy: 0, r: 5, visibility: "hidden" });
  svg.append(cross, hdot);
  const hit = svgEl("rect", { x: P.l - 10, y: 0, width: iw + 20, height: H, fill: "transparent" });
  svg.append(hit);
  box.append(svg);

  const tip = el("div", { class: "ch-tip", hidden: true });
  box.append(tip);
  if (chartState.empty) box.append(el("p", { class: "ch-empty", text: "ยังไม่มีข้อมูล เรียนจบรอบแรกแล้วกราฟจะเริ่มขยับ" }));

  let cur = -1;
  const show = i => {
    cur = Math.max(0, Math.min(n - 1, i));
    const p = pts[cur], x = X(cur), y = Y(val(p));
    cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
    hdot.setAttribute("cx", x); hdot.setAttribute("cy", y); hdot.setAttribute("visibility", "visible");
    tip.textContent = "";
    tip.append(el("span", { class: "tt-d", text: shortDay(p.d) }),
      el("b", { text: metric === "mins" ? (p.count ? fmtMin(p.mins) : "ไม่ได้เรียน") : `${p.days} วัน` }),
      el("span", { class: "tt-s", text: metric === "mins" ? (p.count ? `${p.count} รอบ` : "") : (p.count ? `วันนี้เรียน ${p.count} รอบ` : "วันนี้ไม่ได้เรียน") }));
    tip.hidden = false;
    const tw = tip.offsetWidth, left = Math.min(W - tw - 4, Math.max(4, x - tw / 2));
    tip.style.left = left + "px"; const above = y - tip.offsetHeight - 14;
    tip.style.top = (above >= 0 ? above : y + 14) + "px";
  };
  const hide = () => { cur = -1; tip.hidden = true; cross.setAttribute("visibility", "hidden"); hdot.setAttribute("visibility", "hidden"); };
  const idxAt = e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) * (W / r.width); return Math.round((x - P.l) / (n === 1 ? 1 : iw / (n - 1))); };
  svg.addEventListener("pointermove", e => show(idxAt(e)));
  svg.addEventListener("pointerdown", e => show(idxAt(e)));
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("blur", hide);
  svg.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); show(cur < 0 ? n - 1 : cur + (e.key === "ArrowRight" ? 1 : -1)); }
    else if (e.key === "Home") { e.preventDefault(); show(0); } else if (e.key === "End") { e.preventDefault(); show(n - 1); }
    else if (e.key === "Escape") hide();
  });
}
if (window.ResizeObserver) new ResizeObserver(() => { const b = $("chart"); if (chartState && !b.closest("[hidden]") && Math.abs((b.clientWidth | 0) - (+b.dataset.w || 0)) > 4) drawChart(); }).observe($("chart"));
document.querySelectorAll("#chMetric button").forEach(b => b.addEventListener("click", () => { A.pref.chMetric = b.dataset.v; A.savePref(); renderLog(); }));
document.querySelectorAll("#chRange button").forEach(b => b.addEventListener("click", () => { A.pref.chRange = b.dataset.v; A.savePref(); renderLog(); }));

A.pages = { home: renderHome, timer: () => A.Timer.refresh(), log: renderLog, plan: renderPlan, tasks: renderTasks, calendar: renderCalendar };
})();
