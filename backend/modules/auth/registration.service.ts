import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import * as crypto from 'crypto';
import { EmailValidationService } from './email-validation.service';

@Injectable()
export class RegistrationService {
  constructor(private emailValidation: EmailValidationService) {}

  /**
   * Step 1: Create initial registration session and company info
   */
  async createRegistrationSession(companyInfo: {
    companyName: string;
    staffName: string;
    numberOfEmployees: number;
    email: string;
  }): Promise<{
    sessionId: string;
    step: number;
    message: string;
  }> {
    const db = getDatabase();

    try {
      // Check if email already exists
      const existingUser = await db.query('SELECT id FROM customers WHERE email = $1', [companyInfo.email]);
      if (existingUser.rows.length > 0) {
        throw new ConflictException('User already exists with this email');
      }

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create registration session
      await db.query(
        `INSERT INTO registration_sessions (session_id, company_name, staff_name, number_of_employees, email, step, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sessionId, companyInfo.companyName, companyInfo.staffName, companyInfo.numberOfEmployees, companyInfo.email, 1, expiresAt]
      );

      return {
        sessionId,
        step: 1,
        message: 'Company information saved. Proceeding to email verification.',
      };
    } catch (error) {
      console.error('Registration session creation error:', error);
      throw error;
    }
  }

  /**
   * Step 2: Send email verification
   */
  async sendEmailVerification(sessionId: string): Promise<{
    step: number;
    message: string;
  }> {
    const db = getDatabase();

    try {
      // Get session
      const sessionResult = await db.query('SELECT * FROM registration_sessions WHERE session_id = $1', [sessionId]);
      if (sessionResult.rows.length === 0) {
        throw new BadRequestException('Registration session not found or expired');
      }

      const session = sessionResult.rows[0];
      const verificationCode = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Update session with verification code
      await db.query(
        `UPDATE registration_sessions SET verification_code = $1, verification_expires = $2, step = $3 WHERE session_id = $4`,
        [verificationCode, verificationExpires, 2, sessionId]
      );

      // Send verification email
      await this.emailValidation.sendVerificationEmail(session.email, verificationCode);

      return {
        step: 2,
        message: `Verification email sent to ${session.email}. Check your email for verification code.`,
      };
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Step 2b: Verify email
   */
  async verifyEmail(sessionId: string, verificationCode: string): Promise<{
    step: number;
    message: string;
  }> {
    const db = getDatabase();

    try {
      // Get session
      const sessionResult = await db.query('SELECT * FROM registration_sessions WHERE session_id = $1', [sessionId]);
      if (sessionResult.rows.length === 0) {
        throw new BadRequestException('Registration session not found or expired');
      }

      const session = sessionResult.rows[0];

      // Check code
      if (session.verification_code !== verificationCode) {
        throw new BadRequestException('Invalid verification code');
      }

      // Check expiration
      if (new Date() > session.verification_expires) {
        throw new BadRequestException('Verification code expired');
      }

      // Mark as verified
      await db.query(
        `UPDATE registration_sessions SET email_verified = true, step = $1 WHERE session_id = $2`,
        [3, sessionId]
      );

      return {
        step: 3,
        message: 'Email verified. Now configure your outbound email.',
      };
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Step 3: Configure outbound email and test DKIM/SPF
   */
  async configureOutboundEmail(sessionId: string, emailConfig: {
    sendingEmail: string;
    domain: string;
    dkimSelector?: string;
  }): Promise<{
    step: number;
    validation: {
      emailValid: boolean;
      dkimValid: boolean;
      spfValid: boolean;
      dmarcValid: boolean;
      dmarcPolicy?: 'none' | 'quarantine' | 'reject';
      errors: string[];
      warnings: string[];
    };
    dkimSelector: string;
    dnsGuideProviders: string[];
    message: string;
  }> {
    const db = getDatabase();

    try {
      // Get session
      const sessionResult = await db.query('SELECT * FROM registration_sessions WHERE session_id = $1', [sessionId]);
      if (sessionResult.rows.length === 0) {
        throw new BadRequestException('Registration session not found');
      }

      const session = sessionResult.rows[0];
      const dkimSelector = emailConfig.dkimSelector || 'logik';

      // Validate DNS records
      const validation = await this.emailValidation.validateOutboundEmail(
        emailConfig.sendingEmail,
        emailConfig.domain
      );

      // Save email config
      await db.query(
        `UPDATE registration_sessions
         SET sending_email = $1,
             domain = $2,
             dkim_selector = $3,
             dkim_valid = $4,
             spf_valid = $5,
             dmarc_valid = $6,
             dmarc_policy = $7,
             step = $8
         WHERE session_id = $9`,
        [
          emailConfig.sendingEmail,
          emailConfig.domain,
          dkimSelector,
          validation.dkimValid,
          validation.spfValid,
          validation.dmarcValid,
          validation.dmarcPolicy ?? null,
          4,
          sessionId,
        ],
      );

      const dnsGuideProviders = ['namecheap', 'godaddy', 'route53', 'cloudflare', 'generic'];

      const dnsOk = validation.dkimValid && validation.spfValid && validation.dmarcValid;
      return {
        step: 4,
        validation,
        dkimSelector,
        dnsGuideProviders,
        message: dnsOk
          ? 'DKIM, SPF, and DMARC configured correctly! Complete registration.'
          : 'One or more DNS records are missing. Follow the DNS guide to complete setup.',
      };
    } catch (error) {
      console.error('Outbound email configuration error:', error);
      throw error;
    }
  }

  /**
   * Get DNS configuration guide
   */
  getDNSGuide(sessionId: string, provider: string): {
    provider: string;
    guide: string;
  } {
    // For now, we'll get generic info (in real scenario, would fetch from DB)
    const guide = this.emailValidation.getDNSConfigurationGuide(provider, 'yourdomain.com', 'logik');

    return {
      provider,
      guide,
    };
  }

  /**
   * Retry DKIM/SPF validation
   */
  async retryValidation(sessionId: string, emailConfig: {
    sendingEmail: string;
    domain: string;
    dkimSelector: string;
  }): Promise<{
    validation: {
      emailValid: boolean;
      dkimValid: boolean;
      spfValid: boolean;
      dmarcValid: boolean;
      dmarcPolicy?: 'none' | 'quarantine' | 'reject';
      errors: string[];
      warnings: string[];
    };
    allValid: boolean;
    message: string;
  }> {
    const db = getDatabase();

    try {
      const validation = await this.emailValidation.validateOutboundEmail(
        emailConfig.sendingEmail,
        emailConfig.domain
      );

      await db.query(
        `UPDATE registration_sessions
         SET dkim_valid = $1, spf_valid = $2, dmarc_valid = $3, dmarc_policy = $4
         WHERE session_id = $5`,
        [
          validation.dkimValid,
          validation.spfValid,
          validation.dmarcValid,
          validation.dmarcPolicy ?? null,
          sessionId,
        ],
      );

      const allValid =
        validation.dkimValid && validation.spfValid && validation.dmarcValid;

      return {
        validation,
        allValid,
        message: allValid
          ? '✓ All DNS records validated successfully!'
          : '✗ Some DNS records still need configuration. Please check the guide.',
      };
    } catch (error) {
      console.error('Validation retry error:', error);
      throw error;
    }
  }

  /**
   * Step 4: Complete registration and create user account
   */
  async completeRegistration(sessionId: string, userData: {
    password: string;
  }): Promise<{
    success: boolean;
    user: any;
    workspace: any;
    message: string;
  }> {
    const db = getDatabase();

    try {
      // Get session
      const sessionResult = await db.query('SELECT * FROM registration_sessions WHERE session_id = $1', [sessionId]);
      if (sessionResult.rows.length === 0) {
        throw new BadRequestException('Registration session not found');
      }

      const session = sessionResult.rows[0];

      // Verify all steps completed
      if (!session.email_verified) {
        throw new BadRequestException('Please verify your email first');
      }

      if (!session.sending_email) {
        throw new BadRequestException('Please configure your outbound email');
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // Create customer
      const userResult = await db.query(
        `INSERT INTO customers (email, password_hash, first_name, plan_tier, subscription_status)
         VALUES ($1, $2, $3, 'starter', 'trial')
         RETURNING id, email, first_name`,
        [session.email, passwordHash, session.staff_name]
      );

      const user = userResult.rows[0];

      // Create company
      const companyResult = await db.query(
        `INSERT INTO companies (customer_id, name, number_of_employees)
         VALUES ($1, $2, $3)
         RETURNING id, name`,
        [user.id, session.company_name, session.number_of_employees]
      );

      const company = companyResult.rows[0];

      // Create workspace
      const workspaceResult = await db.query(
        `INSERT INTO workspaces (customer_id, name, company_id)
         VALUES ($1, $2, $3)
         RETURNING id, name`,
        [user.id, `${session.company_name} Workspace`, company.id]
      );

      const workspace = workspaceResult.rows[0];

      // Create email config (workspace-scoped)
      await db.query(
        `INSERT INTO email_configs (
           workspace_id, customer_id, sending_email, domain, dkim_selector,
           dkim_valid, spf_valid, dmarc_valid, dmarc_policy
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          workspace.id,
          user.id,
          session.sending_email,
          session.domain,
          session.dkim_selector,
          session.dkim_valid,
          session.spf_valid,
          session.dmarc_valid ?? false,
          session.dmarc_policy ?? null,
        ],
      );

      // Delete session (cleanup)
      await db.query('DELETE FROM registration_sessions WHERE session_id = $1', [sessionId]);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          company: company,
        },
        message: 'Registration completed successfully!',
      };
    } catch (error) {
      console.error('Registration completion error:', error);
      throw error;
    }
  }

  /**
   * Get registration session status
   */
  async getSessionStatus(sessionId: string): Promise<any> {
    const db = getDatabase();

    try {
      const result = await db.query('SELECT * FROM registration_sessions WHERE session_id = $1', [sessionId]);
      if (result.rows.length === 0) {
        throw new BadRequestException('Registration session not found or expired');
      }

      const session = result.rows[0];

      return {
        sessionId,
        step: session.step,
        companyName: session.company_name,
        staffName: session.staff_name,
        email: session.email,
        emailVerified: session.email_verified,
        sendingEmail: session.sending_email,
        domain: session.domain,
        dkimValid: session.dkim_valid,
        spfValid: session.spf_valid,
        dmarcValid: session.dmarc_valid,
        dmarcPolicy: session.dmarc_policy,
      };
    } catch (error) {
      console.error('Session status error:', error);
      throw error;
    }
  }
}
