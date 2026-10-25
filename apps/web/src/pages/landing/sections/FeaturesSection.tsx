import { useTranslation } from 'react-i18next';

export function FeaturesSection() {
  const { t } = useTranslation('features');
  const featuresData = t('features.list', { returnObjects: true }) as
    | { title: string; description: string }[]
    | string;
  const list = Array.isArray(featuresData) ? featuresData : [];

  const features = list.map((f, index) => {
    const icons = ['📊', '💸', '🏦', '📱', '📈', '🤖'];
    return {
      icon: icons[index] || '📌',
      title: f.title,
      description: f.description
    };
  });

  return (
    <section id="features" className="py-20 sm:py-28">
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

        {/* Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-lg border border-border bg-card p-6 shadow-soft-md transition-all hover:border-primary/30 hover:shadow-soft-xl"
            >
              <span className="mb-4 block text-3xl">{f.icon}</span>
              <h3 className="mb-2 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
