import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { StatementImportService } from '@app/modules/statement-import/statement-import.service';
import type { EntitlementsService } from '@app/modules/plan-entitlements/entitlements.service';
import type { TransactionsService } from '@app/modules/transactions/transactions.service';
import type { CategoriesService } from '@app/modules/categories/categories.service';
import type { CategorySuggestionService } from '@app/modules/categories/category-suggestion.service';
import type { StatementReconciliationService } from '@app/modules/statement-import/statement-reconciliation.service';
import {
  buildStableRowKey,
  normalizeDescriptionKey,
} from '@app/modules/statement-import/statement-row-utils';
import type { ParsedStatementRow } from '@app/modules/statement-import/statement-import.types';
import { buildOfx, stmtrn } from '../../test/support/ofx.fixture';

const ORG = '00000000-0000-0000-0000-000000000001';
const USER = '00000000-0000-0000-0000-000000000002';
const ACC = '00000000-0000-0000-0000-000000000003';
const CAT = '00000000-0000-0000-0000-000000000004';

describe('StatementImportService', () => {
  const mkFile = (buf: Buffer, name = 'x.csv'): Express.Multer.File =>
    ({
      buffer: buf,
      originalname: name,
      size: buf.length,
      mimetype: 'text/csv',
    }) as Express.Multer.File;

  const mkCategories = (
    all: Array<{ id: string; type: 'income' | 'expense' }> = [{ id: CAT, type: 'expense' }],
  ): Pick<CategoriesService, 'findActiveById' | 'findAll' | 'ensureSystemCategories'> => ({
    findActiveById: jest.fn().mockResolvedValue({ id: CAT, type: 'expense' }),
    findAll: jest.fn().mockResolvedValue(all),
    ensureSystemCategories: jest.fn().mockResolvedValue({
      income: { id: 'sys-income', type: 'income' },
      expense: { id: 'sys-expense', type: 'expense' },
    }),
  });

  const mkSuggestion = (): Pick<CategorySuggestionService, 'suggestForDescriptions'> => ({
    suggestForDescriptions: jest.fn().mockResolvedValue([]),
  });

  const mkReconciliation = (
    overrides?: Partial<StatementReconciliationService>,
  ): StatementReconciliationService =>
    ({
      reconcile: jest.fn().mockImplementation(async (_org, _acc, rows: ParsedStatementRow[]) => ({
        rows: rows.map((r) => ({
          row: r,
          rowKey: buildStableRowKey(r),
          duplicateStatus: 'new' as const,
          selectedByDefault: true,
        })),
        counts: { exact: 0, likely: 0, new: rows.length },
      })),
      markIntraBatchDuplicates: jest.fn().mockImplementation((rows) => ({
        rows,
        counts: { exact: 0, likely: 0, new: rows.length },
      })),
      ...overrides,
    }) as unknown as StatementReconciliationService;

  const mkIdempotency = () =>
    ({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    }) as unknown as import('@app/modules/statement-import/statement-import-idempotency.service').StatementImportIdempotencyService;

  const mkAccountsRepo = () =>
    ({
      findOne: jest.fn().mockResolvedValue({ id: ACC }),
    }) as never;

  const mkBanks = () =>
    ({
      findByCompe: jest.fn().mockResolvedValue(null),
      findAllActive: jest.fn().mockResolvedValue([]),
    }) as unknown as import('@app/modules/banks/banks.service').BanksService;

  const mkBatchRepo = (overrides?: Record<string, jest.Mock>) =>
    ({
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation(async (v) => ({ id: 'batch-1', ...v })),
      delete: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    }) as never;

  const mkCategoryMappings = (overrides?: Record<string, jest.Mock>) =>
    ({
      resolveForDescriptions: jest.fn().mockResolvedValue(new Map<string, string>()),
      upsert: jest.fn().mockResolvedValue(null),
      ...overrides,
    }) as unknown as import('@app/modules/statement-import/statement-category-mapping.service').StatementCategoryMappingService;

  const mkAccountsService = (overrides?: Record<string, jest.Mock>) =>
    ({
      findByBankIdentity: jest.fn().mockResolvedValue(null),
      reactivate: jest.fn().mockResolvedValue(undefined),
      ensureByBankIdentity: jest.fn(),
      hasTransactions: jest.fn().mockResolvedValue(false),
      createOpeningBalance: jest.fn().mockResolvedValue(true),
      ...overrides,
    }) as unknown as import('@app/modules/accounts/accounts.service').AccountsService;

  const mkInvestments = (overrides?: Record<string, jest.Mock>) =>
    ({
      createMovement: jest.fn().mockResolvedValue({ id: 'mov' }),
      ...overrides,
    }) as unknown as import('@app/modules/investments/investments.service').InvestmentsService;

  const mkPreviewCache = (overrides?: Record<string, jest.Mock>) =>
    ({
      store: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      ...overrides,
    }) as unknown as import('@app/modules/statement-import/statement-import-preview-cache.service').StatementImportPreviewCacheService;

  const mkService = (
    entitlements: EntitlementsService,
    txs: TransactionsService,
    reconciliation?: StatementReconciliationService,
    deps?: {
      batchRepo?: never;
      categoryMappings?: ReturnType<typeof mkCategoryMappings>;
      categories?: Array<{ id: string; type: 'income' | 'expense' }>;
      previewCache?: ReturnType<typeof mkPreviewCache>;
      investments?: ReturnType<typeof mkInvestments>;
      accountsService?: ReturnType<typeof mkAccountsService>;
    },
  ) =>
    new StatementImportService(
      entitlements,
      txs,
      mkCategories(deps?.categories) as unknown as CategoriesService,
      mkSuggestion() as unknown as CategorySuggestionService,
      reconciliation ?? mkReconciliation(),
      mkIdempotency(),
      mkAccountsRepo(),
      deps?.batchRepo ?? mkBatchRepo(),
      deps?.categoryMappings ?? mkCategoryMappings(),
      mkBanks(),
      deps?.previewCache ?? mkPreviewCache(),
      deps?.accountsService ?? mkAccountsService(),
      deps?.investments ?? mkInvestments(),
    );

  it('previewWebImport throws for free plan', async () => {
    const entitlements = {
      assertCapability: jest.fn(() => {
        throw new ForbiddenException('pro');
      }),
    } as unknown as EntitlementsService;
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    await expect(
      service.previewWebImport(ORG, 'free', mkFile(Buffer.from('2025-01-01,10,x')), ACC),
    ).rejects.toThrow(ForbiddenException);
  });

  it('previewWebImport throws on empty buffer', async () => {
    const entitlements = { assertCapability: jest.fn() } as unknown as EntitlementsService;
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    await expect(
      service.previewWebImport(ORG, 'pro', mkFile(Buffer.alloc(0)), ACC),
    ).rejects.toThrow(BadRequestException);
  });

  it('previewWebImport returns preview for pro with reconciliation', async () => {
    const entitlements = { assertCapability: jest.fn() } as unknown as EntitlementsService;
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    const csv = '2025-01-01,10.5,Desc\n2025-01-02,2,y';
    const r = await service.previewWebImport(ORG, 'pro', mkFile(Buffer.from(csv)), ACC);
    expect(r.rowCount).toBe(2);
    expect(r.previewRows[0]).toMatchObject({
      occurredAt: '2025-01-01',
      amount: 10.5,
      duplicateStatus: 'new',
      selectedByDefault: true,
    });
    expect(r.reconciliation.new).toBe(2);
    expect(entitlements.assertCapability).toHaveBeenCalled();
  });

  it('importCsvFromWeb dryRun skips create', async () => {
    const entitlements = { assertCapability: jest.fn(), incrementStatementImportCount: jest.fn() };
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const service = mkService(entitlements as unknown as EntitlementsService, txs);
    const res = await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from('2025-01-01,5,a')),
      dryRun: true,
    });
    expect(res.dryRun).toBe(true);
    expect(res.created).toBe(0);
    expect(txs.create).not.toHaveBeenCalled();
  });

  it('importCsvFromWeb throws when no valid rows', async () => {
    const entitlements = { assertCapability: jest.fn() } as unknown as EntitlementsService;
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    await expect(
      service.importCsvFromWeb({
        organizationId: ORG,
        plan: 'pro',
        userId: USER,
        accountId: ACC,
        categoryId: CAT,
        file: mkFile(Buffer.from('# only comments')),
        dryRun: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('importCsvFromWeb creates rows and increments', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    const res = await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from('2025-01-01,5,a')),
      dryRun: false,
    });
    expect(res.created).toBe(1);
    expect(txs.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'web' }), ORG);
    expect(entitlements.incrementStatementImportCount).toHaveBeenCalledWith(ORG);
  });

  it('importCsvFromWeb roteia RDB → investimento e fatura → despesa', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const createTransfer = jest.fn().mockResolvedValue([{ id: 'tr' }]);
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
      createTransfer,
    } as unknown as TransactionsService;
    const investments = mkInvestments();
    const service = mkService(entitlements, txs, undefined, { investments });

    // CSV: aplicação RDB (saída), pagamento de fatura (saída), gasto normal (saída).
    const csv = [
      '2025-01-02,-100,Aplicação RDB',
      '2025-01-03,-200,Pagamento de fatura',
      '2025-01-04,-30,Mercado',
    ].join('\n');

    const res = await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from(csv)),
      dryRun: false,
    });

    expect(res.created).toBe(3);
    // RDB → movimento de investimento renda fixa, com conta de caixa e contexto do lote.
    expect(investments.createMovement).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ kind: 'fixed_income', movementKind: 'buy', amount: 100 }),
      ORG,
      expect.objectContaining({ skipPositionCheck: true }),
    );
    // Fatura → despesa: o cartão não é conta rastreada aqui, então o pagamento da fatura é
    // consumo real da conta corrente (BUG-39). Viraria transferência neutra e sumiria do total.
    expect(createTransfer).not.toHaveBeenCalled();
    expect(txs.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 200, description: 'Pagamento de fatura' }),
      ORG,
    );
    // Gasto normal → transação comum (a 3ª linha). Duas despesas no total: fatura + gasto.
    expect(txs.create).toHaveBeenCalledTimes(2);
  });

  it('importCsvFromWeb cria a abertura de saldo quando o OFX traz LEDGERBAL e a conta está vazia', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    } as unknown as TransactionsService;
    const createOpeningBalance = jest.fn().mockResolvedValue(true);
    const service = mkService(entitlements, txs, undefined, {
      accountsService: mkAccountsService({
        hasTransactions: jest.fn().mockResolvedValue(false),
        createOpeningBalance,
      }),
    });

    const ofx = buildOfx(
      [stmtrn({ dtposted: '20261001', trnamt: '-100.00', name: 'Mercado', fitid: 'f-1' })],
      '668.02',
    );

    await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(ofx, 'x.ofx'),
      dryRun: false,
    });

    // O banco fechou em 668,02 e o extrato traz -100,00: a conta tinha 768,02 antes.
    expect(createOpeningBalance).toHaveBeenCalledWith(
      ACC,
      768.02,
      USER,
      `OPENING_BAL_${ACC}`,
      new Date('2026-10-01T00:00:00.000Z'),
    );
  });

  it('importCsvFromWeb não cria abertura quando a conta já tem transações', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    } as unknown as TransactionsService;
    const createOpeningBalance = jest.fn().mockResolvedValue(true);
    const service = mkService(entitlements, txs, undefined, {
      accountsService: mkAccountsService({
        hasTransactions: jest.fn().mockResolvedValue(true),
        createOpeningBalance,
      }),
    });

    const ofx = buildOfx(
      [stmtrn({ dtposted: '20261001', trnamt: '-100.00', name: 'Mercado', fitid: 'f-1' })],
      '668.02',
    );

    await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(ofx, 'x.ofx'),
      dryRun: false,
    });

    expect(createOpeningBalance).not.toHaveBeenCalled();
  });

  it('importCsvFromWeb skips rows in skipKeys', async () => {
    const row: ParsedStatementRow = {
      occurredAt: '2025-01-01',
      amount: 5,
      amountSign: -1,
      description: 'a',
    };
    const rowKey = buildStableRowKey(row);
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    } as unknown as TransactionsService;
    const service = mkService(
      entitlements,
      txs,
      mkReconciliation({
        reconcile: jest.fn().mockResolvedValue({
          rows: [{ row, rowKey, duplicateStatus: 'duplicate-likely', selectedByDefault: false }],
          counts: { exact: 0, likely: 1, new: 0 },
        }),
      }),
    );
    const res = await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from('2025-01-01,5,a')),
      dryRun: false,
      skipKeys: new Set([rowKey]),
    });
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
    expect(txs.create).not.toHaveBeenCalled();
  });

  it('importCsvFromWeb returns alreadyExists on exact duplicate force-import', async () => {
    const row: ParsedStatementRow = {
      occurredAt: '2025-01-01',
      amount: 5,
      amountSign: -1,
      description: 'a',
      fitid: 'F1',
    };
    const rowKey = buildStableRowKey(row);
    const uniqueErr = Object.assign(new QueryFailedError('q', [], {} as never), { code: '23505' });
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockRejectedValue(uniqueErr),
    } as unknown as TransactionsService;
    const service = mkService(
      entitlements,
      txs,
      mkReconciliation({
        reconcile: jest.fn().mockResolvedValue({
          rows: [{ row, rowKey, duplicateStatus: 'duplicate-exact', selectedByDefault: false }],
          counts: { exact: 1, likely: 0, new: 0 },
        }),
      }),
    );
    const res = await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from('2025-01-01,5,a')),
      dryRun: false,
      skipKeys: new Set(),
    });
    expect(res.alreadyExists).toBe(1);
    expect(res.skipped).toBe(0);
  });

  it('importCsvFromWeb counts errors when create fails', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockRejectedValue(new Error('fail')),
    } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    const res = await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from('2025-01-01,5,a')),
      dryRun: false,
    });
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.errors.length).toBe(1);
    expect(entitlements.incrementStatementImportCount).not.toHaveBeenCalled();
  });

  it('importCsvFromWhatsapp requires capability and creates', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = { create: jest.fn().mockResolvedValue({}) } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    const res = await service.importCsvFromWhatsapp({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      buffer: Buffer.from('2025-02-01,1,z'),
      filename: 'wa.csv',
    });
    expect(res.filename).toBe('wa.csv');
    expect(txs.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'whatsapp' }), ORG);
    expect(entitlements.incrementStatementImportCount).toHaveBeenCalled();
  });

  it('importCsvFromWeb creates a batch and links transactions to it', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    } as unknown as TransactionsService;
    const batchRepo = mkBatchRepo();
    const service = mkService(entitlements, txs, undefined, { batchRepo });
    await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from('2025-01-01,5,a')),
      dryRun: false,
    });
    expect((batchRepo as unknown as { save: jest.Mock }).save).toHaveBeenCalled();
    expect(txs.create).toHaveBeenCalledWith(
      expect.objectContaining({ statementImportBatchId: 'batch-1' }),
      ORG,
    );
  });

  it('importCsvFromWeb assigns a synthetic external_id for CSV rows (no FITID)', async () => {
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      file: mkFile(Buffer.from('2025-01-01,5,a')),
      dryRun: false,
    });
    const arg = (txs.create as jest.Mock).mock.calls[0][0] as { externalId?: string };
    expect(arg.externalId).toMatch(/^csv:[0-9a-f]{40}#1$/);
  });

  it('importCsvFromWeb blocks reimport of the same file (unique violation → Conflict)', async () => {
    const uniqueErr = Object.assign(new QueryFailedError('q', [], {} as never), { code: '23505' });
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const batchRepo = mkBatchRepo({ save: jest.fn().mockRejectedValue(uniqueErr) });
    const service = mkService(entitlements, txs, undefined, { batchRepo });
    await expect(
      service.importCsvFromWeb({
        organizationId: ORG,
        plan: 'pro',
        userId: USER,
        accountId: ACC,
        categoryId: CAT,
        file: mkFile(Buffer.from('2025-01-01,5,a')),
        dryRun: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(txs.create).not.toHaveBeenCalled();
  });

  it('importCsvFromWeb applies a saved category mapping over the default category', async () => {
    const MAPPED = '00000000-0000-0000-0000-0000000000aa';
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    } as unknown as TransactionsService;
    const categoryMappings = mkCategoryMappings({
      resolveForDescriptions: jest
        .fn()
        .mockResolvedValue(new Map([[normalizeDescriptionKey('Mercado XYZ'), MAPPED]])),
    });
    // Linha "+5" é entrada; o mapeamento só vale se for do mesmo tipo (income).
    const service = mkService(entitlements, txs, undefined, {
      categoryMappings,
      categories: [
        { id: CAT, type: 'expense' },
        { id: MAPPED, type: 'income' },
      ],
    });
    await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: CAT,
      incomeCategoryId: MAPPED,
      file: mkFile(Buffer.from('2025-01-01,5,Mercado XYZ')),
      dryRun: false,
    });
    expect(txs.create).toHaveBeenCalledWith(expect.objectContaining({ categoryId: MAPPED }), ORG);
  });

  it('importCsvFromWeb categorizes income vs expense rows by sign (directional defaults)', async () => {
    const INCOME = '00000000-0000-0000-0000-0000000000c1';
    const EXPENSE = '00000000-0000-0000-0000-0000000000c2';
    const rows: ParsedStatementRow[] = [
      { occurredAt: '2025-01-01', amount: 10, amountSign: 1, description: 'Salário' },
      { occurredAt: '2025-01-02', amount: 7, amountSign: -1, description: 'Mercado' },
    ];
    const entitlements = {
      assertCapability: jest.fn(),
      incrementStatementImportCount: jest.fn(),
    } as unknown as EntitlementsService;
    const txs = {
      create: jest.fn().mockResolvedValue({ id: 't' }),
    } as unknown as TransactionsService;
    const service = mkService(
      entitlements,
      txs,
      mkReconciliation({
        reconcile: jest.fn().mockResolvedValue({
          rows: rows.map((r) => ({
            row: r,
            rowKey: buildStableRowKey(r),
            duplicateStatus: 'new' as const,
            selectedByDefault: true,
          })),
          counts: { exact: 0, likely: 0, new: 2 },
        }),
      }),
      {
        categories: [
          { id: INCOME, type: 'income' },
          { id: EXPENSE, type: 'expense' },
        ],
      },
    );
    await service.importCsvFromWeb({
      organizationId: ORG,
      plan: 'pro',
      userId: USER,
      accountId: ACC,
      categoryId: EXPENSE,
      incomeCategoryId: INCOME,
      expenseCategoryId: EXPENSE,
      file: mkFile(Buffer.from('2025-01-01,10,Salário\n2025-01-02,-7,Mercado')),
      dryRun: false,
    });
    const calls = (txs.create as jest.Mock).mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(calls.find((c) => c.description === 'Salário')?.categoryId).toBe(INCOME);
    expect(calls.find((c) => c.description === 'Mercado')?.categoryId).toBe(EXPENSE);
  });

  it('importCsvFromWhatsapp throws on empty buffer', async () => {
    const entitlements = { assertCapability: jest.fn() } as unknown as EntitlementsService;
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const service = mkService(entitlements, txs);
    await expect(
      service.importCsvFromWhatsapp({
        organizationId: ORG,
        plan: 'pro',
        userId: USER,
        accountId: ACC,
        categoryId: CAT,
        buffer: Buffer.alloc(0),
        filename: 'x.csv',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('previewBatch returns a token and caches the parsed files', async () => {
    const entitlements = { assertCapability: jest.fn() } as unknown as EntitlementsService;
    const txs = { create: jest.fn() } as unknown as TransactionsService;
    const previewCache = mkPreviewCache();
    const service = mkService(entitlements, txs, undefined, { previewCache });
    const file = mkFile(Buffer.from('2025-01-01,10,Mercado'), 'extrato.csv');

    const r = await service.previewBatch(ORG, 'pro', [file], CAT);

    expect(typeof r.token).toBe('string');
    expect(r.token.length).toBeGreaterThan(0);
    expect(r.files[0].filename).toBe('extrato.csv');
    expect(previewCache.store).toHaveBeenCalledWith(
      ORG,
      r.token,
      expect.objectContaining({ files: expect.any(Array) }),
    );
  });

  it('repreviewBatchByToken throws when the preview token expired', async () => {
    const entitlements = { assertCapability: jest.fn() } as unknown as EntitlementsService;
    const txs = {} as unknown as TransactionsService;
    const previewCache = mkPreviewCache({ get: jest.fn().mockResolvedValue(null) });
    const service = mkService(entitlements, txs, undefined, { previewCache });

    await expect(
      service.repreviewBatchByToken({
        organizationId: ORG,
        plan: 'pro',
        token: 'expired-token',
        routing: {},
        categoryId: CAT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('repreviewBatchByToken reconciles cached files using the new routing (no re-upload)', async () => {
    const entitlements = { assertCapability: jest.fn() } as unknown as EntitlementsService;
    const txs = {} as unknown as TransactionsService;
    const cached = {
      files: [
        {
          filename: 'a.csv',
          format: 'csv' as const,
          rows: [
            {
              occurredAt: '2025-01-01',
              amount: 10,
              amountSign: -1 as const,
              description: 'Mercado',
            },
          ],
        },
      ],
    };
    const previewCache = mkPreviewCache({ get: jest.fn().mockResolvedValue(cached) });
    const service = mkService(entitlements, txs, undefined, { previewCache });

    const r = await service.repreviewBatchByToken({
      organizationId: ORG,
      plan: 'pro',
      token: 'tok',
      routing: { 'a.csv': ACC },
      categoryId: CAT,
    });

    expect(r.previewRows).toHaveLength(1);
    expect(r.previewRows[0]).toMatchObject({ filename: 'a.csv', accountId: ACC });
    expect(r.reconciliation.new).toBe(1);
  });
});
