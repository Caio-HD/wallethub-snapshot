import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Settings2,
  Trash2,
  PiggyBank,
  DollarSign,
  X,
  Upload,
  PowerOff,
} from 'lucide-react';
import { useAccounts, type Account } from '@features/accounts/useAccounts';
import { useBanks } from '@features/accounts/useBanks';
import { BankCombobox } from '@features/accounts/BankCombobox';
import { useActiveUsers } from '@features/dashboard/useActiveUsers';
import { Card, CardContent } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { toast } from 'sonner';
import { cn } from '@shared/utils/cn';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '@shared/hooks/useFormatter';

export const AccountsPage = () => {
  const { t } = useTranslation('accounts');
  const { bcp47 } = useFormatter();
  const navigate = useNavigate();
  const {
    accounts,
    isLoading,
    createAccount,
    updateAccount,
    deleteAccount
  } = useAccounts();

  const { data: users = [] } = useActiveUsers();
  const { banks } = useBanks();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('0');
  const [editBankId, setEditBankId] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  const [newBankId, setNewBankId] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const activeAccounts = accounts.filter(a => a.isActive);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createAccount.mutateAsync({
        name: newName,
        balance: parseFloat(newBalance) || 0,
        ownerUserIds: selectedUserIds.length > 0 ? selectedUserIds : null,
        bankId: newBankId.trim() || null,
        branchNumber: newBranch.trim() || null,
        accountNumber: newAccountNumber.trim() || null,
      });
      setNewName('');
      setNewBalance('0');
      setNewBankId('');
      setNewBranch('');
      setNewAccountNumber('');
      setSelectedUserIds([]);
      setIsAdding(false);
      toast.success(t('toasts.createSuccess'));
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        (error.response as { status: number })?.status === 409
      ) {
        toast.error(t('toasts.createDuplicate'));
      } else {
        toast.error(t('toasts.createError'));
      }
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateAccount.mutateAsync({ 
        id, 
        dto: {
          name: editName,
          balance: parseFloat(editBalance) || 0,
          bankId: editBankId.trim() || null,
          branchNumber: editBranch.trim() || null,
          accountNumber: editAccountNumber.trim() || null,
        }
      });
      setEditingId(null);
      toast.success(t('toasts.updateSuccess'));
    } catch {
      toast.error(t('toasts.updateError'));
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm(t('confirmDeactivate'))) return;
    try {
      await updateAccount.mutateAsync({ id, dto: { isActive: false } });
      toast.success(t('toasts.deactivateSuccess'));
    } catch {
      toast.error(t('toasts.deactivateError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete', 'Excluir esta conta definitivamente? Só é possível se ela não tiver lançamentos, importações ou dívidas.'))) return;
    try {
      await deleteAccount.mutateAsync(id);
      toast.success(t('toasts.deleteSuccess', 'Conta excluída.'));
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 409) {
        // Conta com dados vivos: mostra o motivo do backend e leva à auditoria de importações.
        toast.error(message ?? t('toasts.deleteConflict', 'Conta tem dados — limpe antes de excluir.'), {
          action: {
            label: t('goToImports', 'Ver importações'),
            onClick: () => navigate(`/accounts/${id}/imports`),
          },
        });
      } else {
        toast.error(t('toasts.deleteError', 'Falha ao excluir a conta.'));
      }
    }
  };

  const toggleUser = (userId: string, currentSelected: string[], setter: (ids: string[]) => void) => {
    setter(
      currentSelected.includes(userId) 
        ? currentSelected.filter(id => id !== userId) 
        : [...currentSelected, userId]
    );
  };

  const handleUpdateOwners = async (id: string, userIds: string[]) => {
    try {
      await updateAccount.mutateAsync({ id, dto: { ownerUserIds: userIds.length > 0 ? userIds : null } });
      toast.success(t('toasts.ownersSuccess'));
    } catch {
      toast.error(t('toasts.ownersError'));
    }
  };

  const startEditing = (account: Account) => {
    setEditingId(account.id);
    setEditName(account.name);
    setEditBalance(account.balance);
    setEditBankId(account.bankId ?? '');
    setEditBranch(account.branchNumber ?? '');
    setEditAccountNumber(account.accountNumber ?? '');
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/30 to-indigo-500/30 text-sky-300">
            <PiggyBank className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/accounts/imports')}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {t('importOfx', 'Importar OFX')}
          </Button>
          <Button onClick={() => setIsAdding(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('addAccount')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {isAdding && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-sky-500/5 p-4"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">{t('accountName')}</label>
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder={t('namePlaceholder')}
                          className="rounded-full bg-slate-900/40 border-sky-500/20 focus:border-sky-500/50"
                          autoFocus
                        />
                      </div>
                      <div className="w-40 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">{t('balance')}</label>
                        <Input 
                          type="number"
                          step="0.01"
                          value={newBalance} 
                          onChange={(e) => setNewBalance(e.target.value)} 
                          className="rounded-full bg-slate-900/40 border-sky-500/20 focus:border-sky-500/50"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-full sm:w-auto h-11 flex items-end">
                        <Popover className="relative w-full">
                          <PopoverButton className="flex h-11 w-full items-center justify-between rounded-full border border-sky-500/20 bg-slate-900/40 px-4 text-sm font-semibold text-foreground outline-none transition-all hover:border-sky-500/40 focus:border-sky-500/50">
                            <span className="truncate">
                              {selectedUserIds.length === 0
                                ? t('shared')
                                : t('ownerCount', { count: selectedUserIds.length })
                              }
                            </span>
                            <Users className="h-4 w-4 text-sky-400" />
                          </PopoverButton>
                          <PopoverPanel className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl">
                            <div className="space-y-3">
                              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t('selectOwners')}</div>
                              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {users.map(user => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    className={cn(
                                      "flex h-10 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200",
                                      selectedUserIds.includes(user.id)
                                        ? "bg-sky-500/20 border-sky-500/30 text-sky-400 scale-[1.02]"
                                        : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/10"
                                    )}
                                    onClick={() => toggleUser(user.id, selectedUserIds, setSelectedUserIds)}
                                  >
                                    {user.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </PopoverPanel>
                        </Popover>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="w-72 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">{t('bankId', 'Banco')}</label>
                        <BankCombobox
                          banks={banks}
                          value={newBankId}
                          onChange={setNewBankId}
                          placeholder={t('selectBank', 'Buscar banco por nome ou código…')}
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">{t('branchNumber', 'Agência')}</label>
                        <Input
                          value={newBranch}
                          onChange={(e) => setNewBranch(e.target.value)}
                          placeholder="0001"
                          className="rounded-full bg-slate-900/40 border-sky-500/20 focus:border-sky-500/50"
                        />
                      </div>
                      <div className="flex-1 min-w-[120px] space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">{t('accountNumber', 'Conta')}</label>
                        <Input
                          value={newAccountNumber}
                          onChange={(e) => setNewAccountNumber(e.target.value)}
                          placeholder="12345-6"
                          className="rounded-full bg-slate-900/40 border-sky-500/20 focus:border-sky-500/50"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground pl-1">
                      {t('bankIdentityHint', 'Banco, agência e conta permitem casar importações OFX automaticamente com esta conta.')}
                    </p>
                    <div className="flex gap-2 w-full justify-end pt-2 border-t border-white/5">
                      <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="rounded-full px-4">
                        {t('cancel')}
                      </Button>
                      <Button size="sm" onClick={handleCreate} className="rounded-full px-6 shadow-lg shadow-sky-500/20">
                        {t('addAccount')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeAccounts.map((account) => (
              <div key={account.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  
                  {editingId === account.id ? (
                    <div className="flex flex-wrap items-center gap-3 flex-1 bg-white/5 p-2 rounded-2xl border border-white/5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex-1 min-w-[120px]">
                        <Input 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nome"
                          className="h-9 rounded-full bg-slate-900/60 border-sky-500/30 text-xs font-semibold"
                          autoFocus
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          placeholder="Saldo"
                          className="h-9 rounded-full bg-slate-900/60 border-sky-500/30 text-xs font-semibold"
                        />
                      </div>
                      <div className="w-60">
                        <BankCombobox
                          banks={banks}
                          value={editBankId}
                          onChange={setEditBankId}
                          placeholder={t('selectBank', 'Banco…')}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          value={editBranch}
                          onChange={(e) => setEditBranch(e.target.value)}
                          placeholder={t('branchNumber', 'Agência')}
                          className="h-9 rounded-full bg-slate-900/60 border-sky-500/30 text-xs font-semibold"
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          value={editAccountNumber}
                          onChange={(e) => setEditAccountNumber(e.target.value)}
                          placeholder={t('accountNumber', 'Conta')}
                          className="h-9 rounded-full bg-slate-900/60 border-sky-500/30 text-xs font-semibold"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setEditingId(null)}
                          className="h-8 w-8 rounded-full text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdate(account.id)}
                          className="h-8 rounded-full px-4 text-xs shadow-lg shadow-sky-500/10"
                        >
                          {t('save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{account.name}</span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border-r border-white/10 pr-2">
                            {t('balance')}: {parseFloat(account.balance).toLocaleString(bcp47, { minimumFractionDigits: 2 })}
                          </span>
                          {account.lastBalanceUpdateAt && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 border-r border-white/10 pr-2">
                              Ajuste: {new Date(account.lastBalanceUpdateAt).toLocaleString(bcp47, { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-wider text-sky-400">
                            {(!account.ownerUserIds || account.ownerUserIds.length === 0)
                              ? t('shared')
                              : users.filter(u => account.ownerUserIds?.includes(u.id)).map(u => u.name).join(', ')
                            }
                          </span>
                        </div>
                      </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-sky-500/30 text-sky-300 hover:border-sky-500/50 hover:text-sky-200"
                  onClick={() => navigate(`/accounts/${account.id}/imports`)}
                  title={t('importAudit')}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t('importAudit')}</span>
                </Button>

                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <Popover className="relative">
                    <PopoverButton className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-sky-500/10 hover:text-sky-400 outline-none">
                      <Users className="h-4 w-4" />
                    </PopoverButton>
                    <PopoverPanel className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl">
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t('owners')}</div>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                          {users.map(user => {
                            const isOwner = account.ownerUserIds?.includes(user.id);
                            return (
                              <button
                                key={user.id}
                                type="button"
                                className={cn(
                                  "flex h-10 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200",
                                  isOwner 
                                    ? "bg-sky-500/20 border-sky-500/30 text-sky-400 scale-[1.02]" 
                                    : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/10"
                                )}
                                onClick={() => {
                                  const newOwners = isOwner
                                    ? account.ownerUserIds?.filter(id => id !== user.id) ?? []
                                    : [...(account.ownerUserIds ?? []), user.id];
                                  handleUpdateOwners(account.id, newOwners);
                                }}
                              >
                                {user.name}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[9px] text-muted-foreground italic mt-2 border-t border-white/5 pt-2 text-center">
                          Vazio = Compartilhada com todos
                        </div>
                      </div>
                    </PopoverPanel>
                  </Popover>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => startEditing(account)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                    title={t('deactivate', 'Desativar')}
                    onClick={() => handleDeactivate(account.id)}
                  >
                    <PowerOff className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                    title={t('delete', 'Excluir')}
                    onClick={() => handleDelete(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {activeAccounts.length === 0 && !isAdding && (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="ghost" className="text-sky-400" onClick={() => setIsAdding(true)}>
                    Clique aqui para começar
                  </Button>
                  <span className="text-xs text-muted-foreground/60">{t('or', 'ou')}</span>
                  <Button
                    variant="ghost"
                    className="gap-1.5 text-sky-400"
                    onClick={() => navigate('/accounts/imports')}
                  >
                    <Upload className="h-4 w-4" />
                    {t('importOfx', 'Importar OFX')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
