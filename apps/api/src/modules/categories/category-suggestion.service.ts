import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';

export type CategorySuggestion = {
  categoryId: string | null;
  /** 0–1 heurístico; valores baixos indicam pouca evidência. */
  confidence: number;
};

/** Normaliza texto de descrição para tokens estáveis (PT sem acentos). */
export function normalizeStatementDescription(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensFromNormalized(norm: string): string[] {
  return norm.split(' ').filter((t) => t.length >= 3);
}

@Injectable()
export class CategorySuggestionService {
  private static readonly MAX_TX_SAMPLE = 500;

  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    @InjectRepository(OrganizationMembershipEntity)
    private readonly membershipsRepository: Repository<OrganizationMembershipEntity>,
  ) {}

  /**
   * Sugestões por linha com base no histórico de transações do mesmo tipo (receita/despesa).
   */
  async suggestForDescriptions(
    organizationId: string,
    categoryType: 'income' | 'expense',
    descriptions: string[],
  ): Promise<CategorySuggestion[]> {
    if (descriptions.length === 0) {
      return [];
    }

    const members = await this.membershipsRepository.find({
      where: { organizationId, status: 'active' },
      select: { userId: true },
    });
    const userIds = [...new Set(members.map((m) => m.userId))];
    if (userIds.length === 0) {
      return descriptions.map(() => ({ categoryId: null, confidence: 0 }));
    }

    const txs = await this.transactionsRepository.find({
      where: {
        user: { id: In(userIds) },
        category: { type: categoryType, organizationId },
      },
      relations: { category: true },
      order: { occurredAt: 'DESC' },
      take: CategorySuggestionService.MAX_TX_SAMPLE,
    });

    const fullLineVotes = new Map<string, Map<string, number>>();
    const tokenVotes = new Map<string, Map<string, number>>();

    const bump = (map: Map<string, Map<string, number>>, key: string, categoryId: string) => {
      let inner = map.get(key);
      if (!inner) {
        inner = new Map();
        map.set(key, inner);
      }
      inner.set(categoryId, (inner.get(categoryId) ?? 0) + 1);
    };

    for (const tx of txs) {
      const cid = tx.category.id;
      const norm = normalizeStatementDescription(tx.description ?? '');
      if (!norm) continue;
      bump(fullLineVotes, norm, cid);
      for (const tok of tokensFromNormalized(norm)) {
        bump(tokenVotes, tok, cid);
      }
    }

    const pickBest = (m: Map<string, number>): { id: string; score: number } | null => {
      let bestId: string | null = null;
      let best = 0;
      for (const [id, c] of m) {
        if (c > best) {
          best = c;
          bestId = id;
        }
      }
      return bestId && best > 0 ? { id: bestId, score: best } : null;
    };

    return descriptions.map((raw) => {
      const norm = normalizeStatementDescription(raw);
      if (!norm) {
        return { categoryId: null, confidence: 0 };
      }
      const fullMap = fullLineVotes.get(norm);
      if (fullMap) {
        const best = pickBest(fullMap);
        if (best && best.score >= 1) {
          const total = [...fullMap.values()].reduce((a, b) => a + b, 0);
          return {
            categoryId: best.id,
            confidence: Math.min(1, best.score / (total + 0.5)),
          };
        }
      }
      const scores = new Map<string, number>();
      for (const tok of tokensFromNormalized(norm)) {
        const inner = tokenVotes.get(tok);
        if (!inner) continue;
        for (const [cid, c] of inner) {
          scores.set(cid, (scores.get(cid) ?? 0) + c);
        }
      }
      if (scores.size === 0) {
        return { categoryId: null, confidence: 0 };
      }
      let bestId = '';
      let bestScore = 0;
      let sum = 0;
      for (const [cid, s] of scores) {
        sum += s;
        if (s > bestScore) {
          bestScore = s;
          bestId = cid;
        }
      }
      if (bestScore < 2) {
        return { categoryId: null, confidence: bestScore / (sum + 1) };
      }
      return {
        categoryId: bestId,
        confidence: Math.min(1, bestScore / (sum + 0.01)),
      };
    });
  }
}
