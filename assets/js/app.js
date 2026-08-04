(function initApp() {
    const yearSelect = document.getElementById('filter-year');
    const currentYear = new Date().getFullYear();

    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }

    renderMonthChips();
    renderCatGrid();
    processRecurringPayments();
    renderList();
    renderSwipeHint();
    renderQuickTemplates();

    if (pendingCatSync) {
        syncCategories('push');
    } else {
        syncCategories('pull');
    }

    syncTransactions('pull');
    lucide.createIcons();
})();
