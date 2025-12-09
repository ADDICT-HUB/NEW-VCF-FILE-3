/* script.js
   Double-mode: localStorage fallback + optional Supabase (paste keys below)
*/

/* ====== SUPABASE KEYS PLACEHOLDER ======
   When you're ready to use Supabase, paste your info here:
*/
const SUPABASE_URL = "https://imgoxflvovahburtpxyb.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZ294Zmx2b3ZhaGJ1cnRweHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODQ2MzUsImV4cCI6MjA4MDE2MDYzNX0.Z8JlmaTgtxoKC5Nn_DxgqA-nWMuw54tf-ALJ9PetCHI"; 

// CONFIG
const TARGET = 800;

// local fallback 'db'
let db = { target: TARGET, registered: 0, entries: [] };

// load from localStorage (fallback)
function loadLocal() {
  try {
    const raw = localStorage.getItem('vcf_wildery_db');
    if (raw) {
      const obj = JSON.parse(raw);
      if (typeof obj === 'object') db = Object.assign(db, obj);
    }
  } catch(e){ console.warn('loadLocal error', e) }
  db.target = TARGET;
}

// save to localStorage
function saveLocal() {
  try { localStorage.setItem('vcf_wildery_db', JSON.stringify(db)); }
  catch(e){ console.warn('saveLocal error', e) }
}

// UI refresh
function refreshUI() {
  const reg = db.registered || 0;
  const rem = Math.max(0, db.target - reg);
  const tar = db.target || TARGET;

  document.getElementById('regCount').textContent = reg;
  document.getElementById('remCount').textContent = rem;
  document.getElementById('tarCount').textContent = tar;

  const regPct = tar ? Math.round((reg / tar) * 100) : 0;
  const remPct = tar ? Math.round((rem / tar) * 100) : 0;

  document.getElementById('regFill').style.width = regPct + '%';
  document.getElementById('remFill').style.width = remPct + '%';
  document.getElementById('tarFill').style.width = '100%';
}

// local register (fallback)
function registerLocal(name, phone) {
  if (!name || !phone) return { ok:false, msg:'Please fill name & phone.'};
  // duplicate check
  if (db.entries.some(e => e.phone === phone)) return { ok:false, msg:'Phone already registered.'};
  if (db.registered >= db.target) return { ok:false, msg:'Target reached.'};

  db.entries.push({ name, phone, at: new Date().toISOString() });
  db.registered += 1;
  saveLocal();
  return { ok:true };
}

/* ===== Supabase helpers (lazy load) ===== */
let useSupabase = false;
let supabase = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  if (useSupabase) return true;
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js');
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useSupabase = true;
    return true;
  } catch (err) {
    console.error('initSupabase error', err);
    return false;
  }
}

// fetch counts from supabase (requires table 'vcf_entries')
async function fetchCountsSupabase() {
  try {
    const { data, error, count } = await supabase.from('vcf_entries').select('id', { count: 'exact' });
    if (error) throw error;
    const registered = Array.isArray(data) ? data.length : 0;
    db.registered = registered;
    db.target = TARGET;
    refreshUI();
    return true;
  } catch (err) {
    console.error('fetchCountsSupabase error', err);
    return false;
  }
}

// insert entry to supabase
async function insertSupabase(name, phone) {
  try {
    // check duplicate by phone
    const { data: dup, error: dupErr } = await supabase.from('vcf_entries').select('id').eq('phone', phone).limit(1);
    if (dupErr) throw dupErr;
    if (Array.isArray(dup) && dup.length) return { ok:false, msg:'Phone already registered.' };

    const { data, error } = await supabase.from('vcf_entries').insert([{ name, phone }]);
    if (error) throw error;
    return { ok:true };
  } catch (err) {
    console.error('insertSupabase error', err);
    return { ok:false, msg:'Submission failed.' };
  }
}

/* ===== Wiring & events ===== */
loadLocal();
refreshUI();

// --- NEW: Initialize Supabase counts on page load ---
(async function initCounts() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    await initSupabase();
    await fetchCountsSupabase();

    // live update every 5 seconds
    setInterval(fetchCountsSupabase, 5000);
  }
})();

const form = document.getElementById('vcfForm');
const formMsg = document.getElementById('formMsg');
const contactBtn = document.getElementById('contactBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.textContent = '';

  const name = (document.getElementById('name').value || '').trim();
  const phone = (document.getElementById('phone').value || '').trim();

  if (!name || !phone) {
    formMsg.textContent = 'Please fill name and phone.';
    return;
  }

  // prefer Supabase if keys present
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const ok = await initSupabase();
    if (ok) {
      formMsg.textContent = 'Submitting...';
      const res = await insertSupabase(name, phone);
      formMsg.textContent = res.ok ? 'Registration received. Thank you.' : (res.msg || 'Failed.');
      if (res.ok) {
        await fetchCountsSupabase();
        form.reset();
      }
      return;
    }
  }

  // fallback: local
  const r = registerLocal(name, phone);
  if (r.ok) {
    formMsg.textContent = 'Registration received. Thank you.';
    refreshUI();
    form.reset();
  } else {
    formMsg.textContent = r.msg || 'Submission failed.';
  }
});

// contact admin (WhatsApp)
contactBtn.addEventListener('click', () => {
  window.location.href = 'https://wa.me/254700000000';
});
