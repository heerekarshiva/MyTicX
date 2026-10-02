import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sellTicketSchema } from '@/lib/validation/schemas';
import { computeTicketFingerprint } from '@/lib/ticket/fingerprint';
import { suggestResalePrice, calculatePlatformFee } from '@/lib/config/pricing';

// NOTE: the automated verification pipeline (lib/ticket/verification.ts —
// movie/theatre/price cross-checks) has been removed from this route by
// request. A ticket is now auto-approved as soon as the file + link are
// submitted. What is KEPT below is the duplicate-file / fingerprint uniqueness
// check: that's a database-level guard against the same real ticket being
// listed twice, not a "verification" UX step, and removing it would let one
// screenshot back multiple live listings at once. If you also want that
// gone, delete the `existingFile` block and the unique indexes in
// supabase/schema.sql (uq_tickets_fingerprint_active / uq_tickets_file_hash_active).

const submissionSchema = sellTicketSchema.extend({
  filePath: z.string().optional(),
  fileHash: z.string().optional()
});

type Admin = ReturnType<typeof createAdminClient>;
const esc = (v: string) => v.replace(/[%_\\]/g, m => '\\' + m);

// Movie / theatre / show rows are what the marketplace view joins on. Without
// them a listing has no title, poster or language on the home page.
async function ensureShow(admin: Admin, input: z.infer<typeof submissionSchema>) {
  const title = input.movieName.trim();
  const posterOk = input.posterUrl && input.posterUrl.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/movie-posters/`);
  const poster = posterOk ? input.posterUrl! : null;

  let { data: movie } = await admin.from('movies').select('id, poster_url').ilike('title', esc(title)).ilike('language', esc(input.language)).maybeSingle();
  if (!movie) {
    const ins = await admin.from('movies').insert({ title, language: input.language, poster_url: poster }).select('id, poster_url').single();
    if (ins.error) {
      const again = await admin.from('movies').select('id, poster_url').ilike('title', esc(title)).ilike('language', esc(input.language)).maybeSingle();
      movie = again.data;
    } else movie = ins.data;
  } else if (!movie.poster_url && poster) {
    await admin.from('movies').update({ poster_url: poster }).eq('id', movie.id);
  }
  if (!movie) throw new Error('movie upsert failed');

  const city = input.location.trim();
  let { data: loc } = await admin.from('locations').select('id').ilike('city', esc(city)).limit(1).maybeSingle();
  if (!loc) {
    const ins = await admin.from('locations').insert({ city, country: 'IN' }).select('id').single();
    if (ins.error) throw new Error('location insert failed: ' + ins.error.message);
    loc = ins.data;
  }

  const theatreName = input.theatre.trim();
  let { data: theatre } = await admin.from('theatres').select('id').ilike('name', esc(theatreName)).eq('location_id', loc.id).maybeSingle();
  if (!theatre) {
    const ins = await admin.from('theatres').insert({ name: theatreName, location_id: loc.id }).select('id').single();
    if (ins.error) {
      const again = await admin.from('theatres').select('id').ilike('name', esc(theatreName)).eq('location_id', loc.id).maybeSingle();
      theatre = again.data;
    } else theatre = ins.data;
  }
  if (!theatre) throw new Error('theatre upsert failed');

  let { data: show } = await admin.from('shows').select('id').eq('movie_id', movie.id).eq('theatre_id', theatre.id).eq('show_date', input.showDate).eq('show_time', input.showTime).maybeSingle();
  if (!show) {
    const ins = await admin.from('shows').insert({ movie_id: movie.id, theatre_id: theatre.id, show_date: input.showDate, show_time: input.showTime, base_price: input.ticketPrice }).select('id').single();
    if (ins.error) throw new Error('show insert failed: ' + ins.error.message);
    show = ins.data;
  }
  return show.id as string;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const json = await req.json();
  const parsed = submissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid ticket details', issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const admin = createAdminClient();

  // Content-level duplicate re-check (defense in depth — /api/upload-ticket
  // already rejected an exact re-upload before this point, but we don't
  // trust the client to have actually gone through that step honestly).
  if (input.fileHash) {
    const { data: existingFile } = await admin
      .from('tickets')
      .select('id')
      .eq('file_hash', input.fileHash)
      .not('status', 'in', '("REJECTED","CANCELLED","BLOCKED","EXPIRED")')
      .maybeSingle();
    if (existingFile) {
      return NextResponse.json({ error: 'This ticket file has already been submitted.' }, { status: 409 });
    }
  }

  const fingerprint = computeTicketFingerprint({
    provider: 'manual',
    bookingReference: input.bookingId,
    seatLabel: input.seatNumber
  });

  let showId: string;
  try {
    showId = await ensureShow(admin, input);
  } catch (e) {
    console.error('[verify-ticket] ensureShow failed:', e);
    return NextResponse.json({ error: 'Could not save the movie details. Make sure migration 0005 has been run in Supabase.' }, { status: 500 });
  }

  // Auto-approve straight away — status goes directly to VERIFIED, skipping
  // the old VERIFYING → pipeline → VERIFIED/REJECTED path.
  const { data: ticket, error: insertError } = await admin
    .from('tickets')
    .insert({
      owner_id: user.id,
      show_id: showId,
      provider: 'manual',
      booking_reference: input.bookingId,
      seat_label: input.seatNumber,
      original_price: input.ticketPrice,
      fingerprint,
      file_path: input.filePath ?? null,
      file_hash: input.fileHash ?? null,
      ticket_link: input.ticketLink || null,
      status: 'VERIFIED',
      verification_status: 'DOCUMENT_VERIFIED',
      extracted_data: input
    })
    .select()
    .single();

  if (insertError) {
    // Full error goes to server logs only — never to the client. Raw
    // Postgres errors can leak schema/constraint details that shouldn't be
    // exposed over the API.
    console.error('[verify-ticket] tickets insert failed:', insertError);
    const message = insertError.code === '23505'
      ? 'This ticket has already been submitted or listed on MyTICX.'
      : 'Could not save the ticket. Please check the details and try again.';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // Single audit-trail row so there's still a record of how the ticket was
  // approved (useful for disputes), even with the pipeline gone.
  await admin.from('ticket_verifications').insert({
    ticket_id: ticket.id,
    step: 'auto_approved',
    passed: true,
    detail: 'Verification pipeline skipped — auto-approved on submission.'
  });

  const suggestion = suggestResalePrice({
    originalPrice: input.ticketPrice,
    hoursUntilShow: Math.max(1, (new Date(`${input.showDate}T${input.showTime}`).getTime() - Date.now()) / 3600000),
    activeResaleListingsForShow: 0
  });

  return NextResponse.json({
    ticketId: ticket.id,
    result: {
      overallStatus: 'DOCUMENT_VERIFIED',
      ticketStatus: 'VERIFIED',
      steps: [{ step: 'auto_approved', label: 'Ticket submitted', passed: true, detail: 'Auto-approved — no manual review step.' }]
    },
    priceSuggestion: suggestion,
    platformFee: calculatePlatformFee(suggestion.recommended)
  });
}
