function openChangelogModal() {
    document.getElementById('changelog-modal').classList.remove('hidden');
}

function closeChangelogModal() {
    document.getElementById('changelog-modal').classList.add('hidden');
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

function showScreen(screen) {
    document.getElementById('screen-home').classList.toggle('hidden', screen !== 'home');
    document.getElementById('screen-analytics').classList.toggle('hidden', screen !== 'analytics');
    document.getElementById('screen-burnrate').classList.toggle('hidden', screen !== 'burnrate');
    document.getElementById('settings-screen').classList.toggle('hidden', screen !== 'settings');

    document.getElementById('nav-home').classList.toggle('active', screen === 'home');
    document.getElementById('nav-analytics').classList.toggle('active', screen === 'analytics');
    document.getElementById('nav-burnrate').classList.toggle('active', screen === 'burnrate');
    document.getElementById('nav-settings').classList.toggle('active', screen === 'settings');

    if (screen === 'settings') {
        activeSettingsCat = null;
        closeCatDetail();
        renderManageCats();
        lucide.createIcons();
        return;
    }

    if (screen === 'analytics') {
        renderChartMonthChips();
        updateAnalytics();
        return;
    }

    if (screen === 'burnrate') {
        renderChartMonthChips();
        updateBurnRateTab();
        return;
    }

    processRecurringPayments();
    renderList();
    renderSwipeHint();
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

    requestAnimationFrame(() => toast.classList.add('show'));

    const timeout = setTimeout(() => dismissToast(toast), duration);
    toastTimeouts.push(timeout);
}

function exportData() {
    const payload = {
        db,
        categories,
        exportedAt: new Date().toISOString(),
        version: 'v2.30.1'
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
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);

            if (Array.isArray(parsed.db)) db = parsed.db;
            if (Array.isArray(parsed.categories)) categories = parsed.categories;

            localStorage.setItem('f_db_v20', JSON.stringify(db));
            localStorage.setItem('f_cats_v20', JSON.stringify(categories));

            analyticsBreakdownExpanded = {};
            burnBreakdownExpanded = {};

            renderCatGrid();
            renderManageCats();
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
    analyticsBreakdownExpanded = {};
    burnBreakdownExpanded = {};

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
        if (toastEl?.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 250);
}
