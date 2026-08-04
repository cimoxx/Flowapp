function updateSyncUI(status) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');

    if (status === 'syncing') {
        dot.className = "w-2 h-2 bg-blue-400 animate-pulse rounded-full";
        text.innerText = "...";
    } else {
        if (syncQueue.length > 0 || pendingCatSync) {
            dot.className = "w-2 h-2 bg-amber-500 rounded-full";
            text.innerText = syncQueue.length + (pendingCatSync ? 1 : 0);
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

    if (syncCats) {
        pendingCatSync = true;
        localStorage.setItem('f_pending_cat_sync_v20', 'true');
        syncCategories('push');
    }
}

function manualSync() {
    if (pendingCatSync) syncCategories('push');
    processSyncQueue();
    syncTransactions('pull');
}

async function processSyncQueue() {
    if (syncQueue.length === 0 || isSyncing) {
        updateSyncUI('ok');
        return;
    }

    isSyncing = true;
    updateSyncUI('syncing');

    while (syncQueue.length > 0) {
        try {
            await fetch(GOOGLE_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(syncQueue[0])
            });
            syncQueue.shift();
            saveData(false);
            updateSyncUI('syncing');
        } catch (e) {
            break;
        }
    }

    isSyncing = false;
    updateSyncUI('ok');
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
                processRecurringPayments();
                renderList();
                updateAnalytics();
                updateBurnRateTab();
            }
        } catch (e) {
            console.error("Sync error:", e);
        }
        updateSyncUI('ok');
    }
}

async function syncCategories(action = 'push') {
    updateSyncUI('syncing');

    if (action === 'push') {
        try {
            await fetch(GOOGLE_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: 'sync_categories', categories: categories })
            });
            pendingCatSync = false;
            localStorage.removeItem('f_pending_cat_sync_v20');
        } catch (e) {
            pendingCatSync = true;
            localStorage.setItem('f_pending_cat_sync_v20', 'true');
        }
    } else {
        try {
            const res = await fetch(GOOGLE_URL + "?get=categories");
            const cloudData = await res.json();
            if (Array.isArray(cloudData) && cloudData.length > 0) {
                categories = cloudData;
                localStorage.setItem('f_cats_v20', JSON.stringify(categories));
                renderCatGrid();
                if (!document.getElementById('settings-screen').classList.contains('hidden') && activeSettingsCat === null) {
                    renderManageCats();
                }
            }
        } catch (e) {}
    }

    updateSyncUI('ok');
}

function processRecurringPayments() {
    const selectedYear = parseInt(document.getElementById('filter-year')?.value || new Date().getFullYear());
    const activeMonths = selectedMonths.length > 0 ? selectedMonths : [new Date().getMonth()];
    let hasNew = false;

    db.forEach(item => {
        if (item.isRecurring) {
            const origClean = getCleanDateStr(item.date);
            const origParts = origClean.split('-');
            if (origParts.length !== 3) return;

            const origDay = origParts[2];
            const freq = item.frequency || 'monthly';

            activeMonths.forEach(targetMonth => {
                let monthInterval = 1;
                if (freq === 'quarterly') monthInterval = 3;
                if (freq === 'yearly') monthInterval = 12;

                const origMonth = parseInt(origParts[1]) - 1;
                const origYear = parseInt(origParts[0]);

                const diffMonths = (selectedYear - origYear) * 12 + (targetMonth - origMonth);
                if (diffMonths > 0 && diffMonths % monthInterval === 0) {
                    const targetMonthStr = String(targetMonth + 1).padStart(2, '0');
                    const daysInMonth = new Date(selectedYear, targetMonth + 1, 0).getDate();
                    const targetDayStr = String(Math.min(parseInt(origDay), daysInMonth)).padStart(2, '0');
                    const targetDateStr = `${selectedYear}-${targetMonthStr}-${targetDayStr}`;

                    const exists = db.some(x =>
                        x.isRecurring &&
                        x.category === item.category &&
                        (x.sub || '') === (item.sub || '') &&
                        parseFloat(x.amount) === parseFloat(item.amount) &&
                        getCleanDateStr(x.date) === targetDateStr
                    );

                    if (!exists) {
                        const newId = 'ID-REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                        const newEntry = {
                            ...item,
                            id: newId,
                            date: targetDateStr,
                            full_date: `${targetDateStr} 08:00:00`,
                            processed: false,
                            action: 'save'
                        };
                        db.push(newEntry);
                        syncQueue.push(newEntry);
                        hasNew = true;
                    }
                }
            });
        }
    });

    if (hasNew) {
        saveData(false);
        processSyncQueue();
    }
}
