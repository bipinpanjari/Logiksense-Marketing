import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_LINKEDIN_JOB } from '../../shared/queue.tokens';
import { VaultService } from '../../shared/vault.service';
import { LinkedInAccountService } from './linkedin-account.service';
import { LinkedInLoginService } from './linkedin-login.service';
import { LinkedInSearchService } from './linkedin-search.service';
import { LinkedInMessagingService } from './linkedin-messaging.service';
import { LinkedInCampaignService } from './linkedin-campaign.service';
import { LinkedInService } from './linkedin.service';
import { LinkedInController } from './linkedin.controller';
import { LinkedInJobProcessor } from './processors/linkedin-job.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_LINKEDIN_JOB })],
  controllers: [LinkedInController],
  providers: [
    VaultService,
    LinkedInAccountService,
    LinkedInLoginService,
    LinkedInSearchService,
    LinkedInMessagingService,
    LinkedInCampaignService,
    LinkedInService,
    LinkedInJobProcessor,
  ],
  exports: [LinkedInService, LinkedInAccountService, LinkedInCampaignService],
})
export class LinkedInModule {}
