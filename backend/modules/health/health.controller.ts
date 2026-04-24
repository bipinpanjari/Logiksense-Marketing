import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getDatabase } from '../../shared/database';
import { getQueueToken } from '@nestjs/bullmq';
import {
  QUEUE_EMAIL_SEND,
  QUEUE_LINKEDIN_JOB,
  QUEUE_SCRAPER_JOB,
  QUEUE_SEQUENCE_TICK,
  QUEUE_WEBHOOK_PROCESS,
} from '../../shared/queue.tokens';

interface ComponentStatus {
  status: 'up' | 'down' | 'skipped';
  detail?: string;
}

@Controller('api/health')
export class HealthController {
  constructor(
    @Optional() @Inject(getQueueToken(QUEUE_EMAIL_SEND)) private emailQueue?: Queue,
    @Optional() @Inject(getQueueToken(QUEUE_SEQUENCE_TICK)) private sequenceQueue?: Queue,
    @Optional() @Inject(getQueueToken(QUEUE_SCRAPER_JOB)) private scraperQueue?: Queue,
    @Optional() @Inject(getQueueToken(QUEUE_LINKEDIN_JOB)) private linkedinQueue?: Queue,
    @Optional() @Inject(getQueueToken(QUEUE_WEBHOOK_PROCESS)) private webhookQueue?: Queue,
  ) {}

  @Get()
  async liveness() {
    return { status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    const db = await this.checkDb();
    const redis = await this.checkRedis();
    const overall = db.status === 'up' && redis.status !== 'down' ? 'ok' : 'degraded';
    return {
      status: overall,
      checks: { db, redis },
      ts: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<ComponentStatus> {
    try {
      const db = getDatabase();
      await db.query('SELECT 1 as ok');
      return { status: 'up' };
    } catch (err: any) {
      return { status: 'down', detail: err?.message || 'db error' };
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    const queue = this.emailQueue;
    if (!queue) {
      return { status: 'skipped', detail: 'queue not registered' };
    }
    try {
      const client = await queue.client;
      const pong = await client.ping();
      return { status: pong === 'PONG' ? 'up' : 'down', detail: pong };
    } catch (err: any) {
      return { status: 'down', detail: err?.message || 'redis error' };
    }
  }
}
