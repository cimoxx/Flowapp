let db = JSON.parse(localStorage.getItem('f_db_v20')) || [];
let syncQueue = JSON.parse(localStorage.getItem('f_sync_q_v20')) || [];
let categories = JSON.parse(localStorage.getItem('f_cats_v20')) || [];
let chartPresets = JSON.parse(localStorage.getItem('f_chart_presets_v20')) || [];
let curUser = localStorage.getItem('f_last_user') || 'Lukáš';

let isSyncing = false;

function updateSyncUI(status) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (status === 'syncing') { 
        dot.className = "w-2 h-2 bg-blue-400 animate-pulse rounded-full"; 
        text.innerText = "..."; 
    } else { 
        if (syncQueue.length > 0) { 
            dot.className = "w-2 h-2 bg-amber-500 rounded-full"; 
            text.innerText = syncQueue.length; 
        } else { 
            dot.className = "w-2 h-2 bg-emerald-500 rounded-full"; 
            text.innerText = "OK"; 
        } 
    }
}

function saveData(syncCats = false) {
    localStorage.setItem('f_db_v20', JSON.stringify(db));
    localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
    localStorage.setItem('f_cats_v20', JSON.stringify(categories));
    if (syncCats) syncCategories('push');
}

function manualSync() {
    processSyncQueue();
    syncTransactions('pull');
}

async function processSyncQueue() { 
    if (syncQueue.length === 0 || isSyncing) { updateSyncUI('ok'); return; } 
    isSyncing = true; updateSyncUI('syncing'); 
    while (syncQueue.length > 0) { 
        try { 
            await fetch(GOOGLE_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(syncQueue[0]) }); 
            syncQueue.shift(); 
            saveData(false); 
            updateSyncUI('syncing'); 
        } catch (e) { break; } 
    } 
    isSyncing = false; updateSyncUI('ok'); 
}

async function syncTransactions(action = 'pull') {
    if (action === 'pull') {
        updateSyncUI('syncing');
        try { 
            const res = await fetch(GOOGLE_URL + "?get=transactions"); 
            const cloudData = await res.json(); 
            if (Array.isArray(cloudData)) { 
                const queuedIds = syncQueue.map(q => String(q.id));
                db = cloudData.map(c => {
                    const local = db.find(l => String(l.id) === String(c.id));
                    if (queuedIds.includes(String(c.id)) && local) return local;
                    return { ...c, date: getCleanDateStr(c.date) };
                });
                localStorage.setItem('f_db_v20', JSON.stringify(db)); 
                renderList(); 
                updateAnalytics();
                updateBurnRateTab();
            } 
        } catch (e) { console.error("Sync error:", e); }
        updateSyncUI('ok');
    }
}

async function syncCategories(action = 'push') {
    updateSyncUI('syncing');
    if (action === 'push') { 
        try { 
            await fetch(GOOGLE_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'sync_categories', categories: categories }) }); 
        } catch (e) { } 
    } else { 
        try { 
            const res = await fetch(GOOGLE_URL + "?get=categories"); 
            const cloudData = await res.json(); 
            if(Array.isArray(cloudData)) { 
                categories = cloudData; 
                localStorage.setItem('f_cats_v20', JSON.stringify(categories)); 
                renderCatGrid(); 
                if(!document.getElementById('settings-screen').classList.contains('hidden') && activeSettingsCat === null) renderManageCats(); 
            } 
        } catch (e) { } 
    }
    updateSyncUI('ok');
}
