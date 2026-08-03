const ChangelogModal = {
    open() {
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                    <h3 class="text-xl font-bold mb-4">Čo je nové (V20)</h3>
                    <ul class="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <li>Kompletná hyper-modulárna štruktúra</li>
                        <li>Optimalizované pre zachovanie existujúceho UI</li>
                        <li>Oddelená správa gest a grafov</li>
                    </ul>
                    <button onclick="ChangelogModal.close()" class="btn-primary mt-6">Zavrieť</button>
                </div>
            </div>
        `;
    },
    close() {
        document.getElementById('modal-container').innerHTML = '';
    }
};
