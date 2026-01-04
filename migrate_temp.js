const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente do backend
const envPath = path.join(__dirname, 'backend', '.env');
dotenv.config({ path: envPath });

async function migrate() {
  console.log(" Iniciando migração manual (JS puro na raiz)...");

  // Configuração da conexão com credenciais hardcoded (fallback do PROJECT_CONTEXT.md)
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'app_db',
    user: process.env.DB_USER || 'spheraflow',
    password: process.env.DB_PASSWORD || '@Trafego123',
  });

  try {
    await client.connect();
    console.log(" Conectado ao banco de dados.");

    // Ler o arquivo SQL
    const migrationPath = path.join(__dirname, 'backend/src/database/migrations/add_brand_dna_fields_to_branding.sql');
    
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Arquivo SQL não encontrado em: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log("📄 SQL lido com sucesso. Executando...");

    // Executar a query
    await client.query(sql);

    console.log("✅ Migração aplicada com sucesso!");
  } catch (error) {
    console.error("❌ Erro fatal na migração:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
