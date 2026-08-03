const Settings = {
    open() {
        const screen = document.getElementById('settings-screen');
        screen.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Nastavenia</h2>
                <button onclick="Settings.close()" class="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <!-- Obsah nastavení (kategórie, export, dark mode toggle) -->
            <button class="btn-primary w-full mt-4" onclick="Api.syncData()">Vynútiť synchronizáciu</button>
        `;
        lucide.createIcons();
        screen.classList.remove('hidden');
    },
    close() {
        document.getElementById('settings-screen').classList.add('hidden');
        App.refresh();
    }
};
