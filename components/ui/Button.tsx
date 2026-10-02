import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none min-h-[44px]',
          variant === 'primary' && 'bg-brand-gradient text-white shadow-soft hover:brightness-105 active:brightness-95',
          variant === 'secondary' && 'bg-navy-900 text-white hover:bg-navy-800',
          variant === 'outline' && 'border border-slate-200 bg-white text-navy-900 hover:bg-slate-50',
          variant === 'ghost' && 'text-navy-900 hover:bg-slate-100',
          size === 'sm' && 'px-3 py-2 text-sm',
          size === 'md' && 'px-5 py-2.5 text-sm',
          size === 'lg' && 'px-6 py-3.5 text-base',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
