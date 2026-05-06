# WalletKu Changelogs

## v2.1.0 — 2025-05-06
### ✨ New Features
- Login system with username registration — no Firebase, pure localStorage
- Username stored separately from encrypted data, PIN still the encryption key
- Account Settings page: change username, change PIN, export data backup
- Changelog page — card layout, loads from `changelogs.md` dynamically
- Sound effects system — contextual mix: sci-fi beeps, soft UI clicks, game-like pops
- 🎵 Sounds: PIN tap, login success, error shake, transaction added, delete confirm, toast pop

### 🎨 Design Overhaul
- MAKSIMAL animations — particle background with glow trails
- Full 3D card tilt + parallax on hover (perspective transform)
- GPU-accelerated micro-interactions on every interactive element
- Glowing border animations on active cards
- Staggered entrance animations per element
- Blur glassmorphism layers upgraded — multi-layer backdrop-filter
- Sidebar hover with 3D depth push effect
- Toast notifications with spring physics animation
- Ambient particle system running in canvas background

### 🔒 Security
- PIN lock unchanged — AES-GCM 256-bit, PBKDF2 200k iterations
- Username flow: register on first run → brief delay → re-login (no data wipe)
- Logout clears session only, all encrypted data stays safe
- Export backup is JSON encrypted snapshot

### 🐛 Fixes
- Wallet balance correctly reverses on transaction edit
- Chart canvas properly destroyed before re-render
- Modal overlay click-outside now works on all pages

---

## v2.0.0 — 2025-05-05
### ✨ New Features
- Full PIN-based encryption (AES-GCM + PBKDF2)
- Multi-wallet system (unlimited, custom icon + color)
- Transaction management: add, edit, delete with real-time balance
- Dashboard with 7-day bar chart and expense pie chart
- Filter by wallet, type, category, date range, search
- Global savings goal with progress bar
- Export snapshot: 1440p (instant) and 4K (10-second render delay)
- Sidebar navigation with collapsible mobile support
- Lock app button to re-engage PIN screen

### 🎨 Design
- Dark luxury fintech aesthetic
- Glassmorphism cards with gold accent
- Syne + DM Sans typography
- Responsive layout (mobile-first sidebar)
- Smooth CSS transitions throughout

### 🔒 Security
- All data AES-GCM encrypted at rest in localStorage
- PIN never stored — used only to derive encryption key
- Salt stored separately, 200k PBKDF2 iterations

---

## v1.0.0 — 2025-05-01
### 🎉 Initial Release
- Basic wallet tracker (single wallet)
- Income and expense logging
- Simple localStorage persistence (unencrypted)
- Minimal UI with IDR currency support
