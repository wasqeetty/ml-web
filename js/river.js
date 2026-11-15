/* สายเรียน (SaiRian) — หน้าจับเวลา: Pomodoro 25+5+25 กับแม่น้ำที่ใสขึ้นตามเวลาที่เรียน */
(() => {
"use strict";
const A = App, $ = A.$, pad = A.pad;
/* เวลาที่ตั้งเองได้: โฟกัส x นาที, พัก y นาที, กี่ช่วง — เก็บใน settings/main.timer */
const clampN = (v, a, b, d) => { v = Math.round(+v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
let pendingCfg = null;
function cfg() {
  const c = pendingCfg || { focus: 25, brk: 5, blocks: 2, ...(A.settings().timer || {}) };
  return { focus: clampN(c.focus, 1, 180, 25), brk: clampN(c.brk, 0, 60, 5), blocks: clampN(c.blocks, 1, 6, 2) };
}
function planOf(c) {
  const p = [];
  for (let i = 0; i < c.blocks; i++) { p.push({ k: "focus", m: c.focus }); if (i < c.blocks - 1 && c.brk > 0) p.push({ k: "break", m: c.brk }); }
  return p;
}
const PH = () => (T.phases && T.phases.length ? T.phases : planOf(cfg()));
const focusTotal = ph => ph.filter(p => p.k === "focus").reduce((a, p) => a + p.m, 0);
const AS_START = 50, WHO = 10;
const LS = "mlweb.timer";
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let T = A.lsGet(LS, null) || { status: "idle" };
if (!["idle", "running", "paused", "logging"].includes(T.status)) T = { status: "idle" };
if (T.demo) { T = { status: "idle" }; A.lsSet(LS, T); }   // ล้างรอบทดลองที่ค้างจากเวอร์ชันก่อน (เอาโหมดทดลองออกแล้ว)
if (typeof T.fish === "string") T.fish = [T.fish];          // รอบที่เริ่มก่อนเปลี่ยนเป็นปลา 3 ตัว
const catchIds = () => (Array.isArray(T.fish) ? T.fish : []).filter(id => A.fish(id));
const ui = { confirmQuit: false, drain: null };
let previewP = 0;

const MIN = () => 60000;
const phaseMs = i => PH()[i].m * MIN();
const focusMs = () => focusTotal(PH()) * MIN();
const elapsed = now => (T.pausedAt ?? now) - T.phaseStart;
const saveT = () => A.lsSet(LS, T);

function advance(now, live) {
  if (T.status !== "running") return;
  let changed = false;
  while (T.status === "running" && elapsed(now) >= phaseMs(T.phase)) {
    T.phaseStart += phaseMs(T.phase);
    if (T.phase === PH().length - 1) { T.status = "logging"; T.finishedAt = T.phaseStart; }
    else T.phase++;
    changed = true;
  }
  if (changed) { saveT(); if (live) chime(T.status === "logging" ? "done" : PH()[T.phase].k); onStatus(); }
}
function timerProgress(now) {
  if (T.status === "logging") return 1;
  if (T.status !== "running" && T.status !== "paused") return 0;
  const before = PH().slice(0, T.phase).filter(p => p.k === "focus").reduce((a, p) => a + p.m, 0) * MIN();
  const cur = PH()[T.phase].k === "focus" ? Math.min(elapsed(now), phaseMs(T.phase)) : 0;
  return clamp01((before + cur) / focusMs());
}
function targetP(now) {
  if (ui.drain) {
    const k = (now - ui.drain.start) / 2800;
    if (k >= 1) { ui.drain = null; onStatus(); return previewP; }
    const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    return ui.drain.from * (1 - e);
  }
  if (T.status === "idle") return previewP;
  return timerProgress(now);
}

/* ---------- subject + topic ---------- */
function renderPick() {
  const sel = $("tSubj");
  const want = T.status !== "idle" ? T.subjectId : A.pref.subjectId;
  sel.value = ""; A.fillSubjects(sel, { value: want });
  sel.disabled = T.status !== "idle";
  $("tFree").disabled = T.status !== "idle";
  if (T.status !== "idle") $("tFree").value = T.topicTitle || "";
  if (T.status === "logging") { $("lfTopic").textContent = A.subj(T.subjectId).name + (T.topicTitle ? ` · ${T.topicTitle}` : ""); maybeCapture(); }
}
$("tSubj").addEventListener("change", e => { A.pref.subjectId = e.target.value; A.savePref(); });

/* ---------- actions ---------- */
function start() {
  unlockAudio();
  const plan = planOf(cfg()), luck = A.fishLuck(focusTotal(plan), A.streak(A.byDay()));
  T = { status: "running", phase: 0, phaseStart: Date.now(), pausedAt: null, phases: plan, season: pickSeason(), fish: A.pickCatch(luck),
        subjectId: $("tSubj").value || "", topicTitle: $("tFree").value.trim().slice(0, 120), roomId: A.Rooms ? A.Rooms.activeId() : "" };
  saveT(); onStatus();
}
function pause() { T.status = "paused"; T.pausedAt = Date.now(); saveT(); onStatus(); }
function resume() { unlockAudio(); const now = Date.now(); T.phaseStart += now - T.pausedAt; T.pausedAt = null; T.status = "running"; saveT(); onStatus(); }
function skipBreak() { T.phase++; T.phaseStart = Date.now(); saveT(); onStatus(); }
function askQuit() { ui.confirmQuit = true; renderActions(); $("bQuitNo") && $("bQuitNo").focus(); }
function doQuit() {
  const now = Date.now();
  ui.drain = { from: timerProgress(now), start: now }; ui.confirmQuit = false;
  T = { status: "idle" }; saveT();
  onStatus();
}

/* ---------- sound + wake lock ---------- */
let actx = null;
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) {} }
function chime(kind) {
  if (!actx) return;
  const notes = kind === "done" ? [523.25, 659.25, 783.99, 1046.5] : kind === "break" ? [659.25, 523.25] : [523.25, 659.25];
  notes.forEach((f, i) => {
    try {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.2;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + 1.05);
    } catch (e) {}
  });
}
let wl = null;
async function keepAwake(on) {
  try {
    if (on && !wl && navigator.wakeLock) { wl = await navigator.wakeLock.request("screen"); wl.addEventListener("release", () => { wl = null; }); }
    else if (!on && wl) { const w = wl; wl = null; await w.release(); }
  } catch (e) {}
}
let hiddenAt = document.visibilityState === "hidden" ? Date.now() : 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
  const away = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0;
  advance(Date.now(), true);
  if (T.status === "running") keepAwake(true);
  if (away < 60000) return;
  const m = Math.round(away / 60000);
  if (T.status === "running") A.toast(`ออกไป ${m} นาที เวลายังนับต่อให้ ตอนนี้${PH()[T.phase].k === "break" ? "อยู่ช่วงพัก" : "อยู่ช่วงโฟกัส"}`);
  else if (T.status === "logging") A.toast("ครบรอบแล้วระหว่างที่ออกไป จดบันทึกแล้วกดบันทึกได้เลย");
});

/* ---------- UI ---------- */
function renderActions() {
  const a = $("actions"); a.textContent = "";
  const add = (label, cls, fn, id) => { const b = A.el("button", { type: "button", class: "btn " + (cls || ""), id, onclick: fn, text: label }); a.append(b); return b; };
  if (ui.drain) { add("กำลังรีเซ็ต…", "", () => {}, "bWait").disabled = true; return; }
  if (ui.confirmQuit) {
    a.append(A.el("span", { class: "confirm", text: "ถ้าเลิกตอนนี้ แม่น้ำจะกลับมาขุ่น และรอบนี้จะไม่ถูกนับ" }));
    add("เลิกเรียน", "danger", doQuit, "bQuitYes"); add("เรียนต่อ", "primary", () => { ui.confirmQuit = false; renderActions(); }, "bQuitNo");
    return;
  }
  if (T.status === "running") {
    if (PH()[T.phase].k === "break") add("ข้ามพัก", "primary", skipBreak, "bSkip");
    add("หยุดชั่วคราว", "", pause, "bPause"); add("เลิกกลางคัน", "danger", askQuit, "bQuit");
  } else if (T.status === "paused") { add("เรียนต่อ", "primary", resume, "bResume"); add("เลิกกลางคัน", "danger", askQuit, "bQuit"); }
}

function onStatus() {
  renderActions();
  const lf = $("logform");
  if (T.status === "logging") {
    if (lf.hidden) {
      showShot(); lf.hidden = false;
      const S = SEASONS[T.season];
      $("lfSeason").textContent = S ? `แม่น้ำรอบนี้ได้${S.name}${S.rare ? " ซึ่งออกยากมาก" : ""}` : "";
      $("lfSeason").classList.toggle("rare", !!(S && S.rare));
      showCatch();
    }
  } else lf.hidden = true;
  $("focus").classList.toggle("done", T.status === "logging");
  keepAwake(T.status === "running");
  renderPick();
  layout();
  if (A.onTimer) A.onTimer();
}

/* ป้าย "ใหม่!" ของปลาแต่ละตัว (นับใหม่เมื่อข้อมูลโหลดเสร็จ กันขึ้น "ใหม่" ผิดตอนรีเฟรชหน้า) */
function catchCount() {
  const box = $("lfFish"); if (!box || box.hidden) return;
  const tags = box.querySelectorAll(".lf-new"), n = $("lfFishN");
  if (["loading", "db-cache"].includes(A.store.mode)) { tags.forEach(t => { t.hidden = true; }); if (n) n.textContent = ""; return; }
  const had = {}; A.list("sessions").forEach(s => A.sessFish(s).forEach(id => { had[id] = (had[id] || 0) + 1; }));
  const seen = {};
  catchIds().forEach((id, i) => { const t = tags[i]; if (!t) return; t.hidden = !!(had[id] || seen[id]); seen[id] = 1; });
  const nw = box.querySelectorAll(".lf-new:not([hidden])").length;
  if (n) n.textContent = nw ? `ชนิดใหม่ ${nw} ตัว · เพิ่มเข้าคอลเลกชันแล้ว` : "เพิ่มเข้าคอลเลกชันแล้ว";
}
/* การ์ดจบรอบ: ปลา 3 ตัวที่ได้ (ขยับหางวนไปเรื่อยๆ ตอนการ์ดเปิดอยู่) */
let catchRaf = 0;
function showCatch() {
  const box = $("lfFish"), ids = catchIds();
  cancelAnimationFrame(catchRaf); box.textContent = "";
  if (!ids.length) { box.hidden = true; return; }
  box.style.setProperty("--rc", A.RARITY[A.fish(A.rarest(ids)).rarity].color);
  box.append(A.el("div", { class: "lf-catch-h" }, A.el("b", { text: `ได้ปลา ${ids.length} ตัว` }), A.el("span", { class: "muted sm", id: "lfFishN" })));
  const row = A.el("ul", { class: "lf-catch" }), cvs = [];
  ids.forEach(id => {
    const f = A.fish(id), R = A.RARITY[f.rarity];
    const c = A.el("canvas", { class: "lf-fish-cv", width: 200, height: 110, role: "img", "aria-label": `${f.name} ระดับ${R.name}` });
    const tag = A.el("span", { class: "lf-new", text: "ใหม่!" }); tag.hidden = true;
    row.append(A.el("li", { class: "lf-fi", style: `--rc:${R.color}`, title: f.desc },
      tag, c, A.el("span", { class: "rar r-" + f.rarity, text: R.name }), A.el("b", { text: f.name })));
    cvs.push([c.getContext("2d"), f, R]);
  });
  box.append(row);
  box.hidden = false; catchCount();
  const t0 = performance.now();
  (function tick(now) {
    if ($("logform").hidden || !row.isConnected) return;
    const t = (now - t0) / 1000;
    cvs.forEach(([g, f, R], i) => {
      g.clearRect(0, 0, 200, 110);
      const gr = g.createRadialGradient(100, 55, 0, 100, 55, 90); gr.addColorStop(0, R.color + "55"); gr.addColorStop(1, R.color + "00");
      g.fillStyle = gr; g.fillRect(0, 0, 200, 110);
      A.drawFish(g, f.id, 104, 56 + Math.sin(t * 1.4 + i * 2) * 4, 84 * Math.min(1.15, f.size), t + i, { dir: 1 });
    });
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) catchRaf = requestAnimationFrame(tick);
  })(t0);
}

/* หน้าพร้อมเรียน (แม่น้ำในวงกลม) ↔ โหมดโฟกัสเต็มจอ — ย้าย canvas ตัวเดียวไปมา */
function layout() {
  const inFocus = A.page === "timer" && (T.status !== "idle" || !!ui.drain);
  const f = $("focus");
  if (f.hidden === inFocus) {
    f.hidden = !inFocus;
    document.documentElement.classList.toggle("locked", inFocus);
    if (inFocus) { const b = f.querySelector("#actions button, #lfNote"); if (b) b.focus({ preventScroll: true }); }
  }
  const host = inFocus ? $("stage") : $("port");
  if (cv.parentNode !== host) host.append(cv);
  $("fSubj").textContent = "";
  const rn = T.roomId && A.Rooms ? A.Rooms.name(T.roomId) : "";
  if (T.status !== "idle") $("fSubj").append(A.chip(T.subjectId), T.topicTitle ? `  ·  ${T.topicTitle}` : "", rn ? `  ·  ${/^ห้อง/.test(rn) ? rn : "ห้อง " + rn}` : "");
}
$("bStart").addEventListener("click", () => start(false));
$("bMin").addEventListener("click", () => { location.hash = "home"; });

const live = {};
function setText(id, v) { if (live[id] !== v) { live[id] = v; $(id).textContent = v; } }
function remainingMs(now) {
  if (T.status === "idle") return PH()[0].m * 60000;
  if (T.status === "logging") return 0;
  return Math.max(0, phaseMs(T.phase) - elapsed(now));
}
function updateLive(now, p) {
  let label;
  if (T.status === "idle") label = ui.drain ? "แม่น้ำกำลังขุ่นกลับ" : "พร้อมเริ่ม";
  else if (T.status === "logging") label = "เสร็จแล้ว";
  else label = T.status === "paused" ? "หยุดชั่วคราว" : PH()[T.phase].k === "break" ? "พักสายตา" : `โฟกัสช่วง ${PH().slice(0, T.phase + 1).filter(p => p.k === "focus").length}/${PH().filter(p => p.k === "focus").length}`;
  const s = Math.ceil(remainingMs(now) / (T.status === "idle" ? 1000 : MIN() / 60));
  setText("digits", `${pad(Math.floor(s / 60))}:${pad(s % 60)}`);
  setText("phaseL", label);
  let endTxt = "";
  if (T.status === "running") {
    const rest = PH().slice(T.phase + 1).reduce((a, p) => a + p.m, 0) * MIN();
    const end = new Date(now + remainingMs(now) + rest);
    endTxt = `จบรอบประมาณ ${pad(end.getHours())}:${pad(end.getMinutes())} · ปิดจอหรือสลับไปแอปอื่นได้ เวลายังนับต่อ`;
  } else if (T.status === "paused") endTxt = "หยุดไว้อยู่ เวลาจะไม่นับจนกว่าจะกดเรียนต่อ";
  setText("fEnd", endTxt);
  const stepKey = `${T.status}|${T.phase}|${PH().length}`;
  if (live.steps !== stepKey) {
    live.steps = stepKey;
    const ol = $("steps");
    if (ol.children.length !== PH().length) { ol.textContent = ""; PH().forEach(p => ol.append(A.el("li", { text: p.k === "focus" ? "โฟกัส" : "พัก" }))); }
    const active = T.status === "running" || T.status === "paused";
    [...$("steps").children].forEach((li, i) => {
      li.className = active && i === T.phase ? "on" : ((active && i < T.phase) || T.status === "logging") ? "done" : "";
    });
  }
  const v = AS_START * (1 - p), safe = v <= WHO + 1e-9;
  setText("asV", v.toFixed(1));
  setText("asS", safe ? "ต่ำกว่าเกณฑ์ WHO แล้ว ดื่มได้ปลอดภัย" : `สารหนูเกินเกณฑ์ WHO ${(v / WHO).toFixed(1)} เท่า`);
  const fill = `${(v / AS_START * 100).toFixed(2)}%`;
  if (live.fill !== fill) { live.fill = fill; $("asFill").style.width = fill; }
  if (live.safe !== safe) { live.safe = safe; $("gauge").classList.toggle("safe", safe); }
  let msg;
  if (ui.drain) msg = "แม่น้ำกำลังกลับมาขุ่น พร้อมเมื่อไหร่ค่อยเริ่มใหม่";
  else if (T.status === "idle") msg = "กดเริ่มเรียน แล้วแม่น้ำจะค่อยๆ ใสขึ้นตามเวลาที่ตั้งใจเรียน";
  else if (T.status === "paused") msg = "หยุดไว้ แม่น้ำหยุดไหลรอคุณกลับมา";
  else if (T.status === "logging") msg = "แม่น้ำใสสะอาด ปลากับนกกลับมาแล้ว";
  else if (PH()[T.phase].k === "break") msg = `พักสายตา ${PH()[T.phase].m} นาที ลุกยืดเส้น ดื่มน้ำ แม่น้ำจะนิ่งรอ`;
  else if (p < .25) msg = "น้ำยังขุ่น ไม่มีสิ่งมีชีวิตเลย ตั้งใจเรียนต่อ";
  else if (p < .5) msg = "สารหนูเริ่มลดลง น้ำค่อยๆ ใสขึ้น";
  else if (p < .55) msg = "หญ้ากับต้นไม้ริมตลิ่งเริ่มกลับมา";
  else if (p < .8) msg = "มีเงาปลาว่ายเข้ามา บรรยากาศรอบแม่น้ำเริ่มเปลี่ยน ลุ้นว่าจะได้ปลาอะไร ฤดูไหน";
  else msg = "ผ่านเกณฑ์ WHO แล้ว เรียนให้จบรอบเพื่อให้แม่น้ำใสเต็มที่";
  setText("status", msg);
}


$("logF").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("lfSave"); btn.disabled = true;
  const fin = new Date(T.finishedAt || Date.now());
  const rec = {
    date: A.dateKey(fin), finishedAt: fin.toISOString(),
    subjectId: T.subjectId || "", topicTitle: T.topicTitle || "",
    note: $("lfNote").value.trim().slice(0, 2000),
    rating: Number((document.querySelector('input[name="rate"]:checked') || {}).value || 3),
    focusMin: focusTotal(PH()), riverImg: T.img || "", season: T.season || "", fish: A.rarest(catchIds()), catch: catchIds()
  };
  const id = `s-${rec.date}-${pad(fin.getHours())}${pad(fin.getMinutes())}${pad(fin.getSeconds())}`;
  try {
    await A.put("sessions", id, rec); A.toast("บันทึกแล้ว วันนี้ขึ้นในปฏิทินแล้ว");
    T = { status: "idle" }; saveT();
    $("lfNote").value = ""; $("tFree").value = ""; $("rate3").checked = true;
    onStatus();
  } catch (err) { A.fail(err); }
  finally { btn.disabled = false; }
});

/* ---------- river scene ---------- */
const cv = $("river"), cx = cv.getContext("2d");
let W = 0, H = 0;
function resize() { const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr)); cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
new ResizeObserver(resize).observe(cv); resize();

const C = {};
const hex = h => { h = h.replace("#", "").trim(); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); };
function readColors() { const s = getComputedStyle(document.documentElement); ["dry", "lush", "mud", "murky", "clean", "asdot", "fg"].forEach(k => { C[k] = hex(s.getPropertyValue("--" + k)); }); }
const mix = (a, b, t, al = 1) => { const c = a.map((v, i) => Math.round(v + (b[i] - v) * t)); return `rgba(${c[0]},${c[1]},${c[2]},${al})`; };
readColors();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);
new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = rng(20261114);
const mk = n => Array.from({ length: n }, () => ({ a: rnd(), v: rnd() * 2 - 1, r: rnd(), sp: rnd() }));
const STREAK = mk(28), PART = mk(44), GRASS = mk(54), TREES = mk(10), FISH = mk(6), STUMPS = mk(6), SPECK = mk(80), SPARK = mk(16), BIRDS = mk(3), CRACK = mk(9);
const mod = (a, n) => ((a % n) + n) % n;

/* ---------- ฤดูที่สุ่มได้: ค่อยๆ ปรากฏเมื่อน้ำใสเกินครึ่ง (p 0.55 → 1) ---------- */
const SEASONS = {
  spring:  { name: "ฤดูใบไม้ผลิ", w: 22, ground: [104, 150, 78], canopy: [[242, 166, 194], [248, 198, 216]], grass: [120, 170, 90], water: [64, 160, 214], fall: "petal" },
  summer:  { name: "ฤดูร้อน", w: 22, ground: [112, 170, 66], canopy: [[46, 125, 50], [64, 142, 58]], grass: [92, 160, 60], water: [38, 150, 222], dots: [[250, 214, 80], [255, 250, 235]] },
  autumn:  { name: "ฤดูใบไม้ร่วง", w: 22, ground: [150, 112, 58], canopy: [[214, 104, 40], [190, 64, 40], [232, 160, 60]], grass: [170, 120, 60], water: [52, 130, 190], fall: "leaf", dots: [[200, 90, 40], [230, 150, 50]] },
  winter:  { name: "ฤดูหนาว", w: 19, ground: [226, 233, 240], canopy: [[40, 80, 60]], grass: [210, 220, 230], water: [96, 176, 222], fall: "snow", snowcap: true, ice: true },
  rainy:   { name: "ฤดูฝน", w: 10, ground: [58, 112, 70], canopy: [[34, 96, 52]], grass: [70, 130, 80], water: [60, 120, 160], fall: "rain" },
  firefly: { name: "คืนหิ่งห้อย", w: 5, rare: true, ground: [22, 44, 34], canopy: [[16, 40, 28]], grass: [30, 70, 45], water: [20, 60, 110], fall: "firefly" }
};
function pickSeason() {
  const list = Object.entries(SEASONS); let r = Math.random() * list.reduce((a, [, s]) => a + s.w, 0);
  for (const [key, s] of list) { r -= s.w; if (r < 0) return key; }
  return "spring";
}
A.season = key => SEASONS[key] || null;
const FALL = mk(70), GDOT = mk(60);
const rgb = (c, al = 1) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function drawSeasonFx(S, k, life) {
  if (!S || k <= 0.02) return;
  if (S.fall === "firefly") { cx.fillStyle = `rgba(4,10,30,${0.38 * k})`; cx.fillRect(0, 0, W, H); }
  if (!S.fall) return;
  FALL.forEach((s, i) => {
    if (S.fall === "rain") {
      const sp = 420 + s.sp * 200, y = mod(s.r * H + life * sp, H + 30) - 15, x = mod(s.a * W + life * sp * 0.25, W + 20) - 10;
      cx.strokeStyle = `rgba(200,220,255,${0.45 * k})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - 3, y - 11); cx.stroke();
      if (i % 5 === 0) { const x2 = s.a * W, y2 = ry(x2) + s.v * hw(x2) * 0.7, ph = mod(life * 1.2 + s.r, 1);
        cx.strokeStyle = `rgba(255,255,255,${(1 - ph) * 0.5 * k})`; cx.beginPath(); cx.ellipse(x2, y2, 2 + ph * 9, (2 + ph * 9) * 0.4, 0, 0, Math.PI * 2); cx.stroke(); }
      return;
    }
    if (S.fall === "firefly") {
      if (i > 40) return;
      const [x0, y0] = landY(GDOT[i % GDOT.length], 10 + s.r * H * 0.25);
      const x = x0 + Math.sin(life * 0.7 + s.a * 9) * 10, y = y0 + Math.cos(life * 0.9 + s.v * 7) * 8 - 6;
      const b = Math.pow((Math.sin(life * 2.2 + s.a * 30) + 1) / 2, 3) * k;
      const gr = cx.createRadialGradient(x, y, 0, x, y, 9);
      gr.addColorStop(0, `rgba(230,255,140,${b})`); gr.addColorStop(1, "rgba(230,255,140,0)");
      cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, 9, 0, Math.PI * 2); cx.fill();
      return;
    }
    const snow = S.fall === "snow", sp = snow ? 18 + s.sp * 22 : 22 + s.sp * 26;
    const y = mod(s.r * H + life * sp, H + 20) - 10;
    const x = mod(s.a * W + Math.sin(life * 0.8 + s.v * 6) * 14 + life * (snow ? 4 : 10), W + 20) - 10;
    if (snow) { cx.fillStyle = `rgba(255,255,255,${0.85 * k})`; cx.beginPath(); cx.arc(x, y, 1.2 + s.sp * 1.8, 0, Math.PI * 2); cx.fill(); return; }
    const leaf = S.fall === "leaf", col = leaf ? S.canopy[i % S.canopy.length] : [248, 190, 212];
    cx.save(); cx.translate(x, y); cx.rotate(life * (1 + s.sp) * 1.5 + s.a * 6);
    cx.fillStyle = rgb(col, 0.9 * k); cx.beginPath(); cx.ellipse(0, 0, leaf ? 4 : 3, leaf ? 2 : 1.8, 0, 0, Math.PI * 2); cx.fill(); cx.restore();
  });
}
const ry = x => H * 0.52 + Math.sin(x / W * Math.PI * 1.8 + 0.6) * H * 0.14 + Math.sin(x / W * Math.PI * 4.6) * H * 0.03;
const hw = x => H * 0.15 * (1 + 0.14 * Math.sin(x / W * 7 + 1));
function riverPath(extra, scale = 1) {
  cx.beginPath();
  for (let x = -10; x <= W + 10; x += 8) cx.lineTo(x, ry(x) - hw(x) * scale - extra);
  for (let x = W + 10; x >= -10; x -= 8) cx.lineTo(x, ry(x) + hw(x) * scale + extra);
  cx.closePath();
}
function landY(s, off) { const x = s.a * W, side = s.v >= 0 ? 1 : -1; const y = ry(x) + side * (hw(x) + off); return [x, Math.max(8, Math.min(H - 8, y))]; }

function draw(p, flowT, life) {
  const g = smooth(0.15, 0.7, p);
  const S = T.status !== "idle" ? SEASONS[T.season] : null, k = S ? smooth(0.55, 1, p) : 0;
  cx.fillStyle = mix(C.dry, C.lush, g); cx.fillRect(0, 0, W, H);
  if (k > 0) { cx.fillStyle = rgb(S.ground, k); cx.fillRect(0, 0, W, H); }
  cx.fillStyle = "rgba(0,0,0,0.07)";
  SPECK.forEach(s => cx.fillRect(s.a * W, s.r * H, 2 + s.sp * 2, 2));
  const ca = (1 - smooth(0.1, 0.45, p)) * 0.35;
  if (ca > 0.01) {
    cx.strokeStyle = `rgba(40,30,15,${ca})`; cx.lineWidth = 1.2;
    CRACK.forEach(s => { const [x, y] = landY(s, 20 + s.r * H * 0.2); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + 8 + s.sp * 8, y + 4 * s.v); cx.lineTo(x + 14 + s.sp * 10, y - 3); cx.moveTo(x + 8 + s.sp * 8, y + 4 * s.v); cx.lineTo(x + 10, y + 9); cx.stroke(); });
  }
  cx.fillStyle = mix(C.mud, C.dry, g * 0.5); riverPath(6); cx.fill();
  const wt = p < 0.8 ? p * 0.72 : 0.576 + (p - 0.8) / 0.2 * 0.424;
  let wc = lerpC(C.murky, C.clean, wt); if (k > 0) wc = lerpC(wc, S.water, k * 0.8);
  cx.fillStyle = rgb(wc); riverPath(0); cx.fill();
  if (k > 0 && S.ice) { cx.strokeStyle = `rgba(240,248,255,${0.85 * k})`; cx.lineWidth = 3.5; riverPath(0); cx.stroke(); }
  cx.fillStyle = `rgba(255,255,255,${0.04 + 0.08 * p})`; riverPath(0, 0.42); cx.fill();
  const sc = [200, 188, 118], wh = [255, 255, 255];
  cx.lineCap = "round";
  STREAK.forEach(s => {
    const span = W + 80, x = mod(s.a * span + flowT * (32 + s.sp * 30), span) - 40, y = ry(x) + s.v * hw(x) * 0.78;
    const L = 12 + s.sp * 22, dy = ry(x + L) - ry(x);
    cx.strokeStyle = mix(sc, wh, p, 0.14 + 0.32 * p); cx.lineWidth = 1.4;
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + L, y + dy); cx.stroke();
  });
  const exact = PART.length * (1 - p), n = Math.ceil(exact);
  cx.font = "600 7px 'JetBrains Mono',monospace"; cx.textAlign = "center"; cx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const s = PART[i], span = W + 40;
    const x = mod(s.a * span + flowT * (14 + s.sp * 10), span) - 20;
    const y = ry(x) + s.v * hw(x) * 0.74 + Math.sin(life * 1.3 + s.a * 9) * 2;
    const r = 3 + s.r * 4.6, al = (i === n - 1 ? exact - (n - 1) : 1) * 0.9;
    cx.fillStyle = mix(C.asdot, C.asdot, 0, al); cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = `rgba(60,50,0,${al * 0.55})`; cx.lineWidth = 1; cx.stroke();
    if (r > 6) { cx.fillStyle = `rgba(50,40,0,${al})`; cx.fillText("As", x, y + 0.5); }
  }
  FISH.forEach((s, i) => {
    const thr = 0.72 + i * 0.05, k = smooth(thr, thr + 0.04, p); if (k <= 0) return;
    const span = W + 60, x = mod(s.a * span - flowT * (16 + s.sp * 14) - life * 6, span) - 30;
    const y = ry(x) + s.v * hw(x) * 0.5 + Math.sin(life * 2 + i) * 3;
    const ang = Math.atan2(ry(x - 4) - ry(x), -4);
    cx.save(); cx.translate(x, y); cx.rotate(ang); cx.globalAlpha = k;
    cx.fillStyle = i % 2 ? "rgb(242,165,65)" : "rgb(226,232,236)";
    cx.beginPath(); cx.ellipse(0, 0, 7.5, 3.3, 0, 0, Math.PI * 2); cx.fill();
    const wag = Math.sin(life * 9 + i) * 1.6;
    cx.beginPath(); cx.moveTo(-6, 0); cx.lineTo(-11, -3.5 + wag); cx.lineTo(-11, 3.5 + wag); cx.closePath(); cx.fill();
    cx.fillStyle = "rgba(20,30,30,.8)"; cx.beginPath(); cx.arc(4, -0.8, 0.9, 0, Math.PI * 2); cx.fill();
    cx.restore();
  });
  drawFeatured(p, life);
  const spA = smooth(0.95, 1, p);
  if (spA > 0) {
    cx.strokeStyle = "#fff"; cx.lineWidth = 1.2;
    SPARK.forEach(s => { const x = s.a * W, y = ry(x) + s.v * hw(x) * 0.8, tw = (Math.sin(life * 3 + s.a * 20) + 1) / 2, l = 1.5 + tw * 3.5;
      cx.globalAlpha = spA * tw; cx.beginPath(); cx.moveTo(x - l, y); cx.lineTo(x + l, y); cx.moveTo(x, y - l); cx.lineTo(x, y + l); cx.stroke(); });
    cx.globalAlpha = 1;
  }
  const da = 1 - smooth(0.25, 0.5, p);
  if (da > 0.01) {
    cx.globalAlpha = da; cx.strokeStyle = "rgb(92,82,68)"; cx.lineCap = "round";
    STUMPS.forEach(s => { const [x, y] = landY(s, 26 + s.r * H * 0.16); cx.lineWidth = 3; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 14); cx.stroke(); cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(x, y - 9); cx.lineTo(x - 6, y - 15); cx.moveTo(x, y - 12); cx.lineTo(x + 5, y - 18); cx.stroke(); });
    cx.globalAlpha = 1;
  }
  if (k > 0 && S.dots) GDOT.forEach((s, i) => { const [x, y] = landY(s, 12 + s.r * H * 0.3); cx.fillStyle = rgb(S.dots[i % S.dots.length], k * 0.9); cx.beginPath(); cx.arc(x, y, 1.5 + s.sp * 1.4, 0, Math.PI * 2); cx.fill(); });
  const grassC = lerpC(C.lush, [28, 88, 38], 0.45);
  cx.strokeStyle = rgb(k > 0 ? lerpC(grassC, S.grass, k) : grassC); cx.lineWidth = 1.5;
  GRASS.forEach(s => {
    const thr = 0.22 + s.sp * 0.4, k = smooth(thr, thr + 0.12, p); if (k <= 0) return;
    const [x, y] = landY(s, 8 + s.r * 12), h = 7 * k;
    cx.beginPath(); cx.moveTo(x - 2, y); cx.lineTo(x - 3.5, y - h); cx.moveTo(x, y); cx.lineTo(x, y - h * 1.25); cx.moveTo(x + 2, y); cx.lineTo(x + 3.5, y - h); cx.stroke();
  });
  TREES.forEach((s, i) => {
    const thr = 0.45 + i * 0.032, k = smooth(thr, thr + 0.15, p); if (k <= 0) return;
    const [x, y] = landY(s, 30 + s.r * H * 0.17), r = (7 + s.sp * 8) * k;
    cx.fillStyle = "rgba(0,0,0,.14)"; cx.beginPath(); cx.ellipse(x + 3, y + 3, r, r * 0.6, 0, 0, Math.PI * 2); cx.fill();
    const leafC = lerpC(C.lush, [24, 74, 34], 0.55);
    cx.fillStyle = rgb(S && k > 0 ? lerpC(leafC, S.canopy[i % S.canopy.length], k) : leafC); cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = mix(C.lush, [255, 255, 255], 0.18, 0.8 * (1 - k * 0.6)); cx.beginPath(); cx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2); cx.fill();
    if (S && k > 0 && S.snowcap) { cx.fillStyle = `rgba(250,252,255,${0.92 * k})`; cx.beginPath(); cx.arc(x, y - r * 0.12, r * 0.86, Math.PI * 1.05, Math.PI * 1.95); cx.closePath(); cx.fill(); }
  });
  const ba = S && S.fall === "firefly" ? 0 : smooth(0.97, 1, p);
  if (ba > 0) {
    cx.strokeStyle = mix(C.fg, C.fg, 0, 0.75 * ba); cx.lineWidth = 1.6;
    BIRDS.forEach((s, i) => { const x = mod(s.a * W + life * (22 + i * 6), W + 40) - 20, y = H * 0.13 + s.r * H * 0.1, f = Math.sin(life * 6 + i * 2) * 3;
      cx.beginPath(); cx.moveTo(x - 7, y - 2 - f); cx.quadraticCurveTo(x - 3, y - 3, x, y); cx.quadraticCurveTo(x + 3, y - 3, x + 7, y - 2 - f); cx.stroke(); });
  }
  drawSeasonFx(S, k, life);
}

function drawFeatured(p, life) {
  if (T.status === "idle") return;
  catchIds().forEach((id, i) => {
    const show = smooth(0.5 + i * 0.05, 0.6 + i * 0.05, p), col = smooth(0.8 + i * 0.04, 0.9 + i * 0.04, p);
    if (show <= 0) return;
    const f = A.fish(id), R = A.RARITY[f.rarity];
    const L = Math.max(20, Math.min(W, H) * 0.08) * f.size;
    const span = W + L * 4, x = mod(W * (0.62 + i * 0.29) - life * (16 + i * 3), span) - L * 2;   // ว่ายทวนน้ำช้าๆ คนละระยะ
    const y = ry(x) + Math.sin(life * 0.7 + i * 2.1) * hw(x) * 0.2 + (i - 1) * hw(x) * 0.3;
    cx.save(); cx.translate(x, y); cx.rotate(Math.atan2(ry(x + 4) - ry(x), 4));
    if (col > 0 && R.rank >= 2) {
      const gr = cx.createRadialGradient(0, 0, 0, 0, 0, L * 1.1);
      gr.addColorStop(0, R.color + "66"); gr.addColorStop(1, R.color + "00");
      cx.globalAlpha = show * col; cx.fillStyle = gr; cx.beginPath(); cx.arc(0, 0, L * 1.1, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1;
    }
    if (col < 1) A.drawFish(cx, f.id, 0, 0, L, life + i, { dir: -1, alpha: show * (1 - col) * 0.55, silhouette: "rgb(20,30,40)" });
    if (col > 0) A.drawFish(cx, f.id, 0, 0, L, life + i, { dir: -1, alpha: show * col });
    cx.restore();
  });
}

function flowSpeed() {
  if (ui.drain) return 0.6;
  if (T.status === "running") return PH()[T.phase].k === "break" ? 0.2 : 1;
  if (T.status === "paused") return 0;
  if (T.status === "logging") return 0.8;
  return 0.5;
}

/* ---------- river photo at the end of a round ---------- */
// ถ่ายภาพแม่น้ำหลังจบรอบ รอให้น้ำใสเต็มที่และปลา/นกขึ้นครบก่อน แล้วย่อเป็น JPEG เล็กๆ เก็บไว้กับบันทึก
let shotTimer = null;
function showShot() {
  const img = $("lfImg"), wait = $("lfImgWait");
  if (T.img) { img.src = T.img; img.hidden = false; wait.hidden = true; } else { img.hidden = true; wait.hidden = false; }
}
function maybeCapture() {
  if (T.status !== "logging" || T.img || shotTimer || A.page !== "timer") return;
  shotTimer = setTimeout(() => {
    shotTimer = null;
    if (T.status !== "logging" || T.img || A.page !== "timer" || W < 50) return;
    try {
      draw(1, flowT, Math.max(life, 3));            // วาดแม่น้ำใสเต็มที่ก่อนถ่าย
      // ครอปเป็นภาพแนวนอน 2.4:1 ตรงกลางแม่น้ำ ไม่ว่าจอจะเป็นแนวตั้งหรือแนวนอน
      const k = cv.width / W, sh = Math.min(H, W / 2.4), sy = Math.max(0, Math.min(H - sh, H * 0.52 - sh / 2));
      const w = 640, h = Math.round(w * sh / W), off = document.createElement("canvas");
      off.width = w; off.height = h;
      off.getContext("2d").drawImage(cv, 0, sy * k, W * k, sh * k, 0, 0, w, h);
      T.img = off.toDataURL("image/jpeg", 0.72);
      saveT(); showShot();
    } catch (e) {}
  }, 1500);
}

let last = performance.now(), flowT = 0, life = 0, pDisp = null;
function loop(ts) {
  const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
  const now = Date.now();
  advance(now, true);
  const tp = targetP(now);
  if (pDisp === null) pDisp = tp;
  pDisp += (tp - pDisp) * Math.min(1, dt * (ui.drain ? 20 : 6));
  if (Math.abs(tp - pDisp) < 0.0005) pDisp = tp;
  if (A.page === "timer") {
    if (!reduced) { flowT += dt * flowSpeed(); if (T.status !== "paused") life += dt; }
    if (W > 0 && H > 0) draw(pDisp, flowT, life);
    updateLive(now, pDisp);
    maybeCapture();
  }
  requestAnimationFrame(loop);
}

/* ---------- ตั้งเวลา (หน้าพร้อมเรียน) ---------- */
const PRESETS = [
  { label: "25 + 5 × 2", focus: 25, brk: 5, blocks: 2 },
  { label: "50 นาทีรวด", focus: 50, brk: 0, blocks: 1 },
  { label: "45 + 10 × 2", focus: 45, brk: 10, blocks: 2 },
  { label: "15 + 3 × 3", focus: 15, brk: 3, blocks: 3 }
];
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ""}` : `${m} นาที`;
function renderCfg() {
  const c = cfg(), ph = planOf(c);
  [["cfFocus", c.focus], ["cfBreak", c.brk], ["cfBlocks", c.blocks]].forEach(([id, v]) => { const e = $(id); if (document.activeElement !== e) e.value = v; });
  $("cfBreak").disabled = c.blocks < 2;
  const box = $("presets");
  if (!box.children.length) PRESETS.forEach((p, i) => box.append(A.el("button", { type: "button", class: "preset", "data-i": i, text: p.label, onclick: () => setCfg(p) })));
  [...box.children].forEach((b, i) => { const p = PRESETS[i]; b.setAttribute("aria-pressed", String(p.focus === c.focus && p.blocks === c.blocks && (c.blocks < 2 || p.brk === c.brk))); });
  const total = ph.reduce((a, p) => a + p.m, 0);
  $("cfTotal").textContent = `เรียน ${fmtMin(focusTotal(ph))}${c.blocks > 1 && c.brk ? ` · รวมพัก ${fmtMin(total)}` : ""}`;
  if (T.status === "idle") $("readyTime").textContent = `${pad(c.focus)}:00`;
}
let cfgT = null;
function setCfg(c) {
  pendingCfg = { focus: clampN(c.focus, 1, 180, 25), brk: clampN(c.brk, 0, 60, 5), blocks: clampN(c.blocks, 1, 6, 2) };
  renderCfg();
  clearTimeout(cfgT);
  cfgT = setTimeout(() => {
    const save = pendingCfg;
    A.put("settings", "main", { ...A.settings(), timer: save }).then(() => { if (pendingCfg === save) pendingCfg = null; }).catch(A.fail);
  }, 600);
}
["cfFocus", "cfBreak", "cfBlocks"].forEach(id => {
  $(id).addEventListener("change", () => setCfg({ focus: $("cfFocus").value, brk: $("cfBreak").value, blocks: $("cfBlocks").value }));
});

/* ---------- public ---------- */
A.Timer = {
  info() {
    const now = Date.now();
    return { status: T.status, phase: T.status === "running" || T.status === "paused" ? PH()[T.phase].k : null,
             remainMin: Math.ceil(remainingMs(now) / MIN()), subjectId: T.subjectId, topicTitle: T.topicTitle, roomId: T.roomId || "",
             // เวลาที่ทั้งรอบจะจบ (ใช้บอกเพื่อนในห้องเรียนว่าเหลืออีกกี่นาที) — คิดเฉพาะตอนกำลังเดิน
             endsAt: T.status === "running" ? T.phaseStart + PH().slice(T.phase).reduce((a, p) => a + p.m, 0) * MIN() : 0 };
  },
  refresh() { renderPick(); renderCfg(); layout(); catchCount(); },
  layout() { layout(); }
};
A.startTimer = () => { advance(Date.now(), false); onStatus(); requestAnimationFrame(loop); };
})();
