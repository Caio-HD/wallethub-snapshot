import React, { useMemo } from 'react';
import { MetricsBentoGrid } from './MetricsBentoGrid';
import { AllocationSunburst } from './AllocationSunburst';
import { PortfolioConsole, Row } from './PortfolioConsole';
import { PerformanceMetrics, PortfolioSummary, PortfolioPosition } from './useInvestments';
import { useTranslation } from 'react-i18next';

interface Props {
  portfolio: PortfolioSummary | null | undefined;
  /** Reservado para evolução do terminal (métricas de performance); hoje o Bento usa dados próprios. */
  metrics?: PerformanceMetrics | null;
  loading?: boolean;
}

export const InvestmentTerminal: React.FC<Props> = ({ portfolio }) => {
  const baseCurrency = portfolio?.baseCurrency || 'BRL';
  const { t } = useTranslation('investments');

  const consolePositions = useMemo(() => {
    if (!portfolio?.positions) return [];
    return (portfolio.positions as PortfolioPosition[]).map((p) => ({
      ...p,
      pnl: p.unrealizedPnl // Mapeamento para o PortfolioConsole
    })) as unknown as Row[];
  }, [portfolio]);

  return (
    <div className="terminal-container bg-[#050505] min-h-screen text-zinc-300 p-4 md:p-8 font-mono selection:bg-emerald-500/30">
      {/* CRT Scanline Effect */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden opacity-[0.03]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      </div>

      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="text-emerald-500 text-[12px] mb-1 tracking-widest">{t('terminal.moduleOverview')}</div>
          <h1 className="text-3xl font-black tracking-tighter text-zinc-100 flex items-center gap-3">
            {t('terminal.dashboardTitle')}
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded">{t('terminal.terminalVersion')}</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-500 uppercase">{t('terminal.equityTotal', { baseCurrency })}</div>
          <div className="text-4xl font-bold text-emerald-400 tabular-nums tracking-tighter">
            {portfolio?.totalMarketValue?.toLocaleString('pt-BR', { style: 'currency', currency: baseCurrency })}
          </div>
          <div className={`text-[12px] font-bold ${(portfolio?.totalUnrealizedPnl ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {(portfolio?.totalUnrealizedPnl ?? 0) >= 0 ? '▲' : '▼'} {portfolio?.totalUnrealizedPnl?.toLocaleString('pt-BR', { style: 'currency', currency: baseCurrency })} ({t('terminal.netProfitLabel')})
          </div>
        </div>
      </header>

      {/* NOVO: Bento Box de Métricas */}
      <MetricsBentoGrid />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="text-[11px] text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500"></span> {t('terminal.activePositions')}
            </h2>
            <PortfolioConsole positions={consolePositions} baseCurrency={baseCurrency} />
          </section>
          
          <section className="bg-black border border-zinc-800 p-4 rounded">
            <h2 className="text-[11px] text-zinc-500 uppercase tracking-widest mb-3">{t('terminal.systemLogs')}</h2>
            <div className="text-[10px] space-y-1 font-mono text-zinc-400">
              <div>{t('terminal.recalculatingAlphaBeta')}</div>
              <div>{t('terminal.syncingExternalBenchmark')}</div>
              <div>{t('terminal.coreMetricsUpdate')}</div>
              <div className="text-emerald-500 text-[11px] mt-2 font-bold select-none cursor-default">{t('terminal.systemReady')}</div>
            </div>
          </section>
        </div>
        
        {/* NOVO: Visualização Multi-Dimensional */}
        <div className="space-y-6">
          <AllocationSunburst />
          
          <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800 text-[10px] text-slate-500 italic">
            {t('terminal.alphaBetaMetricsDescription')}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .terminal-container {
          text-shadow: 0 0 2px rgba(52, 211, 153, 0.2);
        }
      `}} />
    </div>
  );
};
