import { useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { TransactionsTable } from '@features/transactions/TransactionsTable';
import {
  Transaction,
  TransactionFilters,
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from '@features/transactions/useTransactions';
import { useCategories } from '@features/categories/useCategories';
import { TransactionForm, TransactionFormValues } from '@features/transactions/TransactionForm';
import {
  transactionBodyFromFormValues,
  transferBodyFromFormValues,
} from '@features/transactions/transaction-api-payload';
import { useAccounts } from '@features/accounts/useAccounts';
import { Button } from '@shared/ui/button';
import { StatementImportPanel } from '@features/transactions/StatementImportPanel';
import { DateRangePicker } from '@shared/ui/date-range-picker';
import { useGlobalScope } from '@shared/context/GlobalScopeContext';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';
import apiClient from '@shared/lib/apiClient';

const toApiFilters = (filters: TransactionFilters) => ({
  ...filters,
  period: filters.period ?? undefined,
});

const defaultPeriod = {
  start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
};

function transactionMutationError(error: unknown, fallback: string, whatsappMsg: string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 409) {
      return whatsappMsg;
    }
  }
  return fallback;
}

export const EntriesPage = () => {
  const { t } = useTranslation('transactions');
  const { scope } = useGlobalScope();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({
    period: defaultPeriod,
    userId: scope === 'all' ? undefined : scope,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Update filters when scope changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      userId: scope === 'all' ? undefined : scope,
    }));
  }, [scope]);

  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useAccounts();
  const { data: transactions = [], isLoading } = useTransactions(toApiFilters(filters));
  const { activeOrganizationId } = useActiveOrganization();

  const createMutation = useCreateTransaction();
  const transferMutation = useCreateTransfer();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const isFormDisabled = isLoadingCategories || isLoadingAccounts;

  const handleCreate = async (values: TransactionFormValues, file: File | null) => {
    // Transferência (movimento neutro): endpoint dedicado, sem categoria nem anexo.
    if (values.direction === 'transfer') {
      try {
        await transferMutation.mutateAsync(transferBodyFromFormValues(values));
        toast.success(t('toasts.createSuccess'));
        setIsCreating(false);
      } catch {
        toast.error(t('toasts.createError'));
      }
      return;
    }
    try {
      const transaction = await createMutation.mutateAsync(transactionBodyFromFormValues(values));

      if (file && transaction.id) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('transactionId', transaction.id);
        await apiClient.post('/attachments', formData);
        toast.success(t('toasts.createWithAttachmentSuccess'));
      } else {
        toast.success(t('toasts.createSuccess'));
      }

      setIsCreating(false);
    } catch {
      toast.error(t('toasts.createError'));
    }
  };

  const handleUpdate = async (values: TransactionFormValues, file: File | null) => {
    if (!editingTransaction) return;
    try {
      await updateMutation.mutateAsync({
        id: editingTransaction.id,
        data: transactionBodyFromFormValues(values),
      });

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('transactionId', editingTransaction.id);
        await apiClient.post('/attachments', formData);
        toast.success(t('toasts.updateWithAttachmentSuccess'));
      } else {
        toast.success(t('toasts.updateSuccess'));
      }

      setEditingTransaction(null);
    } catch (error) {
      toast.error(transactionMutationError(error, t('toasts.updateError'), t('toasts.whatsappLockError')));
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm(t('toasts.deleteConfirm'))) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
      toast.success(t('toasts.deleteSuccess'));
    } catch (error) {
      toast.error(transactionMutationError(error, t('toasts.deleteError'), t('toasts.whatsappLockError')));
    }
  };

  const handleDownloadAttachment = async (transaction: Transaction) => {
    if (!transaction.attachment?.id) return;
    try {
      const { data } = await apiClient.get<Blob>(`/attachments/${transaction.attachment.id}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = transaction.attachment.fileName ?? 'comprovante';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('toasts.downloadError'));
    }
  };

  const handleDeleteAttachment = async (transaction: Transaction) => {
    if (!transaction.attachment?.id) return;
    if (!window.confirm(t('toasts.attachmentDeleteConfirm'))) return;
    try {
      await apiClient.delete(`/attachments/${transaction.attachment.id}`);
      toast.success(t('toasts.attachmentDeleteSuccess'));
      if (activeOrganizationId) {
        await queryClient.invalidateQueries({ queryKey: ['transactions', activeOrganizationId] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard', activeOrganizationId] });
      }
    } catch {
      toast.error(t('toasts.attachmentDeleteError'));
    }
  };

  const activeFormTransaction = editingTransaction ? {
    occurredAt: editingTransaction.occurredAt.slice(0, 10),
    accountId: editingTransaction.accountId,
    categoryId: editingTransaction.categoryId,
    direction: editingTransaction.direction,
    amount: Number(editingTransaction.amount),
    description: editingTransaction.description ?? '',
  } : undefined;

  const periodLabel = useMemo(() => {
    if (!filters.period?.start || !filters.period?.end) return t('customPeriod');
    return `${format(new Date(filters.period.start), 'dd/MM/yyyy')} - ${format(
      new Date(filters.period.end),
      'dd/MM/yyyy',
    )}`;
  }, [filters.period, t]);

  return (
    <div className="space-y-6" data-testid="transactions-root">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t('title')}</h2>
          <p className="text-xs font-medium text-muted-foreground">
            {t('subtitle', { period: periodLabel })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            start={filters.period?.start ?? defaultPeriod.start}
            end={filters.period?.end ?? defaultPeriod.end}
            onChange={(range) => setFilters({ ...filters, period: range })}
          />
          <Button
            type="button"
            className="rounded-full px-6 shadow-lg shadow-accent/20"
            onClick={() => {
              setEditingTransaction(null);
              setIsCreating(true);
            }}
          >
            {t('newEntry')}
          </Button>
        </div>
      </header>

      {!isCreating && !editingTransaction && accounts.length > 0 && categories.length > 0 && (
        <StatementImportPanel accounts={accounts} categories={categories} />
      )}

      {(isCreating || editingTransaction) && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <TransactionForm
            key={editingTransaction?.id ?? (isCreating ? 'new' : 'idle')}
            categories={categories}
            accounts={accounts}
            defaultValues={activeFormTransaction}
            onSubmit={editingTransaction ? handleUpdate : handleCreate}
            onCancel={() => {
              setIsCreating(false);
              setEditingTransaction(null);
            }}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
          {isFormDisabled && (
            <p className="mt-2 text-center text-xs font-medium text-muted-foreground animate-pulse">
              {t('loadingAccounts')}
            </p>
          )}
        </div>
      )}

      {isLoading && (
        <p data-testid="loading-spinner" className="text-sm text-muted-foreground">
          {t('loadingEntries')}
        </p>
      )}

      <div data-testid="transactions-list">
      <TransactionsTable
        transactions={transactions}
        onEdit={(transaction) => {
          setIsCreating(false);
          setEditingTransaction(transaction);
        }}
        onDelete={handleDelete}
        onDownloadAttachment={handleDownloadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
      />
      </div>
    </div>
  );
};
