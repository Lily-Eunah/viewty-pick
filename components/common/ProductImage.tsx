"use client";

import React from 'react';
import ProductImageWithFallback from './ProductImageWithFallback';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  brand?: string;
  className?: string;
}

export default function ProductImage({
  src,
  alt,
  className = '',
}: ProductImageProps) {
  return (
    <ProductImageWithFallback
      src={src}
      alt={alt}
      className={className}
    />
  );
}
