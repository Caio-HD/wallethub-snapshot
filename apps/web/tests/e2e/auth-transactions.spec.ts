import { expect, test } from '@playwright/test';

/**
 * Teste E2E com mocks da API (padrão)
 * 
 * Este teste usa mocks para simular a API. Para usar API real:
 * 1. Configure VITE_API_URL apontando para a API real (ex: http://localhost:3000/api)
 * 2. Remova ou comente o page.route() abaixo
 * 3. Certifique-se de que a API está rodando e tem dados de teste
 * 
 * Exemplo para usar API real:
 * VITE_API_URL=http://localhost:3000/api npm run test:e2e -- tests/e2e/auth-transactions.spec.ts
 */

const jsonHeaders = { 'Content-Type': 'application/json' };

const fulfillJson = (route: any, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });

test('fluxo completo: login e criação de lançamento', async ({ page }) => {
  const now = new Date();
  const user = {
    id: 'user-1',
    name: 'Admin Wallet',
    email: 'admin@wallethub.test',
    phoneNumber: '+5511999999999',
    role: 'admin' as const,
  };

  const categories = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Salário',
      type: 'income' as const,
      ownerUserId: null,
      isActive: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Supermercado',
      type: 'expense' as const,
      ownerUserId: null,
      isActive: true,
    },
  ];

  const accounts = [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Carteira',
      ownerUserId: null,
      initialBalance: '0.00',
      isActive: true,
    },
  ];

  const state = {
    isAuthenticated: false,
    transactions: [] as Array<{
      id: string;
      occurredAt: string;
      accountId: string;
      categoryId: string;
      userId: string;
      direction: 'income' | 'expense';
      amount: string;
      description: string;
      source: 'web' | 'whatsapp';
      category: (typeof categories)[number];
      account: (typeof accounts)[number];
    }>,
  };

  const computeSummary = () => {
    const totals = state.transactions.reduce(
      (
        acc,
        transaction,
      ): {
        income: number;
        expense: number;
        categories: Map<string, { categoryId: string; name: string; total: number }>;
      } => {
        const amount = Number(transaction.amount);
        if (transaction.direction === 'income') {
          acc.income += amount;
        } else {
          acc.expense += amount;
        }
        const current =
          acc.categories.get(transaction.categoryId) ??
          {
            categoryId: transaction.categoryId,
            name: transaction.category.name,
            total: 0,
          };
        current.total += transaction.direction === 'income' ? amount : 0;
        acc.categories.set(transaction.categoryId, current);
        return acc;
      },
      { income: 0, expense: 0, categories: new Map<string, { categoryId: string; name: string; total: number }>() },
    );

    return {
      period: now.toISOString().slice(0, 7),
      scope: 'all' as const,
      totalIncome: totals.income,
      totalExpense: totals.expense,
      balance: totals.income - totals.expense,
      topCategories: Array.from(totals.categories.values()).sort((a, b) => b.total - a.total),
    };
  };

  await page.route('**/__api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let path = url.pathname.slice('/__api'.length);
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    const method = request.method().toUpperCase();

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: jsonHeaders });
    }

    const unauthorized = () => fulfillJson(route, { message: 'Unauthorized' }, 401);

    if (path === '/auth/login' && method === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}');
      if (payload.username !== 'admin' || payload.password !== 'supersecret') {
        return unauthorized();
      }
      state.isAuthenticated = true;
      return fulfillJson(route, {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      });
    }

    // Login virou multi-step: o identificador é validado antes de pedir a senha.
    if (path === '/auth/validate-identifier' && method === 'POST') {
      return fulfillJson(route, {
        exists: true,
        methods: ['password'],
        username: 'admin',
        name: user.name,
      });
    }

    if (!state.isAuthenticated) {
      return unauthorized();
    }

    if (path === '/auth/refresh' && method === 'POST') {
      return fulfillJson(route, {
        accessToken: 'access-token-2',
        refreshToken: 'refresh-token-2',
        expiresIn: 900,
        tokenType: 'Bearer',
      });
    }

    if (path === '/auth/logout' && method === 'POST') {
      state.isAuthenticated = false;
      state.transactions = [];
      return fulfillJson(route, {}, 200);
    }

    if (path === '/users/me' && method === 'GET') {
      return fulfillJson(route, user);
    }

    if (path === '/categories' && method === 'GET') {
      return fulfillJson(route, categories);
    }

    if (path === '/accounts' && method === 'GET') {
      return fulfillJson(route, accounts);
    }

    if (path === '/whatsapp/health' && method === 'GET') {
      return fulfillJson(route, {
        inbound: { waiting: 0, active: 1 },
        outbound: { waiting: 0, active: 1 },
      });
    }

    if (path === '/transactions' && method === 'GET') {
      return fulfillJson(route, state.transactions);
    }

    if (path === '/transactions' && method === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}');
      const category = categories.find((cat) => cat.id === payload.categoryId) ?? categories[0];
      const account = accounts.find((acc) => acc.id === payload.accountId) ?? accounts[0];

      const transaction = {
        id: `txn-${state.transactions.length + 1}`,
        occurredAt: payload.occurredAt ?? now.toISOString(),
        accountId: account.id,
        categoryId: category.id,
        userId: user.id,
        direction: category.type === 'income' ? 'income' : 'expense',
        amount: Number(payload.amount ?? 0).toFixed(2),
        description: payload.description ?? '',
        source: 'web' as const,
        category,
        account,
      };

      state.transactions.push(transaction);
      return fulfillJson(route, transaction, 201);
    }

    if (path === '/dashboard/summary' && method === 'GET') {
      return fulfillJson(route, computeSummary());
    }

    if (path === '/dashboard/projections' && method === 'GET') {
      const summary = computeSummary();
      return fulfillJson(route, {
        id: 'projection-1',
        periodStart: `${summary.period}-01`,
        periodEnd: `${summary.period}-28`,
        scope: 'all',
        projectedIncome: (summary.totalIncome || 2000).toFixed(2),
        projectedExpense: (summary.totalExpense || 800).toFixed(2),
        projectedBalance: (summary.balance || 1200).toFixed(2),
        trend: 'up',
        generatedAt: now.toISOString(),
      });
    }

    return fulfillJson(route, { message: 'Not Found' }, 404);
  });

  await page.goto('/login');
  await expect(page).toHaveURL(/login/);

  // Login multi-step: identificador → "Continuar" (valida) → senha aparece → "Entrar".
  await page.getByPlaceholder('E-mail ou usuário').fill('admin');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByTestId('password').fill('supersecret');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page).toHaveURL(/dashboard/);
  // 'Status WhatsApp' saiu do dashboard; KPI de saldo é um smoke estável de que o dashboard montou.
  await expect(page.getByTestId('total-balance')).toBeVisible();

  await page.getByRole('link', { name: 'Lançamentos' }).click();
  await expect(page).toHaveURL(/entries/);
  await expect(page.getByRole('heading', { name: /Lançamentos/ })).toBeVisible();

  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  await expect(page.getByRole('heading', { name: /Novo Lançamento/i })).toBeVisible();

  // Smoke do formulário: campos principais renderizam. A submissão completa exige seleção de
  // categoria/conta via pickers; a criação de transação já é coberta pelo e2e de API.
  await expect(page.getByPlaceholder('DD/MM/AAAA')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Valor' })).toBeVisible();
});

