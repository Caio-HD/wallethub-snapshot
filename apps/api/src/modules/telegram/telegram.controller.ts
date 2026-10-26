import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'http';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { ConfigService } from '@nestjs/config';
import type { TelegramConfig } from '../../core/config/telegram.config';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly linkService: TelegramLinkService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook/:pathToken')
  @HttpCode(200)
  async webhook(
    @Param('pathToken') pathToken: string,
    @Headers() headers: IncomingHttpHeaders,
    @Body() body: Record<string, unknown>,
  ) {
    this.telegramService.assertPathToken(pathToken);
    this.telegramService.assertWebhookHeaders(headers);
    await this.telegramService.handleUpdate(body);
    return { ok: true };
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  health() {
    return this.telegramService.getHealth();
  }

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  config() {
    return this.telegramService.getPublicConfig();
  }

  @Post('link-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async createLinkCode(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user?.id) {
      throw new BadRequestException('Sessão inválida.');
    }
    const { nonce, expiresAt } = await this.linkService.createLinkNonce(user.id);
    const cfg = this.configService.get<TelegramConfig>('telegram');
    const username = cfg?.botUsername?.replace(/^@/, '');
    if (!username) {
      throw new BadRequestException(
        'Configure TELEGRAM_BOT_USERNAME na API para gerar o link de emparelhamento.',
      );
    }
    return {
      nonce,
      expiresAt,
      deepLink: `https://t.me/${username}?start=${nonce}`,
    };
  }
}
