import { BanksService } from '@app/modules/banks/banks.service';
import type { Repository } from 'typeorm';
import type { BankEntity } from '@app/database/entities/bank.entity';

describe('BanksService.findByCompe', () => {
  const mkRepo = () => {
    const findOne = jest.fn().mockResolvedValue({ compeCode: '001', name: 'Banco do Brasil S.A.' });
    return { repo: { findOne } as unknown as Repository<BankEntity>, findOne };
  };

  it('normaliza COMPE para 3 dígitos (zero-pad) antes de buscar', async () => {
    const { repo, findOne } = mkRepo();
    const svc = new BanksService(repo);
    await svc.findByCompe('1');
    expect(findOne).toHaveBeenCalledWith({ where: { compeCode: '001' } });
  });

  it('aceita código já com 3 dígitos e remove não-dígitos', async () => {
    const { repo, findOne } = mkRepo();
    const svc = new BanksService(repo);
    await svc.findByCompe('341');
    expect(findOne).toHaveBeenCalledWith({ where: { compeCode: '341' } });
    await svc.findByCompe(' 077 ');
    expect(findOne).toHaveBeenCalledWith({ where: { compeCode: '077' } });
  });

  it('retorna null sem buscar quando vazio/nulo', async () => {
    const { repo, findOne } = mkRepo();
    const svc = new BanksService(repo);
    expect(await svc.findByCompe(null)).toBeNull();
    expect(await svc.findByCompe('')).toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });
});
