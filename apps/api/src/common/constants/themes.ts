export const SUPPORTED_THEMES = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof SUPPORTED_THEMES)[number];
