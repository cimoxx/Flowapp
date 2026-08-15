function updateSyncUI(status) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;

    // UI is intentionally unchanged from previous versions.
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

function getSyncToken() {
    return typeof FLOW_API_TOKEN === 'string' ? FLOW_API_TOKEN : '';
}

function buildSyncGetUrl(action) {
    const token = encodeURIComponent(getSyncToken());
    return `${GOOGLE_URL}?get=${encodeURIComponent(action)}&token=${token}`;
}

function queueMutation(item) {
    if (!item || !item.id) return;

    const mutation = {
        ...item,
        id: String(item.id),
        action: item.action || (item.deleted ? 'delete' : 'save'),
        updatedAt: item.updatedAt || new Date().toISOString(),
        version: Math.max(1, parseInt(item.version, 10) || 1),
        userId: item.userId || FLOW_USER_ID
    };

    syncQueue = syncQueue.filter(q => String(q.id) !== mutation.id);
    syncQueue.push(mutation);
    localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
    updateSyncUI('ok');
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

let syncRetryTimer = null;
let syncRetryAttempt = 0;
const SYNC_BATCH_SIZE = 50;
const SYNC_MAX_RETRY_DELAY = 60000;

function scheduleSyncRetry() {
    if (syncRetryTimer || (syncQueue.length === 0 && !pendingCatSync)) return;

    const delay = Math.min(
        2000 * Math.pow(2, Math.max(0, syncRetryAttempt - 1)),
        SYNC_MAX_RETRY_DELAY
    );

    syncRetryTimer = setTimeout(() => {
        syncRetryTimer = null;
        manualSync();
    }, delay);
}

function manualSync() {
    syncRetryAttempt = 0;
    if (pendingCatSync) syncCategories('push');
    processSyncQueue();
    syncTransactions('pull');
}

function getQueueItemKey(item) {
    return `${String(item.id)}|${Number(item.version) || 0}|${item.updatedAt || ''}`;
}

function removeAcceptedQueueItems(items) {
    if (!Array.isArray(items) || !items.length) return;

    const acceptedKeys = new Set(items.map(getQueueItemKey));
    const before = syncQueue.length;

    syncQueue = syncQueue.filter(item => !acceptedKeys.has(getQueueItemKey(item)));

    if (syncQueue.length !== before) {
        localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
    }
}

function applyServerConflict(result) {
    const server = result && result.server;
    if (!server || !server.id) return;

    const id = String(server.id);
    const local = db.find(x => String(x.id) === id);

    if (!local) {
        if (!server.deleted) db.push(server);
        return;
    }

    const cmp = compareRecords(local, server);

    if (cmp <= 0) {
        // Server is newer or identical: accept it and remove the stale queue item.
        const index = db.findIndex(x => String(x.id) === id);
        if (server.deleted) {
            if (index > -1) db.splice(index, 1);
        } else if (index > -1) {
            db[index] = { ...db[index], ...server, deleted: false };
        } else {
            db.push(server);
        }

        syncQueue = syncQueue.filter(q => String(q.id) !== id);
        return;
    }

    // Local is newer. Bump the version so an equal-version timestamp conflict
    // cannot loop forever, then keep the newest local mutation queued.
    local.version = Math.max(
        Number(local.version) || 1,
        Number(server.version) || 1
    ) + 1;
    local.updatedAt = new Date().toISOString();
    local.action = local.deleted ? 'delete' : 'save';
    queueMutation(local);
}

async function processSyncQueue() {
    if (syncQueue.length === 0 || isSyncing) {
        updateSyncUI('ok');
        return;
    }

    isSyncing = true;
    updateSyncUI('syncing');

    try {
        while (syncQueue.length > 0) {
            const batch = syncQueue.slice(0, SYNC_BATCH_SIZE);

            const payload = {
                action: 'batchSync',
                token: getSyncToken(),
                userId: FLOW_USER_ID,
                items: batch
            };

            const res = await fetch(GOOGLE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const result = await res.json();

            if (result && result.status === 'error') {
                throw new Error(result.message || 'Server error');
            }

            if (!result || !Array.isArray(result.results)) {
                throw new Error('Neplatná odpoveď servera');
            }

            const accepted = [];
            const conflicts = [];

            result.results.forEach(r => {
                if (r.status === 'success' || r.status === 'already_current') {
                    const original = batch.find(item => String(item.id) === String(r.id));
                    if (original) accepted.push(original);
                } else if (r.status === 'conflict') {
                    conflicts.push(r);
                }
            });

            removeAcceptedQueueItems(accepted);

            conflicts.forEach(applyServerConflict);

            // Remove any batch item for which the server explicitly accepted it.
            // Conflicts remain/re-enter the queue through applyServerConflict().
            if (conflicts.length === 0 && accepted.length === 0 && batch.length > 0) {
                throw new Error('Server neprijal žiadnu položku');
            }

            localStorage.setItem('f_db_v20', JSON.stringify(db));
            localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
            updateSyncUI('syncing');

            // A conflict can requeue a single local record. Continue immediately.
            // A failed network request exits to retry logic below.
        }

        syncRetryAttempt = 0;
    } catch (e) {
        console.error('SYNC BATCH ERROR:', e);
        syncRetryAttempt++;
        scheduleSyncRetry();
    } finally {
        isSyncing = false;
        updateSyncUI('ok');
    }
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

function recordsEquivalentForSync(local, cloud) {
    if (!local || !cloud) return false;

    const localVersion = Number(local.version) || 0;
    const cloudVersion = Number(cloud.version) || 0;

    if (cloudVersion < localVersion) return false;

    const localUpdated = Date.parse(local.updatedAt || local.createdAt || 0) || 0;
    const cloudUpdated = Date.parse(cloud.updatedAt || cloud.createdAt || 0) || 0;

    if (cloudVersion === localVersion && cloudUpdated < localUpdated) return false;

    if (local.action === 'delete' || local.deleted === true) {
        return Boolean(cloud.deleted);
    }

    return !cloud.deleted;
}

function reconcileSyncQueueWithCloud(cloudData) {
    if (!Array.isArray(cloudData) || !syncQueue.length) return false;

    const cloudById = new Map(cloudData.map(c => [String(c.id), c]));
    const before = syncQueue.length;

    syncQueue = syncQueue.filter(item => {
        const cloud = cloudById.get(String(item.id));
        return !cloud || !recordsEquivalentForSync(item, cloud);
    });

    if (syncQueue.length !== before) {
        localStorage.setItem('f_sync_q_v20', JSON.stringify(syncQueue));
        return true;
    }

    return false;
}

async function syncTransactions(action = 'pull') {
    if (action !== 'pull') return;

    updateSyncUI('syncing');

    try {
        const res = await fetch(buildSyncGetUrl('transactions'));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const cloudData = await res.json();
        if (!Array.isArray(cloudData)) return;

        // Clear queue entries already accepted by the server.
        reconcileSyncQueueWithCloud(cloudData);
        updateSyncUI('syncing');

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

        localById.forEach((local, id) => {
            if (!cloudData.some(c => String(c.id) === id) && !queuedById.has(id) && !local.deleted) {
                merged.push(local);
                queueMutation({ ...local, action: 'save' });
            }
        });

        db = merged;
        saveData(false);
        if (typeof refreshYearSelectors === 'function') refreshYearSelectors();

        processRecurringPayments();
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    } catch (e) {
        console.error("Sync pull error:", e);
        syncRetryAttempt++;
        scheduleSyncRetry();
    } finally {
        updateSyncUI('ok');
    }
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
                    token: getSyncToken(),
                    categories,
                    version: Math.max(1, parseInt(localStorage.getItem('f_categories_version') || '1', 10)),
                    updatedAt: new Date().toISOString(),
                    userId: FLOW_USER_ID
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json();

            if (result && result.status === 'conflict') {
                throw new Error('Category sync conflict');
            }
            if (result && result.status === 'error') {
                throw new Error(result.message || 'Category server error');
            }

            pendingCatSync = false;
            localStorage.removeItem('f_pending_cat_sync_v20');
        } catch (e) {
            console.error('CATEGORY PUSH ERROR:', e);
            pendingCatSync = true;
            localStorage.setItem('f_pending_cat_sync_v20', 'true');
            syncRetryAttempt++;
            scheduleSyncRetry();
        }
    } else {
        try {
            const res = await fetch(buildSyncGetUrl('categories'));
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
            syncRetryAttempt++;
            scheduleSyncRetry();
        }
    }

    updateSyncUI('ok');
}

function addMonthsSafe(date, months) {
    const d = new Date(date);
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, last));
    return target;
}

function recurringOccurrenceDates(plan, fromDate, toDate) {
    const out = [];
    if (!plan || !plan.active) return out;
    const start = new Date((plan.startDate || getTodayStr()) + 'T00:00:00');
    if (isNaN(start.getTime())) return out;
    const from = new Date(fromDate); from.setHours(0,0,0,0);
    const to = new Date(toDate); to.setHours(0,0,0,0);
    let cursor = new Date(Math.max(start.getTime(), from.getTime()));
    const endPlan = plan.endDate ? new Date(plan.endDate + 'T23:59:59') : null;
    if (endPlan && cursor > endPlan) return out;

    const frequency = plan.frequency || 'monthly';
    if (frequency === 'weekly') {
        // Weekly plans use the weekday of startDate; dayOfMonth is ignored.
        const weekday = start.getDay();
        const diff = (weekday - cursor.getDay() + 7) % 7;
        cursor.setDate(cursor.getDate() + diff);
        while (cursor <= to) {
            if (cursor >= from && (!endPlan || cursor <= endPlan)) out.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 7);
        }
        return out;
    }

    const step = frequency === 'yearly' ? 12 : frequency === 'quarterly' ? 3 : 1;
    let occurrence = new Date(start);
    const desiredDay = Math.min(Number(plan.dayOfMonth) || start.getDate() || 1, 31);
    occurrence.setDate(Math.min(desiredDay, new Date(occurrence.getFullYear(), occurrence.getMonth()+1,0).getDate()));

    while (occurrence < from) occurrence = addMonthsSafe(occurrence, step);
    while (occurrence <= to) {
        if ((!endPlan || occurrence <= endPlan) && occurrence >= from) out.push(new Date(occurrence));
        occurrence = addMonthsSafe(occurrence, step);
    }
    return out;
}

function recurringOccurrenceAmount(plan) {
    return Number(plan.amount) || 0;
}

function processRecurringPayments() {
    // Generate real transaction occurrences only from today through 12 months ahead.
    // The selected transaction filter must never limit recurring generation.
    if (typeof flowRecurringPlans === 'undefined' || !Array.isArray(flowRecurringPlans) || flowRecurringPlans.length === 0) return;

    const today = new Date(); today.setHours(0,0,0,0);
    const horizon = addMonthsSafe(today, 12); horizon.setHours(23,59,59,999);
    let hasNew = false;

    flowRecurringPlans.filter(p => p.active).forEach(plan => {
        const dates = recurringOccurrenceDates(plan, today, horizon);
        dates.forEach(date => {
            const targetDateStr = getCleanDateStr(date.toISOString());
            const exists = db.some(x => !x.deleted && String(x.recurringPlanId || '') === String(plan.id) && getCleanDateStr(x.date) === targetDateStr);
            if (exists) return;

            const now = new Date().toISOString();
            const entry = {
                id:createUid('tx'), date:targetDateStr, full_date:`${targetDateStr} 08:00:00`,
                category:plan.category, categoryId:plan.categoryId || getCategoryUidByName(plan.category), sub:plan.sub || '',
                amount:recurringOccurrenceAmount(plan), type:plan.type || 'expense', note:plan.name || '', processed:false,
                isRecurring:true, frequency:plan.frequency, recurringPlanId:plan.id,
                createdAt:now, updatedAt:now, version:1, deleted:false, action:'save'
            };
            db.push(entry); queueMutation(entry); hasNew = true;
        });
    });

    if (hasNew) {
        saveData(false);
        processSyncQueue();
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    }
}

