import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  fullWidth = true,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center text-center transition-all duration-200 active:scale-[0.98] outline-none select-none';
  
  const variantStyles =
    variant === 'primary'
      ? 'bg-primary border border-primary hover:bg-primary-hover hover:border-primary-hover active:bg-primary-dark active:border-primary-dark disabled:bg-[#D8CFCC] disabled:border-[#D8CFCC] text-white font-extrabold h-[54px] rounded-btn text-[16px]'
      : 'bg-surface border border-accent hover:bg-accent-soft hover:border-accent text-primary disabled:bg-[#F1ECE8] disabled:text-[#A8A0A0] disabled:border-border font-bold h-[46px] rounded-[14px] text-[14px]';

  const widthStyles = fullWidth ? 'w-full' : 'px-6';

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${widthStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
