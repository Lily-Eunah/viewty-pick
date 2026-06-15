import React from 'react';

interface CosmeticPlaceholderIconProps {
  alt: string;
  className?: string;
}

export default function CosmeticPlaceholderIcon({ alt, className = '' }: CosmeticPlaceholderIconProps) {
  const isSunscreen = alt.includes('선크림') || alt.includes('선세럼') || alt.includes('선스크린');
  const isToner = alt.includes('토너') || alt.includes('에센스');
  const isCream = alt.includes('크림') || alt.includes('젤');

  // Brand Palette Colors
  const WINE = "#410016";
  const ROSE = "#CA9BAA";
  const ROSE_SOFT = "#F6E7EC";
  const BG_COLOR = isSunscreen ? "#F7EFE7" : ROSE_SOFT; // Using #F7EFE7 or #F6E7EC as requested

  return (
    <div
      className={`relative flex items-center justify-center select-none overflow-hidden rounded-md border border-[#E8DDD5] ${className}`}
      style={{ backgroundColor: BG_COLOR }}
    >
      {/* Decorative background circles */}
      <div className="absolute w-[120%] h-[120%] rounded-full bg-[#CA9BAA] opacity-10 -top-[20%] -left-[20%]" />

      <div className="flex flex-col items-center justify-center relative z-10 transition-transform hover:scale-105 duration-300">
        {isSunscreen && (
          // Skincare Sunscreen Tube
          <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 14h20l-3 36H25L22 14Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
            <path d="M23 14h18v6H23v-6Z" fill="#F7EFE7" stroke={WINE} strokeWidth="1.5" />
            <path d="M26 50h12v5H26v-5Z" fill={ROSE} stroke={WINE} strokeWidth="1.5" />
            <circle cx="32" cy="28" r="4" stroke={WINE} strokeWidth="1.5" />
            <path d="M32 21v2M32 33v2M25 28h2M37 28h2" stroke={ROSE} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M25 40h14" stroke={WINE} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}

        {isToner && (
          // Skincare Tall Bottle
          <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M26 10h12v6H26v-6Z" fill={ROSE} stroke={WINE} strokeWidth="2.5" />
            <path d="M23 16h18l2 38H21l2-38Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
            <path d="M25 19h14l1.5 31H23.5L25 19Z" fill={ROSE_SOFT} opacity="0.85" />
            <path d="M27 30h10M29 36h6" stroke={WINE} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}

        {isCream && (
          // Skincare Cream Jar
          <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 26h32v8H16v-8Z" fill={ROSE} stroke={WINE} strokeWidth="2.5" />
            <path d="M18 34h28l-2.5 20h-23L18 34Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
            <path d="M22 39h20v10H22V39Z" fill={ROSE_SOFT} />
            <path d="M25 44h14" stroke={WINE} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}

        {!isSunscreen && !isToner && !isCream && (
          // Generic bottle/dropper
          <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M28 8h8v12h-8V8Z" fill={ROSE} stroke={WINE} strokeWidth="1.5" />
            <path d="M26 20h12v6H26v-6Z" fill={ROSE_SOFT} stroke={WINE} strokeWidth="1.5" />
            <path d="M22 26h20l2 28H20l2-28Z" fill="#FFFDF9" stroke={WINE} strokeWidth="2.5" />
            <path d="M24 38h16" stroke={WINE} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="32" cy="45" r="3" fill={ROSE} />
          </svg>
        )}
      </div>
    </div>
  );
}
