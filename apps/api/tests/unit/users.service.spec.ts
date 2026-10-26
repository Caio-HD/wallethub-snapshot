import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import { UsersService } from '@app/modules/users/users.service';
import { UserEntity } from '@app/database/entities/user.entity';
import type { StorageService } from '@app/modules/storage/storage.interface';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const setup = () => {
  const usersRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x: object) => x),
    save: jest.fn(async (x: object) => x),
    update: jest.fn().mockResolvedValue({}),
    exist: jest.fn().mockResolvedValue(false),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    }),
  } as unknown as Repository<UserEntity>;

  const storageService = {
    saveFile: jest.fn().mockResolvedValue('/storage/photo.jpg'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getFile: jest.fn(),
  } as unknown as StorageService;

  const service = new UsersService(usersRepository, storageService);

  return { service, usersRepository, storageService };
};

describe('UsersService', () => {
  describe('findByEmail', () => {
    it('returns user when found (case-insensitive lookup)', async () => {
      const { service, usersRepository } = setup();
      const user = { id: USER_ID, email: 'test@example.com' } as UserEntity;
      const getOne = jest.fn().mockResolvedValue(user);
      (usersRepository.createQueryBuilder as jest.Mock) = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne,
      });

      const result = await service.findByEmail('Test@Example.COM');

      expect(result).toBe(user);
      expect(getOne).toHaveBeenCalled();
    });

    it('returns null when not found', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.createQueryBuilder as jest.Mock) = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const { service, usersRepository } = setup();
      const user = { id: USER_ID } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      const result = await service.findById(USER_ID);

      expect(result).toBe(user);
    });
  });

  describe('findOrCreateSocialUser', () => {
    // findByEmail() usa createQueryBuilder().getOne() — helper p/ controlar o resultado.
    const mockFindByEmail = (repo: unknown, result: unknown) => {
      (repo as { createQueryBuilder: jest.Mock }).createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(result),
      });
    };

    it('returns existing user found by googleId', async () => {
      const { service, usersRepository } = setup();
      const existing = { id: USER_ID, googleId: 'g-123' } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(existing);

      const result = await service.findOrCreateSocialUser({
        provider: 'google',
        socialId: 'g-123',
        email: 'user@gmail.com',
        name: 'Test User',
        emailVerified: true,
      });

      expect(result).toBe(existing);
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('links social id to existing account when provider email is VERIFIED', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null); // sem match por socialId
      const existingByEmail = { id: USER_ID, email: 'user@gmail.com', googleId: null } as UserEntity;
      mockFindByEmail(usersRepository, existingByEmail);
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      const result = await service.findOrCreateSocialUser({
        provider: 'google',
        socialId: 'g-456',
        email: 'user@gmail.com',
        name: 'Test User',
        emailVerified: true,
      });

      expect(usersRepository.create).not.toHaveBeenCalled();
      expect(result.googleId).toBe('g-456');
      expect(result.emailVerified).toBe(true);
    });

    it('does NOT link to existing account when email is UNVERIFIED (anti-takeover)', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null); // sem match por socialId
      const victim = { id: USER_ID, email: 'victim@gmail.com', googleId: null } as UserEntity;
      mockFindByEmail(usersRepository, victim); // o e-mail já pertence à vítima
      (usersRepository.exist as jest.Mock).mockResolvedValue(false);
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      await service.findOrCreateSocialUser({
        provider: 'github',
        socialId: 'gh-evil',
        email: 'victim@gmail.com',
        name: 'Evil',
        emailVerified: false,
      });

      // cria conta nova SEM tocar na vítima e SEM reivindicar o e-mail dela
      expect(usersRepository.create).toHaveBeenCalled();
      const created = (usersRepository.create as jest.Mock).mock.calls[0][0];
      expect(created.email).toBeNull();
      expect(created.emailVerified).toBe(false);
      expect(victim.githubId).toBeUndefined();
    });

    it('creates new user with email when verified and email is free', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null);
      mockFindByEmail(usersRepository, null); // e-mail livre
      (usersRepository.exist as jest.Mock).mockResolvedValue(false);
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      await service.findOrCreateSocialUser({
        provider: 'google',
        socialId: 'g-789',
        email: 'johndoe@example.com',
        name: 'John Doe',
        emailVerified: true,
      });

      const created = (usersRepository.create as jest.Mock).mock.calls[0][0];
      expect(created.email).toBe('johndoe@example.com');
      expect(created.emailVerified).toBe(true);
    });

    it('appends number suffix to username when base already exists', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null);
      mockFindByEmail(usersRepository, null); // e-mail livre
      (usersRepository.exist as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (usersRepository.save as jest.Mock).mockResolvedValue({ id: USER_ID } as UserEntity);

      await service.findOrCreateSocialUser({
        provider: 'github',
        socialId: 'gh-1',
        email: 'bob@example.com',
        name: 'Bob',
        emailVerified: true,
      });

      const created = (usersRepository.create as jest.Mock).mock.calls[0][0];
      expect(created.username).toMatch(/^bob1$/);
    });
  });

  describe('createPending', () => {
    it('creates pending user with email', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.exist as jest.Mock).mockResolvedValue(false);
      const user = { id: USER_ID, emailVerified: false } as UserEntity;
      (usersRepository.save as jest.Mock).mockResolvedValue(user);

      const result = await service.createPending({ name: 'Alice', email: 'alice@example.com' });

      const created = (usersRepository.create as jest.Mock).mock.calls[0][0];
      expect(created.emailVerified).toBe(false);
      expect(created.email).toBe('alice@example.com');
      expect(result).toBe(user);
    });

    it('lowercases email when creating pending user', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.exist as jest.Mock).mockResolvedValue(false);
      (usersRepository.save as jest.Mock).mockResolvedValue({ id: USER_ID } as UserEntity);

      await service.createPending({ name: 'Alice', email: 'Alice@Example.COM' });

      const created = (usersRepository.create as jest.Mock).mock.calls[0][0];
      expect(created.email).toBe('alice@example.com');
    });
  });

  describe('updateProfile', () => {
    it('throws NotFoundException when user not found', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateProfile(USER_ID, { name: 'Novo Nome' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates name when provided', async () => {
      const { service, usersRepository } = setup();
      const user = { id: USER_ID, name: 'Antigo', phoneNumber: null, photoUrl: null } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
      (usersRepository.save as jest.Mock).mockResolvedValue({ ...user, name: 'Novo Nome' });

      const result = await service.updateProfile(USER_ID, { name: 'Novo Nome' });

      expect(result.name).toBe('Novo Nome');
    });
  });

  describe('updatePhoto', () => {
    it('throws NotFoundException when user not found', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updatePhoto(USER_ID, { buffer: Buffer.from(''), originalname: 'photo.jpg', mimetype: 'image/jpeg' } as Express.Multer.File),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes old photo and saves new one', async () => {
      const { service, usersRepository, storageService } = setup();
      const user = { id: USER_ID, photoUrl: '/old/photo.jpg' } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
      (usersRepository.save as jest.Mock).mockResolvedValue(user);

      const result = await service.updatePhoto(USER_ID, {
        buffer: Buffer.from('img'),
        originalname: 'new.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File);

      expect(storageService.deleteFile).toHaveBeenCalledWith('/old/photo.jpg');
      expect(storageService.saveFile).toHaveBeenCalled();
      expect(result).toBe('/storage/photo.jpg');
    });

    it('skips deletion when user has no existing photo', async () => {
      const { service, usersRepository, storageService } = setup();
      const user = { id: USER_ID, photoUrl: null } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
      (usersRepository.save as jest.Mock).mockResolvedValue(user);

      await service.updatePhoto(USER_ID, {
        buffer: Buffer.from('img'),
        originalname: 'new.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('markEmailVerified', () => {
    it('calls update with emailVerified true', async () => {
      const { service, usersRepository } = setup();

      await service.markEmailVerified(USER_ID);

      expect(usersRepository.update).toHaveBeenCalledWith({ id: USER_ID }, { emailVerified: true });
    });
  });

  describe('markPhoneVerified', () => {
    it('calls update with phoneVerified true', async () => {
      const { service, usersRepository } = setup();

      await service.markPhoneVerified(USER_ID);

      expect(usersRepository.update).toHaveBeenCalledWith({ id: USER_ID }, { phoneVerified: true });
    });
  });

  describe('listActiveUsersForSelector', () => {
    it('returns active users ordered by createdAt', async () => {
      const { service, usersRepository } = setup();
      const users = [{ id: USER_ID, name: 'Alice', isActive: true }] as UserEntity[];
      (usersRepository.find as jest.Mock).mockResolvedValue(users);

      const result = await service.listActiveUsersForSelector();

      expect(usersRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'ASC' },
        select: ['id', 'name', 'isActive'],
      });
      expect(result).toBe(users);
    });
  });

  describe('linkSocialAccount (F2)', () => {
    it('throws Conflict when the social id already belongs to another user', async () => {
      const { service, usersRepository } = setup();
      (usersRepository.findOne as jest.Mock).mockResolvedValueOnce({ id: 'other-user' } as UserEntity);

      await expect(
        service.linkSocialAccount(USER_ID, 'google', 'g-shared'),
      ).rejects.toThrow('já está vinculada a outro usuário');
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('links provider id to the user when free', async () => {
      const { service, usersRepository } = setup();
      const user = { id: USER_ID, googleId: null } as UserEntity;
      (usersRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // owner check: livre
        .mockResolvedValueOnce(user); // findById
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      const result = await service.linkSocialAccount(USER_ID, 'google', 'g-1');

      expect(result.googleId).toBe('g-1');
    });
  });

  describe('unlinkSocialAccount (F2)', () => {
    it('blocks unlinking the last access method', async () => {
      const { service, usersRepository } = setup();
      const user = {
        id: USER_ID,
        googleId: 'g-1',
        githubId: null,
        facebookId: null,
        emailVerified: false,
        phoneVerified: false,
        passkeys: null,
      } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.unlinkSocialAccount(USER_ID, 'google')).rejects.toThrow(
        'antes de desvincular',
      );
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('unlinks when the user still has a verified email (OTP fallback)', async () => {
      const { service, usersRepository } = setup();
      const user = {
        id: USER_ID,
        googleId: 'g-1',
        githubId: null,
        facebookId: null,
        emailVerified: true,
        phoneVerified: false,
        passkeys: null,
      } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      const result = await service.unlinkSocialAccount(USER_ID, 'google');

      expect(result.googleId).toBeNull();
    });
  });

  describe('changeUsername (F3a)', () => {
    const DAY = 24 * 60 * 60 * 1000;

    it('rejects invalid format', async () => {
      const { service } = setup();
      await expect(service.changeUsername(USER_ID, 'Ab')).rejects.toThrow('inválido');
    });

    it('blocks within the 30-day cooldown', async () => {
      const { service, usersRepository } = setup();
      const user = {
        id: USER_ID,
        username: 'old',
        usernameChangedAt: new Date(Date.now() - 5 * DAY),
      } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(service.changeUsername(USER_ID, 'newname')).rejects.toThrow(
        'trocar o username novamente',
      );
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('rejects when the username is already taken', async () => {
      const { service, usersRepository } = setup();
      const user = { id: USER_ID, username: 'old', usernameChangedAt: null } as UserEntity;
      (usersRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(user) // findById
        .mockResolvedValueOnce({ id: 'someone-else', username: 'taken' } as UserEntity); // findByUsername

      await expect(service.changeUsername(USER_ID, 'taken')).rejects.toThrow('já está em uso');
    });

    it('changes username and stamps usernameChangedAt when free and past cooldown', async () => {
      const { service, usersRepository } = setup();
      const user = {
        id: USER_ID,
        username: 'old',
        usernameChangedAt: new Date(Date.now() - 40 * DAY),
      } as UserEntity;
      (usersRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(user) // findById
        .mockResolvedValueOnce(null); // findByUsername: livre
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      const result = await service.changeUsername(USER_ID, 'newname');

      expect(result.username).toBe('newname');
      expect(result.usernameChangedAt).toBeInstanceOf(Date);
    });
  });

  describe('changePassword (F3c)', () => {
    it('sets a password without the current one when the account has none', async () => {
      const { service, usersRepository } = setup();
      const user = { id: USER_ID, hasPassword: false, passwordHash: 'placeholder' } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      await service.changePassword(USER_ID, { newPassword: 'brandnewpass' });

      expect(usersRepository.save).toHaveBeenCalled();
      expect(user.hasPassword).toBe(true);
      expect(user.passwordHash).not.toBe('placeholder');
    });

    it('requires the current password when the account already has one', async () => {
      const { service, usersRepository } = setup();
      const user = { id: USER_ID, hasPassword: true, passwordHash: 'x' } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(
        service.changePassword(USER_ID, { newPassword: 'brandnewpass' }),
      ).rejects.toThrow('senha atual');
    });

    it('rejects a wrong current password', async () => {
      const { service, usersRepository } = setup();
      const hash = await bcrypt.hash('rightpass', 10);
      const user = { id: USER_ID, hasPassword: true, passwordHash: hash } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      await expect(
        service.changePassword(USER_ID, { currentPassword: 'wrongpass', newPassword: 'newnewpass' }),
      ).rejects.toThrow('incorreta');
    });

    it('changes the password when the current one matches', async () => {
      const { service, usersRepository } = setup();
      const hash = await bcrypt.hash('rightpass', 10);
      const user = { id: USER_ID, hasPassword: true, passwordHash: hash } as UserEntity;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);
      (usersRepository.save as jest.Mock).mockImplementation(async (u) => u);

      await service.changePassword(USER_ID, {
        currentPassword: 'rightpass',
        newPassword: 'newnewpass',
      });

      expect(await bcrypt.compare('newnewpass', user.passwordHash as string)).toBe(true);
    });
  });
});
