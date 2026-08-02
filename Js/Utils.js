function getCleanDateStr(dStr) {
    if (!dStr) return getTodayStr();
    let s = String(dStr).trim();
    
    if (s.includes('T') || s.includes('Z')) {
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const day = String(parsed.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    
    if (s.includes('.')) {
        const p = s.split('.');
        if (p.length === 3) {
            return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
    }
    return s;
}

function getTodayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildDateWithCurrentTime(dateInputVal) {
    const cleanD = getCleanDateStr(dateInputVal);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    return `${cleanD} ${timeStr}`;
}

function formatDayLabel(dateStr) {
    const cleanDate = getCleanDateStr(dateStr);
    if (!cleanDate) return 'Neznámy dátum';

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();

    if (cleanDate === todayStr) return 'Dnes';
    if (cleanDate === yesterdayStr) return 'Včera';

    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parseInt(parts[2])}. ${parseInt(parts[1])}. ${parts[0]}`;
    }

    return cleanDate;
}
