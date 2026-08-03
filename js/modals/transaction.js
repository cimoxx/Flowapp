const TransactionModal = {
    open(editId = null) {
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm transition-opacity">
                <div class="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl transform transition-transform translate-y-0">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold">Nová transakcia</h3>
                        <button onclick="TransactionModal.close()" class="p-2 rounded-full bg-slate-100 dark:bg-slate-800"><i data-lucide="x"></i></button>
                    </div>
                    <input type="number" id="tx-amount" placeholder="0.00 €" class="w-full text-4xl font-black bg-transparent border-b-2 border-slate-200 dark:border-slate-700 py-4 mb-6 focus:outline-none focus:border-blue-500">
                    <button onclick="TransactionModal.save()" class="btn-primary">Uložiť</button>
                </div>
            </div>
        `;
        lucide.createIcons();
    },
    close() {
        document.getElementById('modal-container').innerHTML = '';
    },
    save() {
        const amount = parseFloat(document.getElementById('tx-amount').value);
        if (amount) {
            State.addTransaction({ id: Utils.generateId(), amount, type: 'expense', date: new Date().toISOString() });
            this.close();
            App.refresh();
        }
    }
};
