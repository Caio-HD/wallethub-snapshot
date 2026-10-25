import { useMemo, Fragment, useState, useEffect, useRef } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  startOfWeek, 
  endOfWeek,
  parse,
  isValid,
  isToday,
  subDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../utils/cn';

interface DatePickerProps {
  value: string; // ISO format YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hasShortcuts?: boolean;
}

export const DatePicker = ({ 
  value, 
  onChange, 
  placeholder = 'DD/MM/AAAA', 
  className,
  hasShortcuts = true 
}: DatePickerProps) => {
  const [inputValue, setInputValue] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input with value prop (ISO -> BR)
  useEffect(() => {
    if (value) {
      const date = new Date(value + 'T12:00:00'); // Prevent timezone shift
      if (isValid(date)) {
        setInputValue(format(date, 'dd/MM/yyyy'));
        setCurrentMonth(date);
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    // Auto-mask DD/MM/AAAA
    if (val.length > 2 && val.length <= 4) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    } else if (val.length > 4) {
      val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    }
    
    setInputValue(val);

    // If full date, try to propagate to parent
    if (val.length === 10) {
      const parsed = parse(val, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        onChange(format(parsed, 'yyyy-MM-dd'));
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    const iso = format(date, 'yyyy-MM-dd');
    onChange(iso);
    setInputValue(format(date, 'dd/MM/yyyy'));
  };

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <Popover className={cn('relative w-full', className)}>
      {({ open, close }) => (
        <>
          <div className="relative group">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              className={cn(
                'flex h-11 w-full rounded-[var(--radius-md)] border border-white/10 bg-white/5 pl-10 pr-4 text-sm font-semibold transition-all duration-200 outline-none',
                'hover:border-sky-500/30 group-focus-within:border-sky-500/50 group-focus-within:ring-2 group-focus-within:ring-sky-500/10 text-white placeholder:text-white/20',
                open && 'border-sky-500/50 ring-2 ring-sky-500/10'
              )}
            />
            <Popover.Button className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 group-hover:text-white transition-colors">
              <CalendarDays className="h-4.5 w-4.5" />
            </Popover.Button>
          </div>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Popover.Panel 
              anchor={{ to: 'bottom start', gap: 8 }}
              className="z-[9999] w-80 rounded-2xl border border-white/20 bg-[#020617] p-5 shadow-2xl backdrop-blur-2xl focus:outline-none shadow-sky-500/10"
            >
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-sm font-black uppercase tracking-widest text-white leading-none">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentMonth(subMonths(currentMonth, 1)); }}
                      className="rounded-lg p-1.5 bg-white/5 hover:bg-sky-500 hover:text-white text-sky-400 transition-all active:scale-95"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentMonth(addMonths(currentMonth, 1)); }}
                      className="rounded-lg p-1.5 bg-white/5 hover:bg-sky-500 hover:text-white text-sky-400 transition-all active:scale-95"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div>
                  <div className="grid grid-cols-7 mb-3">
                    {weekDays.map((wd, i) => (
                      <span key={i} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                        {wd}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day, i) => {
                      const isSelected = value && isSameDay(day, new Date(value + 'T12:00:00'));
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDateSelect(day);
                            close();
                          }}
                          className={cn(
                            'flex h-8.5 w-8.5 items-center justify-center rounded-lg text-sm font-black transition-all duration-150',
                            !isCurrentMonth && 'text-white/5 pointer-events-none',
                            isCurrentMonth && 'text-white hover:bg-sky-500 hover:text-white hover:scale-105',
                            isSelected && 'bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)] scale-105 z-10',
                            isToday(day) && !isSelected && 'text-sky-400 ring-2 ring-inset ring-sky-500/40 bg-sky-500/5'
                          )}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shortcuts */}
                {hasShortcuts && (
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDateSelect(new Date()); close(); }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-sky-500 hover:text-white text-[11px] font-black uppercase tracking-widest text-white transition-all border border-white/5 active:scale-95"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDateSelect(subDays(new Date(), 1)); close(); }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-sky-500 hover:text-white text-[11px] font-black uppercase tracking-widest text-white transition-all border border-white/5 active:scale-95"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Ontem
                    </button>
                  </div>
                )}
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
};
