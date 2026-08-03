const Navbar = {
    render() {
        const navEl = document.getElementById('main-navbar');
        navEl.innerHTML = `
            <button onclick="App.switchTab('home')" class="nav-btn flex flex-col items-center p-2 text-blue-600" id="tab-home">
                <i data-lucide="list" class="w-6 h-6"></i>
                <span class="text-[10px] mt-1 font-medium">Prehľad</span>
            </button>
            <button onclick="App.switchTab('analytics')" class="nav-btn flex flex-col items-center p-2 text-slate-400" id="tab-analytics">
                <i data-lucide="pie-chart" class="w-6 h-6"></i>
                <span class="text-[10px] mt-1 font-medium">Grafy</span>
            </button>
            <div class="flex justify-center relative -top-5">
                <button onclick="TransactionModal.open()" class="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg shadow-blue-500/30 transform transition active:scale-95">
                    <i data-lucide="plus" class="w-8 h-8"></i>
                </button>
            </div>
            <button onclick="App.switchTab('burnrate')" class="nav-btn flex flex-col items-center p-2 text-slate-400" id="tab-burnrate">
                <i data-lucide="flame" class="w-6 h-6"></i>
                <span class="text-[10px] mt-1 font-medium">Burn</span>
            </button>
            <button onclick="ChangelogModal.open()" class="nav-btn flex flex-col items-center p-2 text-slate-400" id="tab-changelog">
                <i data-lucide="bell" class="w-6 h-6"></i>
                <span class="text-[10px] mt-1 font-medium">Novinky</span>
            </button>
        `;
        lucide.createIcons();
    },
    updateActive(tabId) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('text-blue-600');
            btn.classList.add('text-slate-400');
        });
        document.getElementById(`tab-${tabId}`)?.classList.add('text-blue-600');
        document.getElementById(`tab-${tabId}`)?.classList.remove('text-slate-400');
    }
};
