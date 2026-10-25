import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationUsageCounterEntity } from '../../database/entities/organization-usage-counter.entity';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity';
import { EntitlementsService } from './entitlements.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationUsageCounterEntity, OrganizationMembershipEntity]),
  ],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
