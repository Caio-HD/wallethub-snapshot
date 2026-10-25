import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, QrCode, LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchOtpWhatsAppStatus,
  createOtpWhatsAppInstance,
  connectOtpWhatsApp,
  logoutOtpWhatsApp,
  updateOtpWhatsAppSettings,
} from '@features/platform/api';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Badge } from '@shared/ui/badge';
import { Card, CardContent, CardTitle } from '@shared/ui/card';

const STATE_LABEL: Record<
  string,
  { label: string; variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  open: { label: 'Conectado', variant: 'success' },
  connecting: { label: 'A conectar', variant: 'info' },
  close: { label: 'Desconectado', variant: 'danger' },
  unknown: { label: 'Desconhecido', variant: 'neutral' },
  unreachable: { label: 'Inacessível', variant: 'danger' },
};

function extractQrBase64(qr: Record<string, unknown>): string | null {
  const direct = qr.base64;
  if (typeof direct === 'string') return direct;
  const nested = (qr.qrcode as { base64?: unknown } | undefined)?.base64;
  return typeof nested === 'string' ? nested : null;
}

export const PlatformOtpWhatsAppTab = () => {
  const queryClient = useQueryClient();
  const [instanceDraft, setInstanceDraft] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['platform', 'otp-whatsapp', 'status'],
    queryFn: fetchOtpWhatsAppStatus,
    staleTime: 1000 * 15,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['platform', 'otp-whatsapp'] });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateOtpWhatsAppSettings({ enabled }),
    onSuccess: (d) => {
      toast.success(d.enabled ? 'OTP por WhatsApp ativado' : 'OTP por WhatsApp desativado');
      void invalidate();
    },
    onError: () => toast.error('Falha ao atualizar o toggle'),
  });

  const instanceMutation = useMutation({
    mutationFn: (instanceName: string) => updateOtpWhatsAppSettings({ instanceName }),
    onSuccess: () => {
      toast.success('Instância atualizada');
      setInstanceDraft(null);
      void invalidate();
    },
    onError: () => toast.error('Falha ao gravar a instância'),
  });

  const createMutation = useMutation({
    mutationFn: createOtpWhatsAppInstance,
    onSuccess: (d) => {
      toast.success(`Instância '${d.instanceName}' criada`);
      void invalidate();
    },
    onError: () => toast.error('Falha ao criar a instância'),
  });

  const connectMutation = useMutation({
    mutationFn: connectOtpWhatsApp,
    onSuccess: (data) => {
      const base64 = extractQrBase64(data);
      if (base64) {
        setQr(base64);
        toast.success('QR gerado — escaneie no WhatsApp');
      } else {
        toast.message('Conexão iniciada (sem QR — talvez já pareado).');
      }
      void invalidate();
    },
    onError: () => toast.error('Falha ao conectar (a instância existe?)'),
  });

  const logoutMutation = useMutation({
    mutationFn: logoutOtpWhatsApp,
    onSuccess: () => {
      toast.success('Sessão encerrada');
      setQr(null);
      void invalidate();
    },
    onError: () => toast.error('Falha ao encerrar a sessão'),
  });

  const status = statusQuery.data;
  const state = status ? (STATE_LABEL[status.connectionState] ?? STATE_LABEL.unknown) : null;
  const busy =
    toggleMutation.isPending ||
    instanceMutation.isPending ||
    createMutation.isPending ||
    connectMutation.isPending ||
    logoutMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void invalidate()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <CardTitle className="text-base">Canal OTP por WhatsApp (Evolution)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Instância única global usada para enviar códigos OTP por WhatsApp. O envio real só
            ocorre com o canal <strong>ativado</strong> e a instância <strong>conectada</strong>.
          </p>

          {statusQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar estado…</p>
          ) : statusQuery.isError || !status ? (
            <p className="text-sm text-destructive">Não foi possível obter o estado.</p>
          ) : (
            <>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Envio (toggle)</dt>
                  <dd className="font-medium text-foreground">
                    {status.enabled ? 'Ativado' : 'Desativado'}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Conexão</dt>
                  <dd>{state ? <Badge variant={state.variant}>{state.label}</Badge> : '—'}</dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Capability (API key)</dt>
                  <dd className="font-medium text-foreground">
                    {status.capable ? 'Configurada' : 'Ausente'}
                  </dd>
                </div>
              </dl>

              {!status.capable ? (
                <p className="text-sm text-amber-400">
                  Sem <code>EVOLUTION_API_KEY</code> no ambiente — configure antes de ativar.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={busy || !status.capable}
                  variant={status.enabled ? 'outline' : 'primary'}
                  onClick={() => toggleMutation.mutate(!status.enabled)}
                >
                  {status.enabled ? 'Desativar envio' : 'Ativar envio'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !status.capable}
                  className="gap-2"
                  onClick={() => createMutation.mutate()}
                >
                  <Plus className="h-4 w-4" />
                  Criar instância
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !status.capable}
                  className="gap-2"
                  onClick={() => connectMutation.mutate()}
                >
                  <QrCode className="h-4 w-4" />
                  Conectar (QR)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !status.capable}
                  className="gap-2"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="h-4 w-4" />
                  Encerrar sessão
                </Button>
                {busy ? <RefreshCw className="h-4 w-4 animate-spin text-sky-400" /> : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {status ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <CardTitle className="text-base">Instância</CardTitle>
            <p className="text-sm text-muted-foreground">
              Nome da instância Evolution. Vazio volta ao default do ambiente.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={instanceDraft ?? status.instanceName}
                onChange={(e) => setInstanceDraft(e.target.value)}
                placeholder="wallethub"
                className="w-full max-w-xs font-mono"
              />
              <Button
                type="button"
                disabled={
                  busy || instanceDraft === null || instanceDraft.trim() === status.instanceName
                }
                onClick={() => instanceMutation.mutate((instanceDraft ?? '').trim())}
              >
                Guardar
              </Button>
              {instanceDraft !== null ? (
                <Button type="button" variant="ghost" onClick={() => setInstanceDraft(null)}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {qr ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-5">
            <CardTitle className="text-base">Parear WhatsApp</CardTitle>
            <p className="text-sm text-muted-foreground">
              WhatsApp → Aparelhos conectados → Conectar aparelho → escaneie:
            </p>
            <img
              src={qr}
              alt="QR de pareamento do WhatsApp"
              className="h-56 w-56 rounded bg-white p-2"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setQr(null)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
