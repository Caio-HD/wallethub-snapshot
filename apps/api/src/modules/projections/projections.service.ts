import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository, IsNull, Equal } from 'typeorm';
import { Queue } from 'bullmq';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { QUEUE_PROJECTIONS } from '../../queues';

export type ProjectionScope = string; // 'all' ou ID do utilizador

@Injectable()
export class ProjectionsService {
  constructor(
    @InjectRepository(ProjectionEntity)
    private readonly projectionsRepository: Repository<ProjectionEntity>,
    @InjectQueue(QUEUE_PROJECTIONS) private readonly projectionsQueue: Queue,
  ) {}

  getLatest(scope: ProjectionScope, organizationId?: string): Promise<ProjectionEntity | null> {
    // Tenant isolation: when an organization is provided (dashboard), bound to it.
    const orgWhere = organizationId ? { organizationId } : {};
    return this.projectionsRepository.findOne({
      where:
        scope === 'all'
          ? { scopeUserId: IsNull(), ...orgWhere }
          : { scopeUserId: Equal(scope), ...orgWhere },
      order: { generatedAt: 'DESC' },
    });
  }

  async scheduleRecalculation(scope: ProjectionScope, trigger: string, organizationId?: string) {
    await this.projectionsQueue.add(
      'recalculate-scope',
      { scope, trigger, organizationId },
      { removeOnComplete: true, removeOnFail: false },
    );
  }
}
