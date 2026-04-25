/**
 * Canonical BullMQ queue names. Register workers and producers against these
 * tokens only - never use raw strings elsewhere.
 */
export const QUEUE_EMAIL_SEND = 'email-send';
export const QUEUE_SEQUENCE_TICK = 'sequence-tick';
export const QUEUE_SCRAPER_JOB = 'scraper-job';
export const QUEUE_LINKEDIN_JOB = 'linkedin-job';
export const QUEUE_WEBHOOK_PROCESS = 'webhook-process';

export const ALL_QUEUES = [
  QUEUE_EMAIL_SEND,
  QUEUE_SEQUENCE_TICK,
  QUEUE_SCRAPER_JOB,
  QUEUE_LINKEDIN_JOB,
  QUEUE_WEBHOOK_PROCESS,
] as const;

export type QueueName = (typeof ALL_QUEUES)[number];

export interface EmailSendJobPayload {
  workspaceId: string;
  customerId: string;
  leadId: string;
  templateId?: string;
  campaignId?: string;
  enrollmentId?: string;
  /**
   * When defined, dispatcher will use the precomputed subject/body instead of
   * re-rendering from the template. Used for sequence ticks with already-
   * personalised copy.
   */
  override?: {
    subject?: string;
    html?: string;
    text?: string;
  };
}

export interface SequenceTickJobPayload {
  enrollmentId: string;
}

export interface ScraperJobPayload {
  jobId?: string;
  workspaceId: string;
  customerId?: string;
  searchProfileId?: string;
  aiDigestBackfillOnly?: boolean;
  /** When true, regenerate briefs for every row in the job, not only missing aiStructured. */
  aiDigestForce?: boolean;
}

export interface LinkedInJobPayload {
  campaignId: string;
  workspaceId: string;
  linkedinAccountId: string;
  stepNumber?: number;
}

export interface WebhookProcessPayload {
  webhookId: string;
  payload: any;
  receivedAt: string;
}
