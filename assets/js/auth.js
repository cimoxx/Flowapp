/* Google prihlásenie (v2.51.0).
 * Appka posiela backendu iba vlastný session token, ktorý backend vydá po overení
 * Google účtu. Povolené účty sú v hárku FlowUsers v Google Sheets. */
const FLOW_GOOGLE_CLIENT_ID = '729250002198-q7rnsnqci5nnegi9u12bjvuibe8bfjku.apps.googleusercontent.com';
// Rovnaký kľúč číta aj inline skript v <head> index.html (skryje dáta ešte pred vykreslením).
const FLOW_AUTH_KEY = 'flow_auth_session_v251';

function flowAuthSession() {
    try {
        const session = JSON.parse(localStorage.getItem(FLOW_AUTH_KEY) || 'null');
        return session && session.token ? session : null;
    } catch (_) {
        return null;
    }
}

function flowAuthToken() {
    const session = flowAuthSession();
    return session ? session.token : '';
}

function flowAuthHasSession() {
    return Boolean(flowAuthToken());
}

function flowAuthSetStatus(text, tone = 'info') {
    const el = document.getElementById('auth-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone;
}

let flowAuthGisReady = false;

function flowAuthInitGis() {
    if (flowAuthGisReady || !window.google || !google.accounts || !google.accounts.id) return;
    flowAuthGisReady = true;
    google.accounts.id.initialize({
        client_id: FLOW_GOOGLE_CLIENT_ID,
        callback: flowAuthOnCredential,
        auto_select: true,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
        context: 'signin'
    });
    flowAuthRenderButton();
}

function flowAuthRenderButton() {
    if (!flowAuthGisReady || flowAuthHasSession()) return;
    const holder = document.getElementById('auth-google-btn');
    if (!holder) return;
    holder.innerHTML = '';
    google.accounts.id.renderButton(holder, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        locale: 'sk',
        width: 260
    });
    google.accounts.id.prompt();
}

// GIS sa načítava asynchrónne; zavolá window.onGoogleLibraryLoad, ak ešte nebol načítaný.
window.onGoogleLibraryLoad = flowAuthInitGis;

function flowAuthLock(message) {
    document.documentElement.classList.add('flow-locked');
    if (message) flowAuthSetStatus(message, 'warn');
    flowAuthInitGis();
    flowAuthRenderButton();
}

function flowAuthShort(text, max = 160) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

// Zrozumiteľná hláška podľa odpovede servera. `ping` je odpoveď na ?get=ping (verzia backendu bez prihlásenia),
// alebo null, keď server neodpovedal správne.
function flowAuthLoginFailureMessage(result, ping) {
    const code = result && result.code;
    if (code === 'not_allowed' || code === 'login_failed') return (result && result.message) || 'Prihlásenie sa nepodarilo.';
    if (code === 'busy') return 'Server je práve zaneprázdnený. Skús to o chvíľu znova.';
    if (code === 'unknown_action') return 'Backend nepozná prihlásenie. Nasaď Google Apps Script v2.54.2 alebo novší.';
    if (code === 'server_error') return `Chyba na strane servera: ${flowAuthShort(result && result.message)}`;
    // Odpoveď bez kódu: starý script, alebo chyba, ktorú starý script nevie pomenovať.
    if (ping && ping.backendVersion) {
        return `Server (v${ping.backendVersion}) vrátil neočakávanú odpoveď: ${flowAuthShort(result && result.message) || 'bez textu'}`;
    }
    return 'Backend neodpovedá správne alebo nemá prihlásenie. Skontroluj nasadenie Google Apps Script (Manage deployments → Version).';
}

async function flowAuthPing() {
    try {
        const res = await flowAuthRawFetch(`${GOOGLE_URL}?get=ping`);
        if (!res.ok) return null;
        const data = await res.json();
        return data && data.status === 'success' && data.backendVersion ? data : null;
    } catch (_) {
        return null;
    }
}

async function flowAuthOnCredential(response) {
    if (!response || !response.credential) return;
    flowAuthSetStatus('Overujem účet…');
    try {
        const res = await flowAuthRawFetch(GOOGLE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'googleLogin', credential: response.credential })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();

        if (result && result.status === 'success' && result.sessionToken) {
            localStorage.setItem(FLOW_AUTH_KEY, JSON.stringify({
                token: result.sessionToken,
                expiresAt: result.expiresAt || '',
                user: result.user || {}
            }));
            flowAuthSetStatus('Prihlásené, načítavam dáta…', 'good');
            // Čistý štart: sync, kategórie aj plán sa načítajú už s platným prihlásením.
            location.reload();
            return;
        }

        // Odpoveď bez kódu môže znamenať starý script aj chybu servera. Ping (verzia backendu) to rozlíši.
        const ping = result && !result.code ? await flowAuthPing() : null;
        flowAuthSetStatus(flowAuthLoginFailureMessage(result, ping), 'warn');
        if (result && result.code === 'not_allowed' && window.google) google.accounts.id.disableAutoSelect();
    } catch (error) {
        console.error('Google login error:', error);
        flowAuthSetStatus('Prihlásenie sa nepodarilo. Skontroluj pripojenie a skús znova.', 'warn');
    }
}

function flowAuthHandleUnauthorized() {
    if (!flowAuthHasSession()) return;
    localStorage.removeItem(FLOW_AUTH_KEY);
    flowAuthRenderAccount();
    flowAuthLock('Prihlásenie vypršalo. Prihlás sa znova, neodoslané zmeny ostali v telefóne.');
}

async function flowAuthLogout() {
    const pending = typeof syncQueue !== 'undefined' && Array.isArray(syncQueue) ? syncQueue.length : 0;
    const question = pending > 0
        ? `Máš ${pending} neodoslaných zmien. Ostanú v telefóne a odošlú sa po ďalšom prihlásení. Odhlásiť sa?`
        : 'Odhlásiť sa z Flow?';
    if (!confirm(question)) return;

    const token = flowAuthToken();
    try {
        await flowAuthRawFetch(GOOGLE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'logout', token })
        });
    } catch (_) {
        // Odhlásenie v telefóne platí aj bez spojenia; session na serveri časom vyprší.
    }
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    localStorage.removeItem(FLOW_AUTH_KEY);
    location.reload();
}

function flowAuthRenderAccount() {
    const name = document.getElementById('auth-account-name');
    const email = document.getElementById('auth-account-email');
    if (!name || !email) return;
    const user = (flowAuthSession() || {}).user || {};
    name.textContent = user.name || 'Neprihlásený';
    email.textContent = user.email || '';
}

// Všetky požiadavky na backend idú cez fetch. Bez prihlásenia sa vôbec neodošlú
// a odpoveď „Unauthorized“ vráti appku na prihlasovaciu obrazovku.
const flowAuthRawFetch = window.fetch.bind(window);

function flowAuthIsBackendUrl(input) {
    const url = typeof input === 'string' ? input : String(input && input.url || '');
    return url.startsWith(GOOGLE_URL);
}

function flowAuthIsUnauthorized(payload) {
    return Boolean(payload && payload.status === 'error' &&
        (payload.code === 'unauthorized' || payload.message === 'Unauthorized'));
}

window.fetch = async function flowAuthFetch(input, init) {
    if (!flowAuthIsBackendUrl(input)) return flowAuthRawFetch(input, init);

    if (!flowAuthHasSession()) {
        return new Response(JSON.stringify({ status: 'error', code: 'unauthorized', message: 'Unauthorized' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const res = await flowAuthRawFetch(input, init);
    res.clone().json().then(payload => {
        if (flowAuthIsUnauthorized(payload)) flowAuthHandleUnauthorized();
    }).catch(() => {});
    return res;
};

if (flowAuthHasSession()) {
    document.documentElement.classList.remove('flow-locked');
} else {
    flowAuthLock();
}
document.addEventListener('DOMContentLoaded', flowAuthRenderAccount);
