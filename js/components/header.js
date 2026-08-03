const Header = {
    render() {
        const headerEl = document.getElementById('main-header');
        const allTxs = State.getNormalizedDb();
        
        const total = allTxs.reduce((sum, tx) => sum + tx.signedAmount, 0);
        const currentMonthTxs = allTxs.filter(tx => tx.month === State.currentMonth && tx.year === State.currentYear);
        
        const catSums = {};
        currentMonthTxs.forEach(tx => {
            if (tx.type === 'expense') {
                const catName = tx.category.toUpperCase();
                catSums[catName] = (catSums[catName] || 0) + tx.amount;
            }
        });

        let categoryBoxes = '';
        Object.entries(catSums).forEach(([cat, sum]) => {
            categoryBoxes += `
                <div class="flex-shrink-0 bg-slate-900/80 border border-slate-800 rounded-xl p-3 min-w-[105px]">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">${cat}</p>
                    <p class="text-sm font-bold text-white">${Utils.formatMoney(sum)}</p>
                </div>
            `;
        });

        headerEl.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <img src="https://img.icons8.com/fluency/48/safe.png" class="w-9 h-9 opacity-90" alt="Trezor">
                    <div>
                        <p class="text-[10px] text-[#34d399] font-bold uppercase tracking-wider">SPOLU</p>
                        <h1 class="text-2xl font-black text-white">
                            ${Utils.formatMoney(total)}
                        </h1>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center bg-slate-900/80 rounded-full px-3 py-1 border border-slate-800">
                        <div class="w-2 h-2 rounded-full bg-[#34d399] mr-2"></div>
                        <span class="text-xs text-slate-300 font-bold">OK</span>
                    </div>
                    <button onclick="Settings.open()" class="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400">
                        <i data-lucide="info" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            
            <div class="flex overflow-x-auto gap-2 pb-1 -mx-5 px-5 snap-x hide-scrollbar">
                ${categoryBoxes || '<div class="text-xs text-slate-500 py-1">Žiadne výdavky v tomto mesiaci</div>'}
            </div>
        `;
        lucide.createIcons();
    }
};
