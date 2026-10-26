import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { CategoriesService } from '@app/modules/categories/categories.service';
import { CategoryEntity } from '@app/database/entities/category.entity';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const CAT_ID = '00000000-0000-0000-0000-000000000003';

type ManagerMock = {
  create: jest.Mock;
  update: jest.Mock;
  transaction: jest.Mock;
};

const setup = () => {
  const manager: ManagerMock = {
    create: jest.fn((_: unknown, data: object) => data),
    update: jest.fn().mockResolvedValue({}),
    transaction: jest.fn(async (cb: (m: ManagerMock) => Promise<void>) => cb(manager)),
  };

  const categoriesRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
    manager,
  } as unknown as Repository<CategoryEntity>;

  const service = new CategoriesService(categoriesRepository);
  return { service, categoriesRepository, manager };
};

describe('CategoriesService', () => {
  describe('findAll', () => {
    it('returns active categories for organization ordered by sortOrder', async () => {
      const { service, categoriesRepository } = setup();
      const cats = [
        { id: CAT_ID, name: 'Alimentação', sortOrder: 0 },
        { id: 'cat-2', name: 'Transporte', sortOrder: 1 },
      ] as CategoryEntity[];
      (categoriesRepository.find as jest.Mock).mockResolvedValue(cats);

      const result = await service.findAll(ORG_ID);

      expect(categoriesRepository.find).toHaveBeenCalledWith({
        where: { isActive: true, organizationId: ORG_ID },
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findActiveById', () => {
    it('returns category when found', async () => {
      const { service, categoriesRepository } = setup();
      const cat = { id: CAT_ID } as CategoryEntity;
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(cat);

      const result = await service.findActiveById(ORG_ID, CAT_ID);

      expect(result).toBe(cat);
    });

    it('returns null when not found', async () => {
      const { service, categoriesRepository } = setup();
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findActiveById(ORG_ID, CAT_ID);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates new category when name does not exist', async () => {
      const { service, categoriesRepository } = setup();
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(null);
      const saved = { id: CAT_ID, name: 'Nova', type: 'expense' } as CategoryEntity;
      (categoriesRepository.save as jest.Mock).mockResolvedValue(saved);

      const result = await service.create({ name: 'Nova', type: 'expense' }, USER_ID, ORG_ID);

      expect(categoriesRepository.save).toHaveBeenCalled();
      expect(result).toBe(saved);
    });

    it('throws ConflictException when active category with same name exists', async () => {
      const { service, categoriesRepository } = setup();
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue({ name: 'Existente', isActive: true });

      await expect(
        service.create({ name: 'Existente', type: 'expense' }, USER_ID, ORG_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reactivates soft-deleted category with same name', async () => {
      const { service, categoriesRepository } = setup();
      const existing = { id: CAT_ID, name: 'Antiga', isActive: false, type: 'income' } as CategoryEntity;
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(existing);
      (categoriesRepository.save as jest.Mock).mockImplementation(async (x: object) => x);

      const result = await service.create({ name: 'Antiga', type: 'expense' }, USER_ID, ORG_ID);

      expect(result.isActive).toBe(true);
      expect(result.type).toBe('expense');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when category not found', async () => {
      const { service, categoriesRepository } = setup();
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(CAT_ID, { name: 'Novo' }, ORG_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates category fields', async () => {
      const { service, categoriesRepository } = setup();
      const cat = { id: CAT_ID, name: 'Antigo', isActive: true } as CategoryEntity;
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(cat);
      (categoriesRepository.save as jest.Mock).mockResolvedValue({ ...cat, name: 'Novo' });

      const result = await service.update(CAT_ID, { name: 'Novo' }, ORG_ID);

      expect(result.name).toBe('Novo');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when category not found', async () => {
      const { service, categoriesRepository } = setup();
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(CAT_ID, ORG_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets isActive to false', async () => {
      const { service, categoriesRepository } = setup();
      const cat = { id: CAT_ID, name: 'Cat', isActive: true } as CategoryEntity;
      (categoriesRepository.findOne as jest.Mock).mockResolvedValue(cat);
      (categoriesRepository.save as jest.Mock).mockResolvedValue({ ...cat, isActive: false });

      await service.remove(CAT_ID, ORG_ID);

      expect((categoriesRepository.save as jest.Mock).mock.calls[0][0].isActive).toBe(false);
    });
  });

  describe('reorder', () => {
    it('updates sortOrder for each category in transaction', async () => {
      const { service, manager } = setup();

      await service.reorder({ categoryIds: ['cat-a', 'cat-b', 'cat-c'] }, ORG_ID);

      expect(manager.update).toHaveBeenCalledTimes(3);
      expect(manager.update).toHaveBeenCalledWith(
        CategoryEntity,
        { id: 'cat-a', organizationId: ORG_ID },
        { sortOrder: 0 },
      );
      expect(manager.update).toHaveBeenCalledWith(
        CategoryEntity,
        { id: 'cat-b', organizationId: ORG_ID },
        { sortOrder: 1 },
      );
    });
  });
});
