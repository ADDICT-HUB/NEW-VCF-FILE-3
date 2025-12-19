/* ===============================
  OFFICIAL GURU GAINS – FINAL script.js
  Supabase-powered registration system
================================= */

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TABLE = "vcf_entries";
const TARGET = 1000;

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ===============================
   DOM ELEMENTS
================================ */
const form = document.getElementById("vcfForm");
const formMsg = document.getElementById("formMsg");

const regCount = document.getElementById("regCount");
const remCount = document.getElementById("remCount");
const tarCount = document.getElementById("tarCount");

/* ===============================
   HELPERS
================================ */
function cleanText(v) {
  return String(v || "").replace(/[<>$%{}]/g, "").trim();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D+/g, "");
}

function isValidPhone(phone) {
  return phone.length >= 7 && phone.length <= 15;
}

/* ===============================
   COUNTERS (IMPORTANT FIX)
================================ */
async function updateCounters() {
  try {
    // DO NOT use head:true (causes silent failure with RLS)
    const { data, error } = await supabase
      .from(TABLE)
      .select("id");

    if (error) {
      console.error("Counter error:", error.message);
      return;
    }

    const registered = data.length;
    const remaining = Math.max(0, TARGET - registered);

    regCount.textContent = registered;
    remCount.textContent = remaining;
    tarCount.textContent = TARGET;
  } catch (err) {
    console.error("Counter exception:", err);
  }
}

/* ===============================
   REGISTRATION
================================ */
async function registerUser(nameRaw, phoneRaw) {
  const name = cleanText(nameRaw);
  const phone = normalizePhone(phoneRaw);

  if (!name || !phone) {
    return { ok: false, msg: "Fill all fields." };
  }

  if (!isValidPhone(phone)) {
    return { ok: false, msg: "Invalid phone number." };
  }

  try {
    // Check duplicate phone
    const { data: dup, error: dupErr } = await supabase
      .from(TABLE)
      .select("id")
      .eq("phone", phone)
      .limit(1);

    if (dupErr) throw dupErr;
    if (dup.length > 0) {
      return { ok: false, msg: "This number is already registered." };
    }

    // Insert
    const { error: insErr } = await supabase
      .from(TABLE)
      .insert([{ name, phone }]);

    if (insErr) throw insErr;

    return { ok: true };
  } catch (err) {
    console.error("Register error:", err.message);
    return { ok: false, msg: "Registration failed." };
  }
}

/* ===============================
   FORM SUBMIT
================================ */
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "";

    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;

    formMsg.textContent = "Submitting...";

    const res = await registerUser(name, phone);

    if (!res.ok) {
      formMsg.textContent = res.msg;
      return;
    }

    formMsg.textContent = "✅ You are registered!";
    form.reset();

    await updateCounters();

    setTimeout(() => {
      window.location.href =
        "https://whatsapp.com/channel/0029VbBNUAFFXUuUmJdrkj1f";
    }, 1200);
  });
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  updateCounters();
  setInterval(updateCounters, 8000);
});
