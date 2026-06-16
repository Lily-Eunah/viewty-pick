import React from 'react';

interface CosmeticPlaceholderIconProps {
  alt: string;
  className?: string;
}

/**
 * Single, clean 1:1 product placeholder. Fills its (square) container so cards keep
 * a uniform height whether or not a photo exists — no category-specific variants.
 */
export default function CosmeticPlaceholderIcon({ alt, className = '' }: CosmeticPlaceholderIconProps) {
  const WINE = '#410016';
  const ROSE = '#CA9BAA';
  const ROSE_SOFT = '#F6E7EC';
  return (
    <div
      className={`relative flex items-center justify-center select-none overflow-hidden ${className}`}
      style={{ backgroundColor: '#FBF7F1' }}
      role="img"
      aria-label={alt}
    >
      <div className="absolute w-[120%] h-[120%] rounded-full bg-[#CA9BAA] opacity-10 -top-[20%] -left-[20%]" />
      <svg viewBox="0 0 64 64" className="w-[42%] h-[42%] relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 8h8v12h-8V8Z" fill={ROSE} stroke={WINE} strokeWidth="1.5" />
        <path d="M26 20h12v6H26v-6Z" fill={ROSE_SOFT} stroke={WINE} strokeWidth="1.5" />
        <path d="M22 26h20l2 28H20l2-28Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
        <path d="M24 38h16" stroke={WINE} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="32" cy="45" r="3" fill={ROSE} />
      </svg>
    </div>
  );
}
