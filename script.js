/* ===============================
  SECURE + FEATURED script.js
  - Registration (sanitized + rate-limit)
  - Counters & progress bars
  - Auto-download buttons when TARGET reached
  - Uses your Supabase anon key only (safe)
================================= */

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TARGET = 800;
const TABLE = "vcf_entries";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* -------------------------
  DOM elements
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

    // Update numbers
    if (regCountEl()) regCountEl().textContent = reg;
    if (remCountEl()) remCountEl().textContent = rem;
    if (tarCountEl()) tarCountEl().textContent = TARGET;

    // Update bars
    const regPercent = (reg / TARGET) * 100;
    const remPercent = (rem / TARGET) * 100;

    if (regFillEl()) regFillEl().style.width = regPercent + "%";
    if (remFillEl()) {
      remFillEl().style.width = remPercent + "%";
      remFillEl().style.left = (100 - remPercent) + "%"; // shrink from right
    }
    if (tarFillEl()) tarFillEl().style.width = "100%";

    // ✅ Show download buttons if target reached
    if (reg >= TARGET) showDownloadButtons();

  } catch (err) {
    console.error("updateCounters EX:", err);
  }
}

// auto-refresh counters every 8s
setInterval(updateCounters, 8000);

/* ============================
   REGISTRATION
============================ */
async function registerUser(nameRaw, phoneRaw) {
  try {
    if (isRateLimited()) return { ok: false, msg: "⏳ Too fast — try again." };

    let name = cleanText(nameRaw);
    let phone = cleanText(phoneRaw);

    if (!name || !phone) return { ok: false, msg: "Please fill name and phone." };
    if (!isValidPhone(phone)) return { ok: false, msg: "Invalid phone number." };

    name = "🥇 " + name;

    // Check duplicate phone
    const { data: dupPhone } = await supabase
      .from(TABLE)
      .select("id")
      .eq("phone", phone)
      .limit(1);
    if (dupPhone?.length) return { ok: false, msg: "Phone already registered." };

    // Insert record
    const { error: insertErr } = await supabase.from(TABLE).insert([{ name, phone }]);
    if (insertErr) throw insertErr;

    updateCounters();

    return { ok: true };
  } catch (err) {
    console.error("registerUser error:", err);
    return { ok: false, msg: err.message || "Registration failed." };
  }
}

/* -------------------------
   FORM SUBMISSION
------------------------- */
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!formMsg) return;
    formMsg.textContent = "";

    const name = document.getElementById("name")?.value || "";
    const phone = document.getElementById("phone")?.value || "";

    if (!name || !phone) {
      formMsg.textContent = "Please fill name and phone.";
      return;
    }

    formMsg.textContent = "Submitting...";

    const res = await registerUser(name, phone);

    if (!res.ok) {
      formMsg.textContent = res.msg;
      return;
    }

    formMsg.textContent = "✅ Registered! Redirecting to WhatsApp...";
    form.reset();
    updateCounters();

    setTimeout(() => {
      window.location.href = "https://whatsapp.com/channel/0029VbBNUAFFXUuUmJdrkj1f";
    }, 1200);
  });
}

/* ============================
   AUTO DOWNLOAD BUTTONS
============================ */
function showDownloadButtons() {
  if (document.getElementById("downloadSection")) return; // avoid duplicates

  const wrap = document.createElement("div");
  wrap.id = "downloadSection";
  wrap.style.display = "flex";
  wrap.style.justifyContent = "center";
  wrap.style.gap = "12px";
  wrap.style.marginTop = "16px";

  const createBtn = (text, onClick) => {
    const btn = document.createElement("button");
    btn.innerText = text;
    btn.className = "btn more";
    btn.onclick = onClick;
    return btn;
  };

  wrap.appendChild(createBtn("Download CSV", exportCSV));
  wrap.appendChild(createBtn("Download VCF", exportVCF));
  wrap.appendChild(createBtn("Download PDF", exportPDF));

  const container = document.querySelector(".form-card") || document.body;
  container.appendChild(wrap);
}

/* ============================
   EXPORT FUNCTIONS
============================ */
async function exportCSV() {
  try {
    const { data, error } = await supabase.from(TABLE).select("*").order("id", { ascending: true });
    if (error) throw error;
    if (!data || !data.length) return alert("No data to export.");

    const csvContent = data.map(r => `"${r.name}","${r.phone}"`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entries_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("CSV export failed:", err);
    alert("Failed to download CSV.");
  }
}

async function exportVCF() {
  try {
    const { data, error } = await supabase.from(TABLE).select("*").order("id", { ascending: true });
    if (error) throw error;
    if (!data || !data.length) return alert("No data to export.");

    const vcards = data.map(r => {
      const name = (r.name || "").replace(/[<>]/g,"");
      const phone = (r.phone || "").replace(/[<>]/g,"");
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${name}`,
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
    console.error("VCF export failed:", err);
    alert("Failed to download VCF.");
  }
}

async function exportPDF() {
  alert("PDF export is not implemented yet."); // optional
}

/* ============================
   INITIALIZE
============================ */
document.addEventListener("DOMContentLoaded", updateCounters);
