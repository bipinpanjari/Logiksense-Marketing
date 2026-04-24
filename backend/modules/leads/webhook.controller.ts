import { Controller, Post, Get, Delete, Body, Param, Request, BadRequestException } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('api')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  // ===== WEBHOOK MANAGEMENT =====

  @Post('webhooks/generate')
  async generateWebhook(@Body('workspaceName') workspaceName: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.webhookService.generateWebhookUrl(
      req.user.workspaceId,
      req.user.userId,
      workspaceName,
    );
  }

  @Get('webhooks')
  async getWebhooks(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.webhookService.getWebhooks(req.user.workspaceId);
  }

  @Delete('webhooks/:id')
  async revokeWebhook(@Param('id') webhookId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.webhookService.revokeWebhook(req.user.workspaceId, webhookId);
  }

  // ===== CONTACT FORM SUBMISSION =====
  // This endpoint is PUBLIC - no auth required
  // API key validation is inside the service

  @Post('webhooks/contact-form/:id')
  async handleContactFormSubmission(
    @Param('id') webhookId: string,
    @Body() dataWithApiKey: any
  ) {
    const { apiKey, ...leadData } = dataWithApiKey;

    if (!apiKey) {
      throw new BadRequestException('API key required');
    }

    if (!leadData.email) {
      throw new BadRequestException('Email is required');
    }

    return this.webhookService.handleContactFormSubmission(webhookId, apiKey, leadData);
  }

  // ===== WEBHOOK TEST =====
  @Post('webhooks/test/:id')
  async testWebhook(@Param('id') webhookId: string, @Body() testData: any) {
    if (!testData.apiKey) {
      throw new BadRequestException('API key required for testing');
    }

    // Test with sample data
    const testLead = {
      firstName: 'Test',
      lastName: 'User',
      email: `test-${Date.now()}@example.com`,
      message: 'This is a test submission',
      ...testData,
    };

    return this.webhookService.handleContactFormSubmission(
      webhookId,
      testData.apiKey,
      testLead
    );
  }
}
