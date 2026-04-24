import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { getDatabase } from '../../shared/database';
import {
  QUEUE_EMAIL_SEND,
  QUEUE_SEQUENCE_TICK,
  EmailSendJobPayload,
  SequenceTickJobPayload,
} from '../../shared/queue.tokens';

interface SequenceStepRow {
  id: string;
  sequence_id: string;
  step_number: number;
  email_template_id: string;
  delay_hours: number;
}

@Injectable()
export class SequenceEngineService {
  private readonly logger = new Logger(SequenceEngineService.name);

  constructor(
    @InjectQueue(QUEUE_EMAIL_SEND) private readonly emailQueue: Queue<EmailSendJobPayload>,
    @InjectQueue(QUEUE_SEQUENCE_TICK) private readonly tickQueue: Queue<SequenceTickJobPayload>,
  ) {}

  async enrollLead(workspaceId: string, sequenceId: string, leadId: string) {
    const db = getDatabase();

    const seqRes = await db.query(
      `SELECT id, workspace_id, status FROM email_sequences WHERE id = $1`,
      [sequenceId],
    );
    if (seqRes.rows.length === 0) throw new NotFoundException('Sequence not found');
    if (seqRes.rows[0].workspace_id !== workspaceId) {
      throw new BadRequestException('Sequence does not belong to workspace');
    }

    const leadRes = await db.query(
      `SELECT id, workspace_id, is_unsubscribed FROM leads WHERE id = $1`,
      [leadId],
    );
    if (leadRes.rows.length === 0) throw new NotFoundException('Lead not found');
    if (leadRes.rows[0].workspace_id !== workspaceId) {
      throw new BadRequestException('Lead does not belong to workspace');
    }
    if (leadRes.rows[0].is_unsubscribed) {
      return { status: 'skipped', reason: 'lead-unsubscribed' };
    }

    const existing = await db.query(
      `SELECT id, status FROM sequence_lead_enrollment WHERE sequence_id = $1 AND lead_id = $2`,
      [sequenceId, leadId],
    );
    if (existing.rows.length > 0 && existing.rows[0].status === 'active') {
      return { status: 'already-enrolled', enrollmentId: existing.rows[0].id };
    }

    const insert = await db.query(
      `INSERT INTO sequence_lead_enrollment (sequence_id, lead_id, current_step, status, started_at)
       VALUES ($1, $2, 1, 'active', CURRENT_TIMESTAMP)
       ON CONFLICT (sequence_id, lead_id)
       DO UPDATE SET status = 'active', current_step = 1, started_at = CURRENT_TIMESTAMP, completed_at = NULL
       RETURNING id`,
      [sequenceId, leadId],
    );
    const enrollmentId = insert.rows[0].id;

    await this.scheduleNextStep(enrollmentId);
    return { status: 'enrolled', enrollmentId };
  }

  async pauseEnrollment(enrollmentId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE sequence_lead_enrollment SET status = 'paused' WHERE id = $1`,
      [enrollmentId],
    );
    return { ok: true };
  }

  async resumeEnrollment(enrollmentId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE sequence_lead_enrollment SET status = 'active' WHERE id = $1`,
      [enrollmentId],
    );
    await this.scheduleNextStep(enrollmentId);
    return { ok: true };
  }

  async completeEnrollment(enrollmentId: string, reason = 'completed') {
    const db = getDatabase();
    await db.query(
      `UPDATE sequence_lead_enrollment
       SET status = $2, completed_at = CURRENT_TIMESTAMP, notes = $3
       WHERE id = $1`,
      [enrollmentId, reason === 'completed' ? 'completed' : 'stopped', reason],
    );
  }

  async scheduleNextStep(enrollmentId: string) {
    const db = getDatabase();

    const enrollmentRes = await db.query(
      `SELECT e.id, e.sequence_id, e.lead_id, e.current_step, e.status, l.workspace_id,
              l.is_unsubscribed, s.status as seq_status
       FROM sequence_lead_enrollment e
       JOIN leads l ON l.id = e.lead_id
       JOIN email_sequences s ON s.id = e.sequence_id
       WHERE e.id = $1`,
      [enrollmentId],
    );
    if (enrollmentRes.rows.length === 0) return { status: 'missing' };
    const e = enrollmentRes.rows[0];

    if (e.status !== 'active' || e.is_unsubscribed) {
      await this.completeEnrollment(enrollmentId, e.is_unsubscribed ? 'unsubscribed' : 'paused');
      return { status: 'skipped' };
    }
    if (e.seq_status !== 'active' && e.seq_status !== 'running') {
      return { status: 'sequence-not-running' };
    }

    const stepRes = await db.query(
      `SELECT id, sequence_id, step_number, email_template_id, delay_hours
       FROM email_sequence_steps
       WHERE sequence_id = $1 AND step_number = $2`,
      [e.sequence_id, e.current_step],
    );
    if (stepRes.rows.length === 0) {
      await this.completeEnrollment(enrollmentId, 'completed');
      return { status: 'done' };
    }

    const step = stepRes.rows[0] as SequenceStepRow;
    const delayMs = Math.max(0, step.delay_hours) * 60 * 60 * 1000;

    await this.emailQueue.add(
      `seq-${enrollmentId}-step-${step.step_number}`,
      {
        workspaceId: e.workspace_id,
        customerId: '', // filled by worker from workspace
        leadId: e.lead_id,
        templateId: step.email_template_id,
        enrollmentId,
      },
      { delay: delayMs },
    );

    return { status: 'scheduled', stepNumber: step.step_number };
  }

  /**
   * Called after an email is delivered to advance the enrollment pointer.
   */
  async advanceEnrollment(enrollmentId: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE sequence_lead_enrollment
       SET current_step = current_step + 1
       WHERE id = $1 AND status = 'active'`,
      [enrollmentId],
    );
    await this.tickQueue.add(`tick-${enrollmentId}`, { enrollmentId });
  }
}
