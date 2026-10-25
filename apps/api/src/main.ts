import { Logger as NestLogger, RawBodyRequest, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded, type Request } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupValidation } from './common/setup-validation';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const globalPrefix = configService.get<string>('app.apiPrefix') ?? 'api';

  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'healthz', method: RequestMethod.GET },
    ],
  });
  app.useLogger(app.get(Logger));

  // CORS configuration (comma-separated FRONTEND_URL for www + apex)
  const frontendUrl = configService.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
  const corsOrigins = frontendUrl
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length <= 1 ? (corsOrigins[0] ?? true) : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organization-Id',
      'X-QA-Run-Id',
      'Idempotency-Key',
    ],
  });

  app.use(helmet());
  app.use(
    json({
      limit: '5mb',
      verify: (req: RawBodyRequest<Request>, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: '5mb',
      verify: (req: RawBodyRequest<Request>, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  setupValidation(app);
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
  NestLogger.log(`🚀 API WalletHub em execução na porta ${port}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  const trace = error instanceof Error ? error.stack : JSON.stringify(error);
  NestLogger.error('Falha ao iniciar a aplicação', trace, 'Bootstrap');
  process.exitCode = 1;
});
