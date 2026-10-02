import { SearchX } from 'lucide-react';
import { Logo } from './Logo';

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl2 border border-dashed border-slate-200 py-16 text-center">
      <div className="opacity-40"><Logo iconOnly /></div>
      <SearchX className="h-6 w-6 text-slate-300" />
      <p className="font-medium text-navy-900">{title}</p>
      {subtitle && <p className="max-w-xs text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
