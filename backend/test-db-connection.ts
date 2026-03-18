import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function testConnection() {
  console.log('Testing PostgreSQL connections...\n');

  // Test different connection approaches
  const connectionConfigs = [
    {
      name: 'Via DATABASE_URL env var',
      config: {
        connectionString: process.env.DATABASE_URL,
      },
    },
    {
      name: 'Via individual params (localhost)',
      config: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'logiksense_marketing',
      },
    },
    {
      name: 'Via individual params (127.0.0.1)',
      config: {
        host: '127.0.0.1',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'logiksense_marketing',
      },
    },
    {
      name: 'Via host.docker.internal',
      config: {
        host: 'host.docker.internal',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'logiksense_marketing',
      },
    },
  ];

  for (const { name, config } of connectionConfigs) {
    console.log(`\n📝 Attempting: ${name}`);
    console.log(`   Config: ${JSON.stringify(config, null, 2)}`);

    const pool = new Pool({
      ...config,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 5000,
    } as any);

    try {
      const client = await pool.connect();
      console.log(`✅ Connection successful!`);

      // Try to get the database info
      const result = await client.query('SELECT version()');
      console.log(`   PostgreSQL version: ${result.rows[0].version.split(',')[0]}`);

      // Check if our tables exist
      const tablesResult = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
      );
      console.log(`   Tables in database: ${tablesResult.rows.length}`);

      client.release();
      pool.end();
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Failed: ${errorMsg}`);
      pool.end().catch(() => {});
    }
  }

  console.log('\n\n📋 Current environment variables:');
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL || '(not set)'}`);
  console.log(`   DB_HOST: ${process.env.DB_HOST || '(not set)'}`);
  console.log(`   DB_PORT: ${process.env.DB_PORT || '(not set)'}`);
  console.log(`   DB_USERNAME: ${process.env.DB_USERNAME || '(not set)'}`);
  console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : '(not set)'}`);
  console.log(`   DB_NAME: ${process.env.DB_NAME || '(not set)'}`);

  console.log('\n\n📋 .env file contents:');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        const displayValue = key && key.includes('PASSWORD') ? '***' : value;
        console.log(`   ${key}=${displayValue}`);
      }
    });
  } else {
    console.log('   .env file not found!');
  }
}

testConnection().catch(console.error);
