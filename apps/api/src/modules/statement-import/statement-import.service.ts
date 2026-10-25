import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/utils/db-error.util.js';
import type { OrganizationPlan } from '../../database/entities/organization.entity';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { StatementImportBatchEntity } from '../../database/entities/statement-import-batch.entity.js';
import { StatementCategoryMappingService } from './statement-category-mapping.service';
import { EntitlementsService } from '../plan-entitlements/entitlements.service';
import { PlanCapability } from '../plan-entitlements/plan-capabilities';
import { TransactionsService } from '../transactions/transactions.service';
import { CategoriesService } from '../categories/categories.service';
import { CategorySuggestionService } from '../categories/category-suggestion.service';
import { parseStatementCsv } from './statement-csv.parser';
import { parseStatementOFX } from './statement-ofx.parser';
import type { OFXBankInfo, ParsedStatementRow } from './statement-import.types';
import {
  StatementReconciliationService,
  type DuplicateStatus,
  type MatchedTransaction,
  type ReconciledStatementRow,
} from './statement-reconciliation.service';
import {
  normalizeDescriptionKey,
  normalizeExternalId,
  syntheticExternalId,
} from './statement-row-utils';
import { StatementImportIdempotencyService } from './statement-import-idempotency.service';
import {
  StatementImportPreviewCacheService,
  type CachedParsedFile,
} from './statement-import-preview-cache.service';
import { AccountsService, normalizeBankField } from '../accounts/accounts.service';
import { BanksService } from '../banks/banks.service';
import { InvestmentsService } from '../investments/investments.service';
import { classifyStatementRow } from './statement-import-classify';

/** Sugestão de conta a cadastrar a partir do <BANKACCTFROM> do OFX. */
export type SuggestedAccount = {
  name: string;
  bankId: string | null;
  bankName: string | null;
  branchNumber: string | null;
  accountNumber: string | null;
};

export type StatementBatchFilePreview = {
  filename: string;
  detectedAcctId?: string;
  rowCount: number;
  detectedFormat: 'csv' | 'ofx';
  bankInfo?: OFXBankInfo;
  /** Conta casada por banco+agência+conta (auto-match), se cadastrada. */
  matchedAccountId?: string;
  /** OFX com dados bancários mas sem conta correspondente — oferecer cadastro. */
  accountUnmatched: boolean;
  suggestedAccount?: SuggestedAccount;
};

export type StatementBatchPreviewRow = StatementImportPreviewRow & {
  filename: string;
  accountId: string;
};

export type StatementBatchCommitFileResult = {
  filename: string;
  acctId?: string;
  accountId?: string;
  status: 'ok' | 'pending' | 'error';
  created: number;
  skipped: number;
  alreadyExists: number;
  duplicates: number;
  errors: string[];
};

export type StatementImportPreviewRow = {
  rowKey: string;
  occurredAt: string;
  amount: number;
  description: string;
  suggestedCategoryId: string | null;
  suggestionConfidence: number;
  hint?: 'income' | 'expense';
  /** Direção derivada do sinal do valor (saída = débito, entrada = crédito). */
  direction: 'income' | 'expense';
  duplicateStatus: DuplicateStatus;
  matchedTransaction?: MatchedTransaction;
  selectedByDefault: boolean;
};

export type StatementImportResult = {
  organizationId: string;
  filename: string;
  dryRun: boolean;
  detectedFormat: 'csv' | 'ofx';
  bankInfo?: OFXBankInfo;
  previewRows: StatementImportPreviewRow[];
  created: number;
  skipped: number;
  alreadyExists: number;
  errors: string[];
  reconciliation?: {
    exact: number;
    likely: number;
    new: number;
    skipped: number;
  };
  /** Lote criado no commit (ausente em dryRun ou quando nada foi criado). */
  batchId?: string;
  /** Conta resolvida para o extrato (auto-match OFX ou seleção explícita). */
  accountId?: string;
  /** Linhas que caíram no fallback "Sem categoria" — call-to-action de recategorização. */
  uncategorized?: number;
  uncategorizedLines?: Array<{
    externalId?: string;
    description: string;
    /** Magnitude positiva (padrão do parser); o sinal está em direction. */
    amount: number;
    direction: 'income' | 'expense';
  }>;
};

/** Detecta formato por extensão ou conteúdo do buffer (primeiros 512 bytes). */
function detectFormat(file: Pick<Express.Multer.File, 'originalname' | 'buffer'>): 'csv' | 'ofx' {
  if (file.originalname.toLowerCase().endsWith('.ofx')) return 'ofx';
  const preview = file.buffer.toString('latin1', 0, 512);
  if (/OFXHEADER|<OFX>/i.test(preview)) return 'ofx';
  return 'csv';
}

/** Parseia o arquivo e retorna rows + metadados do banco (OFX). */
function parseFile(file: Pick<Express.Multer.File, 'originalname' | 'buffer'>) {
  const format = detectFormat(file);
  try {
    if (format === 'ofx') {
      const { rows, bankInfo, ledgerBalance } = parseStatementOFX(file.buffer);
      return { rows, format, bankInfo, ledgerBalance };
    }
    return { rows: parseStatementCsv(file.buffer), format };
  } catch {
    throw new BadRequestException(
      'Arquivo inválido ou corrompido. Verifique o formato (CSV ou OFX).',
    );
  }
}

@Injectable()
export class StatementImportService {
  private readonly logger = new Logger(StatementImportService.name);

  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
    private readonly categorySuggestion: CategorySuggestionService,
    private readonly reconciliation: StatementReconciliationService,
    private readonly idempotency: StatementImportIdempotencyService,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(StatementImportBatchEntity)
    private readonly batchRepository: Repository<StatementImportBatchEntity>,
    private readonly categoryMappings: StatementCategoryMappingService,
    private readonly banksService: BanksService,
    private readonly previewCache: StatementImportPreviewCacheService,
    private readonly accountsService: AccountsService,
    private readonly investmentsService: InvestmentsService,
  ) {}

  /** Cria o lote de importação; unique (org, conta, file_hash) bloqueia reimport do mesmo arquivo ativo. */
  private async createImportBatch(params: {
    organizationId: string;
    accountId: string;
    userId: string;
    filename: string;
    format: 'csv' | 'ofx';
    fileHash: string;
    detectedBankId: string | null;
    origin?: 'web' | 'connector';
    provenance?: Record<string, unknown> | null;
  }): Promise<StatementImportBatchEntity> {
    try {
      return await this.batchRepository.save(
        this.batchRepository.create({
          organizationId: params.organizationId,
          accountId: params.accountId,
          createdByUserId: params.userId,
          filename: params.filename.slice(0, 255),
          format: params.format,
          fileHash: params.fileHash,
          detectedBankId: params.detectedBankId,
          transactionCount: 0,
          skippedCount: 0,
          origin: params.origin ?? 'web',
          provenance: params.provenance ?? null,
        }),
      );
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException(
          'Este arquivo já foi importado nesta conta. Exclua a importação anterior antes de reimportar.',
        );
      }
      throw e;
    }
  }

  private assertWebImport(plan: OrganizationPlan): void {
    this.entitlements.assertCapability(plan, PlanCapability.webStatementImport);
  }

  /**
   * Casa o OFX a uma conta da organização por banco + agência + conta. Delega ao
   * `AccountsService.findByBankIdentity` — fonte ÚNICA do critério de match (escopo do
   * índice único `UQ_account_bank_branch_number`, sem filtro de `isActive`). Apenas adapta
   * a forma `OFXBankInfo` (que usa `branchId`) para a identidade canônica.
   */
  private async matchAccountByBankInfo(
    organizationId: string,
    bankInfo: OFXBankInfo | undefined,
  ): Promise<AccountEntity | null> {
    return this.accountsService.findByBankIdentity(organizationId, {
      bankId: bankInfo?.bankId,
      branchNumber: bankInfo?.branchId,
      accountNumber: bankInfo?.acctId,
    });
  }

  /**
   * Resolve a conta efetiva da importação. Auto-match prioritário: se o OFX casa
   * com uma conta cadastrada (banco+agência+conta), usa-a mesmo que `fallbackAccountId`
   * tenha sido informado. Caso contrário usa o `fallbackAccountId` (CSV / seleção manual),
   * validando que pertence à organização. Retorna null quando nada resolve.
   */
  private async resolveAccountId(
    organizationId: string,
    bankInfo: OFXBankInfo | undefined,
    fallbackAccountId?: string,
  ): Promise<string | null> {
    const matched = await this.matchAccountByBankInfo(organizationId, bankInfo);
    if (matched) return matched.id;
    if (fallbackAccountId) {
      await this.assertAccountInOrg(organizationId, fallbackAccountId);
      return fallbackAccountId;
    }
    return null;
  }

  /**
   * Auto-cadastro de conta a partir da identidade bancária do OFX — idempotente e
   * seguro sob concorrência (vários ficheiros do mesmo extrato). Porta exclusiva do
   * auto-provision do import; delega ao `AccountsService.ensureByBankIdentity` (que
   * casa/cria/reativa e recupera de corrida no índice único). Gating Pro+ como o resto
   * do import. Retorna a conta garantida (id + nome + estado).
   */
  async ensureAccountFromOfx(params: {
    organizationId: string;
    plan: OrganizationPlan;
    userId: string;
    name: string;
    bankId?: string | null;
    branchNumber?: string | null;
    accountNumber?: string | null;
  }): Promise<{ id: string; name: string; isActive: boolean }> {
    this.assertWebImport(params.plan);
    const account = await this.accountsService.ensureByBankIdentity(
      params.organizationId,
      params.userId,
      {
        name: params.name,
        bankId: params.bankId,
        branchNumber: params.branchNumber,
        accountNumber: params.accountNumber,
      },
    );
    return { id: account.id, name: account.name, isActive: account.isActive };
  }

  /**
   * Monta a sugestão de conta a cadastrar quando o OFX não casa com nenhuma conta.
   * Resolve o nome do banco pelo catálogo COMPE (quando o BANKID é conhecido) para
   * um nome amigável (ex: "Banco do Brasil — Ag 1234 CC 5678").
   */
  private async buildSuggestedAccount(
    bankInfo: OFXBankInfo | undefined,
  ): Promise<SuggestedAccount | undefined> {
    if (!bankInfo) return undefined;
    const { bankId, branchId, acctId } = bankInfo;
    if (!bankId && !branchId && !acctId) return undefined;
    const bank = bankId ? await this.banksService.findByCompe(bankId) : null;
    const bankLabel = bank?.name ?? (bankId ? `Banco ${bankId}` : null);
    const parts: string[] = [];
    if (bankLabel) parts.push(bankLabel);
    if (branchId) parts.push(`Ag ${branchId}`);
    if (acctId) parts.push(`CC ${acctId}`);
    return {
      name: parts.join(' — ').slice(0, 60) || 'Conta importada',
      bankId: bankId ?? null,
      bankName: bank?.name ?? null,
      branchNumber: branchId ?? null,
      accountNumber: acctId ?? null,
    };
  }

  private async enrichWithCategorySuggestions(
    organizationId: string,
    defaultCategoryId: string | undefined,
    reconciledRows: Awaited<ReturnType<StatementReconciliationService['reconcile']>>['rows'],
    maxSample: number,
  ): Promise<StatementImportPreviewRow[]> {
    const sampleSlice = reconciledRows.slice(0, maxSample).map((r) => r.row);
    let suggestions: Array<{ categoryId: string | null; confidence: number }> = [];

    if (defaultCategoryId && sampleSlice.length > 0) {
      const cat = await this.categoriesService.findActiveById(organizationId, defaultCategoryId);
      if (!cat) {
        throw new BadRequestException('Categoria padrão inválida para sugestões.');
      }
      if (cat.type === 'transfer') {
        throw new BadRequestException(
          'Categoria de transferência não pode ser categoria padrão de importação.',
        );
      }
      suggestions = await this.categorySuggestion.suggestForDescriptions(
        organizationId,
        cat.type,
        sampleSlice.map((r) => r.description),
      );
    }

    return reconciledRows.map((rec, i) => ({
      rowKey: rec.rowKey,
      occurredAt: rec.row.occurredAt,
      amount: rec.row.amount,
      description: rec.row.description,
      hint: rec.row.hint,
      direction: rec.row.amountSign < 0 ? ('expense' as const) : ('income' as const),
      duplicateStatus: rec.duplicateStatus,
      matchedTransaction: rec.matchedTransaction,
      selectedByDefault: rec.selectedByDefault,
      suggestedCategoryId: i < maxSample ? (suggestions[i]?.categoryId ?? null) : null,
      suggestionConfidence: i < maxSample ? (suggestions[i]?.confidence ?? 0) : 0,
    }));
  }

  /**
   * Valida plano Pro+ e devolve amostra das linhas parseadas (sem gravar).
   * Com `defaultCategoryId`, preenche sugestões heurísticas por linha.
   * Aceita CSV e OFX — detecção automática por extensão e conteúdo.
   */
  async previewWebImport(
    organizationId: string,
    plan: OrganizationPlan,
    file: Pick<Express.Multer.File, 'buffer' | 'originalname' | 'size' | 'mimetype'>,
    accountId?: string,
    defaultCategoryId?: string,
  ): Promise<{
    organizationId: string;
    filename: string;
    size: number;
    mimetype: string;
    detectedFormat: 'csv' | 'ofx';
    bankInfo?: OFXBankInfo;
    previewRows: StatementImportPreviewRow[];
    rowCount: number;
    reconciliation: { exact: number; likely: number; new: number };
    matchedAccountId?: string;
    accountUnmatched: boolean;
    suggestedAccount?: SuggestedAccount;
  }> {
    this.assertWebImport(plan);
    if (!file.buffer?.length) {
      throw new BadRequestException('Ficheiro em falta ou vazio.');
    }

    const { rows, format, bankInfo } = parseFile(file);
    if (rows.length === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo.');
    }

    const resolvedAccountId = await this.resolveAccountId(organizationId, bankInfo, accountId);

    // Conta não cadastrada: sinaliza o frontend para oferecer cadastro automático.
    if (!resolvedAccountId) {
      return {
        organizationId,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        detectedFormat: format,
        bankInfo,
        previewRows: [],
        rowCount: rows.length,
        reconciliation: { exact: 0, likely: 0, new: 0 },
        matchedAccountId: undefined,
        accountUnmatched: true,
        suggestedAccount: await this.buildSuggestedAccount(bankInfo),
      };
    }

    const { rows: reconciled, counts } = await this.reconciliation.reconcile(
      organizationId,
      resolvedAccountId,
      rows,
    );
    const previewRows = await this.enrichWithCategorySuggestions(
      organizationId,
      defaultCategoryId,
      reconciled,
      25,
    );

    return {
      organizationId,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      detectedFormat: format,
      bankInfo,
      previewRows,
      rowCount: rows.length,
      reconciliation: counts,
      matchedAccountId: resolvedAccountId,
      accountUnmatched: false,
      suggestedAccount: undefined,
    };
  }

  /**
   * Importa CSV ou OFX (mesmo parser que o preview). Concilia contra o banco.
   * `categoryOverrides`: índices de linha (string) → UUID de categoria.
   * `skipKeys`: rowKeys estáveis a ignorar (duplicatas desmarcadas pelo utilizador).
   */
  async importCsvFromWeb(params: {
    organizationId: string;
    plan: OrganizationPlan;
    userId: string;
    accountId?: string;
    /** Categoria padrão (fallback final). Opcional — sem ela, cai em "Sem categoria" direcional. */
    categoryId?: string;
    /** Categoria padrão para linhas de entrada (crédito). Quando ausente, usa categoryId. */
    incomeCategoryId?: string;
    /** Categoria padrão para linhas de saída (débito). Quando ausente, usa categoryId. */
    expenseCategoryId?: string;
    file: Express.Multer.File;
    dryRun: boolean;
    categoryOverrides?: Record<string, string>;
    skipKeys?: Set<string>;
    skipEntitlementIncrement?: boolean;
    /** Proveniência das transações criadas. 'connector' = ingestão S2S Zenrick (sem gating de plano — allowlist no guard). */
    source?: 'web' | 'connector';
    /** Metadados de origem gravados no lote (ADR adr-zenrick-connector; sem PII de e-mail). */
    provenance?: Record<string, unknown> | null;
  }): Promise<StatementImportResult> {
    const {
      organizationId,
      plan,
      userId,
      accountId: requestedAccountId,
      categoryId,
      incomeCategoryId,
      expenseCategoryId,
      file,
      dryRun,
      categoryOverrides,
      skipKeys = new Set(),
      skipEntitlementIncrement = false,
      source = 'web',
      provenance,
    } = params;
    if (source !== 'connector') {
      this.assertWebImport(plan);
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('Ficheiro em falta ou vazio.');
    }

    const { rows, format, bankInfo, ledgerBalance } = parseFile(file);
    if (rows.length === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo.');
    }

    // Auto-match prioritário: OFX casado por banco+agência+conta vence a seleção manual.
    const accountId = await this.resolveAccountId(organizationId, bankInfo, requestedAccountId);
    if (!accountId) {
      throw new BadRequestException(
        'Conta não identificada para este extrato. Cadastre a conta (banco/agência/conta) antes de importar.',
      );
    }

    const { rows: reconciled, counts } = await this.reconciliation.reconcile(
      organizationId,
      accountId,
      rows,
    );
    const previewRows = await this.enrichWithCategorySuggestions(
      organizationId,
      categoryId,
      reconciled,
      25,
    );

    const errors: string[] = [];
    let created = 0;
    let skipped = 0;
    let alreadyExists = 0;

    if (dryRun) {
      // dryRun nunca cria lote — apenas projeta o resultado.
      const wouldSkip = reconciled.filter((r) => skipKeys.has(r.rowKey)).length;
      return {
        organizationId,
        accountId,
        filename: file.originalname,
        dryRun: true,
        detectedFormat: format,
        bankInfo,
        previewRows,
        created: 0,
        skipped:
          wouldSkip +
          reconciled.filter((r) => !skipKeys.has(r.rowKey) && r.duplicateStatus !== 'new').length,
        alreadyExists: 0,
        errors,
        reconciliation: {
          ...counts,
          skipped: wouldSkip,
        },
      };
    }

    // Importar para a conta implica uso: reativa se estava apenas desativada.
    await this.accountsService.reactivate(accountId, organizationId);

    // Lote de auditoria + dedup em nível de arquivo (sha256 do buffer).
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const batch = await this.createImportBatch({
      organizationId,
      accountId,
      userId,
      filename: file.originalname,
      format,
      fileHash,
      detectedBankId: normalizeBankField(bankInfo?.bankId),
      origin: source,
      provenance,
    });

    // Memória descrição→categoria: pré-classifica linhas a partir de importações anteriores.
    const mappingByKey = await this.categoryMappings.resolveForDescriptions(
      organizationId,
      reconciled.map((r) => r.row.description),
    );
    // Tipos das categorias da org — para categorizar cada linha pela sua direção
    // (entrada/saída pelo sinal do valor) e ignorar mapeamentos de tipo incompatível.
    const orgCategories = await this.categoriesService.findAll(organizationId);
    const typeByCategory = new Map(orgCategories.map((c) => [c.id, c.type]));
    const incomeDefault =
      incomeCategoryId && typeByCategory.get(incomeCategoryId) === 'income'
        ? incomeCategoryId
        : undefined;
    const expenseDefault =
      expenseCategoryId && typeByCategory.get(expenseCategoryId) === 'expense'
        ? expenseCategoryId
        : undefined;
    // Destino neutro por tipo: linhas sem mapeamento/sugestão/escolha caem em
    // "Sem categoria (entrada/saída)" — o usuário classifica depois e o sistema aprende.
    const systemCats = await this.categoriesService.ensureSystemCategories(organizationId);
    // Instrumento de renda fixa determinístico por banco — agrupa todas as aplicações/resgates RDB.
    const rdbSymbol = `RDB-${(batch.detectedBankId ?? 'GERAL').toString().toUpperCase().slice(0, 24)}`;
    // Ocorrência da mesma (data|valor|descrição) dentro do arquivo — para external_id sintético de CSV.
    const occurrenceByKey = new Map<string, number>();
    // Linhas que caíram no fallback "Sem categoria" — devolvidas ao chamador como
    // call-to-action de recategorização (alimenta o loop de aprendizado / Kyron v2).
    const uncategorizedLines: NonNullable<StatementImportResult['uncategorizedLines']> = [];

    for (let i = 0; i < reconciled.length; i++) {
      const rec = reconciled[i];
      if (skipKeys.has(rec.rowKey)) {
        skipped += 1;
        continue;
      }

      // Direção pelo sinal do valor → escolhe a categoria do tipo correspondente.
      const direction: 'income' | 'expense' = rec.row.amountSign < 0 ? 'expense' : 'income';
      const directionalDefault = direction === 'income' ? incomeDefault : expenseDefault;
      const override = categoryOverrides?.[String(i)];
      // Mapeamento salvo só vale se for do mesmo tipo da linha (não inverte entrada/saída).
      const mapped = mappingByKey.get(normalizeDescriptionKey(rec.row.description));
      const mappedSameType =
        mapped && typeByCategory.get(mapped) === direction ? mapped : undefined;
      const systemFallback = direction === 'income' ? systemCats.income.id : systemCats.expense.id;
      const lineCategoryId =
        override ?? mappedSameType ?? directionalDefault ?? systemFallback ?? categoryId;

      // external_id: FITID (OFX) ou sintético determinístico (CSV) — blindagem anti-duplicidade.
      let externalId: string | undefined;
      if (rec.row.fitid) {
        externalId = normalizeExternalId(rec.row.fitid);
      } else {
        const occKey = rec.rowKey;
        const occ = (occurrenceByKey.get(occKey) ?? 0) + 1;
        occurrenceByKey.set(occKey, occ);
        externalId = syntheticExternalId(rec.row, occ);
      }

      // Detecção: aplicação/resgate RDB → movimento de investimento (+ caixa neutro).
      // Resto (incluindo pagamento de fatura) → transação normal (gasto/renda).
      const rowClass = classifyStatementRow(rec.row);
      try {
        if (rowClass.kind === 'investment') {
          await this.investmentsService.createMovement(
            userId,
            {
              symbol: rdbSymbol,
              market: 'BR',
              kind: 'fixed_income',
              movementKind: rowClass.movement,
              amount: rec.row.amount,
              accountId,
              occurredAt: rec.row.occurredAt,
              displayName: 'Renda Fixa (RDB)',
            },
            organizationId,
            { statementImportBatchId: batch.id, skipPositionCheck: true, externalId },
          );
        } else {
          await this.transactionsService.create(
            {
              occurredAt: rec.row.occurredAt,
              accountId,
              categoryId: lineCategoryId,
              userId,
              amount: rec.row.amount,
              description: rec.row.description,
              source,
              externalId,
              statementImportBatchId: batch.id,
            },
            organizationId,
          );
          if (lineCategoryId === systemFallback) {
            uncategorizedLines.push({
              externalId,
              description: rec.row.description,
              amount: rec.row.amount,
              direction,
            });
          }
        }
        created += 1;
      } catch (e) {
        if (rec.duplicateStatus === 'duplicate-exact' && isUniqueViolation(e)) {
          alreadyExists += 1;
          errors.push(`${rec.row.occurredAt}: already-exists (FITID duplicado)`.slice(0, 240));
        } else {
          skipped += 1;
          errors.push(
            `${rec.row.occurredAt}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 240),
          );
        }
      }
    }

    const skipCount = reconciled.filter((r) => skipKeys.has(r.rowKey)).length;

    // Abertura de saldo: o extrato traz o saldo que o BANCO tinha no fechamento
    // (<LEDGERBAL>). Sem um lançamento de abertura, a soma da movimentação importada
    // nunca chega lá — a conta já tinha saldo antes do primeiro extrato. Só na primeira
    // importação da conta, e apenas se o extrato trouxer o saldo.
    if (created > 0 && ledgerBalance && !(await this.accountsService.hasTransactions(accountId))) {
      const importedMovement = reconciled
        .filter((r) => !skipKeys.has(r.rowKey))
        .reduce((acc, r) => acc + r.row.amount * r.row.amountSign, 0);
      const openingAmount = Number((ledgerBalance.amount - importedMovement).toFixed(2));
      if (Math.abs(openingAmount) >= 0.01) {
        const opened = await this.accountsService.createOpeningBalance(
          accountId,
          openingAmount,
          userId,
          `OPENING_BAL_${accountId}`,
          new Date(`${reconciled[0]?.row.occurredAt ?? ledgerBalance.dtasof}T00:00:00.000Z`),
        );
        if (opened) {
          this.logger.log(
            JSON.stringify({
              event: 'statement_import_opening_balance',
              accountId,
              batchId: batch.id,
              openingAmount,
              ledgerBalance: ledgerBalance.amount,
            }),
          );
        }
      }
    }

    this.logger.log(
      JSON.stringify({
        event: 'statement_import_commit',
        accountId,
        batchId: batch.id,
        exact: counts.exact,
        likely: counts.likely,
        new: counts.new,
        skipped: skipCount + skipped,
        created,
        alreadyExists,
      }),
    );

    if (created === 0) {
      // Nada criado (arquivo totalmente duplicado): não polui a auditoria nem
      // ocupa o slot único de file_hash — remove o lote vazio.
      await this.batchRepository.delete({ id: batch.id });
    } else {
      batch.transactionCount = created;
      batch.skippedCount = skipCount + skipped + alreadyExists;
      await this.batchRepository.save(batch);

      // Aprende mapeamentos descrição→categoria a partir dos overrides explícitos do utilizador.
      if (categoryOverrides) {
        for (const [idx, catId] of Object.entries(categoryOverrides)) {
          const rec = reconciled[Number(idx)];
          if (rec) {
            await this.categoryMappings.upsert(organizationId, rec.row.description, catId);
          }
        }
      }
    }

    if (created > 0 && !skipEntitlementIncrement) {
      await this.entitlements.incrementStatementImportCount(organizationId);
    }

    return {
      organizationId,
      filename: file.originalname,
      dryRun: false,
      detectedFormat: format,
      bankInfo,
      previewRows,
      created,
      skipped,
      alreadyExists,
      errors: errors.slice(0, 50),
      reconciliation: {
        ...counts,
        skipped: skipCount,
      },
      batchId: created > 0 ? batch.id : undefined,
      accountId,
      uncategorized: uncategorizedLines.length,
      uncategorizedLines: uncategorizedLines.slice(0, 100),
    };
  }

  /**
   * Importação a partir do WhatsApp (buffer já descarregado). Gating Pro+ para import WhatsApp.
   */
  async importCsvFromWhatsapp(params: {
    organizationId: string;
    plan: OrganizationPlan;
    userId: string;
    accountId: string;
    categoryId: string;
    buffer: Buffer;
    filename: string;
  }): Promise<StatementImportResult> {
    const { organizationId, plan, userId, accountId, categoryId, buffer, filename } = params;
    this.entitlements.assertCapability(plan, PlanCapability.whatsappStatementImport);
    if (!buffer.length) {
      throw new BadRequestException('Documento vazio.');
    }

    const rows = parseStatementCsv(buffer);
    if (rows.length === 0) {
      throw new BadRequestException('Nenhuma linha válida no extrato.');
    }

    const { rows: reconciled, counts } = await this.reconciliation.reconcile(
      organizationId,
      accountId,
      rows,
    );
    const previewRows = await this.enrichWithCategorySuggestions(
      organizationId,
      categoryId,
      reconciled,
      10,
    );
    const errors: string[] = [];
    let created = 0;
    let skipped = 0;
    const alreadyExists = 0;

    for (const rec of reconciled) {
      if (rec.duplicateStatus !== 'new') {
        skipped += 1;
        continue;
      }
      try {
        await this.transactionsService.create(
          {
            occurredAt: rec.row.occurredAt,
            accountId,
            categoryId,
            userId,
            amount: rec.row.amount,
            description: rec.row.description,
            source: 'whatsapp',
            externalId: rec.row.fitid ? normalizeExternalId(rec.row.fitid) : undefined,
          },
          organizationId,
        );
        created += 1;
      } catch (e) {
        skipped += 1;
        errors.push(
          `${rec.row.occurredAt}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 240),
        );
      }
    }

    if (created > 0) {
      await this.entitlements.incrementStatementImportCount(organizationId);
    }

    return {
      organizationId,
      filename,
      dryRun: false,
      detectedFormat: 'csv',
      previewRows,
      created,
      skipped,
      alreadyExists,
      errors: errors.slice(0, 30),
      reconciliation: { ...counts, skipped },
    };
  }

  async previewBatch(
    organizationId: string,
    plan: OrganizationPlan,
    files: Express.Multer.File[],
    categoryId?: string,
  ): Promise<{
    token: string;
    files: StatementBatchFilePreview[];
    previewRows: StatementBatchPreviewRow[];
    reconciliation: { exact: number; likely: number; new: number };
  }> {
    this.assertWebImport(plan);
    if (!files.length) {
      throw new BadRequestException('Nenhum ficheiro enviado.');
    }
    const previews: StatementBatchFilePreview[] = [];
    const parsedFiles: CachedParsedFile[] = [];
    const initialRouting: Record<string, string> = {};
    for (const file of files) {
      if (!file.buffer?.length) continue;
      const { rows, format, bankInfo } = parseFile(file);
      const matched = await this.matchAccountByBankInfo(organizationId, bankInfo);
      const hasBankIdentity =
        !!normalizeBankField(bankInfo?.bankId) &&
        !!normalizeBankField(bankInfo?.branchId) &&
        !!normalizeBankField(bankInfo?.acctId);
      previews.push({
        filename: file.originalname,
        detectedAcctId: bankInfo?.acctId,
        rowCount: rows.length,
        detectedFormat: format,
        bankInfo,
        matchedAccountId: matched?.id,
        accountUnmatched: !matched && hasBankIdentity,
        suggestedAccount: !matched ? await this.buildSuggestedAccount(bankInfo) : undefined,
      });
      parsedFiles.push({ filename: file.originalname, rows, format, bankInfo });
      if (matched?.id) initialRouting[file.originalname] = matched.id;
    }
    if (previews.length === 0) {
      throw new BadRequestException('Ficheiros vazios ou inválidos.');
    }

    // Guarda as linhas parseadas sob um token: re-previews por mudança de
    // roteamento não precisam reenviar os ficheiros (evita double-upload/400).
    const token = randomUUID();
    await this.previewCache.store(organizationId, token, { files: parsedFiles });

    const { previewRows, reconciliation } = await this.reconcileParsedBatch(
      organizationId,
      parsedFiles,
      initialRouting,
      categoryId,
    );

    return { token, files: previews, previewRows, reconciliation };
  }

  /**
   * Re-reconcilia um lote já parseado (do cache) aplicando um novo roteamento,
   * sem reenviar os ficheiros. Token gerado por {@link previewBatch}.
   */
  async repreviewBatchByToken(params: {
    organizationId: string;
    plan: OrganizationPlan;
    token: string;
    routing: Record<string, string>;
    categoryId?: string;
  }): Promise<{
    previewRows: StatementBatchPreviewRow[];
    reconciliation: { exact: number; likely: number; new: number };
  }> {
    const { organizationId, plan, token, routing, categoryId } = params;
    this.assertWebImport(plan);

    const cached = await this.previewCache.get(organizationId, token);
    if (!cached) {
      throw new BadRequestException(
        'Pré-visualização expirou. Reenvie os ficheiros para pré-visualizar novamente.',
      );
    }

    return this.reconcileParsedBatch(organizationId, cached.files, routing, categoryId);
  }

  /** Reconcilia ficheiros já parseados contra o banco, por conta roteada. */
  private async reconcileParsedBatch(
    organizationId: string,
    parsedFiles: CachedParsedFile[],
    routing: Record<string, string>,
    categoryId?: string,
  ): Promise<{
    previewRows: StatementBatchPreviewRow[];
    reconciliation: { exact: number; likely: number; new: number };
  }> {
    const sorted = [...parsedFiles].sort((a, b) => {
      const acctCmp = (a.bankInfo?.acctId ?? '').localeCompare(b.bankInfo?.acctId ?? '');
      if (acctCmp !== 0) return acctCmp;
      return a.filename.localeCompare(b.filename);
    });

    const byAccount = new Map<string, Array<{ filename: string; rows: ParsedStatementRow[] }>>();
    for (const item of sorted) {
      const accountId = routing[item.filename];
      if (!accountId) continue;
      await this.assertAccountInOrg(organizationId, accountId);
      const bucket = byAccount.get(accountId) ?? [];
      bucket.push({ filename: item.filename, rows: item.rows });
      byAccount.set(accountId, bucket);
    }

    const allReconciled: Array<ReconciledStatementRow & { filename: string; accountId: string }> =
      [];

    for (const [accountId, fileGroups] of byAccount) {
      const mergedRows: ParsedStatementRow[] = [];
      for (const g of fileGroups) {
        mergedRows.push(...g.rows);
      }
      const { rows: dbReconciled } = await this.reconciliation.reconcile(
        organizationId,
        accountId,
        mergedRows,
      );
      const { rows: withBatch } = this.reconciliation.markIntraBatchDuplicates(dbReconciled);

      let offset = 0;
      for (const g of fileGroups) {
        const slice = withBatch.slice(offset, offset + g.rows.length);
        for (const rec of slice) {
          allReconciled.push({ ...rec, filename: g.filename, accountId });
        }
        offset += g.rows.length;
      }
    }

    const previewRows: StatementBatchPreviewRow[] = await Promise.all(
      allReconciled.map(async (rec, i) => {
        const base = (
          await this.enrichWithCategorySuggestions(
            organizationId,
            categoryId,
            [rec],
            i < 25 ? 1 : 0,
          )
        )[0];
        return { ...base, filename: rec.filename, accountId: rec.accountId };
      }),
    );

    const reconciliation = allReconciled.reduce(
      (acc, r) => {
        if (r.duplicateStatus === 'duplicate-exact') acc.exact += 1;
        else if (r.duplicateStatus === 'duplicate-likely') acc.likely += 1;
        else acc.new += 1;
        return acc;
      },
      { exact: 0, likely: 0, new: 0 },
    );

    return { previewRows, reconciliation };
  }

  private async assertAccountInOrg(organizationId: string, accountId: string): Promise<void> {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId, organizationId },
    });
    if (!account) {
      throw new NotFoundException(`Conta ${accountId} não encontrada nesta organização.`);
    }
  }

  private sortFilesForBatch(
    parsed: Array<{
      file: Express.Multer.File;
      rows: ParsedStatementRow[];
      format: 'csv' | 'ofx';
      bankInfo?: OFXBankInfo;
    }>,
  ): typeof parsed {
    return [...parsed].sort((a, b) => {
      const acctA = a.bankInfo?.acctId ?? '';
      const acctB = b.bankInfo?.acctId ?? '';
      const acctCmp = acctA.localeCompare(acctB);
      if (acctCmp !== 0) return acctCmp;
      return a.file.originalname.localeCompare(b.file.originalname);
    });
  }

  async commitBatch(params: {
    organizationId: string;
    plan: OrganizationPlan;
    userId: string;
    files: Express.Multer.File[];
    routing: Record<string, string>;
    categoryId: string;
    incomeCategoryId?: string;
    expenseCategoryId?: string;
    skipKeys?: Set<string>;
    idempotencyKey?: string;
  }): Promise<{ files: StatementBatchCommitFileResult[]; idempotentReplay: boolean }> {
    const {
      organizationId,
      plan,
      userId,
      files,
      routing,
      categoryId,
      incomeCategoryId,
      expenseCategoryId,
      skipKeys = new Set(),
      idempotencyKey,
    } = params;
    this.assertWebImport(plan);

    if (idempotencyKey) {
      const cached = await this.idempotency.get<{ files: StatementBatchCommitFileResult[] }>(
        organizationId,
        idempotencyKey,
      );
      if (cached) {
        return { files: cached.files, idempotentReplay: true };
      }
    }

    const results: StatementBatchCommitFileResult[] = [];
    let totalCreated = 0;

    for (const file of this.sortFilesForBatch(
      files
        .filter((f) => f.buffer?.length)
        .map((f) => {
          const parsed = parseFile(f);
          return { file: f, ...parsed };
        }),
    )) {
      const accountId = routing[file.file.originalname];
      if (!accountId) {
        results.push({
          filename: file.file.originalname,
          acctId: file.bankInfo?.acctId,
          status: 'pending',
          created: 0,
          skipped: 0,
          alreadyExists: 0,
          duplicates: 0,
          errors: ['Conta não roteada para este ficheiro.'],
        });
        continue;
      }

      try {
        await this.assertAccountInOrg(organizationId, accountId);
        const res = await this.importCsvFromWeb({
          organizationId,
          plan,
          userId,
          accountId,
          categoryId,
          incomeCategoryId,
          expenseCategoryId,
          file: file.file,
          dryRun: false,
          skipKeys,
          skipEntitlementIncrement: true,
        });
        totalCreated += res.created;
        const duplicates = (res.reconciliation?.exact ?? 0) + (res.reconciliation?.likely ?? 0);
        results.push({
          filename: file.file.originalname,
          acctId: file.bankInfo?.acctId,
          accountId,
          status: 'ok',
          created: res.created,
          skipped: res.skipped,
          alreadyExists: res.alreadyExists,
          duplicates,
          errors: res.errors,
        });
      } catch (e) {
        results.push({
          filename: file.file.originalname,
          acctId: file.bankInfo?.acctId,
          accountId,
          status: 'error',
          created: 0,
          skipped: 0,
          alreadyExists: 0,
          duplicates: 0,
          errors: [(e instanceof Error ? e.message : String(e)).slice(0, 240)],
        });
      }
    }

    if (idempotencyKey) {
      await this.idempotency.set(organizationId, idempotencyKey, { files: results });
    }

    if (totalCreated > 0) {
      await this.entitlements.incrementStatementImportCount(organizationId);
    }

    return { files: results, idempotentReplay: false };
  }
}
