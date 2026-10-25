import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity';
import { CategoryEntity, type CategoryType } from '../../database/entities/category.entity';
import { SYSTEM_UNCATEGORIZED_NAME, SYSTEM_TRANSFER_NAME } from '../categories/categories.service';

@Injectable()
export class OrganizationsProvisioningService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipsRepository: Repository<OrganizationMembershipEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
  ) {}

  /** Cria (idempotente) as categorias de sistema "Sem categoria" da nova organização. */
  private async seedSystemCategories(organizationId: string): Promise<void> {
    const systemCategories: Array<{ type: CategoryType; name: string }> = [
      { type: 'income', name: SYSTEM_UNCATEGORIZED_NAME.income },
      { type: 'expense', name: SYSTEM_UNCATEGORIZED_NAME.expense },
      { type: 'transfer', name: SYSTEM_TRANSFER_NAME },
    ];
    for (const { type, name } of systemCategories) {
      const exists = await this.categoriesRepository.findOne({ where: { organizationId, name } });
      if (!exists) {
        await this.categoriesRepository.save(
          this.categoriesRepository.create({
            organizationId,
            name,
            type,
            isSystem: true,
            isActive: true,
            sortOrder: 9999,
          }),
        );
      }
    }
  }

  /**
   * Garante que o utilizador tem pelo menos uma organização (workspace pessoal).
   * Idempotente: se já existir membership activa, não cria duplicado.
   */
  async ensurePersonalOrganizationForUser(
    userId: string,
    displayName?: string,
  ): Promise<OrganizationEntity> {
    const existing = await this.membershipsRepository.findOne({
      where: { userId, status: 'active' },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    if (existing?.organization && !existing.deletedAt && !existing.organization.deletedAt) {
      return existing.organization;
    }

    const org = this.organizationsRepository.create({
      name: displayName?.trim() || 'O meu espaço',
      plan: 'free',
    });
    await this.organizationsRepository.save(org);

    const membership = this.membershipsRepository.create({
      organizationId: org.id,
      userId,
      role: 'owner',
      status: 'active',
    });
    await this.membershipsRepository.save(membership);

    await this.seedSystemCategories(org.id);

    return org;
  }
}
