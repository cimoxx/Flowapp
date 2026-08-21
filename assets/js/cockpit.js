/* Flow v2.44.0 — Financial Cockpit
   Read-only presentation layer. It intentionally reuses the existing Budget dataset
   and insight engine and does not alter transactions, Budget, Forecast or Annual Plan. */
(function () {
    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    function signedClass(value) {
        const n = Number(value) || 0;
        return n > 0 ? 'is-positive' : n < 0 ? 'is-negative' : 'is-neutral';
    }

    function getPeriodMeta(year, month) {
        const now = new Date();
        const isCurrent = now.getFullYear() === year && now.getMonth() === month;
        const end = new Date(year, month + 1, 0).getDate();
        const remaining = isCurrent ? Math.max(0, end - now.getDate()) : null;
        const label = new Date(year, month, 1).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
        return { isCurrent, remaining, label: label.charAt(0).toUpperCase() + label.slice(1) };
    }

    function renderFinancialCockpit() {
        const root = document.getElementById('financial-cockpit');
        if (!root || typeof getBudgetDataset !== 'function') return;

        if (!Array.isArray(selectedMonths) || selectedMonths.length !== 1) {
            root.innerHTML = `
                <section class="cockpit-shell cockpit-empty">
                    <div class="cockpit-empty-icon"><i data-lucide="layout-dashboard"></i></div>
                    <div><strong>Finančný cockpit</strong><span>Vyber jeden mesiac a zobrazím jeho aktuálny finančný obraz.</span></div>
                </section>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const data = getBudgetDataset();
        const meta = getPeriodMeta(data.year, data.month);
        const projectedBalance = Number.isFinite(Number(data.plannedBalance))
            ? Number(data.plannedBalance)
            : (Number(data.totalIncome) || 0) - (Number(data.totalForecast) || 0);
        const budgetUsage = data.totalRecommended > 0 ? Math.round((data.totalSpent / data.totalRecommended) * 100) : 0;
        const progressWidth = Math.max(0, Math.min(100, budgetUsage));
        const insights = typeof buildBudgetInsights === 'function' ? buildBudgetInsights(data).slice(0, 3) : [];
        const topInsight = insights[0];

        root.innerHTML = `
            <section class="cockpit-shell" aria-label="Finančný cockpit pre ${esc(meta.label)}">
                <div class="cockpit-head">
                    <div>
                        <div class="cockpit-eyebrow"><i data-lucide="layout-dashboard"></i> Tento mesiac</div>
                        <h2>Finančný cockpit</h2>
                        <p>${esc(meta.label)}${meta.isCurrent ? ` · ${meta.remaining} dní do konca mesiaca` : ''}</p>
                    </div>
                    <button type="button" class="cockpit-budget-link" onclick="showScreen('budget')">Detail budgetu <i data-lucide="arrow-up-right"></i></button>
                </div>

                <div class="cockpit-primary-grid">
                    <div class="cockpit-primary-card">
                        <span>Minuté doteraz</span>
                        <strong>${formatCurrency(data.totalSpent)}</strong>
                        <small>${budgetUsage}% z budgetu ${formatCurrency(data.totalRecommended)}</small>
                        <div class="cockpit-progress"><i style="width:${progressWidth}%"></i></div>
                    </div>
                    <div class="cockpit-primary-card">
                        <span>Forecast mesiaca</span>
                        <strong>${formatCurrency(data.totalForecast)}</strong>
                        <small>aktuálny odhad konca mesiaca</small>
                    </div>
                    <div class="cockpit-primary-card cockpit-result ${signedClass(data.safeToSpend)}">
                        <span>Rezerva podľa forecastu</span>
                        <strong>${formatCurrency(data.safeToSpend)}</strong>
                        <small>${data.safeToSpend >= 0 ? 'forecast je pod budgetom' : 'forecast prekračuje budget'}</small>
                    </div>
                    <div class="cockpit-primary-card cockpit-result ${signedClass(projectedBalance)}">
                        <span>Očakávaný zostatok</span>
                        <strong>${formatCurrency(projectedBalance)}</strong>
                        <small>príjem mínus forecast výdavkov</small>
                    </div>
                </div>

                ${topInsight ? `
                <div class="cockpit-signal tone-${esc(topInsight.tone)}">
                    <div class="cockpit-signal-icon"><i data-lucide="${esc(topInsight.icon)}"></i></div>
                    <div><strong>${esc(topInsight.title)}</strong><span>${esc(topInsight.text)}</span></div>
                </div>` : ''}
            </section>`;

        if (window.lucide) lucide.createIcons();
    }

    window.renderFinancialCockpit = renderFinancialCockpit;

    document.addEventListener('click', event => {
        if (event.target.closest('#filter-months-container')) setTimeout(renderFinancialCockpit, 0);
    });
    document.addEventListener('change', event => {
        if (event.target?.id === 'filter-year') setTimeout(renderFinancialCockpit, 0);
    });
})();
