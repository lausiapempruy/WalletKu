/* ============================================
   WALLETKU v2.2 — wallet.js
   Keyboard PIN · Modal Shortcuts · Shortcuts Page · Recap Nav
   ============================================ */
'use strict';

const LS_SALT      = 'wk_salt_v2';
const LS_VERIFY    = 'wk_verify_v2';
const LS_DATA      = 'wk_data_v2';
const LS_USER      = 'wk_username_v2';
const LS_RECAP     = 'wk_recap_v2';
const VERIFY_PLAIN = 'WALLETKU_OK';

const EMOJI_LIST = ['💰','💳','🏦','🏧','📦','🛒','✈️','🎓','💊','🏠','🚗','🍕','☕','🎮','💎','🌟','🎯','🔑','🌿','⚡'];
const COLORS     = ['#c9a84c','#2dd98f','#5b8dee','#f25c5c','#a78bfa','#fb923c','#38bdf8','#f472b6','#34d399','#e879f9'];
const CATEGORIES = ['Makanan','Transport','Belanja','Hiburan','Kesehatan','Pendidikan','Tabungan','Gaji','Bonus','Transfer','Lainnya'];

let cryptoKey   = null;
let currentUser = null;
let currentPage = 'dashboard';
let charts      = {};
let txFilters   = { wallet:'', type:'', category:'', dateFrom:'', dateTo:'', search:'' };
let state = {
  wallets:[], transactions:[], goals:[],
  settings:{ currency:'IDR', createdAt:null }
};

// ──────────────────────────────────────────────
// SOUND ENGINE
// ──────────────────────────────────────────────
let audioCtx = null;
function getACtx(){
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if (audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freq,type,dur,vol=0.14){
  try{
    const ctx=getACtx(), o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    o.start(); o.stop(ctx.currentTime+dur);
  }catch(e){}
}
const SFX = {
  pinTap()    { playTone(880,'sine',0.08,0.11); },
  pinFill()   { playTone(1200,'sine',0.06,0.09); },
  pinError()  { playTone(180,'sawtooth',0.3,0.18); setTimeout(()=>playTone(140,'sawtooth',0.25,0.14),120); },
  pinWrongKey(){ playTone(220,'sawtooth',0.12,0.1); },
  pinSuccess(){ [660,880,1100].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.18,0.13),i*100)); },
  loginOk()  { [440,550,660,880].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.2,0.13),i*70)); },
  loginFail(){ playTone(200,'square',0.25,0.18); setTimeout(()=>playTone(160,'square',0.2,0.28),150); },
  click()    { playTone(600,'sine',0.06,0.09); },
  save()     { playTone(740,'sine',0.12,0.14); setTimeout(()=>playTone(988,'sine',0.1,0.17),90); },
  del()      { playTone(300,'triangle',0.15,0.2); },
  toast()    { playTone(880,'sine',0.055,0.09); },
  nav()      { playTone(520,'sine',0.045,0.07); },
  lock()     { [440,330,220].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.15,0.11),i*80)); },
  export_()  { [440,550,660,770,880].forEach((f,i)=>setTimeout(()=>playTone(f,'triangle',0.13,0.09),i*60)); },
};

// ──────────────────────────────────────────────
// PARTICLES
// ──────────────────────────────────────────────
function initParticles(){
  const canvas=document.getElementById('particleCanvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  let W,H,pts=[];
  function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
  resize(); window.addEventListener('resize',resize);
  for(let i=0;i<80;i++) pts.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*1.5+0.3,dx:(Math.random()-.5)*.28,dy:(Math.random()-.5)*.28,c:['#c9a84c','#5b8dee','#a78bfa'][Math.floor(Math.random()*3)],o:Math.random()*.45+.08});
  function draw(){
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{ p.x+=p.dx; p.y+=p.dy; if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.c; ctx.globalAlpha=p.o; ctx.fill(); });
    ctx.globalAlpha=1;
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.sqrt(dx*dx+dy*dy);
      if(d<100){ ctx.beginPath(); ctx.strokeStyle='#c9a84c'; ctx.globalAlpha=(1-d/100)*.055; ctx.lineWidth=.5; ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(draw);
  }
  draw();
}

// ──────────────────────────────────────────────
// CARD TILT
// ──────────────────────────────────────────────
function initCardTilt(){
  document.addEventListener('mousemove',e=>{
    document.querySelectorAll('.wallet-card,.stat-card').forEach(card=>{
      const r=card.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
      const dx=(e.clientX-cx)/(r.width/2), dy=(e.clientY-cy)/(r.height/2);
      const dist=Math.sqrt(dx*dx+dy*dy);
      card.style.transform = dist<1.5 ? `perspective(600px) rotateX(${-dy*4}deg) rotateY(${dx*4}deg) translateZ(4px)` : '';
    });
  });
}

// ──────────────────────────────────────────────
// CRYPTO
// ──────────────────────────────────────────────
const enc=new TextEncoder(), dec=new TextDecoder();
function bufToB64(b){ return btoa(String.fromCharCode(...new Uint8Array(b))); }
function b64ToBuf(s){ return Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer; }

async function deriveKey(pin,salt){
  const km=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encrypt(key,pt){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(pt));
  return bufToB64(iv)+'.'+bufToB64(ct);
}
async function decrypt(key,cipher){
  const [iv64,ct64]=cipher.split('.');
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b64ToBuf(iv64))},key,b64ToBuf(ct64));
  return dec.decode(pt);
}

// ──────────────────────────────────────────────
// STORAGE
// ──────────────────────────────────────────────
async function saveData(){
  if(!cryptoKey) return;
  localStorage.setItem(LS_DATA,await encrypt(cryptoKey,JSON.stringify(state)));
  // Store session key for recap page (session only, not persistent)
  sessionStorage.setItem('wk_session_key', document.getElementById('_pinCache')?.value || '');
}
async function loadData(){
  const raw=localStorage.getItem(LS_DATA);
  if(!raw) return;
  try{ state=JSON.parse(await decrypt(cryptoKey,raw)); }catch(e){ console.warn(e); }
}

// ──────────────────────────────────────────────
// PIN SCREEN
// ──────────────────────────────────────────────
let pinBuffer='', isSetup=false, pinConfirmBuf='', isConfirming=false;
let pinErrorTimeout=null;

function initPinScreen(){
  const hasSalt=!!localStorage.getItem(LS_SALT);
  const hasVerify=!!localStorage.getItem(LS_VERIFY);
  isSetup=!(hasSalt&&hasVerify);
  const sub=document.getElementById('pinSub');
  if(isSetup){ sub.textContent='Buat PIN 6 digit baru'; }
  else { sub.textContent='Masukkan PIN untuk membuka'; }

  // Click handlers (mobile/mouse)
  document.querySelectorAll('.pin-btn[data-val]').forEach(b=>b.addEventListener('click',()=>{ SFX.pinTap(); handlePinInput(b.dataset.val); }));
  document.getElementById('pinDel').addEventListener('click',()=>{ SFX.click(); handlePinDel(); });

  // KEYBOARD: listen globally for PIN screen
  document.addEventListener('keydown',handlePinKeyboard);
}

function handlePinKeyboard(e){
  const screen=document.getElementById('pinScreen');
  if(!screen || screen.style.display==='none') return;

  if(e.key>='0'&&e.key<='9'){
    SFX.pinTap();
    handlePinInput(e.key);
  } else if(e.key==='Backspace'){
    SFX.click();
    handlePinDel();
  } else if(e.key==='Enter'){
    // do nothing, auto-submits at 6 digits
  } else {
    // Non-numeric, non-backspace key — flash error briefly
    if(pinErrorTimeout) clearTimeout(pinErrorTimeout);
    const card=document.getElementById('pinScreen').querySelector('.pin-card');
    SFX.pinWrongKey();
    card.classList.add('key-error');
    // Brief flash on dots
    document.querySelectorAll('#pinDots span').forEach((d,i)=>{ if(i<pinBuffer.length) d.style.boxShadow='0 0 8px rgba(242,92,92,.6)'; });
    pinErrorTimeout=setTimeout(()=>{
      card.classList.remove('key-error');
      document.querySelectorAll('#pinDots span').forEach(d=>{ d.style.boxShadow=''; });
    }, 400);
    e.preventDefault();
  }
}

function handlePinInput(val){
  if(pinBuffer.length>=6) return;
  pinBuffer+=val;
  updatePinDots(pinBuffer.length);
  SFX.pinFill();
  if(pinBuffer.length===6) setTimeout(()=>processPinEntry(),200);
}

function handlePinDel(){
  if(pinBuffer.length>0){ pinBuffer=pinBuffer.slice(0,-1); updatePinDots(pinBuffer.length); }
}

function updatePinDots(count,mode='normal'){
  document.querySelectorAll('#pinDots span').forEach((d,i)=>{
    d.className='';
    if(i<count) d.classList.add(mode==='error'?'error':'filled');
  });
}

function setPinError(msg){
  SFX.pinError();
  document.getElementById('pinError').textContent=msg;
  updatePinDots(6,'error');
  setTimeout(()=>{ pinBuffer=''; updatePinDots(0); document.getElementById('pinError').textContent=''; },900);
}

async function processPinEntry(){
  if(isSetup){
    if(!isConfirming){
      pinConfirmBuf=pinBuffer; pinBuffer=''; isConfirming=true;
      updatePinDots(0);
      document.getElementById('pinSub').textContent='Konfirmasi PIN kamu';
    } else {
      if(pinBuffer!==pinConfirmBuf){ setPinError('PIN tidak cocok, ulangi'); pinBuffer=''; isConfirming=false; pinConfirmBuf=''; document.getElementById('pinSub').textContent='Buat PIN 6 digit baru'; return; }
      await setupPin(pinBuffer);
    }
  } else {
    await verifyPin(pinBuffer);
  }
}

async function setupPin(pin){
  const saltBuf=crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(LS_SALT,bufToB64(saltBuf));
  cryptoKey=await deriveKey(pin,saltBuf);
  localStorage.setItem(LS_VERIFY,await encrypt(cryptoKey,VERIFY_PLAIN));
  state.settings.createdAt=new Date().toISOString();
  // Cache pin for session (recap page)
  setCachedPin(pin);
  await saveData();
  SFX.pinSuccess();
  afterPinUnlock();
}

async function verifyPin(pin){
  try{
    const saltBuf=b64ToBuf(localStorage.getItem(LS_SALT));
    const key=await deriveKey(pin,saltBuf);
    const plain=await decrypt(key,localStorage.getItem(LS_VERIFY));
    if(plain!==VERIFY_PLAIN) throw new Error();
    cryptoKey=key;
    setCachedPin(pin);
    await loadData();
    SFX.pinSuccess();
    afterPinUnlock();
  }catch(e){ setPinError('PIN salah, coba lagi'); pinBuffer=''; }
}

// Store pin temporarily in sessionStorage so recap.html can decrypt
function setCachedPin(pin){
  // We store it in sessionStorage — same tab session only
  sessionStorage.setItem('wk_session_key', pin);
  // Also keep a hidden input so saveData can refresh it
  let h=document.getElementById('_pinCache');
  if(!h){ h=document.createElement('input'); h.type='hidden'; h.id='_pinCache'; document.body.appendChild(h); }
  h.value=pin;
}

function afterPinUnlock(){
  document.removeEventListener('keydown',handlePinKeyboard);
  document.getElementById('pinScreen').style.display='none';
  currentUser=localStorage.getItem(LS_USER);
  if(currentUser){ showApp(); } else { showLoginScreen(true); }
}

// ──────────────────────────────────────────────
// LOGIN / REGISTER
// ──────────────────────────────────────────────
let loginIsRegister=false;

function showLoginScreen(isRegister=false){
  loginIsRegister=isRegister;
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  const badge=document.getElementById('loginBadge'), title=document.getElementById('loginTitle'), sub=document.getElementById('loginSub'), sw=document.getElementById('loginSwitch'), btnTxt=document.getElementById('loginBtnText');
  if(isRegister){ badge.textContent='Pendaftaran Pertama'; title.textContent='Buat Username'; sub.textContent='Username untuk menyapa kamu di app'; btnTxt.textContent='Daftar & Masuk'; sw.innerHTML=''; }
  else { badge.textContent='Selamat Datang'; title.textContent='Masuk ke Akun'; sub.textContent='Masukkan username yang sudah terdaftar'; btnTxt.textContent='Masuk'; sw.innerHTML='<span>Ganti akun? </span><a id="switchToRegister">Daftar ulang</a>'; setTimeout(()=>{ const s=document.getElementById('switchToRegister'); if(s) s.addEventListener('click',()=>{ SFX.click(); showLoginScreen(true); }); },100); }
  document.getElementById('usernameInput').value='';
  document.getElementById('loginError').textContent='';
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('loginCountdown').classList.add('hidden');
  document.getElementById('loginBtn').onclick=()=>handleLogin();
  document.getElementById('usernameInput').onkeydown=e=>{ if(e.key==='Enter') handleLogin(); };
  setTimeout(()=>document.getElementById('usernameInput').focus(),300);
}

async function handleLogin(){
  const val=document.getElementById('usernameInput').value.trim();
  const err=document.getElementById('loginError');
  if(!val){ err.textContent='Username tidak boleh kosong'; SFX.loginFail(); return; }
  if(val.length<3){ err.textContent='Minimal 3 karakter'; SFX.loginFail(); return; }
  if(!/^[a-zA-Z0-9_]+$/.test(val)){ err.textContent='Hanya huruf, angka, underscore'; SFX.loginFail(); return; }
  if(!loginIsRegister){
    const saved=localStorage.getItem(LS_USER);
    if(!saved){ err.textContent='Belum ada akun, daftar dulu'; SFX.loginFail(); return; }
    if(val.toLowerCase()!==saved.toLowerCase()){ err.textContent='Username tidak dikenali'; SFX.loginFail(); return; }
  }
  SFX.loginOk(); err.textContent='';
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('loginCountdown').classList.remove('hidden');
  document.getElementById('countdownText').textContent=loginIsRegister?'Menyiapkan akunmu...':'Memuat sesi...';
  let sec=3;
  const circle=document.getElementById('countdownCircle'), numEl=document.getElementById('countdownNum');
  numEl.textContent=sec; circle.style.strokeDashoffset='0';
  const interval=setInterval(()=>{ sec--; numEl.textContent=sec; circle.style.strokeDashoffset=String(163*(1-sec/3)); if(sec<=0){ clearInterval(interval); localStorage.setItem(LS_USER,val); currentUser=val; document.getElementById('loginScreen').classList.add('hidden'); showApp(); } },1000);
}

// ──────────────────────────────────────────────
// APP
// ──────────────────────────────────────────────
function showApp(){
  document.getElementById('app').classList.remove('hidden');
  initApp();
}

function initApp(){
  const name=currentUser||'User';
  document.getElementById('userName').textContent=name;
  document.getElementById('userAvatar').textContent=name[0].toUpperCase();
  document.getElementById('topbarGreeting').textContent=greeting()+', '+name+'!';
  setupNav();
  document.getElementById('lockBtn').addEventListener('click',lockApp);
  document.getElementById('hamburger').addEventListener('click',openSidebar);
  document.getElementById('sidebarClose').addEventListener('click',closeSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click',closeSidebar);
  updateDate();
  updateRecapBadge();
  navigateTo('dashboard');
}

function greeting(){ const h=new Date().getHours(); if(h<11)return'Selamat pagi'; if(h<15)return'Selamat siang'; if(h<18)return'Selamat sore'; return'Selamat malam'; }
function updateDate(){ document.getElementById('topbarDate').textContent=new Date().toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'}); }

function updateRecapBadge(){
  const badge=document.getElementById('recapBadge');
  if(!badge) return;
  const rec=JSON.parse(localStorage.getItem(LS_RECAP)||'{}');
  const txCount=(state.transactions||[]).length;
  if(rec.watched&&rec.watchedAt){
    const age=Date.now()-rec.watchedAt;
    if(age<7*24*60*60*1000){ badge.textContent='✓ Tersedia'; }
    else { badge.textContent='Tutup'; badge.style.background='rgba(242,92,92,.15)'; badge.style.color='var(--red)'; badge.style.borderColor='rgba(242,92,92,.25)'; }
  } else if(txCount>=30){ badge.textContent='Siap!'; badge.style.background='rgba(45,217,143,.15)'; badge.style.color='var(--green)'; badge.style.borderColor='rgba(45,217,143,.25)'; }
  else { badge.textContent=txCount+'/30'; }
}

function setupNav(){
  document.querySelectorAll('.nav-item[data-page]').forEach(btn=>{
    btn.addEventListener('click',()=>{ SFX.nav(); navigateTo(btn.dataset.page); closeSidebar(); });
  });
  // Recap nav button
  const recapBtn=document.getElementById('recapNavBtn');
  if(recapBtn) recapBtn.addEventListener('click',()=>{ SFX.nav(); closeSidebar(); window.open('recap.html','_self'); });
}

function navigateTo(page){
  currentPage=page;
  document.querySelectorAll('.nav-item[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const titles={dashboard:'Dashboard',wallets:'Wallets',transactions:'Transaksi',goals:'Target',export:'Export',changelog:'Changelog',shortcuts:'Shortcuts',settings:'Settings'};
  document.getElementById('topbarTitle').textContent=titles[page]||page;
  Object.values(charts).forEach(c=>{ try{c.destroy();}catch(e){} }); charts={};
  const content=document.getElementById('content');
  content.innerHTML='';
  switch(page){
    case 'dashboard':    renderDashboard(content);    break;
    case 'wallets':      renderWallets(content);      break;
    case 'transactions': renderTransactions(content); break;
    case 'goals':        renderGoals(content);        break;
    case 'export':       renderExport(content);       break;
    case 'changelog':    renderChangelog(content);    break;
    case 'shortcuts':    renderShortcuts(content);    break;
    case 'settings':     renderSettings(content);     break;
  }
}

function openSidebar(){ document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('open'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('open'); }

function lockApp(){
  SFX.lock();
  cryptoKey=null; currentUser=null; pinBuffer=''; isConfirming=false;
  sessionStorage.removeItem('wk_session_key');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('pinScreen').style.display='flex';
  updatePinDots(0);
  document.getElementById('pinError').textContent='';
  initPinScreen();
}

// ──────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function fmtIDR(n){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n); }
function fmtDate(iso){ return new Date(iso).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
function isToday(iso){ const d=new Date(iso),t=new Date(); return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear(); }
function totalBalance(){ return state.wallets.reduce((s,w)=>s+(w.balance||0),0); }
function walletById(id){ return state.wallets.find(w=>w.id===id); }

// ──────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────
function toast(msg,type='info',dur=3200){
  SFX.toast();
  const icons={success:'✅',error:'❌',info:'💡',warning:'⚠️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); el.addEventListener('animationend',()=>el.remove()); },dur);
}

// ──────────────────────────────────────────────
// MODAL — with keyboard shortcuts
// ──────────────────────────────────────────────
let modalKeyHandler=null;

function openModal(title,bodyHTML,onConfirm=null){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=bodyHTML;
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('modalClose').onclick=closeModal;
  document.getElementById('modalOverlay').onclick=e=>{ if(e.target===document.getElementById('modalOverlay')) closeModal(); };

  if(onConfirm){
    const footer=document.createElement('div');
    footer.className='modal-footer';
    // Hint: Enter=Simpan (only when Simpan focused), X=Batal
    footer.innerHTML=`
      <button class="btn btn-ghost" id="modalCancel" data-shortcut="X" title="Batal (tekan X)">Batal</button>
      <button class="btn btn-primary" id="modalConfirm" data-shortcut="Enter" title="Simpan (tekan Enter saat tombol ini fokus)"><span>Simpan</span><span class="btn-shine"></span></button>`;
    document.getElementById('modalBody').appendChild(footer);
    document.getElementById('modalCancel').onclick=closeModal;
    document.getElementById('modalConfirm').onclick=onConfirm;

    // Enter on Simpan button only when Simpan is focused
    document.getElementById('modalConfirm').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); onConfirm(); } });

    // X key closes modal (only when not typing in an input/textarea)
    if(modalKeyHandler) document.removeEventListener('keydown',modalKeyHandler);
    modalKeyHandler=e=>{
      const overlay=document.getElementById('modalOverlay');
      if(overlay.classList.contains('hidden')) return;
      const tag=document.activeElement?.tagName?.toLowerCase();
      const isTyping=tag==='input'||tag==='textarea'||tag==='select';
      if(!isTyping && e.key.toLowerCase()==='x'){ e.preventDefault(); closeModal(); }
    };
    document.addEventListener('keydown',modalKeyHandler);
  }
}

function closeModal(){
  SFX.click();
  document.getElementById('modalOverlay').classList.add('hidden');
  if(modalKeyHandler){ document.removeEventListener('keydown',modalKeyHandler); modalKeyHandler=null; }
}

function confirmDialog(msg,onYes){
  openModal('Konfirmasi',`<p style="color:var(--text2);margin-bottom:0">${msg}</p>`);
  const footer=document.createElement('div');
  footer.className='modal-footer';
  footer.innerHTML=`<button class="btn btn-ghost" id="modalCancel" data-shortcut="X" title="Batal (X)">Batal</button><button class="btn btn-danger" id="modalConfirm">Hapus</button>`;
  document.getElementById('modalBody').appendChild(footer);
  document.getElementById('modalCancel').onclick=closeModal;
  document.getElementById('modalConfirm').onclick=()=>{ closeModal(); onYes(); };

  if(modalKeyHandler) document.removeEventListener('keydown',modalKeyHandler);
  modalKeyHandler=e=>{
    const overlay=document.getElementById('modalOverlay');
    if(overlay.classList.contains('hidden')) return;
    const tag=document.activeElement?.tagName?.toLowerCase();
    if((tag!=='input'&&tag!=='textarea'&&tag!=='select') && e.key.toLowerCase()==='x'){ e.preventDefault(); closeModal(); }
  };
  document.addEventListener('keydown',modalKeyHandler);
}

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────
function renderDashboard(el){
  const txToday=state.transactions.filter(t=>isToday(t.date));
  const totalIn=state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalOut=state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const todayIn=txToday.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const todayOut=txToday.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  el.innerHTML=`
    <div class="page-header"><h1 class="page-title">Dashboard <span>◈</span></h1></div>
    <div class="stat-grid">
      <div class="stat-card gold" style="animation-delay:.00s"><div class="stat-label">Total Saldo</div><div class="stat-value gold">${fmtIDR(totalBalance())}</div><div class="stat-sub">${state.wallets.length} wallet aktif</div></div>
      <div class="stat-card green" style="animation-delay:.05s"><div class="stat-label">Total Pemasukan</div><div class="stat-value green">${fmtIDR(totalIn)}</div><div class="stat-sub">Semua waktu</div></div>
      <div class="stat-card red" style="animation-delay:.10s"><div class="stat-label">Total Pengeluaran</div><div class="stat-value red">${fmtIDR(totalOut)}</div><div class="stat-sub">Semua waktu</div></div>
      <div class="stat-card blue" style="animation-delay:.15s"><div class="stat-label">Transaksi Hari Ini</div><div class="stat-value">${txToday.length}</div><div class="stat-sub">+${fmtIDR(todayIn)} / -${fmtIDR(todayOut)}</div></div>
    </div>
    <div class="chart-grid">
      <div class="card"><div class="card-header"><span class="card-title">Arus Kas 7 Hari</span></div><div class="chart-wrap"><canvas id="chartBar"></canvas></div></div>
      <div class="card"><div class="card-header"><span class="card-title">Pengeluaran per Kategori</span></div><div class="chart-wrap"><canvas id="chartPie"></canvas></div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Transaksi Hari Ini</span><button class="btn btn-primary btn-sm" id="addTxBtn">+ Tambah</button></div>
      <div class="today-list" id="todayList">
        ${txToday.length===0?`<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada transaksi hari ini</div></div>`:txToday.slice().reverse().map(t=>txItemHTML(t)).join('')}
      </div>
    </div>`;
  document.getElementById('addTxBtn').addEventListener('click',showAddTransactionModal);
  el.querySelectorAll('.tx-edit').forEach(b=>b.addEventListener('click',()=>showEditTransactionModal(b.dataset.id)));
  el.querySelectorAll('.tx-del').forEach(b=>b.addEventListener('click',()=>deleteTransaction(b.dataset.id)));
  renderBarChart(); renderPieChart();
}

function renderBarChart(){
  const ctx=document.getElementById('chartBar'); if(!ctx)return;
  const days=[],inc=[],exp=[];
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toLocaleDateString('id-ID',{day:'numeric',month:'short'})); const dt=state.transactions.filter(t=>{const td=new Date(t.date);return td.getDate()===d.getDate()&&td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear();}); inc.push(dt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)); exp.push(dt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)); }
  charts.bar=new Chart(ctx,{type:'bar',data:{labels:days,datasets:[{label:'Pemasukan',data:inc,backgroundColor:'rgba(45,217,143,.6)',borderRadius:6,borderSkipped:false},{label:'Pengeluaran',data:exp,backgroundColor:'rgba(242,92,92,.6)',borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8b92a8',font:{family:'DM Sans',size:11},boxWidth:12}}},scales:{x:{ticks:{color:'#555e78',font:{family:'DM Sans',size:10}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#555e78',font:{family:'DM Sans',size:10},callback:v=>'Rp'+Intl.NumberFormat('id-ID',{notation:'compact'}).format(v)},grid:{color:'rgba(255,255,255,.04)'}}}}});
}

function renderPieChart(){
  const ctx=document.getElementById('chartPie'); if(!ctx)return;
  const expTx=state.transactions.filter(t=>t.type==='expense');
  if(!expTx.length){ ctx.parentElement.innerHTML='<div class="empty-state" style="padding:40px 0"><div class="empty-icon">🍩</div><div class="empty-text">Belum ada pengeluaran</div></div>'; return; }
  const map={};
  expTx.forEach(t=>{ map[t.category]=(map[t.category]||0)+t.amount; });
  charts.pie=new Chart(ctx,{type:'doughnut',data:{labels:Object.keys(map),datasets:[{data:Object.values(map),backgroundColor:COLORS.slice(0,Object.keys(map).length),borderWidth:0,hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'right',labels:{color:'#8b92a8',font:{family:'DM Sans',size:10},boxWidth:10,padding:8}}}}});
}

// ──────────────────────────────────────────────
// WALLETS
// ──────────────────────────────────────────────
function renderWallets(el){
  el.innerHTML=`<div class="page-header"><h1 class="page-title">Wallets <span>◎</span></h1></div><div class="wallet-grid" id="walletGrid">${state.wallets.map((w,i)=>walletCardHTML(w,i)).join('')}<div class="add-wallet-card" id="addWalletBtn"><div class="add-wallet-icon">＋</div><div class="add-wallet-text">Tambah Wallet</div></div></div>`;
  document.getElementById('addWalletBtn').addEventListener('click',showAddWalletModal);
  el.querySelectorAll('.wallet-edit').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); showEditWalletModal(b.dataset.id); }));
  el.querySelectorAll('.wallet-del').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); deleteWallet(b.dataset.id); }));
}

function walletCardHTML(w,i){
  const color=w.color||COLORS[i%COLORS.length];
  return `<div class="wallet-card" data-id="${w.id}" style="animation-delay:${i*.05}s"><div class="wallet-card-accent" style="background:${color};box-shadow:0 0 12px ${color}66"></div><div class="wallet-icon" style="background:${color}22">${w.icon||'💰'}</div><div class="wallet-name">${w.name}</div><div class="wallet-balance" style="color:${color}">${fmtIDR(w.balance||0)}</div><div class="wallet-meta"><span class="badge" style="background:${color}22;color:${color}">${w.type||'Wallet'}</span><div class="wallet-actions"><button class="btn btn-ghost btn-icon btn-sm wallet-edit" data-id="${w.id}">✏️</button><button class="btn btn-danger btn-icon btn-sm wallet-del" data-id="${w.id}">🗑️</button></div></div></div>`;
}

function showAddWalletModal(){
  openModal('Tambah Wallet',walletFormHTML(),async()=>{ const data=getWalletFormData(); if(!data)return; state.wallets.push({id:uid(),...data,balance:parseFloat(data.balance)||0,createdAt:new Date().toISOString()}); await saveData(); closeModal(); SFX.save(); toast('Wallet ditambahkan!','success'); navigateTo('wallets'); updateRecapBadge(); });
  bindWalletFormEvents();
}

function showEditWalletModal(id){
  const w=walletById(id); if(!w)return;
  openModal('Edit Wallet',walletFormHTML(w),async()=>{ const data=getWalletFormData(); if(!data)return; const ob=w.balance; Object.assign(w,data); w.balance=ob; await saveData(); closeModal(); SFX.save(); toast('Wallet diperbarui!','success'); navigateTo('wallets'); });
  bindWalletFormEvents(w);
}

function walletFormHTML(w={}){
  const sc=w.color||COLORS[0], se=w.icon||'💰';
  return `<div class="form-group"><label class="form-label">Nama Wallet</label><input class="form-input" id="wName" placeholder="BCA, Cash, Gopay..." value="${w.name||''}"/></div><div class="form-row"><div class="form-group"><label class="form-label">Tipe</label><select class="form-select" id="wType">${['Tabungan','Cash','Dompet Digital','Investasi','Lainnya'].map(t=>`<option value="${t}"${w.type===t?' selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Saldo Awal (Rp)</label><input class="form-input" id="wBalance" type="number" placeholder="0" value="${w.balance||0}"/></div></div><div class="form-group"><label class="form-label">Ikon</label><div class="emoji-options" id="emojiPicker">${EMOJI_LIST.map(e=>`<button type="button" class="emoji-opt${e===se?' selected':''}" data-emoji="${e}">${e}</button>`).join('')}</div><input type="hidden" id="wIcon" value="${se}"/></div><div class="form-group"><label class="form-label">Warna</label><div class="color-options" id="colorPicker">${COLORS.map(c=>`<div class="color-opt${c===sc?' selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div><input type="hidden" id="wColor" value="${sc}"/></div>`;
}

function bindWalletFormEvents(){
  document.querySelectorAll('.emoji-opt').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('.emoji-opt').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); document.getElementById('wIcon').value=b.dataset.emoji; SFX.click(); }));
  document.querySelectorAll('.color-opt').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('.color-opt').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); document.getElementById('wColor').value=b.dataset.color; SFX.click(); }));
}

function getWalletFormData(){ const name=document.getElementById('wName').value.trim(); if(!name){ toast('Nama wallet wajib','error'); return null; } return {name,type:document.getElementById('wType').value,balance:parseFloat(document.getElementById('wBalance').value)||0,icon:document.getElementById('wIcon').value,color:document.getElementById('wColor').value}; }

async function deleteWallet(id){ const w=walletById(id); confirmDialog(`Hapus wallet "<b>${w.name}</b>"? Transaksi wallet ini juga terhapus.`,async()=>{ state.wallets=state.wallets.filter(x=>x.id!==id); state.transactions=state.transactions.filter(t=>t.walletId!==id); await saveData(); SFX.del(); toast('Wallet dihapus','info'); navigateTo('wallets'); }); }

// ──────────────────────────────────────────────
// TRANSACTIONS
// ──────────────────────────────────────────────
function renderTransactions(el){
  el.innerHTML=`<div class="page-header"><h1 class="page-title">Transaksi <span>⟳</span></h1><button class="btn btn-primary" id="addTxBtnPage">+ Tambah</button></div><div class="tx-filters"><input class="form-input" id="txSearch" placeholder="🔍 Cari..." value="${txFilters.search}" style="max-width:180px"/><select class="form-select" id="filterWallet" style="max-width:160px"><option value="">Semua Wallet</option>${state.wallets.map(w=>`<option value="${w.id}"${txFilters.wallet===w.id?' selected':''}>${w.icon} ${w.name}</option>`).join('')}</select><select class="form-select" id="filterType" style="max-width:140px"><option value="">Semua Tipe</option><option value="income"${txFilters.type==='income'?' selected':''}>Pemasukan</option><option value="expense"${txFilters.type==='expense'?' selected':''}>Pengeluaran</option></select><select class="form-select" id="filterCat" style="max-width:150px"><option value="">Semua Kategori</option>${CATEGORIES.map(c=>`<option value="${c}"${txFilters.category===c?' selected':''}>${c}</option>`).join('')}</select><input class="form-input" type="date" id="filterFrom" value="${txFilters.dateFrom}" style="max-width:150px"/><input class="form-input" type="date" id="filterTo" value="${txFilters.dateTo}" style="max-width:150px"/><button class="btn btn-ghost btn-sm" id="clearFilters">Reset</button></div><div class="tx-list" id="txList"></div>`;
  document.getElementById('addTxBtnPage').addEventListener('click',showAddTransactionModal);
  document.getElementById('filterWallet').addEventListener('change',e=>{ txFilters.wallet=e.target.value; renderTxList(); });
  document.getElementById('filterType').addEventListener('change',e=>{ txFilters.type=e.target.value; renderTxList(); });
  document.getElementById('filterCat').addEventListener('change',e=>{ txFilters.category=e.target.value; renderTxList(); });
  document.getElementById('filterFrom').addEventListener('change',e=>{ txFilters.dateFrom=e.target.value; renderTxList(); });
  document.getElementById('filterTo').addEventListener('change',e=>{ txFilters.dateTo=e.target.value; renderTxList(); });
  document.getElementById('txSearch').addEventListener('input',e=>{ txFilters.search=e.target.value; renderTxList(); });
  document.getElementById('clearFilters').addEventListener('click',()=>{ txFilters={wallet:'',type:'',category:'',dateFrom:'',dateTo:'',search:''}; navigateTo('transactions'); });
  renderTxList();
}

function getFilteredTx(){ return state.transactions.filter(t=>{ if(txFilters.wallet&&t.walletId!==txFilters.wallet)return false; if(txFilters.type&&t.type!==txFilters.type)return false; if(txFilters.category&&t.category!==txFilters.category)return false; if(txFilters.dateFrom&&t.date<txFilters.dateFrom)return false; if(txFilters.dateTo&&t.date>txFilters.dateTo+'T23:59:59')return false; if(txFilters.search){ const q=txFilters.search.toLowerCase(); if(!t.note.toLowerCase().includes(q)&&!t.category.toLowerCase().includes(q))return false; } return true; }).sort((a,b)=>new Date(b.date)-new Date(a.date)); }

function renderTxList(){ const list=document.getElementById('txList'); if(!list)return; const filtered=getFilteredTx(); if(!filtered.length){ list.innerHTML='<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Tidak ada transaksi</div></div>'; return; } list.innerHTML=filtered.map(t=>txItemHTML(t)).join(''); list.querySelectorAll('.tx-edit').forEach(b=>b.addEventListener('click',()=>showEditTransactionModal(b.dataset.id))); list.querySelectorAll('.tx-del').forEach(b=>b.addEventListener('click',()=>deleteTransaction(b.dataset.id))); }

function txItemHTML(t){ const w=walletById(t.walletId); return `<div class="tx-item"><div class="tx-icon ${t.type}">${t.type==='income'?'↑':'↓'}</div><div class="tx-info"><div class="tx-name">${t.note||t.category}</div><div class="tx-meta">${t.category} · ${w?w.icon+' '+w.name:'?'} · ${fmtDate(t.date)}</div></div><div class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}${fmtIDR(t.amount)}</div><div class="tx-actions"><button class="btn btn-ghost btn-icon btn-sm tx-edit" data-id="${t.id}">✏️</button><button class="btn btn-danger btn-icon btn-sm tx-del" data-id="${t.id}">🗑️</button></div></div>`; }

function showAddTransactionModal(){ if(!state.wallets.length){ toast('Buat wallet dulu!','warning'); navigateTo('wallets'); return; } openModal('Tambah Transaksi',txFormHTML(),async()=>{ const data=getTxFormData(); if(!data)return; const tx={id:uid(),...data,date:new Date().toISOString(),createdAt:new Date().toISOString()}; state.transactions.push(tx); const w=walletById(data.walletId); if(w)w.balance=(w.balance||0)+(data.type==='income'?data.amount:-data.amount); await saveData(); closeModal(); SFX.save(); toast(`${data.type==='income'?'Pemasukan':'Pengeluaran'} dicatat!`,'success'); navigateTo(currentPage); updateRecapBadge(); }); bindTxFormEvents(); }

function showEditTransactionModal(id){ const t=state.transactions.find(tx=>tx.id===id); if(!t)return; openModal('Edit Transaksi',txFormHTML(t),async()=>{ const data=getTxFormData(); if(!data)return; const ow=walletById(t.walletId); if(ow)ow.balance+=(t.type==='income'?-t.amount:t.amount); Object.assign(t,data); const nw=walletById(data.walletId); if(nw)nw.balance+=(data.type==='income'?data.amount:-data.amount); await saveData(); closeModal(); SFX.save(); toast('Transaksi diperbarui!','success'); navigateTo(currentPage); }); bindTxFormEvents(t); }

function txFormHTML(t={}){ const isIncome=t.type==='income'; return `<div class="type-toggle"><button type="button" class="type-btn${!t.type||!isIncome?' active expense':''}" id="typeExpense">− Pengeluaran</button><button type="button" class="type-btn${!t.type||isIncome?' active income':''}" id="typeIncome">+ Pemasukan</button></div><input type="hidden" id="txType" value="${t.type||'income'}"/><div class="form-group"><label class="form-label">Wallet</label><select class="form-select" id="txWallet">${state.wallets.map(w=>`<option value="${w.id}"${t.walletId===w.id?' selected':''}>${w.icon} ${w.name} (${fmtIDR(w.balance||0)})</option>`).join('')}</select></div><div class="form-row"><div class="form-group"><label class="form-label">Jumlah (Rp)</label><input class="form-input" id="txAmount" type="number" placeholder="0" value="${t.amount||''}" min="1"/></div><div class="form-group"><label class="form-label">Kategori</label><select class="form-select" id="txCategory">${CATEGORIES.map(c=>`<option value="${c}"${t.category===c?' selected':''}>${c}</option>`).join('')}</select></div></div><div class="form-group"><label class="form-label">Catatan</label><input class="form-input" id="txNote" placeholder="Opsional..." value="${t.note||''}"/></div>`; }

function bindTxFormEvents(t={}){ const setType=type=>{ document.getElementById('txType').value=type; document.getElementById('typeIncome').className='type-btn'+(type==='income'?' active income':''); document.getElementById('typeExpense').className='type-btn'+(type==='expense'?' active expense':''); }; document.getElementById('typeIncome').addEventListener('click',()=>{ SFX.click(); setType('income'); }); document.getElementById('typeExpense').addEventListener('click',()=>{ SFX.click(); setType('expense'); }); setType(t.type||'income'); }

function getTxFormData(){ const amount=parseFloat(document.getElementById('txAmount').value); if(!amount||amount<=0){ toast('Jumlah harus > 0','error'); return null; } const walletId=document.getElementById('txWallet').value; if(!walletId){ toast('Pilih wallet','error'); return null; } return {type:document.getElementById('txType').value,walletId,amount,category:document.getElementById('txCategory').value,note:document.getElementById('txNote').value.trim()}; }

async function deleteTransaction(id){ const t=state.transactions.find(tx=>tx.id===id); if(!t)return; confirmDialog(`Hapus "${t.note||t.category}" (${fmtIDR(t.amount)})?`,async()=>{ const w=walletById(t.walletId); if(w)w.balance+=(t.type==='income'?-t.amount:t.amount); state.transactions=state.transactions.filter(tx=>tx.id!==id); await saveData(); SFX.del(); toast('Transaksi dihapus','info'); navigateTo(currentPage); updateRecapBadge(); }); }

// ──────────────────────────────────────────────
// GOALS
// ──────────────────────────────────────────────
function renderGoals(el){
  const goal=state.goals[0]||null, total=totalBalance();
  el.innerHTML=`<div class="page-header"><h1 class="page-title">Target <span>◉</span></h1><button class="btn btn-primary" id="addGoalBtn">${goal?'Edit Target':'+ Set Target'}</button></div>${goal?goalCardHTML(goal,total):'<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-text">Belum ada target. Yuk set!</div></div>'}<div style="height:20px"></div><div class="card"><div class="card-header"><span class="card-title">Ringkasan Wallet</span></div>${!state.wallets.length?'<div class="empty-state" style="padding:20px 0"><div class="empty-text">Belum ada wallet</div></div>':state.wallets.map(w=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:10px"><span>${w.icon}</span><span style="font-size:.9rem">${w.name}</span></div><span style="font-family:'Syne',sans-serif;font-weight:700;color:var(--gold)">${fmtIDR(w.balance||0)}</span></div>`).join('')}<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 0"><span style="font-size:.85rem;color:var(--text2);font-weight:600">Total</span><span style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:var(--gold)">${fmtIDR(total)}</span></div></div>`;
  document.getElementById('addGoalBtn').addEventListener('click',()=>showGoalModal(goal));
  el.querySelectorAll('.goal-edit').forEach(b=>b.addEventListener('click',()=>showGoalModal(state.goals[0])));
  el.querySelectorAll('.goal-del').forEach(b=>b.addEventListener('click',deleteGoal));
}

function goalCardHTML(goal,total){ const pct=Math.min(100,goal.target>0?Math.round(total/goal.target*100):0), done=total>=goal.target; return `<div class="goal-card"><div class="goal-header"><div><div class="goal-name">${goal.name}</div><div class="goal-amounts">${fmtIDR(total)} dari ${fmtIDR(goal.target)}</div></div><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm goal-edit">✏️</button><button class="btn btn-danger btn-sm goal-del">🗑️</button></div></div><div class="goal-bar-wrap"><div class="goal-bar" style="width:${pct}%"></div></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span class="goal-pct">${pct}% tercapai</span>${done?'<span class="badge badge-green">🎉 Tercapai!</span>':`<span style="font-size:.78rem;color:var(--text3)">Kurang ${fmtIDR(goal.target-total)}</span>`}</div>${goal.note?`<div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:8px;font-size:.82rem;color:var(--text3)">${goal.note}</div>`:''}</div>`; }

function showGoalModal(ex=null){ openModal(ex?'Edit Target':'Set Target',`<div class="form-group"><label class="form-label">Nama Target</label><input class="form-input" id="gName" placeholder="Dana Darurat, Liburan..." value="${ex?.name||''}"/></div><div class="form-group"><label class="form-label">Target (Rp)</label><input class="form-input" id="gTarget" type="number" placeholder="0" value="${ex?.target||''}"/></div><div class="form-group"><label class="form-label">Catatan</label><textarea class="form-textarea" id="gNote">${ex?.note||''}</textarea></div>`,async()=>{ const name=document.getElementById('gName').value.trim(), target=parseFloat(document.getElementById('gTarget').value); if(!name){ toast('Nama target wajib','error'); return; } if(!target||target<=0){ toast('Target harus > 0','error'); return; } state.goals=[{id:ex?.id||uid(),name,target,note:document.getElementById('gNote').value.trim(),createdAt:ex?.createdAt||new Date().toISOString()}]; await saveData(); closeModal(); SFX.save(); toast('Target disimpan!','success'); navigateTo('goals'); }); }
async function deleteGoal(){ confirmDialog('Hapus target tabungan ini?',async()=>{ state.goals=[]; await saveData(); SFX.del(); toast('Target dihapus','info'); navigateTo('goals'); }); }

// ──────────────────────────────────────────────
// SHORTCUTS PAGE
// ──────────────────────────────────────────────
function renderShortcuts(el){
  const groups=[
    { title:'⌨ PIN Screen', items:[
      { keys:['0-9'], title:'Masukkan angka PIN', desc:'Ketik angka 0–9 langsung dari keyboard. Tidak perlu klik tombol manual.' },
      { keys:['Backspace'], title:'Hapus digit terakhir', desc:'Menghapus digit PIN terakhir yang sudah diketik.' },
      { keys:['Enter'], title:'Submit (otomatis)', desc:'PIN di-submit otomatis setelah 6 digit terisi. Enter tidak perlu ditekan.' },
      { keys:['Selain 0-9'], title:'Non-angka diblokir', desc:'Menekan tombol selain angka atau Backspace akan memunculkan flash error singkat tanpa mengubah PIN yang sudah diisi.' },
    ]},
    { title:'📋 Modal / Dialog', items:[
      { keys:['X'], title:'Tutup / Batal', desc:'Menutup modal atau membatalkan aksi. Shortcut X hanya aktif ketika tidak sedang mengetik di input atau textarea.' },
      { keys:['Enter'], title:'Konfirmasi / Simpan', desc:'Trigger tombol Simpan HANYA ketika tombol Simpan sedang dalam fokus (Tab ke tombol dulu). Ini mencegah konflik dengan form input.' },
      { keys:['Tab'], title:'Pindah fokus', desc:'Navigasi antar elemen form di dalam modal menggunakan Tab standar browser.' },
      { keys:['Esc'], title:'Belum di-assign', desc:'Escape saat ini tidak menutup modal untuk mencegah kehilangan data yang sedang diisi.' },
    ]},
    { title:'🧭 Navigasi App', items:[
      { keys:['Klik nav'], title:'Pindah halaman', desc:'Klik item di sidebar untuk berpindah antar halaman Dashboard, Wallets, Transaksi, Target, Export, Changelog, Shortcuts, Settings.' },
      { keys:['Klik ✦ Recap'], title:'Buka WalletKu Recap', desc:'Membuka halaman recap.html di tab yang sama. Membutuhkan minimal 30 transaksi.' },
    ]},
    { title:'📸 Export', items:[
      { keys:['Klik 1440p'], title:'Export snapshot 1440p', desc:'Mengambil screenshot area export dan mengunduhnya langsung sebagai PNG 1440p.' },
      { keys:['Klik 4K'], title:'Export snapshot 4K', desc:'Sama seperti 1440p tapi dengan delay 10 detik agar rendering selesai sempurna sebelum di-capture.' },
    ]},
    { title:'🔒 Keamanan', items:[
      { keys:['Klik 🔒'], title:'Kunci App', desc:'Mengunci app dan kembali ke layar PIN. Data tetap aman, session di-clear.' },
    ]},
    { title:'✦ WalletKu Recap', items:[
      { keys:['→ / Klik slide'], title:'Slide selanjutnya (bawaan)', desc:'Slide di recap maju otomatis setiap ~7 detik.' },
      { keys:['Skip →'], title:'Skip recap', desc:'Lewati slide-slide saat ini dan langsung ke halaman Summary.' },
      { keys:['🔊 / 🔇'], title:'Mute / Unmute suara', desc:'Toggle suara ambient di dalam recap.' },
    ]},
  ];

  el.innerHTML=`<div class="page-header"><h1 class="page-title">Shortcuts <span>⌨</span></h1></div><div class="shortcuts-grid">${
    groups.map((g,gi)=>`
      <div class="shortcut-group" style="animation-delay:${gi*.06}s">
        <div class="shortcut-group-title">${g.title}</div>
        <div class="shortcut-list">
          ${g.items.map(item=>`
            <div class="shortcut-item">
              <div class="shortcut-info">
                <div class="shortcut-title">${item.title}</div>
                <div class="shortcut-desc">${item.desc}</div>
              </div>
              <div class="shortcut-keys">
                ${item.keys.map(k=>`<span class="key-badge">${k}</span>`).join('<span class="key-sep">+</span>')}
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('')
  }</div>`;
}

// ──────────────────────────────────────────────
// CHANGELOG
// ──────────────────────────────────────────────
async function renderChangelog(el){
  el.innerHTML=`<div class="page-header"><h1 class="page-title">Changelog <span>📋</span></h1></div><div id="changelogContent"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">Memuat...</div></div></div>`;
  try{
    const res=await fetch('changelogs.md'); if(!res.ok) throw new Error();
    renderChangelogCards(await res.text(),document.getElementById('changelogContent'));
  }catch(e){ document.getElementById('changelogContent').innerHTML='<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">changelogs.md tidak ditemukan.</div></div>'; }
}

function renderChangelogCards(md,container){
  const blocks=md.split(/^## /m).filter(b=>b.trim());
  if(!blocks.length){ container.innerHTML='<div class="empty-state"><div class="empty-text">Changelog kosong.</div></div>'; return; }
  const html=blocks.map((block,idx)=>{ const lines=block.split('\n'), header=lines[0].trim(), rest=lines.slice(1).join('\n'), parts=header.split(/[—–-]+/).map(s=>s.trim()), version=parts[0], date=parts[1]||''; const sections=rest.split(/^### /m).filter(s=>s.trim()); const sectHTML=sections.map(sec=>{ const sl=sec.split('\n'), title=sl[0].trim(), items=sl.slice(1).filter(l=>l.trim().startsWith('-')).map(l=>`<div class="changelog-item">${l.replace(/^[-*]\s*/,'').trim()}</div>`).join(''); return items?`<div class="changelog-section"><div class="changelog-section-title">${title}</div><div class="changelog-items">${items}</div></div>`:''}).join(''); return `<div class="changelog-card" style="animation-delay:${idx*.07}s"><div class="changelog-version">${version}</div>${date?`<div class="changelog-date">📅 ${date}</div>`:''} ${sectHTML||`<div class="changelog-items">${rest.split('\n').filter(l=>l.trim().startsWith('-')).map(l=>`<div class="changelog-item">${l.replace(/^[-*]\s*/,'').trim()}</div>`).join('')}</div>`}</div>`; }).join('');
  container.innerHTML=`<div class="changelog-grid">${html}</div>`;
}

// ──────────────────────────────────────────────
// SETTINGS
// ──────────────────────────────────────────────
function renderSettings(el){
  el.innerHTML=`<div class="page-header"><h1 class="page-title">Settings <span>⚙</span></h1></div><div class="settings-grid">
    <div class="settings-card"><div class="settings-card-title">👤 Akun</div><div class="form-group"><label class="form-label">Username</label><input class="form-input" id="newUsername" value="${currentUser||''}" placeholder="Username baru..."/></div><button class="btn btn-primary" id="saveUsername"><span>Simpan Username</span><span class="btn-shine"></span></button></div>
    <div class="settings-card"><div class="settings-card-title">🔐 Ubah PIN</div><p style="font-size:.85rem;color:var(--text3);margin-bottom:16px">PIN baru akan re-enkripsi data. Data lama tetap aman.</p><div class="form-group"><label class="form-label">PIN Saat Ini</label><input class="form-input" id="oldPin" type="password" placeholder="6 digit..." maxlength="6"/></div><div class="form-row"><div class="form-group"><label class="form-label">PIN Baru</label><input class="form-input" id="newPin" type="password" placeholder="6 digit..." maxlength="6"/></div><div class="form-group"><label class="form-label">Konfirmasi PIN Baru</label><input class="form-input" id="confirmPin" type="password" placeholder="6 digit..." maxlength="6"/></div></div><button class="btn btn-primary" id="savePin"><span>Ganti PIN</span><span class="btn-shine"></span></button></div>
    <div class="settings-card"><div class="settings-card-title">💾 Backup Data</div><p style="font-size:.85rem;color:var(--text3);margin-bottom:16px">Export semua data sebagai JSON. Untuk restore butuh PIN yang sama.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost" id="exportBackup"><span>⬇ Export Backup</span><span class="btn-shine"></span></button><label class="btn btn-ghost" style="cursor:pointer"><span>⬆ Import Backup</span><input type="file" id="importFile" accept=".json" style="display:none"/></label></div><div id="importMsg" style="margin-top:10px;font-size:.82rem;color:var(--text3)"></div></div>
    <div class="settings-card"><div class="settings-card-title">⚠️ Danger Zone</div><p style="font-size:.85rem;color:var(--text3);margin-bottom:16px">Hapus semua data. PIN & username tetap.</p><button class="btn btn-danger" id="clearDataBtn">🗑 Hapus Semua Data</button></div>
  </div>`;
  document.getElementById('saveUsername').addEventListener('click',async()=>{ const val=document.getElementById('newUsername').value.trim(); if(!val||val.length<3){ toast('Min 3 karakter','error'); return; } if(!/^[a-zA-Z0-9_]+$/.test(val)){ toast('Hanya huruf, angka, underscore','error'); return; } localStorage.setItem(LS_USER,val); currentUser=val; document.getElementById('userName').textContent=val; document.getElementById('userAvatar').textContent=val[0].toUpperCase(); document.getElementById('topbarGreeting').textContent=greeting()+', '+val+'!'; SFX.save(); toast('Username diperbarui!','success'); });
  document.getElementById('savePin').addEventListener('click',async()=>{ const op=document.getElementById('oldPin').value, np=document.getElementById('newPin').value, cp=document.getElementById('confirmPin').value; if(op.length!==6||np.length!==6){ toast('PIN harus 6 digit','error'); return; } if(np!==cp){ toast('Konfirmasi tidak cocok','error'); return; } try{ const sb=b64ToBuf(localStorage.getItem(LS_SALT)), ok=await deriveKey(op,sb), pl=await decrypt(ok,localStorage.getItem(LS_VERIFY)); if(pl!==VERIFY_PLAIN)throw new Error(); const ns=crypto.getRandomValues(new Uint8Array(32)); localStorage.setItem(LS_SALT,bufToB64(ns)); const nk=await deriveKey(np,ns); localStorage.setItem(LS_VERIFY,await encrypt(nk,VERIFY_PLAIN)); cryptoKey=nk; setCachedPin(np); await saveData(); SFX.save(); toast('PIN berhasil diubah!','success'); ['oldPin','newPin','confirmPin'].forEach(id=>document.getElementById(id).value=''); }catch(e){ SFX.loginFail(); toast('PIN lama salah','error'); } });
  document.getElementById('exportBackup').addEventListener('click',()=>{ const raw=localStorage.getItem(LS_DATA); if(!raw){ toast('Tidak ada data','warning'); return; } const blob=new Blob([JSON.stringify({wk_backup:true,data:raw,exported:new Date().toISOString()})],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`WalletKu_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); SFX.export_(); toast('Backup di-export!','success'); });
  document.getElementById('importFile').addEventListener('change',async e=>{ const file=e.target.files[0]; if(!file)return; const msg=document.getElementById('importMsg'); try{ const obj=JSON.parse(await file.text()); if(!obj.wk_backup||!obj.data)throw new Error('Format tidak valid'); const json=await decrypt(cryptoKey,obj.data); state=JSON.parse(json); await saveData(); SFX.save(); toast('Backup di-import!','success'); msg.textContent='✅ Import berhasil '+new Date().toLocaleTimeString('id-ID'); navigateTo('dashboard'); }catch(err){ SFX.loginFail(); toast('Import gagal — PIN harus sama','error'); msg.textContent='❌ '+err.message; } e.target.value=''; });
  document.getElementById('clearDataBtn').addEventListener('click',()=>{ confirmDialog('Hapus SEMUA wallet, transaksi, target?',async()=>{ state={wallets:[],transactions:[],goals:[],settings:{currency:'IDR',createdAt:state.settings?.createdAt}}; await saveData(); SFX.del(); toast('Semua data dihapus','info'); navigateTo('dashboard'); updateRecapBadge(); }); });
}

// ──────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────
function renderExport(el){
  const now=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const totalIn=state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalOut=state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  el.innerHTML=`<div class="page-header"><h1 class="page-title">Export <span>↗</span></h1></div><div class="export-preview"><div class="section-header" style="margin-bottom:16px"><span class="section-title">Preview</span></div><div class="export-capture" id="exportCapture"><div class="export-header"><div class="export-logo">◈ WalletKu</div><div class="export-date">${now}</div></div><div class="export-total"><div class="export-total-label">Total Saldo Semua Wallet</div><div class="export-total-val">${fmtIDR(totalBalance())}</div></div><div class="export-wallets">${!state.wallets.length?'<div style="color:var(--text3);font-size:.85rem;text-align:center;padding:20px">Belum ada wallet</div>':state.wallets.map(w=>`<div class="export-wallet"><div class="export-wallet-name">${w.icon} ${w.name}</div><div class="export-wallet-bal" style="color:${w.color||'var(--gold)'}">${fmtIDR(w.balance||0)}</div></div>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px"><div style="background:var(--green-dim);border-radius:10px;padding:14px;border:1px solid rgba(45,217,143,.15)"><div style="font-size:.72rem;color:var(--green);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Total Pemasukan</div><div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--green)">${fmtIDR(totalIn)}</div></div><div style="background:var(--red-dim);border-radius:10px;padding:14px;border:1px solid rgba(242,92,92,.15)"><div style="font-size:.72rem;color:var(--red);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Total Pengeluaran</div><div style="font-family:'Syne',sans-serif;font-weight:700;color:var(--red)">${fmtIDR(totalOut)}</div></div></div><div style="text-align:center;margin-top:20px;font-size:.7rem;color:var(--text3)">Data privat · WalletKu v2.2 · ${new Date().toLocaleDateString('id-ID')}</div></div></div><div class="export-btns"><button class="btn btn-primary" id="export1440"><span>📸 Export 1440p</span><span class="btn-shine"></span></button><button class="btn btn-ghost" id="export4k"><span>🖼️ Export 4K</span><span style="color:var(--text3);font-size:.75rem">(delay 10 detik)</span><span class="btn-shine"></span></button><div class="export-countdown" id="exportCountdown"></div></div>`;
  document.getElementById('export1440').addEventListener('click',()=>exportImage(1440,false));
  document.getElementById('export4k').addEventListener('click',()=>exportImage(4096,true));
}

async function exportImage(tw,is4k){
  const b1=document.getElementById('export1440'), b4=document.getElementById('export4k'), cd=document.getElementById('exportCountdown'), cap=document.getElementById('exportCapture'); if(!cap)return;
  if(is4k){ b4.disabled=true; b1.disabled=true; let s=10; cd.innerHTML=`⏳ Rendering 4K... <b>${s}s</b>`; const t=setInterval(()=>{ s--; cd.innerHTML=s>0?`⏳ Rendering 4K... <b>${s}s</b>`:'✅ Siap!'; if(s<=0)clearInterval(t); },1000); await new Promise(r=>setTimeout(r,10000)); }
  try{ const scale=tw/cap.offsetWidth, canvas=await html2canvas(cap,{scale,useCORS:true,backgroundColor:'#080c14',logging:false}), a=document.createElement('a'); a.download=`WalletKu_${is4k?'4K':'1440p'}_${new Date().toISOString().slice(0,10)}.png`; a.href=canvas.toDataURL('image/png',1.0); a.click(); SFX.export_(); toast(`Export ${is4k?'4K':'1440p'} berhasil!`,'success'); }catch(e){ toast('Export gagal','error'); }
  finally{ if(b1)b1.disabled=false; if(b4)b4.disabled=false; if(cd)cd.innerHTML=''; }
}

// ──────────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  initParticles();
  initCardTilt();
  initPinScreen();
});
