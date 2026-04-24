import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthedWithWorkspace, getWorkspaceId } from '../../shared/auth-context.util';
import { AuditLogService } from './audit-log.service';
import { Roles } from '../../shared/roles.decorator';
import { RolesGuard } from '../../shared/roles.guard';

@Controller('api/audit')
@UseGuards(RolesGuard)
@Roles('owner', 'admin')
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  list(
    @Req() req: AuthedWithWorkspace,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    const { workspaceId } = getWorkspaceId(req);
    return this.audit.list(workspaceId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      action,
      actorId: actor,
      since,
      until,
    });
  }

  @Get('counts')
  counts(@Req() req: AuthedWithWorkspace, @Query('days') days?: string) {
    const { workspaceId } = getWorkspaceId(req);
    return this.audit.countActions(workspaceId, days ? Number(days) : 30);
  }
}
