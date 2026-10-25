import { useId } from 'react';
import { cn } from '@shared/utils/cn';
import { BRAND_COLORS } from '@shared/brand/brandAssets';

type BrandLogoVariant = 'mark' | 'full';

interface BrandLogoProps {
  /** `mark` = symbol only; `full` = symbol + "WalletHub" wordmark. */
  variant?: BrandLogoVariant;
  /** Height of the symbol in pixels (the wordmark scales to match). */
  height?: number;
  className?: string;
  /** Accessible label. Empty string renders the logo as decorative. */
  title?: string;
}

/**
 * WalletHub logo, rendered as inline SVG (crisp at any size, no raster asset).
 * Source of truth for the mark geometry: `brand/source/mark.svg`.
 */
export function BrandMark({ height = 32, className, title = 'WalletHub' }: Omit<BrandLogoProps, 'variant'>) {
  const gradId = useId();
  const decorative = title === '';
  return (
    <svg
      viewBox="0 0 512 512"
      height={height}
      width={height}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
    >
      {!decorative && <title>{title}</title>}
      <defs>
        <linearGradient id={gradId} x1="126" y1="350" x2="396" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND_COLORS.gradientFrom} />
          <stop offset="1" stopColor={BRAND_COLORS.gradientTo} />
        </linearGradient>
      </defs>
      <path
        d="M126 176 L186 350 L256 236 L322 350 L392 158"
        stroke={`url(#${gradId})`}
        strokeWidth={44}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M344 166 L392 158 L400 206"
        stroke={BRAND_COLORS.accent}
        strokeWidth={44}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function BrandLogo({ variant = 'full', height = 32, className, title = 'WalletHub' }: BrandLogoProps) {
  if (variant === 'mark') {
    return <BrandMark height={height} className={className} title={title} />;
  }
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)} aria-label={title} role="img">
      <BrandMark height={height} title="" />
      <span
        className="font-bold tracking-tight leading-none"
        style={{ fontSize: Math.round(height * 0.82) }}
      >
        <span className="text-current">Wallet</span>
        <span style={{ color: BRAND_COLORS.accent }}>Hub</span>
      </span>
    </span>
  );
}
