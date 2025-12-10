/* CLEAN VCF REGISTRATION SCRIPT
   Fully Supabase-powered
   Works with admin.html
   No LocalStorage, no conflicts
*/

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TARGET = 800;

// Init Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI Elements
const form = document.getElementById("vcfForm");
const formMsg = document.getElementById("formMsg");

// =========================
// Validate Phone Number
// =========================
function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 6;
}

// =========================
// Fetch Total Count
// =========================
async function updateCounters() {
  try {
    const { count, error } = await supabase
      .from("vcf_entries")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    const reg = count || 0;
    const rem = Math.max(0, TARGET - reg);

    document.getElementById("regCount").textContent = reg;
    document.getElementById("remCount").textContent = rem;
    document.getElementById("tarCount").textContent = TARGET;
  } catch (err) {
    console.error("Count error:", err.message);
  }
}

// =========================
// Insert Into Supabase
// =========================
async function registerUser(name, phone) {
  try {
    // Check phone duplicate
    const { data: dup, error: dupErr } = await supabase
      .from("vcf_entries")
      .select("id")
      .eq("phone", phone)
      .limit(1);

    if (dupErr) throw dupErr;
    if (dup?.length) return { ok: false, msg: "Phone already registered." };

    // Check name duplicate
    const { data: dupName, error: dupNameErr } = await supabase
      .from("vcf_entries")
      .select("id")
      .ilike("name", name)
      .limit(1);

    if (dupNameErr) throw dupNameErr;
    if (dupName?.length) return { ok: false, msg: "Name already registered." };

    // Insert
    const { error } = await supabase
      .from("vcf_entries")
      .insert([{ name, phone }]);

    if (error) throw error;

    return { ok: true };
  } catch (err) {
    return { ok: false, msg: err.message };
  }
}

// =========================
// Form Submit
// =========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = "🥇 " + document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!name || !phone) {
    formMsg.textContent = "Please fill name and phone.";
    return;
  }

  if (!isValidPhone(phone)) {
    formMsg.textContent = "Invalid phone number.";
    return;
  }

  formMsg.textContent = "Submitting...";

  const res = await registerUser(name, phone);

  if (!res.ok) {
    formMsg.textContent = res.msg;
    return;
  }

  formMsg.textContent = "Registration successful!";
  form.reset();

  updateCounters();

  setTimeout(() => {
    window.location.href =
      "https://whatsapp.com/channel/0029VbBNUAFFXUuUmJdrkj1f";
  }, 1200);
});

// =========================
// Auto-Init
// =========================
updateCounters();
setInterval(updateCounters, 8000);
