'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, ArrowRight, ShieldCheck, Zap, Users, Ticket } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Footer } from '@/components/Footer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatTime12h } from '@/lib/utils';

interface ListingRow {
  listing_id: string; resale_price: number; original_price: number;
  movie_title: string | null; language: string | null; poster_url: string | null;
  theatre_name: string | null; location: string | null; show_date: string | null; show_time: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/listings?page=1')
      .then(r => r.json())
      .then(d => setListings((d.listings ?? []).slice(0, 8)))
      .finally(() => setLoading(false));
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/marketplace?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-gradient-soft">
        <div className="container-page grid gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-bluedark">
              Buy <span className="text-slate-300">•</span> Sell <span className="text-slate-300">•</span> Experience
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] text-navy-900 sm:text-5xl">
              Your Next
              <br />
              <span className="bg-brand-gradient bg-clip-text text-transparent">Movie Awaits</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-slate-600 sm:text-lg">
              MyTICX (Tickets In Connected eXchange) makes it easy to buy and sell verified movie tickets and join events — safely, securely, and at a fair price.
            </p>

            <form onSubmit={onSearch} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search movies, theatres, language…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Explore Tickets <ArrowRight className="h-4 w-4" />
              </Button>
              <Button type="button" size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/sell')}>
                Sell a Ticket
              </Button>
            </form>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <TrustPoint icon={<ShieldCheck className="h-5 w-5" />} title="100%" subtitle="Verified Tickets" />
              <TrustPoint icon={<Zap className="h-5 w-5" />} title="Safe & Secure" subtitle="Transactions" />
              <TrustPoint icon={<Users className="h-5 w-5" />} title="Trusted" subtitle="Community" />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-[2.5rem] border-[6px] border-navy-900 bg-white p-3 shadow-soft">
              <div className="rounded-[1.75rem] bg-white">
                <div className="flex items-center justify-between px-2 pb-3 pt-1">
                  <span className="text-xs font-semibold text-slate-400">9:41</span>
                  <span className="flex items-center gap-1 text-navy-900">
                    <Ticket className="h-4 w-4 text-brand-blue" />
                    <span className="text-sm font-bold">MyTICX</span>
                  </span>
                </div>
                <form onSubmit={onSearch} className="space-y-2 px-2">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-9 text-xs" placeholder="Search for movies…" value={q} onChange={e => setQ(e.target.value)} />
                  </div>
                </form>
                <p className="mt-3 px-2 text-xs font-semibold text-navy-900">Live on MyTICX</p>
                <div className="mt-2 space-y-2 px-2 pb-3">
                  {listings.length
                    ? listings.slice(0, 3).map(m => (
                      <div key={m.listing_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2">
                        <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-brand-gradient bg-cover bg-center" style={m.poster_url ? { backgroundImage: `url(${m.poster_url})` } : undefined} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-navy-900">{m.movie_title ?? 'Movie'}</p>
                          <p className="text-[11px] text-slate-400">{m.language ?? '—'}</p>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-brand-gradient-soft px-2 py-1 text-[11px] font-semibold text-brand-bluedark">From ₹{m.resale_price ?? '—'}</span>
                      </div>
                    ))
                    : PLACEHOLDER_POSTERS.map(m => (
                      <div key={m.src} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.src} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
                        <div className="flex-1" />
                        <span className="flex-shrink-0 rounded-full bg-brand-gradient-soft px-2 py-1 text-[11px] font-semibold text-brand-bluedark">From ₹{m.price}</span>
                      </div>
                    ))}
                </div>
                <div className="flex items-center justify-around border-t border-slate-100 py-2">
                  {['Home', 'Sell', 'Tickets', 'Profile'].map((t, i) => (
                    <span key={t} className={`text-[10px] font-medium ${i === 0 ? 'text-brand-blue' : 'text-slate-400'}`}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Recently Listed</h2>
          <button className="text-sm font-medium text-brand-blue" onClick={() => router.push('/marketplace')}>See all</button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && listings.length === 0 && <p className="text-sm text-slate-400">No listings yet — be the first to sell a ticket.</p>}
          {!loading && listings.map(row => (
            <Card key={row.listing_id} className="cursor-pointer overflow-hidden !p-0" onClick={() => router.push(`/listing/${row.listing_id}`)}>
              <div className="h-32 w-full bg-brand-gradient-soft bg-cover bg-center" style={row.poster_url ? { backgroundImage: `url(${row.poster_url})` } : undefined} />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-navy-900">{row.movie_title ?? 'Movie'}</p>
                  {row.language && <Badge tone="info">{row.language}</Badge>}
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">{row.theatre_name}{row.location ? `, ${row.location}` : ''}</p>
                {row.show_date && <p className="text-xs text-slate-400">{row.show_date} • {formatTime12h(row.show_time ?? '')}</p>}
                <p className="mt-2 text-base font-bold text-navy-900">₹{Number(row.resale_price).toFixed(0)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-page pb-10">
        <Card className="flex flex-wrap items-center justify-between gap-4 bg-brand-gradient-soft">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Organizing something?</h2>
            <p className="mt-1 text-sm text-slate-500">Browse concerts, meetups and more on MyTICX Events.</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/events')}>Browse events</Button>
        </Card>
      </section>

      <Footer />
      <MobileBottomNav />
    </div>
  );
}

// Shown only until real listings exist. Posters only, no fake movie names.
const PLACEHOLDER_POSTERS = [
  { src: '/posters/oppenheimer.png', price: 249 },
  { src: '/posters/interstellar.png', price: 349 },
  { src: '/posters/spiderverse.png', price: 199 }
];

function TrustPoint({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-blue shadow-soft">{icon}</span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-navy-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
