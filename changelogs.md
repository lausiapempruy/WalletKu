# WalletKu Changelogs

## v2.3.0 — 26 Juli 2026

### 🎨 Design Overhaul — iOS 26 Liquid Glass
- Desain total dibangun ulang mengikuti Apple iOS 26 design language
- Liquid Glass material — multi-layer glassmorphism, acrylic surfaces, frosted panels
- Aurora background ambient dengan 4 orb animasi + noise texture overlay
- Cursor-reactive glow lighting yang mengikuti posisi mouse
- Bento grid layout (12-column) menggantikan sidebar-only layout lama
- Inter font family — clean, Apple-feel, menggantikan Syne+DM Sans
- Light / Dark mode toggle — disimpan otomatis ke localStorage
- Spring physics animations di semua interaksi
- 3D card tilt effect pada hover wallet cards dan stat cards
- Shimmer accent lines, goal bar shimmer, sidebar user card shimmer
- FAB (Floating Action Button) quick-add transaction dari halaman mana saja
- Toast notifications iPhone-style — muncul dari atas tengah layar
- Modal bottom-sheet style di mobile, centered di desktop
- Topbar glassmorphism sticky dengan blur

### ✨ Fitur Baru
- **Multi-currency** — tiap wallet bisa punya currency sendiri (IDR, USD, EUR, SGD, MYR), dengan currency override per transaksi
- **Recurring Transactions** — set langganan, gaji, tagihan bulanan/mingguan/harian/tahunan; auto-create transaksi saat jatuh tempo
- **Budget per Kategori** — set limit pengeluaran per kategori per bulan, notifikasi otomatis saat 90% dan 100% tercapai
- **Internal Transfer** — transfer saldo antar wallet langsung dari halaman Wallets, otomatis tercatat sebagai 2 transaksi
- **Savings Goals** — multiple goal per item (bukan global lagi), tiap goal bisa diisi dana secara manual, ada deadline target
- **Wishlist** — list barang yang mau dibeli, bisa tandai sebagai sudah dibeli, ada link dan harga
- **Tags per Transaksi** — #penting, #rutin, #impulsif, #hemat, dll; bisa difilter di halaman Transaksi
- **Daily Notes / Memo** — catatan harian keuangan, bisa edit dan hapus
- **Analytics Page** — dedicated page dengan: trend 12 bulan, perbandingan bulan ini vs bulan lalu (MoM), proyeksi pengeluaran akhir bulan, streak hari aktif, top kategori pengeluaran, heatmap aktivitas 10 minggu
- **Notification System** — panel notifikasi iPhone-style di topbar, alert budget otomatis, notifikasi recurring transaction, notifikasi goal tercapai
- **Backup Code** — generate kode emergency di Settings (tidak mengganti PIN)
- **Halaman Shortcuts** — daftar lengkap semua keyboard shortcut dengan deskripsi

### ⌨️ Keyboard & UX Improvements
- PIN screen: ketik angka langsung dari keyboard PC tanpa klik manual
- Non-angka di PIN screen: flash error singkat tanpa mengubah PIN yang sudah diisi
- Modal Batal: shortcut `X` (hanya aktif saat tidak mengetik di input)
- Modal Simpan: shortcut `Enter` hanya saat tombol Simpan dalam fokus (tidak konflik dengan form)
- Shortcut hint ditampilkan saat hover tombol Simpan & Batal

### 🔒 Security & Bug Fixes
- **CRITICAL FIX**: `VERIFY_KEY` dikembalikan ke `'WALLETKU_OK'` agar kompatibel dengan data lama — PIN yang benar tidak lagi ditolak
- **CRITICAL FIX**: `LS_DATA` dikembalikan ke `'wk_data_v2'` agar data localStorage lama tetap terbaca
- **FIX**: `verifyPIN` sekarang accept kedua nilai verify lama dan baru (backward compatible)
- **FIX**: `saltBuf` selalu di-wrap `new Uint8Array(unb64(...))` — fix bug subtle di mana `deriveKey` menerima `ArrayBuffer` raw bukan `Uint8Array`
- **FIX**: Change PIN di Settings kena fix yang sama
- Enkripsi tetap AES-GCM 256-bit + PBKDF2 200.000 iterasi
- PIN tidak pernah disimpan ke disk — hanya dipakai derive key lalu di-cache di sessionStorage per sesi
- File `.gitignore` ditambahkan — backup JSON, PNG export, env secrets, dan OS files tidak ikut di-commit

### 🗑️ Dihapus
- Recap WalletKu (`recap.html`) dihapus total dari v2.3
- File `wallet.js` direbrand menjadi `app.js`
- `script.js` (v2.0) tidak lagi digunakan

---

## v2.2.0 — 28 Mei 2025

### ✨ New Features
- Login system dengan username registration — no Firebase, pure localStorage
- Halaman Shortcuts di sidebar nav: daftar lengkap keyboard shortcut + deskripsi
- Recap WalletKu (`recap.html`): animasi fullscreen Spotify/Discord-style, 2 menit, auto-advance per slide
- Recap konten: total pemasukan & pengeluaran, wallet terkaya, kategori terbesar, transaksi terbesar, streak, total saldo
- Recap membutuhkan minimal 30 transaksi; cooldown 7 hari setelah ditonton
- Skip recap → Summary slide → Share Card (bisa di-screenshot/export)
- Sound effects kontekstual — Web Audio API, tanpa file external
- File `script.js` direbrand menjadi `wallet.js`
- `changelogs.md` ditambahkan, diload otomatis di halaman Changelog

### ⌨️ Keyboard Shortcuts
- PIN: ketik angka langsung dari keyboard PC
- Modal Batal: shortcut `X`
- Modal Simpan: `Enter` saat tombol Simpan difokus

### 🐛 Fixes
- Shortcut `Enter` tidak nyasar ke halaman lain
- Wallet balance correctly reverses on transaction edit

---

## v2.1.0 — 6 Mei 2025

### ✨ New Features
- Login system dengan username — pure localStorage, no Firebase
- Account Settings: ganti username, ganti PIN, export/import backup data
- Changelog page — card layout, load dari `changelogs.md`
- Sound effects — Web Audio API, kontekstual per aksi

### 🎨 Design
- Particle background dengan glow trails
- 3D card tilt + parallax hover
- Spring physics toast
- Multi-layer glassmorphism backdrop-filter
- Staggered entrance animations

### 🔒 Security
- Username disimpan di localStorage biasa, terpisah dari data terenkripsi
- PIN tetap jadi encryption key — data di-encrypt AES-GCM per sesi

---

## v2.0.0 — 5 Mei 2025

### ✨ New Features
- Full PIN-based encryption (AES-GCM + PBKDF2 200k iterasi)
- Multi-wallet (unlimited, custom icon + warna)
- Tambah, edit, hapus transaksi dengan real-time balance
- Dashboard dengan 7-day bar chart + expense pie chart
- Filter transaksi: wallet, tipe, kategori, tanggal, search
- Global savings goal dengan progress bar
- Export snapshot: 1440p (instant) dan 4K (delay 10 detik)
- Sidebar navigation collapsible mobile
- Lock app button

### 🎨 Design
- Dark luxury fintech aesthetic
- Glassmorphism cards dengan gold accent
- Syne + DM Sans typography
- Responsive layout mobile-first

---

## v1.0.0 — 1 Mei 2025

### 🎉 Initial Release
- Basic wallet tracker (single wallet)
- Income dan expense logging
- Simple localStorage (unencrypted)
- Minimal UI, IDR currency
