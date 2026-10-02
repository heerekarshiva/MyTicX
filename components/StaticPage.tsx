import type { ReactNode } from 'react';
import Link from 'next/link';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { JsonLd } from './JsonLd';
import { breadcrumbJsonLd } from '@/lib/events/schema';

/** Shared shell for static content pages: navbar, breadcrumb schema, readable column, footer. */
export function StaticPage({ title, intro, path, children, schema }: { title: string; intro?: string; path: string; children: ReactNode; schema?: Record<string, unknown>[] }) {
  return (
    <div>
      <JsonLd data={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: title, path }]), ...(schema ?? [])]} />
      <Navbar />
      <main className="container-page max-w-3xl py-10">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
          <Link href="/" className="hover:text-brand-blue">Home</Link> <span aria-hidden="true">/</span> <span>{title}</span>
        </nav>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900">{title}</h1>
        {intro && <p className="mt-3 text-lg text-slate-600">{intro}</p>}
        <div className="mt-8 space-y-4 text-[15px] leading-7 text-slate-700 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy-900 [&_a]:font-medium [&_a]:text-brand-bluedark [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
