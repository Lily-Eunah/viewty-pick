import React from 'react';

interface BadgeProps {
  type?: 'trust' | 'accent' | 'default';
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  type = 'default',
  children,
  className = '',
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2.5 py-1 text-[11px] font-black rounded-pill tracking-tight';

  const typeStyles =
    type === 'trust'
      ? 'bg-primary-light text-primary-dark'
      : type === 'accent'
      ? 'bg-accent-light text-[#7A5B00]'
      : 'bg-bg-warm text-title';

  return (
    <span className={`${baseStyles} ${typeStyles} ${className}`}>
      {children}
    </span>
  );
}
