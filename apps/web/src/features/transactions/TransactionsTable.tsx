import { Fragment, useMemo, useState } from 'react';
import { Check, Download, ListFilter, Paperclip, Pencil, Search, Trash2, X } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { Transaction } from './useTransactions';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { cn } from '@shared/utils/cn';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '@shared/hooks/useFormatter';
import { useLocale } from '@shared/hooks/useLocale';

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onDownloadAttachment?: (transaction: Transaction) => void;
  onDeleteAttachment?: (transaction: Transaction) => void;
}

export interface ColumnFiltersState {
  date: string;
  description: string;
  /** Seleções múltiplas (OR): a linha passa se a categoria corresponder a qualquer valor (contém, case-insensitive). */
  category: string[];
  account: string[];
  amount: string;
}

function isMessagingChannelSource(source: Transaction['source']): boolean {
  return source === 'whatsapp' || source === 'telegram';
}

function messagingChannelLabel(source: Transaction['source']): string {
  return source === 'telegram' ? 'Telegram' : 'WhatsApp';
}

export function matchesColumnFilters(
  transaction: Transaction,
  filters: ColumnFiltersState,
  noCategory: string,
  noAccount: string,
  formatCurrency: (v: number) => string,
  formatDate: (s: string | null | undefined) => string,
): boolean {
  const amount = Number(transaction.amount || 0);
  const dateStr = formatDate(transaction.occurredAt);
  const desc = transaction.description ?? '—';
  const categoryName = transaction.category?.name ?? noCategory;
  const accountName = transaction.account?.name ?? noAccount;
  const valueStr = formatCurrency(amount);

  function includesInsensitive(haystack: string, needle: string): boolean {
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }

  if (filters.date.trim() && !includesInsensitive(dateStr, filters.date.trim())) return false;
  if (filters.description.trim() && !includesInsensitive(desc, filters.description.trim())) return false;

  const categoryTokens = filters.category.map((s) => s.trim()).filter(Boolean);
  if (categoryTokens.length > 0 && !categoryTokens.some((token) => includesInsensitive(categoryName, token))) return false;

  const accountTokens = filters.account.map((s) => s.trim()).filter(Boolean);
  if (accountTokens.length > 0 && !accountTokens.some((token) => includesInsensitive(accountName, token))) return false;

  if (filters.amount.trim() && !includesInsensitive(valueStr, filters.amount.trim())) return false;

  return true;
}

const emptyFilters: ColumnFiltersState = {
  date: '',
  description: '',
  category: [],
  account: [],
  amount: '',
};

const panelClass =
  'z-[50] w-[min(100vw-2rem,18rem)] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl focus:outline-none';

type AnchorTo = 'bottom start' | 'bottom end';

function filterOptionsByQuery(options: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.toLowerCase().includes(q));
}

function optionIsSelected(selected: string[], name: string): boolean {
  return selected.some((s) => s.toLowerCase() === name.toLowerCase());
}

function FilterSearchPickList({
  options,
  selected,
  onSelectedChange,
  ariaLabel,
  emptyHint,
  hint,
  searchPlaceholder,
  clearSearchLabel,
  removeChipPrefix,
}: {
  options: string[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  ariaLabel: string;
  emptyHint: string;
  hint: string;
  searchPlaceholder: string;
  clearSearchLabel: string;
  removeChipPrefix: (name: string) => string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterOptionsByQuery(options, query), [options, query]);

  const toggle = (name: string) => {
    if (optionIsSelected(selected, name)) {
      onSelectedChange(selected.filter((s) => s.toLowerCase() !== name.toLowerCase()));
    } else {
      onSelectedChange([...selected, name]);
    }
  };

  const removeChip = (name: string) => {
    onSelectedChange(selected.filter((s) => s !== name));
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto custom-scrollbar">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 pl-2.5 pr-1 py-0.5 text-[11px] font-medium text-sky-100"
            >
              <span className="truncate">{name}</span>
              <button
                type="button"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/15 hover:text-foreground"
                onClick={() => removeChip(name)}
                aria-label={removeChipPrefix(name)}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[10px] leading-snug text-muted-foreground/90">{hint}</p>
      <div
        className={cn(
          'flex h-10 items-center gap-2 rounded-full border border-sky-500/25 bg-slate-950/90 pl-3 pr-2 shadow-inner',
          'transition-colors focus-within:border-sky-500/45 focus-within:ring-2 focus-within:ring-sky-500/20',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-sky-400/80" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`${ariaLabel} — ${searchPlaceholder}`}
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground/55"
        />
        {query.trim() !== '' && (
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-white/10 hover:text-foreground"
            onClick={() => setQuery('')}
            aria-label={clearSearchLabel}
          >
            ×
          </button>
        )}
      </div>
      <div
        className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 py-1 custom-scrollbar"
        role="listbox"
        aria-label={ariaLabel}
        aria-multiselectable="true"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">{emptyHint}</p>
        ) : (
          filtered.map((name) => {
            const isSelected = optionIsSelected(selected, name);
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-sky-500/20 text-sky-100'
                    : 'text-foreground/90 hover:bg-white/8',
                )}
                onClick={() => toggle(name)}
              >
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterPopoverShell({
  active,
  anchor,
  triggerAriaLabel,
  children,
}: {
  active: boolean;
  anchor: { to: AnchorTo; gap: number };
  triggerAriaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Popover className="relative inline-flex shrink-0">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full outline-none transition-colors',
              'text-muted-foreground hover:bg-white/5 hover:text-foreground',
              active && 'text-sky-400 ring-1 ring-sky-500/40 bg-sky-500/10',
              open && !active && 'bg-white/5 text-foreground',
            )}
            aria-label={triggerAriaLabel}
            title={triggerAriaLabel}
          >
            <ListFilter className="h-4 w-4 shrink-0" aria-hidden />
          </PopoverButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel anchor={anchor} className={panelClass}>
              <div className="normal-case tracking-normal">{children}</div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
}

export const TransactionsTable = ({
  transactions,
  onEdit,
  onDelete,
  onDownloadAttachment,
  onDeleteAttachment,
}: TransactionsTableProps) => {
  const { t } = useTranslation('transactions');
  const { formatCurrency, formatDate, bcp47 } = useFormatter();
  const { currentLang } = useLocale();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(emptyFilters);

  const noCategory = t('noCategory');
  const noAccount = t('noAccount');

  const uniqueCategoryNames = useMemo(() => {
    const s = new Set<string>();
    for (const tx of transactions) {
      s.add(tx.category?.name ?? noCategory);
    }
    return [...s].sort((a, b) => a.localeCompare(b, bcp47));
  }, [transactions, noCategory, bcp47]);

  const uniqueAccountNames = useMemo(() => {
    const s = new Set<string>();
    for (const tx of transactions) {
      s.add(tx.account?.name ?? noAccount);
    }
    return [...s].sort((a, b) => a.localeCompare(b, bcp47));
  }, [transactions, noAccount, bcp47]);

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) =>
        matchesColumnFilters(tx, columnFilters, noCategory, noAccount, formatCurrency, formatDate),
      ),
    [transactions, columnFilters, noCategory, noAccount, formatCurrency, formatDate],
  );

  const setFilter = (key: 'date' | 'description' | 'amount', value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getLockReason = (transaction: Transaction): string | null => {
    if (!isMessagingChannelSource(transaction.source)) return null;
    const via = messagingChannelLabel(transaction.source);
    if (!transaction.lockedUntil) return t('locks.lockedVia', { channel: via });
    const lockedUntil = new Date(transaction.lockedUntil);
    if (Number.isNaN(lockedUntil.getTime())) return t('locks.lockedVia', { channel: via });
    if (lockedUntil > new Date()) {
      return t('locks.lockedUntil', { date: formatDate(transaction.lockedUntil) });
    }
    return null;
  };

  // unused but kept for potential external consumers that depend on lang
  void currentLang;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-slate-950/40 shadow-soft-md backdrop-blur-xl">
      {/* View de Tabela (Desktop/Tablet) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-white/5 text-sm">
          <thead className="bg-slate-950/60 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span>{t('table.date')}</span>
                  <FilterPopoverShell
                    active={!!columnFilters.date.trim()}
                    anchor={{ to: 'bottom start', gap: 8 }}
                    triggerAriaLabel={t('filter.byDate')}
                  >
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t('filter.textInDate')}
                      </p>
                      <Input
                        aria-label={t('filter.byDate')}
                        placeholder={t('filter.datePlaceholder')}
                        value={columnFilters.date}
                        onChange={(e) => setFilter('date', e.target.value)}
                        className="h-9 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs text-sky-400 hover:text-sky-300"
                        onClick={() => setFilter('date', '')}
                      >
                        {t('filter.clear')}
                      </Button>
                    </div>
                  </FilterPopoverShell>
                </div>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <div className="flex items-center gap-1.5">
                  <span>{t('table.description')}</span>
                  <FilterPopoverShell
                    active={!!columnFilters.description.trim()}
                    anchor={{ to: 'bottom start', gap: 8 }}
                    triggerAriaLabel={t('filter.byDescription')}
                  >
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t('filter.containsText')}
                      </p>
                      <Input
                        aria-label={t('filter.byDescription')}
                        placeholder={t('filter.descriptionPlaceholder')}
                        value={columnFilters.description}
                        onChange={(e) => setFilter('description', e.target.value)}
                        className="h-9 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs text-sky-400 hover:text-sky-300"
                        onClick={() => setFilter('description', '')}
                      >
                        {t('filter.clear')}
                      </Button>
                    </div>
                  </FilterPopoverShell>
                </div>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <div className="flex items-center gap-1.5">
                  <span>{t('table.category')}</span>
                  <FilterPopoverShell
                    active={columnFilters.category.length > 0}
                    anchor={{ to: 'bottom start', gap: 8 }}
                    triggerAriaLabel={t('filter.byCategory')}
                  >
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t('filter.multiSelect')}
                      </p>
                      <FilterSearchPickList
                        options={uniqueCategoryNames}
                        selected={columnFilters.category}
                        onSelectedChange={(next) =>
                          setColumnFilters((prev) => ({ ...prev, category: next }))
                        }
                        ariaLabel={t('filter.byCategory')}
                        emptyHint={t('filter.noCategoryMatch')}
                        hint={t('filter.hint')}
                        searchPlaceholder={t('filter.searchPlaceholder')}
                        clearSearchLabel={t('filter.clearSearch')}
                        removeChipPrefix={(name) => t('filter.removeChip', { name })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs text-sky-400 hover:text-sky-300"
                        onClick={() => setColumnFilters((prev) => ({ ...prev, category: [] }))}
                      >
                        {t('filter.clear')}
                      </Button>
                    </div>
                  </FilterPopoverShell>
                </div>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <div className="flex items-center gap-1.5">
                  <span>{t('table.account')}</span>
                  <FilterPopoverShell
                    active={columnFilters.account.length > 0}
                    anchor={{ to: 'bottom start', gap: 8 }}
                    triggerAriaLabel={t('filter.byAccount')}
                  >
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t('filter.multiSelect')}
                      </p>
                      <FilterSearchPickList
                        options={uniqueAccountNames}
                        selected={columnFilters.account}
                        onSelectedChange={(next) =>
                          setColumnFilters((prev) => ({ ...prev, account: next }))
                        }
                        ariaLabel={t('filter.byAccount')}
                        emptyHint={t('filter.noAccountMatch')}
                        hint={t('filter.hint')}
                        searchPlaceholder={t('filter.searchPlaceholder')}
                        clearSearchLabel={t('filter.clearSearch')}
                        removeChipPrefix={(name) => t('filter.removeChip', { name })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs text-sky-400 hover:text-sky-300"
                        onClick={() => setColumnFilters((prev) => ({ ...prev, account: [] }))}
                      >
                        {t('filter.clear')}
                      </Button>
                    </div>
                  </FilterPopoverShell>
                </div>
              </th>
              <th className="px-4 py-3 text-right font-medium">
                <div className="flex items-center justify-end gap-1.5">
                  <span>{t('table.amount')}</span>
                  <FilterPopoverShell
                    active={!!columnFilters.amount.trim()}
                    anchor={{ to: 'bottom end', gap: 8 }}
                    triggerAriaLabel={t('filter.byAmount')}
                  >
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t('filter.textInDate')}
                      </p>
                      <Input
                        aria-label={t('filter.byAmount')}
                        placeholder={t('filter.amountPlaceholder')}
                        value={columnFilters.amount}
                        onChange={(e) => setFilter('amount', e.target.value)}
                        className="h-9 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full text-xs text-sky-400 hover:text-sky-300"
                        onClick={() => setFilter('amount', '')}
                      >
                        {t('filter.clear')}
                      </Button>
                    </div>
                  </FilterPopoverShell>
                </div>
              </th>
              <th className="px-4 py-3 text-right font-medium">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-foreground/90">
            {filteredTransactions.map((transaction, rowIndex) => {
              const amount = Number(transaction.amount);
              const isIncome = transaction.direction === 'income';
              const isTransfer = transaction.direction === 'transfer';
              const amountClass = isTransfer
                ? 'text-sky-300'
                : isIncome
                  ? 'text-emerald-300'
                  : 'text-rose-300';
              const lockReason = getLockReason(transaction);
              const isLocked = Boolean(lockReason);
              return (
                <tr
                  key={transaction.id}
                  data-testid={`transaction-row-${transaction.id}`}
                  className="transition-colors hover:bg-sky-500/5"
                >
                  <td
                    className="px-4 py-3 align-middle whitespace-nowrap"
                    {...(rowIndex === 0 ? { 'data-testid': 'transaction-date' } : {})}
                  >
                    {formatDate(transaction.occurredAt)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {transaction.description ?? '—'}
                      </span>
                      {isMessagingChannelSource(transaction.source) && (
                        <span className="text-[11px] text-sky-300">
                          {t('registeredVia', { channel: messagingChannelLabel(transaction.source) })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Badge
                      variant={isTransfer ? 'info' : isIncome ? 'success' : 'danger'}
                      className="max-w-[160px] truncate"
                    >
                      {transaction.category?.name ?? noCategory}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {transaction.account?.name ?? noAccount}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap ${amountClass}`}
                    {...(rowIndex === 0 ? { 'data-testid': 'transaction-amount' } : {})}
                  >
                    {isTransfer && (transaction.transferLeg === 'out' ? '− ' : '+ ')}
                    {formatCurrency(amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      {transaction.attachment?.id ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200"
                            aria-label={t('actions.downloadAttachment')}
                            title={transaction.attachment.fileName ?? t('actions.downloadAttachment')}
                            onClick={() => onDownloadAttachment?.(transaction)}
                          >
                            <Download className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-amber-300 hover:bg-amber-500/15 hover:text-amber-200"
                            aria-label={t('actions.removeAttachment')}
                            title={t('actions.removeAttachment')}
                            onClick={() => onDeleteAttachment?.(transaction)}
                          >
                            <Paperclip className="h-4 w-4" aria-hidden />
                          </Button>
                        </>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-sky-300 hover:bg-sky-500/15 hover:text-sky-200"
                        aria-label={t('actions.editEntry')}
                        title={isLocked ? (lockReason ?? t('locks.editBlocked')) : t('actions.editEntry')}
                        disabled={isLocked}
                        onClick={() => onEdit(transaction)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
                        aria-label={t('actions.deleteEntry')}
                        title={isLocked ? (lockReason ?? t('locks.removeBlocked')) : t('actions.deleteEntry')}
                        disabled={isLocked}
                        onClick={() => onDelete(transaction)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* View de Cards (Mobile) */}
      <div className="block sm:hidden divide-y divide-white/5">
        {filteredTransactions.map((transaction) => {
          const amount = Number(transaction.amount);
          const isIncome = transaction.direction === 'income';
          const isTransfer = transaction.direction === 'transfer';
          const amountClass = isTransfer
            ? 'text-sky-300'
            : isIncome
              ? 'text-emerald-300'
              : 'text-rose-300';
          const lockReason = getLockReason(transaction);
          const isLocked = Boolean(lockReason);
          return (
            <div key={transaction.id} className="p-4 space-y-3 active:bg-white/5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  {formatDate(transaction.occurredAt)}
                </span>
                <span className={`text-sm font-bold tracking-tight ${amountClass}`}>
                  {isTransfer && (transaction.transferLeg === 'out' ? '− ' : '+ ')}
                  {formatCurrency(amount)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {transaction.description ?? '—'}
                </p>
                {isMessagingChannelSource(transaction.source) && (
                  <p className="text-[10px] text-sky-400 mt-0.5">
                    {t('registeredVia', { channel: messagingChannelLabel(transaction.source) })}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={isTransfer ? 'info' : isIncome ? 'success' : 'danger'} className="text-[10px] px-2 py-0 border-white/5">
                    {transaction.category?.name ?? noCategory}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                    {transaction.account?.name ?? noAccount}
                  </span>
                </div>
                <div className="flex gap-1">
                  {transaction.attachment?.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-400"
                        onClick={() => onDownloadAttachment?.(transaction)}
                        title={transaction.attachment.fileName ?? t('actions.downloadAttachment')}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-400"
                        onClick={() => onDeleteAttachment?.(transaction)}
                        title={t('actions.removeAttachment')}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sky-400"
                    disabled={isLocked}
                    title={isLocked ? (lockReason ?? t('locks.editBlocked')) : t('actions.editEntry')}
                    onClick={() => onEdit(transaction)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    disabled={isLocked}
                    title={isLocked ? (lockReason ?? t('locks.removeBlocked')) : t('actions.deleteEntry')}
                    onClick={() => onDelete(transaction)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
