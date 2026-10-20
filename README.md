# 🎵 Upacara Song Repository

Repositori ini khusus menyimpan koleksi file audio/MIDI dan katalog lagu (songs.json) untuk aplikasi **Upacara Player** (Pengiring Upacara Bendera & Koor).

Dengan memisahkan file audio dan daftar lagu ke repositori ini, pembaruan koleksi lagu dapat dilakukan kapan saja tanpa harus mengubah kode aplikasi web Upacara Player.

---

## 📁 Struktur Repositori

`	ext
Upacara Song Repository/
├── audio/                          # Folder berisi file fisik audio
│   ├── indonesia_raya.mid
│   ├── mengheningkan_cipta.mid
│   ├── padamu_negeri.mp3
│   ├── syukur.mp3
│   └── ...
├── songs.json                      # Metadata & katalog daftar lagu
├── Update-Catalog.ps1              # Script otomatis sinkronisasi audio -> songs.json
└── README.md                       # Panduan penggunaan repositori
`

---

## 🚀 Cara Menghubungkan ke GitHub (Hosting Gratis)

### Langkah 1: Buat Repositori Baru di GitHub
1. Buka [GitHub](https://github.com/new).
2. Beri nama repositori, misalnya: upacara-songs.
3. Pilih opsi **Public**.
4. Klik **Create repository**.

### Langkah 2: Inisialisasi & Push dari Folder Ini
Buka terminal (PowerShell atau Git Bash) di folder ini, lalu jalankan:

`powershell
git init
git add .
git commit -m "feat: inisialisasi koleksi lagu upacara"
git branch -M main
git remote add origin https://github.com/USERNAME/upacara-songs.git
git push -u origin main
`
*(Ganti USERNAME dengan username GitHub Anda)*

---

## 🌐 Format URL untuk Digunakan di Upacara Player

Setelah di-push ke GitHub, Anda dapat menggunakan salah satu dari URL berikut di Upacara Player:

### Opsi A: CDN jsDelivr (Sangat Direkomendasikan - Cepat & Bebas Batas Kuota)
* **Katalog JSON:**
  https://cdn.jsdelivr.net/gh/USERNAME/upacara-songs@main/songs.json
* **File Audio:** Otomatis terbaca melalui jalur udio/... dari base URL repositori.

### Opsi B: GitHub Raw
* **Katalog JSON:**
  https://raw.githubusercontent.com/USERNAME/upacara-songs/main/songs.json

---

## ➕ Cara Menambah Lagu Baru

1. Masukkan file audio baru (.mp3, .wav, atau .mid) ke dalam folder udio/.
2. Buka songs.json dan tambahkan data lagu baru mengikuti format:

`json
{
  "id": "nama_lagu_unik",
  "title": "Nama Lagu Lengkap",
  "category": "Upacara Wajib",
  "directUrl": "audio/nama_lagu.mp3",
  "isMidi": false,
  "description": "Deskripsi singkat mengenai pencipta atau fungsi lagu"
}
`

> **Kategori yang didukung di Upacara Player:**
> - Upacara Wajib
> - Lagu Nasional
> - Hymne & Mars
> - Pemanasan Vokal
> - Lagu Pilihan

3. Commit dan push ke GitHub:
`powershell
git add .
git commit -m "add: tambah lagu baru [nama lagu]"
git push
`

---

## 💡 Tips
* Untuk file lagu berukuran besar atau banyak, GitHub memiliki batasan 100 MB per file (sangat cukup untuk audio).
* Begitu diunduh sekali melalui Upacara Player, seluruh lagu akan tersimpan di browser (**IndexedDB**), sehingga tetap bisa diputar saat offline di lapangan upacara!
