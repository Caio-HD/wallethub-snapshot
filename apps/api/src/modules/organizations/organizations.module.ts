import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { CategoryEntity } from '../../database/entities/category.entity';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsProvisioningService } from './organizations-provisioning.service';
import { EntitlementsModule } from '../plan-entitlements/entitlements.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      OrganizationMembershipEntity,
      UserEntity,
      CategoryEntity,
    ]),
    EntitlementsModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsProvisioningService],
  exports: [OrganizationsService, OrganizationsProvisioningService],
})
export class OrganizationsModule {}
