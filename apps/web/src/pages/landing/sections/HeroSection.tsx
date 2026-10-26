import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function HeroSection() {
  const { t } = useTranslation('hero');

  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      {/* Subtle radial gradient behind the headline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, hsl(220 85% 56% / 0.18), transparent)',
        }}
      />

       <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
         <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
           {t('title.part1')}{' '}
           <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
             {t('title.part2')}
           </span>{' '}
           {t('title.part3')}
         </h1>

         <p className="mx-auto mb-10 max-w-2xl text-base text-muted-foreground sm:text-lg">
           {t('description')}
         </p>

         <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
           <Link
             to="/login"
             id="landing-hero-cta"
             className="w-full rounded-lg bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-soft-md transition-all hover:opacity-90 hover:shadow-soft-xl sm:w-auto"
           >
             {t('cta')}
           </Link>
           <a
             href="https://github.com"
             target="_blank"
             rel="noopener noreferrer"
             id="landing-hero-github"
             className="w-full rounded-lg border border-border px-8 py-3.5 text-sm font-semibold text-foreground/80 transition-colors hover:border-primary/50 hover:text-foreground sm:w-auto"
           >
             {t('github')}
           </a>
         </div>
       </div>
    </section>
  );
}
