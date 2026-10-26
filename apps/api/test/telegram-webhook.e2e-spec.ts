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
import { ensureDatabaseMigrations } from './support/migration-runner';

jest.setTimeout(60000);

const TG_PATH = 'e2e-telegram-path';
const TG_SECRET = 'e2e-telegram-secret';

describe('Telegram (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<UserEntity>;

  const mockEvolutionClient = {
  
    onModuleDestroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    sendTextMessage: jest.fn(),
  };

  const credentials = {
    username: 'super-tg-e2e',
    password: 'Str0ngP@ssw0rd!',
  };

  let accessToken: string;

  beforeAll(async () => {
    process.env.TELEGRAM_WEBHOOK_PATH_TOKEN = TG_PATH;
    process.env.TELEGRAM_WEBHOOK_SECRET = TG_SECRET;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RefreshTokenStore)
      .useClass(InMemoryRefreshTokenStore)
      .overrideProvider(EvolutionClientService)
      .useValue(mockEvolutionClient)
      .compile();

    dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    await app.init();

    usersRepository = dataSource.getRepository(UserEntity);
  });

  beforeEach(async () => {
    await usersRepository.delete({ username: credentials.username });

    const passwordHash = await bcrypt.hash(credentials.password, 10);
    await usersRepository.save(
      usersRepository.create({
        email: 'super-tg-e2e@wallethub.local',
        username: credentials.username,
        name: 'TG Test Super',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7).toString().padStart(7, '0')}`,
        passwordHash,
        isActive: true,
        role: 'super_admin',
      }),
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    accessToken = loginResponse.body.accessToken;
  });

  afterEach(async () => {
    await usersRepository.delete({ username: credentials.username });
  });

  afterAll(async () => {
    delete process.env.TELEGRAM_WEBHOOK_PATH_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    await app.close();
  });

  describe('POST /telegram/webhook/:pathToken', () => {
    it('rejeita path token incorrecto', async () => {
      await request(app.getHttpServer())
        .post('/telegram/webhook/wrong')
        .set('X-Telegram-Bot-Api-Secret-Token', TG_SECRET)
        .send({})
        .expect(401);
    });

    it('rejeita secret incorrecto', async () => {
      await request(app.getHttpServer())
        .post(`/telegram/webhook/${TG_PATH}`)
        .set('X-Telegram-Bot-Api-Secret-Token', 'nope')
        .send({})
        .expect(401);
    });

    it('aceita update vazio com path e secret correctos', async () => {
      await request(app.getHttpServer())
        .post(`/telegram/webhook/${TG_PATH}`)
        .set('X-Telegram-Bot-Api-Secret-Token', TG_SECRET)
        .send({})
        .expect(200);
    });
  });

  describe('GET /telegram/health', () => {
    it('retorna filas com super_admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/telegram/health')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        inbound: expect.any(Object),
        outbound: expect.any(Object),
      });
    });

    it('rejeita sem autenticação', async () => {
      await request(app.getHttpServer()).get('/telegram/health').expect(401);
    });
  });

  describe('GET /telegram/config', () => {
    it('retorna config pública com super_admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/telegram/config')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          webhookPathToken: expect.anything(),
          webhookSecretConfigured: true,
        }),
      );
    });
  });
});
