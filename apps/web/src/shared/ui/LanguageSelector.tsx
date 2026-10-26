import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { useLocale } from '@shared/hooks/useLocale';
import { SupportedLanguage } from '@shared/i18n/config';

export function LanguageSelector() {
  const { currentLang, supportedLanguages, setLanguage } = useLocale();
  const { t } = useTranslation('common');

  return (
    <div className="relative inline-flex items-center">
      <select
        value={currentLang}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        aria-label={t('language.selectLabel', { defaultValue: 'Idioma' })}
        className="h-9 min-w-[9.5rem] cursor-pointer appearance-none rounded-lg border border-border/70 bg-muted/40 py-1.5 pl-3 pr-9 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/35 hover:bg-muted/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-border/80 dark:bg-muted/30 dark:hover:bg-muted/45"
      >
        {supportedLanguages.map((lang) => (
          <option key={lang} value={lang} className="bg-background text-foreground">
            {t(`language.${lang}`)}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
