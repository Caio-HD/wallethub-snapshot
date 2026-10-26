import {
  Body,
  Controller,
  Get,
  GoneException,
  Headers,
  HttpCode,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'http';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { WhatsAppConfig } from '../../core/config/whatsapp.config';

// Public Evolution webhook + operator-only server config. The status/config/AI-provider routes
// expose global server state, so they are restricted to the platform operator (`super_admin`),
// mirroring TelegramController. Previously `@Roles('admin')` — which, since every user defaults to
// global role 'admin', meant any authenticated user. The WhatsApp page degrades gracefully on 403.
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly configService: ConfigService,
  ) {}

  /** Webhook chamado pela Evolution API ao receber mensagens. */
  @Post('webhook')
  @HttpCode(200)
  async evolutionWebhook(
    @Headers() headers: IncomingHttpHeaders,
    @Body() payload: Record<string, unknown>,
  ) {
    const cfg = this.configService.get<WhatsAppConfig>('whatsapp');
    const expectedKey = cfg?.evolutionApiKey;
    if (expectedKey) {
      const receivedKey = headers['apikey'] as string | undefined;
      if (!receivedKey || receivedKey !== expectedKey) {
        throw new UnauthorizedException('Invalid webhook token.');
      }
    }
    await this.whatsappService.handleEvolutionWebhook(payload);
    return { ok: true };
  }

  @Get('webhook')
  webhookGet() {
    throw new GoneException('GET não suportado neste endpoint.');
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  health() {
    return this.whatsappService.getHealth();
  }

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  config() {
    return this.whatsappService.getPublicConfig();
  }

  @Get('settings/ai-provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async getAiProvider() {
    const provider = await this.whatsappService.getWhatsappAiProvider();
    return { provider };
  }

  @Put('settings/ai-provider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async setAiProvider(@Body('provider') provider: string) {
    await this.whatsappService.setWhatsappAiProvider(provider);
    return { success: true };
  }
}
