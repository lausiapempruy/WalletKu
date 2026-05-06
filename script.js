// ============ DATA & STORAGE ============
let wallets = [];
let transactions = [];

const STORAGE_WALLETS = 'walletku_wallets';
const STORAGE_TRANSACTIONS = 'walletku_transactions';

function loadData() {
    const savedWallets = localStorage.getItem(STORAGE_WALLETS);
    if (savedWallets) {
        wallets = JSON.parse(savedWallets);
    } else {
        wallets = [];
    }

    const savedTransactions = localStorage.getItem(STORAGE_TRANSACTIONS);
    if (savedTransactions) {
        transactions = JSON.parse(savedTransactions);
    } else {
        transactions = [];
    }
    
    console.log('data loaded - wallets:', wallets.length, 'transactions:', transactions.length);
}

function saveWallets() {
    localStorage.setItem(STORAGE_WALLETS, JSON.stringify(wallets));
}

function saveTransactions() {
    localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(transactions));
}

function formatRupiah(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

function updateAllSaldoDisplay() {
    const total = wallets.reduce((sum, w) => sum + w.balance, 0);
    const totalEl = document.getElementById('totalSaldoDashboard');
    const sidebarEl = document.getElementById('totalSaldoSidebar');
    if (totalEl) totalEl.innerHTML = formatRupiah(total);
    if (sidebarEl) sidebarEl.innerHTML = formatRupiah(total);
    
    renderWalletsGrid();
    renderWalletsManager();
    renderHistory();
    renderTodayShopping();
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function renderTodayShopping() {
    const today = getTodayDate();
    const todayTransactions = transactions.filter(t => t.date === today && t.type === 'expense');
    
    const container = document.getElementById('todayShoppingList');
    if (!container) return;
    
    if (todayTransactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>belum ada catatan belanja hari ini</p></div>';
        return;
    }
    
    let html = '';
    todayTransactions.forEach(t => {
        let itemName = '';
        if (t.purpose === 'jajan') itemName = '🍔 Jajan / Beli Sesuatu';
        else if (t.purpose === 'bayar hutang') itemName = '💸 Bayar Hutang';
        else if (t.purpose === 'ditabung lagi') itemName = '💰 Ditabung Lagi';
        else itemName = `📦 ${t.purpose}`;
        
        html += `
            <div class="shopping-item">
                <strong>${itemName}</strong>: ${formatRupiah(t.amount)}<br>
                <small>dari ${t.walletName} | ${t.note || 'tanpa catatan'}</small>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderWalletsGrid() {
    const grid = document.getElementById('walletsGrid');
    if (!grid) return;
    
    if (wallets.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-plus-circle"></i><p>belum ada tabungan, buat dulu di menu Atur Tabungan</p></div>';
        return;
    }
    
    grid.innerHTML = '';
    wallets.forEach(wallet => {
        const card = document.createElement('div');
        card.className = 'wallet-card';
        card.innerHTML = `
            <div class="wallet-name">
                <i class="fas fa-credit-card"></i> ${wallet.name}
            </div>
            <div class="wallet-balance">${formatRupiah(wallet.balance)}</div>
        `;
        grid.appendChild(card);
    });
}

function renderWalletsManager() {
    const manager = document.getElementById('walletsManager');
    if (!manager) return;
    
    if (wallets.length === 0) {
        manager.innerHTML = '<div class="empty-state"><i class="fas fa-plus-circle"></i><p>klik tombol tambah di atas untuk buat tabungan pertama lo</p></div>';
        return;
    }
    
    manager.innerHTML = '';
    wallets.forEach(wallet => {
        const div = document.createElement('div');
        div.className = 'wallet-manager-item';
        div.innerHTML = `
            <div>
                <strong><i class="fas fa-wallet" style="color:#fbbf24; margin-right:8px"></i> ${wallet.name}</strong><br>
                <small style="color:#fbbf24">${formatRupiah(wallet.balance)}</small>
            </div>
            <div>
                <button class="btn-icon edit-wallet" data-id="${wallet.id}"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-icon delete-wallet" data-id="${wallet.id}" ${wallets.length === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed"' : ''}><i class="fas fa-trash"></i> Hapus</button>
            </div>
        `;
        manager.appendChild(div);
    });
    
    document.querySelectorAll('.edit-wallet').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const wallet = wallets.find(w => w.id === id);
            if (!wallet) return;
            const newName = prompt('Edit nama tabungan:', wallet.name);
            if (newName && newName.trim()) {
                wallet.name = newName.trim();
                saveWallets();
                updateAllSaldoDisplay();
                loadWalletSelects();
            }
        });
    });
    
    document.querySelectorAll('.delete-wallet').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (wallets.length === 1) {
                alert('minimal harus ada 1 tabungan, bang aji');
                return;
            }
            const walletName = wallets.find(w => w.id === id)?.name;
            if (confirm(`hapus tabungan "${walletName}"? data transaksinya tetep ada tapi ga nyambung`)) {
                wallets = wallets.filter(w => w.id !== id);
                saveWallets();
                updateAllSaldoDisplay();
                loadWalletSelects();
            }
        });
    });
}

function renderHistory() {
    const filterWalletId = document.getElementById('filterWallet')?.value || 'all';
    const historyContainer = document.getElementById('historyList');
    if (!historyContainer) return;
    
    let filtered = [...transactions];
    if (filterWalletId !== 'all') {
        filtered = filtered.filter(t => t.walletId === filterWalletId);
    }
    
    filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (filtered.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>belum ada laporan nambah/kurang, bang aji</p></div>';
        return;
    }
    
    historyContainer.innerHTML = '';
    filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = `history-item ${t.type === 'income' ? 'history-income' : 'history-expense'}`;
        const typeIcon = t.type === 'income' ? '➕' : '➖';
        const typeText = t.type === 'income' ? 'Nambah Uang' : 'Kurang Uang';
        
        let detailText = '';
        if (t.type === 'income') {
            detailText = `sumber: ${t.source || 'uang jajan'}`;
        } else {
            detailText = `buat: ${t.purpose || 'jajan'}`;
        }
        
        item.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                <strong>${typeIcon} ${typeText}</strong>
                <small style="color:#94a3b8">${new Date(t.timestamp).toLocaleString('id-ID')}</small>
            </div>
            <div style="margin-bottom:6px">${formatRupiah(t.amount)} dari <strong style="color:#fbbf24">${t.walletName}</strong></div>
            <div><small style="color:#94a3b8">${detailText}</small></div>
            <div><small style="color:#64748b">📝 ${t.note || 'tanpa keterangan'}</small></div>
        `;
        historyContainer.appendChild(item);
    });
}

function loadWalletSelects() {
    const selectTrans = document.getElementById('transWalletSelect');
    const selectFilter = document.getElementById('filterWallet');
    
    if (selectTrans) {
        if (wallets.length === 0) {
            selectTrans.innerHTML = '<option value="">-- belum ada tabungan, buat dulu di menu Atur Tabungan --</option>';
        } else {
            selectTrans.innerHTML = '<option value="">-- pilih tabungan --</option>' + 
                wallets.map(w => `<option value="${w.id}">${w.name} (${formatRupiah(w.balance)})</option>`).join('');
        }
    }
    
    if (selectFilter) {
        if (wallets.length === 0) {
            selectFilter.innerHTML = '<option value="all">Semua Tabungan</option>';
        } else {
            selectFilter.innerHTML = '<option value="all">📊 Semua Tabungan</option>' +
                wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        }
    }
}

function addTransaction(walletId, type, amount, sourceOrPurpose, note) {
    console.log('addTransaction called:', {walletId, type, amount, sourceOrPurpose, note});
    
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) {
        alert('tabungan ga ketemu, bang');
        return false;
    }
    
    if (type === 'expense' && wallet.balance < amount) {
        alert(`saldo ${wallet.name} ga cukup! sisa: ${formatRupiah(wallet.balance)}`);
        return false;
    }
    
    // update saldo wallet
    if (type === 'income') {
        wallet.balance += amount;
    } else {
        wallet.balance -= amount;
    }
    
    // buat transaksi baru
    const transaction = {
        id: Date.now() + Math.random(),
        walletId: walletId,
        walletName: wallet.name,
        type: type,
        amount: amount,
        date: getTodayDate(),
        timestamp: new Date().toISOString(),
        note: note || '',
    };
    
    if (type === 'income') {
        transaction.source = sourceOrPurpose;
    } else {
        transaction.purpose = sourceOrPurpose;
    }
    
    transactions.push(transaction);
    
    // save ke localStorage
    saveWallets();
    saveTransactions();
    
    console.log('transaction saved, total transactions:', transactions.length);
    console.log('wallet new balance:', wallet.name, wallet.balance);
    
    // update semua tampilan
    updateAllSaldoDisplay();
    loadWalletSelects();
    
    return true;
}

async function exportToImage() {
    if (wallets.length === 0) {
        alert('belum ada tabungan, bang aji. buat dulu di menu Atur Tabungan');
        return;
    }
    
    const totalText = document.getElementById('totalSaldoDashboard').innerText;
    const today = getTodayDate();
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.background = 'linear-gradient(135deg, #0a0f1e, #03050b)';
    tempDiv.style.padding = '48px';
    tempDiv.style.borderRadius = '32px';
    tempDiv.style.width = '1440px';
    tempDiv.style.fontFamily = "'Inter', sans-serif";
    tempDiv.style.color = '#e2e8f0';
    
    const walletItems = wallets.map(w => `
        <div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
            <span><i class="fas fa-wallet" style="color:#fbbf24; margin-right:12px"></i> ${w.name}</span>
            <span style="color:#fbbf24;font-weight:700">${formatRupiah(w.balance)}</span>
        </div>
    `).join('');
    
    const shoppingItems = [];
    const todayTrans = transactions.filter(t => t.date === today && t.type === 'expense');
    todayTrans.forEach(t => {
        let itemName = t.purpose === 'jajan' ? '🍔 Jajan / Beli' : t.purpose === 'bayar hutang' ? '💸 Bayar Hutang' : t.purpose === 'ditabung lagi' ? '💰 Ditabung lagi' : `📦 ${t.purpose}`;
        shoppingItems.push(`${itemName}: ${formatRupiah(t.amount)} (${t.walletName})${t.note ? ` - ${t.note}` : ''}`);
    });
    
    tempDiv.innerHTML = `
        <div style="text-align:center; margin-bottom:40px">
            <div style="font-size:56px; margin-bottom:12px">🏦 WALLETKU</div>
            <div style="font-size:16px; color:#64748b">privat punya bang aji • ${today}</div>
        </div>
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a); border:2px solid #fbbf24; border-radius:28px; padding:36px; margin-bottom:36px; text-align:center">
            <div style="font-size:18px; color:#94a3b8; letter-spacing:2px">TOTAL TABUNGAN</div>
            <div style="font-size:80px; font-weight:800; color:#fbbf24">${totalText}</div>
        </div>
        <div style="margin-bottom:36px">
            <div style="font-size:22px; font-weight:600; margin-bottom:20px; border-left:4px solid #fbbf24; padding-left:16px">💰 RINCIAN PER TABUNGAN</div>
            <div style="background:rgba(255,255,255,0.03); border-radius:24px; padding:24px">
                ${walletItems}
            </div>
        </div>
        <div style="margin-bottom:36px">
            <div style="font-size:22px; font-weight:600; margin-bottom:20px; border-left:4px solid #fbbf24; padding-left:16px">🛍️ YANG DIBELI HARI INI</div>
            ${shoppingItems.length > 0 ? 
                `<div style="background:rgba(255,255,255,0.03); border-radius:24px; padding:24px">
                    ${shoppingItems.map(item => `<div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05)">${item}</div>`).join('')}
                </div>` : 
                '<div style="background:rgba(255,255,255,0.03); border-radius:24px; padding:32px; text-align:center; color:#64748b">✨ belum ada belanja hari ini ✨</div>'
            }
        </div>
        <div style="margin-top:36px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.08); text-align:center; font-size:12px; color:#475569">
            snapshot otomatis • walletku tracker • data privat bang aji
        </div>
    `;
    
    document.body.appendChild(tempDiv);
    
    try {
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            backgroundColor: null,
            logging: false,
            useCORS: false
        });
        
        const link = document.createElement('a');
        link.download = `walletku_snapshot_${today}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        alert('foto 1440p udah ke-download, bang aji! cek folder download lo.');
    } catch (err) {
        console.error('export error:', err);
        alert('gagal bikin foto, coba lagi ya');
    } finally {
        document.body.removeChild(tempDiv);
    }
}

function setupEventListeners() {
    const quickLaporBtn = document.getElementById('quickLaporBtn');
    if (quickLaporBtn) {
        quickLaporBtn.addEventListener('click', () => {
            document.querySelector('[data-page="transaction"]').click();
        });
    }
    
    const exportBtn = document.getElementById('exportImageBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToImage);
    }
    
    const submitBtn = document.getElementById('submitTransBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const walletId = document.getElementById('transWalletSelect').value;
            const typeRadio = document.querySelector('input[name="transType"]:checked');
            const type = typeRadio ? typeRadio.value : 'income';
            const amount = parseInt(document.getElementById('transAmount').value);
            const note = document.getElementById('transNote').value;
            
            if (!walletId) {
                alert('pilih tabungan dulu bang aji');
                return;
            }
            if (!amount || amount <= 0) {
                alert('isi jumlah yang bener ya');
                return;
            }
            
            let sourceOrPurpose = '';
            if (type === 'income') {
                sourceOrPurpose = document.getElementById('incomeSource').value;
            } else {
                sourceOrPurpose = document.getElementById('expensePurpose').value;
            }
            
            const success = addTransaction(walletId, type, amount, sourceOrPurpose, note);
            if (success) {
                document.getElementById('transAmount').value = '';
                document.getElementById('transNote').value = '';
                alert('laporan tersimpan bang aji!');
                // pindah ke dashboard biar liat perubahan
                document.querySelector('[data-page="dashboard"]').click();
            }
        });
    }
    
    const radioButtons = document.querySelectorAll('input[name="transType"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isIncome = e.target.value === 'income';
            const incomeGroup = document.getElementById('incomeDetailGroup');
            const expenseGroup = document.getElementById('expenseDetailGroup');
            if (incomeGroup) incomeGroup.style.display = isIncome ? 'block' : 'none';
            if (expenseGroup) expenseGroup.style.display = isIncome ? 'none' : 'block';
        });
    });
    
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Yakin bang aji? semua riwayat bakal ilang permanen')) {
                transactions = [];
                saveTransactions();
                updateAllSaldoDisplay();
                alert('riwayat udah dibersihin');
            }
        });
    }
    
    const filterWallet = document.getElementById('filterWallet');
    if (filterWallet) {
        filterWallet.addEventListener('change', () => renderHistory());
    }
    
    const addWalletBtn = document.getElementById('addWalletBtn');
    if (addWalletBtn) {
        addWalletBtn.addEventListener('click', () => {
            const newName = document.getElementById('newWalletName').value.trim();
            if (!newName) {
                alert('kasih nama tabungannya dulu bang');
                return;
            }
            const newWallet = {
                id: 'wallet_' + Date.now(),
                name: newName,
                balance: 0
            };
            wallets.push(newWallet);
            saveWallets();
            updateAllSaldoDisplay();
            loadWalletSelects();
            document.getElementById('newWalletName').value = '';
        });
    }
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page;
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            const targetPage = document.getElementById(`${pageId}-page`);
            if (targetPage) targetPage.classList.add('active');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            if (pageId === 'settings') {
                loadWalletSelects();
            }
            if (pageId === 'history') {
                renderHistory();
            }
            
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('overlay');
                if (sidebar) sidebar.classList.remove('open');
                if (overlay) overlay.style.display = 'none';
            }
        });
    });
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            if (sidebar) sidebar.classList.toggle('open');
            if (overlay) overlay.style.display = sidebar?.classList.contains('open') ? 'block' : 'none';
        });
    }
    
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
            overlay.style.display = 'none';
        });
    }
}

function init() {
    loadData();
    updateAllSaldoDisplay();
    loadWalletSelects();
    setupEventListeners();
    console.log('app initialized');
}

init();
