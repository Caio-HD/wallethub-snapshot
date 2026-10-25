import { Fragment, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '@shared/hooks/useFormatter';
import { PeriodPicker } from '@features/dashboard/PeriodPicker';
import { primaryMonthFromPeriod } from '@features/dashboard/periodUtils';
import { useGlobalScope } from '@shared/context/GlobalScopeContext';
import {
  useCategoryBudgets,
  useMonthlyBudget,
  useSetCategoryBudget,
  useSetMonthlyBudget,
  usePropagateEstimatedIncome,
  useDeleteCategoryBudget,
} from '@features/budgets/useBudgets';
import { useCategories } from '@features/categories/useCategories';
import { Card, CardContent, CardTitle } from '@shared/ui/card';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { Popover, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';


const currentMonth = format(new Date(), 'yyyy-MM');

export const BudgetsPage = () => {
  const { t } = useTranslation('budgets');
  const { formatCurrency } = useFormatter();
  const { scope } = useGlobalScope();
  const [isStandard, setIsStandard] = useState<boolean>(true);
  const [monthPeriod, setMonthPeriod] = useState<string>(currentMonth);
  const period = isStandard ? 'default' : monthPeriod;

  const [estimatedIncome, setEstimatedIncome] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categoryAmount, setCategoryAmount] = useState<string>('');

  useEffect(() => {
    if (!isStandard) {
      setMonthPeriod((p) => {
        const trimmed = p.trim();
        if (trimmed.includes(',') || !/^\d{4}-\d{2}$/.test(trimmed)) return primaryMonthFromPeriod(p);
        return trimmed;
      });
    }
  }, [isStandard]);

  const { data: categories = [] } = useCategories();
  const { data: categoryBudgets = [], isLoading: loadingCategoryBudgets } = useCategoryBudgets(
    scope,
    period,
  );
  const { data: monthlyBudget, isLoading: loadingMonthly } = useMonthlyBudget(scope, period);
  const setMonthlyMutation = useSetMonthlyBudget();
  const propagateMutation = usePropagateEstimatedIncome();
  const setCategoryMutation = useSetCategoryBudget(scope, period);
  const deleteCategoryMutation = useDeleteCategoryBudget(scope, period);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const totalCategoryLimits = categoryBudgets.reduce((acc, b) => acc + Number(b.amount), 0);
  const derivedLimitDisplay =
    monthlyBudget != null ? Number(monthlyBudget.amount) : totalCategoryLimits;

  const parseIncome = (): number | undefined => {
    if (!estimatedIncome.trim()) return undefined;
    return Number(estimatedIncome.replace(',', '.'));
  };

  const handleSaveStandard = async () => {
    const incomeValue = parseIncome();
    if (incomeValue === undefined || !Number.isFinite(incomeValue) || incomeValue < 0) {
      toast.error(t('toasts.invalidIncome'));
      return;
    }
    try {
      await propagateMutation.mutateAsync({
        userId: scope === 'all' ? undefined : scope,
        fromPeriod: currentMonth,
        estimatedAverageIncome: incomeValue,
      });
      toast.success(t('toasts.propagateSuccess'));
      setEstimatedIncome('');
    } catch {
      toast.error(t('toasts.propagateError'));
    }
  };

  const handleSaveMonthly = async () => {
    const raw = estimatedIncome.trim();
    let incomeValue: number | undefined;
    if (raw !== '') {
      incomeValue = Number(raw.replace(',', '.'));
      if (!Number.isFinite(incomeValue) || incomeValue < 0) {
        toast.error(t('toasts.invalidMonthlyIncome'));
        return;
      }
    }
    try {
      await setMonthlyMutation.mutateAsync({
        userId: scope === 'all' ? undefined : scope,
        period: monthPeriod,
        ...(incomeValue !== undefined ? { estimatedAverageIncome: incomeValue } : {}),
      });
      toast.success(t('toasts.monthlySuccess'));
      setEstimatedIncome('');
    } catch {
      toast.error(t('toasts.monthlyError'));
    }
  };

  const handleSaveCategory = async () => {
    if (!selectedCategoryId) {
      toast.error(t('toasts.noCategorySelected'));
      return;
    }
    const value = Number(categoryAmount.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) {
      toast.error(t('toasts.invalidAmount'));
      return;
    }
    try {
      await setCategoryMutation.mutateAsync({
        categoryId: selectedCategoryId,
        userId: scope === 'all' ? undefined : scope,
        period,
        amount: value,
      });
      toast.success(t('toasts.categoryLimitSuccess'));
      setSelectedCategoryId('');
      setCategoryAmount('');
    } catch {
      toast.error(t('toasts.categoryLimitError'));
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!window.confirm(t('confirmDeleteCategory'))) return;
    try {
      await deleteCategoryMutation.mutateAsync(categoryId);
      toast.success(t('toasts.categoryLimitDeleteSuccess'));
    } catch {
      toast.error(t('toasts.categoryLimitDeleteError'));
    }
  };

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const savePending = setMonthlyMutation.isPending || propagateMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex rounded-xl bg-slate-900/50 p-1 ring-1 ring-white/5 shadow-soft-xl">
          <button
            type="button"
            onClick={() => setIsStandard(true)}
            className={`px-4 py-1.5 text-sm font-medium transition-all rounded-lg ${
              isStandard ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('modeStandard')}
          </button>
          <button
            type="button"
            onClick={() => setIsStandard(false)}
            className={`px-4 py-1.5 text-sm font-medium transition-all rounded-lg ${
              !isStandard ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('modeMonthly')}
          </button>
        </div>
        {!isStandard && (
          <PeriodPicker
            value={monthPeriod}
            onChange={setMonthPeriod}
            selectionMode="single"
          />
        )}
      </section>

      <Card>
        <CardTitle className="mb-3 px-4 pt-4 text-sm font-semibold text-foreground/80">
          {isStandard ? 'Configuração do Orçamento Padrão' : `Ajuste para ${monthPeriod}`}
        </CardTitle>
        <CardContent className="px-4 pb-4 pt-0 space-y-6">
          {loadingMonthly ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-950/20 border border-white/5">
              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">
                      Limite de gastos (soma das categorias)
                    </label>
                    <p className="text-lg font-semibold text-emerald-400">
                      {formatCurrency(derivedLimitDisplay)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                      O valor guardado acompanha automaticamente os limites por categoria neste
                      período.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-sky-400/80">
                      Receita média estimada (R$)
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={
                          monthlyBudget?.estimatedAverageIncome
                            ? String(monthlyBudget.estimatedAverageIncome)
                            : '0,00'
                        }
                        value={estimatedIncome}
                        onChange={(e) => setEstimatedIncome(e.target.value)}
                        className="w-40 border-sky-500/30 focus:border-sky-500/60"
                        aria-describedby={isStandard ? 'income-help-standard' : 'income-help-monthly'}
                      />
                      {monthlyBudget?.estimatedAverageIncome && (
                        <span className="text-sm font-medium text-sky-400">
                          {formatCurrency(Number(monthlyBudget.estimatedAverageIncome))}
                        </span>
                      )}
                    </div>
                    {isStandard ? (
                      <p id="income-help-standard" className="mt-1 text-[11px] text-muted-foreground">
                        Ao guardar, aplica-se a receita a partir do mês atual e aos meses futuros
                        (sobrescrevível por mês na aba Mensal).
                      </p>
                    ) : (
                      <p id="income-help-monthly" className="mt-1 text-[11px] text-muted-foreground">
                        Altera só este mês. Deixe em branco e salve para sincronizar o limite sem
                        mudar a receita.
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={isStandard ? handleSaveStandard : handleSaveMonthly}
                    disabled={savePending}
                    size="sm"
                    className="w-fit mt-2"
                  >
                    {savePending
                      ? 'Salvando…'
                      : isStandard
                        ? 'Aplicar receita estimada (futuro)'
                        : 'Salvar receita deste mês'}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-4 bg-white/5 p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Soma dos limites (categorias)</span>
                  <span className="text-lg font-bold text-white">
                    {formatCurrency(totalCategoryLimits)}
                  </span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Diferença (Receita - Limite)</span>
                  <span
                    className={`text-lg font-bold ${
                      (Number(monthlyBudget?.estimatedAverageIncome ?? 0) - totalCategoryLimits) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(
                      Number(monthlyBudget?.estimatedAverageIncome ?? 0) - totalCategoryLimits,
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardTitle className="mb-3 px-4 pt-4 text-sm font-semibold text-foreground/80">
          Limite por categoria
        </CardTitle>
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Categoria</label>
              <Popover className="relative">
                {({ open, close }) => (
                  <>
                    <Popover.Button
                      className={`flex h-11 w-48 items-center justify-between rounded-[var(--radius-md)] border bg-background/60 px-3 text-sm text-foreground shadow-soft-md outline-none transition-colors hover:bg-slate-900/60 focus:ring-2 focus:ring-sky-500/50 ${
                        open ? 'border-sky-500/50 ring-2 ring-sky-500/20' : 'border-input'
                      }`}
                    >
                      <span className="block truncate text-left">
                        {selectedCategoryId ? categoryName(selectedCategoryId) : 'Selecione'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-white/40" />
                    </Popover.Button>

                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="opacity-0 translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition ease-in duration-150"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 translate-y-1"
                    >
                      <Popover.Panel
                        anchor="bottom start"
                        className="z-50 flex w-64 flex-col rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md [--anchor-gap:8px] focus:outline-none sm:w-80"
                      >
                        <div className="custom-scrollbar max-h-[300px] overflow-y-auto pr-1">
                          <h3 className="mb-2 pl-1 text-xs font-semibold text-slate-400">
                            Selecionar Categoria
                          </h3>
                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2">
                            {expenseCategories.map((c) => {
                              const isSelected = selectedCategoryId === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCategoryId(c.id);
                                    close();
                                  }}
                                  className={`relative flex flex-col items-center justify-center rounded-lg px-2 py-2 text-[12px] font-medium transition-all ${
                                    isSelected
                                      ? 'bg-sky-500/20 text-sky-300 shadow-sm ring-1 ring-sky-500/50'
                                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                                  }`}
                                >
                                  <span className="w-full truncate text-center">{c.name}</span>
                                  {isSelected && (
                                    <Check className="absolute right-1 top-1 h-3 w-3 opacity-70" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </Popover.Panel>
                    </Transition>
                  </>
                )}
              </Popover>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Limite (R$)</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={categoryAmount}
                onChange={(e) => setCategoryAmount(e.target.value)}
                className="w-32"
              />
            </div>
            <Button
              type="button"
              onClick={handleSaveCategory}
              disabled={setCategoryMutation.isPending}
              size="sm"
            >
              {setCategoryMutation.isPending ? 'Salvando…' : 'Definir'}
            </Button>
          </div>
          {loadingCategoryBudgets ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : categoryBudgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum limite por categoria definido para este período.
            </p>
          ) : (
            <ul className="space-y-2">
              {categoryBudgets.map((b) => (
                <li
                  key={b.id}
                  className="grid grid-cols-[1fr_auto_80px] sm:grid-cols-[1fr_100px_100px_100px] items-center gap-4 rounded-2xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/60 transition-all px-4 py-3 text-sm shadow-sm"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold text-slate-100 truncate">
                      {categoryName(b.categoryId)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      Categoria
                    </span>
                  </div>

                  <div className="flex flex-col items-end sm:items-center">
                    <span className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">
                      Média (3m)
                    </span>
                    <span className="font-medium text-slate-300">
                      {formatCurrency(b.averageSpent ?? 0)}
                    </span>
                  </div>

                  <div className="flex flex-col items-end sm:items-center">
                    <span className="text-[10px] text-emerald-500/80 uppercase font-bold mb-0.5">
                      Limite
                    </span>
                    <span className="font-bold text-emerald-400">
                      {formatCurrency(Number(b.amount))}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => handleDeleteCategory(b.categoryId)}
                      disabled={deleteCategoryMutation.isPending}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 rounded-full"
                      title="Remover Limite"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
