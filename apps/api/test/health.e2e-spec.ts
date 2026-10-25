import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RefreshTokenStore } from '../src/modules/auth/refresh-token.store';
import { InMemoryRefreshTokenStore } from './support/in-memory-refresh-token.store';
import { EvolutionClientService } from '../src/modules/whatsapp/evolution-client.service';
import { ensureDatabaseMigrations } from './support/migration-runner';

jest.setTimeout(60000);

describe('Health (e2e)', () => {
  let app: INestApplication;
  const mockEvolutionClient = {
  
    onModuleDestroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    sendTextMessage: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RefreshTokenStore)
      .useClass(InMemoryRefreshTokenStore)
      .overrideProvider(EvolutionClientService)
      .useValue(mockEvolutionClient)
      .compile();

    const dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / retorna metadados do serviço', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        service: 'wallethub-api',
        api: '/api',
        healthLive: '/api/health/live',
        healthz: '/healthz',
      }),
    );
  });

  it('GET /healthz retorna ok em texto plano', async () => {
    const response = await request(app.getHttpServer()).get('/healthz').expect(200);
    expect(response.text.trim()).toBe('ok');
  });

  it('GET /health retorna relatório consolidado', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/^(up|degraded)$/),
        timestamp: expect.any(String),
        checks: expect.objectContaining({
          api: expect.objectContaining({ status: 'up' }),
          database: expect.objectContaining({ status: expect.any(String) }),
          redis: expect.objectContaining({ status: expect.any(String) }),
          queues: expect.any(Object),
        }),
      }),
    );
  });
});

