import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AbstractHttpAdapter } from '@nestjs/core';
import { AppModule } from './app.module';

export async function createNestApp(httpAdapter?: AbstractHttpAdapter): Promise<INestApplication> {
  const app = httpAdapter
    ? await NestFactory.create(AppModule, httpAdapter)
    : await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  return app;
}
