import '@testing-library/jest-dom';
import i18n from 'i18next';
import '../src/shared/i18n/config';

// Componentes usam t() (react-i18next). Sem inicializar o i18n, os testes não encontram os textos.
// LanguageDetector detecta 'en' no jsdom; os specs esperam pt-BR, então forçamos 'pt'.
void i18n.changeLanguage('pt');

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
