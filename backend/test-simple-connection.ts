import { Pool } from 'pg';

async function testConnection() {
  console.log('🔍 Testing connection (now with trust auth)...\n');

  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres', // Can try with or without password now
    database: 'logiksense_marketing',
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully!');

    // Get version
    const versionResult = await client.query('SELECT version()');
    console.log(`PostgreSQL: ${versionResult.rows[0].version.split(',')[0]}`);

    // List all tables
    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );

    console.log(`\n📊 Current tables (${tablesResult.rows.length}):`);
    tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));

    client.release();
  } catch (error) {
    console.error('❌ Connection failed:', (error as Error).message);
  } finally {
    await pool.end();
  }
}

testConnection();
