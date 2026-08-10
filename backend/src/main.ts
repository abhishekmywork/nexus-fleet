import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppModule } from './app.module';
import { configuration, type AppConfig } from './config/configuration';

async function bootstrap() {
  // Only create the directory for sql.js (in-memory SQLite)
  const config = configuration();
  if (config.database.type !== 'postgres') {
    mkdirSync(dirname(config.database.url), { recursive: true });
  }

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService<AppConfig, true>);
  app.setGlobalPrefix('api');

  const allowedOrigins = configService.get('corsOrigins', { infer: true });
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Check exact match first
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Check if the origin is a subdomain of any allowed base domain
      try {
        const url = new URL(origin);
        const hostname = url.hostname;
        for (const allowed of allowedOrigins) {
          const allowedUrl = new URL(allowed.startsWith('http') ? allowed : `http://${allowed}`);
          const allowedHost = allowedUrl.hostname;
          // Check if hostname is the allowed domain or a subdomain of it
          if (hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)) {
            return callback(null, true);
          }
        }
      } catch {
        // Not a valid URL
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = configService.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://0.0.0.0:${port}/api`, 'Bootstrap');
}

void bootstrap();
