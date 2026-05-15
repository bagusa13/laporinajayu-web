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
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
//   STATE
// ============================================================
let currentUser = null;
const googleProvider = new GoogleAuthProvider();

// ============================================================
//   NAVBAR SCROLL
// ============================================================
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// ============================================================
//   HAMBURGER MENU
// ============================================================
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');

hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    hamburger.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
});

mobileNav.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', closeMobileNav);
});

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
        if (!currentUser) {
            showToast("Harap Masuk/Daftar terlebih dahulu untuk melapor.", "error");
            type = 'login';
        } else {
            panelUser.style.display = 'none';
            panelLapor.style.display = 'block';
        }
    }

    if (type === 'login' || type === 'daftar' || type === 'masuk') {
        panelUser.style.display = 'block';
        panelLapor.style.display = 'none';
        switchTab(type === 'daftar' ? 'daftar' : 'masuk');
    }

    requestAnimationFrame(() => {
        const focusable = modal.querySelectorAll(FOCUSABLE);
        if (focusable.length) focusable[0].focus();
    });
};

window.closeModal = function () {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (previouslyFocused) previouslyFocused.focus();
};

window.handleOverlayClick = function (e) {
    if (e.target === modal) window.closeModal();
};

// FIX: Tutup modal dengan tombol Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
        window.closeModal();
    }
});

window.switchTab = function (tab) {
    const isMasuk = tab === 'masuk';
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

// FIX: Fungsi isValidEmail sekarang benar-benar digunakan di semua form
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
    setTimeout(() => toast.remove(), 4000);
}

// ============================================================
//   GENERATE TICKET ID YANG UNIK
//   FIX: Tidak lagi pakai random 4 digit yang bisa duplikat.
//   Gunakan timestamp + random suffix untuk kolisi yang sangat kecil.
// ============================================================
function generateTicketId() {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString(36).toUpperCase(); // base-36 dari ms
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 char acak
    return `#LAP-${year}-${timestamp}${suffix}`;
}

// ============================================================
//   STATS DINAMIS DARI FIRESTORE
//   FIX: Statistik di hero section diambil dari DB, bukan hardcoded.
// ============================================================
async function loadHeroStats() {
    try {
        const reportsRef = collection(db, "reports");

        const [totalSnap, selesaiSnap] = await Promise.all([
            getCountFromServer(reportsRef),
            getCountFromServer(query(reportsRef, where("status", "==", "Selesai")))
        ]);

        const total = totalSnap.data().count;
        const selesai = selesaiSnap.data().count;
        const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;

        const elTotal = document.querySelector('.stat-number[data-stat="total"]');
        const elPct = document.querySelector('.stat-number[data-stat="pct"]');

        if (elTotal) elTotal.innerHTML = `${total > 999 ? (total / 1000).toFixed(1) + 'K' : total}<span>+</span>`;
        if (elPct) elPct.innerHTML = `${pct}<span>%</span>`;
    } catch (e) {
        // Jika gagal (misal Firestore rules), biarkan nilai default HTML tetap tampil
        console.warn("Gagal memuat stats:", e.message);
    }
}

// ============================================================
//   AUTH STATE
// ============================================================
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const deskNav = document.getElementById('auth-nav-actions');
    const mobNav = document.getElementById('mobile-auth-actions');

    if (user) {
        const displayName = user.displayName || 'User';
        const loggedInHtml = `
            <span style="font-size:13px; font-weight:bold; margin-right:10px;">Hi, ${displayName}</span>
            <button class="btn btn-primary btn-sm" onclick="openModal('lapor')">Buat Laporan</button>
            <button class="btn btn-ghost btn-sm" id="btn-logout" style="border-color:var(--color-danger); color:var(--color-danger)">Keluar</button>
        `;
        deskNav.innerHTML = loggedInHtml;
        mobNav.innerHTML = loggedInHtml.replace(/btn-sm/g, 'btn-md');

        document.querySelectorAll('#btn-logout').forEach(btn => {
            btn.addEventListener('click', () => signOut(auth));
        });
    } else {
        const loggedOutHtml = `
            <button class="btn btn-ghost btn-sm" onclick="openModal('login')">Masuk</button>
            <button class="btn btn-primary btn-sm" onclick="openModal('daftar')">Mulai Lapor</button>
        `;
        deskNav.innerHTML = loggedOutHtml;
        mobNav.innerHTML = loggedOutHtml.replace(/btn-sm/g, 'btn-md');
    }
});

// ============================================================
//   GOOGLE LOGIN
// ============================================================
async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        showToast(`Selamat datang, ${result.user.displayName}!`);
        window.closeModal();
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
            showToast("Gagal masuk dengan Google.", "error");
        }
    }
}

document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleLogin);
document.getElementById('btn-google-reg')?.addEventListener('click', handleGoogleLogin);

// ============================================================
//   LOGIN FORM
//   FIX: Validasi email format aktif, pesan error lebih jelas.
// ============================================================
document.getElementById('btn-masuk').addEventListener('click', async () => {
    const emailEl = document.getElementById('masuk-email');
    const passEl = document.getElementById('masuk-password');
    let valid = true;

    if (!emailEl.value.trim()) {
        showError(emailEl, 'Email wajib diisi.');
        valid = false;
    } else if (!isValidEmail(emailEl.value.trim())) {
        // FIX: isValidEmail sekarang dipakai di sini
        showError(emailEl, 'Format email tidak valid.');
        valid = false;
    }

    if (!passEl.value) {
        showError(passEl, 'Password wajib diisi.');
        valid = false;
    }

    if (valid) {
        setLoadingState('btn-masuk', true, "Verifikasi...");
        try {
            await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
            showToast("Berhasil masuk.");
            window.closeModal();
        } catch (err) {
            // FIX: Pesan error lebih informatif berdasarkan kode error Firebase
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

// ============================================================
//   REGISTER FORM
//   FIX: Validasi email format, panjang minimum password (8 char).
// ============================================================
document.getElementById('btn-daftar').addEventListener('click', async () => {
    const namaEl = document.getElementById('daftar-nama');
    const emailEl = document.getElementById('daftar-email');
    const passEl = document.getElementById('daftar-password');
    const konfEl = document.getElementById('daftar-konfirmasi');
    let valid = true;

    if (!namaEl.value.trim()) {
        showError(namaEl, 'Nama wajib diisi.');
        valid = false;
    } else if (namaEl.value.trim().length < 2) {
        showError(namaEl, 'Nama minimal 2 karakter.');
        valid = false;
    }

    if (!emailEl.value.trim()) {
        showError(emailEl, 'Email wajib diisi.');
        valid = false;
    } else if (!isValidEmail(emailEl.value.trim())) {
        // FIX: Validasi format email aktif
        showError(emailEl, 'Format email tidak valid.');
        valid = false;
    }

    if (!passEl.value) {
        showError(passEl, 'Password wajib diisi.');
        valid = false;
    } else if (passEl.value.length < 8) {
        // FIX: Minimum panjang password 8 karakter
        showError(passEl, 'Password minimal 8 karakter.');
        valid = false;
    }

    if (!konfEl.value) {
        showError(konfEl, 'Konfirmasi wajib diisi.');
        valid = false;
    } else if (konfEl.value !== passEl.value) {
        showError(konfEl, 'Password tidak cocok.');
        valid = false;
    }

    if (valid) {
        setLoadingState('btn-daftar', true, "Membuat akun...");
        try {
            const userCred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
            await updateProfile(userCred.user, { displayName: namaEl.value.trim() });
            showToast("Pendaftaran berhasil. Selamat datang!");
            window.closeModal();
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                showError(emailEl, 'Email sudah terdaftar. Coba masuk.');
            } else if (err.code === 'auth/weak-password') {
                showError(passEl, 'Password terlalu lemah.');
            } else {
                showError(emailEl, 'Gagal mendaftar. Coba lagi.');
            }
        } finally {
            setLoadingState('btn-daftar', false);
        }
    }
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

    // Validasi per-field
    let valid = true;
    if (!katEl.value) {
        showToast("Pilih kategori kerusakan terlebih dahulu.", "error");
        valid = false;
    }
    if (!lokEl.value.trim()) {
        showError(lokEl, 'Lokasi wajib diisi.');
        valid = false;
    }
    if (!desEl.value.trim()) {
        showError(desEl, 'Deskripsi wajib diisi.');
        valid = false;
    } else if (desEl.value.trim().length < 10) {
        showError(desEl, 'Deskripsi terlalu singkat (min. 10 karakter).');
        valid = false;
    }

    // FIX: Validasi ukuran & tipe file foto
    if (fileInput) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(fileInput.type)) {
            showError(fotoEl, 'Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.');
            valid = false;
        } else if (fileInput.size > maxSize) {
            showError(fotoEl, 'Ukuran file maksimal 5MB.');
            valid = false;
        }
    }

    if (!valid) return;

    setLoadingState('btn-submit-laporan', true, "Menyimpan...");

    try {
        let imgUrl = "";

if (fileInput) {
            const cloudName = "dyfc0i8y5"; 
            const uploadPreset = "PictLaporin"; 
            const formData = new FormData();
            formData.append('file', fileInput);
            formData.append('upload_preset', uploadPreset);

            const cloudResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });

            const cloudData = await cloudResp.json();
            if (cloudData.error) throw new Error(`Upload foto gagal: ${cloudData.error.message}`);
            imgUrl = cloudData.secure_url;
        }
        // FIX: Gunakan generateTicketId() yang unik, bukan random 4 digit
        const ticketId = generateTicketId();

        await addDoc(collection(db, "reports"), {
            reportId: ticketId,
            reporterInfo: {
                name: currentUser.displayName || "Pengguna",
                email: currentUser.email,
                uid: currentUser.uid
            },
            content: {
                category: katEl.value,
                location: lokEl.value.trim(),
                description: desEl.value.trim(),
                imageUrl: imgUrl
            },
            status: "Menunggu",
            metadata: {
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }
        });

        showToast(`✅ Laporan berhasil dikirim! Tiket: ${ticketId}`);

        // Reset form setelah submit berhasil
        katEl.value = '';
        lokEl.value = '';
        desEl.value = '';
        fotoEl.value = '';
        clearAllErrors();

        window.closeModal();
    } catch (err) {
        console.error("Submit laporan error:", err);
        showToast(err.message || "Gagal mengirim laporan. Coba lagi.", "error");
    } finally {
        setLoadingState('btn-submit-laporan', false);
    }
});

// ============================================================
//   TRACKING LAPORAN
//   FIX: Validasi email format sebelum query, tampil lebih rapi.
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

    // FIX: Jika input berisi '@' tapi bukan email valid, tampilkan error
    if (val.includes('@') && !isValidEmail(val)) {
        input.classList.add('input-error');
        errorEl.textContent = '⚠️ Format email tidak valid.';
        errorEl.style.display = 'block';
        return;
    }

    setLoadingState('btn-track', true, "Mencari Database...");

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
                let statusColor, statusAnim, statusIcon;

                switch (d.status) {
                    case 'Selesai':
                        statusColor = 'var(--color-success)';
                        statusAnim = 'none';
                        statusIcon = '✅';
                        break;
                    case 'Diproses':
                        statusColor = 'var(--color-primary-500)';
                        statusAnim = 'pulse 1.5s infinite';
                        statusIcon = '🔧';
                        break;
                    default: // Menunggu
                        statusColor = 'var(--color-warning)';
                        statusAnim = 'none';
                        statusIcon = '⏳';
                }

                // FIX: Tampilkan tanggal laporan jika tersedia
                let tglDibuat = '';
                if (d.metadata?.createdAt?.toDate) {
                    tglDibuat = d.metadata.createdAt.toDate().toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric'
                    });
                }

                resultEl.innerHTML += `
                    <div style="font-size:var(--text-sm);font-weight:var(--weight-bold);color:var(--color-neutral-800);margin-bottom:var(--space-2);margin-top:var(--space-4)">
                        Laporan ${d.reportId}
                    </div>
                    <div style="display:flex;align-items:center;gap:var(--space-3); padding-bottom: 15px; border-bottom: 1px solid var(--color-neutral-200);">
                        <div style="width:36px;height:36px;background:${statusColor};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;animation:${statusAnim};font-size:16px;">
                            ${statusIcon}
                        </div>
                        <div>
                            <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-neutral-800)">Status: ${d.status}</div>
                            <div style="font-size:var(--text-xs);color:var(--color-neutral-500)">
                                ${d.content.category} · 📍 ${d.content.location}
                                ${tglDibuat ? `<br>🗓 Dilaporkan: ${tglDibuat}` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            resultEl.style.display = 'block';
        }
    } catch (e) {
        showToast("Gagal mengambil data dari server.", "error");
        console.error("Track error:", e);
    } finally {
        setLoadingState('btn-track', false);
    }
};

// FIX: Tombol Enter juga memicu pencarian di tracking input
document.getElementById('trackInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.handleTrack();
});

// ============================================================
//   INTERSECTION OBSERVER — ANIMASI SCROLL
// ============================================================
const observer = new IntersectionObserver((entries) => {
    entries.forEach(el => {
        if (el.isIntersecting) {
            el.target.style.opacity = '1';
            el.target.style.transform = 'translateY(0)';
            observer.unobserve(el.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.step-card, .category-card, .feature-small, .feature-big').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
});

// ============================================================
//   INIT
// ============================================================
loadHeroStats();