import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AuthedWithWorkspace, getWorkspaceContext, getWorkspaceId } from '../../shared/auth-context.util';
import { LinkedInAccountService, PairAccountInput } from './linkedin-account.service';
import { CreateCampaignInput, LinkedInService } from './linkedin.service';

@Controller('api/linkedin')
export class LinkedInController {
  constructor(
    private readonly accounts: LinkedInAccountService,
    private readonly service: LinkedInService,
  ) {}

  @Get('status')
  status(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.accounts.getStatus(workspaceId);
  }

  @Post('accept-tos')
  acceptTos(@Req() req: AuthedWithWorkspace) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.accounts.acceptTos(workspaceId, customerId);
  }

  @Post('disable')
  disable(@Req() req: AuthedWithWorkspace) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.accounts.disable(workspaceId, customerId);
  }

  @Get('accounts')
  listAccounts(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.accounts.list(workspaceId);
  }

  @Post('accounts')
  pairAccount(@Req() req: AuthedWithWorkspace, @Body() body: PairAccountInput) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.accounts.pair(workspaceId, customerId, body);
  }

  @Post('accounts/:id/pause')
  pauseAccount(@Req() req: AuthedWithWorkspace, @Param('id') id: string, @Body() body: { reason?: string }) {
    const { workspaceId } = getWorkspaceId(req);
    return this.accounts.pause(workspaceId, id, body?.reason);
  }

  @Post('accounts/:id/resume')
  resumeAccount(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.accounts.resume(workspaceId, id);
  }

  @Delete('accounts/:id')
  removeAccount(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.accounts.remove(workspaceId, id);
  }

  @Get('audit-log')
  auditLog(@Req() req: AuthedWithWorkspace, @Query('limit') limit?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.accounts.auditLog(workspaceId, Number(limit) || 200);
  }

  @Get('campaigns')
  listCampaigns(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.service.listCampaigns(workspaceId);
  }

  @Post('campaigns')
  createCampaign(@Req() req: AuthedWithWorkspace, @Body() body: CreateCampaignInput) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.service.createCampaign(workspaceId, customerId, body);
  }

  @Get('campaigns/:id')
  getCampaign(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.service.getCampaign(workspaceId, id);
  }

  @Patch('campaigns/:id')
  updateCampaign(@Req() req: AuthedWithWorkspace, @Param('id') id: string, @Body() body: Partial<CreateCampaignInput>) {
    const { workspaceId } = getWorkspaceId(req);
    return this.service.updateCampaign(workspaceId, id, body);
  }

  @Post('campaigns/:id/start')
  start(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.service.startCampaign(workspaceId, id);
  }

  @Post('campaigns/:id/pause')
  pause(@Req() req: AuthedWithWorkspace, @Param('id') id: string, @Body() body: { reason?: string }) {
    const { workspaceId } = getWorkspaceId(req);
    return this.service.pauseCampaign(workspaceId, id, body?.reason);
  }

  @Delete('campaigns/:id')
  remove(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.service.deleteCampaign(workspaceId, id);
  }
}
