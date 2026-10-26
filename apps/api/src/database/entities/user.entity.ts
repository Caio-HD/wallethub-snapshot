import { Column, Entity, Index, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { TransactionEntity } from './transaction.entity.js';

/** Credencial WebAuthn persistida em `users.passkeys` (jsonb). */
export interface Passkey {
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  transports?: string[];
}

@Entity({ name: 'users' })
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', unique: true, nullable: true })
  @Index()
  email?: string | null;

  @Column({ unique: true })
  @Index()
  username!: string;

  @Column({ name: 'username_changed_at', type: 'timestamptz', nullable: true })
  usernameChangedAt?: Date | null;

  @Column()
  name!: string;

  @Column({ type: 'varchar', name: 'phone_number', nullable: true })
  @Index()
  phoneNumber!: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'varchar', name: 'password_hash', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'has_password', default: false })
  hasPassword!: boolean;

  @Column({ name: 'email_verified', default: false })
  emailVerified!: boolean;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified!: boolean;

  @Column({ name: 'google_id', type: 'varchar', nullable: true, unique: true })
  @Index()
  googleId?: string | null;

  @Column({ name: 'github_id', type: 'varchar', nullable: true, unique: true })
  @Index()
  githubId?: string | null;

  @Column({ name: 'facebook_id', type: 'varchar', nullable: true, unique: true })
  @Index()
  facebookId?: string | null;

  @Column({ name: 'mfa_secret', type: 'varchar', nullable: true })
  mfaSecret?: string | null;

  @Column({ name: 'is_mfa_enabled', default: false })
  isMfaEnabled!: boolean;

  @Column({ name: 'passkeys', type: 'jsonb', nullable: true })
  passkeys?: Passkey[] | null;

  @Column({ type: 'varchar', name: 'photo_url', nullable: true })
  photoUrl?: string | null;

  @Column({ name: 'telegram_user_id', type: 'varchar', nullable: true, unique: true })
  @Index()
  telegramUserId?: string | null;

  @Column({ name: 'base_currency', type: 'varchar', length: 3, default: 'BRL' })
  baseCurrency!: string;

  @Column({ name: 'preferred_language', type: 'varchar', length: 10, nullable: true })
  preferredLanguage?: string | null;

  @Column({ name: 'timezone', type: 'varchar', length: 64, nullable: true })
  timezone?: string | null;

  @Column({ default: 'admin' })
  role!: 'admin' | 'super_admin';

  @OneToMany(() => TransactionEntity, (transaction) => transaction.user)
  transactions!: Relation<TransactionEntity>[];
}
