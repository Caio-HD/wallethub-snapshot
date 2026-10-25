import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';

interface SetPasswordViewProps {
  onSubmit: (password: string) => Promise<void>;
}

export const SetPasswordView = ({ onSubmit }: SetPasswordViewProps) => {
  const { t } = useTranslation('auth');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = z
    .object({
      password: z.string().min(6, t('form.passwordMinLength')),
      confirmPassword: z.string().min(6, t('form.passwordMinLength')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('setPassword.mismatch'),
      path: ['confirmPassword'],
    });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onChange',
  });

  const handleFormSubmit = async (values: { password: string }) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values.password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-2">
          <Lock size={24} />
        </div>
        <h2 className="text-2xl font-bold text-white">{t('setPassword.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('setPassword.subtitle')}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="space-y-2">
          <Input
            id="password"
            type="password"
            placeholder={t('setPassword.passwordPlaceholder')}
            autoComplete="new-password"
            className="h-14 bg-white/5 border-white/10 focus:border-primary/50 rounded-2xl"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-destructive px-2 font-medium">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t('setPassword.confirmPlaceholder')}
            autoComplete="new-password"
            className="h-14 bg-white/5 border-white/10 focus:border-primary/50 rounded-2xl"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive px-2 font-medium">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 rounded-2xl font-bold"
          variant="primary"
        >
          {isSubmitting ? t('buttons.processing') : t('setPassword.submit')}
        </Button>
      </form>
    </div>
  );
};
