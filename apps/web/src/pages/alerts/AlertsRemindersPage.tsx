import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Bell, CalendarPlus, Trash2, Check } from 'lucide-react';
import apiClient from '@shared/lib/apiClient';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/ui/card';
import { Input } from '@shared/ui/input';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

type AlertRow = {
  id: string;
  type: string;
  title: string;
  readAt: string | null;
  createdAt: string;
  payload?: Record<string, unknown>;
};

type ReminderRow = {
  id: string;
  title: string;
  dueAt: string;
  recurrence: 'none' | 'monthly';
};

export const AlertsRemindersPage = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useActiveOrganization();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');

  const alertsQuery = useQuery({
    queryKey: ['alerts', activeOrganizationId],
    queryFn: async () => {
      const { data } = await apiClient.get<AlertRow[]>('/alerts');
      return data;
    },
    enabled: Boolean(activeOrganizationId),
  });

  const remindersQuery = useQuery({
    queryKey: ['reminders', activeOrganizationId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReminderRow[]>('/reminders');
      return data;
    },
    enabled: Boolean(activeOrganizationId),
  });

  const readMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/alerts/${id}/read`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts', activeOrganizationId] });
    },
    onError: () => toast.error('Não foi possível marcar como lido.'),
  });

  const createReminderMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ReminderRow>('/reminders', {
        title: title.trim(),
        dueAt: new Date(dueAt).toISOString(),
        recurrence: 'none',
      });
      return data;
    },
    onSuccess: () => {
      setTitle('');
      setDueAt('');
      void queryClient.invalidateQueries({ queryKey: ['reminders', activeOrganizationId] });
      toast.success('Lembrete criado.');
    },
    onError: () => toast.error('Não foi possível criar o lembrete.'),
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reminders/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reminders', activeOrganizationId] });
      toast.success('Lembrete removido.');
    },
    onError: () => toast.error('Não foi possível remover.'),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-24 pt-6 md:pb-8">
      <div>
        <h1 className="text-xl font-bold text-white">Alertas e lembretes</h1>
        <p className="text-sm text-white/60">
          Alertas de saldo projectado e lembretes do dia aparecem aqui (in-app). Lembretes disparam
          notificação às 00:05 UTC na data indicada.
        </p>
      </div>

      <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-amber-300" /> Alertas
          </CardTitle>
          <CardDescription>Marque como lidos após rever.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertsQuery.isLoading ? (
            <p className="text-sm text-white/50">A carregar…</p>
          ) : !alertsQuery.data?.length ? (
            <p className="text-sm text-white/50">Sem alertas.</p>
          ) : (
            <ul className="space-y-2">
              {alertsQuery.data.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{a.title}</p>
                    <p className="text-[10px] text-white/40">
                      {a.type} · {new Date(a.createdAt).toLocaleString('pt-PT')}
                    </p>
                  </div>
                  {!a.readAt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={readMutation.isPending}
                      onClick={() => readMutation.mutate(a.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Marcar lido
                    </Button>
                  ) : (
                    <span className="text-[10px] text-emerald-400/90">Lido</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4 text-sky-300" /> Lembretes
          </CardTitle>
          <CardDescription>Crie lembretes com data e hora (timezone local convertido para ISO).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1">
              <span className="text-[10px] font-bold uppercase text-white/50">Título</span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Pagar condomínio"
                className="border-white/10 bg-white/5"
              />
            </label>
            <label className="sm:w-56 space-y-1">
              <span className="text-[10px] font-bold uppercase text-white/50">Data e hora</span>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="border-white/10 bg-white/5"
              />
            </label>
            <Button
              type="button"
              disabled={!title.trim() || !dueAt || createReminderMutation.isPending}
              onClick={() => createReminderMutation.mutate()}
            >
              Adicionar
            </Button>
          </div>
          {remindersQuery.isLoading ? (
            <p className="text-sm text-white/50">A carregar…</p>
          ) : !remindersQuery.data?.length ? (
            <p className="text-sm text-white/50">Sem lembretes abertos.</p>
          ) : (
            <ul className="space-y-2">
              {remindersQuery.data.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white">{r.title}</p>
                    <p className="text-[10px] text-white/45">
                      {new Date(r.dueAt).toLocaleString('pt-PT')} · {r.recurrence}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-rose-400/90"
                    aria-label="Remover lembrete"
                    onClick={() => deleteReminderMutation.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
