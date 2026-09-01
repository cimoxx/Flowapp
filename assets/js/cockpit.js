/* Flow v2.44.2 — Simplified Financial Cockpit
   Read-only presentation layer. Reuses existing Budget/Planning data only. */
(function () {
    function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
    function signedClass(value) { const n=Number(value)||0; return n>0?'is-positive':n<0?'is-negative':'is-neutral'; }
    function getPeriodMeta(year, month) {
        const now=new Date(), isCurrent=now.getFullYear()===year&&now.getMonth()===month;
        const end=new Date(year,month+1,0).getDate(), remaining=isCurrent?Math.max(0,end-now.getDate()):null;
        const daysInclusive=isCurrent?Math.max(1,remaining+1):null;
        const label=new Date(year,month,1).toLocaleDateString('sk-SK',{month:'long',year:'numeric'});
        return {isCurrent,remaining,daysInclusive,label:label.charAt(0).toUpperCase()+label.slice(1)};
    }
    function buildSafeToSpend(data,meta){
        if(!meta.isCurrent)return null;
        const available=Number(data.safeToSpend)||0, daily=available>0?available/meta.daysInclusive:0;
        return {available,daily,sevenDay:available>0?Math.min(available,daily*7):0};
    }
    function renderFinancialCockpit(){
        const root=document.getElementById('financial-cockpit');
        if(!root||typeof getBudgetDataset!=='function')return;
        if(!Array.isArray(selectedMonths)||selectedMonths.length!==1){
            root.innerHTML=`<section class="cockpit-shell cockpit-empty"><div class="cockpit-empty-icon"><i data-lucide="layout-dashboard"></i></div><div><strong>Prehľad mesiaca</strong><span>Vyber jeden mesiac pre finančný súhrn.</span></div></section>`;
            if(window.lucide)lucide.createIcons(); return;
        }
        const data=getBudgetDataset(), meta=getPeriodMeta(data.year,data.month);
        const projectedBalance=Number.isFinite(Number(data.plannedBalance))?Number(data.plannedBalance):(Number(data.totalIncome)||0)-(Number(data.totalForecast)||0);
        const budgetUsage=data.totalRecommended>0?Math.round((data.totalSpent/data.totalRecommended)*100):0;
        const progressWidth=Math.max(0,Math.min(100,budgetUsage));
        const insights=typeof buildBudgetInsights==='function'?buildBudgetInsights(data).slice(0,3):[];
        const safe=buildSafeToSpend(data,meta);
        const primaryLabel=meta.isCurrent?'Očakávaný zostatok':'Odhadovaný zostatok';
        root.innerHTML=`<section class="cockpit-shell cockpit-simple" aria-label="Finančný prehľad pre ${esc(meta.label)}">
          <div class="cockpit-simple-head"><div><div class="cockpit-eyebrow"><i data-lucide="layout-dashboard"></i>${meta.isCurrent?'Tento mesiac':'Vybraný mesiac'}</div><h2>${esc(meta.label)}</h2></div><button type="button" class="cockpit-budget-link" onclick="showScreen('budget')">Budget <i data-lucide="arrow-up-right"></i></button></div>
          <div class="cockpit-hero ${signedClass(projectedBalance)}"><span>${primaryLabel}</span><strong>${formatCurrency(projectedBalance)}</strong><small>očakávaný príjem mínus forecast výdavkov</small></div>
          <div class="cockpit-glance">
            <div><span>Minuté</span><strong>${formatCurrency(data.totalSpent)}</strong><small>${budgetUsage}% z budgetu</small></div>
            <div><span>Forecast</span><strong>${formatCurrency(data.totalForecast)}</strong><small>odhad konca mesiaca</small></div>
            ${safe?`<div class="cockpit-glance-safe ${signedClass(safe.available)}"><span>Safe to Spend</span><strong>${formatCurrency(safe.available)}</strong><small>${safe.available>=0?`${formatCurrency(safe.daily)} / deň`:'forecast nad budgetom'}</small></div>`:`<div><span>Rezerva</span><strong>${formatCurrency(data.safeToSpend)}</strong><small>budget − forecast</small></div>`}
          </div>
          <div class="cockpit-progress-row"><div><span>Čerpanie budgetu</span><b>${budgetUsage}%</b></div><div class="cockpit-progress"><i style="width:${progressWidth}%"></i></div></div>
          ${insights.length?`<section class="smart-insights" aria-label="Čo je dobré vedieť">
            <div class="smart-insights-head"><div><span>Čo je dobré vedieť</span><small>Najdôležitejšie veci pre tento mesiac</small></div><span class="smart-insights-count">${insights.length}</span></div>
            <div class="smart-insights-list">${insights.map((item,index)=>`<article class="smart-insight tone-${esc(item.tone)} ${index===0?'is-primary':''}"><div class="smart-insight-icon"><i data-lucide="${esc(item.icon)}"></i></div><div class="smart-insight-copy"><strong>${esc(item.title)}</strong><span>${esc(item.text)}</span></div></article>`).join('')}</div>
          </section>`:''}
          <details class="cockpit-more"><summary>Detail mesiaca <i data-lucide="chevron-down"></i></summary><div class="cockpit-more-grid">
            <div><span>Budget</span><strong>${formatCurrency(data.totalRecommended)}</strong></div>
            <div><span>Rezerva podľa forecastu</span><strong class="${signedClass(data.safeToSpend)}">${formatCurrency(data.safeToSpend)}</strong></div>
            ${safe?`<div><span>Safe / 7 dní</span><strong>${formatCurrency(safe.sevenDay)}</strong></div><div><span>Do konca</span><strong>${meta.remaining} dní</strong></div>`:''}
          </div></details>
        </section>`;
        if(window.lucide)lucide.createIcons();
    }
    window.renderFinancialCockpit=renderFinancialCockpit;
    document.addEventListener('click',e=>{if(e.target.closest('#filter-months-container'))setTimeout(renderFinancialCockpit,0);});
    document.addEventListener('change',e=>{if(e.target?.id==='filter-year')setTimeout(renderFinancialCockpit,0);});
})();
