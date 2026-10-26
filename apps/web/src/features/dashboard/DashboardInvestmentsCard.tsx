import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@shared/ui/button';
import { Card, CardTitle } from '@shared/ui/card';
import type { InvestmentPeriodSummary } from '@features/investments/useInvestments';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

interface DashboardInvestmentsCardProps {
  portfolioValue: number;
  periodSummary: InvestmentPeriodSummary | undefined;
  isLoadingPortfolio: boolean;
  isLoadingPeriod: boolean;
}

export const DashboardInvestmentsCard = ({
  portfolioValue,
  periodSummary,
  isLoadingPortfolio,
  isLoadingPeriod,
}: DashboardInvestmentsCardProps) => {
  const chartData = periodSummary
    ? [
        { name: 'Compras', value: periodSummary.totalBuys, fill: '#38bdf8' },
        { name: 'Vendas', value: periodSummary.totalSells, fill: '#a78bfa' },
        { name: 'Proventos', value: periodSummary.totalDividends, fill: '#34d399' },
      ]
    : [];

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground/80">
            Carteira de investimentos
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Valor estimado com cotações públicas (~atualização diária + após movimentos). P/L não realizado
            reflete a posição atual, não o fecho do mês.
          </p>
          <p className="mt-2 text-lg font-semibold text-sky-200">
            {isLoadingPortfolio ? '…' : currencyFormatter.format(portfolioValue)}
          </p>
        </div>
        <Button type="button" variant="glass" size="sm" asChild>
          <Link to="/investments">Abrir investimentos</Link>
        </Button>
      </div>

      {isLoadingPeriod ? (
        <p className="text-sm text-muted-foreground">A carregar movimentação do período…</p>
      ) : periodSummary ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-muted-foreground">Compras</p>
              <p className="mt-0.5 font-semibold text-sky-200">
                {currencyFormatter.format(periodSummary.totalBuys)}
              </p>
              <p className="text-[10px] text-muted-foreground">{periodSummary.buyCount} ops.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-muted-foreground">Vendas</p>
              <p className="mt-0.5 font-semibold text-rose-200">
                {currencyFormatter.format(periodSummary.totalSells)}
              </p>
              <p className="text-[10px] text-muted-foreground">{periodSummary.sellCount} ops.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-muted-foreground">Proventos</p>
              <p className="mt-0.5 font-semibold text-emerald-200">
                {currencyFormatter.format(periodSummary.totalDividends)}
              </p>
              <p className="text-[10px] text-muted-foreground">{periodSummary.dividendCount} ops.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
              <p className="text-muted-foreground">P/L não realizado</p>
              <p
                className={`mt-0.5 font-semibold ${
                  periodSummary.totalUnrealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {currencyFormatter.format(periodSummary.totalUnrealizedPnl)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 sm:col-span-2">
              <p className="text-muted-foreground">Valor de mercado (atual)</p>
              <p className="mt-0.5 font-semibold text-foreground/90">
                {currencyFormatter.format(periodSummary.totalMarketValue)}
              </p>
            </div>
          </div>
          <div className="h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(v: number) =>
                    currencyFormatter.format(v).replace(/\s/g, ' ')
                  }
                />
                <Tooltip
                  formatter={(v: number) => currencyFormatter.format(v)}
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.4)',
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((e) => (
                    <Cell key={e.name} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </Card>
  );
};
