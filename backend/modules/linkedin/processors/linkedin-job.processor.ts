import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_LINKEDIN_JOB, LinkedInJobPayload } from '../../../shared/queue.tokens';
import { LinkedInCampaignService } from '../linkedin-campaign.service';

const isWorker = process.env.LINKEDIN_WORKER_ENABLED !== 'false';

@Processor(QUEUE_LINKEDIN_JOB, {
  concurrency: parseInt(process.env.LINKEDIN_WORKER_CONCURRENCY || '1', 10),
  autorun: isWorker,
})
export class LinkedInJobProcessor extends WorkerHost {
  private readonly logger = new Logger(LinkedInJobProcessor.name);

  constructor(private readonly campaign: LinkedInCampaignService) {
    super();
  }

  async process(job: Job<LinkedInJobPayload>): Promise<any> {
    this.logger.log(`[linkedin] campaign=${job.data.campaignId} bullmq=${job.id}`);
    return this.campaign.runCampaign(job.data.campaignId);
  }
}
