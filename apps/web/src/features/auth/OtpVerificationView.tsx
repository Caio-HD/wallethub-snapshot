import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@shared/ui/button';

const OTP_LENGTH = 6;

export function parsePastedOtp(text: string, length = OTP_LENGTH): string[] {
  const digits = text.replace(/\D/g, '').slice(0, length);
  return Array.from({ length }, (_, i) => digits[i] ?? '');
}

interface OtpVerificationViewProps {
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  identifier: string;
}

export const OtpVerificationView = ({ onVerify, onResend, identifier }: OtpVerificationViewProps) => {
  const { t } = useTranslation('auth');
  const [otp, setOtp] = useState(() => Array(OTP_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const isEmail = identifier.includes('@');

  const focusAfterFill = useCallback((next: string[]) => {
    const filled = next.filter(Boolean).length;
    const focusIndex = Math.min(Math.max(filled - 1, 0), OTP_LENGTH - 1);
    inputs.current[focusIndex]?.focus();
  }, []);

  const applyOtpFromText = useCallback(
    (raw: string) => {
      const next = parsePastedOtp(raw);
      setOtp(next);
      focusAfterFill(next);
      return next;
    },
    [focusAfterFill],
  );

  const handleChange = (index: number, value: string) => {
    const digitChars = value.replace(/\D/g, '');
    if (digitChars.length >= 2) {
      applyOtpFromText(value);
      return;
    }

    const digit = digitChars.slice(-1);
    if (digit && !/^\d$/.test(digit)) return;
    if (!digit && value.length > 0) return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    applyOtpFromText(e.clipboardData.getData('text'));
  };

  const handlePasteClick = async () => {
    if (isSubmitting || isPasting) return;

    setIsPasting(true);
    try {
      const text = await navigator.clipboard.readText();
      applyOtpFromText(text);
    } catch {
      toast.error(t('otp.pasteError'));
      inputs.current[0]?.focus();
    } finally {
      setIsPasting(false);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleApply = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) return;

    setIsSubmitting(true);
    try {
      await onVerify(code);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <h2 id="otp-heading" className="text-2xl font-bold text-white">
          {isEmail ? t('otp.verifyEmail') : t('otp.verifyPhone')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('otp.sentTo')} <br />
          <span className="text-white font-medium">{identifier}</span>
        </p>
      </div>

      <div role="group" aria-labelledby="otp-heading" className="space-y-2">
        <div className="flex justify-between gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit}
              aria-label={t('otp.digit', { index: i + 1 })}
              onChange={(e) => handleChange(i, e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl text-center text-xl font-bold text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting || isPasting}
            onClick={handlePasteClick}
            aria-label={t('otp.pasteAria')}
            className="gap-1.5 text-muted-foreground hover:text-primary"
          >
            <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden />
            {isPasting ? t('otp.pasting') : t('otp.paste')}
          </Button>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <Button
          onClick={handleApply}
          disabled={isSubmitting || otp.some((d) => !d)}
          className="w-full h-14 rounded-2xl font-bold"
          variant="primary"
        >
          {isSubmitting ? t('otp.verifying') : t('otp.confirm')}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={onResend}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {t('otp.resend')}
          </button>
        </div>
      </div>
    </div>
  );
};
