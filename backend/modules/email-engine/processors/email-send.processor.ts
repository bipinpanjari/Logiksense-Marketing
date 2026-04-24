import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EmailSendJobPayload, QUEUE_EMAIL_SEND } from '../../../shared/queue.tokens';
import { EmailDispatcherService } from '../email-dispatcher.service';
import { SequenceEngineService } from '../sequence-engine.service';
import { getDatabase } from '../../../shared/database';

@Processor(QUEUE_EMAIL_SEND, { concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '4', 10) })
export class EmailSendProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailSendProcessor.name);

  constructor(
    private readonly dispatcher: EmailDispatcherService,
    private readonly sequenceEngine: SequenceEngineService,
  ) {
    super();
  }

  async process(job: Job<EmailSendJobPayload>): Promise<any> {
    const db = getDatabase();
    const { workspaceId, leadId } = job.data;
    let customerId = job.data.customerId;

    if (!customerId && workspaceId) {
      const r = await db.query(`SELECT customer_id FROM workspaces WHERE id = $1`, [workspaceId]);
      customerId = r.rows[0]?.customer_id ?? '';
    }

    if (job.data.campaignId) {
      const r = await db.query(
        `SELECT status FROM email_campaigns WHERE id = $1`,
        [job.data.campaignId],
      );
      const status = r.rows[0]?.status;
      if (status !== 'running') {
        this.logger.log(`skip campaign=${job.data.campaignId} lead=${leadId} status=${status}`);
        return { status: 'skipped', reason: `campaign-${status}` };
      }
    }

    const result = await this.dispatcher.dispatch({
      workspaceId,
      customerId,
      leadId,
      templateId: job.data.templateId,
      campaignId: job.data.campaignId,
      enrollmentId: job.data.enrollmentId,
      override: job.data.override,
    });

    if (result.status === 'sent' && job.data.enrollmentId) {
      await this.sequenceEngine.advanceEnrollment(job.data.enrollmentId);
    }

    return result;
  }
}
