import { Module } from '@nestjs/common';
import { VaultService } from '../../shared/vault.service';
import { NameDetectorService } from './name-detector.service';
import { AiUsageService } from './ai-usage.service';
import { OpenAiClient } from './openai.client';
import { IcebreakerService } from './icebreaker.service';
import { EnrichmentService } from './enrichment.service';
import { AiSettingsService } from './ai-settings.service';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [
    VaultService,
    NameDetectorService,
    AiUsageService,
    OpenAiClient,
    IcebreakerService,
    EnrichmentService,
    AiSettingsService,
  ],
  exports: [NameDetectorService, IcebreakerService, EnrichmentService, AiUsageService, OpenAiClient],
})
export class AiModule {}
