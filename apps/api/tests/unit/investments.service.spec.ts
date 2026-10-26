/* eslint-disable @typescript-eslint/unbound-method -- expect() on jest.fn mocks of repo/queue methods */
import { InvestmentsService } from '../../src/modules/investments/investments.service';
import type { Repository } from 'typeorm';
import type { InvestmentInstrumentEntity } from '../../src/database/entities/investment-instrument.entity';
import type { InvestmentMovementEntity } from '../../src/database/entities/investment-movement.entity';
import type { InvestmentQuoteSnapshotEntity } from '../../src/database/entities/investment-quote-snapshot.entity';
import type { Queue } from 'bullmq';
import type { TransactionsService } from '../../src/modules/transactions/transactions.service';
import type { CreateInvestmentMovementDto } from '../../src/modules/investments/dto/create-investment-movement.dto';

type TransactionsMock = {
  createTransfer: jest.Mock;
  removeByTransferGroup: jest.Mock;
};

const mkTransactions = (): TransactionsMock => ({
  createTransfer: jest.fn().mockResolvedValue([{ transferGroupId: 'grp-1' }]),
  removeByTransferGroup: jest.fn().mockResolvedValue(undefined),
});

type TransferArg = { leg: string; amount: number; accountId: string };
type MovementPayload = { quantity: string; unitPrice: string; cashTransferGroupId?: string | null };

const firstArg = <T>(m: jest.Mock): T => (m.mock.calls as unknown[][])[0][0] as T;
const lastArg = <T>(m: jest.Mock): T => {
  const calls = m.mock.calls as unknown[][];
  return calls[calls.length - 1][0] as T;
};

/** Service pronto para exercitar createMovement/deleteMovement (instrumento novo, sem cotação). */
function buildCreateService() {
  const instruments = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((p: Partial<InvestmentInstrumentEntity>) => p),
    save: jest.fn((p: Partial<InvestmentInstrumentEntity>) => ({ id: 'inst-1', ...p })),
  } as unknown as Repository<InvestmentInstrumentEntity>;
  const movements = {
    create: jest.fn((p: Partial<InvestmentMovementEntity>) => p),
    save: jest.fn((p: Partial<InvestmentMovementEntity> & { id?: string }) => ({
      id: p.id ?? 'mov-1',
      ...p,
    })),
    softRemove: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<InvestmentMovementEntity>;
  const quotesQueue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as Queue;
  const transactions = mkTransactions();
  const svc = new InvestmentsService(
    instruments,
    movements,
    {} as unknown as Repository<InvestmentQuoteSnapshotEntity>,
    quotesQueue,
    transactions as unknown as TransactionsService,
  );
  return { svc, instruments, movements, quotesQueue, transactions };
}

function mockMovementRepoEmpty(): Pick<Repository<InvestmentMovementEntity>, 'createQueryBuilder'> {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
}

function mockMovementRepoFor(
  rows: Array<Partial<InvestmentMovementEntity>>,
): Repository<InvestmentMovementEntity> {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
    // portfolio path: no positions -> zeroed market value / pnl
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as unknown as Repository<InvestmentMovementEntity>;
}

describe('InvestmentsService', () => {
  it('getPeriodSummary agrega buys/sells/dividends do período', async () => {
    const movements = mockMovementRepoFor([
      { kind: 'buy', quantity: '10', unitPrice: '5', fees: '1' },
      { kind: 'sell', quantity: '2', unitPrice: '8', fees: '0' },
      { kind: 'dividend', quantity: '0', unitPrice: '20', fees: '0' },
    ] as Array<Partial<InvestmentMovementEntity>>);
    const instruments = {} as unknown as Repository<InvestmentInstrumentEntity>;
    const quotes = {} as unknown as Repository<InvestmentQuoteSnapshotEntity>;
    const quotesQueue = { add: jest.fn() } as unknown as Queue;

    const svc = new InvestmentsService(
      instruments,
      movements,
      quotes,
      quotesQueue,
      mkTransactions() as unknown as TransactionsService,
    );

    const r = await svc.getPeriodSummary('user-1', '2026-06');
    expect(r.period).toBe('2026-06');
    expect(r.totalBuys).toBe(51); // 10*5 + 1
    expect(r.totalSells).toBe(16); // 2*8 - 0
    expect(r.totalDividends).toBe(20); // qty 0 -> unitPrice
    expect(r.buyCount).toBe(1);
    expect(r.sellCount).toBe(1);
    expect(r.dividendCount).toBe(1);
    expect(r.totalMarketValue).toBe(0);
    expect(r.totalUnrealizedPnl).toBe(0);
  });

  it('getPeriodSummary rejeita período inválido', async () => {
    const movements = mockMovementRepoFor([]);
    const svc = new InvestmentsService(
      {} as unknown as Repository<InvestmentInstrumentEntity>,
      movements,
      {} as unknown as Repository<InvestmentQuoteSnapshotEntity>,
      { add: jest.fn() } as unknown as Queue,
      mkTransactions() as unknown as TransactionsService,
    );
    await expect(svc.getPeriodSummary('user-1', '2026/06')).rejects.toThrow();
  });

  it('getPortfolioSummary retorna vazio sem instrumentos', async () => {
    const movements = mockMovementRepoEmpty() as unknown as Repository<InvestmentMovementEntity>;
    const instruments = {} as unknown as Repository<InvestmentInstrumentEntity>;
    const quotes = {} as unknown as Repository<InvestmentQuoteSnapshotEntity>;
    const quotesQueue = { add: jest.fn() } as unknown as Queue;

    const svc = new InvestmentsService(
      instruments,
      movements,
      quotes,
      quotesQueue,
      mkTransactions() as unknown as TransactionsService,
    );

    const r = await svc.getPortfolioSummary('user-1');
    expect(r.totalCostBasis).toBe(0);
    expect(r.totalMarketValue).toBe(0);
    expect(r.positions).toEqual([]);
  });

  const fiBuy = (over: Partial<CreateInvestmentMovementDto> = {}): CreateInvestmentMovementDto =>
    ({
      symbol: 'RDB-NU',
      market: 'BR',
      kind: 'fixed_income',
      movementKind: 'buy',
      amount: 1000,
      ...over,
    }) as CreateInvestmentMovementDto;

  it('createMovement (renda fixa) mapeia amount→principal e NÃO enfileira cotação', async () => {
    const { svc, movements, quotesQueue } = buildCreateService();
    const saved = await svc.createMovement('user-1', fiBuy(), 'org-1');
    const createdPayload = firstArg<MovementPayload>(movements.create as jest.Mock);
    expect(createdPayload.quantity).toBe('1000.00000000'); // principal
    expect(createdPayload.unitPrice).toBe('1.00000000');
    expect(saved.id).toBe('mov-1');
    expect(quotesQueue.add).not.toHaveBeenCalled(); // renda fixa não tem cotação
  });

  it('createMovement (renda fixa) exige amount > 0', async () => {
    const { svc } = buildCreateService();
    await expect(
      svc.createMovement('user-1', fiBuy({ amount: undefined }), 'org-1'),
    ).rejects.toThrow();
  });

  it('aporte com conta de caixa cria transferência OUT (principal + fees)', async () => {
    const { svc, movements, transactions } = buildCreateService();
    await svc.createMovement('user-1', fiBuy({ accountId: 'acc-cash', fees: 5 }), 'org-1');
    expect(transactions.createTransfer).toHaveBeenCalledTimes(1);
    const arg = firstArg<TransferArg>(transactions.createTransfer);
    expect(arg.leg).toBe('out');
    expect(arg.amount).toBe(1005); // 1000 principal + 5 fees
    expect(arg.accountId).toBe('acc-cash');
    // grupo da transferência fica registrado no movimento (para reverter no delete)
    const lastSave = lastArg<MovementPayload>(movements.save as jest.Mock);
    expect(lastSave.cashTransferGroupId).toBe('grp-1');
  });

  it('aporte SEM conta de caixa não cria transferência', async () => {
    const { svc, transactions } = buildCreateService();
    await svc.createMovement('user-1', fiBuy(), 'org-1');
    expect(transactions.createTransfer).not.toHaveBeenCalled();
  });

  it('resgate com conta de caixa cria transferência IN', async () => {
    const { svc, movements, transactions } = buildCreateService();
    // posição suficiente para o resgate
    (movements.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([{ kind: 'buy', quantity: '2000', unitPrice: '1', fees: '0' }]),
    });
    await svc.createMovement(
      'user-1',
      fiBuy({ movementKind: 'sell', amount: 800, accountId: 'acc-cash' }),
      'org-1',
    );
    const arg = firstArg<TransferArg>(transactions.createTransfer);
    expect(arg.leg).toBe('in');
    expect(arg.amount).toBe(800);
  });

  it('deleteMovement reverte a transferência de caixa vinculada', async () => {
    const { svc, movements, transactions } = buildCreateService();
    (movements.findOne as jest.Mock).mockResolvedValue({
      id: 'mov-1',
      userId: 'user-1',
      cashTransferGroupId: 'grp-9',
    });
    await svc.deleteMovement('user-1', 'mov-1');
    expect(transactions.removeByTransferGroup).toHaveBeenCalledWith('grp-9', 'user-1');
    expect(movements.softRemove).toHaveBeenCalled();
  });
});
