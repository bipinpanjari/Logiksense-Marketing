import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
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
    const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';

    if (!isRedisEnabled) {
      console.log('ℹ️ [Queue] Redis Queue processing is disabled (REDIS_ENABLED=false). Registering mock queues.');
      const providers = ALL_QUEUES.map((name) => ({
        provide: getQueueToken(name),
        useValue: {
          add: async () => ({ id: 'mock-job-id' }),
          on: () => {},
          pause: async () => {},
          resume: async () => {},
          clean: async () => {},
          getJobs: async () => [],
        },
      }));

      return {
        module: AppQueueModule,
        providers: providers,
        exports: providers,
      };
    }

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
