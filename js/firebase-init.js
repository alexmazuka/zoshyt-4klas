// Міст між модульним Firebase SDK (ES-модулі, завантажується з CDN) і рештою зошита,
// яка написана як звичайні (не-модульні) скрипти. Кладе потрібні функції у window.__fb
// і генерує подію 'z4-fb-ready', на яку чекає sync у js/common.js (fbReady()).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Публічна конфігурація Firebase-проєкту "zoshyt-4klas" (лише ідентифікатори, не секрет —
// доступ до даних обмежують Правила безпеки Firestore, див. sync/firestore.rules).
const firebaseConfig = {
  apiKey: "AIzaSyAi08s4KnoWQuQtcKkkd1ODF7ErxTrxOBw",
  authDomain: "zoshyt-4klas.firebaseapp.com",
  projectId: "zoshyt-4klas",
  storageBucket: "zoshyt-4klas.firebasestorage.app",
  messagingSenderId: "182774037902",
  appId: "1:182774037902:web:b5d3a9b33b0743317a38df"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.__fb = { db, doc, getDoc, setDoc, onSnapshot, serverTimestamp };
window.dispatchEvent(new Event('z4-fb-ready'));
