'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatTime12h } from '@/lib/utils';
import { LANGUAGES } from '@/lib/constants/languages';

interface MarketplaceRow {
  listing_id: string;
  resale_price: number;
  platform_fee: number;
  original_price: number;
  seat_label: string | null;
  verification_status: string;
  movie_title: string | null;
  language: string | null;
  poster_url: string | null;
  theatre_name: string | null;
  location: string | null;
  show_date: string | null;
  show_time: string | null;
  seller_phone_verified: boolean;
}

export default function MarketplaceClient({ initial, initialQ = '', initialLanguage = 'all' }: { initial: MarketplaceRow[]; initialQ?: string; initialLanguage?: string }) {
  const [rows, setRows] = useState<MarketplaceRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState(initialQ);
  const [language, setLanguage] = useState(initialLanguage);
  const skipFirst = useRef(true);

  // The server already rendered the first result set for the URL's filters, so skip the first fetch.
  // Later changes are debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true); setFailed(false);
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (language !== 'all') qs.set('language', language);
      fetch(`/api/listings?${qs.toString()}`, { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
        .then(d => setRows(d.listings ?? []))
        .catch(e => { if (e.name !== 'AbortError') setFailed(true); })
        .finally(() => setLoading(false));
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, language]);

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar />
      <div className="container-page py-6">
        <h1 className="text-xl font-bold text-navy-900">Resale Ticket Marketplace</h1>
        <p className="mt-1 text-sm text-slate-500">Verified movie tickets from real people, at least ₹50 below the original price.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Search listings" placeholder="Search movie, theatre, city or language" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip active={language === 'all'} onClick={() => setLanguage('all')} label="All languages" />
          {LANGUAGES.map(l => <FilterChip key={l} active={language === l} onClick={() => setLanguage(l)} label={l} />)}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && <p className="text-sm text-slate-500" role="status">Updating listings…</p>}
          {failed && <p className="text-sm text-rose-600" role="alert">Could not load listings. Please try again.</p>}
          {!loading && !failed && rows.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState title="No resale tickets found." subtitle="Try clearing filters or check back later." />
            </div>
          )}
          {rows.map(row => {
            const discountPct = row.original_price ? Math.round((1 - row.resale_price / row.original_price) * 100) : 0;
            return (
              <Link key={row.listing_id} href={`/listing/${row.listing_id}`} className="block rounded-xl2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
              <Card className="h-full overflow-hidden !p-0 transition hover:-translate-y-0.5">
                <div className="h-36 w-full overflow-hidden bg-brand-gradient-soft">
                  {row.poster_url && <img src={row.poster_url} alt={`${row.movie_title ?? 'Movie'} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-navy-900">{row.movie_title ?? 'Movie'}</h3>
                    <Badge tone="success">{discountPct}% lower</Badge>
                  </div>
                  {row.language && <Badge tone="info" className="mt-1">{row.language}</Badge>}
                  <p className="mt-1 text-sm text-slate-500">{row.theatre_name}, {row.location}</p>
                  <p className="mt-1 text-xs text-slate-400">{row.show_date} • {formatTime12h(row.show_time ?? '')}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400 line-through">₹{row.original_price?.toFixed(0)}</p>
                      <p className="text-lg font-bold text-navy-900">₹{row.resale_price.toFixed(0)}</p>
                    </div>
                    <Badge tone={row.verification_status === 'PROVIDER_VERIFIED' ? 'success' : 'info'}>
                      {row.verification_status === 'PROVIDER_VERIFIED' ? 'Provider verified' : row.verification_status === 'DOCUMENT_VERIFIED' ? 'Document verified' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              </Card>
              </Link>
            );
          })}
        </div>
      </div>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button" aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-brand-blue bg-brand-gradient-soft text-brand-bluedark' : 'border-slate-200 text-slate-600'}`}
    >
      {label}
    </button>
  );
}
