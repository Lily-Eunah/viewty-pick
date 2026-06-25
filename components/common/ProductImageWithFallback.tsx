"use client";

import React, { useState } from 'react';
import CosmeticPlaceholderIcon from './CosmeticPlaceholderIcon';

interface ProductImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  category?: string;
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
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return <CosmeticPlaceholderIcon alt={alt} className={className} />;
}
