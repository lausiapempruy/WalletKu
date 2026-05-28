# WalletKu Changelogs

## v2.2.0 — 2025-05-28
### ✨ New Features
- Recap WalletKu (`recap.html`): animasi fullscreen Spotify/Discord-style, 2 menit, auto-advance per slide
- Recap konten: total pemasukan & pengeluaran, wallet terkaya, kategori terbesar, transaksi terbesar, streak hari aktif, total saldo
- Recap membutuhkan minimal 30 transaksi untuk diaktifkan
- Tombol "Cek Semua Transaksi Untuk Recap" dengan delay 5 detik scanning
- Recap sistem 7 hari: setelah nonton dapat cap, bisa rewatch 7 hari, habis masa tutup otomatis
- Skip recap → masuk Summary slide → Share Card cantik (bisa screenshot/export)
- Sound on di recap (Web Audio API — music-like ambient + accent tones)
- Konfeti & warna pop di highlight slide
- Halaman Shortcuts di sidebar nav: daftar lengkap semua keyboard shortcut + deskripsi
- File script.js direbrand jadi wallet.js

### ⌨️ Keyboard Shortcuts
- PIN screen: typing angka langsung dari keyboard PC (tanpa klik manual), non-angka auto-error sementara
- Modal Simpan: Enter trigger Simpan hanya kalau tombol Simpan sedang di-focus
- Modal Batal: shortcut X saat modal terbuka
- Shortcut hint muncul saat hover tombol Simpan & Batal
- Semua shortcut terdaftar di halaman `/shortcuts` di sidebar

### 🐛 Fixes
- Shortcut Enter tidak nyasar ke halaman lain atau trigger aksi yang salah
- Shortcut X tidak konflik dengan input teks

---

## v2.1.0 — 2025-05-06
### ✨ New Features
- Login system dengan username registration — no Firebase, pure localStorage
- Username stored separately dari encrypted data, PIN tetap jadi encryption key
- Account Settings: ganti username, ganti PIN, export/import data backup
- Changelog page — card layout, load dari `changelogs.md` dinamis
- Sound effects system — contextual mix via Web Audio API
- Sounds: PIN tap, login success, error shake, transaction added, delete, toast pop

### 🎨 Design Overhaul
- Particle background dengan glow trails
- Full 3D card tilt + parallax on hover
- GPU-accelerated micro-interactions
- Glowing border animations
- Staggered entrance animations
- Multi-layer glassmorphism backdrop-filter
- Spring physics toast notifications

### 🔒 Security
- PIN lock unchanged — AES-GCM 256-bit, PBKDF2 200k iterations
- Username flow: register → delay → login (no data wipe)
- Export backup adalah JSON encrypted snapshot

---

## v2.0.0 — 2025-05-05
### ✨ New Features
- Full PIN-based encryption (AES-GCM + PBKDF2)
- Multi-wallet system (unlimited, custom icon + color)
- Transaction management: add, edit, delete dengan real-time balance
- Dashboard dengan 7-day bar chart dan expense pie chart
- Filter by wallet, type, category, date range, search
- Global savings goal dengan progress bar
- Export snapshot: 1440p (instant) dan 4K (10-second delay)
- Sidebar navigation collapsible mobile
- Lock app button

### 🎨 Design
- Dark luxury fintech aesthetic
- Glassmorphism cards dengan gold accent
- Syne + DM Sans typography
- Responsive layout (mobile-first)

---

## v1.0.0 — 2025-05-01
### 🎉 Initial Release
- Basic wallet tracker (single wallet)
- Income dan expense logging
- Simple localStorage persistence
- Minimal UI dengan IDR currency
