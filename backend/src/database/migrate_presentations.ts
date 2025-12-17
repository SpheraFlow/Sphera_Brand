import fs from 'fs';
import path from 'path';
import db from '../config/database';

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'create_presentations_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        
        console.log('📦 Criando tabela de apresentações...');
        await db.query(sql);
        console.log('✅ Tabela criada com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

runMigration();
