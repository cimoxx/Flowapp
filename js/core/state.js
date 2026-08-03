const State = {
    db: JSON.parse(localStorage.getItem('f_db_v20')) || JSON.parse(localStorage.getItem('flow_db')) || [],
    categories: JSON.parse(localStorage.getItem('f_cats_v20')) || [],
    syncQueue: JSON.parse(localStorage.getItem('f_sync_q_v20')) || [],
    currentUser: localStorage.getItem('f_last_user') || 'Lukáš',
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    filterMode: 'all',

    getNormalizedDb() {
        return this.db.map(tx => Utils.normalizeTx(tx)).filter(Boolean);
    },
    
    save() {
        localStorage.setItem('f_db_v20', JSON.stringify(this.db));
        localStorage.setItem('f_cats_v20', JSON.stringify(this.categories));
        localStorage.setItem('f_sync_q_v20', JSON.stringify(this.syncQueue));
    },

    addTransaction(tx) {
        this.db.push(tx);
        this.save();
    },

    deleteTransaction(id) {
        this.db = this.db.filter(t => (t.id || t._id) !== id);
        this.save();
    }
};
