const State = {
    db: JSON.parse(localStorage.getItem('f_db_v20')) || [],
    syncQueue: JSON.parse(localStorage.getItem('f_sync_q_v20')) || [],
    categories: JSON.parse(localStorage.getItem('f_cats_v20')) || [],
    chartPresets: JSON.parse(localStorage.getItem('f_chart_presets_v20')) || [],
    curUser: localStorage.getItem('f_last_user') || 'Lukáš',
    
    save() {
        localStorage.setItem('f_db_v20', JSON.stringify(this.db));
        localStorage.setItem('f_sync_q_v20', JSON.stringify(this.syncQueue));
        localStorage.setItem('f_cats_v20', JSON.stringify(this.categories));
    }
};
