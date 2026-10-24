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
        // v2.53: rezerva = rozpočet − už minuté − pravidelné platby, ktoré ešte len prídu − plánované udalosti.
        // Ušetrené peniaze ju zvyšujú, nadmerné míňanie znižuje. Starý údaj (rozpočet − odhad) ostáva
        // iba ako náhrada, ak plán nie je k dispozícii.
        const hasFree=Number.isFinite(Number(data.freeToSpend));
        const available=hasFree?Number(data.freeToSpend):(Number(data.safeToSpend)||0);
        const days=Math.max(1,Number(meta.remaining)||Number(meta.daysInclusive)||1);
        const daily=available>0?available/days:0;
        const sevenDay=available>0?Math.min(available,daily*Math.min(7,days)):0;
        const budgetBase=hasFree&&data.freeBreakdown?Number(data.freeBreakdown.budget)||0:data.totalRecommended;
        const ratio=budgetBase>0?available/budgetBase:0;
        const projectedMargin=Number(data.safeToSpend)||0; // rozpočet − odhad na koniec mesiaca (zohľadňuje tempo)
        const status=available<0
            ? {tone:'danger',label:'Treba ubrať',text:'Rozpočet je už vyčerpaný, vrátane platieb, ktoré ešte prídu.'}
            : projectedMargin<0
                ? {tone:'warn',label:'Pozor na tempo',text:'Pri súčasnom tempe rozpočet do konca mesiaca nevyjde.'}
                : ratio<0.08
                    ? {tone:'warn',label:'Rezerva je malá',text:'Do rozpočtu ostáva už len malý priestor.'}
                    : {tone:'good',label:'V pohode',text:'Podľa doterajšieho tempa zostáva priestor v rozpočte.'};
        return {available,daily,sevenDay,days,status,breakdown:hasFree?data.freeBreakdown:null};
    }
    function renderFinancialCockpitNow(){
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
          <div class="cockpit-simple-head"><div><div class="cockpit-eyebrow"><i data-lucide="layout-dashboard"></i>${meta.isCurrent?'Tento mesiac':'Vybraný mesiac'}</div><h2>${esc(meta.label)}</h2></div><button type="button" class="cockpit-budget-link" onclick="showScreen('budget')">Rozpočet <i data-lucide="arrow-up-right"></i></button></div>
          <div class="cockpit-hero ${signedClass(projectedBalance)}"><span>${primaryLabel}</span><strong>${formatCurrency(projectedBalance)}</strong><small>očakávaný príjem mínus odhad výdavkov</small></div>
          <div class="cockpit-glance cockpit-glance-two">
            <div><span>Minuté</span><strong>${formatCurrency(data.totalSpent)}</strong><small>${budgetUsage}% z rozpočtu</small></div>
            <div><span>Odhad výdavkov</span><strong>${formatCurrency(data.totalForecast)}</strong><small>${data.forecastRange&&meta.isCurrent?`typicky ${formatCurrency(data.forecastRange.low)} – ${formatCurrency(data.forecastRange.high)}`:'do konca mesiaca'}</small></div>
          </div>
          <div class="cockpit-progress-row"><div><span>Čerpanie rozpočtu</span><b>${budgetUsage}%</b></div><div class="cockpit-progress"><i style="width:${progressWidth}%"></i></div></div>
          ${safe?`<section class="safe-spend-card tone-${safe.status.tone}" aria-label="Koľko ešte môžem minúť">
            <div class="safe-spend-head"><div><span>Koľko ešte môžem minúť?</span><small>${safe.status.text}</small></div><span class="safe-spend-status tone-${safe.status.tone}">${safe.status.label}</span></div>
            <div class="safe-spend-main ${signedClass(safe.available)}"><strong>${formatCurrency(safe.available)}</strong><span>${safe.available>=0?`≈ ${formatCurrency(safe.daily)} denne do konca mesiaca`:'Rozpočet už podľa odhadu nestačí'}</span></div>
            <details class="safe-spend-details"><summary>Ako sme k tomu prišli? <i data-lucide="chevron-down"></i></summary><div class="safe-spend-breakdown">
              ${safe.breakdown?`<div><span>Rozpočet kategórií</span><b>${formatCurrency(safe.breakdown.budget)}</b></div>
              <div><span>Minuté doteraz</span><b>− ${formatCurrency(safe.breakdown.spent)}</b></div>
              <div><span>Pravidelné platby, ktoré ešte prídu</span><b>− ${formatCurrency(safe.breakdown.remainingRecurring)}</b></div>
              <div><span>Plánované udalosti</span><b>− ${formatCurrency(safe.breakdown.pendingEvents)}</b></div>`:`<div><span>Rozpočet na mesiac</span><b>${formatCurrency(data.totalRecommended)}</b></div>
              <div><span>Odhad výdavkov do konca</span><b>${formatCurrency(data.totalForecast)}</b></div>`}
              <div class="safe-spend-result"><span>Môžeš ešte minúť</span><b class="${signedClass(safe.available)}">${formatCurrency(safe.available)}</b></div>
            </div><p>Stav „Pozor na tempo“ vychádza z odhadu na koniec mesiaca: zohľadňuje, koľko doteraz míňaš v porovnaní s obvyklým tempom.</p></details>
          </section>`:''}
          ${insights.length?`<section class="smart-insights" aria-label="Čo je dobré vedieť">
            <div class="smart-insights-head"><div><span>Čo je dobré vedieť</span><small>Najdôležitejšie veci pre tento mesiac</small></div><span class="smart-insights-count">${insights.length}</span></div>
            <div class="smart-insights-list">${insights.map((item,index)=>`<article class="smart-insight tone-${esc(item.tone)} ${index===0?'is-primary':''}"><div class="smart-insight-icon"><i data-lucide="${esc(item.icon)}"></i></div><div class="smart-insight-copy"><strong>${esc(item.title)}</strong><span>${esc(item.text)}</span></div></article>`).join('')}</div>
          </section>`:''}
          <details class="cockpit-more"><summary>Ďalšie údaje <i data-lucide="chevron-down"></i></summary><div class="cockpit-more-grid">
            <div><span>Rozpočet</span><strong>${formatCurrency(data.totalRecommended)}</strong></div>
            <div><span>Očakávaný príjem</span><strong>${formatCurrency(data.totalIncome)}</strong></div>
            ${safe?`<div><span>Do konca mesiaca</span><strong>${meta.remaining} dní</strong></div>`:''}
          </div></details>
        </section>`;
        if(window.lucide)lucide.createIcons();
    }
    // v2.53: karta sa prekreslí, kedykoľvek sa zmenia dáta (nová transakcia, sync, úprava plánu),
    // nielen pri prepnutí obrazovky. Podpis je lacný, takže ho renderList() smie kontrolovať často.
    let lastCockpitSignature='';
    function hashText(text){let h=5381;for(let i=0;i<text.length;i++)h=((h<<5)+h+text.charCodeAt(i))|0;return h;}
    function cockpitSignature(){
        const parts=[
            Array.isArray(selectedMonths)?selectedMonths.join(','):'',
            document.getElementById('filter-year')?.value||'',
            typeof getForecastIndexSignature==='function'?getForecastIndexSignature():'',
            Array.isArray(categories)?categories.length:0,
            new Date().toDateString()
        ];
        try{
            parts.push(hashText(JSON.stringify([
                typeof flowRecurringPlans!=='undefined'?flowRecurringPlans:[],
                typeof flowPlannedEvents!=='undefined'?flowPlannedEvents:[],
                typeof flowBudgetOverrides!=='undefined'?flowBudgetOverrides:[]
            ])));
        }catch(_){}
        return parts.join('|');
    }
    function renderFinancialCockpit(){
        renderFinancialCockpitNow();
        lastCockpitSignature=cockpitSignature();
    }
    function refreshFinancialCockpitIfChanged(){
        if(cockpitSignature()!==lastCockpitSignature)renderFinancialCockpit();
    }
    window.renderFinancialCockpit=renderFinancialCockpit;
    window.refreshFinancialCockpitIfChanged=refreshFinancialCockpitIfChanged;
    document.addEventListener('click',e=>{if(e.target.closest('#filter-months-container'))setTimeout(renderFinancialCockpit,0);});
    document.addEventListener('change',e=>{if(e.target?.id==='filter-year')setTimeout(renderFinancialCockpit,0);});
})();
