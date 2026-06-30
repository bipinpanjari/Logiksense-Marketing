const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54321/logiksense_marketing?schema=public&sslmode=disable' });
client.connect()
  .then(() => client.query("SELECT id, email, first_name, last_name, onboarding_completed FROM customers WHERE email = 'info@logiksense.ai'"))
  .then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    client.end();
  })
  .catch(err => {
    console.error('Connection failed:', err.message);
    process.exit(1);
  });
