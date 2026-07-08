const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/email/send-test',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test'  // Even if invalid, we want to see backend response
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(JSON.stringify({to: 'bipinpanjari@outlook.com'}));
req.end();
