import { Fragment, useMemo } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown, Wallet } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';
import { useAccounts } from '@features/accounts/useAccounts';

interface AccountFilterProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

const ALL_ACCOUNTS = '__all__';

export const AccountFilter = ({ value, onChange }: AccountFilterProps) => {
  const { t } = useTranslation('dashboard');
  const { accounts } = useAccounts();

  const selectedLabel = useMemo(() => {
    if (!value) return t('filters.allAccounts');
    return accounts.find((a) => a.id === value)?.name ?? t('filters.allAccounts');
  }, [value, accounts, t]);

  return (
    <Listbox
      value={value ?? ALL_ACCOUNTS}
      onChange={(next: string) => onChange(next === ALL_ACCOUNTS ? undefined : next)}
    >
      <div className="relative">
        <Listbox.Button
          className={twMerge(
            'inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/40 pl-3 pr-2 py-1.5 text-xs text-muted-foreground shadow-soft-md transition-colors hover:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ui-open:border-sky-500/50 ui-open:ring-2 ui-open:ring-sky-500/20',
          )}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="min-w-[100px] text-left font-medium text-foreground">
            {selectedLabel}
          </span>
          <ChevronDown className="h-4 w-4 text-white/40" />
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-[100] mt-2 max-h-72 w-64 overflow-auto custom-scrollbar rounded-xl border border-white/10 bg-slate-900/95 p-2 shadow-xl backdrop-blur-md focus:outline-none">
            {[{ id: ALL_ACCOUNTS, name: t('filters.allAccounts') }, ...accounts].map(
              (option) => (
                <Listbox.Option
                  key={option.id}
                  value={option.id}
                  className={({ active, selected }) =>
                    twMerge(
                      'relative flex h-10 cursor-pointer select-none items-center rounded-lg px-3 pr-8 text-sm font-medium transition-colors',
                      active ? 'bg-white/10 text-foreground' : 'text-slate-200',
                      selected && 'text-sky-300',
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className="block truncate">{option.name}</span>
                      {selected && (
                        <Check className="absolute right-2 h-4 w-4 text-sky-300" />
                      )}
                    </>
                  )}
                </Listbox.Option>
              ),
            )}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};
