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
window.submitFeedback = async function (ticketId) {
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

window.switchLaporMode = function (mode) {
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
    if (!inputEl) return;
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
    if (!inputEl) return;
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

document.querySelectorAll('.form-input, .form-input-floating').forEach(input => {
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
            <button class="btn btn-primary btn-sm magnetic" onclick="openModal('lapor')">Buat Laporan</button>
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
            <button class="btn btn-primary btn-sm magnetic" onclick="openModal('lapor')">Mulai Lapor</button>
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
    if (isGoogleLoginPending) return;

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
            showError(passEl, 'Email atau password salah.');
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
    if (!emailEl.value.trim()) { showError(emailEl, 'Email wajib diisi.'); valid = false; }
    else if (!isValidEmail(emailEl.value.trim())) { showError(emailEl, 'Format email tidak valid.'); valid = false; }
    if (!passEl.value) { showError(passEl, 'Password wajib diisi.'); valid = false; }
    else if (passEl.value.length < 8) { showError(passEl, 'Password minimal 8 karakter.'); valid = false; }
    if (konfEl.value !== passEl.value) { showError(konfEl, 'Password tidak cocok.'); valid = false; }
    if (valid) {
        setLoadingState('btn-daftar', true, "Membuat akun...");
        try {
            const userCred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
            await updateProfile(userCred.user, { displayName: namaEl.value.trim() });
            showToast("Pendaftaran berhasil!");
            window.closeModal();
        } catch (err) {
            showError(emailEl, 'Gagal mendaftar atau email sudah digunakan.');
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

fotoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            fotoPreview.src = e.target.result;
            previewContainer.style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
});

btnHapusFoto.addEventListener('click', function () {
    fotoInput.value = '';
    previewContainer.style.display = 'none';
});

// ============================================================
//   SUBMIT LAPORAN (SAFE CLOUD INTEGRATION)
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
    }

    let valid = true;
    if (!katEl.value) { showToast("Pilih kategori kerusakan.", "error"); valid = false; }
    if (!lokEl.value.trim()) { showError(lokEl, 'Lokasi wajib diisi.'); valid = false; }
    if (!desEl.value.trim()) { showError(desEl, 'Deskripsi wajib diisi.'); valid = false; }
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
            imgUrl = cloudData.secure_url || "";
        }

        const ticketId = generateTicketId();
        await addDoc(collection(db, "reports"), {
            reportId: ticketId,
            reporterInfo: { name: reporterName, email: reporterEmail, uid: reporterUid, isAnonymous: reporterUid === "anonymous" },
            content: { category: katEl.value, location: lokEl.value.trim(), description: desEl.value.trim(), imageUrl: imgUrl },
            status: "Menunggu",
            estimasiBiaya: null,
            metadata: { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
        });

        document.getElementById('lapor-form-wrapper').style.display = 'none';
        document.getElementById('lapor-success-screen').style.display = 'block';
        document.getElementById('success-ticket-id').innerText = ticketId;

        if (window.confetti) {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }

        katEl.value = ''; lokEl.value = ''; desEl.value = ''; fotoEl.value = '';
        const targetAnonNama = document.getElementById('anon-nama');
        const targetAnonEmail = document.getElementById('anon-email');
        if (targetAnonNama) targetAnonNama.value = '';
        if (targetAnonEmail) targetAnonEmail.value = '';

        clearAllErrors();
        previewContainer.style.display = 'none';
        btnSubmit.innerHTML = originalBtnContent;
    } catch (err) {
        showToast("Gagal menyimpan data laporan.", "error");
    } finally {
        setLoadingState('btn-submit-laporan', false);
    }
});

// ============================================================
//   TRACKING LAPORAN
// ============================================================
window.handleTrack = async function () {
    const input = document.getElementById('trackInput');
    const resultEl = document.getElementById('trackResult');
    let val = input.value.trim();

    if (!val) { showError(input, "Wajib diisi."); return; }
    setLoadingState('btn-track', true, "Mencari...");

    try {
        let q = query(collection(db, "reports"), where("reportId", "==", val.toUpperCase()));
        if (val.includes('@')) {
            q = query(collection(db, "reports"), where("reporterInfo.email", "==", val.toLowerCase()));
        }

        const snap = await getDocs(q);
        if (snap.empty) {
            document.getElementById('trackNotFound').style.display = 'block';
            resultEl.style.display = 'none';
        } else {
            document.getElementById('trackNotFound').style.display = 'none';
            resultEl.innerHTML = '';
            snap.forEach(docSnap => {
                const d = docSnap.data();
                resultEl.innerHTML += `
                    <div class="track-result-card" style="margin-top:16px; padding:16px; border:1px solid var(--neutral-200); border-radius:var(--radius-xl); background:#fff;">
                        <div style="font-weight:bold; color:var(--red-500);">${d.reportId}</div>
                        <div style="font-size:13px; margin-top:6px;"><b>Kategori:</b> ${d.content.category}</div>
                        <div style="font-size:13px;"><b>Lokasi:</b> ${d.content.location}</div>
                        <div style="font-size:13px; margin-bottom:8px;"><b>Status:</b> [${d.status}]</div>
                    </div>`;
            });
            resultEl.style.display = 'block';
        }
    } catch (e) {
        showToast("Error tracking database", "error");
    } finally {
        setLoadingState('btn-track', false);
    }
};

// ============================================================
//   PREMIUM SENSORY & MICRO-INTERACTIONS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Progress Bar Scroll Halaman
    const scrollProgress = document.getElementById('scroll-progress');
    if (scrollProgress) {
        window.addEventListener('scroll', () => {
            const scrollTop = document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            scrollProgress.style.width = (scrollTop / scrollHeight) * 100 + '%';
        });
    }

    // 2. Custom Cursor Bulat Mengkilap Merah
    if (window.matchMedia("(min-width: 1024px) and (hover: hover)").matches) {
        const cursor = document.getElementById('custom-cursor');
        const follower = document.getElementById('custom-cursor-follower');
        let mouseX = 0, mouseY = 0, fX = 0, fY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX; mouseY = e.clientY;
            if (cursor) cursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
        });

        function animateFollower() {
            fX += (mouseX - fX) * 0.45; fY += (mouseY - fY) * 0.45;
            if (follower) follower.style.transform = `translate3d(${fX}px, ${fY}px, 0) translate(-50%, -50%)`;
            requestAnimationFrame(animateFollower);
        }
        animateFollower();

        document.querySelectorAll('a, button, input, select, textarea, .category-card-img').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
        });
    }

    // 3. Efek Ripple Air pada Tombol Utama
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const rect = this.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // 4. Animasi Jalur Garis Progress Step Kerja
    const steps = document.querySelectorAll('.step-card');
    const progressLine = document.getElementById('progress-line');
    if (steps.length && progressLine) {
        steps.forEach((step, idx) => {
            step.addEventListener('mouseenter', () => { progressLine.style.width = (idx / (steps.length - 1)) * 100 + '%'; });
            step.addEventListener('mouseleave', () => { progressLine.style.width = '0%'; });
        });
    }

    // 5. Efek Tombol Mengambang (Magnetic System)
    document.querySelectorAll('.magnetic').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const pullX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2) * 6;
            const pullY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2) * 6;
            btn.style.transform = `translate(${pullX}px, ${pullY}px)`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0px, 0px)'; });
    });
});

window.addEventListener('load', () => { document.getElementById('page-preloader')?.classList.add('fade-out'); });
initRealtimeStats();
window.copyTicketId = function () { navigator.clipboard.writeText(document.getElementById('success-ticket-id').innerText); showToast("Nomor Tiket Disalin!"); };