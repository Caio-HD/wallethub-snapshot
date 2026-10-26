import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { TelegramLinkNonceEntity } from '../../database/entities/telegram-link-nonce.entity';
import { UserEntity } from '../../database/entities/user.entity';

const NONCE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class TelegramLinkService {
  constructor(
    @InjectRepository(TelegramLinkNonceEntity)
    private readonly nonces: Repository<TelegramLinkNonceEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async createLinkNonce(userId: string): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
    await this.nonces.save(
      this.nonces.create({
        nonce,
        userId,
        expiresAt,
      }),
    );
    return { nonce, expiresAt };
  }

  /**
   * Associa o ID Telegram ao utilizador do nonce. Devolve false se nonce inválido ou expirado.
   */
  async tryLinkUserByNonce(telegramUserId: string, nonce: string): Promise<boolean> {
    const row = await this.nonces.findOne({ where: { nonce } });
    if (!row || row.expiresAt < new Date()) {
      if (row) await this.nonces.softRemove(row);
      return false;
    }

    const existingOther = await this.users.findOne({
      where: { telegramUserId },
    });
    if (existingOther && existingOther.id !== row.userId) {
      throw new ConflictException('Este Telegram já está ligado a outra conta.');
    }

    const target = await this.users.findOne({ where: { id: row.userId } });
    if (!target) {
      await this.nonces.softRemove(row);
      return false;
    }

    if (target.telegramUserId && target.telegramUserId !== telegramUserId) {
      throw new ConflictException('A sua conta já está ligada a outro Telegram.');
    }

    target.telegramUserId = telegramUserId;
    await this.users.save(target);
    await this.nonces.softRemove(row);
    return true;
  }
}
