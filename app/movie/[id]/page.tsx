'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Clock, MapPin, Star } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { ShowResult } from '@/lib/providers/movie-provider';
import { formatTime12h } from '@/lib/utils';

export default function MovieDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [show, setShow] = useState<ShowResult | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/shows/detail?id=${id}`).then(r => r.json()).then(d => setShow(d.show ?? null));
  }, [id]);

  if (!show) {
    return (
      <div>
        <Navbar authed />
        <div className="container-page py-10 text-sm text-slate-500">Loading show details…</div>
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <div className="h-64 rounded-xl2 bg-brand-gradient-soft lg:h-full" />
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{show.movieTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>{show.language}</span><span>•</span><span>{show.genre}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {Math.floor(show.durationMinutes / 60)}h {show.durationMinutes % 60}m</span>
            {show.rating && <span className="flex items-center gap-1"><Star className="h-4 w-4" /> {show.rating}</span>}
          </div>
          <p className="mt-4 max-w-xl text-sm text-slate-600">
            First-run tickets for {show.movieTitle} are booked through the cinema directly. If you already have a
            ticket you can't use, list it for resale from the Sell Ticket page — or check the resale marketplace
            below for discounted seats other users are offering for this exact show.
          </p>

          <Card className="mt-6">
            <p className="flex items-center gap-1 text-sm font-medium text-navy-900"><MapPin className="h-4 w-4 text-brand-blue" /> {show.theatreName}, {show.location}</p>
            <p className="mt-1 text-xs text-slate-500">{show.showDate}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {show.showTimes.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTime(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${selectedTime === t ? 'border-brand-blue bg-brand-gradient-soft text-brand-bluedark' : 'border-slate-200 text-navy-900'}`}
                >
                  {formatTime12h(t)}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-500">Base price: ₹{show.basePrice.toFixed(0)}</p>
            <Button
              className="mt-4 w-full sm:w-auto"
              disabled={!selectedTime}
              onClick={() => router.push(`/marketplace?movie=${encodeURIComponent(show.movieTitle)}&location=${encodeURIComponent(show.location)}`)}
            >
              View Resale Tickets
            </Button>
          </Card>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
