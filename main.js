let auth, db;
let signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, GoogleAuthProvider, signInWithPopup;
let collection, addDoc, serverTimestamp, query, where, getDocs, getCountFromServer, onSnapshot, doc, updateDoc;

let currentUser = null;
let laporMode = 'akun'; // 'akun' | 'anon'
let googleProvider = null;

const initFirebase = async () => {
    try {
        const fbApp = await import('./firebase-config.js');
        auth = fbApp.auth; db = fbApp.db;

        const fbAuth = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
        signInWithEmailAndPassword = fbAuth.signInWithEmailAndPassword;
        createUserWithEmailAndPassword = fbAuth.createUserWithEmailAndPassword;
        onAuthStateChanged = fbAuth.onAuthStateChanged;
        signOut = fbAuth.signOut;
        updateProfile = fbAuth.updateProfile;
        GoogleAuthProvider = fbAuth.GoogleAuthProvider;
        signInWithPopup = fbAuth.signInWithPopup;

        const fbStore = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        collection = fbStore.collection;
        addDoc = fbStore.addDoc;
        serverTimestamp = fbStore.serverTimestamp;
        query = fbStore.query;
        where = fbStore.where;
        getDocs = fbStore.getDocs;
        getCountFromServer = fbStore.getCountFromServer;
        onSnapshot = fbStore.onSnapshot;
        doc = fbStore.doc;
        updateDoc = fbStore.updateDoc;

        googleProvider = new GoogleAuthProvider();
        
        if (typeof window.__initAuthState === 'function') {
            window.__initAuthState();
        }

        // Initialize features that depend on Firebase or DOM ready after lazy load
        if (typeof initRealtimeStats === 'function') initRealtimeStats();
        if (typeof initPhysics === 'function') initPhysics();

    } catch(e) {
        console.warn("Firebase terblokir (AdBlock/Incognito). Fitur Backend nonaktif.");
    }
};

initFirebase();


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
// ============================================================
//   STATE
// ============================================================
// ============================================================
//   LENIS INTEGRATION (PHASE 2)
// ============================================================
const lenis = window.Lenis ? new window.Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Apple/Linear smoothness
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
  infinite: false,
}) : null;

// Sync Lenis with GSAP ScrollTrigger (Phase 3)
if (window.gsap && window.ScrollTrigger && lenis) {
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    window.gsap.ticker.lagSmoothing(0);
} else if (lenis) {
    function rafLenis(time) {
      lenis.raf(time);
      requestAnimationFrame(rafLenis);
    }
    requestAnimationFrame(rafLenis);
}

// Make lenis globally accessible to pause/play safely
window.lenis = lenis;

// Migrate all scroll events to a centralized, GPU-efficient loop
function handleScroll(e) {
    const scrollY = e ? e.animatedScroll : window.scrollY;

    // 1. Navbar State
    const navbar = document.querySelector('.navbar');
    if (scrollY > 20) navbar?.classList.add('scrolled');
    else navbar?.classList.remove('scrolled');

    // 2. Scroll Progress Bar
    const scrollProgress = document.getElementById('scroll-progress');
    if (scrollProgress) {
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollPercent = (scrollY / scrollHeight) * 100;
        scrollProgress.style.width = scrollPercent + '%';
    }

    // 3. Parallax Pattern & Blobs
    const heroBg = document.querySelector('.hero-grid-pattern');
    if (heroBg) heroBg.style.transform = `translateY(${scrollY * 0.3}px)`;
    
    const blobs = document.querySelectorAll('.hero-blob-1, .hero-blob-2');
    blobs.forEach((blob, idx) => {
        blob.style.transform = `translateY(${scrollY * (0.15 + (idx * 0.1))}px)`;
    });
}

if (lenis) {
    lenis.on('scroll', handleScroll);
} else {
    window.addEventListener('scroll', () => handleScroll());
    // Trigger once on load
    window.addEventListener('load', () => handleScroll());
}

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
    } catch (e) {
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
    if(isOpen) window.lenis?.stop(); else window.lenis?.start();
});
mobileNav.querySelectorAll('a, button').forEach(el => el.addEventListener('click', closeMobileNav));
function closeMobileNav() {
    mobileNav.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
    window.lenis?.start();
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
    window.lenis?.stop();
    closeMobileNav();
    clearAllErrors();

    if (type === 'lapor') {
        panelUser.style.display = 'none';
        panelLapor.style.display = 'block';
        const formWrapper = document.getElementById('lapor-form-wrapper');
        const successScreen = document.getElementById('lapor-success-screen');
        if (formWrapper) formWrapper.style.display = 'block';
        if (successScreen) successScreen.style.display = 'none';
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
    window.lenis?.start();
    
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
};

// ============================================================
//   HERO & BOTTOM STATS (REAL-TIME)
// ============================================================
function animateCounter(element, targetValue, suffix = '') {
    if (!window.gsap) {
        let display = targetValue > 999 ? (targetValue / 1000).toFixed(1) + 'K' : targetValue;
        element.innerHTML = `${display}<span>${suffix}</span>`;
        return;
    }
    
    let currentRaw = element.dataset.rawVal ? parseFloat(element.dataset.rawVal) : 0;
    const obj = { val: currentRaw };
    
    window.gsap.killTweensOf(obj);
    window.gsap.killTweensOf(element);
    element.dataset.rawVal = targetValue;

    window.gsap.to(obj, {
        val: targetValue,
        duration: 2.5,
        ease: "power4.out",
        onUpdate: () => {
            let current = Math.round(obj.val);
            let display = current > 999 ? (current / 1000).toFixed(1) + 'K' : current;
            element.innerHTML = `${display}<span>${suffix}</span>`;
        }
    });
    
    window.gsap.fromTo(element, 
        { scale: 1.1, color: "var(--red-600)" }, 
        { scale: 1, color: "inherit", duration: 1.2, ease: "expo.out" }
    );
}

function initRealtimeStats() {
    const reportsRef = collection(db, "reports");

    onSnapshot(reportsRef, (snapshot) => {
        let total = snapshot.size;
        let selesai = 0;
        snapshot.forEach((doc) => {
            if (doc.data().status === "Selesai") selesai++;
        });

        const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;

        const elTotalHero = document.querySelector('.stat-number[data-stat="total"]');
        const elPctHero = document.querySelector('.stat-number[data-stat="pct"]');
        if (elTotalHero) animateCounter(elTotalHero, total, '+');
        if (elPctHero) animateCounter(elPctHero, pct, '%');

        const elTotalBottom = document.getElementById('stat-bottom-total');
        const elPctBottom = document.getElementById('stat-bottom-pct');
        if (elTotalBottom) animateCounter(elTotalBottom, total, '+');
        if (elPctBottom) animateCounter(elPctBottom, pct, '%');
    }, (error) => {});
}

function triggerUpdateAnim(element) {
    // Deprecated in Phase 3. Left empty to prevent breaking any scattered references.
}

// ============================================================
//   AUTH STATE
// ============================================================
window.__initAuthState = function() {
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
            if (deskNav) deskNav.innerHTML = loggedInHtml;
            if (mobNav) mobNav.innerHTML = loggedInHtml.replace(/btn-sm/g, 'btn-md');
            document.querySelectorAll('.btn-logout').forEach(btn => {
                btn.addEventListener('click', () => signOut(auth));
            });
        } else {
            const loggedOutHtml = `
                <button class="btn btn-ghost btn-sm" onclick="openModal('login')">Masuk</button>
                <button class="btn btn-primary btn-sm" onclick="openModal('lapor')">Mulai Lapor</button>
            `;
            if (deskNav) deskNav.innerHTML = loggedOutHtml;
            if (mobNav) mobNav.innerHTML = loggedOutHtml.replace(/btn-sm/g, 'btn-md');
        }
    });
};

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

            if (window.confetti) {
                setTimeout(() => {
                    confetti({
                        particleCount: 120, spread: 80, origin: { y: 0.6 }, zIndex: 99999,
                        colors: ['#E53E3E', '#F59E0B', '#10B981']
                    });
                }, 200);
            }

            if(window.setFavicon) window.setFavicon('success');
        
        katEl.value = '';
        lokEl.value = '';
        desEl.value = '';
        fotoEl.value = '';
        const inputAnonNama = document.getElementById('anon-nama');
        const inputAnonEmail = document.getElementById('anon-email');
        if (inputAnonNama) inputAnonNama.value = '';
        if (inputAnonEmail) inputAnonEmail.value = '';
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
                            <div class="track-result-row">
                                <div class="track-result-icon">👷</div>
                                <div>
                                    <div class="track-result-label">Tim Teknisi</div>
                                    <div class="track-result-value">${d.assignee || 'Belum Ditugaskan'}</div>
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
        
        const w = this.clientWidth, h = this.clientHeight;
        const size = Math.max(w, h) * 1.5;
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.marginLeft = ripple.style.marginTop = `${-size/2}px`;
        
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
});

// --- 2. GSAP ScrollTrigger Reveal Animations (Phase 3) ---
if (window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    
    const revealElements = document.querySelectorAll('.reveal-up, .reveal-scale, .reveal-blur, .category-card');
    
    revealElements.forEach(el => {
        el.style.transition = 'none'; // Prevent CSS stuttering
        
        window.gsap.fromTo(el, 
            { y: 60, opacity: 0, scale: el.classList.contains('reveal-scale') ? 0.9 : 1 },
            {
                y: 0, 
                opacity: 1, 
                scale: 1,
                duration: 1.2, 
                ease: "power3.out",
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%", 
                    toggleActions: "play none none none"
                },
                onComplete: () => {
                    el.style.transition = '';
                }
            }
        );
    });
}

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
// initRealtimeStats(); // Removed to prevent double initialization
window.copyTicketId = function() {
    const ticketId = document.getElementById('success-ticket-id').innerText;
    navigator.clipboard.writeText(ticketId).then(() => {
        showToast("✅ Nomor Tiket disalin ke clipboard!");
    }).catch(err => {
        showToast("Gagal menyalin tiket.", "error");
    });
};


// Preloader Logic & Hero Sequence (Phase 3)
let preloaderHidden = false;
function hidePreloader() {
    if (preloaderHidden) return;
    preloaderHidden = true;
    
    const preloader = document.getElementById('page-preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('fade-out');
            window.__hero_revealed = true;
            
            if(window.gsap && window.SplitType) {
                // Initialize Typography (Phase 4)
                const heroTitleSplit = new window.SplitType('.hero-title', { types: 'words, chars' });
                const sectionTitlesSplit = new window.SplitType('.section-title', { types: 'words, chars' });

                const tl = window.gsap.timeline({ defaults: { ease: "expo.out", duration: 1.5 } });
                tl.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, "+=0.2")
                  .fromTo(heroTitleSplit.chars, { opacity: 0, y: 20, rotateX: -90, transformOrigin: '0% 50% -50' }, { opacity: 1, y: 0, rotateX: 0, stagger: 0.02 }, "-=1.2")
                  .fromTo('.hero-desc', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, "-=1.3")
                  .fromTo('.hero-actions', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, "-=1.3")
                  .fromTo('.hero-stats', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1 }, "-=1.2");
                
                // Section Title Animation
                document.querySelectorAll('.section-title').forEach(title => {
                    window.gsap.fromTo(title.querySelectorAll('.word'), 
                        { opacity: 0, y: 30, rotateX: -40, transformOrigin: '0% 100%' },
                        {
                            opacity: 1,
                            y: 0,
                            rotateX: 0,
                            duration: 1.2,
                            ease: "power3.out",
                            stagger: 0.05,
                            scrollTrigger: {
                                trigger: title,
                                start: "top 85%",
                                toggleActions: "play none none none"
                            }
                        }
                    );
                });

                // Handle Resize (Debounced) to prevent layout shifts
                let resizeTimeout;
                window.addEventListener('resize', () => {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        heroTitleSplit.split();
                        sectionTitlesSplit.split();
                    }, 250);
                });
            } else if(window.gsap) {
                // Fallback
                const tl = window.gsap.timeline({ defaults: { ease: "expo.out", duration: 1.5 } });
                tl.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, "+=0.2")
                  .fromTo('.hero-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0 }, "-=1.2")
                  .fromTo('.hero-desc', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, "-=1.3")
                  .fromTo('.hero-actions', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, "-=1.3")
                  .fromTo('.hero-stats', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1 }, "-=1.2");
            } else {
                // Failsafe: if GSAP is blocked, just force everything visible
                document.querySelectorAll('.reveal-up, .hero-badge, .hero-title, .hero-desc, .hero-actions, .hero-stats, .section-title, .word, .char').forEach(el => {
                    el.style.opacity = '1';
                    el.style.transform = 'none';
                    el.style.transition = 'opacity 0.5s ease';
                });
            }
        }, 500);
    }
}

// Failsafe: hide after 4s max even if load hangs
window.addEventListener('load', hidePreloader);
setTimeout(hidePreloader, 4000);


/* ==========================================================================
   CUSTOM CURSOR & MAGNETIC BUTTONS LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Scroll Progress Bar (Migrated to Lenis)
    const scrollProgress = document.getElementById('scroll-progress');

    
        // 5. 3D Tilt Hover on Category Cards
        const catCards = document.querySelectorAll('.category-card-img');
        catCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const tiltX = ((y - centerY) / centerY) * -8; // Max 8 deg
                const tiltY = ((x - centerX) / centerX) * 8;
                card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            });
        });

    
    // 6. Parallax Background (Migrated to Lenis)

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


// ============================================================
//   STATEFUL FAVICON
// ============================================================
window.setFavicon = function(state) {
    let svg = '';
    if (state === 'loading') {
        svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="12" stroke="#E53E3E" stroke-width="4" stroke-dasharray="18 18" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="0.8s" repeatCount="indefinite"/></circle></svg>`;
    } else if (state === 'success') {
        svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#10B981"/><path d="M9 16L14 21L23 11" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else {
        svg = `<svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="10" fill="#E53E3E" /><path d="M11 12C11 10.3431 12.3431 9 14 9H26C27.6569 9 29 10.3431 29 12V22C29 23.6569 27.6569 25 26 25H18.8284C18.298 25 17.7893 25.2107 17.4142 25.5858L14.4142 28.5858C13.5233 29.4767 12 28.8457 12 27.5858V25.1716C11.3914 24.6865 11 23.8967 11 23V12Z" fill="white" fill-opacity="0.2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 14V18M20 21.5H20.01" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    const link = document.querySelector("link[rel~='icon']");
    if (link) {
        link.href = 'data:image/svg+xml;base64,' + btoa(svg);
    }
};


// ==========================================
//   DEVELOPER EASTER EGG
// ==========================================
console.log("%c🚀 LAPORIN AJA - TELKOM UNIVERSITY", "font-size: 24px; font-weight: bold; color: #E53E3E; text-shadow: 2px 2px 0px #000;");
console.log("%cWebsite ini dirakit dengan presisi level piksel dan performa maksimal.", "font-size: 14px; color: #10B981;");
console.log("%cIngin melihat di balik layar? Kunjungi /admin.html", "font-size: 12px; color: #64748b; font-style: italic;");

// ============================================================
//   MATTER.JS PHYSICS ENGINE (PHASE 5)
// ============================================================
function initPhysics() {
    if (!window.Matter) return;
    
    // Disable physics engine on mobile and tablet screens (< 1024px) or touch devices to save CPU/GPU and battery
    if (window.innerWidth < 1024 || window.matchMedia("(any-hover: none)").matches) {
        return;
    }
    
    const container = document.getElementById('matter-container');
    if (!container) return;

    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite,
          Mouse = Matter.Mouse,
          MouseConstraint = Matter.MouseConstraint;

    // Create engine
    const engine = Engine.create();
    
    // Create renderer
    const render = Render.create({
        element: container,
        engine: engine,
        options: {
            width: container.clientWidth,
            height: container.clientHeight,
            background: 'transparent',
            wireframes: false,
            pixelRatio: window.devicePixelRatio
        }
    });

    // Create boundaries
    const wallOpts = { isStatic: true, render: { visible: false } };
    const ground = Bodies.rectangle(container.clientWidth/2, container.clientHeight + 25, container.clientWidth + 100, 50, wallOpts);
    const leftWall = Bodies.rectangle(-25, container.clientHeight/2, 50, container.clientHeight + 100, wallOpts);
    const rightWall = Bodies.rectangle(container.clientWidth + 25, container.clientHeight/2, 50, container.clientHeight + 100, wallOpts);
    const ceiling = Bodies.rectangle(container.clientWidth/2, -500, container.clientWidth + 100, 50, wallOpts);
    
    // Create interactive shapes (LaporinAja elements)
    const shapes = [];
    const colors = ['#E53E3E', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
    
    for (let i = 0; i < 12; i++) {
        const x = Math.random() * container.clientWidth;
        const y = Math.random() * -500 - 100; // Drop from above
        const radius = Math.random() * 15 + 25;
        
        if (i % 2 === 0) {
            shapes.push(Bodies.circle(x, y, radius, {
                restitution: 0.8,
                render: { fillStyle: colors[i % colors.length] }
            }));
        } else {
            shapes.push(Bodies.rectangle(x, y, radius * 2, radius * 1.5, {
                restitution: 0.6,
                chamfer: { radius: 8 },
                render: { fillStyle: colors[i % colors.length] }
            }));
        }
    }

    Composite.add(engine.world, [ground, leftWall, rightWall, ceiling, ...shapes]);

    // Add mouse control
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: { visible: false }
        }
    });
    
    // Prevent mouse from capturing scroll events on mobile
    mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
    mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);

    Composite.add(engine.world, mouseConstraint);
    render.mouse = mouse;

    // Performance Optimization: Only run when visible
    const runner = Runner.create();
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                Render.run(render);
                Runner.run(runner, engine);
            } else {
                Render.stop(render);
                Runner.stop(runner);
            }
        });
    });
    
    observer.observe(document.querySelector('.hero'));

    // Handle Resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            render.canvas.width = container.clientWidth * window.devicePixelRatio;
            render.canvas.height = container.clientHeight * window.devicePixelRatio;
            
            Matter.Body.setPosition(ground, { x: container.clientWidth/2, y: container.clientHeight + 25 });
            Matter.Body.setPosition(rightWall, { x: container.clientWidth + 25, y: container.clientHeight/2 });
            Matter.Body.setPosition(ceiling, { x: container.clientWidth/2, y: -500 });
        }, 250);
    });
}

// Initialize Physics when window loads
// window.addEventListener('load', initPhysics); // Removed to prevent double initialization