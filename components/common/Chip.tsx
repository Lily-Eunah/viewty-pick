import React from 'react';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'skin' | 'sort';
}

export default function Chip({
  label,
  selected = false,
  onClick,
  variant = 'skin',
}: ChipProps) {
  const baseStyles = 'inline-flex items-center justify-center px-4 py-2 text-[13px] font-bold rounded-pill border select-none transition-all cursor-pointer active:scale-95';

  let variantStyles = '';

  if (variant === 'skin') {
    variantStyles = selected
      ? 'bg-primary text-white border-primary shadow-sm'
      : 'bg-surface text-body border-line hover:bg-bg';
  } else {
    // Sort option chip
    variantStyles = selected
      ? 'bg-accent-soft text-primary border-[#F1D8E0] font-extrabold shadow-sm'
      : 'bg-transparent text-sub border-transparent hover:text-body';
  }

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles}`}
    >
      {label}
    </button>
  );
}
