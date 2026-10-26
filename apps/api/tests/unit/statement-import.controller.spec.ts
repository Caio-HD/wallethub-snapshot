import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StatementImportController } from '@app/modules/statement-import/statement-import.controller';
import { StatementImportService } from '@app/modules/statement-import/statement-import.service';
import { StatementImportAuditService } from '@app/modules/statement-import/statement-import-audit.service';
import { StatementCategoryMappingService } from '@app/modules/statement-import/statement-category-mapping.service';
import { ActiveOrganizationGuard } from '@common/guards/active-organization.guard';
import { JwtAuthGuard } from '@app/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';

const ORG = { id: '00000000-0000-0000-0000-000000000001', plan: 'pro' as const };
const ACC = '33333333-3333-4333-8333-333333333333';

describe('StatementImportController', () => {
  const previewWebImport = jest.fn();
  const importCsvFromWeb = jest.fn();
  let controller: StatementImportController;

  beforeEach(async () => {
    previewWebImport.mockReset();
    importCsvFromWeb.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [StatementImportController],
      providers: [
        {
          provide: StatementImportService,
          useValue: { previewWebImport, importCsvFromWeb },
        },
        {
          provide: StatementImportAuditService,
          useValue: { listBatches: jest.fn(), getBatch: jest.fn(), deleteBatch: jest.fn() },
        },
        {
          provide: StatementCategoryMappingService,
          useValue: { list: jest.fn(), upsert: jest.fn(), remove: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ActiveOrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(StatementImportController);
  });

  it('previewStatementLegacy rejects missing file', async () => {
    await expect(controller.previewStatementLegacy(ORG as never, undefined, ACC)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('previewStatementLegacy delegates to service with accountId', async () => {
    const file = {
      buffer: Buffer.from('a'),
      originalname: 'f.csv',
      size: 1,
      mimetype: 'text/csv',
    } as Express.Multer.File;
    previewWebImport.mockResolvedValue({ ok: true });
    await expect(controller.previewStatementLegacy(ORG as never, file, ACC)).resolves.toEqual({
      ok: true,
    });
    expect(previewWebImport).toHaveBeenCalledWith(ORG.id, ORG.plan, file, ACC, undefined);
  });

  it('commitStatement validates uuids and user', async () => {
    const file = {
      buffer: Buffer.from('a'),
      originalname: 'f.csv',
      size: 1,
      mimetype: 'text/csv',
    } as Express.Multer.File;
    expect(() =>
      controller.commitStatement(
        ORG as never,
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as never,
        'not-uuid',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        file,
      ),
    ).toThrow('accountId inválido');
  });

  it('commitStatement rejects invalid skipKeys JSON', async () => {
    const acc = ACC;
    const cat = '44444444-4444-4444-8444-444444444444';
    const file = {
      buffer: Buffer.from('2025-01-01,1,x'),
      originalname: 'f.csv',
      size: 10,
      mimetype: 'text/csv',
    } as Express.Multer.File;
    const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    expect(() =>
      controller.commitStatement(
        ORG as never,
        user as never,
        acc,
        cat,
        undefined,
        undefined,
        'false',
        undefined,
        '{not-json',
        file,
      ),
    ).toThrow('skipKeys JSON inválido');
  });

  it('commitStatement calls service with skipKeys', async () => {
    const acc = ACC;
    const cat = '44444444-4444-4444-8444-444444444444';
    const file = {
      buffer: Buffer.from('2025-01-01,1,x'),
      originalname: 'f.csv',
      size: 10,
      mimetype: 'text/csv',
    } as Express.Multer.File;
    importCsvFromWeb.mockResolvedValue({ created: 1 });
    const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    const res = await controller.commitStatement(
      ORG as never,
      user as never,
      acc,
      cat,
      undefined,
      undefined,
      'false',
      undefined,
      JSON.stringify(['key-1']),
      file,
    );
    expect(res).toEqual({ created: 1 });
    expect(importCsvFromWeb).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG.id,
        accountId: acc,
        categoryId: cat,
        dryRun: false,
        skipKeys: new Set(['key-1']),
      }),
    );
  });
});
