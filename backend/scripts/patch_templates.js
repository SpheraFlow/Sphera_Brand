require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
    .then(() => {
        console.log("Conectado ao DB. Atualizando templates...");
        return client.query(`UPDATE prompt_templates SET body = body || '\n\nINSTRUÇÕES POR FORMATO DE CONTEÚDO:\n{{INSTRUCOES_POR_FORMATO}}\n' WHERE body NOT LIKE '%{{INSTRUCOES_POR_FORMATO}}%'`);
    })
    .then(res => console.log('✅ Sucesso! Templates atualizados: ' + res.rowCount))
    .catch(err => console.error('❌ Erro:', err))
    .finally(() => client.end());
