const BurnRate = {
    render() {
        const screen = document.getElementById('screen-burnrate');
        screen.innerHTML = `
            <h2 class="text-xl font-bold mb-4">Burn Rate</h2>
            <div class="p-6 bg-blue-50 dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-slate-700 text-center">
                <p class="text-sm text-slate-500 dark:text-slate-400">Priemerná denná spotreba</p>
                <h3 class="text-4xl font-black text-blue-600 dark:text-blue-400 mt-2">€ 34.50</h3>
            </div>
        `;
    }
};
