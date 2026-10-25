import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { StatementImportService } from './statement-import.service';
import { StatementImportAuditService } from './statement-import-audit.service';
import { StatementCategoryMappingService } from './statement-category-mapping.service';
import { EnsureAccountDto } from './dto/ensure-account.dto';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

function parseCategoryOverrides(raw: string | undefined): Record<string, string> | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== 'object' || o === null || Array.isArray(o)) {
      throw new BadRequestException('categoryOverrides inválido.');
    }
    return o as Record<string, string>;
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException('categoryOverrides JSON inválido.');
  }
}

function parseSkipKeys(raw: string | undefined): Set<string> | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  try {
    const o = JSON.parse(raw) as unknown;
    if (!Array.isArray(o) || !o.every((x) => typeof x === 'string')) {
      throw new BadRequestException('skipKeys inválido — esperado array de strings.');
    }
    return new Set(o);
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException('skipKeys JSON inválido.');
  }
}

function parseRouting(raw: string | undefined): Record<string, string> {
  if (raw == null || raw === '') {
    throw new BadRequestException('routing inválido.');
  }
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== 'object' || o === null || Array.isArray(o)) {
      throw new BadRequestException('routing inválido — esperado objeto filename→accountId.');
    }
    for (const [k, v] of Object.entries(o as Record<string, string>)) {
      if (typeof v !== 'string' || !isUuid(v)) {
        throw new BadRequestException(`routing contém accountId inválido para ${k}.`);
      }
    }
    return o as Record<string, string>;
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException('routing JSON inválido.');
  }
}

/** Aceita `routing` como objeto (corpo JSON) ou string JSON (legado). */
function coerceRouting(raw: unknown): Record<string, string> {
  if (typeof raw === 'string') {
    return parseRouting(raw);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new BadRequestException('routing inválido — esperado objeto filename→accountId.');
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'string' || !isUuid(v)) {
      throw new BadRequestException(`routing contém accountId inválido para ${k}.`);
    }
  }
  return raw as Record<string, string>;
}

@Controller('imports')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveOrganizationGuard)
@Roles('admin')
export class StatementImportController {
  constructor(
    private readonly statementImport: StatementImportService,
    private readonly audit: StatementImportAuditService,
    private readonly categoryMappings: StatementCategoryMappingService,
  ) {}

  // ───────────────────────── Auditoria de importações (lotes) ─────────────────────────

  @Get('statement/batches')
  listBatches(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Query('accountId') accountId?: string,
  ) {
    if (accountId && !isUuid(accountId)) {
      throw new BadRequestException('accountId inválido.');
    }
    return this.audit.listBatches(org.id, accountId || undefined);
  }

  @Get('statement/batches/:id')
  getBatch(@ActiveOrganization() org: ActiveOrganizationContext, @Param('id') id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('id inválido.');
    }
    return this.audit.getBatch(org.id, id);
  }

  @Delete('statement/batches/:id')
  deleteBatch(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ) {
    if (!user?.id) {
      throw new BadRequestException('Utilizador não autenticado.');
    }
    if (!isUuid(id)) {
      throw new BadRequestException('id inválido.');
    }
    return this.audit.deleteBatch(org.id, id, user.id, false);
  }

  /**
   * Auto-cadastro de conta a partir da identidade bancária do OFX. Porta exclusiva e
   * idempotente do auto-provision do import (find-or-create-or-reactivate, seguro sob
   * concorrência) — o `POST /accounts` público mantém o 409 estrito.
   */
  @Post('statement/ensure-account')
  ensureAccount(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: EnsureAccountDto,
  ) {
    if (!user?.id) {
      throw new BadRequestException('Utilizador não autenticado.');
    }
    return this.statementImport.ensureAccountFromOfx({
      organizationId: org.id,
      plan: org.plan,
      userId: user.id,
      name: dto.name,
      bankId: dto.bankId,
      branchNumber: dto.branchNumber,
      accountNumber: dto.accountNumber,
    });
  }

  // ───────────────────────── Mapeamento descrição→categoria ─────────────────────────

  @Get('statement/category-mappings')
  listCategoryMappings(@ActiveOrganization() org: ActiveOrganizationContext) {
    return this.categoryMappings.list(org.id);
  }

  @Post('statement/category-mappings')
  upsertCategoryMapping(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body('description') description: string,
    @Body('categoryId') categoryId: string,
  ) {
    if (!description || typeof description !== 'string') {
      throw new BadRequestException('description obrigatória.');
    }
    if (!categoryId || !isUuid(categoryId)) {
      throw new BadRequestException('categoryId inválido.');
    }
    return this.categoryMappings.upsert(org.id, description, categoryId);
  }

  @Delete('statement/category-mappings/:id')
  deleteCategoryMapping(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Param('id') id: string,
  ) {
    if (!isUuid(id)) {
      throw new BadRequestException('id inválido.');
    }
    return this.categoryMappings.remove(org.id, id);
  }

  /** @deprecated Prefer `POST /imports/statement/preview` */
  @Post('statement')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async previewStatementLegacy(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('accountId') accountId: string,
    @Body('defaultCategoryId') defaultCategoryId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Ficheiro em falta ou vazio.');
    }
    if (accountId && !isUuid(accountId)) {
      throw new BadRequestException('accountId inválido.');
    }
    const cat = defaultCategoryId && isUuid(defaultCategoryId) ? defaultCategoryId : undefined;
    return this.statementImport.previewWebImport(
      org.id,
      org.plan,
      file,
      accountId || undefined,
      cat,
    );
  }

  @Post('statement/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async previewStatement(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('accountId') accountId: string,
    @Body('defaultCategoryId') defaultCategoryId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Ficheiro em falta ou vazio.');
    }
    if (accountId && !isUuid(accountId)) {
      throw new BadRequestException('accountId inválido.');
    }
    const cat = defaultCategoryId && isUuid(defaultCategoryId) ? defaultCategoryId : undefined;
    return this.statementImport.previewWebImport(
      org.id,
      org.plan,
      file,
      accountId || undefined,
      cat,
    );
  }

  @Post('statement/commit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  commitStatement(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body('accountId') accountId: string,
    @Body('categoryId') categoryId: string,
    @Body('incomeCategoryId') incomeCategoryId: string | undefined,
    @Body('expenseCategoryId') expenseCategoryId: string | undefined,
    @Body('dryRun') dryRunRaw: string | undefined,
    @Body('categoryOverrides') categoryOverridesRaw: string | undefined,
    @Body('skipKeys') skipKeysRaw: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!user?.id) {
      throw new BadRequestException('Utilizador não autenticado.');
    }
    if (accountId && !isUuid(accountId)) {
      throw new BadRequestException('accountId inválido.');
    }
    if (!categoryId || !isUuid(categoryId)) {
      throw new BadRequestException('categoryId inválido.');
    }
    if (incomeCategoryId && !isUuid(incomeCategoryId)) {
      throw new BadRequestException('incomeCategoryId inválido.');
    }
    if (expenseCategoryId && !isUuid(expenseCategoryId)) {
      throw new BadRequestException('expenseCategoryId inválido.');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Ficheiro em falta ou vazio.');
    }
    const dryRun = dryRunRaw === 'true' || dryRunRaw === '1';
    const categoryOverrides = parseCategoryOverrides(categoryOverridesRaw);
    const skipKeys = parseSkipKeys(skipKeysRaw);
    if (categoryOverrides) {
      for (const v of Object.values(categoryOverrides)) {
        if (!isUuid(v)) {
          throw new BadRequestException('categoryOverrides contém UUID inválido.');
        }
      }
    }
    return this.statementImport.importCsvFromWeb({
      organizationId: org.id,
      plan: org.plan,
      userId: user.id,
      accountId: accountId || undefined,
      categoryId,
      incomeCategoryId: incomeCategoryId || undefined,
      expenseCategoryId: expenseCategoryId || undefined,
      file,
      dryRun,
      categoryOverrides,
      skipKeys,
    });
  }

  @Post('statement/preview-batch')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 20 * 1024 * 1024 } }))
  previewBatch(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body('categoryId') categoryId?: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException('Ficheiros em falta.');
    }
    const cat = categoryId && isUuid(categoryId) ? categoryId : undefined;
    return this.statementImport.previewBatch(org.id, org.plan, files, cat);
  }

  // Re-preview por mudança de roteamento: NÃO reenvia os ficheiros (usa o token
  // do preview-batch). Corpo JSON — sem upload, evita o double-upload que
  // causava 400 "Ficheiros em falta".
  @Post('statement/repreview-batch')
  repreviewBatch(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body('token') token: string,
    @Body('routing') routingRaw: unknown,
    @Body('categoryId') categoryId?: string,
  ) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('token de pré-visualização em falta.');
    }
    const routing = coerceRouting(routingRaw);
    const cat = categoryId && isUuid(categoryId) ? categoryId : undefined;
    return this.statementImport.repreviewBatchByToken({
      organizationId: org.id,
      plan: org.plan,
      token,
      routing,
      categoryId: cat,
    });
  }

  @Post('statement/commit-batch')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 20 * 1024 * 1024 } }))
  commitBatch(
    @ActiveOrganization() org: ActiveOrganizationContext,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body('routing') routingRaw: string,
    @Body('categoryId') categoryId: string,
    @Body('incomeCategoryId') incomeCategoryId: string | undefined,
    @Body('expenseCategoryId') expenseCategoryId: string | undefined,
    @Body('skipKeys') skipKeysRaw: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    if (!user?.id) {
      throw new BadRequestException('Utilizador não autenticado.');
    }
    if (!categoryId || !isUuid(categoryId)) {
      throw new BadRequestException('categoryId inválido.');
    }
    if (incomeCategoryId && !isUuid(incomeCategoryId)) {
      throw new BadRequestException('incomeCategoryId inválido.');
    }
    if (expenseCategoryId && !isUuid(expenseCategoryId)) {
      throw new BadRequestException('expenseCategoryId inválido.');
    }
    if (!files?.length) {
      throw new BadRequestException('Ficheiros em falta.');
    }
    const routing = parseRouting(routingRaw);
    const skipKeys = parseSkipKeys(skipKeysRaw);
    return this.statementImport.commitBatch({
      organizationId: org.id,
      plan: org.plan,
      userId: user.id,
      files,
      routing,
      categoryId,
      incomeCategoryId: incomeCategoryId || undefined,
      expenseCategoryId: expenseCategoryId || undefined,
      skipKeys,
      idempotencyKey,
    });
  }
}
