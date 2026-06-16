import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../shared/prisma.service';

@Injectable()
export class TeamService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;

  constructor(private prisma: PrismaService) {
    this.fromEmail = process.env.SMTP_FROM || 'noreply@logik-sense.com';
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        } : undefined,
      });
    }
  }

  async getMembers(workspaceId: string) {
    const db = getDatabase();
    const result = await db.query(
      `SELECT m.id, m.role, m.joined_at, c.email, c.first_name, c.last_name
       FROM workspace_members m
       JOIN customers c ON m.customer_id = c.id
       WHERE m.workspace_id = $1
       ORDER BY m.joined_at ASC`,
      [workspaceId]
    );
    return result.rows;
  }

  async getPendingInvitations(workspaceId: string) {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, email, role, expires_at, created_at
       FROM workspace_invitations
       WHERE workspace_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [workspaceId]
    );
    return result.rows;
  }

  async inviteMember(workspaceId: string, inviterId: string, email: string, role: string) {
    const db = getDatabase();

    // Check if already a member
    const existingMember = await db.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND customer_id = (SELECT id FROM customers WHERE email = $2)',
      [workspaceId, email.toLowerCase()]
    );
    if (existingMember.rows.length > 0) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600000); // 7 days

    const result = await db.query(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token, inviter_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role`,
      [workspaceId, email.toLowerCase(), role, token, inviterId, expiresAt]
    );

    const ws = await db.query('SELECT name FROM workspaces WHERE id = $1', [workspaceId]);
    const workspaceName = ws.rows[0]?.name || 'a workspace';

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;

    if (this.transporter) {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: `You've been invited to join ${workspaceName} on LogikSense`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2>Team Invitation</h2>
            <p>You have been invited to join the <strong>${workspaceName}</strong> team on LogikSense Marketing Automation Suite.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${inviteUrl}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
            </div>
            <p>If you don't have an account yet, you'll be prompted to create one first.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #888;">This invitation Link will expire in 7 days.</p>
          </div>
        `,
      });
    }

    return result.rows[0];
  }

  async cancelInvitation(workspaceId: string, inviteId: string) {
    const db = getDatabase();
    await db.query(
      'DELETE FROM workspace_invitations WHERE id = $1 AND workspace_id = $2',
      [inviteId, workspaceId]
    );
    return { success: true };
  }

  async getInvitationByToken(token: string) {
    const db = getDatabase();
    const result = await db.query(
      `SELECT i.*, w.name as workspace_name
       FROM workspace_invitations i
       JOIN workspaces w ON i.workspace_id = w.id
       WHERE i.token = $1 AND i.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Invitation not found or expired');
    }
    return result.rows[0];
  }

  async acceptInvitation(token: string, customerId: string) {
    const invite = await this.getInvitationByToken(token);
    const db = getDatabase();

    // Add to members
    await db.query(
      `INSERT INTO workspace_members (workspace_id, customer_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, customer_id) DO UPDATE SET role = EXCLUDED.role`,
      [invite.workspace_id, customerId, invite.role]
    );

    // Delete invite
    await db.query('DELETE FROM workspace_invitations WHERE id = $1', [invite.id]);

    return { workspaceId: invite.workspace_id };
  }
}
