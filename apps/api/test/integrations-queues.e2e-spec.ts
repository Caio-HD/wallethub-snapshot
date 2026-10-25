import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { RefreshTokenStore } from '../src/modules/auth/refresh-token.store';
import { InMemoryRefreshTokenStore } from './support/in-memory-refresh-token.store';
import { EvolutionClientService } from '../src/modules/whatsapp/evolution-client.service';
import { ElevatedAccessService } from '../src/common/security/elevated-access.service';
import { ensureDatabaseMigrations } from './support/migration-runner';

jest.setTimeout(60000);

describe('Admin integrations queues (e2e)', () => {
  let app: INestApplication;
  let users: Repository<UserEntity>;

  const operator = { username: 'queues-op-e2e', password: 'Str0ngP@ssw0rd!' };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RefreshTokenStore)
      .useClass(InMemoryRefreshTokenStore)
      .overrideProvider(EvolutionClientService)
      .useValue({ onModuleDestroy: jest.fn(), on: jest.fn(), off: jest.fn(), sendTextMessage: jest.fn() })
      .overrideProvider(ElevatedAccessService)
      .useValue({
        assertElevatedAllowed: () => undefined,
        isElevatedAllowed: () => true,
        isBypassEnabled: () => true,
      })
      .compile();

    const dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    await app.init();

    users = dataSource.getRepository(UserEntity);
  });

  beforeEach(async () => {
    await users.delete({ username: operator.username });
    const passwordHash = await bcrypt.hash(operator.password, 10);
    await users.save(
      users.create({
        email: 'queues-op-e2e@wallethub.local',
        username: operator.username,
        name: 'Queues Operator',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7)
          .toString()
          .padStart(7, '0')}`,
        passwordHash,
        isActive: true,
        role: 'super_admin',
      }),
    );
  });

  afterEach(async () => {
    await users.delete({ username: operator.username });
  });

  afterAll(async () => {
    await app.close();
  });

  const login = async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send(operator).expect(200);
    return res.body.accessToken as string;
  };

  it('GET /admin/integrations/queues returns BullMQ metrics for super_admin', async () => {
    const token = await login();
    const res = await request(app.getHttpServer())
      .get('/admin/integrations/queues')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: expect.stringMatching(/^(up|degraded)$/),
        timestamp: expect.any(String),
        queues: expect.objectContaining({
          whatsappInbound: expect.objectContaining({ status: expect.any(String) }),
          whatsappOutbound: expect.objectContaining({ status: expect.any(String) }),
          telegramInbound: expect.objectContaining({ status: expect.any(String) }),
          notionSync: expect.objectContaining({ status: expect.any(String) }),
          notionWebhook: expect.objectContaining({ status: expect.any(String) }),
        }),
      }),
    );
  });

  it('GET /admin/integrations/queues rejects unauthenticated callers', async () => {
    await request(app.getHttpServer()).get('/admin/integrations/queues').expect(401);
  });
});
