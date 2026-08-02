function openChangelogModal() { 
    document.getElementById('changelog-modal').classList.remove('hidden'); 
}

function closeChangelogModal() { 
    document.getElementById('changelog-modal').classList.add('hidden'); 
}

function closeCatDetail() { 
    activeSettingsCat = null; 
    document.getElementById('settings-cat-detail').classList.add('hidden'); 
    document.getElementById('settings-home').classList.remove('hidden'); 
    renderManageCats(); 
}

function showScreen(s) { 
    document.getElementById('screen-home').classList.toggle('hidden', s !== 'home');
    document.getElementById('screen-analytics').classList.toggle('hidden', s !== 'analytics');
    document.getElementById('screen-burnrate').classList.toggle('hidden', s !== 'burnrate');
    document.getElementById('settings-screen').classList.toggle('hidden', s !== 'settings');

    document.getElementById('nav-home').classList.toggle('active', s === 'home');
    document.getElementById('nav-analytics').classList.toggle('active', s === 'analytics');
    document.getElementById('nav-burnrate').classList.toggle('active', s === 'burnrate');
    document.getElementById('nav-settings').classList.toggle('active', s === 'settings');

    if(s === 'settings') { 
        activeSettingsCat = null; 
        closeCatDetail(); 
        renderManageCats(); 
    } else if (s === 'analytics') {
        renderPresets();
        renderChartMonthChips();
        updateAnalytics();
    } else if (s === 'burnrate') {
        renderPresets();
        renderChartMonthChips();
        updateBurnRateTab();
    } else {
        renderList();
    }
}
