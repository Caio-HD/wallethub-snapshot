import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';

import { envSchema } from './core/config/env.schema';
import { appConfig } from './core/config/app.config';
import { databaseConfig } from './core/config/database.config';
import { redisConfig } from './core/config/redis.config';
import { jwtConfig } from './core/config/jwt.config';
import { bullConfig } from './core/config/bullmq.config';
import { aiConfig } from './core/config/ai.config';
import { whatsappConfig } from './core/config/whatsapp.config';
import { storageConfig } from './core/config/storage.config';
import { notionConfig } from './core/config/notion.config';
import { ragConfig } from './core/config/rag.config';
import { mcpConfig } from './core/config/mcp.config';
import { investmentsConfig } from './core/config/investments.config';
import { notificationsConfig } from './core/config/notifications.config';
import { securityConfig } from './core/config/security.config';
import { telegramConfig } from './core/config/telegram.config';

import { SecurityModule } from './common/security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { BanksModule } from './modules/banks/banks.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ProjectionsModule } from './modules/projections/projections.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { HealthModule } from './modules/health/health.module';
import { RootModule } from './modules/root/root.module';
import { AiModule } from './modules/ai/ai.module';
import { BackupModule } from './modules/backup/backup.module';
import { StorageModule } from './modules/storage/storage.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { NotionModule } from './modules/notion/notion.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { AdminModule } from './modules/admin/admin.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RagModule } from './modules/rag/rag.module';
import { McpModule } from './modules/mcp/mcp.module';
import { EntitlementsModule } from './modules/plan-entitlements/entitlements.module';
import { WalletInboundMessagingModule } from './modules/messaging/wallet-inbound-messaging.module';
import { StatementImportModule } from './modules/statement-import/statement-import.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { DebtsModule } from './modules/debts/debts.module';
import { ZenrickModule } from './modules/integrations/zenrick/zenrick.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production' &&
          process.env.DOCKER !== 'true' &&
          process.stdout.isTTY === true
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  singleLine: true,
                },
              }
            : undefined,
        redact: ['req.headers.authorization', 'res.headers.authorization'],
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        bullConfig,
        aiConfig,
        whatsappConfig,
        storageConfig,
        notionConfig,
        ragConfig,
        mcpConfig,
        investmentsConfig,
        notificationsConfig,
        securityConfig,
        telegramConfig,
      ],
      validationSchema: envSchema,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          // Nome 'global' é referenciado pelos @Throttle({ global: ... }) (ex.: login). Sem o nome,
          // os overrides por-rota não aplicavam e o login ficava no limite default (100).
          name: 'global',
          ttl: 60000, // ms (throttler v6) — 60s. Antes 60 (= 60ms), janela inútil.
          limit: 100,
        },
      ],
      // Permite desabilitar o throttler em e2e (THROTTLER_DISABLED=true), avaliado por request — os
      // testes fazem muitos logins/requests do mesmo IP. Em prod a var não existe → throttler ativo.
      skipIf: () => process.env.THROTTLER_DISABLED === 'true',
    }),
    PrometheusModule.register(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const bull = configService.getOrThrow<ReturnType<typeof bullConfig>>('bull');
        const { connection } = bull;
        const connectionOptions = connection.url
          ? { url: connection.url }
          : {
              host: connection.host ?? '127.0.0.1',
              port: connection.port ?? 6379,
              password: connection.password,
              tls: connection.useTls ? {} : undefined,
            };

        return {
          connection: connectionOptions,
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow<TypeOrmModuleOptions>('database'),
    }),
    SecurityModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    AccountsModule,
    BanksModule,
    TransactionsModule,
    ProjectionsModule,
    DashboardModule,
    BudgetsModule,
    WhatsAppModule,
    RootModule,
    HealthModule,
    AiModule,
    BackupModule,
    StorageModule,
    AttachmentsModule,
    NotionModule,
    AdminModule,
    OrganizationsModule,
    RagModule,
    McpModule,
    EntitlementsModule,
    WalletInboundMessagingModule,
    StatementImportModule,
    TelegramModule,
    InvestmentsModule,
    AlertsModule,
    RemindersModule,
    DebtsModule,
    ZenrickModule,
    I18nModule.forRoot({
      fallbackLanguage: 'pt',
      fallbacks: {
        'pt-*': 'pt',
        'en-*': 'en',
        'es-*': 'es',
        'fr-*': 'fr',
        'de-*': 'de',
        'it-*': 'it',
        'zh-*': 'zh',
        'ja-*': 'ja',
        'ar-*': 'ar',
      },
      loaderOptions: {
        path: path.join(__dirname, './i18n/'),
        watch: process.env.NODE_ENV === 'development',
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
      typesOutputPath: path.join(__dirname, '../../src/generated/i18n.generated.ts'),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
