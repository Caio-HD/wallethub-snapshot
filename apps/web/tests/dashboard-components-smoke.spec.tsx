import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CategoriesReportVisual } from '@features/dashboard/CategoriesReportVisual';
import { CashflowTimelineChart } from '@features/dashboard/CashflowTimelineChart';
import { DashboardInvestmentsCard } from '@features/dashboard/DashboardInvestmentsCard';
import { EvolutionChart } from '@features/dashboard/EvolutionChart';
import { KpiCard } from '@features/dashboard/KpiCard';
import { PeriodPicker } from '@features/dashboard/PeriodPicker';

describe('componentes do dashboard (smoke)', () => {
  it('CategoriesReportVisual mostra skeleton em loading', () => {
    render(<CategoriesReportVisual items={[]} isLoading />);
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('CategoriesReportVisual renderiza gráficos com dados', () => {
    render(
      <div style={{ width: 640, height: 480 }}>
        <CategoriesReportVisual
        isLoading={false}
        items={[
          {
            categoryId: '1',
            name: 'Salário',
            type: 'income',
            totalIncome: 1000,
            totalExpense: 0,
          },
          {
            categoryId: '2',
            name: 'Mercado',
            type: 'expense',
            totalIncome: 0,
            totalExpense: 250,
          },
        ]}
        />
      </div>,
    );
    expect(screen.getByText('Receitas por categoria')).toBeInTheDocument();
    expect(screen.getByText('Despesas por categoria')).toBeInTheDocument();
  });

  it('CashflowTimelineChart renderiza com dados', () => {
    render(
      <div style={{ width: 640, height: 400 }}>
        <CashflowTimelineChart
        data={[
          {
            month: 'Jan',
            period: '2025-01',
            income: 100,
            expense: 40,
            balance: 60,
            rowKind: 'actual',
          },
        ]}
        highlightPeriod="2025-01"
        todayPeriod="2025-02"
        />
      </div>,
    );
    expect(screen.getByText('Fluxo mensal (realizado e projetado)')).toBeInTheDocument();
  });

  it('EvolutionChart renderiza com dados', () => {
    render(
      <div style={{ width: 640, height: 400 }}>
        <EvolutionChart
        data={[
          {
            month: 'Jan',
            period: '2025-01',
            income: 10,
            expense: 5,
            balance: 5,
          },
        ]}
        />
      </div>,
    );
    expect(screen.getByText(/Evolução/i)).toBeInTheDocument();
  });

  it('KpiCard mostra variação positiva', () => {
    render(
      <KpiCard title="Saldo" value={100} variation={2.5} />,
    );
    expect(screen.getByText('Saldo')).toBeInTheDocument();
    expect(screen.getByText(/\+2\.5%/)).toBeInTheDocument();
  });

  it('KpiCard cobre variação negativa, zero e estável', () => {
    const { rerender } = render(<KpiCard title="Despesas" value={50} variation={-1.2} />);
    expect(screen.getByText(/-1\.2%/)).toBeInTheDocument();
    rerender(<KpiCard title="Despesas" value={50} variation={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    rerender(<KpiCard title="Despesas" value={50} />);
    expect(screen.getByText('Estável')).toBeInTheDocument();
  });

  it('PeriodPicker chama onChange', () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="2025-01" onChange={onChange} selectionMode="single" />);
    expect(screen.getByRole('button', { name: /Janeiro de 2025/i })).toBeInTheDocument();
  });

  it('DashboardInvestmentsCard liga ao portefólio', () => {
    render(
      <MemoryRouter>
        <div style={{ width: 640, height: 420 }}>
        <DashboardInvestmentsCard
          portfolioValue={1000}
          periodSummary={{
            period: '2025-01',
            totalBuys: 10,
            totalSells: 5,
            totalDividends: 1,
            buyCount: 1,
            sellCount: 1,
            dividendCount: 1,
            totalMarketValue: 1000,
            totalUnrealizedPnl: 0,
          }}
          isLoadingPortfolio={false}
          isLoadingPeriod={false}
        />
        </div>
      </MemoryRouter>,
    );
    expect(screen.getByText('Carteira de investimentos')).toBeInTheDocument();
  });

  it('PeriodPicker aplica atalho de intervalo em modo múltiplo', () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="2025-06" onChange={onChange} selectionMode="multiple" />);
    fireEvent.click(screen.getByRole('button', { name: /junho de 2025/i }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Selecionar os seis meses consecutivos que terminam no mês de referência/i,
      }),
    );
    expect(onChange).toHaveBeenCalled();
  });
});
