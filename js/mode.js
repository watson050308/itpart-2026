// 測試／正式模式：網址加上 ?mode=test 就會改用另一組資料，和正式名單完全分開。
//   正式：index.html / admin.html / host.html
//   測試：index.html?mode=test / admin.html?mode=test / host.html?mode=test
// 三個頁面要使用同一個模式，才會看到同一份資料。
export const IS_TEST = new URLSearchParams(location.search).get("mode") === "test";

export const ENTRIES_COLLECTION = IS_TEST ? "entries_test" : "entries";
export const STATE_DOC_ID = IS_TEST ? "state_test" : "state";

if (IS_TEST) {
  document.title = "【測試】" + document.title;
  const banner = document.createElement("div");
  banner.textContent = "🧪 測試模式 — 這裡的資料不會出現在正式抽獎";
  banner.style.cssText =
    "position:sticky;top:0;z-index:999;background:#f59e0b;color:#1e1b4b;" +
    "text-align:center;font-weight:700;font-size:14px;padding:6px 10px;";
  document.body.prepend(banner);
}
