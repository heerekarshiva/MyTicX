import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import type { ShowResult } from '@/lib/providers/movie-provider';
import { formatTime12h } from '@/lib/utils';

export function MovieCard({ show }: { show: ShowResult }) {
  return (
    <Card className="flex flex-col gap-3 sm:flex-row">
      <div className="h-40 w-full flex-shrink-0 rounded-lg bg-brand-gradient-soft sm:h-28 sm:w-20" aria-hidden />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-navy-900">{show.movieTitle}</h3>
          {show.rating && <Badge tone="neutral">{show.rating}</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-500">{show.language} • {show.genre}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" /> {Math.floor(show.durationMinutes / 60)}h {show.durationMinutes % 60}m
        </p>
        <p className="mt-2 flex items-center gap-1 text-sm font-medium text-navy-900">
          <MapPin className="h-4 w-4 text-brand-blue" /> {show.theatreName}, {show.location}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {show.showTimes.map(t => (
            <span key={t} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-navy-900">{formatTime12h(t)}</span>
          ))}
        </div>
        <Link
          href={`/movie/${show.movieId}?theatre=${encodeURIComponent(show.theatreId)}`}
          className="mt-4 inline-block rounded-xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white"
        >
          View Tickets
        </Link>
      </div>
    </Card>
  );
}
