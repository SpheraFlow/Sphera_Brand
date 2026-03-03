import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function run() {
    console.log('🔄 Iniciando importação do Calendário Estratégico 2026...');

    try {
        const filePath = path.join(__dirname, '../../calendario_estrategico_2026.md');
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // O arquivo contém JSON puro
        const datas = JSON.parse(fileContent);

        console.log(`📦 Encontradas ${datas.length} datas para importar.`);

        let inseridas = 0;
        let atualizadas = 0;

        for (const item of datas) {
            if (!item.data || !item.nome) {
                console.warn('⚠️ Pulando item inválido:', item);
                continue;
            }

            // Converte nichos (array de strings) e calcula relevância padrão
            const categorias = Array.isArray(item.nichos) ? item.nichos : [];

            // Maior relevância se for Feriado, Copa ou Natal
            let relevancia = 5;
            const catsArr = categorias.map(c => c.toLowerCase());
            if (catsArr.includes('feriado') || catsArr.includes('feriado nacional')) relevancia = 8;
            if (item.nome.toLowerCase().includes('copa') || item.nome.toLowerCase().includes('natal')) relevancia = 10;

            const result = await db.query(
                `INSERT INTO datas_comemorativas (data, titulo, categorias, descricao, relevancia)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (data, titulo) DO UPDATE
         SET categorias = EXCLUDED.categorias,
             descricao = EXCLUDED.descricao,
             relevancia = EXCLUDED.relevancia
         RETURNING (xmax = 0) AS is_insert`,
                [
                    item.data,
                    item.nome,
                    JSON.stringify(categorias),
                    item.descricao_orientativa || null,
                    relevancia
                ]
            );

            if (result.rows[0].is_insert) {
                inseridas++;
            } else {
                atualizadas++;
            }
        }

        console.log('\n✅ Importação concluída com sucesso!');
        console.log(`➕ Inseridas: ${inseridas}`);
        console.log(`🔄 Atualizadas: ${atualizadas}`);
        console.log(`📊 Total na base agora: ${inseridas + atualizadas}`);

    } catch (error) {
        console.error('❌ Erro fatal durante a importação:', error);
    } finally {
        await db.end();
    }
}

run();
