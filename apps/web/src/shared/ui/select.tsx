import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../utils/cn';

interface Option {
  id: string;
  name: string;
}

interface SelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  layout?: 'list' | 'grid';
  panelTitle?: string;
}

export const Select = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  label,
  icon,
  className,
  layout = 'list',
  panelTitle,
}: SelectProps) => {
  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pl-1">
          {icon}
          {label}
        </div>
      )}
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button
            className={cn(
              'relative h-11 w-full cursor-pointer rounded-full border border-sky-500/20 bg-slate-900/40 pl-4 pr-10 text-left text-sm shadow-soft-md transition-all duration-200 outline-none hover:border-sky-500/40 focus:border-sky-500/50 ring-offset-slate-950 focus:ring-2 focus:ring-sky-500/20',
              !selectedOption && 'text-muted-foreground'
            )}
          >
            <span className="block truncate font-semibold">
              {selectedOption ? selectedOption.name : placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronDown className="h-4 w-4 text-sky-400 transition-transform duration-200 ui-open:rotate-180" aria-hidden="true" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className={cn(
               "absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl focus:outline-none",
               layout === 'grid' ? "w-[320px]" : "w-full"
            )}>
              {panelTitle && (
                <div className="mb-3 px-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  {panelTitle}
                </div>
              )}
              <div className={cn(
                "max-height-60 overflow-auto custom-scrollbar",
                layout === 'grid' ? "grid grid-cols-2 gap-2" : "flex flex-col gap-1"
              )}>
                {options.length === 0 ? (
                  <div className="relative cursor-default select-none px-4 py-2 text-muted-foreground text-center col-span-2">
                    Nenhuma opção encontrada
                  </div>
                ) : (
                  options.map((option) => (
                    <Listbox.Option
                      key={option.id}
                      className={({ active, selected }) =>
                        cn(
                          'relative cursor-pointer select-none transition-all duration-200',
                          layout === 'grid' 
                            ? 'flex h-10 items-center justify-center rounded-full border border-white/5 bg-white/5 text-xs font-bold' 
                            : 'flex h-10 items-center justify-start rounded-xl px-4 text-sm font-medium',
                          active && 'bg-white/10 border-white/10 text-foreground scale-[1.02]',
                          selected && (layout === 'grid' 
                            ? 'bg-sky-500/20 border-sky-500/30 text-sky-400' 
                            : 'bg-accent/20 text-accent font-semibold')
                        )
                      }
                      value={option.id}
                    >
                      {({ selected }) => (
                        <>
                          <span className="block truncate">{option.name}</span>
                          {selected && layout === 'list' && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-accent">
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))
                )}
              </div>
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};
