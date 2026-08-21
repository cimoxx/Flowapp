function showScreen(screen) {
    const screens = ['home', 'budget', 'plan', 'recurring', 'analytics', 'burnrate'];

    screens.forEach(name => {
        const el = document.getElementById(`screen-${name}`);
        if (el) el.classList.add('hidden');
    });

    const settings = document.getElementById('settings-screen');
    if (settings) settings.classList.add('hidden');

    const target = document.getElementById(`screen-${screen}`);
    if (target) target.classList.remove('hidden');

    ['home', 'budget', 'plan', 'recurring', 'analytics', 'burnrate', 'settings'].forEach(name => {
        const nav = document.getElementById(`nav-${name}`);
        if (nav) nav.classList.remove('active');
    });

    const activeNav = document.getElementById(`nav-${screen}`);
    if (activeNav) activeNav.classList.add('active');

    if (screen === 'settings') {
        if (settings) settings.classList.remove('hidden');
        activeSettingsCat = null;
        const detail = document.getElementById('settings-cat-detail');
        const home = document.getElementById('settings-home');
        if (detail) detail.classList.add('hidden');
        if (home) home.classList.remove('hidden');
        if (typeof renderManageCats === 'function') renderManageCats();
    } else if (screen === 'analytics') {
        if (typeof renderChartMonthChips === 'function') renderChartMonthChips();
        if (typeof updateAnalytics === 'function') updateAnalytics();
    } else if (screen === 'burnrate') {
        if (typeof renderChartMonthChips === 'function') renderChartMonthChips();
        if (typeof updateBurnRateTab === 'function') updateBurnRateTab();
    } else if (screen === 'budget') {
        if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    } else if (screen === 'plan') {
        if (typeof renderAnnualPlanScreen === 'function') renderAnnualPlanScreen();
    } else if (screen === 'recurring') {
        if (typeof renderRecurringScreen === 'function') renderRecurringScreen();
    } else if (screen === 'home') {
        if (typeof processRecurringPayments === 'function') processRecurringPayments();
        if (typeof renderList === 'function') renderList();
        if (typeof renderSwipeHint === 'function') renderSwipeHint();
        if (typeof renderFinancialCockpit === 'function') renderFinancialCockpit();
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function refreshAllViews() {
    if (typeof refreshYearSelectors === 'function') refreshYearSelectors();
    if (typeof renderList === 'function') renderList();
    if (typeof updateAnalytics === 'function') updateAnalytics();
    if (typeof updateBurnRateTab === 'function') updateBurnRateTab();
    if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    if (typeof renderFinancialCockpit === 'function') renderFinancialCockpit();
    if (typeof renderPlanningScreens === 'function') renderPlanningScreens();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

(function initApp() {
    const currentYear = new Date().getFullYear();
    if (typeof refreshYearSelectors === 'function') refreshYearSelectors();

    if (typeof renderMonthChips === 'function') renderMonthChips();
    if (typeof renderCatGrid === 'function') renderCatGrid();
    if (typeof processRecurringPayments === 'function') processRecurringPayments();
    if (typeof renderList === 'function') renderList();
    if (typeof renderSwipeHint === 'function') renderSwipeHint();
    if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    if (typeof renderFinancialCockpit === 'function') renderFinancialCockpit();
    if (typeof initPlanning === 'function') initPlanning();

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
