import React from 'react';

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'skin' | 'sort' | 'tab';
}

export default function Chip({
  label,
  selected = false,
  onClick,
  variant = 'skin',
}: ChipProps) {
  const baseStyles = 'inline-flex items-center justify-center text-[13px] select-none transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0';

  let variantStyles = '';

  if (variant === 'skin') {
    variantStyles = `px-4 py-2 font-bold rounded-pill border ${
      selected
        ? 'bg-primary text-white border-primary shadow-sm'
        : 'bg-surface text-body border-line hover:bg-bg'
    }`;
  } else if (variant === 'sort') {
    // Sort option chip
    variantStyles = `px-4 py-2 font-bold rounded-pill border ${
      selected
        ? 'bg-accent-soft text-primary border-[#F1D8E0] font-extrabold shadow-sm'
        : 'bg-transparent text-sub border-transparent hover:text-body'
    }`;
  } else if (variant === 'tab') {
    // Underlined tab style for sub-categories
    variantStyles = `px-1 py-2 font-bold border-b-2 transition-all shrink-0 ${
      selected
        ? 'border-primary text-primary font-extrabold'
        : 'border-transparent text-sub hover:text-body'
    }`;
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

