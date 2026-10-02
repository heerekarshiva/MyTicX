import 'server-only';
import { getMovieProvider } from '@/lib/providers/movie-provider';
import { computeTicketFingerprint } from '@/lib/ticket/fingerprint';
import { createAdminClient } from '@/lib/supabase/admin';
import type { VerificationPipelineResult, VerificationStepResult } from '@/types';

export interface RawTicketSubmission {
  movieName: string;
  theatre: string;
  location: string;
  showDate: string;
  showTime: string;
  ticketPrice: number;
  seatNumber: string;
  bookingId: string;
  ownerId: string;
}

/**
 * Server-side verification pipeline. Mirrors spec section 12: never trusts
 * a ticket just because it "looks real" — every check must explicitly pass,
 * and duplicate/fingerprint checks happen against the database with a
 * unique constraint as the final backstop (see schema.sql).
 *
 * This never returns a false "100% verified". It distinguishes
 * DOCUMENT_VERIFIED (internal checks passed, no authoritative source) from
 * PROVIDER_VERIFIED (confirmed against the real ticket provider's API,
 * which is not connected in this build) as required by the spec.
 */
export async function runVerificationPipeline(input: RawTicketSubmission): Promise<VerificationPipelineResult> {
  const steps: VerificationStepResult[] = [];
  const provider = getMovieProvider();
  const admin = createAdminClient();

  // Step 1: does the movie/show exist in our catalog?
  const matches = await provider.searchShows({ movie: input.movieName, location: input.location });
  const showMatch = matches.find(m =>
    m.theatreName.toLowerCase() === input.theatre.trim().toLowerCase() &&
    m.showTimes.includes(input.showTime)
  );
  steps.push({
    step: 'movie_theatre_match',
    label: 'Movie & theatre found',
    passed: Boolean(showMatch),
    detail: showMatch ? undefined : 'No matching movie/theatre/show-time combination was found.'
  });

  // Step 2: is the show still upcoming (not already happened)?
  const showDateTime = showMatch ? new Date(`${input.showDate}T${input.showTime}:00`) : null;
  const isUpcoming = showDateTime ? showDateTime.getTime() > Date.now() : false;
  steps.push({
    step: 'show_upcoming',
    label: 'Show has not already started',
    passed: isUpcoming,
    detail: isUpcoming ? undefined : 'This show date/time has already passed.'
  });

  // Step 3: basic format validation on the booking ID / seat.
  const idFormatOk = /^[A-Za-z0-9\-]{3,80}$/.test(input.bookingId);
  steps.push({
    step: 'ticket_format',
    label: 'Ticket ID format valid',
    passed: idFormatOk,
    detail: idFormatOk ? undefined : 'Booking/ticket ID contains unexpected characters.'
  });

  // Step 4: fingerprint + duplicate check against the database.
  const fingerprint = computeTicketFingerprint({
    provider: 'manual',
    bookingReference: input.bookingId,
    showId: showMatch?.movieId ?? null,
    seatLabel: input.seatNumber
  });
  const { data: existing } = await admin
    .from('tickets')
    .select('id,status')
    .eq('fingerprint', fingerprint)
    .not('status', 'in', '("REJECTED","CANCELLED","BLOCKED","EXPIRED")')
    .maybeSingle();
  const noDuplicate = !existing;
  steps.push({
    step: 'duplicate_check',
    label: 'Duplicate check completed',
    passed: noDuplicate,
    detail: noDuplicate ? undefined : 'This ticket has already been submitted or listed.'
  });

  const allPassed = steps.every(s => s.passed);

  return {
    overallStatus: allPassed ? 'DOCUMENT_VERIFIED' : 'REJECTED',
    ticketStatus: allPassed ? 'VERIFIED' : 'REJECTED',
    steps,
    rejectionReason: allPassed ? undefined : steps.find(s => !s.passed)?.detail
  };
}
