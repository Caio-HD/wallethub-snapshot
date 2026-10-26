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
import { setupValidation } from '../src/common/setup-validation';
import { ensureDatabaseMigrations } from './support/migration-runner';
import { ProjectionsProcessor } from '../src/modules/projections/projections.processor';

jest.setTimeout(60000);

describe('Transactions (e2e)', () => {
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
    username: 'admin-tx-e2e',
    password: 'Str0ngP@ssw0rd!',
  };

  let testUser: UserEntity;
  let testCategory: CategoryEntity;
  let testAccount: AccountEntity;
  let accessToken: string;
  let testOrg: OrganizationEntity;

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
      // Desliga o worker de projeções (não é injetado em lugar nenhum): sem ele processando jobs,
      // o DB não é tocado concorrente com o TRUNCATE CASCADE do beforeEach (evita 'deadlock detected').
      .overrideProvider(ProjectionsProcessor)
      .useValue({})
      .compile();

    dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    setupValidation(app); // espelha main.ts: sem isto, DTOs inválidos viram 500 em vez de 400
    await app.init();

    usersRepository = dataSource.getRepository(UserEntity);
    categoriesRepository = dataSource.getRepository(CategoryEntity);
    accountsRepository = dataSource.getRepository(AccountEntity);
    transactionsRepository = dataSource.getRepository(TransactionEntity);
    organizationsRepository = dataSource.getRepository(OrganizationEntity);
    membershipsRepository = dataSource.getRepository(OrganizationMembershipEntity);
  });

  beforeEach(async () => {
    // Limpeza robusta: TRUNCATE CASCADE cobre todo o grafo org/user-scoped (transactions,
    // categories, accounts, memberships, projections, debts, budgets, ...) sem enumerar tabelas.
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');

    // Criar utilizador de teste
    const passwordHash = await bcrypt.hash(credentials.password, 10);
    testUser = await usersRepository.save(
      usersRepository.create({
        email: 'admin-tx-e2e@wallethub.local',
        username: credentials.username,
        name: 'TX Test Admin',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7).toString().padStart(7, '0')}`,
        passwordHash,
        isActive: true,
        role: 'admin',
        baseCurrency: 'BRL',
      }),
    );

    testOrg = await organizationsRepository.save(
      organizationsRepository.create({
        name: `Org TX E2E ${Date.now()}`,
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

    // Criar categoria de teste
    testCategory = await categoriesRepository.save(
      categoriesRepository.create({
        organizationId: testOrg.id,
        name: `Categoria E2E ${Date.now()}`,
        type: 'expense',
        ownerUserId: null,
        isActive: true,
      }),
    );

    // Criar conta de teste
    testAccount = await accountsRepository.save(
      accountsRepository.create({
        organizationId: testOrg.id,
        name: `Conta E2E ${Date.now()}`,
        ownerUserIds: null,
        isActive: true,
      }),
    );

    // Autenticar e obter token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    accessToken = loginResponse.body.accessToken;
  });

  afterEach(async () => {
    // Limpeza robusta: TRUNCATE CASCADE cobre todo o grafo org/user-scoped (transactions,
    // categories, accounts, memberships, projections, debts, budgets, ...) sem enumerar tabelas.
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /transactions', () => {
    it('cria uma transação de despesa', async () => {
      const dto = {
        occurredAt: new Date().toISOString(),
        accountId: testAccount.id,
        categoryId: testCategory.id,
        amount: 150.75,
        description: 'Teste E2E - Despesa',
        source: 'web',
      };

      const response = await request(app.getHttpServer())
        .post('/transactions')
        .set(orgHeaders())
        .send(dto)
        .expect(201);

      // A resposta do create serializa a entidade (relações account/category/user são @Exclude),
      // então o vínculo é verificado via re-fetch no banco, não no corpo da resposta.
      expect(response.body).toMatchObject({
        id: expect.any(String),
        occurredAt: expect.any(String),
        direction: 'expense',
        amount: '150.75',
        description: 'Teste E2E - Despesa',
        source: 'web',
      });

      // Verificar se foi salvo no banco com os vínculos corretos
      const saved = await transactionsRepository.findOne({
        where: { id: response.body.id },
        relations: ['account', 'category', 'user'],
      });
      expect(saved).toBeDefined();
      expect(saved?.amount).toBe('150.75');
      expect(saved?.account.id).toBe(testAccount.id);
      expect(saved?.category.id).toBe(testCategory.id);
      expect(saved?.user.id).toBe(testUser.id);
    });

    it('cria uma transação de receita', async () => {
      const incomeCategory = await categoriesRepository.save(
        categoriesRepository.create({
          organizationId: testOrg.id,
          name: `Receita E2E ${Date.now()}`,
          type: 'income',
          ownerUserId: null,
          isActive: true,
        }),
      );

      const dto = {
        occurredAt: new Date().toISOString(),
        accountId: testAccount.id,
        categoryId: incomeCategory.id,
        amount: 2000.0,
        description: 'Teste E2E - Receita',
        source: 'web',
      };

      const response = await request(app.getHttpServer())
        .post('/transactions')
        .set(orgHeaders())
        .send(dto)
        .expect(201);

      expect(response.body.direction).toBe('income');
      expect(response.body.amount).toBe('2000.00');
    });

    it('rejeita criação sem autenticação', async () => {
      const dto = {
        occurredAt: new Date().toISOString(),
        accountId: testAccount.id,
        categoryId: testCategory.id,
        amount: 100.0,
      };

      await request(app.getHttpServer()).post('/transactions').send(dto).expect(401);
    });

    it('rejeita criação com dados inválidos', async () => {
      const dto = {
        occurredAt: 'invalid-date',
        accountId: 'invalid-uuid',
        categoryId: testCategory.id,
        amount: -100,
      };

      await request(app.getHttpServer())
        .post('/transactions')
        .set(orgHeaders())
        .send(dto)
        .expect(400);
    });
  });

  describe('GET /transactions', () => {
    it('lista transações do usuário', async () => {
      // Criar algumas transações
      const tx1 = await transactionsRepository.save(
        transactionsRepository.create({
          organizationId: testOrg.id,
          occurredAt: new Date(),
          account: testAccount,
          category: testCategory,
          user: testUser,
          direction: 'expense',
          amount: '100.00',
          description: 'TX 1',
          source: 'web',
        }),
      );

      const tx2 = await transactionsRepository.save(
        transactionsRepository.create({
          organizationId: testOrg.id,
          occurredAt: new Date(),
          account: testAccount,
          category: testCategory,
          user: testUser,
          direction: 'expense',
          amount: '200.00',
          description: 'TX 2',
          source: 'web',
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/transactions')
        .set(orgHeaders())
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      const ids = response.body.map((tx: TransactionEntity) => tx.id);
      expect(ids).toContain(tx1.id);
      expect(ids).toContain(tx2.id);
    });

    it('filtra transações por categoria', async () => {
      const category2 = await categoriesRepository.save(
        categoriesRepository.create({
          organizationId: testOrg.id,
          name: `Categoria 2 E2E ${Date.now()}`,
          type: 'expense',
          ownerUserId: null,
          isActive: true,
        }),
      );

      await transactionsRepository.save(
        transactionsRepository.create({
          organizationId: testOrg.id,
          occurredAt: new Date(),
          account: testAccount,
          category: testCategory,
          user: testUser,
          direction: 'expense',
          amount: '100.00',
          source: 'web',
        }),
      );

      await transactionsRepository.save(
        transactionsRepository.create({
          organizationId: testOrg.id,
          occurredAt: new Date(),
          account: testAccount,
          category: category2,
          user: testUser,
          direction: 'expense',
          amount: '200.00',
          source: 'web',
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/transactions?categoryId=${testCategory.id}`)
        .set(orgHeaders())
        .expect(200);

      expect(response.body.every((tx: TransactionEntity) => tx.category.id === testCategory.id)).toBe(true);
    });
  });

  describe('PATCH /transactions/:id', () => {
    it('atualiza uma transação', async () => {
      const transaction = await transactionsRepository.save(
        transactionsRepository.create({
          organizationId: testOrg.id,
          occurredAt: new Date(),
          account: testAccount,
          category: testCategory,
          user: testUser,
          direction: 'expense',
          amount: '100.00',
          description: 'Original',
          source: 'web',
        }),
      );

      const updateDto = {
        amount: 150.50,
        description: 'Atualizado',
      };

      const response = await request(app.getHttpServer())
        .patch(`/transactions/${transaction.id}`)
        .set(orgHeaders())
        .send(updateDto)
        .expect(200);

      expect(response.body.amount).toBe('150.50');
      expect(response.body.description).toBe('Atualizado');

      // Verificar no banco
      const updated = await transactionsRepository.findOne({ where: { id: transaction.id } });
      expect(updated?.amount).toBe('150.50');
      expect(updated?.description).toBe('Atualizado');
    });

    it('rejeita atualização de transação inexistente', async () => {
      const updateDto = {
        amount: 200.0,
      };

      await request(app.getHttpServer())
        .patch('/transactions/00000000-0000-0000-0000-000000000000')
        .set(orgHeaders())
        .send(updateDto)
        .expect(404);
    });
  });

  describe('DELETE /transactions/:id', () => {
    it('remove uma transação', async () => {
      const transaction = await transactionsRepository.save(
        transactionsRepository.create({
          organizationId: testOrg.id,
          occurredAt: new Date(),
          account: testAccount,
          category: testCategory,
          user: testUser,
          direction: 'expense',
          amount: '100.00',
          source: 'web',
        }),
      );

      await request(app.getHttpServer())
        .delete(`/transactions/${transaction.id}`)
        .set(orgHeaders())
        .expect(200);

      // Verificar que foi removido
      const deleted = await transactionsRepository.findOne({ where: { id: transaction.id } });
      expect(deleted).toBeNull();
    });

    it('rejeita remoção de transação inexistente', async () => {
      await request(app.getHttpServer())
        .delete('/transactions/00000000-0000-0000-0000-000000000000')
        .set(orgHeaders())
        .expect(404);
    });
  });
});

