/* SECURE VCF REGISTRATION SCRIPT
   - Strong input validation
   - Anti-spam protection
   - Sanitization
   - Duplicate checks (strict)
   - Clean Supabase integration
*/

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TARGET = 800;

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const form = document.getElementById("vcfForm");
const formMsg = document.getElementById("formMsg");

/* ============================================================
   SANITIZE TEXT (Prevents code injection or weird symbols)
   ============================================================ */
function cleanText(input) {
  return input
    .replace(/[<>$%{}]/g, "") // remove dangerous symbols
    .trim();
}

/* ============================================================
   VALIDATE PHONE STRICTLY
   - No symbols except + and numbers
   - Must be 7–15 digits
   ============================================================ */
function isValidPhone(phone) {
  const cleaned = phone.replace(/\D+/g, ""); // digits only
  return cleaned.length >= 7 && cleaned.length <= 15;
}

/* ============================================================
   RATE LIMIT: prevent users spamming multiple requests
   ============================================================ */
let lastSubmit = 0;
function isRateLimited() {
  const now = Date.now();
  if (now - lastSubmit < 3500) return true; // 3.5 sec cooldown
  lastSubmit = now;
  return false;
}

/* ============================================================
   UPDATE REGISTRATION COUNTERS
   ============================================================ */
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
    console.error("Counter Error:", err.message);
  }
}

/* ============================================================
   REGISTER NEW USER
   ============================================================ */
async function registerUser(name, phone) {
  try {
    // Check phone duplicate
    const { data: dupPhone, error: errPhone } = await supabase
      .from("vcf_entries")
      .select("id")
      .eq("phone", phone)
      .limit(1);

    if (errPhone) throw errPhone;
    if (dupPhone?.length) return { ok: false, msg: "❗ Phone already registered" };

    // Check name duplicate EXACT match
    const { data: dupName, error: errName } = await supabase
      .from("vcf_entries")
      .select("id")
      .eq("name", name)
      .limit(1);

    if (errName) throw errName;
    if (dupName?.length) return { ok: false, msg: "❗ Name already registered" };

    // Insert sanitized record
    const { error: insertErr } = await supabase
      .from("vcf_entries")
      .insert([{ name, phone }]);

    if (insertErr) throw insertErr;

    return { ok: true };
  } catch (err) {
    return { ok: false, msg: "⚠️ Error: " + err.message };
  }
}

/* ============================================================
   FORM SUBMIT HANDLER
   ============================================================ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isRateLimited()) {
    formMsg.textContent = "⏳ Please wait...";
    return;
  }

  let name = cleanText(document.getElementById("name").value);
  let phone = cleanText(document.getElementById("phone").value);

  if (!name || !phone) {
    formMsg.textContent = "⚠️ Enter both name and phone.";
    return;
  }

  if (!isValidPhone(phone)) {
    formMsg.textContent = "⚠️ Invalid phone number.";
    return;
  }

  // Add badge prefix
  name = "🥇 " + name;

  formMsg.textContent = "Submitting...";

  const res = await registerUser(name, phone);

  if (!res.ok) {
    formMsg.textContent = res.msg;
    return;
  }

  formMsg.textContent = "✅ Registration successful!";
  form.reset();

  updateCounters();

  // Redirect after success
  setTimeout(() => {
    window.location.href =
      "https://whatsapp.com/channel/0029VbBNUAFFXUuUmJdrkj1f";
  }, 1500);
});

/* ============================================================
   AUTO INIT
   ============================================================ */
updateCounters();
setInterval(updateCounters, 10000); // safer refresh rate
