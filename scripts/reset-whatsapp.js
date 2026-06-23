const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Caminho do .env.local no projeto wacrm
const envPath = path.join(__dirname, '../.env.local');

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error(`Erro: Arquivo .env.local não encontrado em ${envPath}`);
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
    
    // Remove aspas se houver
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Conectando ao Supabase em:", supabaseUrl);
  console.log("Limpando a tabela whatsapp_config...");
  
  // Realiza o delete de todas as linhas de whatsapp_config
  const { data, error } = await supabase
    .from('whatsapp_config')
    .delete()
    .neq('phone_number_id', 'delete-all-force-hack-1234'); // neq garante que bate em tudo sem gte/lte chatos do postgrest se n tiver índice

  if (error) {
    console.error("❌ Erro ao deletar linhas:", error);
    process.exit(1);
  }
  
  console.log("✅ Tabela whatsapp_config limpa com sucesso!");
  console.log("Agora você pode recarregar a interface do CRM e reconfigurar o WhatsApp com a nova ENCRYPTION_KEY e o token correto!");
}

run().catch(err => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});
