import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@shared/ui/card';
import { useFormatter } from '@shared/hooks/useFormatter';
import { useAccounts } from '@features/accounts/useAccounts';

export const AccountBalancesCard = () => {
  const { t } = useTranslation('dashboard');
  const { formatCurrency } = useFormatter();
  const { accounts, isLoading } = useAccounts();

  const total = useMemo(
    () => accounts.reduce((acc, a) => acc + Number(a.balance), 0),
    [accounts],
  );

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-200/90">
          <Wallet className="h-4 w-4" />
          {t('cards.accountBalances.title')}
        </CardTitle>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {formatCurrency(total)}
        </span>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('cards.loading')}</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('cards.accountBalances.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-sm first:border-t-0 first:pt-0"
            >
              <span className="truncate text-foreground/90">{account.name}</span>
              <span className="tabular-nums text-foreground">
                {formatCurrency(Number(account.balance))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
