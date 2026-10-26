import type React from 'react';
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Trash2,
  Eye,
  ChevronDown,
  Building2,
  Tags,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { toast } from 'sonner';
import { useAccounts } from '@features/accounts/useAccounts';
import { useBanks, normCompe } from '@features/accounts/useBanks';
import { BankCombobox } from '@features/accounts/BankCombobox';
import { useCategories, type Category } from '@features/categories/useCategories';
import { StatementImportPanel } from '@features/transactions/StatementImportPanel';
import {
  useStatementBatches,
  useStatementBatchDetail,
  useDeleteStatementBatch,
  useCategoryMappings,
  statementBatchesQueryKey,
  type StatementBatchSummary,
} from '@features/transactions/useStatementBatches';
import {
  useUncategorizedGroups,
  useBulkCategorize,
  uncategorizedQueryKey,
  type UncategorizedGroup,
} from '@features/transactions/useUncategorized';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';
import { Card, CardContent } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Badge } from '@shared/ui/badge';
import { cn } from '@shared/utils/cn';
import { useFormatter } from '@shared/hooks/useFormatter';

const BatchRow = ({
  batch,
  bankLabel,
  bcp47,
  onDelete,
}: {
  batch: StatementBatchSummary;
  bankLabel: string;
  bcp47: string;
  onDelete: (batch: StatementBatchSummary) => void;
}) => {
  const { t } = useTranslation('ofxAudit');
  const { categories } = useCategories();
  const [expanded, setExpanded] = useState(false);
  const detail = useStatementBatchDetail(expanded ? batch.id : null);

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{batch.filename}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {bankLabel}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
              {new Date(batch.createdAt).toLocaleString(bcp47, {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-sky-400">
              {batch.liveTransactionCount < batch.transactionCount
                ? t('batches.liveOfTotal', {
                    live: batch.liveTransactionCount,
                    total: batch.transactionCount,
                  })
                : t('batches.count', { count: batch.transactionCount })}
            </span>
          </div>
        </div>
        <Badge variant={batch.format === 'ofx' ? 'info' : 'neutral'}>{batch.format}</Badge>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-sky-400"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <Eye className="h-3.5 w-3.5" />
          {t('batches.view')}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-rose-400"
          onClick={() => onDelete(batch)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('batches.delete')}
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
              {detail.isLoading ? (
                <p className="text-[11px] text-muted-foreground">{t('common.loading')}</p>
              ) : detail.data && detail.data.transactions.length > 0 ? (
                <ul className="space-y-1.5 text-[11px] text-foreground/90">
                  {detail.data.transactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex flex-wrap items-center gap-2 rounded border border-white/5 bg-black/20 p-2"
                    >
                      <span className="font-mono text-[10px] text-white/70">
                        {new Date(tx.occurredAt).toLocaleDateString(bcp47)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {tx.description ?? t('batches.noDescription')}
                      </span>
                      <span className="text-[9px] uppercase text-muted-foreground">
                        {categoryName(tx.categoryId)}
                      </span>
                      <span
                        className={cn(
                          'font-mono font-semibold',
                          tx.direction === 'income' ? 'text-emerald-400' : 'text-rose-400',
                        )}
                      >
                        {tx.direction === 'income' ? '+' : '-'}
                        {Math.abs(parseFloat(tx.amount)).toLocaleString(bcp47, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">{t('batches.emptyDetail')}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Aba "Categorizar": agrupa as transações "Sem categoria" por descrição e categoriza em lote. */
const CategorizeTab = ({
  accountId,
  general,
  categories,
  bcp47,
  onChanged,
}: {
  accountId: string | undefined;
  general: boolean;
  categories: Category[];
  bcp47: string;
  onChanged: () => void;
}) => {
  const { t } = useTranslation('ofxAudit');
  const groupsQuery = useUncategorizedGroups(accountId, { includeAll: general });
  const bulkCategorize = useBulkCategorize();
  const [picked, setPicked] = useState<Record<string, string>>({});

  const keyOf = (g: UncategorizedGroup) => `${g.direction}|${g.descriptionKey}`;

  const apply = async (g: UncategorizedGroup) => {
    const categoryId = picked[keyOf(g)];
    if (!categoryId) return;
    try {
      const res = await bulkCategorize.mutateAsync({ transactionIds: g.transactionIds, categoryId });
      toast.success(t('categorize.applied', { count: res.updated }));
      if (res.skipped.length > 0) {
        toast.warning(t('categorize.skipped', { count: res.skipped.length }), {
          description: t('categorize.skippedHint'),
        });
      }
      onChanged();
    } catch {
      toast.error(t('categorize.error'));
    }
  };

  const groups = groupsQuery.data ?? [];

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-[11px] text-muted-foreground">{t('categorize.hint')}</p>
        {groupsQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t('categorize.empty')}
          </div>
        ) : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/5">
            {groups.map((g) => {
              const ofType = categories.filter((c) => c.type === g.direction && !c.isSystem);
              const signed = (g.direction === 'expense' ? -1 : 1) * Number(g.totalAmount);
              return (
                <div
                  key={keyOf(g)}
                  className="flex flex-wrap items-center gap-3 px-3 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {g.descriptionSample}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t('categorize.count', { count: g.count })}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          g.direction === 'expense' ? 'text-rose-300' : 'text-emerald-300',
                        )}
                      >
                        {g.direction === 'expense' ? '-' : '+'}
                        {Math.abs(signed).toLocaleString(bcp47, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-sky-400">
                        {t(g.direction === 'income' ? 'categorize.income' : 'categorize.expense')}
                      </span>
                    </div>
                  </div>
                  {ofType.length === 0 ? (
                    <span className="text-[11px] text-amber-300">
                      {t('categorize.noCategoryOfType')}
                    </span>
                  ) : (
                    <>
                      <select
                        className="h-10 w-48 rounded-full border border-sky-500/20 bg-slate-900/40 px-3 text-sm font-semibold text-foreground outline-none focus:border-sky-500/50"
                        value={picked[keyOf(g)] ?? ''}
                        onChange={(e) =>
                          setPicked((prev) => ({ ...prev, [keyOf(g)]: e.target.value }))
                        }
                      >
                        <option value="">{t('categorize.selectCategory')}</option>
                        {ofType.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!picked[keyOf(g)] || bulkCategorize.isPending}
                        onClick={() => void apply(g)}
                      >
                        {t('categorize.apply')}
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const OfxAuditPage = () => {
  const { t } = useTranslation('ofxAudit');
  const { accountId = '' } = useParams<{ accountId: string }>();
  const { bcp47 } = useFormatter();
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();

  const { accounts, updateAccount } = useAccounts();
  const { categories } = useCategories();
  const { banks } = useBanks();
  const account = accounts.find((a) => a.id === accountId);
  // Modo geral (sem conta na rota): entrada de import quando não há conta cadastrada.
  // Lista todos os lotes da org e oculta o vínculo banco↔conta (específico de conta).
  const general = !accountId;

  const batchesQuery = useStatementBatches(accountId || undefined, { includeAll: general });
  const deleteBatch = useDeleteStatementBatch();
  const { mappings, createMapping, deleteMapping } = useCategoryMappings();

  const [pendingDelete, setPendingDelete] = useState<StatementBatchSummary | null>(null);

  // Config — vínculo banco↔conta
  const [editBankId, setEditBankId] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [bankFormReady, setBankFormReady] = useState(false);
  if (account && !bankFormReady) {
    setEditBankId(account.bankId ?? '');
    setEditBranch(account.branchNumber ?? '');
    setEditAccountNumber(account.accountNumber ?? '');
    setBankFormReady(true);
  }

  // Config — novo mapeamento
  const [newMapDescription, setNewMapDescription] = useState('');
  const [newMapCategoryId, setNewMapCategoryId] = useState('');

  const bankLabelFor = useMemo(
    () => (compe: string | null) => {
      if (!compe) return t('batches.noBank');
      const bank = banks.find((b) => normCompe(b.compeCode) === normCompe(compe));
      return bank ? `${bank.compeCode} — ${bank.name}` : compe;
    },
    [banks, t],
  );

  const invalidateBatches = () =>
    void queryClient.invalidateQueries({
      queryKey: statementBatchesQueryKey(activeOrganizationId, accountId || undefined),
    });

  const handleSaveBank = async () => {
    try {
      await updateAccount.mutateAsync({
        id: accountId,
        dto: {
          bankId: editBankId.trim() || null,
          branchNumber: editBranch.trim() || null,
          accountNumber: editAccountNumber.trim() || null,
        },
      });
      toast.success(t('toasts.bankSaved'));
    } catch {
      toast.error(t('toasts.bankError'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const result = await deleteBatch.mutateAsync(pendingDelete.id);
      toast.success(t('toasts.deleted', { count: result.deleted }));
      if (result.skipped.length > 0) {
        toast.warning(t('toasts.skipped', { count: result.skipped.length }), {
          description: t('toasts.skippedHint'),
        });
      }
      invalidateBatches();
    } catch {
      toast.error(t('toasts.deleteError'));
    } finally {
      setPendingDelete(null);
    }
  };

  const handleAddMapping = async () => {
    if (!newMapDescription.trim() || !newMapCategoryId) return;
    try {
      await createMapping.mutateAsync({
        description: newMapDescription.trim(),
        categoryId: newMapCategoryId,
      });
      setNewMapDescription('');
      setNewMapCategoryId('');
      toast.success(t('toasts.mappingAdded'));
    } catch {
      toast.error(t('toasts.mappingError'));
    }
  };

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';

  const tabClass = ({ selected }: { selected: boolean }) =>
    cn(
      'rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider outline-none transition-all',
      selected
        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
        : 'border border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/accounts"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition-all hover:border-sky-500/40 hover:text-sky-400"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/30 to-indigo-500/30 text-sky-300">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {account ? account.name : general ? t('subtitleAll', 'Todas as contas') : t('subtitle')}
            </p>
          </div>
        </div>
      </div>

      <TabGroup>
        <TabList className="flex flex-wrap gap-2">
          <Tab className={tabClass}>{t('tabs.import')}</Tab>
          <Tab className={tabClass}>{t('tabs.batches')}</Tab>
          <Tab className={tabClass}>{t('tabs.categorize')}</Tab>
          <Tab className={tabClass}>{t('tabs.config')}</Tab>
        </TabList>

        <TabPanels className="mt-4">
          {/* Import (+ reprocessar/re-preview) */}
          <TabPanel className="space-y-4 outline-none">
            <p className="text-[11px] text-muted-foreground">{t('import.hint')}</p>
            {categories.length > 0 ? (
              <StatementImportPanel
                accounts={accounts}
                categories={categories}
                initialAccountId={accountId || undefined}
                onImportSuccess={invalidateBatches}
              />
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t('import.noCategories')}
                </CardContent>
              </Card>
            )}
          </TabPanel>

          {/* Importações (audit list) */}
          <TabPanel className="outline-none">
            <Card>
              <CardContent className="p-0">
                {batchesQuery.isLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                  </div>
                ) : (batchesQuery.data ?? []).length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {t('batches.empty')}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {(batchesQuery.data ?? []).map((batch) => (
                      <BatchRow
                        key={batch.id}
                        batch={batch}
                        bankLabel={bankLabelFor(batch.detectedBankId)}
                        bcp47={bcp47}
                        onDelete={setPendingDelete}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabPanel>

          {/* Categorizar em lote */}
          <TabPanel className="outline-none">
            <CategorizeTab
              accountId={accountId || undefined}
              general={general}
              categories={categories}
              bcp47={bcp47}
              onChanged={() => {
                void queryClient.invalidateQueries({
                  queryKey: uncategorizedQueryKey(activeOrganizationId, accountId || undefined),
                });
                invalidateBatches();
                void queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
              }}
            />
          </TabPanel>

          {/* Config */}
          <TabPanel className="space-y-6 outline-none">
            {/* Vínculo banco↔conta (apenas no modo por conta) */}
            {!general && (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-sky-400" />
                  <h2 className="text-sm font-bold text-foreground">{t('config.bankTitle')}</h2>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('config.bankHint')}</p>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-72 space-y-2">
                    <label className="pl-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                      {t('config.bank')}
                    </label>
                    <BankCombobox
                      banks={banks}
                      value={editBankId}
                      onChange={setEditBankId}
                      placeholder={t('config.bankPlaceholder')}
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <label className="pl-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                      {t('config.branch')}
                    </label>
                    <Input
                      value={editBranch}
                      onChange={(e) => setEditBranch(e.target.value)}
                      placeholder="0001"
                      className="rounded-full border-sky-500/20 bg-slate-900/40 focus:border-sky-500/50"
                    />
                  </div>
                  <div className="w-40 space-y-2">
                    <label className="pl-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                      {t('config.account')}
                    </label>
                    <Input
                      value={editAccountNumber}
                      onChange={(e) => setEditAccountNumber(e.target.value)}
                      placeholder="12345-6"
                      className="rounded-full border-sky-500/20 bg-slate-900/40 focus:border-sky-500/50"
                    />
                  </div>
                  <Button
                    onClick={handleSaveBank}
                    disabled={updateAccount.isPending || !account}
                    className="px-6"
                  >
                    {t('config.save')}
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Mapeamento de categorias */}
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Tags className="h-4 w-4 text-sky-400" />
                  <h2 className="text-sm font-bold text-foreground">{t('config.mappingsTitle')}</h2>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('config.mappingsHint')}</p>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[160px] space-y-2">
                    <label className="pl-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                      {t('config.description')}
                    </label>
                    <Input
                      value={newMapDescription}
                      onChange={(e) => setNewMapDescription(e.target.value)}
                      placeholder={t('config.descriptionPlaceholder')}
                      className="rounded-full border-sky-500/20 bg-slate-900/40 focus:border-sky-500/50"
                    />
                  </div>
                  <div className="w-56 space-y-2">
                    <label className="pl-1 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                      {t('config.category')}
                    </label>
                    <select
                      className="h-11 w-full rounded-full border border-sky-500/20 bg-slate-900/40 px-4 text-sm font-semibold text-foreground outline-none focus:border-sky-500/50"
                      value={newMapCategoryId}
                      onChange={(e) => setNewMapCategoryId(e.target.value)}
                    >
                      <option value="">{t('config.selectCategory')}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleAddMapping}
                    disabled={
                      createMapping.isPending || !newMapDescription.trim() || !newMapCategoryId
                    }
                    className="gap-1.5 px-5"
                  >
                    <Plus className="h-4 w-4" />
                    {t('config.add')}
                  </Button>
                </div>

                {mappings.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{t('config.mappingsEmpty')}</p>
                ) : (
                  <div className="divide-y divide-white/5 rounded-xl border border-white/5">
                    {mappings.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
                          {m.descriptionSample}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-sky-400">
                          {categoryName(m.categoryId)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                          onClick={() => deleteMapping.mutate(m.id)}
                          aria-label={t('config.removeMapping')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setPendingDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">{t('delete.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('delete.body', { filename: pendingDelete.filename })}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                  {t('delete.cancel')}
                </Button>
                <Button
                  variant="secondary"
                  className="border-rose-500/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                  disabled={deleteBatch.isPending}
                  onClick={handleConfirmDelete}
                >
                  {t('delete.confirm')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
