import { NextRequest, NextResponse } from 'next/server';

// Movie suggestions with IMDb rating (OMDb) and OTT platforms (TMDB watch providers).
// OMDB_API_KEY is required for ratings; TMDB_API_KEY is optional and adds OTT info.
const PICKS = ['Oppenheimer', 'Inside Out 2', 'Interstellar', 'Spider-Man: Across the Spider-Verse', 'Deadpool & Wolverine', 'Dune: Part Two', 'Inception', 'The Dark Knight'];

async function one(title: string, region: string) {
  const omdb = process.env.OMDB_API_KEY;
  const tmdb = process.env.TMDB_API_KEY;
  let rating: string | null = null, poster: string | null = null, year: string | null = null, genre: string | null = null;
  if (omdb) {
    const r = await fetch(`https://www.omdbapi.com/?apikey=${omdb}&t=${encodeURIComponent(title)}`, { next: { revalidate: 86400 } }).then(x => x.json()).catch(() => null);
    if (r?.Response === 'True') {
      rating = r.imdbRating && r.imdbRating !== 'N/A' ? r.imdbRating : null;
      poster = r.Poster && r.Poster !== 'N/A' ? r.Poster : null;
      year = r.Year; genre = r.Genre;
    }
  }
  let ott: string[] = [];
  if (tmdb) {
    const s = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${tmdb}&query=${encodeURIComponent(title)}`, { next: { revalidate: 86400 } }).then(x => x.json()).catch(() => null);
    const id = s?.results?.[0]?.id;
    if (id) {
      const w = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${tmdb}`, { next: { revalidate: 86400 } }).then(x => x.json()).catch(() => null);
      const p = w?.results?.[region];
      ott = [...(p?.flatrate ?? []), ...(p?.rent ?? [])].map((x: any) => x.provider_name).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).slice(0, 4);
    }
  }
  return { title, rating, poster, year, genre, ott };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const titles = q ? [q] : PICKS;
  const items = await Promise.all(titles.map(t => one(t, 'IN')));
  return NextResponse.json({ items, configured: { imdb: !!process.env.OMDB_API_KEY, ott: !!process.env.TMDB_API_KEY } });
}
