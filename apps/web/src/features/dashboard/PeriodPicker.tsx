import { Fragment, useEffect, useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { CalendarDays, ChevronDown, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { twMerge } from 'tailwind-merge';
import {
  chartPeriodLabel,
  periodFromShortcut,
  primaryMonthFromPeriod,
  type PeriodShortcutKind,
} from './periodUtils';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@shared/hooks/useDateFnsLocale';
import { DateRangePicker } from '@shared/ui/date-range-picker';

interface DateRange {
  start: string;
  end: string;
}

interface PeriodPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** `single`: um mês (dashboard). `multiple`: alternar vários meses. */
  selectionMode?: 'single' | 'multiple';
  /** Habilita o toggle "Por mês" | "Por intervalo" (default: desabilitado). */
  enableRange?: boolean;
  mode?: 'month' | 'range';
  onModeChange?: (mode: 'month' | 'range') => void;
  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

type ShortcutDef = {
  kind: PeriodShortcutKind;
  label: string;
  circleLabel?: string;
  ariaKeyMultiple: string;
  ariaKeySingle: string;
};

const SHORTCUTS: ShortcutDef[] = [
  { kind: 'minus6', label: '−6', ariaKeyMultiple: 'period.shortcuts.minus6Multi', ariaKeySingle: 'period.shortcuts.minus6Single' },
  { kind: 'minus3', label: '−3', ariaKeyMultiple: 'period.shortcuts.minus3Multi', ariaKeySingle: 'period.shortcuts.minus3Single' },
  { kind: 'minus1', label: '−1', ariaKeyMultiple: 'period.shortcuts.minus1Multi', ariaKeySingle: 'period.shortcuts.minus1Single' },
  { kind: 'current', label: '', circleLabel: '', ariaKeyMultiple: 'period.shortcuts.currentMulti', ariaKeySingle: 'period.shortcuts.currentSingle' },
  { kind: 'plus1', label: '+1', ariaKeyMultiple: 'period.shortcuts.plus1Multi', ariaKeySingle: 'period.shortcuts.plus1Single' },
  { kind: 'plus3', label: '+3', ariaKeyMultiple: 'period.shortcuts.plus3Multi', ariaKeySingle: 'period.shortcuts.plus3Single' },
  { kind: 'plus6', label: '+6', ariaKeyMultiple: 'period.shortcuts.plus6Multi', ariaKeySingle: 'period.shortcuts.plus6Single' },
];

export const PeriodPicker = ({
  value,
  onChange,
  selectionMode = 'single',
  enableRange = false,
  mode = 'month',
  onModeChange,
  range,
  onRangeChange,
}: PeriodPickerProps) => {
  const { t } = useTranslation('dashboard');
  const dateFnsLocale = useDateFnsLocale();
  const isRangeMode = enableRange && mode === 'range';

  const selectedValues = useMemo(() => {
    if (!value) return [];
    return value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => /^\d{4}-\d{2}$/.test(v));
  }, [value]);

  const [viewYear, setViewYear] = useState(() => {
    const y = primaryMonthFromPeriod(value || format(new Date(), 'yyyy-MM')).slice(0, 4);
    return parseInt(y, 10);
  });

  useEffect(() => {
    const base = primaryMonthFromPeriod(value || format(new Date(), 'yyyy-MM'));
    setViewYear(parseInt(base.slice(0, 4), 10));
  }, [value]);

  const monthCells = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const ym = `${viewYear}-${m}`;
      const d = parse(`${ym}-01`, 'yyyy-MM-dd', new Date());
      return {
        value: ym,
        label: capitalize(format(d, 'LLL', { locale: dateFnsLocale })),
      };
    });
  }, [viewYear, dateFnsLocale]);

  const handleMonthClick = (optValue: string) => {
    if (selectionMode === 'single') {
      onChange(optValue);
      return;
    }
    let newSelected: string[];
    if (selectedValues.includes(optValue)) {
      newSelected = selectedValues.filter((v) => v !== optValue);
    } else {
      newSelected = [...selectedValues, optValue];
    }
    newSelected.sort((a, b) => a.localeCompare(b));
    if (newSelected.length === 0) {
      newSelected = [format(new Date(), 'yyyy-MM')];
    }
    onChange(newSelected.join(','));
  };

  const applyShortcut = (kind: PeriodShortcutKind, close: () => void) => {
    const todayYm = format(new Date(), 'yyyy-MM');
    const anchor = value || todayYm;
    const next = periodFromShortcut(kind, selectionMode, anchor, todayYm);
    onChange(next);
    const primary = primaryMonthFromPeriod(next);
    setViewYear(parseInt(primary.slice(0, 4), 10));
    if (selectionMode === 'single') close();
  };

  const displayLabel = useMemo(() => {
    if (isRangeMode && range) {
      return `${format(new Date(range.start), 'dd/MM/yyyy')} – ${format(
        new Date(range.end),
        'dd/MM/yyyy',
      )}`;
    }
    if (selectedValues.length === 0) return t('period.select');
    if (selectedValues.length === 1) {
      const primary = primaryMonthFromPeriod(selectedValues[0]);
      const d = parse(`${primary}-01`, 'yyyy-MM-dd', new Date());
      return capitalize(format(d, "MMMM 'de' yyyy", { locale: dateFnsLocale }));
    }
    return chartPeriodLabel(value);
  }, [selectedValues, value, t, dateFnsLocale, isRangeMode, range]);

  return (
    <Popover className="relative">
      {({ open, close }) => (
        <>
          <PopoverButton
            className={twMerge(
              'inline-flex items-center gap-2 rounded-full border bg-slate-950/40 pl-3 pr-2 py-1.5 text-xs text-muted-foreground shadow-soft-md transition-colors hover:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-sky-500/50',
              open ? 'border-sky-500/50 ring-2 ring-sky-500/20' : 'border-white/15',
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
              <CalendarDays className="h-4 w-4" />
            </span>
            <span className="min-w-[100px] text-left font-medium text-foreground">{displayLabel}</span>
            <ChevronDown className="h-4 w-4 text-white/40" />
          </PopoverButton>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel
              portal
              anchor={{ to: 'bottom start', gap: 8 }}
              transition
              className="z-[100] flex w-[min(100vw-1rem,348px)] min-w-[300px] flex-col overflow-visible rounded-xl border border-white/10 bg-slate-900/95 p-2 shadow-xl backdrop-blur-md sm:w-[348px]"
            >
              {enableRange && (
                <div className="mb-2 flex rounded-lg bg-slate-800/60 p-1">
                  <button
                    type="button"
                    onClick={() => onModeChange?.('month')}
                    className={twMerge(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                      mode === 'month'
                        ? 'bg-sky-500/25 text-sky-200 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200',
                    )}
                  >
                    {t('filters.byMonth')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange?.('range')}
                    className={twMerge(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                      mode === 'range'
                        ? 'bg-sky-500/25 text-sky-200 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200',
                    )}
                  >
                    {t('filters.byRange')}
                  </button>
                </div>
              )}
              {isRangeMode && range ? (
                <DateRangePicker
                  start={range.start}
                  end={range.end}
                  onChange={(next) => onRangeChange?.(next)}
                />
              ) : (
                <>
              <div className="grid grid-cols-4 gap-1.5">
                {monthCells.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        handleMonthClick(opt.value);
                        if (selectionMode === 'single') close();
                      }}
                      className={twMerge(
                        'relative flex min-h-[2.75rem] min-w-0 flex-col items-center justify-center rounded-lg px-1 py-2 text-xs font-semibold leading-tight transition-all sm:min-h-12',
                        isSelected
                          ? 'bg-sky-500/25 text-sky-200 shadow-sm ring-1 ring-sky-500/50'
                          : 'bg-slate-800/60 text-slate-200 hover:bg-slate-700 hover:text-white',
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="absolute right-1 top-1 h-3 w-3 opacity-90" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                <div className="flex items-center justify-center gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y - 1)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                    aria-label={t('period.prevYear')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-slate-200">
                    {viewYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y + 1)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                    aria-label={t('period.nextYear')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="grid w-full grid-cols-7 gap-1"
                  role="group"
                  aria-label={t('period.rangeShortcuts')}
                >
                  {SHORTCUTS.map((s) => {
                    const ariaKey = selectionMode === 'multiple' ? s.ariaKeyMultiple : s.ariaKeySingle;
                    const displayLabel = s.kind === 'current'
                      ? t('period.currentShort')
                      : s.label;
                    const titleLabel = s.kind === 'current'
                      ? t('period.current')
                      : s.label;
                    return (
                      <div key={s.kind} className="flex min-w-0 justify-center">
                        <button
                          type="button"
                          title={titleLabel}
                          onClick={() => applyShortcut(s.kind, close)}
                          aria-label={t(ariaKey)}
                          className="inline-flex aspect-square w-full max-h-10 max-w-10 min-w-0 items-center justify-center rounded-full border border-white/10 bg-slate-800/35 text-[10px] font-semibold tabular-nums leading-none text-slate-300 transition-colors hover:border-sky-500/30 hover:bg-slate-700/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45 sm:text-xs"
                        >
                          {displayLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
                </>
              )}
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};
