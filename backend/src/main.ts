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
  app.enableCors({
    origin: configService.get('corsOrigins', { infer: true }),
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
