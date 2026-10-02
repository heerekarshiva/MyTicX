import type { Metadata } from 'next';
import { SITE } from './site';

interface PageMetaInput {
  title: string;
  description: string;
  /** Path used for the canonical URL, e.g. "/events". */
  path: string;
  image?: string | null;
  noindex?: boolean;
  type?: 'website' | 'article';
}

/**
 * Builds consistent per-page metadata (title, description, canonical, Open Graph, Twitter).
 * Canonicals are set PER PAGE on purpose — setting one in the root layout would make every
 * page inherit "/" as its canonical, which tells Google to ignore them.
 */
export function pageMeta({ title, description, path, image, noindex, type = 'website' }: PageMetaInput): Metadata {
  const images = image ? [{ url: image }] : undefined; // falls back to the generated /opengraph-image
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: SITE.name, title, description, url: path, locale: SITE.locale, ...(images ? { images } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(images ? { images: images.map(i => i.url) } : {}) },
    ...(noindex ? { robots: { index: false, follow: false } } : {})
  };
}

/** For private/transactional pages that must never appear in search results. */
export const NOINDEX: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
};
