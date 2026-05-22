/**
 * Migration: STORY-012 — Add retry/error tracking fields to job tables.
 *
 * Adds:
 *   - attempt_count INT NOT NULL DEFAULT 0
 *   - last_error TEXT
 *   - last_error_at TIMESTAMPTZ
 *
 * Applies to both `calendar_generation_jobs` and `creative_jobs` since both have
 * workers covered by STORY-012 (calendarGenerationWorker, creativeProductionWorker).
 *
 * Idempotent: safe to re-run; uses ADD COLUMN IF NOT EXISTS.
 */

import db from "../src/config/database";

const TABLES = ["calendar_generation_jobs", "creative_jobs"] as const;

const migrate = async () => {
  const client = await db.connect();
  try {
    console.log("🔄 [STORY-012] Migrando campos de retry nos jobs...");
    await client.query("BEGIN");

    for (const table of TABLES) {
      // Check table exists first (creative_jobs may not exist in older envs).
      const existsRes = await client.query(
        "SELECT to_regclass($1) AS exists",
        [table]
      );
      if (!existsRes.rows[0]?.exists) {
        console.log(`   ⏭️  Tabela ${table} não existe — pulando.`);
        continue;
      }

      console.log(`   📝 Adicionando colunas em ${table}...`);
      await client.query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS last_error TEXT,
          ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
      `);

      // Index to speed up the "failed jobs in last 2h" query used by AgencyHome banner (AC6).
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_status_created_at
          ON ${table} (status, created_at DESC);
      `);
    }

    await client.query("COMMIT");
    console.log("✅ [STORY-012] Migração concluída.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [STORY-012] Falha na migração:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
};

migrate();
