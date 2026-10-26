import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Row {
  symbol: string;
  quantity: number;
  averageCost: number;
  lastPrice: number | null;
  marketValue: number | null;
  pnl: number | null;
  currency: string;
}

interface Props {
  positions: Row[];
  baseCurrency: string;
}

type SortKey = 'symbol' | 'quantity' | 'averageCost' | 'lastPrice' | 'marketValue' | 'pnlPercent';

export const PortfolioConsole: React.FC<Props> = ({ positions, baseCurrency }) => {
  const [sortKey, setSortKey] = useState<SortKey>('marketValue');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false); // default to descending for numbers usually
    }
  };

  const sortedPositions = useMemo(() => {
    return [...positions].map(p => {
      const pnlPercent = p.pnl != null && p.marketValue ? (p.pnl / (p.marketValue - p.pnl)) * 100 : 0;
      return { ...p, pnlPercent };
    }).sort((a, b) => {
      let valA: string | number = a[sortKey] || 0;
      let valB: string | number = b[sortKey] || 0;

      if (valA == null) valA = 0;
      if (valB == null) valB = 0;

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [positions, sortKey, sortAsc]);

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40 hover:opacity-100" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 inline ml-1 text-emerald-500" /> : <ArrowDown className="w-3 h-3 inline ml-1 text-emerald-500" />;
  };

  return (
    <div className="bg-black/50 backdrop-blur-md border border-zinc-800/80 rounded-xl shadow-2xl overflow-hidden font-mono text-zinc-300">
      <div className="bg-zinc-900/50 border-b border-zinc-800/80 px-4 py-3 flex flex-col xs:flex-row justify-between items-start xs:items-center text-[10px] md:text-[11px] text-zinc-400 gap-2 xs:gap-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          <span className="tracking-widest font-bold">SYSTEM_PORTFOLIO_CORE_V3</span>
        </div>
        <div className="flex gap-4 tracking-widest font-medium">
          <span>CURRENCY: <span className="text-emerald-400">{baseCurrency}</span></span>
          <span>ASSETS: <span className="text-zinc-100">{positions.length}</span></span>
        </div>
      </div>
      
      {/* Visualização Mobile (Cards) */}
      <div className="md:hidden flex flex-col divide-y divide-zinc-800/50">
        {sortedPositions.map((p) => {
          const isPos = p.pnlPercent >= 0;
          return (
            <div key={p.symbol} className="p-4 flex flex-col gap-3 hover:bg-zinc-900/30 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-zinc-100 text-sm">{p.symbol}</div>
                  <div className="text-[10px] text-zinc-500">Qty: {p.quantity.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-400 text-sm">
                    {p.marketValue ? p.marketValue.toLocaleString('pt-BR', { style: 'currency', currency: baseCurrency }) : '--'}
                  </div>
                  <div className={`text-[11px] font-bold ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {p.pnlPercent > 0 ? '+' : ''}{p.pnlPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-900/40 p-2 rounded border border-zinc-800/50">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Avg Cost</span>
                  <span className="text-zinc-300">{p.averageCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Last Price</span>
                  <span className="text-zinc-300">{p.lastPrice ? p.lastPrice.toFixed(2) : '--'}</span>
                </div>
              </div>
            </div>
          );
        })}
        {sortedPositions.length === 0 && (
          <div className="p-8 text-center text-zinc-600 text-xs italic">AWAITING_DATA...</div>
        )}
      </div>

      {/* Visualização Desktop (Tabela) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 text-zinc-500 text-[10px] uppercase tracking-widest bg-zinc-900/20">
              <th className="px-4 py-3 font-medium cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('symbol')}>
                Symbol <SortIcon colKey="symbol" />
              </th>
              <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('quantity')}>
                Qty <SortIcon colKey="quantity" />
              </th>
              <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('averageCost')}>
                Avg Cost <SortIcon colKey="averageCost" />
              </th>
              <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('lastPrice')}>
                Last Price <SortIcon colKey="lastPrice" />
              </th>
              <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('marketValue')}>
                Market Value <SortIcon colKey="marketValue" />
              </th>
              <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('pnlPercent')}>
                P/L % <SortIcon colKey="pnlPercent" />
              </th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {sortedPositions.map((p) => {
              const isPos = p.pnlPercent >= 0;
              return (
                <tr key={p.symbol} className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-3 font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">{p.symbol}</td>
                  <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">{p.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">{p.averageCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                    {p.lastPrice ? p.lastPrice.toFixed(2) : '--'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-400 tabular-nums shadow-sm">
                    {p.marketValue ? p.marketValue.toLocaleString('pt-BR', { style: 'currency', currency: baseCurrency }) : '--'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {p.pnlPercent > 0 ? '+' : ''}{p.pnlPercent.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
            {sortedPositions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-600 text-xs italic">
                  AWAITING_INCOMING_DATA_STREAM...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="bg-zinc-950/80 px-4 py-2 text-[9px] text-zinc-600 flex justify-between italic tracking-widest border-t border-zinc-800/80">
        <span>READY_STATE::IDLE</span>
        <span>LAST_SYNC: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
