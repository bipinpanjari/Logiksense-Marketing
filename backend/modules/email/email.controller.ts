import { Body, Controller, Get, Post, Put, Request, UnauthorizedException } from '@nestjs/common';
import { EmailService, UpsertEmailConfigInput } from './email.service';
import { RequestWithUser } from '../../shared/auth.middleware';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('config')
  async getConfig(@Request() req: RequestWithUser) {
    const workspaceId = req.user?.workspaceId;
    const customerId = req.user?.userId;
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
}

