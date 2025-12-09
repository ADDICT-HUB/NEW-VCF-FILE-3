/* script.js
   Double-mode: localStorage fallback + Supabase
*/

const SUPABASE_URL = "https://imgoxflvovahburtpxyb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TARGET = 800;
let db = { target: TARGET, registered: 0, entries: [] };

// --- Local Storage ---
function loadLocal() {
  try {
    const raw = localStorage.getItem('vcf_wildery_db');
    if (raw) {
      const obj = JSON.parse(raw);
      if (typeof obj === 'object') db = Object.assign(db, obj);
    }
  } catch(e){ console.warn('loadLocal error', e); }
  db.target = TARGET;
}

function saveLocal() {
  try { localStorage.setItem('vcf_wildery_db', JSON.stringify(db)); }
  catch(e){ console.warn('saveLocal error', e); }
}

// --- UI Refresh ---
function refreshUI() {
  const reg = db.registered || 0;
  const rem = Math.max(0, db.target - reg);
  const tar = db.target || TARGET;

  document.getElementById('regCount').textContent = reg;
  document.getElementById('remCount').textContent = rem;
  document.getElementById('tarCount').textContent = tar;

  document.getElementById('regFill').style.width = Math.round((reg/tar)*100) + '%';
  document.getElementById('remFill').style.width = Math.round((rem/tar)*100) + '%';
  document.getElementById('tarFill').style.width = '100%';
}

// --- Local Registration ---
function registerLocal(name, phone) {
  if (!name || !phone) return { ok:false, msg:'Please fill name & phone.'};
  if (db.entries.some(e => e.phone === phone)) return { ok:false, msg:'Phone already registered.'};
  if (db.registered >= db.target) return { ok:false, msg:'Target reached.'};

  db.entries.push({ name, phone, at: new Date().toISOString() });
  db.registered += 1;
  saveLocal();
  return { ok:true };
}

// --- Supabase Helpers ---
let supabase = null;

async function loadSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  if (supabase) return true;
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load Supabase'));
      document.head.appendChild(s);
    });
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  } catch(e){ console.error(e); return false; }
}

// --- Fetch counts from Supabase ---
async function fetchCountsSupabase() {
  if (!supabase) return false;
  try {
    const { count, error } = await supabase
      .from('vcf_entries')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;

    db.registered = count || 0;
    db.target = TARGET;
    refreshUI();
    return true;
  } catch(e){
    console.error('Supabase fetch error:', e.message || e);
    return false;
  }
}

// --- Insert entry to Supabase ---
async function insertSupabase(name, phone) {
  try {
    const { data: dup, error: dupErr } = await supabase
      .from('vcf_entries')
      .select('id')
      .eq('phone', phone)
      .limit(1);

    if (dupErr) throw dupErr;
    if (dup && dup.length) return { ok:false, msg:'Phone already registered.' };

    const { error } = await supabase
      .from('vcf_entries')
      .insert([{ name, phone }]);

    if (error) throw error;
    return { ok:true };
  } catch(e) {
    console.error('Supabase insert error:', e.message || e);
    return { ok:false, msg: e.message || 'Submission failed.' };
  }
}

// --- Event Wiring ---
const form = document.getElementById('vcfForm');
const formMsg = document.getElementById('formMsg');
const contactBtn = document.getElementById('contactBtn');

async function initPage() {
  loadLocal();
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const ok = await loadSupabase();
    if (ok) await fetchCountsSupabase();
  }
  refreshUI();
}
initPage();

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.textContent = '';
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!name || !phone) {
    formMsg.textContent = 'Please fill name and phone.';
    return;
  }

  if (SUPABASE_URL && SUPABASE_ANON_KEY && supabase) {
    formMsg.textContent = 'Submitting...';
    const res = await insertSupabase(name, phone);
    formMsg.textContent = res.ok ? 'Registration received. Thank you.' : res.msg;
    if (res.ok) await fetchCountsSupabase();
    if (res.ok) form.reset();
    return;
  }

  // fallback: local
  const r = registerLocal(name, phone);
  formMsg.textContent = r.ok ? 'Registration received. Thank you.' : r.msg;
  if (r.ok) refreshUI();
  if (r.ok) form.reset();
});

// Contact admin
contactBtn.addEventListener('click', () => {
  window.location.href = 'https://wa.me/254700000000';
});
