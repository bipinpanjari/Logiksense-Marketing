// Load environment variables FIRST
import * as dotenv from 'dotenv';
dotenv.config();

// Register path aliases FIRST, before any other imports
require('tsconfig-paths').register();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { initializeDatabase } from './shared/database';
import cors from 'cors';

async function bootstrap() {
  try {
    // Initialize database connection
    console.log('Initializing database connection...');
    initializeDatabase();
    console.log('✓ Database initialized');

    const app = await NestFactory.create(AppModule);

    // Enable CORS
    app.use(
      cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3001',
        credentials: true,
      })
    );

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    const PORT = process.env.PORT || 3000;
    const server = await app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try a different port.`);
        process.exit(1);
      }
    });
    console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
  } catch (error) {
    console.error('Bootstrap error:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
