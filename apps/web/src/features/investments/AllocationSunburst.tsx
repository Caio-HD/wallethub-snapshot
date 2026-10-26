import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, TooltipProps } from 'recharts';
import { usePortfolio, PortfolioPosition } from './useInvestments';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

interface AllocationItem {
  name: string;
  value: number;
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-black/80 backdrop-blur-xl border border-zinc-700/50 p-3 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.5)] font-mono">
        <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold mb-1">
          {data.payload.kind ? 'System_Asset' : 'System_Class'}
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.payload.fill, boxShadow: `0 0 8px ${data.payload.fill}` }} />
          <p className="text-white text-sm font-bold tracking-wider">{data.name}</p>
        </div>
        <p className="text-emerald-400 text-xs font-bold mt-1 text-right tabular-nums">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(data.value))}
        </p>
      </div>
    );
  }
  return null;
};

export const AllocationSunburst = () => {
  const { data: portfolio } = usePortfolio();

  if (!portfolio || !portfolio.positions.length) return null;

  // Simplificação: Agrupamento por Classe (inner) e Ativo (outer)
  const classData = portfolio.positions.reduce((acc: AllocationItem[], pos: PortfolioPosition) => {
    const existing = acc.find(item => item.name === pos.kind);
    const value = Math.max(0, Number(pos.marketValue) || 0);
    if (existing) {
      existing.value += value;
    } else {
      acc.push({ name: pos.kind, value });
    }
    return acc;
  }, []);

  // Garantir que assetData siga a mesma ordem de classData para alinhamento no Sunburst
  const assetData = classData.flatMap(c => 
    portfolio.positions
      .filter(pos => pos.kind === c.name)
      .map(pos => ({
        name: pos.symbol,
        value: Math.max(0, Number(pos.marketValue) || 0),
        kind: pos.kind,
        classIndex: classData.indexOf(c)
      }))
  );


  return (
    <div className="bg-black/40 p-4 sm:p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-md h-[350px] sm:h-[400px] overflow-hidden flex flex-col shadow-xl">
      <h3 className="text-zinc-400 text-[11px] uppercase tracking-widest font-black mb-2 sm:mb-4">Alocação_Multi_Dimensional_V2</h3>
      <div className="flex-1 min-h-[250px] w-full items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={classData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="0%"
              outerRadius="45%"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={2}
            >
              {classData.map((_entry: AllocationItem, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.7} />
              ))}
            </Pie>
            <Pie
              data={assetData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              stroke="rgba(0,0,0,0.8)"
              strokeWidth={3}
            >
              {assetData.map((entry: { classIndex: number }, index: number) => (
                <Cell 
                  key={`cell-asset-${index}`} 
                  fill={COLORS[entry.classIndex % COLORS.length]} 
                  opacity={0.8}
                />
              ))}
            </Pie>

            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 pt-3 border-t border-zinc-800/50 flex flex-wrap gap-3 justify-center">
         {classData.map((item: AllocationItem, index: number) => (
           <div key={item.name} className="flex items-center gap-1.5 cursor-default hover:opacity-80 transition-opacity">
             <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length], boxShadow: `0 0 5px ${COLORS[index % COLORS.length]}` }} />
             <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">{item.name}</span>
           </div>
         ))}
      </div>
    </div>
  );
};
