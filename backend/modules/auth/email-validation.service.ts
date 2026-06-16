import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import * as nodemailer from 'nodemailer';
import { promisify } from 'util';
<<<<<<< Updated upstream

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
=======
import { exec } from 'child_process';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const execAsync = promisify(exec);
>>>>>>> Stashed changes

@Injectable()
export class EmailValidationService {
  /**
<<<<<<< Updated upstream
=======
   * Helper to resolve DNS TXT records with a fallback to shell command on Windows
   */
  private async safeResolveTxt(domain: string): Promise<string[][]> {
    try {
      return await dns.promises.resolveTxt(domain);
    } catch (error: any) {
      if (process.platform === 'win32' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEOUT') {
        console.log(`[DNS] Native resolveTxt failed for ${domain} (${error.code}), trying nslookup fallback...`);
        try {
          const { stdout } = await execAsync(`nslookup -type=txt ${domain}`);
          console.log(`[DNS] nslookup stdout: ${stdout}`);
          // Parse nslookup output: look for lines starting with "text =" or quoted strings
          const records: string[][] = [];
          
          // Improved parsing: search for all quoted strings, potentially spanning lines or multiple records
          const matches = stdout.match(/"([^"]+)"/g);
          if (matches) {
            matches.forEach(m => {
              const cleaned = m.replace(/^"|"$/g, '');
              console.log(`[DNS] Found TXT record via quotes: ${cleaned}`);
              records.push([cleaned]);
            });
          }

          // If no quotes found, try the "text =" fallback but handle multi-line better
          if (records.length === 0) {
            const textLines = stdout.split('\n').filter(l => l.includes('text ='));
            textLines.forEach(line => {
              const val = line.split('text =')[1]?.trim().replace(/"/g, '');
              if (val) {
                console.log(`[DNS] Found TXT record via text=: ${val}`);
                records.push([val]);
              }
            });
          }

          if (records.length > 0) return records;
        } catch (shellError: any) {
          console.error(`[DNS] Fallback nslookup failed for ${domain}:`, shellError.message);
        }
      }
      throw error;
    }
  }

  /**
   * Helper to resolve DNS CNAME records with a fallback to shell command
   */
  private async safeResolveCname(domain: string): Promise<string[]> {
    try {
      return await dns.promises.resolveCname(domain);
    } catch (error: any) {
      if (process.platform === 'win32' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEOUT') {
        console.log(`[DNS] Native resolveCname failed for ${domain} (${error.code}), trying nslookup fallback...`);
        try {
          const { stdout } = await execAsync(`nslookup -type=cname ${domain}`);
          console.log(`[DNS] nslookup CNAME stdout: ${stdout}`);
          const match = stdout.match(/canonical name\s*=\s*(.*)/i);
          if (match && match[1]) {
            const cname = match[1].trim().replace(/\.$/, '');
            console.log(`[DNS] Found CNAME: ${cname}`);
            return [cname];
          }
        } catch (shellError: any) {
          console.error(`[DNS] Fallback nslookup failed for ${domain}:`, shellError.message);
        }
      }
      throw error;
    }
  }

  /**
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
      // Try TXT first
      try {
        const txtRecords = await this.safeResolveTxt(dkimDomain);
        if (txtRecords && txtRecords.length > 0) {
          const record = txtRecords.map(r => r.join('')).join('');
          if (record.toLowerCase().includes('v=dkim1')) {
            return { valid: true, record: record.substring(0, 100) + '...' };
          }
        }
      } catch (e: any) {
        // Fall through to CNAME check
      }

      // Try CNAME check (common for Office 365 / Google)
      try {
        const cnameRecords = await this.safeResolveCname(dkimDomain);
        if (cnameRecords && cnameRecords.length > 0) {
          return {
            valid: true,
            record: `CNAME pointing to: ${cnameRecords[0]}`,
          };
        }
      } catch (e: any) {
        // Ignore errors
>>>>>>> Stashed changes
      }

      return {
        valid: false,
        error: 'DKIM record not found or invalid format',
      };
<<<<<<< Updated upstream
    } catch (error) {
      console.error(`DKIM validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: 'Failed to query DKIM record. Make sure domain is correct.',
=======
    } catch (error: any) {
      console.error(`DKIM validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: `Failed to query DKIM record: ${error.message || 'Unknown error'}`,
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      const txtRecords = await resolveTxt(domain);
=======
      const txtRecords = await this.safeResolveTxt(domain);
>>>>>>> Stashed changes

      if (txtRecords && txtRecords.length > 0) {
        const spfRecord = txtRecords
          .map(r => r.join(''))
<<<<<<< Updated upstream
          .find(record => record.startsWith('v=spf1'));
=======
          .find(record => record.toLowerCase().startsWith('v=spf1'));
>>>>>>> Stashed changes

        if (spfRecord) {
          return {
            valid: true,
<<<<<<< Updated upstream
            record: spfRecord.substring(0, 100) + '...',
=======
            record: spfRecord.length > 100 ? spfRecord.substring(0, 100) + '...' : spfRecord,
>>>>>>> Stashed changes
          };
        }
      }

      return {
        valid: false,
        error: 'SPF record not found. Add SPF record to DNS TXT records.',
      };
<<<<<<< Updated upstream
    } catch (error) {
      console.error(`SPF validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: 'Failed to query SPF record. Make sure domain is correct.',
=======
    } catch (error: any) {
      console.error(`SPF validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: `Failed to query SPF record: ${error.message || 'Unknown error'}`,
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      const txtRecords = await resolveTxt(dmarcDomain);
=======
      const txtRecords = await this.safeResolveTxt(dmarcDomain);
>>>>>>> Stashed changes

      if (txtRecords && txtRecords.length > 0) {
        const record = txtRecords
          .map((r) => r.join(''))
<<<<<<< Updated upstream
          .find((r) => r.startsWith('v=DMARC1'));
=======
          .find((r) => r.toUpperCase().startsWith('V=DMARC1'));
>>>>>>> Stashed changes

        if (record) {
          const policyMatch = /p=(none|quarantine|reject)/i.exec(record);
          const policy = policyMatch
            ? (policyMatch[1].toLowerCase() as 'none' | 'quarantine' | 'reject')
            : undefined;
<<<<<<< Updated upstream
          return { valid: true, record, policy };
=======
          return { valid: true, record: record.length > 100 ? record.substring(0, 100) + '...' : record, policy };
>>>>>>> Stashed changes
        }
      }

      return {
        valid: false,
        error: 'DMARC record not found. Add a TXT record at _dmarc.' + domain,
      };
<<<<<<< Updated upstream
    } catch (error) {
      console.error(`DMARC validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: 'Failed to query DMARC record. Make sure domain is correct.',
=======
    } catch (error: any) {
      console.error(`DMARC validation failed for ${domain}:`, error);
      return {
        valid: false,
        error: `Failed to query DMARC record: ${error.message || 'Unknown error'}`,
>>>>>>> Stashed changes
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
