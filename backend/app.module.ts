import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
// import { BullModule } from '@nestjs/bull';
import { AuthMiddleware, WorkspaceMiddleware } from './shared/auth.middleware';
import { AuthService } from './modules/auth/auth.service';
import { RegistrationService } from './modules/auth/registration.service';
import { EmailValidationService } from './modules/auth/email-validation.service';
import { AuthController } from './modules/auth/auth.controller';
import { WorkspaceService } from './modules/workspaces/workspace.service';
import { WorkspaceController } from './modules/workspaces/workspace.controller';
import { LeadService } from './modules/leads/lead.service';
import { LeadImportService } from './modules/leads/lead-import.service';
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
// import { EmailModule } from '@modules/email/email.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
    // BullModule.forRoot({
    //   redis: {
    //     host: process.env.REDIS_HOST || 'localhost',
    //     port: parseInt(process.env.REDIS_PORT || '6379'),
    //     db: parseInt(process.env.REDIS_DB || '0'),
    //   },
    // }),
    // EmailModule,
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
    AuthService,
    RegistrationService,
    EmailValidationService,
    WorkspaceService,
    LeadService,
    LeadImportService,
    LeadScoringService,
    ContactSegmentationService,
    EmailAnalyticsService,
    WebhookService,
    ContactService,
    EmailService,
    MarketingEmailService,
  ],
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
