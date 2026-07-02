// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error(`Erro: Arquivo .env.local não encontrado.`);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.substring(0, index).trim();
    let value = trimmed.substring(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log("---- RELATÓRIO DO BANCO DE DADOS ----");
  
  const tables = ['profiles', 'accounts', 'contacts', 'conversations', 'messages', 'whatsapp_config'];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      console.log(`❌ Tabela "${table}": Erro ao ler (${error.message})`);
    } else {
      console.log(`📊 Tabela "${table}": ${count} registros`);
    }
  }
}

check().catch(console.error);
