import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_SEQUENCE_TICK, SequenceTickJobPayload } from '../../../shared/queue.tokens';
import { SequenceEngineService } from '../sequence-engine.service';

@Processor(QUEUE_SEQUENCE_TICK, {
  concurrency: parseInt(process.env.SEQUENCE_WORKER_CONCURRENCY || '2', 10),
})
export class SequenceTickProcessor extends WorkerHost {
  private readonly logger = new Logger(SequenceTickProcessor.name);

  constructor(private readonly sequenceEngine: SequenceEngineService) {
    super();
  }

  async process(job: Job<SequenceTickJobPayload>): Promise<any> {
    const { enrollmentId } = job.data;
    this.logger.debug(`tick enrollment=${enrollmentId}`);
    return this.sequenceEngine.scheduleNextStep(enrollmentId);
  }
}
