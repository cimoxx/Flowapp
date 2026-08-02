function renderCatGrid() {
    const catGrid = document.getElementById('cat-grid');
    if (!catGrid) return;
    catGrid.innerHTML = categories.map(c => `
        <div onclick="selectCat('${c.id}', event)" data-id="${c.id}" class="cat-tile flex flex-col items-center justify-center p-1 font-extrabold uppercase">
            <i data-lucide="${c.icon || 'layers'}"></i>
            <span>${c.id}</span>
        </div>
    `).join('');
    lucide.createIcons();
}

function selectCat(id, e = null) { 
    if (e) e.preventDefault();
    selectedCat = id; 
    selectedSub = ''; 
    
    document.querySelectorAll('.cat-tile').forEach(el => el.classList.toggle('selected', el.dataset.id === id)); 
    const cat = categories.find(c => c.id === id); 
    
    const subSection = document.getElementById('sub-section');
    const subGrid = document.getElementById('sub-grid');
    
    if(cat && cat.subs && cat.subs.length > 0) { 
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
