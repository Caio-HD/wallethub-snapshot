import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PlatformBreadcrumbs } from '@pages/platform/PlatformBreadcrumbs';

describe('PlatformBreadcrumbs', () => {
  it('renderiza trilho com links intermédios', () => {
    render(
      <MemoryRouter>
        <PlatformBreadcrumbs
          items={[
            { label: 'Console', to: '/platform?tab=orgs' },
            { label: 'Organizações', to: '/platform?tab=orgs' },
            { label: 'Casa Lda' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: /Navegação do console/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Console' })).toHaveAttribute(
      'href',
      '/platform?tab=orgs',
    );
    expect(screen.getByRole('link', { name: 'Organizações' })).toHaveAttribute(
      'href',
      '/platform?tab=orgs',
    );
    expect(screen.getByText('Casa Lda')).toHaveAttribute('aria-current', 'page');
  });

  it('marca último item sem link como página actual', () => {
    render(
      <MemoryRouter>
        <PlatformBreadcrumbs
          items={[
            { label: 'Console', to: '/platform?tab=orgs' },
            { label: 'Utilizadores' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Utilizadores')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Utilizadores' })).not.toBeInTheDocument();
  });
});
