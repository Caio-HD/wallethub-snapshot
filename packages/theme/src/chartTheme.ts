import type { ResolvedTheme } from './constants.js';

export interface ChartTheme {
  gridColor: string;
  textColor: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
  colors: string[];
}

const LIGHT_CHART_THEME: ChartTheme = {
  gridColor: 'rgba(0,0,0,0.08)',
  textColor: '#374151',
  tooltipBackground: '#ffffff',
  tooltipBorder: '#e5e7eb',
  tooltipText: '#111827',
  colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
};

const DARK_CHART_THEME: ChartTheme = {
  gridColor: 'rgba(255,255,255,0.08)',
  textColor: '#9ca3af',
  tooltipBackground: '#1e293b',
  tooltipBorder: '#334155',
  tooltipText: '#f1f5f9',
  colors: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'],
};

export function chartThemeFor(resolved: ResolvedTheme): ChartTheme {
  return resolved === 'dark' ? DARK_CHART_THEME : LIGHT_CHART_THEME;
}
