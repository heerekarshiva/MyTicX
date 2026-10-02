import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Movie Picks – What to Watch Now, With IMDb Ratings',
  description: 'Discover movies worth watching with IMDb ratings and where to stream them, picked for MyTICX users.',
  path: '/suggestions'
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
