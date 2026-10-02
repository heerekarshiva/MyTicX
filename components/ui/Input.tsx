import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
