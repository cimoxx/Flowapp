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
        recurringPlans: typeof flowRecurringPlans !== 'undefined' ? flowRecurringPlans : [],
        plannedEvents: typeof flowPlannedEvents !== 'undefined' ? flowPlannedEvents : [],
        budgetOverrides: typeof flowBudgetOverrides !== 'undefined' ? flowBudgetOverrides : [],
        forecastArchive: typeof flowForecastArchive !== 'undefined' ? flowForecastArchive : [],
        exportedAt: new Date().toISOString(),
        version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '2.49.0'
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

            if (!Array.isArray(parsed.db) && !Array.isArray(parsed.categories)) {
                throw new Error('Neplatný Flow backup');
            }

            try {
                localStorage.setItem('f_safety_backup_v249', JSON.stringify({
                    db, categories,
                    recurringPlans: typeof flowRecurringPlans !== 'undefined' ? flowRecurringPlans : [],
                    plannedEvents: typeof flowPlannedEvents !== 'undefined' ? flowPlannedEvents : [],
                    budgetOverrides: typeof flowBudgetOverrides !== 'undefined' ? flowBudgetOverrides : [],
                    forecastArchive: typeof flowForecastArchive !== 'undefined' ? flowForecastArchive : [],
                    savedAt: new Date().toISOString(), reason: 'before_import'
                }));
            } catch (_) {}

            if (Array.isArray(parsed.db)) db = parsed.db;
            if (Array.isArray(parsed.categories)) categories = parsed.categories;
            if (Array.isArray(parsed.recurringPlans) && typeof flowRecurringPlans !== 'undefined') flowRecurringPlans = parsed.recurringPlans;
            if (Array.isArray(parsed.plannedEvents) && typeof flowPlannedEvents !== 'undefined') flowPlannedEvents = parsed.plannedEvents;
            if (Array.isArray(parsed.budgetOverrides) && typeof flowBudgetOverrides !== 'undefined') flowBudgetOverrides = parsed.budgetOverrides;
            if (Array.isArray(parsed.forecastArchive) && typeof flowForecastArchive !== 'undefined') flowForecastArchive = parsed.forecastArchive;
            if (typeof planningPersist === 'function') planningPersist();

            // Imported data replaces the current local dataset. Any old queued
            // mutations belong to the previous dataset and must never be pushed
            // after the import, otherwise they can overwrite imported data.
            syncQueue = [];
            pendingCatSync = false;

            localStorage.setItem('f_db_v20', JSON.stringify(db));
            categorySyncState.source = 'import';
            categorySyncState.baselineLoaded = true;
            persistCategoriesLocally('import');
            localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
            localStorage.removeItem('f_pending_cat_sync_v20');

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
    localStorage.removeItem('f_pending_cat_sync_v20');
    localStorage.removeItem('flow_recurring_plans_v235');
    localStorage.removeItem('flow_planned_events_v235');
    localStorage.removeItem('flow_budget_overrides_v235');
    localStorage.removeItem('flow_forecast_archive_v235');
    localStorage.removeItem('flow_model_state_v235');

    if (typeof flowRecurringPlans !== 'undefined') flowRecurringPlans = [];
    if (typeof flowPlannedEvents !== 'undefined') flowPlannedEvents = [];
    if (typeof flowBudgetOverrides !== 'undefined') flowBudgetOverrides = [];
    if (typeof flowForecastArchive !== 'undefined') flowForecastArchive = [];
    if (typeof flowModelState !== 'undefined') flowModelState = {};

    db = [];
    syncQueue = [];
    pendingCatSync = false;
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


// FLOW v2.49.0 — Data Protection Center
function getLocalDataHealth() {
    const rows = Array.isArray(db) ? db : [];
    const cats = Array.isArray(categories) ? categories : [];
    const ids = new Set(), categoryIds = new Set(cats.map(c => String(c?.id || '')).filter(Boolean));
    let duplicateIds=0, badDates=0, badAmounts=0, missingCategory=0;
    rows.forEach(item => {
        const id=String(item?.id||'');
        if(id){ if(ids.has(id)) duplicateIds++; ids.add(id); }
        const clean=typeof getCleanDateStr==='function'?getCleanDateStr(item?.date):String(item?.date||'');
        if(!clean || isNaN(new Date(clean+'T00:00:00').getTime())) badDates++;
        if(!Number.isFinite(Number(item?.amount))) badAmounts++;
        if(item?.category && item.type!=='income' && !categoryIds.has(String(item.category))) missingCategory++;
    });
    const issues=[];
    if(!cats.length) issues.push('Chýbajú kategórie');
    if(duplicateIds) issues.push(`${duplicateIds} duplicitných ID transakcií`);
    if(badDates) issues.push(`${badDates} neplatných dátumov`);
    if(badAmounts) issues.push(`${badAmounts} neplatných súm`);
    if(missingCategory) issues.push(`${missingCategory} transakcií odkazuje na chýbajúcu kategóriu`);
    if(typeof isLegacyGenericDefaultSet==='function' && isLegacyGenericDefaultSet(cats)) issues.push('Načítali sa chránené predvolené kategórie');
    return {ok:!issues.length,issues,transactions:rows.filter(x=>!x.deleted).length,categories:cats.length,
      recurring:typeof flowRecurringPlans!=='undefined'&&Array.isArray(flowRecurringPlans)?flowRecurringPlans.length:0,
      pending:Array.isArray(syncQueue)?syncQueue.length:0};
}
function renderDataHealth(local,remote){
    const title=document.getElementById('data-health-title'),badge=document.getElementById('data-health-badge'),
      summary=document.getElementById('data-health-summary'),issues=document.getElementById('data-health-issues'),
      last=document.getElementById('data-last-backup'),
      auto=document.getElementById('data-auto-backup');
    if(!title||!badge||!summary||!issues||!last)return;
    const ok=local.ok && (!remote||remote.status==='success');
    title.textContent=ok?'Všetko vyzerá v poriadku':'Našiel som veci na kontrolu';
    badge.textContent=ok?'OK':'SKONTROLOVAŤ'; badge.className=`data-health-badge ${ok?'tone-good':'tone-warn'}`;
    summary.innerHTML=`<div><b>${local.transactions}</b><span>transakcií</span></div><div><b>${local.categories}</b><span>kategórií</span></div><div><b>${local.recurring}</b><span>pravidelných</span></div><div><b>${local.pending}</b><span>čaká na sync</span></div>`;
    const all=[...local.issues]; if(remote&&remote.status!=='success')all.push('Cloudový stav sa nepodarilo overiť');
    if(all.length){issues.classList.remove('hidden');issues.innerHTML=all.map(x=>`<div><i data-lucide="triangle-alert"></i><span>${x}</span></div>`).join('');}
    else{issues.classList.add('hidden');issues.innerHTML='';}
    if(remote?.lastBackupAt){const d=new Date(remote.lastBackupAt);last.textContent=isNaN(d)?remote.lastBackupAt:d.toLocaleString('sk-SK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
    else if(remote?.status==='success')last.textContent='Zatiaľ nevytvorená'; else last.textContent=remote?.message||'Cloud sa nepodarilo overiť';
    if(auto) auto.textContent=remote?.autoBackupEnabled ? 'Zapnutá · posledný deň mesiaca' : 'Vypnutá';
    if(window.lucide)lucide.createIcons();
}
async function refreshDataProtection(){
    const local=getLocalDataHealth(); renderDataHealth(local,null);
    try{
      const r=await fetch(buildSyncGetUrl('data_health'),{cache:'no-store'});
      const text=await r.text();
      let remote;
      try{ remote=JSON.parse(text); }catch(_){ throw new Error(`Neplatná odpoveď servera (${r.status})`); }
      if(!r.ok) throw new Error(remote?.message||`HTTP ${r.status}`);
      renderDataHealth(local,remote);
    }catch(error){
      renderDataHealth(local,{status:'error',message:error?.message||'Cloud sa nepodarilo overiť'});
    }
}
async function createCloudBackup(btn){
    if(btn){btn.disabled=true;btn.classList.add('opacity-60');}
    showToast({type:'info',title:'Vytváram zálohu',text:'Kopírujem celú Google tabuľku.'});
    try{
      const r=await fetch(GOOGLE_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'createBackup',token:getSyncToken(),userId:typeof FLOW_USER_ID!=='undefined'?FLOW_USER_ID:'default'})});
      const text=await r.text();
      let result;
      try{ result=JSON.parse(text); }catch(_){ throw new Error(`Neplatná odpoveď servera (${r.status})`); }
      if(!r.ok || !result || result.status!=='success')throw new Error(result?.message||`HTTP ${r.status}`);
      showToast({type:'success',title:'Záloha je hotová',text:`Uložené ako ${result.name||'nová kópia'}.`});
      refreshDataProtection();
    }catch(error){
      showToast({type:'error',title:'Záloha sa nevytvorila',text:error?.message||'Nepodarilo sa spojiť so serverom.'});
    }finally{if(btn){btn.disabled=false;btn.classList.remove('opacity-60');}}
}


async function setupAutoBackup(btn){
    if(btn){btn.disabled=true;btn.classList.add('opacity-60');}
    showToast({type:'info',title:'Nastavujem automatickú zálohu',text:'Flow ju spustí v posledný deň každého mesiaca.'});
    try{
      const r=await fetch(GOOGLE_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'setupAutoBackup',token:getSyncToken()})});
      const text=await r.text(); let result;
      try{result=JSON.parse(text);}catch(_){throw new Error(`Neplatná odpoveď servera (${r.status})`);}
      if(!r.ok||!result||result.status!=='success')throw new Error(result?.message||`HTTP ${r.status}`);
      showToast({type:'success',title:'Automatická záloha je zapnutá',text:'Flow zálohuje v posledný deň mesiaca a drží najviac 5 záloh.'});
      refreshDataProtection();
    }catch(error){
      showToast({type:'error',title:'Automatická záloha sa nezapla',text:error?.message||'Skontroluj nový Google Apps Script v2.49.2.'});
    }finally{if(btn){btn.disabled=false;btn.classList.remove('opacity-60');}}
}
