import { INestApplication, ValidationPipe } from '@nestjs/common';
import { validationErrorFactory } from './utils/validation-error.factory';

export function setupValidation(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: validationErrorFactory,
    }),
  );
}
