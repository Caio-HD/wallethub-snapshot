import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { AccountsService } from '../accounts/accounts.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { WhatsAppService } from './whatsapp.service';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { QUEUE_WHATSAPP_INBOUND, QUEUE_WHATSAPP_OUTBOUND } from '../../queues';
import { AiService } from '../ai/ai.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';

interface InboundJobPayload {
  eventId: string;
  message: {
    id: string;
    from: string;
    text?: { body?: string };
    timestamp?: string;
  };
}

@Injectable()
@Processor(QUEUE_WHATSAPP_INBOUND)
export class WhatsAppWorkerService extends WorkerHost {
  private readonly logger = new Logger(WhatsAppWorkerService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
    private readonly dashboardService: DashboardService,
    private readonly whatsappService: WhatsAppService,
    private readonly aiService: AiService,
    private readonly organizationsService: OrganizationsService,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    @InjectQueue(QUEUE_WHATSAPP_OUTBOUND)
    private readonly outboundQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<InboundJobPayload>) {
    const { eventId, message } = job.data;
    const text = message.text?.body?.trim();
    if (!text) {
      await this.whatsappService.markFailed(eventId, 'Mensagem vazia');
      return;
    }

    const user = await this.usersService.findByPhoneNumber(message.from);
    if (!user) {
      await this.whatsappService.markFailed(eventId, 'Número não autorizado');
      await this.whatsappService.enqueueOutbound(message.from, 'Número não autorizado.');
      return;
    }

    let org: ActiveOrganizationContext;
    try {
      org = await this.organizationsService.resolveOrganizationForLegacyChannel(user.id);
    } catch {
      await this.whatsappService.markFailed(eventId, 'Sem organização');
      await this.whatsappService.enqueueOutbound(
        message.from,
        'Sem organização associada à sua conta.',
      );
      return;
    }

    const [command, ...rest] = text.split(/\s+/);
    const normalizedCommand = command?.toLowerCase();

    try {
      switch (normalizedCommand) {
        case 'saldo':
          await this.handleSaldo(user.id, message.from, org.id);
          break;
        case 'receita':
        case 'despesa':
          await this.handleTransactionCommand(
            normalizedCommand,
            rest,
            user.id,
            message.from,
            eventId,
            org.id,
          );
          break;
        case 'listar':
          await this.handleList(rest, user.id, message.from, org.id);
          break;
        case 'cancelar':
          await this.handleCancel(user.id, message.from, org.id);
          break;
        default:
          await this.handleUnknownCommand(eventId, text, message.from, user.id, org.id);
      }
      await this.whatsappService.markProcessed(eventId);
    } catch (error) {
      this.logger.error('Erro ao processar comando WhatsApp', error as Error);
      await this.whatsappService.markFailed(eventId, (error as Error).message);
      await this.whatsappService.enqueueOutbound(
        message.from,
        'Erro ao processar sua solicitação. Tente novamente mais tarde.',
      );
      throw error;
    }
  }

  private async handleSaldo(userId: string, to: string, organizationId: string) {
    const summary = await this.dashboardService.getSummary(
      'all',
      this.currentPeriod(),
      organizationId,
    );
    const body = `Saldo atual: R$ ${summary.balance.toFixed(2)}\nReceitas: R$ ${summary.totalIncome.toFixed(2)}\nDespesas: R$ ${summary.totalExpense.toFixed(2)}`;
    await this.whatsappService.enqueueOutbound(to, body);
  }

  private async handleUnknownCommand(
    eventId: string,
    text: string,
    to: string,
    userId: string,
    organizationId: string,
  ) {
    const providerPreference = await this.whatsappService.getWhatsappAiProvider();
    const preferredProvider =
      providerPreference === 'openai' ||
      providerPreference === 'vertex' ||
      providerPreference === 'deepseek'
        ? providerPreference
        : undefined;
    const agentResult = await this.aiService.runAgent(
      {
        userId,
        scope: userId,
        organizationId,
        channel: 'whatsapp',
        whatsappEventId: eventId,
      },
      text,
      {
        maxToolRounds: 5,
        preferredProvider,
      },
    );

    if (agentResult && agentResult.reply) {
      this.logger.debug('Resposta gerada via agente IA para comando desconhecido.');
      await this.whatsappService.enqueueOutbound(to, agentResult.reply);
      return;
    }

    await this.whatsappService.enqueueOutbound(
      to,
      'Comando não reconhecido. Use: saldo, receita, despesa, listar, cancelar.',
    );
  }

  private async handleTransactionCommand(
    command: 'receita' | 'despesa',
    args: string[],
    userId: string,
    to: string,
    eventId: string,
    organizationId: string,
  ) {
    const amountRaw = args[0];
    const categoryName = args[1];
    const description = args.slice(2).join(' ');

    if (!amountRaw || !categoryName) {
      await this.whatsappService.enqueueOutbound(
        to,
        'Formato inválido. Use: receita 1000 categoria Descrição opcional.',
      );
      return;
    }

    const amount = Number(amountRaw.replace(',', '.'));
    if (Number.isNaN(amount)) {
      await this.whatsappService.enqueueOutbound(to, 'Valor inválido.');
      return;
    }

    const category = await this.categoriesRepository.findOne({
      where: { name: categoryName, isActive: true, organizationId },
    });
    if (!category) {
      await this.whatsappService.enqueueOutbound(
        to,
        `Categoria ${categoryName} não encontrada. Cadastre-a no painel antes de usar.`,
      );
      return;
    }

    if (command === 'receita' && category.type !== 'income') {
      await this.whatsappService.enqueueOutbound(to, 'Categoria não é de receita.');
      return;
    }
    if (command === 'despesa' && category.type !== 'expense') {
      await this.whatsappService.enqueueOutbound(to, 'Categoria não é de despesa.');
      return;
    }

    const account = await this.getDefaultAccount(organizationId, userId);

    await this.transactionsService.create(
      {
        accountId: account.id,
        categoryId: category.id,
        userId,
        occurredAt: new Date().toISOString(),
        amount,
        description,
        source: 'whatsapp',
        whatsappEventId: eventId,
      },
      organizationId,
    );

    await this.whatsappService.enqueueOutbound(
      to,
      `${command === 'receita' ? 'Receita' : 'Despesa'} registrada com sucesso!`,
    );
  }

  private async handleList(args: string[], userId: string, to: string, organizationId: string) {
    const period = args[0] ?? this.currentPeriod();
    const summary = await this.dashboardService.getSummary('all', period, organizationId);
    const lines = summary.topCategories
      .map((item) => `${item.name}: R$ ${item.total.toFixed(2)}`)
      .join('\n');
    const body = `Resumo ${period}\nSaldo: R$ ${summary.balance.toFixed(2)}\n${lines}`;
    await this.whatsappService.enqueueOutbound(to, body);
  }

  private async handleCancel(userId: string, to: string, organizationId: string) {
    const lastTransaction = await this.transactionsService
      .findAll({ userId, organizationId })
      .then((list) => list[0]);
    if (!lastTransaction) {
      await this.whatsappService.enqueueOutbound(to, 'Nenhuma transação encontrada.');
      return;
    }

    await this.transactionsService.remove(lastTransaction.id, userId);
    await this.whatsappService.enqueueOutbound(to, 'Última transação cancelada.');
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
        balance: 0,
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
