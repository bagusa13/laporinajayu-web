# 📖 Buku Panduan (User Manual) - LaporinAja

Selamat datang di Panduan Penggunaan Sistem LaporinAja. Dokumen ini dirancang untuk memandu Pelapor (Mahasiswa/Staf) dan Administrator dalam menggunakan platform pelaporan fasilitas kampus Telkom University secara optimal.

---

## 👨‍🎓 BAB 1: Panduan Untuk Pelapor (Mahasiswa / Staf)

Sistem LaporinAja dirancang sangat sederhana sehingga Anda tidak perlu membuat akun atau *login*.

### 1.1 Cara Melaporkan Kerusakan
1. Akses halaman utama website LaporinAja.
2. Di layar utama, Anda akan melihat tombol merah besar **"Buat Laporan Baru"**. Klik tombol tersebut.
3. Sebuah formulir (*popup*) akan muncul. Isi data berikut:
   - **Nama Anda**: Nama lengkap atau nama panggilan.
   - **Email / WhatsApp**: Nomor HP atau Email untuk keperluan jika teknisi perlu menghubungi Anda (Opsional).
   - **Kategori Fasilitas**: Pilih dari daftar *dropdown* (misal: AC & Pendingin, Pintu & Jendela).
   - **Lokasi Spesifik**: Tulis ruangan atau gedung (contoh: *Gedung TULT, Ruang 04.12*).
   - **Detail Kerusakan**: Jelaskan masalah yang terjadi secara singkat.
   - **Foto Bukti**: Klik ikon kamera untuk mengunggah foto. Sistem secara otomatis akan mengecilkan (kompresi) foto Anda agar kuota internet Anda hemat.
4. Klik tombol **"Kirim Laporan Kerusakan"**.
5. **PENTING:** Jika berhasil, Anda akan mendapatkan **Nomor Tiket** (contoh: `LAP-A1B2C3`). Harap catat atau salin nomor ini untuk melacak perbaikan nanti.

### 1.2 Cara Melacak Status Perbaikan (Tracking)
1. Akses halaman utama website.
2. Gulir (scroll) ke bawah hingga Anda menemukan bagian **"Lacak Laporan Anda"**.
3. Masukkan **Nomor Tiket** yang Anda dapatkan sebelumnya ke dalam kotak pencarian.
4. Klik tombol **"Lacak"**.
5. Sistem akan menampilkan kartu detail berisi: Status Saat Ini (Menunggu, Diproses, atau Selesai), Nama Teknisi yang ditugaskan, dan Estimasi Biaya Perbaikan (jika ada).

### 1.3 Cara Menginstal LaporinAja di HP (PWA)
Anda tidak perlu mencari LaporinAja di PlayStore atau AppStore!
1. Buka website LaporinAja melalui *browser* Chrome (Android) atau Safari (iOS).
2. Tunggu beberapa detik, *browser* akan menampilkan *popup* **"Add LaporinAja to Home Screen"** (Tambahkan ke Layar Utama).
3. Setujui permintaan tersebut. Ikon LaporinAja akan muncul di layar HP Anda layaknya aplikasi biasa. Anda kini bisa membukanya dengan lebih cepat!

---

## 👨‍💻 BAB 2: Panduan Untuk Administrator & Teknisi

Bagian ini khusus untuk tim operasional logistik atau IT yang memegang kendali sistem.

### 2.1 Cara Masuk (Login) ke Panel Admin
1. Buka url rahasia admin: `(URL_WEBSITE_ANDA)/admin.html`
2. Masukkan kredensial sistem:
   - **Email**: admin@laporinaja.com (atau sesuai *setting* Firebase Anda)
   - **Password**: password (atau sesuai *setting* Firebase Anda)
3. Klik **Otentikasi Sistem**. Anda akan dibawa masuk ke Dasbor Laporan.

### 2.2 Membaca dan Mengelola Laporan Masuk
Di Dasbor Admin, Anda akan melihat tabel besar berisi antrean laporan secara langsung (*Real-Time*). Jika ada mahasiswa yang baru melapor, data tersebut akan langsung muncul di baris paling atas tanpa Anda harus me-*refresh* layar.
1. **Melihat Foto**: Pada kolom "Foto Bukti", klik tombol **📷 Lihat** untuk membuka gambar bukti yang diunggah pelapor.
2. **Mengubah Status**: Pada kolom "Status Sistem", ubah *dropdown* dari `Menunggu` ke `Diproses` (jika teknisi sedang bekerja) atau `Selesai` (jika sudah diperbaiki).

### 2.3 Menugaskan Tim Teknisi (Assignee)
1. Pada tabel laporan, lihat kolom **Tim Teknisi**.
2. Pilih regu yang paling tepat dari *dropdown* (misal: "Tim Kelistrikan (ME)" untuk masalah lampu mati).
3. Setelah dipilih, klik tombol **Update** warna hitam di sebelah paling kanan tabel agar data tersimpan ke pangkalan data. Pelapor kini bisa melihat bahwa laporan mereka sudah dialokasikan ke teknisi tersebut.

### 2.4 Memasukkan Estimasi Biaya
Jika kerusakan memerlukan dana (contoh: ganti freon AC), Anda bisa:
1. Klik kolom angka pada bagian **Estimasi Biaya**.
2. Ketikkan angka (misal: `150000` tanpa titik).
3. Klik tombol **Update** di paling kanan baris tabel. Data pengeluaran akan langsung terhitung pada kartu Statistik di atas tabel secara otomatis!

### 2.5 Mengunduh Laporan LENGKAP (Export CSV)
Perlu memberikan laporan akhir bulan ke rektorat?
1. Pada pojok kanan atas area tabel, klik tombol **📥 Export CSV**.
2. *Browser* akan otomatis mengunduh *file* Excel (.csv) berisi ratusan hingga ribuan data laporan sejak hari pertama website beroperasi.
3. Data CSV ini dapat dibuka menggunakan Microsoft Excel atau Google Sheets.

---

## ❓ BAB 3: Tanya Jawab (FAQ) & Trouble-Shooting

**Q: Mengapa tombol "Kirim Laporan" berwarna pudar dan tidak bisa di-klik?**
**A**: Kemungkinan koneksi internet Anda terputus. Sistem kami mendeteksi jaringan yang tidak stabil (mode *Offline*) dan memblokir pengiriman sementara agar data Anda tidak hilang/terkirim ganda. Tunggu hingga jaringan Anda pulih.

**Q: Kenapa saat saya unggah foto beresolusi tinggi, loadingnya cepat?**
**A**: LaporinAja dilengkapi dengan mesin kompresi AI di dalam *browser*. Foto 12 MegaPixel dari kamera HP Anda dikerutkan secara instan (tanpa mengurangi kejelasan objek kerusakan) sebelum ditransfer ke satelit, sehingga 10x lebih cepat.

**Q: Saya lupa nomor tiket laporan saya. Apakah bisa dicari?**
**A**: Saat ini fitur pelacakan hanya beroperasi secara absolut menggunakan Nomor Tiket untuk menjaga privasi anonimitas (karena pengguna tidak membuat akun). Anda bisa menghubungi Admin Kampus jika benar-benar membutuhkan data tersebut.

---
*(Dokumen ini merupakan properti LaporinAja Team - Generated untuk Telkom University)*
