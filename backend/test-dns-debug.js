const dns = require('dns');
const { Resolver } = dns.promises;
const resolver = new Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

async function test() {
  const domain = 'selector1._domainkey.logiksense.ai';
  console.log('Testing (Google DNS):', domain);
  
  try {
    const txt = await resolver.resolveTxt(domain);
    console.log('TXT Records:', txt);
  } catch (e) {
    console.log('TXT Error:', e.code, e.message);
  }

  try {
    const cname = await resolver.resolveCname(domain);
    console.log('CNAME Records:', cname);
  } catch (e) {
    console.log('CNAME Error:', e.code, e.message);
  }
}

test();
