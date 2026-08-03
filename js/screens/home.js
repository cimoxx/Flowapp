const Home = {
    render() {
        const screen = document.getElementById('screen-home');
        if (State.db.length === 0) {
            screen.innerHTML = `<div class="text-center text-slate-500 mt-10">Žiadne transakcie</div>`;
            return;
        }

        let html = '<div class="space-y-3">';
        State.db.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
            const isIncome = tx.type === 'income';
            html += `
                <div class="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800" id="tx-${tx.id}">
                    <div class="swipe-bg bg-red-500 justify-end"><i data-lucide="trash-2" class="text-white"></i></div>
                    <div class="swipe-item relative bg-white dark:bg-slate-900 p-4 flex justify-between items-center z-10">
                        <div>
                            <p class="font-semibold text-slate-800 dark:text-white">${tx.title || tx.category}</p>
                            <p class="text-xs text-slate-500">${Utils.formatDate(tx.date)}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold ${isIncome ? 'text-green-500' : 'text-slate-800 dark:text-white'}">
                                ${isIncome ? '+' : '-'}${Utils.formatMoney(tx.amount)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        screen.innerHTML = html;
        lucide.createIcons();

        // Inicializácia swipe pre každú transakciu
        State.db.forEach(tx => {
            const el = document.querySelector(`#tx-${tx.id} .swipe-item`);
            if (el) {
                Swipe.init(el, () => this.deleteTx(tx.id), null);
            }
        });
    },
    deleteTx(id) {
        if(confirm('Naozaj zmazať transakciu?')) {
            State.deleteTransaction(id);
            App.refresh();
        }
    }
};
