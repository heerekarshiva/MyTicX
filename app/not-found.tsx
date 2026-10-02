import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { NOINDEX } from '@/lib/seo';

export const metadata = { ...NOINDEX, title: 'Page not found' };

export default function NotFound() {
  return (
    <div>
      <Navbar />
      <main className="container-page flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
        <p className="text-6xl font-black text-navy-900">4<span className="text-brand-blue">0</span>4</p>
        <h1 className="mt-4 text-2xl font-bold text-navy-900">We couldn’t find that page</h1>
        <p className="mt-2 max-w-md text-slate-600">The link may be broken, or the ticket or event may no longer be available.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/marketplace" className="rounded-full bg-brand-blue px-6 py-3 text-sm font-semibold text-white hover:bg-brand-bluedark">Browse tickets</Link>
          <Link href="/events" className="rounded-full border border-ticx-border px-6 py-3 text-sm font-semibold text-navy-900 hover:bg-ticx-bg">See events</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
