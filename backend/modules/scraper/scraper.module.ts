import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_SCRAPER_JOB } from '../../shared/queue.tokens';
import { AiModule } from '../ai/ai.module';
import { EmailExtractorService } from './email-extractor.service';
import { GoogleMapsScraperService } from './gmaps-scraper.service';
import { WebsiteScraperService } from './website-scraper.service';
import { ScraperOrchestratorService } from './scraper-orchestrator.service';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { ScraperJobProcessor } from './processors/scraper-job.processor';
import { ScraperSchedulerService } from './scraper-scheduler.service';
import { ScraperRecoveryService } from './scraper-recovery.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_SCRAPER_JOB }), AiModule],
  controllers: [ScraperController],
  providers: [
    EmailExtractorService,
    GoogleMapsScraperService,
    WebsiteScraperService,
    ScraperOrchestratorService,
    ScraperService,
    ScraperJobProcessor,
    ScraperSchedulerService,
    ScraperRecoveryService,
  ],
  exports: [ScraperOrchestratorService, ScraperService],
})
export class ScraperModule {}
