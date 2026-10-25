import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function PlansSection() {
  const { t } = useTranslation('plans');
  const plansData = t('plans', { returnObjects: true }) as
    | {
        id: string;
        name: string;
        badge: string | null;
        description: string;
        features: string[];
        unavailable: string[];
        cta: string;
        highlighted: boolean;
      }[]
    | string;

  const list = Array.isArray(plansData) ? plansData : [];

  const plans = list.map((plan) => ({
    id: plan.id,
    name: plan.name,
    badge: plan.badge,
    description: plan.description,
    features: plan.features || [],
    unavailable: plan.unavailable || [],
    cta: plan.cta,
    highlighted: plan.highlighted,
  }));

  return (
    <section id="plans" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
         {/* Header */}
         <div className="mb-14 text-center">
           <h2 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
             {t('header.title')}
           </h2>
           <p className="text-muted-foreground">
             {t('header.description')}
           </p>
         </div>

        {/* Cards */}
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={[
                'relative flex flex-col rounded-xl border p-6 shadow-soft-md transition-all',
                plan.highlighted
                  ? 'border-primary/50 bg-card shadow-soft-xl ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-border/80',
              ].join(' ')}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                  {plan.badge}
                </span>
              )}

              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {plan.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-0.5 shrink-0 text-secondary">✓</span>
                    {f}
                  </li>
                ))}
                {plan.unavailable.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground/50 line-through">
                    <span className="mt-0.5 shrink-0">✕</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                id={`landing-plan-${plan.id}`}
                className={[
                  'block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all',
                  plan.highlighted
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'border border-border text-foreground hover:border-primary/50',
                ].join(' ')}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
