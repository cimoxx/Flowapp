const Header = {
    render() {
        const headerEl = document.getElementById('main-header');
        
        // Filtrovanie len pre aktuálny mesiac a rok (voliteľné, ale zvyčajne sa to robí takto)
        const currentMonthTxs = State.db.filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === State.currentMonth && d.getFullYear() === State.currentYear;
        });

        // Výpočet celkového zostatku zo VŠETKÝCH transakcií (alebo len mesiaca, podľa tvojej preferencie)
        const total = State.db.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
        
        // Výpočet súm pre kategórie (iba výdavky v danom mesiaci)
        const catSums = {};
        currentMonthTxs.forEach(tx => {
            if (tx.type === 'expense') {
                catSums[tx.category] = (catSums[tx.category] || 0) + tx.amount;
            }
        });

        // HTML pre boxy kategórií
        let categoryBoxes = '';
        Object.entries(catSums).forEach(([cat, sum]) => {
            categoryBoxes += `
                <div class="flex-shrink-0 bg-slate-800 border border-slate-700 rounded-xl p-3 min-w-[100px]">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">${cat}</p>
                    <p class="text-sm font-bold text-white">${Utils.formatMoney(sum)}</p>
                </div>
            `;
        });

        headerEl.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <img src="https://img.icons8.com/fluency/48/safe.png" class="w-10 h-10 opacity-80" alt="Trezor">
                    <div>
                        <p class="text-[10px] text-[#22c55e] font-bold uppercase tracking-wider">Spolu</p>
                        <h1 class="text-3xl font-black ${total >= 0 ? 'text-white' : 'text-white'}">
                            ${Utils.formatMoney(total)}
                        </h1>
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="flex items-center bg-slate-800/50 rounded-full px-3 py-1 border border-slate-700/50">
                        <div class="w-2 h-2 rounded-full bg-[#22c55e] mr-2"></div>
                        <span class="text-xs text-slate-300 font-medium">OK</span>
                    </div>
                    <button onclick="Settings.open()" class="p-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-slate-400">
                        <i data-lucide="info" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            
            <!-- Horizontálny scroll pre kategórie -->
            <div class="flex overflow-x-auto gap-2 pb-2 -mx-5 px-5 snap-x hide-scrollbar">
                ${categoryBoxes}
            </div>
        `;
        lucide.createIcons();
    }
};
