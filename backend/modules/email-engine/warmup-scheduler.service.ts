import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WarmupEngineService } from './warmup-engine.service';

@Injectable()
export class WarmupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WarmupSchedulerService.name);

  constructor(private readonly warmupEngine: WarmupEngineService) {}

  onModuleInit() {
    this.logger.log('Warmup Scheduler initialized.');
  }

  /**
   * Run the warmup cycle every hour at minute 0.
   * This handles both sending new warmup emails and processing replies.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleWarmup() {
    this.logger.log('Triggering scheduled warmup cycle...');
    try {
      await this.warmupEngine.runWarmupCycle();
    } catch (err) {
      this.logger.error('Failed to run scheduled warmup cycle', err);
    }
  }

  /**
   * Optional: A secondary check for replies more frequently than new sends?
   * For now, once per hour is a safe starting point to avoid account detection.
   */
}
