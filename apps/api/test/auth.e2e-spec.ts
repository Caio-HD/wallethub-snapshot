import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { OrganizationEntity } from '../src/database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../src/database/entities/organization-membership.entity.js';
import { RefreshTokenStore } from '../src/modules/auth/refresh-token.store';
import { InMemoryRefreshTokenStore } from './support/in-memory-refresh-token.store';
import { EvolutionClientService } from '../src/modules/whatsapp/evolution-client.service';
import { ensureDatabaseMigrations } from './support/migration-runner';
import { DEV_SEED_LOGIN_USERS } from './support/dev-seed-credentials';

jest.setTimeout(60000);

function resetInMemoryThrottler(app: INestApplication): void {
  try {
    const storage = app.get(ThrottlerStorage);
    if (!(storage instanceof ThrottlerStorageService)) return;
    const raw = storage as unknown as {
      timeoutIds?: Map<string, ReturnType<typeof setTimeout>[]>;
    };
    raw.timeoutIds?.forEach((ids) => ids.forEach(clearTimeout));
    raw.timeoutIds?.clear();
    storage.storage.clear();
  } catch {
    /* ThrottlerStorage indisponível */
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<UserEntity>;
  let organizationsRepository: Repository<OrganizationEntity>;
  let membershipsRepository: Repository<OrganizationMembershipEntity>;
  let testUser: UserEntity;
  const mockEvolutionClient = {
  
    onModuleDestroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    sendTextMessage: jest.fn(),
  };

  const credentials = {
    username: 'admin-e2e',
    password: 'Str0ngP@ssw0rd!',
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

    dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    await app.init();

    usersRepository = dataSource.getRepository(UserEntity);
    organizationsRepository = dataSource.getRepository(OrganizationEntity);
    membershipsRepository = dataSource.getRepository(OrganizationMembershipEntity);
  });

  const removeTestUser = async () => {
    if (!usersRepository) return;
    await usersRepository.delete({ username: credentials.username });
  };

  beforeEach(async () => {
    resetInMemoryThrottler(app);
    await removeTestUser();
    const passwordHash = await bcrypt.hash(credentials.password, 10);

    testUser = await usersRepository.save(
      usersRepository.create({
        email: 'admin-e2e@wallethub.local',
        username: credentials.username,
        name: 'QA Admin',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7)
          .toString()
          .padStart(7, '0')}`,
        passwordHash,
        isActive: true,
        role: 'admin',
      }),
    );
  });

  afterEach(async () => {
    await removeTestUser();
  });

  afterAll(async () => {
    await app.close();
  });

  it('autentica e retorna tokens de acesso', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: expect.any(Number),
      }),
    );
  });

  it('rejeita credenciais inválidas', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, password: 'senha-invalida' })
      .expect(401);
  });

  /**
   * Garante que o hash em `ops/dev/seeds/base.sql` corresponde às passwords documentadas
   * (fluxo real de login após aplicar a seed de desenvolvimento).
   */
  it('autentica utilizadores da seed dev (rick/nya) com hashes de base.sql', async () => {
    for (const seed of DEV_SEED_LOGIN_USERS) {
      await usersRepository.delete({ username: seed.username });
      await usersRepository.save(
        usersRepository.create({
          email: seed.email,
          username: seed.username,
          name: seed.name,
          phoneNumber: seed.phoneNumber,
          passwordHash: seed.passwordHash,
          isActive: true,
          role: 'admin',
        }),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: seed.username, password: seed.password })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          tokenType: 'Bearer',
          expiresIn: expect.any(Number),
        }),
      );

      await usersRepository.delete({ username: seed.username });
    }
  });

  it('GET /users/active retorna membros da organização activa (X-Organization-Id)', async () => {
    // O endpoint é org-scoped: o user precisa de uma organização ativa (membership).
    const org = await organizationsRepository.save(
      organizationsRepository.create({ name: `Org Auth E2E ${Date.now()}`, plan: 'free' }),
    );
    await membershipsRepository.save(
      membershipsRepository.create({
        organizationId: org.id,
        userId: testUser.id,
        role: 'owner',
        status: 'active',
      }),
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    const orgsRes = await request(app.getHttpServer())
      .get('/organizations')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    expect(Array.isArray(orgsRes.body)).toBe(true);
    expect(orgsRes.body.length).toBeGreaterThanOrEqual(1);
    const orgId = orgsRes.body[0].id as string;

    const res = await request(app.getHttpServer())
      .get('/users/active')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .set('X-Organization-Id', orgId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        isActive: true,
      }),
    );
  });

  it('permite renovar tokens com refresh válido', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: loginResponse.body.refreshToken,
      })
      .expect(200);

    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).not.toEqual(loginResponse.body.refreshToken);
  });

  it('rejeita refresh token inválido', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: 'token-invalido',
      })
      .expect(401);
  });

  it('permite fazer logout com refresh token válido', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({
        refreshToken: loginResponse.body.refreshToken,
      })
      .expect(200);

    // Após logout, o refresh token não deve mais funcionar
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: loginResponse.body.refreshToken,
      })
      .expect(401);
  });

  it('aplica rate limiting no endpoint de login', async () => {
    // Reativa o throttler só para este teste (desligado por padrão nos e2e — ver setup-e2e-env).
    process.env.THROTTLER_DISABLED = 'false';
    try {
      // Fazer 5 tentativas com senha incorreta (limite)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ ...credentials, password: 'senha-errada' })
          .expect(401);
      }

      // A 6ª tentativa deve ser bloqueada por rate limit
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...credentials, password: 'senha-errada' })
        .expect(429);

      expect(response.body.message).toContain('ThrottlerException');
    } finally {
      process.env.THROTTLER_DISABLED = 'true';
    }
  }, 10000);
});

