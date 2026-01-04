/* ===============================
   ULTRA SIMPLE WORKING VERSION
================================= */

const SUPABASE_URL = "https://hkxmgufbjqmncwbydtht.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY";
const TABLE = "vcf_entries";
const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbBNUAFFXUuUmJdrkj1f";

// Initialize
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get elements
const form = document.getElementById('vcfForm');
const formMsg = document.getElementById('formMsg');

// SIMPLE FORM HANDLER
if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log("📝 Form submitted!");
        
        // Get values
        const name = document.getElementById('name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        
        console.log(`Name: "${name}", Phone: "${phone}"`);
        
        // Basic validation
        if (!name || !phone) {
            showMsg("Please fill in both fields", 'error');
            return;
        }
        
        // Clean phone
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 7) {
            showMsg("Enter a valid phone number (7+ digits)", 'error');
            return;
        }
        
        // Show loading
        showMsg("Processing...", 'loading');
        
        try {
            console.log("🔄 Trying to save to Supabase...");
            
            // SIMPLE INSERT
            const { error } = await supabase
                .from(TABLE)
                .insert([{ 
                    name: name, 
                    phone: cleanPhone,
                    created_at: new Date().toISOString()
                }]);
            
            if (error) {
                console.error("❌ Supabase error:", error);
                
                if (error.message.includes("row-level security")) {
                    showMsg("Database permissions issue. Using local storage.", 'error');
                    saveLocal(name, cleanPhone);
                } else {
                    showMsg("Registration failed: " + error.message, 'error');
                }
                return;
            }
            
            console.log("✅ Saved to Supabase!");
            showMsg("✅ Registered! Redirecting...", 'success');
            
            // Generate VCF
            generateVCF(name, cleanPhone);
            
            // Clear form
            form.reset();
            
            // Redirect to WhatsApp
            setTimeout(() => {
                console.log("🔗 Opening WhatsApp...");
                window.open(WHATSAPP_CHANNEL, '_blank');
            }, 1500);
            
        } catch (error) {
            console.error("💥 Unexpected error:", error);
            showMsg("Something went wrong. Try again.", 'error');
        }
    });
}

// SIMPLE MESSAGE FUNCTION
function showMsg(text, type = 'info') {
    if (formMsg) {
        formMsg.textContent = text;
        formMsg.className = `form-msg ${type}`;
        formMsg.style.display = 'block';
        console.log(`[${type.toUpperCase()}] ${text}`);
    }
}

// LOCAL FALLBACK
function saveLocal(name, phone) {
    try {
        const registrations = JSON.parse(localStorage.getItem('guru_vcf') || '[]');
        registrations.push({ name, phone, date: new Date().toISOString() });
        localStorage.setItem('guru_vcf', JSON.stringify(registrations));
        console.log("📱 Saved locally:", registrations.length, "registrations");
        showMsg("✅ Saved locally! Redirecting...", 'success');
        
        // Still redirect to WhatsApp
        setTimeout(() => {
            window.open(WHATSAPP_CHANNEL, '_blank');
        }, 1500);
        
        form.reset();
    } catch (e) {
        console.error("Local save error:", e);
        showMsg("Failed to save. Try again.", 'error');
    }
}

// SIMPLE VCF GENERATOR
function generateVCF(name, phone) {
    try {
        const vcf = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL:${phone}
END:VCARD`;
        
        const blob = new Blob([vcf], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_')}.vcf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        console.log("📄 VCF downloaded");
    } catch (e) {
        console.error("VCF error:", e);
    }
}

// UPDATE COUNTERS
async function updateCounters() {
    try {
        console.log("🔄 Updating counter...");
        const { count, error } = await supabase
            .from(TABLE)
            .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
            const registered = count;
            const remaining = Math.max(0, 800 - registered);
            
            // Update display
            const regEl = document.getElementById('regCount');
            const remEl = document.getElementById('remCount');
            if (regEl) regEl.textContent = registered;
            if (remEl) remEl.textContent = remaining;
            
            console.log(`📊 Count: ${registered} registered, ${remaining} remaining`);
        }
    } catch (e) {
        console.error("Counter error:", e);
    }
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Guru VCF Loaded");
    console.log("📱 WhatsApp:", WHATSAPP_CHANNEL);
    console.log("💾 Table:", TABLE);
    
    // Add CSS
    const style = document.createElement('style');
    style.textContent = `
        .form-msg {
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            text-align: center;
            display: none;
        }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .loading { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .info { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }
    `;
    document.head.appendChild(style);
    
    // Update counters
    updateCounters();
});

// DEBUG FUNCTIONS
window.debugInfo = function() {
    console.log("=== DEBUG INFO ===");
    console.log("URL:", window.location.href);
    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Table:", TABLE);
    console.log("WhatsApp:", WHATSAPP_CHANNEL);
    
    // Test Supabase
    supabase.from(TABLE).select('count').limit(1)
        .then(r => console.log("Supabase test:", r))
        .catch(e => console.log("Supabase error:", e));
};

// Run debug on load
setTimeout(() => {
    console.log("ℹ️ Type 'debugInfo()' in console for debugging");
}, 2000);
