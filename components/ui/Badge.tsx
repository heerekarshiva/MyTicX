import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const toneClasses: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-blue-50 text-brand-bluedark ring-blue-600/20',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20'
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
