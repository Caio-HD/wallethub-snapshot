import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ProjectionEntity } from '../../database/entities/projection.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { AccountEntity } from '../../database/entities/account.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { OrganizationEntity } from '../../database/entities/organization.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import { ProjectionsService } from './projections.service';
import { ProjectionsProcessor } from './projections.processor';
import { QUEUE_ALERTS, QUEUE_PROJECTIONS } from '../../queues';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectionEntity,
      TransactionEntity,
      AccountEntity,
      UserEntity,
      OrganizationEntity,
      OrganizationMembershipEntity,
    ]),
    BullModule.registerQueue({ name: QUEUE_PROJECTIONS }),
    BullModule.registerQueue({ name: QUEUE_ALERTS }),
  ],
  providers: [ProjectionsService, ProjectionsProcessor],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
