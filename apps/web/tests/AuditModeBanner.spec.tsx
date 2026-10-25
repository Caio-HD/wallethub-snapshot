import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuditModeBanner } from '@app/layouts/AuditModeBanner';

vi.mock('@shared/ui/button', () => ({
  Button: ({
    children,
    onClick,
    asChild,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
  }) => (asChild ? children : <button onClick={onClick}>{children}</button>),
}));

vi.mock('@shared/context/ActiveOrganizationContext', () => ({
  useActiveOrganization: vi.fn(),
}));

import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

const mockedUseActiveOrganization = vi.mocked(useActiveOrganization);

const renderBanner = (pathname = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AuditModeBanner />
    </MemoryRouter>,
  );

describe('AuditModeBanner', () => {
  it('mostra banner activo quando operador está em modo auditoria', () => {
    mockedUseActiveOrganization.mockReturnValue({
      organizations: [{ id: 'o1', name: 'Casa', plan: 'free' }],
      activeOrganizationId: 'o1',
      activeOrganization: { id: 'o1', name: 'Casa', plan: 'free' },
      setActiveOrganizationId: vi.fn(),
      clearActiveOrganization: vi.fn(),
      isLoadingOrganizations: false,
      refreshOrganizations: vi.fn(),
      isPlatformOperator: true,
      isAuditMode: true,
    });

    renderBanner('/dashboard');

    expect(screen.getByText(/Modo auditoria/i)).toBeInTheDocument();
    expect(screen.getByText(/Casa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sair da auditoria/i })).toBeInTheDocument();
  });

  it('pede selecção de org quando operador não tem org activa', () => {
    mockedUseActiveOrganization.mockReturnValue({
      organizations: [{ id: 'o1', name: 'Casa', plan: 'free' }],
      activeOrganizationId: null,
      activeOrganization: null,
      setActiveOrganizationId: vi.fn(),
      clearActiveOrganization: vi.fn(),
      isLoadingOrganizations: false,
      refreshOrganizations: vi.fn(),
      isPlatformOperator: true,
      isAuditMode: false,
    });

    renderBanner('/entries');

    expect(screen.getByText(/Selecione uma organização/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Console → Abrir como esta org/i })).toHaveAttribute(
      'href',
      '/platform?tab=orgs',
    );
  });

  it('não renderiza no console de plataforma', () => {
    mockedUseActiveOrganization.mockReturnValue({
      organizations: [],
      activeOrganizationId: null,
      activeOrganization: null,
      setActiveOrganizationId: vi.fn(),
      clearActiveOrganization: vi.fn(),
      isLoadingOrganizations: false,
      refreshOrganizations: vi.fn(),
      isPlatformOperator: true,
      isAuditMode: false,
    });

    const { container } = renderBanner('/platform');
    expect(container).toBeEmptyDOMElement();
  });

  it('limpa org activa ao sair da auditoria', () => {
    const clearActiveOrganization = vi.fn();
    mockedUseActiveOrganization.mockReturnValue({
      organizations: [{ id: 'o1', name: 'Casa', plan: 'free' }],
      activeOrganizationId: 'o1',
      activeOrganization: { id: 'o1', name: 'Casa', plan: 'free' },
      setActiveOrganizationId: vi.fn(),
      clearActiveOrganization,
      isLoadingOrganizations: false,
      refreshOrganizations: vi.fn(),
      isPlatformOperator: true,
      isAuditMode: true,
    });

    renderBanner('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Sair da auditoria/i }));
    expect(clearActiveOrganization).toHaveBeenCalled();
  });
});
