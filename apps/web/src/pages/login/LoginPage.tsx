import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@features/auth/AuthProvider';
import { toast } from 'sonner';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { BrandLogo } from '@shared/ui/BrandLogo';
import { Fingerprint, Lock, User, ArrowRight, Mail, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OtpVerificationView } from '@features/auth/OtpVerificationView';
import { ForgotPasswordView } from '@features/auth/ForgotPasswordView';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '@shared/lib/extractApiErrorMessage';

type OtpChannel = 'email' | 'phone';

type LoginValues = {
  username: string;
  password?: string;
  name?: string;
  registerEmail?: string;
  registerPhone?: string;
};


export const LoginPage = () => {
  const { t } = useTranslation('auth');
  const { login, loginWithPasskey, loginWithSocial, requestOtp, register: registerAccount, verifyOtp, validateIdentifier } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [otpChannel, setOtpChannel] = useState<OtpChannel | null>(null);
  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [, setAuthMethods] = useState<string[]>([]);

  const loginSchema = z.object({
    username: z.string().min(1, t('form.usernameRequired')),
    password: z.string().min(6, t('form.passwordMinLength')).optional().or(z.literal('')),
    name: z.string().optional(),
    registerEmail: z.string().optional(),
    registerPhone: z.string().optional(),
  });

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', registerEmail: '', registerPhone: '' },
    mode: 'onChange',
  });

  const username = watch('username');

  const resetRegistrationFlow = () => {
    setShowPassword(false);
    setIsRegistering(false);
    setShowOtp(false);
    setShowForgotPassword(false);
    setOtpChannel(null);
    setOtpIdentifier('');
  };

  const handleBiometricLogin = async () => {
    if (!username) {
      toast.error(t('toasts.biometricLoginUserRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithPasskey(username);
      toast.success(t('toasts.biometricLoginSuccess'));
    } catch (caught: unknown) {
      const name =
        caught && typeof caught === 'object' && 'name' in caught
          ? String((caught as { name?: string }).name)
          : '';
      if (name === 'NotAllowedError') {
        toast.error(t('toasts.biometricLoginCancelled'));
      } else {
        toast.error(t('toasts.biometricLoginFailed'));
        setShowPassword(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpRequest = async (channel?: OtpChannel, identifier?: string) => {
    const resolvedChannel = channel ?? (username.includes('@') ? 'email' : 'phone');
    const resolvedIdentifier = identifier ?? username;

    if (!resolvedIdentifier) {
      toast.error(t('toasts.otpRequestUserRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await requestOtp(resolvedChannel, resolvedIdentifier);
      setOtpChannel(resolvedChannel);
      setOtpIdentifier(resolvedIdentifier);
      setShowOtp(true);
      toast.success(t('toasts.otpSent'));
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error) ?? t('toasts.otpSendError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterWithOtp = async (channel: OtpChannel) => {
    const values = getValues();
    const name = values.name?.trim();

    if (!name) {
      toast.error(t('form.nameRequired'));
      return;
    }

    const email = values.registerEmail?.trim().toLowerCase();
    const phoneNumber = values.registerPhone?.trim();

    if (channel === 'email') {
      const emailCheck = z.string().email().safeParse(email);
      if (!emailCheck.success) {
        toast.error(t('form.emailRequired'));
        return;
      }
    } else if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 8) {
      toast.error(t('form.phoneRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await registerAccount({
        name,
        email: channel === 'email' ? email : undefined,
        phoneNumber: channel === 'phone' ? phoneNumber : undefined,
      });
      const identifier = channel === 'email' ? email! : phoneNumber!;
      setOtpChannel(channel);
      setOtpIdentifier(identifier);
      setShowOtp(true);
      toast.success(t('toasts.otpSent'));
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error) ?? t('toasts.otpSendError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (values: LoginValues) => {
    if (isRegistering) {
      return;
    }

    if (!showPassword && !isRegistering) {
      setIsSubmitting(true);
      try {
        const result = await validateIdentifier(values.username);
        setAuthMethods(result.methods);

        if (result.exists) {
          if (result.methods.includes('password')) {
            setShowPassword(true);
          } else if (result.methods.includes('passkey')) {
            handleBiometricLogin();
          } else {
            handleOtpRequest();
          }
        } else {
          setIsRegistering(true);
          toast.info(t('toasts.userNotFound'));
        }
      } catch {
        toast.error(t('toasts.userValidationError'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (showPassword && !values.password) {
      toast.error(t('form.passwordMinLength'));
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ username: values.username, password: values.password || '' });
      toast.success(t('toasts.loginSuccess'));
    } catch {
      toast.error(t('toasts.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeOtpChannel = otpChannel ?? (otpIdentifier.includes('@') ? 'email' : 'phone');

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-[#020617]">
      {/* Decorative Left Panel (Desktop Only) */}
      <div className="hidden lg:flex flex-col justify-center p-16 xl:p-24 relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#020617] to-[#020617] border-r border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
        <div className="relative z-10 space-y-8 max-w-xl">
          <BrandLogo height={44} className="text-white" />
          <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
            Financial freedom,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">reimagined.</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            Manage your portfolios, cashflows, and digital assets in one unified, secure terminal.
          </p>
        </div>

        {/* Decorative blobs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <motion.div
          data-testid="login-root"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 p-8 sm:p-10 rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl shadow-2xl shadow-blue-500/5 relative z-10"
        >
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="mb-2 flex justify-center lg:hidden"
          >
            <BrandLogo height={40} className="text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold tracking-tight text-white hidden lg:block">
            {isRegistering ? t('titles.register') : t('titles.login')}
          </h2>
          <p className="text-muted-foreground">
            {isRegistering ? t('subtitles.register') : t('subtitles.login')}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {showForgotPassword ? (
            <motion.div
              key="forgot-password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ForgotPasswordView
                initialIdentifier={username}
                onBack={resetRegistrationFlow}
              />
            </motion.div>
          ) : !showOtp ? (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4">
                  {!isRegistering ? (
                    <>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <User size={18} />
                        </div>
                        <Input
                          id="username"
                          data-testid="email"
                          type="text"
                          disabled={showPassword}
                          placeholder={t('form.usernamePlaceholder')}
                          autoComplete="username"
                          className="pl-12 h-14 bg-white/5 border-white/10 focus:border-primary/50 rounded-2xl transition-all disabled:opacity-50"
                          {...register('username')}
                        />
                      </div>
                      {errors.username && (
                        <p className="text-xs text-destructive px-2 font-medium">{errors.username.message}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <Input
                        id="name"
                        type="text"
                        placeholder={t('form.namePlaceholder')}
                        autoComplete="name"
                        className="h-14 bg-white/5 border-white/10 focus:border-primary/50 rounded-2xl transition-all"
                        {...register('name')}
                      />

                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Mail size={18} />
                        </div>
                        <Input
                          id="registerEmail"
                          data-testid="register-email"
                          type="email"
                          placeholder={t('form.emailPlaceholder')}
                          autoComplete="email"
                          className="pl-12 h-14 bg-white/5 border-white/10 focus:border-primary/50 rounded-2xl transition-all"
                          {...register('registerEmail')}
                        />
                      </div>

                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Phone size={18} />
                        </div>
                        <Input
                          id="registerPhone"
                          data-testid="register-phone"
                          type="tel"
                          placeholder={t('form.phonePlaceholder')}
                          autoComplete="tel"
                          className="pl-12 h-14 bg-white/5 border-white/10 focus:border-primary/50 rounded-2xl transition-all"
                          {...register('registerPhone')}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground px-2">{t('register.otpChoiceHint')}</p>
                    </>
                  )}

                  <AnimatePresence>
                    {showPassword && (
                      <>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                              <Lock size={18} />
                            </div>
                            <Input
                              id="password"
                              data-testid="password"
                              type="password"
                              placeholder={t('form.passwordPlaceholder')}
                              autoComplete="current-password"
                              className="pl-12 h-14 bg-white/5 border-white/10 focus:border-primary/50 rounded-2xl transition-all"
                              {...register('password')}
                            />
                          </div>
                          {errors.password && (
                            <p className="text-xs text-destructive px-2 font-medium">{errors.password.message}</p>
                          )}
                        </motion.div>
                        <div className="flex justify-end px-2 pt-1">
                          <button
                            type="button"
                            data-testid="forgot-password-link"
                            onClick={() => {
                              setShowForgotPassword(true);
                              setShowPassword(false);
                            }}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            {t('links.forgotPassword')}
                          </button>
                        </div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-3">
                  {!isRegistering && (
                    <Button
                      type="submit"
                      data-testid="submit"
                      disabled={isSubmitting}
                      className="h-14 rounded-2xl font-bold text-base shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      variant="primary"
                    >
                      {isSubmitting
                        ? t('buttons.processing')
                        : showPassword
                          ? t('buttons.login')
                          : t('buttons.continue')}
                      {!isSubmitting && !showPassword && <ArrowRight size={18} className="ml-2" />}
                    </Button>
                  )}

                  {!showPassword && !isRegistering && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          onClick={() => loginWithSocial('google')}
                          variant="glass"
                          className="h-14 rounded-2xl"
                        >
                          {t('buttons.google')}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => loginWithSocial('github')}
                          variant="glass"
                          className="h-14 rounded-2xl"
                        >
                          {t('buttons.github')}
                        </Button>
                        {import.meta.env.VITE_SOCIAL_META_ENABLED === 'true' && (
                          <>
                            <Button
                              type="button"
                              onClick={() => loginWithSocial('facebook')}
                              variant="glass"
                              className="h-14 rounded-2xl"
                            >
                              {t('buttons.facebook')}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => loginWithSocial('instagram')}
                              variant="glass"
                              className="h-14 rounded-2xl"
                            >
                              {t('buttons.instagram')}
                            </Button>
                          </>
                        )}
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleOtpRequest()}
                        disabled={isSubmitting}
                        variant="ghost"
                        className="h-12 rounded-2xl text-muted-foreground hover:text-white"
                      >
                        {t('buttons.otpLogin')}
                      </Button>

                      <Button
                        type="button"
                        onClick={handleBiometricLogin}
                        disabled={isSubmitting}
                        variant="outline"
                        className="h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all overflow-hidden relative group"
                      >
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Fingerprint size={20} className="mr-2 text-primary" />
                        <span>{t('buttons.passkeyLogin')}</span>
                      </Button>
                    </>
                  )}

                  {isRegistering && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        type="button"
                        data-testid="register-otp-email"
                        onClick={() => handleRegisterWithOtp('email')}
                        disabled={isSubmitting}
                        className="h-14 rounded-2xl font-bold"
                        variant="primary"
                      >
                        <Mail size={18} className="mr-2 shrink-0" />
                        {t('buttons.otpViaEmail')}
                      </Button>
                      <Button
                        type="button"
                        data-testid="register-otp-phone"
                        onClick={() => handleRegisterWithOtp('phone')}
                        disabled={isSubmitting}
                        className="h-14 rounded-2xl font-bold"
                        variant="glass"
                      >
                        <Phone size={18} className="mr-2 shrink-0" />
                        {t('buttons.otpViaPhone')}
                      </Button>
                    </div>
                  )}

                  {(showPassword || isRegistering) && (
                    <button
                      type="button"
                      onClick={resetRegistrationFlow}
                      className="text-sm text-muted-foreground hover:text-white transition-colors"
                    >
                      {isRegistering ? t('buttons.useAnotherIdentifier') : t('buttons.backToQuickOptions')}
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="otp-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <OtpVerificationView
                identifier={otpIdentifier || username}
                onVerify={async (code) => {
                  try {
                    const channel = activeOtpChannel;
                    const identifier = otpIdentifier || username;
                    await verifyOtp(channel, identifier, code);
                    toast.success(t('toasts.biometricLoginSuccess'));
                  } catch {
                    toast.error(t('toasts.invalidOtp'));
                  }
                }}
                onResend={() => handleOtpRequest(activeOtpChannel, otpIdentifier || username)}
              />
              <button
                onClick={() => setShowOtp(false)}
                className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-white"
              >
                {t('buttons.backToQuickOptions')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-4 text-center border-t border-white/5">
          <p className="text-sm text-muted-foreground">
            {isRegistering ? (
              <>{t('links.alreadyHaveAccount')} <span onClick={resetRegistrationFlow} className="text-primary font-semibold hover:underline cursor-pointer">{t('links.loginAction')}</span></>
            ) : (
              <>{t('links.dontHaveAccount')} <span onClick={() => {
                resetRegistrationFlow();
                setIsRegistering(true);
              }} className="text-primary font-semibold hover:underline cursor-pointer">{t('links.registerNow')}</span></>
            )}
          </p>
        </div>
      </motion.div>
      </div>

      {/* Mobile background decorative blobs */}
      <div className="lg:hidden fixed top-1/4 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="lg:hidden fixed bottom-1/4 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
};
