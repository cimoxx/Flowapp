const Home = {
    render() {
        const screen = document.getElementById('screen-home');
        
        // Získanie filtrovaných transakcií (podľa State.currentMonth a State.currentYear)
        const filteredTxs = State.db.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === State.currentMonth && d.getFullYear() === State.currentYear;
        }).sort((a,b) => new Date(b.date) - new Date(a.date));

        // 1. Vygenerovanie mesiacov
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
        let monthsHtml = '';
        months.forEach((m, index) => {
            const isActive = index === State.currentMonth;
            monthsHtml += `
                <button onclick="Home.setMonth(${index})" class="px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${isActive ? 'bg-[#34d399] text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}">
                    ${m}
                </button>
            `;
        });

        // 2. Zoskupenie transakcií podľa dátumu
        const grouped = {};
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        filteredTxs.forEach(tx => {
            const txDate = new Date(tx.date).toDateString();
            let label = txDate;
            if (txDate === today) label = 'DNES';
            else if (txDate === yesterday) label = 'VČERA';
            else {
                const d = new Date(tx.date);
                label = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
            }

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
