import * as dotenv from 'dotenv';
dotenv.config();

import { initSentry } from './modules/observability/sentry.init';
initSentry();

(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

require('tsconfig-paths').register();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { initializeDatabase } from './shared/database';
import cors from 'cors';

function parseOrigins(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  initializeDatabase();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));


  const defaultOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3009',
    'http://localhost:3001',
    'http://localhost:3000',
  ];

  const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS, defaultOrigins);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          allowedOrigins.includes('*') ||
          origin === 'app://.' ||
          origin.startsWith('chrome-extension://')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const PORT = parseInt(String(process.env.PORT || '3000'), 10);
  const server = await app.listen(PORT, '0.0.0.0');

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    }
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully`);
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
  console.log(`✓ CORS origins: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
