const { Client } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const IV_LENGTH_BYTES = 12;
const TAG_LENGTH_BYTES = 16;

function requireKey() {
  const raw = process.env.SMTP_ENCRYPTION_KEY || 'dGVzdC12YXVsdC1rZXktZm9yLWNpLTMyYnl0ZXM=';
  const asHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length >= 32;
  const keyMaterial = asHex
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64').length >= 16
      ? Buffer.from(raw, 'base64')
      : Buffer.from(raw, 'utf8');
  return crypto.createHash('sha256').update(keyMaterial).digest();
}

function decryptSmtpPassword(encrypted) {
  const key = requireKey();
  const [ivB64, tagB64, dataB64] = encrypted.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted SMTP password format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return plain;
}

async function testEmailFlow() {
  const db = new Client({
    host: 'localhost',
    port: 5432,
    database: 'logiksense_marketing',
    user: 'db_username',
    password: 'logiksense',
  });

  try {
    await db.connect();
    console.log('✓ Connected to database\n');

    const configId = '09439885-ff21-49d9-899b-91f2948d5f56';
    const customerId = '2cd20401-7576-4057-bcf9-81d09ee95fab';

    console.log('📋 Step 1: Fetch config from database');
    const result = await db.query(`SELECT * FROM email_configs WHERE id = $1::uuid AND customer_id = $2::uuid`, [configId, customerId]);
    
    if (result.rows.length === 0) {
      console.error('❌ Config not found!');
      process.exit(1);
    }

    const raw = result.rows[0];
    console.log('  ✓ Config fetched');
    console.log('  - Auth Type:', raw.auth_type);
    console.log('  - Sending Email:', raw.sending_email);
    console.log('  - OAuth2 Client ID:', raw.oauth2_client_id);
    console.log('  - OAuth2 Tenant ID:', raw.oauth2_tenant_id);
    console.log('  - Has Client Secret:', !!raw.oauth2_client_secret_encrypted);
    console.log('  - Has Refresh Token:', !!raw.oauth2_refresh_token_encrypted);

    if (raw.auth_type !== 'OAUTH2') {
      console.error('❌ Auth type is not OAUTH2!');
      process.exit(1);
    }

    console.log('\n🔐 Step 2: Decrypt OAuth2 credentials');
    
    let clientSecret = '';
    let refreshToken = '';
    
    try {
      if (raw.oauth2_client_secret_encrypted) {
        clientSecret = decryptSmtpPassword(raw.oauth2_client_secret_encrypted);
        console.log('  ✓ Client Secret decrypted (length:', clientSecret.length, ')');
      }
    } catch (e) {
      console.error('  ❌ Failed to decrypt client secret:', e.message);
      process.exit(1);
    }

    try {
      if (raw.oauth2_refresh_token_encrypted) {
        refreshToken = decryptSmtpPassword(raw.oauth2_refresh_token_encrypted);
        console.log('  ✓ Refresh Token decrypted (length:', refreshToken.length, ')');
      }
    } catch (e) {
      console.error('  ❌ Failed to decrypt refresh token:', e.message);
      process.exit(1);
    }

    if (!refreshToken) {
      console.error('❌ No refresh token found!');
      process.exit(1);
    }

    console.log('\n🔧 Step 3: Build Nodemailer transporter');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      connectionTimeout: 30_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      auth: {
        type: 'OAuth2',
        user: raw.sending_email,
        clientId: raw.oauth2_client_id,
        clientSecret,
        refreshToken,
        accessUrl: `https://login.microsoftonline.com/${raw.oauth2_tenant_id}/oauth2/v2.0/token`,
      },
    });

    console.log('  ✓ Transporter created with OAuth2 config');
    console.log('  - User:', raw.sending_email);
    console.log('  - Client ID:', raw.oauth2_client_id);
    console.log('  - Access URL: https://login.microsoftonline.com/' + raw.oauth2_tenant_id + '/oauth2/v2.0/token');

    console.log('\n📧 Step 4: Send test email');
    
    const fromName = raw.smtp_from_name || 'Logik Sense';
    const from = `${fromName} <${raw.sending_email}>`;
    
    try {
      const result = await transporter.sendMail({
        from,
        to: 'bipinpanjari@outlook.com',
        subject: 'Test email from Logik Sense',
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
                 <h2>SMTP Test Successful</h2>
                 <p>This is a test email sent from your Logik Sense workspace using your configured SMTP provider.</p>
                 <p><strong>From:</strong> ${raw.sending_email}</p>
               </div>`,
      });
      
      console.log('  ✓ Email sent successfully!');
      console.log('  - Message ID:', result.messageId);
      console.log('  - Response:', result.response);
    } catch (err) {
      console.error('  ❌ Failed to send email:');
      console.error('  - Error:', err.message);
      console.error('  - Code:', err.code);
      if (err.response) {
        console.error('  - Response:', err.response);
      }
      process.exit(1);
    }

    await db.end();
    console.log('\n✅ Test completed successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

testEmailFlow();
