import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 3 * 1024 * 1024;

// Uploads a movie poster to the public "movie-posters" bucket and returns its
// public URL. The URL is saved on the movie row when the ticket is submitted.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Poster must be a JPG, PNG or WEBP image.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Poster must be under 3MB.' }, { status: 400 });

  const admin = createAdminClient();
  const path = `${user.id}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('movie-posters').upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: false
  });
  if (error) {
    console.error('[posters] upload failed:', error.message);
    return NextResponse.json({ error: 'Could not upload the poster. Make sure migration 0005 has been run.' }, { status: 500 });
  }
  const { data } = admin.storage.from('movie-posters').getPublicUrl(path);
  return NextResponse.json({ posterUrl: data.publicUrl });
}
