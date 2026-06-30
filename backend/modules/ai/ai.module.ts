import { Module } from '@nestjs/common';
import { VaultService } from '../../shared/vault.service';
import { NameDetectorService } from './name-detector.service';
import { AiUsageService } from './ai-usage.service';
import { LlmGatewayService } from './llm-gateway.service';
import { IcebreakerService } from './icebreaker.service';
import { EnrichmentService } from './enrichment.service';
import { AiSettingsService } from './ai-settings.service';
import { AiController } from './ai.controller';
import { WebsiteDigestRepBriefService } from './website-digest-rep-brief.service';

import { ApolloService } from './apollo.service';


@Module({
  controllers: [AiController],
  providers: [
    VaultService,
    NameDetectorService,
    AiUsageService,
    LlmGatewayService,
    IcebreakerService,
    EnrichmentService,
    AiSettingsService,
    WebsiteDigestRepBriefService,

    ApolloService,

  ],
  exports: [
    NameDetectorService,
    IcebreakerService,
    EnrichmentService,
    AiUsageService,
    LlmGatewayService,
    WebsiteDigestRepBriefService,

    ApolloService,

  ],
})
export class AiModule {}
