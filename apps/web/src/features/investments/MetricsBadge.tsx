import React from 'react';
import { PerformanceMetrics } from './useInvestments';

interface Props {
  metrics: PerformanceMetrics;
  loading?: boolean;
}

export const MetricsBadge: React.FC<Props> = ({ metrics, loading }) => {
  if (loading) return <div className="animate-pulse h-24 bg-zinc-900 border border-zinc-800 rounded"></div>;

  const items = [
    { label: 'SHARPE RATIO', value: metrics.sharpeRatio.toFixed(2), color: 'text-emerald-400' },
    { label: 'TWR (ANNUAL)', value: `${(metrics.twr * 100).toFixed(2)}%`, color: 'text-blue-400' },
    { label: 'MAX DRAWDOWN', value: `${(metrics.maxDrawdown * 100).toFixed(2)}%`, color: 'text-rose-400' },
    { label: 'VOLATILITY', value: `${(metrics.volatility * 100).toFixed(2)}%`, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {items.map((item) => (
        <div key={item.label} className="bg-black/40 border border-zinc-800 p-4 font-mono relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors"></div>
          <div className="text-[10px] text-zinc-500 mb-1">{item.label}</div>
          <div className={`text-xl font-bold ${item.color} tracking-tighter`}>
            {item.value}
          </div>
          <div className="absolute top-0 right-0 p-1">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
