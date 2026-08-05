function openChangelogModal() {
    document.getElementById('changelog-modal').classList.remove('hidden');
}

function closeChangelogModal() {
    document.getElementById('changelog-modal').classList.add('hidden');
}

function renderUserToggle() {
    const wrap = document.getElementById('user-toggle-wrap');
    if (!wrap) return;

    wrap.innerHTML = `
        <div class="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            ${users.map(u => `
                <button type="button" onclick="setUser('${u.replace(/'/g, "\\'")}')" id="u-${u}" class="flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all">${u.toUpperCase()}</button>
            `).join('')}
        </div>
    `;
    setUser(curUser);
}

function renderUserFilters() {
    const chartUser = document.getElementById('chart-user-filter');
    const burnUser = document.getElementById('burn-user-filter');

    const options = `<option value="all">Všetci</option>` + users.map(u => `<option value="${u}">${u}</option>`).join('');

    if (chartUser) chartUser.innerHTML = options;
    if (burnUser) burnUser.innerHTML = options;
}

function renderUsersSettings() {
    const el = document.getElementById('users-settings-list');
    if (!el) return;

    el.innerHTML = users.map((u, i) => `
        <div class="flex items-center gap-2">
            <input type="text" value="${u}" onchange="renameUser(${i}, this.value)" class="flex-1 p-3 rounded-xl text-sm outline-none">
            <button type="button" onclick="removeUser(${i})" class="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-900/30 text-rose-400">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    lucide.createIcons();
}

function addUser() {
    const newName = prompt('Zadaj meno používateľa:');
    if (!newName || !newName.trim()) return;

    const trimmed = newName.trim();
    if (users.includes(trimmed)) {
        showToast({ type: 'info', title: 'Používateľ už existuje' });
        return;
    }

    users.push(trimmed);
    saveUsers();
}

function renameUser(index, value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;

    const oldName = users[index];
    if (oldName === trimmed) return;

    db.forEach(item => {
        if ((item.user || '') === oldName) item.user = trimmed;
    });

    if (curUser === oldName) curUser = trimmed;
    users[index] = trimmed;

    localStorage.setItem('f_last_user', curUser);
    saveUsers();
    saveData(false);
    renderList();
    updateAnalytics();
    updateBurnRateTab();
}

function removeUser(index) {
    if (users.length <= 1) {
        showToast({
            type: 'warning',
            title: 'Nedá sa zmazať',
            text: 'Aplikácia potrebuje aspoň jedného používateľa.'
        });
        return;
    }

    const removed = users[index];
    if (!confirm(`Zmazať používateľa ${removed}?`)) return;

    users.splice(index, 1);

    db.forEach(item => {
        if (item.user === removed) {
            item.user = users[0];
        }
    });

    if (curUser === removed) curUser = users[0];
    localStorage.setItem('f_last_user', curUser);

    saveUsers();
    saveData(false);
    renderList();
    updateAnalytics();
    updateBurnRateTab();
}

function saveUsers() {
    localStorage.setItem('f_users_v20', JSON.stringify(users));
    renderUserToggle();
    renderUserFilters();
    renderUsersSettings();
    lucide.createIcons();
}

function setUser(u) {
    curUser = u;
    localStorage.setItem('f_last_user', u);

    users.forEach(name => {
        const btn = document.getElementById(`u-${name}`);
        if (!btn) return;
        btn.className =
            `flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${u === name ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`;
    });
}

function setType(t) {
    curType = t;
    localStorage.setItem('f_last_type_v20', t);

    document.getElementById('t-ex').className =
        `flex-1 py-2 rounded-lg text-[10px] font-black ${t === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400'}`;

    document.getElementById('t-in').className =
        `flex-1 py-2 rounded-lg text-[10px] font-black ${t === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`;
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function closeCatDetail() {
    activeSettingsCat = null;
    document.getElementById('settings-cat-detail').classList.add('hidden');
    document.getElementById('settings-home').classList.remove('hidden');
    renderManageCats();
}

function showScreen(s) {
    document.getElementById('screen-home').classList.toggle('hidden', s !== 'home');
    document.getElementById('screen-analytics').classList.toggle('hidden', s !== 'analytics');
    document.getElementById('screen-burnrate').classList.toggle('hidden', s !== 'burnrate');
    document.getElementById('settings-screen').classList.toggle('hidden', s !== 'settings');

    document.getElementById('nav-home').classList.toggle('active', s === 'home');
    document.getElementById('nav-analytics').classList.toggle('active', s === 'analytics');
    document.getElementById('nav-burnrate').classList.toggle('active', s === 'burnrate');
    document.getElementById('nav-settings').classList.toggle('active', s === 'settings');

    if (s === 'settings') {
        activeSettingsCat = null;
        closeCatDetail();
        renderManageCats();
        renderUsersSettings();
        lucide.createIcons();
    } else if (s === 'analytics') {
        renderChartMonthChips();
        updateAnalytics();
    } else if (s === 'burnrate') {
        renderChartMonthChips();
        updateBurnRateTab();
    } else {
        processRecurringPayments();
        renderList();
        renderSwipeHint();
    }
}

function showToast({ type = 'success', title = '', text = '', duration = 2600, action = null } = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
        success: 'check-circle-2',
        error: 'alert-circle',
        info: 'info',
        warning: 'triangle-alert'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i data-lucide="${iconMap[type] || 'info'}" class="toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${text ? `<div class="toast-text">${text}</div>` : ''}
        </div>
        ${action ? `<button type="button" class="toast-action-btn">${action.label}</button>` : ''}
        <button type="button" class="toast-close" onclick="dismissToast(this.closest('.toast'))">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    if (action) {
        const btn = toast.querySelector('.toast-action-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                action.onClick();
                dismissToast(toast);
            });
        }
    }

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const timeout = setTimeout(() => {
        dismissToast(toast);
    }, duration);

    toastTimeouts.push(timeout);
}

function exportData() {
    const payload = {
        db,
        categories,
        users,
        exportedAt: new Date().toISOString(),
        version: 'v2.29.0'
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-v20-backup-${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast({
        type: 'success',
        title: 'Export dokončený',
        text: 'Záloha bola uložená do JSON súboru.'
    });
}

function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);

            if (Array.isArray(parsed.db)) db = parsed.db;
            if (Array.isArray(parsed.categories)) categories = parsed.categories;
            if (Array.isArray(parsed.users)) users = parsed.users;

            localStorage.setItem('f_db_v20', JSON.stringify(db));
            localStorage.setItem('f_cats_v20', JSON.stringify(categories));
            localStorage.setItem('f_users_v20', JSON.stringify(users));

            renderCatGrid();
            renderManageCats();
            renderUserToggle();
            renderUserFilters();
            renderUsersSettings();
            renderList();
            updateAnalytics();
            updateBurnRateTab();

            showToast({
                type: 'success',
                title: 'Import dokončený',
                text: 'Dáta boli úspešne načítané.'
            });
        } catch (err) {
            showToast({
                type: 'error',
                title: 'Import zlyhal',
                text: 'Súbor nemá platný formát JSON.'
            });
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function resetLocalData() {
    if (!confirm('Resetovať lokálne dáta? Cloud dáta zostanú zachované, ale lokálny stav sa vymaže.')) return;

    localStorage.removeItem('f_db_v20');
    localStorage.removeItem('f_sync_q_v20');
    localStorage.removeItem('f_last_cat');
    localStorage.removeItem('f_last_sub');
    localStorage.removeItem('f_last_type_v20');

    db = [];
    syncQueue = [];

    renderList();
    updateAnalytics();
    updateBurnRateTab();
    updateSyncUI('ok');

    showToast({
        type: 'warning',
        title: 'Lokálne dáta resetované',
        text: 'Aplikácia je vyčistená. Môžeš znova synchronizovať cloud dáta.'
    });
}

function dismissToast(toastEl) {
    if (!toastEl) return;
    toastEl.classList.remove('show');
    setTimeout(() => {
        if (toastEl && toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
        }
    }, 250);
}
