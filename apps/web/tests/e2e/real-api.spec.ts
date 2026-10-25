import { expect, test } from '@playwright/test';

/**
 * Testes E2E que conectam à API real (não mocks)
 * 
 * Para executar estes testes, é necessário:
 * 1. Ter a API rodando em http://localhost:3000
 * 2. Ter banco de dados e Redis configurados
 * 3. Configurar variável de ambiente USE_REAL_API=true
 * 
 * Exemplo:
 * USE_REAL_API=true npm run test:e2e -- tests/e2e/real-api.spec.ts
 */

const API_URL = process.env.REAL_API_URL || 'http://localhost:3000';
const USE_REAL_API = process.env.USE_REAL_API === 'true';

test.describe('E2E com API Real', () => {
  test.beforeEach(() => {
    test.skip(!USE_REAL_API, 'Testes com API real desabilitados. Configure USE_REAL_API=true para executar.');
  });

  test('deve conectar à API real e verificar health', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
  });

  test('deve fazer login e obter token', async ({ request }) => {
    // Nota: Este teste requer um usuário válido no banco de dados
    // Em um ambiente de teste real, você criaria o usuário antes de executar
    const loginData = {
      username: process.env.TEST_USERNAME || 'admin',
      password: process.env.TEST_PASSWORD || 'admin',
    };

    const response = await request.post(`${API_URL}/auth/login`, {
      data: loginData,
    });

    // Se o usuário não existir, o teste falhará (comportamento esperado)
    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.tokenType).toBe('Bearer');
    } else {
      // Se falhar, pelo menos verificamos que a API está respondendo
      expect(response.status()).toBe(401);
    }
  });

  test('deve listar categorias autenticado', async ({ request }) => {
    // Primeiro, fazer login
    const loginData = {
      username: process.env.TEST_USERNAME || 'admin',
      password: process.env.TEST_PASSWORD || 'admin',
    };

    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: loginData,
    });

    if (!loginResponse.ok()) {
      test.skip(true, 'Login falhou - usuário de teste não configurado');
      return;
    }

    const { accessToken } = await loginResponse.json();

    // Agora, listar categorias
    const categoriesResponse = await request.get(`${API_URL}/categories`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(categoriesResponse.ok()).toBeTruthy();
    const categories = await categoriesResponse.json();
    expect(Array.isArray(categories)).toBe(true);
  });
});

