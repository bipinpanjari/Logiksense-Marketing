const { Client } = require('pg');

const db = new Client({
  host: 'localhost',
  port: 5432,
  database: 'logiksense_marketing',
  user: 'db_username',
  password: 'logiksense',
});

async function checkConfig() {
  try {
    await db.connect();
    console.log('✓ Connected to database');

    // Get the email config
    const result = await db.query(`
      SELECT 
        id,
        workspace_id,
        customer_id,
        sending_email,
        auth_type,
        smtp_host,
        smtp_port,
        smtp_user,
        oauth2_client_id,
        oauth2_tenant_id,
        oauth2_client_secret_encrypted IS NOT NULL as has_client_secret,
        oauth2_refresh_token_encrypted IS NOT NULL as has_refresh_token,
        created_at,
        updated_at
      FROM email_configs
      WHERE workspace_id = 'cf2887bd-7185-4b39-9f55-1dda10b0d015'
      LIMIT 5
    `);

    console.log('\n📧 EMAIL CONFIGS:');
    result.rows.forEach((row, i) => {
      console.log(`\n[Config ${i + 1}]`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Sending Email: ${row.sending_email}`);
      console.log(`  Auth Type: ${row.auth_type}`);
      console.log(`  SMTP Host: ${row.smtp_host}`);
      console.log(`  SMTP Port: ${row.smtp_port}`);
      console.log(`  SMTP User: ${row.smtp_user}`);
      console.log(`  OAuth2 Client ID: ${row.oauth2_client_id}`);
      console.log(`  OAuth2 Tenant ID: ${row.oauth2_tenant_id}`);
      console.log(`  Has Client Secret: ${row.has_client_secret}`);
      console.log(`  Has Refresh Token: ${row.has_refresh_token}`);
      console.log(`  Created: ${row.created_at}`);
      console.log(`  Updated: ${row.updated_at}`);
    });

    // Check user
    const userResult = await db.query(`
      SELECT id, email, first_name, last_name FROM customers 
      WHERE id = '2cd20401-7576-4057-bcf9-81d09ee95fab'
    `);
    
    console.log('\n👤 USER INFO:');
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.first_name} ${user.last_name}`);
    }

    await db.end();
    console.log('\n✓ Database check complete');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkConfig();
