import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, Trash2 } from 'lucide-react';
import {
  deleteRagDocument,
  fetchRagDocument,
  fetchRagDocuments,
  upsertRagDocument,
} from '@features/platform/api';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card, CardContent } from '@shared/ui/card';

type ModalState = { mode: 'new' } | { mode: 'edit'; sourceKey: string } | null;

export const PlatformRagTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  const [sourceKey, setSourceKey] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const editSourceKey = modal?.mode === 'edit' ? modal.sourceKey : '';

  const listQuery = useQuery({
    queryKey: ['platform', 'rag', 'documents', page],
    queryFn: () => fetchRagDocuments({ page, limit: 20 }),
  });

  const detailQuery = useQuery({
    queryKey: ['platform', 'rag', 'document', editSourceKey],
    queryFn: () => fetchRagDocument(editSourceKey),
    enabled: Boolean(editSourceKey),
  });

  useEffect(() => {
    if (!modal) return;
    if (modal.mode === 'new') {
      setSourceKey('');
      setTitle('');
      setBody('');
    }
  }, [modal]);

  useEffect(() => {
    if (modal?.mode !== 'edit' || !detailQuery.data) return;
    const d = detailQuery.data;
    setSourceKey(d.sourceKey);
    setTitle(d.title ?? '');
    setBody(d.body);
  }, [modal?.mode, detailQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: () =>
      upsertRagDocument({
        sourceKey: sourceKey.trim(),
        title: title.trim() || undefined,
        body: body.trim(),
      }),
    onSuccess: () => {
      toast.success('Documento guardado.');
      void queryClient.invalidateQueries({ queryKey: ['platform', 'rag'] });
      setModal(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao guardar.';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteRagDocument(key),
    onSuccess: (res) => {
      if (res.deleted) toast.success('Documento removido.');
      else toast.message('Nada a remover.');
      void queryClient.invalidateQueries({ queryKey: ['platform', 'rag'] });
      setModal(null);
    },
    onError: () => toast.error('Falha ao remover.'),
  });

  const totalPages = listQuery.data
    ? Math.max(1, Math.ceil(listQuery.data.total / listQuery.data.limit))
    : 1;

  const isEdit = modal?.mode === 'edit';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Markdown ou texto simples. A ingestão exige RAG ativo no servidor (OPENAI_API_KEY).
        </p>
        <Button type="button" onClick={() => setModal({ mode: 'new' })} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo documento
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {listQuery.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">A carregar…</p>
          ) : listQuery.isError ? (
            <p className="p-6 text-sm text-destructive">Não foi possível carregar os documentos.</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-900/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Chave</th>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Chunks</th>
                  <th className="px-4 py-3 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data?.items.map((d) => (
                  <tr
                    key={d.id}
                    className="cursor-pointer border-b border-white/5 hover:bg-white/[0.02]"
                    onClick={() => setModal({ mode: 'edit', sourceKey: d.sourceKey })}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-sky-300">{d.sourceKey}</td>
                    <td className="max-w-[200px] truncate px-4 py-3">{d.title ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.chunkCount}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(d.updatedAt).toLocaleString('pt-PT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {listQuery.data ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {listQuery.data.total} documento(s) · página {listQuery.data.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Seguinte
            </Button>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
              <FileText className="h-5 w-5 text-sky-400" />
              <h3 className="text-lg font-semibold text-foreground">
                {isEdit ? 'Editar documento' : 'Novo documento'}
              </h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {isEdit && detailQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">A carregar conteúdo…</p>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">sourceKey</label>
                    <Input
                      value={sourceKey}
                      onChange={(e) => setSourceKey(e.target.value)}
                      disabled={isEdit}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Título (opcional)</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Corpo (markdown)</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={14}
                      className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-sky-500/40"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-6 py-4">
              {isEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (!window.confirm('Remover este documento da base de conhecimento?')) return;
                    deleteMutation.mutate(sourceKey.trim());
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Apagar
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={
                    upsertMutation.isPending ||
                    !sourceKey.trim() ||
                    !body.trim() ||
                    (isEdit && detailQuery.isLoading)
                  }
                  onClick={() => upsertMutation.mutate()}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
