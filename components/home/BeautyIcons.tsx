import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const WINE = "#410016";
const ROSE = "#CA9BAA";
const ROSE_SOFT = "#F6E7EC";
const BORDER = "#E8DDD5";

export function DrySkinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <path
        d="M32 7C21 20 16 29 16 39c0 10.5 7.2 18 16 18s16-7.5 16-18C48 29 43 20 32 7Z"
        stroke={WINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M24 38h8l-5 6h8l-4 7" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 31c2 3 3 5 3 8" stroke={ROSE} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function OilySkinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <path
        d="M32 7C21 20 16 30 16 40c0 10 7.2 17 16 17s16-7 16-17C48 30 43 20 32 7Z"
        stroke={WINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M26 43c3 4 9 4 12 0" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 35c1.2-6 4.4-11 8-16" stroke={ROSE} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="43" cy="29" r="2.4" fill={ROSE} />
    </svg>
  );
}

export function CombinationSkinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <circle cx="32" cy="32" r="23" stroke={WINE} strokeWidth="3" />
      <path
        d="M32 10c0 12-8 15-8 27 0 8 4.2 14 8 17V10Z"
        fill={ROSE_SOFT}
        stroke={WINE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 10c0 12 8 15 8 27 0 8-4.2 14-8 17V10Z"
        fill={ROSE}
        opacity="0.65"
      />
      <path d="M32 10v44" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function SensitiveSkinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <path
        d="M32 7 49 14v14c0 13-7.2 22.5-17 29-9.8-6.5-17-16-17-29V14l17-7Z"
        stroke={WINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M32 39s-9-5.2-9-11.2c0-3.3 2.2-5.8 5.2-5.8 1.8 0 3.1.9 3.8 2.1.7-1.2 2-2.1 3.8-2.1 3 0 5.2 2.5 5.2 5.8C41 33.8 32 39 32 39Z"
        fill={ROSE}
      />
      <path d="M44 44c5-1 8-4 9-9-5 .4-8.7 3.3-9 9Z" stroke={WINE} strokeWidth="2.5" fill={ROSE_SOFT} />
    </svg>
  );
}

export function DehydratedOilyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <path
        d="M29 7C18.5 20 14 29 14 39c0 10.5 6.8 18 15 18s15-7.5 15-18C44 29 39.5 20 29 7Z"
        stroke={WINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M15 42c7 5 19 5 28 0" stroke={ROSE} strokeWidth="4" strokeLinecap="round" />
      <path
        d="M48 29c-4.5 5.5-6.5 9.5-6.5 14 0 5 3.4 8.5 7.5 8.5s7.5-3.5 7.5-8.5c0-4.5-2-8.5-6.5-14Z"
        stroke={WINE}
        strokeWidth="2.5"
        fill={ROSE_SOFT}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunscreenIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      <path d="M31 16h26l-4 55H35L31 16Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
      <path d="M32 16h24v8H32z" fill="#F7EFE7" stroke={BORDER} strokeWidth="1.5" />
      <path d="M36 71h16v8H36z" fill={ROSE} stroke={WINE} strokeWidth="2" />
      <circle cx="44" cy="38" r="5" stroke={WINE} strokeWidth="2" />
      <path d="M44 27v4M44 45v4M33 38h4M51 38h4M36 30l3 3M52 30l-3 3M36 46l3-3M52 46l-3-3" stroke={ROSE} strokeWidth="2" strokeLinecap="round" />
      <path d="M34 54h20" stroke={WINE} strokeWidth="2" strokeLinecap="round" />
      <path d="M37 60h14" stroke={ROSE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TonerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      <path d="M35 16h18v8H35z" fill={ROSE} stroke={WINE} strokeWidth="2" />
      <path d="M31 24h26l3 49c.3 4-2.7 7-6.5 7h-19c-3.8 0-6.8-3-6.5-7l3-49Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
      <path d="M34 28h20l2 42H32l2-42Z" fill={ROSE_SOFT} opacity="0.85" />
      <path d="M36 46h16M38 53h12" stroke={WINE} strokeWidth="2" strokeLinecap="round" />
      <path d="M39 60h10" stroke={ROSE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LotionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      <path d="M42 12h14c5 0 8 3 8 8v3" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M38 20h17v8H38z" fill={ROSE} stroke={WINE} strokeWidth="2" />
      <path d="M29 28h30v45c0 4-3 7-7 7H36c-4 0-7-3-7-7V28Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
      <path d="M34 34h20v36H34z" fill="#F7EFE7" />
      <path d="M36 50h16M38 57h12" stroke={WINE} strokeWidth="2" strokeLinecap="round" />
      <path d="M40 64h8" stroke={ROSE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CreamIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      <path d="M25 34h38v10H25z" fill={ROSE} stroke={WINE} strokeWidth="2.5" />
      <path d="M28 44h32l-3 28c-.4 4-3.3 7-7 7H38c-3.7 0-6.6-3-7-7l-3-28Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
      <path d="M32 50h24l-2 18H34l-2-18Z" fill={ROSE_SOFT} />
      <path d="M37 59h14M39 66h10" stroke={WINE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SerumIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      <path d="M38 14h12v13H38z" fill={ROSE} stroke={WINE} strokeWidth="2" />
      <path d="M35 27h18v8H35z" fill={ROSE_SOFT} stroke={WINE} strokeWidth="2" />
      <path d="M31 35h26l3 37c.4 4-2.8 8-7 8H35c-4.2 0-7.4-4-7-8l3-37Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
      <path d="M33 50h22l1.5 18h-25L33 50Z" fill={ROSE_SOFT} />
      <path d="M37 56h14M39 63h10" stroke={WINE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CleansingIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      <path d="M39 13h17c5 0 8 3 8 8v4" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 22h18v8H36z" fill={ROSE} stroke={WINE} strokeWidth="2" />
      <path d="M28 30h32v43c0 4-3 7-7 7H35c-4 0-7-3-7-7V30Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
      <path d="M32 38h24v30H32z" fill={ROSE_SOFT} />
      <circle cx="41" cy="54" r="4" stroke={WINE} strokeWidth="2" />
      <circle cx="51" cy="48" r="2" fill={ROSE} />
      <circle cx="35" cy="48" r="2" fill={ROSE} />
    </svg>
  );
}

export function MaskIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      <path d="M26 16h36v60H26z" fill={ROSE_SOFT} stroke={WINE} strokeWidth="2.5" rx="4" />
      <path d="M31 22h26v36H31z" fill="#FFFDF9" opacity="0.5" />
      <path d="M34 36h20M36 43h16" stroke={WINE} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M48 55c10 1 16 7 16 15-3 4-8 7-16 7s-13-3-16-7c0-8 6-14 16-15Z"
        fill="#FFFDF9"
        stroke={WINE}
        strokeWidth="2"
      />
      <circle cx="43" cy="66" r="1.8" fill={ROSE} />
      <circle cx="53" cy="66" r="1.8" fill={ROSE} />
      <path d="M44 72c2.5 1.5 5.5 1.5 8 0" stroke={ROSE} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MoreGridIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" {...props}>
      {[24, 48].map((x) =>
        [24, 48].map((y) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="16"
            height="16"
            rx="5"
            fill={ROSE_SOFT}
            stroke={WINE}
            strokeWidth="2.5"
          />
        )),
      )}
    </svg>
  );
}
