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

describe('WhatsApp (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<UserEntity>;

  const mockEvolutionClient = {
    sendTextMessage: jest.fn(),
  };

  const credentials = {
    username: 'admin-wa-e2e',
    password: 'Str0ngP@ssw0rd!',
  };

  let accessToken: string;

  beforeAll(async () => {
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
        email: 'admin-wa-e2e@wallethub.local',
        username: credentials.username,
        name: 'WA Test Admin',
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
    await app.close();
  });

  describe('GET /whatsapp/webhook', () => {
    it('retorna 410 Gone', async () => {
      await request(app.getHttpServer()).get('/whatsapp/webhook').expect(410);
    });
  });

  describe('POST /whatsapp/webhook', () => {
    it('aceita payload Evolution e retorna ok', async () => {
      const response = await request(app.getHttpServer())
        .post('/whatsapp/webhook')
        .send({ event: 'messages.upsert', instance: 'wallethub', data: {} })
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });
  });

  describe('GET /whatsapp/health', () => {
    it('retorna status de saúde do WhatsApp', async () => {
      const response = await request(app.getHttpServer())
        .get('/whatsapp/health')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        provider: 'evolution',
        inbound: expect.any(Object),
        outbound: expect.any(Object),
      });
    });

    it('rejeita acesso sem autenticação', async () => {
      await request(app.getHttpServer()).get('/whatsapp/health').expect(401);
    });
  });

  describe('GET /whatsapp/config', () => {
    it('retorna configuração pública Evolution', async () => {
      const response = await request(app.getHttpServer())
        .get('/whatsapp/config')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          instanceName: expect.any(String),
          apiUrl: expect.any(String),
        }),
      );
    });

    it('rejeita acesso sem autenticação', async () => {
      await request(app.getHttpServer()).get('/whatsapp/config').expect(401);
    });
  });
});
