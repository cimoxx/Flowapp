function toggleStatusFilter() {
    const toggle = document.getElementById('ui-toggle');
    const optUnprocessed = document.getElementById('opt-unprocessed');
    const optAll = document.getElementById('opt-all');

    if (currentStatusFilter === 'unprocessed') {
        currentStatusFilter = 'all';
        toggle.classList.add('all-active');
        optUnprocessed.classList.remove('active');
        optAll.classList.add('active');
    } else {
        currentStatusFilter = 'unprocessed';
        toggle.classList.remove('all-active');
        optUnprocessed.classList.add('active');
        optAll.classList.remove('active');
    }

    renderList();
}

function setSearchQuery(value) {
    transactionSearchQuery = String(value || '').trim().toLowerCase();
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !transactionSearchQuery);
    renderList();
}

function clearSearch() {
    transactionSearchQuery = '';
    const input = document.getElementById('transaction-search');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    renderList();
}

function resetCategoryFilter() {
    activeCategoryFilter = null;
    window.activeSubFilter = null;
    renderList();
}

function toggleProcessed(id) {
    const item = db.find(x => String(x.id) === String(id));
    if (!item) return;

    item.processed = !item.processed;
    item.updatedAt = new Date().toISOString();
    item.version = (parseInt(item.version, 10) || 0) + 1;
    syncQueue.push({ ...item, action: 'save' });
    saveData(false);

    renderList();
    updateAnalytics();
    updateBurnRateTab();
    processSyncQueue();

    showToast({
        type: 'success',
        title: item.processed ? 'Transakcia označená ako zapísaná' : 'Transakcia vrátená medzi nové',
        text: `${item.category}${item.sub ? ' / ' + item.sub : ''}`
    });
}

function updateTotals(currentListData) {
    const total = currentListData.reduce((acc, curr) => {
        return curr.type === 'income'
            ? acc + parseFloat(curr.amount)
            : acc - parseFloat(curr.amount);
    }, 0);

    document.getElementById('display-balance').innerText = formatCurrency(total);
    updateBalanceLabel();
}

const BALANCE_MONTH_SHORT_SK = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

// Názov nad sumou hovorí, čo číslo znamená: stav filtra (Nové/Spolu), obdobie a prípadná kategória.
function updateBalanceLabel() {
    const label = document.getElementById('balance-label');
    if (!label) return;
    const year = document.getElementById('filter-year')?.value || new Date().getFullYear();
    const months = [...selectedMonths].sort((x, y) => x - y);
    let period;
    if (months.length === 0 || months.length === 12) period = `Rok ${year}`;
    else if (months.length <= 3) period = `${months.map(m => BALANCE_MONTH_SHORT_SK[m]).join(', ')} ${year}`;
    else period = `${months.length} mes. ${year}`;
    const parts = [currentStatusFilter === 'unprocessed' ? 'Nové' : 'Spolu', period];
    if (typeof activeCategoryFilter !== 'undefined' && activeCategoryFilter) parts.push(activeCategoryFilter);
    label.textContent = parts.join(' · ');
}

function setModalMeta(isEdit = false) {
    const title = document.getElementById('modal-title');
    const subtitle = document.getElementById('modal-subtitle');

    if (!title || !subtitle) return;

    if (isEdit) {
        title.innerText = 'Upraviť transakciu';
        subtitle.innerText = 'Zmeň údaje existujúcej položky a ulož aktualizovaný záznam.';
    } else {
        title.innerText = 'Nová transakcia';
        subtitle.innerText = 'Rýchle pridanie novej položky do prehľadu.';
    }
}

// Často používané kombinácie (typ + kategória + podkategória + poznámka) z posledných 30 dní.
// Pravidelné platby a historický import sa nezapočítavajú, ide o to, čo človek zadáva ručne.
const QUICK_PICK_DAYS = 30;
const QUICK_PICK_LIMIT = 6;
let quickPicks = [];

function getQuickPicks(limit = QUICK_PICK_LIMIT) {
    const since = Date.now() - QUICK_PICK_DAYS * 86400000;
    const groups = new Map();

    (Array.isArray(db) ? db : []).forEach(tx => {
        if (!tx || tx.deleted || tx.isRecurring || tx.recurringPlanId) return;
        if (/^(RPOCC_|HIST-)/i.test(String(tx.id || ''))) return;

        const when = Date.parse(getCleanDateStr(tx.date) + 'T00:00:00');
        if (!Number.isFinite(when) || when < since) return;

        const cat = categories.find(c => c.id === tx.category);
        if (!cat) return;

        const type = tx.type === 'income' ? 'income' : 'expense';
        const subName = tx.sub && Array.isArray(cat.subs) && cat.subs.includes(tx.sub) ? tx.sub : '';
        const note = String(tx.note || '').trim();
        const key = [type, cat.id, subName, note.toLowerCase()].join('|');

        const group = groups.get(key) || { type, category: cat.id, sub: subName, note, count: 0, last: 0 };
        group.count += 1;
        group.last = Math.max(group.last, when);
        groups.set(key, group);
    });

    return [...groups.values()]
        .sort((a, b) => b.count - a.count || b.last - a.last)
        .slice(0, limit);
}

function renderQuickPicks() {
    const wrap = document.getElementById('quick-picks');
    const list = document.getElementById('quick-picks-list');
    if (!wrap || !list) return;

    quickPicks = getQuickPicks();
    wrap.classList.toggle('hidden', quickPicks.length === 0);

    list.innerHTML = quickPicks.map((p, i) => {
        const where = p.sub ? `${p.category} / ${p.sub}` : p.category;
        const title = p.note || p.sub || p.category;
        const detail = p.note ? where : (p.sub ? p.category : '');
        return `<button type="button" onclick="applyQuickPick(${i})" class="quick-pick quick-pick-${p.type}">
            <span class="quick-pick-title">${p.type === 'income' ? '+ ' : ''}${escHtml(title)}</span>
            ${detail ? `<span class="quick-pick-detail">${escHtml(detail)}</span>` : ''}
        </button>`;
    }).join('');
}

function applyQuickPick(index) {
    const pick = quickPicks[index];
    if (!pick) return;

    setType(pick.type);
    selectCat(pick.category);
    if (pick.sub) selectSub(pick.sub);
    document.getElementById('f-note').value = pick.note;

    // Suma sa nikdy nepredvypĺňa: stačí ju napísať a uložiť.
    const amountInput = document.getElementById('f-amount');
    amountInput.focus();
    amountInput.select();
}

function openModal(id = null) {
    const overlay = document.getElementById('modal-overlay');
    const amountInput = document.getElementById('f-amount');
    const entryIdInput = document.getElementById('entry-id');

    overlay.classList.remove('hidden');

    if (id) {
        setModalMeta(true);

        const item = db.find(x => String(x.id) === String(id));
        if (!item) return;

        entryIdInput.value = item.id;
        amountInput.value = item.amount;
        document.getElementById('f-note').value = item.note || '';
        document.getElementById('f-date').value = getCleanDateStr(item.date) || getTodayStr();

        setType(item.type || 'expense');

        document.getElementById('f-recurring').checked = !!item.isRecurring;
        document.getElementById('f-frequency').value = item.frequency || 'monthly';
        toggleRecurringOptions();

        renderCatGrid();
        selectCat(item.category);
        if (item.sub) selectSub(item.sub);

        document.getElementById('del-btn').classList.remove('hidden');
        document.getElementById('quick-picks')?.classList.add('hidden');
    } else {
        setModalMeta(false);

        document.getElementById('entry-form').reset();
        entryIdInput.value = '';
        document.getElementById('f-date').value = getTodayStr();

        document.getElementById('f-recurring').checked = false;
        document.getElementById('f-frequency').value = 'monthly';
        toggleRecurringOptions();

        setType(localStorage.getItem('f_last_type_v20') || 'expense');
        renderCatGrid();

        const lastCat = localStorage.getItem('f_last_cat');
        const lastSub = localStorage.getItem('f_last_sub');
        const catToSelect = lastCat || (categories[0]?.id || '');

        if (catToSelect) {
            selectCat(catToSelect);

            if (lastSub) {
                const cat = categories.find(c => c.id === catToSelect);
                if (cat?.subs?.includes(lastSub)) {
                    selectSub(lastSub);
                }
            }
        }

        document.getElementById('del-btn').classList.add('hidden');
        renderQuickPicks();
    }

    setTimeout(() => {
        amountInput.focus();
        amountInput.select();
    }, 250);
}

function handleSave(e) {
    e.preventDefault();

    const existingId = document.getElementById('entry-id').value;
    const id = existingId || ('ID-' + Date.now());

    const dateVal = document.getElementById('f-date').value;
    const cleanDate = getCleanDateStr(dateVal);
    const fullDateWithTime = buildDateWithCurrentTime(dateVal);

    let currentProcessed = false;
    const localRecord = db.find(x => String(x.id) === String(id));
    if (localRecord) currentProcessed = localRecord.processed;

    const isRecurring = document.getElementById('f-recurring').checked;
    const frequency = isRecurring ? document.getElementById('f-frequency').value : null;

    const now = new Date().toISOString();
    const previous = localRecord || {};
    const entry = {
        id,
        date: cleanDate,
        full_date: fullDateWithTime,
        category: selectedCat,
        categoryId: getCategoryUidByName(selectedCat),
        sub: selectedSub,
        amount: parseFloat(document.getElementById('f-amount').value),
        type: curType,
        note: document.getElementById('f-note').value,
        processed: currentProcessed,
        isRecurring,
        frequency,
        createdAt: previous.createdAt || now,
        updatedAt: now,
        version: Math.max(1, (parseInt(previous.version, 10) || 0) + 1),
        deleted: false,
        action: 'save'
    };

    if (selectedCat) localStorage.setItem('f_last_cat', selectedCat);
    if (selectedSub) localStorage.setItem('f_last_sub', selectedSub);
    localStorage.setItem('f_last_type_v20', curType);

    const idx = db.findIndex(x => String(x.id) === String(id));
    if (idx > -1) db[idx] = entry;
    else db.push(entry);

    syncQueue.push(entry);
    saveData(false);
    closeModal();
    processRecurringPayments();
    renderList();
    updateAnalytics();
    updateBurnRateTab();
    processSyncQueue();

    showToast({
        type: 'success',
        title: existingId ? 'Transakcia upravená' : 'Transakcia uložená',
        text: `${entry.category}${entry.sub ? ' / ' + entry.sub : ''} · ${parseFloat(entry.amount).toFixed(2)} €`
    });
}

function handleDelete(idToDelete = null) {
    const id = idToDelete || document.getElementById('entry-id').value;
    if (!id || !confirm('Zmazať transakciu?')) return;

    const deletedItem = db.find(x => String(x.id) === String(id));
    if (!deletedItem) return;

    lastDeletedEntry = { ...deletedItem };
    lastDeletedSyncSnapshot = [...syncQueue];

    const deleteRecord = {
        ...deletedItem,
        action: 'delete',
        deleted: true,
        updatedAt: new Date().toISOString(),
        version: (parseInt(deletedItem.version, 10) || 0) + 1
    };
    syncQueue = syncQueue.filter(q => String(q.id) !== String(id));
    syncQueue.push(deleteRecord);
    db = db.filter(x => String(x.id) !== String(id));

    saveData(false);
    closeModal();
    renderList();
    updateAnalytics();
    updateBurnRateTab();
    processSyncQueue();

    showToast({
        type: 'warning',
        title: 'Transakcia zmazaná',
        text: `${deletedItem.category}${deletedItem.sub ? ' / ' + deletedItem.sub : ''}`,
        duration: 5000,
        action: {
            label: 'Späť',
            onClick: undoDelete
        }
    });
}

function undoDelete() {
    if (!lastDeletedEntry) return;

    const restored = {
        ...lastDeletedEntry,
        deleted: false,
        updatedAt: new Date().toISOString(),
        version: (parseInt(lastDeletedEntry.version, 10) || 0) + 1,
        action: 'save'
    };
    db.push(restored);
    syncQueue = [...lastDeletedSyncSnapshot.filter(q => String(q.id) !== String(restored.id)), restored];

    saveData(false);
    renderList();
    updateAnalytics();
    updateBurnRateTab();
    processSyncQueue();

    showToast({
        type: 'success',
        title: 'Transakcia obnovená',
        text: `${lastDeletedEntry.category}${lastDeletedEntry.sub ? ' / ' + lastDeletedEntry.sub : ''}`
    });

    lastDeletedEntry = null;
    lastDeletedSyncSnapshot = null;
}

function handleSwipeStart(e, id) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isSwiping = false;

    const el = document.getElementById(`item-${id}`);
    if (el) el.classList.add('swiping');
}

function handleSwipeMove(e, id) {
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;

    if (!isSwiping && Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
        const el = document.getElementById(`item-${id}`);
        if (el) {
            el.style.transform = 'translateX(0px)';
            el.classList.remove('swiping');
        }
        return;
    }

    if (Math.abs(diffX) > 10) isSwiping = true;

    if (isSwiping) {
        const el = document.getElementById(`item-${id}`);
        const bg = document.getElementById(`bg-${id}`);
        if (!el || !bg) return;

        const translateX = Math.max(-120, Math.min(120, diffX));
        el.style.transform = `translateX(${translateX}px)`;
        bg.style.opacity = Math.min(1, Math.abs(translateX) / 40);
        bg.className = translateX > 0 ? 'swipe-bg bg-emerald-500' : 'swipe-bg bg-rose-500';
    }
}

function handleSwipeEnd(e, id) {
    const el = document.getElementById(`item-${id}`);
    const bg = document.getElementById(`bg-${id}`);
    if (!el) return;

    el.classList.remove('swiping');

    const style = window.getComputedStyle(el);
    const matrix = new WebKitCSSMatrix(style.transform);
    const translateX = matrix.m41;

    if (translateX > 80) {
        hideSwipeHintForever();
        toggleProcessed(id);
    } else if (translateX < -80) {
        hideSwipeHintForever();
        handleDelete(id);
    }

    el.style.transform = 'translateX(0px)';
    if (bg) bg.style.opacity = '0';

    const touch = e.changedTouches?.[0];
    let totalDist = 0;

    if (touch) {
        const totalDiffX = touch.clientX - touchStartX;
        const totalDiffY = touch.clientY - touchStartY;
        totalDist = Math.sqrt(totalDiffX * totalDiffX + totalDiffY * totalDiffY);
    }

    if (!isSwiping && Math.abs(translateX) < 5 && totalDist < 8) {
        openModal(id);
    }

    isSwiping = false;
}

function toggleMonthSelect(monthIdx) {
    if (selectedMonths.includes(monthIdx)) {
        selectedMonths = selectedMonths.filter(m => m !== monthIdx);
    } else {
        selectedMonths.push(monthIdx);
    }

    renderMonthChips();
    processRecurringPayments();
    renderList();
    updateAnalytics();
    updateBurnRateTab();
    scrollToActiveMonth(monthIdx);
}

function renderMonthChips() {
    const container = document.getElementById('filter-months-container');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

    container.innerHTML = months.map((m, i) => {
        const isActive = selectedMonths.includes(i);
        return `<button type="button" id="m-chip-${i}" onclick="toggleMonthSelect(${i})" class="month-chip ${isActive ? 'active' : ''}">${m}</button>`;
    }).join('');

    if (selectedMonths.length > 0) scrollToActiveMonth(selectedMonths[0]);
}

function scrollToActiveMonth(monthIdx) {
    setTimeout(() => {
        const activeChip = document.getElementById(`m-chip-${monthIdx}`);
        if (activeChip) {
            activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, 50);
}

function getFilteredData() {
    const yearEl = document.getElementById('filter-year');
    const selYear = parseInt(yearEl?.value || new Date().getFullYear(), 10);

    return db.filter(d => {
        const cleanDate = getCleanDateStr(d.date);
        const parts = cleanDate.split('-');
        if (parts.length !== 3) return false;

        const itemYear = parseInt(parts[0], 10);
        const itemMonth = parseInt(parts[1], 10) - 1;
        const monthMatches = selectedMonths.length === 0 || selectedMonths.includes(itemMonth);

        return monthMatches && itemYear === selYear;
    });
}

function matchesSearch(item) {
    if (!transactionSearchQuery) return true;

    const haystack = [
        item.category || '',
        item.sub || '',
        item.note || '',
        String(item.amount || '')
    ].join(' ').toLowerCase();

    return haystack.includes(transactionSearchQuery);
}

function renderSummary(sums, currentFiltered) {
    const container = document.getElementById('category-summary');
    if (!container) return;

    // Rýchly filter patrí výhradne do obrazovky Transakcie.
    const homeScreen = document.getElementById('screen-home');
    if (!homeScreen || homeScreen.classList.contains('hidden')) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // 1) Bez vybratej kategórie: zobraz iba kategórie.
    if (activeCategoryFilter === null) {
        const sortedCategories = Object.keys(sums).sort((a, b) => sums[b] - sums[a]);
        if (sortedCategories.length > 0) {
            html += '<div class="flex gap-1.5 overflow-x-auto no-scrollbar py-1">';
            sortedCategories.forEach(category => {
                html += `
                    <button type="button" onclick="toggleFilter(${jsArg(category)})" class="summary-card p-2.5 cursor-pointer flex flex-col justify-between shrink-0 text-left">
                        <span class="text-[9px] font-black uppercase text-slate-400 truncate">${escHtml(category)}</span>
                        <span class="text-[13px] font-extrabold mt-1">${sums[category].toFixed(2)} €</span>
                    </button>
                `;
            });
            html += '</div>';
        }
    } else {
        // 2) Po výbere kategórie zobraz iba jej podkategórie.
        const subSums = {};
        currentFiltered.forEach(item => {
            if (item.type === 'expense' && item.category === activeCategoryFilter) {
                const subName = item.sub || 'Nezaradené';
                subSums[subName] = (subSums[subName] || 0) + Number(item.amount || 0);
            }
        });

        const sortedSubs = Object.keys(subSums).sort((a, b) => subSums[b] - subSums[a]);
        if (sortedSubs.length > 0) {
            html += '<div class="flex gap-1.5 overflow-x-auto no-scrollbar py-1">';
            sortedSubs.forEach(sub => {
                const isActive = window.activeSubFilter === sub;
                html += `
                    <button type="button" onclick="toggleSubFilter(${jsArg(sub)})" class="summary-card ${isActive ? 'active-filter' : ''} p-2.5 cursor-pointer flex flex-col justify-between shrink-0 text-left">
                        <span class="text-[9px] font-black uppercase text-amber-500/80 truncate">${escHtml(sub)}</span>
                        <span class="text-[13px] font-extrabold mt-1">${subSums[sub].toFixed(2)} €</span>
                    </button>
                `;
            });
            html += '</div>';
        }
    }

    container.innerHTML = html;
}

function toggleFilter(cat) {
    if (activeCategoryFilter === cat) {
        activeCategoryFilter = null;
        window.activeSubFilter = null;
    } else {
        activeCategoryFilter = cat;
        window.activeSubFilter = null;
    }
    renderList();
}

function toggleSubFilter(sub) {
    if (!activeCategoryFilter) return;
    if (window.activeSubFilter === sub) {
        window.activeSubFilter = null;
    } else {
        window.activeSubFilter = sub;
    }
    renderList();
}

function renderActiveFilterSummary() {
    const el = document.getElementById('active-filter-summary');
    if (!el) return;

    /* sumár filtrov nechceme zobrazovať */
    el.classList.add('hidden');
    el.innerHTML = '';
}

function renderSwipeHint() {
    const el = document.getElementById('swipe-hint');
    if (!el) return;

    if (hasShownSwipeHint) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
    }

    el.classList.remove('hidden');
    el.innerHTML = `
        <div class="swipe-hint-card">
            <div class="hint-icon">
                <i data-lucide="move-horizontal" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="hint-title">Rýchle gestá</div>
                <div class="hint-text">Potiahni položku doprava pre zapísanie alebo doľava pre vymazanie.</div>
            </div>
            <button type="button" class="hint-close" onclick="hideSwipeHintForever()">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
    `;
    lucide.createIcons();
}

function hideSwipeHintForever() {
    hasShownSwipeHint = true;
    localStorage.setItem('f_swipe_hint_seen_v20', 'true');
    const el = document.getElementById('swipe-hint');
    if (!el) return;
    el.classList.add('hidden');
    el.innerHTML = '';
}

function renderList() {
    const list = document.getElementById('transaction-list');
    let currentFiltered = getFilteredData();

    if (currentStatusFilter === 'unprocessed') {
        currentFiltered = currentFiltered.filter(d => !d.processed);
    }

    currentFiltered = currentFiltered.filter(matchesSearch);

    const sums = {};
    currentFiltered.forEach(item => {
        if (item.type === 'expense') {
            if (!sums[item.category]) sums[item.category] = 0;
            sums[item.category] += item.amount;
        }
    });

    renderSummary(sums, currentFiltered);
    renderActiveFilterSummary();

    if (activeCategoryFilter) {
        currentFiltered = currentFiltered.filter(d => d.category === activeCategoryFilter);
        if (window.activeSubFilter) {
            currentFiltered = currentFiltered.filter(d => (d.sub || 'Nezaradené') === window.activeSubFilter);
        }
    }

    updateTotals(currentFiltered);
    document.getElementById('clear-cat-filter').classList.toggle('hidden', !(activeCategoryFilter || window.activeSubFilter));

    const sortedItems = [...currentFiltered].sort((a, b) => {
        const dateA = getCleanDateStr(a.date);
        const dateB = getCleanDateStr(b.date);
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(b.id).localeCompare(String(a.id));
    });

    const grouped = {};
    sortedItems.forEach(item => {
        const dayKey = getCleanDateStr(item.date) || 'Neznámy dátum';
        if (!grouped[dayKey]) grouped[dayKey] = [];
        grouped[dayKey].push(item);
    });

    if (Object.keys(grouped).length === 0) {
        const isSearching = !!transactionSearchQuery;
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i data-lucide="${isSearching ? 'search-x' : 'receipt-text'}" class="w-6 h-6"></i>
                </div>
                <div class="empty-state-title">${isSearching ? 'Nič sa nenašlo' : 'Žiadne transakcie'}</div>
                <div class="empty-state-text">
                    ${isSearching
                        ? 'Skús zmeniť hľadaný výraz alebo upraviť aktívne filtre. Pre aktuálny dopyt sa nenašli žiadne záznamy.'
                        : 'Pre aktuálny výber filtrov zatiaľ nemáš žiadne položky. Skús zmeniť mesiac, status alebo pridať novú transakciu.'}
                </div>
                <button type="button" onclick="${isSearching ? 'clearSearch()' : 'openModal()'}" class="empty-state-action">
                    <i data-lucide="${isSearching ? 'rotate-ccw' : 'plus'}" class="w-4 h-4"></i>
                    ${isSearching ? 'Vyčistiť hľadanie' : 'Pridať transakciu'}
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '';

    Object.keys(grouped).forEach(dayKey => {
        const dayItems = grouped[dayKey];
        const daySum = dayItems.reduce((acc, curr) => {
            return curr.type === 'income'
                ? acc + parseFloat(curr.amount)
                : acc - parseFloat(curr.amount);
        }, 0);

        html += `
            <div class="day-group mb-4">
                <div class="flex justify-between items-center px-2 py-1.5 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <span>${formatDayLabel(dayKey)}</span>
                    <span class="${daySum >= 0 ? 'text-emerald-500' : 'text-slate-400'}">${daySum >= 0 ? '+' : ''}${daySum.toFixed(2)} €</span>
                </div>
                <div class="space-y-1.5">
                    ${dayItems.map(item => `
                        <div class="swipe-wrapper" id="wrapper-${escHtml(item.id)}">
                            <div class="swipe-bg" id="bg-${escHtml(item.id)}">
                                <span class="left-action flex items-center gap-1.5"><i data-lucide="check" class="w-4 h-4"></i> <span>Zapísaná</span></span>
                                <span class="right-action flex items-center gap-1.5"><span>Vymazať</span> <i data-lucide="trash-2" class="w-4 h-4"></i></span>
                            </div>

                            <div class="swipe-content tx-row tx-${item.type} p-3.5 flex items-center justify-between ${item.processed ? 'processed' : ''}"
                                 id="item-${escHtml(item.id)}"
                                 ontouchstart="handleSwipeStart(event, ${jsArg(item.id)})"
                                 ontouchmove="handleSwipeMove(event, ${jsArg(item.id)})"
                                 ontouchend="handleSwipeEnd(event, ${jsArg(item.id)})">

                                <div class="tx-main flex-1 min-w-0">
                                    <div class="tx-title">
                                        ${item.isRecurring ? '<i data-lucide="repeat" class="w-3.5 h-3.5 text-emerald-500 inline shrink-0"></i>' : ''}
                                        <span class="truncate">${escHtml(item.category)}</span>
                                        ${item.sub ? `<span class="tx-subsep">/</span><span class="truncate text-safe-dim">${escHtml(item.sub)}</span>` : ''}
                                    </div>
                                    <div class="tx-note">${item.note ? escHtml(item.note) : '&nbsp;'}</div>
                                </div>

                                <div class="tx-meta">
                                    <span class="tx-amount ${item.type === 'income' ? 'income' : 'expense'}">${item.type === 'income' ? '+' : '-'}${parseFloat(item.amount).toFixed(2)} €</span>
                                    <div onclick="event.stopPropagation(); toggleProcessed(${jsArg(item.id)})" class="tx-check ${item.processed ? 'done' : 'pending'}">
                                        <i data-lucide="check" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
    lucide.createIcons();
}
