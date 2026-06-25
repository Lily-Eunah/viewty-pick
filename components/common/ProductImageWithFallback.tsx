"use client";

import React, { useState } from 'react';
import CosmeticPlaceholderIcon from './CosmeticPlaceholderIcon';

interface ProductImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  category?: string;
}

function getMajorCategory(category?: string | null): string | null {
  if (!category) return null;
  const majors = ['suncare', 'skincare', 'cleansing-care', 'maskpack', 'bodycare', 'base-makeup'];
  if (majors.includes(category)) return category;

  const mapping: Record<string, string> = {
    // Suncare
    'sunscreen': 'suncare',
    'sunstick': 'suncare',
    'suncushion': 'suncare',
    // Skincare
    'toner': 'skincare',
    'lotion': 'skincare',
    'serum': 'skincare',
    'allinone': 'skincare',
    'cream': 'skincare',
    // Cleansing
    'cleansing': 'cleansing-care',
    'cleansing-oil': 'cleansing-care',
    'cleansing-water': 'cleansing-care',
    // Maskpack
    'sheet-mask': 'maskpack',
    'pad': 'maskpack',
    // Bodycare
    'shower': 'bodycare',
    'body-lotion': 'bodycare',
    'shaving': 'bodycare',
    'shaving-cream': 'bodycare',
    'shaving-foam': 'bodycare',
    // Base Makeup
    'cushion': 'base-makeup',
  };

  return mapping[category] || null;
}

export default function ProductImageWithFallback({
  src,
  alt,
  className = '',
  category,
}: ProductImageWithFallbackProps) {
  const [error, setError] = useState(false);

  const hasImage = !!src && src.startsWith('http') && !error;

  if (hasImage) {
    return (
      <div className={`relative overflow-hidden bg-[#FFFDF9] ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src!}
          alt={alt}
          className="w-full h-full object-contain"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  const majorCategory = getMajorCategory(category);
  if (majorCategory) {
    return (
      <div className={`relative overflow-hidden bg-[#FFFDF9] flex items-center justify-center p-3.5 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/images/categories/${majorCategory}.png`}
          alt={alt}
          className="w-full h-full object-contain opacity-75"
        />
      </div>
    );
  }

  return <CosmeticPlaceholderIcon alt={alt} className={className} />;
}
