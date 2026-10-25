import { Controller, Post, Get, Body, UseGuards, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserAiContextEntity } from '../../database/entities/user_ai_context.entity';
import { AgentMessage } from './ai.types';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    @InjectRepository(UserAiContextEntity)
    private readonly aiContextRepository: Repository<UserAiContextEntity>,
  ) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard, ActiveOrganizationGuard)
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @ActiveOrganization() org: ActiveOrganizationContext,
    @Body('message') message: string,
    @Body('provider') provider?: 'openai' | 'vertex' | 'deepseek' | 'openrouter',
  ) {
    // 1. Carregar histórico recente
    const historyEntities = await this.aiContextRepository.find({
      where: { userId: user.id },
      order: { createdAt: 'ASC' },
      take: 20, // Últimas 20 mensagens
    });

    const history: AgentMessage[] = historyEntities.map((h) => ({
      role: h.role,
      content: h.content,
      toolCallId: h.toolCallId || undefined,
      name: h.name || undefined,
    }));

    // 2. Salvar mensagem do usuário
    await this.aiContextRepository.save(
      this.aiContextRepository.create({
        userId: user.id,
        role: 'user',
        content: message,
      }),
    );

    // 3. Executar agente
    const result = await this.aiService.runAgent(
      { userId: user.id, scope: user.id, channel: 'web', organizationId: org.id },
      message,
      {
        history,
        preferredProvider: provider,
      },
    );

    if (result && result.reply) {
      // 4. Salvar resposta da IA
      await this.aiContextRepository.save(
        this.aiContextRepository.create({
          userId: user.id,
          role: 'assistant',
          content: result.reply,
          metadata: { ...result.usage, toolsUsed: result.toolsUsed },
        }),
      );
    }

    return result;
  }

  @Get('providers')
  getProviders() {
    return this.aiService.getConfiguredProviders();
  }

  @Get('history')
  async getHistory(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit = 50) {
    return this.aiContextRepository.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
