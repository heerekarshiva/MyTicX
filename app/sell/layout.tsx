import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';

// Private/transactional area: never shown in search results.
export const metadata: Metadata = NOINDEX;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
