import { describe, expect, it } from 'vitest';
import {
  formatPlatformPlan,
  formatPlatformRole,
  formatPlatformStatus,
} from '@features/platform/labels';

describe('platform labels', () => {
  it('traduz papéis conhecidos', () => {
    expect(formatPlatformRole('super_admin')).toBe('Super admin');
    expect(formatPlatformRole('admin')).toBe('Administrador');
    expect(formatPlatformRole('unknown')).toBe('unknown');
  });

  it('traduz planos e estados', () => {
    expect(formatPlatformPlan('free')).toBe('Gratuito');
    expect(formatPlatformStatus('active')).toBe('Ativo');
  });
});
