const App = {
    init() {
        Header.render();
        Navbar.render();
        this.switchTab('home');
    },
    
    switchTab(tabId) {
        ['home', 'analytics', 'burnrate'].forEach(id => {
            document.getElementById(`screen-${id}`).classList.add('hidden');
        });
        document.getElementById(`screen-${tabId}`).classList.remove('hidden');
        
        Navbar.updateActive(tabId);

        if (tabId === 'home') Home.render();
        if (tabId === 'analytics') Analytics.render();
        if (tabId === 'burnrate') BurnRate.render();
    },

    refresh() {
        Header.render();
        // Znovunačítanie aktuálnej obrazovky
        if (!document.getElementById('screen-home').classList.contains('hidden')) Home.render();
        if (!document.getElementById('screen-analytics').classList.contains('hidden')) Analytics.render();
        if (!document.getElementById('screen-burnrate').classList.contains('hidden')) BurnRate.render();
    }
};

// Spustenie aplikácie po načítaní DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
