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
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
const googleProvider = new GoogleAuthProvider();

const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

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

const modal = document.getElementById('modal');
let previouslyFocused = null;
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

window.openModal = function(type) {
  previouslyFocused = document.activeElement;
  const panelUser  = document.getElementById('panel-user');
  const panelLapor = document.getElementById('panel-lapor');

  modal.classList.add('open');
  modal.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
  closeMobileNav();
  clearAllErrors();

  if (type === 'lapor') {
      if(!currentUser) {
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
}

window.closeModal = function() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (previouslyFocused) previouslyFocused.focus();
}

window.handleOverlayClick = function(e) {
  if (e.target === modal) window.closeModal();
}

window.switchTab = function(tab) {
  const isMasuk = tab === 'masuk';
  document.getElementById('tab-masuk').classList.toggle('active', isMasuk);
  document.getElementById('tab-daftar').classList.toggle('active', !isMasuk);
  document.getElementById('form-masuk').style.display  = isMasuk ? 'block' : 'none';
  document.getElementById('form-daftar').style.display = isMasuk ? 'none'  : 'block';
  clearAllErrors();
}

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

function setLoadingState(btnId, loading, text="Memuat...") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
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

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const deskNav = document.getElementById('auth-nav-actions');
    const mobNav = document.getElementById('mobile-auth-actions');
    
    if (user) {
        const loggedInHtml = `
            <span style="font-size:13px; font-weight:bold; margin-right:10px;">Hi, ${user.displayName || 'User'}</span>
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

async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        showToast(`Selamat datang, ${result.user.displayName}!`);
        window.closeModal();
    } catch (error) {
        showToast("Gagal masuk dengan Google.", "error");
    }
}

document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleLogin);
document.getElementById('btn-google-reg')?.addEventListener('click', handleGoogleLogin);

document.getElementById('btn-masuk').addEventListener('click', async () => {
  const emailEl = document.getElementById('masuk-email');
  const passEl  = document.getElementById('masuk-password');
  let valid = true;

  if (!emailEl.value.trim()) { showError(emailEl, 'Email wajib diisi.'); valid = false; }
  if (!passEl.value) { showError(passEl, 'Password wajib diisi.'); valid = false; }

  if (valid) {
    setLoadingState('btn-masuk', true, "Verifikasi...");
    try {
        await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
        showToast("Berhasil masuk.");
        window.closeModal();
    } catch(err) {
        showError(passEl, 'Kredensial salah atau tidak ditemukan.');
    } finally {
        setLoadingState('btn-masuk', false);
    }
  }
});

document.getElementById('btn-daftar').addEventListener('click', async () => {
  const namaEl  = document.getElementById('daftar-nama');
  const emailEl = document.getElementById('daftar-email');
  const passEl  = document.getElementById('daftar-password');
  const konfEl  = document.getElementById('daftar-konfirmasi');
  let valid = true;

  if (!namaEl.value.trim()) { showError(namaEl, 'Nama wajib diisi.'); valid = false; }
  if (!emailEl.value.trim()) { showError(emailEl, 'Email wajib diisi.'); valid = false; }
  if (!passEl.value) { showError(passEl, 'Password wajib diisi.'); valid = false; }
  if (!konfEl.value) { showError(konfEl, 'Konfirmasi wajib.'); valid = false; }
  else if (konfEl.value !== passEl.value) { showError(konfEl, 'Password tidak cocok.'); valid = false; }

  if (valid) {
    setLoadingState('btn-daftar', true, "Membuat akun...");
    try {
        const userCred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
        await updateProfile(userCred.user, { displayName: namaEl.value.trim() });
        showToast("Pendaftaran berhasil.");
        window.closeModal();
    } catch(err) {
        showError(emailEl, 'Email mungkin sudah terdaftar.');
    } finally {
        setLoadingState('btn-daftar', false);
    }
  }
});

document.getElementById('btn-submit-laporan').addEventListener('click', async () => {
    const katEl = document.getElementById('lapor-kategori');
    const lokEl = document.getElementById('lapor-lokasi');
    const desEl = document.getElementById('lapor-deskripsi');
    const fileInput = document.getElementById('lapor-foto').files[0];
    
    if (!katEl.value || !lokEl.value.trim() || !desEl.value.trim()) {
        showToast("Lengkapi semua data laporan!", "error");
        return;
    }

    setLoadingState('btn-submit-laporan', true, "Menyimpan...");

    try {
        let imgUrl = "";

        if (fileInput) {
            const sigResp = await fetch('/api/sign-cloudinary');
            if (!sigResp.ok) throw new Error("Gagal otentikasi serverless.");
            const sigData = await sigResp.json();

            const formData = new FormData();
            formData.append('file', fileInput);
            formData.append('api_key', sigData.api_key);
            formData.append('timestamp', sigData.timestamp);
            formData.append('signature', sigData.signature);

            const cloudResp = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`, {
                method: 'POST',
                body: formData
            });

            const cloudData = await cloudResp.json();
            if (cloudData.error) throw new Error(cloudData.error.message);
            imgUrl = cloudData.secure_url;
        }

        const ticketId = `#LAP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await addDoc(collection(db, "reports"), {
            reportId: ticketId,
            reporterInfo: { 
                name: currentUser.displayName, 
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
            metadata: { createdAt: serverTimestamp() }
        });

        showToast(`Laporan Berhasil! Tiket: ${ticketId}`);
        katEl.value = ''; lokEl.value = ''; desEl.value = ''; document.getElementById('lapor-foto').value = '';
        window.closeModal();
    } catch (err) {
        console.error(err);
        showToast("Gagal mengirim laporan: " + err.message, "error");
    } finally {
        setLoadingState('btn-submit-laporan', false);
    }
});

window.handleTrack = async function() {
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

      if(snap.empty) {
          notfoundEl.style.display = 'block';
      } else {
          resultEl.innerHTML = '';
          
          snap.forEach(doc => {
              const d = doc.data();
              let statusColor = 'var(--color-primary-500)';
              let statusAnim = 'pulse 1.5s infinite';
              
              if(d.status === 'Selesai') { statusColor = 'var(--color-success)'; statusAnim = 'none'; }
              if(d.status === 'Menunggu') { statusColor = 'var(--color-warning)'; statusAnim = 'none'; }

              resultEl.innerHTML += `
                  <div style="font-size:var(--text-sm);font-weight:var(--weight-bold);color:var(--color-neutral-800);margin-bottom:var(--space-2);margin-top:var(--space-4)">Laporan ${d.reportId}</div>
                  <div style="display:flex;align-items:center;gap:var(--space-3); padding-bottom: 15px; border-bottom: 1px solid var(--color-neutral-200);">
                    <div style="width:28px;height:28px;background:${statusColor};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;animation:${statusAnim}">
                      <div style="width:8px;height:8px;background:white;border-radius:50%"></div>
                    </div>
                    <div>
                      <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-neutral-800)">Status: ${d.status}</div>
                      <div style="font-size:var(--text-xs);color:var(--color-neutral-500)">${d.content.category} | Lokasi: ${d.content.location}</div>
                    </div>
                  </div>
              `;
          });
          resultEl.style.display = 'block';
      }
  } catch(e) {
      showToast("Gagal mengambil data dari server.", "error");
      console.error(e);
  } finally {
      setLoadingState('btn-track', false);
  }
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.style.opacity   = '1';
      el.target.style.transform = 'translateY(0)';
      observer.unobserve(el.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.step-card, .category-card, .feature-small, .feature-big').forEach(el => {
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});