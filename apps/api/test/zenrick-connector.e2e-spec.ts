import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { AccountEntity } from '../src/database/entities/account.entity.js';
import { ConnectorIngestEventEntity } from '../src/database/entities/connector-ingest-event.entity.js';
import { OrganizationEntity } from '../src/database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../src/database/entities/organization-membership.entity.js';
import { StatementImportBatchEntity } from '../src/database/entities/statement-import-batch.entity.js';
import { TransactionEntity } from '../src/database/entities/transaction.entity.js';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { RefreshTokenStore } from '../src/modules/auth/refresh-token.store';
import { InMemoryRefreshTokenStore } from './support/in-memory-refresh-token.store';
import { EvolutionClientService } from '../src/modules/whatsapp/evolution-client.service';
import { ProjectionsProcessor } from '../src/modules/projections/projections.processor';
import { ensureDatabaseMigrations } from './support/migration-runner';
import { setupValidation } from '../src/common/setup-validation';

jest.setTimeout(60000);

const CONNECTOR_TOKEN = 'zenrick-connector-e2e-token';

/** Fixture OFX anonimizada (2 lançamentos, FITID estável, identidade bancária casável). */
const OFX_FIXTURE = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0260
<BRANCHID>0001
<ACCTID>12345678
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260615
<TRNAMT>-42.50
<FITID>E2E-FIT-001
<MEMO>PIX MERCADO ZENRICK
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260616
<TRNAMT>1500.00
<FITID>E2E-FIT-002
<MEMO>TED RECEBIDA E2E
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

describe('Zenrick Connector ingest (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let users: Repository<UserEntity>;
  let organizations: Repository<OrganizationEntity>;
  let memberships: Repository<OrganizationMembershipEntity>;
  let accounts: Repository<AccountEntity>;
  let transactions: Repository<TransactionEntity>;
  let batches: Repository<StatementImportBatchEntity>;
  let ledger: Repository<ConnectorIngestEventEntity>;

  let testOrg: OrganizationEntity;

  const ofxBuffer = Buffer.from(OFX_FIXTURE, 'utf-8');

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 1,
      organizationId: testOrg.id,
      file: {
        format: 'ofx',
        filename: 'extrato-e2e.ofx',
        contentBase64: ofxBuffer.toString('base64'),
        sha256: createHash('sha256').update(ofxBuffer).digest('hex'),
      },
      provenance: {
        channel: 'email',
        extractor: 'kyron/google-connector@e2e',
        messageIdHash: `sha256:${'a'.repeat(16)}`,
        receivedAt: new Date().toISOString(),
        confidence: 1,
      },
      ...overrides,
    };
  }

  function post(idempotencyKey: string, body: Record<string, unknown>, token = CONNECTOR_TOKEN) {
    return request(app.getHttpServer())
      .post('/integrations/zenrick/statements')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
  }

  beforeAll(async () => {
    process.env.WALLETHUB_CONNECTOR_TOKEN = CONNECTOR_TOKEN;

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RefreshTokenStore)
      .useClass(InMemoryRefreshTokenStore)
      .overrideProvider(EvolutionClientService)
      .useValue({
        onModuleDestroy: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        sendTextMessage: jest.fn(),
      })
      // Sem o worker de projeções tocando o DB, o TRUNCATE CASCADE do beforeEach não deadlocka.
      .overrideProvider(ProjectionsProcessor)
      .useValue({})
      .compile();

    dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    setupValidation(app);
    await app.init();

    users = dataSource.getRepository(UserEntity);
    organizations = dataSource.getRepository(OrganizationEntity);
    memberships = dataSource.getRepository(OrganizationMembershipEntity);
    accounts = dataSource.getRepository(AccountEntity);
    transactions = dataSource.getRepository(TransactionEntity);
    batches = dataSource.getRepository(StatementImportBatchEntity);
    ledger = dataSource.getRepository(ConnectorIngestEventEntity);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE connector_ingest_events RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE statement_import_batches RESTART IDENTITY CASCADE');

    const owner = await users.save(
      users.create({
        email: 'zenrick-e2e@wallethub.local',
        username: `zenrick-e2e-${Date.now()}`,
        name: 'Zenrick E2E Owner',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7)
          .toString()
          .padStart(7, '0')}`,
        passwordHash: 'x',
        isActive: true,
        role: 'admin',
        baseCurrency: 'BRL',
      }),
    );

    // Plano free de propósito: o caminho connector NÃO passa pelo gating de plano (ADR §7).
    testOrg = await organizations.save(
      organizations.create({ name: `Org Zenrick E2E ${Date.now()}`, plan: 'free' }),
    );
    await memberships.save(
      memberships.create({
        organizationId: testOrg.id,
        userId: owner.id,
        role: 'owner',
        status: 'active',
      }),
    );

    // Conta com identidade bancária casável com o BANKACCTFROM da fixture.
    await accounts.save(
      accounts.create({
        organizationId: testOrg.id,
        name: 'Conta Zenrick E2E',
        ownerUserIds: null,
        isActive: true,
        // Identidade normalizada (normalizeBankField remove zeros à esquerda)
        bankId: '260',
        branchNumber: '1',
        accountNumber: '12345678',
      }),
    );

    process.env.WALLETHUB_CONNECTOR_ALLOWED_ORGS = testOrg.id;
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE connector_ingest_events RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE statement_import_batches RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('401 sem token e com token inválido', async () => {
    await request(app.getHttpServer())
      .post('/integrations/zenrick/statements')
      .set('Idempotency-Key', randomUUID())
      .send(payload())
      .expect(401);
    await post(randomUUID(), payload(), 'token-errado').expect(401);
  });

  it('400 sem Idempotency-Key; 400 em schemaVersion desconhecida', async () => {
    await request(app.getHttpServer())
      .post('/integrations/zenrick/statements')
      .set('Authorization', `Bearer ${CONNECTOR_TOKEN}`)
      .send(payload())
      .expect(400);
    await post(randomUUID(), payload({ schemaVersion: 2 })).expect(400);
  });

  it('403 para organização fora da allowlist', async () => {
    process.env.WALLETHUB_CONNECTOR_ALLOWED_ORGS = randomUUID();
    await post(randomUUID(), payload()).expect(403);
  });

  it('422 quando sha256 diverge do conteúdo', async () => {
    const body = payload();
    (body.file as Record<string, unknown>).sha256 = 'f'.repeat(64);
    await post(randomUUID(), body).expect(422);
  });

  it('dryRun projeta sem criar lote nem transações', async () => {
    const res = await post(randomUUID(), payload({ options: { dryRun: true } })).expect(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.created).toBe(0);
    expect(await batches.count()).toBe(0);
    expect(await transactions.count()).toBe(0);
  });

  it('commit cria transações source=connector com lote de proveniência + replay idempotente', async () => {
    const key = randomUUID();
    const first = await post(key, payload()).expect(200);

    expect(first.body.created).toBe(2);
    expect(first.body.replay).toBe(false);
    expect(first.body.batchId).toBeTruthy();
    expect(first.body.uncategorized).toBe(2); // sem mapeamentos: cai em "Sem categoria"
    expect(first.body.uncategorizedLines).toHaveLength(2);

    const created = await transactions.find();
    expect(created).toHaveLength(2);
    expect(created.every((t) => t.source === 'connector')).toBe(true);
    expect(created.every((t) => t.lockedUntil == null)).toBe(true); // sem lock de 2h (ADR §6)

    const batch = await batches.findOneByOrFail({ id: first.body.batchId });
    expect(batch.origin).toBe('connector');
    expect(batch.provenance).toMatchObject({
      channel: 'email',
      extractor: 'kyron/google-connector@e2e',
    });

    // Replay com a MESMA Idempotency-Key devolve a mesma resposta, sem duplicar nada.
    const replay = await post(key, payload()).expect(200);
    expect(replay.body.replay).toBe(true);
    expect(replay.body.batchId).toBe(first.body.batchId);
    expect(await transactions.count()).toBe(2);

    const event = await ledger.findOneByOrFail({ idempotencyKey: key });
    expect(event.status).toBe('imported');
    expect(event.batchId).toBe(first.body.batchId);
  });

  it('mesmo arquivo com Idempotency-Key nova → 409 (lote vivo), e o ledger registra duplicate', async () => {
    await post(randomUUID(), payload()).expect(200);
    const dupKey = randomUUID();
    await post(dupKey, payload()).expect(409);
    const event = await ledger.findOneByOrFail({ idempotencyKey: dupKey });
    expect(event.status).toBe('duplicate');
    // Replay do 409 com a mesma key continua 409 (idempotente).
    await post(dupKey, payload()).expect(409);
  });

  // --- F3: reports read-only S2S (ADR §9) ---

  function getReport(path: string, org: string, token = CONNECTOR_TOKEN) {
    return request(app.getHttpServer())
      .get(`/integrations/zenrick/reports/${path}`)
      .query({ organizationId: org })
      .set('Authorization', `Bearer ${token}`);
  }

  it('reports: 401 sem token; 403 org fora da allowlist', async () => {
    await request(app.getHttpServer())
      .get('/integrations/zenrick/reports/summary')
      .query({ organizationId: testOrg.id })
      .expect(401);
    await getReport('summary', randomUUID()).expect(403);
  });

  it('reports/summary retorna o resumo org-wide após ingestão connector', async () => {
    await post(randomUUID(), payload()).expect(200); // 1 débito 42,50 + 1 crédito 1500 (jun/2026)

    // A fixture é datada de jun/2026 → consulta o período correspondente.
    const res = await getReport('summary', testOrg.id).query({ period: '2026-06' }).expect(200);
    expect(res.body.totalIncome).toBeCloseTo(1500);
    expect(res.body.totalExpense).toBeCloseTo(42.5);
    expect(res.body.scope).toBe('all');
  });

  it('reports/top-transactions e category-catalog respondem com token', async () => {
    await post(randomUUID(), payload()).expect(200);
    const top = await getReport('top-transactions', testOrg.id)
      .query({ period: '2026-06', limit: '10' })
      .expect(200);
    expect(top.body).toBeDefined();
    const cat = await getReport('category-catalog', testOrg.id).expect(200);
    expect(Array.isArray(cat.body)).toBe(true); // ao menos as categorias de sistema
  });
});
