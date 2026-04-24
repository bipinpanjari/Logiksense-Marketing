import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AuthedWithWorkspace, getWorkspaceContext, getWorkspaceId } from '../../shared/auth-context.util';
import { PipelineService, PipelineStage, STAGE_ORDER } from './pipeline.service';
import { AnalyticsService } from './analytics.service';
import { ContactNotesService } from './contact-notes.service';
import { RepliesService } from './replies.service';

@Controller('api/pipeline')
export class PipelineController {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly analytics: AnalyticsService,
    private readonly notes: ContactNotesService,
    private readonly replies: RepliesService,
  ) {}

  @Get('stages')
  stages(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.pipeline.stageCounts(workspaceId);
  }

  @Get()
  async board(@Req() req: AuthedWithWorkspace, @Query('stage') stage?: string) {
    const { workspaceId } = getWorkspaceId(req);
    if (stage) {
      if (!STAGE_ORDER.includes(stage as PipelineStage)) {
        throw new BadRequestException('invalid stage');
      }
      return this.pipeline.listByStage(workspaceId, stage as PipelineStage, 500);
    }
    const counts = await this.pipeline.stageCounts(workspaceId);
    const columns = await Promise.all(
      STAGE_ORDER.map(async (s) => ({
        stage: s,
        count: counts.find((c) => c.stage === s)?.count ?? 0,
        leads: await this.pipeline.listByStage(workspaceId, s, 50),
      })),
    );
    return { stages: counts, columns };
  }

  @Get('lead/:id/timeline')
  timeline(@Req() req: AuthedWithWorkspace, @Param('id') leadId: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.pipeline.timeline(workspaceId, leadId);
  }

  @Post('lead/:id/stage')
  setStage(@Req() req: AuthedWithWorkspace, @Param('id') leadId: string, @Body() body: { stage: PipelineStage }) {
    const { workspaceId } = getWorkspaceId(req);
    return this.pipeline.setStage(workspaceId, leadId, body.stage);
  }

  @Get('lead/:id/notes')
  listNotes(@Req() req: AuthedWithWorkspace, @Param('id') leadId: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.notes.list(workspaceId, leadId);
  }

  @Post('lead/:id/notes')
  createNote(@Req() req: AuthedWithWorkspace, @Param('id') leadId: string, @Body() body: { body: string }) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.notes.create(workspaceId, leadId, customerId, body.body);
  }

  @Patch('notes/:noteId')
  updateNote(@Req() req: AuthedWithWorkspace, @Param('noteId') noteId: string, @Body() body: { body: string }) {
    const { workspaceId } = getWorkspaceId(req);
    return this.notes.update(workspaceId, noteId, body.body);
  }

  @Delete('notes/:noteId')
  deleteNote(@Req() req: AuthedWithWorkspace, @Param('noteId') noteId: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.notes.remove(workspaceId, noteId);
  }

  @Get('replies')
  listReplies(@Req() req: AuthedWithWorkspace, @Query('limit') limit?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.replies.list(workspaceId, Number(limit) || 100);
  }

  @Get('inbound/token')
  getInboundToken(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.replies.ensureWebhookToken(workspaceId).then((token) => ({ token }));
  }

  @Post('inbound/token/rotate')
  rotateInboundToken(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.replies.rotateWebhookToken(workspaceId).then((token) => ({ token }));
  }
}

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.analytics.kpis(workspaceId);
  }

  @Get('top-campaigns')
  topCampaigns(@Req() req: AuthedWithWorkspace, @Query('limit') limit?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.analytics.topCampaigns(workspaceId, Number(limit) || 5);
  }

  @Get('sends-by-day')
  sendsByDay(@Req() req: AuthedWithWorkspace, @Query('days') days?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.analytics.sendsByDay(workspaceId, Number(days) || 30);
  }
}
