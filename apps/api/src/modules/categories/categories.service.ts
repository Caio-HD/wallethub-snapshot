import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UserEntity } from '../../database/entities/user.entity.js';
import type { CategoryType } from '../../database/entities/category.entity.js';

/** Nomes canônicos das categorias de sistema "Sem categoria" (fonte única — DRY). */
export const SYSTEM_UNCATEGORIZED_NAME: Record<'income' | 'expense', string> = {
  income: 'Sem categoria (entradas)',
  expense: 'Sem categoria (saídas)',
};

/** Categoria de sistema neutra para transferências (não conta como receita/despesa). */
export const SYSTEM_TRANSFER_NAME = 'Transferências';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
  ) {}

  /**
   * Garante (find-or-create, idempotente) as categorias de sistema "Sem categoria"
   * de entrada e saída da organização — destino neutro de importações ainda não
   * classificadas. Self-heal: recria se o usuário as tiver removido.
   */
  async ensureSystemCategories(
    organizationId: string,
  ): Promise<Record<CategoryType, CategoryEntity>> {
    const ensureOne = async (type: CategoryType, name: string): Promise<CategoryEntity> => {
      const existing = await this.categoriesRepository.findOne({
        where: { organizationId, name },
      });
      if (existing) return existing;
      return this.categoriesRepository.save(
        this.categoriesRepository.create({
          organizationId,
          name,
          type,
          isSystem: true,
          isActive: true,
          sortOrder: 9999,
        }),
      );
    };
    const [income, expense, transfer] = await Promise.all([
      ensureOne('income', SYSTEM_UNCATEGORIZED_NAME.income),
      ensureOne('expense', SYSTEM_UNCATEGORIZED_NAME.expense),
      ensureOne('transfer', SYSTEM_TRANSFER_NAME),
    ]);
    return { income, expense, transfer };
  }

  findAll(organizationId: string): Promise<CategoryEntity[]> {
    return this.categoriesRepository.find({
      where: { isActive: true, organizationId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findActiveById(organizationId: string, id: string): Promise<CategoryEntity | null> {
    return this.categoriesRepository.findOne({
      where: { id, organizationId, isActive: true },
    });
  }

  async create(
    dto: CreateCategoryDto,
    userId: string,
    organizationId: string,
  ): Promise<CategoryEntity> {
    const existing = await this.categoriesRepository.findOne({
      where: { name: dto.name, organizationId },
      withDeleted: true,
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException(`Já existe uma categoria ativa com o nome "${dto.name}"`);
      }

      existing.isActive = true;
      existing.type = dto.type;
      existing.ownerUserId = dto.ownerUserId ?? null;
      if (dto.sortOrder !== undefined) existing.sortOrder = dto.sortOrder;

      return this.categoriesRepository.save(existing);
    }

    const createdBy = this.categoriesRepository.manager.create(UserEntity, { id: userId });
    const category = this.categoriesRepository.create({
      name: dto.name,
      type: dto.type,
      ownerUserId: dto.ownerUserId ?? null,
      sortOrder: dto.sortOrder ?? 0,
      createdBy,
      organizationId,
    });
    return this.categoriesRepository.save(category);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    organizationId: string,
  ): Promise<CategoryEntity> {
    const category = await this.categoriesRepository.findOne({ where: { id, organizationId } });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    Object.assign(category, dto);
    return this.categoriesRepository.save(category);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const category = await this.categoriesRepository.findOne({ where: { id, organizationId } });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    category.isActive = false;
    await this.categoriesRepository.save(category);
  }

  async reorder(dto: ReorderCategoriesDto, organizationId: string): Promise<void> {
    await this.categoriesRepository.manager.transaction(async (manager) => {
      await Promise.all(
        dto.categoryIds.map((categoryId, index) =>
          manager.update(CategoryEntity, { id: categoryId, organizationId }, { sortOrder: index }),
        ),
      );
    });
  }
}
