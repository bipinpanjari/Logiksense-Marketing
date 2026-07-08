const http = require('http');
const jwt = require('jsonwebtoken');

// Generate a fresh token
const token = jwt.sign(
  { userId: '2cd20401-7576-4057-bcf9-81d09ee95fab', workspaceId: 'cf2887bd-7185-4b39-9f55-1dda10b0d015', email: 'info@logiksense.ai', role: 'owner' },
  'logiksense',
  { expiresIn: '24h' }
);

console.log('Token:', token);
console.log('\nTesting /api/email/config...');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/email/config',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const config = JSON.parse(data);
      console.log('\nConfig received:');
      console.log('  ID:', config.id);
      console.log('  Sending Email:', config.sendingEmail);
      console.log('  Auth Type:', config.authType);
      console.log('  OAuth2 Client ID:', config.oauth2ClientId);
      console.log('  OAuth2 Tenant ID:', config.oauth2TenantId);
      console.log('  Has Refresh Token:', !!config.oauth2RefreshToken);
      console.log('  Full response:', JSON.stringify(config, null, 2));
    } catch (e) {
      console.log('Response:', data);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.end();
