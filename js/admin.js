import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// 這只是避免同事誤點進來的軟性門檔，不是真正的安全機制。
// 密碼寫死在前端程式碼裡，任何看得到原始碼的人都能繞過，
// 若需要真正保護請改用 Firebase Authentication。
const ADMIN_PASSWORD = "party2026";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const gate = document.getElementById("gate");
const main = document.getElementById("main");
const gateInput = document.getElementById("gate-password");
const gateBtn = document.getElementById("gate-btn");
const gateError = document.getElementById("gate-error");

function unlock() {
  gate.style.display = "none";
  main.style.display = "block";
  startListening();
}

gateBtn.addEventListener("click", () => {
  if (gateInput.value === ADMIN_PASSWORD) {
    sessionStorage.setItem("admin_ok", "1");
    unlock();
  } else {
    gateError.style.display = "block";
  }
});

gateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") gateBtn.click();
});

if (sessionStorage.getItem("admin_ok") === "1") {
  unlock();
} else {
  gate.style.display = "block";
}

// ---- Draw logic ----

const countPill = document.getElementById("count-pill");
const stage = document.getElementById("stage");
const drawBtn = document.getElementById("draw-btn");
const historyList = document.getElementById("history-list");

let entries = [];
let drawing = false;
const history = [];
const drawnNames = new Set();

function normalizeName(name) {
  return (name || "").trim();
}

function remainingEntries() {
  return entries.filter((e) => !drawnNames.has(normalizeName(e.name)));
}

function updateCountPill() {
  const remaining = remainingEntries().length;
  countPill.textContent = `已上傳 ${entries.length} 張・尚未抽出 ${remaining} 位`;
  drawBtn.disabled = remaining === 0;
  drawBtn.textContent = remaining === 0 ? "所有人都已經抽完囉" : (history.length === 0 ? "🎲 開始抽獎" : "🎉 再抽一次");
}

function startListening() {
  onSnapshot(collection(db, "entries"), (snap) => {
    entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    updateCountPill();
  });
}

function renderStagePlaceholder() {
  stage.innerHTML = `<div class="stage-placeholder">按下方按鈕開始抽獎</div>`;
}
renderStagePlaceholder();

function renderSpin(entry) {
  stage.innerHTML = `
    <img class="stage-photo spinning" src="${entry.photoURL}" alt="" />
    <div class="stage-name">${escapeHtml(entry.name)}</div>
  `;
}

function renderResult(entry) {
  stage.innerHTML = `
    <span class="reveal-badge">恭喜中獎</span>
    <img class="stage-photo" src="${entry.photoURL}" alt="" />
    <div class="stage-name">${escapeHtml(entry.name)}</div>
    ${entry.message ? `<div class="stage-message">「${escapeHtml(entry.message)}」</div>` : ""}
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function addHistory(entry) {
  history.unshift(entry);
  const item = document.createElement("div");
  item.className = "history-item";
  item.innerHTML = `<img src="${entry.photoURL}" alt="" />${escapeHtml(entry.name)}`;
  historyList.prepend(item);
}

function pickRandomFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

async function draw() {
  const pool = remainingEntries();
  if (drawing || pool.length === 0) return;
  drawing = true;
  drawBtn.disabled = true;
  drawBtn.textContent = "抽獎中…";

  const totalTicks = 20;
  let delay = 70;
  for (let i = 0; i < totalTicks; i++) {
    renderSpin(pickRandomFrom(pool));
    await new Promise((r) => setTimeout(r, delay));
    delay += 12; // 逐漸變慢，製造停止感
  }

  const winner = pickRandomFrom(pool);
  drawnNames.add(normalizeName(winner.name));
  renderResult(winner);
  addHistory(winner);

  drawing = false;
  updateCountPill();
}

drawBtn.addEventListener("click", draw);

const resetBtn = document.getElementById("reset-btn");
resetBtn.addEventListener("click", () => {
  if (!confirm("確定要清空已抽出名單，讓所有人重新回到抽獎池嗎？")) return;
  drawnNames.clear();
  history.length = 0;
  historyList.innerHTML = "";
  renderStagePlaceholder();
  updateCountPill();
});
