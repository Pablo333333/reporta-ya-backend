import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express'; // <--- IMPORTANTE
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());

  // Log de tráfico entrante para debugging forense
  app.use((req, res, next) => {
    console.log(`[TRAFICO ENTRANTE] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    const body = req.body || {};
    if (Object.keys(body).length > 0) {
      console.log(`[TRAFICO ENTRANTE] Body: ${JSON.stringify(body)}`);
    }
    next();
  });

  // Aumenta el límite a 50MB (o lo que necesites para tus audios)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'x-territorio-id'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();