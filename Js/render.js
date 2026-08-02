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
                                    <span class="font-bold text-xs tracking-tight">${item.category}${item.sub ? ' <span class="text-slate-400 font-medium">/</span> '+item.sub : ''}</span>
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
