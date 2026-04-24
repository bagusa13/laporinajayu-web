const cloudinary = require('cloudinary').v2;

export default async function handler(req, res) {
  // Konfigurasi Cloudinary menggunakan kredensial milikmu
  cloudinary.config({
    cloud_name: 'dyfc0i8y5',
    api_key: '618594465543911',
    api_secret: 'BdTnwIiVUv1QKm9KpNxLumeJwE0'
  });

  try {
    // Menghasilkan timestamp dalam detik untuk keperluan signature
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Membuat signature digital yang valid untuk mengamankan proses upload
    const signature = cloudinary.utils.api_sign_request(
      { timestamp: timestamp },
      'BdTnwIiVUv1QKm9KpNxLumeJwE0'
    );

    // Mengirimkan data autentikasi kembali ke frontend
    res.status(200).json({
      signature: signature,
      timestamp: timestamp,
      cloud_name: 'dyfc0i8y5',
      api_key: '618594465543911'
    });
  } catch (error) {
    // Mengirimkan respon error jika proses pembuatan signature gagal
    res.status(500).json({ error: "Gagal otentikasi ke Cloudinary" });
  }
}