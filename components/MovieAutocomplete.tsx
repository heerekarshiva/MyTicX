'use client';
import { useEffect, useRef, useState } from 'react';
import { Input } from './ui/Input';

interface MovieHit { id: string; title: string; language: string | null; poster_url: string | null; }

/**
 * Movie name field with autocomplete against movies already on MyTICX. Picking
 * a result reuses that movie's saved poster/language instead of asking the
 * seller to upload a poster again for a movie someone else already listed.
 */
export function MovieAutocomplete({
  value,
  onChange,
  onPick
}: {
  value: string;
  onChange: (title: string) => void;
  onPick: (movie: MovieHit) => void;
}) {
  const [hits, setHits] = useState<MovieHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/movies?q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => setHits(d.movies ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Start typing a movie name…"
        autoComplete="off"
      />
      {open && hits.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
          {hits.map(m => (
            <button
              key={m.id}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => { onPick(m); setOpen(false); }}
            >
              {m.poster_url
                ? <img src={m.poster_url} alt="" className="h-8 w-8 rounded object-cover" />
                : <span className="h-8 w-8 flex-shrink-0 rounded bg-brand-gradient-soft" />}
              <span className="min-w-0 flex-1 truncate">{m.title}</span>
              {m.language && <span className="flex-shrink-0 text-xs text-slate-400">{m.language}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
