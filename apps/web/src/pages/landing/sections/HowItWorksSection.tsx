import { useTranslation } from 'react-i18next';

export function HowItWorksSection() {
  const { t } = useTranslation('how-it-works');
  const stepsData = t('steps', { returnObjects: true }) as
    | { number?: string; title: string; description: string }[]
    | string;

  const list = Array.isArray(stepsData) ? stepsData : [];

  const steps = list.map((step, index) => {
    const numbers = ['01', '02', '03'];
    return {
      number: numbers[index] || step.number || `0${index + 1}`,
      title: step.title,
      description: step.description
    };
  });

  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28"
      style={{
        background:
          'linear-gradient(to bottom, hsl(222 47% 4%), hsl(222 47% 6%), hsl(222 47% 4%))',
      }}
    >
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

          {/* Steps */}
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.number} className="relative flex flex-col items-start sm:items-center sm:text-center">
                {/* Connector line between steps (desktop only) */}
                {index < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute left-full top-7 hidden h-px w-full -translate-y-1/2 bg-border sm:block"
                    style={{ width: 'calc(100% - 3.5rem)', left: '50%', marginLeft: '1.75rem' }}
                  />
                )}

                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xl font-extrabold text-primary">
                  {step.number}
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
       </div>
    </section>
  );
}
