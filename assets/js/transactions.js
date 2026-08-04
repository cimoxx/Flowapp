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

function resetCategoryFilter() {
    activeCategoryFilter = null;
    window.activeSubFilter = null;
    renderList();
}

function toggleProcessed(id) {
    const item = db.find(x => String(x.id) === String(id));
    if (item) {
        item.processed = !item.processed;
        syncQueue.push({ ...item, action: 'save' });
        saveData(false);
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue();
    }
}

function updateTotals(currentListData) {
    const total = currentListData.reduce((acc, curr) => curr.type === 'income' ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount), 0);
    document.getElementById('display-balance').innerText = total.toFixed(2) + ' €';
}

function openModal(id = null) {
    const overlay = document.getElementById('modal-overlay');
    const amountInput = document.getElementById('f-amount');
    const entryIdInput = document.getElementById('entry-id');

    overlay.classList.remove('hidden');

    if (id) {
        const i = db.find(x => String(x.id) === String(id));
        if (!i) return;

        entryIdInput.value = i.id;
        amountInput.value = i.amount;
        document.getElementById('f-note').value = i.note || '';

        const cleanD = getCleanDateStr(i.date);
        document.getElementById('f-date').value = cleanD || getTodayStr();

        setUser(i.user || 'Lukáš');
        setType(i.type || 'expense');

        const isRecurring = !!i.isRecurring;
        document.getElementById('f-recurring').checked = isRecurring;
        document.getElementById('f-frequency').value = i.frequency || 'monthly';
        toggleRecurringOptions();

        renderCatGrid();
        selectCat(i.category);
        if (i.sub) selectSub(i.sub);

        document.getElementById('del-btn').classList.remove('hidden');
    } else {
        document.getElementById('entry-form').reset();
        entryIdInput.value = "";
        document.getElementById('f-date').value = getTodayStr();
        document.getElementById('f-recurring').checked = false;
        document.getElementById('f-frequency').value = 'monthly';
        toggleRecurringOptions();

        setUser(localStorage.getItem('f_last_user') || 'Lukáš');
        setType('expense');

        renderCatGrid();

        const lastCat = localStorage.getItem('f_last_cat');
        const lastSub = localStorage.getItem('f_last_sub');
        let catToSelect = lastCat || (categories[0]?.id || '');

        selectCat(catToSelect);

        if (lastSub) {
            const cat = categories.find(c => c.id === catToSelect);
            if (cat && cat.subs && cat.subs.includes(lastSub)) {
                selectSub(lastSub);
            }
        }
        document.getElementById('del-btn').classList.add('hidden');
    }

    setTimeout(() => {
        amountInput.focus();
        amountInput.select();
    }, 300);
}

function handleSave(e) {
    e.preventDefault();

    let existingId = document.getElementById('entry-id').value;
    let id = existingId || 'ID-' + Date.now();

    const cleanDate = getCleanDateStr(document.getElementById('f-date').value);
    const fullDateWithTime = buildDateWithCurrentTime(document.getElementById('f-date').value);

    let currentProcessed = false;
    const localRecord = db.find(x => String(x.id) === String(id));
    if (localRecord) currentProcessed = localRecord.processed;

    const isRecurring = document.getElementById('f-recurring').checked;
    const frequency = isRecurring ? document.getElementById('f-frequency').value : null;

    const entry = {
        id: id,
        date: cleanDate,
        full_date: fullDateWithTime,
        category: selectedCat,
        sub: selectedSub,
        amount: parseFloat(document.getElementById('f-amount').value),
        type: curType,
        note: document.getElementById('f-note').value,
        processed: currentProcessed,
        user: curUser,
        isRecurring: isRecurring,
        frequency: frequency,
        action: 'save'
    };

    if (selectedCat) localStorage.setItem('f_last_cat', selectedCat);
    if (selectedSub) localStorage.setItem('f_last_sub', selectedSub);

    const idx = db.findIndex(x => String(x.id) === String(id));
    if (idx > -1) {
        db[idx] = entry;
    } else {
        db.push(entry);
    }

    syncQueue.push(entry);
    saveData(false);
    closeModal();
    processRecurringPayments();
    renderList();
    updateAnalytics();
    updateBurnRateTab();
    processSyncQueue();
}

function handleDelete(idToDelete = null) {
    const id = idToDelete || document.getElementById('entry-id').value;
    if (id && confirm('Zmazať transakciu?')) {
        syncQueue.push({ id: id, action: 'delete' });
        db = db.filter(x => String(x.id) !== String(id));
        saveData(false);
        closeModal();
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue();
    }
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

        if (translateX > 0) {
            bg.className = "swipe-bg bg-emerald-500";
        } else {
            bg.className = "swipe-bg bg-rose-500";
        }
    }
}

function handleSwipeEnd(e, id, processed) {
    const el = document.getElementById(`item-${id}`);
    const bg = document.getElementById(`bg-${id}`);
    if (!el) return;

    el.classList.remove('swiping');

    const style = window.getComputedStyle(el);
    const matrix = new WebKitCSSMatrix(style.transform);
    const translateX = matrix.m41;

    if (translateX > 80) {
        toggleProcessed(id);
    } else if (translateX < -80) {
        handleDelete(id);
    }

    el.style.transform = 'translateX(0px)';
    if (bg) bg.style.opacity = '0';

    const touch = e.changedTouches ? e.changedTouches[0] : null;
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
    const months = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec'];

    container.innerHTML = months.map((m, i) => {
        const isActive = selectedMonths.includes(i);
        return `<button type="button" id="m-chip-${i}" onclick="toggleMonthSelect(${i})" class="month-chip ${isActive ? 'active' : ''}">${m}</button>`;
    }).join('');

    if (selectedMonths.length > 0) {
        scrollToActiveMonth(selectedMonths[0]);
    }
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
    const selYear = parseInt(document.getElementById('filter-year').value);
    return db.filter(d => {
        const cleanDate = getCleanDateStr(d.date);
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            const itemYear = parseInt(parts[0]);
            const itemMonth = parseInt(parts[1]) - 1;
            const monthMatches = selectedMonths.length === 0 || selectedMonths.includes(itemMonth);
            return monthMatches && itemYear === selYear;
        }
        return false;
    });
}

function renderSummary(sums, currentFiltered) {
    const container = document.getElementById('category-summary');
    if (!container) return;

    const sortedKeys = Object.keys(sums).sort((a, b) => sums[b] - sums[a]);

    if (sortedKeys.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="flex gap-1.5 overflow-x-auto no-scrollbar py-1">';
    sortedKeys.forEach(k => {
        if (activeCategoryFilter === null) {
            const isActive = activeCategoryFilter === k;
            html += `
                <div onclick="toggleFilter('${k}')" class="summary-card ${isActive ? 'active-filter' : ''} p-2 cursor-pointer flex flex-col justify-between shrink-0">
                    <span class="text-[8px] font-black uppercase text-slate-400 truncate">${k}</span>
                    <span class="text-xs font-extrabold">${sums[k].toFixed(2)} €</span>
                </div>
            `;
        } else {
            const isActive = window.activeSubFilter === k;
            html += `
                <div onclick="toggleSubFilter('${k}')" class="summary-card ${isActive ? 'active-filter' : ''} p-2 cursor-pointer flex flex-col justify-between shrink-0">
                    <span class="text-[8px] font-black uppercase text-slate-400 truncate">${k}</span>
                    <span class="text-xs font-extrabold">${sums[k].toFixed(2)} €</span>
                </div>
            `;
        }
    });
    html += '</div>';

    if (activeCategoryFilter !== null) {
        const subSums = {};
        currentFiltered.forEach(item => {
            if (item.type === 'expense' && item.category === activeCategoryFilter) {
                const subName = item.sub ? item.sub : 'Nezaradené';
                if (!subSums[subName]) subSums[subName] = 0;
                subSums[subName] += item.amount;
            }
        });

        const sortedSubs = Object.keys(subSums).sort((a, b) => subSums[b] - subSums[a]);
        if (sortedSubs.length > 0) {
            html += '<div class="flex gap-1.5 overflow-x-auto no-scrollbar py-1 mt-1 border-t border-slate-100 dark:border-slate-800/60 pt-2">';
            sortedSubs.forEach(s => {
                const isSubActive = window.activeSubFilter === s;
                html += `
                    <div onclick="toggleSubFilter('${s}')" class="summary-card ${isSubActive ? 'active-filter' : ''} p-2 cursor-pointer flex flex-col justify-between shrink-0">
                        <span class="text-[8px] font-black uppercase text-amber-500/80 truncate">${s}</span>
                        <span class="text-xs font-extrabold">${subSums[s].toFixed(2)} €</span>
                    </div>
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
    if (window.activeSubFilter === sub) {
        window.activeSubFilter = null;
    } else {
        window.activeSubFilter = sub;
    }
    renderList();
}

function renderList() {
    const list = document.getElementById('transaction-list');
    let currentFiltered = getFilteredData();

    if (currentStatusFilter === 'unprocessed') {
        currentFiltered = currentFiltered.filter(d => !d.processed);
    }

    const sums = {};
    currentFiltered.forEach(item => {
        if (item.type === 'expense') {
            if (!sums[item.category]) sums[item.category] = 0;
            sums[item.category] += item.amount;
        }
    });
    renderSummary(sums, currentFiltered);

    if (activeCategoryFilter) {
        currentFiltered = currentFiltered.filter(d => d.category === activeCategoryFilter);
        if (window.activeSubFilter) {
            currentFiltered = currentFiltered.filter(d => (d.sub ? d.sub : 'Nezaradené') === window.activeSubFilter);
        }
    }

    updateTotals(currentFiltered);

    document.getElementById('clear-cat-filter').classList.toggle('hidden', !activeCategoryFilter);

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
        list.innerHTML = `<div class="text-center py-8 text-slate-400 font-extrabold text-xs uppercase">Žiadne transakcie</div>`;
        return;
    }

    let html = '';
    Object.keys(grouped).forEach(dayKey => {
        const dayItems = grouped[dayKey];
        const daySum = dayItems.reduce((acc, curr) => curr.type === 'income' ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount), 0);

        html += `
        <div class="day-group mb-3">
            <div class="flex justify-between items-center px-2 py-1 mb-1 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <span>${formatDayLabel(dayKey)}</span>
                <span class="${daySum >= 0 ? 'text-emerald-500' : 'text-slate-400'}">${daySum >= 0 ? '+' : ''}${daySum.toFixed(2)} €</span>
            </div>
            <div class="space-y-1">
                ${dayItems.map(item => `
                    <div class="swipe-wrapper" id="wrapper-${item.id}">
                        <div class="swipe-bg" id="bg-${item.id}">
                            <span class="left-action flex items-center gap-1.5"><i data-lucide="check" class="w-4 h-4"></i> <span id="bg-left-text-${item.id}">Zapísaná</span></span>
                            <span class="right-action flex items-center gap-1.5"><span>Vymazať</span> <i data-lucide="trash-2" class="w-4 h-4"></i></span>
                        </div>
                        <div class="swipe-content p-4 flex items-center justify-between ${item.processed ? 'processed' : ''}"
                             id="item-${item.id}"
                             ontouchstart="handleSwipeStart(event, '${item.id}')"
                             ontouchmove="handleSwipeMove(event, '${item.id}')"
                             ontouchend="handleSwipeEnd(event, '${item.id}', ${item.processed})">

                            <div class="flex-1">
                                <div class="flex justify-between items-center pr-3">
                                    <span class="font-bold text-xs tracking-tight flex items-center gap-1">
                                        ${item.isRecurring ? '<i data-lucide="repeat" class="w-3 h-3 text-emerald-500 inline shrink-0"></i>' : ''}
                                        ${item.category}${item.sub ? ' <span class="text-slate-400 font-medium">/</span> '+item.sub : ''}
                                    </span>
                                    <span class="font-extrabold text-xs ${item.type === 'income' ? 'text-emerald-500' : ''}">${parseFloat(item.amount).toFixed(2)}€</span>
                                </div>
                                <div class="text-[8.5px] font-bold text-slate-400 uppercase tracking-wide mt-1">${item.note ? item.note : ''}</div>
                            </div>

                            <div onclick="event.stopPropagation(); toggleProcessed('${item.id}')" class="w-7 h-7 rounded-lg flex items-center justify-center border ml-3 cursor-pointer shrink-0 ${item.processed ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 dark:border-slate-800 text-slate-300'}">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    });

    list.innerHTML = html;
    lucide.createIcons();
}
