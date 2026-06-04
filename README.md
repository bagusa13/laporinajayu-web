
<div align="center">
  <img src="https://raw.githubusercontent.com/bagusa13/laporinajayu-web/main/og-image.png" alt="LaporinAja Banner" width="100%">
  
  <h1>🚀 LaporinAja - Sistem Pelaporan Fasilitas Kampus</h1>
  <p>Platform <i>Progressive Web App (PWA)</i> modern untuk pelaporan kerusakan fasilitas di lingkungan Telkom University secara <i>real-time</i>.</p>

  <p>
    <a href="#"><img src="https://img.shields.io/badge/Status-Production_Ready-success.svg?style=flat-square" alt="Status"></a>
    <a href="#"><img src="https://img.shields.io/badge/Tech-Vanilla_JS-f7df1e.svg?style=flat-square&logo=javascript" alt="JavaScript"></a>
    <a href="#"><img src="https://img.shields.io/badge/Database-Firebase_Firestore-FFCA28.svg?style=flat-square&logo=firebase" alt="Firebase"></a>
    <a href="#"><img src="https://img.shields.io/badge/UI-Custom_CSS3-1572B6.svg?style=flat-square&logo=css3" alt="CSS3"></a>
  </p>
</div>

---

## ✨ Fitur Utama (Features)

### 🧑‍🎓 Untuk Mahasiswa (Pelapor)
- **Tanpa Login (Frictionless)**: Lapor kerusakan cukup dengan nama, email, dan foto bukti tanpa perlu mendaftar akun.
- **Real-Time Tracker**: Lacak status perbaikan fasilitas secara <i>live</i> menggunakan kode unik tiket (misal: `LAP-168A9B`).
- **Progressive Web App (PWA)**: Bisa di-install di layar utama <i>smartphone</i> layaknya aplikasi *Native*.
- **Offline Detection**: Sistem mendeteksi otomatis jika koneksi terputus dan memblokir pengiriman ganda.
- **Auto Image Compression**: Foto bukti (sebesar 10MB) dikompres otomatis di sisi klien (browser) menjadi ~200KB sebelum di-upload, menghemat kuota pengguna dan server.
- **Premium Micro-Interactions**: Dilengkapi dengan UI kelas dunia (Custom Cursor, Parallax Scroll, 3D Hover Tilt, Skeleton Loading, Lottie Confetti).

### 👨‍💻 Untuk Rektorat & Teknisi (Admin)
- **Real-Time Dashboard**: Semua laporan masuk secara instan tanpa perlu memuat ulang (refresh) halaman.
- **Sistem Penugasan (Assignee)**: Teruskan laporan ke "Tim IT", "Tim AC", atau "Sipil" dengan satu klik.
- **Analitik Visual**: Dilengkapi dengan grafik Donut (*Chart.js*) untuk melihat dominasi kerusakan kategori tertentu.
- **Export to CSV**: Unduh rekap laporan bulanan ke dalam format Excel (CSV) untuk keperluan arsip kampus.
- **Estimasi Biaya Transparan**: Teknisi dapat memasukkan estimasi nominal harga perbaikan agar mahasiswa tahu.

---

## 🛠️ Arsitektur & Teknologi

Proyek ini dibangun secara mandiri tanpa menggunakan Framework Frontend (seperti React/Vue), membuktikan bahwa *Vanilla Web Technologies* bisa mencapai performa dan keindahan maksimal.

- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables/Tokens), Vanilla JavaScript (ES6+).
- **Backend/BaaS**: Firebase (Firestore, Storage, Authentication).
- **Libraries Eksternal**: 
  - `canvas-confetti` (Animasi selebrasi)
  - `Chart.js` (Visualisasi data dasbor admin)

---

## 💻 Panduan Instalasi Lokal (Local Setup)

1. Lakukan *clone* repositori ini:
   ```bash
   git clone https://github.com/bagusa13/laporinajayu-web.git
   ```
2. Buka folder proyek:
   ```bash
   cd laporinajayu-web
   ```
3. Gunakan *Live Server* (ekstensi VS Code) atau jalankan server lokal Python:
   ```bash
   python -m http.server 8000
   ```
4. Buka browser dan arahkan ke `http://localhost:8000`

---

## 📞 Kontak & Lisensi
Dikembangkan oleh **LaporinAja Team**. Hak Cipta dilindungi. Proyek ini merupakan <i>proof-of-concept</i> modernisasi layanan kampus.
