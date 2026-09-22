import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const form = document.getElementById("upload-form");
const fileInput = document.getElementById("photo");
const fileDrop = document.getElementById("file-drop");
const preview = document.getElementById("preview");
const hint = document.getElementById("file-hint");
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const submitBtn = document.getElementById("submit-btn");
const progressWrap = document.getElementById("progress");
const progressBar = document.getElementById("progress-bar");
const msgBox = document.getElementById("msg");

let selectedFile = null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = "block";
    fileDrop.classList.add("has-image");
    hint.textContent = file.name;
  };
  reader.readAsDataURL(file);
});

function resizeImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showMsg(text, type) {
  msgBox.textContent = text;
  msgBox.className = `msg ${type}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msgBox.className = "msg";

  const name = nameInput.value.trim();
  const message = messageInput.value.trim();

  if (!name) {
    showMsg("請填寫你的名字", "error");
    return;
  }
  if (!selectedFile) {
    showMsg("請選擇一張照片", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "上傳中…";
  progressWrap.style.display = "block";
  progressBar.style.width = "10%";

  try {
    const blob = await resizeImage(selectedFile);
    progressBar.style.width = "40%";

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, `photos/${filename}`);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    progressBar.style.width = "75%";

    const photoURL = await getDownloadURL(storageRef);
    progressBar.style.width = "90%";

    await addDoc(collection(db, "entries"), {
      name,
      message,
      photoURL,
      storagePath: `photos/${filename}`,
      createdAt: serverTimestamp()
    });

    progressBar.style.width = "100%";
    showMsg("上傳成功！等等抽獎時見 🎉", "success");
    form.reset();
    preview.style.display = "none";
    fileDrop.classList.remove("has-image");
    hint.textContent = "點這裡選擇照片（或拍一張新的）";
    selectedFile = null;
  } catch (err) {
    console.error(err);
    showMsg("上傳失敗，請檢查網路後再試一次", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "送出";
    setTimeout(() => { progressWrap.style.display = "none"; progressBar.style.width = "0%"; }, 800);
  }
});
