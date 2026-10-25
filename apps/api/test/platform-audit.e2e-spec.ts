import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/database/entities/user.entity.js';
import { PlatformAuditLogEntity } from '../src/database/entities/platform-audit-log.entity.js';
import { RefreshTokenStore } from '../src/modules/auth/refresh-token.store';
import { InMemoryRefreshTokenStore } from './support/in-memory-refresh-token.store';
import { EvolutionClientService } from '../src/modules/whatsapp/evolution-client.service';
import { ElevatedAccessService } from '../src/common/security/elevated-access.service';
import { ensureDatabaseMigrations } from './support/migration-runner';

jest.setTimeout(60000);

/**
 * Proves the M1 contract end-to-end: a real operator mutation through the consolidated
 * `/admin/platform/users` surface lands a `platform_audit_log` row, and the deprecated
 * `/admin/users` shim still answers but flags itself with `Deprecation`/`Sunset`.
 *
 * MFA/kill-switch enforcement is isolated out (ElevatedAccessService override) so this suite
 * asserts the audit behaviour, not the elevated-access plumbing (covered elsewhere).
 */
describe('Platform audit coverage (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let users: Repository<UserEntity>;
  let audit: Repository<PlatformAuditLogEntity>;
  let operatorId: string;

  const operator = { username: 'audit-op-e2e', password: 'Str0ngP@ssw0rd!' };
  const createdUsernames: string[] = [];

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

    dataSource = moduleFixture.get(DataSource);
    await ensureDatabaseMigrations(dataSource);

    app = moduleFixture.createNestApplication(new ExpressAdapter());
    await app.init();

    users = dataSource.getRepository(UserEntity);
    audit = dataSource.getRepository(PlatformAuditLogEntity);
  });

  beforeEach(async () => {
    await users.delete({ username: operator.username });
    const passwordHash = await bcrypt.hash(operator.password, 10);
    const saved = await users.save(
      users.create({
        email: 'audit-op-e2e@wallethub.local',
        username: operator.username,
        name: 'Audit Operator',
        phoneNumber: `55119${Math.floor(Math.random() * 10 ** 7)
          .toString()
          .padStart(7, '0')}`,
        passwordHash,
        isActive: true,
        role: 'super_admin',
      }),
    );
    operatorId = saved.id;
  });

  afterEach(async () => {
    if (operatorId) await audit.delete({ actorUserId: operatorId });
    for (const username of createdUsernames.splice(0)) {
      await users.delete({ username });
    }
    await users.delete({ username: operator.username });
  });

  afterAll(async () => {
    await app.close();
  });

  const login = async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send(operator).expect(200);
    return res.body.accessToken as string;
  };

  it('POST /admin/platform/users writes a create audit row', async () => {
    const token = await login();
    const username = `created-e2e-${Math.floor(Math.random() * 10 ** 6)}`;
    createdUsernames.push(username);

    const res = await request(app.getHttpServer())
      .post('/admin/platform/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username, name: 'Created E2E', phoneNumber: '5511988887777', password: 'password123' })
      .expect(201);

    const createdId = res.body.id as string;
    const rows = await audit.find({
      where: { actorUserId: operatorId, action: 'create', entityType: 'user', entityId: createdId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].before).toBeNull();
    expect(rows[0].after).not.toBeNull();
  });

  it('PATCH /admin/platform/users/:id writes an update audit row with before/after', async () => {
    const token = await login();
    const username = `patched-e2e-${Math.floor(Math.random() * 10 ** 6)}`;
    createdUsernames.push(username);

    const created = await request(app.getHttpServer())
      .post('/admin/platform/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username, name: 'Before Name', phoneNumber: '5511977776666', password: 'password123' })
      .expect(201);
    const id = created.body.id as string;

    await request(app.getHttpServer())
      .patch(`/admin/platform/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'After Name' })
      .expect(200);

    const rows = await audit.find({
      where: { actorUserId: operatorId, action: 'update', entityType: 'user', entityId: id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].before).not.toBeNull();
    expect(rows[0].after).not.toBeNull();
  });

  it('legacy GET /admin/users still responds but is flagged Deprecation/Sunset', async () => {
    const token = await login();
    const res = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers['sunset']).toBeDefined();
    expect(res.headers['link']).toContain('/admin/platform/users');
  });

  it('GET /admin/platform/audit/export returns CSV with current filters', async () => {
    const token = await login();
    const username = `export-e2e-${Math.floor(Math.random() * 10 ** 6)}`;
    createdUsernames.push(username);

    await request(app.getHttpServer())
      .post('/admin/platform/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username, name: 'Export E2E', phoneNumber: '5511966665555', password: 'password123' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/admin/platform/audit/export?format=csv&entityType=user&action=create')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('id,data,accao');
    expect(res.text).toContain(username);

    const exportReads = await audit.find({
      where: { actorUserId: operatorId, action: 'read', entityType: 'platform_audit' },
    });
    expect(exportReads.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/platform/audit/export?format=json returns envelope', async () => {
    const token = await login();
    const res = await request(app.getHttpServer())
      .get('/admin/platform/audit/export?format=json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      exported: expect.any(Number),
      truncated: expect.any(Boolean),
    });
  });
});
