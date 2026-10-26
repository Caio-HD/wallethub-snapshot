import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { useState, useMemo, useEffect } from 'react';
import { Calendar, CreditCard, Tag, DollarSign, AlignLeft, Paperclip, ChevronRight } from 'lucide-react';
import { Category } from '@features/categories/useCategories';
import { Account } from '@features/accounts/useAccounts';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { FileUpload } from '@shared/ui/file-upload';
import { Select } from '@shared/ui/select';
import { DatePicker } from '@shared/ui/date-picker';
import { cn } from '@shared/utils/cn';
import {
  formatBrlMoneyTyping,
  formatNumberToBrlInput,
  parseBrlMoneyInput,
} from '@shared/utils/brl-money-input';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

const buildTransactionFormSchema = (messages: {
  dateRequired: string;
  accountRequired: string;
  categoryRequired: string;
  amountRequired: string;
  amountPositive: string;
  descriptionMax: string;
  toAccountRequired: string;
  toAccountSame: string;
}) =>
  z
    .object({
      occurredAt: z.string({ required_error: messages.dateRequired }),
      accountId: z.string().uuid(messages.accountRequired),
      // categoryId só é obrigatório para income/expense; toAccountId só para transfer.
      categoryId: z.string().optional().or(z.literal('')),
      toAccountId: z.string().optional().or(z.literal('')),
      direction: z.enum(['income', 'expense', 'transfer']),
      amount: z
        .string()
        .trim()
        .min(1, messages.amountRequired)
        .transform((s) => parseBrlMoneyInput(s))
        .refine((n) => Number.isFinite(n) && n > 0, { message: messages.amountPositive }),
      description: z.string().max(240, messages.descriptionMax).optional().or(z.literal('')),
    })
    .superRefine((val, ctx) => {
      if (val.direction === 'transfer') {
        if (!val.toAccountId) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toAccountId'], message: messages.toAccountRequired });
        } else if (val.toAccountId === val.accountId) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toAccountId'], message: messages.toAccountSame });
        }
      } else if (!val.categoryId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryId'], message: messages.categoryRequired });
      }
    });

type TransactionFormSchema = ReturnType<typeof buildTransactionFormSchema>;
export type TransactionFormValues = z.output<TransactionFormSchema>;
type TransactionFormInput = z.input<TransactionFormSchema>;

export type TransactionFormDefaultValues = Partial<Omit<TransactionFormValues, 'amount'>> & {
  amount?: number;
};

interface TransactionFormProps {
  categories: Category[];
  accounts: Account[];
  defaultValues?: TransactionFormDefaultValues;
  onSubmit: (values: TransactionFormValues, file: File | null) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export const TransactionForm = ({
  categories,
  accounts,
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting,
}: TransactionFormProps) => {
  const { t } = useTranslation('transactions');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const schema = useMemo(
    () =>
      buildTransactionFormSchema({
        dateRequired: t('form.validation.dateRequired'),
        accountRequired: t('form.validation.accountRequired'),
        categoryRequired: t('form.validation.categoryRequired'),
        amountRequired: t('form.validation.amountRequired'),
        amountPositive: t('form.validation.amountPositive'),
        descriptionMax: t('form.validation.descriptionMax'),
        toAccountRequired: t('form.validation.toAccountRequired'),
        toAccountSame: t('form.validation.toAccountSame'),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(schema) as Resolver<TransactionFormInput, unknown, TransactionFormValues>,
    defaultValues: {
      occurredAt: defaultValues?.occurredAt ?? new Date().toISOString().slice(0, 10),
      accountId: defaultValues?.accountId ?? accounts[0]?.id ?? '',
      categoryId: defaultValues?.categoryId ?? '',
      toAccountId: '',
      direction: defaultValues?.direction ?? 'expense',
      amount: formatNumberToBrlInput(defaultValues?.amount ?? 0),
      description: defaultValues?.description ?? '',
    },
  });

  const direction = watch('direction');
  const categoryId = watch('categoryId');
  const accountId = watch('accountId');
  const toAccountId = watch('toAccountId');

  const isEditing = Boolean(defaultValues?.occurredAt);
  const isTransfer = direction === 'transfer';

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === direction);
  }, [categories, direction]);

  useEffect(() => {
    if (isTransfer) return; // transferência não usa categoria
    const isCurrentCategoryValid = filteredCategories.some((c) => c.id === categoryId);
    if (!isCurrentCategoryValid) {
      setValue('categoryId', filteredCategories[0]?.id ?? '');
    }
  }, [direction, isTransfer, filteredCategories, categoryId, setValue]);

  // Destino default = primeira conta diferente da origem.
  useEffect(() => {
    if (!isTransfer) return;
    if (!toAccountId || toAccountId === accountId) {
      const firstOther = accounts.find((a) => a.id !== accountId);
      setValue('toAccountId', firstOther?.id ?? '');
    }
  }, [isTransfer, accountId, toAccountId, accounts, setValue]);

  return (
    <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl">
      <CardContent className="p-0">
        <form onSubmit={handleSubmit((values) => onSubmit(values, selectedFile))} className="divide-y divide-white/5">
          <div className="flex items-center justify-between bg-white/5 p-4 lg:p-6">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {defaultValues?.occurredAt ? t('form.editTitle') : t('form.newTitle')}
            </h2>
            <div className="flex rounded-xl bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setValue('direction', 'expense')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200',
                  direction === 'expense'
                    ? 'bg-destructive/20 text-destructive shadow-lg shadow-destructive/10'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('form.expense')}
              </button>
              <button
                type="button"
                onClick={() => setValue('direction', 'income')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200',
                  direction === 'income'
                    ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('form.income')}
              </button>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setValue('direction', 'transfer')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200',
                    isTransfer
                      ? 'bg-sky-500/20 text-sky-400 shadow-lg shadow-sky-500/10'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t('form.transfer')}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 p-4 lg:grid-cols-2 lg:p-8">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t('form.dateLabel')}
                  </div>
                  <Controller
                    name="occurredAt"
                    control={control}
                    render={({ field }) => (
                      <DatePicker value={field.value} onChange={field.onChange} />
                    )}
                  />
                  {errors.occurredAt && (
                    <span className="text-[10px] font-bold text-destructive ml-1">
                      {errors.occurredAt.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    {t('form.amountLabel')}
                  </div>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground/40 group-focus-within:text-accent transition-colors">
                      R$
                    </span>
                    <Controller
                      name="amount"
                      control={control}
                      render={({ field }) => (
                        <Input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          aria-label={t('form.amountAriaLabel')}
                          placeholder={t('form.amountPlaceholder')}
                          value={field.value}
                          onChange={(e) => field.onChange(formatBrlMoneyTyping(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="pl-10 border-white/5 bg-white/5 hover:border-white/20 transition-colors text-lg font-bold"
                        />
                      )}
                    />
                  </div>
                  {errors.amount && (
                    <span className="text-[10px] font-bold text-destructive ml-1">
                      {errors.amount.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label={isTransfer ? t('form.fromAccountLabel') : t('form.accountLabel')}
                  icon={<CreditCard className="h-3.5 w-3.5" />}
                  options={accounts}
                  value={accountId}
                  onChange={(val) => setValue('accountId', val)}
                />

                {isTransfer ? (
                  <div className="space-y-1">
                    <Select
                      label={t('form.toAccountLabel')}
                      icon={<CreditCard className="h-3.5 w-3.5" />}
                      options={accounts.filter((a) => a.id !== accountId)}
                      value={toAccountId ?? ''}
                      onChange={(val) => setValue('toAccountId', val)}
                    />
                    {errors.toAccountId && (
                      <span className="text-[10px] font-bold text-destructive ml-1">
                        {errors.toAccountId.message}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Select
                      label={t('form.categoryLabel')}
                      icon={<Tag className="h-3.5 w-3.5" />}
                      options={filteredCategories}
                      value={categoryId ?? ''}
                      onChange={(val) => setValue('categoryId', val)}
                      layout="grid"
                      panelTitle={t('form.categoryPanelTitle')}
                    />
                    {errors.categoryId && (
                      <span className="text-[10px] font-bold text-destructive ml-1">
                        {errors.categoryId.message}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">
                  <AlignLeft className="h-3.5 w-3.5" />
                  {t('form.descriptionLabel')}
                </div>
                <textarea
                  rows={3}
                  placeholder={t('form.descriptionPlaceholder')}
                  className="w-full rounded-[var(--radius-md)] border border-white/5 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-white/10 shadow-soft-md outline-none transition-all hover:border-white/20 focus:border-accent/40"
                  {...register('description')}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">
                <Paperclip className="h-3.5 w-3.5" />
                {t('form.attachmentLabel')}
              </div>
              <FileUpload onFileSelect={setSelectedFile} className="h-full min-h-[160px]" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 bg-white/5 p-4 lg:px-8 lg:py-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 sm:flex-none">
                  {t('form.discard')}
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none relative group pr-10">
                {isSubmitting ? t('form.processing') : t('form.save')}
                <ChevronRight className="absolute right-3 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
