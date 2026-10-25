import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../database/entities/user.entity.js';
import { normalizeEmail } from '../../common/utils/normalize-email.js';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { Inject } from '@nestjs/common';

export interface ActiveUserSelectorRow {
  id: string;
  name: string;
  isActive: boolean;
}

function randomPlaceholderSecret(): string {
  return randomBytes(24).toString('hex');
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity) private readonly usersRepository: Repository<UserEntity>,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    const normalized = normalizeEmail(email);
    if (!normalized) return Promise.resolve(null);
    return this.usersRepository
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: normalized })
      .getOne();
  }

  findByUsername(username: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  /** Cooldown entre trocas de username (anti-abuso/impersonação). */
  private static readonly USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

  /** Troca de username self-service: formato + unicidade + cooldown (1x/30 dias). */
  async changeUsername(userId: string, rawUsername: string): Promise<UserEntity> {
    const username = rawUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      throw new ConflictException('Username inválido (3–30 caracteres: a-z, 0-9 ou _).');
    }
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (user.username === username) {
      return user; // sem mudança
    }
    if (user.usernameChangedAt) {
      const remaining =
        UsersService.USERNAME_COOLDOWN_MS -
        (Date.now() - new Date(user.usernameChangedAt).getTime());
      if (remaining > 0) {
        const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
        throw new ConflictException(
          `Você só poderá trocar o username novamente em ${days} dia(s).`,
        );
      }
    }
    const existing = await this.findByUsername(username);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Este username já está em uso.');
    }
    user.username = username;
    user.usernameChangedAt = new Date();
    return this.usersRepository.save(user);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByPhoneNumber(phoneNumber: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { phoneNumber } });
  }

  findByTelegramUserId(telegramUserId: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { telegramUserId } });
  }

  /**
   * Utilizador OAuth: procura por id social ou e-mail; cria conta mínima se necessário.
   */
  async findOrCreateSocialUser(params: {
    provider: 'google' | 'github' | 'facebook';
    socialId: string;
    email: string;
    name: string;
    emailVerified: boolean;
  }): Promise<UserEntity> {
    const { provider, socialId, email, name, emailVerified } = params;
    const socialColumn: 'googleId' | 'githubId' | 'facebookId' =
      provider === 'google' ? 'googleId' : provider === 'github' ? 'githubId' : 'facebookId';
    const bySocial = await this.usersRepository.findOne({
      where: { [socialColumn]: socialId },
    });
    if (bySocial) {
      return bySocial;
    }

    const normalizedEmail = normalizeEmail(email);

    // Vinculação a conta existente: SÓ quando o provedor confirma o e-mail
    // (email_verified). Sem isso, um social com o e-mail da vítima (não
    // confirmado) sequestraria a conta — por isso nunca auto-vinculamos um
    // e-mail não verificado.
    if (normalizedEmail && emailVerified) {
      const byEmail = await this.findByEmail(normalizedEmail);
      if (byEmail) {
        byEmail[socialColumn] = socialId;
        byEmail.emailVerified = true;
        return this.usersRepository.save(byEmail);
      }
    }

    // Conta nova. Só assumimos o e-mail se for seguro:
    //  - livre + verificado  → usa, emailVerified=true
    //  - livre + não verif.  → usa, emailVerified=false (a confirmar depois)
    //  - já em uso por outra → NÃO reivindica (email=null): evita takeover e
    //    a violação do unique. (Se estivesse em uso E verificado, já teria
    //    vinculado acima — vincular ≫ duplicar.)
    let accountEmail: string | null = null;
    let accountEmailVerified = false;
    if (normalizedEmail) {
      const taken = await this.findByEmail(normalizedEmail);
      if (!taken) {
        accountEmail = normalizedEmail;
        accountEmailVerified = emailVerified;
      }
    }

    const rawBase =
      accountEmail?.split('@')[0]?.replace(/[^a-z0-9_]/gi, '') ||
      `${provider}_${socialId.slice(0, 8)}`;
    const usernameBase = rawBase.toLowerCase() || `${provider}_${socialId.slice(0, 8)}`;
    let username = usernameBase;
    let n = 0;
    while (await this.usersRepository.exist({ where: { username } })) {
      n += 1;
      username = `${usernameBase}${n}`;
    }
    const placeholderHash = await bcrypt.hash(randomPlaceholderSecret(), 10);
    const user = this.usersRepository.create({
      username,
      name: name || username,
      email: accountEmail,
      phoneNumber: null,
      passwordHash: placeholderHash,
      isActive: true,
      emailVerified: accountEmailVerified,
    });
    user[socialColumn] = socialId;
    return this.usersRepository.save(user);
  }

  async createPending(params: {
    name: string;
    email?: string;
    phoneNumber?: string;
  }): Promise<UserEntity> {
    const email = params.email?.toLowerCase() ?? null;
    const phoneNumber = params.phoneNumber ?? null;
    const rawBase =
      (email?.split('@')[0] ?? phoneNumber ?? `user_${randomBytes(4).toString('hex')}`)
        .replace(/[^a-z0-9_]/gi, '')
        .toLowerCase() || `user_${randomBytes(4).toString('hex')}`;
    let username = rawBase;
    let n = 0;
    while (await this.usersRepository.exist({ where: { username } })) {
      n += 1;
      username = `${rawBase}${n}`;
    }
    const placeholderHash = await bcrypt.hash(randomPlaceholderSecret(), 10);
    const user = this.usersRepository.create({
      username,
      name: params.name,
      email,
      phoneNumber,
      passwordHash: placeholderHash,
      isActive: true,
      emailVerified: false,
      phoneVerified: false,
      role: 'admin',
    });
    return this.usersRepository.save(user);
  }

  async updateProfile(id: string, payload: UpdateProfileDto): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    user.name = payload.name ?? user.name;
    user.phoneNumber = payload.phoneNumber ?? user.phoneNumber;
    user.photoUrl = payload.photoUrl ?? user.photoUrl;
    if (payload.baseCurrency !== undefined) user.baseCurrency = payload.baseCurrency;
    if (payload.preferredLanguage !== undefined) user.preferredLanguage = payload.preferredLanguage;
    if (payload.timezone !== undefined) user.timezone = payload.timezone;
    return this.usersRepository.save(user);
  }

  async updatePhoto(id: string, file: Express.Multer.File): Promise<string> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Remover foto antiga se existir
    if (user.photoUrl) {
      try {
        await this.storageService.deleteFile(user.photoUrl);
      } catch {
        // Ignorar erro se arquivo já não existe
      }
    }

    // Salvar nova foto
    const storagePath = await this.storageService.saveFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    user.photoUrl = storagePath;
    await this.usersRepository.save(user);

    return storagePath;
  }

  async getPhoto(
    id: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
    const user = await this.findById(id);
    if (!user || !user.photoUrl) {
      return null;
    }

    try {
      return await this.storageService.getFile(user.photoUrl);
    } catch {
      return null;
    }
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.usersRepository.update({ id }, { emailVerified: true });
  }

  async markPhoneVerified(id: string): Promise<void> {
    await this.usersRepository.update({ id }, { phoneVerified: true });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update({ id }, { passwordHash, hasPassword: true });
  }

  /**
   * Define/troca a senha do usuário logado (F3c). Se o usuário já tem uma senha
   * real (`hasPassword`), exige e valida a senha atual; contas sem senha
   * utilizável (criadas via social/OTP) podem definir sem a atual.
   */
  async changePassword(
    userId: string,
    params: { currentPassword?: string; newPassword: string },
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (user.hasPassword) {
      if (!params.currentPassword) {
        throw new UnauthorizedException('Informe a senha atual.');
      }
      const ok = user.passwordHash
        ? await bcrypt.compare(params.currentPassword, user.passwordHash)
        : false;
      if (!ok) {
        throw new UnauthorizedException('Senha atual incorreta.');
      }
    }
    const newHash = await bcrypt.hash(params.newPassword, 10);
    user.passwordHash = newHash;
    user.hasPassword = true;
    await this.usersRepository.save(user);
  }

  /** Stores a pending TOTP secret without enabling MFA (enrollment step 1). */
  async setMfaSecret(id: string, secret: string): Promise<void> {
    await this.usersRepository.update({ id }, { mfaSecret: secret, isMfaEnabled: false });
  }

  /** Enables MFA after the enrolled TOTP code is verified (enrollment step 2). */
  async enableMfa(id: string): Promise<void> {
    await this.usersRepository.update({ id }, { isMfaEnabled: true });
  }

  /** Clears TOTP enrollment (platform operator or self-service reset). */
  async disableMfa(id: string): Promise<void> {
    await this.usersRepository.update({ id }, { mfaSecret: null, isMfaEnabled: false });
  }

  /** Sem limite fixo de perfis ativos (agregado familiar pode ter N utilizadores). */
  ensureTwoAdmins(): Promise<void> {
    return Promise.resolve();
  }

  /** Utilizadores ativos para o seletor de âmbito (UUID). Ordem: created_at ASC. */
  async listActiveUsersForSelector(): Promise<ActiveUserSelectorRow[]> {
    return this.usersRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
      select: ['id', 'name', 'isActive'],
    });
  }

  // ── F2: provedores sociais vinculados ─────────────────────────────────────

  private socialColumnFor(
    provider: 'google' | 'github' | 'facebook',
  ): 'googleId' | 'githubId' | 'facebookId' {
    return provider === 'google' ? 'googleId' : provider === 'github' ? 'githubId' : 'facebookId';
  }

  getLinkedProviders(user: UserEntity): { google: boolean; github: boolean; facebook: boolean } {
    return {
      google: !!user.googleId,
      github: !!user.githubId,
      facebook: !!user.facebookId,
    };
  }

  /** Vincula uma identidade social ao usuário logado. Falha se já pertencer a outro. */
  async linkSocialAccount(
    userId: string,
    provider: 'google' | 'github' | 'facebook',
    socialId: string,
  ): Promise<UserEntity> {
    const column = this.socialColumnFor(provider);
    const owner = await this.usersRepository.findOne({ where: { [column]: socialId } });
    if (owner && owner.id !== userId) {
      throw new ConflictException(`Esta conta ${provider} já está vinculada a outro usuário.`);
    }
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    user[column] = socialId;
    return this.usersRepository.save(user);
  }

  /** Desvincula um provedor; bloqueia se deixaria o usuário sem método de acesso. */
  async unlinkSocialAccount(
    userId: string,
    provider: 'google' | 'github' | 'facebook',
  ): Promise<UserEntity> {
    const column = this.socialColumnFor(provider);
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (!user[column]) {
      return user; // já desvinculado — idempotente
    }
    // Métodos que SOBRAM após remover este provedor. Senha não conta: contas
    // criadas via social têm hash placeholder não utilizável.
    const remainingProviders = (['googleId', 'githubId', 'facebookId'] as const).filter(
      (c) => c !== column && !!user[c],
    ).length;
    const hasPasskey = (user.passkeys?.length ?? 0) > 0;
    const hasOtp = user.emailVerified || user.phoneVerified;
    if (remainingProviders === 0 && !hasPasskey && !hasOtp) {
      throw new ConflictException(
        'Configure outro método de acesso (passkey, e-mail ou telefone verificado) antes de desvincular este provedor.',
      );
    }
    user[column] = null;
    return this.usersRepository.save(user);
  }

  /** Aplica um e-mail já confirmado (usado pela troca de e-mail via OTP — F3b). */
  async setVerifiedEmail(userId: string, email: string): Promise<UserEntity> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    user.email = email;
    user.emailVerified = true;
    return this.usersRepository.save(user);
  }
}
