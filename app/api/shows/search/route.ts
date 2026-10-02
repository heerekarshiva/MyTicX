import { NextRequest, NextResponse } from 'next/server';
import { getMovieProvider } from '@/lib/providers/movie-provider';
import { movieSearchSchema } from '@/lib/validation/schemas';

// Public search endpoint — wraps whichever MovieProvider is configured
// (mock in development; a real provider in production) behind one stable
// contract so pages never talk to the provider directly.
export async function GET(req: NextRequest) {
  const movie = req.nextUrl.searchParams.get('movie') ?? '';
  const location = req.nextUrl.searchParams.get('location') ?? '';

  // Both fields are optional for browsing, but validate when present.
  if (movie) movieSearchSchema.shape.movie.safeParse(movie);

  const provider = getMovieProvider();
  const results = await provider.searchShows({ movie, location });
  return NextResponse.json({ results });
}
