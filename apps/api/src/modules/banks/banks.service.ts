import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankEntity } from '../../database/entities/bank.entity.js';

/** Forma canônica de um código COMPE (3 dígitos numéricos, sem zeros à esquerda perdidos). */
function normalizeCompe(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(3, '0').slice(-3);
}

@Injectable()
export class BanksService {
  constructor(
    @InjectRepository(BankEntity)
    private readonly banksRepository: Repository<BankEntity>,
  ) {}

  /** Lista de bancos ativos para o seletor de cadastro manual. */
  async findAllActive(): Promise<BankEntity[]> {
    return this.banksRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  /** Resolve um banco pelo código COMPE (tolerante a zeros à esquerda / formatação). */
  async findByCompe(compe: string | null | undefined): Promise<BankEntity | null> {
    const code = normalizeCompe(compe);
    if (!code) return null;
    return this.banksRepository.findOne({ where: { compeCode: code } });
  }
}
