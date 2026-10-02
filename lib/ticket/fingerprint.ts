import { createHash } from 'crypto';

/**
 * Deterministic identity fingerprint for a real-world ticket, used to stop
 * the same ticket being uploaded/listed more than once — including by
 * different accounts. Never expose the raw fingerprint to clients; it is
 * used only for a server-side unique constraint (see schema.sql).
 */
export function computeTicketFingerprint(input: {
  provider: string;
  bookingReference: string;
  showId?: string | null;
  seatLabel?: string | null;
}): string {
  const normalized = [
    input.provider.trim().toLowerCase(),
    input.bookingReference.trim().toLowerCase(),
    (input.showId ?? '').trim().toLowerCase(),
    (input.seatLabel ?? '').trim().toLowerCase()
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}
