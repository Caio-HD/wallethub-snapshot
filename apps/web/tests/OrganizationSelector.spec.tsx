import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationSelector } from '@app/layouts/OrganizationSelector';

vi.mock('@shared/ui/select', () => ({
  Select: ({
    label,
    value,
    options,
  }: {
    label: string;
    value: string;
    options: { id: string; name: string }[];
  }) => (
    <select aria-label={label} data-testid="org-select" value={value}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@shared/context/ActiveOrganizationContext', () => ({
  useActiveOrganization: vi.fn(),
}));

import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

const mockedUseActiveOrganization = vi.mocked(useActiveOrganization);

describe('OrganizationSelector', () => {
  it('mostra selector com badge de modo auditoria para operador de plataforma', () => {
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

    render(<OrganizationSelector />);

    expect(screen.getByText('Modo auditoria')).toBeInTheDocument();
    expect(screen.getByTestId('org-select')).toBeInTheDocument();
  });

  it('mostra selector com uma única org (não esconde quando length === 1)', () => {
    mockedUseActiveOrganization.mockReturnValue({
      organizations: [{ id: 'o1', name: 'Única', plan: 'pro' }],
      activeOrganizationId: 'o1',
      activeOrganization: { id: 'o1', name: 'Única', plan: 'pro' },
      setActiveOrganizationId: vi.fn(),
      clearActiveOrganization: vi.fn(),
      isLoadingOrganizations: false,
      refreshOrganizations: vi.fn(),
      isPlatformOperator: false,
      isAuditMode: false,
    });

    render(<OrganizationSelector />);

    expect(screen.queryByText('Modo auditoria')).not.toBeInTheDocument();
    expect(screen.getByTestId('org-select')).toBeInTheDocument();
  });

  it('não renderiza sem organizações', () => {
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

    const { container } = render(<OrganizationSelector />);
    expect(container).toBeEmptyDOMElement();
  });
});
