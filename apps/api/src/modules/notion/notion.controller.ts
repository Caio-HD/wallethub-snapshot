import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NOTION_WEBHOOK } from '../../queues';
import { NotionWebhookJob } from './notion.types.js';
import { NotionConfig, defaultNotionConfig } from '../../core/config/notion.config';
import { createHmac } from 'crypto';

// Public Meta/Notion webhook surface only. The operator-only status/sync actions moved to
// AdminIntegrationsController (super_admin + ElevatedAccessGuard).
@Controller('notion')
export class NotionController {
  private readonly logger = new Logger(NotionController.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NOTION_WEBHOOK)
    private readonly notionWebhookQueue: Queue<NotionWebhookJob>,
  ) {}

  @Get('webhook')
  verifyWebhook(@Query('challenge') challenge: string): string {
    // Notion webhook verification
    return challenge || '';
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-notion-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    const config = this.configService.get<NotionConfig>('notion') ?? defaultNotionConfig;

    // Validate webhook signature if secret is configured
    if (config.webhookSecret && signature) {
      const isValid = this.validateWebhookSignature(body, signature, config.webhookSecret);
      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    try {
      // Notion webhook format: { object: 'event', entry: [...] }
      const entries = (body.entry as Array<Record<string, unknown>>) ?? [];

      for (const entry of entries) {
        const pageId = entry.id as string | undefined;
        const parent = entry.parent as { database_id?: string } | undefined;
        const databaseId = parent?.database_id;
        const eventType = (entry.type as string) || 'updated';

        if (!pageId || !databaseId) {
          this.logger.warn('Missing pageId or databaseId in webhook entry');
          continue;
        }

        await this.notionWebhookQueue.add(
          `webhook-${eventType}`,
          {
            pageId,
            databaseId,
            eventType: eventType as 'created' | 'updated' | 'deleted',
          },
          {
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
          },
        );
      }

      return { received: true };
    } catch (error) {
      this.logger.error('Failed to process webhook:', error);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  private validateWebhookSignature(
    body: Record<string, unknown> | string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      const hash = createHmac('sha256', secret).update(bodyString).digest('hex');
      return hash === signature;
    } catch (error) {
      this.logger.error('Error validating webhook signature:', error);
      return false;
    }
  }
}
