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
<<<<<<< Updated upstream

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_LINKEDIN_JOB })],
=======
import { LinkedinProfileScraperService } from './linkedin-profile-scraper.service';
import { AiModule } from '../ai/ai.module';

const redisEnabled = process.env.REDIS_ENABLED !== 'false';

@Module({
  imports: redisEnabled ? [BullModule.registerQueue({ name: QUEUE_LINKEDIN_JOB }), AiModule] : [AiModule],
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  ],
  exports: [LinkedInService, LinkedInAccountService, LinkedInCampaignService],
=======
    LinkedinProfileScraperService,
  ],
  exports: [LinkedInService, LinkedInAccountService, LinkedInCampaignService, LinkedinProfileScraperService],
>>>>>>> Stashed changes
})
export class LinkedInModule {}
