import { Pool } from 'pg';

async function testConnections() {
  console.log('🔍 Testing different database targets...\n');

  const tests = [
    {
      name: 'Connect to default postgres DB',
      config: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        // No database specified - should connect to default 'postgres' DB
      },
    },
    {
      name: 'Connect to logiksense_marketing DB',
      config: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'logiksense_marketing',
      },
    },
  ];

  for (const test of tests) {
    console.log(`\n📝 Test: ${test.name}`);
    const pool = new Pool({
      ...test.config,
      connectionTimeoutMillis: 5000,
    } as any);

    try {
      const client = await pool.connect();
      console.log('✅ Connected successfully');

      // Check if database exists
      const result = await client.query(
        `SELECT datname FROM pg_catalog.pg_database WHERE datname = 'logiksense_marketing'`,
      );

      if (result.rows.length > 0) {
        console.log('✅ logiksense_marketing database EXISTS');
      } else {
        console.log('❌ logiksense_marketing database DOES NOT EXIST');
        console.log('   Creating database...');
        try {
          await client.query('CREATE DATABASE logiksense_marketing');
          console.log('✅ Database created');
        } catch (e) {
          console.log(`   Note: ${(e as Error).message}`);
        }
      }

      client.release();
      await pool.end();
    } catch (error) {
      console.log(`❌ Failed: ${(error as Error).message}`);
      pool.end().catch(() => {});
    }
  }
}

testConnections().catch(console.error);
