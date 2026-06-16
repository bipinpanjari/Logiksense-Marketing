const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const prisma = new PrismaClient();

function decrypt(text) {
  if (!text) return '';
  const key = Buffer.from('dGVzdC12YXVsdC1rZXktZm9yLWNpLTMyYnl0ZXM=', 'base64');
  const parts = text.split(':');
  if (parts.length < 2) return text;
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function runTest() {
  const config = await prisma.emailConfig.findFirst({
    orderBy: { updatedAt: 'desc' },
    where: { isActive: true }
  });

  if (!config) {
    console.log('No active config found');
    return;
  }

  console.log('Testing connection for:', config.sendingEmail);
  const tenantId = config.oauth2TenantId || 'common';
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
      type: 'OAuth2',
      user: config.smtpUser,
      clientId: config.oauth2ClientId,
      clientSecret: decrypt(config.oauth2ClientSecretEnc),
      refreshToken: decrypt(config.oauth2RefreshToken),
      accessUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    },
    debug: true,
    logger: true
  });

  try {
    await transporter.verify();
    console.log('✅ Connection Verified Successfully!');
    
    const info = await transporter.sendMail({
      from: `"${config.smtpFromName || 'Logiksense'}" <${config.sendingEmail}>`,
      to: 'bipinpanjari@gmail.com',
      subject: 'Logiksense - Microsoft Connection Test Success',
      text: 'This email confirms your Microsoft account is correctly linked to Logiksense.',
      html: '<b>Success!</b> Your Microsoft account is correctly linked.'
    });
    
    console.log('✅ Test email sent: %s', info.messageId);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('Microsoft Error Response:', err.response);
    }
  }
}

runTest().then(() => prisma.$disconnect());
