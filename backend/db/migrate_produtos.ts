import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente baseadas no ambiente
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const pool = new Pool({
    user: process.env.DB_USER || 'spheraflow',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'app_db',
    password: process.env.DB_PASSWORD || '@Trafego123',
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

const migrate = async () => {
    try {
        console.log('Iniciando migração da tabela produtos...');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS produtos (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                    nome VARCHAR(255) NOT NULL,
                    categoria VARCHAR(255),
                    preco NUMERIC(10, 2),
                    descricao TEXT,
                    link_referencia VARCHAR(1024),
                    ativo BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `;

            console.log('Executando query de criação da tabela produtos...');
            await client.query(createTableQuery);

            console.log('Criando índices...');
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_produtos_cliente_id ON produtos(cliente_id);
                CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
            `);

            await client.query('COMMIT');
            console.log('Migração da tabela produtos concluída com sucesso!');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro durante a migração (transação revertida):', error);
            throw error;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('Erro fatal executando script de migração:', err.message);
    } finally {
        await pool.end();
        console.log('Conexão com o banco de dados encerrada.');
    }
};

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

export default migrate;
