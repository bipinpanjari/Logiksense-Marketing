import * as dotenv from 'dotenv';
dotenv.config();

(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

require('tsconfig-paths').register();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { initSentry } from '../modules/observability/sentry.init';
import { initializeDatabase } from '../shared/database';
import { AppModule } from '../app.module';

/**
 * Shared boot sequence for standalone BullMQ worker processes.
 *
 * Each worker (email/scraper/linkedin) has its own entry file that imports
 * this function with a `WORKER_KIND` env so logs + Sentry traces are
 * attributed correctly. The worker processes share the same AppModule so
 * services, Prisma, Redis config, and VaultService are identical to the API
 * container.
 *
 * We intentionally start the Nest application context (no HTTP listener) so
 * BullMQ processors auto-register and the process stays alive holding the
 * Redis connection. Graceful shutdown on SIGINT/SIGTERM closes the context
 * cleanly, letting in-flight jobs finish.
 */
export async function bootWorker(kind: string) {
  process.env.WORKER_KIND = kind;
  initSentry();
  initializeDatabase();

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  logger.log(`worker "${kind}" online pid=${process.pid}`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    logger.log(`worker "${kind}" received ${signal}, shutting down`);
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => {
    logger.error(`unhandledRejection in worker "${kind}": ${(err as any)?.message ?? err}`);
  });
}
