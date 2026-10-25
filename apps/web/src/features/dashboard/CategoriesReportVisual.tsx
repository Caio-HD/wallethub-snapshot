import { useMemo } from 'react';
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
import type { CategoryReportItem } from './useDashboard';
import { Card, CardTitle } from '@shared/ui/card';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const TOP_N = 8;

interface CategoriesReportVisualProps {
  items: CategoryReportItem[];
  isLoading: boolean;
}

function topByIncome(items: CategoryReportItem[]) {
  return [...items]
    .filter((i) => i.type === 'income' && i.totalIncome > 0)
    .sort((a, b) => b.totalIncome - a.totalIncome)
    .slice(0, TOP_N)
    .map((i) => ({ name: i.name, value: i.totalIncome }));
}

function topByExpense(items: CategoryReportItem[]) {
  return [...items]
    .filter((i) => i.type === 'expense' && i.totalExpense > 0)
    .sort((a, b) => b.totalExpense - a.totalExpense)
    .slice(0, TOP_N)
    .map((i) => ({ name: i.name, value: i.totalExpense }));
}

const incomeColor = '#34d399';
const expenseColor = '#fb7185';

/** Hover do Recharts desativado no próprio retângulo; só banda muito leve + tooltip. */
const subtleTooltipCursor = { fill: 'rgba(148, 163, 184, 0.06)' };

type BarRow = { name: string; value: number };

function CategoryBarTooltip({
  active,
  payload,
  variant,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: BarRow }>;
  variant: 'income' | 'expense';
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as BarRow | undefined;
  if (!row?.name) return null;
  const valueColor = variant === 'income' ? 'text-emerald-400' : 'text-rose-400';
  return (
    <div className="max-w-[220px] rounded-md border border-white/12 bg-slate-950/95 px-2 py-1 shadow-md backdrop-blur-sm">
      <p className="truncate text-[11px] font-medium leading-tight text-slate-200">{row.name}</p>
      <p className={`mt-0.5 text-xs font-semibold tabular-nums leading-tight ${valueColor}`}>
        {currencyFormatter.format(Number(row.value))}
      </p>
    </div>
  );
}

export const CategoriesReportVisual = ({ items, isLoading }: CategoriesReportVisualProps) => {
  const incomeBars = useMemo(() => topByIncome(items), [items]);
  const expenseBars = useMemo(() => topByExpense(items), [items]);

  if (isLoading) {
    return (
      <Card className="p-0">
        <CardTitle className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-foreground/80">
          Relatório por categorias
        </CardTitle>
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Carregando…
        </div>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="p-0">
        <CardTitle className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-foreground/80">
          Relatório por categorias
        </CardTitle>
        <p className="p-4 text-sm text-muted-foreground">Nenhuma categoria com movimentação no período.</p>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <CardTitle className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-foreground/80">
        Relatório por categorias
      </CardTitle>

      <div className="flex flex-col gap-6 p-4">
        <section aria-labelledby="cat-income-heading">
          <h3
            id="cat-income-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/90"
          >
            Receitas por categoria
          </h3>
          {incomeBars.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem receitas no período.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={incomeBars}
                    layout="vertical"
                    margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal />
                    <XAxis
                      type="number"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickFormatter={(v: number) =>
                        currencyFormatter.format(v).replace(/\s/g, ' ')
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={subtleTooltipCursor}
                      content={(props) => <CategoryBarTooltip {...props} variant="income" />}
                    />
                    <Bar
                      dataKey="value"
                      name="Receitas"
                      radius={[0, 4, 4, 0]}
                      activeBar={false}
                      isAnimationActive={false}
                    >
                      {incomeBars.map((_, i) => (
                        <Cell key={`i-${i}`} fill={incomeColor} fillOpacity={0.85 - (i % 3) * 0.08} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {incomeBars.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/50 px-3 py-2"
                  >
                    <span className="truncate text-foreground/85">{row.name}</span>
                    <span className="shrink-0 font-medium text-emerald-300">
                      {currencyFormatter.format(row.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="cat-expense-heading">
          <h3
            id="cat-expense-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-300/90"
          >
            Despesas por categoria
          </h3>
          {expenseBars.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={expenseBars}
                    layout="vertical"
                    margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal />
                    <XAxis
                      type="number"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickFormatter={(v: number) =>
                        currencyFormatter.format(v).replace(/\s/g, ' ')
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={subtleTooltipCursor}
                      content={(props) => <CategoryBarTooltip {...props} variant="expense" />}
                    />
                    <Bar
                      dataKey="value"
                      name="Despesas"
                      radius={[0, 4, 4, 0]}
                      activeBar={false}
                      isAnimationActive={false}
                    >
                      {expenseBars.map((_, i) => (
                        <Cell key={`e-${i}`} fill={expenseColor} fillOpacity={0.85 - (i % 3) * 0.08} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {expenseBars.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/50 px-3 py-2"
                  >
                    <span className="truncate text-foreground/85">{row.name}</span>
                    <span className="shrink-0 font-medium text-rose-300">
                      {currencyFormatter.format(row.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
};
