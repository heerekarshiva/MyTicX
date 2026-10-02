import { z } from 'zod';

export const EVENT_TYPES = ['Concert', 'Meetup', 'Workshop', 'Competition', 'Sports', 'Other'] as const;

export const createEventSchema = z.object({
  eventType: z.enum(EVENT_TYPES, { errorMap: () => ({ message: 'Select an event type' }) }),
  title: z.string().trim().min(2, 'Enter a title').max(150),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  details: z.string().trim().max(2000).optional().or(z.literal('')),
  venue: z.string().trim().max(150).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  eventDate: z.string().min(1, 'Pick a date'),
  eventTime: z.string().min(1, 'Pick a time'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative').max(1000000),
  organizerUpiId: z.string().trim().regex(/^[\w.+-]{2,256}@[a-zA-Z]{2,64}$/, 'Enter a valid UPI ID, e.g. name@bank'),
  organizerPayeeName: z.string().trim().min(1).max(100),
  posterUrl: z.string().url().max(600).optional().or(z.literal('')),
  capacity: z.coerce.number().int().positive().max(1000000).optional()
});

export const registerEventSchema = z.object({
  eventId: z.string().uuid()
});

export const submitEventUtrSchema = z.object({
  registrationId: z.string().uuid(),
  utr: z.string().trim().min(4, 'Enter the UPI transaction / reference number (UTR)').max(64)
});

export const confirmEventRegSchema = z.object({
  registrationId: z.string().uuid(),
  action: z.enum(['confirm', 'reject'])
});
