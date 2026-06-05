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

// Format angka ke Rupiah
function formatRupiah(angka) {
    if (!angka && angka !== 0) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(angka);
}

// ============================================================
//   AUTENTIKATOR & PROTEKSI RUTE
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const adminRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            document.getElementById('admin-login-view').style.display = 'none';
            document.getElementById('admin-main-view').style.display = 'flex';

            const adminData = adminSnap.data();
            document.getElementById('admin-display-name').innerText = adminData.name || "Administrator";
            document.getElementById('admin-display-email').innerText = user.email;
            document.getElementById('admin-initial').innerText = (adminData.name || "A").charAt(0);

            initAdminDashboard();
        } else {
            signOut(auth);
            showToast("Akses Ditolak. UID Anda tidak terdaftar sebagai Admin.", "error");
        }
    } else {
        document.getElementById('admin-login-view').style.display = 'flex';
        document.getElementById('admin-main-view').style.display = 'none';
    }
});

document.getElementById('btn-a-login').onclick = async () => {
    const email = document.getElementById('a-email').value.trim();
    const pass = document.getElementById('a-pass').value;
    const btn = document.getElementById('btn-a-login');
    btn.innerHTML = "Memverifikasi...";
    btn.disabled = true;
    try {
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
let currentReportsData = [];
let categoryChartInstance = null;

// ============================================================
function initAdminDashboard() {
    const body = document.getElementById('report-table-body');
    
    // Optimasi: Event Delegation (Hanya di-bind satu kali di luar onSnapshot)
    body.addEventListener('click', async (e) => {
        if (e.target && e.target.classList.contains('btn-save')) {
            const btn = e.target;
            const docId = btn.dataset.id;
            const newStatus = document.querySelector(`.status-select[data-id="${docId}"]`).value;
            const newAssignee = document.querySelector(`.assignee-select[data-id="${docId}"]`).value;
            const biayaInput = document.querySelector(`.biaya-input[data-id="${docId}"]`);
            const biayaVal = biayaInput ? parseFloat(biayaInput.value) || null : null;

            btn.innerText = "...";
            btn.disabled = true;
            try {
                await updateDoc(doc(db, "reports", docId), {
                    status: newStatus,
                    assignee: newAssignee,
                    estimasiBiaya: biayaVal,
                    "metadata.updatedAt": new Date()
                });
                showToast(`Status, teknisi, & biaya berhasil diperbarui.`);
            } catch(err) {
                showToast("Gagal memperbarui data.", "error");
            } finally {
                btn.innerText = "Update";
                btn.disabled = false;
            }
        }
    });

    const q = query(collection(db, "reports"), orderBy("metadata.createdAt", "desc"));

    onSnapshot(q, (snap) => {
        const body = document.getElementById('report-table-body');
        const emptyState = document.getElementById('admin-empty-state');
        body.innerHTML = "";
        currentReportsData = [];
        let countTotal = 0, countProses = 0, countSelesai = 0, totalBiaya = 0;
        const categoryCounts = {};

        if (snap.empty) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            snap.forEach(d => {
                const data = d.data();
                currentReportsData.push(data);
                categoryCounts[data.content.category] = (categoryCounts[data.content.category] || 0) + 1;
                countTotal++;
                if (data.status === "Diproses") countProses++;
                if (data.status === "Selesai") countSelesai++;
                if (data.estimasiBiaya) totalBiaya += Number(data.estimasiBiaya);

                // Badge anonim
                const anonBadge = data.reporterInfo?.isAnonymous
                    ? `<span class="anon-row-badge">👤 Anonim</span>`
                    : '';

                // Status badge warna
                let statusBadgeClass = '';
                switch(data.status) {
                    case 'Selesai': statusBadgeClass = 'status-badge-selesai'; break;
                    case 'Diproses': statusBadgeClass = 'status-badge-proses'; break;
                    default: statusBadgeClass = 'status-badge-menunggu';
                }

                // Tampilan biaya di tabel
                const biayaDisplay = data.estimasiBiaya
                    ? `<span class="biaya-filled">${formatRupiah(data.estimasiBiaya)}</span>`
                    : `<span class="biaya-empty">Belum diisi</span>`;

                // Ulasan display
                let ulasanHtml = `<span style="color:var(--neutral-400); font-style:italic; font-size:12px;">Belum ada ulasan</span>`;
                if (data.feedback) {
                    let stars = '';
                    for(let i=0; i<data.feedback.rating; i++) stars += '★';
                    ulasanHtml = `
                        <div style="color:var(--copper-400); font-size:14px; letter-spacing:2px; margin-bottom:4px;">${stars}</div>
                        <div style="font-size:12px; color:var(--neutral-700); line-height:1.4;">"${data.feedback.comment}"</div>
                    `;
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="td-ticket">
                        <strong>${data.reportId}</strong>
                        <div style="margin-top:4px;">${anonBadge}</div>
                    </td>
                    <td class="td-user">
                        <span>${data.reporterInfo.name}</span>
                        <small>${data.reporterInfo.email}</small>
                    </td>
                    <td class="td-desc">
                        <span class="cat-badge">${data.content.category}</span>
                        <p>${data.content.description} <br> <small>📍 ${data.content.location}</small></p>
                    </td>
                    <td>
                        ${data.content.imageUrl
                            ? `<a href="${data.content.imageUrl}" target="_blank" class="view-img">📷 Lihat</a>`
                            : '<span class="no-img">No Image</span>'}
                    </td>
                    <td class="td-biaya">
                        <div class="biaya-input-wrap">
                            <div style="margin-bottom:6px;">${biayaDisplay}</div>
                            <div class="biaya-input-row">
                                <input
                                    type="number"
                                    class="biaya-input"
                                    placeholder="Rp 0"
                                    value="${data.estimasiBiaya || ''}"
                                    data-id="${d.id}"
                                    min="0"
                                    step="1000"
                                >
                            </div>
                        </div>
                    </td>
                    <td data-status="${data.status}">
                        <select class="status-dropdown status-select" data-id="${d.id}">
                            <option value="Menunggu" ${data.status === 'Menunggu' ? 'selected' : ''}>⏳ Menunggu</option>
                            <option value="Diproses" ${data.status === 'Diproses' ? 'selected' : ''}>🔧 Diproses</option>
                            <option value="Selesai" ${data.status === 'Selesai' ? 'selected' : ''}>✅ Selesai</option>
                        </select>
                    </td>
                    <td>
                        <select class="status-dropdown assignee-select" data-id="${d.id}">
                            <option value="" ${!data.assignee ? 'selected' : ''}>Belum Ditugaskan</option>
                            <option value="Tim IT" ${data.assignee === 'Tim IT' ? 'selected' : ''}>Tim IT</option>
                            <option value="Tim AC" ${data.assignee === 'Tim AC' ? 'selected' : ''}>Tim AC</option>
                            <option value="Sipil" ${data.assignee === 'Sipil' ? 'selected' : ''}>Sipil</option>
                            <option value="Tim Kelistrikan (ME)" ${data.assignee === 'Tim Kelistrikan (ME)' ? 'selected' : ''}>Tim Kelistrikan (ME)</option>
                        </select>
                    </td>
                    <td class="td-ulasan" style="min-width:180px;">
                        ${ulasanHtml}
                    </td>
                    <td style="text-align: right;">
                        <button class="btn-save" data-id="${d.id}">Update</button>
                    </td>
                `;
                body.appendChild(row);
            });

            // Update Chart
            const ctx = document.getElementById('categoryChart').getContext('2d');
            const labels = Object.keys(categoryCounts);
            const values = Object.values(categoryCounts);
            if (categoryChartInstance) categoryChartInstance.destroy();
            categoryChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: [
                            '#b91c1c', // Crimson
                            '#ea580c', // Copper
                            '#ca8a04', // Gold
                            '#44403c', // Charcoal
                            '#991b1b', // Deep Crimson
                            '#c2410c', // Deep Copper
                            '#78716c', // Warm Stone
                            '#15803d'  // Forest Green
                        ],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                font: {
                                    family: "'Manrope', sans-serif",
                                    weight: 600
                                },
                                color: '#44403c'
                            }
                        }
                    }
                }
            });
        }

        // Update stat cards
        document.getElementById('count-total').innerText = countTotal;
        document.getElementById('count-proses').innerText = countProses;
        document.getElementById('count-selesai').innerText = countSelesai;
        document.getElementById('count-biaya').innerText = formatRupiah(totalBiaya);



        // Re-apply filter jika ada
        const filterVal = document.getElementById('filter-status')?.value;
        if (filterVal) window.filterTable?.();
    });
}

// ============================================================
//   EXPORT CSV
// ============================================================
window.exportToCSV = function() {
    if (currentReportsData.length === 0) {
        showToast("Tidak ada data untuk di-export", "error");
        return;
    }
    const headers = ["Tiket", "Nama Pelapor", "Email", "Kategori", "Lokasi", "Deskripsi", "Status", "Tim Teknisi", "Estimasi Biaya", "Waktu Dibuat"];
    const rows = currentReportsData.map(d => {
        let tgl = '';
        if (d.metadata?.createdAt?.toDate) tgl = d.metadata.createdAt.toDate().toISOString();
        return [
            d.reportId,
            `"${d.reporterInfo.name}"`,
            `"${d.reporterInfo.email}"`,
            `"${d.content.category}"`,
            `"${d.content.location}"`,
            `"${d.content.description.replace(/\n/g, ' ')}"`,
            d.status,
            `"${d.assignee || 'Belum Ditugaskan'}"`,
            d.estimasiBiaya || 0,
            tgl
        ].join(",");
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_kampus_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};