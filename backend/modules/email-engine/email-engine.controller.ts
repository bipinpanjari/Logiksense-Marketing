import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { CampaignLauncherService } from './campaign-launcher.service';
import { SequenceEngineService } from './sequence-engine.service';
import { EmailDispatcherService } from './email-dispatcher.service';

import { WarmupEngineService } from './warmup-engine.service';

import { getDatabase } from '../../shared/database';
import { AuthedWithWorkspace, getWorkspaceContext, getWorkspaceId } from '../../shared/auth-context.util';

@Controller('api/email-engine')
export class EmailEngineController {
  constructor(
    private readonly launcher: CampaignLauncherService,
    private readonly sequence: SequenceEngineService,
    private readonly dispatcher: EmailDispatcherService,

    private readonly warmup: WarmupEngineService,
  ) {}

  @Post('warmup/run')
  async runWarmup() {
    // Note: In production this would usually be restricted to super-admins or a CRON
    await this.warmup.runWarmupCycle();
    return { ok: true, message: 'Warmup cycle triggered' };
  }


  @Post('campaigns/:id/launch')
  async launchCampaign(@Param('id') campaignId: string, @Req() req: AuthedWithWorkspace) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.launcher.launchCampaign(workspaceId, customerId, campaignId);
  }

  @Post('campaigns/:id/pause')
  async pauseCampaign(@Param('id') campaignId: string, @Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.launcher.pauseCampaign(workspaceId, campaignId);
  }

  @Get('campaigns/:id')
  async campaignDetail(@Param('id') campaignId: string, @Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    const db = getDatabase();
    const cRes = await db.query(
      `SELECT c.*, t.name AS template_name, s.name AS segment_name
       FROM email_campaigns c
       LEFT JOIN email_templates t ON t.id = c.template_id
       LEFT JOIN contact_segments s ON s.id = c.segment_id
       WHERE c.id = $1 AND c.workspace_id = $2`,
      [campaignId, workspaceId],
    );
    if (cRes.rows.length === 0) return { error: 'not-found' };
    const c = cRes.rows[0];

    const logs = await db.query(
      `SELECT id, lead_id, status, subject, sent_at, opened_at, clicked_at, bounced_at, bounce_reason
       FROM email_logs
       WHERE campaign_id = $1
       ORDER BY sent_at DESC NULLS LAST
       LIMIT 200`,
      [campaignId],
    );
    return { campaign: c, logs: logs.rows };
  }

  @Post('sequences/:id/enroll/:leadId')
  async enroll(
    @Param('id') sequenceId: string,
    @Param('leadId') leadId: string,
    @Req() req: AuthedWithWorkspace,
  ) {
    const { workspaceId } = getWorkspaceId(req);
    return this.sequence.enrollLead(workspaceId, sequenceId, leadId);
  }

  @Post('sequences/enrollments/:enrollmentId/pause')
  async pauseEnrollment(@Param('enrollmentId') id: string) {
    return this.sequence.pauseEnrollment(id);
  }

  @Post('sequences/enrollments/:enrollmentId/resume')
  async resumeEnrollment(@Param('enrollmentId') id: string) {
    return this.sequence.resumeEnrollment(id);
  }

  @Post('test-send')
  async testSend(
    @Req() req: AuthedWithWorkspace,
    @Body() body: { leadId: string; templateId?: string; subject?: string; html?: string; text?: string },
  ) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    if (!body?.leadId) throw new BadRequestException('leadId is required');
    const override =
      body.subject && body.html ? { subject: body.subject, html: body.html, text: body.text } : undefined;
    return this.dispatcher.dispatch({
      workspaceId,
      customerId,
      leadId: body.leadId,
      templateId: body.templateId,
      override,
    });
  }

  @Get('templates/:id/preview')
  async previewTemplate(@Param('id') templateId: string, @Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    const db = getDatabase();
    const r = await db.query(
      `SELECT id, name, subject, body_html, body_text, category FROM email_templates
       WHERE id = $1 AND workspace_id = $2`,
      [templateId, workspaceId],
    );
    if (r.rows.length === 0) return { error: 'not-found' };
    return { template: r.rows[0] };
  }
}
