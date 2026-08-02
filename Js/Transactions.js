let curType = 'expense', selectedCat = '', selectedSub = '';

function setUser(u) {
    curUser = u;
    localStorage.setItem('f_last_user', u);
    document.getElementById('u-Lukáš').className = `flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${u === 'Lukáš' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`;
    document.getElementById('u-Zdenka').className = `flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${u === 'Zdenka' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`;
}

function setType(t) {
    curType = t;
    document.getElementById('t-ex').className = `flex-1 py-1.5 rounded-lg text-[9px] font-black ${t === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400'}`;
    document.getElementById('t-in').className = `flex-1 py-1.5 rounded-lg text-[9px] font-black ${t === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`;
}

function toggleProcessed(id) {
    const item = db.find(x => String(x.id) === String(id));
    if (item) {
        item.processed = !item.processed;
        syncQueue.push({ ...item, action: 'save' });
        saveData(false);
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue();
    }
}

function updateTotals(currentListData) {
    const total = currentListData.reduce((acc, curr) => curr.type === 'income' ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount), 0);
    document.getElementById('display-balance').innerText = total.toFixed(2) + ' €';
}

function openModal(id = null) {
    const overlay = document.getElementById('modal-overlay');
    const amountInput = document.getElementById('f-amount');
    const entryIdInput = document.getElementById('entry-id');
    overlay.classList.remove('hidden');

    if(id) {
        const i = db.find(x => String(x.id) === String(id));
        if(!i) return;
        entryIdInput.value = i.id; 
        amountInput.value = i.amount;
        document.getElementById('f-note').value = i.note || ''; 
        
        const cleanD = getCleanDateStr(i.date);
        document.getElementById('f-date').value = cleanD || getTodayStr();

        setUser(i.user || 'Lukáš'); 
        setType(i.type || 'expense'); 
        
        renderCatGrid();
        selectCat(i.category);
        if(i.sub) { selectSub(i.sub); }

        document.getElementById('del-btn').classList.remove('hidden');
    } else {
        document.getElementById('entry-form').reset();
        entryIdInput.value = "";
        document.getElementById('f-date').value = getTodayStr();
        setUser(localStorage.getItem('f_last_user') || 'Lukáš'); 
        setType('expense');
        
        renderCatGrid();
        
        const lastCat = localStorage.getItem('f_last_cat');
        const lastSub = localStorage.getItem('f_last_sub');
        let catToSelect = lastCat || (categories[0]?.id || '');
        
        selectCat(catToSelect);
        
        if(lastSub) {
            const cat = categories.find(c => c.id === catToSelect);
            if(cat && cat.subs && cat.subs.includes(lastSub)) {
                selectSub(lastSub);
            }
        }
        document.getElementById('del-btn').classList.add('hidden');
    }
    setTimeout(() => { amountInput.focus(); amountInput.select(); }, 300);
}

function handleSave(e) {
    e.preventDefault();
    let existingId = document.getElementById('entry-id').value;
    let id = existingId || 'ID-' + Date.now();
    
    const cleanDate = getCleanDateStr(document.getElementById('f-date').value);
    const fullDateWithTime = buildDateWithCurrentTime(document.getElementById('f-date').value);
    
    let currentProcessed = false;
    const localRecord = db.find(x => String(x.id) === String(id));
    if (localRecord) currentProcessed = localRecord.processed;

    const entry = { 
        id: id, 
        date: cleanDate,
        full_date: fullDateWithTime,
        category: selectedCat, 
        sub: selectedSub, 
        amount: parseFloat(document.getElementById('f-amount').value), 
        type: curType, 
        note: document.getElementById('f-note').value, 
        processed: currentProcessed, 
        user: curUser, 
        action: 'save' 
    };

    if (selectedCat) localStorage.setItem('f_last_cat', selectedCat);
    if (selectedSub) localStorage.setItem('f_last_sub', selectedSub);

    const idx = db.findIndex(x => String(x.id) === String(id));
    if (idx > -1) { db[idx] = entry; } else { db.push(entry); }
    
    syncQueue.push(entry); 
    saveData(false); 
    closeModal(); 
    renderList(); 
    updateAnalytics();
    updateBurnRateTab();
    processSyncQueue();
}

function handleDelete(idToDelete = null) { 
    const id = idToDelete || document.getElementById('entry-id').value; 
    if(id && confirm('Zmazať transakciu?')) { 
        syncQueue.push({ id: id, action: 'delete' }); 
        db = db.filter(x => String(x.id) !== String(id)); 
        saveData(false); 
        closeModal(); 
        renderList(); 
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue(); 
    } 
}

function closeModal() { 
    document.getElementById('modal-overlay').classList.add('hidden'); 
}
