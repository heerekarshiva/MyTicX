'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { cn } from '@/lib/utils';

const tabs = [
  ['/admin', 'Overview'], ['/admin/events', 'Events'], ['/admin/event-types', 'Event types'], ['/admin/fields', 'Field builder'],
  ['/admin/templates', 'Templates'], ['/admin/organizers', 'Organizers'], ['/admin/payouts', 'Payouts'], ['/admin/settings', 'Settings']
];
export function AdminShell({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-ticx-bg">
      <Navbar authed />
      <div className="container-page py-6">
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-2" aria-label="Admin sections">
          {tabs.map(([href, label]) => <Link key={href} href={href} className={cn('whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium', path === href ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-white')}>{label}</Link>)}
        </nav>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold text-navy-900">{title}</h1>{action}</div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export async function api(url: string, method = 'GET', body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, data: j, error: j.error as string | undefined };
}
export const selectCls = 'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-900 outline-none focus:border-brand-blue';
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm text-navy-900"><input type="checkbox" className="h-4 w-4 accent-[#FF7A00]" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
