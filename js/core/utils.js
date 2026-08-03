const Utils = {
    generateId: () => '_' + Math.random().toString(36).substr(2, 9),
    
    formatMoney: (amount) => {
        const num = Number(amount) || 0;
        return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(num);
    },

    parseDate: (dStr) => {
        if (!dStr) return new Date();
        if (dStr instanceof Date) return dStr;
        if (typeof dStr === 'number') return new Date(dStr);
        
        const str = String(dStr).trim();
        
        // Podpora pre "16. 8. 2026" aj "16.08.2026"
        const skMatch = str.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
        if (skMatch) {
            return new Date(parseInt(skMatch[3], 10), parseInt(skMatch[2], 10) - 1, parseInt(skMatch[1], 10));
        }
        
        // Podpora pre "2026-08-16"
        const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (isoMatch) {
            return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
        }

        const parsed = new Date(str);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    },

    normalizeTx: (tx) => {
        if (!tx) return null;
        
        let rawAmount = tx.amount !== undefined ? tx.amount : (tx.suma !== undefined ? tx.suma : (tx.val !== undefined ? tx.val : 0));
        let numAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(',', '.')) || 0;
        
        let type = tx.type || tx.typ || (numAmount < 0 ? 'expense' : 'income');
        if (type === 'prijem' || type === 'in') type = 'income';
        if (type === 'vydaj' || type === 'out') type = 'expense';
        
        let absAmount = Math.abs(numAmount);
        let dateObj = Utils.parseDate(tx.date || tx.datum || tx.created_at);
        
        return {
            id: tx.id || tx._id || Utils.generateId(),
            raw: tx,
            amount: absAmount,
            signedAmount: type === 'income' ? absAmount : -absAmount,
            type: type,
            dateObj: dateObj,
            day: dateObj.getDate(),
            month: dateObj.getMonth(),
            year: dateObj.getFullYear(),
            category: tx.category || tx.kat || tx.kategoria || 'Bez kategórie',
            subCategory: tx.subCategory || tx.sub || tx.podkategoria || tx.podkat || '',
            note: tx.note || tx.poznamka || tx.title || tx.popis || '',
            checked: tx.checked !== undefined ? tx.checked : true
        };
    },

    vibrate: (ms = 50) => { if (navigator.vibrate) navigator.vibrate(ms); }
};
