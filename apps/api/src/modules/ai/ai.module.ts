import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { OpenAiProvider } from './providers/openai.provider';
import { VertexProvider } from './providers/vertex.provider';
import { DeepseekProvider } from './providers/deepseek.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { AiToolsExecutor } from './tools/ai-tools.executor';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ProjectionsModule } from '../projections/projections.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CategoriesModule } from '../categories/categories.module';
import { AccountsModule } from '../accounts/accounts.module';
import { InvestmentsModule } from '../investments/investments.module';
import { UserAiContextEntity } from '../../database/entities/user_ai_context.entity';
import { AiConversationSessionEntity } from '../../database/entities/ai-conversation-session.entity';
import { AiAgentTraceEntity } from '../../database/entities/ai-agent-trace.entity';
import { AiTraceObservationEntity } from '../../database/entities/ai-trace-observation.entity';
import { AiController } from './ai.controller';
import { RagModule } from '../rag/rag.module';
import { McpModule } from '../mcp/mcp.module';
import { AgentToolCatalogService } from './agent-tool-catalog.service';
import { AiTracingService } from './tracing/ai-tracing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserAiContextEntity,
      AiConversationSessionEntity,
      AiAgentTraceEntity,
      AiTraceObservationEntity,
    ]),
    ConfigModule,
    RagModule,
    McpModule,
    DashboardModule,
    ProjectionsModule,
    BudgetsModule,
    TransactionsModule,
    CategoriesModule,
    AccountsModule,
    InvestmentsModule,
  ],
  providers: [
    AiService,
    OpenAiProvider,
    VertexProvider,
    DeepseekProvider,
    OpenRouterProvider,
    AiToolsExecutor,
    AgentToolCatalogService,
    AiTracingService,
  ],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
