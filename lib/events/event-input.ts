import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { FIELD_TYPES, sanitizeText } from './fields';
import { zonedToUtc } from './time';
import { registrationDeadline } from './lifecycle';
import { getSettings } from './server';

const clean = (max: number) => z.string().trim().max(max).transform(sanitizeText);
const optional = (max: number) => clean(max).optional().or(z.literal('')).transform(v => v || null);

const fieldSchema = z.object({
  definitionId: z.string().uuid().nullish(),
  key: z.string().trim().max(60).optional(),
  label: clean(80).optional(),
  type: z.enum(FIELD_TYPES as [string, ...string[]]).optional(),
  placeholder: optional(120),
  options: z.array(clean(80)).max(50).optional(),
  required: z.boolean().default(false)
});

export const eventInputSchema = z.object({
  eventTypeId: z.string().uuid('Choose an event type'),
  collegeName: optional(150),
  title: clean(150).pipe(z.string().min(2, 'Enter an event name')),
  organizerName: clean(100).pipe(z.string().min(2, 'Enter the organizer name')),
  organizerEmail: z.string().trim().toLowerCase().email('Enter a valid organizer email').max(150),
  description: optional(1000),
  details: optional(2000),
  posterUrl: z.string().url().max(600).optional().or(z.literal('')).transform(v => v || null),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a start time'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick an end time'),
  venue: clean(200).pipe(z.string().min(2, 'Enter the venue')),
  city: optional(100),
  registrationType: z.enum(['FREE', 'PAID']),
  price: z.coerce.number().min(0, 'Price cannot be negative').default(0),
  upiId: z.string().trim().regex(/^[\w.+-]{2,256}@[a-zA-Z]{2,64}$/, 'Enter a valid UPI ID, e.g. name@bank').optional().or(z.literal('')).transform(v => v || null),
  payeeName: optional(100),
  capacity: z.coerce.number().int().positive().max(1_000_000).optional().or(z.literal('')).transform(v => (v === '' || v === undefined ? null : v)),
  templateId: z.string().uuid().nullish(),
  fields: z.array(fieldSchema).max(60),
  publish: z.boolean().default(false)
});
export type EventInput = z.infer<typeof eventInputSchema>;

const keyify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 40);

/** Validates + normalises an organizer payload into DB rows. Returns {error} or {event, fields}. */
export async function buildEvent(input: EventInput, opts: { scheduleLocked?: boolean; existing?: any } = {}) {
  const admin = createAdminClient();
  const settings = await getSettings();
  const tz = settings.timezone as string;

  const { data: type } = await admin.from('event_types').select('*').eq('id', input.eventTypeId).maybeSingle();
  if (!type || !type.is_active) return { error: 'This event type is not available.' };
  if (type.collect_college_name && !input.collegeName) return { error: 'Enter the college name.' };

  // ---- schedule (server is the authority, in the platform timezone)
  let start_at: Date, end_at: Date;
  if (opts.scheduleLocked && opts.existing) {
    start_at = new Date(opts.existing.start_at); end_at = new Date(opts.existing.end_at);
  } else {
    start_at = zonedToUtc(input.eventDate, input.startTime, tz);
    end_at = zonedToUtc(input.eventDate, input.endTime, tz);
    if (isNaN(start_at.getTime()) || isNaN(end_at.getTime())) return { error: 'Invalid date or time.' };
    if (end_at <= start_at) return { error: 'Event start time must be before the end time.' };
    if (!opts.existing || start_at.getTime() !== new Date(opts.existing.start_at).getTime()) {
      if (start_at.getTime() <= Date.now()) return { error: 'Event date and time cannot be in the past.' };
    }
  }
  const closes = registrationDeadline(start_at, Number(settings.registration_cutoff_minutes) || 30);
  if (input.publish && closes.getTime() <= Date.now()) {
    return { error: `Registration closes ${settings.registration_cutoff_minutes} minutes before the start, so the event must start further in the future.` };
  }

  // ---- payment
  let price = 0, upi: string | null = null, payee: string | null = null;
  if (input.registrationType === 'PAID') {
    if (!type.allow_paid || !settings.allow_paid_events) return { error: 'Paid events are not enabled for this event type.' };
    if (!(input.price > 0)) return { error: 'Enter a ticket price greater than 0.' };
    if (input.price > Number(settings.max_price)) return { error: `Price cannot exceed ₹${settings.max_price}.` };
    if (!input.upiId || !input.payeeName) return { error: 'Enter the UPI ID and payee name where payments should go.' };
    price = Math.round(input.price * 100) / 100; upi = input.upiId; payee = input.payeeName;
  }

  // ---- participant fields: definitions come from the DB, never from the client
  let template: any = null;
  if (input.templateId) {
    const { data } = await admin.from('event_templates').select('*').eq('id', input.templateId).eq('event_type_id', type.id).maybeSingle();
    template = data;
  }
  let requested = input.fields;
  if (template && (!template.allow_customization || !type.allow_field_editing)) {
    const { data: tf } = await admin.from('event_template_fields').select('field_definition_id, is_required, sort_order').eq('template_id', template.id).order('sort_order');
    requested = (tf ?? []).map(r => ({ definitionId: r.field_definition_id, required: r.is_required, placeholder: null }));
  }
  if (requested.length === 0) return { error: 'Choose at least one piece of participant information to collect.' };
  if (requested.filter(f => !f.definitionId).length > Number(settings.max_custom_fields)) return { error: 'Too many custom fields.' };

  const ids = requested.map(f => f.definitionId).filter(Boolean) as string[];
  const { data: defs } = ids.length ? await admin.from('field_definitions').select('*').in('id', ids).eq('is_active', true) : { data: [] as any[] };
  const defMap = new Map((defs ?? []).map(d => [d.id, d]));
  const seen = new Set<string>();
  const fields: any[] = [];
  for (const [i, f] of requested.entries()) {
    let row: any;
    if (f.definitionId) {
      const d = defMap.get(f.definitionId);
      if (!d) return { error: 'One of the selected fields is no longer available.' };
      row = { definition_id: d.id, field_key: d.key, label: f.label || d.label, field_type: d.field_type, placeholder: f.placeholder ?? d.placeholder, options: d.options, validation: d.validation, is_required: f.required };
    } else {
      if (!type.allow_custom_fields) return { error: 'Custom fields are not allowed for this event type.' };
      const label = f.label?.trim();
      if (!label || !f.type) return { error: 'Every custom field needs a name and a type.' };
      if (f.type === 'dropdown' && (!f.options || f.options.filter(Boolean).length < 2)) return { error: `Add at least two options to “${label}”.` };
      row = { definition_id: null, field_key: keyify(f.key || label) || `field_${i}`, label, field_type: f.type, placeholder: f.placeholder ?? null, options: f.type === 'dropdown' ? (f.options ?? []).filter(Boolean) : [], validation: {}, is_required: f.required };
    }
    let k = row.field_key, n = 2;
    while (seen.has(k)) k = `${row.field_key}_${n++}`;
    row.field_key = k; seen.add(k); row.sort_order = i;
    fields.push(row);
  }

  const event = {
    event_type: type.name, event_type_id: type.id, template_id: template?.id ?? null,
    college_name: type.collect_college_name ? input.collegeName : null,
    title: input.title, organizer_name: input.organizerName, organizer_email: input.organizerEmail,
    description: input.description, details: input.details, poster_url: input.posterUrl,
    venue: input.venue, city: input.city,
    start_at: start_at.toISOString(), end_at: end_at.toISOString(),
    // legacy columns kept populated so old queries/pages keep working
    event_date: input.eventDate, event_time: input.startTime,
    registration_closes_at: closes.toISOString(),
    registration_type: input.registrationType, amount: price, currency: 'INR',
    organizer_upi_id: upi, organizer_payee_name: payee, capacity: input.capacity as number | null,
    updated_at: new Date().toISOString()
  };
  return { event, fields };
}

export async function replaceFields(eventId: string, fields: any[]) {
  const admin = createAdminClient();
  await admin.from('event_fields').delete().eq('event_id', eventId);
  if (fields.length) await admin.from('event_fields').insert(fields.map(f => ({ ...f, event_id: eventId })));
}
