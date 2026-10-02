'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Ticket, PlusCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/sell', label: 'Sell', icon: PlusCircle },
  { href: '/my-tickets', label: 'Tickets', icon: Ticket },
  { href: '/profile', label: 'Profile', icon: User }
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-100 bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]">
            <Icon className={cn('h-5 w-5', active ? 'text-brand-blue' : 'text-slate-400')} />
            <span className={cn(active ? 'font-semibold text-brand-blue' : 'text-slate-500')}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
