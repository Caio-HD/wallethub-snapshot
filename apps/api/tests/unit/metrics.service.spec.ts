import { MetricsService } from '../../src/modules/investments/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe('calculateBeta', () => {
    it('should calculate beta correctly for simple values', () => {
      // Retornos do Portfólio: [0.01, 0.02, 0.015]
      // Retornos do Benchmark: [0.01, 0.01, 0.01] -> Variância 0 (caso degenerado, mas vamos dar valores reais)
      
      const portfolioReturns = [0.02, 0.04, 0.06];
      const benchmarkReturns = [0.01, 0.02, 0.03];
      
      // Bench: media 0.02. Desvios: [-0.01, 0, 0.01]. Var = (0.0001 + 0 + 0.0001) / 3 = 0.0000666...
      // Port: media 0.04. Desvios: [-0.02, 0, 0.02].
      // Covar = ((-0.01 * -0.02) + 0 + (0.01 * 0.02)) / 3 = (0.0002 + 0.0002) / 3 = 0.0001333...
      // Beta = Covar / Var = 0.0001333 / 0.0000666 = 2.0
      
      const beta = service.calculateBeta(portfolioReturns, benchmarkReturns);
      expect(beta).toBeCloseTo(2.0, 5);
    });

    it('should return 1.0 if benchmark has no variance to avoid division by zero', () => {
      const portfolioReturns = [0.01, 0.02];
      const benchmarkReturns = [0.01, 0.01];
      const beta = service.calculateBeta(portfolioReturns, benchmarkReturns);
      expect(beta).toBe(1.0);
    });
  });

  describe('calculateAlpha', () => {
    it('should calculate Alpha correctly', () => {
      const portfolioReturn = 0.15; // 15%
      const benchmarkReturn = 0.10; // 10%
      const beta = 1.2;
      const riskFreeRate = 0.05; // 5%
      
      // Alpha = 0.15 - [0.05 + 1.2 * (0.10 - 0.05)]
      // Alpha = 0.15 - [0.05 + 1.2 * 0.05]
      // Alpha = 0.15 - [0.05 + 0.06]
      // Alpha = 0.15 - 0.11 = 0.04
      
      const alpha = service.calculateAlpha(portfolioReturn, benchmarkReturn, beta, riskFreeRate);
      expect(alpha).toBeCloseTo(0.04, 5);
    });
  });

  describe('calculateSharpe', () => {
    it('should calculate Sharpe Ratio correctly', () => {
      const returns = [0.01, 0.02, 0.03]; // Media 0.02
      const riskFreeRate = 0.005;
      // Desvios: [-0.01, 0, 0.01]. Var = 0.0000666. Vol = sqrt(0.0000666) = 0.00816
      // Sharpe = (0.02 - 0.005) / 0.00816 = 0.015 / 0.00816 = 1.837
      
      const sharpe = service.calculateSharpe(returns, riskFreeRate);
      expect(sharpe).toBeGreaterThan(1.8);
    });
  });
});
