import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ENTRIES_COLLECTION, STATE_DOC_ID } from "./mode.js";

// 手機上的「抽獎遙控器」：按下抽獎後只負責決定誰中獎並寫進 draw/state，
// 投影用的 admin.html 會即時收到並播放抽獎動畫。
// 密碼只是軟性門檻，說明同 admin.js。
const ADMIN_PASSWORD = "party2026";

// 大螢幕動畫約 3.7 秒，這段時間內鎖住按鈕避免連按
const ANIMATION_MS = 4500;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const stateRef = doc(db, "draw", STATE_DOC_ID);

const gate = document.getElementById("gate");
const main = document.getElementById("main");
const gateInput = document.getElementById("gate-password");
const gateBtn = document.getElementById("gate-btn");
const gateError = document.getElementById("gate-error");
const countPill = document.getElementById("count-pill");
const drawBtn = document.getElementById("draw-btn");
const historyList = document.getElementById("history-list");
const resetBtn = document.getElementById("reset-btn");

let entries = [];
let state = { seq: 0, winner: null, history: [] };
let locked = false;
let started = false;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// 每張照片就是一張抽獎券：上傳越多張機率越高，中過獎的人之後仍可再被抽到
function remainingEntries() {
  return entries;
}

function renderHistory() {
  historyList.innerHTML = (state.history || []).slice().reverse().map((e) =>
    `<div class="history-item"><img src="${e.photoURL}" alt="" />${escapeHtml(e.name)}</div>`
  ).join("");
}

function updateUI() {
  const drawnCount = (state.history || []).length;
  countPill.textContent = `已上傳 ${entries.length} 張・已抽出 ${drawnCount} 次`;
  drawBtn.disabled = locked || entries.length === 0;
  drawBtn.textContent = locked
    ? "抽獎中…"
    : entries.length === 0 ? "還沒有人上傳照片" : (drawnCount === 0 ? "🎲 開始抽獎" : "🎉 再抽一次");
}

// 把 Firestore 錯誤轉成現場看得懂的說明（原始錯誤碼附在最後，方便回報）
function describeError(err, failedPrefix) {
  const code = err?.code || "unknown";
  let reason;
  if (code === "permission-denied") {
    reason = "沒有寫入權限：Firestore 規則尚未加入 draw/state（請到 Firebase Console → Firestore → 規則，加入 match /draw/state { allow read, write: if true; } 並發布）。";
  } else if (code === "unavailable" || code === "deadline-exceeded" || !navigator.onLine) {
    reason = "連不上伺服器：請確認手機網路（Wi-Fi / 行動網路）是否正常，再按一次。";
  } else if (code === "resource-exhausted") {
    reason = "Firebase 免費額度已用完，請稍後再試或到 Firebase Console 確認用量。";
  } else {
    reason = "發生未知錯誤，請重新整理頁面後再試一次。";
  }
  return `${failedPrefix}\n\n原因：${reason}\n\n（錯誤碼：${code}）`;
}

async function draw() {
  const pool = remainingEntries();
  if (locked || pool.length === 0) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const winner = { name: pick.name, photoURL: pick.photoURL, message: pick.message || "" };

  locked = true;
  updateUI();
  try {
    await setDoc(stateRef, {
      seq: (state.seq || 0) + 1,
      winner,
      history: [...(state.history || []), winner],
    });
  } catch (err) {
    console.error(err);
    alert(describeError(err, "抽獎結果沒有送到大螢幕，這一輪不算數，名單不會變動。"));
    locked = false;
    updateUI();
    return;
  }
  setTimeout(() => { locked = false; renderHistory(); updateUI(); }, ANIMATION_MS);
}

async function reset() {
  if (locked) return;
  if (!confirm("確定要清空已抽出名單嗎？")) return;
  try {
    await setDoc(stateRef, {
      seq: (state.seq || 0) + 1,
      winner: null,
      history: [],
    });
  } catch (err) {
    console.error(err);
    alert(describeError(err, "重設沒有成功，中獎名單維持原狀。"));
  }
}

function startListening() {
  if (started) return;
  started = true;
  onSnapshot(collection(db, ENTRIES_COLLECTION), (snap) => {
    entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    updateUI();
  });
  onSnapshot(stateRef, (snap) => {
    if (snap.exists()) state = snap.data();
    // 抽獎動畫進行中先不更新名單，避免手機比大螢幕先洩漏結果
    if (!locked) renderHistory();
    updateUI();
  });
}

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
gateInput.addEventListener("keydown", (e) => { if (e.key === "Enter") gateBtn.click(); });
drawBtn.addEventListener("click", draw);
resetBtn.addEventListener("click", reset);

if (sessionStorage.getItem("admin_ok") === "1") unlock(); else gate.style.display = "block";
