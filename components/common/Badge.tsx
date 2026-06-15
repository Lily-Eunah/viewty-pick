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
  const baseStyles = 'inline-flex items-center px-2.5 py-1 text-[11px] font-black rounded-pill tracking-tight select-none';

  const text = typeof children === 'string' ? children.trim() : '';

  let typeStyles = '';

  if (text.includes('더마테스트')) {
    typeStyles = 'bg-[#EAF0F3] text-[#6F838F]';
  } else if (text.includes('민감성')) {
    typeStyles = 'bg-[#F6E7EC] text-[#410016]';
  } else if (text.includes('지성')) {
    typeStyles = 'bg-[#EEF3F1] text-[#6F8F7A]';
  } else if (text.includes('무기자차')) {
    typeStyles = 'bg-[#F7EFE7] text-[#6F6667]';
  } else if (text.includes('기능성')) {
    typeStyles = 'bg-[#FAEEF2] text-[#8A1238]';
  } else if (text.includes('%') || text.includes('↓')) {
    typeStyles = 'bg-[#8A1238] text-white';
  } else {
    typeStyles =
      type === 'trust'
        ? 'bg-primary-light text-primary'
        : type === 'accent'
        ? 'bg-accent-light text-[#8A1238]'
        : 'bg-bg-warm text-title';
  }

  return (
    <span className={`${baseStyles} ${typeStyles} ${className}`}>
      {children}
    </span>
  );
}
