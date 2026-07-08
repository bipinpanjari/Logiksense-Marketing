
import { Body, Controller, Delete, Get, Param, Post, Put, Request, UnauthorizedException } from '@nestjs/common';

import { EmailService, UpsertEmailConfigInput } from './email.service';
import { RequestWithUser } from '../../shared/auth.middleware';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}


  @Get('configs')
  async getConfigs(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) return [];
    return this.emailService.getActiveConfigs(workspaceId, customerId);
  }

  // Backwards compatibility for old UI

  @Get('config')
  async getConfig(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;

    if (!workspaceId || !customerId) return null;
    const configs = await this.emailService.getActiveConfigs(workspaceId, customerId);
    return configs.length > 0 ? configs[0] : null;
  }

  @Put('config')
  async updateDefaultConfig(@Request() req: RequestWithUser, @Body() body: UpsertEmailConfigInput) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
    if (!workspaceId || !customerId) throw new UnauthorizedException('Not authenticated');
    
    // Get the default config (first one) and update it
    const configs = await this.emailService.getActiveConfigs(workspaceId, customerId);
    if (configs.length === 0) {
      // If no config exists, create one
      return this.emailService.createConfig(workspaceId, customerId, body);
    }
    // Update the first config
    return this.emailService.updateConfig(workspaceId, customerId, configs[0].id, body);
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


  @Get('oauth/microsoft-url/:id')
  async getMicrosoftAuthUrl(@Request() req: RequestWithUser, @Param('id') id: string) {
    const customerId = req.user?.userId;
    if (!customerId) throw new UnauthorizedException();
    return this.emailService.getMicrosoftAuthUrl(customerId, id);
  }

  @Get('oauth/microsoft-callback')
  async microsoftCallback(@Request() req: any) {
    const { code, state } = req.query;
    if (!code || !state) throw new UnauthorizedException('Missing code or state parameter');
    return this.emailService.handleMicrosoftCallbackPublic(state, code);
  }
}

