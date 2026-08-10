function getCategoryTransactionCount(catId) {
    return db.filter(item => item.category === catId).length;
}

function renderCatGrid() {
    const catGrid = document.getElementById('cat-grid');
    catGrid.innerHTML = categories.map(c => `
        <div onclick="selectCat('${c.id}', event)" data-id="${c.id}" class="cat-tile flex flex-col items-center justify-center p-1 font-extrabold uppercase">
            <i data-lucide="${c.icon || 'layers'}"></i>
            <span>${c.id}</span>
        </div>
    `).join('');
    lucide.createIcons();
}

function renderManageCats() {
    document.getElementById('manage-cats-list').innerHTML = categories.map((c, i) => `
        <div class="flex items-center gap-2">
            <div onclick="openCatDetail(${i})" class="flex-1 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm cursor-pointer active:scale-[0.98] transition-all">
                <div class="font-extrabold text-sm uppercase flex items-center gap-2 min-w-0">
                    <i data-lucide="${c.icon || 'layers'}" class="w-4 h-4 shrink-0"></i>
                    <span class="truncate">${c.id}</span>
                </div>
                <div class="text-right">
                    <div class="text-[9px] text-slate-300 uppercase font-black tracking-tighter">${c.subs ? c.subs.length : 0} subs</div>
                    <div class="text-[9px] text-slate-400 font-black">${getCategoryTransactionCount(c.id)} tx</div>
                </div>
            </div>
            <button type="button" onclick="editCategoryName(${i})" class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-500" aria-label="Premenovať kategóriu"><i data-lucide="pencil" class="w-4 h-4"></i></button>
            <button type="button" onclick="deleteCategoryFromList(${i}, event)" class="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 text-red-400 hover:text-red-600" aria-label="Zmazať kategóriu"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            <div class="flex flex-col gap-1">
                <button type="button" onclick="moveCat(${i}, -1)" class="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"><i data-lucide="chevron-up" class="w-3 h-3"></i></button>
                <button type="button" onclick="moveCat(${i}, 1)" class="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"><i data-lucide="chevron-down" class="w-3 h-3"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function editCategoryName(index) {
    const oldName = categories[index].id;
    const newName = prompt("Upravte názov kategórie:", oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        const trimmed = newName.trim();
        categories[index].id = trimmed;
        categories[index].uid = categories[index].uid || createUid('cat');
        const categoryUid = categories[index].uid;
        db.forEach(item => {
            if (item.category === oldName) {
                item.category = trimmed;
                item.categoryId = categoryUid;
                item.updatedAt = new Date().toISOString();
                item.version = (parseInt(item.version, 10) || 0) + 1;
            }
        });
        db.filter(item => item.category === trimmed).forEach(item => syncQueue.push({ ...item, action: 'save' }));
        saveData(true);
        renderManageCats();
        renderCatGrid();
        renderList();
        updateAnalytics();
        updateBurnRateTab();
        processSyncQueue();
    }
}

function deleteCategoryFromList(index, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (activeSettingsCat === index) activeSettingsCat = null;
    deleteCategoryByIndex(index);
}

function deleteCategoryByIndex(index) {
    if (index === null || index === undefined || !categories[index]) return;

    const deletedCategory = categories[index];
    const deletedId = deletedCategory.id;
    const affectedItems = db.filter(item => item.category === deletedId && !item.deleted);

    const fallbackCategory = categories.find(c => c.id === 'Ine' && c.id !== deletedId)
        || categories.find(c => c.id !== deletedId);
    const fallbackId = fallbackCategory ? fallbackCategory.id : '';

    if (!confirm(`Zmazať kategóriu ${deletedId}?${affectedItems.length ? `\n\nObsahuje ${affectedItems.length} transakcií. Tie budú presunuté do kategórie „${fallbackId || 'bez kategórie'}“.` : ''}`)) return;

    affectedItems.forEach(item => {
        item.category = fallbackId;
        item.categoryId = fallbackCategory ? fallbackCategory.uid : '';
        item.sub = '';
        item.updatedAt = new Date().toISOString();
        item.version = (parseInt(item.version, 10) || 0) + 1;
        queueMutation(item);
    });

    categories.splice(index, 1);
    activeSettingsCat = null;
    saveData(true);

    const home = document.getElementById('settings-home');
    const detail = document.getElementById('settings-cat-detail');
    if (detail) detail.classList.add('hidden');
    if (home) home.classList.remove('hidden');

    renderManageCats();
    renderCatGrid();
    renderList();
    updateAnalytics();
    updateBurnRateTab();
    if (typeof updateBudgetScreen === 'function') updateBudgetScreen();
    processSyncQueue();
}

function openCatDetail(index) {
    activeSettingsCat = index;
    document.getElementById('settings-home').classList.add('hidden');
    document.getElementById('settings-cat-detail').classList.remove('hidden');
    document.getElementById('detail-cat-title').innerText = categories[index].id;
    document.getElementById('cat-icon-name').value = categories[index].icon || 'layers';
    renderManageSubs();
}

function saveCategoryIcon() {
    if (activeSettingsCat === null) return;
    const iconName = (document.getElementById('cat-icon-name').value || '').trim() || 'layers';
    categories[activeSettingsCat].icon = iconName;
    saveData(true);
    renderManageCats();
    renderCatGrid();
    showToast({
        type: 'success',
        title: 'Ikona kategórie uložená',
        text: categories[activeSettingsCat].id
    });
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
        </div>
    `).join('');
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
                item.categoryId = cat.uid;
                item.updatedAt = new Date().toISOString();
                item.version = (parseInt(item.version, 10) || 0) + 1;
                queueMutation(item);
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
    if ((dir === -1 && i > 0) || (dir === 1 && i < categories.length - 1)) {
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
    if ((dir === -1 && i > 0) || (dir === 1 && i < subs.length - 1)) {
        const temp = subs[i];
        subs[i] = subs[i + dir];
        subs[i + dir] = temp;
        saveData(true);
        renderManageSubs();
    }
}

function addCategory() {
    let n = document.getElementById('new-cat-name').value.trim();
    if (n) {
        categories.push({ id: n, uid: createUid('cat'), icon: 'layers', subs: [] });
        document.getElementById('new-cat-name').value = '';
        saveData(true);
        renderManageCats();
        renderCatGrid();
    }
}

function addSubCategory() {
    let n = document.getElementById('new-sub-name').value.trim();
    if (n && activeSettingsCat !== null) {
        if (!categories[activeSettingsCat].subs) categories[activeSettingsCat].subs = [];
        categories[activeSettingsCat].subs.push(n);
        document.getElementById('new-sub-name').value = '';
        saveData(true);
        renderManageSubs();
    }
}

function deleteSub(index) {
    if (confirm('Zmazať podkategóriu?')) {
        const cat = categories[activeSettingsCat];
        const deletedSubName = cat.subs[index];
        cat.subs.splice(index, 1);

        db.forEach(item => {
            if (item.category === cat.id && item.sub === deletedSubName) {
                item.sub = '';
                item.categoryId = cat.uid;
                item.updatedAt = new Date().toISOString();
                item.version = (parseInt(item.version, 10) || 0) + 1;
                queueMutation(item);
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
    deleteCategoryByIndex(activeSettingsCat);
}

function selectCat(id, e = null) {
    if (e) e.preventDefault();

    selectedCat = id;
    selectedSub = '';

    document.querySelectorAll('.cat-tile').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
    const cat = categories.find(c => c.id === id);

    const subSection = document.getElementById('sub-section');
    const subGrid = document.getElementById('sub-grid');

    if (cat && cat.subs && cat.subs.length > 0) {
        subSection.classList.remove('hidden');
        subGrid.innerHTML = cat.subs.map(s => `<button type="button" onclick="selectSub('${s}', event)" data-sub="${s}" class="sub-chip px-3 py-2 rounded-xl font-extrabold uppercase shadow-sm">${s}</button>`).join('');
    } else {
        subSection.classList.add('hidden');
        subGrid.innerHTML = '';
    }
}

function selectSub(s, e = null) {
    if (e) e.preventDefault();
    selectedSub = s;
    document.querySelectorAll('.sub-chip').forEach(el => el.classList.toggle('active', el.dataset.sub === s));
}
