import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import * as nodemailer from 'nodemailer';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

@Injectable()
export class EmailValidationService {
  /**
   * Verify email ownership by sending verification link
   */
  async sendVerificationEmail(email: string, verificationCode: string): Promise<boolean> {
    try {
      // For development, we'll log the verification code
      // In production, use real SMTP
      console.log(`📧 Verification email for ${email}: http://verify.local?code=${verificationCode}`);

      // Optional: Send real email if SMTP is configured
      if (process.env.SMTP_HOST) {
        const smtpHost =
          process.env.SMTP_HOST === 'localhost' ? '127.0.0.1' : process.env.SMTP_HOST;
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@logik-sense.com',
          to: email,
          subject: 'Verify Your Email - Logik Sense',
          html: `
            <h2>Verify Your Email</h2>
            <p>Click the link below to verify your email address:</p>
            <a href="${process.env.FRONTEND_URL}/verify?code=${verificationCode}">
              Verify Email
            </a>
            <p>Code: ${verificationCode}</p>
          `,
        });

        transporter.close();
      }

      return true;
    } catch (error) {
      console.error('Email verification error:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Check if domain has MX records (basic email validation)
   */
  async validateEmailDomain(email: string): Promise<boolean> {
    try {
      const domain = email.split('@')[1];
      if (!domain) return false;

      const mxRecords = await resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (error) {
      console.error(`MX validation failed for ${email}:`, error);
      return false;
    }
  }

  /**
   * Test DKIM configuration for outbound email
   * Checks DNS TXT records for DKIM public key
   */
  async validateDKIM(domain: string, selector: string = 'default'): Promise<{
    valid: boolean;
    record?: string;
    error?: string;
  }> {
    try {
      // DKIM record is typically at: selector._domainkey.domain
      const dkimDomain = `${selector}._domainkey.${domain}`;

      const txtRecords = await resolveTxt(dkimDomain);
      
      if (txtRecords && txtRecords.length > 0) {
        const record = txtRecords.map(r => r.join('')).join('');
        
        // Check if it contains DKIM v=DKIM1 marker
        if (record.includes('v=DKIM1')) {
          return {
            valid: true,
            record: record.substring(0, 100) + '...',
          };
        }
      }

      return {
        valid: false,
        error: 'DKIM record not found or invalid format',
      };
    } catch (error) {
      console.error(`DKIM validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: 'Failed to query DKIM record. Make sure domain is correct.',
      };
    }
  }

  /**
   * Test SPF configuration for outbound email
   * Checks DNS TXT records for SPF policy
   */
  async validateSPF(domain: string): Promise<{
    valid: boolean;
    record?: string;
    error?: string;
  }> {
    try {
      const txtRecords = await resolveTxt(domain);

      if (txtRecords && txtRecords.length > 0) {
        const spfRecord = txtRecords
          .map(r => r.join(''))
          .find(record => record.startsWith('v=spf1'));

        if (spfRecord) {
          return {
            valid: true,
            record: spfRecord.substring(0, 100) + '...',
          };
        }
      }

      return {
        valid: false,
        error: 'SPF record not found. Add SPF record to DNS TXT records.',
      };
    } catch (error) {
      console.error(`SPF validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: 'Failed to query SPF record. Make sure domain is correct.',
      };
    }
  }

  /**
   * Test DMARC configuration for outbound email
   * Checks DNS TXT records at _dmarc.<domain>
   */
  async validateDMARC(domain: string): Promise<{
    valid: boolean;
    record?: string;
    policy?: 'none' | 'quarantine' | 'reject';
    error?: string;
  }> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const txtRecords = await resolveTxt(dmarcDomain);

      if (txtRecords && txtRecords.length > 0) {
        const record = txtRecords
          .map((r) => r.join(''))
          .find((r) => r.startsWith('v=DMARC1'));

        if (record) {
          const policyMatch = /p=(none|quarantine|reject)/i.exec(record);
          const policy = policyMatch
            ? (policyMatch[1].toLowerCase() as 'none' | 'quarantine' | 'reject')
            : undefined;
          return { valid: true, record, policy };
        }
      }

      return {
        valid: false,
        error: 'DMARC record not found. Add a TXT record at _dmarc.' + domain,
      };
    } catch (error) {
      console.error(`DMARC validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: 'Failed to query DMARC record. Make sure domain is correct.',
      };
    }
  }

  /**
   * Comprehensive email validation including DNS checks
   */
  async validateOutboundEmail(email: string, domain: string): Promise<{
    emailValid: boolean;
    dkimValid: boolean;
    spfValid: boolean;
    dmarcValid: boolean;
    dmarcPolicy?: 'none' | 'quarantine' | 'reject';
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const emailDomainValid = await this.validateEmailDomain(email);
    if (!emailDomainValid) {
      errors.push('Email domain has no MX records');
    }

    const dkimResult = await this.validateDKIM(domain);
    if (!dkimResult.valid) {
      warnings.push(`DKIM: ${dkimResult.error}`);
    }

    const spfResult = await this.validateSPF(domain);
    if (!spfResult.valid) {
      warnings.push(`SPF: ${spfResult.error}`);
    }

    const dmarcResult = await this.validateDMARC(domain);
    if (!dmarcResult.valid) {
      warnings.push(`DMARC: ${dmarcResult.error}`);
    } else if (dmarcResult.policy === 'none') {
      warnings.push(
        'DMARC policy is set to "none" (monitor-only). Consider upgrading to "quarantine" or "reject" once confident.',
      );
    }

    return {
      emailValid: emailDomainValid,
      dkimValid: dkimResult.valid,
      spfValid: spfResult.valid,
      dmarcValid: dmarcResult.valid,
      dmarcPolicy: dmarcResult.policy,
      errors,
      warnings,
    };
  }

  /**
   * Generate DNS configuration guides for each provider
   */
  getDNSConfigurationGuide(provider: string, domain: string, dkimSelector: string = 'default'): string {
    const guides: Record<string, string> = {
      namecheap: this.getNamecheapGuide(domain, dkimSelector),
      godaddy: this.getGodaddyGuide(domain, dkimSelector),
      route53: this.getRoute53Guide(domain, dkimSelector),
      cloudflare: this.getCloudflareGuide(domain, dkimSelector),
      generic: this.getGenericGuide(domain, dkimSelector),
    };

    const providerKey = provider.toLowerCase();
    return guides[providerKey] || guides['generic'];
  }

  private getNamecheapGuide(domain: string, selector: string): string {
    return `
# Namecheap DKIM/SPF Setup

## Step 1: Get Your DKIM Public Key
Contact your email provider (SendGrid, Gmail, etc.) for your DKIM public key.

## Step 2: Add DKIM Record in Namecheap
1. Login to Namecheap
2. Go to Domain List → Select "${domain}"
3. Click Advanced DNS
4. Add a TXT Record:
   - Host: ${selector}._domainkey
   - Value: v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE
   - TTL: 30 minutes

## Step 3: Add SPF Record
1. Add another TXT Record:
   - Host: @
   - Value: v=spf1 include:sendgrid.net ~all
   - TTL: 30 minutes

## Step 4: Verify
Wait 24-48 hours for DNS propagation. Then test DKIM/SPF in Logik Sense.
    `.trim();
  }

  private getGodaddyGuide(domain: string, selector: string): string {
    return `
# GoDaddy DKIM/SPF Setup

## Step 1: Get Your DKIM Public Key
Contact your email provider (SendGrid, Gmail, etc.) for your DKIM public key.

## Step 2: Add DKIM Record in GoDaddy
1. Login to GoDaddy
2. Go to My Products → Domains
3. Select "${domain}" and click Manage DNS
4. Add a TXT Record:
   - Name: ${selector}._domainkey
   - Value: v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE
   - TTL: 1 hour

## Step 3: Add SPF Record
1. Add another TXT Record:
   - Name: @
   - Value: v=spf1 include:sendgrid.net ~all
   - TTL: 1 hour

## Step 4: Verify
Wait 24-48 hours for DNS propagation. Then test DKIM/SPF in Logik Sense.
    `.trim();
  }

  private getRoute53Guide(domain: string, selector: string): string {
    return `
# AWS Route53 DKIM/SPF Setup

## Step 1: Get Your DKIM Public Key
Contact your email provider (SendGrid, Gmail, etc.) for your DKIM public key.

## Step 2: Add DKIM Record in Route53
1. Login to AWS Console
2. Go to Route53 → Hosted zones → Select "${domain}"
3. Click "Create record"
4. Create a TXT Record:
   - Name: ${selector}._domainkey.${domain}
   - Value: "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE"
   - TTL: 300

## Step 3: Add SPF Record
1. Click "Create record" again
2. Create a TXT Record:
   - Name: ${domain}
   - Value: "v=spf1 include:sendgrid.net ~all"
   - TTL: 300

## Step 4: Verify
Wait 5-10 minutes (Route53 is faster). Then test DKIM/SPF in Logik Sense.
    `.trim();
  }

  private getCloudflareGuide(domain: string, selector: string): string {
    return `
# Cloudflare DKIM/SPF Setup

## Step 1: Get Your DKIM Public Key
Contact your email provider (SendGrid, Gmail, etc.) for your DKIM public key.

## Step 2: Add DKIM Record in Cloudflare
1. Login to Cloudflare
2. Go to DNS for "${domain}"
3. Click "+ Add record"
4. Create a TXT Record:
   - Type: TXT
   - Name: ${selector}._domainkey
   - Content: v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE
   - TTL: Auto

## Step 3: Add SPF Record
1. Click "+ Add record" again
2. Create a TXT Record:
   - Type: TXT
   - Name: ${domain}
   - Content: v=spf1 include:sendgrid.net ~all
   - TTL: Auto

## Step 4: Verify
Wait 5-10 minutes. Then test DKIM/SPF in Logik Sense.
    `.trim();
  }

  private getGenericGuide(domain: string, selector: string): string {
    return `
# Generic DNS Provider DKIM/SPF Setup

## Step 1: Get Your DKIM Public Key
Contact your email provider (SendGrid, Gmail, etc.) for your DKIM public key.

## Step 2: Add DKIM Record
In your DNS provider's control panel, add a TXT record:
- Host/Name: ${selector}._domainkey
- Value: v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE

## Step 3: Add SPF Record
In your DNS provider's control panel, add another TXT record:
- Host/Name: @ (or root domain)
- Value: v=spf1 include:sendgrid.net ~all

## Step 4: Verify
Wait 24-48 hours for DNS propagation. Then test DKIM/SPF in Logik Sense.

## Common Email Providers:
- Gmail: use include:gmail.com
- SendGrid: use include:sendgrid.net
- Mailgun: use include:mailgun.org
- AWS SES: use include:amazonses.com
    `.trim();
  }
}
