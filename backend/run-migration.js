const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'logiksense_marketing',
    user: 'db_username',
    password: 'logiksense',
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Add the new columns
    await client.query(`
      ALTER TABLE email_configs 
      ADD COLUMN IF NOT EXISTS oauth2_access_token_encrypted VARCHAR(1000);
    `);
    console.log('✓ Added oauth2_access_token_encrypted column');

    await client.query(`
      ALTER TABLE email_configs 
      ADD COLUMN IF NOT EXISTS oauth2_token_expires_at TIMESTAMP;
    `);
    console.log('✓ Added oauth2_token_expires_at column');

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_oauth2_token_expires ON email_configs(oauth2_token_expires_at);
    `);
    console.log('✓ Created index for oauth2_token_expires_at');

    // Verify columns exist
    const result = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='email_configs' 
      AND column_name IN ('oauth2_access_token_encrypted', 'oauth2_token_expires_at')
      ORDER BY column_name;
    `);

    console.log('\n✅ Migration completed! New columns:');
    result.rows.forEach(row => console.log('  -', row.column_name));

    await client.end();
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
