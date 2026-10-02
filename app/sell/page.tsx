'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sellTicketSchema, phoneSchema, otpSchema } from '@/lib/validation/schemas';
import { LANGUAGES } from '@/lib/constants/languages';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Input } from '@/components/ui/Input';
import { OtpInput } from '@/components/ui/OtpInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UploadDropzone } from '@/components/UploadDropzone';
import { MovieAutocomplete } from '@/components/MovieAutocomplete';
import { ConsentModal } from '@/components/ConsentModal';
import { TimeInput } from '@/components/ui/TimeInput';
import { formatTime12h } from '@/lib/utils';

type DetailsForm = z.infer<typeof sellTicketSchema>;

const STEPS = ['Details', 'Upload', 'Price', 'Contact', 'Publish'];
const DRAFT_KEY = 'ticx:sell-draft';

// What's saved to localStorage so a tab switch or accidental navigation
// doesn't lose typed-in progress. The File object itself can't be
// serialized, so a re-selection is the one thing the draft can't restore —
// everything else (movie details, poster, ticket link, chosen price, even
// which step you were on) comes back exactly as left.
interface Draft {
  step: number;
  details: Partial<DetailsForm> | null;
  ticketLink: string;
  posterUrl: string;
  ticketId: string | null;
  priceSuggestion: { min: number; max: number; recommended: number; explanation: string } | null;
  platformFee: number;
  resalePrice: number;
}

export default function SellTicketPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<{ filePath: string; fileHash: string } | null>(null);
  const [ticketLink, setTicketLink] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [priceSuggestion, setPriceSuggestion] = useState<{ min: number; max: number; recommended: number; explanation: string } | null>(null);
  const [platformFee, setPlatformFee] = useState(12);
  const [resalePrice, setResalePrice] = useState<number>(0);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [showConsent, setShowConsent] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, getValues, formState: { errors } } = useForm<DetailsForm>({
    resolver: zodResolver(sellTicketSchema),
    defaultValues: { showTime: '19:00' }
  });
  const showTime = watch('showTime');
  const movieName = watch('movieName');

  const [draftLoaded, setDraftLoaded] = useState(false);

  // Restore a saved draft once, on mount — before the first save-effect runs,
  // so it never immediately overwrites what it just loaded.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: Draft = JSON.parse(raw);
        if (draft.details) reset(draft.details as DetailsForm);
        setTicketLink(draft.ticketLink ?? '');
        setPosterUrl(draft.posterUrl ?? '');
        setTicketId(draft.ticketId ?? null);
        setPriceSuggestion(draft.priceSuggestion ?? null);
        setPlatformFee(draft.platformFee ?? 12);
        setResalePrice(draft.resalePrice ?? 0);
        // Never resume on the Upload step with no file selected — the
        // browser can't restore a File across a reload, so send the seller
        // back one step to re-attach it rather than showing a broken step.
        setStep(draft.step === 1 ? 1 : draft.step ?? 0);
      }
    } catch { /* ignore a corrupt/old draft */ }
    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on every change, once the initial restore is done.
  useEffect(() => {
    if (!draftLoaded || published) return;
    const sub = watch(values => {
      const draft: Draft = { step, details: values, ticketLink, posterUrl, ticketId, priceSuggestion, platformFee, resalePrice };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full/unavailable */ }
    });
    return () => sub.unsubscribe();
  }, [draftLoaded, published, step, ticketLink, posterUrl, ticketId, priceSuggestion, platformFee, resalePrice, watch]);

  // The subscription above only fires on form-field edits — also save when
  // the step or other non-form state changes on its own (e.g. moving from
  // Upload to Price after a successful submit).
  useEffect(() => {
    if (!draftLoaded || published) return;
    try {
      const draft: Draft = { step, details: getValues(), ticketLink, posterUrl, ticketId, priceSuggestion, platformFee, resalePrice };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { /* storage full/unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ticketLink, posterUrl, ticketId, priceSuggestion, platformFee, resalePrice, draftLoaded, published]);

  useEffect(() => {
    if (published) { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }
  }, [published]);

  async function onMoviePicked(movie: { title: string; language: string | null; poster_url: string | null }) {
    setValue('movieName', movie.title, { shouldValidate: true });
    if (movie.language && (LANGUAGES as readonly string[]).includes(movie.language)) {
      setValue('language', movie.language as DetailsForm['language'], { shouldValidate: true });
    }
    if (movie.poster_url) setPosterUrl(movie.poster_url);
  }

  async function onPosterSelected(f: File) {
    setUploadingPoster(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const res = await fetch('/api/posters', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? 'Could not upload poster.'); return; }
      setPosterUrl(data.posterUrl);
    } finally {
      setUploadingPoster(false);
    }
  }

  async function onDetailsSubmit(data: DetailsForm) {
    setDetails(data);
    setStep(1);
  }

  async function onUploadContinue() {
    if (!file) { setUploadError('Please attach a screenshot or PDF of your ticket.'); return; }
    if (!ticketLink.trim()) { setUploadError('Please paste the ticket / booking link.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-ticket', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed.'); return; }
      setFileMeta(data);
      await submitTicket(data);
    } finally {
      setUploading(false);
    }
  }

  // Saves the ticket to Supabase and auto-approves it — the manual review /
  // verification pipeline step has been removed, so this goes straight from
  // "screenshot + link" to eligible-for-listing.
  async function submitTicket(uploadedFile: { filePath: string; fileHash: string }) {
    if (!details) return;
    setSubmitting(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/verify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, ticketLink, posterUrl, filePath: uploadedFile.filePath, fileHash: uploadedFile.fileHash })
      });
      const data = await res.json();
      // TEMP DEBUG: appends the raw Postgres error so it shows up on-screen
      // too, not just the server terminal. Remove the `data.debug` part once
      // you've found the cause.
      if (!res.ok) { setUploadError(data.error ?? 'Could not save this ticket.'); return; }
      setTicketId(data.ticketId);
      setPriceSuggestion(data.priceSuggestion);
      setResalePrice(data.priceSuggestion.recommended);
      setPlatformFee(data.platformFee);
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendOtp() {
    setPhoneError(null);
    const parsed = phoneSchema.safeParse({ phone });
    if (!parsed.success) { setPhoneError(parsed.error.issues[0].message); return; }
    setResending(true);
    setOtp('');
    try {
      const res = await fetch('/api/phone/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await res.json();
      if (!res.ok) { setPhoneError(data.error ?? 'Could not send code.'); return; }
      setOtpSent(true);
    } finally {
      setResending(false);
    }
  }

  async function verifyOtp() {
    setPhoneError(null);
    // The box UI below already caps entry at 6 numeric digits, so this only
    // ever fires with a well-formed code — this check just guards a direct
    // call (e.g. the auto-submit effect) before the state has settled.
    const parsed = otpSchema.safeParse({ otp });
    if (!parsed.success) { setPhoneError(parsed.error.issues[0].message); return; }
    setVerifying(true);
    try {
      const res = await fetch('/api/phone/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp, phone }) });
      const data = await res.json();
      if (!res.ok) { setPhoneError(data.error ?? 'Incorrect code.'); setOtp(''); return; }
      setPhoneVerified(true);
    } finally {
      setVerifying(false);
    }
  }

  // Auto-submit the instant all 6 boxes are filled, like every modern OTP
  // UI — the person shouldn't have to also tap "Verify".
  useEffect(() => {
    if (otpSent && !phoneVerified && otp.length === 8 && !verifying) {
      verifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function publishListing() {
    if (!ticketId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, resalePrice, acceptedTerms: true })
      });
      const data = await res.json();
      if (!res.ok) { setPublishError(data.error ?? 'Could not publish listing.'); setShowConsent(false); return; }
      setPublished(true);
      setShowConsent(false);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page max-w-2xl py-8">
        <h1 className="text-2xl font-bold text-navy-900">Can't make the show?</h1>
        <p className="mt-1 text-slate-500">Turn your unused ticket into value.</p>

        {/* Step indicator */}
        <ol className="mt-6 flex flex-wrap gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li key={label} className={`rounded-full px-3 py-1.5 font-medium ${i === step ? 'bg-brand-gradient text-white' : i < step ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
              {i + 1} {label}
            </li>
          ))}
        </ol>

        <Card className="mt-6">
          {step === 0 && (
            <form className="space-y-4" onSubmit={handleSubmit(onDetailsSubmit)}>
              <Field label="Movie name" error={errors.movieName?.message}>
                <MovieAutocomplete value={movieName ?? ''} onChange={v => setValue('movieName', v, { shouldValidate: true })} onPick={onMoviePicked} />
              </Field>
              <Field label="Language" error={errors.language?.message}>
                <select {...register('language')} className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-navy-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20">
                  <option value="">Select language</option>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Theatre" error={errors.theatre?.message}><Input {...register('theatre')} /></Field>
              <Field label="Location" error={errors.location?.message}><Input {...register('location')} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Show date" error={errors.showDate?.message}><Input type="date" {...register('showDate')} /></Field>
                <Field label="Show time" error={errors.showTime?.message}>
                  <TimeInput value={showTime} onChange={v => setValue('showTime', v, { shouldValidate: true })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ticket price (₹)" error={errors.ticketPrice?.message}><Input type="number" step="0.01" {...register('ticketPrice')} /></Field>
                <Field label="Seat number" error={errors.seatNumber?.message}><Input {...register('seatNumber')} /></Field>
              </div>
              <Field label="Booking / ticket ID" error={errors.bookingId?.message}><Input {...register('bookingId')} /></Field>
              <Button type="submit" className="w-full">Continue</Button>
            </form>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <UploadDropzone onFileSelected={setFile} />
              <Field label="Ticket / booking link">
                <Input
                  placeholder="https://in.bookmyshow.com/..."
                  value={ticketLink}
                  onChange={e => setTicketLink(e.target.value)}
                />
              </Field>
              <Field label="Movie poster (optional — reused for everyone selling this movie)">
                {posterUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={posterUrl} alt="Movie poster" className="h-16 w-16 rounded-lg object-cover" />
                    <button type="button" className="text-xs font-medium text-brand-blue" onClick={() => setPosterUrl('')}>Remove</button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      id="poster-input"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) onPosterSelected(f); }}
                    />
                    <label htmlFor="poster-input" className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-navy-900 hover:bg-slate-50">
                      {uploadingPoster ? 'Uploading…' : 'Upload poster'}
                    </label>
                  </div>
                )}
              </Field>
              <p className="text-xs text-slate-500">
                We check the exact file you upload against everything already on MyTICX — the same screenshot or
                PDF can't be submitted twice, even under a different booking ID. There's no manual review: once
                you continue, your ticket is saved and immediately eligible for listing.
              </p>
              {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
              <Button className="w-full" onClick={onUploadContinue} disabled={uploading || submitting}>
                {uploading ? 'Uploading…' : submitting ? 'Saving…' : 'Continue'}
              </Button>
            </div>
          )}

          {step === 2 && priceSuggestion && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{priceSuggestion.explanation}</p>
              <Field label={`Resale price (₹${priceSuggestion.min.toFixed(0)} – ₹${priceSuggestion.max.toFixed(0)})`}>
                <Input type="number" step="0.01" value={resalePrice} onChange={e => setResalePrice(Number(e.target.value))} />
              </Field>
              <p className="text-xs text-slate-500">Platform fee: ₹{platformFee} (added to the buyer's total, not deducted from your payout).</p>
              <Button
                className="w-full"
                disabled={resalePrice < priceSuggestion.min || resalePrice > priceSuggestion.max}
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {phoneVerified ? (
                <>
                  <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Phone verified ✓</p>
                  <Button className="w-full" onClick={() => setStep(4)}>Continue</Button>
                </>
              ) : !otpSent ? (
                <>
                  <Field label="Mobile number"><Input placeholder="+91XXXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
                  <p className="text-xs text-slate-500">We'll email the verification code to your account email address.</p>
                  {phoneError && <p className="text-sm text-rose-600">{phoneError}</p>}
                  <Button className="w-full" onClick={sendOtp}>Send code</Button>
                </>
              ) : (
                <>
                  <p className="text-center text-xs text-slate-500">Check your email for the 8-digit code.</p>
                  <OtpInput value={otp} onChange={setOtp} length={8} disabled={verifying} />
                  {phoneError && <p className="text-center text-sm text-rose-600">{phoneError}</p>}
                  <Button className="w-full" onClick={verifyOtp} disabled={otp.length !== 8 || verifying}>
                    {verifying ? 'Verifying…' : 'Verify'}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-xs font-medium text-brand-blue disabled:opacity-50"
                    onClick={sendOtp}
                    disabled={resending}
                  >
                    {resending ? 'Resending…' : "Didn't get a code? Resend"}
                  </button>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            published ? (
              <p className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                Your listing is live on the marketplace! Buyers can now find and purchase this ticket.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Review your listing, then publish. You'll be asked to confirm the seller terms.</p>
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <p><strong>{details?.movieName}</strong> — {details?.theatre}, {details?.location}</p>
                  <p>{details?.showDate} • {formatTime12h(details?.showTime)} • Seat {details?.seatNumber}</p>
                  <p className="mt-2 font-semibold text-navy-900">Resale price: ₹{resalePrice.toFixed(0)} (+₹{platformFee} platform fee for the buyer)</p>
                </div>
                {publishError && <p className="text-sm text-rose-600">{publishError}</p>}
                <Button className="w-full" onClick={() => setShowConsent(true)}>Publish Listing</Button>
              </div>
            )
          )}
        </Card>
      </div>

      <ConsentModal
        open={showConsent}
        role="seller"
        loading={publishing}
        onCancel={() => setShowConsent(false)}
        onAccept={publishListing}
      />
      <MobileBottomNav />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-navy-900">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
