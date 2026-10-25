import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { UserEntity } from '../../database/entities/user.entity.js';
import { RagDocumentEntity } from '../../database/entities/rag-document.entity';
import { RagChunkEntity } from '../../database/entities/rag-chunk.entity';
import { AiConversationSessionEntity } from '../../database/entities/ai-conversation-session.entity';
import { AiAgentTraceEntity } from '../../database/entities/ai-agent-trace.entity';
import { AiTraceObservationEntity } from '../../database/entities/ai-trace-observation.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { PlatformAuditLogEntity } from '../../database/entities/platform-audit-log.entity.js';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminPlatformController } from './admin-platform.controller';
import { AdminPlatformService } from './admin-platform.service';
import { PlatformAuditService } from './platform-audit.service';
import { AdminRagController } from './admin-rag.controller';
import { AdminRagService } from './admin-rag.service';
import { AdminAiController } from './admin-ai.controller';
import { AdminAiService } from './admin-ai.service';
import { AdminIntegrationsController } from './admin-integrations.controller';
import { QaAdminController } from './qa-admin.controller.js';
import { QaAdminService } from './qa-admin.service.js';
import { RagModule } from '../rag/rag.module';
import { NotionModule } from '../notion/notion.module';
import { HealthModule } from '../health/health.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import { EvolutionOtpAdminService } from './evolution-otp-admin.service';
import { AUDIT_PERSIST_FAILURES_METRIC } from './platform-audit.service';
import {
  LegacyAdminUsersInterceptor,
  LEGACY_USERS_ROUTE_HITS_METRIC,
} from './legacy-admin-users.interceptor';

@Module({
  imports: [
    RagModule,
    NotionModule,
    HealthModule,
    WhatsAppModule,
    AuthModule,
    TypeOrmModule.forFeature([
      UserEntity,
      RagDocumentEntity,
      RagChunkEntity,
      AiConversationSessionEntity,
      AiAgentTraceEntity,
      AiTraceObservationEntity,
      OrganizationEntity,
      OrganizationMembershipEntity,
      AccountEntity,
      CategoryEntity,
      TransactionEntity,
      PlatformAuditLogEntity,
    ]),
  ],
  controllers: [
    AdminUsersController,
    AdminPlatformController,
    AdminRagController,
    AdminAiController,
    AdminIntegrationsController,
    QaAdminController,
  ],
  providers: [
    makeCounterProvider({
      name: AUDIT_PERSIST_FAILURES_METRIC,
      help: 'Falhas ao persistir a linha do platform_audit_log (linha advisory perdida)',
      labelNames: ['action', 'entity_type'],
    }),
    makeCounterProvider({
      name: LEGACY_USERS_ROUTE_HITS_METRIC,
      help: 'Hits nas rotas legadas /admin/users (depreciadas → /admin/platform/users)',
      labelNames: ['method'],
    }),
    LegacyAdminUsersInterceptor,
    AdminUsersService,
    AdminPlatformService,
    PlatformAuditService,
    AdminRagService,
    AdminAiService,
    QaAdminService,
    EvolutionOtpAdminService,
  ],
})
export class AdminModule {}
