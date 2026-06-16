<<<<<<< Updated upstream
import { Body, Controller, Get, Post, Put, Request, UnauthorizedException } from '@nestjs/common';
=======
import { Body, Controller, Delete, Get, Param, Post, Put, Request, UnauthorizedException } from '@nestjs/common';
>>>>>>> Stashed changes
import { EmailService, UpsertEmailConfigInput } from './email.service';
import { RequestWithUser } from '../../shared/auth.middleware';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

<<<<<<< Updated upstream
=======
  @Get('configs')
  async getConfigs(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) return [];
    return this.emailService.getActiveConfigs(workspaceId, customerId);
  }

  // Backwards compatibility for old UI
>>>>>>> Stashed changes
  @Get('config')
  async getConfig(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
<<<<<<< Updated upstream
    if (!workspaceId || !customerId) {
      return null;
    }
    return this.emailService.getActiveConfig(workspaceId, customerId);
  }

  @Put('config')
  async upsertConfig(@Request() req: RequestWithUser, @Body() body: UpsertEmailConfigInput) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.emailService.upsertConfig(workspaceId as string, customerId as string, body);
  }

  @Post('test-connection')
  async testConnection(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.emailService.testConnection(workspaceId as string, customerId as string);
  }

  @Post('send-test')
  async sendTest(@Request() req: RequestWithUser, @Body() body: { to: string; subject?: string; html?: string }) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.emailService.sendTestEmail(workspaceId as string, customerId as string, body?.to, body?.subject, body?.html);
=======
    if (!workspaceId || !customerId) return null;
    const configs = await this.emailService.getActiveConfigs(workspaceId, customerId);
    return configs.length > 0 ? configs[0] : null;
  }

  @Post('configs')
  async createConfig(@Request() req: RequestWithUser, @Body() body: UpsertEmailConfigInput) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.emailService.createConfig(workspaceId, customerId, body);
  }

  @Put('configs/:id')
  async updateConfig(@Request() req: RequestWithUser, @Param('id') id: string, @Body() body: UpsertEmailConfigInput) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.emailService.updateConfig(workspaceId, customerId, id, body);
  }

  @Delete('configs/:id')
  async deleteConfig(@Request() req: RequestWithUser, @Param('id') id: string) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    await this.emailService.deleteConfig(workspaceId, customerId, id);
    return { success: true };
  }

  @Post('test-connection')
  async testConnection(@Request() req: RequestWithUser, @Body() body: { configId?: string }) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.emailService.testConnection(workspaceId, customerId, body?.configId);
  }

  @Post('send-test')
  async sendTest(@Request() req: RequestWithUser, @Body() body: { to: string; subject?: string; html?: string; configId?: string }) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    return this.emailService.sendTestEmail(workspaceId, customerId, body?.to, body?.subject, body?.html, body?.configId);
>>>>>>> Stashed changes
  }

  @Post('validate-dkim')
  async validateDkim(@Body() body: { domain: string; selector?: string }) {
    return this.emailService.validateDkim(body?.domain, body?.selector);
  }

  @Post('validate-spf')
  async validateSpf(@Body() body: { domain: string }) {
    return this.emailService.validateSpf(body?.domain);
  }

  @Post('validate-dmarc')
  async validateDmarc(@Body() body: { domain: string }) {
    return this.emailService.validateDmarc(body?.domain);
  }
<<<<<<< Updated upstream
}

=======

  @Get('oauth/microsoft-url/:id')
  async getMicrosoftAuthUrl(@Request() req: RequestWithUser, @Param('id') id: string) {
    const customerId = req.user?.userId;
    if (!customerId) throw new UnauthorizedException();
    return this.emailService.getMicrosoftAuthUrl(customerId, id);
  }

  @Post('oauth/microsoft-callback')
  async microsoftCallback(@Request() req: RequestWithUser, @Body() body: { code: string; configId: string }) {
    const customerId = req.user?.userId;
    if (!customerId) throw new UnauthorizedException();
    return this.emailService.handleMicrosoftCallback(customerId, body.configId, body.code);
  }
}
>>>>>>> Stashed changes
