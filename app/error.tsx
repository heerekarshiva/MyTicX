'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[ui] route error', error.digest ?? '', error.message); }, [error]);
  return (
    <main className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-2xl font-bold text-navy-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-slate-600">An unexpected error occurred. Your data is safe — please try again.</p>
      {error.digest && <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-full bg-brand-blue px-6 py-3 text-sm font-semibold text-white hover:bg-brand-bluedark">Try again</button>
        <Link href="/" className="rounded-full border border-ticx-border px-6 py-3 text-sm font-semibold text-navy-900 hover:bg-ticx-bg">Go home</Link>
      </div>
    </main>
  );
}
