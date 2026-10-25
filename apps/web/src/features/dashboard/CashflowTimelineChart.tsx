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
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';

export interface CashflowTimelineDatum {
  month: string;
  period: string;
  income: number;
  expense: number;
  balance: number;
  rowKind: 'actual' | 'forecast';
}

interface CashflowTimelineChartProps {
  data: CashflowTimelineDatum[];
  /** Mês do picker (primeiro token) para contorno nas barras. */
  highlightPeriod?: string;
  /** Mês calendário atual (yyyy-MM) — contorno secundário se diferente do highlight. */
  todayPeriod?: string;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Largura mínima para barras legíveis com muitos meses (multi-seleção). */
const PX_PER_MONTH = 56;
const CHART_MIN_WIDTH = 320;

export const CashflowTimelineChart = ({
  data,
  highlightPeriod,
  todayPeriod,
}: CashflowTimelineChartProps) => {
  const minPx = Math.max(CHART_MIN_WIDTH, data.length * PX_PER_MONTH);

  return (
    <Card className="w-full min-w-0 p-0">
      <CardHeader className="px-4 pt-4">
        <CardTitle className="text-sm font-semibold text-foreground/80">
          Fluxo mensal (realizado e projetado)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-0">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <div className="h-[260px] min-h-[220px] sm:h-[300px]" style={{ minWidth: minPx }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ left: 4, right: 8, top: 10, bottom: 52 }}
                barCategoryGap="12%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis
                  dataKey="month"
                  stroke="#cbd5f5"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-38}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  stroke="#cbd5f5"
                  fontSize={11}
                  width={56}
                  tickFormatter={(value: number) => currencyFormatter.format(value)}
                />
                <Tooltip
                  formatter={(value: number) => currencyFormatter.format(value)}
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.4)',
                  }}
                  cursor={{ fill: 'rgba(15,23,42,0.45)' }}
                  labelFormatter={(_label, payload) => {
                    const row = payload?.[0]?.payload as CashflowTimelineDatum | undefined;
                    return row
                      ? `${row.period} (${row.rowKind === 'forecast' ? 'projetado' : 'realizado'})`
                      : '';
                  }}
                />
                <Bar dataKey="income" fill="#22c55e" name="Receitas" radius={[6, 6, 0, 0]}>
                  {data.map((entry, i) => (
                    <Cell
                      key={`inc-${entry.period}-${i}`}
                      fillOpacity={entry.rowKind === 'forecast' ? 0.45 : 1}
                      stroke={
                        entry.period === highlightPeriod
                          ? '#f8fafc'
                          : entry.period === todayPeriod && todayPeriod !== highlightPeriod
                            ? 'rgba(248,250,252,0.35)'
                            : undefined
                      }
                      strokeWidth={
                        entry.period === highlightPeriod
                          ? 2
                          : entry.period === todayPeriod && todayPeriod !== highlightPeriod
                            ? 1
                            : 0
                      }
                      strokeDasharray={
                        entry.period === todayPeriod && todayPeriod !== highlightPeriod
                          ? '4 3'
                          : undefined
                      }
                    />
                  ))}
                </Bar>
                <Bar dataKey="expense" fill="#fb7185" name="Despesas" radius={[6, 6, 0, 0]}>
                  {data.map((entry, i) => (
                    <Cell
                      key={`exp-${entry.period}-${i}`}
                      fillOpacity={entry.rowKind === 'forecast' ? 0.45 : 1}
                      stroke={
                        entry.period === highlightPeriod
                          ? '#f8fafc'
                          : entry.period === todayPeriod && todayPeriod !== highlightPeriod
                            ? 'rgba(248,250,252,0.35)'
                            : undefined
                      }
                      strokeWidth={
                        entry.period === highlightPeriod
                          ? 2
                          : entry.period === todayPeriod && todayPeriod !== highlightPeriod
                            ? 1
                            : 0
                      }
                      strokeDasharray={
                        entry.period === todayPeriod && todayPeriod !== highlightPeriod
                          ? '4 3'
                          : undefined
                      }
                    />
                  ))}
                </Bar>
                <Bar dataKey="balance" fill="#38bdf8" name="Saldo" radius={[6, 6, 0, 0]}>
                  {data.map((entry, i) => (
                    <Cell
                      key={`bal-${entry.period}-${i}`}
                      fillOpacity={entry.rowKind === 'forecast' ? 0.45 : 1}
                      stroke={
                        entry.period === highlightPeriod
                          ? '#f8fafc'
                          : entry.period === todayPeriod && todayPeriod !== highlightPeriod
                            ? 'rgba(248,250,252,0.35)'
                            : undefined
                      }
                      strokeWidth={
                        entry.period === highlightPeriod
                          ? 2
                          : entry.period === todayPeriod && todayPeriod !== highlightPeriod
                            ? 1
                            : 0
                      }
                      strokeDasharray={
                        entry.period === todayPeriod && todayPeriod !== highlightPeriod
                          ? '4 3'
                          : undefined
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
