'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Search } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

interface Item { title: string; rating: string | null; poster: string | null; year: string | null; genre: string | null; ott: string[] }

export default function SuggestionsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState({ imdb: true, ott: true });

  async function load(query = '') {
    setLoading(true);
    const d = await fetch(`/api/suggestions${query ? `?q=${encodeURIComponent(query)}` : ''}`).then(r => r.json()).catch(() => null);
    if (d) { setItems(d.items ?? []); setCfg(d.configured); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <Navbar authed />
      <main className="container-page py-8">
        <h1 className="text-2xl font-bold text-navy-900">Movie picks</h1>
        <p className="mt-1 text-sm text-ticx-textmuted">IMDb ratings and where to watch at home. Found a movie you love? See if someone is selling tickets.</p>
        <form onSubmit={e => { e.preventDefault(); load(q.trim()); }} className="relative mt-5 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a movie title"
            className="h-11 w-full rounded-full border border-ticx-border pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue" />
        </form>
        {!cfg.imdb && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Add OMDB_API_KEY to your environment to show IMDb ratings{!cfg.ott && ', and TMDB_API_KEY to show OTT platforms'}.</p>}

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? <p className="text-sm text-ticx-textmuted">Loading picks…</p> : items.map(m => (
            <div key={m.title} className="overflow-hidden rounded-2xl border border-ticx-border bg-white">
              <div className="aspect-[2/3] bg-navy-900">{m.poster && <img src={m.poster} alt={`${m.title} poster`} className="h-full w-full object-cover" />}</div>
              <div className="p-4">
                <h2 className="font-semibold text-navy-900">{m.title}</h2>
                <p className="text-xs text-ticx-textmuted">{[m.year, m.genre].filter(Boolean).join(', ')}</p>
                {m.rating && <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-sm font-bold text-amber-700"><Star className="h-4 w-4 fill-amber-500 text-amber-500" />{m.rating}<span className="text-xs font-normal">/10 IMDb</span></p>}
                {m.ott.length > 0 && <p className="mt-2 text-xs text-slate-600">Watch on: <span className="font-medium">{m.ott.join(', ')}</span></p>}
                <Link href={`/marketplace?q=${encodeURIComponent(m.title)}`} className="mt-3 block rounded-lg bg-brand-blue py-2 text-center text-sm font-semibold text-white hover:bg-brand-bluedark">Find tickets</Link>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
