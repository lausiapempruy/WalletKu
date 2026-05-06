/* ============================================
   WALLETKU — script.js
   PIN-locked · AES-GCM Encrypted localStorage
   ============================================ */

'use strict';

// ──────────────────────────────────────────────
// CONSTANTS & STATE
// ──────────────────────────────────────────────
const LS_SALT      = 'wk_salt_v2';
const LS_VERIFY    = 'wk_verify_v2';
const LS_DATA      = 'wk_data_v2';
const VERIFY_PLAIN = 'WALLETKU_OK';

const EMOJI_LIST = ['💰','💳','🏦','🏧','📦','🛒','✈️','🎓','💊','🏠','🚗','🍕','☕','🎮','💎','🌟','🎯','🔑','🌿','⚡'];
const COLORS     = ['#c9a84c','#2dd98f','#5b8dee','#f25c5c','#a78bfa','#fb923c','#38bdf8','#f472b6','#34d399','#e879f9'];
const CATEGORIES = ['Makanan','Transport','Belanja','Hiburan','Kesehatan','Pendidikan','Tabungan','Gaji','Bonus','Transfer','Lainnya'];

let cryptoKey = null;    // CryptoKey after unlock
let state = {
  wallets: [],
  transactions: [],
  goals: [],
  settings: { currency: 'IDR', createdAt: null }
};
let currentPage = 'dashboard';
let charts = {};

// ──────────────────────────────────────────────
// CRYPTO HELPERS (AES-GCM, PBKDF2)
// ──────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer;
}

async function deriveKey(pin, saltBuf) {
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 200000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

async function encrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
  );
  return bufToB64(iv) + '.' + bufToB64(ct);
}

async function decrypt(key, ciphertext) {
  const [ivB64, ctB64] = ciphertext.split('.');
  const iv = b64ToBuf(ivB64);
  const ct = b64ToBuf(ctB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, ct);
  return dec.decode(pt);
}

// ──────────────────────────────────────────────
// STORAGE
// ──────────────────────────────────────────────
async function saveData() {
  if (!cryptoKey) return;
  const json = JSON.stringify(state);
  const cipher = await encrypt(cryptoKey, json);
  localStorage.setItem(LS_DATA, cipher);
}

async function loadData() {
  const raw = localStorage.getItem(LS_DATA);
  if (!raw) return;
  try {
    const json = await decrypt(cryptoKey, raw);
    state = JSON.parse(json);
  } catch(e) {
    console.warn('Data decrypt failed', e);
  }
}

// ──────────────────────────────────────────────
// PIN SCREEN
// ──────────────────────────────────────────────
let pinBuffer = '';
let isSetup = false;
let pinConfirmBuffer = '';
let isConfirming = false;

function initPinScreen() {
  const hasSalt = !!localStorage.getItem(LS_SALT);
  const hasVerify = !!localStorage.getItem(LS_VERIFY);
  isSetup = !(hasSalt && hasVerify);

  const sub = document.getElementById('pinSub');
  const hint = document.getElementById('pinHint');

  if (isSetup) {
    sub.textContent = 'Buat PIN 6 digit untuk WalletKu';
    hint.textContent = 'PIN ini akan mengenkripsi semua data kamu';
  } else {
    sub.textContent = 'Masukkan PIN untuk membuka';
    hint.textContent = '';
  }

  document.querySelectorAll('.pin-btn[data-val]').forEach(btn => {
    btn.addEventListener('click', () => handlePinInput(btn.dataset.val));
  });
  document.getElementById('pinDel').addEventListener('click', handlePinDel);
  document.addEventListener('keydown', handlePinKeyboard);
}

function handlePinKeyboard(e) {
  if (!document.getElementById('pinScreen').offsetParent) return;
  if (e.key >= '0' && e.key <= '9') handlePinInput(e.key);
  if (e.key === 'Backspace') handlePinDel();
}

function handlePinInput(val) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += val;
  updatePinDots(pinBuffer.length);
  if (pinBuffer.length === 6) {
    setTimeout(() => processPinEntry(), 200);
  }
}

function handlePinDel() {
  if (pinBuffer.length > 0) {
    pinBuffer = pinBuffer.slice(0, -1);
    updatePinDots(pinBuffer.length);
  }
}

function updatePinDots(count, mode = 'normal') {
  const dots = document.querySelectorAll('#pinDots span');
  dots.forEach((d, i) => {
    d.className = '';
    if (i < count) {
      d.classList.add(mode === 'error' ? 'error' : 'filled');
    }
  });
}

function setPinError(msg) {
  document.getElementById('pinError').textContent = msg;
  updatePinDots(6, 'error');
  setTimeout(() => {
    pinBuffer = '';
    updatePinDots(0);
    document.getElementById('pinError').textContent = '';
  }, 900);
}

async function processPinEntry() {
  if (isSetup) {
    if (!isConfirming) {
      // First entry — store temporarily
      pinConfirmBuffer = pinBuffer;
      pinBuffer = '';
      isConfirming = true;
      updatePinDots(0);
      document.getElementById('pinSub').textContent = 'Konfirmasi PIN kamu';
      document.getElementById('pinHint').textContent = 'Masukkan ulang PIN yang sama';
    } else {
      // Confirm
      if (pinBuffer !== pinConfirmBuffer) {
        setPinError('PIN tidak cocok, coba lagi');
        pinBuffer = '';
        isConfirming = false;
        pinConfirmBuffer = '';
        document.getElementById('pinSub').textContent = 'Buat PIN 6 digit untuk WalletKu';
        document.getElementById('pinHint').textContent = 'PIN ini akan mengenkripsi semua data kamu';
        return;
      }
      await setupPin(pinBuffer);
    }
  } else {
    await verifyPin(pinBuffer);
  }
}

async function setupPin(pin) {
  const saltBuf = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(LS_SALT, bufToB64(saltBuf));
  cryptoKey = await deriveKey(pin, saltBuf);
  const verifyEnc = await encrypt(cryptoKey, VERIFY_PLAIN);
  localStorage.setItem(LS_VERIFY, verifyEnc);
  state.settings.createdAt = new Date().toISOString();
  await saveData();
  unlockApp();
}

async function verifyPin(pin) {
  try {
    const saltBuf = b64ToBuf(localStorage.getItem(LS_SALT));
    const key = await deriveKey(pin, saltBuf);
    const verifyEnc = localStorage.getItem(LS_VERIFY);
    const plain = await decrypt(key, verifyEnc);
    if (plain !== VERIFY_PLAIN) throw new Error('Wrong PIN');
    cryptoKey = key;
    await loadData();
    unlockApp();
  } catch(e) {
    setPinError('PIN salah, coba lagi');
    pinBuffer = '';
  }
}

function unlockApp() {
  document.removeEventListener('keydown', handlePinKeyboard);
  document.getElementById('pinScreen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  initApp();
}

function lockApp() {
  cryptoKey = null;
  pinBuffer = '';
  isConfirming = false;
  isSetup = false;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('pinScreen').style.display = 'flex';
  // Reset pin screen
  updatePinDots(0);
  document.getElementById('pinError').textContent = '';
  initPinScreen();
}

// ──────────────────────────────────────────────
// APP INIT
// ──────────────────────────────────────────────
function initApp() {
  setupNav();
  document.getElementById('lockBtn').addEventListener('click', lockApp);
  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
  updateDate();
  navigateTo('dashboard');
}

function updateDate() {
  const now = new Date();
  document.getElementById('topbarDate').textContent =
    now.toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.page);
      closeSidebar();
    });
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const titles = { dashboard:'Dashboard', wallets:'Wallets', transactions:'Transaksi', goals:'Target Tabungan', export:'Export' };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  renderPage(page);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ──────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtIDR(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

function isToday(iso) {
  const d = new Date(iso);
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function totalBalance() {
  return state.wallets.reduce((s, w) => s + (w.balance || 0), 0);
}

function walletById(id) {
  return state.wallets.find(w => w.id === id);
}

// ──────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
  const icons = { success:'✅', error:'❌', info:'💡', warning:'⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ──────────────────────────────────────────────
// MODAL
// ──────────────────────────────────────────────
function openModal(title, bodyHTML, onConfirm = null) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalOverlay').onclick = (e) => { if (e.target === document.getElementById('modalOverlay')) closeModal(); };
  if (onConfirm) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `<button class="btn btn-ghost" id="modalCancel">Batal</button><button class="btn btn-primary" id="modalConfirm">Simpan</button>`;
    document.getElementById('modalBody').appendChild(footer);
    document.getElementById('modalCancel').onclick = closeModal;
    document.getElementById('modalConfirm').onclick = onConfirm;
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

function confirmDialog(msg, onYes) {
  openModal('Konfirmasi', `<p style="color:var(--text2);margin-bottom:0">${msg}</p>`);
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `<button class="btn btn-ghost" id="modalCancel">Batal</button><button class="btn btn-danger" id="modalConfirm">Hapus</button>`;
  document.getElementById('modalBody').appendChild(footer);
  document.getElementById('modalCancel').onclick = closeModal;
  document.getElementById('modalConfirm').onclick = () => { closeModal(); onYes(); };
}

// ──────────────────────────────────────────────
// PAGE RENDERER
// ──────────────────────────────────────────────
function renderPage(page) {
  // Destroy old charts
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e){} });
  charts = {};

  const content = document.getElementById('content');
  content.innerHTML = '';

  switch(page) {
    case 'dashboard':    renderDashboard(content); break;
    case 'wallets':      renderWallets(content); break;
    case 'transactions': renderTransactions(content); break;
    case 'goals':        renderGoals(content); break;
    case 'export':       renderExport(content); break;
  }
}

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────
function renderDashboard(el) {
  const txToday = state.transactions.filter(t => isToday(t.date));
  const totalIn  = state.transactions.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const totalOut = state.transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const todayIn  = txToday.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const todayOut = txToday.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard <span>◈</span></h1>
    </div>

    <div class="stat-grid">
      <div class="stat-card gold" style="animation-delay:0s">
        <div class="stat-label">Total Saldo</div>
        <div class="stat-value gold">${fmtIDR(totalBalance())}</div>
        <div class="stat-sub">${state.wallets.length} wallet aktif</div>
      </div>
      <div class="stat-card green" style="animation-delay:.05s">
        <div class="stat-label">Total Pemasukan</div>
        <div class="stat-value green">${fmtIDR(totalIn)}</div>
        <div class="stat-sub">Semua waktu</div>
      </div>
      <div class="stat-card red" style="animation-delay:.1s">
        <div class="stat-label">Total Pengeluaran</div>
        <div class="stat-value red">${fmtIDR(totalOut)}</div>
        <div class="stat-sub">Semua waktu</div>
      </div>
      <div class="stat-card blue" style="animation-delay:.15s">
        <div class="stat-label">Transaksi Hari Ini</div>
        <div class="stat-value">${txToday.length}</div>
        <div class="stat-sub">+${fmtIDR(todayIn)} / -${fmtIDR(todayOut)}</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Arus Kas 7 Hari</span>
        </div>
        <div class="chart-wrap">
          <canvas id="chartBar"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Pengeluaran per Kategori</span>
        </div>
        <div class="chart-wrap">
          <canvas id="chartPie"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Transaksi Hari Ini</span>
        <button class="btn btn-primary btn-sm" id="addTxBtn">+ Tambah</button>
      </div>
      <div class="today-list" id="todayList">
        ${txToday.length === 0 ? `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada transaksi hari ini</div></div>` : txToday.slice().reverse().map(t => txItemHTML(t)).join('')}
      </div>
    </div>
  `;

  // Bind add button
  document.getElementById('addTxBtn').addEventListener('click', showAddTransactionModal);

  // Bind tx actions
  el.querySelectorAll('.tx-edit').forEach(b => b.addEventListener('click', () => showEditTransactionModal(b.dataset.id)));
  el.querySelectorAll('.tx-del').forEach(b => b.addEventListener('click', () => deleteTransaction(b.dataset.id)));

  // Charts
  renderBarChart();
  renderPieChart();
}

function renderBarChart() {
  const ctx = document.getElementById('chartBar');
  if (!ctx) return;
  const days = [];
  const incomes = [];
  const expenses = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('id-ID', { day:'numeric', month:'short' });
    days.push(label);
    const dayTx = state.transactions.filter(t => {
      const td = new Date(t.date);
      return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    incomes.push(dayTx.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0));
    expenses.push(dayTx.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0));
  }

  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        { label: 'Pemasukan', data: incomes, backgroundColor: 'rgba(45,217,143,0.6)', borderRadius: 6, borderSkipped: false },
        { label: 'Pengeluaran', data: expenses, backgroundColor: 'rgba(242,92,92,0.6)', borderRadius: 6, borderSkipped: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b92a8', font: { family: 'DM Sans', size: 11 }, boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: '#555e78', font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#555e78', font: { family: 'DM Sans', size: 10 }, callback: v => 'Rp'+Intl.NumberFormat('id-ID',{notation:'compact'}).format(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderPieChart() {
  const ctx = document.getElementById('chartPie');
  if (!ctx) return;
  const expTx = state.transactions.filter(t => t.type === 'expense');
  if (expTx.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state" style="padding:40px 0"><div class="empty-icon">🍩</div><div class="empty-text">Belum ada data pengeluaran</div></div>';
    return;
  }
  const catMap = {};
  expTx.forEach(t => { catMap[t.category] = (catMap[t.category]||0) + t.amount; });
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);
  const bgColors = ['#c9a84c','#2dd98f','#5b8dee','#f25c5c','#a78bfa','#fb923c','#38bdf8','#f472b6','#34d399','#e879f9','#fbbf24'];

  charts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: bgColors.slice(0, labels.length), borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { color: '#8b92a8', font: { family: 'DM Sans', size: 10 }, boxWidth: 10, padding: 8 } }
      }
    }
  });
}

// ──────────────────────────────────────────────
// WALLETS PAGE
// ──────────────────────────────────────────────
function renderWallets(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Wallets <span>◎</span></h1>
    </div>
    <div class="wallet-grid" id="walletGrid">
      ${state.wallets.map((w, i) => walletCardHTML(w, i)).join('')}
      <div class="add-wallet-card" id="addWalletBtn">
        <div class="add-wallet-icon">+</div>
        <div class="add-wallet-text">Tambah Wallet</div>
      </div>
    </div>
  `;

  document.getElementById('addWalletBtn').addEventListener('click', showAddWalletModal);
  el.querySelectorAll('.wallet-edit').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); showEditWalletModal(b.dataset.id); }));
  el.querySelectorAll('.wallet-del').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); deleteWallet(b.dataset.id); }));
  el.querySelectorAll('.wallet-card[data-id]').forEach(c => c.addEventListener('click', () => {
    navigateTo('transactions');
    // store selected wallet filter
    setTimeout(() => {
      const sel = document.getElementById('filterWallet');
      if (sel) { sel.value = c.dataset.id; sel.dispatchEvent(new Event('change')); }
    }, 100);
  }));
}

function walletCardHTML(w, i) {
  const color = w.color || COLORS[i % COLORS.length];
  return `
    <div class="wallet-card" data-id="${w.id}" style="animation-delay:${i*0.05}s">
      <div class="wallet-card-accent" style="background:${color}"></div>
      <div class="wallet-icon" style="background:${color}22">${w.icon || '💰'}</div>
      <div class="wallet-name">${w.name}</div>
      <div class="wallet-balance" style="color:${color}">${fmtIDR(w.balance || 0)}</div>
      <div class="wallet-meta">
        <span class="badge" style="background:${color}22;color:${color}">${w.type || 'Wallet'}</span>
        <div class="wallet-actions">
          <button class="btn btn-ghost btn-icon btn-sm wallet-edit" data-id="${w.id}" title="Edit">✏️</button>
          <button class="btn btn-danger btn-icon btn-sm wallet-del" data-id="${w.id}" title="Hapus">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

// Wallet Modal
function showAddWalletModal() {
  openModal('Tambah Wallet', walletFormHTML(), async () => {
    const data = getWalletFormData();
    if (!data) return;
    state.wallets.push({ id: uid(), ...data, balance: 0, createdAt: new Date().toISOString() });
    await saveData();
    closeModal();
    toast('Wallet berhasil ditambahkan!', 'success');
    renderPage('wallets');
  });
  bindWalletFormEvents();
}

function showEditWalletModal(id) {
  const w = walletById(id);
  if (!w) return;
  openModal('Edit Wallet', walletFormHTML(w), async () => {
    const data = getWalletFormData();
    if (!data) return;
    Object.assign(w, data);
    await saveData();
    closeModal();
    toast('Wallet diperbarui!', 'success');
    renderPage('wallets');
  });
  bindWalletFormEvents(w);
}

function walletFormHTML(w = {}) {
  const selectedColor = w.color || COLORS[0];
  const selectedEmoji = w.icon || '💰';
  return `
    <div class="form-group">
      <label class="form-label">Nama Wallet</label>
      <input class="form-input" id="wName" placeholder="contoh: BCA, Cash, Dompet..." value="${w.name || ''}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Tipe</label>
        <select class="form-select" id="wType">
          ${['Tabungan','Cash','Dompet Digital','Investasi','Lainnya'].map(t => `<option value="${t}" ${w.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Saldo Awal</label>
        <input class="form-input" id="wBalance" type="number" placeholder="0" value="${w.balance || 0}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Ikon</label>
      <div class="emoji-options" id="emojiPicker">
        ${EMOJI_LIST.map(e => `<button type="button" class="emoji-opt ${e===selectedEmoji?'selected':''}" data-emoji="${e}">${e}</button>`).join('')}
      </div>
      <input type="hidden" id="wIcon" value="${selectedEmoji}" />
    </div>
    <div class="form-group">
      <label class="form-label">Warna</label>
      <div class="color-options" id="colorPicker">
        ${COLORS.map(c => `<div class="color-opt ${c===selectedColor?'selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
      </div>
      <input type="hidden" id="wColor" value="${selectedColor}" />
    </div>
  `;
}

function bindWalletFormEvents(w = {}) {
  document.querySelectorAll('.emoji-opt').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.emoji-opt').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      document.getElementById('wIcon').value = b.dataset.emoji;
    });
  });
  document.querySelectorAll('.color-opt').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.color-opt').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      document.getElementById('wColor').value = b.dataset.color;
    });
  });
}

function getWalletFormData() {
  const name = document.getElementById('wName').value.trim();
  if (!name) { toast('Nama wallet wajib diisi', 'error'); return null; }
  return {
    name,
    type:    document.getElementById('wType').value,
    balance: parseFloat(document.getElementById('wBalance').value) || 0,
    icon:    document.getElementById('wIcon').value,
    color:   document.getElementById('wColor').value,
  };
}

async function deleteWallet(id) {
  const w = walletById(id);
  confirmDialog(`Hapus wallet "<b>${w.name}</b>"? Semua transaksi di wallet ini juga akan terhapus.`, async () => {
    state.wallets = state.wallets.filter(w => w.id !== id);
    state.transactions = state.transactions.filter(t => t.walletId !== id);
    await saveData();
    toast('Wallet dihapus', 'info');
    renderPage('wallets');
  });
}

// ──────────────────────────────────────────────
// TRANSACTIONS PAGE
// ──────────────────────────────────────────────
let txFilters = { wallet: '', type: '', category: '', dateFrom: '', dateTo: '', search: '' };

function renderTransactions(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Transaksi <span>⟳</span></h1>
      <button class="btn btn-primary" id="addTxBtnPage">+ Tambah</button>
    </div>
    <div class="tx-filters">
      <input class="form-input" id="txSearch" placeholder="🔍 Cari..." value="${txFilters.search}" style="max-width:180px" />
      <select class="form-select" id="filterWallet" style="max-width:160px">
        <option value="">Semua Wallet</option>
        ${state.wallets.map(w => `<option value="${w.id}" ${txFilters.wallet===w.id?'selected':''}>${w.icon} ${w.name}</option>`).join('')}
      </select>
      <select class="form-select" id="filterType" style="max-width:140px">
        <option value="">Semua Tipe</option>
        <option value="income" ${txFilters.type==='income'?'selected':''}>Pemasukan</option>
        <option value="expense" ${txFilters.type==='expense'?'selected':''}>Pengeluaran</option>
      </select>
      <select class="form-select" id="filterCat" style="max-width:150px">
        <option value="">Semua Kategori</option>
        ${CATEGORIES.map(c => `<option value="${c}" ${txFilters.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <input class="form-input" type="date" id="filterFrom" value="${txFilters.dateFrom}" style="max-width:150px" />
      <input class="form-input" type="date" id="filterTo" value="${txFilters.dateTo}" style="max-width:150px" />
      <button class="btn btn-ghost btn-sm" id="clearFilters">Reset</button>
    </div>
    <div class="tx-list" id="txList"></div>
  `;

  document.getElementById('addTxBtnPage').addEventListener('click', showAddTransactionModal);
  document.getElementById('filterWallet').addEventListener('change', e => { txFilters.wallet = e.target.value; renderTxList(); });
  document.getElementById('filterType').addEventListener('change', e => { txFilters.type = e.target.value; renderTxList(); });
  document.getElementById('filterCat').addEventListener('change', e => { txFilters.category = e.target.value; renderTxList(); });
  document.getElementById('filterFrom').addEventListener('change', e => { txFilters.dateFrom = e.target.value; renderTxList(); });
  document.getElementById('filterTo').addEventListener('change', e => { txFilters.dateTo = e.target.value; renderTxList(); });
  document.getElementById('txSearch').addEventListener('input', e => { txFilters.search = e.target.value; renderTxList(); });
  document.getElementById('clearFilters').addEventListener('click', () => {
    txFilters = { wallet:'', type:'', category:'', dateFrom:'', dateTo:'', search:'' };
    renderPage('transactions');
  });

  renderTxList();
}

function getFilteredTx() {
  return state.transactions.filter(t => {
    if (txFilters.wallet && t.walletId !== txFilters.wallet) return false;
    if (txFilters.type && t.type !== txFilters.type) return false;
    if (txFilters.category && t.category !== txFilters.category) return false;
    if (txFilters.dateFrom && t.date < txFilters.dateFrom) return false;
    if (txFilters.dateTo && t.date > txFilters.dateTo + 'T23:59:59') return false;
    if (txFilters.search) {
      const q = txFilters.search.toLowerCase();
      if (!t.note.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b) => new Date(b.date) - new Date(a.date));
}

function renderTxList() {
  const list = document.getElementById('txList');
  if (!list) return;
  const filtered = getFilteredTx();
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Tidak ada transaksi</div></div>`;
    return;
  }
  list.innerHTML = filtered.map(t => txItemHTML(t)).join('');
  list.querySelectorAll('.tx-edit').forEach(b => b.addEventListener('click', () => showEditTransactionModal(b.dataset.id)));
  list.querySelectorAll('.tx-del').forEach(b => b.addEventListener('click', () => deleteTransaction(b.dataset.id)));
}

function txItemHTML(t) {
  const wallet = walletById(t.walletId);
  const wName  = wallet ? `${wallet.icon} ${wallet.name}` : 'Unknown';
  return `
    <div class="tx-item">
      <div class="tx-icon ${t.type}">${t.type === 'income' ? '↑' : '↓'}</div>
      <div class="tx-info">
        <div class="tx-name">${t.note || t.category}</div>
        <div class="tx-meta">${t.category} · ${wName} · ${fmtDate(t.date)}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmtIDR(t.amount)}</div>
      <div class="tx-actions">
        <button class="btn btn-ghost btn-icon btn-sm tx-edit" data-id="${t.id}" title="Edit">✏️</button>
        <button class="btn btn-danger btn-icon btn-sm tx-del" data-id="${t.id}" title="Hapus">🗑️</button>
      </div>
    </div>
  `;
}

function showAddTransactionModal() {
  if (state.wallets.length === 0) { toast('Buat wallet dulu ya!', 'warning'); navigateTo('wallets'); return; }
  openModal('Tambah Transaksi', txFormHTML(), async () => {
    const data = getTxFormData();
    if (!data) return;
    const tx = { id: uid(), ...data, date: new Date().toISOString(), createdAt: new Date().toISOString() };
    state.transactions.push(tx);
    // Update wallet balance
    const wallet = walletById(data.walletId);
    if (wallet) wallet.balance = (wallet.balance || 0) + (data.type === 'income' ? data.amount : -data.amount);
    await saveData();
    closeModal();
    toast(`${data.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} dicatat!`, 'success');
    renderPage(currentPage);
  });
  bindTxFormEvents();
}

function showEditTransactionModal(id) {
  const t = state.transactions.find(tx => tx.id === id);
  if (!t) return;
  openModal('Edit Transaksi', txFormHTML(t), async () => {
    const data = getTxFormData();
    if (!data) return;
    // Reverse old balance change
    const oldWallet = walletById(t.walletId);
    if (oldWallet) oldWallet.balance += (t.type === 'income' ? -t.amount : t.amount);
    // Apply new
    Object.assign(t, data);
    const newWallet = walletById(data.walletId);
    if (newWallet) newWallet.balance += (data.type === 'income' ? data.amount : -data.amount);
    await saveData();
    closeModal();
    toast('Transaksi diperbarui!', 'success');
    renderPage(currentPage);
  });
  bindTxFormEvents(t);
}

function txFormHTML(t = {}) {
  const isIncome = t.type === 'income';
  return `
    <div class="type-toggle">
      <button type="button" class="type-btn ${!t.type || isIncome ? '' : 'active expense'}" id="typeExpense" data-type="expense">− Pengeluaran</button>
      <button type="button" class="type-btn ${!t.type || isIncome ? 'active income' : ''}" id="typeIncome" data-type="income">+ Pemasukan</button>
    </div>
    <input type="hidden" id="txType" value="${t.type || 'income'}" />
    <div class="form-group">
      <label class="form-label">Wallet</label>
      <select class="form-select" id="txWallet">
        ${state.wallets.map(w => `<option value="${w.id}" ${t.walletId===w.id?'selected':''}>${w.icon} ${w.name} (${fmtIDR(w.balance||0)})</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Jumlah (Rp)</label>
        <input class="form-input" id="txAmount" type="number" placeholder="0" value="${t.amount || ''}" min="1" />
      </div>
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select class="form-select" id="txCategory">
          ${CATEGORIES.map(c => `<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Catatan</label>
      <input class="form-input" id="txNote" placeholder="Opsional..." value="${t.note || ''}" />
    </div>
  `;
}

function bindTxFormEvents(t = {}) {
  const setType = (type) => {
    document.getElementById('txType').value = type;
    document.getElementById('typeIncome').classList.toggle('active', type === 'income');
    document.getElementById('typeIncome').classList.toggle('income', type === 'income');
    document.getElementById('typeExpense').classList.toggle('active', type === 'expense');
    document.getElementById('typeExpense').classList.toggle('expense', type === 'expense');
  };
  document.getElementById('typeIncome').addEventListener('click', () => setType('income'));
  document.getElementById('typeExpense').addEventListener('click', () => setType('expense'));
  setType(t.type || 'income');
}

function getTxFormData() {
  const amount = parseFloat(document.getElementById('txAmount').value);
  if (!amount || amount <= 0) { toast('Jumlah harus lebih dari 0', 'error'); return null; }
  const walletId = document.getElementById('txWallet').value;
  if (!walletId) { toast('Pilih wallet dulu', 'error'); return null; }
  return {
    type:     document.getElementById('txType').value,
    walletId,
    amount,
    category: document.getElementById('txCategory').value,
    note:     document.getElementById('txNote').value.trim(),
  };
}

async function deleteTransaction(id) {
  const t = state.transactions.find(tx => tx.id === id);
  if (!t) return;
  confirmDialog(`Hapus transaksi "${t.note || t.category}" (${fmtIDR(t.amount)})?`, async () => {
    const wallet = walletById(t.walletId);
    if (wallet) wallet.balance += (t.type === 'income' ? -t.amount : t.amount);
    state.transactions = state.transactions.filter(tx => tx.id !== id);
    await saveData();
    toast('Transaksi dihapus', 'info');
    renderPage(currentPage);
  });
}

// ──────────────────────────────────────────────
// GOALS PAGE
// ──────────────────────────────────────────────
function renderGoals(el) {
  const goal = state.goals[0] || null;
  const total = totalBalance();

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Target <span>◉</span></h1>
      <button class="btn btn-primary" id="addGoalBtn">${goal ? 'Edit Target' : '+ Tambah Target'}</button>
    </div>
    ${goal ? goalCardHTML(goal, total) : `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-text">Belum ada target tabungan.<br>Yuk set target kamu!</div></div>`}
    <div style="height:24px"></div>
    <div class="card">
      <div class="card-header"><span class="card-title">Ringkasan Wallet</span></div>
      ${state.wallets.length === 0 ? '<div class="empty-state" style="padding:20px 0"><div class="empty-text">Belum ada wallet</div></div>' :
        state.wallets.map(w => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px">
              <span>${w.icon}</span>
              <span style="font-size:.9rem">${w.name}</span>
            </div>
            <span style="font-family:'Syne',sans-serif;font-weight:700;color:var(--gold)">${fmtIDR(w.balance||0)}</span>
          </div>
        `).join('')
      }
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 0">
        <span style="font-size:.85rem;color:var(--text2);font-weight:600">Total Semua Wallet</span>
        <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:var(--gold)">${fmtIDR(total)}</span>
      </div>
    </div>
  `;

  document.getElementById('addGoalBtn').addEventListener('click', () => showGoalModal(goal));
}

function goalCardHTML(goal, total) {
  const pct = Math.min(100, goal.target > 0 ? Math.round((total / goal.target) * 100) : 0);
  const done = total >= goal.target;
  return `
    <div class="goal-card">
      <div class="goal-header">
        <div>
          <div class="goal-name">${goal.name}</div>
          <div class="goal-amounts">${fmtIDR(total)} dari ${fmtIDR(goal.target)}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" id="editGoalBtn">✏️</button>
          <button class="btn btn-danger btn-sm" id="delGoalBtn">🗑️</button>
        </div>
      </div>
      <div class="goal-bar-wrap">
        <div class="goal-bar" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
        <span class="goal-pct">${pct}% tercapai</span>
        ${done ? '<span class="badge badge-green">🎉 Target Tercapai!</span>' : `<span style="font-size:.78rem;color:var(--text3)">Kurang ${fmtIDR(goal.target - total)}</span>`}
      </div>
      ${goal.note ? `<div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px;font-size:.82rem;color:var(--text3)">${goal.note}</div>` : ''}
    </div>
  `;
}

function showGoalModal(existing = null) {
  openModal(existing ? 'Edit Target' : 'Tambah Target', `
    <div class="form-group">
      <label class="form-label">Nama Target</label>
      <input class="form-input" id="gName" placeholder="contoh: Dana Darurat, Liburan..." value="${existing?.name || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Target Jumlah (Rp)</label>
      <input class="form-input" id="gTarget" type="number" placeholder="0" value="${existing?.target || ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Catatan (opsional)</label>
      <textarea class="form-textarea" id="gNote" placeholder="Deskripsi atau catatan...">${existing?.note || ''}</textarea>
    </div>
  `, async () => {
    const name = document.getElementById('gName').value.trim();
    const target = parseFloat(document.getElementById('gTarget').value);
    if (!name) { toast('Nama target wajib diisi', 'error'); return; }
    if (!target || target <= 0) { toast('Target harus lebih dari 0', 'error'); return; }
    const goalObj = { id: existing?.id || uid(), name, target, note: document.getElementById('gNote').value.trim(), createdAt: existing?.createdAt || new Date().toISOString() };
    state.goals = [goalObj]; // only 1 global goal
    await saveData();
    closeModal();
    toast('Target disimpan!', 'success');
    renderPage('goals');
  });

  // bind delete if editing
  setTimeout(() => {
    const editBtn = document.getElementById('editGoalBtn');
    const delBtn = document.getElementById('delGoalBtn');
    if (editBtn) editBtn.addEventListener('click', () => showGoalModal(state.goals[0]));
    if (delBtn) delBtn.addEventListener('click', async () => {
      state.goals = [];
      await saveData();
      toast('Target dihapus', 'info');
      renderPage('goals');
    });
  }, 100);
}

// ──────────────────────────────────────────────
// EXPORT PAGE
// ──────────────────────────────────────────────
function renderExport(el) {
  const now = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  el.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Export <span>↗</span></h1>
    </div>

    <div class="export-preview">
      <div class="section-header" style="margin-bottom:16px">
        <span class="section-title">Preview Export</span>
      </div>
      <div class="export-capture" id="exportCapture">
        <div class="export-header">
          <div class="export-logo">◈ WalletKu</div>
          <div class="export-date">${now}</div>
        </div>
        <div class="export-total">
          <div class="export-total-label">Total Saldo Semua Wallet</div>
          <div class="export-total-val">${fmtIDR(totalBalance())}</div>
        </div>
        <div class="export-wallets">
          ${state.wallets.length === 0 ? '<div style="color:var(--text3);font-size:.85rem;text-align:center;padding:20px">Belum ada wallet</div>' :
            state.wallets.map(w => `
              <div class="export-wallet">
                <div class="export-wallet-name">${w.icon} ${w.name}</div>
                <div class="export-wallet-bal" style="color:${w.color||'var(--gold)'}">${fmtIDR(w.balance||0)}</div>
              </div>
            `).join('')
          }
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px">
          ${renderExportStats()}
        </div>
        <div style="text-align:center;margin-top:20px;font-size:.7rem;color:var(--text3)">
          Data privat · WalletKu v2.0 · ${new Date().toLocaleDateString('id-ID')}
        </div>
      </div>
    </div>

    <div class="export-btns">
      <button class="btn btn-primary" id="export1440">📸 Export 1440p</button>
      <button class="btn btn-ghost" id="export4k">🖼️ Export 4K <span style="color:var(--text3);font-size:.75rem">(delay 10 detik)</span></button>
      <div class="export-countdown" id="exportCountdown"></div>
    </div>
  `;

  document.getElementById('export1440').addEventListener('click', () => exportImage(1440));
  document.getElementById('export4k').addEventListener('click', () => exportImage(4096, true));
}

function renderExportStats() {
  const totalIn  = state.transactions.filter(t => t.type==='income').reduce((s,t) => s+t.amount, 0);
  const totalOut = state.transactions.filter(t => t.type==='expense').reduce((s,t) => s+t.amount, 0);
  return `
    <div style="background:var(--green-dim);border-radius:10px;padding:12px;border:1px solid rgba(45,217,143,.15)">
      <div style="font-size:.72rem;color:var(--green);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Total Pemasukan</div>
      <div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--green)">${fmtIDR(totalIn)}</div>
    </div>
    <div style="background:var(--red-dim);border-radius:10px;padding:12px;border:1px solid rgba(242,92,92,.15)">
      <div style="font-size:.72rem;color:var(--red);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Total Pengeluaran</div>
      <div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--red)">${fmtIDR(totalOut)}</div>
    </div>
  `;
}

async function exportImage(targetWidth, is4k = false) {
  const btn1 = document.getElementById('export1440');
  const btn4k = document.getElementById('export4k');
  const countdown = document.getElementById('exportCountdown');
  const captureEl = document.getElementById('exportCapture');

  if (!captureEl) return;

  if (is4k) {
    btn4k.disabled = true;
    btn1.disabled = true;
    let sec = 10;
    countdown.innerHTML = `⏳ Rendering 4K... <b>${sec}s</b>`;
    const timer = setInterval(() => {
      sec--;
      countdown.innerHTML = sec > 0 ? `⏳ Rendering 4K... <b>${sec}s</b>` : '✅ Siap!';
      if (sec <= 0) clearInterval(timer);
    }, 1000);
    await new Promise(r => setTimeout(r, 10000));
  }

  try {
    const scale = targetWidth / captureEl.offsetWidth;
    const canvas = await html2canvas(captureEl, {
      scale,
      useCORS: true,
      backgroundColor: '#080c14',
      logging: false
    });
    const link = document.createElement('a');
    const ts = new Date().toISOString().slice(0,10);
    link.download = `WalletKu_${is4k ? '4K' : '1440p'}_${ts}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    toast(`Export ${is4k ? '4K' : '1440p'} berhasil!`, 'success');
  } catch(e) {
    toast('Export gagal, coba lagi', 'error');
    console.error(e);
  } finally {
    if (btn1) btn1.disabled = false;
    if (btn4k) btn4k.disabled = false;
    countdown.innerHTML = '';
  }
}

// ──────────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPinScreen();
});
