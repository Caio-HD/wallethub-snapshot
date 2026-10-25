import { useMemo, useState } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { normCompe, type Bank } from './useBanks';

type Props = {
  banks: Bank[];
  /** COMPE normalizado (mesmo formato do bankId da conta). Vazio = nenhum. */
  value: string;
  onChange: (compe: string) => void;
  placeholder?: string;
  className?: string;
};

/** Remove acentos e baixa caixa para busca tolerante. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Apelidos comerciais → COMPE. O catálogo Bacen usa a razão social (ex.: Nubank =
 * "NU PAGAMENTOS S.A."), então buscar pelo nome popular não casa sem este mapa.
 */
const BANK_ALIASES: Record<string, string> = {
  nubank: '260',
  nu: '260',
  roxinho: '260',
  inter: '077',
  'banco inter': '077',
  c6: '336',
  'c6 bank': '336',
  picpay: '380',
  pagbank: '290',
  pagseguro: '290',
  'mercado pago': '323',
  mercadopago: '323',
  bmg: '318',
  safra: '422',
  sicoob: '756',
  sicredi: '748',
  bb: '001',
  'banco do brasil': '001',
  caixa: '104',
  cef: '104',
  bradesco: '237',
  itau: '341',
  santander: '033',
  pan: '623',
  'banco pan': '623',
};

/**
 * Autocomplete de bancos (COMPE). Filtra por código, nome/nome curto ou apelido
 * comercial; emite o COMPE normalizado para casar com o bankId armazenado na conta.
 */
export const BankCombobox = ({ banks, value, onChange, placeholder, className }: Props) => {
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => banks.find((b) => normCompe(b.compeCode) === value) ?? null,
    [banks, value],
  );

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return banks.slice(0, 50);
    const digits = q.replace(/\D/g, '');
    // COMPEs apontados por apelidos que casam com a busca (ex.: "nubank" → 260).
    const aliasCompes = new Set(
      Object.entries(BANK_ALIASES)
        .filter(([alias]) => fold(alias).includes(q) || q.includes(fold(alias)))
        .map(([, compe]) => normCompe(compe)),
    );
    return banks
      .filter(
        (b) =>
          fold(b.name).includes(q) ||
          fold(b.shortName ?? '').includes(q) ||
          (digits.length > 0 && b.compeCode.includes(digits)) ||
          aliasCompes.has(normCompe(b.compeCode)),
      )
      .slice(0, 50);
  }, [banks, query]);

  return (
    <Combobox
      immediate
      value={selected}
      onChange={(b: Bank | null) => onChange(b ? normCompe(b.compeCode) : '')}
      onClose={() => setQuery('')}
    >
      <div className={cn('relative', className)}>
        <ComboboxInput
          className="h-10 w-full rounded-full border border-sky-500/20 bg-slate-900/40 px-4 pr-9 text-sm outline-none focus:border-sky-500/50"
          placeholder={placeholder ?? 'Buscar banco por nome ou código…'}
          autoComplete="off"
          displayValue={(b: Bank | null) => (b ? `${b.compeCode} — ${b.name}` : '')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
          <ChevronsUpDown className="h-4 w-4" />
        </ComboboxButton>
        <ComboboxOptions className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-white/10 bg-slate-900/95 p-1 text-sm shadow-2xl backdrop-blur-xl empty:hidden">
          {filtered.map((b) => (
            <ComboboxOption
              key={b.id}
              value={b}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 data-[focus]:bg-sky-500/15"
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-sky-400 opacity-0 data-[selected]:opacity-100" />
              <span className="font-mono text-[11px] text-sky-300/90">{b.compeCode}</span>
              <span className="truncate">{b.name}</span>
            </ComboboxOption>
          ))}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">Nenhum banco encontrado.</div>
          ) : null}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
};
