const Utils = {
    generateId: () => '_' + Math.random().toString(36).substr(2, 9),
    formatMoney: (amount) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(amount),
    formatDate: (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    vibrate: (ms = 50) => { if (navigator.vibrate) navigator.vibrate(ms); }
};
