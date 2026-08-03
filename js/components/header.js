const Header = {
    render() {
        const headerEl = document.getElementById('main-header');
        const total = State.db.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
        
        headerEl.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Zostatok</p>
                    <h1 class="text-3xl font-bold ${total >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}">
                        ${Utils.formatMoney(total)}
                    </h1>
                </div>
                <button onclick="Settings.open()" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    <i data-lucide="settings" class="w-6 h-6 text-slate-600 dark:text-slate-300"></i>
                </button>
            </div>
        `;
        lucide.createIcons();
    }
};
