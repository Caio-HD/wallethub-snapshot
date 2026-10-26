import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import type { Repository } from 'typeorm';
import { TelegramEventEntity } from '@app/database/entities/telegram-event.entity';
import { QUEUE_TELEGRAM_INBOUND, QUEUE_TELEGRAM_OUTBOUND } from '@app/queues';
import { TelegramService } from '@app/modules/telegram/telegram.service';
import { UsersService } from '@app/modules/users/users.service';
import { OrganizationsService } from '@app/modules/organizations/organizations.service';
import { TelegramLinkService } from '@app/modules/telegram/telegram-link.service';
import { TelegramHttpSenderService } from '@app/modules/telegram/telegram-http-sender.service';
import { TelegramObservabilityService } from '@app/modules/telegram/telegram-observability.service';

describe('TelegramService', () => {
  let service: TelegramService;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
        {
          provide: getRepositoryToken(TelegramEventEntity),
          useValue: {} as Repository<TelegramEventEntity>,
        },
        { provide: getQueueToken(QUEUE_TELEGRAM_INBOUND), useValue: { add: jest.fn() } },
        { provide: getQueueToken(QUEUE_TELEGRAM_OUTBOUND), useValue: { add: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: OrganizationsService, useValue: {} },
        { provide: TelegramLinkService, useValue: {} },
        { provide: TelegramHttpSenderService, useValue: {} },
        { provide: TelegramObservabilityService, useValue: { recordInbound: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(TelegramService);
  });

  describe('assertPathToken', () => {
    it('rejeita token em falta', () => {
      configGet.mockReturnValue(undefined);
      expect(() => service.assertPathToken('x')).toThrow(UnauthorizedException);
    });

    it('rejeita token incorrecto', () => {
      configGet.mockReturnValue({ webhookPathToken: 'expected' });
      expect(() => service.assertPathToken('wrong')).toThrow(UnauthorizedException);
    });

    it('aceita token correcto', () => {
      configGet.mockReturnValue({ webhookPathToken: 'expected' });
      expect(() => service.assertPathToken('expected')).not.toThrow();
    });
  });

  describe('assertWebhookHeaders', () => {
    it('sem webhookSecret não valida cabeçalho', () => {
      configGet.mockReturnValue({ webhookSecret: undefined });
      expect(() => service.assertWebhookHeaders({})).not.toThrow();
    });

    it('com secret exige cabeçalho correcto', () => {
      configGet.mockReturnValue({ webhookSecret: 's3cr3t' });
      expect(() => service.assertWebhookHeaders({})).toThrow(UnauthorizedException);
      expect(() =>
        service.assertWebhookHeaders({ 'x-telegram-bot-api-secret-token': 'wrong' }),
      ).toThrow(UnauthorizedException);
      expect(() =>
        service.assertWebhookHeaders({ 'x-telegram-bot-api-secret-token': 's3cr3t' }),
      ).not.toThrow();
    });
  });
});
