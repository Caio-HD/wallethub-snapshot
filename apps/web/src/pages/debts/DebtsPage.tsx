import { useMemo, useState } from 'react';
import { Landmark, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useDebts, useDebtDetail } from '@features/debts/useDebts';
import { useAccounts } from '@features/accounts/useAccounts';
import { useCategories } from '@features/categories/useCategories';
import { Card, CardContent } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { useFormatter } from '@shared/hooks/useFormatter';
import { cn } from '@shared/utils/cn';

export const DebtsPage = () => {
  const { formatCurrency } = useFormatter();
  const { debts, isLoading, createDebt, payInstallment, unpayInstallment, skipInstallment, payRemaining, removeDebt } =
    useDebts();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' && c.isActive),
    [categories],
  );
  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [installments, setInstallments] = useState('12');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');

  const { data: detail } = useDebtDetail(expandedId);

  const handleCreate = async () => {
    if (!name.trim() || !categoryId) {
      toast.error('Preencha nome e categoria.');
      return;
    }
    const principalAmount = Number.parseFloat(principal);
    const totalInstallments = Number.parseInt(installments, 10);
    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      toast.error('Valor principal inválido.');
      return;
    }
    if (!Number.isFinite(totalInstallments) || totalInstallments < 1) {
      toast.error('Número de parcelas inválido.');
      return;
    }
    try {
      await createDebt.mutateAsync({
        name: name.trim(),
        principalAmount,
        totalInstallments,
        startDate,
        categoryId,
        accountId: accountId || undefined,
      });
      setIsAdding(false);
      setName('');
      setPrincipal('');
      toast.success('Dívida criada.');
    } catch {
      toast.error('Não foi possível criar a dívida.');
    }
  };

  const defaultAccountId = accountId || activeAccounts[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-amber-300">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Dívidas</h1>
            <p className="text-sm text-muted-foreground">
              Cronograma parcelado, pagamentos e saldo devedor.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova dívida
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-2">
            <Input placeholder="Nome (ex.: Financiamento carro)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Valor total" type="number" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            <Input placeholder="Parcelas" type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} />
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <select
              className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Categoria de despesa</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Conta (opcional)</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
              <Button onClick={() => void handleCreate()} disabled={createDebt.isPending}>Criar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="divide-y divide-white/5 p-0">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">A carregar…</p>}
          {!isLoading && debts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma dívida registada.</p>
          )}
          {debts.map((debt) => {
            const expanded = expandedId === debt.id;
            const rows = expanded && detail?.id === debt.id ? detail.installments ?? [] : [];
            return (
              <div key={debt.id} className="p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 text-left"
                  onClick={() => setExpandedId(expanded ? null : debt.id)}
                >
                  <div>
                    <p className="font-medium">{debt.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {debt.progress} · {debt.status} · próximo {debt.nextDueDate ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-amber-200">
                      {formatCurrency(Number.parseFloat(debt.outstanding))}
                    </span>
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {expanded && rows.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!defaultAccountId || payRemaining.isPending || debt.pendingCount === 0}
                        onClick={() => {
                          void payRemaining.mutateAsync({ debtId: debt.id, accountId: defaultAccountId })
                            .then(() => toast.success('Dívida quitada.'))
                            .catch(() => toast.error('Falha ao quitar.'));
                        }}
                      >
                        Quitar restante
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm('Remover esta dívida?')) return;
                          void removeDebt.mutateAsync(debt.id)
                            .then(() => { setExpandedId(null); toast.success('Dívida removida.'); })
                            .catch(() => toast.error('Falha ao remover.'));
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-white/5">
                      <table className="min-w-full text-sm">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">Vencimento</th>
                            <th className="px-3 py-2 text-left">Valor</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                            <th className="px-3 py-2 text-right">Acções</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id} className="border-t border-white/5">
                              <td className="px-3 py-2">{row.sequenceNumber}</td>
                              <td className="px-3 py-2">{row.dueDate}</td>
                              <td className="px-3 py-2">{formatCurrency(Number.parseFloat(row.amount))}</td>
                              <td className="px-3 py-2">
                                <span className={cn(
                                  row.status === 'paid' && 'text-emerald-400',
                                  row.status === 'pending' && 'text-amber-300',
                                  row.status === 'skipped' && 'text-muted-foreground',
                                )}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right space-x-1">
                                {row.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      disabled={!defaultAccountId || payInstallment.isPending}
                                      onClick={() => {
                                        void payInstallment.mutateAsync({
                                          debtId: debt.id,
                                          installmentId: row.id,
                                          accountId: defaultAccountId,
                                        })
                                          .then(() => toast.success('Parcela paga.'))
                                          .catch(() => toast.error('Falha ao pagar.'));
                                      }}
                                    >
                                      Pagar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        void skipInstallment.mutateAsync({ debtId: debt.id, installmentId: row.id })
                                          .then(() => toast.success('Parcela ignorada.'))
                                          .catch(() => toast.error('Falha.'));
                                      }}
                                    >
                                      Ignorar
                                    </Button>
                                  </>
                                )}
                                {row.status === 'paid' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      void unpayInstallment.mutateAsync({ debtId: debt.id, installmentId: row.id })
                                        .then(() => toast.success('Pagamento desfeito.'))
                                        .catch(() => toast.error('Falha ao desfazer.'));
                                    }}
                                  >
                                    Desfazer
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
