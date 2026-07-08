const { Client } = require('pg');

const client = new Client({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'logiksense_marketing',
  user: process.env.DATABASE_USER || 'db_username',
  password: process.env.DATABASE_PASSWORD || 'logiksense',
});

(async () => {
  try {
    await client.connect();
    const result = await client.query(
      `UPDATE email_configs SET auth_type = $1 WHERE oauth2_refresh_token_encrypted IS NOT NULL RETURNING id, auth_type`,
      ['OAUTH2']
    );
    console.log('Updated configs:', result.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    process.exit(0);
  }
})();
