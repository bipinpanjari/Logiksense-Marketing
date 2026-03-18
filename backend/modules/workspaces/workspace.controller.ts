import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';

@Controller('api/workspaces')
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  @Post()
  async createWorkspace(@Body('name') name: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.workspaceService.createWorkspace(req.user.userId, name);
  }

  @Get()
  async getWorkspaces(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.workspaceService.getWorkspaces(req.user.userId);
  }

  @Get(':id')
  async getWorkspace(@Param('id') workspaceId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.workspaceService.getWorkspace(workspaceId, req.user.userId);
  }

  @Get(':id/stats')
  async getWorkspaceStats(@Param('id') workspaceId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    // Verify ownership
    await this.workspaceService.getWorkspace(workspaceId, req.user.userId);
    return this.workspaceService.getWorkspaceStats(workspaceId);
  }

  @Put(':id')
  async updateWorkspace(
    @Param('id') workspaceId: string,
    @Body() updates: any,
    @Request() req: any
  ) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.workspaceService.updateWorkspace(workspaceId, req.user.userId, updates);
  }

  @Post(':id/switch')
  async switchWorkspace(@Param('id') workspaceId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.workspaceService.switchWorkspace(req.user.userId, workspaceId);
  }
}
