import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';

interface InvestmentProjectionChartProps {
  data: Array<{
    month: string;
    contributions: number;
    projected: number;
    optimistic: number;
    pessimistic: number;
  }>;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export const InvestmentProjectionChart = ({ data }: InvestmentProjectionChartProps) => (
  <Card className="h-96 w-full p-0">
    <CardHeader className="px-4 pt-4">
      <CardTitle className="text-sm font-black uppercase tracking-widest text-white/70">
        Projeção de Patrimônio
      </CardTitle>
    </CardHeader>
    <CardContent className="h-[320px] px-2 pb-4 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 10, right: 10, top: 10 }}>
          <defs>
            <linearGradient id="projectedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="contributionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis 
            dataKey="month" 
            stroke="#64748b" 
            fontSize={10} 
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => currencyFormatter.format(value)}
          />
          <Tooltip
            formatter={(value: number) => currencyFormatter.format(value)}
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            }}
            itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
            labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '10px' }}
          />
          <Area
            type="monotone"
            dataKey="pessimistic"
            stroke="transparent"
            fill="#f43f5e"
            fillOpacity={0.05}
            name="Cenário Pessimista"
          />
          <Area
            type="monotone"
            dataKey="optimistic"
            stroke="transparent"
            fill="#10b981"
            fillOpacity={0.05}
            name="Cenário Otimista"
          />
          <Area
            type="monotone"
            dataKey="contributions"
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="4 4"
            fill="url(#contributionFill)"
            name="Aportes Totais"
          />
          <Area
            type="monotone"
            dataKey="projected"
            stroke="#38bdf8"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#projectedFill)"
            name="Patrimônio Projetado"
          />
        </AreaChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);
