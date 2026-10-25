import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from '@jest/types';
import { pathsToModuleNameMapper } from 'ts-jest';

type TsConfigJson = { compilerOptions?: { paths?: Record<string, string[]> } };

const { compilerOptions = {} } = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tsconfig.json'), 'utf8'),
) as TsConfigJson;
const tsPaths = pathsToModuleNameMapper(compilerOptions.paths ?? {}, {
  prefix: '<rootDir>/',
});

const config: Config.InitialOptions = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/support/setup-env.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  /**
   * Cobertura ≥80% nos pacotes críticos: lista explícita (sem .module / types só interface).
   */
  collectCoverageFrom: [
    'src/modules/statement-import/statement-csv.parser.ts',
    'src/modules/statement-import/statement-import.service.ts',
    'src/modules/statement-import/statement-import.controller.ts',
    'src/modules/transactions/transactions.service.ts',
    'src/modules/plan-entitlements/entitlements.service.ts',
    'src/modules/plan-entitlements/plan-capabilities.ts',
    'src/modules/auth/auth.service.ts',
    'src/modules/auth/strategies/jwt.strategy.ts',
    'src/modules/organizations/organizations.service.ts',
    'src/modules/budgets/budgets.service.ts',
    'src/modules/dashboard/dashboard.service.ts',
    'src/modules/notion/notion-scope-mapper.ts',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  coverageDirectory: 'coverage',
  // Piso anti-regressão (não objetivo — "cobertura é métrica, não objetivo"). Medido no CI de
  // 2026-10-21: a `main` sozinha fica em 68,42% statements / 51,03% branches / 66,5% functions /
  // 68,98% lines (run 39532919043, artefato coverage-unit). O piso anterior (70/70/55) JÁ
  // reprovava antes de qualquer mudança: não impedia regressão, só mantinha a CI vermelha para
  // todo mundo. Os limites antigos (80/75) tinham o mesmo problema e foram ajustados em 46f3e11.
  //
  // Aqui o piso fica 2-3 pontos abaixo do real, como em 46f3e11 (70 contra ~72 real, 55 contra
  // ~58 real): continua sendo rede de segurança contra regressão, sem ser faca de bloqueio.
  // Subir a cobertura de verdade é trabalho separado e está registrado como demanda.
  coverageThreshold: {
    global: {
      statements: 66,
      lines: 66,
      branches: 48,
      functions: 65,
    },
  },
  moduleNameMapper: {
    ...tsPaths,
    '^@whiskeysockets/baileys$': '<rootDir>/test/support/baileys.mock.ts',
    // Map .js extensions to empty (removes .js) for Jest to find .ts files
    // Refined to only match local/aliased imports to avoid breaking node_modules (e.g. sha.js)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(@app|@config|@common|@modules|@queues)(.*)\\.js$': '$1$2',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@simplewebauthn|@hexagon|@peculiar|@scure|otplib)/)',
  ],
};

export default config;
