import { useTranslation } from 'react-i18next';

export function FooterSection() {
  const year = new Date().getFullYear();
  const { t } = useTranslation('common');

  return (
    <footer className="border-t border-border/50 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <span className="text-base font-bold text-primary">
          Wallet<span className="text-secondary">Hub</span>
        </span>

        <p className="text-xs text-muted-foreground">
          {t('footer.copyright', { year })}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            {t('footer.github')}
          </a>
          <span className="text-border">·</span>
          <a
            href="/login"
            className="transition-colors hover:text-foreground"
          >
            {t('footer.login')}
          </a>
        </div>
      </div>
    </footer>
  );
}
