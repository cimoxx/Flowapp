const Home = {
    render() {
        const screen = document.getElementById('screen-home');
        const allTxs = State.getNormalizedDb();

        let filteredTxs = allTxs.filter(tx => tx.month === State.currentMonth && tx.year === State.currentYear);
        filteredTxs.sort((a,b) => b.dateObj - a.dateObj);

        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
        let monthsHtml = '';
        months.forEach((m, index) => {
            const isActive = index === State.currentMonth;
            monthsHtml += `
                <button onclick="Home.setMonth(${index})" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${isActive ? 'bg-[#34d399] text-slate-950 shadow-md shadow-[#34d399]/20' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'}">
                    ${m}
                </button>
            `;
        });

        const grouped = {};
        const todayStr = new Date().toDateString();
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yestStr = yest.toDateString();

        filteredTxs.forEach(tx => {
            const txDateStr = tx.dateObj.toDateString();
            let label = '';
            if (txDateStr === todayStr) label = 'DNES';
            else if (txDateStr === yestStr) label = 'VČERA';
            else {
                label = `${tx.day}. ${tx.month + 1}. ${tx.year}`;
            }

            if (!grouped[label]) grouped[label] = { total: 0, items: [] };
            grouped[label].items.push(tx);
            grouped[label].total += tx.signedAmount;
        });

        let txHtml = '';
        if (Object.keys(grouped).length === 0) {
            txHtml = `<div class="text-center text-slate-500 my-12 text-sm font-medium">Žiadne transakcie pre tento mesiac.</div>`;
        } else {
            Object.keys(grouped).forEach(dateLabel => {
                const group = grouped[dateLabel];
                txHtml += `
                    <div class="flex justify-between items-center mt-5 mb-2 px-1">
                        <span class="text-[11px] font-bold text-slate-400 tracking-wider uppercase">${dateLabel}</span>
                        <span class="text-[11px] font-bold text-slate-400">${Utils.formatMoney(group.total)}</span>
                    </div>
                    <div class="space-y-2">
                `;
                
                group.items.forEach(tx => {
                    const isIncome = tx.type === 'income';
                    txHtml += `
                        <div class="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800/80" id="tx-${tx.id}">
                            <div class="swipe-bg bg-red-500/90 justify-end"><i data-lucide="trash-2" class="text-white w-5 h-5"></i></div>
                            <div class="swipe-item relative p-3.5 flex justify-between items-center z-10 bg-slate-900">
                                <div class="flex flex-col">
                                    <span class="font-bold text-[15px] text-white">
                                        ${tx.category} ${tx.subCategory ? `<span class="text-slate-400 font-normal text-xs">/ ${tx.subCategory}</span>` : ''}
                                    </span>
                                    ${tx.note ? `<span class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">${tx.note}</span>` : ''}
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="font-bold text-[15px] ${isIncome ? 'text-[#34d399]' : 'text-white'}">
                                        ${Utils.formatMoney(tx.amount)}
                                    </span>
                                    <div class="w-7 h-7 rounded-lg border border-slate-700/80 flex items-center justify-center bg-slate-800/40 text-slate-300">
                                        <i data-lucide="check" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                txHtml += `</div>`;
            });
        }

        screen.innerHTML = `
            <div class="sticky top-0 z-10 bg-slate-950 pb-3 pt-1 border-b border-slate-800/80 -mx-4 px-4 mb-2">
                <div class="flex overflow-x-auto gap-2 pb-2.5 hide-scrollbar items-center">
                    ${monthsHtml}
                    <select onchange="Home.setYear(this.value)" class="bg-slate-900 border border-slate-800 text-white text-xs font-bold rounded-xl px-2.5 py-1.5 ml-1 outline-none">
                        <option value="2026" ${State.currentYear === 2026 ? 'selected' : ''}>2026</option>
                        <option value="2025" ${State.currentYear === 2025 ? 'selected' : ''}>2025</option>
                    </select>
                </div>
                <div class="flex bg-slate-900 rounded-xl p-1 w-fit border border-slate-800/80">
                    <button onclick="Home.setFilterMode('new')" class="${State.filterMode === 'new' ? 'bg-[#34d399] text-slate-950' : 'text-slate-400'} px-5 py-1 rounded-lg text-xs font-bold transition-all">NOVÉ</button>
                    <button onclick="Home.setFilterMode('all')" class="${State.filterMode === 'all' ? 'bg-[#34d399] text-slate-950' : 'text-slate-400'} px-5 py-1 rounded-lg text-xs font-bold transition-all">VŠETKY</button>
                </div>
            </div>

            <div class="pb-6">
                ${txHtml}
            </div>
        `;
        lucide.createIcons();

        filteredTxs.forEach(tx => {
            const el = document.querySelector(`#tx-${tx.id} .swipe-item`);
            if (el) {
                Swipe.init(el, () => this.deleteTx(tx.id), null);
            }
        });
    },

    setMonth(m) {
        State.currentMonth = m;
        App.refresh();
    },

    setYear(y) {
        State.currentYear = parseInt(y, 10);
        App.refresh();
    },

    setFilterMode(mode) {
        State.filterMode = mode;
        App.refresh();
    },

    deleteTx(id) {
        if(confirm('Naozaj zmazať transakciu?')) {
            State.deleteTransaction(id);
            App.refresh();
        }
    }
};

            if (!grouped[label]) grouped[label] = { total: 0, items: [] };
            grouped[label].items.push(tx);
            grouped[label].total += (tx.type === 'income' ? tx.amount : -tx.amount);
        });

        // 3. Vykreslenie zoznamu
        let txHtml = '';
        if (Object.keys(grouped).length === 0) {
            txHtml = `<div class="text-center text-slate-500 mt-10">Zatiaľ žiadne transakcie v tomto mesiaci.</div>`;
        } else {
            Object.keys(grouped).forEach(dateLabel => {
                const group = grouped[dateLabel];
                // Hlavička dňa
                txHtml += `
                    <div class="flex justify-between items-end mt-6 mb-2 border-b border-slate-800 pb-1 px-1">
                        <span class="text-[10px] font-bold text-slate-400 tracking-wider">${dateLabel}</span>
                        <span class="text-[10px] font-bold ${group.total >= 0 ? 'text-slate-400' : 'text-slate-400'}">${Utils.formatMoney(group.total)}</span>
                    </div>
                    <div class="space-y-1">
                `;
                
                // Položky dňa
                group.items.forEach(tx => {
                    const isIncome = tx.type === 'income';
                    txHtml += `
                        <div class="relative overflow-hidden rounded-xl bg-transparent" id="tx-${tx.id}">
                            <div class="swipe-bg bg-red-500 justify-end"><i data-lucide="trash-2" class="text-white"></i></div>
                            <div class="swipe-item relative p-3 flex justify-between items-center z-10 bg-slate-900 border-b border-slate-800/50">
                                <div class="flex flex-col">
                                    <span class="font-bold text-[15px] ${isIncome ? 'text-white' : 'text-white'}">${tx.category || 'Neznáme'} ${tx.subCategory ? `<span class="text-slate-400 font-normal">/ ${tx.subCategory}</span>` : ''}</span>
                                    ${tx.note ? `<span class="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">${tx.note}</span>` : ''}
                                </div>
                                <div class="flex items-center gap-4">
                                    <span class="font-bold text-[15px] ${isIncome ? 'text-[#34d399]' : 'text-white'}">
                                        ${Utils.formatMoney(tx.amount)}
                                    </span>
                                    <div class="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-500">
                                        <i data-lucide="check" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                txHtml += `</div>`;
            });
        }

        // 4. Vloženie do obrazovky
        screen.innerHTML = `
            <!-- Filtre -->
            <div class="sticky top-0 z-10 bg-slate-950 pb-2 pt-2 border-b border-slate-800 -mx-4 px-4 mb-4">
                <div class="flex overflow-x-auto gap-2 pb-3 hide-scrollbar items-center">
                    ${monthsHtml}
                    <select class="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-3 py-2 ml-2 outline-none">
                        <option>2026</option>
                        <option>2025</option>
                    </select>
                </div>
                <div class="flex bg-slate-900 rounded-xl p-1 mt-1 w-fit border border-slate-800">
                    <button class="bg-[#34d399] text-slate-900 px-6 py-1.5 rounded-lg text-xs font-bold">NOVÉ</button>
                    <button class="text-slate-400 px-6 py-1.5 rounded-lg text-xs font-bold">VŠETKY</button>
                </div>
            </div>

            <!-- Zoznam transakcií -->
            <div class="pb-6">
                ${txHtml}
            </div>
        `;
        lucide.createIcons();

        // Inicializácia swipe na zmazanie
        filteredTxs.forEach(tx => {
            const el = document.querySelector(`#tx-${tx.id} .swipe-item`);
            if (el) {
                Swipe.init(el, () => this.deleteTx(tx.id), null);
            }
        });
    },

    setMonth(monthIndex) {
        State.currentMonth = monthIndex;
        App.refresh();
    },

    deleteTx(id) {
        if(confirm('Naozaj zmazať transakciu?')) {
            State.deleteTransaction(id);
            App.refresh();
        }
    }
};
