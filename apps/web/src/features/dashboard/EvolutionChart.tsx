import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';

export interface EvolutionChartDatum {
  month: string;
  period: string;
  income: number;
  expense: number;
  balance: number;
}

interface EvolutionChartProps {
  data: EvolutionChartDatum[];
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const EvolutionChart = ({ data }: EvolutionChartProps) => (
  <Card className="h-80 w-full p-0">
    <CardHeader className="px-4 pt-4">
      <CardTitle className="text-sm font-semibold text-foreground/80">
        Evolução (últimos meses)
      </CardTitle>
    </CardHeader>
    <CardContent className="h-[260px] px-2 pb-4 pt-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
          <XAxis dataKey="month" stroke="#cbd5f5" fontSize={11} />
          <YAxis
            stroke="#cbd5f5"
            fontSize={11}
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
          />
          <Bar dataKey="income" fill="#22c55e" name="Receitas" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" fill="#fb7185" name="Despesas" radius={[6, 6, 0, 0]} />
          <Bar dataKey="balance" fill="#38bdf8" name="Saldo" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);
