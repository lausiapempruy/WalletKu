# WalletKu Changelogs

## v1.4.1 — 29 Juli 2026

### 🐛 Bug Fixes & Updates
- **CRITICAL FIX**: PIN selalu incorrect padahal PIN benar — disebabkan `VERIFY_KEY` berubah antar versi (`'WALLETKU_OK_V23'` vs `'WALLETKU_OK'`); dikembalikan ke nilai asal agar data lama tetap bisa dibuka
- **CRITICAL FIX**: `LS_DATA` berubah dari `wk_data_v2` ke `wk_data_v3` — data localStorage lama tidak terbaca; dikembalikan ke `wk_data_v2`
- **FIX**: `verifyPIN` sekarang accept kedua nilai verify (backward compatible dengan semua versi sebelumnya)
- **FIX**: `saltBuf` selalu di-wrap `new Uint8Array(unb64(...))` — fix bug subtle di mana `deriveKey` menerima `ArrayBuffer` raw bukan `Uint8Array`; berlaku juga di Change PIN (Settings)
- Favicon ditambahkan — ikon ◈ muncul di browser tab (SVG inline, tanpa file eksternal)
- Halaman Changelog ditambahkan ke sidebar nav
- Versi renaming: skema v2.x.x → v1.x (lihat detail di bawah)
- `.gitignore` ditambahkan untuk keamanan repo

---

## v1.4.0 — 26 Juli 2026

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

### ✨ Fitur Baru
- **Multi-currency** — tiap wallet bisa punya currency sendiri (IDR, USD, EUR, SGD, MYR), dengan currency override per transaksi
- **Recurring Transactions** — set langganan, gaji, tagihan; auto-create transaksi saat jatuh tempo
- **Budget per Kategori** — set limit pengeluaran per bulan, notifikasi otomatis saat 90% dan 100% tercapai
- **Internal Transfer** — transfer saldo antar wallet, otomatis tercatat sebagai 2 transaksi
- **Savings Goals** — multiple goal per item, bisa diisi dana manual, ada deadline target
- **Wishlist** — list barang yang mau dibeli, tandai sebagai sudah dibeli, ada link dan harga
- **Tags per Transaksi** — #penting, #rutin, #impulsif, dll; bisa difilter
- **Daily Notes / Memo** — catatan harian keuangan, bisa edit dan hapus
- **Analytics Page** — trend 12 bulan, MoM comparison, proyeksi pengeluaran, streak, heatmap aktivitas 10 minggu
- **Notification System** — panel notifikasi iPhone-style, alert budget otomatis, notifikasi recurring & goal
- **Backup Code** — generate kode emergency di Settings
- **Halaman Shortcuts** — daftar lengkap keyboard shortcut dengan deskripsi

### ⌨️ Keyboard & UX
- PIN screen: ketik angka langsung dari keyboard PC tanpa klik manual
- Non-angka di PIN: flash error singkat tanpa mengubah PIN yang sudah diisi
- Modal Batal: shortcut `X` (hanya aktif saat tidak mengetik di input)
- Modal Simpan: `Enter` hanya saat tombol Simpan dalam fokus

### 🗑️ Dihapus
- Recap WalletKu (`recap.html`) dihapus total
- `wallet.js` diganti menjadi `app.js`

---

## v1.3.0 — 28 Mei 2025

### ✨ New Features
- Login system dengan username registration — no Firebase, pure localStorage
- Halaman Shortcuts di sidebar nav
- Recap WalletKu (`recap.html`) — animasi fullscreen Spotify/Discord-style, 2 menit, slide auto-advance
- Recap: total pemasukan & pengeluaran, wallet terkaya, kategori terbesar, transaksi terbesar, streak, saldo total
- Recap membutuhkan minimal 30 transaksi; cooldown 7 hari setelah ditonton
- Skip → Summary slide → Share Card (bisa di-export)
- Sound effects kontekstual via Web Audio API
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

## v1.2.0 — 6 Mei 2025

### ✨ New Features
- Login system dengan username — pure localStorage, no Firebase
- Account Settings: ganti username, ganti PIN, export/import backup data
- Changelog page — card layout, load dari `changelogs.md`
- Sound effects — Web Audio API, kontekstual per aksi

### 🎨 Design
- Particle background dengan glow trails
- 3D card tilt + parallax hover
- Spring physics toast notifications
- Multi-layer glassmorphism backdrop-filter
- Staggered entrance animations

### 🔒 Security
- Username disimpan di localStorage biasa, terpisah dari data terenkripsi
- PIN tetap jadi encryption key — AES-GCM per sesi

---

## v1.1.0 — 5 Mei 2025

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
