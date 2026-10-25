import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Upload, CheckCircle2, Building2, AlertTriangle } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import apiClient from '@shared/lib/apiClient';
import { type Account } from '@features/accounts/useAccounts';
import type { Category } from '@features/categories/useCategories';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';
import axios from 'axios';

// Import/reconcile de lote pode exceder o timeout global de 10s do apiClient.
const IMPORT_TIMEOUT_MS = 60_000;

type MatchedTransaction = {
  id: string;
  occurredAt: string;
  amount: number;
  description?: string;
};

type PreviewRow = {
  rowKey: string;
  occurredAt: string;
  amount: number;
  description: string;
  suggestedCategoryId: string | null;
  suggestionConfidence: number;
  direction: 'income' | 'expense';
  hint?: 'income' | 'expense';
  duplicateStatus: 'new' | 'duplicate-exact' | 'duplicate-likely';
  matchedTransaction?: MatchedTransaction;
  selectedByDefault: boolean;
  filename?: string;
  accountId?: string;
};

type BankInfo = {
  bankId?: string;
  branchId?: string;
  acctId?: string;
};

type SuggestedAccount = {
  name: string;
  bankId: string | null;
  bankName: string | null;
  branchNumber: string | null;
  accountNumber: string | null;
};

type BatchFileMeta = {
  filename: string;
  detectedAcctId?: string;
  rowCount: number;
  detectedFormat: 'csv' | 'ofx';
  bankInfo?: BankInfo;
  matchedAccountId?: string;
  accountUnmatched?: boolean;
  suggestedAccount?: SuggestedAccount;
};

type PreviewResponse = {
  previewRows: PreviewRow[];
  rowCount: number;
  filename: string;
  detectedFormat: 'csv' | 'ofx';
  bankInfo?: BankInfo;
  reconciliation?: { exact: number; likely: number; new: number };
  matchedAccountId?: string;
  accountUnmatched?: boolean;
  suggestedAccount?: SuggestedAccount;
};

type CommitResponse = {
  created: number;
  skipped: number;
  alreadyExists: number;
  dryRun: boolean;
  detectedFormat: 'csv' | 'ofx';
  bankInfo?: BankInfo;
  previewRows: PreviewRow[];
  errors: string[];
};

type Props = {
  accounts: Account[];
  categories: Category[];
  initialAccountId?: string;
  onImportSuccess?: () => void;
};

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string })?.message;
    if (typeof msg === 'string' && msg.length > 0) return msg;
  }
  return fallback;
}

function formatBankInfo(bankInfo: BankInfo | undefined): string | null {
  if (!bankInfo) return null;
  const parts: string[] = [];
  if (bankInfo.bankId) parts.push(`Banco ${bankInfo.bankId}`);
  if (bankInfo.acctId) {
    const masked =
      bankInfo.acctId.length > 4 ? `****${bankInfo.acctId.slice(-4)}` : bankInfo.acctId;
    parts.push(`conta ${masked}`);
  }
  return parts.length > 0 ? parts.join(' — ') : null;
}

function guessAccountByAcctId(accounts: Account[], acctId?: string): string {
  if (!acctId) return '';
  const match = accounts.find(
    (a) => a.name.includes(acctId.slice(-4)) || a.id.endsWith(acctId.slice(-4)),
  );
  return match?.id ?? '';
}

export const StatementImportPanel = ({
  accounts,
  categories,
  initialAccountId,
  onImportSuccess,
}: Props) => {
  const queryClient = useQueryClient();
  const { activeOrganizationId: orgId, activeOrganization } = useActiveOrganization();
  // Auto-cadastro de conta pelo OFX usa o endpoint dedicado e idempotente do import
  // (find-or-create-or-reactivate, seguro sob concorrência) — NÃO o POST /accounts público.
  const ensureAccount = useMutation({
    mutationFn: async (payload: {
      name: string;
      bankId: string | null;
      branchNumber: string | null;
      accountNumber: string | null;
    }) => {
      const { data } = await apiClient.post<{ id: string; name: string; isActive: boolean }>(
        '/imports/statement/ensure-account',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      if (orgId) void queryClient.invalidateQueries({ queryKey: ['accounts', orgId] });
    },
  });
  const [files, setFiles] = useState<File[]>([]);
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? '');
  // Padrão neutro: prefere a categoria de sistema "Sem categoria" do tipo (o usuário
  // classifica depois e o sistema aprende). Cai no primeiro do tipo se não existir.
  const defaultCategoryOfType = useCallback(
    (type: 'income' | 'expense'): string => {
      const ofType = categories.filter((c) => c.type === type);
      return (ofType.find((c) => c.isSystem) ?? ofType[0])?.id ?? '';
    },
    [categories],
  );
  const [incomeCategoryId, setIncomeCategoryId] = useState(() => defaultCategoryOfType('income'));
  const [expenseCategoryId, setExpenseCategoryId] = useState(() =>
    defaultCategoryOfType('expense'),
  );
  // Categoria legada (a API ainda exige categoryId obrigatório).
  const categoryId = incomeCategoryId || expenseCategoryId || categories[0]?.id || '';
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [batchMeta, setBatchMeta] = useState<BatchFileMeta[] | null>(null);
  const [routing, setRouting] = useState<Record<string, string>>({});
  // Token do preview-batch: re-previews por mudança de roteamento usam o token
  // (sem reenviar os ficheiros). Ver repreview-batch no backend.
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [lineCategoryByIndex, setLineCategoryByIndex] = useState<Record<number, string>>({});
  // Conta detectada no OFX mas ainda não cadastrada — formulário de cadastro rápido.
  const [pendingAccount, setPendingAccount] = useState<SuggestedAccount | null>(null);
  // Lote: contas detectadas nos ficheiros que ainda não estão cadastradas
  // (deduplicadas por número de conta) — oferecemos criar todas de uma vez.
  const [missingAccounts, setMissingAccounts] = useState<SuggestedAccount[]>([]);

  const isBatch = files.length > 1;
  const isImportAllowed = activeOrganization?.plan === 'pro' || activeOrganization?.plan === 'plus';

  useEffect(() => {
    if (accounts[0] && !accounts.some((a) => a.id === accountId)) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    const incomeCats = categories.filter((c) => c.type === 'income');
    const expenseCats = categories.filter((c) => c.type === 'expense');
    if (incomeCats[0] && !incomeCats.some((c) => c.id === incomeCategoryId)) {
      setIncomeCategoryId(defaultCategoryOfType('income'));
    }
    if (expenseCats[0] && !expenseCats.some((c) => c.id === expenseCategoryId)) {
      setExpenseCategoryId(defaultCategoryOfType('expense'));
    }
  }, [categories, incomeCategoryId, expenseCategoryId, defaultCategoryOfType]);

  const skipKeys = useMemo(() => {
    if (!preview) return [];
    return preview.previewRows
      .filter((r) => !selectedRowKeys.has(r.rowKey))
      .map((r) => r.rowKey);
  }, [preview, selectedRowKeys]);

  const previewMutation = useMutation({
    mutationFn: async (inputFiles: File[]) => {
      if (inputFiles.length === 1) {
        const fd = new FormData();
        fd.append('file', inputFiles[0]);
        fd.append('accountId', accountId);
        fd.append('defaultCategoryId', incomeCategoryId || expenseCategoryId);
        if (incomeCategoryId) fd.append('incomeCategoryId', incomeCategoryId);
        if (expenseCategoryId) fd.append('expenseCategoryId', expenseCategoryId);
        const { data } = await apiClient.post<PreviewResponse>('/imports/statement/preview', fd, {
          timeout: IMPORT_TIMEOUT_MS,
        });
        return { mode: 'single' as const, data };
      }
      // Upload ÚNICO: o backend parseia, cacheia sob um token e já devolve a
      // reconciliação inicial (roteamento auto-detectado). Re-previews por
      // mudança de conta usam o token, sem reenviar os ficheiros.
      const fd = new FormData();
      for (const f of inputFiles) fd.append('files', f);
      fd.append('categoryId', categoryId);
      const { data } = await apiClient.post<{
        token: string;
        files: BatchFileMeta[];
        previewRows: PreviewRow[];
        reconciliation: PreviewResponse['reconciliation'];
      }>('/imports/statement/preview-batch', fd, { timeout: IMPORT_TIMEOUT_MS });
      const initialRouting: Record<string, string> = {};
      for (const m of data.files) {
        initialRouting[m.filename] =
          m.matchedAccountId || guessAccountByAcctId(accounts, m.detectedAcctId) || accountId;
      }
      return {
        mode: 'batch' as const,
        token: data.token,
        meta: data.files,
        routing: initialRouting,
        data: {
          previewRows: data.previewRows,
          rowCount: data.previewRows.length,
          filename: `${inputFiles.length} ficheiros`,
          detectedFormat: 'ofx' as const,
          reconciliation: data.reconciliation,
        },
      };
    },
    onSuccess: (result) => {
      setPreview(result.data);
      if (result.mode === 'batch') {
        setBatchMeta(result.meta);
        setRouting(result.routing);
        setPreviewToken(result.token);
        setPendingAccount(null);
        // Contas do extrato ainda não cadastradas → oferecer criar (dedup por número).
        const missing: SuggestedAccount[] = [];
        const seen = new Set<string>();
        for (const m of result.meta) {
          if (!m.accountUnmatched || !m.suggestedAccount) continue;
          const key = m.suggestedAccount.accountNumber ?? m.detectedAcctId ?? m.filename;
          if (seen.has(key)) continue;
          seen.add(key);
          missing.push(m.suggestedAccount);
        }
        setMissingAccounts(missing);
      } else {
        setBatchMeta(null);
        setRouting({});
        setPreviewToken(null);
        setMissingAccounts([]);
        // Auto-match prioritário: usa a conta casada pelo OFX.
        if (result.data.matchedAccountId) {
          setAccountId(result.data.matchedAccountId);
        }
        // Conta detectada mas não cadastrada → oferece cadastro automático.
        if (result.data.accountUnmatched) {
          setPendingAccount(
            result.data.suggestedAccount ?? {
              name: result.data.bankInfo?.acctId
                ? `Conta ${result.data.bankInfo.acctId}`
                : 'Conta importada',
              bankId: result.data.bankInfo?.bankId ?? null,
              bankName: null,
              branchNumber: result.data.bankInfo?.branchId ?? null,
              accountNumber: result.data.bankInfo?.acctId ?? null,
            },
          );
          toast.warning('Conta do extrato ainda não cadastrada — cadastre para importar.');
          return;
        }
        setPendingAccount(null);
      }
      const defaults = new Set(
        result.data.previewRows.filter((r) => r.selectedByDefault).map((r) => r.rowKey),
      );
      setSelectedRowKeys(defaults);
      const next: Record<number, string> = {};
      result.data.previewRows.slice(0, 25).forEach((r, i) => {
        next[i] =
          r.suggestedCategoryId ??
          (r.direction === 'income' ? incomeCategoryId : expenseCategoryId);
      });
      setLineCategoryByIndex(next);
      toast.success(`${result.data.rowCount} transação(ões) detectadas.`);
    },
    onError: (err) =>
      toast.error(extractErrorMessage(err, 'Pré-visualização falhou (plano Pro+ ou arquivo inválido).')),
  });

  // Re-preview por mudança de roteamento — usa o token (sem reenviar ficheiros).
  const repreviewMutation = useMutation({
    mutationFn: async (nextRouting: Record<string, string>) => {
      if (!previewToken) throw new Error('Token de pré-visualização ausente.');
      const { data } = await apiClient.post<{
        previewRows: PreviewRow[];
        reconciliation: PreviewResponse['reconciliation'];
      }>(
        '/imports/statement/repreview-batch',
        { token: previewToken, routing: nextRouting, categoryId },
        { timeout: IMPORT_TIMEOUT_MS },
      );
      return data;
    },
    onSuccess: (data) => {
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              previewRows: data.previewRows,
              rowCount: data.previewRows.length,
              reconciliation: data.reconciliation,
            }
          : prev,
      );
      const defaults = new Set(
        data.previewRows.filter((r) => r.selectedByDefault).map((r) => r.rowKey),
      );
      setSelectedRowKeys(defaults);
      const next: Record<number, string> = {};
      data.previewRows.slice(0, 25).forEach((r, i) => {
        next[i] =
          r.suggestedCategoryId ?? (r.direction === 'income' ? incomeCategoryId : expenseCategoryId);
      });
      setLineCategoryByIndex(next);
    },
    onError: (err) =>
      toast.error(
        extractErrorMessage(err, 'Falha ao reprocessar o roteamento — reenvie os ficheiros.'),
      ),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error('Arquivo em falta');
      if (isBatch) {
        const fd = new FormData();
        for (const f of files) fd.append('files', f);
        fd.append('routing', JSON.stringify(routing));
        fd.append('categoryId', categoryId);
        if (incomeCategoryId) fd.append('incomeCategoryId', incomeCategoryId);
        if (expenseCategoryId) fd.append('expenseCategoryId', expenseCategoryId);
        if (skipKeys.length > 0) fd.append('skipKeys', JSON.stringify(skipKeys));
        const key = `batch-${Date.now()}-${files.map((f) => f.name).join(',')}`;
        const { data } = await apiClient.post('/imports/statement/commit-batch', fd, {
          headers: { 'Idempotency-Key': key },
          timeout: IMPORT_TIMEOUT_MS,
        });
        return data;
      }
      const fd = new FormData();
      fd.append('file', files[0]);
      fd.append('accountId', accountId);
      fd.append('categoryId', categoryId);
      if (incomeCategoryId) fd.append('incomeCategoryId', incomeCategoryId);
      if (expenseCategoryId) fd.append('expenseCategoryId', expenseCategoryId);
      if (skipKeys.length > 0) fd.append('skipKeys', JSON.stringify(skipKeys));
      const overrides: Record<string, string> = {};
      const maxIdx = Math.min(preview?.previewRows.length ?? 0, 25);
      for (let i = 0; i < maxIdx; i++) {
        const dirDefault =
          preview?.previewRows[i].direction === 'income' ? incomeCategoryId : expenseCategoryId;
        const pick = lineCategoryByIndex[i] ?? dirDefault;
        if (pick && pick !== dirDefault) overrides[String(i)] = pick;
      }
      if (Object.keys(overrides).length > 0) {
        fd.append('categoryOverrides', JSON.stringify(overrides));
      }
      const { data } = await apiClient.post<CommitResponse>('/imports/statement/commit', fd, {
        timeout: IMPORT_TIMEOUT_MS,
      });
      return data;
    },
    onSuccess: (data) => {
      if (Array.isArray((data as { files?: unknown }).files)) {
        const batch = data as {
          files: Array<{
            created: number;
            skipped: number;
            alreadyExists?: number;
            status?: string;
            errors?: string[];
          }>;
        };
        const created = batch.files.reduce((s, f) => s + f.created, 0);
        const alreadyExists = batch.files.reduce((s, f) => s + (f.alreadyExists ?? 0), 0);
        const pending = batch.files.filter((f) => f.status === 'pending').length;
        const errored = batch.files.filter((f) => f.status === 'error').length;
        const extra = [
          alreadyExists ? `${alreadyExists} já existiam` : '',
          pending ? `${pending} ficheiro(s) sem conta` : '',
          errored ? `${errored} com erro` : '',
        ]
          .filter(Boolean)
          .join(', ');
        const suffix = extra ? ` (${extra})` : '';
        if (created === 0 && (pending || errored)) {
          toast.warning(
            `Nenhum lançamento importado${suffix}. ${
              pending ? 'Cadastre/atribua uma conta aos ficheiros e tente de novo.' : ''
            }`.trim(),
          );
        } else {
          toast.success(
            `Importados ${created} lançamentos em ${batch.files.length} ficheiro(s)${suffix}.`,
          );
        }
      } else {
        const d = data as CommitResponse;
        toast.success(
          `Importados ${d.created} lançamentos (${d.skipped} ignorados${d.alreadyExists ? `, ${d.alreadyExists} já existiam` : ''}).`,
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['transactions', orgId] });
      onImportSuccess?.();
      setFiles([]);
      setPreview(null);
      setBatchMeta(null);
      setRouting({});
      setPreviewToken(null);
      setMissingAccounts([]);
    },
    onError: (err) => toast.error(extractErrorMessage(err, 'Importação falhou.')),
  });

  const handleCreatePendingAccount = async () => {
    if (!pendingAccount || !pendingAccount.name.trim()) return;
    try {
      const created = await ensureAccount.mutateAsync({
        name: pendingAccount.name.trim(),
        bankId: pendingAccount.bankId?.trim() || null,
        branchNumber: pendingAccount.branchNumber?.trim() || null,
        accountNumber: pendingAccount.accountNumber?.trim() || null,
      });
      toast.success('Conta cadastrada. A reprocessar o extrato…');
      setAccountId(created.id);
      setPendingAccount(null);
      // Reprocessa: agora o auto-match casa o OFX com a conta recém-criada.
      previewMutation.mutate(files);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Falha ao cadastrar a conta.'));
    }
  };

  // Lote: cria todas as contas em falta de uma vez, roteia os ficheiros para
  // elas e reprocessa a prévia (via token, sem reenviar os ficheiros).
  const handleCreateMissingAccounts = async () => {
    if (missingAccounts.length === 0) return;
    try {
      const createdByNumber = new Map<string, string>();
      for (const sa of missingAccounts) {
        if (!sa.name.trim()) continue;
        const acc = await ensureAccount.mutateAsync({
          name: sa.name.trim(),
          bankId: sa.bankId?.trim() || null,
          branchNumber: sa.branchNumber?.trim() || null,
          accountNumber: sa.accountNumber?.trim() || null,
        });
        createdByNumber.set(sa.accountNumber ?? sa.name, acc.id);
      }
      // Roteia cada ficheiro para a conta recém-criada correspondente.
      const nextRouting = { ...routing };
      for (const m of batchMeta ?? []) {
        const key = m.suggestedAccount?.accountNumber ?? m.detectedAcctId ?? '';
        const id = createdByNumber.get(key);
        if (id) nextRouting[m.filename] = id;
      }
      setRouting(nextRouting);
      setMissingAccounts([]);
      toast.success(
        `${createdByNumber.size} conta(s) cadastrada(s). A reprocessar a pré-visualização…`,
      );
      if (previewToken) repreviewMutation.mutate(nextRouting);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Falha ao cadastrar as contas em falta.'));
    }
  };

  const toggleRow = (row: PreviewRow) => {
    if (row.duplicateStatus === 'duplicate-exact') return;
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(row.rowKey)) next.delete(row.rowKey);
      else next.add(row.rowKey);
      return next;
    });
  };

  const bankLabel = formatBankInfo(preview?.bankInfo);

  return (
    <Card className="border-white/10 bg-slate-900/40 shadow-xl backdrop-blur-xl">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
          <Upload className="h-4 w-4 text-sky-400" />
          Importar extrato (CSV / OFX)
        </CardTitle>
        <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
          Aceita múltiplos <code className="text-sky-300/90">.csv</code> ou{' '}
          <code className="text-sky-300/90">.ofx</code>. Duplicatas são detectadas contra lançamentos
          existentes. Requer plano Pro+.
        </p>
        {!isImportAllowed ? (
          <p className="text-[11px] font-medium text-amber-300">
            O seu plano actual ({activeOrganization?.plan ?? 'free'}) não inclui importação web.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          {!isBatch ? (
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Conta
              </span>
              <select
                disabled={!isImportAllowed}
                className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm font-semibold text-foreground outline-none focus:border-sky-500/50"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Categoria padrão — Entradas
            </span>
            <select
              disabled={!isImportAllowed || !categories.some((c) => c.type === 'income')}
              className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm font-semibold text-foreground outline-none focus:border-sky-500/50"
              value={incomeCategoryId}
              onChange={(e) => setIncomeCategoryId(e.target.value)}
            >
              {categories
                .filter((c) => c.type === 'income')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {!categories.some((c) => c.type === 'income') ? (
              <span className="text-[9px] text-muted-foreground">
                Nenhuma categoria de entrada cadastrada.
              </span>
            ) : null}
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Categoria padrão — Saídas
            </span>
            <select
              disabled={!isImportAllowed || !categories.some((c) => c.type === 'expense')}
              className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm font-semibold text-foreground outline-none focus:border-sky-500/50"
              value={expenseCategoryId}
              onChange={(e) => setExpenseCategoryId(e.target.value)}
            >
              {categories
                .filter((c) => c.type === 'expense')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {!categories.some((c) => c.type === 'expense') ? (
              <span className="text-[9px] text-muted-foreground">
                Nenhuma categoria de saída cadastrada.
              </span>
            ) : null}
          </label>
        </div>

        {isBatch && missingAccounts.length > 0 ? (
          <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {missingAccounts.length} conta(s) do extrato ainda não cadastrada(s)
            </div>
            <ul className="space-y-0.5 text-[10px] text-muted-foreground">
              {missingAccounts.map((sa, i) => (
                <li key={`${sa.accountNumber ?? sa.name}-${i}`} className="font-mono">
                  {sa.name}
                  {sa.accountNumber ? ` — conta ${sa.accountNumber}` : ''}
                  {sa.branchNumber ? ` ag. ${sa.branchNumber}` : ''}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              className="h-8 text-[11px]"
              disabled={ensureAccount.isPending || repreviewMutation.isPending}
              onClick={handleCreateMissingAccounts}
            >
              Criar conta(s) e reprocessar
            </Button>
          </div>
        ) : null}

        {isBatch && batchMeta ? (
          <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] font-bold text-muted-foreground">Roteamento por ficheiro</p>
            {batchMeta.map((m) => (
              <div key={m.filename} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                <span className="truncate text-[11px] font-mono">{m.filename}</span>
                <select
                  className="h-9 rounded border border-white/10 bg-white/5 px-2 text-[11px]"
                  value={routing[m.filename] ?? ''}
                  disabled={repreviewMutation.isPending}
                  onChange={(e) => {
                    const next = { ...routing, [m.filename]: e.target.value };
                    setRouting(next);
                    // Reprocessa a prévia com o novo roteamento (via token, sem reenviar ficheiros).
                    if (previewToken) repreviewMutation.mutate(next);
                  }}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : null}

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center transition hover:border-sky-500/40">
          <input
            type="file"
            multiple
            accept=".csv,.ofx,text/csv,application/x-ofx"
            className="sr-only"
            disabled={!isImportAllowed}
            onChange={(e) => {
              const list = e.target.files ? Array.from(e.target.files) : [];
              setFiles(list);
              setPreview(null);
              setBatchMeta(null);
              setPreviewToken(null);
              setMissingAccounts([]);
              setSelectedRowKeys(new Set());
              // A própria seleção já dispara a pré-visualização/conciliação:
              // não há botão "Pré-visualizar" — o upload configura, o "Importar" grava.
              if (list.length > 0) previewMutation.mutate(list);
            }}
          />
          <Upload className="h-8 w-8 text-sky-400/80" />
          {files.length > 0 ? (
            <span className="text-xs font-semibold text-foreground">
              {files.length} ficheiro(s) seleccionado(s)
            </span>
          ) : (
            <span className="text-xs font-semibold text-foreground">
              Toque para escolher CSV ou OFX (múltiplos permitidos)
            </span>
          )}
        </label>

        {bankLabel && (
          <div className="flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] text-sky-300">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            {bankLabel}
          </div>
        )}

        {pendingAccount && !isBatch ? (
          <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-200">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A conta deste extrato ainda não está cadastrada. Cadastre-a para importar — as próximas
              importações deste banco/agência/conta serão automáticas.
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Nome da conta
                </span>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-white/5 px-2 text-[12px]"
                  value={pendingAccount.name}
                  onChange={(e) =>
                    setPendingAccount((p) => (p ? { ...p, name: e.target.value } : p))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Banco (COMPE){pendingAccount.bankName ? ` — ${pendingAccount.bankName}` : ''}
                </span>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-white/5 px-2 text-[12px]"
                  value={pendingAccount.bankId ?? ''}
                  onChange={(e) =>
                    setPendingAccount((p) => (p ? { ...p, bankId: e.target.value } : p))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Agência
                </span>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-white/5 px-2 text-[12px]"
                  value={pendingAccount.branchNumber ?? ''}
                  onChange={(e) =>
                    setPendingAccount((p) => (p ? { ...p, branchNumber: e.target.value } : p))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Conta
                </span>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-white/5 px-2 text-[12px]"
                  value={pendingAccount.accountNumber ?? ''}
                  onChange={(e) =>
                    setPendingAccount((p) => (p ? { ...p, accountNumber: e.target.value } : p))
                  }
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingAccount(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!pendingAccount.name.trim() || ensureAccount.isPending}
                onClick={handleCreatePendingAccount}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cadastrar conta e continuar
              </Button>
            </div>
          </div>
        ) : null}

        {preview?.reconciliation ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-bold text-sky-300">
              {preview.reconciliation.new} novas
            </span>
            {preview.reconciliation.exact > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                {preview.reconciliation.exact} duplicatas exactas
              </span>
            ) : null}
            {preview.reconciliation.likely > 0 ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-200/80">
                {preview.reconciliation.likely} prováveis
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Ação única: o upload já fez a pré-visualização/conciliação; aqui só se grava. */}
        <Button
          type="button"
          size="md"
          disabled={
            !isImportAllowed ||
            files.length === 0 ||
            previewMutation.isPending ||
            !preview ||
            selectedRowKeys.size === 0 ||
            (!isBatch && !accountId) ||
            !!pendingAccount ||
            (isBatch && missingAccounts.length > 0) ||
            !categoryId ||
            (!incomeCategoryId && categories.some((c) => c.type === 'income')) ||
            (!expenseCategoryId && categories.some((c) => c.type === 'expense')) ||
            commitMutation.isPending
          }
          onClick={() => commitMutation.mutate()}
          className="w-full gap-2 shadow-lg shadow-emerald-500/10"
        >
          <CheckCircle2 className="h-4 w-4" />
          {previewMutation.isPending
            ? 'A analisar o extrato…'
            : commitMutation.isPending
              ? 'A importar…'
              : selectedRowKeys.size > 0
                ? `Importar ${selectedRowKeys.size} transação(ões)`
                : 'Importar'}
        </Button>

        {preview && preview.previewRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-muted-foreground">
                Revisar lançamentos
              </p>
              <span className="text-[10px] font-semibold text-emerald-300">
                {selectedRowKeys.size} de {preview.rowCount} seleccionada(s)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Desmarque o que não quer importar e ajuste a categoria por linha se precisar.
            </p>
            <ul className="max-h-80 space-y-1.5 overflow-auto pr-0.5">
              {preview.previewRows.map((r, i) => {
                const isExact = r.duplicateStatus === 'duplicate-exact';
                const checked = selectedRowKeys.has(r.rowKey);
                const isExpense = r.direction === 'expense';
                const rowCats = categories.filter((c) => c.type === r.direction);
                return (
                  <li
                    key={r.rowKey}
                    className={`flex gap-2.5 rounded-lg border bg-black/20 p-2.5 transition ${
                      checked ? 'border-white/10' : 'border-white/5 opacity-55'
                    } ${isExpense ? 'border-l-2 border-l-rose-500/40' : 'border-l-2 border-l-emerald-500/40'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isExact}
                      onChange={() => toggleRow(r)}
                      aria-label={`Importar ${r.description}`}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500 disabled:opacity-40"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span
                          className={`font-mono text-sm font-bold tabular-nums ${
                            isExpense ? 'text-rose-300' : 'text-emerald-300'
                          }`}
                        >
                          {isExpense ? '−' : '+'}
                          {r.amount.toFixed(2)}
                        </span>
                        <span className="font-mono text-[10px] text-white/50">{r.occurredAt}</span>
                        {r.duplicateStatus !== 'new' ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                            {isExact ? 'duplicata exacta' : 'provável duplicata'}
                          </span>
                        ) : null}
                        {r.filename ? (
                          <span className="truncate text-[9px] text-muted-foreground">{r.filename}</span>
                        ) : null}
                      </div>
                      <span className="truncate text-[11px] text-foreground/80" title={r.description}>
                        {r.description}
                      </span>
                      {r.matchedTransaction ? (
                        <div className="flex items-start gap-1 text-[10px] text-amber-200/70">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          Casado com {r.matchedTransaction.occurredAt} ·{' '}
                          {r.matchedTransaction.amount.toFixed(2)} —{' '}
                          {r.matchedTransaction.description ?? '(sem descrição)'}
                        </div>
                      ) : null}
                      {i < 25 && checked ? (
                        <label className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            Categoria
                          </span>
                          <select
                            className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-semibold outline-none focus:border-sky-500/50 sm:max-w-[16rem]"
                            value={
                              lineCategoryByIndex[i] ??
                              (r.direction === 'income' ? incomeCategoryId : expenseCategoryId)
                            }
                            onChange={(e) =>
                              setLineCategoryByIndex((prev) => ({ ...prev, [i]: e.target.value }))
                            }
                          >
                            {rowCats.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
