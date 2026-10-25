import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { ConnectorIngestEventEntity } from '../../../database/entities/connector-ingest-event.entity.js';
import { OrganizationEntity } from '../../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../../database/entities/organization-membership.entity.js';
import {
  StatementImportResult,
  StatementImportService,
} from '../../statement-import/statement-import.service';
import { IngestStatementDto } from './dto/ingest-statement.dto.js';
import { assertConnectorOrgAllowed } from './zenrick-org.util.js';

/** Após N falhas com a mesma Idempotency-Key, o ledger vira DLQ lógico: para de reprocessar. */
const MAX_ATTEMPTS = 5;

export type ZenrickIngestResponse = {
  schemaVersion: 1;
  replay: boolean;
  batchId?: string;
  accountId?: string;
  dryRun: boolean;
  created: number;
  skipped: number;
  alreadyExists: number;
  uncategorized: number;
  uncategorizedLines: NonNullable<StatementImportResult['uncategorizedLines']>;
  reconciliation?: StatementImportResult['reconciliation'];
  bankInfo?: StatementImportResult['bankInfo'];
  errors: string[];
};

/**
 * Ingestão S2S de extratos do ecossistema Zenrick (Kyron) — ADR adr-zenrick-connector.
 * Recebe o arquivo bruto (o WalletHub é o único parser de OFX/CSV), delega ao pipeline
 * maduro do StatementImportService e mantém o ledger durável de idempotência.
 */
@Injectable()
export class ZenrickIngestService {
  private readonly logger = new Logger(ZenrickIngestService.name);

  constructor(
    private readonly statementImport: StatementImportService,
    @InjectRepository(ConnectorIngestEventEntity)
    private readonly ledger: Repository<ConnectorIngestEventEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly memberships: Repository<OrganizationMembershipEntity>,
  ) {}

  async ingestStatement(
    dto: IngestStatementDto,
    idempotencyKey: string,
  ): Promise<ZenrickIngestResponse> {
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key header obrigatório (máx. 128 chars).');
    }
    // Single source of truth for the org allowlist (shared with the reports surface).
    const organizationId = assertConnectorOrgAllowed(dto.organizationId);

    const dryRun = dto.options?.dryRun === true;

    // Replay idempotente: o ledger durável devolve a MESMA resposta (dryRun não persiste).
    const prior = await this.ledger.findOne({ where: { organizationId, idempotencyKey } });
    if (prior && !dryRun) {
      if (prior.status === 'imported') {
        return { ...(prior.response as ZenrickIngestResponse), replay: true };
      }
      if (prior.status === 'duplicate') {
        // Comportamento idempotente: replay de um 409 devolve o mesmo 409.
        throw new ConflictException(
          'Este arquivo já foi importado nesta conta. Exclua a importação anterior antes de reimportar.',
        );
      }
      if (prior.attempts >= MAX_ATTEMPTS) {
        throw new UnprocessableEntityException(
          `Ingestão falhou ${prior.attempts}x para esta Idempotency-Key — reprocessamento suspenso (DLQ). Último erro: ${prior.lastError ?? 'desconhecido'}`,
        );
      }
    }

    const buffer = Buffer.from(dto.file.contentBase64, 'base64');
    if (!buffer.length) {
      throw new UnprocessableEntityException('Arquivo vazio após decodificação base64.');
    }
    if (dto.file.sha256) {
      const actual = createHash('sha256').update(buffer).digest('hex');
      if (actual !== dto.file.sha256.toLowerCase()) {
        throw new UnprocessableEntityException('sha256 divergente do conteúdo recebido.');
      }
    }

    const organization = await this.organizations.findOne({ where: { id: organizationId } });
    if (!organization) {
      throw new ForbiddenException('Organização inexistente.');
    }
    // user_id NOT NULL nas transações: ingestão S2S atribui ao owner da org (precedente qa-admin).
    const owner = await this.memberships.findOne({
      where: { organizationId, role: 'owner', status: 'active' },
      order: { createdAt: 'ASC' },
    });
    if (!owner) {
      throw new UnprocessableEntityException(
        'Organização sem owner ativo para atribuir transações.',
      );
    }

    const file = {
      originalname: dto.file.filename,
      buffer,
      size: buffer.length,
      mimetype: 'application/octet-stream',
    } as Express.Multer.File;

    try {
      const result = await this.statementImport.importCsvFromWeb({
        organizationId,
        plan: organization.plan,
        userId: owner.userId,
        accountId: dto.routing?.accountId,
        categoryId: dto.routing?.defaultCategoryId,
        incomeCategoryId: dto.routing?.incomeCategoryId,
        expenseCategoryId: dto.routing?.expenseCategoryId,
        file,
        dryRun,
        skipEntitlementIncrement: true,
        source: 'connector',
        provenance: {
          channel: dto.provenance.channel,
          extractor: dto.provenance.extractor,
          messageIdHash: dto.provenance.messageIdHash,
          receivedAt: dto.provenance.receivedAt,
          confidence: dto.provenance.confidence ?? null,
        },
      });

      const response: ZenrickIngestResponse = {
        schemaVersion: 1,
        replay: false,
        batchId: result.batchId,
        accountId: result.accountId,
        dryRun,
        created: result.created,
        skipped: result.skipped,
        alreadyExists: result.alreadyExists,
        uncategorized: result.uncategorized ?? 0,
        uncategorizedLines: result.uncategorizedLines ?? [],
        reconciliation: result.reconciliation,
        bankInfo: result.bankInfo,
        errors: result.errors,
      };

      if (!dryRun) {
        await this.recordLedger(organizationId, idempotencyKey, {
          status: 'imported',
          batchId: result.batchId ?? null,
          response,
        });
      }
      this.log('connector_ingest_ok', organizationId, idempotencyKey, {
        dryRun,
        batchId: result.batchId,
        created: result.created,
        skipped: result.skipped,
        alreadyExists: result.alreadyExists,
        uncategorized: response.uncategorized,
      });
      return response;
    } catch (e) {
      if (e instanceof ConflictException) {
        // 409 file_hash: o mesmo arquivo já vive num lote — para o cliente é sucesso idempotente.
        await this.recordLedger(organizationId, idempotencyKey, {
          status: 'duplicate',
          batchId: null,
          response: null,
        });
        this.log('connector_ingest_duplicate', organizationId, idempotencyKey, {});
        throw e;
      }
      const message = e instanceof Error ? e.message : String(e);
      if (!dryRun) {
        await this.recordLedger(organizationId, idempotencyKey, {
          status: 'failed',
          lastError: message.slice(0, 500),
        });
      }
      this.log('connector_ingest_error', organizationId, idempotencyKey, {
        error: message.slice(0, 240),
      });
      throw e;
    }
  }

  private async recordLedger(
    organizationId: string,
    idempotencyKey: string,
    patch: {
      status: 'imported' | 'duplicate' | 'failed';
      batchId?: string | null;
      response?: ZenrickIngestResponse | null;
      lastError?: string;
    },
  ): Promise<void> {
    try {
      const existing = await this.ledger.findOne({ where: { organizationId, idempotencyKey } });
      if (existing) {
        existing.status = patch.status;
        existing.attempts = patch.status === 'failed' ? existing.attempts + 1 : existing.attempts;
        existing.lastError =
          patch.lastError ?? (patch.status === 'failed' ? existing.lastError : null);
        if (patch.batchId !== undefined) existing.batchId = patch.batchId;
        if (patch.response !== undefined) {
          existing.response = patch.response as unknown as Record<string, unknown> | null;
        }
        await this.ledger.save(existing);
        return;
      }
      await this.ledger.save(
        this.ledger.create({
          organizationId,
          idempotencyKey,
          status: patch.status,
          attempts: 1,
          lastError: patch.lastError ?? null,
          batchId: patch.batchId ?? null,
          response: (patch.response ?? null) as Record<string, unknown> | null,
        }),
      );
    } catch (e) {
      // O ledger é trilha de idempotência/auditoria — falha nele não pode derrubar a ingestão.
      this.logger.error(
        JSON.stringify({
          event: 'connector_ledger_write_failed',
          organizationId,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  /** Log estruturado sem PII (nunca descrição de transação, remetente ou conteúdo). */
  private log(
    event: string,
    organizationId: string,
    idempotencyKey: string,
    extra: Record<string, unknown>,
  ): void {
    this.logger.log(JSON.stringify({ event, organizationId, idempotencyKey, ...extra }));
  }
}
