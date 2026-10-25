import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { CategoryEntity } from '../src/database/entities/category.entity.js';
import { AccountEntity } from '../src/database/entities/account.entity.js';
import { TransactionEntity } from '../src/database/entities/transaction.entity.js';
import { OrganizationEntity } from '../src/database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../src/database/entities/organization-membership.entity.js';
import { RefreshTokenStore } from '../src/modules/auth/refresh-token.store';
import { InMemoryRefreshTokenStore } from './support/in-memory-refresh-token.store';
import { EvolutionClientService } from '../src/modules/whatsapp/evolution-client.service';
import { ensureDatabaseMigrations } from './support/migration-runner';

jest.setTimeout(60000);

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<UserEntity>;
  let categoriesRepository: Repository<CategoryEntity>;
  let accountsRepository: Repository<AccountEntity>;
  let transactionsRepository: Repository<TransactionEntity>;
  let organizationsRepository: Repository<OrganizationEntity>;
  let membershipsRepository: Repository<OrganizationMembershipEntity>;
  const mockEvolutionClient = {
    onModuleDestroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    sendTextMessage: jest.fn(),
  };

  const credentials = {
    username: 'admin-dash-e2e',
    password: 'Str0ngP@ssw0rd!',
  };

  let accessToken: string;
  let testOrg: OrganizationEntity;
  const period = '2025-01';

  // Dashboard é org-scoped (ActiveOrganizationGuard): requer Authorization + X-Organization-Id.
  const orgHeaders = () => ({
    Authorization: `Bearer ${accessToken}`,
    'X-Organization-Id': testOrg.id,
  });

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
    categoriesRepository = dataSource.getRepository(CategoryEntity);
    accountsRepository = dataSource.getRepository(AccountEntity);
    transactionsRepository = dataSource.getRepository(TransactionEntity);
    organizationsRepository = dataSource.getRepository(OrganizationEntity);
    membershipsRepository = dataSource.getRepository(OrganizationMembershipEntity);
  });

  beforeEach(async () => {
    // Limpeza robusta: TRUNCATE CASCADE cobre todo o grafo org/user-scoped sem enumerar tabelas.
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');

    const passwordHash = await bcrypt.hash(credentials.password, 10);
    const testUser = await usersRepository.save(
      usersRepository.create({
        email: 'admin-dash-e2e@wallethub.local',
        username: credentials.username,
        name: 'Dashboard E2E Admin',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7).toString().padStart(7, '0')}`,
        passwordHash,
        isActive: true,
        role: 'admin',
      }),
    );

    testOrg = await organizationsRepository.save(
      organizationsRepository.create({
        name: `Org Dash E2E ${Date.now()}`,
        plan: 'free',
      }),
    );

    await membershipsRepository.save(
      membershipsRepository.create({
        organizationId: testOrg.id,
        userId: testUser.id,
        role: 'owner',
        status: 'active',
      }),
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    accessToken = loginResponse.body.accessToken;
  });

  afterEach(async () => {
    // Limpeza robusta: TRUNCATE CASCADE cobre todo o grafo org/user-scoped sem enumerar tabelas.
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /dashboard/categories-report', () => {
    it('retorna 200 e estrutura period, scope, items com autenticação', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dashboard/categories-report?period=${period}`)
        .set(orgHeaders())
        .expect(200);

      expect(response.body).toMatchObject({
        period,
        scope: 'all',
        items: expect.any(Array),
      });
    });

    it('rejeita requisição sem autenticação', async () => {
      await request(app.getHttpServer())
        .get(`/dashboard/categories-report?period=${period}`)
        .expect(401);
    });

    it('inclui categorias ativas com totais zero quando não há transações', async () => {
      await categoriesRepository.save(
        categoriesRepository.create({
          organizationId: testOrg.id,
          name: `Cat Report E2E ${Date.now()}`,
          type: 'expense',
          ownerUserId: null,
          isActive: true,
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/dashboard/categories-report?period=${period}`)
        .set(orgHeaders())
        .expect(200);

      expect(response.body.items.length).toBeGreaterThanOrEqual(1);
      const item = response.body.items.find((i: { name: string }) => i.name.startsWith('Cat Report E2E'));
      expect(item).toMatchObject({
        name: expect.any(String),
        type: 'expense',
        totalIncome: 0,
        totalExpense: 0,
      });
    });
  });

  describe('GET /dashboard/export/csv', () => {
    it('retorna 200 e CSV com header quando autenticado', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dashboard/export/csv?period=${period}`)
        .set(orgHeaders())
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.text).toContain('Data;Descrição;Valor;Direção;Categoria;Conta;Origem');
    });

    it('rejeita requisição sem autenticação', async () => {
      await request(app.getHttpServer())
        .get(`/dashboard/export/csv?period=${period}`)
        .expect(401);
    });
  });
});
