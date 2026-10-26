import { Injectable } from '@nestjs/common';
import { InvestmentMovementEntity } from '../../database/entities/investment-movement.entity';

export interface PerformanceMetrics {
  twr: number; // Time-Weighted Return
  mwr: number; // Money-Weighted Return
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  alpha: number;
  beta: number;
}

@Injectable()
export class MetricsService {
  /**
   * Calcula o TWR do período.
   * Simplificado: geometric link of sub-period returns (split by cash flows).
   */
  calculateTWR(
    movements: InvestmentMovementEntity[],
    initialValue: number,
    finalValue: number,
  ): number {
    if (initialValue === 0 && movements.length === 0) return 0;

    let netFlow = 0;
    for (const m of movements) {
      const val = Number(m.quantity) * Number(m.unitPrice) + Number(m.fees ?? 0);
      if (m.kind === 'buy') netFlow += val;
      if (m.kind === 'sell') netFlow -= val;
    }

    const denominator = initialValue + netFlow / 2; // Simplificação de Dietz
    if (denominator <= 0) return 0;
    return (finalValue - initialValue - netFlow) / denominator;
  }

  /**
   * Calcula o Sharpe Ratio.
   * (R - Rf) / Volatilidade.
   */
  calculateSharpe(returns: number[], riskFreeRate = 0.1): number {
    if (returns.length < 2) return 0;
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / returns.length;
    const vol = Math.sqrt(variance);
    if (vol === 0) return 0;
    return (avg - riskFreeRate) / vol;
  }

  /**
   * Calcula o Max Drawdown.
   */
  calculateMaxDrawdown(values: number[]): number {
    if (values.length === 0) return 0;
    let peak = -Infinity;
    let maxDD = 0;

    for (const v of values) {
      if (v > peak) peak = v;
      if (peak <= 0) continue;
      const dd = (peak - v) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  }

  /**
   * Calcula o Beta de uma carteira em relação a um benchmark.
   * Beta = Cov(Rp, Rm) / Var(Rm)
   */
  calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length < 2) {
      return 1; // Default neutral Beta
    }

    const n = portfolioReturns.length;
    const meanP = portfolioReturns.reduce((a, b) => a + b, 0) / n;
    const meanB = benchmarkReturns.reduce((a, b) => a + b, 0) / n;

    let covariance = 0;
    let varianceB = 0;

    for (let i = 0; i < n; i++) {
      covariance += (portfolioReturns[i] - meanP) * (benchmarkReturns[i] - meanB);
      varianceB += Math.pow(benchmarkReturns[i] - meanB, 2);
    }

    if (varianceB === 0) return 1;
    return covariance / varianceB;
  }

  /**
   * Calcula o Alpha (Jensen's Alpha).
   * Alpha = Rp - [Rf + Beta * (Rm - Rf)]
   */
  calculateAlpha(
    portfolioReturn: number,
    benchmarkReturn: number,
    beta: number,
    riskFreeRate = 0.1,
  ): number {
    return portfolioReturn - (riskFreeRate + beta * (benchmarkReturn - riskFreeRate));
  }
}
