const jwt = require('jsonwebtoken');

// Generate JWT token with correct payload format
const userId = '2cd20401-7576-4057-bcf9-81d09ee95fab';
const workspaceId = 'cf2887bd-7185-4b39-9f55-1dda10b0d015';

// Using the JWT_SECRET from .env
const token = jwt.sign(
  { userId, workspaceId, email: 'info@logiksense.ai', role: 'owner' },
  'logiksense', // JWT_SECRET from backend .env
  { expiresIn: '24h' }
);

console.log('Generated JWT Token:');
console.log(token);
