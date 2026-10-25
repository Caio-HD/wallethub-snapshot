import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectorIngestEventEntity } from '../../../database/entities/connector-ingest-event.entity.js';
import { OrganizationEntity } from '../../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../../database/entities/organization-membership.entity.js';
import { CategoriesModule } from '../../categories/categories.module';
import { DashboardModule } from '../../dashboard/dashboard.module';
import { StatementImportModule } from '../../statement-import/statement-import.module';
import { ConnectorTokenGuard } from './connector-token.guard.js';
import { ZenrickIngestController } from './zenrick-ingest.controller.js';
import { ZenrickIngestService } from './zenrick-ingest.service.js';
import { ZenrickReportsController } from './zenrick-reports.controller.js';

/**
 * Módulo de integração do ecossistema Zenrick (Kyron) — ADR adr-zenrick-connector.
 * Fase 1: ingestão de extratos. Fase 3: relatórios S2S read-only (Kyron narra).
 * Deployável dormante — sem WALLETHUB_CONNECTOR_TOKEN, a superfície responde 401.
 * Fases futuras: categorize assistida (F4), MCP server (F6).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConnectorIngestEventEntity,
      OrganizationEntity,
      OrganizationMembershipEntity,
    ]),
    StatementImportModule,
    DashboardModule,
    CategoriesModule,
  ],
  controllers: [ZenrickIngestController, ZenrickReportsController],
  providers: [ZenrickIngestService, ConnectorTokenGuard],
})
export class ZenrickModule {}
