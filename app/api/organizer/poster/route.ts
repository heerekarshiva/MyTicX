import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireOrganizer, sameOrigin, limited, getSettings, fail, json } from '@/lib/events/server';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const magic = (b: Buffer, t: string) =>
  t === 'image/png' ? b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) :
  t === 'image/jpeg' ? b[0] === 0xff && b[1] === 0xd8 :
  b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  if (limited(req, 'poster', g.ctx.user.id, 20)) return fail('Too many uploads. Try again shortly.', 429);
  const file = (await req.formData()).get('file');
  if (!(file instanceof File)) return fail('No file provided.');
  const ext = TYPES[file.type];
  if (!ext) return fail('Poster must be a JPG, JPEG, PNG or WebP image.');
  const maxMb = Number((await getSettings()).max_poster_mb) || 5;
  if (file.size > maxMb * 1024 * 1024) return fail(`Poster must be under ${maxMb}MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!magic(buf, file.type)) return fail('That file is not a valid image.');
  const path = `${g.ctx.user.id}/${randomUUID()}.${ext}`;
  const { error } = await g.ctx.admin.storage.from('event-posters').upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return fail('Could not store the poster. Make sure migration 0008 has been run.', 500);
  const { data } = g.ctx.admin.storage.from('event-posters').getPublicUrl(path);
  return json({ url: data.publicUrl });
}
