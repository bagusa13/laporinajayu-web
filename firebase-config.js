import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js"; // Tambahkan ini
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyBNsdX1l_AO_gXCQmsFWdegMMKEJ6N6OMw",
  authDomain: "laporinaja-web.firebaseapp.com",
  projectId: "laporinaja-web",
  storageBucket: "laporinaja-web.firebasestorage.app", 
  messagingSenderId: "632993929561",
  appId: "1:632993929561:web:0fdbf5256df671dd9f5448"
};

const app = initializeApp(firebaseConfig);

self.FIREBASE_APPCHECK_DEBUG_TOKEN = false; 

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6Leq_scsAAAAAL7-dVbRVsnuUbN1yVIZ94VTXuY'), //
  isTokenAutoRefreshEnabled: true 
});


export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
