import { z } from 'zod';
import { LANGUAGES } from '@/lib/constants/languages';

export const signUpSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name').max(100),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters')
});

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required')
});

export const movieSearchSchema = z.object({
  movie: z.string().trim().min(1, 'Enter a movie name').max(100),
  location: z.string().trim().min(1, 'Enter a city or theatre').max(100)
});

export const sellTicketSchema = z.object({
  movieName: z.string().trim().min(1, 'Enter the movie name').max(150),
  language: z.enum(LANGUAGES, { errorMap: () => ({ message: 'Select the movie language' }) }),
  posterUrl: z.string().url().max(600).optional().or(z.literal('')),
  theatre: z.string().min(1).max(150),
  location: z.string().min(1).max(150),
  showDate: z.string().min(1),
  showTime: z.string().min(1),
  ticketPrice: z.coerce.number().positive('Must be greater than 0').max(100000),
  seatNumber: z.string().min(1).max(30),
  bookingId: z.string().min(3, 'Enter the booking / ticket ID').max(80),
  ticketLink: z.string().trim().url('Enter a valid link (https://...)').max(500).optional().or(z.literal(''))
});

export const phoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Enter a valid phone number with country code')
});

export const otpSchema = z.object({
  otp: z.string().length(8, 'Enter the 8-digit code')
});

// Used to verify a phone OTP: the code itself (checked by Supabase Auth)
// plus the phone number being verified, so it can be saved once the code
// checks out.
export const verifyPhoneOtpSchema = otpSchema.merge(phoneSchema);

export const purchaseRequestSchema = z.object({
  listingId: z.string().uuid(),
  acceptedRisk: z.literal(true, { errorMap: () => ({ message: 'You must accept the buyer terms to complete a purchase.' }) })
});

// Seller's own UPI ID, entered once in their profile — never hardcoded into
// the app. Used to build the "pay via UPI" QR shown to buyers on an order.
export const upiIdSchema = z.object({
  upiId: z.string().trim().regex(/^[\w.+-]{2,256}@[a-zA-Z]{2,64}$/, 'Enter a valid UPI ID, e.g. name@bank'),
  upiPayeeName: z.string().trim().min(1).max(100)
});

// Buyer-submitted proof of a manual UPI payment (no payment-gateway API is
// involved — see lib/providers/payment-provider.ts for why this can't be
// verified automatically). Requires the UTR/reference number; a screenshot
// is optional but recommended.
export const manualPaymentSubmitSchema = z.object({
  orderId: z.string().uuid(),
  utr: z.string().trim().min(4, 'Enter the UPI transaction / reference number (UTR)').max(64),
  screenshotPath: z.string().max(500).optional()
});

export const manualPaymentConfirmSchema = z.object({
  paymentId: z.string().uuid()
});
