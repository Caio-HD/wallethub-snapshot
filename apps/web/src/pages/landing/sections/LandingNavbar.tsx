import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@shared/ui/LanguageSelector';

export function LandingNavbar() {
  const { t } = useTranslation('common');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-primary">
            Wallet<span className="text-secondary">Hub</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            id="landing-nav-login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t('navbar.login')}
          </Link>
          <LanguageSelector />
        </div>
      </div>
    </header>
  );
}
