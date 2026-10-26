import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../database/entities/user.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import type { Role } from '../../common/decorators/roles.decorator';
import { normalizeEmail } from '../../common/utils/normalize-email.js';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { PatchAdminUserDto } from './dto/patch-admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipsRepository: Repository<OrganizationMembershipEntity>,
  ) {}

  async list(params: {
    page: number;
    limit: number;
    q?: string;
  }): Promise<{ items: UserEntity[]; total: number }> {
    const { page, limit, q } = params;
    const qb = this.usersRepository.createQueryBuilder('u');
    if (q?.trim()) {
      const term = `%${q.trim()}%`;
      qb.where(
        '(u.username ILIKE :term OR u.name ILIKE :term OR u.email ILIKE :term OR u.phone_number ILIKE :term)',
        { term },
      );
    }
    qb.orderBy('u.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilizador não encontrado');
    return user;
  }

  /** Only a super_admin actor may create/assign the super_admin role. Fail-closed on unknown actor. */
  private assertMayAssignRole(role: Role | undefined, actorRole: Role | undefined): void {
    if (role === 'super_admin' && actorRole !== 'super_admin') {
      throw new ForbiddenException('Apenas um super_admin pode atribuir o papel super_admin.');
    }
  }

  /** Case-insensitive email uniqueness (matches DB index on lower(email)). */
  private async assertEmailAvailable(
    email: string | null,
    excludingUserId?: string,
  ): Promise<void> {
    if (!email) return;
    const qb = this.usersRepository
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email });
    if (excludingUserId) {
      qb.andWhere('u.id != :id', { id: excludingUserId });
    }
    const other = await qb.getOne();
    if (other) {
      throw new ConflictException('Email já em uso');
    }
  }

  async create(dto: CreateAdminUserDto, actorRole?: Role): Promise<UserEntity> {
    const role: Role = dto.role ?? 'admin';
    this.assertMayAssignRole(role, actorRole);

    const username = dto.username.trim().toLowerCase();
    const existingU = await this.usersRepository.findOne({ where: { username } });
    if (existingU) {
      throw new ConflictException('Username já em uso');
    }
    const phoneNumber = dto.phoneNumber?.trim() || null;
    if (phoneNumber) {
      const existingP = await this.usersRepository.findOne({ where: { phoneNumber } });
      if (existingP) {
        throw new ConflictException('Telefone já em uso');
      }
    }
    const email = normalizeEmail(dto.email);
    if (email) {
      await this.assertEmailAvailable(email);
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      username,
      name: dto.name.trim(),
      phoneNumber,
      email,
      passwordHash,
      isActive: true,
      role,
    });
    return this.usersRepository.save(user);
  }

  async update(id: string, dto: PatchAdminUserDto, actorRole?: Role): Promise<UserEntity> {
    const user = await this.findOne(id);

    if (dto.role !== undefined && dto.role !== user.role) {
      this.assertMayAssignRole(dto.role, actorRole);
      // Last-operator protection: never demote the last active super_admin.
      if (user.role === 'super_admin' && dto.role !== 'super_admin') {
        await this.assertNotLastActiveSuperAdmin(id);
      }
      user.role = dto.role;
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phoneNumber !== undefined) {
      const phone = dto.phoneNumber?.trim() || null;
      if (phone) {
        const other = await this.usersRepository.findOne({ where: { phoneNumber: phone } });
        if (other && other.id !== id) {
          throw new ConflictException('Telefone já em uso');
        }
        user.phoneNumber = phone;
      } else {
        user.phoneNumber = null;
      }
    }
    if (dto.email !== undefined) {
      const em = normalizeEmail(dto.email);
      await this.assertEmailAvailable(em, id);
      user.email = em;
    }
    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      // Last-operator protection: never deactivate the last active super_admin.
      if (!dto.isActive && user.role === 'super_admin') {
        await this.assertNotLastActiveSuperAdmin(id);
      }
      user.isActive = dto.isActive;
    }
    if (dto.timezone !== undefined) {
      user.timezone = dto.timezone?.trim() || null;
    }
    if (dto.preferredLanguage !== undefined) {
      user.preferredLanguage = dto.preferredLanguage?.trim() || null;
    }
    return this.usersRepository.save(user);
  }

  async resetPassword(id: string, password: string): Promise<void> {
    const user = await this.findOne(id);
    if (!user.isActive) {
      throw new BadRequestException(
        'Não é possível redefinir a password de um utilizador inactivo. Reactive a conta primeiro.',
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.usersRepository.update({ id }, { passwordHash });
  }

  async disableMfa(id: string): Promise<void> {
    await this.findOne(id);
    await this.usersRepository.update({ id }, { mfaSecret: null, isMfaEnabled: false });
  }

  /** Guards against locking the platform out: refuse to demote/deactivate the last operator. */
  private async assertNotLastActiveSuperAdmin(excludingUserId: string): Promise<void> {
    const others = await this.usersRepository
      .createQueryBuilder('u')
      .where('u.role = :role', { role: 'super_admin' })
      .andWhere('u.is_active = true')
      .andWhere('u.id != :id', { id: excludingUserId })
      .getCount();
    if (others === 0) {
      throw new BadRequestException(
        'Não é possível remover/desativar o último super_admin activo. Crie outro operador primeiro.',
      );
    }
  }

  async toPublic(u: UserEntity) {
    const memberships = await this.membershipsRepository.find({
      where: { userId: u.id, status: 'active' },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      phoneNumber: u.phoneNumber,
      email: u.email,
      isActive: u.isActive,
      role: u.role,
      isMfaEnabled: u.isMfaEnabled,
      timezone: u.timezone ?? null,
      preferredLanguage: u.preferredLanguage ?? null,
      memberships: memberships
        .filter((m) => m.organization && !m.deletedAt)
        .map((m) => ({
          organizationId: m.organizationId,
          organizationName: m.organization.name,
          role: m.role,
        })),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }
}
