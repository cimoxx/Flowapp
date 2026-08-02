if ('serviceWorker' in navigator) { 
    navigator.serviceWorker.register('sw.js'); 
}

document.addEventListener('DOMContentLoaded', () => {
    const yearSelect = document.getElementById('filter-year');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear - 2; i <= currentYear + 1; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            if (i === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }

    lucide.createIcons();
    renderMonthChips();
    renderChartMonthChips();
    renderList();
});
