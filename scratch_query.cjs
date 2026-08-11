const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Failed to read .env file', e);
  process.exit(1);
}

const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const [key, ...val] = trimmed.split('=');
  if (key) {
    env[key.trim()] = val.join('=').trim();
  }
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function run() {
  console.log('Querying public.profiles...');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  console.log('Profiles:', profiles, 'Error:', pError);

  console.log('Querying public.user_roles...');
  const { data: roles, error: rError } = await supabase.from('user_roles').select('*');
  console.log('Roles:', roles, 'Error:', rError);

  console.log('Querying public.suppliers (first 5)...');
  const { data: sups, error: sError } = await supabase.from('suppliers').select('*').limit(5);
  console.log('Suppliers (first 5):', sups, 'Error:', sError);
}

run();
