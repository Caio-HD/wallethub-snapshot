import { describe, expect, it } from 'vitest';
import { buildPlatformBreadcrumbs, platformPath } from '@features/platform/platformNav';

describe('platformPath', () => {
  it('gera URL com tab apenas', () => {
    expect(platformPath({ tab: 'audit' })).toBe('/platform?tab=audit');
  });

  it('inclui orgId e userId quando presentes', () => {
    expect(platformPath({ tab: 'orgs', orgId: 'o1' })).toBe('/platform?tab=orgs&orgId=o1');
    expect(platformPath({ tab: 'users', userId: 'u1' })).toBe('/platform?tab=users&userId=u1');
  });
});

describe('buildPlatformBreadcrumbs', () => {
  it('lista de organizações', () => {
    expect(buildPlatformBreadcrumbs('orgs')).toEqual([
      { label: 'Console', to: '/platform?tab=orgs' },
      { label: 'Organizações' },
    ]);
  });

  it('detalhe de organização', () => {
    expect(
      buildPlatformBreadcrumbs('orgs', { orgId: 'o1', orgName: 'Casa Lda' }),
    ).toEqual([
      { label: 'Console', to: '/platform?tab=orgs' },
      { label: 'Organizações', to: '/platform?tab=orgs' },
      { label: 'Casa Lda' },
    ]);
  });

  it('lista de utilizadores', () => {
    expect(buildPlatformBreadcrumbs('users')).toEqual([
      { label: 'Console', to: '/platform?tab=orgs' },
      { label: 'Utilizadores' },
    ]);
  });

  it('detalhe de utilizador', () => {
    expect(
      buildPlatformBreadcrumbs('users', { userId: 'u1', userName: 'Ana Silva' }),
    ).toEqual([
      { label: 'Console', to: '/platform?tab=orgs' },
      { label: 'Utilizadores', to: '/platform?tab=users' },
      { label: 'Ana Silva' },
    ]);
  });

  it('aba de sistema', () => {
    expect(buildPlatformBreadcrumbs('audit')).toEqual([
      { label: 'Console', to: '/platform?tab=orgs' },
      { label: 'Auditoria' },
    ]);
  });

  it('usa reticências quando nome ainda não carregou', () => {
    expect(buildPlatformBreadcrumbs('orgs', { orgId: 'o1' })).toEqual([
      { label: 'Console', to: '/platform?tab=orgs' },
      { label: 'Organizações', to: '/platform?tab=orgs' },
      { label: '…' },
    ]);
  });
});
