import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Settings2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Tag,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import { useCategories, CategoryType } from '@features/categories/useCategories';
import { Card, CardContent } from '@shared/ui/card';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { cn } from '@shared/utils/cn';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export const CategoriesPage = () => {
  const { t } = useTranslation('common');
  const {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories
  } = useCategories();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CategoryType>('expense');

  const activeCategories = categories.filter(c => c.isActive);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: newName, type: newType });
      setNewName('');
      setIsAdding(false);
      toast.success(t('categories.toasts.createSuccess'));
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        (error.response as { status: number })?.status === 409
      ) {
        toast.error(t('categories.toasts.createDuplicate'));
      } else {
        toast.error(t('categories.toasts.createError'));
      }
    }
  };

  const handleUpdateName = async (id: string, name: string) => {
    if (!name.trim()) return;
    try {
      await updateCategory.mutateAsync({ id, dto: { name } });
      setEditingId(null);
      toast.success(t('categories.toasts.updateSuccess'));
    } catch {
      toast.error(t('categories.toasts.updateError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('categories.confirmDeactivate'))) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast.success(t('categories.toasts.deactivateSuccess'));
    } catch {
      toast.error(t('categories.toasts.deactivateError'));
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...activeCategories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

    try {
      await reorderCategories.mutateAsync(newItems.map(c => c.id));
    } catch {
      toast.error(t('categories.toasts.reorderError'));
    }
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
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-sky-500/30 text-indigo-200">
            <Tag className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('categories.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('categories.subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('categories.addCategory')}
        </Button>
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
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('categories.nameLabel')}</label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t('categories.namePlaceholderExample')}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('categories.typeLabel')}</label>
                      <div className="flex rounded-lg border border-white/10 bg-slate-950/50 p-1">
                        <button
                          onClick={() => setNewType('expense')}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                            newType === 'expense' ? "bg-rose-500/20 text-rose-300 shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <TrendingDown className="h-3.5 w-3.5" />
                          {t('categories.expense')}
                        </button>
                        <button
                          onClick={() => setNewType('income')}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                            newType === 'income' ? "bg-emerald-500/20 text-emerald-300 shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          {t('categories.income')}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleCreate}>
                        {t('categories.create')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeCategories.map((category, index) => (
              <div key={category.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
                <div className="flex items-center gap-3 flex-1">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    category.type === 'income' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  )}>
                    {category.type === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>

                  {editingId === category.id ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Input
                        defaultValue={category.name}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateName(category.id, e.currentTarget.value);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={(e) => handleUpdateName(category.id, e.target.value)}
                        className="h-8 py-0"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{category.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {category.type === 'income' ? t('categories.income') : t('categories.expense')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-sky-400"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-sky-400"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === activeCategories.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingId(category.id)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {activeCategories.length === 0 && !isAdding && (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">{t('categories.empty')}</p>
                <Button variant="ghost" className="mt-2 text-sky-400" onClick={() => setIsAdding(true)}>
                  {t('categories.clickToStart')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
