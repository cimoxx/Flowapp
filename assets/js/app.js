function showScreen(screen) {
    const screens = ['home', 'budget', 'analytics', 'burnrate'];

    screens.forEach(name => {
        const el = document.getElementById(`screen-${name}`);
        if (el) el.classList.add('hidden');
    });

    const settings = document.getElementById('settings-screen');
    if (settings) settings.classList.add('hidden');

    const target = document.getElementById(`screen-${screen}`);
    if (target) target.classList.remove('hidden');

    ['home', 'budget', 'analytics', 'burnrate', 'settings'].forEach(name => {
        const nav = document.getElementById(`nav-${name}`);
        if (nav) nav.classList.remove('active');
    });

    const activeNav = document.getElementById(`nav-${screen}`);
    if (activeNav) activeNav.classList.add('active');

    if (screen === 'settings') {
        if (settings) settings.classList.remove('hidden');
    }

    if (screen === 'analytics' && typeof updateAnalytics === 'function') {
        updateAnalytics();
    }

    if (screen === 'burnrate' && typeof updateBurnRateTab === 'function') {
        updateBurnRateTab();
    }

    if (screen === 'budget' && typeof updateBudgetScreen === 'function') {
        updateBudgetScreen();
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function refreshAllViews() {
    if (typeof renderList === 'function') renderList();
    if (typeof updateAnalytics === 'function') updateAnalytics();
    if (typeof updateBurnRateTab === 'function') updateBurnRateTab();
    if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

(function initApp() {
    const yearSelect = document.getElementById('filter-year');
    const currentYear = new Date().getFullYear();

    if (yearSelect) {
        yearSelect.innerHTML = '';

        for (let y = currentYear - 2; y <= currentYear + 2; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.innerText = y;
            if (y === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }

    if (typeof renderMonthChips === 'function') renderMonthChips();
    if (typeof renderCatGrid === 'function') renderCatGrid();
    if (typeof processRecurringPayments === 'function') processRecurringPayments();
    if (typeof renderList === 'function') renderList();
    if (typeof renderSwipeHint === 'function') renderSwipeHint();
    if (typeof updateBudgetScreen === 'function') updateBudgetScreen();

    if (pendingCatSync) {
        if (typeof syncCategories === 'function') syncCategories('push');
    } else {
        if (typeof syncCategories === 'function') syncCategories('pull');
    }

    if (typeof syncTransactions === 'function') syncTransactions('pull');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
})();
