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
    getCountFromServer,
    onSnapshot,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
//   STATE
// ============================================================
let currentUser = null;
let laporMode = 'akun'; // 'akun' | 'anon'
const googleProvider = new GoogleAuthProvider();

// ============================================================
//   NAVBAR SCROLL
// ============================================================
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 20) navbar?.classList.add('scrolled');
    else navbar?.classList.remove('scrolled');
});

// ============================================================
//   FEEDBACK & RATING
// ============================================================
window.submitFeedback = async function(ticketId) {
    const ratingEl = document.querySelector(`input[name="rating-${ticketId}"]:checked`);
    const commentEl = document.getElementById(`comment-${ticketId}`);
    if (!ratingEl) {
        showToast("Pilih rating bintang terlebih dahulu!", "error");
        return;
    }
    const rating = parseInt(ratingEl.value);
    const comment = commentEl.value.trim();
    if (!comment) {
        showToast("Mohon isi komentar Anda.", "error");
        return;
    }

    try {
        const docRef = doc(db, "reports", ticketId);
        await updateDoc(docRef, {
            feedback: { rating, comment, createdAt: new Date() }
        });
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
                let width = img.width;
                let height = img.height;
                if (width > height && width > maxWidth) {
                    height = Math.round((height *= maxWidth / width));
                    width = maxWidth;
                } else if (height > maxHeight) {
                    width = Math.round((width *= maxHeight / height));
                    height = maxHeight;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
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

// ============================================================
//   HAMBURGER
// ============================================================
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');
hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    hamburger.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
});
mobileNav.querySelectorAll('a, button').forEach(el => el.addEventListener('click', closeMobileNav));
function closeMobileNav() {
    mobileNav.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================================
//   MODAL
// ============================================================
const modal = document.getElementById('modal');
let previouslyFocused = null;
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

window.openModal = function (type) {
    previouslyFocused = document.activeElement;
    const panelUser = document.getElementById('panel-user');
    const panelLapor = document.getElementById('panel-lapor');

    modal.classList.add('open');
    modal.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    closeMobileNav();
    clearAllErrors();

    if (type === 'lapor') {
        panelUser.style.display = 'none';
        panelLapor.style.display = 'block';
        updateLaporPanel();
    } else if (type === 'login' || type === 'daftar' || type === 'masuk') {
        panelUser.style.display = 'block';
        panelLapor.style.display = 'none';
        switchTab(type === 'daftar' ? 'daftar' : 'masuk');
    }

    requestAnimationFrame(() => {
        const focusable = modal.querySelectorAll(FOCUSABLE);
        if (focusable.length) focusable[0].focus();
    });
};

function updateLaporPanel() {
    const modeTabs = document.getElementById('lapor-mode-tabs');
    const loggedInfo = document.getElementById('lapor-logged-info');
    const anonFields = document.getElementById('form-anon-fields');

    if (currentUser) {
        modeTabs.style.display = 'none';
        loggedInfo.style.display = 'block';
        anonFields.style.display = 'none';
        document.getElementById('lapor-chip-name').textContent = currentUser.displayName || 'Pengguna';
        document.getElementById('lapor-chip-email').textContent = currentUser.email;
        document.getElementById('lapor-chip-avatar').textContent = (currentUser.displayName || 'U').charAt(0).toUpperCase();
        laporMode = 'akun';
    } else {
        modeTabs.style.display = 'flex';
        loggedInfo.style.display = 'none';
        switchLaporMode('anon');
    }
}

window.switchLaporMode = function(mode) {
    laporMode = mode;
    const anonFields = document.getElementById('form-anon-fields');
    const btnAkun = document.getElementById('btn-mode-akun');
    const btnAnon = document.getElementById('btn-mode-anon');
    const indicator = document.getElementById('lapor-mode-indicator');
    if (indicator) indicator.style.transform = mode === 'akun' ? 'translateX(0)' : 'translateX(100%)';

    btnAkun.classList.toggle('active', mode === 'akun');
    btnAnon.classList.toggle('active', mode === 'anon');

    if (mode === 'anon') {
        anonFields.style.display = 'block';
    } else {
        anonFields.style.display = 'none';
        if (!currentUser) {
            const panelUser = document.getElementById('panel-user');
            const panelLapor = document.getElementById('panel-lapor');
            panelUser.style.display = 'block';
            panelLapor.style.display = 'none';
            switchTab('masuk');
            showToast("Masuk ke akun terlebih dahulu untuk lapor dengan akun.", "error");
        }
    }
};

window.closeModal = function () {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
    }
};

window.handleOverlayClick = function (e) {
    if (e.target === modal) window.closeModal();
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) window.closeModal();
});

window.switchTab = function (tab) {
    const isMasuk = tab === 'masuk';
    const indicator = document.getElementById('tab-indicator');
    if (indicator) indicator.style.transform = isMasuk ? 'translateX(0)' : 'translateX(100%)';
    document.getElementById('tab-masuk').classList.toggle('active', isMasuk);
    document.getElementById('tab-daftar').classList.toggle('active', !isMasuk);
    document.getElementById('form-masuk').style.display = isMasuk ? 'block' : 'none';
    document.getElementById('form-daftar').style.display = isMasuk ? 'none' : 'block';
    clearAllErrors();
};

// ============================================================
//   FORM VALIDATION HELPERS
// ============================================================
function showError(inputEl, msg) {
    inputEl.classList.add('input-error');
    let errEl = inputEl.parentElement.querySelector('.field-error');
    if (!errEl) {
        errEl = document.createElement('p');
        errEl.className = 'field-error';
        errEl.style.fontSize = '12px';
        errEl.style.color = 'var(--color-danger)';
        errEl.style.marginTop = '4px';
        inputEl.parentElement.appendChild(errEl);
    }
    errEl.textContent = msg;
}

function clearError(inputEl) {
    inputEl.classList.remove('input-error');
    const errEl = inputEl.parentElement.querySelector('.field-error');
    if (errEl) errEl.remove();
}

function clearAllErrors() {
    document.querySelectorAll('.input-error').forEach(el => clearError(el));
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', () => clearError(input));
});

// ============================================================
//   UI HELPERS
// ============================================================
function setLoadingState(btnId, loading, text = "Memuat...") {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = `<span class="spinner"></span> ${text}`;
    } else {
        btn.innerHTML = btn.dataset.originalText || btn.textContent;
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-leaving');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ============================================================
//   GENERATE TICKET ID
// ============================================================
function generateTicketId() {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `#LAP-${year}-${timestamp}${suffix}`;
}

// ============================================================
//   HERO & BOTTOM STATS (REAL-TIME)
// ============================================================
function initRealtimeStats() {
    const reportsRef = collection(db, "reports");

    onSnapshot(reportsRef, (snapshot) => {
        let total = snapshot.size;
        let selesai = 0;

        snapshot.forEach((doc) => {
            if (doc.data().status === "Selesai") {
                selesai++;
            }
        });

        const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;

        const elTotalHero = document.querySelector('.stat-number[data-stat="total"]');
        const elPctHero = document.querySelector('.stat-number[data-stat="pct"]');
        
        let displayTotalHero = total > 999 ? (total / 1000).toFixed(1) + 'K' : total;
        if (elTotalHero && elTotalHero.innerText !== `${displayTotalHero}+`) {
            elTotalHero.innerHTML = `${displayTotalHero}<span>+</span>`;
            triggerUpdateAnim(elTotalHero);
        }
        
        if (elPctHero && elPctHero.innerText !== `${pct}%`) {
            elPctHero.innerHTML = `${pct}<span>%</span>`;
            triggerUpdateAnim(elPctHero);
        }

        const elTotalBottom = document.getElementById('stat-bottom-total');
        const elPctBottom = document.getElementById('stat-bottom-pct');
        
        let displayTotalBottom = total > 999 ? (total / 1000).toFixed(1) + 'K+' : total;
        if (elTotalBottom && elTotalBottom.innerText !== displayTotalBottom.toString()) {
            elTotalBottom.innerText = displayTotalBottom;
            triggerUpdateAnim(elTotalBottom);
        }
        
        if (elPctBottom && elPctBottom.innerText !== `${pct}%`) {
            elPctBottom.innerText = `${pct}%`;
            triggerUpdateAnim(elPctBottom);
        }
    }, (error) => {
});
}

function triggerUpdateAnim(element) {
    element.classList.remove('update-anim');
    void element.offsetWidth;
    element.classList.add('update-anim');
}

// ============================================================
//   AUTH STATE
// ============================================================
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const deskNav = document.getElementById('desktop-auth-container');
    const mobNav = document.getElementById('mobile-auth-container');

    if (user) {
        const displayName = user.displayName || 'User';
        const loggedInHtml = `
            <span style="font-size:13px; font-weight:bold; margin-right:8px; color: var(--neutral-700);">Hi, ${displayName.split(' ')[0]}! 👋</span>
            <button class="btn btn-primary btn-sm" onclick="openModal('lapor')">Buat Laporan</button>
            <button class="btn btn-ghost btn-sm btn-logout" style="border-color:var(--color-danger); color:var(--color-danger)">Keluar</button>
        `;
        deskNav.innerHTML = loggedInHtml;
        mobNav.innerHTML = loggedInHtml.replace(/btn-sm/g, 'btn-md');
        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.addEventListener('click', () => signOut(auth));
        });
    } else {
        const loggedOutHtml = `
            <button class="btn btn-ghost btn-sm" onclick="openModal('login')">Masuk</button>
            <button class="btn btn-primary btn-sm" onclick="openModal('lapor')">Mulai Lapor</button>
        `;
        deskNav.innerHTML = loggedOutHtml;
        mobNav.innerHTML = loggedOutHtml.replace(/btn-sm/g, 'btn-md');
    }
});

// ============================================================
//   GOOGLE LOGIN
// ============================================================
let isGoogleLoginPending = false;
async function handleGoogleLogin(e) {
    if (e) e.preventDefault();
    if (isGoogleLoginPending) return; // Mencegah double click
    
    if (window.location.protocol === 'file:') {
        showToast("Google Login butuh web server (localhost/http). Jangan buka file HTML langsung.", "error");
        return;
    }
    
    isGoogleLoginPending = true;
    try {
        const result = await signInWithPopup(auth, googleProvider);
        showToast(`Selamat datang, ${result.user.displayName}!`);
        window.closeModal();
    } catch (error) {
// Abaikan jika user menutup popup secara manual atau double click (cancelled)
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            showToast(`Gagal: ${error.message}`, "error");
        }
    } finally {
        isGoogleLoginPending = false;
    }
}
document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleLogin);
document.getElementById('btn-google-reg')?.addEventListener('click', handleGoogleLogin);

// ============================================================
//   LOGIN & REGISTER FORM
// ============================================================
document.getElementById('btn-masuk').addEventListener('click', async () => {
    const emailEl = document.getElementById('masuk-email');
    const passEl = document.getElementById('masuk-password');
    let valid = true;
    if (!emailEl.value.trim()) { showError(emailEl, 'Email wajib diisi.'); valid = false; }
    else if (!isValidEmail(emailEl.value.trim())) { showError(emailEl, 'Format email tidak valid.'); valid = false; }
    if (!passEl.value) { showError(passEl, 'Password wajib diisi.'); valid = false; }
    if (valid) {
        setLoadingState('btn-masuk', true, "Verifikasi...");
        try {
            await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
            showToast("Berhasil masuk.");
            window.closeModal();
        } catch (err) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                showError(passEl, 'Email atau password salah.');
            } else if (err.code === 'auth/too-many-requests') {
                showError(emailEl, 'Terlalu banyak percobaan. Coba lagi nanti.');
            } else {
                showError(passEl, 'Terjadi kesalahan. Coba lagi.');
            }
        } finally {
            setLoadingState('btn-masuk', false);
        }
    }
});

document.getElementById('btn-daftar').addEventListener('click', async () => {
    const namaEl = document.getElementById('daftar-nama');
    const emailEl = document.getElementById('daftar-email');
    const passEl = document.getElementById('daftar-password');
    const konfEl = document.getElementById('daftar-konfirmasi');
    let valid = true;
    if (!namaEl.value.trim()) { showError(namaEl, 'Nama wajib diisi.'); valid = false; }
    else if (namaEl.value.trim().length < 2) { showError(namaEl, 'Nama minimal 2 karakter.'); valid = false; }
    if (!emailEl.value.trim()) { showError(emailEl, 'Email wajib diisi.'); valid = false; }
    else if (!isValidEmail(emailEl.value.trim())) { showError(emailEl, 'Format email tidak valid.'); valid = false; }
    if (!passEl.value) { showError(passEl, 'Password wajib diisi.'); valid = false; }
    else if (passEl.value.length < 8) { showError(passEl, 'Password minimal 8 karakter.'); valid = false; }
    if (!konfEl.value) { showError(konfEl, 'Konfirmasi wajib diisi.'); valid = false; }
    else if (konfEl.value !== passEl.value) { showError(konfEl, 'Password tidak cocok.'); valid = false; }
    if (valid) {
        setLoadingState('btn-daftar', true, "Membuat akun...");
        try {
            const userCred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
            await updateProfile(userCred.user, { displayName: namaEl.value.trim() });
            showToast("Pendaftaran berhasil. Selamat datang!");
            window.closeModal();
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') { showError(emailEl, 'Email sudah terdaftar. Coba masuk.'); }
            else if (err.code === 'auth/weak-password') { showError(passEl, 'Password terlalu lemah.'); }
            else { showError(emailEl, 'Gagal mendaftar. Coba lagi.'); }
        } finally {
            setLoadingState('btn-daftar', false);
        }
    }
});

// ============================================================
//   IMAGE PREVIEW LOGIC
// ============================================================
const fotoInput = document.getElementById('lapor-foto');
const previewContainer = document.getElementById('preview-container');
const fotoPreview = document.getElementById('foto-preview');
const btnHapusFoto = document.getElementById('hapus-foto');

fotoInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            fotoPreview.src = e.target.result;
            previewContainer.style.display = 'block';
        }
        reader.readAsDataURL(file);
    } else {
        previewContainer.style.display = 'none';
    }
});

btnHapusFoto.addEventListener('click', function() {
    fotoInput.value = '';
    previewContainer.style.display = 'none';
});

// ============================================================
//   SUBMIT LAPORAN
// ============================================================
document.getElementById('btn-submit-laporan').addEventListener('click', async () => {
    const katEl = document.getElementById('lapor-kategori');
    const lokEl = document.getElementById('lapor-lokasi');
    const desEl = document.getElementById('lapor-deskripsi');
    const fotoEl = document.getElementById('lapor-foto');
    const fileInput = fotoEl.files[0];

    let reporterName, reporterEmail, reporterUid;

    if (currentUser) {
        reporterName = currentUser.displayName || "Pengguna";
        reporterEmail = currentUser.email;
        reporterUid = currentUser.uid;
    } else if (laporMode === 'anon') {
        const anonNamaEl = document.getElementById('anon-nama');
        const anonEmailEl = document.getElementById('anon-email');
        let valid = true;
        if (!anonNamaEl.value.trim()) { showError(anonNamaEl, 'Nama wajib diisi.'); valid = false; }
        if (anonEmailEl.value.trim() && !isValidEmail(anonEmailEl.value.trim())) {
            showError(anonEmailEl, 'Format email tidak valid.'); valid = false;
        }
        if (!valid) return;
        reporterName = anonNamaEl.value.trim();
        reporterEmail = anonEmailEl.value.trim() || "anonim@noemail.com";
        reporterUid = "anonymous";
    } else {
        showToast("Masuk ke akun terlebih dahulu.", "error");
        return;
    }

    let valid = true;
    if (!katEl.value) { showToast("Pilih kategori kerusakan terlebih dahulu.", "error"); valid = false; }
    if (!lokEl.value.trim()) { showError(lokEl, 'Lokasi wajib diisi.'); valid = false; }
    if (!desEl.value.trim()) { showError(desEl, 'Deskripsi wajib diisi.'); valid = false; }
    else if (desEl.value.trim().length < 10) { showError(desEl, 'Deskripsi terlalu singkat (min. 10 karakter).'); valid = false; }
    if (fileInput) {
        const maxSize = 5 * 1024 * 1024;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(fileInput.type)) { showError(fotoEl, 'Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.'); valid = false; }
        else if (fileInput.size > maxSize) { showError(fotoEl, 'Ukuran file maksimal 5MB.'); valid = false; }
    }
    if (!valid) return;

    setLoadingState('btn-submit-laporan', true, "Menyimpan...");
    const btnSubmit = document.getElementById('btn-submit-laporan');
    const originalBtnContent = btnSubmit.innerHTML;

    try {
        let imgUrl = "";
        if (fileInput) {
            setLoadingState('btn-submit-laporan', true, "Mengompresi Gambar...");
            const compressedFile = await compressImage(fileInput);
            
            setLoadingState('btn-submit-laporan', true, "Mengunggah Gambar...");
            const cloudName = "dyfc0i8y5";
            const uploadPreset = "PictLaporin";
            const formData = new FormData();
            formData.append('file', compressedFile);
            formData.append('upload_preset', uploadPreset);
            const cloudResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
            const cloudData = await cloudResp.json();
            if (cloudData.error) throw new Error(`Upload foto gagal: ${cloudData.error.message}`);
            imgUrl = cloudData.secure_url;
            setLoadingState('btn-submit-laporan', true, "Menyimpan Data...");
        }

        const ticketId = generateTicketId();
        await addDoc(collection(db, "reports"), {
            reportId: ticketId,
            reporterInfo: {
                name: reporterName,
                email: reporterEmail,
                uid: reporterUid,
                isAnonymous: reporterUid === "anonymous"
            },
            content: {
                category: katEl.value,
                location: lokEl.value.trim(),
                description: desEl.value.trim(),
                imageUrl: imgUrl
            },
            status: "Menunggu",
            estimasiBiaya: null,
            metadata: {
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }
        });

        // Show Success Screen instead of closing
        document.getElementById('lapor-form-wrapper').style.display = 'none';
        document.getElementById('lapor-success-screen').style.display = 'block';
        document.getElementById('success-ticket-id').innerText = ticketId;
        
        katEl.value = '';
        lokEl.value = '';
        desEl.value = '';
        fotoEl.value = '';
        if (anonNama) anonNama.value = '';
        if (anonEmail) anonEmail.value = '';
        clearAllErrors();
        document.getElementById('preview-container').style.display = 'none';
        btnSubmit.innerHTML = originalBtnContent;
    } catch (err) {
showToast(err.message || "Gagal mengirim laporan. Coba lagi.", "error");
        btnSubmit.innerHTML = originalBtnContent;
    } finally {
        setLoadingState('btn-submit-laporan', false);
    }
});

// ============================================================
//   TRACKING LAPORAN
// ============================================================
window.handleTrack = async function () {
    const input = document.getElementById('trackInput');
    const errorEl = document.getElementById('trackError');
    const notfoundEl = document.getElementById('trackNotFound');
    const resultEl = document.getElementById('trackResult');

    let val = input.value.trim();
    resultEl.style.display = 'none';
    errorEl.style.display = 'none';
    notfoundEl.style.display = 'none';
    input.classList.remove('input-error');

    if (!val) {
        input.classList.add('input-error');
        errorEl.style.display = 'block';
        return;
    }
    if (val.includes('@') && !isValidEmail(val)) {
        input.classList.add('input-error');
        errorEl.textContent = '⚠️ Format email tidak valid.';
        errorEl.style.display = 'block';
        return;
    }

    setLoadingState('btn-track', true, "Mencari Database...");
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
        <div class="track-result-card skeleton" style="border-radius:var(--radius-xl); padding:var(--space-6); background: white; border: 1px solid var(--neutral-150);">
            <div style="height: 24px; margin-bottom: 16px; width: 60%; background: #e4e4e7; border-radius: 4px;"></div>
            <div style="height: 16px; margin-bottom: 12px; width: 80%; background: #e4e4e7; border-radius: 4px;"></div>
            <div style="height: 16px; margin-bottom: 24px; width: 50%; background: #e4e4e7; border-radius: 4px;"></div>
            <div style="height: 60px; width: 100%; background: #e4e4e7; border-radius: 8px;"></div>
        </div>
    `;
    try {
        let q;
        if (val.includes('@')) {
            q = query(collection(db, "reports"), where("reporterInfo.email", "==", val.toLowerCase()));
        } else {
            val = val.toUpperCase();
            if (!val.startsWith('#')) val = '#' + val;
            q = query(collection(db, "reports"), where("reportId", "==", val));
        }

        const snap = await getDocs(q);
        if (snap.empty) {
            notfoundEl.style.display = 'block';
        } else {
            resultEl.innerHTML = '';
            snap.forEach(docSnap => {
                const d = docSnap.data();
                let statusColor, statusBg, statusIcon, statusLabel;
                switch (d.status) {
                    case 'Selesai':
                        statusColor = '#15803d'; statusBg = '#f0fdf4'; statusIcon = '✅'; statusLabel = 'Selesai';
                        break;
                    case 'Diproses':
                        statusColor = '#b45309'; statusBg = '#fffbeb'; statusIcon = '🔧'; statusLabel = 'Sedang Diproses';
                        break;
                    default:
                        statusColor = '#b91c1c'; statusBg = '#fff1f1'; statusIcon = '⏳'; statusLabel = 'Menunggu';
                }

                let tglDibuat = '';
                if (d.metadata?.createdAt?.toDate) {
                    tglDibuat = d.metadata.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                }

                let biayaHtml = '';
                if (d.status === 'Selesai' && d.estimasiBiaya) {
                    const biayaFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(d.estimasiBiaya);
                    biayaHtml = `
                        <div class="track-result-row track-result-row--cost">
                            <div class="track-result-icon" style="background:#f0fdf4;">💰</div>
                            <div>
                                <div class="track-result-label">Estimasi Biaya Perbaikan</div>
                                <div class="track-result-value" style="color: #15803d; font-size: var(--text-base); font-weight: var(--weight-extrabold);">${biayaFormatted}</div>
                            </div>
                        </div>
                    `;
                } else if (d.status !== 'Selesai') {
                    biayaHtml = `
                        <div class="track-result-row">
                            <div class="track-result-icon" style="background:#fafafa;">💰</div>
                            <div>
                                <div class="track-result-label">Estimasi Biaya Perbaikan</div>
                                <div class="track-result-value" style="color:var(--neutral-400); font-style:italic;">Akan tersedia setelah perbaikan selesai</div>
                            </div>
                        </div>
                    `;
                }

                let feedbackHtml = '';
                if (d.status === 'Selesai') {
                    if (d.feedback) {
                        let stars = '';
                        for(let i=0; i<d.feedback.rating; i++) stars += '★';
                        for(let i=d.feedback.rating; i<5; i++) stars += '☆';
                        feedbackHtml = `
                            <div class="feedback-readonly">
                                <div style="font-size:12px; font-weight:bold; color:var(--neutral-500); margin-bottom:4px; text-transform:uppercase;">Ulasan Anda</div>
                                <div class="feedback-readonly-stars">${stars}</div>
                                <div style="font-size: 13px; color: var(--neutral-700); font-style: italic;">"${d.feedback.comment}"</div>
                            </div>
                        `;
                    } else {
                        feedbackHtml = `
                            <div class="feedback-box">
                                <div class="feedback-title">Beri Ulasan Perbaikan</div>
                                <div class="star-rating">
                                    <input type="radio" id="star5-${docSnap.id}" name="rating-${docSnap.id}" value="5"><label for="star5-${docSnap.id}">★</label>
                                    <input type="radio" id="star4-${docSnap.id}" name="rating-${docSnap.id}" value="4"><label for="star4-${docSnap.id}">★</label>
                                    <input type="radio" id="star3-${docSnap.id}" name="rating-${docSnap.id}" value="3"><label for="star3-${docSnap.id}">★</label>
                                    <input type="radio" id="star2-${docSnap.id}" name="rating-${docSnap.id}" value="2"><label for="star2-${docSnap.id}">★</label>
                                    <input type="radio" id="star1-${docSnap.id}" name="rating-${docSnap.id}" value="1"><label for="star1-${docSnap.id}">★</label>
                                </div>
                                <textarea id="comment-${docSnap.id}" class="form-input" placeholder="Tulis komentar atau masukan Anda..." rows="2" style="margin-bottom:8px;"></textarea>
                                <button class="btn btn-primary btn-sm" onclick="submitFeedback('${docSnap.id}')" style="width:100%;">Kirim Ulasan</button>
                            </div>
                        `;
                    }
                }

                const isAnon = d.reporterInfo?.isAnonymous;
                resultEl.innerHTML += `
                    <div class="track-result-card">
                        <div class="track-result-header">
                            <div>
                                <div class="track-result-ticket">${d.reportId}</div>
                                ${tglDibuat ? `<div class="track-result-date">🗓 Dilaporkan: ${tglDibuat}</div>` : ''}
                            </div>
                            <div class="track-result-status" style="background:${statusBg}; color:${statusColor}; border-color: ${statusColor}30;">
                                ${statusIcon} ${statusLabel}
                            </div>
                        </div>
                        <div class="track-result-body">
                            <div class="track-result-row">
                                <div class="track-result-icon">📍</div>
                                <div>
                                    <div class="track-result-label">Lokasi</div>
                                    <div class="track-result-value">${d.content.location}</div>
                                </div>
                            </div>
                            <div class="track-result-row">
                                <div class="track-result-icon">🔧</div>
                                <div>
                                    <div class="track-result-label">Kategori</div>
                                    <div class="track-result-value">${d.content.category}</div>
                                </div>
                            </div>
                            <div class="track-result-row">
                                <div class="track-result-icon">👤</div>
                                <div>
                                    <div class="track-result-label">Pelapor</div>
                                    <div class="track-result-value">${d.reporterInfo.name} ${isAnon ? '<span style="font-size:10px;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#64748b;">Anonim</span>' : ''}</div>
                                </div>
                            </div>
                            ${biayaHtml}
                        </div>
                        <div class="track-progress">
                            <div class="track-progress-step ${['Menunggu','Diproses','Selesai'].includes(d.status) ? 'done' : ''}">
                                <div class="track-progress-dot ${d.status === 'Menunggu' ? 'active' : ((['Diproses','Selesai'].includes(d.status)) ? 'done' : '')}"></div>
                                <span>Dikirim</span>
                            </div>
                            <div class="track-progress-line ${['Diproses','Selesai'].includes(d.status) ? 'done' : ''}"></div>
                            <div class="track-progress-step">
                                <div class="track-progress-dot ${d.status === 'Diproses' ? 'active' : (d.status === 'Selesai' ? 'done' : '')}"></div>
                                <span>Diproses</span>
                            </div>
                            <div class="track-progress-line ${d.status === 'Selesai' ? 'done' : ''}"></div>
                            <div class="track-progress-step">
                                <div class="track-progress-dot ${d.status === 'Selesai' ? 'done' : ''}"></div>
                                <span>Selesai</span>
                            </div>
                        </div>
                        ${feedbackHtml}
                    </div>
                `;
            });
            resultEl.style.display = 'block';
        }
    } catch (e) {
        showToast("Gagal mengambil data dari server.", "error");
} finally {
        setLoadingState('btn-track', false);
    }
};

document.getElementById('trackInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.handleTrack();
});

// ============================================================
//   PREMIUM MICRO-INTERACTIONS & OBSERVERS
// ============================================================

// --- 1. Ripple Effect for Buttons ---
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        if (this.disabled) return;
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        // Calculate max distance to corner for proper ripple size
        const w = this.clientWidth, h = this.clientHeight;
        const size = Math.max(w, h) * 1.5;
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.marginLeft = ripple.style.marginTop = `${-size/2}px`;
        
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
});

// --- 2. Advanced Intersection Observer (Reveal Animations) ---
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal-active');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal-up, .reveal-scale, .reveal-blur').forEach(el => {
    revealObserver.observe(el);
});

// --- 3. Magnetic Hover & 3D Tilt Effect ---
const categoryCards = document.querySelectorAll('.category-card, .step-card, .feature-small');
categoryCards.forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        const tiltX = (y - 0.5) * -16;
        const tiltY = (x - 0.5) * 16;
        
        card.style.transition = 'none';
        card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.5s var(--ease-spring)';
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
});

// --- 4. Modal Blur Backdrop Transition ---
if (modal) {
    const originalOpenModal = window.openModal;
    window.openModal = function(type) {
        const res = originalOpenModal(type);
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
        return res;
    };
    
    const originalCloseModal = window.closeModal;
    window.closeModal = function() {
        modal.style.opacity = '0';
        setTimeout(() => originalCloseModal(), 400);
    };
}

// ============================================================
//   INIT
// ============================================================
initRealtimeStats();
window.copyTicketId = function() {
    const ticketId = document.getElementById('success-ticket-id').innerText;
    navigator.clipboard.writeText(ticketId).then(() => {
        showToast("✅ Nomor Tiket disalin ke clipboard!");
    }).catch(err => {
        showToast("Gagal menyalin tiket.", "error");
    });
};


// Preloader Logic
window.addEventListener('load', () => {
    const preloader = document.getElementById('page-preloader');
    if (preloader) {
        // Add a slight delay for aesthetic purposes so the bar animation finishes
        setTimeout(() => {
            preloader.classList.add('fade-out');
        }, 500);
    }
});


/* ==========================================================================
   CUSTOM CURSOR & MAGNETIC BUTTONS LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Scroll Progress Bar
    const scrollProgress = document.getElementById('scroll-progress');
    if (scrollProgress) {
        window.addEventListener('scroll', () => {
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollPercent = (scrollTop / scrollHeight) * 100;
            scrollProgress.style.width = scrollPercent + '%';
        });
    }

    // Check if device supports hover (desktop)
    if (window.matchMedia("(min-width: 1024px) and (hover: hover)").matches) {
        // 2. Custom Cursor
        const cursor = document.getElementById('custom-cursor');
        const follower = document.getElementById('custom-cursor-follower');
        
        let mouseX = 0, mouseY = 0;
        let followerX = 0, followerY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            // Immediate update for the dot
            if(cursor) {
                cursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
            }
        });

        // Smooth trailing for the follower
        function animateFollower() {
            followerX += (mouseX - followerX) * 0.45; // reduced delay
            followerY += (mouseY - followerY) * 0.45;
            
            if(follower) {
                follower.style.transform = `translate3d(${followerX}px, ${followerY}px, 0) translate(-50%, -50%)`;
            }
            requestAnimationFrame(animateFollower);
        }
        animateFollower();

        // Add hover effects to interactable elements
        const interactables = document.querySelectorAll('a, button, input, select, textarea, .category-card-img, .logo');
        interactables.forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
        });

        // Hide cursor when it leaves window
        document.addEventListener('mouseleave', () => document.body.classList.add('cursor-hidden'));
        document.addEventListener('mouseenter', () => document.body.classList.remove('cursor-hidden'));

        
        // 4. Progressive Line on Steps
        const steps = document.querySelectorAll('.step-card');
        const progressLine = document.getElementById('progress-line');
        if(steps.length && progressLine) {
            steps.forEach((step, index) => {
                step.addEventListener('mouseenter', () => {
                    const percentage = (index / (steps.length - 1)) * 100;
                    progressLine.style.width = percentage + '%';
                });
                step.addEventListener('mouseleave', () => {
                    progressLine.style.width = '0%';
                });
            });
        }

        // 3. Magnetic Buttons
        const magnetics = document.querySelectorAll('.magnetic');
        magnetics.forEach(btn => {
            // Wrap content in span if not already to parallax text
            if(!btn.querySelector('span')) {
                const inner = btn.innerHTML;
                btn.innerHTML = `<span>${inner}</span>`;
            }
            
            const text = btn.querySelector('span');

            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left; 
                const y = e.clientY - rect.top;
                
                // Calculate pull (max 15px)
                const pullX = (x - rect.width / 2) / (rect.width / 2) * 6;
                const pullY = (y - rect.height / 2) / (rect.height / 2) * 6;
                
                btn.style.transform = `translate(${pullX}px, ${pullY}px)`;
                if(text) text.style.transform = `translate(${pullX * 0.3}px, ${pullY * 0.3}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translate(0px, 0px)';
                if(text) text.style.transform = 'translate(0px, 0px)';
            });
        });
    }
});
