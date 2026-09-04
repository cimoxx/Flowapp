/* FLOW v2.50.0 — Google authentication gate */
const FLOW_AUTH_STORAGE_KEY = 'flow_auth_session_v250';
let flowAuthUser = null;
let flowAuthConfig = null;

function getFlowSessionToken() {
    try { return localStorage.getItem(FLOW_AUTH_STORAGE_KEY) || ''; } catch (_) { return ''; }
}

function setFlowSessionToken(token) {
    try {
        if (token) localStorage.setItem(FLOW_AUTH_STORAGE_KEY, token);
        else localStorage.removeItem(FLOW_AUTH_STORAGE_KEY);
    } catch (_) {}
}

function setAuthMessage(text, tone='neutral') {
    const el=document.getElementById('auth-message');
    if(!el)return;
    el.textContent=text||'';
    el.className=`auth-message tone-${tone}`;
}

function showAuthGate() {
    document.documentElement.classList.add('flow-auth-locked');
    document.getElementById('auth-gate')?.classList.remove('hidden');
    document.getElementById('flow-app-shell')?.setAttribute('aria-hidden','true');
}

function hideAuthGate() {
    document.documentElement.classList.remove('flow-auth-locked');
    document.getElementById('auth-gate')?.classList.add('hidden');
    document.getElementById('flow-app-shell')?.removeAttribute('aria-hidden');
}

function renderSignedInUser(user) {
    flowAuthUser=user||null;
    const name=document.getElementById('auth-user-name');
    const email=document.getElementById('auth-user-email');
    const avatar=document.getElementById('auth-user-avatar');
    if(name)name.textContent=user?.name||'Google účet';
    if(email)email.textContent=user?.email||'';
    if(avatar){
        if(user?.picture){avatar.src=user.picture;avatar.classList.remove('hidden');}
        else avatar.classList.add('hidden');
    }
}

async function fetchAuthConfig() {
    const r=await fetch(`${GOOGLE_URL}?get=auth_config`,{cache:'no-store'});
    const text=await r.text();
    let data;
    try{data=JSON.parse(text);}catch(_){throw new Error('Server neposlal platnú konfiguráciu prihlásenia.');}
    if(!r.ok||data.status!=='success')throw new Error(data.message||'Prihlásenie nie je nakonfigurované.');
    return data;
}

async function validateExistingSession() {
    const token=getFlowSessionToken();
    if(!token)return false;
    try{
        const r=await fetch(`${GOOGLE_URL}?get=auth_status&token=${encodeURIComponent(token)}`,{cache:'no-store'});
        const data=await r.json();
        if(data?.status==='success'&&data?.authenticated){
            renderSignedInUser(data.user);
            hideAuthGate();
            if(typeof window.startFlowApp==='function')window.startFlowApp();
            return true;
        }
    }catch(_){}
    setFlowSessionToken('');
    return false;
}

async function handleGoogleCredential(response) {
    const credential=response?.credential||'';
    if(!credential){setAuthMessage('Google neposlal prihlasovacie údaje. Skús to znova.','error');return;}
    setAuthMessage('Overujem účet…','neutral');
    try{
        const r=await fetch(GOOGLE_URL,{
            method:'POST',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body:JSON.stringify({action:'googleLogin',credential})
        });
        const text=await r.text();
        let data;
        try{data=JSON.parse(text);}catch(_){throw new Error('Server neposlal platnú odpoveď.');}
        if(!r.ok||data.status!=='success'||!data.sessionToken)throw new Error(data.message||'Prihlásenie nebolo povolené.');
        setFlowSessionToken(data.sessionToken);
        renderSignedInUser(data.user);
        setAuthMessage('');
        hideAuthGate();
        if(typeof window.startFlowApp==='function')window.startFlowApp();
    }catch(error){
        setFlowSessionToken('');
        setAuthMessage(error?.message||'Prihlásenie zlyhalo.','error');
    }
}

function renderGoogleButton() {
    const target=document.getElementById('google-signin-button');
    if(!target||!window.google?.accounts?.id||!flowAuthConfig?.clientId)return false;
    target.innerHTML='';
    google.accounts.id.initialize({
        client_id:flowAuthConfig.clientId,
        callback:handleGoogleCredential,
        use_fedcm_for_prompt:true,
        auto_select:false,
        cancel_on_tap_outside:true
    });
    google.accounts.id.renderButton(target,{
        theme:'outline',
        size:'large',
        shape:'pill',
        text:'continue_with',
        width:300,
        logo_alignment:'left'
    });
    return true;
}

async function flowLogout() {
    const token=getFlowSessionToken();
    try{
        if(token)await fetch(GOOGLE_URL,{
            method:'POST',
            headers:{'Content-Type':'text/plain;charset=utf-8'},
            body:JSON.stringify({action:'logout',token})
        });
    }catch(_){}
    setFlowSessionToken('');
    // Sensitive cached finance data must not remain available after explicit logout.
    const sensitivePrefixes=[
        'f_db_v20','f_sync_q_v20','f_cats_v20','f_categories_','f_pending_cat_sync_v20',
        'flow_recurring_plans_','flow_planned_events_','flow_budget_overrides_','flow_model_state_',
        'flowHistoricalAccuracyRepair:'
    ];
    try{
        Object.keys(localStorage).forEach(key=>{
            if(sensitivePrefixes.some(prefix=>key===prefix||key.startsWith(prefix)))localStorage.removeItem(key);
        });
    }catch(_){}
    location.reload();
}

async function initFlowAuth() {
    showAuthGate();
    setAuthMessage('Kontrolujem prihlásenie…');
    if(await validateExistingSession())return;
    try{
        flowAuthConfig=await fetchAuthConfig();
        if(!flowAuthConfig?.configured){
            setAuthMessage('Google prihlásenie ešte nie je nakonfigurované. Pozri docs/implementation/V2.50.0-IMPLEMENTACIA.md.','error');
            return;
        }
        setAuthMessage('Prihlás sa účtom, ktorý má povolený prístup.');
        let attempts=0;
        const timer=setInterval(()=>{
            attempts++;
            if(renderGoogleButton()||attempts>40)clearInterval(timer);
            if(attempts>40&&!window.google?.accounts?.id)setAuthMessage('Google prihlásenie sa nenačítalo. Skontroluj pripojenie a obnov stránku.','error');
        },150);
    }catch(error){
        setAuthMessage(error?.message||'Prihlásenie sa nepodarilo načítať.','error');
    }
}

document.addEventListener('DOMContentLoaded',initFlowAuth);
window.handleGoogleCredential=handleGoogleCredential;
window.flowLogout=flowLogout;
