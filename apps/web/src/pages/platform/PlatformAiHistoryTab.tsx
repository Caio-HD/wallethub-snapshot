import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye } from 'lucide-react';
import { fetchAiSessions, fetchAiTraceDetail, fetchAiTraces, fetchPlatformUsers } from '@features/platform/api';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';

const channelLabel: Record<string, string> = {
  web: 'Web',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

export const PlatformAiHistoryTab = () => {
  const platformUsersQuery = useQuery({
    queryKey: ['platform', 'users', 'picker'],
    queryFn: () => fetchPlatformUsers({ limit: 500 }),
    staleTime: 1000 * 60 * 2,
  });
  const platformUsers = platformUsersQuery.data?.items ?? [];

  const [sessionPage, setSessionPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [channel, setChannel] = useState<'web' | 'whatsapp' | 'telegram' | ''>('');
  const [sessionFrom, setSessionFrom] = useState('');
  const [sessionTo, setSessionTo] = useState('');

  const [tracePage, setTracePage] = useState(1);
  const [traceSessionId, setTraceSessionId] = useState('');
  const [traceFrom, setTraceFrom] = useState('');
  const [traceTo, setTraceTo] = useState('');

  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    setSessionPage(1);
  }, [userId, channel, sessionFrom, sessionTo]);

  useEffect(() => {
    setTracePage(1);
  }, [traceSessionId, traceFrom, traceTo]);

  const sessionsQuery = useQuery({
    queryKey: ['platform', 'ai', 'sessions', sessionPage, userId, channel, sessionFrom, sessionTo],
    queryFn: () =>
      fetchAiSessions({
        page: sessionPage,
        limit: 20,
        userId: userId || undefined,
        channel: channel || undefined,
        from: sessionFrom || undefined,
        to: sessionTo || undefined,
      }),
  });

  const tracesQuery = useQuery({
    queryKey: ['platform', 'ai', 'traces', tracePage, traceSessionId, traceFrom, traceTo],
    queryFn: () =>
      fetchAiTraces({
        page: tracePage,
        limit: 20,
        sessionId: traceSessionId || undefined,
        from: traceFrom ? new Date(traceFrom).toISOString() : undefined,
        to: traceTo ? new Date(traceTo).toISOString() : undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['platform', 'ai', 'trace-detail', detailId],
    queryFn: () => fetchAiTraceDetail(detailId!, 200),
    enabled: !!detailId,
  });

  const sessionTotalPages = sessionsQuery.data
    ? Math.max(1, Math.ceil(sessionsQuery.data.total / sessionsQuery.data.limit))
    : 1;
  const traceTotalPages = tracesQuery.data
    ? Math.max(1, Math.ceil(tracesQuery.data.total / tracesQuery.data.limit))
    : 1;

  const formatDt = (iso: string) => {
    try {
      return format(parseISO(iso), 'd MMM yyyy HH:mm', { locale: ptBR });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sessões de conversação
        </h3>
        <div className="flex flex-wrap gap-3">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-foreground outline-none"
          >
            <option value="">Todos os utilizadores</option>
            {platformUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.username})
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as '' | 'web' | 'whatsapp' | 'telegram')}
            className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-foreground outline-none"
          >
            <option value="">Todos os canais</option>
            <option value="web">Web</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
          </select>
          <input
            type="date"
            value={sessionFrom}
            onChange={(e) => setSessionFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-foreground"
          />
          <input
            type="date"
            value={sessionTo}
            onChange={(e) => setSessionTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-foreground"
          />
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            {sessionsQuery.isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">A carregar sessões…</p>
            ) : sessionsQuery.isError ? (
              <p className="p-6 text-sm text-destructive">Falha ao carregar sessões.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/10 bg-slate-900/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data (sessão)</th>
                    <th className="px-4 py-3 font-medium">Canal</th>
                    <th className="px-4 py-3 font-medium">Utilizador</th>
                    <th className="px-4 py-3 font-medium">Criada</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsQuery.data?.items.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer border-b border-white/5 hover:bg-white/[0.02]"
                      onClick={() => setTraceSessionId(s.id)}
                      title="Clique para filtrar traces desta sessão"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{s.sessionDate}</td>
                      <td className="px-4 py-3">{channelLabel[s.channel] ?? s.channel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.userName ?? s.userId ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDt(s.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        {sessionsQuery.data ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {sessionsQuery.data.total} sessão(ões) · p. {sessionsQuery.data.page} /{' '}
              {sessionTotalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sessionPage <= 1}
                onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sessionPage >= sessionTotalPages}
                onClick={() => setSessionPage((p) => p + 1)}
              >
                Seguinte
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Traces do agente
        </h3>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={traceSessionId}
            onChange={(e) => setTraceSessionId(e.target.value)}
            placeholder="ID da sessão (UUID)"
            className="min-w-[240px] flex-1 rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 font-mono text-xs text-foreground outline-none"
          />
          <input
            type="datetime-local"
            value={traceFrom}
            onChange={(e) => setTraceFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-foreground"
          />
          <input
            type="datetime-local"
            value={traceTo}
            onChange={(e) => setTraceTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-foreground"
          />
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            {tracesQuery.isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">A carregar traces…</p>
            ) : tracesQuery.isError ? (
              <p className="p-6 text-sm text-destructive">Falha ao carregar traces.</p>
            ) : (
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-white/10 bg-slate-900/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Modelo</th>
                    <th className="px-4 py-3 font-medium">Início</th>
                    <th className="px-4 py-3 font-medium">Resposta (prévia)</th>
                    <th className="px-4 py-3 font-medium text-right">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {tracesQuery.data?.items.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">{t.status}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {t.provider ?? '—'} / {t.model ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDt(t.startedAt)}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 text-xs text-muted-foreground">
                        {t.finalReply ?? t.errorMessage ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setDetailId(t.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        {tracesQuery.data ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {tracesQuery.data.total} trace(s) · p. {tracesQuery.data.page} / {traceTotalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={tracePage <= 1}
                onClick={() => setTracePage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={tracePage >= traceTotalPages}
                onClick={() => setTracePage((p) => p + 1)}
              >
                Seguinte
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {detailId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h3 className="text-lg font-semibold text-foreground">Trace</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDetailId(null)}>
                Fechar
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detailQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">A carregar…</p>
              ) : detailQuery.isError || !detailQuery.data ? (
                <p className="text-sm text-destructive">Não foi possível carregar o trace.</p>
              ) : (
                <div className="space-y-4">
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Estado</dt>
                      <dd>{detailQuery.data.status}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Canal</dt>
                      <dd>{detailQuery.data.channel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Utilizador</dt>
                      <dd>{detailQuery.data.userName ?? detailQuery.data.userId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Modelo</dt>
                      <dd>
                        {detailQuery.data.provider ?? '—'} / {detailQuery.data.model ?? '—'}
                      </dd>
                    </div>
                  </dl>
                  {detailQuery.data.errorMessage ? (
                    <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                      {detailQuery.data.errorMessage}
                    </p>
                  ) : null}
                  {detailQuery.data.finalReply ? (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Resposta final</p>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs text-foreground">
                        {detailQuery.data.finalReply}
                      </pre>
                    </div>
                  ) : null}
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      Observações ({detailQuery.data.observations.length})
                    </p>
                    <ul className="space-y-2">
                      {detailQuery.data.observations.map((o) => (
                        <li
                          key={o.id}
                          className="rounded-lg border border-white/5 bg-slate-950/30 p-3 text-xs"
                        >
                          <span className="font-mono text-sky-300">
                            #{o.sequence} {o.observationType}
                          </span>
                          {o.name ? <span className="ml-2 text-muted-foreground">{o.name}</span> : null}
                          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                            {JSON.stringify(o.payload, null, 2)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
