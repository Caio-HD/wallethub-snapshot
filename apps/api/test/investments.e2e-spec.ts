import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { OrganizationEntity } from '../src/database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../src/database/entities/organization-membership.entity.js';
import { InvestmentMovementEntity } from '../src/database/entities/investment-movement.entity.js';
import { InvestmentInstrumentEntity } from '../src/database/entities/investment-instrument.entity.js';
import { InvestmentQuoteSnapshotEntity } from '../src/database/entities/investment-quote-snapshot.entity.js';
import { RefreshTokenStore } from '../src/modules/auth/refresh-token.store';
import { InMemoryRefreshTokenStore } from './support/in-memory-refresh-token.store';
import { EvolutionClientService } from '../src/modules/whatsapp/evolution-client.service';
import { ensureDatabaseMigrations } from './support/migration-runner';

jest.setTimeout(60000);

describe('Investments (e2e)', () => {
  let app!: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<UserEntity>;
  let organizationsRepository: Repository<OrganizationEntity>;
  let membershipsRepository: Repository<OrganizationMembershipEntity>;
  let movementsRepository: Repository<InvestmentMovementEntity>;
  let instrumentsRepository: Repository<InvestmentInstrumentEntity>;
  let quotesRepository: Repository<InvestmentQuoteSnapshotEntity>;

  const mockEvolutionClient = {
  
    onModuleDestroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    sendTextMessage: jest.fn(),
  };

  const credentials = {
    username: 'admin-inv-e2e',
    password: 'Str0ngP@ssw0rd!',
  };

  let accessToken: string;
  let testUser: UserEntity;
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
      .compile();

    dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    usersRepository = dataSource.getRepository(UserEntity);
    organizationsRepository = dataSource.getRepository(OrganizationEntity);
    membershipsRepository = dataSource.getRepository(OrganizationMembershipEntity);
    movementsRepository = dataSource.getRepository(InvestmentMovementEntity);
    instrumentsRepository = dataSource.getRepository(InvestmentInstrumentEntity);
    quotesRepository = dataSource.getRepository(InvestmentQuoteSnapshotEntity);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    await app.init();
  });

  beforeEach(async () => {
    // Org/user-scoped (movements, memberships, ...) via TRUNCATE CASCADE; quotes/instruments são
    // globais (sem FK a org) e ficam fora do cascade, então limpamos depois.
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
    await quotesRepository.createQueryBuilder().delete().execute();
    await instrumentsRepository.createQueryBuilder().delete().execute();

    const passwordHash = await bcrypt.hash(credentials.password, 10);
    testUser = await usersRepository.save(
      usersRepository.create({
        email: 'admin-inv-e2e@wallethub.local',
        username: credentials.username,
        name: 'Investments E2E Admin',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7)
          .toString()
          .padStart(7, '0')}`,
        passwordHash,
        isActive: true,
        role: 'admin',
      }),
    );

    testOrg = await organizationsRepository.save(
      organizationsRepository.create({
        name: `Org Inv E2E ${Date.now()}`,
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
    // Org/user-scoped (movements, memberships, ...) via TRUNCATE CASCADE; quotes/instruments são
    // globais (sem FK a org) e ficam fora do cascade, então limpamos depois.
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
    await quotesRepository.createQueryBuilder().delete().execute();
    await instrumentsRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /investments/portfolio retorna totais zerados sem movimentos', async () => {
    const res = await request(app.getHttpServer())
      .get('/investments/portfolio')
      .set(orgHeaders())
      .expect(200);

    expect(res.body).toMatchObject({
      totalCostBasis: 0,
      totalMarketValue: 0,
      totalUnrealizedPnl: 0,
      totalDividends: 0,
      positions: [],
    });
  });

  it('POST /investments/movements e GET portfolio refletem compra', async () => {
    await request(app.getHttpServer())
      .post('/investments/movements')
      .set(orgHeaders())
      .send({
        symbol: 'TEST9',
        market: 'BR',
        kind: 'stock',
        movementKind: 'buy',
        quantity: 10,
        unitPrice: 15.5,
        fees: 1,
      })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    const res = await request(app.getHttpServer())
      .get('/investments/portfolio')
      .set(orgHeaders())
      .expect(200);

    expect(res.body.positions.length).toBe(1);
    expect(res.body.positions[0]).toMatchObject({
      symbol: 'TEST9',
      market: 'BR',
      quantity: 10,
    });
    expect(res.body.totalCostBasis).toBeGreaterThan(0);
  });

  it('rejeita sem autenticação', async () => {
    await request(app.getHttpServer()).get('/investments/portfolio').expect(401);
  });
});
