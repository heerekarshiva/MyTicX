'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { MovieCard } from '@/components/MovieCard';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { ShowResult } from '@/lib/providers/movie-provider';

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [movie, setMovie] = useState(params.get('movie') ?? '');
  const [location, setLocation] = useState(params.get('location') ?? '');
  const [results, setResults] = useState<ShowResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('all');

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ movie, location }).toString();
    fetch(`/api/shows/search?${qs}`)
      .then(r => r.json())
      .then(d => setResults(d.results ?? []))
      .finally(() => setLoading(false));
  }, [movie, location]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search?movie=${encodeURIComponent(movie)}&location=${encodeURIComponent(location)}`);
  }

  const filtered = language === 'all' ? results : results.filter(r => r.language === language);
  const languages = Array.from(new Set(results.map(r => r.language)));

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page py-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-xl2 bg-white p-3 shadow-soft sm:flex-row">
          <Input placeholder="Movie name" value={movie} onChange={e => setMovie(e.target.value)} />
          <Input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
          <Button type="submit">Search</Button>
        </form>

        {languages.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip active={language === 'all'} onClick={() => setLanguage('all')} label="All languages" />
            {languages.map(l => <FilterChip key={l} active={language === l} onClick={() => setLanguage(l)} label={l} />)}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {loading && <p className="text-sm text-slate-500">Searching…</p>}
          {!loading && filtered.length === 0 && (
            <EmptyState
              title={`No tickets found for "${movie || 'this movie'}" in ${location || 'this location'}.`}
              subtitle="Try another location or date."
            />
          )}
          {!loading && filtered.map(show => <MovieCard key={`${show.movieId}-${show.theatreId}`} show={show} />)}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-brand-blue bg-brand-gradient-soft text-brand-bluedark' : 'border-slate-200 text-slate-600'}`}
    >
      {label}
    </button>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading…</div>}>
      <SearchInner />
    </Suspense>
  );
}
