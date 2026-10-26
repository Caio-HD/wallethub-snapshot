import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AdminUsersService } from '@app/modules/admin/admin-users.service';
import type { UserEntity } from '@app/database/entities/user.entity';
import type { OrganizationMembershipEntity } from '@app/database/entities/organization-membership.entity';

describe('AdminUsersService', () => {
  const membershipsRepo = (rows: Partial<OrganizationMembershipEntity>[] = []) =>
    ({
      find: jest.fn().mockResolvedValue(rows),
    }) as unknown as Repository<OrganizationMembershipEntity>;

  it('toPublic maps entity fields and includes memberships', async () => {
    const usersRepo = {} as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(
      usersRepo,
      membershipsRepo([
        {
          organizationId: 'o1',
          role: 'owner',
          deletedAt: null,
          organization: { name: 'Casa' },
        } as unknown as OrganizationMembershipEntity,
      ]),
    );
    const now = new Date('2024-06-01T12:00:00.000Z');
    const u = {
      id: 'u1',
      username: 'alice',
      name: 'Alice',
      phoneNumber: '+5511999999999',
      email: 'a@example.com',
      isActive: true,
      role: 'admin',
      isMfaEnabled: true,
      timezone: 'Europe/Lisbon',
      preferredLanguage: 'pt-PT',
      createdAt: now,
      updatedAt: now,
    } as UserEntity;

    await expect(svc.toPublic(u)).resolves.toEqual({
      id: 'u1',
      username: 'alice',
      name: 'Alice',
      phoneNumber: '+5511999999999',
      email: 'a@example.com',
      isActive: true,
      role: 'admin',
      isMfaEnabled: true,
      timezone: 'Europe/Lisbon',
      preferredLanguage: 'pt-PT',
      memberships: [{ organizationId: 'o1', organizationName: 'Casa', role: 'owner' }],
      createdAt: now,
      updatedAt: now,
    });
  });

  it('create rejects assigning super_admin when actor is not super_admin (fail-closed)', async () => {
    const usersRepo = { findOne: jest.fn() } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    await expect(
      svc.create(
        { username: 'x', name: 'X', password: 'password1', role: 'super_admin' },
        'admin',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create rejects super_admin when actor role is undefined (fail-closed)', async () => {
    const usersRepo = { findOne: jest.fn() } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    await expect(
      svc.create({ username: 'x', name: 'X', password: 'password1', role: 'super_admin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update clears phone when patch sends null', async () => {
    const target = {
      id: 'u1',
      role: 'admin',
      isActive: true,
      phoneNumber: '+5511999999999',
    } as UserEntity;
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue(target),
      save: jest.fn().mockImplementation(async (u: UserEntity) => u),
    } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    const updated = await svc.update('u1', { phoneNumber: null }, 'super_admin');
    expect(updated.phoneNumber).toBeNull();
    expect(usersRepo.save).toHaveBeenCalled();
  });

  it('update refuses to deactivate the last active super_admin', async () => {
    const target = { id: 'sa1', role: 'super_admin', isActive: true } as UserEntity;
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue(target),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0), // no other active super_admin
      }),
      save: jest.fn(),
    } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    await expect(svc.update('sa1', { isActive: false }, 'super_admin')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resetPassword hashes and updates password', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    await svc.resetPassword('u1', 'newpassword1');
    expect(usersRepo.update).toHaveBeenCalledWith(
      { id: 'u1' },
      expect.objectContaining({ passwordHash: expect.any(String) }),
    );
  });

  it('resetPassword rejects inactive user', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }),
      update: jest.fn(),
    } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    await expect(svc.resetPassword('u1', 'newpassword1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(usersRepo.update).not.toHaveBeenCalled();
  });

  it('create stores normalized lowercase email', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn((x: object) => x),
      save: jest.fn(async (x: object) => x),
    } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    await svc.create(
      {
        username: 'alice',
        name: 'Alice',
        password: 'password1',
        email: 'Alice@Example.COM',
        phoneNumber: '5511999999999',
      },
      'super_admin',
    );
    const created = (usersRepo.create as jest.Mock).mock.calls[0][0];
    expect(created.email).toBe('alice@example.com');
  });

  it('disableMfa clears secret and flag', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'u1' }),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as Repository<UserEntity>;
    const svc = new AdminUsersService(usersRepo, membershipsRepo());
    await svc.disableMfa('u1');
    expect(usersRepo.update).toHaveBeenCalledWith(
      { id: 'u1' },
      { mfaSecret: null, isMfaEnabled: false },
    );
  });
});
