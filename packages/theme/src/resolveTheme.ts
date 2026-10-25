import type { ThemePreference, ResolvedTheme } from './constants.js';
import { THEME_STORAGE_KEY } from './constants.js';

export function getSystemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia != null &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function readStoredPreference(storage: Storage | null): ThemePreference | null {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    return null;
  } catch {
    return null;
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return prefersDark ? 'dark' : 'light';
}

export interface ResolveInitialThemeContext {
  isAuthenticated: boolean;
  apiPreference?: ThemePreference | null;
  localPreference?: ThemePreference | null;
  prefersDark: boolean;
}

export function resolveInitialTheme(ctx: ResolveInitialThemeContext): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
} {
  const pref: ThemePreference =
    (ctx.isAuthenticated ? ctx.apiPreference : null) ??
    ctx.localPreference ??
    'system';
  return { preference: pref, resolved: resolveTheme(pref, ctx.prefersDark) };
}

export interface BootstrapThemeResult {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

export function bootstrapThemeContext(): BootstrapThemeResult {
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  const prefersDark = getSystemPrefersDark();
  const localPreference = readStoredPreference(storage);
  const preference: ThemePreference = localPreference ?? 'system';
  const resolved = resolveTheme(preference, prefersDark);
  return { preference, resolved };
}
