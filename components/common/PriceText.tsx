import React from 'react';
import { won } from '../../lib/format';

interface PriceTextProps {
  price: number | null | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function PriceText({
  price,
  size = 'md',
  className = '',
}: PriceTextProps) {
  const sizeClasses = {
    sm: 'text-[14px] font-bold',
    md: 'text-[18px] font-extrabold',
    lg: 'text-[22px] font-black',
    xl: 'text-[28px] font-black',
  };

  return (
    <span className={`text-price tracking-tight ${sizeClasses[size]} ${className}`}>
      {won(price)}
    </span>
  );
}
