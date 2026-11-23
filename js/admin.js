import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ENTRIES_COLLECTION, STATE_DOC_ID } from "./mode.js";

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

// ---- Display logic ----
// 大螢幕只負責「顯示」：長官在 host.html（手機）按下抽獎後，
// 抽中的結果會寫進 Firestore 的 draw/state，這裡收到新的一輪就播放抽獎動畫。

const countPill = document.getElementById("count-pill");
const stage = document.getElementById("stage");
const historyList = document.getElementById("history-list");

let entries = [];
let state = null;
let lastSeq = null;
let animating = false;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function updateCountPill() {
  const drawnCount = (state?.history || []).length;
  countPill.textContent = `已上傳 ${entries.length} 張・已抽出 ${drawnCount} 次`;
}

function renderStagePlaceholder() {
  stage.innerHTML = `<div class="stage-placeholder">等待主持人抽獎</div>`;
}

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

function renderHistory() {
  historyList.innerHTML = (state?.history || []).slice().reverse().map((e) =>
    `<div class="history-item"><img src="${e.photoURL}" alt="" />${escapeHtml(e.name)}</div>`
  ).join("");
}

function pickRandomFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

async function animateTo(next) {
  animating = true;
  const pool = entries.length ? entries : [next.winner];

  let delay = 70;
  for (let i = 0; i < 20; i++) {
    renderSpin(pickRandomFrom(pool));
    await new Promise((r) => setTimeout(r, delay));
    delay += 12; // 逐漸變慢，製造停止感
  }

  renderResult(next.winner);
  animating = false;
  // 動畫期間若又有新狀態進來，以最新的為準
  if (state !== next) apply(state);
  else { renderHistory(); updateCountPill(); }
}

function apply(next) {
  const first = lastSeq === null;
  const changed = next.seq !== lastSeq;
  lastSeq = next.seq;
  if (animating) return; // animateTo 結束後會補上最新狀態
  if (!first && changed && next.winner) {
    animateTo(next);
    return;
  }
  // 第一次載入、或主持人重設名單：不播動畫，直接顯示目前狀態
  if (next.winner) renderResult(next.winner); else renderStagePlaceholder();
  renderHistory();
  updateCountPill();
}

function startListening() {
  onSnapshot(collection(db, ENTRIES_COLLECTION), (snap) => {
    entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!animating) updateCountPill();
  });
  onSnapshot(doc(db, "draw", STATE_DOC_ID), (snap) => {
    state = snap.exists() ? snap.data() : { seq: 0, winner: null, history: [] };
    apply(state);
  });
}

renderStagePlaceholder();

if (sessionStorage.getItem("admin_ok") === "1") {
  unlock();
} else {
  gate.style.display = "block";
}
