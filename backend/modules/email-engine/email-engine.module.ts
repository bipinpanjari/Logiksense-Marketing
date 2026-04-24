import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_EMAIL_SEND, QUEUE_SEQUENCE_TICK } from '../../shared/queue.tokens';
import { SmtpTransportFactory } from './smtp-transport.factory';
import { TemplateRendererService } from './template-renderer.service';
import { UnsubscribeService } from './unsubscribe.service';
import { EmailDispatcherService } from './email-dispatcher.service';
import { SequenceEngineService } from './sequence-engine.service';
import { CampaignLauncherService } from './campaign-launcher.service';
import { EmailSendProcessor } from './processors/email-send.processor';
import { SequenceTickProcessor } from './processors/sequence-tick.processor';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailEngineController } from './email-engine.controller';
import { AiModule } from '../ai/ai.module';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_EMAIL_SEND }, { name: QUEUE_SEQUENCE_TICK }),
    AiModule,
    PipelineModule,
  ],
  controllers: [EmailTrackingController, EmailEngineController],
  providers: [
    SmtpTransportFactory,
    TemplateRendererService,
    UnsubscribeService,
    EmailDispatcherService,
    SequenceEngineService,
    CampaignLauncherService,
    EmailSendProcessor,
    SequenceTickProcessor,
  ],
  exports: [
    EmailDispatcherService,
    SequenceEngineService,
    CampaignLauncherService,
    TemplateRendererService,
    UnsubscribeService,
  ],
})
export class EmailEngineModule {}
