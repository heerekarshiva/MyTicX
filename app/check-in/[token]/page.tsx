'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/Card';

// Target of the QR code. Contains only a random token — no personal data. Public
// visitors see nothing about the participant; the event's organizer is forwarded to the scanner.
export default function CheckInLanding() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'denied'>('loading');
  useEffect(() => {
    fetch(`/api/organizer/resolve?token=${encodeURIComponent(token)}`).then(async r => {
      if (r.ok) { const j = await r.json(); router.replace(`/organizer/events/${j.eventId}/scan?token=${encodeURIComponent(token)}`); } else setState('denied');
    }).catch(() => setState('denied'));
  }, [token, router]);
  return (
    <div><Navbar />
      <div className="container-page max-w-md py-16">
        <Card className="text-center">
          <h1 className="text-lg font-bold text-navy-900">MyTICX entry pass</h1>
          <p className="mt-2 text-sm text-slate-500">{state === 'loading' ? 'Checking…' : 'This is a participant’s entry pass. Only the event organizer can verify it, from the Scan Participant screen.'}</p>
        </Card>
      </div>
    </div>
  );
}
