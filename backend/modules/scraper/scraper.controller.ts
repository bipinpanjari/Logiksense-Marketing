import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AuthedWithWorkspace, getWorkspaceContext, getWorkspaceId } from '../../shared/auth-context.util';
import { ScraperService, CreateProfileInput } from './scraper.service';

@Controller('api/scraper')
export class ScraperController {
  constructor(private readonly scraper: ScraperService) {}

  @Get('status')
  status(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.scraper.getStatus(workspaceId);
  }

  @Post('accept-tos')
  accept(@Req() req: AuthedWithWorkspace) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.scraper.acceptTos(workspaceId, customerId);
  }

  @Post('disable')
  disable(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.scraper.disableScraping(workspaceId);
  }

  @Get('profiles')
  list(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.scraper.listProfiles(workspaceId);
  }

  @Post('profiles')
  create(@Req() req: AuthedWithWorkspace, @Body() body: CreateProfileInput) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.scraper.createProfile(workspaceId, customerId, body);
  }

  @Patch('profiles/:id')
  update(
    @Req() req: AuthedWithWorkspace,
    @Param('id') id: string,
    @Body() body: Partial<CreateProfileInput> & { isActive?: boolean },
  ) {
    const { workspaceId } = getWorkspaceId(req);
    return this.scraper.updateProfile(workspaceId, id, body);
  }

  @Delete('profiles/:id')
  remove(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.scraper.deleteProfile(workspaceId, id);
  }

  @Post('profiles/:id/run')
  runProfile(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.scraper.runProfile(workspaceId, customerId, id);
  }

  @Post('run')
  runAdhoc(@Req() req: AuthedWithWorkspace, @Body() body: any) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.scraper.runAdhoc(workspaceId, customerId, body);
  }

  @Get('jobs')
  listJobs(@Req() req: AuthedWithWorkspace, @Query('limit') limit?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.scraper.listJobs(workspaceId, limit ? Number(limit) : 50);
  }

  @Get('jobs/:id')
  @Header('Cache-Control', 'no-store')
  getJob(@Req() req: AuthedWithWorkspace, @Param('id') id: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.scraper.getJobDetail(workspaceId, id);
  }
}
