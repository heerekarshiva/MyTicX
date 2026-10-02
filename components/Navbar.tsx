'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X, Bell, User, Search } from 'lucide-react';
import { Logo } from './Logo';
import { createClient } from '@/lib/supabase/client';

type NavLink = { href: string; label: string; newTab?: boolean };
// Opens in a NEW TAB per spec. The label/visibility are admin-controlled (platform settings).
const ORGANIZE: NavLink = { href: '/organize-event', label: 'Organize Your Event', newTab: true };
const MOVIE_PICKS: NavLink = { href: '/suggestions', label: 'Movie picks' };
const publicLinks: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/marketplace', label: 'Browse' },
  { href: '/sell', label: 'Sell Tickets' },
  { href: '/events', label: 'Events' },
  ORGANIZE,
  MOVIE_PICKS
];
const authedLinks: NavLink[] = [
  { href: '/home', label: 'Home' },
  { href: '/marketplace', label: 'Browse' },
  { href: '/events', label: 'Events' },
  ORGANIZE,
  MOVIE_PICKS,
  { href: '/my-registrations', label: 'My registrations' },
  { href: '/organizer/dashboard', label: 'Organizer dashboard' },
  { href: '/my-tickets', label: 'My tickets' },
  { href: '/my-listings', label: 'My listings' }
];

/**
 * `authed` is optional. Pass it when the page already knows (private pages pass true); omit it on
 * PUBLIC pages so they can be statically rendered/cached — the navbar then detects the session in
 * the browser, while crawlers and first paint get the public navigation.
 */
export function Navbar({ authed: authedProp }: { authed?: boolean }) {
  const [clientAuthed, setClientAuthed] = useState(false);
  useEffect(() => {
    if (authedProp !== undefined) return;
    let unsub: (() => void) | undefined;
    try {
      const sb = createClient();
      sb.auth.getSession().then(({ data }) => setClientAuthed(!!data.session)).catch(() => {});
      const { data } = sb.auth.onAuthStateChange((_e, session) => setClientAuthed(!!session));
      unsub = () => data.subscription.unsubscribe();
    } catch { /* Supabase not configured: stay in public mode */ }
    return () => unsub?.();
  }, [authedProp]);
  const authed = authedProp ?? clientAuthed;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const router = useRouter();
  const [nav, setNav] = useState({ enabled: true, label: ORGANIZE.label });
  useEffect(() => {
    fetch('/api/event-config').then(r => r.json()).then(c => c?.settings && setNav({ enabled: c.settings.navEnabled !== false, label: c.settings.navLabel || ORGANIZE.label })).catch(() => {});
  }, []);
  const links = (authed ? authedLinks : publicLinks)
    .filter(l => l !== ORGANIZE || nav.enabled)
    .map(l => (l === ORGANIZE ? { ...l, label: nav.label } : l));
  const renderLink = (l: NavLink, cls: string, onClick?: () => void) => l.newTab
    ? <a key={l.href + l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>{l.label}</a>
    : <Link key={l.href + l.label} href={l.href} onClick={onClick} className={cls}>{l.label}</Link>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/marketplace?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href={authed ? '/home' : '/'} aria-label="MyTICX home"><Logo tone="light" /></Link>

        {authed ? (
          <form onSubmit={submit} className="relative mx-auto hidden w-full max-w-xl md:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search for movies, events, or shows..."
              className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue" />
          </form>
        ) : (
          <nav className="mx-auto hidden items-center gap-7 md:flex">
            {links.map(l => renderLink(l, 'text-sm font-medium text-white/90 hover:text-brand-blue'))}
          </nav>
        )}

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {authed ? (
            <>
              {nav.enabled && <a href="/organize-event" target="_blank" rel="noopener noreferrer" className="hidden px-2 text-sm font-medium text-white/90 hover:text-brand-blue lg:inline">{nav.label}</a>}
              <Link href="/suggestions" className="hidden px-2 text-sm font-medium text-white/90 hover:text-brand-blue lg:inline">Movie picks</Link>
              <Link href="/sell" className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-bluedark">Sell Tickets</Link>
              <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-white/10">
                <Bell className="h-5 w-5" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-blue" />
              </Link>
              <Link href="/profile" aria-label="Profile" className="rounded-full bg-white/10 p-2 hover:bg-white/20"><User className="h-5 w-5" /></Link>
            </>
          ) : (
            <>
              <Link href="/login" className="px-2 text-sm font-medium hover:text-brand-blue">Login</Link>
              <Link href="/signup" className="rounded-full bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-bluedark">Sign Up</Link>
            </>
          )}
        </div>

        <button className="ml-auto rounded-lg p-2 hover:bg-white/10 md:hidden" onClick={() => setOpen(v => !v)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-navy-900 px-4 pb-4 md:hidden">
          <div className="flex flex-col pt-2">
            {links.concat(authed ? [{ href: '/sell', label: 'Sell Tickets' }, { href: '/profile', label: 'Profile' }] as NavLink[] : [{ href: '/login', label: 'Login' }, { href: '/signup', label: 'Sign Up' }] as NavLink[])
              .map(l => renderLink(l, 'rounded-lg px-3 py-3 text-sm font-medium hover:bg-white/10', () => setOpen(false)))}
          </div>
        </div>
      )}
    </header>
  );
}
