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
      ? 'bg-primary-dark hover:bg-opacity-95 text-white font-extrabold h-[54px] rounded-btn text-[16px]'
      : 'bg-primary-light hover:bg-[#E2EAD9] text-primary-dark font-bold h-[46px] rounded-[14px] text-[14px]';

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
