import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { assertEnv } from './config/env.schema';

/**
 * Production bootstrap: env validation → security headers → CORS → cookies → validation pipe
 * → graceful shutdown. Secrets come only from the environment (never the repo).
 */
async function bootstrap(): Promise<void> {
  const log = new Logger('Bootstrap');
  assertEnv(); // fail fast before binding the port

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  // Security headers (HSTS, no-sniff, frameguard, etc.)
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
  app.use(cookieParser());

  // CORS — explicit allow-list from env; credentials enabled for secure cookies.
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : false, credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'Idempotency-Key'] });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.set('trust proxy', 1); // behind ALB / Netlify / Vercel proxy → correct client IP for rate limiting

  app.enableShutdownHooks(); // SIGTERM → graceful close (drains pool)

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  log.log(`API listening on :${port} (${process.env.NODE_ENV ?? 'development'})`);
}
void bootstrap();
