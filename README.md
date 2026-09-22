# 聚餐照片上傳 & 抽獎

- `index.html` — 給同事上傳照片、名字、留言（手機用）
- `admin.html` — 主持人抽獎畫面（投影在螢幕上）
- 照片與資料存在 Firebase（Storage 存照片、Firestore 存名字/留言/照片網址）

## 1. 建立 Firebase 專案

1. 開啟 https://console.firebase.google.com/ ，用 Google 帳號登入
2. 「新增專案」→ 輸入專案名稱（例如 `itparty-2026`）→ 一路下一步建立完成
3. 建好後，在左側選單找到 **建構 → Firestore Database** → 「建立資料庫」→ 選 **正式版模式（production）**，地區選 `asia-east1`（台灣近）
4. 左側選單找到 **建構 → Storage** → 「開始使用」→ 一路下一步，地區一樣選 `asia-east1`

## 2. 設定安全規則（重要）

因為同事上傳照片不需要登入帳號，所以要放寬「新增」權限，但限制不能亂改別人的資料。

**Firestore 規則**（Firestore Database → 規則，貼上後「發布」）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /entries/{entryId} {
      allow read: if true;
      allow create: if request.resource.data.name is string
                    && request.resource.data.name.size() > 0
                    && request.resource.data.name.size() < 50
                    && request.resource.data.photoURL is string;
      allow update, delete: if false;
    }
  }
}
```

**Storage 規則**（Storage → Rules，貼上後「發布」）：

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{fileName} {
      allow read: if true;
      allow write: if request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

> 這樣任何人拿到網址都能上傳照片，適合聚餐這種輕鬆場合。活動結束後可以把規則改回預設（全部拒絕）避免持續被亂傳。

## 3. 取得設定並貼進專案

1. Firebase Console 左上角齒輪 → **專案設定**
2. 往下捲到「你的應用程式」→ 點 `</>`（網頁圖示）→ 輸入應用程式暱稱 → 註冊
3. 會出現一段 `firebaseConfig = { ... }`，整段複製
4. 打開專案裡的 `js/firebase-config.js`，把裡面的範例值換成你複製的內容

## 4. 本機測試

因為用了 ES module，不能直接雙擊 html 打開，要用一個簡單的本機伺服器：

```
cd ITPARTY
python3 -m http.server 8000
```

瀏覽器開 http://localhost:8000 測上傳，http://localhost:8000/admin.html 測抽獎。

## 5. 設定主持人密碼

打開 `js/admin.js`，找到這一行，改成你要的密碼：

```js
const ADMIN_PASSWORD = "party2026";
```

⚠️ 這只是避免同事手滑點進主持畫面，**不是真正的安全機制**（密碼就寫在前端程式碼裡，懂技術的人打開原始碼就看得到）。如果需要真正防護，之後可以改用 Firebase Authentication。

## 6. 部署到 GitHub Pages

```
cd ITPARTY
git init
git add .
git commit -m "聚餐抽獎網站"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo名稱>.git
git push -u origin main
```

接著到 GitHub 該 repo 的 **Settings → Pages**：
- Source 選 `Deploy from a branch`
- Branch 選 `main` / `/(root)`
- 儲存後等 1-2 分鐘，會出現網址，格式像 `https://<你的帳號>.github.io/<repo名稱>/`

- 上傳照片頁：`https://<你的帳號>.github.io/<repo名稱>/`
- 抽獎主持頁：`https://<你的帳號>.github.io/<repo名稱>/admin.html`

把上傳照片頁的網址做成 QR code，活動當天讓同事掃碼上傳即可。

## 活動結束後

- Firestore 規則改回拒絕所有寫入，避免網址被繼續濫用
- 想保留照片可以到 Firebase Storage 主控台直接下載，或到 Firestore 匯出 `entries` collection
