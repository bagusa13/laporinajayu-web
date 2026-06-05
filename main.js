import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    onSnapshot,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
//   OFFLINE / ONLINE DETECTION
// ==========================================
window.addEventListener('offline', () => {
    showToast('Koneksi terputus! Anda sedang offline.', 'error');
    const btn = document.getElementById('btn-submit-laporan');
    if (btn) { btn.disabled = true; btn.innerText = 'Menunggu Koneksi...'; }
});
window.addEventListener('online', () => {
    showToast('Koneksi kembali pulih.', 'success');
    const btn = document.getElementById('btn-submit-laporan');
    if (btn) { btn.disabled = false; btn.innerText = 'Kirim Laporan'; }
});

let currentUser = null;
let laporMode = 'akun';
const googleProvider = new GoogleAuthProvider();

window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 20) navbar?.classList.add('scrolled');
    else navbar?.classList.remove('scrolled');
});

window.submitFeedback = async function (ticketId) {
    const ratingEl = document.querySelector(`input[name="rating-${ticketId}"]:checked`);
    const commentEl = document.getElementById(`comment-${ticketId}`);
    if (!ratingEl) { showToast("Pilih rating bintang terlebih dahulu!", "error"); return; }
    const rating = parseInt(ratingEl.value);
    const comment = commentEl.value.trim();
    if (!comment) { showToast("Mohon isi komentar Anda.", "error"); return; }

    try {
        const docRef = doc(db, "reports", ticketId);
        await updateDoc(docRef, { feedback: { rating, comment, createdAt: new Date() } });
        showToast("Terima kasih atas ulasan Anda!", "success");
        window.handleTrack();
    } catch (err) {
        showToast("Gagal mengirim ulasan.", "error");
    }
};

function compressImage(file, quality = 0.7, maxWidth = 1200, maxHeight = 1200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width, height = img.height;
                if (width > height && width > maxWidth) { height = Math.round(height *= maxWidth / width); width = maxWidth; }
                else if (height > maxHeight) { width = Math.round(width *= maxHeight / height); height = maxHeight; }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', quality);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');
hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    hamburger.classList.toggle('active', isOpen);
});
mobileNav.querySelectorAll('a, button').forEach(el => el.addEventListener('click', () => { mobileNav.classList.remove('open'); hamburger.classList.remove('active'); }));

const modal = document.getElementById('modal');
window.openModal = function (type) {
    const panelUser = document.getElementById('panel-user');
    const panelLapor = document.getElementById('panel-lapor');
    modal.classList.add('open');
    if (type === 'lapor') { panelUser.style.display = 'none'; panelLapor.style.display = 'block'; updateLaporPanel(); }
    else { panelUser.style.display = 'block'; panelLapor.style.display = 'none'; switchTab(type === 'daftar' ? 'daftar' : 'masuk'); }
};

function updateLaporPanel() {
    if (currentUser) {
        document.getElementById('lapor-mode-tabs').style.display = 'none';
        document.getElementById('lapor-logged-info').style.display = 'block';
        document.getElementById('form-anon-fields').style.display = 'none';
        document.getElementById('lapor-chip-name').textContent = currentUser.displayName || 'Pengguna';
        document.getElementById('lapor-chip-email').textContent = currentUser.email;
        document.getElementById('lapor-chip-avatar').textContent = (currentUser.displayName || 'U').charAt(0).toUpperCase();
        laporMode = 'akun';
    } else {
        document.getElementById('lapor-mode-tabs').style.display = 'flex';
        document.getElementById('lapor-logged-info').style.display = 'none';
        switchLaporMode('anon');
    }
}

window.switchLaporMode = function (mode) {
    laporMode = mode;
    document.getElementById('form-anon-fields').style.display = mode === 'anon' ? 'block' : 'none';
    document.getElementById('btn-mode-akun').classList.toggle('active', mode === 'akun');
    document.getElementById('btn-mode-anon').classList.toggle('active', mode === 'anon');
};

window.closeModal = function () { modal.classList.remove('open'); };
window.handleOverlayClick = function (e) { if (e.target === modal) window.closeModal(); };
window.switchTab = function (tab) {
    const isMasuk = tab === 'masuk';
    document.getElementById('tab-masuk').classList.toggle('active', isMasuk);
    document.getElementById('tab-daftar').classList.toggle('active', !isMasuk);
    document.getElementById('form-masuk').style.display = isMasuk ? 'block' : 'none';
    document.getElementById('form-daftar').style.display = isMasuk ? 'none' : 'block';
};

function showError(inputEl, msg) {
    if (!inputEl) return;
    inputEl.classList.add('input-error');
    let errEl = inputEl.parentElement.querySelector('.field-error') || document.createElement('p');
    errEl.className = 'field-error'; errEl.textContent = msg;
    inputEl.parentElement.appendChild(errEl);
}
function clearAllErrors() { document.querySelectorAll('.input-error').forEach(el => { el.classList.remove('input-error'); el.parentElement.querySelector('.field-error')?.remove(); }); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function setLoadingState(btnId, loading, text = "Memuat...") {
    const btn = document.getElementById(btnId); if (!btn) return;
    btn.disabled = loading; if (loading) { btn.dataset.originalText = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span> ${text}`; }
    else { btn.innerHTML = btn.dataset.originalText || btn.textContent; }
}
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div');
    toast.className = `toast toast-${type}`; toast.innerText = message; container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-leaving'); setTimeout(() => toast.remove(), 400); }, 4000);
}

function generateTicketId() { return `#LAP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`; }

function initRealtimeStats() {
    onSnapshot(collection(db, "reports"), (snapshot) => {
        let total = snapshot.size, selesai = 0;
        snapshot.forEach((doc) => { if (doc.data().status === "Selesai") selesai++; });
        const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;

        const elTotalHero = document.querySelector('.stat-number[data-stat="total"]');
        const elPctHero = document.querySelector('.stat-number[data-stat="pct"]');
        if (elTotalHero) elTotalHero.innerHTML = `${total}<span>+</span>`;
        if (elPctHero) elPctHero.innerHTML = `${pct}<span>%</span>`;

        document.getElementById('stat-bottom-total').innerText = total;
        document.getElementById('stat-bottom-pct').innerText = `${pct}%`;
    });
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const deskNav = document.getElementById('desktop-auth-container');
    if (user) {
        deskNav.innerHTML = `<span>Hi, ${user.displayName || 'User'}!</span><button class="btn btn-ghost btn-sm btn-logout">Keluar</button>`;
        deskNav.querySelector('.btn-logout').addEventListener('click', () => signOut(auth));
    } else {
        deskNav.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="openModal('login')">Masuk</button><button class="btn btn-primary btn-sm magnetic" onclick="openModal('lapor')">Mulai Lapor</button>`;
    }
});

document.getElementById('btn-google-login')?.addEventListener('click', async () => {
    try { await signInWithPopup(auth, googleProvider); window.closeModal(); } catch (err) { showToast("Gagal Login Google", "error"); }
});

document.getElementById('btn-masuk').addEventListener('click', async () => {
    const emailEl = document.getElementById('masuk-email'), passEl = document.getElementById('masuk-password');
    try { await signInWithEmailAndPassword(auth, emailEl.value, passEl.value); window.closeModal(); } catch (err) { showError(passEl, "Kredensial salah."); }
});

document.getElementById('btn-daftar').addEventListener('click', async () => {
    const namaEl = document.getElementById('daftar-nama'), emailEl = document.getElementById('daftar-email'), passEl = document.getElementById('daftar-password');
    try { const cred = await createUserWithEmailAndPassword(auth, emailEl.value, passEl.value); await updateProfile(cred.user, { displayName: namaEl.value }); window.closeModal(); } catch (err) { showToast("Gagal mendaftar.", "error"); }
});

const fotoInput = document.getElementById('lapor-foto'), previewContainer = document.getElementById('preview-container'), fotoPreview = document.getElementById('foto-preview');
fotoInput.addEventListener('change', function () {
    if (this.files[0]) { const reader = new FileReader(); reader.onload = e => { fotoPreview.src = e.target.result; previewContainer.style.display = 'block'; }; reader.readAsDataURL(this.files[0]); }
});
document.getElementById('hapus-foto').addEventListener('click', () => { fotoInput.value = ''; previewContainer.style.display = 'none'; });

document.getElementById('btn-submit-laporan').addEventListener('click', async () => {
    const katEl = document.getElementById('lapor-kategori'), lokEl = document.getElementById('lapor-lokasi'), desEl = document.getElementById('lapor-deskripsi');
    let rName = currentUser?.displayName || document.getElementById('anon-nama').value, rEmail = currentUser?.email || document.getElementById('anon-email').value || "anon@lapor.com";

    setLoadingState('btn-submit-laporan', true, "Menyimpan...");
    try {
        const ticketId = generateTicketId();
        await addDoc(collection(db, "reports"), {
            reportId: ticketId, reporterInfo: { name: rName, email: rEmail, isAnonymous: !currentUser },
            content: { category: katEl.value, location: lokEl.value, description: desEl.value, imageUrl: "" },
            status: "Menunggu", metadata: { createdAt: serverTimestamp() }
        });
        document.getElementById('lapor-form-wrapper').style.display = 'none';
        document.getElementById('lapor-success-screen').style.display = 'block';
        document.getElementById('success-ticket-id').innerText = ticketId;
        if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

        katEl.value = ''; lokEl.value = ''; desEl.value = '';
        const targetAnonNama = document.getElementById('anon-nama'), targetAnonEmail = document.getElementById('anon-email');
        if (targetAnonNama) targetAnonNama.value = ''; if (targetAnonEmail) targetAnonEmail.value = '';
        clearAllErrors();
    } catch (err) { showToast("Gagal mengirim laporan", "error"); } finally { setLoadingState('btn-submit-laporan', false); }
});

window.handleTrack = async function () {
    const input = document.getElementById('trackInput'), resultEl = document.getElementById('trackResult');
    const q = query(collection(db, "reports"), where("reportId", "==", input.value.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) { document.getElementById('trackNotFound').style.display = 'block'; return; }
    resultEl.style.display = 'block'; resultEl.innerHTML = '';
    snap.forEach(docSnap => {
        const d = docSnap.data();
        resultEl.innerHTML = `<div class="track-result-card"><h3>📋 Tiket: ${d.reportId}</h3><p>Status: <b>${d.status}</b></p><p>Lokasi: ${d.content.location}</p></div>`;
    });
};

initRealtimeStats();
window.copyTicketId = function () { navigator.clipboard.writeText(document.getElementById('success-ticket-id').innerText); showToast("Disalin!"); };