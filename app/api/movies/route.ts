import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Movie autocomplete for the sell form. Returns existing movies (with their
// saved poster + language) so a second seller of the same movie can reuse the
// poster instead of uploading another one.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/[%_,()\\]/g, ' ').slice(0, 80);
  if (q.length < 2) return NextResponse.json({ movies: [] });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('movies')
    .select('id, title, language, poster_url')
    .ilike('title', `%${q}%`)
    .order('title')
    .limit(8);
  if (error) return NextResponse.json({ movies: [] });
  return NextResponse.json({ movies: data ?? [] });
}
