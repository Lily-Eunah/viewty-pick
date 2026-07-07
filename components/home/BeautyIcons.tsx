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
// ─── Image-based Category Icons (using background-removed PNGs) ────────────────

export function SuncareImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/suncare.png"
      alt="선케어"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

export function SkincareImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/skincare.png"
      alt="스킨케어"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

export function CleansingCareImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/cleansing-care.png"
      alt="클렌징"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

export function MaskpackImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/maskpack.png"
      alt="마스크팩"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

export function BodycareImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/bodycare.png"
      alt="바디케어"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

export function BaseMakeupImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/base-makeup.png"
      alt="베이스 메이크업"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

export function HaircareImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/haircare.png"
      alt="헤어케어"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

export function FeminineHygieneImageIcon({ className, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return (
    <img
      src="/images/categories/feminine-hygiene.png"
      alt="위생용품"
      width={48}
      height={48}
      className={className}
      {...props}
    />
  );
}

