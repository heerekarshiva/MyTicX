import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHash, randomUUID } from 'crypto';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const BUCKET = 'ticket-uploads';

/**
 * Step 1 of selling: upload the raw ticket file BEFORE any typed-in details
 * are trusted. We hash the file's exact bytes (sha256) and reject the
 * upload outright if that same file has already been attached to any
 * non-terminal ticket — regardless of which account uploaded it or what
 * booking ID they typed in alongside it. This is a content-level duplicate
 * check, separate from (and in addition to) the booking-ID fingerprint
 * check that runs later in the verification pipeline.
 *
 * Note: exact-hash matching catches identical re-uploads (the common case —
 * someone re-submitting the same screenshot/PDF). It will not catch a
 * deliberately re-compressed or re-screenshotted copy of the same ticket;
 * a production system would add perceptual/image hashing or OCR-based
 * cross-checks on top of this for that harder case.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only PDF, PNG, JPG, or WEBP files are allowed.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be under 10MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Defense-in-depth against malicious "image" uploads: check real magic
  // bytes rather than trusting the declared MIME type.
  if (!hasPlausibleMagicBytes(buffer, file.type)) {
    return NextResponse.json({ error: 'The file does not appear to be a valid document/image.' }, { status: 400 });
  }

  const fileHash = createHash('sha256').update(buffer).digest('hex');

  const admin = createAdminClient();

  // Content-level duplicate check: has this exact file already been
  // attached to a live ticket anywhere on the platform?
  const { data: existing } = await admin
    .from('tickets')
    .select('id, owner_id')
    .eq('file_hash', fileHash)
    .not('status', 'in', '("REJECTED","CANCELLED","BLOCKED","EXPIRED")')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'This exact ticket file has already been uploaded to MyTICX and cannot be submitted again.' },
      { status: 409 }
    );
  }

  const ext = file.name.split('.').pop() || 'bin';
  const path = `${user.id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[upload-ticket] Supabase storage upload failed:', uploadError.message);
    return NextResponse.json({ error: 'Could not store the file. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ filePath: path, fileHash });
}

function hasPlausibleMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4) return false;
  const sig = buf.subarray(0, 4);
  if (mimeType === 'application/pdf') return sig.toString('ascii', 0, 4) === '%PDF';
  if (mimeType === 'image/png') return sig[0] === 0x89 && sig[1] === 0x50;
  if (mimeType === 'image/jpeg') return sig[0] === 0xff && sig[1] === 0xd8;
  if (mimeType === 'image/webp') return buf.length > 12 && buf.toString('ascii', 8, 12) === 'WEBP';
  return true;
}
