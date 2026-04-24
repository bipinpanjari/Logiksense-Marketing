import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { AuthedWithWorkspace, getWorkspaceContext, getWorkspaceId } from '../../shared/auth-context.util';
import { AiSettingsService, UpdateAiSettingsInput } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';
import { NameDetectorService } from './name-detector.service';
import { IcebreakerService } from './icebreaker.service';
import { EnrichmentService } from './enrichment.service';

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
    private readonly detector: NameDetectorService,
    private readonly icebreaker: IcebreakerService,
    private readonly enrichment: EnrichmentService,
  ) {}

  @Get('settings')
  getSettings(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.settings.get(workspaceId);
  }

  @Post('settings')
  updateSettings(@Req() req: AuthedWithWorkspace, @Body() body: UpdateAiSettingsInput) {
    const { workspaceId } = getWorkspaceId(req);
    return this.settings.update(workspaceId, body);
  }

  @Get('usage/summary')
  usageSummary(@Req() req: AuthedWithWorkspace, @Query('days') days?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.usage.summary(workspaceId, Number(days) || 30);
  }

  @Get('usage/recent')
  usageRecent(@Req() req: AuthedWithWorkspace, @Query('limit') limit?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.usage.recent(workspaceId, Number(limit) || 100);
  }

  @Post('detect-name')
  detectName(
    @Req() req: AuthedWithWorkspace,
    @Body()
    body: {
      email?: string;
      linkedinName?: string;
      companyName?: string;
      jobTitle?: string;
      industry?: string;
      location?: string;
    },
  ) {
    getWorkspaceId(req);
    return this.detector.detect(body);
  }

  @Post('icebreaker')
  async generateIcebreaker(
    @Req() req: AuthedWithWorkspace,
    @Body()
    body: {
      leadId?: string;
      companyName: string;
      websiteText?: string;
      industry?: string;
      jobTitle?: string;
      firstName?: string;
    },
  ) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    if (!body.companyName) throw new BadRequestException('companyName required');
    return this.icebreaker.generate({
      workspaceId,
      customerId,
      leadId: body.leadId,
      companyName: body.companyName,
      websiteText: body.websiteText,
      industry: body.industry,
      jobTitle: body.jobTitle,
      firstName: body.firstName,
    });
  }

  @Post('enrich/lead/:id')
  enrichLead(@Req() req: AuthedWithWorkspace, @Param('id') leadId: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.enrichment.enrichLead(workspaceId, leadId);
  }

  @Post('enrich/verify-email')
  verifyEmail(@Req() req: AuthedWithWorkspace, @Body() body: { email: string }) {
    const { workspaceId } = getWorkspaceId(req);
    if (!body.email) throw new BadRequestException('email required');
    return this.enrichment.verifyEmail(workspaceId, body.email);
  }
}
