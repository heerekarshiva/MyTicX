import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl2 border border-slate-100 bg-white p-5 shadow-soft', className)}
      {...props}
    />
  );
}
