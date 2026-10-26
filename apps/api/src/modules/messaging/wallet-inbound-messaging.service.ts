import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionsService } from '../transactions/transactions.service';
import { AccountsService } from '../accounts/accounts.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { AiService } from '../ai/ai.service';
import { EntitlementsService } from '../plan-entitlements/entitlements.service';
import { PlanCapability } from '../plan-entitlements/plan-capabilities';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { StatementImportService } from '../statement-import/statement-import.service';
import { CategoryEntity } from '../../database/entities/category.entity';
import { AccountEntity } from '../../database/entities/account.entity';
import type { TransactionSource } from '../../database/entities/transaction.entity';
import { MessagingAiSettingsService } from './messaging-ai-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';

export type WalletMessagingChannel = 'whatsapp' | 'telegram';

/** Destino de resposta: telefone (WhatsApp) ou chat_id (Telegram). */
export type WalletMessagingReplyTo = string;

export interface WalletMessagingSink {
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, reason: string): Promise<void>;
  enqueueOutbound(to: WalletMessagingReplyTo, body: string): Promise<void>;
}

export interface StatementImportJobPayload {
  bufferBase64: string;
  fileName: string;
  caption?: string;
}

const UUID_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class WalletInboundMessagingService {
  private readonly logger = new Logger(WalletInboundMessagingService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly accountsService: AccountsService,
    private readonly dashboardService: DashboardService,
    private readonly aiService: AiService,
    private readonly entitlementsService: EntitlementsService,
    private readonly statementImportService: StatementImportService,
    private readonly messagingAiSettings: MessagingAiSettingsService,
    private readonly organizationsService: OrganizationsService,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
  ) {}

  async processStatementImport(params: {
    channel: WalletMessagingChannel;
    sink: WalletMessagingSink;
    eventId: string;
    replyTo: WalletMessagingReplyTo;
    userId: string;
    org: ActiveOrganizationContext;
    statementImport: StatementImportJobPayload;
  }): Promise<void> {
    const { sink, eventId, replyTo, userId, org, statementImport } = params;
    const caption = statementImport.caption ?? '';
    const ids = caption.split(/\s+/).filter((t) => UUID_TOKEN.test(t));
    if (ids.length < 2) {
      await sink.markFailed(eventId, 'Legenda incompleta');
      await sink.enqueueOutbound(
        replyTo,
        'Para importar CSV: anexe o ficheiro e na legenda envie: <uuid_da_conta> <uuid_da_categoria> (copie do painel).',
      );
      return;
    }

    try {
      const buf = Buffer.from(statementImport.bufferBase64, 'base64');
      const res = await this.statementImportService.importCsvFromWhatsapp({
        organizationId: org.id,
        plan: org.plan,
        userId,
        accountId: ids[0],
        categoryId: ids[1],
        buffer: buf,
        filename: statementImport.fileName,
      });
      await sink.markProcessed(eventId);
      const errTail = res.errors.length > 0 ? ` Avisos: ${res.errors.slice(0, 2).join('; ')}` : '';
      await sink.enqueueOutbound(
        replyTo,
        `Importação concluída: ${res.created} lançamentos criados, ${res.skipped} ignorados.${errTail}`,
      );
    } catch (error) {
      this.logger.error(`Erro ao importar extrato via ${params.channel}`, error as Error);
      await sink.markFailed(eventId, (error as Error).message);
      await sink.enqueueOutbound(
        replyTo,
        `Importação falhou: ${(error as Error).message}`.slice(0, 500),
      );
      throw error;
    }
  }

  async processTextCommand(params: {
    channel: WalletMessagingChannel;
    sink: WalletMessagingSink;
    eventId: string;
    replyTo: WalletMessagingReplyTo;
    text: string;
    userId: string;
    org: ActiveOrganizationContext;
  }): Promise<void> {
    const { channel, sink, eventId, replyTo, text, userId, org } = params;
    const trimmed = text.trim();
    if (!trimmed) {
      await sink.markFailed(eventId, 'Mensagem vazia');
      return;
    }

    const [command, ...rest] = trimmed.split(/\s+/);
    const normalizedCommand = command?.toLowerCase();

    try {
      switch (normalizedCommand) {
        case 'saldo':
          await this.handleSaldo(org.id, replyTo, sink);
          break;
        case 'receita':
        case 'despesa':
          await this.handleTransactionCommand(
            channel,
            normalizedCommand,
            rest,
            org.id,
            userId,
            replyTo,
            sink,
            eventId,
          );
          break;
        case 'listar':
          await this.handleList(org.id, rest, replyTo, sink);
          break;
        case 'cancelar':
          await this.handleCancel(org.id, userId, replyTo, sink);
          break;
        default:
          await this.handleUnknownCommand(channel, eventId, trimmed, replyTo, userId, org, sink);
      }
      await sink.markProcessed(eventId);
    } catch (error) {
      this.logger.error(`Erro ao processar comando ${channel}`, error as Error);
      await sink.markFailed(eventId, (error as Error).message);
      await sink.enqueueOutbound(
        replyTo,
        'Erro ao processar sua solicitação. Tente novamente mais tarde.',
      );
      throw error;
    }
  }

  private async handleSaldo(
    organizationId: string,
    replyTo: WalletMessagingReplyTo,
    sink: WalletMessagingSink,
  ) {
    const summary = await this.dashboardService.getSummary(
      'all',
      this.currentPeriod(),
      organizationId,
    );
    const body = `Saldo atual: R$ ${summary.balance.toFixed(2)}\nReceitas: R$ ${summary.totalIncome.toFixed(2)}\nDespesas: R$ ${summary.totalExpense.toFixed(2)}`;
    await sink.enqueueOutbound(replyTo, body);
  }

  private async handleUnknownCommand(
    channel: WalletMessagingChannel,
    eventId: string,
    text: string,
    replyTo: WalletMessagingReplyTo,
    userId: string,
    org: ActiveOrganizationContext,
    sink: WalletMessagingSink,
  ) {
    this.entitlementsService.assertCapability(org.plan, PlanCapability.messagingAiInsights);
    await this.entitlementsService.assertAiMessagingAssistantAllowed(org.id, org.plan);
    const membership = await this.organizationsService.getActiveMembership(org.id, userId);
    if (!membership) {
      await sink.enqueueOutbound(replyTo, 'Sem acesso a esta organização.');
      return;
    }
    this.entitlementsService.assertMessagingAiSeatForMembership(membership);

    const providerPreference = await this.messagingAiSettings.getPreferredProvider();
    const preferredProvider =
      providerPreference === 'openai' ||
      providerPreference === 'vertex' ||
      providerPreference === 'deepseek'
        ? providerPreference
        : undefined;

    const agentResult = await this.aiService.runAgent(
      {
        organizationId: org.id,
        userId,
        scope: userId,
        channel,
        whatsappEventId: channel === 'whatsapp' ? eventId : null,
        telegramEventId: channel === 'telegram' ? eventId : null,
      },
      text,
      {
        maxToolRounds: 5,
        preferredProvider,
      },
    );

    if (agentResult && agentResult.reply) {
      await this.entitlementsService.incrementAiMessagingAssistantCount(org.id);
      this.logger.debug('Resposta gerada via agente IA para comando desconhecido.');
      await sink.enqueueOutbound(replyTo, agentResult.reply);
      return;
    }

    await sink.enqueueOutbound(
      replyTo,
      'Comando não reconhecido. Use: saldo, receita, despesa, listar, cancelar.',
    );
  }

  private async handleTransactionCommand(
    channel: WalletMessagingChannel,
    command: 'receita' | 'despesa',
    args: string[],
    organizationId: string,
    userId: string,
    replyTo: WalletMessagingReplyTo,
    sink: WalletMessagingSink,
    eventId: string,
  ) {
    const amountRaw = args[0];
    const categoryName = args[1];
    const description = args.slice(2).join(' ');

    if (!amountRaw || !categoryName) {
      await sink.enqueueOutbound(
        replyTo,
        'Formato inválido. Use: receita 1000 categoria Descrição opcional.',
      );
      return;
    }

    const amount = Number(amountRaw.replace(',', '.'));
    if (Number.isNaN(amount)) {
      await sink.enqueueOutbound(replyTo, 'Valor inválido.');
      return;
    }

    const category = await this.categoriesRepository.findOne({
      where: { name: categoryName, isActive: true, organizationId },
    });
    if (!category) {
      await sink.enqueueOutbound(
        replyTo,
        `Categoria ${categoryName} não encontrada. Cadastre-a no painel antes de usar.`,
      );
      return;
    }

    if (command === 'receita' && category.type !== 'income') {
      await sink.enqueueOutbound(replyTo, 'Categoria não é de receita.');
      return;
    }
    if (command === 'despesa' && category.type !== 'expense') {
      await sink.enqueueOutbound(replyTo, 'Categoria não é de despesa.');
      return;
    }

    const account = await this.getDefaultAccount(organizationId, userId);
    const source: TransactionSource = channel === 'whatsapp' ? 'whatsapp' : 'telegram';

    await this.transactionsService.create(
      {
        accountId: account.id,
        categoryId: category.id,
        userId,
        occurredAt: new Date().toISOString(),
        amount,
        description,
        source,
        whatsappEventId: channel === 'whatsapp' ? eventId : undefined,
        telegramEventId: channel === 'telegram' ? eventId : undefined,
      },
      organizationId,
    );

    await sink.enqueueOutbound(
      replyTo,
      `${command === 'receita' ? 'Receita' : 'Despesa'} registrada com sucesso!`,
    );
  }

  private async handleList(
    organizationId: string,
    args: string[],
    replyTo: WalletMessagingReplyTo,
    sink: WalletMessagingSink,
  ) {
    const period = args[0] ?? this.currentPeriod();
    const summary = await this.dashboardService.getSummary('all', period, organizationId);
    const lines = summary.topCategories
      .map((item) => `${item.name}: R$ ${item.total.toFixed(2)}`)
      .join('\n');
    const body = `Resumo ${period}\nSaldo: R$ ${summary.balance.toFixed(2)}\n${lines}`;
    await sink.enqueueOutbound(replyTo, body);
  }

  private async handleCancel(
    organizationId: string,
    userId: string,
    replyTo: WalletMessagingReplyTo,
    sink: WalletMessagingSink,
  ) {
    const lastTransaction = await this.transactionsService
      .findAll({ organizationId, userId })
      .then((list) => list[0]);
    if (!lastTransaction) {
      await sink.enqueueOutbound(replyTo, 'Nenhuma transação encontrada.');
      return;
    }

    await this.transactionsService.remove(lastTransaction.id, userId);
    await sink.enqueueOutbound(replyTo, 'Última transação cancelada.');
  }

  private async getDefaultAccount(organizationId: string, userId: string) {
    const account = await this.accountsRepository.findOne({
      where: { name: 'Carteira', organizationId },
    });
    if (account) return account;
    return await this.accountsService.create(
      {
        name: 'Carteira',
        ownerUserIds: null,
      },
      userId,
      organizationId,
    );
  }

  private currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
