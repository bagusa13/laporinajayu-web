import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Helper untuk menampilkan notifikasi
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerText = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ============================================================
//   AUTENTIKATOR & PROTEKSI RUTE (VERSI AMAN)
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 1. Cek apakah UID pengguna ini ada di koleksi 'admins'
        const adminRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            // LOGIN BERHASIL: Pengguna terverifikasi sebagai Admin
            document.getElementById('admin-login-view').style.display = 'none';
            document.getElementById('admin-main-view').style.display = 'flex';
            
            // Ambil data dari dokumen admin di Firestore untuk profil
            const adminData = adminSnap.data();
            document.getElementById('admin-display-name').innerText = adminData.name || "Administrator";
            document.getElementById('admin-display-email').innerText = user.email;
            document.getElementById('admin-initial').innerText = (adminData.name || "A").charAt(0);
            
            initAdminDashboard();
        } else {
            // KICK: Login berhasil tapi UID tidak terdaftar di koleksi admins
            signOut(auth);
            showToast("Akses Ditolak. UID Anda tidak terdaftar sebagai Admin.", "error");
        }
    } else {
        // Tampilkan layar login jika belum ada sesi
        document.getElementById('admin-login-view').style.display = 'flex';
        document.getElementById('admin-main-view').style.display = 'none';
    }
});

// Logika tombol login
document.getElementById('btn-a-login').onclick = async () => {
    const email = document.getElementById('a-email').value.trim();
    const pass = document.getElementById('a-pass').value;
    
    const btn = document.getElementById('btn-a-login');
    btn.innerHTML = "Memverifikasi...";
    btn.disabled = true;

    try {
        // Cukup login biasa, pengecekan role dilakukan di onAuthStateChanged atas
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        showToast("Kredensial salah atau akses ditolak.", "error");
        btn.innerHTML = "Otentikasi Sistem";
        btn.disabled = false;
    }
};

document.getElementById('a-logout').onclick = () => signOut(auth);

// ============================================================
//   MANAJEMEN DATA REAL-TIME
// ============================================================
function initAdminDashboard() {
    const q = query(collection(db, "reports"), orderBy("metadata.createdAt", "desc"));
    
    onSnapshot(q, (snap) => {
        const body = document.getElementById('report-table-body');
        const emptyState = document.getElementById('admin-empty-state');
        body.innerHTML = "";

        let countTotal = 0, countProses = 0, countSelesai = 0;

        if (snap.empty) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            snap.forEach(d => {
                const data = d.data();
                countTotal++;
                if(data.status === "Diproses") countProses++;
                if(data.status === "Selesai") countSelesai++;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="td-ticket"><strong>${data.reportId}</strong></td>
                    <td class="td-user">
                        <span>${data.reporterInfo.name}</span>
                        <small>${data.reporterInfo.email}</small>
                    </td>
                    <td class="td-desc">
                        <span class="cat-badge">${data.content.category}</span>
                        <p>${data.content.description} <br> <small>📍 ${data.content.location}</small></p>
                    </td>
                    <td>
                        ${data.content.imageUrl ? `<a href="${data.content.imageUrl}" target="_blank" class="view-img">Lihat Foto</a>` : '<span class="no-img">No Image</span>'}
                    </td>
                    <td>
                        <select class="status-dropdown" data-id="${d.id}">
                            <option value="Menunggu" ${data.status === 'Menunggu' ? 'selected' : ''}>Menunggu</option>
                            <option value="Diproses" ${data.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
                            <option value="Selesai" ${data.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                        </select>
                    </td>
                    <td style="text-align: right;">
                        <button class="btn-save" data-id="${d.id}">Update</button>
                    </td>
                `;
                body.appendChild(row);
            });
        }

        document.getElementById('count-total').innerText = countTotal;
        document.getElementById('count-proses').innerText = countProses;
        document.getElementById('count-selesai').innerText = countSelesai;

        document.querySelectorAll('.btn-save').forEach(btn => {
            btn.onclick = async (e) => {
                const docId = e.target.dataset.id;
                const newStatus = document.querySelector(`.status-dropdown[data-id="${docId}"]`).value;
                e.target.innerText = "...";
                try {
                    await updateDoc(doc(db, "reports", docId), { 
                        status: newStatus,
                        "metadata.updatedAt": new Date()
                    });
                    showToast(`Status berhasil diperbarui.`);
                } catch(err) {
                    showToast("Gagal memperbarui data.", "error");
                } finally {
                    e.target.innerText = "Update";
                }
            };
        });
    });
}