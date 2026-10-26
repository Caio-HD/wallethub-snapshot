import { Fragment } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { CalendarDays, ChevronDown, Clock } from 'lucide-react';
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';
import { cn } from '../utils/cn';
import { Button } from './button';
import { DatePicker } from './date-picker';

interface DateRangePickerProps {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  className?: string;
}

export const DateRangePicker = ({ start, end, onChange, className }: DateRangePickerProps) => {
  const label = `${format(new Date(start), 'dd/MM/yyyy')} - ${format(new Date(end), 'dd/MM/yyyy')}`;

  const setToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    onChange({ start: today, end: today });
  };

  const setCurrentMonth = () => {
    const s = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const e = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    onChange({ start: s, end: e });
  };

  const setLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1);
    const s = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
    const e = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
    onChange({ start: s, end: e });
  };

  const setLast7Days = () => {
    const today = new Date();
    const s = format(subDays(today, 7), 'yyyy-MM-dd');
    const e = format(today, 'yyyy-MM-dd');
    onChange({ start: s, end: e });
  };

  const setLast30Days = () => {
    const today = new Date();
    const s = format(subDays(today, 30), 'yyyy-MM-dd');
    const e = format(today, 'yyyy-MM-dd');
    onChange({ start: s, end: e });
  };

  return (
    <Popover className={cn('relative', className)}>
      {({ open }) => (
        <>
          <Popover.Button
            className={cn(
              'group flex h-11 items-center gap-3 rounded-[var(--radius-md)] border bg-background/60 pl-3 pr-4 text-sm shadow-soft-md transition-all duration-200 outline-none',
              open 
                ? 'border-sky-500/50 ring-2 ring-sky-500/20 bg-slate-900/40' 
                : 'border-input hover:border-sky-500/30 hover:bg-slate-900/20'
            )}
          >
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              open ? 'bg-sky-500 text-white' : 'bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20'
            )}>
              <CalendarDays className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">Período</span>
              <span className="font-semibold text-foreground tracking-tight">
                {label}
              </span>
            </div>
            <ChevronDown className={cn(
              'ml-1 h-4 w-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180 text-sky-400'
            )} />
          </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel 
              anchor={{ to: 'bottom end', gap: 12 }}
              className="z-[50] flex w-[480px] flex-col gap-5 rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl focus:outline-none"
            >
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Clock className="h-4 w-4 text-sky-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/70">Atalhos rápidos</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="ghost" size="sm" onClick={setToday} className="bg-white/5 hover:bg-sky-500 hover:text-white text-[10px] font-black h-9">
                    Hoje
                  </Button>
                  <Button variant="ghost" size="sm" onClick={setLast7Days} className="bg-white/5 hover:bg-sky-500 hover:text-white text-[10px] font-black h-9">
                    7 dias
                  </Button>
                  <Button variant="ghost" size="sm" onClick={setLast30Days} className="bg-white/5 hover:bg-sky-500 hover:text-white text-[10px] font-black h-9">
                    30 dias
                  </Button>
                  <Button variant="ghost" size="sm" onClick={setCurrentMonth} className="bg-white/5 hover:bg-sky-500 hover:text-white text-[10px] font-black h-9">
                    Este Mês
                  </Button>
                  <Button variant="ghost" size="sm" onClick={setLastMonth} className="bg-white/5 hover:bg-sky-500 hover:text-white text-[10px] font-black h-9">
                    Mês Passado
                  </Button>
                </div>

                <div className="flex items-center gap-2 border-b border-white/5 pb-3 pt-1">
                  <CalendarDays className="h-4 w-4 text-sky-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/70">Personalizado</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1">De</label>
                    <DatePicker
                      value={start}
                      onChange={(val: string) => onChange({ start: val, end })}
                      hasShortcuts={false}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1">Até</label>
                    <DatePicker
                      value={end}
                      onChange={(val: string) => onChange({ start, end: val })}
                      hasShortcuts={false}
                    />
                  </div>
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
};
