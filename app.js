/* ============================================
   WALLETKU v2.3 — app.js
   iOS 26 · Bento · Multi-feature · 25 Jul 2026
   ============================================ */
'use strict';

// ── CONSTANTS ──────────────────────────────────
const LS_SALT    = 'wk_salt_v2';
const LS_VERIFY  = 'wk_verify_v2';
// Keep same key as v2.x so existing encrypted data is not lost on upgrade
const LS_DATA    = 'wk_data_v2';
const LS_USER    = 'wk_username_v2';
const LS_THEME   = 'wk_theme_v1';
const LS_NOTIFS  = 'wk_notifs_v1';
// Must match the value originally written by setupPIN — never change this
const VERIFY_KEY = 'WALLETKU_OK';

const EMOJIS     = ['💰','💳','🏦','🏧','📦','🛒','✈️','🎓','💊','🏠','🚗','🍕','☕','🎮','💎','🌟','🎯','🔑','🌿','⚡','🎵','🏋️','🌏','🐕','🎁'];
const PALETTE    = ['#c9a84c','#34d399','#60a5fa','#f87171','#a78bfa','#fb923c','#38bdf8','#f472b6','#4ade80','#e879f9'];
const CATEGORIES = ['Makanan','Transport','Belanja','Hiburan','Kesehatan','Pendidikan','Tabungan','Gaji','Bonus','Transfer','Tagihan','Investasi','Lainnya'];
const CURRENCIES = { IDR:{symbol:'Rp',name:'Rupiah',locale:'id-ID'}, USD:{symbol:'$',name:'Dollar',locale:'en-US'}, EUR:{symbol:'€',name:'Euro',locale:'de-DE'}, SGD:{symbol:'S$',name:'Singapore Dollar',locale:'en-SG'}, MYR:{symbol:'RM',name:'Malaysian Ringgit',locale:'ms-MY'} };
const ALL_TAGS   = ['penting','rutin','impulsif','hemat','investasi','darurat','liburan','hadiah'];

// ── STATE ──────────────────────────────────────
let cryptoKey   = null;
let currentUser = null;
let currentPage = 'dashboard';
let charts      = {};
let txFilters   = { wallet:'', type:'', category:'', tag:'', dateFrom:'', dateTo:'', search:'' };
let notifications = [];
let modalKeyHandler = null;

let state = {
  wallets: [],
  transactions: [],
  goals: [],
  wishlist: [],
  budgets: [],
  recurring: [],
  notes: [],
  settings: { currency: 'IDR', createdAt: null, backupCode: null }
};

// ── CRYPTO ─────────────────────────────────────
const _enc = new TextEncoder(), _dec = new TextDecoder();
const b64  = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;

async function deriveKey(pin, salt) {
  const km = await crypto.subtle.importKey('raw', _enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:200000, hash:'SHA-256' }, km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, _enc.encode(text));
  return b64(iv) + '.' + b64(ct);
}
async function decrypt(key, cipher) {
  const [iv64, ct64] = cipher.split('.');
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv: new Uint8Array(unb64(iv64)) }, key, unb64(ct64));
  return _dec.decode(pt);
}

// ── STORAGE ────────────────────────────────────
async function saveData() {
  if (!cryptoKey) return;
  localStorage.setItem(LS_DATA, await encrypt(cryptoKey, JSON.stringify(state)));
  sessionStorage.setItem('wk_sk', document.getElementById('_pc')?.value || '');
}
async function loadData() {
  const raw = localStorage.getItem(LS_DATA);
  if (!raw) return;
  try {
    const parsed = JSON.parse(await decrypt(cryptoKey, raw));
    // Merge: keep new fields if missing in old data
    state = { ...state, ...parsed };
    state.goals     = parsed.goals     || [];
    state.wishlist  = parsed.wishlist  || [];
    state.budgets   = parsed.budgets   || [];
    state.recurring = parsed.recurring || [];
    state.notes     = parsed.notes     || [];
    state.settings  = { ...state.settings, ...parsed.settings };
  } catch(e) { console.warn('decrypt fail', e); }
}

// ── SOUND ──────────────────────────────────────
let _actx = null;
function _ac() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}
function tone(freq, type, dur, vol = 0.12) {
  try {
    const c = _ac(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(); o.stop(c.currentTime + dur);
  } catch(e) {}
}
const SFX = {
  tap()     { tone(880,'sine',0.07,0.1); },
  fill()    { tone(1200,'sine',0.05,0.09); },
  err()     { tone(180,'sawtooth',0.28,0.16); setTimeout(()=>tone(140,'sawtooth',0.22,0.13),110); },
  wrongKey(){ tone(220,'sawtooth',0.1,0.08); },
  ok()      { [660,880,1100].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.16,0.12),i*90)); },
  login()   { [440,550,660,880].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.18,0.12),i*65)); },
  fail()    { tone(200,'square',0.22,0.16); setTimeout(()=>tone(160,'square',0.18,0.26),140); },
  click()   { tone(600,'sine',0.05,0.08); },
  save()    { tone(740,'sine',0.11,0.13); setTimeout(()=>tone(988,'sine',0.09,0.15),85); },
  del()     { tone(300,'triangle',0.14,0.18); },
  toast()   { tone(880,'sine',0.045,0.08); },
  nav()     { tone(520,'sine',0.04,0.07); },
  lock()    { [440,330,220].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.13,0.1),i*75)); },
  notif()   { tone(660,'sine',0.07,0.1); setTimeout(()=>tone(880,'sine',0.06,0.08),80); },
  budget()  { tone(440,'sawtooth',0.18,0.12); setTimeout(()=>tone(330,'sawtooth',0.15,0.15),100); },
};

// ── CURSOR GLOW ────────────────────────────────
function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  if (!glow) return;
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
  });
}

// ── THEME ──────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(LS_THEME, t);
  const lbl = document.getElementById('themeLabel');
  if (lbl) lbl.textContent = t === 'dark' ? 'Light' : 'Dark';
}
function initTheme() {
  const saved = localStorage.getItem(LS_THEME) || 'dark';
  applyTheme(saved);
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    SFX.click();
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

// ── NOTIFICATIONS ──────────────────────────────
function addNotif(title, text, icon = '💡') {
  SFX.notif();
  notifications.unshift({ id: uid(), title, text, icon, time: Date.now() });
  if (notifications.length > 30) notifications.pop();
  const dot = document.getElementById('notifDot');
  if (dot) dot.classList.remove('hidden');
  renderNotifPanel();
}
function renderNotifPanel() {
  const list = document.getElementById('notifList');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = '<div class="empty-state" style="padding:32px 16px"><div class="empty-icon">🔔</div><div class="empty-title">No notifications</div></div>';
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item">
      <div class="notif-item-icon">${n.icon}</div>
      <div>
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-text">${n.text}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>
      </div>
    </div>`).join('');
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}
function initNotifBell() {
  const bell  = document.getElementById('notifBell');
  const panel = document.getElementById('notifPanel');
  const clear = document.getElementById('clearNotifs');
  if (!bell || !panel) return;
  bell.addEventListener('click', e => {
    e.stopPropagation();
    SFX.click();
    panel.classList.toggle('hidden');
    document.getElementById('notifDot')?.classList.add('hidden');
  });
  clear?.addEventListener('click', () => {
    notifications = [];
    renderNotifPanel();
    panel.classList.add('hidden');
  });
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== bell) panel.classList.add('hidden');
  });
}

// ── PIN SCREEN ─────────────────────────────────
let pinBuf = '', isSetup = false, pinConfirm = '', isConfirm = false, pinErrTimer = null;

function initPinScreen() {
  const hasSalt   = !!localStorage.getItem(LS_SALT);
  const hasVerify = !!localStorage.getItem(LS_VERIFY);
  isSetup = !(hasSalt && hasVerify);

  document.getElementById('pinSub').textContent = isSetup ? 'Create a 6-digit PIN' : 'Enter your PIN';
  document.getElementById('pinHint').textContent = isSetup ? '🔒 PIN encrypts all your data' : '💡 Type digits directly from keyboard';

  document.querySelectorAll('.pin-key[data-val]').forEach(b =>
    b.addEventListener('click', () => { SFX.tap(); doPinInput(b.dataset.val); }));
  document.getElementById('pinDel').addEventListener('click', () => { SFX.click(); doPinDel(); });
  document.addEventListener('keydown', pinKeyboard);
}

function pinKeyboard(e) {
  const scr = document.getElementById('pinScreen');
  if (!scr || scr.style.display === 'none') return;
  if (e.key >= '0' && e.key <= '9') { SFX.tap(); doPinInput(e.key); }
  else if (e.key === 'Backspace') { SFX.click(); doPinDel(); }
  else if (e.key !== 'Enter') {
    // Flash error for wrong key
    SFX.wrongKey();
    if (pinErrTimer) clearTimeout(pinErrTimer);
    const island = document.querySelector('.pin-island');
    island?.classList.add('key-flash');
    document.querySelectorAll('#pinDots span').forEach((d,i) => { if (i < pinBuf.length) d.style.boxShadow = '0 0 8px rgba(248,113,113,0.6)'; });
    pinErrTimer = setTimeout(() => {
      island?.classList.remove('key-flash');
      document.querySelectorAll('#pinDots span').forEach(d => d.style.boxShadow = '');
    }, 350);
    e.preventDefault();
  }
}

function doPinInput(v) {
  if (pinBuf.length >= 6) return;
  pinBuf += v;
  updateDots(pinBuf.length);
  SFX.fill();
  if (pinBuf.length === 6) setTimeout(processPIN, 180);
}
function doPinDel() {
  if (pinBuf.length) { pinBuf = pinBuf.slice(0,-1); updateDots(pinBuf.length); }
}
function updateDots(n, mode='normal') {
  document.querySelectorAll('#pinDots span').forEach((d,i) => {
    d.className = '';
    if (i < n) d.classList.add(mode === 'error' ? 'error' : 'filled');
  });
}
function pinError(msg) {
  SFX.err();
  document.getElementById('pinError').textContent = msg;
  updateDots(6, 'error');
  setTimeout(() => { pinBuf = ''; updateDots(0); document.getElementById('pinError').textContent = ''; }, 850);
}

async function processPIN() {
  if (isSetup) {
    if (!isConfirm) {
      pinConfirm = pinBuf; pinBuf = ''; isConfirm = true;
      updateDots(0);
      document.getElementById('pinSub').textContent = 'Confirm your PIN';
    } else {
      if (pinBuf !== pinConfirm) {
        pinError("PINs don't match — try again");
        pinBuf = ''; isConfirm = false; pinConfirm = '';
        document.getElementById('pinSub').textContent = 'Create a 6-digit PIN';
        return;
      }
      await setupPIN(pinBuf);
    }
  } else {
    await verifyPIN(pinBuf);
  }
}
async function setupPIN(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(LS_SALT, b64(salt));
  // deriveKey expects Uint8Array for salt
  cryptoKey = await deriveKey(pin, salt);
  localStorage.setItem(LS_VERIFY, await encrypt(cryptoKey, VERIFY_KEY));
  state.settings.createdAt = new Date().toISOString();
  cachePin(pin);
  await saveData();
  SFX.ok();
  afterPINUnlock();
}
async function verifyPIN(pin) {
  try {
    const saltRaw = localStorage.getItem(LS_SALT);
    if (!saltRaw) throw new Error('No salt');
    // unb64 returns ArrayBuffer — deriveKey needs Uint8Array
    const saltBuf = new Uint8Array(unb64(saltRaw));
    const key = await deriveKey(pin, saltBuf);
    const verifyRaw = localStorage.getItem(LS_VERIFY);
    if (!verifyRaw) throw new Error('No verify token');
    const pl = await decrypt(key, verifyRaw);
    // Accept both old plain-text verify value AND current VERIFY_KEY
    if (pl !== VERIFY_KEY && pl !== 'WALLETKU_OK') throw new Error('PIN mismatch');
    cryptoKey = key;
    cachePin(pin);
    await loadData();
    SFX.ok();
    afterPINUnlock();
  } catch(e) {
    console.warn('verifyPIN error:', e);
    pinError('Incorrect PIN — try again');
    pinBuf = '';
  }
}
function cachePin(pin) {
  sessionStorage.setItem('wk_sk', pin);
  let h = document.getElementById('_pc');
  if (!h) { h = document.createElement('input'); h.type='hidden'; h.id='_pc'; document.body.appendChild(h); }
  h.value = pin;
}
function afterPINUnlock() {
  document.removeEventListener('keydown', pinKeyboard);
  document.getElementById('pinScreen').style.display = 'none';
  currentUser = localStorage.getItem(LS_USER);
  if (currentUser) showApp(); else showLogin(true);
}

// ── LOGIN SCREEN ───────────────────────────────
let loginIsReg = false;
function showLogin(isReg = false) {
  loginIsReg = isReg;
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  const pill=document.getElementById('loginPill'), title=document.getElementById('loginTitle'),
        sub=document.getElementById('loginSub'), sw=document.getElementById('loginSwitch'), btnT=document.getElementById('loginBtnText');
  if (isReg) {
    pill.textContent='First Time Setup'; title.textContent='Create Account'; sub.textContent='Choose a username for your profile'; btnT.textContent='Create Account'; sw.innerHTML='';
  } else {
    pill.textContent='Welcome Back'; title.textContent='Sign In'; sub.textContent='Enter your username to continue'; btnT.textContent='Continue';
    sw.innerHTML='<span>New device? </span><a id="swReg">Register again</a>';
    setTimeout(() => document.getElementById('swReg')?.addEventListener('click', () => { SFX.click(); showLogin(true); }), 50);
  }
  const inp = document.getElementById('usernameInput');
  inp.value = '';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('loginCountdown').classList.add('hidden');
  document.getElementById('loginBtn').onclick = doLogin;
  inp.onkeydown = e => { if (e.key === 'Enter') doLogin(); };
  setTimeout(() => inp.focus(), 250);
}

async function doLogin() {
  const val = document.getElementById('usernameInput').value.trim();
  const err = document.getElementById('loginError');
  if (!val)          { err.textContent = 'Username is required';       SFX.fail(); return; }
  if (val.length < 3){ err.textContent = 'Minimum 3 characters';       SFX.fail(); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(val)) { err.textContent = 'Letters, numbers, underscore only'; SFX.fail(); return; }
  if (!loginIsReg) {
    const saved = localStorage.getItem(LS_USER);
    if (!saved)                      { err.textContent = 'No account found — register first'; SFX.fail(); return; }
    if (val.toLowerCase() !== saved.toLowerCase()) { err.textContent = 'Username not recognized'; SFX.fail(); return; }
  }
  SFX.login(); err.textContent = '';
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('loginCountdown').classList.remove('hidden');
  document.getElementById('countdownText').textContent = loginIsReg ? 'Setting up your account…' : 'Loading your data…';
  let sec = 3;
  const circ = document.getElementById('countdownCircle'), numEl = document.getElementById('countdownNum');
  numEl.textContent = sec; circ.style.strokeDashoffset = '0';
  const iv = setInterval(() => {
    sec--;
    numEl.textContent = sec;
    circ.style.strokeDashoffset = String(176 * (1 - sec/3));
    if (sec <= 0) {
      clearInterval(iv);
      localStorage.setItem(LS_USER, val);
      currentUser = val;
      document.getElementById('loginScreen').classList.add('hidden');
      showApp();
    }
  }, 1000);
}

// ── APP SHELL ──────────────────────────────────
function showApp() {
  document.getElementById('app').classList.remove('hidden');
  initApp();
}
function initApp() {
  const name = currentUser || 'User';
  document.getElementById('userName').textContent    = name;
  document.getElementById('userAvatar').textContent  = name[0].toUpperCase();
  document.getElementById('topbarGreeting').textContent = greet() + ', ' + name;
  updateDate();
  initNav();
  initNotifBell();
  document.getElementById('lockBtn').addEventListener('click', lockApp);
  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  document.getElementById('sidebarScrim').addEventListener('click', closeSidebar);
  document.getElementById('fabAdd').addEventListener('click', () => showAddTxModal());
  checkRecurring();
  checkBudgets();
  navigateTo('dashboard');
}

function greet() {
  const h = new Date().getHours();
  if (h < 11) return 'Good morning'; if (h < 15) return 'Good afternoon'; if (h < 18) return 'Good evening'; return 'Good night';
}
function updateDate() {
  document.getElementById('topbarDate').textContent =
    new Date().toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

function initNav() {
  document.querySelectorAll('.nav-pill[data-page]').forEach(b =>
    b.addEventListener('click', () => { SFX.nav(); navigateTo(b.dataset.page); closeSidebar(); }));
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-pill[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const titles = { dashboard:'Dashboard', wallets:'Wallets', transactions:'Transactions', recurring:'Recurring', budget:'Budget', goals:'Savings Goals', wishlist:'Wishlist', analytics:'Analytics', notes:'Daily Notes', export:'Export', changelog:'Changelog', shortcuts:'Shortcuts', settings:'Settings' };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e){} }); charts = {};
  const content = document.getElementById('pageContent');
  content.innerHTML = '';
  switch(page) {
    case 'dashboard':    renderDashboard(content);    break;
    case 'wallets':      renderWallets(content);      break;
    case 'transactions': renderTransactions(content); break;
    case 'recurring':    renderRecurring(content);    break;
    case 'budget':       renderBudget(content);       break;
    case 'goals':        renderGoals(content);        break;
    case 'wishlist':     renderWishlist(content);     break;
    case 'analytics':    renderAnalytics(content);    break;
    case 'notes':        renderNotes(content);        break;
    case 'export':       renderExport(content);       break;
    case 'changelog':    renderChangelog(content);    break;
    case 'shortcuts':    renderShortcuts(content);    break;
    case 'settings':     renderSettings(content);     break;
  }
}

function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarScrim').classList.add('visible'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarScrim').classList.remove('visible'); }

function lockApp() {
  SFX.lock();
  cryptoKey = null; currentUser = null; pinBuf = ''; isConfirm = false;
  sessionStorage.removeItem('wk_sk');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('pinScreen').style.display = 'flex';
  updateDots(0); document.getElementById('pinError').textContent = '';
  initPinScreen();
}

// ── UTILS ──────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function fmtMoney(n, currCode) {
  const cur = CURRENCIES[currCode || state.settings.currency || 'IDR'];
  if (!cur) return 'Rp' + Math.round(n).toLocaleString('id-ID');
  return new Intl.NumberFormat(cur.locale, { style:'currency', currency:currCode||state.settings.currency||'IDR', maximumFractionDigits:0 }).format(n);
}

function fmtDate(iso) { return new Date(iso).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }); }
function isToday(iso) { const d=new Date(iso),t=new Date(); return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear(); }
function isThisMonth(iso) { const d=new Date(iso),t=new Date(); return d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear(); }
function totalBal() { return state.wallets.reduce((s,w)=>s+(w.balance||0),0); }
function walletById(id) { return state.wallets.find(w=>w.id===id); }
function walletColor(id) { const w=walletById(id); return w?.color||'#c9a84c'; }

// ── TOAST ──────────────────────────────────────
function toast(msg, type='info', dur=3200) {
  SFX.toast();
  const icons = { success:'✅', error:'❌', info:'💡', warning:'⚠️' };
  const el = document.createElement('div');
  el.className = `toast-bubble ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'💡'}</span><span>${msg}</span>`;
  document.getElementById('toastRack').appendChild(el);
  setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', ()=>el.remove()); }, dur);
}

// ── MODAL ──────────────────────────────────────
function openModal(title, body, onConfirm=null, confirmLabel='Save') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalBackdrop').onclick = e => { if (e.target===document.getElementById('modalBackdrop')) closeModal(); };

  if (onConfirm) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button class="btn btn-ghost" id="mCancel" data-shortcut="X" title="Cancel (X)">Cancel</button>
      <button class="btn btn-primary" id="mConfirm" data-shortcut="↵" title="Save (Enter when focused)">${confirmLabel}</button>`;
    document.getElementById('modalBody').appendChild(footer);
    document.getElementById('mCancel').onclick = closeModal;
    document.getElementById('mConfirm').onclick = onConfirm;
    document.getElementById('mConfirm').addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); onConfirm(); } });
    if (modalKeyHandler) document.removeEventListener('keydown', modalKeyHandler);
    modalKeyHandler = e => {
      if (document.getElementById('modalBackdrop').classList.contains('hidden')) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (!['input','textarea','select'].includes(tag) && e.key.toLowerCase()==='x') { e.preventDefault(); closeModal(); }
    };
    document.addEventListener('keydown', modalKeyHandler);
  }
}

function closeModal() {
  SFX.click();
  document.getElementById('modalBackdrop').classList.add('hidden');
  if (modalKeyHandler) { document.removeEventListener('keydown', modalKeyHandler); modalKeyHandler = null; }
}

function confirmDlg(msg, onYes, danger=true) {
  openModal('Confirm', `<p style="color:var(--text-secondary);line-height:1.6;font-size:.875rem">${msg}</p>`, () => { closeModal(); onYes(); }, danger ? '🗑 Delete' : 'Confirm');
  // Override confirm button to danger style
  setTimeout(() => { const btn = document.getElementById('mConfirm'); if (btn && danger) { btn.className='btn btn-danger'; } }, 10);
}

// ── RECURRING CHECK ────────────────────────────
function checkRecurring() {
  const today = new Date().toISOString().slice(0,10);
  let changed = false;
  state.recurring.forEach(r => {
    if (!r.active) return;
    const last = r.lastRun || '';
    const due  = nextDueDate(r);
    if (due <= today && due !== last) {
      // Auto-create transaction
      const wallet = walletById(r.walletId);
      if (wallet) {
        const tx = { id:uid(), type:r.type, walletId:r.walletId, amount:r.amount, category:r.category, note:r.name+' (auto)', tags:[], date:new Date().toISOString(), createdAt:new Date().toISOString() };
        state.transactions.push(tx);
        wallet.balance = (wallet.balance||0) + (r.type==='income'?r.amount:-r.amount);
        r.lastRun = today;
        changed = true;
        addNotif('Recurring Transaction', `${r.name} — ${fmtMoney(r.amount)} auto-recorded`, '🔄');
      }
    }
  });
  if (changed) saveData();
}

function nextDueDate(r) {
  const start = new Date(r.startDate || r.createdAt);
  const today = new Date();
  today.setHours(0,0,0,0);
  let d = new Date(start);
  while (d < today) {
    if (r.freq === 'daily')   d.setDate(d.getDate()+1);
    else if (r.freq === 'weekly')  d.setDate(d.getDate()+7);
    else if (r.freq === 'monthly') d.setMonth(d.getMonth()+1);
    else if (r.freq === 'yearly')  d.setFullYear(d.getFullYear()+1);
    else break;
  }
  return d.toISOString().slice(0,10);
}

// ── BUDGET CHECK ───────────────────────────────
function checkBudgets() {
  const now = new Date();
  state.budgets.forEach(b => {
    const spent = state.transactions
      .filter(t => t.type==='expense' && t.category===b.category && isThisMonth(t.date))
      .reduce((s,t)=>s+t.amount,0);
    const pct = b.limit > 0 ? spent/b.limit : 0;
    if (pct >= 0.9 && !b.notified90) {
      b.notified90 = true;
      addNotif('Budget Alert', `${b.category}: ${Math.round(pct*100)}% of ${fmtMoney(b.limit)} used`, '⚠️');
      SFX.budget();
    }
    if (pct >= 1 && !b.notifiedOver) {
      b.notifiedOver = true;
      addNotif('Budget Exceeded!', `${b.category} is over budget by ${fmtMoney(spent-b.limit)}`, '🚨');
    }
  });
}

// ════════════════════════════════════════════════
// PAGE: DASHBOARD
// ════════════════════════════════════════════════
function renderDashboard(el) {
  const txToday  = state.transactions.filter(t=>isToday(t.date));
  const txMonth  = state.transactions.filter(t=>isThisMonth(t.date));
  const totalIn  = txMonth.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalOut = txMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const todayIn  = txToday.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const todayOut = txToday.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const net = totalIn - totalOut;

  el.innerHTML = `
    <div class="bento-grid">

      <!-- TOTAL BALANCE — wide hero -->
      <div class="bento-card bento-4" style="animation-delay:.00s;background:linear-gradient(135deg,rgba(201,168,76,0.1),var(--glass-bg))">
        <div class="bento-card-accent"></div>
        <div class="card-eyebrow">Total Balance</div>
        <div class="card-value accent">${fmtMoney(totalBal())}</div>
        <div class="card-sub">${state.wallets.length} wallet${state.wallets.length!==1?'s':''} · ${new Date().toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</div>
      </div>

      <!-- NET FLOW -->
      <div class="bento-card bento-2" style="animation-delay:.05s">
        <div class="card-eyebrow">Net This Month</div>
        <div class="card-value ${net>=0?'green':'red'}">${net>=0?'+':''}${fmtMoney(net)}</div>
        <div style="margin-top:8px"><span class="stat-pill ${net>=0?'up':'down'}">${net>=0?'↑':'↓'} ${net>=0?'Surplus':'Deficit'}</span></div>
      </div>

      <!-- INCOME -->
      <div class="bento-card bento-3" style="animation-delay:.08s;background:linear-gradient(135deg,var(--green-dim),var(--glass-bg))">
        <div class="card-eyebrow">Income</div>
        <div class="card-value green">${fmtMoney(totalIn)}</div>
        <div class="card-sub">This month</div>
      </div>

      <!-- EXPENSES -->
      <div class="bento-card bento-3" style="animation-delay:.11s;background:linear-gradient(135deg,var(--red-dim),var(--glass-bg))">
        <div class="card-eyebrow">Expenses</div>
        <div class="card-value red">${fmtMoney(totalOut)}</div>
        <div class="card-sub">This month</div>
      </div>

      <!-- TX COUNT TODAY -->
      <div class="bento-card bento-2" style="animation-delay:.14s">
        <div class="card-eyebrow">Transactions Today</div>
        <div class="card-value">${txToday.length}</div>
        <div class="card-sub">+${fmtMoney(todayIn)} / -${fmtMoney(todayOut)}</div>
      </div>

      <!-- 7-DAY CHART -->
      <div class="bento-card bento-7" style="animation-delay:.17s">
        <div class="card-eyebrow" style="margin-bottom:16px">Cash Flow — Last 7 Days</div>
        <div class="chart-wrap"><canvas id="chartBar"></canvas></div>
      </div>

      <!-- EXPENSE DONUT -->
      <div class="bento-card bento-5" style="animation-delay:.20s">
        <div class="card-eyebrow" style="margin-bottom:16px">Spending by Category</div>
        <div class="chart-wrap"><canvas id="chartPie"></canvas></div>
      </div>

      <!-- TODAY'S TRANSACTIONS -->
      <div class="bento-card bento-12" style="animation-delay:.22s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4)">
          <div class="card-eyebrow" style="margin:0">Today</div>
          <button class="btn btn-primary btn-xs" id="dashAddTx">+ Add</button>
        </div>
        <div class="tx-list" id="dashTxList">
          ${txToday.length===0
            ? '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No transactions today</div><div class="empty-desc">Tap + Add to record one</div></div>'
            : txToday.slice().reverse().slice(0,6).map(t=>txRowHTML(t)).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('dashAddTx').addEventListener('click', () => showAddTxModal());
  bindTxActions(el);
  renderBarChart(); renderPieChart();
}

function renderBarChart() {
  const ctx = document.getElementById('chartBar'); if (!ctx) return;
  const days=[], inc=[], exp=[];
  for (let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    days.push(d.toLocaleDateString('id-ID',{weekday:'short'}));
    const dt=state.transactions.filter(t=>{const td=new Date(t.date);return td.getDate()===d.getDate()&&td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear();});
    inc.push(dt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
    exp.push(dt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  }
  charts.bar = new Chart(ctx, { type:'bar', data:{ labels:days, datasets:[
    {label:'Income',data:inc,backgroundColor:'rgba(52,211,153,0.65)',borderRadius:6,borderSkipped:false},
    {label:'Expense',data:exp,backgroundColor:'rgba(248,113,113,0.65)',borderRadius:6,borderSkipped:false}
  ]}, options:{ responsive:true,maintainAspectRatio:false, plugins:{legend:{labels:{color:'var(--text-tertiary)',font:{family:'Inter',size:11},boxWidth:10}}}, scales:{
    x:{ticks:{color:'var(--text-tertiary)',font:{family:'Inter',size:10}},grid:{color:'rgba(255,255,255,0.04)'}},
    y:{ticks:{color:'var(--text-tertiary)',font:{family:'Inter',size:10},callback:v=>fmtMoney(v).replace(/[^0-9KMB,.]/g,'').slice(0,8)},grid:{color:'rgba(255,255,255,0.04)'}}
  }}});
}

function renderPieChart() {
  const ctx = document.getElementById('chartPie'); if (!ctx) return;
  const expTx = state.transactions.filter(t=>t.type==='expense'&&isThisMonth(t.date));
  if (!expTx.length) { ctx.parentElement.innerHTML='<div class="empty-state" style="padding:32px 0"><div class="empty-icon">🍩</div><div class="empty-title">No expenses yet</div></div>'; return; }
  const map={};
  expTx.forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; });
  charts.pie = new Chart(ctx, { type:'doughnut', data:{ labels:Object.keys(map), datasets:[{data:Object.values(map),backgroundColor:PALETTE.slice(0,Object.keys(map).length),borderWidth:0,hoverOffset:8}]},
    options:{ responsive:true,maintainAspectRatio:false,cutout:'68%', plugins:{legend:{position:'right',labels:{color:'var(--text-tertiary)',font:{family:'Inter',size:10},boxWidth:9,padding:8}}}}});
}

// ════════════════════════════════════════════════
// PAGE: WALLETS
// ════════════════════════════════════════════════
function renderWallets(el) {
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Wallets</h2><button class="btn btn-primary" id="addWalletBtn">+ New Wallet</button></div>
    <div class="wallet-grid" id="walletGrid">
      ${state.wallets.map((w,i)=>walletCardHTML(w,i)).join('')}
      <div class="add-wallet-card" id="addWalletCard">
        <div style="font-size:2rem">+</div>
        <div style="font-size:.85rem;font-weight:600">Add Wallet</div>
      </div>
    </div>
    <!-- Transfer section -->
    <div style="margin-top:var(--sp-8)"><div class="section-header"><h2 class="section-title">Internal Transfer</h2></div>
    <div class="bento-card" id="transferSection">
      ${state.wallets.length < 2
        ? '<div class="empty-state"><div class="empty-icon">🔁</div><div class="empty-title">Need 2+ wallets</div><div class="empty-desc">Add another wallet to enable transfers</div></div>'
        : `<div class="form-row" style="align-items:flex-end;gap:var(--sp-4)">
            <div class="form-group" style="margin:0"><label class="form-label">From</label><select class="form-select" id="tfFrom">${state.wallets.map(w=>`<option value="${w.id}">${w.icon} ${w.name} (${fmtMoney(w.balance||0)})</option>`).join('')}</select></div>
            <div class="form-group" style="margin:0"><label class="form-label">To</label><select class="form-select" id="tfTo">${state.wallets.map(w=>`<option value="${w.id}">${w.icon} ${w.name}</option>`).join('')}</select></div>
            <div class="form-group" style="margin:0"><label class="form-label">Amount</label><input class="form-input" id="tfAmt" type="number" placeholder="0" min="1"/></div>
            <div class="form-group" style="margin:0"><label class="form-label">Note</label><input class="form-input" id="tfNote" placeholder="Optional"/></div>
            <button class="btn btn-primary" id="tfBtn" style="flex-shrink:0">Transfer 🔁</button>
          </div>`}
    </div></div>`;

  document.getElementById('addWalletBtn').addEventListener('click', showAddWalletModal);
  document.getElementById('addWalletCard').addEventListener('click', showAddWalletModal);
  el.querySelectorAll('.wallet-edit').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();showEditWalletModal(b.dataset.id);}));
  el.querySelectorAll('.wallet-del').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();deleteWallet(b.dataset.id);}));
  document.getElementById('tfBtn')?.addEventListener('click', doTransfer);
}

function walletCardHTML(w,i) {
  const color = w.color||PALETTE[i%PALETTE.length];
  return `<div class="wallet-card" data-id="${w.id}" style="animation-delay:${i*.05}s">
    <div class="wallet-card-stripe" style="background:${color};box-shadow:0 0 12px ${color}55"></div>
    <div class="wallet-card-glow" style="background:radial-gradient(circle,${color},transparent)"></div>
    <div class="wallet-card-icon" style="background:${color}22">${w.icon||'💰'}</div>
    <div class="wallet-card-name">${w.name}</div>
    <div class="wallet-card-type">${w.type||'Wallet'} · ${w.currency||state.settings.currency||'IDR'}</div>
    <div class="wallet-card-balance" style="color:${color}">${fmtMoney(w.balance||0,w.currency)}</div>
    <div class="wallet-card-footer">
      <span class="badge" style="background:${color}18;color:${color};border-color:${color}33">${w.type||'Wallet'}</span>
      <div class="wallet-actions">
        <button class="btn btn-ghost btn-icon-sm wallet-edit" data-id="${w.id}" title="Edit">✏️</button>
        <button class="btn btn-danger btn-icon-sm wallet-del" data-id="${w.id}" title="Delete">🗑</button>
      </div>
    </div>
  </div>`;
}

async function doTransfer() {
  const from = document.getElementById('tfFrom')?.value;
  const to   = document.getElementById('tfTo')?.value;
  const amt  = parseFloat(document.getElementById('tfAmt')?.value);
  const note = document.getElementById('tfNote')?.value.trim() || 'Transfer';
  if (!from||!to||!amt||amt<=0) { toast('Fill all transfer fields','error'); return; }
  if (from===to) { toast('Cannot transfer to same wallet','error'); return; }
  const wFrom=walletById(from), wTo=walletById(to);
  if (!wFrom||!wTo) return;
  if ((wFrom.balance||0)<amt) { toast('Insufficient balance','error'); return; }
  wFrom.balance=(wFrom.balance||0)-amt;
  wTo.balance=(wTo.balance||0)+amt;
  const now=new Date().toISOString();
  state.transactions.push({id:uid(),type:'expense',walletId:from,amount:amt,category:'Transfer',note:`→ ${wTo.name}: ${note}`,tags:['transfer'],date:now,createdAt:now});
  state.transactions.push({id:uid(),type:'income',walletId:to,amount:amt,category:'Transfer',note:`← ${wFrom.name}: ${note}`,tags:['transfer'],date:now,createdAt:now});
  await saveData(); SFX.save();
  toast(`Transferred ${fmtMoney(amt)} from ${wFrom.name} to ${wTo.name}`,'success');
  navigateTo('wallets');
}

function showAddWalletModal() { openModal('New Wallet',walletFormHTML(),async()=>{ const d=getWalletForm(); if(!d)return; state.wallets.push({id:uid(),...d,balance:parseFloat(d.balance)||0,createdAt:new Date().toISOString()}); await saveData();closeModal();SFX.save();toast('Wallet added!','success');navigateTo('wallets'); }); bindWalletForm(); }
function showEditWalletModal(id) { const w=walletById(id); if(!w)return; openModal('Edit Wallet',walletFormHTML(w),async()=>{ const d=getWalletForm(); if(!d)return; const ob=w.balance; Object.assign(w,d); w.balance=ob; await saveData();closeModal();SFX.save();toast('Wallet updated','success');navigateTo('wallets'); }); bindWalletForm(w); }

function walletFormHTML(w={}) {
  const sc=w.color||PALETTE[0],se=w.icon||'💰';
  return `
    <div class="form-group"><label class="form-label">Wallet Name</label><input class="form-input" id="wName" placeholder="BCA, Cash, GoPay…" value="${w.name||''}"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="wType">${['Savings','Cash','Digital Wallet','Investment','Other'].map(t=>`<option${w.type===t?' selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Currency</label><select class="form-select" id="wCurrency">${Object.entries(CURRENCIES).map(([k,v])=>`<option value="${k}"${(w.currency||state.settings.currency)===k?' selected':''}>${k} — ${v.name}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Initial Balance</label><input class="form-input" id="wBalance" type="number" placeholder="0" value="${w.balance||0}"/></div>
    <div class="form-group"><label class="form-label">Icon</label><div class="emoji-picker-grid" id="emojiGrid">${EMOJIS.map(e=>`<button type="button" class="emoji-swatch${e===se?' selected':''}" data-e="${e}">${e}</button>`).join('')}</div><input type="hidden" id="wIcon" value="${se}"/></div>
    <div class="form-group"><label class="form-label">Color</label><div class="color-swatch-grid" id="colorGrid">${PALETTE.map(c=>`<div class="color-swatch${c===sc?' selected':''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div><input type="hidden" id="wColor" value="${sc}"/></div>`;
}
function bindWalletForm(w={}) {
  document.querySelectorAll('.emoji-swatch').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.emoji-swatch').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');document.getElementById('wIcon').value=b.dataset.e;SFX.click();}));
  document.querySelectorAll('.color-swatch').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');document.getElementById('wColor').value=b.dataset.c;SFX.click();}));
}
function getWalletForm() {
  const name=document.getElementById('wName').value.trim();
  if(!name){toast('Name is required','error');return null;}
  return {name,type:document.getElementById('wType').value,currency:document.getElementById('wCurrency').value,balance:parseFloat(document.getElementById('wBalance').value)||0,icon:document.getElementById('wIcon').value,color:document.getElementById('wColor').value};
}
async function deleteWallet(id) {
  const w=walletById(id);
  confirmDlg(`Delete wallet "<b>${w?.name}</b>"? All its transactions will also be deleted.`,async()=>{
    state.wallets=state.wallets.filter(x=>x.id!==id);
    state.transactions=state.transactions.filter(t=>t.walletId!==id);
    await saveData();SFX.del();toast('Wallet deleted','info');navigateTo('wallets');
  });
}

// ════════════════════════════════════════════════
// PAGE: TRANSACTIONS
// ════════════════════════════════════════════════
function renderTransactions(el) {
  const filtered = getFilteredTx();
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Transactions</h2><button class="btn btn-primary" id="addTxBtn">+ Add</button></div>
    <div class="filters-bar">
      <input class="form-input" id="txSearch" placeholder="🔍 Search…" value="${txFilters.search}" style="max-width:180px"/>
      <select class="form-select" id="fWallet" style="max-width:155px"><option value="">All Wallets</option>${state.wallets.map(w=>`<option value="${w.id}"${txFilters.wallet===w.id?' selected':''}>${w.icon} ${w.name}</option>`).join('')}</select>
      <select class="form-select" id="fType" style="max-width:130px"><option value="">All Types</option><option value="income"${txFilters.type==='income'?' selected':''}>Income</option><option value="expense"${txFilters.type==='expense'?' selected':''}>Expense</option></select>
      <select class="form-select" id="fCat" style="max-width:145px"><option value="">All Categories</option>${CATEGORIES.map(c=>`<option${txFilters.category===c?' selected':''}>${c}</option>`).join('')}</select>
      <select class="form-select" id="fTag" style="max-width:130px"><option value="">All Tags</option>${ALL_TAGS.map(t=>`<option${txFilters.tag===t?' selected':''}>${t}</option>`).join('')}</select>
      <input class="form-input" type="date" id="fFrom" value="${txFilters.dateFrom}" style="max-width:145px"/>
      <input class="form-input" type="date" id="fTo" value="${txFilters.dateTo}" style="max-width:145px"/>
      <button class="btn btn-ghost btn-sm" id="fReset">Reset</button>
    </div>
    <div style="color:var(--text-tertiary);font-size:.75rem;margin-bottom:var(--sp-3)">${filtered.length} transactions found</div>
    <div class="tx-list" id="txListMain">${filtered.length?filtered.map(t=>txRowHTML(t)).join(''):'<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No transactions found</div></div>'}</div>`;

  document.getElementById('addTxBtn').addEventListener('click', ()=>showAddTxModal());
  document.getElementById('txSearch').addEventListener('input', e=>{txFilters.search=e.target.value;refreshTxList();});
  document.getElementById('fWallet').addEventListener('change', e=>{txFilters.wallet=e.target.value;refreshTxList();});
  document.getElementById('fType').addEventListener('change', e=>{txFilters.type=e.target.value;refreshTxList();});
  document.getElementById('fCat').addEventListener('change', e=>{txFilters.category=e.target.value;refreshTxList();});
  document.getElementById('fTag').addEventListener('change', e=>{txFilters.tag=e.target.value;refreshTxList();});
  document.getElementById('fFrom').addEventListener('change', e=>{txFilters.dateFrom=e.target.value;refreshTxList();});
  document.getElementById('fTo').addEventListener('change', e=>{txFilters.dateTo=e.target.value;refreshTxList();});
  document.getElementById('fReset').addEventListener('click', ()=>{txFilters={wallet:'',type:'',category:'',tag:'',dateFrom:'',dateTo:'',search:''};navigateTo('transactions');});
  bindTxActions(el);
}

function getFilteredTx() {
  return state.transactions.filter(t=>{
    if(txFilters.wallet&&t.walletId!==txFilters.wallet)return false;
    if(txFilters.type&&t.type!==txFilters.type)return false;
    if(txFilters.category&&t.category!==txFilters.category)return false;
    if(txFilters.tag&&!(t.tags||[]).includes(txFilters.tag))return false;
    if(txFilters.dateFrom&&t.date<txFilters.dateFrom)return false;
    if(txFilters.dateTo&&t.date>txFilters.dateTo+'T23:59:59')return false;
    if(txFilters.search){const q=txFilters.search.toLowerCase();if(!(t.note||'').toLowerCase().includes(q)&&!t.category.toLowerCase().includes(q))return false;}
    return true;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));
}

function refreshTxList() {
  const list=document.getElementById('txListMain'); if(!list)return;
  const f=getFilteredTx();
  list.innerHTML=f.length?f.map(t=>txRowHTML(t)).join(''):'<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No transactions found</div></div>';
  bindTxActions(list);
}

function txRowHTML(t) {
  const w=walletById(t.walletId);
  const tags=(t.tags||[]).map(tg=>`<span class="tx-tag">#${tg}</span>`).join('');
  const icon = t.type==='income'?'↑':t.type==='transfer'?'⇄':'↓';
  return `<div class="tx-row">
    <div class="tx-icon-wrap ${t.type}">${icon}</div>
    <div class="tx-info-col">
      <div class="tx-name">${t.note||t.category}</div>
      <div class="tx-meta">${t.category}${w?` · ${w.icon} ${w.name}`:''}${t.currency?' · '+t.currency:''} · ${fmtDate(t.date)} ${tags}</div>
    </div>
    <div class="tx-amount-col ${t.type}">${t.type==='income'?'+':'-'}${fmtMoney(t.amount,t.currency||w?.currency)}</div>
    <div class="tx-actions-col">
      <button class="btn btn-ghost btn-icon-sm tx-edit" data-id="${t.id}" title="Edit">✏️</button>
      <button class="btn btn-danger btn-icon-sm tx-del" data-id="${t.id}" title="Delete">🗑</button>
    </div>
  </div>`;
}

function bindTxActions(root) {
  root.querySelectorAll('.tx-edit').forEach(b=>b.addEventListener('click',()=>showEditTxModal(b.dataset.id)));
  root.querySelectorAll('.tx-del').forEach(b=>b.addEventListener('click',()=>deleteTx(b.dataset.id)));
}

function showAddTxModal() {
  if(!state.wallets.length){toast('Add a wallet first!','warning');navigateTo('wallets');return;}
  openModal('Add Transaction',txFormHTML(),async()=>{const d=getTxForm();if(!d)return;const tx={id:uid(),...d,date:new Date().toISOString(),createdAt:new Date().toISOString()};state.transactions.push(tx);const w=walletById(d.walletId);if(w)w.balance=(w.balance||0)+(d.type==='income'?d.amount:-d.amount);await saveData();closeModal();SFX.save();toast(`${d.type==='income'?'Income':'Expense'} recorded!`,'success');checkBudgets();navigateTo(currentPage);});
  bindTxForm();
}
function showEditTxModal(id) {
  const t=state.transactions.find(x=>x.id===id);if(!t)return;
  openModal('Edit Transaction',txFormHTML(t),async()=>{const d=getTxForm();if(!d)return;const ow=walletById(t.walletId);if(ow)ow.balance+=(t.type==='income'?-t.amount:t.amount);Object.assign(t,d);const nw=walletById(d.walletId);if(nw)nw.balance+=(d.type==='income'?d.amount:-d.amount);await saveData();closeModal();SFX.save();toast('Transaction updated','success');navigateTo(currentPage);});
  bindTxForm(t);
}

function txFormHTML(t={}) {
  const selTags=t.tags||[];
  return `
    <div class="type-toggle"><button type="button" class="type-btn${t.type!=='income'?' active expense':''}" id="tExp">− Expense</button><button type="button" class="type-btn${t.type==='income'?' active income':''}" id="tInc">+ Income</button></div>
    <input type="hidden" id="txType" value="${t.type||'expense'}"/>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Wallet</label><select class="form-select" id="txWallet">${state.wallets.map(w=>`<option value="${w.id}"${t.walletId===w.id?' selected':''}>${w.icon} ${w.name} (${fmtMoney(w.balance||0,w.currency)})</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Amount</label><input class="form-input" id="txAmt" type="number" placeholder="0" value="${t.amount||''}" min="1"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label><select class="form-select" id="txCat">${CATEGORIES.map(c=>`<option${t.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Currency Override</label><select class="form-select" id="txCur"><option value="">Default (${state.settings.currency||'IDR'})</option>${Object.keys(CURRENCIES).map(k=>`<option value="${k}"${t.currency===k?' selected':''}>${k}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="txNote" placeholder="What was this for?" value="${t.note||''}"/></div>
    <div class="form-group"><label class="form-label">Tags</label><div class="tags-wrap">${ALL_TAGS.map(tg=>`<span class="tag-chip${selTags.includes(tg)?' selected':''}" data-tag="${tg}">#${tg}</span>`).join('')}</div><input type="hidden" id="txTags" value="${selTags.join(',')}"/></div>`;
}
function bindTxForm(t={}) {
  const setType=type=>{document.getElementById('txType').value=type;document.getElementById('tInc').className='type-btn'+(type==='income'?' active income':'');document.getElementById('tExp').className='type-btn'+(type==='expense'?' active expense':'');};
  document.getElementById('tInc').addEventListener('click',()=>{SFX.click();setType('income');});
  document.getElementById('tExp').addEventListener('click',()=>{SFX.click();setType('expense');});
  setType(t.type||'expense');
  document.querySelectorAll('.tag-chip').forEach(chip=>{
    chip.addEventListener('click',()=>{SFX.click();chip.classList.toggle('selected');const active=[...document.querySelectorAll('.tag-chip.selected')].map(c=>c.dataset.tag);document.getElementById('txTags').value=active.join(',');});
  });
}
function getTxForm() {
  const amt=parseFloat(document.getElementById('txAmt').value);
  if(!amt||amt<=0){toast('Amount must be > 0','error');return null;}
  const wid=document.getElementById('txWallet').value;
  if(!wid){toast('Select a wallet','error');return null;}
  const rawTags=document.getElementById('txTags').value;
  return {type:document.getElementById('txType').value,walletId:wid,amount:amt,category:document.getElementById('txCat').value,currency:document.getElementById('txCur').value||undefined,note:document.getElementById('txNote').value.trim(),tags:rawTags?rawTags.split(',').filter(Boolean):[]};
}
async function deleteTx(id) {
  const t=state.transactions.find(x=>x.id===id);if(!t)return;
  confirmDlg(`Delete "${t.note||t.category}" (${fmtMoney(t.amount)})?`,async()=>{
    const w=walletById(t.walletId);if(w)w.balance+=(t.type==='income'?-t.amount:t.amount);
    state.transactions=state.transactions.filter(x=>x.id!==id);
    await saveData();SFX.del();toast('Transaction deleted','info');navigateTo(currentPage);
  });
}

// ════════════════════════════════════════════════
// PAGE: RECURRING
// ════════════════════════════════════════════════
function renderRecurring(el) {
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Recurring</h2><button class="btn btn-primary" id="addRecBtn">+ New</button></div>
    <div class="tx-list">
      ${!state.recurring.length?'<div class="empty-state"><div class="empty-icon">🔄</div><div class="empty-title">No recurring transactions</div><div class="empty-desc">Set up subscriptions, salaries, or bills</div></div>':
        state.recurring.map(r=>{const w=walletById(r.walletId);return `<div class="tx-row">
          <div class="tx-icon-wrap ${r.type}">${r.type==='income'?'↑':'↓'}</div>
          <div class="tx-info-col">
            <div class="tx-name">${r.name}</div>
            <div class="tx-meta">${r.category} · ${w?w.name:''} · ${r.freq} · Next: ${nextDueDate(r)}</div>
          </div>
          <div class="tx-amount-col ${r.type}">${r.type==='income'?'+':'-'}${fmtMoney(r.amount)}</div>
          <div class="tx-actions-col" style="display:flex;gap:4px;align-items:center">
            <span class="badge ${r.active?'badge-green':'badge-red'}" style="cursor:pointer" data-toggle="${r.id}">${r.active?'Active':'Paused'}</span>
            <button class="btn btn-danger btn-icon-sm rec-del" data-id="${r.id}">🗑</button>
          </div>
        </div>`;}).join('')}
    </div>`;
  document.getElementById('addRecBtn').addEventListener('click',showAddRecModal);
  el.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',async()=>{const r=state.recurring.find(x=>x.id===b.dataset.toggle);if(r){r.active=!r.active;await saveData();SFX.click();navigateTo('recurring');}}) );
  el.querySelectorAll('.rec-del').forEach(b=>b.addEventListener('click',async()=>{confirmDlg('Delete this recurring transaction?',async()=>{state.recurring=state.recurring.filter(x=>x.id!==b.dataset.id);await saveData();SFX.del();navigateTo('recurring');});}));
}

function showAddRecModal() {
  if(!state.wallets.length){toast('Add a wallet first!','warning');return;}
  openModal('New Recurring',`
    <div class="type-toggle"><button type="button" class="type-btn active expense" id="rExp">− Expense</button><button type="button" class="type-btn" id="rInc">+ Income</button></div>
    <input type="hidden" id="rType" value="expense"/>
    <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="rName" placeholder="Netflix, Salary…"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Wallet</label><select class="form-select" id="rWallet">${state.wallets.map(w=>`<option value="${w.id}">${w.icon} ${w.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Amount</label><input class="form-input" id="rAmt" type="number" placeholder="0" min="1"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label><select class="form-select" id="rCat">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Frequency</label><select class="form-select" id="rFreq"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option><option value="yearly">Yearly</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" id="rStart" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>`,
  async()=>{
    const name=document.getElementById('rName').value.trim();
    const amt=parseFloat(document.getElementById('rAmt').value);
    if(!name||!amt||amt<=0){toast('Name and amount required','error');return;}
    state.recurring.push({id:uid(),name,type:document.getElementById('rType').value,walletId:document.getElementById('rWallet').value,amount:amt,category:document.getElementById('rCat').value,freq:document.getElementById('rFreq').value,startDate:document.getElementById('rStart').value,active:true,lastRun:null,createdAt:new Date().toISOString()});
    await saveData();closeModal();SFX.save();toast('Recurring added!','success');navigateTo('recurring');
  });
  // type toggle
  setTimeout(()=>{
    const setT=t=>{document.getElementById('rType').value=t;document.getElementById('rInc').className='type-btn'+(t==='income'?' active income':'');document.getElementById('rExp').className='type-btn'+(t==='expense'?' active expense':'');};
    document.getElementById('rInc').addEventListener('click',()=>setT('income'));
    document.getElementById('rExp').addEventListener('click',()=>setT('expense'));
  },50);
}

// ════════════════════════════════════════════════
// PAGE: BUDGET
// ════════════════════════════════════════════════
function renderBudget(el) {
  const now=new Date();
  const monthLabel=now.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Budget <span style="color:var(--text-tertiary);font-weight:400;font-size:1rem">· ${monthLabel}</span></h2><button class="btn btn-primary" id="addBudgetBtn">+ Set Budget</button></div>
    <div class="budget-list">
      ${!state.budgets.length?'<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-title">No budgets set</div><div class="empty-desc">Set spending limits per category to stay on track</div></div>':
        state.budgets.map(b=>{
          const spent=state.transactions.filter(t=>t.type==='expense'&&t.category===b.category&&isThisMonth(t.date)).reduce((s,t)=>s+t.amount,0);
          const pct=b.limit>0?Math.min(200,spent/b.limit):0;
          const cls=pct>=1?'over':pct>=0.8?'warn':'safe';
          return `<div class="budget-row${pct>=1?' budget-row-over':''}">
            <div>
              <div class="budget-cat">${b.category}</div>
              <div class="budget-track"><div class="budget-fill ${cls}" style="width:${Math.min(100,pct*100)}%"></div></div>
              <div class="budget-amounts">${fmtMoney(spent)} of ${fmtMoney(b.limit)} used${pct>=1?` · Over by ${fmtMoney(spent-b.limit)}`:'·Remaining '+fmtMoney(b.limit-spent)}</div>
            </div>
            <div style="text-align:right">
              <div class="budget-pct" style="color:${pct>=1?'var(--red)':pct>=0.8?'var(--orange)':'var(--green)'}">${Math.round(pct*100)}%</div>
              <button class="btn btn-danger btn-xs bud-del" data-id="${b.id}" style="margin-top:6px">Del</button>
            </div>
          </div>`;
        }).join('')}
    </div>`;
  document.getElementById('addBudgetBtn').addEventListener('click',()=>{
    openModal('Set Budget',`
      <div class="form-group"><label class="form-label">Category</label><select class="form-select" id="bCat">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Monthly Limit</label><input class="form-input" id="bLimit" type="number" placeholder="0" min="1"/></div>`,
    async()=>{
      const cat=document.getElementById('bCat').value,lim=parseFloat(document.getElementById('bLimit').value);
      if(!lim||lim<=0){toast('Set a valid limit','error');return;}
      const ex=state.budgets.find(b=>b.category===cat);
      if(ex){ex.limit=lim;ex.notified90=false;ex.notifiedOver=false;}
      else state.budgets.push({id:uid(),category:cat,limit:lim,notified90:false,notifiedOver:false});
      await saveData();closeModal();SFX.save();toast('Budget set!','success');navigateTo('budget');
    });
  });
  el.querySelectorAll('.bud-del').forEach(b=>b.addEventListener('click',async()=>{state.budgets=state.budgets.filter(x=>x.id!==b.dataset.id);await saveData();SFX.del();navigateTo('budget');}));
}

// ════════════════════════════════════════════════
// PAGE: GOALS
// ════════════════════════════════════════════════
function renderGoals(el) {
  const bal=totalBal();
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Savings Goals</h2><button class="btn btn-primary" id="addGoalBtn">+ New Goal</button></div>
    <div class="bento-grid" id="goalsGrid">
      ${!state.goals.length?'<div class="bento-card bento-12"><div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">No goals yet</div><div class="empty-desc">Set savings goals and track your progress</div></div></div>':
        state.goals.map((g,i)=>{
          const pct=Math.min(100,g.target>0?Math.round((g.amount/g.target)*100):0);
          const done=g.amount>=g.target;
          return `<div class="bento-card bento-3 goal-card" style="animation-delay:${i*.06}s">
            <div class="goal-header">
              <div>
                <div class="goal-name">${g.icon||'🎯'} ${g.name}</div>
                <div class="goal-amounts">${fmtMoney(g.amount)} of ${fmtMoney(g.target)}</div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-ghost btn-icon-sm goal-add" data-id="${g.id}" title="Add funds">+</button>
                <button class="btn btn-danger btn-icon-sm goal-del" data-id="${g.id}">🗑</button>
              </div>
            </div>
            <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
              <span class="goal-pct">${pct}%</span>
              ${done?'<span class="badge badge-green">🎉 Done!</span>':`<span style="font-size:.72rem;color:var(--text-tertiary)">Need ${fmtMoney(g.target-g.amount)}</span>`}
            </div>
            ${g.deadline?`<div style="font-size:.7rem;color:var(--text-tertiary);margin-top:6px">📅 Target: ${fmtDate(g.deadline)}</div>`:''}
          </div>`;
        }).join('')}
    </div>`;
  document.getElementById('addGoalBtn').addEventListener('click',showAddGoalModal);
  el.querySelectorAll('.goal-del').forEach(b=>b.addEventListener('click',async()=>{confirmDlg('Delete this goal?',async()=>{state.goals=state.goals.filter(g=>g.id!==b.dataset.id);await saveData();SFX.del();navigateTo('goals');});}));
  el.querySelectorAll('.goal-add').forEach(b=>b.addEventListener('click',()=>showAddFundsModal(b.dataset.id)));
}

function showAddGoalModal() {
  openModal('New Savings Goal',`
    <div class="form-row">
      <div class="form-group"><label class="form-label">Goal Name</label><input class="form-input" id="gName" placeholder="Emergency Fund, Vacation…"/></div>
      <div class="form-group"><label class="form-label">Icon</label><input class="form-input" id="gIcon" placeholder="🎯" maxlength="2" value="🎯"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Target Amount</label><input class="form-input" id="gTarget" type="number" placeholder="0" min="1"/></div>
      <div class="form-group"><label class="form-label">Target Date (optional)</label><input class="form-input" id="gDeadline" type="date"/></div>
    </div>
    <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="gNote" placeholder="What's this goal for?"></textarea></div>`,
  async()=>{
    const name=document.getElementById('gName').value.trim(),target=parseFloat(document.getElementById('gTarget').value);
    if(!name||!target||target<=0){toast('Name and target required','error');return;}
    state.goals.push({id:uid(),name,icon:document.getElementById('gIcon').value||'🎯',target,amount:0,deadline:document.getElementById('gDeadline').value||null,note:document.getElementById('gNote').value.trim(),createdAt:new Date().toISOString()});
    await saveData();closeModal();SFX.save();toast('Goal created!','success');navigateTo('goals');
  });
}

function showAddFundsModal(goalId) {
  const g=state.goals.find(x=>x.id===goalId);if(!g)return;
  openModal(`Add Funds — ${g.name}`,`
    <div style="margin-bottom:var(--sp-4);font-size:.85rem;color:var(--text-secondary)">Current: ${fmtMoney(g.amount)} / ${fmtMoney(g.target)}</div>
    <div class="form-group"><label class="form-label">Amount to Add</label><input class="form-input" id="gAddAmt" type="number" placeholder="0" min="1"/></div>`,
  async()=>{
    const amt=parseFloat(document.getElementById('gAddAmt').value);
    if(!amt||amt<=0){toast('Enter an amount','error');return;}
    g.amount=Math.min(g.target,(g.amount||0)+amt);
    if(g.amount>=g.target) addNotif('Goal Reached! 🎉',`${g.name} is fully funded!`,'🎯');
    await saveData();closeModal();SFX.save();toast(`Added ${fmtMoney(amt)} to ${g.name}`,'success');navigateTo('goals');
  });
}

// ════════════════════════════════════════════════
// PAGE: WISHLIST
// ════════════════════════════════════════════════
function renderWishlist(el) {
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Wishlist</h2><button class="btn btn-primary" id="addWishBtn">+ Add Item</button></div>
    <div class="bento-grid" id="wishGrid">
      ${!state.wishlist.length?'<div class="bento-card bento-12"><div class="empty-state"><div class="empty-icon">💝</div><div class="empty-title">Wishlist is empty</div><div class="empty-desc">Add items you want to save for</div></div></div>':
        state.wishlist.map((item,i)=>`
          <div class="bento-card bento-3" style="animation-delay:${i*.05}s;${item.purchased?'opacity:.6':''}">
            <div style="font-size:2rem;margin-bottom:var(--sp-3)">${item.icon||'✨'}</div>
            <div style="font-size:.9rem;font-weight:700;margin-bottom:2px;${item.purchased?'text-decoration:line-through':''}">${item.name}</div>
            <div style="font-size:1.2rem;font-weight:800;color:var(--accent);margin:var(--sp-2) 0">${fmtMoney(item.price)}</div>
            ${item.link?`<a href="${item.link}" target="_blank" style="font-size:.72rem;color:var(--blue);text-decoration:none">🔗 View item</a>`:''}
            <div style="display:flex;gap:6px;margin-top:var(--sp-4)">
              ${!item.purchased?`<button class="btn btn-success btn-xs wish-buy" data-id="${item.id}" style="flex:1">✅ Mark Bought</button>`:'<span class="badge badge-green">✅ Purchased</span>'}
              <button class="btn btn-danger btn-icon-sm wish-del" data-id="${item.id}">🗑</button>
            </div>
          </div>`).join('')}
    </div>`;
  document.getElementById('addWishBtn').addEventListener('click',()=>{
    openModal('Add Wishlist Item',`
      <div class="form-row"><div class="form-group"><label class="form-label">Item Name</label><input class="form-input" id="wiName" placeholder="iPhone, Shoes…"/></div><div class="form-group"><label class="form-label">Icon</label><input class="form-input" id="wiIcon" placeholder="✨" maxlength="2" value="✨"/></div></div>
      <div class="form-group"><label class="form-label">Price</label><input class="form-input" id="wiPrice" type="number" placeholder="0" min="1"/></div>
      <div class="form-group"><label class="form-label">Link (optional)</label><input class="form-input" id="wiLink" placeholder="https://…" type="url"/></div>
      <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="wiNote" placeholder="Why do you want this?"/></div>`,
    async()=>{
      const name=document.getElementById('wiName').value.trim(),price=parseFloat(document.getElementById('wiPrice').value);
      if(!name||!price||price<=0){toast('Name and price required','error');return;}
      state.wishlist.push({id:uid(),name,icon:document.getElementById('wiIcon').value||'✨',price,link:document.getElementById('wiLink').value.trim()||null,note:document.getElementById('wiNote').value.trim(),purchased:false,createdAt:new Date().toISOString()});
      await saveData();closeModal();SFX.save();toast('Added to wishlist!','success');navigateTo('wishlist');
    });
  });
  el.querySelectorAll('.wish-buy').forEach(b=>b.addEventListener('click',async()=>{const item=state.wishlist.find(x=>x.id===b.dataset.id);if(item){item.purchased=true;await saveData();SFX.save();toast('Marked as purchased!','success');navigateTo('wishlist');}}) );
  el.querySelectorAll('.wish-del').forEach(b=>b.addEventListener('click',async()=>{confirmDlg('Remove from wishlist?',async()=>{state.wishlist=state.wishlist.filter(x=>x.id!==b.dataset.id);await saveData();SFX.del();navigateTo('wishlist');});}));
}

// ════════════════════════════════════════════════
// PAGE: ANALYTICS
// ════════════════════════════════════════════════
function renderAnalytics(el) {
  const now=new Date();
  const thisMonth=state.transactions.filter(t=>isThisMonth(t.date));
  const lastMonth=state.transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===((now.getMonth()+11)%12)&&d.getFullYear()===(now.getMonth()===0?now.getFullYear()-1:now.getFullYear());});
  const tmIn=thisMonth.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const tmOut=thisMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const lmIn=lastMonth.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const lmOut=lastMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const inPct=lmIn>0?Math.round((tmIn-lmIn)/lmIn*100):0;
  const outPct=lmOut>0?Math.round((tmOut-lmOut)/lmOut*100):0;

  // Streak
  const days=[...new Set(state.transactions.map(t=>t.date?.slice(0,10)))].sort();
  let maxStreak=1,cur=1;
  for(let i=1;i<days.length;i++){const d1=new Date(days[i-1]),d2=new Date(days[i]);if((d2-d1)/(86400000)===1){cur++;maxStreak=Math.max(maxStreak,cur);}else cur=1;}

  // Projection
  const daysElapsed=now.getDate();
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const projOut=daysElapsed>0?Math.round(tmOut/daysElapsed*daysInMonth):0;

  // Heatmap data (last 10 weeks)
  const heatData={};
  state.transactions.filter(t=>t.type==='expense').forEach(t=>{const d=t.date?.slice(0,10);if(d)heatData[d]=(heatData[d]||0)+t.amount;});
  const maxHeat=Math.max(...Object.values(heatData),1);

  // Build 10-week heatmap
  const heatCells=[];
  const heatStart=new Date(); heatStart.setDate(heatStart.getDate()-69);
  for(let i=0;i<70;i++){const d=new Date(heatStart);d.setDate(d.getDate()+i);const key=d.toISOString().slice(0,10);const val=heatData[key]||0;const level=val===0?0:val<maxHeat*.25?1:val<maxHeat*.5?2:val<maxHeat*.75?3:4;heatCells.push(`<div class="heatmap-cell" data-level="${level}" title="${key}: ${val?fmtMoney(val):'No expenses'}"></div>`);}

  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Analytics</h2></div>
    <div class="bento-grid">

      <!-- MoM Income -->
      <div class="bento-card bento-3" style="animation-delay:.00s">
        <div class="card-eyebrow">Income vs Last Month</div>
        <div class="card-value green">${fmtMoney(tmIn)}</div>
        <div style="margin-top:6px"><span class="stat-pill ${inPct>=0?'up':'down'}">${inPct>=0?'↑':'↓'} ${Math.abs(inPct)}% MoM</span></div>
        <div class="card-sub">Last month: ${fmtMoney(lmIn)}</div>
      </div>

      <!-- MoM Expense -->
      <div class="bento-card bento-3" style="animation-delay:.04s">
        <div class="card-eyebrow">Expenses vs Last Month</div>
        <div class="card-value red">${fmtMoney(tmOut)}</div>
        <div style="margin-top:6px"><span class="stat-pill ${outPct<=0?'up':'down'}">${outPct<=0?'↓':'↑'} ${Math.abs(outPct)}% MoM</span></div>
        <div class="card-sub">Last month: ${fmtMoney(lmOut)}</div>
      </div>

      <!-- Streak -->
      <div class="bento-card bento-3" style="animation-delay:.08s">
        <div class="card-eyebrow">Best Activity Streak</div>
        <div class="card-value">${maxStreak}</div>
        <div class="card-sub">consecutive days with transactions</div>
      </div>

      <!-- Projection -->
      <div class="bento-card bento-3" style="animation-delay:.12s">
        <div class="card-eyebrow">Projected Spend This Month</div>
        <div class="card-value red">${fmtMoney(projOut)}</div>
        <div class="card-sub">Based on ${daysElapsed} days elapsed / ${daysInMonth} days</div>
      </div>

      <!-- 12-month trend -->
      <div class="bento-card bento-7" style="animation-delay:.16s">
        <div class="card-eyebrow" style="margin-bottom:16px">12-Month Trend</div>
        <div class="chart-wrap-lg"><canvas id="chartTrend"></canvas></div>
      </div>

      <!-- Top categories -->
      <div class="bento-card bento-5" style="animation-delay:.20s">
        <div class="card-eyebrow" style="margin-bottom:16px">Top Spending Categories</div>
        <div id="topCats"></div>
      </div>

      <!-- Heatmap -->
      <div class="bento-card bento-12" style="animation-delay:.24s">
        <div class="card-eyebrow" style="margin-bottom:var(--sp-4)">Activity Heatmap — Last 10 Weeks</div>
        <div class="heatmap-label-row">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="heatmap-label">${d}</div>`).join('')}</div>
        <div class="heatmap-grid">${heatCells.join('')}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:var(--sp-3);font-size:.68rem;color:var(--text-tertiary)">Less <div class="heatmap-cell" style="width:12px;height:12px;display:inline-block" data-level="0"></div><div class="heatmap-cell" style="width:12px;height:12px;display:inline-block" data-level="1"></div><div class="heatmap-cell" style="width:12px;height:12px;display:inline-block" data-level="2"></div><div class="heatmap-cell" style="width:12px;height:12px;display:inline-block" data-level="3"></div><div class="heatmap-cell" style="width:12px;height:12px;display:inline-block" data-level="4"></div> More</div>
      </div>

    </div>`;

  // Top categories
  const catTotals={};
  state.transactions.filter(t=>t.type==='expense'&&isThisMonth(t.date)).forEach(t=>{catTotals[t.category]=(catTotals[t.category]||0)+t.amount;});
  const sorted=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxCat=sorted[0]?.[1]||1;
  document.getElementById('topCats').innerHTML=sorted.length?sorted.map(([cat,amt])=>`
    <div style="margin-bottom:var(--sp-3)">
      <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:4px"><span style="font-weight:600">${cat}</span><span style="color:var(--text-secondary)">${fmtMoney(amt)}</span></div>
      <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${amt/maxCat*100}%"></div></div>
    </div>`).join(''):'<div class="empty-state" style="padding:20px 0"><div class="empty-title">No expense data</div></div>';

  // 12-month trend
  const trendCtx=document.getElementById('chartTrend');
  if(trendCtx){
    const months=[],inc12=[],exp12=[];
    for(let i=11;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push(d.toLocaleDateString('id-ID',{month:'short',year:'2-digit'}));const mt=state.transactions.filter(t=>{const td=new Date(t.date);return td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear();});inc12.push(mt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));exp12.push(mt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));}
    charts.trend=new Chart(trendCtx,{type:'line',data:{labels:months,datasets:[{label:'Income',data:inc12,borderColor:'rgba(52,211,153,.8)',backgroundColor:'rgba(52,211,153,.1)',fill:true,tension:0.4,borderWidth:2,pointRadius:3},{label:'Expense',data:exp12,borderColor:'rgba(248,113,113,.8)',backgroundColor:'rgba(248,113,113,.1)',fill:true,tension:0.4,borderWidth:2,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'var(--text-tertiary)',font:{family:'Inter',size:11},boxWidth:10}}},scales:{x:{ticks:{color:'var(--text-tertiary)',font:{family:'Inter',size:10}},grid:{color:'rgba(255,255,255,0.04)'}},y:{ticks:{color:'var(--text-tertiary)',font:{family:'Inter',size:10}},grid:{color:'rgba(255,255,255,0.04)'}}}}});
  }
}

// ════════════════════════════════════════════════
// PAGE: NOTES
// ════════════════════════════════════════════════
function renderNotes(el) {
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Daily Notes</h2><button class="btn btn-primary" id="addNoteBtn">+ New Note</button></div>
    <div class="notes-list">
      ${!state.notes.length?'<div class="bento-card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">No notes yet</div><div class="empty-desc">Keep daily financial memos here</div></div></div>':
        state.notes.slice().reverse().map((n,i)=>`
          <div class="note-card" style="animation-delay:${i*.04}s">
            <div class="note-date">📅 ${fmtDate(n.date)} ${n.title?`· <b>${n.title}</b>`:''}</div>
            <div class="note-content">${n.content}</div>
            <div style="display:flex;gap:4px;margin-top:var(--sp-3)">
              <button class="btn btn-ghost btn-xs note-edit" data-id="${n.id}">Edit</button>
              <button class="btn btn-danger btn-xs note-del" data-id="${n.id}">Delete</button>
            </div>
          </div>`).join('')}
    </div>`;
  document.getElementById('addNoteBtn').addEventListener('click',()=>showNoteModal());
  el.querySelectorAll('.note-edit').forEach(b=>b.addEventListener('click',()=>showNoteModal(b.dataset.id)));
  el.querySelectorAll('.note-del').forEach(b=>b.addEventListener('click',async()=>{confirmDlg('Delete this note?',async()=>{state.notes=state.notes.filter(x=>x.id!==b.dataset.id);await saveData();SFX.del();navigateTo('notes');});}));
}
function showNoteModal(id=null) {
  const n=id?state.notes.find(x=>x.id===id):null;
  openModal(n?'Edit Note':'New Note',`
    <div class="form-group"><label class="form-label">Title (optional)</label><input class="form-input" id="nTitle" placeholder="Note title…" value="${n?.title||''}"/></div>
    <div class="form-group"><label class="form-label">Content</label><textarea class="form-textarea" id="nContent" placeholder="Write your note…" style="min-height:120px">${n?.content||''}</textarea></div>`,
  async()=>{
    const content=document.getElementById('nContent').value.trim();
    if(!content){toast('Content required','error');return;}
    if(n){n.title=document.getElementById('nTitle').value.trim();n.content=content;n.updatedAt=new Date().toISOString();}
    else state.notes.push({id:uid(),title:document.getElementById('nTitle').value.trim(),content,date:new Date().toISOString(),createdAt:new Date().toISOString()});
    await saveData();closeModal();SFX.save();toast('Note saved!','success');navigateTo('notes');
  });
}

// ════════════════════════════════════════════════
// PAGE: EXPORT
// ════════════════════════════════════════════════
function renderExport(el) {
  const now=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const totalIn=state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalOut=state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Export</h2></div>
    <div class="export-preview-wrap">
      <div style="margin-bottom:var(--sp-4);font-size:.72rem;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;letter-spacing:.08em">Snapshot Preview</div>
      <div class="export-capture" id="exportCapture">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-6);padding-bottom:var(--sp-4);border-bottom:1px solid rgba(255,255,255,.07)">
          <div style="font-size:1.1rem;font-weight:800;color:#c9a84c;letter-spacing:-.02em">◈ WalletKu</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.35)">${now}</div>
        </div>
        <div style="text-align:center;margin-bottom:var(--sp-5)">
          <div style="font-size:.65rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Total Balance</div>
          <div style="font-size:2.2rem;font-weight:800;color:#c9a84c;letter-spacing:-.04em">${fmtMoney(totalBal())}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:var(--sp-5)">
          ${state.wallets.map(w=>`<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px"><div style="font-size:.68rem;color:rgba(255,255,255,.35);margin-bottom:4px">${w.icon} ${w.name}</div><div style="font-size:.95rem;font-weight:700;color:${w.color||'#c9a84c'}">${fmtMoney(w.balance||0,w.currency)}</div></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:var(--sp-4)">
          <div style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.15);border-radius:10px;padding:14px"><div style="font-size:.65rem;color:#34d399;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Total Income</div><div style="font-size:.95rem;font-weight:700;color:#34d399">${fmtMoney(totalIn)}</div></div>
          <div style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.15);border-radius:10px;padding:14px"><div style="font-size:.65rem;color:#f87171;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Total Expenses</div><div style="font-size:.95rem;font-weight:700;color:#f87171">${fmtMoney(totalOut)}</div></div>
        </div>
        <div style="text-align:center;font-size:.65rem;color:rgba(255,255,255,.2)">Private data · WalletKu v1.4.1 · ${new Date().toLocaleDateString('id-ID')}</div>
      </div>
    </div>
    <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap">
      <button class="btn btn-primary" id="exp1440">📸 Export 1440p</button>
      <button class="btn btn-ghost" id="exp4k">🖼️ Export 4K <span style="color:var(--text-tertiary);font-size:.72rem">(10s delay)</span></button>
      <div id="expCount" style="display:flex;align-items:center;font-size:.8rem;color:var(--text-tertiary)"></div>
    </div>`;
  document.getElementById('exp1440').addEventListener('click',()=>doExport(1440,false));
  document.getElementById('exp4k').addEventListener('click',()=>doExport(4096,true));
}

async function doExport(width,is4k) {
  const b1=document.getElementById('exp1440'),b4=document.getElementById('exp4k'),cd=document.getElementById('expCount'),cap=document.getElementById('exportCapture');
  if(!cap)return;
  if(is4k){b4.disabled=true;b1.disabled=true;let s=10;cd.textContent=`⏳ Rendering 4K… ${s}s`;const iv=setInterval(()=>{s--;cd.textContent=s>0?`⏳ Rendering 4K… ${s}s`:'✅ Ready!';if(s<=0)clearInterval(iv);},1000);await new Promise(r=>setTimeout(r,10000));}
  try{
    const scale=width/cap.offsetWidth,canvas=await html2canvas(cap,{scale,useCORS:true,backgroundColor:'#07090f',logging:false});
    const a=document.createElement('a');a.download=`WalletKu_${is4k?'4K':'1440p'}_${new Date().toISOString().slice(0,10)}.png`;a.href=canvas.toDataURL('image/png',1.0);a.click();
    SFX.save();toast(`Exported ${is4k?'4K':'1440p'}!`,'success');
  }catch(e){toast('Export failed','error');}
  finally{if(b1)b1.disabled=false;if(b4)b4.disabled=false;if(cd)cd.textContent='';}
}

// ════════════════════════════════════════════════
// PAGE: CHANGELOG
// ════════════════════════════════════════════════
async function renderChangelog(el) {
  el.innerHTML = `
    <div class="section-header"><h2 class="section-title">Changelog</h2></div>
    <div id="clContent">
      <div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">Loading…</div></div>
    </div>`;
  try {
    const res = await fetch('changelogs.md');
    if (!res.ok) throw new Error('not found');
    buildChangelogCards(await res.text(), document.getElementById('clContent'));
  } catch(e) {
    document.getElementById('clContent').innerHTML =
      '<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">changelogs.md not found</div><div class="empty-desc">Make sure the file is in the same folder as index.html</div></div>';
  }
}

function buildChangelogCards(md, container) {
  const blocks = md.split(/^## /m).filter(b => b.trim());
  if (!blocks.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Changelog is empty</div></div>';
    return;
  }

  // Color map per version prefix
  const vColor = v => {
    if (v.startsWith('v1.4')) return 'var(--accent)';
    if (v.startsWith('v1.3')) return 'var(--purple)';
    if (v.startsWith('v1.2')) return 'var(--blue)';
    if (v.startsWith('v1.1')) return 'var(--green)';
    return 'var(--text-secondary)';
  };

  const html = blocks.map((block, idx) => {
    const lines   = block.split('\n');
    const header  = lines[0].trim();
    const rest    = lines.slice(1).join('\n');
    const parts   = header.split(/\s*—\s*/);
    const version = parts[0]?.trim() || header;
    const date    = parts[1]?.trim() || '';

    const sections = rest.split(/^### /m).filter(s => s.trim());
    const sectHTML = sections.map(sec => {
      const sl    = sec.split('\n');
      const title = sl[0].trim();
      const items = sl.slice(1)
        .filter(l => l.trim().startsWith('-'))
        .map(l => `<div style="display:flex;gap:8px;font-size:.82rem;color:var(--text-secondary);line-height:1.55;padding:3px 0"><span style="color:var(--text-quaternary);flex-shrink:0">—</span><span>${l.replace(/^[-*]\s*/,'').replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').trim()}</span></div>`)
        .join('');
      return items ? `
        <div style="margin-bottom:var(--sp-4)">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-tertiary);margin-bottom:var(--sp-2)">${title}</div>
          ${items}
        </div>` : '';
    }).join('');

    const isCurrent = idx === 0;

    return `
      <div class="bento-card bento-12" style="animation-delay:${idx*.06}s;${isCurrent?`border-color:${vColor(version)}33;`:''}position:relative;overflow:hidden">
        ${isCurrent ? `<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${vColor(version)},transparent)"></div>` : ''}
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--sp-4);gap:var(--sp-4)">
          <div>
            <div style="font-size:1.1rem;font-weight:800;letter-spacing:-.03em;color:${vColor(version)}">${version}</div>
            ${date ? `<div style="font-size:.72rem;color:var(--text-tertiary);margin-top:3px">📅 ${date}</div>` : ''}
          </div>
          ${isCurrent ? `<span class="badge badge-gold" style="flex-shrink:0">Current</span>` : ''}
        </div>
        ${sectHTML || `<div style="font-size:.82rem;color:var(--text-secondary)">${rest.split('\n').filter(l=>l.trim().startsWith('-')).map(l=>`<div style="padding:3px 0">— ${l.replace(/^[-*]\s*/,'').trim()}</div>`).join('')}</div>`}
      </div>`;
  }).join('');

  container.innerHTML = `<div class="bento-grid">${html}</div>`;
}

// ════════════════════════════════════════════════
// PAGE: SHORTCUTS
// ════════════════════════════════════════════════
function renderShortcuts(el) {
  const groups=[
    {title:'🔐 PIN Screen',items:[
      {keys:['0–9'],title:'Enter PIN digit',desc:'Type numbers directly from keyboard — no clicking needed'},
      {keys:['Backspace'],title:'Delete last digit',desc:'Remove the last entered digit'},
      {keys:['Other keys'],title:'Invalid key flash',desc:'Non-numeric keys trigger a brief error flash without clearing your PIN'},
    ]},
    {title:'📋 Modal / Dialogs',items:[
      {keys:['X'],title:'Close / Cancel',desc:'Close the modal when not typing in a field'},
      {keys:['Enter'],title:'Confirm / Save',desc:'Only triggers Save when the Save button is focused (Tab to it first)'},
      {keys:['Tab'],title:'Navigate fields',desc:'Move between form inputs inside modals'},
    ]},
    {title:'🧭 Navigation',items:[
      {keys:['Click nav'],title:'Switch page',desc:'Click sidebar items to navigate between all pages'},
      {keys:['Click FAB +'],title:'Quick add transaction',desc:'Floating button opens Add Transaction modal from any page'},
    ]},
    {title:'📸 Export',items:[
      {keys:['1440p'],title:'Export HD snapshot',desc:'Instant PNG export at 1440p width'},
      {keys:['4K'],title:'Export 4K snapshot',desc:'4K PNG with 10-second render delay for full quality'},
    ]},
    {title:'🔔 Notifications',items:[
      {keys:['Bell 🔔'],title:'Toggle notification panel',desc:'Click the bell in the top bar to see recent alerts'},
      {keys:['Clear all'],title:'Clear notifications',desc:'Remove all notifications from the panel'},
    ]},
    {title:'🌙 Theme',items:[
      {keys:['Theme button'],title:'Toggle Light / Dark',desc:'Switch between dark and light mode — saved automatically'},
    ]},
    {title:'🔒 Security',items:[
      {keys:['Lock App'],title:'Lock WalletKu',desc:'Returns to PIN screen, clears session. All data remains encrypted.'},
    ]},
  ];
  el.innerHTML=`<div class="section-header"><h2 class="section-title">Keyboard Shortcuts</h2></div>${
    groups.map(g=>`<div class="shortcut-section"><div class="shortcut-section-title">${g.title}</div><div class="shortcut-list">${
      g.items.map(item=>`<div class="shortcut-row"><div class="shortcut-info"><div class="shortcut-row-title">${item.title}</div><div class="shortcut-row-desc">${item.desc}</div></div><div class="key-group">${item.keys.map(k=>`<span class="kbd">${k}</span>`).join('<span style="color:var(--text-tertiary);font-size:.7rem;padding:0 2px">·</span>')}</div></div>`).join('')
    }</div></div>`).join('')}`;
}

// ════════════════════════════════════════════════
// PAGE: SETTINGS
// ════════════════════════════════════════════════
function renderSettings(el) {
  el.innerHTML=`
    <div class="section-header"><h2 class="section-title">Settings</h2></div>

    <div class="settings-section">
      <div class="settings-section-title">Account</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info"><div class="settings-row-title">Username</div><div class="settings-row-sub">Your display name</div></div>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="form-input" id="sUsername" value="${currentUser||''}" style="max-width:160px"/>
            <button class="btn btn-primary btn-sm" id="saveUsername">Save</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info"><div class="settings-row-title">Default Currency</div><div class="settings-row-sub">Used for new wallets and transactions</div></div>
          <select class="form-select" id="sCurrency" style="max-width:160px">${Object.entries(CURRENCIES).map(([k,v])=>`<option value="${k}"${state.settings.currency===k?' selected':''}>${k} — ${v.name}</option>`).join('')}</select>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Security</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info"><div class="settings-row-title">Change PIN</div><div class="settings-row-sub">Re-encrypts all data with new PIN</div></div>
          <button class="btn btn-ghost btn-sm" id="changePinBtn">Change PIN</button>
        </div>
        <div class="settings-row">
          <div class="settings-row-info"><div class="settings-row-title">Backup Code</div><div class="settings-row-sub">Emergency recovery code (store safely)</div></div>
          <button class="btn btn-ghost btn-sm" id="genBackupBtn">Generate Code</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Data</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info"><div class="settings-row-title">Export Backup</div><div class="settings-row-sub">Encrypted JSON — restore needs same PIN</div></div>
          <button class="btn btn-ghost btn-sm" id="expBackupBtn">⬇ Export</button>
        </div>
        <div class="settings-row">
          <div class="settings-row-info"><div class="settings-row-title">Import Backup</div><div class="settings-row-sub">Merge or restore from backup file</div></div>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer">⬆ Import<input type="file" id="impFile" accept=".json" style="display:none"/></label>
        </div>
        <div id="impMsg" style="padding:0 var(--sp-5) var(--sp-3);font-size:.78rem;color:var(--text-tertiary)"></div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Danger Zone</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info"><div class="settings-row-title" style="color:var(--red)">Clear All Data</div><div class="settings-row-sub">Deletes all wallets, transactions, goals. PIN & username preserved.</div></div>
          <button class="btn btn-danger btn-sm" id="clearDataBtn">Clear</button>
        </div>
      </div>
    </div>`;

  // Save username
  document.getElementById('saveUsername').addEventListener('click',async()=>{const v=document.getElementById('sUsername').value.trim();if(!v||v.length<3){toast('Min 3 characters','error');return;}if(!/^[a-zA-Z0-9_]+$/.test(v)){toast('Letters, numbers, underscore only','error');return;}localStorage.setItem(LS_USER,v);currentUser=v;document.getElementById('userName').textContent=v;document.getElementById('userAvatar').textContent=v[0].toUpperCase();document.getElementById('topbarGreeting').textContent=greet()+', '+v;SFX.save();toast('Username updated!','success');});

  // Currency change
  document.getElementById('sCurrency').addEventListener('change',async e=>{state.settings.currency=e.target.value;await saveData();SFX.click();toast('Currency updated','success');});

  // Change PIN
  document.getElementById('changePinBtn').addEventListener('click',()=>{
    openModal('Change PIN',`
      <div class="form-group"><label class="form-label">Current PIN</label><input class="form-input" id="pOld" type="password" maxlength="6" placeholder="6 digits"/></div>
      <div class="form-row"><div class="form-group"><label class="form-label">New PIN</label><input class="form-input" id="pNew" type="password" maxlength="6" placeholder="6 digits"/></div><div class="form-group"><label class="form-label">Confirm New PIN</label><input class="form-input" id="pConf" type="password" maxlength="6" placeholder="6 digits"/></div></div>`,
    async()=>{
      const op=document.getElementById('pOld').value,np=document.getElementById('pNew').value,cp=document.getElementById('pConf').value;
      if(op.length!==6||np.length!==6){toast('PINs must be 6 digits','error');return;}
      if(np!==cp){toast("New PINs don't match",'error');return;}
      try{
        const saltBuf=new Uint8Array(unb64(localStorage.getItem(LS_SALT)));
        const key=await deriveKey(op,saltBuf);
        const pl=await decrypt(key,localStorage.getItem(LS_VERIFY));
        if(pl!==VERIFY_KEY&&pl!=='WALLETKU_OK')throw new Error();
        const ns=crypto.getRandomValues(new Uint8Array(32));localStorage.setItem(LS_SALT,b64(ns));
        const nk=await deriveKey(np,ns);localStorage.setItem(LS_VERIFY,await encrypt(nk,VERIFY_KEY));
        cryptoKey=nk;cachePin(np);await saveData();closeModal();SFX.save();toast('PIN changed!','success');
      }catch(e){SFX.fail();toast('Current PIN incorrect','error');}
    });
  });

  // Generate backup code
  document.getElementById('genBackupBtn').addEventListener('click',()=>{
    const code=Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{4}/g).join('-');
    state.settings.backupCode=code;saveData();
    openModal('Your Backup Code',`<div style="font-family:monospace;font-size:1.2rem;font-weight:800;letter-spacing:.1em;text-align:center;padding:var(--sp-6);background:var(--glass-bg);border-radius:var(--r-md);color:var(--accent);word-break:break-all">${code}</div><div style="font-size:.8rem;color:var(--text-secondary);margin-top:var(--sp-4);line-height:1.6">⚠️ Store this code safely. It doesn't replace your PIN but can help identify your account data.</div>`);
  });

  // Export backup
  document.getElementById('expBackupBtn').addEventListener('click',async()=>{const raw=localStorage.getItem(LS_DATA);if(!raw){toast('No data to export','warning');return;}const blob=new Blob([JSON.stringify({wk_backup:true,version:'2.3',data:raw,exported:new Date().toISOString()})],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`WalletKu_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();SFX.save();toast('Backup exported!','success');});

  // Import backup
  document.getElementById('impFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const msg=document.getElementById('impMsg');try{const obj=JSON.parse(await file.text());if(!obj.wk_backup||!obj.data)throw new Error('Invalid backup format');const json=await decrypt(cryptoKey,obj.data);state={...state,...JSON.parse(json)};await saveData();SFX.save();toast('Backup restored!','success');msg.textContent='✅ Restored at '+new Date().toLocaleTimeString('id-ID');navigateTo('dashboard');}catch(err){SFX.fail();toast('Import failed — must use same PIN','error');msg.textContent='❌ '+err.message;}e.target.value='';});

  // Clear data
  document.getElementById('clearDataBtn').addEventListener('click',()=>{confirmDlg('Delete ALL wallets, transactions, goals, budgets, notes, wishlist, and recurring? This cannot be undone.',async()=>{state={wallets:[],transactions:[],goals:[],wishlist:[],budgets:[],recurring:[],notes:[],settings:{...state.settings}};await saveData();SFX.del();toast('All data cleared','info');navigateTo('dashboard');});});
}

// ════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCursorGlow();
  initPinScreen();
});
