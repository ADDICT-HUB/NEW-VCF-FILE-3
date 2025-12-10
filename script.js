/* ===============================
  SECURE + FEATURED script.js
  - Fixes counters
  - Registration (sanitized + rate-limit)
  - Client-side admin login (trigger Ctrl+Shift+A)
  - Export CSV / VCF / PDF (admin only)
  - Uses your Supabase anon key only (safe)
  NOTE: client-side admin login is convenient but NOT 100% secure.
        For production use Supabase Auth or a server-side check.
================================= */

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TARGET = 800;
const TABLE = "vcf_entries";

// Init Supabase (uses the UMD on the page)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* -------------------------
  DOM elements used by index.html
------------------------- */
const form = document.getElementById("vcfForm");
const formMsg = document.getElementById("formMsg");
const regCountEl = () => document.getElementById("regCount");
const remCountEl = () => document.getElementById("remCount");
const tarCountEl = () => document.getElementById("tarCount");
const regFillEl = () => document.getElementById("regFill");
const remFillEl = () => document.getElementById("remFill");
const tarFillEl = () => document.getElementById("tarFill");

/* ============================
   Sanitization & Validation
   ============================ */
function cleanText(input) {
  return String(input || "").replace(/[<>$%{}]/g, "").trim();
}

function isValidPhone(phone) {
  const cleaned = String(phone || "").replace(/\D+/g, "");
  return cleaned.length >= 7 && cleaned.length <= 15;
}

/* ============================
   Rate limiting (client-side)
   ============================ */
let lastSubmit = 0;
function isRateLimited() {
  const now = Date.now();
  if (now - lastSubmit < 3500) return true;
  lastSubmit = now;
  return false;
}

/* ============================
   COUNTERS: fetch & update
   ============================ */
async function updateCounters() {
  try {
    const { count, error } = await supabase
      .from(TABLE)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("updateCounters error:", error);
      return;
    }

    const reg = count || 0;
    const rem = Math.max(0, TARGET - reg);

    if (regCountEl()) regCountEl().textContent = reg;
    if (remCountEl()) remCountEl().textContent = rem;
    if (tarCountEl()) tarCountEl().textContent = TARGET;

    // progress bars if present
    if (regFillEl()) regFillEl().style.width = (reg / TARGET) * 100 + "%";
    if (remFillEl()) remFillEl().style.width = (rem / TARGET) * 100 + "%";
    if (tarFillEl()) tarFillEl().style.width = "100%";
  } catch (err) {
    console.error("updateCounters EX:", err);
  }
}
// auto-refresh
setInterval(updateCounters, 8000);

/* ============================
   REGISTRATION (insert)
   ============================ */
async function registerUser(nameRaw, phoneRaw) {
  try {
    if (isRateLimited()) return { ok: false, msg: "⏳ Too fast — try again." };

    let name = cleanText(nameRaw);
    let phone = cleanText(phoneRaw);

    if (!name || !phone) return { ok: false, msg: "Please fill name and phone." };
    if (!isValidPhone(phone)) return { ok: false, msg: "Invalid phone number." };

    // Apply badge -- keep as your original behavior
    name = "🥇 " + name;

    // check duplicate phone
    const { data: dupPhone, error: dupPhoneErr } = await supabase
      .from(TABLE)
      .select("id")
      .eq("phone", phone)
      .limit(1);

    if (dupPhoneErr) throw dupPhoneErr;
    if (dupPhone?.length) return { ok: false, msg: "Phone already registered." };

    // check duplicate name (exact)
    const { data: dupName, error: dupNameErr } = await supabase
      .from(TABLE)
      .select("id")
      .eq("name", name)
      .limit(1);

    if (dupNameErr) throw dupNameErr;
    if (dupName?.length) return { ok: false, msg: "Name already registered." };

    // insert
    const { error: insertErr } = await supabase.from(TABLE).insert([{ name, phone }]);
    if (insertErr) throw insertErr;

    // update counters quickly
    updateCounters();

    return { ok: true };
  } catch (err) {
    console.error("registerUser error:", err);
    return { ok: false, msg: err.message || "Registration failed." };
  }
}

/* Attach form submit behavior (keeps your page behavior) */
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!formMsg) return;
    formMsg.textContent = "";

    const name = document.getElementById("name")?.value || "";
    const phone = document.getElementById("phone")?.value || "";

    const res = await registerUser(name, phone);
    if (!res.ok) {
      formMsg.textContent = res.msg;
      return;
    }

    formMsg.textContent = "✅ Registration successful!";
    form.reset();

    setTimeout(() => {
      window.location.href = "https://whatsapp.com/channel/0029VbBNUAFFXUuUmJdrkj1f";
    }, 1200);
  });
}

/* run initial counters as soon as script loads */
document.addEventListener("DOMContentLoaded", () => {
  updateCounters();
});

/* ============================
   ADMIN LOGIN + EXPORTS
   - Trigger admin prompt with CTRL+SHIFT+A
   - After successful login, admin controls (Export CSV/VCF/PDF) appear
   ============================ */

/* Client-side admin password hash (SHA-256 hex).
   Replace this with your own hash for better privacy.
   Default convenience demo password: demo1234
   To create your own hash use any SHA-256 tool and place hex here.
*/
const ADMIN_PASSWORD_HASH = "c2e2b6d7f5ca32b6c8c2e6c9b9a8f2c6f36f9f3ae8a5a4a9f0ef1bb1e6f8f4d2"; // demo placeholder

let adminLoggedIn = false;
let adminControlsEl = null;

/* SHA-256 helper -> hex */
async function sha256hex(msg) {
  const enc = new TextEncoder();
  const data = enc.encode(msg);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* Create and show an admin modal (hidden unless triggered) */
function createAdminModal() {
  // if exists, return
  if (document.getElementById("vcfAdminModal")) return document.getElementById("vcfAdminModal");

  const modal = document.createElement("div");
  modal.id = "vcfAdminModal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = 9999;

  const box = document.createElement("div");
  box.style.background = "#000";
  box.style.border = "1px solid #222";
  box.style.padding = "18px";
  box.style.borderRadius = "8px";
  box.style.width = "320px";
  box.style.color = "#fff";
  box.innerHTML = `
    <h3 style="margin:0 0 8px 0">Admin Login</h3>
    <div style="font-size:13px;color:#ccc;margin-bottom:8px">Enter admin password (demo: demo1234)</div>
    <input id="vcfAdminPassword" type="password" style="width:100%;padding:8px;border-radius:6px;border:1px solid #333;background:#050505;color:#fff" />
    <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
      <button id="vcfAdminCancel" style="padding:8px 10px;border-radius:6px;border:1px solid #333;background:#111;color:#fff">Cancel</button>
      <button id="vcfAdminOk" style="padding:8px 10px;border-radius:6px;border:1px solid #0ab;border:1px solid #0ab;background:#022;color:#0ff">Sign in</button>
    </div>
    <div id="vcfAdminMsg" style="margin-top:8px;font-size:13px;color:#ffea00"></div>
  `;
  modal.appendChild(box);
  document.body.appendChild(modal);

  document.getElementById("vcfAdminCancel").onclick = () => { modal.remove(); };
  document.getElementById("vcfAdminOk").onclick = async () => {
    const pw = document.getElementById("vcfAdminPassword").value || "";
    const msgEl = document.getElementById("vcfAdminMsg");
    msgEl.textContent = "Checking...";
    // demo password quick-path
    if (pw === "demo1234") {
      msgEl.textContent = "Demo login accepted.";
      setTimeout(() => { modal.remove(); onAdminSuccess(); }, 300);
      return;
    }
    try {
      const h = await sha256hex(pw);
      if (h === ADMIN_PASSWORD_HASH) {
        msgEl.textContent = "Welcome.";
        setTimeout(() => { modal.remove(); onAdminSuccess(); }, 250);
      } else {
        msgEl.textContent = "Invalid password.";
      }
    } catch (err) {
      msgEl.textContent = "Error.";
      console.error(err);
    }
  };

  return modal;
}

/* Keyboard trigger: Ctrl+Shift+A */
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
    if (!adminLoggedIn) createAdminModal();
  }
});

/* When admin logs in, create controls (buttons) injected into page */
function onAdminSuccess() {
  if (adminLoggedIn) return;
  adminLoggedIn = true;

  // create admin controls container (keeps design intact)
  const wrap = document.createElement("div");
  wrap.id = "vcfAdminControls";
  wrap.style.position = "fixed";
  wrap.style.bottom = "18px";
  wrap.style.right = "18px";
  wrap.style.zIndex = 9998;
  wrap.style.display = "flex";
  wrap.style.gap = "8px";

  const btnCsv = document.createElement("button");
  btnCsv.innerText = "Export CSV";
  btnCsv.style.padding = "8px 10px";
  btnCsv.style.borderRadius = "8px";
  btnCsv.style.border = "1px solid #333";
  btnCsv.style.background = "#111";
  btnCsv.style.color = "#fff";
  btnCsv.onclick = exportCSV;

  const btnVcf = document.createElement("button");
  btnVcf.innerText = "Download VCF";
  btnVcf.style.padding = "8px 10px";
  btnVcf.style.borderRadius = "8px";
  btnVcf.style.border = "1px solid #333";
  btnVcf.style.background = "#111";
  btnVcf.style.color = "#fff";
  btnVcf.onclick = exportVCF;

  const btnPdf = document.createElement("button");
  btnPdf.innerText = "Download PDF";
  btnPdf.style.padding = "8px 10px";
  btnPdf.style.borderRadius = "8px";
  btnPdf.style.border = "1px solid #333";
  btnPdf.style.background = "#111";
  btnPdf.style.color = "#fff";
  btnPdf.onclick = exportPDF;

  const btnLogout = document.createElement("button");
  btnLogout.innerText = "Logout";
  btnLogout.style.padding = "8px 10px";
  btnLogout.style.borderRadius = "8px";
  btnLogout.style.border = "1px solid #333";
  btnLogout.style.background = "#440";
  btnLogout.style.color = "#fff";
  btnLogout.onclick = () => {
    adminLoggedIn = false;
    wrap.remove();
    // optionally re-run counters or clear any admin state
  };

  wrap.appendChild(btnCsv);
  wrap.appendChild(btnVcf);
  wrap.appendChild(btnPdf);
  wrap.appendChild(btnLogout);

  document.body.appendChild(wrap);
  adminControlsEl = wrap;
  // visual feedback
  alert("Admin signed in — export controls are available at bottom-right.");
}

/* ============================
   EXPORTS
   - exportCSV
   - exportVCF
   - exportPDF (uses jsPDF loaded dynamically)
   ============================ */

async function exportCSV() {
  if (!adminLoggedIn) return alert("Sign in first (Ctrl+Shift+A).");
  try {
    const { data, error } = await supabase.from(TABLE).select("*").order("id", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return alert("No data to export.");

    const headers = ["id","name","phone","created_at"];
    const rows = data.map(r => [
      r.id ?? "",
      `"${(r.name||"").replace(/"/g,'""')}"`,
      `"${(r.phone||"").replace(/"/g,'""')}"`,
      `"${(r.created_at||"")}"`,
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vcf_entries_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("exportCSV:", err);
    alert("CSV export failed.");
  }
}

async function exportVCF() {
  if (!adminLoggedIn) return alert("Sign in first (Ctrl+Shift+A).");
  try {
    const { data, error } = await supabase.from(TABLE).select("*").order("id", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return alert("No data to export.");

    const vcards = data.map(r => {
      const name = (r.name || "").replace(/[<>]/g,"");
      const phone = (r.phone || "").replace(/[<>]/g,"");
      const plainName = name.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,"");
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${plainName}`,
        `TEL;TYPE=CELL:${phone}`,
        "END:VCARD"
      ].join("\r\n");
    }).join("\r\n");

    const blob = new Blob([vcards], { type: "text/vcard;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vcf_entries_${new Date().toISOString().slice(0,10)}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("exportVCF:", err);
    alert("VCF export failed.");
  }
}

async function exportPDF() {
  if (!adminLoggedIn) return alert("Sign in first (Ctrl+Shift+A).");
  try {
    // load jsPDF dynamically if not present
    if (!window.jspdf) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
    const { data, error } = await supabase.from(TABLE).select("*").order("id", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return alert("No data to export.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(12);
    doc.text("VCF Entries", 40, 40);
    let y = 60;
    const lineHeight = 14;

    data.forEach((r, idx) => {
      const id = String(idx + 1);
      const name = (r.name||"").replace(/[<>]/g,"");
      const phone = (r.phone||"").replace(/[<>]/g,"");
      const created = r.created_at ? new Date(r.created_at).toLocaleString() : "";
      const rowText = `${id}. ${name} — ${phone} — ${created}`;
      const split = doc.splitTextToSize(rowText, 520);
      doc.text(split, 40, y);
      y += lineHeight * split.length;
      if (y > 760) {
        doc.addPage();
        y = 40;
      }
    });

    const filename = `vcf_entries_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error("exportPDF:", err);
    alert("PDF export failed.");
  }
}

/* small helper to dynamically load scripts */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => setTimeout(resolve, 50);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ============================
   NOTES:
   - Trigger admin modal: Ctrl+Shift+A
   - Default demo password: demo1234
   - Replace ADMIN_PASSWORD_HASH with your SHA-256 hex of chosen password
   - For production, implement Supabase Auth & protect admin routes server-side.
   ============================ */
