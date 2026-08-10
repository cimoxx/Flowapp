function updateSyncUI(status) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');

    if (!dot || !text) return;

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

    updateSyncUI('ok');
}

function manualSync() {
    if (pendingCatSync) syncCategories('push');
    processSyncQueue();
    syncTransactions('pull');
}

function enqueueTransactionMutation(item) {
    if (!item || !item.id) return;
    const key = String(item.id);
    const normalized = item.action === 'delete'
        ? { ...item, id: key, transactionId: String(item.transactionId || key), version: Math.max(1, Number(item.version) || 1) }
        : { ...item, id: key, transactionId: String(item.transactionId || key), version: Math.max(1, Number(item.version) || 1) };

    syncQueue = syncQueue.filter(q => String(q?.id || '') !== key);
    syncQueue.push(normalized);
    localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
    updateSyncUI('ok');
}

function getMutationTimestamp(item) {
    const t = Date.parse(item?.updatedAt || item?.deletedAt || '');
    return Number.isFinite(t) ? t : 0;
}

function isCloudNewer(cloud, local) {
    if (!local) return true;
    const cloudVersion = Number(cloud?.version) || 0;
    const localVersion = Number(local?.version) || 0;
    if (cloudVersion !== localVersion) return cloudVersion > localVersion;
    return getMutationTimestamp(cloud) >= getMutationTimestamp(local);
}

function mergeCloudTransactions(cloudData) {
    const cloud = Array.isArray(cloudData) ? cloudData : [];
    const localById = new Map(db.map(item => [String(item.id), item]));
    const queuedById = new Map(syncQueue.map(item => [String(item.id), item]));
    const merged = new Map();

    cloud.forEach(raw => {
        const normalized = normalizeTransactionRecord(raw, 0, categories);
        const key = String(normalized.id);
        const local = localById.get(key);
        const queued = queuedById.get(key);

        // A queued delete must not be resurrected by an older cloud snapshot.
        if (queued?.action === 'delete') return;

        // A queued local mutation always wins until it has been acknowledged.
        if (queued && local) {
            merged.set(key, local);
            return;
        }
        if (queued && !local) {
            merged.set(key, normalizeTransactionRecord(queued, 0, categories));
            return;
        }
        merged.set(key, isCloudNewer(normalized, local) ? normalized : local);
    });

    // Local records absent from the cloud are kept only while their mutation
    // is still queued. Once acknowledged, the cloud is authoritative.
    localById.forEach((local, key) => {
        if (merged.has(key)) return;
        const queued = queuedById.get(key);
        if (queued && queued.action !== 'delete') merged.set(key, local);
    });

    db = Array.from(merged.values()).map(item => normalizeTransactionRecord(item, 0, categories));
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
            console.log('SYNC PUSH START:', item);

            const res = await fetch(GOOGLE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(item)
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            console.log('SYNC PUSH OK:', item.id, 'v', item.version);
            syncQueue.shift();
            saveData(false);
            updateSyncUI('syncing');
        } catch (e) {
            console.error('SYNC PUSH ERROR:', e, item);
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

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const cloudData = await res.json();

            if (Array.isArray(cloudData)) {
                mergeCloudTransactions(cloudData);
                ensureDataIntegrity();
                localStorage.setItem('f_db_v20', JSON.stringify(db));

                processRecurringPayments();
                renderList();
                updateAnalytics();
                updateBurnRateTab();
            }
        } catch (e) {
            console.error("Sync pull error:", e);
        }

        updateSyncUI('ok');
    }
}

function mergeCloudCategories(cloudData) {
    if (!Array.isArray(cloudData)) return;

    const localByUid = new Map(categories.map(c => [String(c.uid), c]));
    const localByName = new Map(categories.map(c => [String(c.id), c]));
    const result = [];
    const seen = new Set();

    cloudData.forEach((raw, index) => {
        const rawUid = raw && typeof raw === 'object' ? String(raw.uid || raw.categoryId || '') : '';
        const localMatch = rawUid ? localByUid.get(rawUid) : localByName.get(String(raw?.id || ''));
        const candidate = normalizeCategoryRecord(
            localMatch && !rawUid ? { ...raw, uid: localMatch.uid, createdAt: localMatch.createdAt } : raw,
            index
        );
        const local = localByUid.get(candidate.uid) || localMatch;
        const chosen = local && !isCloudNewer(candidate, local) ? local : candidate;
        if (!seen.has(chosen.uid)) {
            result.push(chosen);
            seen.add(chosen.uid);
        }
    });

    // Preserve locally created/edited categories that are newer than the cloud snapshot.
    categories.forEach(local => {
        if (!seen.has(local.uid) && getMutationTimestamp(local) > 0) {
            result.push(local);
            seen.add(local.uid);
        }
    });

    categories = result;
}

async function syncCategories(action = 'push') {
    updateSyncUI('syncing');

    if (action === 'push') {
        try {
            const res = await fetch(GOOGLE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({
                    action: 'sync_categories',
                    categories: categories
                })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

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

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const cloudData = await res.json();

            if (Array.isArray(cloudData) && cloudData.length > 0) {
                mergeCloudCategories(cloudData);
                ensureDataIntegrity();
                localStorage.setItem('f_cats_v20', JSON.stringify(categories));

                renderCatGrid();

                if (!document.getElementById('settings-screen').classList.contains('hidden') && activeSettingsCat === null) {
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

                        touchTransaction(newEntry, true);
                        db.push(newEntry);
                        enqueueTransactionMutation(newEntry);
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
