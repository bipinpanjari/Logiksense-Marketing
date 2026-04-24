import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthMiddleware, WorkspaceMiddleware } from './shared/auth.middleware';
import { PrismaService } from './shared/prisma.service';
import { VaultService } from './shared/vault.service';
import { AppQueueModule } from './shared/queue.module';
import { AuthService } from './modules/auth/auth.service';
import { RegistrationService } from './modules/auth/registration.service';
import { EmailValidationService } from './modules/auth/email-validation.service';
import { AuthController } from './modules/auth/auth.controller';
import { WorkspaceService } from './modules/workspaces/workspace.service';
import { WorkspaceController } from './modules/workspaces/workspace.controller';
import { LeadService } from './modules/leads/lead.service';
import { LeadImportService } from './modules/leads/lead-import.service';
import { LeadExtractionService } from './modules/leads/lead-extraction.service';
import { LeadScoringService } from './modules/leads/lead-scoring.service';
import { ContactSegmentationService } from './modules/leads/contact-segmentation.service';
import { EmailAnalyticsService } from './modules/leads/email-analytics.service';
import { LeadController } from './modules/leads/lead.controller';
import { WebhookService } from './modules/leads/webhook.service';
import { WebhookController } from './modules/leads/webhook.controller';
import { ContactService } from './modules/contacts/contact.service';
import { ContactController } from './modules/contacts/contact.controller';
import { EmailController } from './modules/email/email.controller';
import { EmailService } from './modules/email/email.service';
import { MarketingEmailController } from './modules/email/marketing-email.controller';
import { MarketingEmailService } from './modules/email/marketing-email.service';
import { HealthModule } from './modules/health/health.module';
import { EmailEngineModule } from './modules/email-engine/email-engine.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { LinkedInModule } from './modules/linkedin/linkedin.module';
import { AiModule } from './modules/ai/ai.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ObservabilityModule } from './modules/observability/observability.module';

const isDev = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
        transport: isDev
          ? {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
            }
          : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.apiKey',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: parseInt(process.env.RATE_LIMIT_DEFAULT || '600', 10),
      },
    ]),
    AppQueueModule.register(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    HealthModule,
    EmailEngineModule,
    ScraperModule,
    LinkedInModule,
    AiModule,
    PipelineModule,
    ComplianceModule,
    ObservabilityModule,
  ],
  controllers: [
    AuthController,
    WorkspaceController,
    LeadController,
    WebhookController,
    ContactController,
    EmailController,
    MarketingEmailController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AuthService,
    RegistrationService,
    EmailValidationService,
    WorkspaceService,
    PrismaService,
    VaultService,
    LeadService,
    LeadExtractionService,
    LeadImportService,
    LeadScoringService,
    ContactSegmentationService,
    EmailAnalyticsService,
    WebhookService,
    ContactService,
    EmailService,
    MarketingEmailService,
  ],
  exports: [VaultService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('*')
      .apply(WorkspaceMiddleware)
      .forRoutes('*');
  }
}
