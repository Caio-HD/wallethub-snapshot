import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// PT
import ptCommon from './locales/pt/common.json';
import ptAuth from './locales/pt/auth.json';
import ptDashboard from './locales/pt/dashboard.json';
import ptTransactions from './locales/pt/transactions.json';
import ptBudgets from './locales/pt/budgets.json';
import ptInvestments from './locales/pt/investments.json';
import ptAccounts from './locales/pt/accounts.json';
import ptOfxAudit from './locales/pt/ofx-audit.json';
import ptErrors from './locales/pt/errors.json';
import ptHero from './locales/pt/hero.json';
import ptFeatures from './locales/pt/features.json';
import ptHowItWorks from './locales/pt/how-it-works.json';
import ptPlans from './locales/pt/plans.json';

// EN
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enTransactions from './locales/en/transactions.json';
import enBudgets from './locales/en/budgets.json';
import enInvestments from './locales/en/investments.json';
import enAccounts from './locales/en/accounts.json';
import enOfxAudit from './locales/en/ofx-audit.json';
import enErrors from './locales/en/errors.json';
import enHero from './locales/en/hero.json';
import enFeatures from './locales/en/features.json';
import enHowItWorks from './locales/en/how-it-works.json';

export const SUPPORTED_LANGUAGES = ['pt', 'en', 'es', 'fr', 'de', 'it', 'zh', 'ja', 'ar'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

export const NAMESPACES = ['common', 'auth', 'dashboard', 'transactions', 'budgets', 'investments', 'accounts', 'ofxAudit', 'errors', 'hero', 'features', 'how-it-works', 'plans'] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: {
        common: ptCommon,
        auth: ptAuth,
        dashboard: ptDashboard,
        transactions: ptTransactions,
        budgets: ptBudgets,
        investments: ptInvestments,
        accounts: ptAccounts,
        ofxAudit: ptOfxAudit,
        errors: ptErrors,
        hero: ptHero,
        features: ptFeatures,
        'how-it-works': ptHowItWorks,
        plans: ptPlans,
      },
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        transactions: enTransactions,
        budgets: enBudgets,
        investments: enInvestments,
        accounts: enAccounts,
        ofxAudit: enOfxAudit,
        errors: enErrors,
        hero: enHero,
        features: enFeatures,
        'how-it-works': enHowItWorks,
        plans: ptPlans, // EN plans not yet translated, share PT version
      },
    },
    fallbackLng: 'pt',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: NAMESPACES,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'wh_lang',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
