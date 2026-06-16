import { Controller, Get, Post, Delete, Body, Param, Request, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { TeamService } from './team.service';
import { WorkspaceService } from './workspace.service';

@Controller('api/team')
export class TeamController {
  constructor(
    private teamService: TeamService,
    private workspaceService: WorkspaceService
  ) {}

  @Get('members')
  async getMembers(@Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    return this.teamService.getMembers(req.user.workspaceId);
  }

  @Get('invites')
  async getInvites(@Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    return this.teamService.getPendingInvitations(req.user.workspaceId);
  }

  @Post('invites')
  async inviteMember(@Body() body: { email: string; role: string }, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    
    // Authorization check
    const ws = await this.workspaceService.getWorkspace(req.user.workspaceId, req.user.userId);
    if (ws.role !== 'owner' && ws.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can invite members');
    }

    return this.teamService.inviteMember(req.user.workspaceId, req.user.userId, body.email, body.role);
  }

  @Delete('invites/:id')
  async cancelInvite(@Param('id') inviteId: string, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    return this.teamService.cancelInvitation(req.user.workspaceId, inviteId);
  }

  @Get('invitation/:token')
  async getInvitation(@Param('token') token: string) {
    return this.teamService.getInvitationByToken(token);
  }

  @Post('invitation/accept')
  async acceptInvitation(@Body() body: { token: string }, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException();
    return this.teamService.acceptInvitation(body.token, req.user.userId);
  }
}
