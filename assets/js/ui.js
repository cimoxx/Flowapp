function openChangelogModal() {
    document.getElementById('changelog-modal').classList.remove('hidden');
}

function closeChangelogModal() {
    document.getElementById('changelog-modal').classList.add('hidden');
}

function setUser(u) {
    curUser = u;
    localStorage.setItem('f_last_user', u);

    document.getElementById('u-Lukáš').className =
        `flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${u === 'Lukáš' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`;

    document.getElementById('u-Zdenka').className =
        `flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${u === 'Zdenka' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`;
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
    } else if (s === 'analytics') {
        renderPresets();
        renderChartMonthChips();
        updateAnalytics();
    } else if (s === 'burnrate') {
        renderPresets();
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

function dismissToast(toastEl) {
    if (!toastEl) return;
    toastEl.classList.remove('show');
    setTimeout(() => {
        if (toastEl && toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
        }
    }, 250);
}
