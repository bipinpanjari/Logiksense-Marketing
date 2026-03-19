import { Body, Controller, Get, Patch, Post, Query, Request, UnauthorizedException, Param } from '@nestjs/common';
import { RequestWithUser } from '../../shared/auth.middleware';
import { MarketingEmailService } from './marketing-email.service';

@Controller('api/marketing-email')
export class MarketingEmailController {
  constructor(private readonly marketingEmailService: MarketingEmailService) {}

  @Get('campaigns')
  async listCampaigns(
    @Request() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string
  ) {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.listCampaigns(workspaceId, { from, to, status });
  }

  @Post('campaigns')
  async createCampaign(
    @Request() req: RequestWithUser,
    @Body() body: { name: string; status?: string; audienceCount?: number; scheduledAt?: string }
  ) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.createCampaign(workspaceId, customerId, body);
  }

  @Patch('campaigns/:id')
  async updateCampaign(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { name?: string; status?: string; audienceCount?: number; scheduledAt?: string | null }
  ) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.updateCampaign(workspaceId, customerId, id, body);
  }

  @Get('calendar')
  async calendar(@Request() req: RequestWithUser, @Query('days') days?: string) {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.getCalendar(workspaceId, days ? Number(days) : 7);
  }

  @Get('templates')
  async listTemplates(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.listTemplates(workspaceId);
  }

  @Post('templates')
  async createTemplate(
    @Request() req: RequestWithUser,
    @Body() body: { name: string; subject: string; bodyHtml: string; bodyText?: string; category?: string }
  ) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.createTemplate(workspaceId, customerId, body);
  }

  @Get('sequences')
  async listSequences(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.listSequences(workspaceId);
  }

  @Post('sequences')
  async createSequence(
    @Request() req: RequestWithUser,
    @Body() body: { name: string; description?: string; status?: string; steps: Array<{ id: number | string; name: string; delayHours: number; subject?: string }> }
  ) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.marketingEmailService.createSequence(workspaceId, customerId, body);
  }
}

