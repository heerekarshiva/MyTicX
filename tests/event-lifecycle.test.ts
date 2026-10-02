import { describe, it, expect } from 'vitest';
import { effectiveStatus, registrationDeadline, isRegistrationOpen, isDiscoverable, canEditSchedule } from '@/lib/events/lifecycle';
import { zonedToUtc, dayOfWeek } from '@/lib/events/time';
import { validateAnswers, maskPhone, type FieldConfig } from '@/lib/events/fields';

const tz = 'Asia/Kolkata';
const start = zonedToUtc('2026-10-05', '18:00', tz); // 6:00 PM IST
const ev = (over: object = {}) => ({ status: 'PUBLISHED', start_at: start.toISOString(), end_at: zonedToUtc('2026-10-05', '21:00', tz).toISOString(), registration_opens_at: null, registration_closes_at: registrationDeadline(start).toISOString(), ...over });
const at = (h: string) => zonedToUtc('2026-10-05', h, tz);

describe('timezone', () => {
  it('6 PM IST is 12:30 UTC', () => expect(start.toISOString()).toBe('2026-10-05T12:30:00.000Z'));
  it('day of week', () => expect(dayOfWeek('2026-10-05')).toBe('Monday'));
});

describe('30-minute registration cutoff', () => {
  it('deadline is exactly 5:30 PM for a 6:00 PM event', () => expect(registrationDeadline(start).toISOString()).toBe(at('17:30').toISOString()));
  it('open at 5:29:59', () => expect(isRegistrationOpen(ev(), new Date(at('17:30').getTime() - 1000))).toBe(true));
  it('closed at exactly 5:30:00', () => expect(isRegistrationOpen(ev(), at('17:30'))).toBe(false));
  it('closed at 5:45 but event not started', () => expect(effectiveStatus(ev(), at('17:45'))).toBe('REGISTRATION_CLOSED'));
  it('drops out of discovery once closed', () => { expect(isDiscoverable(ev(), at('17:00'))).toBe(true); expect(isDiscoverable(ev(), at('17:31'))).toBe(false); });
  it('custom cutoff respected', () => expect(registrationDeadline(start, 60).toISOString()).toBe(at('17:00').toISOString()));
});

describe('status lifecycle', () => {
  it('ONGOING at start', () => expect(effectiveStatus(ev(), at('18:00'))).toBe('ONGOING'));
  it('COMPLETED at end', () => expect(effectiveStatus(ev(), at('21:00'))).toBe('COMPLETED'));
  it('PUBLISHED before opens_at', () => expect(effectiveStatus(ev({ registration_opens_at: at('10:00').toISOString() }), at('09:00'))).toBe('PUBLISHED'));
  it('manual states never auto-advance', () => { for (const s of ['DRAFT', 'CANCELLED', 'SUSPENDED']) expect(effectiveStatus(ev({ status: s }), at('19:00'))).toBe(s); });
  it('schedule locked once started', () => { expect(canEditSchedule(ev(), at('12:00'))).toBe(true); expect(canEditSchedule(ev(), at('18:30'))).toBe(false); });
});

describe('dynamic field validation', () => {
  const f = (o: Partial<FieldConfig>): FieldConfig => ({ field_key: 'k', label: 'K', field_type: 'text', options: [], validation: {}, is_required: true, ...o });
  it('required', () => expect(validateAnswers([f({})], { k: '' }).ok).toBe(false));
  it('optional empty ok', () => expect(validateAnswers([f({ is_required: false })], {}).ok).toBe(true));
  it('email', () => { expect(validateAnswers([f({ field_type: 'email' })], { k: 'nope' }).ok).toBe(false); expect(validateAnswers([f({ field_type: 'email' })], { k: 'a@b.co' }).ok).toBe(true); });
  it('dropdown only accepts listed options', () => expect(validateAnswers([f({ field_type: 'dropdown', options: ['CSE', 'ECE'] })], { k: 'MBA' }).ok).toBe(false));
  it('number range', () => expect(validateAnswers([f({ field_type: 'number', validation: { min: 1, max: 120 } })], { k: '200' }).ok).toBe(false));
  it('strips markup characters', () => expect(validateAnswers([f({})], { k: '<b>hi</b>' }).values.k).toBe('bhi/b'));
  it('masks phone', () => expect(maskPhone('9876543210')).toBe('********10'));
});
