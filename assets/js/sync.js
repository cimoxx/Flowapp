function updateSyncUI(status) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;

    if (status === 'syncing') {
        dot.className = "w-2 h-2 bg-blue-400 animate-pulse rounded-full";
        text.innerText = "...";
    } else {
        const pending = syncQueue.length + (pendingCatSync ? 1 : 0);
        if (pending > 0) {
            dot.className = "w-2 h-2 bg-amber-500 rounded-full";
            text.innerText = pending;
        } else {
            dot.className = "w-2 h-2 bg-emerald-500 rounded-full";
            text.innerText = "OK";
        }
    }
}

function queueMutation(item) {
    if (!item || !item.id) return;
    const mutation = {
        ...item,
        id: String(item.id),
        action: item.action || 'save',
        updatedAt: item.updatedAt || new Date().toISOString(),
        version: Math.max(1, parseInt(item.version, 10) || 1)
    };

    syncQueue = syncQueue.filter(q => String(q.id) !== mutation.id);
    syncQueue.push(mutation);
    localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
}

function saveData(syncCats = false) {
    ensureDataIntegrity();
    localStorage.setItem('f_db_v20', JSON.stringify(db));
    localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
    localStorage.setItem('f_cats_v20', JSON.stringify(categories));

    if (syncCats) {
        const categoryVersion = (parseInt(localStorage.getItem('f_categories_version') || '0', 10) || 0) + 1;
        localStorage.setItem('f_categories_version', String(categoryVersion));
        pendingCatSync = true;
        localStorage.setItem('f_pending_cat_sync_v20', 'true');
        syncCategories('push');
    }

    updateSyncUI('ok');
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
        const item = syncQueue[0];

        try {
            const res = await fetch(GOOGLE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(item)
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            let result = null;
            try { result = await res.json(); } catch (_) {}
            if (result && result.status === 'conflict') {
                console.warn('SYNC CONFLICT:', result);
                // Leave the item queued; pull/merge will resolve it.
                await syncTransactions('pull');
                break;
            }
            if (result && result.status === 'error') throw new Error(result.message || 'Server error');

            syncQueue.shift();
            localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
            updateSyncUI('syncing');
        } catch (e) {
            console.error('SYNC PUSH ERROR:', e, item);
            break;
        }
    }

    isSyncing = false;
    updateSyncUI('ok');
}

function compareRecords(local, cloud) {
    const lv = Number(local?.version) || 0;
    const cv = Number(cloud?.version) || 0;
    if (lv !== cv) return lv > cv ? 1 : -1;

    const lt = Date.parse(local?.updatedAt || local?.createdAt || 0) || 0;
    const ct = Date.parse(cloud?.updatedAt || cloud?.createdAt || 0) || 0;
    if (lt !== ct) return lt > ct ? 1 : -1;

    return 0;
}

async function syncTransactions(action = 'pull') {
    if (action !== 'pull') return;

    updateSyncUI('syncing');

    try {
        const res = await fetch(GOOGLE_URL + "?get=transactions");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const cloudData = await res.json();
        if (!Array.isArray(cloudData)) return;

        const localById = new Map(db.map(x => [String(x.id), x]));
        const queuedById = new Map(syncQueue.map(q => [String(q.id), q]));
        const merged = [];

        cloudData.forEach(cloudRaw => {
            const cloud = {
                ...cloudRaw,
                id: String(cloudRaw.id),
                date: getCleanDateStr(cloudRaw.date),
                version: Math.max(1, parseInt(cloudRaw.version, 10) || 1),
                createdAt: cloudRaw.createdAt || cloudRaw.date || new Date().toISOString(),
                updatedAt: cloudRaw.updatedAt || cloudRaw.createdAt || cloudRaw.date || new Date().toISOString(),
                deleted: Boolean(cloudRaw.deleted)
            };

            const local = localById.get(cloud.id);
            const queued = queuedById.get(cloud.id);

            if (queued) {
                // Local mutation wins until the queue has been accepted by the server.
                if (local) merged.push(local);
                return;
            }

            if (local && compareRecords(local, cloud) > 0) {
                merged.push(local);
                queueMutation({ ...local, action: local.deleted ? 'delete' : 'save' });
                return;
            }

            if (!cloud.deleted) merged.push(cloud);
        });

        // Keep genuinely local records that have not reached the cloud yet.
        localById.forEach((local, id) => {
            if (!cloudData.some(c => String(c.id) === id) && !queuedById.has(id) && !local.deleted) {
                merged.push(local);
                queueMutation({ ...local, action: 'save' });
            }
        });

        db = merged;
        saveData(false);

        processRecurringPayments();
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    } catch (e) {
        console.error("Sync pull error:", e);
    }

    updateSyncUI('ok');
}

async function syncCategories(action = 'push') {
    updateSyncUI('syncing');

    if (action === 'push') {
        try {
            const res = await fetch(GOOGLE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'sync_categories',
                    categories,
                    version: Math.max(1, parseInt(localStorage.getItem('f_categories_version') || '1', 10)),
                    updatedAt: new Date().toISOString()
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json().catch(() => null);
            if (result && result.status === 'conflict') throw new Error('Category sync conflict');

            pendingCatSync = false;
            localStorage.removeItem('f_pending_cat_sync_v20');
        } catch (e) {
            console.error('CATEGORY PUSH ERROR:', e);
            pendingCatSync = true;
            localStorage.setItem('f_pending_cat_sync_v20', 'true');
        }
    } else {
        try {
            const res = await fetch(GOOGLE_URL + "?get=categories");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const cloudData = await res.json();
            if (Array.isArray(cloudData) && cloudData.length > 0) {
                categories = cloudData;
                ensureDataIntegrity();
                localStorage.setItem('f_cats_v20', JSON.stringify(categories));
                renderCatGrid();

                const settings = document.getElementById('settings-screen');
                if (settings && !settings.classList.contains('hidden') && activeSettingsCat === null) {
                    renderManageCats();
                }
            }
        } catch (e) {
            console.error('CATEGORY PULL ERROR:', e);
        }
    }

    updateSyncUI('ok');
}

function processRecurringPayments() {
    const selectedYear = parseInt(document.getElementById('filter-year')?.value || new Date().getFullYear());
    const activeMonths = selectedMonths.length > 0 ? selectedMonths : [new Date().getMonth()];
    let hasNew = false;

    db.forEach(item => {
        if (item.isRecurring && !item.deleted) {
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
                        !x.deleted &&
                        x.isRecurring &&
                        x.categoryId === item.categoryId &&
                        (x.sub || '') === (item.sub || '') &&
                        parseFloat(x.amount) === parseFloat(item.amount) &&
                        getCleanDateStr(x.date) === targetDateStr
                    );

                    if (!exists) {
                        const now = new Date().toISOString();
                        const newEntry = {
                            ...item,
                            id: createUid('tx'),
                            date: targetDateStr,
                            full_date: `${targetDateStr} 08:00:00`,
                            processed: false,
                            createdAt: now,
                            updatedAt: now,
                            version: 1,
                            deleted: false,
                            action: 'save'
                        };

                        db.push(newEntry);
                        queueMutation(newEntry);
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
