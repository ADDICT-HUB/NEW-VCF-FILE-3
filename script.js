/* ===============================
  GURU V.C.F. 3 - FIXED WORKING SCRIPT
================================= */

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

const TABLE = "vcf_entries";
const TARGET = 800; // Changed to 800 as per your site
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

/* ===============================
   HELPER FUNCTIONS - SIMPLIFIED
================================ */
function showMessage(type, text, duration = 5000) {
    if (formMsg) {
        formMsg.textContent = text;
        formMsg.className = `form-msg form-${type}`;
        formMsg.style.display = 'block';
        
        console.log(`[${type.toUpperCase()}] ${text}`);
        
        if (duration > 0) {
            setTimeout(() => {
                formMsg.style.display = 'none';
            }, duration);
        }
    }
}

function cleanText(text) {
    return String(text || "").trim().slice(0, 100); // Limit length
}

function normalizePhone(phone) {
    return String(phone || "").replace(/\D+/g, "");
}

function isValidPhone(phone) {
    const cleaned = normalizePhone(phone);
    return cleaned.length >= 7 && cleaned.length <= 15;
}

/* ===============================
   COUNTERS - SIMPLIFIED & FIXED
================================ */
async function updateCounters() {
    try {
        console.log("🔄 Fetching counter from Supabase...");
        
        // SIMPLE COUNT QUERY
        const { count, error } = await supabase
            .from(TABLE)
            .select('*', { count: 'exact', head: false });
        
        if (error) {
            console.error("❌ Counter error:", error);
            showMessage('error', 'Cannot load count. Please refresh.', 3000);
            return;
        }
        
        const registered = count || 0;
        const remaining = Math.max(0, TARGET - registered);
        
        console.log(`✅ Found ${registered} registrations`);
        
        // Update display
        regCount.textContent = registered;
        remCount.textContent = remaining;
        tarCount.textContent = TARGET;
        
        // Update progress bars if they exist
        const regFill = document.getElementById("regFill");
        const remFill = document.getElementById("remFill");
        
        if (regFill && remFill) {
            const regPercent = (registered / TARGET) * 100;
            const remPercent = (remaining / TARGET) * 100;
            
            regFill.style.width = `${regPercent}%`;
            remFill.style.width = `${remPercent}%`;
        }
        
        return registered;
        
    } catch (err) {
        console.error("❌ Counter exception:", err);
        showMessage('error', 'Failed to load counter.', 3000);
    }
}

/* ===============================
   REGISTRATION - SIMPLIFIED
================================ */
async function registerUser(nameRaw, phoneRaw) {
    const name = cleanText(nameRaw);
    const phone = normalizePhone(phoneRaw);
    
    // Basic validation
    if (!name || name.length < 2) {
        return { ok: false, msg: "Please enter a valid name (min 2 characters)." };
    }
    
    if (!phone || !isValidPhone(phone)) {
        return { ok: false, msg: "Please enter a valid phone number (7-15 digits)." };
    }
    
    try {
        console.log("🔍 Checking for duplicate phone...");
        
        // Check duplicate phone (SIMPLIFIED QUERY)
        const { data: existing, error: dupError } = await supabase
            .from(TABLE)
            .select('phone')
            .eq('phone', phone)
            .limit(1);
        
        if (dupError) {
            console.error("❌ Duplicate check error:", dupError);
            throw dupError;
        }
        
        if (existing && existing.length > 0) {
            return { ok: false, msg: "This phone number is already registered." };
        }
        
        console.log("📝 Inserting new registration...");
        
        // SIMPLE INSERT
        const { error: insertError } = await supabase
            .from(TABLE)
            .insert([{ 
                name: name, 
                phone: phone,
                created_at: new Date().toISOString()
            }]);
        
        if (insertError) {
            console.error("❌ Insert error:", insertError);
            
            // Check for specific errors
            if (insertError.message.includes('row-level security')) {
                return { ok: false, msg: "Database permissions issue. Please contact admin." };
            }
            
            throw insertError;
        }
        
        console.log("✅ Registration successful!");
        
        // Generate simple VCF
        generateSimpleVCF(name, phone);
        
        return { ok: true, msg: "Registration successful!" };
        
    } catch (err) {
        console.error("❌ Registration error:", err);
        return { ok: false, msg: "Registration failed. Please try again." };
    }
}

/* ===============================
   SIMPLE VCF GENERATION
================================ */
function generateSimpleVCF(name, phone) {
    try {
        const vcfContent = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL:${phone}
END:VCARD`;
        
        // Create download
        const blob = new Blob([vcfContent], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_')}.vcf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log("📄 VCF downloaded");
    } catch (err) {
        console.error("❌ VCF generation error:", err);
    }
}

/* ===============================
   FORM SUBMIT - FIXED
================================ */
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("🚀 Form submitted");
        
        // Reset message
        formMsg.textContent = "";
        formMsg.className = "form-msg";
        
        // Get values
        const name = document.getElementById("name").value;
        const phone = document.getElementById("phone").value;
        
        // Disable button and show loading
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">⏳</span> Processing...';
        }
        
        showMessage('loading', 'Processing your registration...', 0);
        
        // Register user
        const res = await registerUser(name, phone);
        
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Submit for VCF & Join Channel';
        }
        
        if (!res.ok) {
            showMessage('error', res.msg);
            return;
        }
        
        // SUCCESS - Show success message
        showMessage('success', '✅ Registration successful!', 2000);
        
        // Update counter immediately
        await updateCounters();
        
        // Clear form
        form.reset();
        
        // Redirect to WhatsApp after 2 seconds
        console.log("🔗 Redirecting to WhatsApp...");
        setTimeout(() => {
            window.open(WHATSAPP_CHANNEL, '_blank');
            // Also change location if you want
            // window.location.href = WHATSAPP_CHANNEL;
        }, 2000);
    });
}

/* ===============================
   INITIALIZATION
================================ */
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🎯 Guru V.C.F. 3 Initialized");
    console.log("🔑 Supabase URL:", SUPABASE_URL);
    console.log("🎯 Target:", TARGET);
    console.log("📱 WhatsApp:", WHATSAPP_CHANNEL);
    
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .form-msg {
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
            font-weight: 500;
        }
        .form-success {
            background: rgba(40, 167, 69, 0.15);
            color: #28a745;
            border: 1px solid rgba(40, 167, 69, 0.3);
        }
        .form-error {
            background: rgba(220, 53, 69, 0.15);
            color: #dc3545;
            border: 1px solid rgba(220, 53, 69, 0.3);
        }
        .form-loading {
            background: rgba(13, 110, 253, 0.15);
            color: #0d6efd;
            border: 1px solid rgba(13, 110, 253, 0.3);
        }
    `;
    document.head.appendChild(style);
    
    // Load initial counters
    await updateCounters();
    
    // Auto-refresh counters every 10 seconds
    setInterval(updateCounters, 10000);
    
    // Add debug info to console
    console.log("✅ System ready. Test with:");
    console.log("   Name: Test User");
    console.log("   Phone: 1234567890 (or any 10-digit number)");
});

/* ===============================
   DEBUG FUNCTIONS
================================ */
// Test Supabase connection
window.testConnection = async function() {
    console.log("🔧 Testing Supabase connection...");
    showMessage('loading', 'Testing connection...', 3000);
    
    try {
        const { data, error } = await supabase
            .from(TABLE)
            .select('count')
            .limit(1);
        
        if (error) {
            console.error("❌ Connection test failed:", error);
            showMessage('error', `Connection failed: ${error.message}`, 5000);
            return false;
        }
        
        console.log("✅ Connection test successful!");
        showMessage('success', '✅ Supabase connection working!', 3000);
        return true;
    } catch (err) {
        console.error("❌ Connection test error:", err);
        showMessage('error', `Connection error: ${err.message}`, 5000);
        return false;
    }
};

// Manually add a test registration
window.addTestRegistration = async function() {
    const testName = "Test User " + Date.now().toString().slice(-4);
    const testPhone = "1" + Date.now().toString().slice(-9);
    
    console.log("🧪 Adding test registration:", testName, testPhone);
    showMessage('loading', 'Adding test registration...', 3000);
    
    const result = await registerUser(testName, testPhone);
    
    if (result.ok) {
        console.log("✅ Test registration added!");
        showMessage('success', '✅ Test registration added!', 3000);
        await updateCounters();
    } else {
        console.log("❌ Test failed:", result.msg);
        showMessage('error', `Test failed: ${result.msg}`, 5000);
    }
};

// Check current count
window.checkCount = async function() {
    await updateCounters();
};

// Open browser console and run these commands to debug:
console.log("🛠️  DEBUG COMMANDS:");
console.log("   testConnection()   - Check Supabase connection");
console.log("   addTestRegistration() - Add a test registration");
console.log("   checkCount()       - Refresh counter");
