const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/email/send-test',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyY2QyMDQwMS03NTc2LTQwNTctYmNmOS04MWQwOWVlOTVmYWIiLCJ3b3Jrc3BhY2VJZCI6ImNmMjg4N2JkLTcxODUtNGIzOS05ZjU1LTFkZGExMGIwZDAxNSIsImVtYWlsIjoiaW5mb0Bsb2dpa3NlbnNlLmFpIiwicm9sZSI6Im93bmVyIiwiaWF0IjoxNzgzMTcyODU5LCJleHAiOjE3ODMyNTkyNTl9.g3BDXu-agGHdd22nNAAigaTnU_w3GETYiJblC7hw4-M'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS:`, JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});

const postData = JSON.stringify({
  to: 'bipinpanjari@outlook.com'
});

console.log('Sending email via OAuth2...');
req.write(postData);
req.end();
