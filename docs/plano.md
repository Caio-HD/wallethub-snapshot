# 🌍 WalletHub — Plano de Internacionalização (i18n)

> **Objetivo:** Implementar suporte multilingual robusto no WalletHub (frontend React/Vite + backend NestJS), cobrindo os principais idiomas globais e respeitando integralmente as [Regras Absolutas](./Regras.md).

---

## 1. Visão Geral

| Camada       | Tecnologia           | Biblioteca i18n           | Estratégia de detecção              |
|--------------|----------------------|---------------------------|-------------------------------------|
| **Frontend** | React 18 + Vite      | `react-i18next` + `i18next` | Browser language → localStorage → fallback `pt` |
| **Backend**  | NestJS 11            | `nestjs-i18n`             | `Accept-Language` header → fallback `pt`        |

### Idiomas suportados (Fase 1)

| Código | Idioma               | Razão de inclusão                        |
|--------|----------------------|------------------------------------------|
| `pt`   | Português (Brasil)   | Idioma principal do projeto              |
| `en`   | Inglês               | Padrão global, fallback universal        |
| `es`   | Espanhol             | América Latina / Espanha (mercado-alvo)  |
| `fr`   | Francês              | Europa / África Francófona               |
| `de`   | Alemão               | Europa Central (fintech forte)           |
| `it`   | Italiano             | Europa Ocidental                         |
| `zh`   | Chinês Simplificado  | Maior base de usuários globalmente       |
| `ja`   | Japonês              | Mercado fintech premium                  |
| `ar`   | Árabe (RTL)          | Oriente Médio (suporte RTL obrigatório)  |

> **Fase 2 (expansão futura):** `hi` (Hindi), `ru` (Russo), `ko` (Coreano), `nl` (Holandês).

---

## 2. Regras de Compliance

Conforme `docs/Regras.md`:

- **DRY:** Uma única fonte de verdade para chaves de tradução (arquivos JSON centralizados por namespace e idioma).
- **KISS:** Nenhuma camada de abstração extra além das bibliotecas padrão. Sem wrappers desnecessários.
- **SOLID/SRP:** Módulo i18n dedicado no backend; contexto React isolado no frontend.
- **Build:** Validar build após cada etapa — erros de TypeScript em chaves tipadas devem ser tratados antes do merge.
- **Testes:** Suite de testes i18n em módulos/arquivos separados (Vitest no frontend, Jest no backend).
- **CHANGELOG:** Atualizar `CHANGELOG.md` a cada entrega de fase.
- **Mobile-first:** Seletor de idioma acessível e funcional em viewports mobile (mínimo 320px).

---

## 3. Arquitetura de Arquivos

### 3.1 Frontend (`apps/web`)

```
apps/web/src/
├── shared/
│   ├── i18n/
│   │   ├── index.ts              # Inicialização i18next (singleton)
│   │   ├── config.ts             # Configuração: fallbackLng, namespaces, plugins
│   │   └── locales/
│   │       ├── pt/
│   │       │   ├── common.json   # Labels globais (buttons, nav, status)
│   │       │   ├── auth.json     # Telas de login, registro, OTP
│   │       │   ├── dashboard.json
│   │       │   ├── transactions.json
│   │       │   ├── budgets.json
│   │       │   ├── investments.json
│   │       │   ├── accounts.json
│   │       │   └── errors.json   # Mensagens de erro padronizadas
│   │       ├── en/               # Estrutura idêntica
│   │       ├── es/
│   │       ├── fr/
│   │       ├── de/
│   │       ├── it/
│   │       ├── zh/
│   │       ├── ja/
│   │       └── ar/
│   ├── context/
│   │   └── I18nProvider.tsx      # Provider com detecção + persistência de idioma
│   └── hooks/
│       └── useLocale.ts          # Hook: idioma atual, trocar idioma, lista disponível
```

**Namespaces por feature:**

| Namespace         | Escopo                                    |
|-------------------|-------------------------------------------|
| `common`          | Botões, nav, status, labels universais    |
| `auth`            | Login, registro, OTP, passkeys            |
| `dashboard`       | Cards de resumo, saudação                 |
| `transactions`    | Tabela, formulários, filtros              |
| `budgets`         | Orçamentos, progresso, alertas            |
| `investments`     | Portfólio, ativos, análises               |
| `accounts`        | Contas bancárias, saldos                  |
| `errors`          | Mensagens de erro da API e validações     |

### 3.2 Backend (`apps/api`)

```
apps/api/src/
├── i18n/
│   ├── pt/
│   │   ├── auth.json          # Mensagens de autenticação
│   │   ├── validation.json    # Erros de DTO/class-validator
│   │   ├── common.json        # Mensagens genéricas
│   │   └── errors.json        # Respostas de erro de negócio
│   ├── en/
│   ├── es/
│   ├── fr/
│   ├── de/
│   ├── it/
│   ├── zh/
│   ├── ja/
│   └── ar/
├── generated/
│   └── i18n.generated.ts      # Gerado automaticamente — chaves type-safe
```

---

## 4. Implementação Frontend

### 4.1 Dependências

```bash
# Instalar em apps/web
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend
```

| Pacote                           | Função                                           |
|----------------------------------|--------------------------------------------------|
| `i18next`                        | Core da biblioteca de i18n                       |
| `react-i18next`                  | Integração React (hooks, Suspense)               |
| `i18next-browser-languagedetector` | Detecta idioma do browser automaticamente      |
| `i18next-http-backend`           | Carrega JSONs sob demanda (lazy loading por rota)|

### 4.2 Configuração Central (`shared/i18n/config.ts`)

```typescript
// apps/web/src/shared/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

export const SUPPORTED_LANGUAGES = ['pt', 'en', 'es', 'fr', 'de', 'it', 'zh', 'ja', 'ar'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

export const NAMESPACES = ['common', 'auth', 'dashboard', 'transactions', 'budgets', 'investments', 'accounts', 'errors'] as const;

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: NAMESPACES,
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'wh_lang',
    },
    interpolation: {
      escapeValue: false, // React já escapa por padrão
    },
  });

export default i18n;
```

### 4.3 Provider (`shared/context/I18nProvider.tsx`)

```typescript
// Responsabilidade única: inicializar i18n e sincronizar direção RTL no <html>
import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@shared/i18n/config';
import { RTL_LANGUAGES, type SupportedLanguage } from '@shared/i18n/config';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lang = i18n.language as SupportedLanguage;
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
```

### 4.4 Integração em `main.tsx`

O `I18nProvider` envolve toda a árvore, depois do `QueryClientProvider` e antes de `BrowserRouter`:

```typescript
// apps/web/src/app/main.tsx — ponto de entrada
<React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <I18nProvider>          {/* ← NOVO */}
      <BrowserRouter ...>
        <AuthProvider>
          <ActiveOrganizationProvider>
            <App />
          </ActiveOrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  </QueryClientProvider>
</React.StrictMode>
```

### 4.5 Hook de Idioma (`shared/hooks/useLocale.ts`)

```typescript
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES, type SupportedLanguage } from '@shared/i18n/config';

export function useLocale() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language as SupportedLanguage;

  return {
    currentLang,
    isRTL: RTL_LANGUAGES.includes(currentLang),
    supportedLanguages: SUPPORTED_LANGUAGES,
    setLanguage: (lang: SupportedLanguage) => i18n.changeLanguage(lang),
  };
}
```

### 4.6 Componente Seletor de Idioma (`shared/ui/LanguageSelector.tsx`)

- Componente mobile-first (dropdown acessível via `<select>` nativo ou Headless UI)
- Deve exibir nome do idioma no próprio idioma (ex.: "Português", "中文", "العربية")
- Posicionado na navbar/sidebar já existente — sem criar nova rota
- Persistência automática via `localStorage` (chave `wh_lang`)

### 4.7 Uso nos Componentes

```typescript
// Exemplo em qualquer componente
import { useTranslation } from 'react-i18next';

function TransactionTable() {
  const { t } = useTranslation('transactions');
  return <th>{t('table.date')}</th>;
}
```

### 4.8 Formatação Regional (datas, moedas, números)

Usar `Intl` nativo do browser — **sem biblioteca extra** (KISS):

```typescript
// apps/web/src/shared/utils/format.ts
export function formatCurrency(value: number, lang: string): string {
  const currencyMap: Record<string, string> = { pt: 'BRL', en: 'USD', es: 'EUR', de: 'EUR', fr: 'EUR', it: 'EUR', zh: 'CNY', ja: 'JPY', ar: 'SAR' };
  return new Intl.NumberFormat(lang, { style: 'currency', currency: currencyMap[lang] ?? 'USD' }).format(value);
}

export function formatDate(date: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}
```

> **Nota:** As funções `formatCurrency` e `formatDate` são utilitários puros — sem estado, sem acoplamento ao i18next.

---

## 5. Implementação Backend

### 5.1 Dependências

```bash
# Instalar em apps/api
npm install nestjs-i18n
```

### 5.2 Configuração do Módulo (`app.module.ts`)

```typescript
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';

I18nModule.forRoot({
  fallbackLanguage: 'pt',
  loaderOptions: {
    path: path.join(__dirname, '../i18n/'),
    watch: process.env.NODE_ENV === 'development',
  },
  resolvers: [
    { use: QueryResolver, options: ['lang'] },
    AcceptLanguageResolver,
  ],
  typesOutputPath: path.join(__dirname, '../../src/generated/i18n.generated.ts'),
}),
```

### 5.3 `nest-cli.json` — copiar arquivos JSON no build

```json
{
  "compilerOptions": {
    "assets": [{ "include": "i18n/**/*", "outDir": "dist" }],
    "watchAssets": true
  }
}
```

### 5.4 Uso nos Services

```typescript
// Injeção do I18nService — tipagem gerada automaticamente
import { I18nService } from 'nestjs-i18n';
import { I18nTranslations } from '../generated/i18n.generated';

constructor(private readonly i18n: I18nService<I18nTranslations>) {}

// Tradução com chave type-safe
const msg = this.i18n.t('auth.INVALID_CREDENTIALS', { lang });
```

### 5.5 Estratégia de Erros da API

O backend retorna sempre um `code` de erro (ex.: `INVALID_CREDENTIALS`), nunca mensagem em texto fixo. O frontend lê o `code` do JSON de resposta e busca a tradução local em `errors.json`. Isso garante:

- DRY: mensagem definida uma única vez no frontend
- Consistência entre múltiplos clientes (web, mobile futuro)
- Sem acoplamento de idioma entre API e cliente

```json
// Resposta de erro da API (idioma-agnóstico)
{
  "statusCode": 401,
  "code": "INVALID_CREDENTIALS"
}
```

```json
// apps/web/src/shared/i18n/locales/pt/errors.json
{
  "INVALID_CREDENTIALS": "E-mail ou senha incorretos.",
  "SESSION_EXPIRED": "Sua sessão expirou. Faça login novamente."
}
```

---

## 6. RTL (Right-to-Left) para Árabe

- `document.dir = 'rtl'` é aplicado automaticamente pelo `I18nProvider` quando o idioma é `ar`
- Tailwind CSS: usar prefixo `rtl:` para inversões de layout (ex.: `rtl:flex-row-reverse`, `rtl:text-right`)
- Verificar componentes de navegação, tabelas e formulários com viewport mobile em modo RTL

---

## 7. Estrutura de um Arquivo de Tradução

```json
// apps/web/src/shared/i18n/locales/pt/transactions.json
{
  "title": "Transações",
  "table": {
    "date": "Data",
    "description": "Descrição",
    "category": "Categoria",
    "amount": "Valor",
    "status": "Status"
  },
  "status": {
    "pending": "Pendente",
    "completed": "Concluída",
    "failed": "Falhou"
  },
  "actions": {
    "add": "Nova Transação",
    "edit": "Editar",
    "delete": "Excluir",
    "filter": "Filtrar"
  },
  "empty": "Nenhuma transação encontrada."
}
```

---

## 8. Plano de Fases de Implementação

### Fase 1 — Fundação (Sprint 1)

- [ ] Instalar `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `i18next-http-backend` no frontend
- [ ] Instalar `nestjs-i18n` no backend
- [ ] Criar estrutura de diretórios `shared/i18n/locales/<lang>/`
- [ ] Criar arquivos JSON para `pt` (idioma base) em todos os namespaces
- [ ] Configurar `i18n/config.ts` e `I18nProvider.tsx`
- [ ] Integrar `I18nProvider` em `main.tsx`
- [ ] Configurar `I18nModule` no `app.module.ts` e adjustar `nest-cli.json`
- [ ] Criar `useLocale.ts` hook
- [ ] Criar utilitários `formatCurrency` / `formatDate` em `shared/utils/format.ts`

### Fase 2 — Migração de Strings (Sprint 2)

- [ ] Extrair todas as strings hardcoded do frontend para os JSONs de `pt`
- [ ] Migrar namespace `auth` (login, OTP, registro)
- [ ] Migrar namespace `dashboard`
- [ ] Migrar namespace `transactions`
- [ ] Migrar namespace `budgets`
- [ ] Migrar namespace `investments`
- [ ] Migrar namespace `accounts`
- [ ] Migrar namespace `errors` e ajustar respostas da API para usar `code`
- [ ] Migrar mensagens de validação do backend para `nestjs-i18n`

### Fase 3 — Traduções (Sprint 3)

- [ ] Criar arquivos JSON para `en` (prioridade máxima — revisão manual)
- [ ] Criar arquivos JSON para `es`
- [ ] Criar arquivos JSON para `fr`, `de`, `it`
- [ ] Criar arquivos JSON para `zh`, `ja`
- [ ] Criar arquivos JSON para `ar` (incluir validação de layout RTL)
- [ ] Implementar `LanguageSelector` na navbar
- [ ] Testar viewport mobile (320px) e desktop em todos os idiomas

### Fase 4 — Qualidade e Testes (Sprint 4)

- [ ] Testes unitários (Vitest): `useLocale`, `formatCurrency`, `formatDate`
- [ ] Testes de renderização (React Testing Library): componentes com `useTranslation`
- [ ] Testes de integração (Jest + NestJS Testing): `I18nService` nos serviços
- [ ] Validar build Release: `npm run validate-build` em `apps/web` e `apps/api`
- [ ] Atualizar `CHANGELOG.md`

---

## 9. Verificação e Critérios de Aceite

| Critério                                                          | Como verificar                                           |
|-------------------------------------------------------------------|----------------------------------------------------------|
| Idioma persiste ao recarregar a página                            | Trocar idioma → F5 → idioma mantido                     |
| Fallback funciona quando falta chave de tradução                  | Remover uma chave de `en` → deve aparecer em `pt`        |
| RTL ativo para árabe                                              | Mudar para `ar` → `<html dir="rtl">` no DevTools        |
| `formatCurrency` retorna moeda correta por idioma                 | Vitest unitário                                          |
| API retorna `code` e não texto de erro fixo                       | Testar endpoint de login com credenciais inválidas       |
| Build sem erros de TypeScript em chaves i18n                      | `npm run validate-build` em ambos os apps                |
| Mobile-first: seletor legível em 320px                            | DevTools → viewport 320px → inspecionar LanguageSelector |
| CHANGELOG atualizado                                              | `CHANGELOG.md` contém entrada da sprint                 |

---

## 10. Decisões Técnicas

| Decisão                                  | Alternativa descartada          | Motivo                                     |
|------------------------------------------|---------------------------------|--------------------------------------------|
| `i18next-http-backend` (lazy load)       | Bundle estático completo        | Evita aumentar bundle inicial (KISS + perf)|
| JSON por namespace + idioma              | JSON único por idioma           | DRY: cada feature owns suas strings        |
| `Intl` nativo para formatação            | `date-fns/locale` / `numeral`   | Zero dependência extra (KISS)              |
| Erro como `code` na API                  | Msg de texto no backend         | DRY: string definida uma vez no frontend   |
| `nestjs-i18n` com types auto-gerados     | i18n manual em strings          | Type-safety → elimina erros em runtime     |
| `localStorage` como cache de preferência | Cookie                          | Sem conflito com SSR futuro; mais simples  |

---

## 11. Referências

- [react-i18next Docs](https://react.i18next.com/)
- [i18next Docs](https://www.i18next.com/)
- [nestjs-i18n Docs](https://nestjs-i18n.com/)
- [MDN — Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [W3C Internationalization](https://www.w3.org/International/)
- `docs/Regras.md` — Regras Absolutas do Projeto
