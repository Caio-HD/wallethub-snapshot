import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type { OrganizationPlan } from '../../database/entities/organization.entity.js';
import { WhatsAppSessionEntity } from '../../database/entities/whatsapp-session.entity.js';
import { EntitlementsService } from '../plan-entitlements/entitlements.service.js';
import { PlanCapability } from '../plan-entitlements/plan-capabilities.js';
import { EvolutionApiService } from './evolution-api.service.js';
import { evolutionInstanceNameForOrganization } from './whatsapp-instance.util.js';
import { WhatsAppRedisLockService } from './whatsapp-redis-lock.service.js';

@Injectable()
export class WhatsAppSessionService {
  constructor(
    @InjectRepository(WhatsAppSessionEntity)
    private readonly sessionsRepository: Repository<WhatsAppSessionEntity>,
    private readonly evolutionApi: EvolutionApiService,
    private readonly entitlements: EntitlementsService,
    private readonly redisLock: WhatsAppRedisLockService,
  ) {}

  private assertPlanAllowsInstance(plan: OrganizationPlan): void {
    this.entitlements.assertCapability(plan, PlanCapability.whatsappEvolutionInstance);
  }

  async findByOrganizationId(organizationId: string): Promise<WhatsAppSessionEntity | null> {
    return this.sessionsRepository.findOne({ where: { organizationId } });
  }

  async findByEvolutionInstanceName(instanceName: string): Promise<WhatsAppSessionEntity | null> {
    return this.sessionsRepository.findOne({ where: { evolutionInstanceName: instanceName } });
  }

  async getOrCreateSessionRow(organizationId: string): Promise<WhatsAppSessionEntity> {
    let session = await this.findByOrganizationId(organizationId);
    if (!session) {
      const instanceName = evolutionInstanceNameForOrganization(organizationId);
      session = this.sessionsRepository.create({
        organizationId,
        sessionName: instanceName,
        evolutionInstanceName: instanceName,
        webhookSecret: randomUUID(),
        status: 'unknown',
      });
      session = await this.sessionsRepository.save(session);
    }
    return session;
  }

  private lockKey(organizationId: string): string {
    return `org:${organizationId}:whatsapp:mutation`;
  }

  async createInstance(
    organizationId: string,
    plan: OrganizationPlan,
  ): Promise<WhatsAppSessionEntity> {
    this.assertPlanAllowsInstance(plan);
    try {
      return await this.redisLock.withLock(this.lockKey(organizationId), 120, async () => {
        let session = await this.findByOrganizationId(organizationId);
        const instanceName = evolutionInstanceNameForOrganization(organizationId);
        if (!session) {
          session = this.sessionsRepository.create({
            organizationId,
            sessionName: instanceName,
            evolutionInstanceName: instanceName,
            webhookSecret: randomUUID(),
            status: 'unknown',
          });
        } else if (!session.evolutionInstanceName) {
          session.evolutionInstanceName = instanceName;
          session.sessionName = instanceName;
          session.webhookSecret = session.webhookSecret ?? randomUUID();
        }
        const secret = session.webhookSecret!;
        try {
          await this.evolutionApi.createInstance(instanceName, secret);
        } catch {
          await this.evolutionApi.setWebhook(instanceName, secret);
        }
        session.status = 'qr';
        session.lastSyncAt = new Date();
        return this.sessionsRepository.save(session);
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'LOCK_NOT_ACQUIRED') {
        throw new ConflictException(
          'Outra operação WhatsApp está em curso. Aguarde e tente novamente.',
        );
      }
      throw error;
    }
  }

  async connectInstance(
    organizationId: string,
    plan: OrganizationPlan,
  ): Promise<WhatsAppSessionEntity> {
    this.assertPlanAllowsInstance(plan);
    const session = await this.findByOrganizationId(organizationId);
    if (!session?.evolutionInstanceName) {
      throw new NotFoundException('Instância WhatsApp não criada para esta organização.');
    }
    try {
      return await this.redisLock.withLock(this.lockKey(organizationId), 120, async () => {
        const connectData = await this.evolutionApi.connectInstance(session.evolutionInstanceName!);
        const raw = connectData;
        const qrcode = raw.qrcode as Record<string, unknown> | undefined;
        const qr = (qrcode?.base64 ?? raw.base64) as string | undefined;
        if (qr) {
          session.lastQr = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
        }
        session.status = 'qr';
        session.lastSyncAt = new Date();
        return this.sessionsRepository.save(session);
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'LOCK_NOT_ACQUIRED') {
        throw new ConflictException(
          'Outra operação WhatsApp está em curso. Aguarde e tente novamente.',
        );
      }
      throw error;
    }
  }

  async deleteInstance(organizationId: string, plan: OrganizationPlan): Promise<void> {
    this.assertPlanAllowsInstance(plan);
    const session = await this.findByOrganizationId(organizationId);
    if (!session?.evolutionInstanceName) return;
    try {
      await this.redisLock.withLock(this.lockKey(organizationId), 120, async () => {
        await this.evolutionApi.logoutInstance(session.evolutionInstanceName!);
        await this.evolutionApi.deleteInstance(session.evolutionInstanceName!);
        await this.sessionsRepository.remove(session);
      });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'LOCK_NOT_ACQUIRED') {
        throw new ConflictException(
          'Outra operação WhatsApp está em curso. Aguarde e tente novamente.',
        );
      }
      throw error;
    }
  }

  async syncConnectionState(session: WhatsAppSessionEntity): Promise<WhatsAppSessionEntity> {
    if (!session.evolutionInstanceName) return session;
    const data = await this.evolutionApi.getConnectionState(session.evolutionInstanceName);
    const state = this.evolutionApi.resolveState(data);
    session.lastSyncAt = new Date();
    if (state === 'open') {
      session.status = 'connected';
      session.lastConnectedAt = new Date();
    } else if (state === 'close') {
      session.status = 'disconnected';
    } else if (state === 'connecting' || state === 'qrcode') {
      session.status = 'qr';
    }
    return this.sessionsRepository.save(session);
  }
}
