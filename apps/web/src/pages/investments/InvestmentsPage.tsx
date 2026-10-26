import { useMemo, useState, useRef } from 'react';
import { format } from 'date-fns';
import {
  usePortfolio,
  useCreateInvestmentMovement,
  usePerformanceMetrics,
  type CreateMovementPayload,
} from '@features/investments/useInvestments';
import { InvestmentTerminal } from '@features/investments/InvestmentTerminal';
import { useAccounts } from '@features/accounts/useAccounts';
import apiClient from '@shared/lib/apiClient';

import { Card, CardTitle } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Select } from '@shared/ui/select';
import { DatePicker } from '@shared/ui/date-picker';
import { InvestmentProjectionChart } from '@features/investments/InvestmentProjectionChart';
import { Label } from '@shared/ui/label';
import { Slider } from '@shared/ui/slider';
import { Calculator } from 'lucide-react';

interface AssetSuggestion {
  symbol: string;
  displayName: string;
  kind?: 'stock' | 'fii' | 'etf' | 'other';
  quoteSymbol?: string;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const emptyForm: CreateMovementPayload = {
  symbol: '',
  market: 'BR',
  kind: 'stock',
  movementKind: 'buy',
  quantity: 0,
  unitPrice: 0,
  fees: 0,
  notes: '',
  occurredAt: format(new Date(), 'yyyy-MM-dd'),
};

export const InvestmentsPage = () => {
  const { data: portfolio, isLoading: loadingPortfolio } = usePortfolio();
  const { data: metrics, isLoading: loadingMetrics } = usePerformanceMetrics();
  const createMut = useCreateInvestmentMovement();
  const { data: accounts = [] } = useAccounts();

  const [formOpen, setFormOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [form, setForm] = useState<CreateMovementPayload>(emptyForm);
  const isFixed = form.kind === 'fixed_income';
  const total = useMemo(
    () =>
      (isFixed ? (form.amount ?? 0) : (form.quantity ?? 0) * (form.unitPrice ?? 0)) +
      (form.fees || 0),
    [isFixed, form.amount, form.quantity, form.unitPrice, form.fees],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);

  const isPriceManuallyEdited = useRef(false);
  const [isPriceFetching, setIsPriceFetching] = useState(false);

  // Parâmetros de projeção
  const [projMonths, setProjMonths] = useState(60); 
  const [monthlyContribution, setMonthlyContribution] = useState(1000);
  const [expectedReturn, setExpectedReturn] = useState(10); 
  const [volatility, setVolatility] = useState(5); 

  // Lógica de busca de ativos
  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const { data } = await apiClient.get<AssetSuggestion[]>(`/investments/search-assets`, {
        params: { q: val, market: form.market }
      });
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    }
  };

  // Buscar preço histórico quando mudar ticker ou data
  const fetchPrice = async (symbol: string, date: string, market: string) => {
    if (!symbol || !date) return;
    setIsPriceFetching(true);
    try {
      const { data } = await apiClient.get<{ price: number }>(`/investments/historical-price`, {
        params: { symbol, market, date }
      });
      setIsPriceFetching(false);
      if (data?.price && !isPriceManuallyEdited.current) {
        setForm(f => ({ ...f, unitPrice: data.price }));
      }
    } catch {
      setIsPriceFetching(false);
    }

  };

  const handleSelectAsset = (asset: AssetSuggestion) => {
    isPriceManuallyEdited.current = false;
    setForm(f => {
      const next: CreateMovementPayload = { 
        ...f, 
        symbol: asset.symbol, 
        displayName: asset.displayName || '', 
        kind: asset.kind || f.kind 
      };
      if (f.occurredAt) fetchPrice(asset.symbol, f.occurredAt, f.market);
      return next;
    });
    setSearchQuery(asset.symbol);
    setSuggestions([]);
  };

  const handleQtyChange = (val: number) => {
    setForm(f => ({ ...f, quantity: val }));
  };

  const handlePriceChange = (val: number) => {
    isPriceManuallyEdited.current = true;
    setForm(f => ({ ...f, unitPrice: val }));
  };


  const projectionData = useMemo(() => {
    if (!portfolio) return [];
    const data = [];
    const expectedReturnNum = Number(expectedReturn) || 0;
    const volatilityNum = Number(volatility) || 0;
    const monthlyContributionNum = Number(monthlyContribution) || 0;
    const monthlyRate = (1 + expectedReturnNum / 100) ** (1 / 12) - 1;
    const monthlyVol = (volatilityNum / 100) / Math.sqrt(12);

    let currentBalance = Number(portfolio.totalMarketValue) || 0;
    let totalContributed = Number(portfolio.totalMarketValue) || 0;
    let optimisticBalance = currentBalance;
    let pessimisticBalance = currentBalance;
    const now = new Date();
    
    for (let i = 0; i <= projMonths; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      
      // Validação final para evitar que p.ex. o Recharts exploda com NaNs
      const safeContributed = Math.round(totalContributed) || 0;
      const safeProjected = Math.round(currentBalance) || 0;
      const safeOptimistic = Math.round(optimisticBalance) || 0;
      const safePessimistic = Math.round(pessimisticBalance) || 0;

      data.push({
        month: format(monthDate, 'MMM/yy'),
        contributions: isFinite(safeContributed) ? safeContributed : 0,
        projected: isFinite(safeProjected) ? safeProjected : 0,
        optimistic: isFinite(safeOptimistic) ? safeOptimistic : 0,
        pessimistic: isFinite(safePessimistic) ? safePessimistic : 0,
      });

      const yieldAmount = currentBalance * monthlyRate;
      currentBalance += yieldAmount + monthlyContributionNum;
      totalContributed += monthlyContributionNum;
      optimisticBalance += yieldAmount * 1.2 + monthlyContributionNum + (currentBalance * monthlyVol);
      pessimisticBalance += yieldAmount * 0.8 + monthlyContributionNum - (currentBalance * monthlyVol);
      
      if (pessimisticBalance < totalContributed * 0.5) {
        pessimisticBalance = totalContributed * 0.5;
      }
    }
    return data;
  }, [portfolio, projMonths, monthlyContribution, expectedReturn, volatility]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateMovementPayload = {
      ...form,
      symbol: form.symbol.trim().toUpperCase(),
      notes: form.notes?.trim() || undefined,
      fees: form.fees && form.fees > 0 ? form.fees : undefined,
      occurredAt: form.occurredAt?.trim() || undefined,
      quoteSymbol: form.quoteSymbol?.trim() || undefined,
      displayName: form.displayName?.trim() || undefined,
    };
    createMut.mutate(payload, {
      onSuccess: () => {
        setFormOpen(false);
        setForm({ ...emptyForm });
        setSearchQuery('');
      },

    });
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] flex flex-col md:flex-row gap-3 items-end md:items-center">
        <Button 
          variant="secondary" 
          size="lg" 
          className="rounded-full font-mono bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 font-extrabold uppercase tracking-widest px-8 w-fit"
          onClick={() => setFormOpen(!formOpen)}
        >
          {formOpen ? 'CLOSE_CONSOLE' : 'EXEC_APPEND_MOVEMENT'}
        </Button>
        <Button 
          variant="secondary" 
          size="lg" 
          className="rounded-full font-mono bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/30 hover:shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all duration-300 font-extrabold uppercase tracking-widest px-8 w-fit"
          onClick={() => setProjOpen(!projOpen)}
        >
          {projOpen ? 'CLOSE_PROJ' : 'RUN_PROJECTION_MODEL'}
        </Button>
      </div>

      <InvestmentTerminal
        portfolio={portfolio}
        metrics={metrics || null}
        loading={loadingPortfolio || loadingMetrics}
      />

      {/* Portal-like Overlays for Terminal feel */}
      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800 text-zinc-100 font-mono">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <CardTitle className="text-sm font-bold text-emerald-500 tracking-tighter">
                &gt; RECORD_NEW_MOVEMENT_PTR
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} className="text-zinc-500 hover:text-zinc-300">ESCAPE</Button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
              <div className="space-y-2">
                <Label className="text-[10px] text-zinc-500 uppercase font-black">Asset_Class</Label>
                <Select
                  value={form.kind ?? 'stock'}
                  onChange={(v: string) =>
                    setForm((f) => ({ ...f, kind: v as CreateMovementPayload['kind'] }))
                  }
                  options={[
                    { id: 'stock', name: 'AÇÃO / STOCK' },
                    { id: 'fii', name: 'FII' },
                    { id: 'etf', name: 'ETF' },
                    { id: 'fixed_income', name: 'RENDA FIXA (RDB/CDB)' },
                    { id: 'other', name: 'OUTRO' },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] text-zinc-500 uppercase font-black">
                    {isFixed ? 'Currency_Region' : 'Market_Region'}
                  </Label>
                  <Select 
                    value={form.market} 
                    onChange={(v: string) => {
                      const m = v as 'BR' | 'INTL';
                      setForm(f => ({ ...f, market: m, symbol: '', quoteSymbol: undefined }));
                      setSearchQuery('');
                    }}
                    options={[{ id: 'BR', name: 'B3 (BRL)' }, { id: 'INTL', name: 'GLOBAL (USD)' }]}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-zinc-500 uppercase font-black">
                    {isFixed ? 'Identifier_Name' : 'Instrument_Ticker'}
                  </Label>
                  {isFixed ? (
                    <Input
                      placeholder="RDB Nubank, CDB Inter..."
                      className="bg-black border-zinc-700 font-bold uppercase tracking-widest text-emerald-400"
                      value={form.symbol}
                      onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                      required
                    />
                  ) : (
                  <div className="relative">
                    <Input
                      placeholder="PETR4, AAPL..."
                      className="bg-black border-zinc-700 font-bold uppercase tracking-widest text-emerald-400"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      required
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute top-12 left-0 w-full bg-zinc-950 border border-zinc-700 rounded-md z-50 shadow-2xl">
                        {suggestions.map(s => (
                          <button 
                            key={s.symbol} 
                            type="button"
                            className="w-full text-left p-3 hover:bg-zinc-800 border-b border-zinc-900 last:border-0 flex justify-between items-center group"
                            onClick={() => handleSelectAsset(s)}
                          >
                            <span className="font-bold text-sky-400 group-hover:text-emerald-400">{s.symbol}</span>
                            <span className="text-[10px] text-zinc-600 truncate max-w-[150px]">{s.displayName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] text-zinc-500 uppercase font-black">Movement_Type</Label>
                  <Select 
                    value={form.movementKind} 
                    onChange={(v: string) => setForm({ ...form, movementKind: v as 'buy' | 'sell' | 'dividend' })}
                    options={[{id: 'buy', name: 'BUY'}, {id: 'sell', name: 'SELL'}, {id: 'dividend', name: 'DIVIDEND'}]}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-zinc-500 uppercase font-black">Execution_Date</Label>
                  <DatePicker 
                    value={form.occurredAt || ''} 
                    onChange={v => {
                      isPriceManuallyEdited.current = false;
                      setForm(f => ({ ...f, occurredAt: v }));
                      if (form.symbol) fetchPrice(form.symbol, v, form.market);
                    }} 
                  />
                </div>
              </div>

              {isFixed && (
                <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-lg border border-zinc-800">
                  <div className="space-y-1">
                    <Label className="text-[9px] text-zinc-600 uppercase">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.amount ?? 0}
                      onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                      className="bg-transparent border-none p-0 h-auto text-lg font-bold focus:ring-0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] text-zinc-600 uppercase">Conta de caixa (opcional)</Label>
                    <Select
                      value={form.accountId ?? ''}
                      onChange={(v: string) =>
                        setForm((f) => ({ ...f, accountId: v || undefined }))
                      }
                      options={[
                        { id: '', name: '— sem conta —' },
                        ...accounts.map((a) => ({ id: a.id, name: a.name })),
                      ]}
                    />
                  </div>
                </div>
              )}

              <div
                className={`grid grid-cols-3 gap-4 bg-black/40 p-4 rounded-lg border border-zinc-800 ${
                  isFixed ? 'hidden' : ''
                }`}
              >
                <div className="space-y-1">
                  <Label className="text-[9px] text-zinc-600 uppercase">Qty</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.quantity}
                    onChange={e => handleQtyChange(Number(e.target.value))}
                    className="bg-transparent border-none p-0 h-auto text-lg font-bold focus:ring-0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-zinc-600 uppercase">Unit_Price</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="any"
                      value={form.unitPrice} 
                      onChange={e => handlePriceChange(Number(e.target.value))} 
                      className="bg-transparent border-none p-0 h-auto text-lg font-bold text-sky-400 focus:ring-0"
                    />
                    {isPriceFetching && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 items-center">
                           <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-sky-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                        </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-zinc-600 uppercase">Fees</Label>
                  <Input 
                    type="number" 
                    step="any"
                    value={form.fees || 0} 
                    onChange={e => {
                      const v = Number(e.target.value);
                      setForm(f => ({ ...f, fees: v }));
                  }} 
                    className="bg-transparent border-none p-0 h-auto text-lg font-bold text-rose-500 focus:ring-0"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Total_Execution_Value</div>
                <div className="text-2xl font-black text-emerald-400 tabular-nums">
                  {form.market === 'BR' ? brl.format(total) : usd.format(total)}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-black h-12 text-sm tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  disabled={createMut.isPending || !form.symbol}
                >
                  {createMut.isPending ? 'PROCESSING_COMMIT...' : 'INITIALIZE_COMMIT'}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  className="border-zinc-700 text-zinc-500"
                >
                  ABORT
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Projection Simulator Overlay */}
      {projOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
           <Card className="w-full max-w-6xl bg-zinc-900 border-zinc-800 h-[90vh] flex flex-col overflow-hidden font-mono">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                <div className="flex items-center gap-3">
                  <Calculator className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-black text-emerald-500 tracking-widest uppercase">PROJECTION_SIMULATOR_CORE_V4</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setProjOpen(false)} className="text-zinc-500 hover:text-rose-500">TERMINATE_PROCESS</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                 <div className="h-[450px] bg-black/40 p-6 rounded-lg border border-zinc-800 shadow-inner">
                    <InvestmentProjectionChart data={projectionData} />
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-zinc-950 p-6 rounded-lg border border-zinc-800 relative shadow-2xl">
                    <div className="absolute top-0 right-0 p-2 text-[10px] text-zinc-800 font-black uppercase tracking-widest">Parameter_Matrix</div>
                    
                    <div className="space-y-3">
                      <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Contribution_Monthly</Label>
                      <Input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="bg-black border-zinc-700 text-sky-400 font-bold h-12 text-lg" />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Growth_Target (% a.a.)</Label>
                      <div className="flex items-center gap-4">
                        <Slider value={[expectedReturn]} min={0} max={30} step={0.5} onValueChange={(v: number[]) => setExpectedReturn(v[0])} className="flex-1" />
                        <span className="text-emerald-400 font-black min-w-[3rem] text-right">{expectedReturn}%</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Volatility_Risk (%)</Label>
                      <div className="flex items-center gap-4">
                        <Slider value={[volatility]} min={0} max={30} step={1} onValueChange={(v: number[]) => setVolatility(v[0])} className="flex-1" />
                        <span className="text-rose-500 font-black min-w-[3rem] text-right">{volatility}%</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Time_Horizon (Months)</Label>
                      <div className="flex items-center gap-4">
                        <Slider value={[projMonths]} min={12} max={480} step={12} onValueChange={(v: number[]) => setProjMonths(v[0])} className="flex-1" />
                        <span className="text-sky-400 font-black min-w-[3rem] text-right">{projMonths}m</span>
                      </div>
                    </div>
                 </div>
              </div>
              <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-600 italic">
                <span>SIMULATION_ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                <span>SYSTEM_V_PORT: {portfolio?.baseCurrency || 'BRL'}</span>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
};
