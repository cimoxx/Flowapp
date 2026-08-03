const Api = {
    API_URL: 'TVOJ_APPS_SCRIPT_URL', // Doplniť v prípade potreby
    async syncData() {
        if (!navigator.onLine || State.syncQueue.length === 0) return;
        try {
            // Logika odoslania na Apps Script
            console.log('Syncing data...', State.syncQueue);
            State.syncQueue = [];
            State.save();
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }
};
