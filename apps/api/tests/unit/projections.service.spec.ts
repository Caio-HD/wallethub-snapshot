import type { Queue } from 'bullmq';
import type { Repository } from 'typeorm';
import type { ProjectionEntity } from '@app/database/entities/projection.entity';
import { ProjectionsService } from '@app/modules/projections/projections.service';

describe('ProjectionsService', () => {
  it('should enqueue recalculation jobs', async () => {
    const repository: Partial<Repository<ProjectionEntity>> = {
      findOne: jest.fn(),
    };
    const queue: Partial<Queue> = {
      add: jest.fn(),
    };
    const service = new ProjectionsService(
      repository as Repository<ProjectionEntity>,
      queue as Queue,
    );

    await service.scheduleRecalculation('all', 'manual');

    expect(queue.add).toHaveBeenCalledWith(
      'recalculate-scope',
      {
        scope: 'all',
        trigger: 'manual',
      },
      { removeOnComplete: true, removeOnFail: false },
    );
  });
});
