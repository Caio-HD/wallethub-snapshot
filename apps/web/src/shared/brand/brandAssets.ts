export interface BrandMarkConfig {
  src: string;
  width: number;
  height: number;
  display: number;
}

export const BRAND_MARK_SIZES: Record<'sm' | 'md' | 'lg', BrandMarkConfig> = {
  sm: { src: '/brand/mark-128.png', width: 128, height: 128, display: 36 },
  md: { src: '/brand/mark-256.png', width: 256, height: 256, display: 44 },
  lg: { src: '/brand/mark-256.png', width: 256, height: 256, display: 56 },
};

export const BRAND_FULL = {
  webp: '/brand/logo-full.webp',
  png: '/brand/logo-full.png',
  webpDark: '/brand/logo-full-dark.webp',
  pngDark: '/brand/logo-full-dark.png',
  aspectRatio: 8.865,
  maxDisplayWidth: 220,
} as const;

/** Brand colours (mirror of `brand/source/mark.svg` + the wordmark accent). */
export const BRAND_COLORS = {
  gradientFrom: '#2F6BFF',
  gradientTo: '#22D3EE',
  accent: '#22D3EE',
} as const;
