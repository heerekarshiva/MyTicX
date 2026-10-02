// Pure lifecycle logic (no I/O) so it is unit-testable and shared by server
// reads, the cron sync and the registration guard.
export type EventStatus =
  'DRAFT' | 'PUBLISHED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'SUSPENDED';

export interface LifecycleEvent {
  status: EventStatus | string;
  start_at: string | null;
  end_at: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
}

export const DEFAULT_CUTOFF_MINUTES = 30;

/** registration closes exactly `cutoffMinutes` before the event starts. */
export function registrationDeadline(start: Date, cutoffMinutes = DEFAULT_CUTOFF_MINUTES): Date {
  return new Date(start.getTime() - cutoffMinutes * 60_000);
}

const MANUAL = new Set(['DRAFT', 'CANCELLED', 'SUSPENDED']);

export function effectiveStatus(ev: LifecycleEvent, now = new Date()): EventStatus {
  if (MANUAL.has(ev.status)) return ev.status as EventStatus;
  if (!ev.start_at) return ev.status as EventStatus;
  const t = now.getTime();
  const start = new Date(ev.start_at).getTime();
  const end = ev.end_at ? new Date(ev.end_at).getTime() : start + 3 * 3600_000;
  const closes = ev.registration_closes_at ? new Date(ev.registration_closes_at).getTime() : start - DEFAULT_CUTOFF_MINUTES * 60_000;
  const opens = ev.registration_opens_at ? new Date(ev.registration_opens_at).getTime() : null;
  if (t >= end) return 'COMPLETED';
  if (t >= start) return 'ONGOING';
  if (t >= closes) return 'REGISTRATION_CLOSED';
  if (opens === null || t >= opens) return 'REGISTRATION_OPEN';
  return 'PUBLISHED';
}

export function isRegistrationOpen(ev: LifecycleEvent, now = new Date()): boolean {
  return effectiveStatus(ev, now) === 'REGISTRATION_OPEN';
}

/** Discovery = listed publicly. Closed/ongoing/completed events drop out. */
export function isDiscoverable(ev: LifecycleEvent, now = new Date()): boolean {
  const s = effectiveStatus(ev, now);
  return s === 'REGISTRATION_OPEN' || s === 'PUBLISHED';
}

/** Schedule fields that must not change once the event has started. */
export function canEditSchedule(ev: LifecycleEvent, now = new Date()): boolean {
  const s = effectiveStatus(ev, now);
  return s !== 'ONGOING' && s !== 'COMPLETED' && s !== 'CANCELLED';
}

// Participant-facing payment labels mapped onto the existing enum
// (event_reg_status) so legacy rows keep working.
export const PAYMENT_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'PAYMENT_REQUIRED',
  SUBMITTED: 'PAYMENT_PROCESSING',
  CONFIRMED: 'PAID',
  REJECTED: 'PAYMENT_FAILED',
  CANCELLED: 'CANCELLED'
};
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', PUBLISHED: 'Published', REGISTRATION_OPEN: 'Registration open', REGISTRATION_CLOSED: 'Registration closed',
  ONGOING: 'Ongoing', COMPLETED: 'Completed', CANCELLED: 'Cancelled', SUSPENDED: 'Suspended'
};
