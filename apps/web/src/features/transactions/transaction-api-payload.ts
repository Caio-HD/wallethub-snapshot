import type { TransactionFormValues } from './TransactionForm';
import type { CreateTransferPayload } from './useTransactions';

/** Corpo aceite por POST/PATCH de transações (sem `direction`: não existe nos DTOs Nest + forbidNonWhitelisted). */
export type TransactionApiBody = {
  occurredAt: string;
  accountId: string;
  categoryId: string;
  amount: number;
  description: string;
};

export function transactionBodyFromFormValues(values: TransactionFormValues): TransactionApiBody {
  return {
    occurredAt: values.occurredAt,
    accountId: values.accountId,
    categoryId: values.categoryId ?? '',
    amount: values.amount,
    description: values.description?.trim() ?? '',
  };
}

/** Corpo de transferência pareada. Usar quando `values.direction === 'transfer'`. */
export function transferBodyFromFormValues(values: TransactionFormValues): CreateTransferPayload {
  return {
    occurredAt: values.occurredAt,
    amount: values.amount,
    fromAccountId: values.accountId,
    toAccountId: values.toAccountId ?? '',
    description: values.description?.trim() || undefined,
  };
}
