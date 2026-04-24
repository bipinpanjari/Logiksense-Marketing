import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthedWithWorkspace, getWorkspaceContext, getWorkspaceId } from '../../shared/auth-context.util';
import { GdprService } from './gdpr.service';
import { Roles } from '../../shared/roles.decorator';
import { RolesGuard } from '../../shared/roles.guard';

@Controller('api/compliance')
@UseGuards(RolesGuard)
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  /** GDPR Art. 15 data export. Any authenticated workspace member can request their own workspace export. */
  @Post('export')
  @Roles('owner', 'admin', 'member')
  export(@Req() req: AuthedWithWorkspace) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.gdpr.requestExport(workspaceId, customerId);
  }

  /** GDPR Art. 17 right-to-erasure. Owner only. */
  @Post('purge')
  @Roles('owner')
  purge(@Req() req: AuthedWithWorkspace, @Body() body: { confirm: string }) {
    const { workspaceId, customerId } = getWorkspaceContext(req);
    return this.gdpr.requestDeletion(workspaceId, customerId, body?.confirm ?? '');
  }

  @Get('requests')
  @Roles('owner', 'admin')
  requests(@Req() req: AuthedWithWorkspace) {
    const { workspaceId } = getWorkspaceId(req);
    return this.gdpr.listRequests(workspaceId);
  }
}
