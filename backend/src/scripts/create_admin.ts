import bcrypt from 'bcryptjs';
import db from '../config/database';

async function createAdmin() {
    const args = process.argv.slice(2);
    let email = '';
    let password = '';
    let nome = 'Administrador';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--email' && args[i + 1]) email = args[i + 1] || '';
        if (args[i] === '--password' && args[i + 1]) password = args[i + 1] || '';
        if (args[i] === '--nome' && args[i + 1]) nome = args[i + 1] || '';
    }

    if (!email || !password) {
        console.error('Uso: npx ts-node create_admin.ts --email <email> --password <senha> [--nome <nome>]');
        process.exit(1);
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const defaultAdminPermissions = JSON.stringify({
            dashboard_view: true,
            clients_manage: true,
            team_manage: true,
            content_generate: true,
            content_approve: true
        });

        const result = await db.query(
            `INSERT INTO users (nome, email, password_hash, role, permissions) 
       VALUES ($1, $2, $3, 'admin', $4) 
       ON CONFLICT (email) 
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', permissions = $4
       RETURNING id, nome, email, role, permissions`,
            [nome, email, hash, defaultAdminPermissions]
        );

        console.log('✅ Admin criado/atualizado com sucesso:');
        console.log(result.rows[0]);
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao criar admin:', error);
        process.exit(1);
    }
}

createAdmin();
