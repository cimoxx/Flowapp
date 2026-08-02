let activeSettingsCat = null;

function renderManageCats() {
    document.getElementById('manage-cats-list').innerHTML = categories.map((c, i) => `
        <div class="flex items-center gap-2">
            <div onclick="openCatDetail(${i})" class="flex-1 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm cursor-pointer active:scale-[0.98] transition-all">
                <div class="font-extrabold text-sm uppercase flex items-center gap-2">
                    <span>${c.id}</span>
                </div>
                <div class="text-[9px] text-slate-300 uppercase font-black tracking-tighter">${c.subs ? c.subs.length : 0} subs</div>
            </div>
            <button type="button" onclick="editCategoryName(${i})" class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-500"><i data-lucide="pencil" class="w-4 h-4"></i></button>
            <div class="flex flex-col gap-1">
                <button type="button" onclick="moveCat(${i}, -1)" class="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"><i data-lucide="chevron-up" class="w-3 h-3"></i></button>
                <button type="button" onclick="moveCat(${i}, 1)" class="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"><i data-lucide="chevron-down" class="w-3 h-3"></i></button>
            </div>
        </div>`).join('');
    lucide.createIcons();
}

function editCategoryName(index) {
    const oldName = categories[index].id;
    const newName = prompt("Upravte názov kategórie:", oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        const trimmed = newName.trim();
        db.forEach(item => {
            if (item.category === oldName) {
                item.category = trimmed;
                syncQueue.push({ ...item, action: 'save' });
            }
        });
        categories[index].id = trimmed;
        saveData(true);
        renderManageCats();
        renderCatGrid();
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue();
    }
}

function openCatDetail(index) { 
    activeSettingsCat = index; 
    document.getElementById('settings-home').classList.add('hidden'); 
    document.getElementById('settings-cat-detail').classList.remove('hidden'); 
    document.getElementById('detail-cat-title').innerText = categories[index].id; 
    renderManageSubs(); 
}

function renderManageSubs() {
    const cat = categories[activeSettingsCat];
    if (!cat.subs) cat.subs = [];
    document.getElementById('manage-subs-list').innerHTML = cat.subs.map((s, i) => `
        <div class="flex items-center gap-2">
            <div class="flex-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between border border-transparent dark:border-slate-700">
                <div class="font-bold text-xs uppercase">${s}</div>
                <div class="flex items-center gap-1">
                    <button type="button" onclick="editSubCategoryName(${i})" class="p-1.5 text-slate-400 hover:text-emerald-500"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                    <button type="button" onclick="deleteSub(${i})" class="p-1.5 text-red-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>
            <div class="flex flex-col gap-1">
                <button type="button" onclick="moveSub(${i}, -1)" class="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"><i data-lucide="chevron-up" class="w-2.5 h-2.5"></i></button>
                <button type="button" onclick="moveSub(${i}, 1)" class="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"><i data-lucide="chevron-down" class="w-2.5 h-2.5"></i></button>
            </div>
        </div>`).join('');
    lucide.createIcons();
}

function editSubCategoryName(subIndex) {
    const cat = categories[activeSettingsCat];
    const oldName = cat.subs[subIndex];
    const newName = prompt("Upravte názov podkategórie:", oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        const trimmed = newName.trim();
        db.forEach(item => {
            if (item.category === cat.id && item.sub === oldName) {
                item.sub = trimmed;
                syncQueue.push({ ...item, action: 'save' });
            }
        });
        cat.subs[subIndex] = trimmed;
        saveData(true);
        renderManageSubs();
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue();
    }
}

function moveCat(i, dir) { 
    if((dir === -1 && i > 0) || (dir === 1 && i < categories.length - 1)) { 
        const temp = categories[i]; 
        categories[i] = categories[i + dir]; 
        categories[i + dir] = temp; 
        saveData(true); 
        renderManageCats(); 
        renderCatGrid(); 
    } 
}

function moveSub(i, dir) { 
    const subs = categories[activeSettingsCat].subs; 
    if((dir === -1 && i > 0) || (dir === 1 && i < subs.length - 1)) { 
        const temp = subs[i]; 
        subs[i] = subs[i + dir]; 
        subs[i + dir] = temp; 
        saveData(true); 
        renderManageSubs(); 
    } 
}

function addCategory() { 
    let n = document.getElementById('new-cat-name').value.trim(); 
    if(n) { 
        categories.push({id: n, icon: 'layers', subs: []}); 
        document.getElementById('new-cat-name').value = ''; 
        saveData(true); 
        renderManageCats(); 
        renderCatGrid(); 
    } 
}

function addSubCategory() { 
    let n = document.getElementById('new-sub-name').value.trim(); 
    if(n && activeSettingsCat !== null) { 
        if (!categories[activeSettingsCat].subs) categories[activeSettingsCat].subs = []; 
        categories[activeSettingsCat].subs.push(n); 
        document.getElementById('new-sub-name').value = ''; 
        saveData(true); 
        renderManageSubs(); 
    } 
}

function deleteSub(index) { 
    if(confirm('Zmazať podkategóriu?')) { 
        const cat = categories[activeSettingsCat];
        const deletedSubName = cat.subs[index];
        
        cat.subs.splice(index, 1); 
        
        db.forEach(item => {
            if (item.category === cat.id && item.sub === deletedSubName) {
                item.sub = '';
                syncQueue.push({ ...item, action: 'save' });
            }
        });
        
        saveData(true); 
        renderManageSubs(); 
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue();
    } 
}

function deleteActiveCat() { 
    if(confirm(`Zmazať kategóriu ${categories[activeSettingsCat].id}?`)) { 
        categories.splice(activeSettingsCat, 1); 
        saveData(true); 
        closeCatDetail(); 
        renderCatGrid(); 
    } 
}
