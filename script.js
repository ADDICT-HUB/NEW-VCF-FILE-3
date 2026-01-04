/* ===============================
  GURU V.C.F. 3 - NEW TABLE VERSION
================================= */

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";

// USE THIS NEW TABLE NAME
const TABLE = "vcf_registrations";
const TARGET = 800;
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

/* ===============================
   SIMPLE HELPER FUNCTIONS
================================ */
function showMessage(text, type = 'info', duration = 5000) {
    if (!formMsg) return;
    
    formMsg.textContent = text;
    formMsg.className = `form-msg ${type}`;
    formMsg.style.display = 'block';
    
    console.log(`[${type.toUpperCase()}] ${text}`);
    
    if (duration > 0) {
        setTimeout(() => {
            formMsg.style.display = 'none';
        }, duration);
    }
}

function normalizePhone(phone) {
    return String(phone || "").replace(/\D+/g, "");
}

function isValidPhone(phone) {
    const cleaned = normalizePhone(phone);
    return cleaned.length >= 7 && cleaned.length <= 15;
}

/* ===============================
   UPDATE COUNTERS - SIMPLE
================================ */
async function updateCounters() {
    try {
        console.log("🔄 Loading counter...");
        
        // Simple count query
        const { count, error } = await supabase
            .from(TABLE)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("Counter error:", error);
            showMessage("Could not load count", 'error', 3000);
            return 0;
        }
        
        const registered = count || 0;
        const remaining = Math.max(0, TARGET - registered);
        
        console.log(`✅ Found ${registered} registrations`);
        
        // Update UI
        regCount.textContent = registered;
        remCount.textContent = remaining;
        
        // Update progress bars if they exist
        const regFill = document.getElementById("regFill");
        const remFill = document.getElementById("remFill");
        
        if (regFill) {
            regFill.style.width = `${(registered / TARGET) * 100}%`;
        }
        if (remFill) {
            remFill.style.width = `${(remaining / TARGET) * 100}%`;
        }
        
        return registered;
        
    } catch (error) {
        console.error("Counter failed:", error);
        showMessage("Failed to load count", 'error', 3000);
        return 0;
    }
}

/* ===============================
   REGISTER USER - SIMPLE
================================ */
async function registerUser(name, phone) {
    const cleanedName = String(name || "").trim();
    const cleanedPhone = normalizePhone(phone);
    
    // Validation
    if (!cleanedName || cleanedName.length < 2) {
        return { success: false, message: "Please enter a valid name (min 2 characters)" };
    }
    
    if (!cleanedPhone || !isValidPhone(cleanedPhone)) {
        return { success: false, message: "Please enter a valid phone number (7-15 digits)" };
    }
    
    try {
        console.log("Checking duplicate...");
        
        // Check for duplicate phone
        const { data: existing, error: checkError } = await supabase
            .from(TABLE)
            .select('phone')
            .eq('phone', cleanedPhone)
            .limit(1);
        
        if (checkError) {
            console.error("Duplicate check error:", checkError);
            return { success: false, message: "Database error. Please try again." };
        }
        
        if (existing && existing.length > 0) {
            return { success: false, message: "This phone number is already registered" };
        }
        
        console.log("Inserting registration...");
        
        // Insert new registration
        const { error: insertError } = await supabase
            .from(TABLE)
            .insert([{
                name: cleanedName,
                phone: cleanedPhone,
                created_at: new Date().toISOString()
            }]);
        
        if (insertError) {
            console.error("Insert error:", insertError);
            return { success: false, message: "Registration failed. Please try again." };
        }
        
        console.log("✅ Registration successful!");
        
        // Generate VCF
        generateVCF(cleanedName, cleanedPhone);
        
        return { 
            success: true, 
            message: "Registration successful!" 
        };
        
    } catch (error) {
        console.error("Registration error:", error);
        return { success: false, message: "Something went wrong. Please try again." };
    }
}

/* ===============================
   GENERATE VCF
================================ */
function generateVCF(name, phone) {
    try {
        const vcfContent = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL:${phone}
END:VCARD`;
        
        const blob = new Blob([vcfContent], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_')}.vcf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log("VCF downloaded");
    } catch (error) {
        console.error("VCF error:", error);
    }
}

/* ===============================
   FORM SUBMISSION
================================ */
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Form submitted");
        
        // Get values
        const name = document.getElementById("name").value;
        const phone = document.getElementById("phone").value;
        
        // Disable button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Processing...';
        }
        
        // Show loading
        showMessage("Processing your registration...", 'loading', 0);
        
        // Register user
        const result = await registerUser(name, phone);
        
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Submit for VCF & Join Channel';
        }
        
        if (!result.success) {
            showMessage(result.message, 'error');
            return;
        }
        
        // SUCCESS
        showMessage("✅ Registration successful! Redirecting...", 'success', 2000);
        
        // Update counter
        await updateCounters();
        
        // Clear form
        form.reset();
        
        // Redirect to WhatsApp
        setTimeout(() => {
            console.log("Redirecting to WhatsApp...");
            window.open(WHATSAPP_CHANNEL, '_blank');
        }, 2000);
    });
}

/* ===============================
   INITIALIZATION
================================ */
document.addEventListener("DOMContentLoaded", async () => {
    console.log("=== GURU V.C.F. 3 STARTED ===");
    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Table:", TABLE);
    console.log("Target:", TARGET);
    console.log("WhatsApp:", WHATSAPP_CHANNEL);
    
    // Add CSS for messages
    const style = document.createElement('style');
    style.textContent = `
        .form-msg {
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
            font-weight: 500;
            display: none;
        }
        .success {
            background: rgba(40, 167, 69, 0.15);
            color: #28a745;
            border: 1px solid rgba(40, 167, 69, 0.3);
        }
        .error {
            background: rgba(220, 53, 69, 0.15);
            color: #dc3545;
            border: 1px solid rgba(220, 53, 69, 0.3);
        }
        .loading {
            background: rgba(13, 110, 253, 0.15);
            color: #0d6efd;
            border: 1px solid rgba(13, 110, 253, 0.3);
        }
        .info {
            background: rgba(108, 117, 125, 0.15);
            color: #6c757d;
            border: 1px solid rgba(108, 117, 125, 0.3);
        }
    `;
    document.head.appendChild(style);
    
    // Load initial count
    await updateCounters();
    
    // Auto-refresh every 30 seconds
    setInterval(updateCounters, 30000);
    
    console.log("✅ System ready!");
});

/* ===============================
   DEBUG FUNCTIONS (for console)
================================ */
// Test connection
window.testSupabase = async function() {
    console.log("Testing Supabase connection...");
    
    try {
        const { data, error } = await supabase
            .from(TABLE)
            .select('count')
            .limit(1);
        
        if (error) {
            console.error("❌ Connection failed:", error);
            showMessage(`Connection failed: ${error.message}`, 'error');
            return false;
        }
        
        console.log("✅ Connection successful!");
        showMessage("✅ Supabase connection working!", 'success');
        return true;
    } catch (error) {
        console.error("❌ Test error:", error);
        showMessage(`Test error: ${error.message}`, 'error');
        return false;
    }
};

// Add test data
window.addTestUser = async function() {
    const testName = "Test User " + Math.floor(Math.random() * 1000);
    const testPhone = "1" + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    
    console.log("Adding test user:", testName, testPhone);
    
    const result = await registerUser(testName, testPhone);
    
    if (result.success) {
        console.log("✅ Test user added!");
        await updateCounters();
    } else {
        console.log("❌ Failed:", result.message);
    }
};

// View all registrations
window.viewRegistrations = async function() {
    try {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error("Error:", error);
            return;
        }
        
        console.log("Recent registrations:");
        console.table(data || []);
    } catch (error) {
        console.error("Error:", error);
    }
};
