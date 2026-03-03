
import db from '../src/config/database';

async function getClient() {
    try {
        const res = await db.query('SELECT id, nome FROM clientes LIMIT 1');
        if (res.rows.length > 0) {
            console.log('CLIENT_ID=' + res.rows[0].id);
            console.log('CLIENT_NAME=' + res.rows[0].nome);
        } else {
            console.error('No clients found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

getClient();
