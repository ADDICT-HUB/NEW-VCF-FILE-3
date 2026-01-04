/* ===============================
  ENHANCED GURU GAINS – script.js
  Supabase-powered registration system with VCF generation
================================= */

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TABLE = "vcf_entries";
const TARGET = 1000;
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbBNUAFFXUuUmJdrkj1f";

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ===============================
   DOM ELEMENTS
================================ */
const form = document.getElementById("vcfForm");
const formMsg = document.getElementById("formMsg");
const regCount = document.getElementById("regCount");
const remCount = document.getElementById("remCount");
const tarCount = document.getElementById("tarCount");
const progressBar = document.getElementById("progressBar");

/* ===============================
   ENHANCED HELPER FUNCTIONS
================================ */
function cleanText(v) {
  return String(v || "").replace(/[<>$%{}]/g, "").trim();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D+/g, "");
}

function isValidPhone(phone) {
  const cleaned = normalizePhone(phone);
  
  // Basic length check
  if (cleaned.length < 7 || cleaned.length > 15) {
    return false;
  }
  
  // Enhanced validation - detect fake numbers
  const patterns = [
    /^(\d)\1+$/, // All same digits (1111111, 2222222, etc.)
    /^1234567890$/, // Sequential ascending
    /^0987654321$/, // Sequential descending
    /^(\d{2,})\1+$/, // Repeated pattern (121212, 123123)
  ];
  
  // Check if phone matches any fake pattern
  const isFake = patterns.some(pattern => pattern.test(cleaned));
  
  return !isFake;
}

function formatPhoneDisplay(phone) {
  const cleaned = normalizePhone(phone);
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0,3)}) ${cleaned.substring(3,6)}-${cleaned.substring(6)}`;
  }
  return cleaned;
}

/* ===============================
   ENHANCED COUNTERS WITH PROGRESS
================================ */
async function updateCounters() {
  try {
    const { data, error, count } = await supabase
      .from(TABLE)
      .select("id", { count: 'exact', head: false });

    if (error) {
      console.error("Counter error:", error.message);
      return;
    }

    const registered = count || 0;
    const remaining = Math.max(0, TARGET - registered);
    const progress = Math.min(100, (registered / TARGET) * 100);

    // Update display
    regCount.textContent = registered.toLocaleString();
    remCount.textContent = remaining.toLocaleString();
    tarCount.textContent = TARGET.toLocaleString();
    
    // Update progress bar if exists
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `${Math.round(progress)}%`;
    }
    
    // Update page title with count
    document.title = `(${registered}/${TARGET}) VCF Registration`;
    
    return registered;
  } catch (err) {
    console.error("Counter exception:", err);
  }
}

/* ===============================
   ENHANCED REGISTRATION
================================ */
async function registerUser(nameRaw, phoneRaw) {
  const name = cleanText(nameRaw);
  const phone = normalizePhone(phoneRaw);

  // Validation
  if (!name || !phone) {
    return { ok: false, msg: "Please fill in both name and phone number." };
  }

  if (!isValidPhone(phone)) {
    return { ok: false, msg: "Invalid phone number detected. Please use a real number." };
  }

  // Name validation
  if (name.length < 2 || name.length > 50) {
    return { ok: false, msg: "Name must be between 2 and 50 characters." };
  }

  // Check for suspicious names
  const suspiciousNames = ['test', 'demo', 'example', 'user', 'admin', 'fake'];
  const lowerName = name.toLowerCase();
  if (suspiciousNames.some(s => lowerName.includes(s))) {
    return { ok: false, msg: "Please use a real name." };
  }

  try {
    // Enhanced duplicate check
    const { data: existing, error: checkError } = await supabase
      .from(TABLE)
      .select("name, phone, created_at")
      .or(`phone.eq.${phone},name.ilike.%${name}%`)
      .limit(2);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      // Check exact phone match
      const exactPhoneMatch = existing.find(entry => entry.phone === phone);
      if (exactPhoneMatch) {
        return { 
          ok: false, 
          msg: `This number is already registered by ${exactPhoneMatch.name}.` 
        };
      }
      
      // Check similar name
      const similarName = existing.find(entry => 
        entry.name.toLowerCase().includes(lowerName) || 
        lowerName.includes(entry.name.toLowerCase())
      );
      if (similarName) {
        return { 
          ok: false, 
          msg: `Similar name "${similarName.name}" already registered.` 
        };
      }
    }

    // Insert with additional data
    const userData = {
      name,
      phone,
      formatted_phone: formatPhoneDisplay(phone),
      ip_address: await getUserIP(), // Optional
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString()
    };

    const { error: insertError, data: insertedData } = await supabase
      .from(TABLE)
      .insert([userData])
      .select();

    if (insertError) throw insertError;

    // Generate VCF for the user
    generateVCF(name, phone);

    return { 
      ok: true, 
      data: insertedData?.[0],
      msg: "Registration successful!" 
    };

  } catch (err) {
    console.error("Registration error:", err);
    return { 
      ok: false, 
      msg: "Registration failed. Please try again later." 
    };
  }
}

/* ===============================
   VCF GENERATION FUNCTION
================================ */
function generateVCF(name, phone) {
  const vcfContent = `BEGIN:VCARD
VERSION:3.0
FN:${name}
N:${name.split(' ').reverse().join(';')};;;
TEL;TYPE=CELL,VOICE:${phone}
ORG:Guru Gains;
TITLE:Registered Member;
NOTE:Registered via Guru Gains VCF System
REV:${new Date().toISOString()}
END:VCARD`;

  // Create download link
  const blob = new Blob([vcfContent], { type: 'text/vcard' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/\s+/g, '_')}_gurugains.vcf`;
  link.style.display = 'none';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/* ===============================
   GET USER IP (OPTIONAL)
================================ */
async function getUserIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return 'unknown';
  }
}

/* ===============================
   ENHANCED FORM SUBMIT
================================ */
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Reset message
    formMsg.textContent = "";
    formMsg.className = "message";
    
    // Get values
    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    
    // Show loading state
    formMsg.textContent = "⏳ Processing your registration...";
    formMsg.className = "message loading";
    
    // Disable form during processing
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = "Processing...";
    submitBtn.disabled = true;
    
    // Register user
    const res = await registerUser(name, phone);
    
    if (!res.ok) {
      // Show error
      formMsg.textContent = `❌ ${res.msg}`;
      formMsg.className = "message error";
      
      // Re-enable form
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
      return;
    }
    
    // Success
    formMsg.textContent = "✅ Registration successful! Downloading VCF...";
    formMsg.className = "message success";
    
    // Update counters
    await updateCounters();
    
    // Clear form
    form.reset();
    
    // Re-enable button briefly before redirect
    submitBtn.textContent = "✅ Success!";
    submitBtn.disabled = false;
    
    // Countdown before WhatsApp redirect
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      formMsg.textContent = `✅ Registration complete! Redirecting to WhatsApp in ${countdown}...`;
      countdown--;
      
      if (countdown < 0) {
        clearInterval(countdownInterval);
        // Redirect to WhatsApp
        window.location.href = WHATSAPP_CHANNEL;
        
        // Fallback: Open in new tab if redirect fails
        setTimeout(() => {
          window.open(WHATSAPP_CHANNEL, '_blank');
        }, 100);
      }
    }, 1000);
  });
}

/* ===============================
   INPUT VALIDATION (REAL-TIME)
================================ */
// Phone input formatting
const phoneInput = document.getElementById("phone");
if (phoneInput) {
  phoneInput.addEventListener("input", function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    // Auto-format as user types
    if (value.length > 3 && value.length <= 6) {
      value = value.replace(/(\d{3})(\d+)/, '$1-$2');
    } else if (value.length > 6) {
      value = value.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3');
    }
    
    e.target.value = value;
  });
}

// Name input validation
const nameInput = document.getElementById("name");
if (nameInput) {
  nameInput.addEventListener("blur", function(e) {
    if (e.target.value.length > 0 && e.target.value.length < 2) {
      formMsg.textContent = "Name should be at least 2 characters";
      formMsg.className = "message warning";
    }
  });
}

/* ===============================
   INITIALIZATION
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Guru Gains VCF System Initialized");
  
  // Initial counter update
  await updateCounters();
  
  // Auto-refresh counters every 30 seconds
  setInterval(updateCounters, 30000);
  
  // Add loading animation
  const style = document.createElement('style');
  style.textContent = `
    .message {
      padding: 12px;
      border-radius: 6px;
      margin: 15px 0;
      text-align: center;
      transition: all 0.3s ease;
    }
    .message.loading {
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeaa7;
    }
    .message.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .message.warning {
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeaa7;
    }
    button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
  
  // Auto-focus name input
  if (nameInput) {
    setTimeout(() => nameInput.focus(), 100);
  }
});
