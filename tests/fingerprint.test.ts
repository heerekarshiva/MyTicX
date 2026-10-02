import { describe, it, expect } from 'vitest';
import { computeTicketFingerprint } from '@/lib/ticket/fingerprint';

describe('ticket fingerprint', () => {
  it('is deterministic for identical inputs', () => {
    const a = computeTicketFingerprint({ provider: 'manual', bookingReference: 'ABC123', seatLabel: 'F12' });
    const b = computeTicketFingerprint({ provider: 'manual', bookingReference: 'abc123', seatLabel: 'f12' });
    expect(a).toBe(b); // case-insensitive normalization
  });

  it('differs when the booking reference differs', () => {
    const a = computeTicketFingerprint({ provider: 'manual', bookingReference: 'ABC123' });
    const b = computeTicketFingerprint({ provider: 'manual', bookingReference: 'XYZ999' });
    expect(a).not.toBe(b);
  });
});
