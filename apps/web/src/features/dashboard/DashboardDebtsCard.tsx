import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { useDebts } from '@features/debts/useDebts';
import { useFormatter } from '@shared/hooks/useFormatter';

export const DashboardDebtsCard = () => {
  const { summary, isSummaryLoading } = useDebts();
  const { formatCurrency } = useFormatter();

  if (isSummaryLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">A carregar dívidas…</CardContent>
      </Card>
    );
  }

  if (!summary || summary.activeCount === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4 text-amber-400" />
            Dívidas
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/debts">Gerir</Link>
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nenhuma dívida activa registada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Landmark className="h-4 w-4 text-amber-400" />
          Dívidas
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/debts">Ver todas</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Saldo devedor</span>
          <span className="font-semibold text-amber-200">
            {formatCurrency(Number.parseFloat(summary.totalOutstanding))}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Vence este mês</span>
          <span>{formatCurrency(Number.parseFloat(summary.dueThisMonth))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Próximos 7 dias</span>
          <span>{formatCurrency(Number.parseFloat(summary.dueNext7Days))}</span>
        </div>
        {summary.nextDueDate && (
          <p className="text-xs text-muted-foreground">
            Próximo vencimento: {summary.nextDueDate}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
