import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { AnalyticsService } from './analytics.service';
import { ContactNotesService } from './contact-notes.service';
import { RepliesService } from './replies.service';
import { AnalyticsController, PipelineController } from './pipeline.controller';
import { InboundWebhookController } from './inbound.controller';

@Module({
  controllers: [PipelineController, AnalyticsController, InboundWebhookController],
  providers: [PipelineService, AnalyticsService, ContactNotesService, RepliesService],
  exports: [PipelineService, AnalyticsService, RepliesService],
})
export class PipelineModule {}
