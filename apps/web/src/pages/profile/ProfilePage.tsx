import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@features/auth/AuthProvider';
import apiClient from '@shared/lib/apiClient';
import { buildUserPhotoUrl } from '@shared/lib/walletHubApiBaseUrl';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { User, Camera, Smartphone, Loader2, Building2, MessageCircle, Bot, Globe } from 'lucide-react';
import { useTelegramLinkCode } from '@features/telegram/useTelegramLinkCode';
import {
  useActiveOrganization,
  type OrganizationSummary,
} from '@shared/context/ActiveOrganizationContext';
import { Switch } from '@shared/ui/switch';
import { Select } from '@shared/ui/select';

const LANGUAGE_OPTIONS = [
  { id: 'pt', name: 'Português' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' },
  { id: 'it', name: 'Italiano' },
  { id: 'zh', name: '中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ar', name: 'العربية' },
];

const CURRENCY_OPTIONS = [
  { id: 'BRL', name: 'BRL — Real Brasileiro' },
  { id: 'USD', name: 'USD — Dólar Americano' },
  { id: 'EUR', name: 'EUR — Euro' },
  { id: 'GBP', name: 'GBP — Libra Esterlina' },
  { id: 'JPY', name: 'JPY — Iene Japonês' },
  { id: 'CAD', name: 'CAD — Dólar Canadense' },
  { id: 'AUD', name: 'AUD — Dólar Australiano' },
  { id: 'CHF', name: 'CHF — Franco Suíço' },
  { id: 'CNY', name: 'CNY — Yuan Chinês' },
  { id: 'ARS', name: 'ARS — Peso Argentino' },
  { id: 'MXN', name: 'MXN — Peso Mexicano' },
  { id: 'CLP', name: 'CLP — Peso Chileno' },
  { id: 'COP', name: 'COP — Peso Colombiano' },
  { id: 'PEN', name: 'PEN — Sol Peruano' },
];

const TIMEZONE_OPTIONS = [
  { id: 'America/Sao_Paulo', name: 'America/Sao_Paulo (GMT-3)' },
  { id: 'America/Manaus', name: 'America/Manaus (GMT-4)' },
  { id: 'America/Belem', name: 'America/Belem (GMT-3)' },
  { id: 'America/Fortaleza', name: 'America/Fortaleza (GMT-3)' },
  { id: 'America/Recife', name: 'America/Recife (GMT-3)' },
  { id: 'America/Maceio', name: 'America/Maceio (GMT-3)' },
  { id: 'America/Bahia', name: 'America/Bahia (GMT-3)' },
  { id: 'America/Cuiaba', name: 'America/Cuiaba (GMT-4)' },
  { id: 'America/Porto_Velho', name: 'America/Porto_Velho (GMT-4)' },
  { id: 'America/Boa_Vista', name: 'America/Boa_Vista (GMT-4)' },
  { id: 'America/Rio_Branco', name: 'America/Rio_Branco (GMT-5)' },
  { id: 'America/Noronha', name: 'America/Noronha (GMT-2)' },
  { id: 'America/New_York', name: 'America/New_York (GMT-5)' },
  { id: 'America/Chicago', name: 'America/Chicago (GMT-6)' },
  { id: 'America/Denver', name: 'America/Denver (GMT-7)' },
  { id: 'America/Los_Angeles', name: 'America/Los_Angeles (GMT-8)' },
  { id: 'America/Anchorage', name: 'America/Anchorage (GMT-9)' },
  { id: 'America/Honolulu', name: 'America/Honolulu (GMT-10)' },
  { id: 'America/Toronto', name: 'America/Toronto (GMT-5)' },
  { id: 'America/Vancouver', name: 'America/Vancouver (GMT-8)' },
  { id: 'America/Mexico_City', name: 'America/Mexico_City (GMT-6)' },
  { id: 'America/Bogota', name: 'America/Bogota (GMT-5)' },
  { id: 'America/Lima', name: 'America/Lima (GMT-5)' },
  { id: 'America/Santiago', name: 'America/Santiago (GMT-4)' },
  { id: 'America/Buenos_Aires', name: 'America/Buenos_Aires (GMT-3)' },
  { id: 'America/Caracas', name: 'America/Caracas (GMT-4)' },
  { id: 'America/La_Paz', name: 'America/La_Paz (GMT-4)' },
  { id: 'America/Montevideo', name: 'America/Montevideo (GMT-3)' },
  { id: 'America/Asuncion', name: 'America/Asuncion (GMT-4)' },
  { id: 'America/Guayaquil', name: 'America/Guayaquil (GMT-5)' },
  { id: 'America/Havana', name: 'America/Havana (GMT-5)' },
  { id: 'America/Panama', name: 'America/Panama (GMT-5)' },
  { id: 'America/Costa_Rica', name: 'America/Costa_Rica (GMT-6)' },
  { id: 'America/Tegucigalpa', name: 'America/Tegucigalpa (GMT-6)' },
  { id: 'America/Guatemala', name: 'America/Guatemala (GMT-6)' },
  { id: 'America/El_Salvador', name: 'America/El_Salvador (GMT-6)' },
  { id: 'America/Managua', name: 'America/Managua (GMT-6)' },
  { id: 'Europe/Lisbon', name: 'Europe/Lisbon (GMT+0)' },
  { id: 'Europe/London', name: 'Europe/London (GMT+0)' },
  { id: 'Europe/Paris', name: 'Europe/Paris (GMT+1)' },
  { id: 'Europe/Berlin', name: 'Europe/Berlin (GMT+1)' },
  { id: 'Europe/Madrid', name: 'Europe/Madrid (GMT+1)' },
  { id: 'Europe/Rome', name: 'Europe/Rome (GMT+1)' },
  { id: 'Europe/Amsterdam', name: 'Europe/Amsterdam (GMT+1)' },
  { id: 'Europe/Brussels', name: 'Europe/Brussels (GMT+1)' },
  { id: 'Europe/Zurich', name: 'Europe/Zurich (GMT+1)' },
  { id: 'Europe/Vienna', name: 'Europe/Vienna (GMT+1)' },
  { id: 'Europe/Warsaw', name: 'Europe/Warsaw (GMT+1)' },
  { id: 'Europe/Prague', name: 'Europe/Prague (GMT+1)' },
  { id: 'Europe/Budapest', name: 'Europe/Budapest (GMT+1)' },
  { id: 'Europe/Stockholm', name: 'Europe/Stockholm (GMT+1)' },
  { id: 'Europe/Oslo', name: 'Europe/Oslo (GMT+1)' },
  { id: 'Europe/Copenhagen', name: 'Europe/Copenhagen (GMT+1)' },
  { id: 'Europe/Helsinki', name: 'Europe/Helsinki (GMT+2)' },
  { id: 'Europe/Athens', name: 'Europe/Athens (GMT+2)' },
  { id: 'Europe/Istanbul', name: 'Europe/Istanbul (GMT+3)' },
  { id: 'Europe/Moscow', name: 'Europe/Moscow (GMT+3)' },
  { id: 'Europe/Kiev', name: 'Europe/Kiev (GMT+2)' },
  { id: 'Europe/Bucharest', name: 'Europe/Bucharest (GMT+2)' },
  { id: 'Europe/Sofia', name: 'Europe/Sofia (GMT+2)' },
  { id: 'Europe/Belgrade', name: 'Europe/Belgrade (GMT+1)' },
  { id: 'Europe/Zagreb', name: 'Europe/Zagreb (GMT+1)' },
  { id: 'Africa/Luanda', name: 'Africa/Luanda (GMT+1)' },
  { id: 'Africa/Maputo', name: 'Africa/Maputo (GMT+2)' },
  { id: 'Africa/Johannesburg', name: 'Africa/Johannesburg (GMT+2)' },
  { id: 'Africa/Lagos', name: 'Africa/Lagos (GMT+1)' },
  { id: 'Africa/Nairobi', name: 'Africa/Nairobi (GMT+3)' },
  { id: 'Africa/Cairo', name: 'Africa/Cairo (GMT+2)' },
  { id: 'Africa/Casablanca', name: 'Africa/Casablanca (GMT+1)' },
  { id: 'Asia/Dubai', name: 'Asia/Dubai (GMT+4)' },
  { id: 'Asia/Riyadh', name: 'Asia/Riyadh (GMT+3)' },
  { id: 'Asia/Tehran', name: 'Asia/Tehran (GMT+3:30)' },
  { id: 'Asia/Karachi', name: 'Asia/Karachi (GMT+5)' },
  { id: 'Asia/Kolkata', name: 'Asia/Kolkata (GMT+5:30)' },
  { id: 'Asia/Dhaka', name: 'Asia/Dhaka (GMT+6)' },
  { id: 'Asia/Bangkok', name: 'Asia/Bangkok (GMT+7)' },
  { id: 'Asia/Jakarta', name: 'Asia/Jakarta (GMT+7)' },
  { id: 'Asia/Singapore', name: 'Asia/Singapore (GMT+8)' },
  { id: 'Asia/Shanghai', name: 'Asia/Shanghai (GMT+8)' },
  { id: 'Asia/Hong_Kong', name: 'Asia/Hong_Kong (GMT+8)' },
  { id: 'Asia/Seoul', name: 'Asia/Seoul (GMT+9)' },
  { id: 'Asia/Tokyo', name: 'Asia/Tokyo (GMT+9)' },
  { id: 'Australia/Sydney', name: 'Australia/Sydney (GMT+10)' },
  { id: 'Australia/Melbourne', name: 'Australia/Melbourne (GMT+10)' },
  { id: 'Australia/Perth', name: 'Australia/Perth (GMT+8)' },
  { id: 'Pacific/Auckland', name: 'Pacific/Auckland (GMT+12)' },
  { id: 'Pacific/Honolulu', name: 'Pacific/Honolulu (GMT-10)' },
  { id: 'UTC', name: 'UTC (GMT+0)' },
];

type OrgMembersMessagingAiResponse = {
  members: Array<{
    userId: string;
    name: string;
    email: string | null;
    role: 'owner' | 'admin' | 'member';
    messagingAiEnabled: boolean;
  }>;
  seatsInUse: number;
  seatLimit: number;
  planLabel: string;
};

const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(80, 'Nome deve ter no máximo 80 caracteres'),
  phoneNumber: z.string().optional().nullable(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export const ProfilePage = () => {
  const { user, refreshProfile, linkSocial, unlinkSocial, requestEmailChange, confirmEmailChange } =
    useAuth();
  const { activeOrganization, refreshOrganizations } = useActiveOrganization();
  const queryClient = useQueryClient();
  const [orgNameInput, setOrgNameInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const telegramLinkMutation = useTelegramLinkCode();

  const [prefLanguage, setPrefLanguage] = useState(user?.preferredLanguage ?? '');
  const [prefCurrency, setPrefCurrency] = useState(user?.baseCurrency ?? 'BRL');
  const [prefTimezone, setPrefTimezone] = useState(user?.timezone ?? '');
  const [newUsername, setNewUsername] = useState(user?.username ?? '');
  const [emailStep, setEmailStep] = useState<'request' | 'confirm'>('request');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const passwordMutation = useMutation({
    mutationFn: async (values: { currentPassword?: string; newPassword: string }) => {
      await apiClient.post('/users/me/password', values);
    },
    onSuccess: async () => {
      await refreshProfile();
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Senha atualizada.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Não foi possível atualizar a senha.');
    },
  });

  const emailRequestMutation = useMutation({
    mutationFn: async (email: string) => {
      await requestEmailChange(email);
    },
    onSuccess: () => {
      setEmailStep('confirm');
      toast.success('Enviamos um código para o novo e-mail.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Não foi possível solicitar a troca de e-mail.');
    },
  });

  const emailConfirmMutation = useMutation({
    mutationFn: async (values: { email: string; code: string }) => {
      await confirmEmailChange(values.email, values.code);
    },
    onSuccess: () => {
      setEmailStep('request');
      setNewEmail('');
      setEmailCode('');
      toast.success('E-mail atualizado.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Código inválido ou expirado.');
    },
  });

  const usernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const { data } = await apiClient.patch('/users/me/username', { username });
      return data;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success('Username atualizado.');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Não foi possível trocar o username.');
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: async (values: { preferredLanguage?: string; baseCurrency?: string; timezone?: string }) => {
      const { data } = await apiClient.patch('/users/me', values);
      return data;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success('Preferências atualizadas.');
    },
    onError: () => {
      toast.error('Erro ao salvar preferências.');
    },
  });

  const orgMembersAiQuery = useQuery({
    queryKey: ['organizations', 'current', 'members', 'messaging-ai', activeOrganization?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<OrgMembersMessagingAiResponse>(
        '/organizations/current/members',
      );
      return data;
    },
    enabled: Boolean(activeOrganization?.id),
    retry: false,
  });

  const messagingAiSeatMutation = useMutation({
    mutationFn: async (params: { userId: string; enabled: boolean }) => {
      const { data } = await apiClient.patch(
        `/organizations/current/members/${params.userId}/messaging-ai`,
        { enabled: params.enabled },
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['organizations', 'current', 'members', 'messaging-ai'],
      });
      await queryClient.invalidateQueries({ queryKey: ['users', 'active'] });
      toast.success('Vaga de IA actualizada.');
    },
    onError: () => {
      toast.error('Não foi possível actualizar a vaga de IA.');
    },
  });

  useEffect(() => {
    setOrgNameInput(activeOrganization?.name ?? '');
  }, [activeOrganization?.name]);

  const orgNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.patch<OrganizationSummary>('/organizations/current', { name });
      return data;
    },
    onSuccess: async () => {
      await refreshOrganizations();
      toast.success('Nome do espaço atualizado.');
    },
    onError: () => {
      toast.error('Não foi possível atualizar o nome do espaço.');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    defaultValues: {
      name: user?.name ?? '',
      phoneNumber: user?.phoneNumber ?? '',
    },
    resolver: zodResolver(profileSchema),
  });

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const { data } = await apiClient.patch('/users/me', values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/users/me'] });
      toast.success('Perfil atualizado com sucesso!');
      setTimeout(() => window.location.reload(), 500);
    },
    onError: () => {
      toast.error('Erro ao atualizar perfil.');
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post<{ photoUrl: string }>('/users/photo', formData);
      return data;
    },
    onSuccess: async () => {
      setPhotoLoadFailed(false);
      await refreshProfile();
      toast.success('Foto atualizada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao enviar foto.');
    },
  });

  const mfaSetupMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ qrCode: string }>('/auth/mfa/setup');
      return data;
    },
    onSuccess: (data) => {
      setMfaQrCode(data.qrCode);
      toast.success('QR de MFA gerado. Leia com seu aplicativo autenticador.');
    },
    onError: () => {
      toast.error('Não foi possível iniciar o setup de MFA.');
    },
  });

  const mfaConfirmMutation = useMutation({
    mutationFn: async (token: string) => {
      const { data } = await apiClient.post('/auth/mfa/confirm', { token });
      return data;
    },
    onSuccess: () => {
      setMfaToken('');
      setMfaQrCode(null);
      toast.success('MFA ativado com sucesso.');
    },
    onError: () => {
      toast.error('Código MFA inválido ou expirado.');
    },
  });

  const onSubmit = async (values: ProfileValues) => {
    setIsUpdating(true);
    try {
      await profileMutation.mutateAsync(values);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo deve ser uma imagem');
      return;
    }

    setIsUploading(true);
    try {
      await photoMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const photoSrc = user ? buildUserPhotoUrl(user.id, user.photoUrl) : null;
  const showPhoto = Boolean(photoSrc && !photoLoadFailed);

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [user?.id, user?.photoUrl]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="settings-root">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white/90">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e aparência.</p>
        <span data-testid="user-email" className="sr-only">
          {user?.email ?? ''}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Card className="border-white/10 bg-slate-900/60 backdrop-blur-xl">
            <CardContent className="flex flex-col items-center pt-8">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="relative group transition-transform active:scale-95 disabled:opacity-50"
                title="Clique para alterar a foto"
              >
                <div className="h-28 w-28 rounded-full bg-gradient-to-br from-sky-500 via-indigo-500 to-emerald-500 p-1 shadow-2xl overflow-hidden">
                  <div className="h-full w-full rounded-full bg-slate-900 overflow-hidden relative">
                    {showPhoto ? (
                      <img
                        src={photoSrc!}
                        alt={user?.name}
                        className="h-full w-full object-cover"
                        onError={() => setPhotoLoadFailed(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                        {user?.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    {(isUploading || isUpdating) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex justify-center translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md border border-white/20">
                    Alterar Foto
                  </div>
                </div>
                <div className="absolute right-0 top-0 translate-x-1 -translate-y-1 rounded-full bg-sky-500 p-1.5 text-white shadow-lg ring-2 ring-slate-900 group-hover:scale-110 transition-transform">
                  <Camera className="h-4 w-4" />
                </div>
              </button>
              
              <h3 className="mt-8 text-lg font-semibold text-white">{user?.name}</h3>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
                  {user?.role?.toUpperCase()}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  Ativo
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <div className="space-y-6">
            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Informações Gerais</CardTitle>
                <CardDescription>Atualize seu nome e detalhes de contato.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-white/80" htmlFor="name">
                        <User className="h-4 w-4" /> Nome completo
                      </label>
                      <Input
                        id="name"
                        placeholder="Seu nome"
                        {...register('name')}
                        className="bg-white/5 border-white/10 focus:border-sky-500/50"
                      />
                      {errors.name && <p className="text-xs text-rose-400 font-medium">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-white/80" htmlFor="phoneNumber">
                        <Smartphone className="h-4 w-4" /> Celular (BR)
                      </label>
                      <Input
                        id="phoneNumber"
                        placeholder="11912345678"
                        {...register('phoneNumber')}
                        className="bg-white/5 border-white/10 focus:border-sky-500/50"
                      />
                      {errors.phoneNumber && <p className="text-xs text-rose-400 font-medium">{errors.phoneNumber.message}</p>}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isUpdating || isUploading}
                      className="min-w-[140px] shadow-lg shadow-sky-500/20"
                    >
                      {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Espaço de trabalho
                </CardTitle>
                <CardDescription>
                  Nome do espaço activo (visível no selector de organizações). Apenas owners e admins
                  da organização podem alterar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!activeOrganization ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum espaço seleccionado. Escolha uma organização no menu superior.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80" htmlFor="orgName">
                        Nome do espaço
                      </label>
                      <Input
                        id="orgName"
                        value={orgNameInput}
                        onChange={(e) => setOrgNameInput(e.target.value)}
                        disabled={orgNameMutation.isPending}
                        className="bg-white/5 border-white/10 focus:border-sky-500/50"
                        maxLength={128}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={
                          orgNameMutation.isPending ||
                          !orgNameInput.trim() ||
                          orgNameInput.trim() === activeOrganization.name
                        }
                        onClick={() => orgNameMutation.mutate(orgNameInput.trim())}
                      >
                        {orgNameMutation.isPending ? 'A guardar…' : 'Guardar nome do espaço'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {activeOrganization && !orgMembersAiQuery.isError && orgMembersAiQuery.data && (
              <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" /> Vagas de IA (membros)
                  </CardTitle>
                  <CardDescription>
                    Owners e admins usam o assistente sem ocupar vaga. Membros com papel &quot;member&quot;
                    precisam de vaga para chat IA na web, WhatsApp e Telegram. Plano{' '}
                    {orgMembersAiQuery.data.planLabel}: {orgMembersAiQuery.data.seatsInUse} de{' '}
                    {orgMembersAiQuery.data.seatLimit} vagas atribuídas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orgMembersAiQuery.isLoading ? (
                    <p className="text-sm text-white/60">A carregar…</p>
                  ) : orgMembersAiQuery.data.seatLimit === 0 ? (
                    <p className="text-sm text-amber-200/90">
                      No plano Free não há vagas para membros. Faça upgrade para Pro ou Plus.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {orgMembersAiQuery.data.members.map((m) => (
                        <li
                          key={m.userId}
                          className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-950/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-white">{m.name}</p>
                            <p className="text-xs text-white/50">
                              {m.role === 'owner'
                                ? 'Owner — IA incluída'
                                : m.role === 'admin'
                                  ? 'Admin — IA incluída'
                                  : 'Membro'}
                              {m.email ? ` · ${m.email}` : ''}
                            </p>
                          </div>
                          {m.role === 'member' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/70">Vaga IA</span>
                              <Switch
                                checked={m.messagingAiEnabled}
                                disabled={messagingAiSeatMutation.isPending}
                                onCheckedChange={(enabled: boolean) =>
                                  messagingAiSeatMutation.mutate({ userId: m.userId, enabled })
                                }
                                aria-label={`IA para ${m.name}`}
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" /> Preferências
                </CardTitle>
                <CardDescription>
                  Idioma, moeda base e fuso horário. Aplica-se em todos os dispositivos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <Select
                    label="Idioma"
                    options={LANGUAGE_OPTIONS}
                    value={prefLanguage}
                    onChange={setPrefLanguage}
                    placeholder="Detectado automaticamente"
                  />
                  <Select
                    label="Moeda base"
                    options={CURRENCY_OPTIONS}
                    value={prefCurrency}
                    onChange={setPrefCurrency}
                    placeholder="BRL"
                  />
                  <Select
                    label="Fuso horário"
                    options={TIMEZONE_OPTIONS}
                    value={prefTimezone}
                    onChange={setPrefTimezone}
                    placeholder="Detectado automaticamente"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={preferencesMutation.isPending}
                    onClick={() =>
                      preferencesMutation.mutate({
                        ...(prefLanguage ? { preferredLanguage: prefLanguage } : {}),
                        baseCurrency: prefCurrency,
                        ...(prefTimezone ? { timezone: prefTimezone } : {}),
                      })
                    }
                  >
                    {preferencesMutation.isPending ? 'Salvando…' : 'Salvar preferências'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" /> Telegram
                </CardTitle>
                <CardDescription>
                  Ligue o bot para comandos por mensagem (saldo, receita, despesa…). A quota de IA
                  partilha-se com o WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user?.telegramUserId ? (
                  <p className="text-sm text-emerald-400">Conta Telegram ligada.</p>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={telegramLinkMutation.isPending}
                      onClick={() => {
                        telegramLinkMutation.mutate(undefined, {
                          onSuccess: (data) => {
                            setTelegramLink(data.deepLink);
                            toast.success('Link gerado. Abra no Telegram antes de expirar.');
                          },
                          onError: () => {
                            toast.error('Não foi possível gerar o link. Confirme TELEGRAM_BOT_USERNAME na API.');
                          },
                        });
                      }}
                    >
                      {telegramLinkMutation.isPending ? 'A gerar…' : 'Gerar link Telegram'}
                    </Button>
                    {telegramLink ? (
                      <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                        <p className="text-xs text-muted-foreground mb-1">Abrir no telemóvel:</p>
                        <a
                          href={telegramLink}
                          className="text-sm text-sky-400 break-all underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {telegramLink}
                        </a>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Autenticação em duas etapas (MFA)</CardTitle>
                <CardDescription>
                  Recomendado para proteger sua conta com código TOTP.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={mfaSetupMutation.isPending}
                  onClick={() => mfaSetupMutation.mutate()}
                >
                  {mfaSetupMutation.isPending ? 'Gerando QR…' : 'Gerar QR do MFA'}
                </Button>
                {mfaQrCode ? (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-sm text-muted-foreground">
                      Leia o QR com Google Authenticator, Microsoft Authenticator ou app similar.
                    </p>
                    <img
                      src={mfaQrCode}
                      alt="QR code para configurar MFA"
                      className="h-56 w-56 rounded-lg border border-white/10 bg-white p-2"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={mfaToken}
                        onChange={(event) => setMfaToken(event.target.value)}
                        placeholder="Digite o código de 6 dígitos"
                        className="max-w-xs bg-white/5 border-white/10 focus:border-sky-500/50"
                      />
                      <Button
                        type="button"
                        disabled={mfaConfirmMutation.isPending || mfaToken.trim().length < 6}
                        onClick={() => mfaConfirmMutation.mutate(mfaToken.trim())}
                      >
                        {mfaConfirmMutation.isPending ? 'Confirmando…' : 'Confirmar MFA'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Contas conectadas</CardTitle>
                <CardDescription>
                  Vincule provedores sociais para entrar com um clique. Você não pode remover o
                  último método de acesso da conta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(
                  [
                    { key: 'google', label: 'Google' },
                    { key: 'github', label: 'GitHub' },
                    ...(import.meta.env.VITE_SOCIAL_META_ENABLED === 'true'
                      ? [{ key: 'facebook', label: 'Facebook' }]
                      : []),
                  ] as { key: 'google' | 'github' | 'facebook'; label: string }[]
                ).map(({ key, label }) => {
                  const linked = !!user?.linkedProviders?.[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{label}</span>
                        {linked ? (
                          <span className="text-xs text-emerald-400">Conectado</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não conectado</span>
                        )}
                      </div>
                      {linked ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            void unlinkSocial(key)
                              .then(() => toast.success(`${label} desconectado.`))
                              .catch((err: { response?: { data?: { message?: string } } }) =>
                                toast.error(
                                  err?.response?.data?.message ??
                                    'Não foi possível desconectar este provedor.',
                                ),
                              );
                          }}
                        >
                          Desconectar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            void linkSocial(key).catch(() =>
                              toast.error('Não foi possível iniciar a conexão.'),
                            );
                          }}
                        >
                          Conectar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Nome de usuário</CardTitle>
                <CardDescription>
                  Você pode entrar usando seu username. Só é possível trocá-lo uma vez a cada 30
                  dias.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={newUsername}
                    onChange={(event) => setNewUsername(event.target.value.toLowerCase())}
                    placeholder="seu_username"
                    className="max-w-xs bg-white/5 border-white/10 focus:border-sky-500/50"
                  />
                  <Button
                    type="button"
                    disabled={
                      usernameMutation.isPending ||
                      newUsername.trim().length < 3 ||
                      newUsername.trim() === (user?.username ?? '')
                    }
                    onClick={() => usernameMutation.mutate(newUsername.trim())}
                  >
                    {usernameMutation.isPending ? 'Salvando…' : 'Salvar username'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  3 a 30 caracteres: letras minúsculas, números ou _.
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>E-mail</CardTitle>
                <CardDescription>
                  {user?.email ? `Atual: ${user.email}. ` : ''}
                  Enviamos um código ao novo endereço para confirmar a troca; o e-mail atual
                  continua válido até você confirmar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {emailStep === 'request' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      placeholder="novo@email.com"
                      className="max-w-xs bg-white/5 border-white/10 focus:border-sky-500/50"
                    />
                    <Button
                      type="button"
                      disabled={emailRequestMutation.isPending || !newEmail.includes('@')}
                      onClick={() => emailRequestMutation.mutate(newEmail.trim())}
                    >
                      {emailRequestMutation.isPending ? 'Enviando…' : 'Enviar código'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Digite o código de 6 dígitos enviado para <strong>{newEmail}</strong>.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={emailCode}
                        onChange={(event) => setEmailCode(event.target.value)}
                        placeholder="123456"
                        className="max-w-xs bg-white/5 border-white/10 focus:border-sky-500/50"
                      />
                      <Button
                        type="button"
                        disabled={emailConfirmMutation.isPending || emailCode.trim().length < 6}
                        onClick={() =>
                          emailConfirmMutation.mutate({
                            email: newEmail.trim(),
                            code: emailCode.trim(),
                          })
                        }
                      >
                        {emailConfirmMutation.isPending ? 'Confirmando…' : 'Confirmar troca'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEmailStep('request');
                          setEmailCode('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>{user?.hasPassword ? 'Trocar senha' : 'Definir senha'}</CardTitle>
                <CardDescription>
                  {user?.hasPassword
                    ? 'Informe a senha atual e a nova senha.'
                    : 'Sua conta ainda não tem senha (você entra por provedor social ou código). Defina uma para também entrar com usuário e senha.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {user?.hasPassword ? (
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Senha atual"
                    className="max-w-xs bg-white/5 border-white/10 focus:border-sky-500/50"
                  />
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Nova senha (mín. 8 caracteres)"
                    className="max-w-xs bg-white/5 border-white/10 focus:border-sky-500/50"
                  />
                  <Button
                    type="button"
                    disabled={
                      passwordMutation.isPending ||
                      newPassword.length < 8 ||
                      (!!user?.hasPassword && currentPassword.length === 0)
                    }
                    onClick={() =>
                      passwordMutation.mutate({
                        currentPassword: user?.hasPassword ? currentPassword : undefined,
                        newPassword,
                      })
                    }
                  >
                    {passwordMutation.isPending
                      ? 'Salvando…'
                      : user?.hasPassword
                        ? 'Trocar senha'
                        : 'Definir senha'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
