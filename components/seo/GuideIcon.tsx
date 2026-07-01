import type { SVGProps } from 'react';

// Mauve line-art icons for the /best hub cards. All use stroke="currentColor",
// so the color is set by the parent (grid = mauve, 올리브영 밴드 = green, 하단 chip = gray).
// Product-category shapes + concern/ingredient concept shapes, matched to the
// existing docs/category_icon illustration language (thin line, product silhouette).

export type GuideIconName =
  | 'tube' | 'bottle' | 'dropper' | 'jar' | 'compact' | 'foundation'
  | 'pad' | 'foam' | 'oil' | 'pump' | 'mask' | 'device'
  | 'soothing' | 'pdrn' | 'acne' | 'blackhead' | 'men' | 'hydra';

const PATHS: Record<GuideIconName, React.ReactNode> = {
  // ── Product categories ──────────────────────────────────────────────
  tube: (
    <>
      <path d="M15 13h10v16a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 15 29z" />
      <path d="M15 13l1-3h8l1 3" />
      <path d="M15 17.5h10" />
      <circle cx="20" cy="22.5" r="2" />
      <path d="M20 18.5v-1M20 26.5v1M15.5 22.5h-1M25.5 22.5h-1" />
    </>
  ),
  bottle: (
    <>
      <rect x="16" y="8" width="8" height="4" rx="1" />
      <path d="M15.5 12h9v17a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z" />
      <path d="M18 20.5h4" />
    </>
  ),
  dropper: (
    <>
      <rect x="15" y="15" width="10" height="17" rx="2.5" />
      <rect x="17.5" y="8" width="5" height="7" rx="1" />
      <path d="M20 18v8.5" />
    </>
  ),
  jar: (
    <>
      <ellipse cx="20" cy="15" rx="7.5" ry="2.5" />
      <path d="M12.5 15v9a7.5 2.5 0 0 0 15 0v-9" />
      <path d="M12.5 19a7.5 2.5 0 0 0 15 0" />
    </>
  ),
  compact: (
    <>
      <circle cx="20" cy="20" r="9.5" />
      <circle cx="20" cy="20" r="5" />
    </>
  ),
  foundation: (
    <>
      <rect x="15" y="15" width="10" height="17" rx="2" />
      <rect x="18" y="8" width="4" height="4" rx="1" />
      <path d="M22 10h3" />
      <path d="M18 20h4" />
    </>
  ),
  pad: (
    <>
      <ellipse cx="20" cy="13" rx="8" ry="2.5" />
      <path d="M12 13v11a8 3 0 0 0 16 0V13" />
      <ellipse cx="20" cy="24" rx="4" ry="1.3" />
    </>
  ),
  foam: (
    <>
      <rect x="15" y="16" width="10" height="16" rx="2" />
      <rect x="18" y="9" width="4" height="5" rx="1" />
      <path d="M22 11h3v2" />
      <circle cx="27.5" cy="16" r="1" />
      <circle cx="29.5" cy="19" r="0.8" />
    </>
  ),
  oil: (
    <>
      <rect x="15" y="14" width="10" height="18" rx="2" />
      <rect x="18" y="8" width="4" height="6" rx="1" />
      <path d="M20 22c-1.5 2-1.5 3.5 0 3.5s1.5-1.5 0-3.5z" />
    </>
  ),
  pump: (
    <>
      <path d="M15 15h10v15a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2z" />
      <rect x="18.5" y="8" width="3" height="5" rx="1" />
      <path d="M20 9h4v2" />
      <path d="M18 20h4" />
    </>
  ),
  mask: (
    <>
      <path d="M14 11h12a1 1 0 0 1 1 1v6c0 7-3.5 12-7 12s-7-5-7-12v-6a1 1 0 0 1 1-1z" />
      <path d="M16.5 18h3M20.5 18h3" />
      <path d="M18 24h4" />
    </>
  ),
  device: (
    <>
      <circle cx="20" cy="14" r="5" />
      <rect x="16" y="18" width="8" height="14" rx="3" />
    </>
  ),
  // ── Concern / ingredient concepts ──────────────────────────────────
  soothing: (
    <>
      <path d="M20 8C13 14 12 25 20 32 28 25 27 14 20 8z" />
      <path d="M20 12v18" />
      <path d="M20 18l-4.5-3M20 18l4.5-3M20 24l-4.5-3M20 24l4.5-3" />
    </>
  ),
  pdrn: (
    <>
      <path d="M14 8c0 7 12 7 12 12s-12 5-12 12" />
      <path d="M26 8c0 7-12 7-12 12s12 5 12 12" />
      <path d="M16 12h8M17 20h6M16 28h8" />
    </>
  ),
  acne: (
    <>
      <circle cx="20" cy="20" r="10" />
      <circle cx="20" cy="20" r="6.5" strokeDasharray="1.5 2.2" />
    </>
  ),
  blackhead: (
    <>
      <circle cx="18" cy="18" r="8" />
      <path d="M24 24l7 7" />
      <circle cx="16" cy="17" r="1" />
      <circle cx="20" cy="16" r="1" />
      <circle cx="18" cy="20.5" r="1" />
    </>
  ),
  men: (
    <>
      <path d="M13 12h14v4a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1z" />
      <path d="M14.5 17v1.5M17.5 17v1.5M20 17v1.5M22.5 17v1.5M25.5 17v1.5" />
      <rect x="18" y="19" width="4" height="13" rx="1.5" />
    </>
  ),
  hydra: (
    <>
      <path d="M20 8C13 18 11 25 20 32 29 25 27 18 20 8z" />
      <path d="M16 24a4 4 0 0 0 4 4" />
    </>
  ),
};

interface GuideIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: GuideIconName;
}

export function GuideIcon({ name, ...props }: GuideIconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name] ?? PATHS.bottle}
    </svg>
  );
}

// ── slug/category → icon mapping ──────────────────────────────────────
const CATEGORY_ICON: Record<string, GuideIconName> = {
  sunscreen: 'tube', suncare: 'tube', sunstick: 'tube', suncushion: 'tube',
  toner: 'bottle', lotion: 'bottle',
  serum: 'dropper', ampoule: 'dropper', skincare: 'dropper',
  cream: 'jar',
  cushion: 'compact', 'base-makeup': 'compact',
  foundation: 'foundation',
  pad: 'pad',
  cleansing: 'foam', 'cleansing-foam': 'foam', 'cleansing-care': 'foam',
  'cleansing-oil': 'oil', 'cleansing-water': 'oil',
  bodywash: 'pump', 'body-lotion': 'pump', bodycare: 'pump', shower: 'pump',
  'sheet-mask': 'mask', maskpack: 'mask',
  allinone: 'pump',
  device: 'device',
};

const KEYWORD_ICON: Array<[RegExp, GuideIconName]> = [
  [/pdrn/, 'pdrn'],
  [/blackhead/, 'blackhead'],
  [/acne/, 'acne'],
  [/soothing/, 'soothing'],
  [/hydra/, 'hydra'],
  [/men/, 'men'],
];

/** Pick the icon for a hub card from its page_type / slug / category. */
export function guideIconName(page: { slug: string; category?: string | null; page_type?: string | null }): GuideIconName {
  if ((page.page_type || '') === 'keyword') {
    for (const [re, name] of KEYWORD_ICON) if (re.test(page.slug)) return name;
  }
  if (page.category && CATEGORY_ICON[page.category]) return CATEGORY_ICON[page.category];
  return 'bottle';
}
