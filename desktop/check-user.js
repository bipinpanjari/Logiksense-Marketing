const { PGlite } = require('@electric-sql/pglite');
const path = require('path');
const os = require('os');

async function checkUser() {
  const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'logiksense-desktop', 'pglite-data');
  const db = new PGlite({ dataDir: dbPath });
  try {
    const res = await db.query("SELECT id, email, first_name, last_name, onboarding_completed FROM customers WHERE email = 'info@logiksense.ai'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(err) {
    console.error(err);
  } finally {
    await db.close();
  }
}
checkUser();
