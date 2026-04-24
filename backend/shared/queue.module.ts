import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ALL_QUEUES } from './queue.tokens';

function resolveRedisConnection() {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;
  const db = parseInt(process.env.REDIS_DB || '0', 10);
  return { host, port, password, db };
}

@Global()
@Module({})
export class AppQueueModule {
  static register(): DynamicModule {
    const imports: DynamicModule['imports'] = [
      BullModule.forRoot({
        connection: resolveRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { count: 1_000, age: 60 * 60 * 24 },
          removeOnFail: { count: 5_000, age: 60 * 60 * 24 * 7 },
        },
      }),
      ...ALL_QUEUES.map((name) => BullModule.registerQueue({ name })),
    ];

    return {
      module: AppQueueModule,
      imports,
      exports: imports,
    };
  }
}
