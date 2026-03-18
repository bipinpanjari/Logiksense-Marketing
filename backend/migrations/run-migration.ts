import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/logiksense_marketing',
  });

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '003_add_lead_scoring.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    console.log('Executing migration: 003_add_lead_scoring.sql');
    await pool.query(sql);
    console.log('✓ Migration completed successfully');

    // Verify tables were created
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('lead_score_history', 'contact_segments', 'segment_members', 'email_analytics')",
    );

    console.log('\n✓ Tables created:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('✗ Migration failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
