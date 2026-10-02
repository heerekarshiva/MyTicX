import { cn } from '@/lib/utils';

/** MyTICX wordmark: bold "TIC" + orange ticket-cut "X". Use tone="light" on navy backgrounds. */
export function Logo({ className, tone = 'dark', tagline = false, iconOnly = false }: { className?: string; tone?: 'dark' | 'light'; tagline?: boolean; iconOnly?: boolean }) {
  return (
    <div className={cn('flex flex-col leading-none', className)}>
      <span className={cn('flex items-center text-2xl font-black tracking-tight', tone === 'light' ? 'text-white' : 'text-navy-900')}>
        {!iconOnly && <><span className="mr-0.5 text-[0.7em] font-bold opacity-90">My</span>TIC</>}
        <svg viewBox="0 0 34 30" className="-ml-0.5 h-6 w-7" aria-hidden="true">
          <path d="M2 2h9l6 8 6-8h9L21.5 15 32 28h-9l-6-8-6 8H2l10.5-13z" fill="#FF7A00" />
          <rect x="21" y="1" width="9" height="6" rx="1.5" transform="rotate(35 25 4)" fill="#FFA31A" />
        </svg>
      </span>
      {tagline && (
        <span className={cn('mt-1 text-[10px] font-medium', tone === 'light' ? 'text-white/80' : 'text-slate-500')}>
          Tickets In Connected eXchange
        </span>
      )}
    </div>
  );
}
