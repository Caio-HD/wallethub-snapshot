import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@features/auth/AuthProvider';
import { OtpVerificationView } from '@features/auth/OtpVerificationView';
import { SetPasswordView } from '@features/auth/SetPasswordView';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { extractApiErrorMessage } from '@shared/lib/extractApiErrorMessage';

interface ForgotPasswordViewProps {
  initialIdentifier?: string;
  onBack: () => void;
  onSuccess?: () => void;
}

export const ForgotPasswordView = ({
  initialIdentifier = '',
  onBack,
  onSuccess,
}: ForgotPasswordViewProps) => {
  const { t } = useTranslation('auth');
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState<'identifier' | 'otp' | 'password'>('identifier');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [resetCode, setResetCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSentRef = useRef(false);

  const handleRequestReset = async () => {
    if (!identifier.trim()) {
      toast.error(t('toasts.otpRequestUserRequired'));
      return;
    }
    setIsSubmitting(true);
    try {
      await forgotPassword(identifier.trim());
      setStep('otp');
      toast.success(t('forgotPassword.sent'));
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error) ?? t('toasts.otpSendError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (initialIdentifier.trim() && !autoSentRef.current) {
      autoSentRef.current = true;
      void handleRequestReset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === 'identifier') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">{t('forgotPassword.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('forgotPassword.subtitle')}</p>
        </div>
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={t('form.usernamePlaceholder')}
          className="h-14 bg-white/5 border-white/10 rounded-2xl"
          autoComplete="username"
        />
        <Button
          type="button"
          onClick={handleRequestReset}
          disabled={isSubmitting}
          className="w-full h-14 rounded-2xl font-bold"
          variant="primary"
        >
          {isSubmitting ? t('buttons.processing') : t('forgotPassword.submit')}
        </Button>
        <button type="button" onClick={onBack} className="w-full text-sm text-muted-foreground">
          {t('buttons.backToQuickOptions')}
        </button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="space-y-4">
        <OtpVerificationView
          identifier={identifier}
          onVerify={async (code) => {
            setResetCode(code);
            setStep('password');
          }}
          onResend={handleRequestReset}
        />
        <button type="button" onClick={onBack} className="w-full text-sm text-muted-foreground">
          {t('buttons.backToQuickOptions')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SetPasswordView
        onSubmit={async (password) => {
          if (!resetCode) {
            setStep('otp');
            toast.error(t('forgotPassword.codeExpired'));
            return;
          }
          try {
            await resetPassword(identifier.trim(), resetCode, password);
            toast.success(t('resetPassword.success'));
            onSuccess?.();
            onBack();
          } catch (error: unknown) {
            toast.error(extractApiErrorMessage(error) ?? t('toasts.invalidOtp'));
            throw error;
          }
        }}
      />
      <button type="button" onClick={onBack} className="w-full text-sm text-muted-foreground">
        {t('buttons.backToQuickOptions')}
      </button>
    </div>
  );
};
