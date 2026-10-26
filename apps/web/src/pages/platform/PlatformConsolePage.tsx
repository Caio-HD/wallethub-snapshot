import { useState, useDeferredValue, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  ShieldCheck,
  Users,
  ScrollText,
  Database,
  Bot,
  Plug,
  NotebookText,
  MessageCircle,
  Plus,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@shared/utils/cn';
import { Card, CardContent } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { useAuth } from '@features/auth/AuthProvider';
import {
  fetchPlatformOrganizations,
  fetchPlatformOrgDetail,
  fetchPlatformOrgTransactions,
  patchPlatformOrganization,
  createPlatformOrganization,
  addPlatformOrgMember,
  patchPlatformOrgMember,
  removePlatformOrgMember,
  resetPlatformUserPassword,
  disablePlatformUserMfa,
  fetchPlatformUsers,
  patchPlatformUser,
  createPlatformUser,
  fetchPlatformUser,
  startMfaEnrollment,
  confirmMfaEnrollment,
  type PlatformUser,
} from '@features/platform/api';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';
import { PlatformRagTab } from './PlatformRagTab';
import { PlatformAiHistoryTab } from './PlatformAiHistoryTab';
import { PlatformIntegrationsTab } from './PlatformIntegrationsTab';
import { PlatformOtpWhatsAppTab } from './PlatformOtpWhatsAppTab';
import { PlatformNotionTab } from './PlatformNotionTab';
import { PlatformAuditTab, type PlatformNavigate } from './PlatformAuditTab';
import { PlatformEmptyState } from './PlatformEmptyState';
import {
  formatPlatformPlan,
  formatPlatformRole,
  formatPlatformStatus,
} from '@features/platform/labels';
import { Badge } from '@shared/ui/badge';
import { PlatformImpersonateButton } from '@features/platform/PlatformImpersonateButton';
import { buildPlatformBreadcrumbs, platformPath } from '@features/platform/platformNav';
import { PlatformBreadcrumbs } from './PlatformBreadcrumbs';

const TOKENS_STORAGE_KEY = 'wallethub::tokens';

// The console requires MFA (ElevatedAccessGuard returns 428 until enrolled). This card walks the
// operator through TOTP enrollment; on success it persists the fresh tokens (which carry
// isMfaEnabled=true) and reloads so the app picks up the elevated session.
function MfaEnrollment() {
  const [data, setData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const start = useMutation({
    mutationFn: startMfaEnrollment,
    onSuccess: setData,
    onError: () => toast.error('Falha ao iniciar inscrição de MFA'),
  });
  const confirm = useMutation({
    mutationFn: () => confirmMfaEnrollment(code),
    onSuccess: (tokens) => {
      localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
      toast.success('MFA ativado');
      window.location.reload();
    },
    onError: () => toast.error('Código inválido'),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Verificação em duas etapas (MFA)
          </h2>
          <p className="text-sm text-muted-foreground">
            O console de plataforma exige MFA. Inscreva um autenticador TOTP para continuar.
          </p>
        </div>
        {!data ? (
          <Button onClick={() => start.mutate()} disabled={start.isPending} className="w-48">
            Iniciar inscrição
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <img src={data.qrCode} alt="QR MFA" className="h-44 w-44 rounded bg-white p-2" />
            <p className="break-all text-xs text-muted-foreground">Segredo: {data.secret}</p>
            <Input
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-48"
            />
            <Button
              onClick={() => confirm.mutate()}
              disabled={code.length !== 6 || confirm.isPending}
              className="w-48"
            >
              Confirmar e ativar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TabId =
  | 'orgs'
  | 'users'
  | 'rag'
  | 'ai'
  | 'integrations'
  | 'otp-whatsapp'
  | 'notion'
  | 'audit';

const tabGroups: {
  label: string;
  tabs: { id: TabId; label: string; icon: typeof Building2 }[];
}[] = [
  {
    label: 'Tenants',
    tabs: [
      { id: 'orgs', label: 'Organizações', icon: Building2 },
      { id: 'users', label: 'Utilizadores', icon: Users },
    ],
  },
  {
    label: 'Sistema',
    tabs: [
      { id: 'rag', label: 'Base de conhecimento', icon: Database },
      { id: 'ai', label: 'Histórico IA', icon: Bot },
      { id: 'integrations', label: 'Integrações', icon: Plug },
      { id: 'otp-whatsapp', label: 'OTP / WhatsApp', icon: MessageCircle },
      { id: 'notion', label: 'Notion', icon: NotebookText },
      { id: 'audit', label: 'Auditoria', icon: ScrollText },
    ],
  },
];

const tabs = tabGroups.flatMap((g) => g.tabs);

const isTabId = (value: string | null): value is TabId =>
  tabs.some((t) => t.id === value);

function PlatformOnboardingBanner({ onCreateOrg }: { onCreateOrg: () => void }) {
  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100"
      role="status"
    >
      <p className="font-medium text-amber-50">Primeiros passos</p>
      <p className="mt-1 text-amber-100/90">
        Não há organizações na plataforma. Crie a primeira para associar utilizadores e auditar dados
        financeiros no modo impersonation.
      </p>
      <Button size="sm" className="mt-3" onClick={onCreateOrg}>
        <Plus className="h-3.5 w-3.5" />
        Criar primeira organização
      </Button>
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-PT');

// ---------------------------------------------------------------- Organizations
function OrgDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState<{
    userId: string;
    role: 'owner' | 'admin' | 'member';
  }>({ userId: '', role: 'member' });
  const { data: org } = useQuery({
    queryKey: ['platform', 'org', id],
    queryFn: () => fetchPlatformOrgDetail(id),
  });
  const { data: tx } = useQuery({
    queryKey: ['platform', 'org', id, 'tx'],
    queryFn: () => fetchPlatformOrgTransactions(id, { limit: 20 }),
  });
  const [orgForm, setOrgForm] = useState<{
    name: string;
    plan: 'free' | 'pro' | 'plus';
    isQa: boolean;
    legalName: string;
    taxIdType: '' | 'cpf' | 'cnpj';
    taxId: string;
  } | null>(null);
  const save = useMutation({
    mutationFn: () => {
      if (!orgForm) return Promise.reject();
      return patchPlatformOrganization(id, {
        name: orgForm.name.trim(),
        plan: orgForm.plan,
        isQa: orgForm.isQa,
        legalName: orgForm.legalName.trim() || null,
        taxIdType: orgForm.taxIdType || null,
        taxId: orgForm.taxId.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Organização atualizada (auditado)');
      void qc.invalidateQueries({ queryKey: ['platform', 'org', id] });
      void qc.invalidateQueries({ queryKey: ['platform', 'orgs'] });
      setOrgForm(null);
    },
    onError: () => toast.error('Falha ao atualizar'),
  });
  const usersPicker = useQuery({
    queryKey: ['platform', 'users', 'picker'],
    queryFn: () => fetchPlatformUsers({ limit: 500 }),
    enabled: addMemberOpen,
  });
  const addMember = useMutation({
    mutationFn: () => addPlatformOrgMember(id, addMemberForm),
    onSuccess: () => {
      toast.success('Membro adicionado (auditado)');
      void qc.invalidateQueries({ queryKey: ['platform', 'org', id] });
      void qc.invalidateQueries({ queryKey: ['platform', 'orgs'] });
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
      setAddMemberOpen(false);
      setAddMemberForm({ userId: '', role: 'member' });
    },
    onError: () => toast.error('Falha ao adicionar membro'),
  });
  const patchMember = useMutation({
    mutationFn: ({
      userId,
      role,
      messagingAiEnabled,
    }: {
      userId: string;
      role?: 'owner' | 'admin' | 'member';
      messagingAiEnabled?: boolean;
    }) =>
      patchPlatformOrgMember(id, userId, {
        ...(role !== undefined ? { role } : {}),
        ...(messagingAiEnabled !== undefined ? { messagingAiEnabled } : {}),
      }),
    onSuccess: () => {
      toast.success('Membro actualizado (auditado)');
      void qc.invalidateQueries({ queryKey: ['platform', 'org', id] });
    },
    onError: () => toast.error('Falha ao actualizar membro'),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => removePlatformOrgMember(id, userId),
    onSuccess: () => {
      toast.success('Membro removido (auditado)');
      void qc.invalidateQueries({ queryKey: ['platform', 'org', id] });
      void qc.invalidateQueries({ queryKey: ['platform', 'orgs'] });
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
    onError: () => toast.error('Falha ao remover membro'),
  });

  if (!org) return <p className="text-sm text-muted-foreground">A carregar…</p>;

  const form = orgForm ?? {
    name: org.name,
    plan: org.plan,
    isQa: org.isQa,
    legalName: org.legalName ?? '',
    taxIdType: (org.taxIdType ?? '') as '' | 'cpf' | 'cnpj',
    taxId: org.taxId ?? '',
  };
  const orgDirty =
    orgForm !== null &&
    (form.name !== org.name ||
      form.plan !== org.plan ||
      form.isQa !== org.isQa ||
      form.legalName !== (org.legalName ?? '') ||
      form.taxIdType !== (org.taxIdType ?? '') ||
      form.taxId !== (org.taxId ?? ''));

  const setForm = (patch: Partial<typeof form>) =>
    setOrgForm((prev) => ({ ...(prev ?? form), ...patch }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PlatformImpersonateButton organizationId={org.id} organizationName={org.name} />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Nome
              <Input value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Plano
              <select
                value={form.plan}
                onChange={(e) =>
                  setForm({ plan: e.target.value as 'free' | 'pro' | 'plus' })
                }
                className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="plus">plus</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.isQa}
                onChange={(e) => setForm({ isQa: e.target.checked })}
                className="rounded border-white/20"
              />
              Organização QA
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Razão social
              <Input
                value={form.legalName}
                onChange={(e) => setForm({ legalName: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Tipo fiscal
              <select
                value={form.taxIdType}
                onChange={(e) =>
                  setForm({ taxIdType: e.target.value as '' | 'cpf' | 'cnpj' })
                }
                className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              NIF / documento
              <Input value={form.taxId} onChange={(e) => setForm({ taxId: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!orgDirty || save.isPending}
              onClick={() => save.mutate()}
            >
              Guardar alterações
            </Button>
            {orgDirty ? (
              <Button size="sm" variant="ghost" onClick={() => setOrgForm(null)}>
                Reverter
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">criada {fmtDate(org.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Membros ({org.members.length})</h3>
          <Button size="sm" className="gap-1" onClick={() => setAddMemberOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar membro
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Nome</th>
                <th className="p-2">Email</th>
                <th className="p-2">Papel</th>
                <th className="p-2">IA mensagens</th>
                <th className="p-2">Estado</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {org.members.map((m) => (
                <tr key={m.userId} className="border-t border-border/30">
                  <td className="p-2">{m.name}</td>
                  <td className="p-2">{m.email ?? '—'}</td>
                  <td className="p-2">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        patchMember.mutate({
                          userId: m.userId,
                          role: e.target.value as 'owner' | 'admin' | 'member',
                        })
                      }
                      className="rounded border border-white/10 bg-slate-900/50 px-2 py-1 text-xs"
                    >
                      <option value="owner">{formatPlatformRole('owner')}</option>
                      <option value="admin">{formatPlatformRole('admin')}</option>
                      <option value="member">{formatPlatformRole('member')}</option>
                    </select>
                  </td>
                  <td className="p-2">
                    {m.role === 'member' ? (
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={m.messagingAiEnabled}
                          disabled={patchMember.isPending}
                          onChange={(e) =>
                            patchMember.mutate({
                              userId: m.userId,
                              messagingAiEnabled: e.target.checked,
                            })
                          }
                        />
                        {m.messagingAiEnabled ? 'activa' : 'off'}
                      </label>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">{formatPlatformStatus(m.status)}</td>
                  <td className="p-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={removeMember.isPending}
                      onClick={() => removeMember.mutate(m.userId)}
                    >
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Últimas transações</h3>
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Data</th>
                <th className="p-2">Descrição</th>
                <th className="p-2">Categoria</th>
                <th className="p-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(tx?.items ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border/30">
                  <td className="p-2">{new Date(t.occurredAt).toLocaleDateString('pt-PT')}</td>
                  <td className="p-2">{t.description ?? '—'}</td>
                  <td className="p-2">{t.category ?? '—'}</td>
                  <td
                    className={cn(
                      'p-2 text-right',
                      t.direction === 'income' ? 'text-emerald-300' : 'text-rose-300',
                    )}
                  >
                    {t.direction === 'expense' ? '-' : ''}
                    {t.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {addMemberOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Adicionar membro</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Utilizador</label>
                <select
                  value={addMemberForm.userId}
                  onChange={(e) => setAddMemberForm((f) => ({ ...f, userId: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {(usersPicker.data?.items ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Papel</label>
                <select
                  value={addMemberForm.role}
                  onChange={(e) =>
                    setAddMemberForm((f) => ({
                      ...f,
                      role: e.target.value as 'owner' | 'admin' | 'member',
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setAddMemberOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!addMemberForm.userId || addMember.isPending}
                  onClick={() => addMember.mutate()}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrganizationsTab({
  createRequested = 0,
  selectedOrgId,
  onSelectOrg,
}: {
  createRequested?: number;
  selectedOrgId?: string | null;
  onSelectOrg: (orgId: string) => void;
}) {
  const qc = useQueryClient();
  const { refreshOrganizations } = useActiveOrganization();
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (createRequested > 0) setCreateOpen(true);
  }, [createRequested]);
  const [createForm, setCreateForm] = useState({
    name: '',
    plan: 'free' as 'free' | 'pro' | 'plus',
    ownerUserId: '',
  });
  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'orgs', deferredQ],
    queryFn: () => fetchPlatformOrganizations({ q: deferredQ || undefined, limit: 50 }),
  });
  const usersPicker = useQuery({
    queryKey: ['platform', 'users', 'picker'],
    queryFn: () => fetchPlatformUsers({ limit: 500 }),
    enabled: createOpen,
  });
  const createOrg = useMutation({
    mutationFn: () =>
      createPlatformOrganization({
        name: createForm.name.trim(),
        plan: createForm.plan,
        ownerUserId: createForm.ownerUserId || undefined,
      }),
    onSuccess: async () => {
      toast.success('Organização criada (auditado)');
      void qc.invalidateQueries({ queryKey: ['platform', 'orgs'] });
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
      await refreshOrganizations();
      setCreateOpen(false);
      setCreateForm({ name: '', plan: 'free', ownerUserId: '' });
    },
    onError: () => toast.error('Falha ao criar organização'),
  });

  if (selectedOrgId) return <OrgDetail id={selectedOrgId} />;

  const openCreate = () => setCreateOpen(true);

  const items = data?.items ?? [];
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Procurar organização…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {q !== deferredQ ? (
          <span className="text-xs text-muted-foreground">A procurar…</span>
        ) : null}
        <Button className="ml-auto gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova organização
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar organizações…</p>
      ) : isEmpty ? (
        <PlatformEmptyState
          icon={Building2}
          title={q ? 'Nenhuma organização encontrada' : 'Sem organizações'}
          description={
            q
              ? 'Tente outro termo de pesquisa ou crie uma nova organização.'
              : 'Crie a primeira organização para começar a associar utilizadores e auditar tenants.'
          }
          actionLabel={q ? undefined : 'Nova organização'}
          onAction={q ? undefined : openCreate}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Nome</th>
                <th className="p-2">Plano</th>
                <th className="p-2 text-right">Membros</th>
                <th className="p-2 text-right">Transações</th>
                <th className="p-2">Criada</th>
                <th className="p-2 text-right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => onSelectOrg(o.id)}
                  className="cursor-pointer border-t border-border/30 hover:bg-white/5"
                >
                  <td className="p-2">
                    {o.name}{' '}
                    {o.isQa ? (
                      <Badge variant="warning" className="ml-1 normal-case">
                        QA
                      </Badge>
                    ) : null}
                  </td>
                  <td className="p-2">{formatPlatformPlan(o.plan)}</td>
                  <td className="p-2 text-right">{o.memberCount}</td>
                  <td className="p-2 text-right">{o.transactionCount}</td>
                  <td className="p-2">{new Date(o.createdAt).toLocaleDateString('pt-PT')}</td>
                  <td className="p-2 text-right">
                    <PlatformImpersonateButton
                      organizationId={o.id}
                      organizationName={o.name}
                      stopPropagation
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Nova organização</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Plano</label>
                <select
                  value={createForm.plan}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      plan: e.target.value as 'free' | 'pro' | 'plus',
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
                >
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                  <option value="plus">plus</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Owner inicial (opcional)
                </label>
                <select
                  value={createForm.ownerUserId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, ownerUserId: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
                >
                  <option value="">Nenhum</option>
                  {(usersPicker.data?.items ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!createForm.name.trim() || createOrg.isPending}
                  onClick={() => createOrg.mutate()}
                >
                  Criar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Users
const emptyCreate = { username: '', name: '', phoneNumber: '', password: '', email: '' };

function UsersTab({
  selectedUserId,
  onSelectUser,
  onClearUser,
}: {
  selectedUserId?: string | null;
  onSelectUser: (userId: string) => void;
  onClearUser: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    timezone: '',
    preferredLanguage: '',
  });
  const [resetPassword, setResetPassword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'users', deferredQ],
    queryFn: () => fetchPlatformUsers({ q: deferredQ || undefined, limit: 50 }),
  });
  const selectedUserQuery = useQuery({
    queryKey: ['platform', 'user', selectedUserId],
    queryFn: () => fetchPlatformUser(selectedUserId!),
    enabled: Boolean(selectedUserId),
  });

  const applyEditUser = (u: PlatformUser) => {
    setEditUser(u);
    setEditForm({
      name: u.name,
      phoneNumber: u.phoneNumber ?? '',
      email: u.email ?? '',
      timezone: u.timezone ?? '',
      preferredLanguage: u.preferredLanguage ?? '',
    });
    setResetPassword('');
  };

  const closeEdit = () => {
    setEditUser(null);
    onClearUser();
  };

  const openEdit = (u: PlatformUser) => {
    if (selectedUserId !== u.id) onSelectUser(u.id);
    applyEditUser(u);
  };

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof patchPlatformUser>[1] }) =>
      patchPlatformUser(id, body),
    onSuccess: () => {
      toast.success('Utilizador atualizado (auditado)');
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
      closeEdit();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: unknown } } }).response?.data?.message)
          : null;
      toast.error(msg && msg !== 'undefined' ? msg : 'Falha ao atualizar (ação restrita?)');
    },
  });
  const resetPwd = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      resetPlatformUserPassword(id, password),
    onSuccess: () => {
      toast.success('Password redefinida (auditado)');
      setResetPassword('');
    },
    onError: () => toast.error('Falha ao redefinir password'),
  });
  const disableMfa = useMutation({
    mutationFn: (id: string) => disablePlatformUserMfa(id),
    onSuccess: () => {
      toast.success('MFA desactivado (auditado)');
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
      setEditUser((u) => (u ? { ...u, isMfaEnabled: false } : null));
    },
    onError: () => toast.error('Falha ao desactivar MFA'),
  });
  const create = useMutation({
    mutationFn: () =>
      createPlatformUser({
        username: createForm.username.trim().toLowerCase(),
        name: createForm.name.trim(),
        phoneNumber: createForm.phoneNumber.trim(),
        password: createForm.password,
        email: createForm.email.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Utilizador criado.');
      void qc.invalidateQueries({ queryKey: ['platform', 'users'] });
      setCreateOpen(false);
      setCreateForm(emptyCreate);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: unknown } } }).response?.data?.message)
          : null;
      toast.error(msg && msg !== 'undefined' ? msg : 'Falha ao criar utilizador.');
    },
  });

  useEffect(() => {
    if (selectedUserQuery.data) applyEditUser(selectedUserQuery.data);
  }, [selectedUserQuery.data]);

  useEffect(() => {
    if (!selectedUserId) setEditUser(null);
  }, [selectedUserId]);

  const createValid =
    createForm.username.trim().length >= 2 &&
    createForm.name.trim().length >= 2 &&
    createForm.phoneNumber.trim().length >= 8 &&
    createForm.password.length >= 8;

  const items = data?.items ?? [];
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Procurar utilizador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px] flex-1"
        />
        {q !== deferredQ ? (
          <span className="text-xs text-muted-foreground">A procurar…</span>
        ) : null}
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo utilizador
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar utilizadores…</p>
      ) : isEmpty ? (
        <PlatformEmptyState
          icon={Users}
          title={q ? 'Nenhum utilizador encontrado' : 'Sem utilizadores'}
          description={
            q
              ? 'Tente outro termo de pesquisa.'
              : 'Crie utilizadores e associe-os a organizações na aba Organizações.'
          }
          actionLabel={q ? undefined : 'Novo utilizador'}
          onAction={q ? undefined : () => setCreateOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Username</th>
                <th className="p-2">Nome</th>
                <th className="p-2">Papel</th>
                <th className="p-2">Orgs</th>
                <th className="p-2">Estado</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-border/30">
                  <td className="p-2 font-mono text-xs">{u.username}</td>
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">
                    <Badge variant="neutral" className="normal-case">
                      {formatPlatformRole(u.role)}
                    </Badge>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {u.memberships.length > 0 ? (
                      <span className="flex flex-col gap-0.5">
                        {u.memberships.map((m) => (
                          <span key={m.organizationId}>
                            <Link
                              to={platformPath({ tab: 'orgs', orgId: m.organizationId })}
                              className="text-sky-300 hover:underline"
                            >
                              {m.organizationName}
                            </Link>{' '}
                            ({formatPlatformRole(m.role)})
                          </span>
                        ))}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-2">
                    <Badge variant={u.isActive ? 'success' : 'danger'} className="normal-case">
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => openEdit(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                      >
                        {u.isActive ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Novo utilizador</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Username</label>
                <Input
                  value={createForm.username}
                  onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Telefone</label>
                <Input
                  value={createForm.phoneNumber}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Email (opcional)</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Password inicial (mín. 8 caracteres)
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button disabled={!createValid || create.isPending} onClick={() => create.mutate()}>
                  Criar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Editar utilizador</h3>
            <p className="mb-4 font-mono text-xs text-muted-foreground">{editUser.username}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Telefone</label>
                <Input
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Timezone (IANA, ex. Europe/Lisbon)
                </label>
                <Input
                  value={editForm.timezone}
                  onChange={(e) => setEditForm((f) => ({ ...f, timezone: e.target.value }))}
                  placeholder="Europe/Lisbon"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Idioma preferido</label>
                <Input
                  value={editForm.preferredLanguage}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, preferredLanguage: e.target.value }))
                  }
                  placeholder="pt-PT"
                />
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  MFA: {editUser.isMfaEnabled ? 'activo' : 'inactivo'}
                </p>
                {editUser.isMfaEnabled ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disableMfa.isPending}
                    onClick={() => disableMfa.mutate(editUser.id)}
                  >
                    Desactivar MFA
                  </Button>
                ) : null}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                {!editUser.isActive ? (
                  <p className="mb-2 text-xs text-amber-400">
                    Conta inactiva — reactive antes de redefinir a password ou o utilizador não
                    conseguirá entrar.
                  </p>
                ) : null}
                <label className="mb-1 block text-xs text-muted-foreground">
                  Nova password (mín. 8 caracteres)
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  variant="secondary"
                  disabled={resetPassword.length < 8 || resetPwd.isPending || !editUser.isActive}
                  onClick={() => resetPwd.mutate({ id: editUser.id, password: resetPassword })}
                >
                  Redefinir password
                </Button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={closeEdit}>
                  Cancelar
                </Button>
                <Button
                  disabled={patch.isPending}
                  onClick={() => {
                    const phone = editForm.phoneNumber.trim();
                    patch.mutate({
                      id: editUser.id,
                      body: {
                        name: editForm.name.trim(),
                        ...(phone ? { phoneNumber: phone } : { phoneNumber: null }),
                        email: editForm.email.trim() || null,
                        timezone: editForm.timezone.trim() || null,
                        preferredLanguage: editForm.preferredLanguage.trim() || null,
                      },
                    });
                  }}
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
}

// ---------------------------------------------------------------- Audit — ver PlatformAuditTab.tsx

export const PlatformConsolePage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabId = isTabId(tabParam) ? tabParam : 'orgs';
  const orgIdParam = searchParams.get('orgId');
  const userIdParam = searchParams.get('userId');
  const setTab = (id: TabId) =>
    setSearchParams({ tab: id }, { replace: true });
  const selectOrg = (orgId: string) =>
    setSearchParams({ tab: 'orgs', orgId }, { replace: true });
  const selectUser = (userId: string) =>
    setSearchParams({ tab: 'users', userId }, { replace: true });
  const clearUser = () => setSearchParams({ tab: 'users' }, { replace: true });
  const navigatePlatform: PlatformNavigate = ({ tab: nextTab, orgId, userId }) => {
    setSearchParams(
      {
        tab: nextTab,
        ...(orgId ? { orgId } : {}),
        ...(userId ? { userId } : {}),
      },
      { replace: true },
    );
  };
  const mfaEnrolled = user?.isMfaEnabled === true;
  const [createOrgRequest, setCreateOrgRequest] = useState(0);

  const { data: orgOverview } = useQuery({
    queryKey: ['platform', 'orgs', 'overview'],
    queryFn: () => fetchPlatformOrganizations({ limit: 1 }),
    enabled: mfaEnrolled,
  });
  const hasNoOrgs = orgOverview?.total === 0;

  const breadcrumbOrgQuery = useQuery({
    queryKey: ['platform', 'org', orgIdParam, 'breadcrumb'],
    queryFn: () => fetchPlatformOrgDetail(orgIdParam!),
    enabled: mfaEnrolled && tab === 'orgs' && Boolean(orgIdParam),
  });
  const breadcrumbUserQuery = useQuery({
    queryKey: ['platform', 'user', userIdParam, 'breadcrumb'],
    queryFn: () => fetchPlatformUser(userIdParam!),
    enabled: mfaEnrolled && tab === 'users' && Boolean(userIdParam),
  });
  const breadcrumbItems = buildPlatformBreadcrumbs(tab, {
    orgId: orgIdParam,
    orgName: breadcrumbOrgQuery.data?.name,
    userId: userIdParam,
    userName: breadcrumbUserQuery.data?.name,
  });

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-4"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-emerald-500/30 text-emerald-200">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Console de plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Gerir tenants, utilizadores e sistema. Escolha uma organização na barra lateral para
            auditar dados financeiros.
          </p>
        </div>
      </motion.div>

      {!mfaEnrolled && <MfaEnrollment />}

      {mfaEnrolled && hasNoOrgs ? (
        <PlatformOnboardingBanner
          onCreateOrg={() => {
            setTab('orgs');
            setCreateOrgRequest((n) => n + 1);
          }}
        />
      ) : null}

      <div className={cn('flex flex-col gap-3', !mfaEnrolled && 'pointer-events-none opacity-40')}>
        {tabGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-2">
              {group.tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
                      tab === t.id
                        ? 'bg-white/10 text-foreground ring-1 ring-white/10'
                        : 'text-muted-foreground hover:bg-white/5',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {mfaEnrolled ? <PlatformBreadcrumbs items={breadcrumbItems} /> : null}

      {mfaEnrolled && tab === 'orgs' && (
        <OrganizationsTab
          createRequested={createOrgRequest}
          selectedOrgId={orgIdParam}
          onSelectOrg={selectOrg}
        />
      )}
      {mfaEnrolled && tab === 'users' && (
        <UsersTab
          selectedUserId={userIdParam}
          onSelectUser={selectUser}
          onClearUser={clearUser}
        />
      )}
      {mfaEnrolled && tab === 'rag' && <PlatformRagTab />}
      {mfaEnrolled && tab === 'ai' && <PlatformAiHistoryTab />}
      {mfaEnrolled && tab === 'integrations' && <PlatformIntegrationsTab />}
      {mfaEnrolled && tab === 'otp-whatsapp' && <PlatformOtpWhatsAppTab />}
      {mfaEnrolled && tab === 'notion' && <PlatformNotionTab />}
      {mfaEnrolled && tab === 'audit' && <PlatformAuditTab onNavigate={navigatePlatform} />}
    </div>
  );
};
