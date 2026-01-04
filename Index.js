// index.js - VCF Generation Server with Validation
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://hkxmgufbjqmncwbydtht.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreG1ndWZianFtbmN3YnlkdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg0NDMsImV4cCI6MjA4MDg0NDQ0M30.1yaFlEJqGVg48R57IliLVnkNAiYAFIBmZEdzJX9NRfY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper functions
function cleanText(text) {
  return String(text || '').replace(/[<>$%{}]/g, '').trim();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D+/g, '');
}

function isValidPhone(phone) {
  const cleaned = normalizePhone(phone);
  // Check if it's a valid length and doesn't contain repeating digits (like 1111111111)
  if (cleaned.length < 7 || cleaned.length > 15) return false;
  
  // Check for fake/pattern numbers
  const allSame = /^(\d)\1+$/.test(cleaned); // All same digits
  const sequential = /0123456789|9876543210|123456789|987654321/.test(cleaned); // Sequential
  const repeatedPattern = /^(\d{2,})\1+$/.test(cleaned); // Repeated pattern like 121212
  
  return !(allSame || sequential || repeatedPattern);
}

function checkOriginality(name, phone) {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '');
  const normalizedPhone = normalizePhone(phone);
  
  // Check for suspicious names
  const suspiciousNames = ['test', 'demo', 'example', 'user', 'admin', 'fake'];
  if (suspiciousNames.some(s => normalizedName.includes(s))) {
    return { valid: false, reason: 'Suspicious name detected' };
  }
  
  // Check for common fake names
  const commonFakeNames = ['john doe', 'jane doe', 'abc', 'xyz', 'aaa', 'bbb'];
  if (commonFakeNames.includes(normalizedName)) {
    return { valid: false, reason: 'Common fake name detected' };
  }
  
  return { valid: true };
}

// Check duplicates in Supabase
async function checkDuplicates(name, phone) {
  try {
    const normalizedName = cleanText(name).toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    
    // Check by phone
    const { data: phoneDup, error: phoneErr } = await supabase
      .from('vcf_entries')
      .select('*')
      .eq('phone', normalizedPhone)
      .limit(1);
    
    if (phoneErr) throw phoneErr;
    
    // Check by name (fuzzy match - same name ignoring case)
    const { data: nameDup, error: nameErr } = await supabase
      .from('vcf_entries')
      .select('*')
      .ilike('name', `%${normalizedName}%`)
      .limit(1);
    
    if (nameErr) throw nameErr;
    
    return {
      phoneExists: phoneDup.length > 0,
      nameExists: nameDup.length > 0,
      existingData: phoneDup[0] || nameDup[0]
    };
  } catch (error) {
    console.error('Duplicate check error:', error);
    return { phoneExists: false, nameExists: false };
  }
}

// Store registration (optional)
async function storeRegistration(name, phone, email = '') {
  try {
    const { error } = await supabase
      .from('vcf_entries')
      .insert([
        {
          name: cleanText(name),
          phone: normalizePhone(phone),
          email: cleanText(email),
          created_at: new Date().toISOString()
        }
      ]);
    
    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
}

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>VCF Generator with Validation</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f9f9f9; padding: 20px; border-radius: 10px; }
        input, button { padding: 10px; margin: 5px 0; width: 100%; }
        .error { color: red; }
        .success { color: green; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📇 VCF Generator with Validation</h1>
        <p>Generates VCF files with duplicate checking and phone validation</p>
        
        <h3>Generate VCF:</h3>
        <form id="vcfForm">
          <input type="text" id="name" placeholder="Full Name" required><br>
          <input type="tel" id="phone" placeholder="Phone Number" required><br>
          <input type="email" id="email" placeholder="Email (optional)"><br>
          <button type="submit">Generate VCF</button>
        </form>
        <div id="message"></div>
        
        <h3>API Endpoints:</h3>
        <p><strong>POST /validate</strong> - Validate and check duplicates</p>
        <p><strong>GET /generate</strong> - Generate VCF file</p>
        <p><strong>GET /stats</strong> - Get registration statistics</p>
      </div>
      
      <script>
        document.getElementById('vcfForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = document.getElementById('name').value;
          const phone = document.getElementById('phone').value;
          const email = document.getElementById('email').value;
          
          const response = await fetch('/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email })
          });
          
          const result = await response.json();
          const message = document.getElementById('message');
          
          if (result.valid) {
            message.innerHTML = '<p class="success">✅ ' + result.message + '</p>';
            // Generate VCF
            const params = new URLSearchParams({ name, phone, email });
            window.open('/generate?' + params.toString(), '_blank');
          } else {
            message.innerHTML = '<p class="error">❌ ' + result.message + '</p>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Validation endpoint
app.post('/validate', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    
    // Basic validation
    if (!name || !phone) {
      return res.json({ valid: false, message: 'Name and phone are required' });
    }
    
    // Clean inputs
    const cleanedName = cleanText(name);
    const cleanedPhone = normalizePhone(phone);
    
    // Check originality
    const originality = checkOriginality(cleanedName, cleanedPhone);
    if (!originality.valid) {
      return res.json({ valid: false, message: originality.reason });
    }
    
    // Validate phone
    if (!isValidPhone(cleanedPhone)) {
      return res.json({ valid: false, message: 'Invalid phone number detected' });
    }
    
    // Check duplicates
    const duplicates = await checkDuplicates(cleanedName, cleanedPhone);
    
    if (duplicates.phoneExists) {
      return res.json({ 
        valid: false, 
        message: 'This phone number is already registered',
        duplicate: true 
      });
    }
    
    if (duplicates.nameExists) {
      return res.json({ 
        valid: false, 
        message: 'This name is already registered (or similar name exists)',
        duplicate: true 
      });
    }
    
    // Store registration if valid
    const storeResult = await storeRegistration(cleanedName, cleanedPhone, email);
    
    if (!storeResult.success) {
      console.error('Storage error:', storeResult.error);
    }
    
    res.json({ 
      valid: true, 
      message: 'Validation passed! Generating VCF...',
      stored: storeResult.success 
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ valid: false, message: 'Server error during validation' });
  }
});

// Enhanced VCF generation with validation
app.get('/generate', async (req, res) => {
  try {
    const { name, phone, email, company, title, address, website, bypass } = req.query;
    
    // Allow bypass for direct downloads (optional)
    if (bypass !== 'true') {
      const cleanedName = cleanText(name);
      const cleanedPhone = normalizePhone(phone);
      
      // Quick validation
      if (!cleanedName || !cleanedPhone) {
        return res.status(400).send('Name and phone are required');
      }
      
      if (!isValidPhone(cleanedPhone)) {
        return res.status(400).send('Invalid phone number');
      }
      
      // Quick duplicate check
      const duplicates = await checkDuplicates(cleanedName, cleanedPhone);
      if (duplicates.phoneExists || duplicates.nameExists) {
        return res.status(400).send('Duplicate entry detected');
      }
    }
    
    // Generate VCF content
    const vcfContent = `BEGIN:VCARD
VERSION:3.0
FN:${name || 'Contact'}
N:${(name || '').split(' ').reverse().join(';')};;;
ORG:${company || ''};
TITLE:${title || ''}
TEL;TYPE=CELL,VOICE:${phone || ''}
EMAIL;TYPE=INTERNET:${email || ''}
URL:${website || ''}
ADR;TYPE=WORK:;;${address || ''}
NOTE:Generated via VCF Generator Service
REV:${new Date().toISOString()}
END:VCARD`;
    
    // Set headers for VCF download
    const filename = `${(name || 'contact').replace(/[^a-z0-9]/gi, '_')}.vcf`;
    res.setHeader('Content-Type', 'text/vcard');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(vcfContent);
    
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).send('Error generating VCF');
  }
});

// Statistics endpoint
app.get('/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vcf_entries')
      .select('*');
    
    if (error) throw error;
    
    const stats = {
      total: data.length,
      uniquePhones: new Set(data.map(d => d.phone)).size,
      uniqueNames: new Set(data.map(d => d.name.toLowerCase())).size,
      recent: data.slice(-10).reverse() // Last 10 entries
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Cleanup endpoint (optional - for admin)
app.post('/cleanup', async (req, res) => {
  try {
    // Get all entries
    const { data, error } = await supabase
      .from('vcf_entries')
      .select('*');
    
    if (error) throw error;
    
    // Find duplicates by phone
    const phoneMap = new Map();
    const duplicates = [];
    
    data.forEach(entry => {
      if (phoneMap.has(entry.phone)) {
        duplicates.push(entry.id);
      } else {
        phoneMap.set(entry.phone, entry.id);
      }
    });
    
    // Delete duplicates (optional - be careful!)
    if (duplicates.length > 0 && req.query.confirm === 'true') {
      const { error: deleteError } = await supabase
        .from('vcf_entries')
        .delete()
        .in('id', duplicates);
      
      if (deleteError) throw deleteError;
      
      res.json({ 
        message: `Cleaned ${duplicates.length} duplicates`,
        removed: duplicates 
      });
    } else {
      res.json({ 
        message: `${duplicates.length} duplicates found`,
        duplicates: duplicates.length,
        confirmRequired: true 
      });
    }
    
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ VCF Generator with Validation running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`🔒 Features:`);
  console.log(`   • Phone number validation`);
  console.log(`   • Duplicate checking (phone & name)`);
  console.log(`   • Fake number detection`);
  console.log(`   • Supabase integration`);
});
