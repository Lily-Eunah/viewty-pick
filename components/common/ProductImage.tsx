import React from 'react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  brand?: string;
  className?: string;
}

export default function ProductImage({
  src,
  alt,
  brand = '',
  className = '',
}: ProductImageProps) {
  // If we have a valid source url, render the standard image (with fallback)
  // For MVP, we render the beautiful CSS skincare placeholder as requested!
  const hasImage = !!src && src.startsWith('http');

  if (hasImage) {
    return (
      <div className={`relative w-full aspect-square bg-[#F5F3EA] overflow-hidden ${className}`}>
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Draw a premium minimalist skincare bottle/tube vector using CSS
  const isSunscreen = alt.includes('선크림') || alt.includes('선세럼') || alt.includes('선스크린');
  const isToner = alt.includes('토너') || alt.includes('에센스');
  const isCream = alt.includes('크림');

  return (
    <div className={`w-full aspect-square bg-[#F5F3EA] flex flex-col justify-center items-center relative overflow-hidden select-none ${className}`}>
      {/* Decorative Grid or background circles */}
      <div className="absolute w-[140%] h-[140%] rounded-full bg-[#EAE8DD] opacity-20 -top-[30%] -left-[30%]" />
      
      {/* Container drawing */}
      <div className="flex flex-col items-center justify-center relative z-10 transition-transform hover:scale-105 duration-300">
        {isSunscreen && (
          // Skincare Sunscreen Tube
          <div className="w-[42px] h-[78px] relative flex flex-col items-center">
            {/* Cap */}
            <div className="w-[26px] h-[10px] bg-primary-dark rounded-t-sm shadow-sm" />
            {/* Neck */}
            <div className="w-[12px] h-[6px] bg-[#D4D2C5]" />
            {/* Tube Body */}
            <div className="w-[44px] h-[60px] bg-surface border border-[#E1DEC8] rounded-b-lg flex flex-col items-center justify-between py-2 px-1 relative shadow-sm">
              {/* Sun badge */}
              <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center text-[8px] font-black text-amber-900 shadow-inner">
                ☀️
              </div>
              <div className="text-[7px] text-[#A2A08E] font-black tracking-tighter truncate max-w-[36px]">
                SPF50+
              </div>
            </div>
          </div>
        )}

        {isToner && (
          // Skincare Tall Bottle
          <div className="w-[38px] h-[86px] relative flex flex-col items-center">
            {/* Silver Cap */}
            <div className="w-[22px] h-[14px] bg-[#CFCDC1] rounded-t-md border-b border-[#B8B6A9]" />
            {/* Neck */}
            <div className="w-[14px] h-[6px] bg-[#EAE8DD]" />
            {/* Translucent Bottle Body */}
            <div className="w-[36px] h-[64px] bg-[#FDFDFB] border border-[#E1DEC8] rounded-b-md flex flex-col items-center justify-center p-1 relative shadow-sm">
              <div className="w-1.5 h-[34px] bg-primary opacity-20 rounded-full absolute left-[6px]" />
              <div className="text-[8px] font-extrabold text-primary-dark tracking-tighter z-10">
                HYDRA
              </div>
              <div className="text-[6px] font-bold text-sub tracking-tighter mt-1 z-10">
                77%
              </div>
            </div>
          </div>
        )}

        {isCream && (
          // Skincare Round Jar/Cream Tub
          <div className="w-[52px] h-[58px] relative flex flex-col items-center justify-center mt-3">
            {/* Wide Lid */}
            <div className="w-[50px] h-[12px] bg-primary-dark rounded-t-md shadow-sm" />
            {/* Jar Body */}
            <div className="w-[48px] h-[34px] bg-surface border border-[#E1DEC8] rounded-b-xl flex flex-col items-center justify-center p-1 relative shadow-sm">
              <div className="w-8 h-1 bg-[#EAE8DD] rounded-full mt-0.5" />
              <div className="text-[7px] font-black text-[#A2A08E] tracking-tighter mt-1.5">
                CICA BARRIER
              </div>
            </div>
          </div>
        )}

        {!isSunscreen && !isToner && !isCream && (
          // Generic Cosmetic Box/Tube
          <div className="w-[36px] h-[72px] relative flex flex-col items-center">
            {/* Cap */}
            <div className="w-[20px] h-[8px] bg-sub rounded-t-sm" />
            {/* Body */}
            <div className="w-[36px] h-[58px] bg-surface border border-[#E1DEC8] rounded-b-md flex flex-col items-center justify-center relative shadow-sm">
              <span className="text-[9px] font-black text-primary">VP</span>
            </div>
          </div>
        )}
      </div>

      {/* Brand & Volume label footer */}
      {brand && (
        <span className="absolute bottom-2 text-[9px] font-black text-sub tracking-wider uppercase">
          {brand.slice(0, 8)}
        </span>
      )}
    </div>
  );
}
