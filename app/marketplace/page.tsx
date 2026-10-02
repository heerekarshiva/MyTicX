import type { Metadata } from 'next';
import MarketplaceClient from './MarketplaceClient';
import { JsonLd } from '@/components/JsonLd';
import { pageMeta } from '@/lib/seo';
import { abs } from '@/lib/site';
import { getMarketplaceSafe } from '@/lib/listings/public';
import { breadcrumbJsonLd } from '@/lib/events/schema';
import { LANGUAGES } from '@/lib/constants/languages';

type SP = { q?: string; language?: string };

// Rendered per request so filters in the URL are server-rendered (shareable and crawlable).
export const dynamic = 'force-dynamic'; // filters live in the URL; the DB query itself is cached for 15s (see getMarketplaceSafe)

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const filtered = !!(searchParams.q || (searchParams.language && searchParams.language !== 'all'));
  const meta = pageMeta({
    title: 'Buy Discounted Movie Tickets – Verified Resale Marketplace',
    description: 'Browse verified resale movie tickets at least ₹50 below the original price. Filter by movie, theatre, city or language. Every listing is checked before it goes live.',
    path: '/marketplace'
  });
  // Search-result URLs are thin/duplicate: keep them out of the index but let links be followed.
  return filtered ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function MarketplacePage({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q ?? '').slice(0, 80);
  const language = LANGUAGES.includes((searchParams.language ?? '') as any) ? (searchParams.language as string) : 'all';
  const { rows } = await getMarketplaceSafe({ q, language });

  const schema = [
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Marketplace', path: '/marketplace' }]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Resale movie ticket marketplace',
      url: abs('/marketplace'),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: rows.length,
        itemListElement: rows.slice(0, 20).map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: `${r.movie_title ?? 'Movie ticket'}${r.theatre_name ? ` – ${r.theatre_name}` : ''}` }))
      }
    }
  ];
  return (
    <>
      <JsonLd data={schema} />
      <MarketplaceClient initial={rows as any} initialQ={q} initialLanguage={language} />
    </>
  );
}
