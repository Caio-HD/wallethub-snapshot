export function money2(value: number): string {
  return value.toFixed(2);
}

export function parseMoney(value: string | number): number {
  return typeof value === 'number' ? value : Number.parseFloat(value);
}

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
