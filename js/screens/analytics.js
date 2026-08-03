const Analytics = {
    chartInstance: null,
    render() {
        const screen = document.getElementById('screen-analytics');
        screen.innerHTML = `
            <h2 class="text-xl font-bold mb-4">Analýza kategórií</h2>
            <div class="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                <canvas id="mainChart"></canvas>
            </div>
        `;
        this.initChart();
    },
    initChart() {
        const ctx = document.getElementById('mainChart');
        if (this.chartInstance) this.chartInstance.destroy();
        
        // Logika pre extrakciu dát pre graf zo State.db
        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Strava', 'Bývanie', 'Doprava'], // Dynamické v ostrej verzii
                datasets: [{ data: [300, 500, 100], backgroundColor: ['#3b82f6', '#22c55e', '#ef4444'] }]
            },
            options: { responsive: true }
        });
    }
};
