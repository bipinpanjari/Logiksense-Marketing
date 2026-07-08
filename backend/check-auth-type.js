const pg = require('pg');

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'logiksense_marketing',
  user: 'db_username',
  password: 'logiksense'
});

client.connect((err) => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }

  const query = `
    SELECT id, sending_email, auth_type, 
           CASE WHEN oauth2_refresh_token_encrypted IS NOT NULL THEN 'YES' ELSE 'NO' END as has_refresh_token
    FROM email_configs 
    WHERE id = '09439885-ff21-49d9-899b-91f2948d5f56'
  `;

  client.query(query, (err, res) => {
    if (err) {
      console.error('Query error:', err);
    } else {
      console.log('Current auth_type config:');
      console.log(JSON.stringify(res.rows[0], null, 2));
    }
    client.end();
  });
});
