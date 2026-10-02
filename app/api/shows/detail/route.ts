import { NextRequest, NextResponse } from 'next/server';
import { getMovieProvider } from '@/lib/providers/movie-provider';

export async function GET(req: NextRequest) {
  const showId = req.nextUrl.searchParams.get('id');
  if (!showId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const provider = getMovieProvider();
  const show = await provider.getShowById(showId);
  if (!show) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ show });
}
