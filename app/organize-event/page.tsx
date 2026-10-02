'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, CalendarDays, UploadCloud, Check, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DynamicForm } from '@/components/events/DynamicForm';
import { FieldBuilder, fromLibrary, type BuilderField, type LibraryField } from '@/components/events/FieldBuilder';
import { dayOfWeek, hhmm, ymd } from '@/lib/events/time';
import type { FieldConfig } from '@/lib/events/fields';

interface EType { id: string; key: string; name: string; description: string | null; icon: string; collect_college_name: boolean; allow_paid: boolean; allow_custom_fields: boolean; allow_field_editing: boolean }
interface Template { id: string; event_type_id: string; name: string; is_default: boolean; allow_customization: boolean; fields: { field_definition_id: string; is_required: boolean }[] }
interface Config { types: EType[]; fieldLibrary: LibraryField[]; templates: Template[]; settings: { cutoffMinutes: number; timezone: string; allowPaid: boolean; maxPrice: number; maxPosterMb: number; maxCustomFields: number } }

const empty = { collegeName: '', title: '', organizerName: '', organizerEmail: '', description: '', details: '', posterUrl: '', eventDate: '', startTime: '', endTime: '', venue: '', city: '', registrationType: 'FREE', price: '', upiId: '', payeeName: '', capacity: '' };
const icons: Record<string, any> = { 'graduation-cap': GraduationCap, calendar: CalendarDays };
const F = ({ label, error, children, req }: { label: string; error?: string; children: React.ReactNode; req?: boolean }) => (
  <div><label className="mb-1 block text-sm font-medium text-navy-900">{label}{req && <span className="text-rose-600"> *</span>}</label>{children}{error && <p className="mt-1 text-xs text-rose-600">{error}</p>}</div>
);

function Wizard() {
  const router = useRouter();
  const editId = useSearchParams().get('edit');
  const [cfg, setCfg] = useState<Config | null>(null);
  const [step, setStep] = useState(0); // 0 type, 1 details, 2 participant info, 3 review
  const [type, setType] = useState<EType | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [f, setF] = useState({ ...empty });
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [locks, setLocks] = useState({ schedule: false, fields: false, pricing: false });
  const [loadError, setLoadError] = useState('');
  const set = (k: keyof typeof empty, v: string) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch('/api/event-config').then(r => r.json()).then(setCfg).catch(() => setLoadError('Could not load event settings.')); }, []);

  // Edit mode
  useEffect(() => {
    if (!editId || !cfg) return;
    fetch(`/api/organizer/events/${editId}`).then(async r => {
      const j = await r.json(); if (!r.ok) { setLoadError(j.error ?? 'Could not load event.'); return; }
      const e = j.event, tz = cfg.settings.timezone;
      setType(cfg.types.find(t => t.id === e.event_type_id) ?? null); setTemplateId(e.template_id);
      setF({ collegeName: e.college_name ?? '', title: e.title, organizerName: e.organizer_name ?? '', organizerEmail: e.organizer_email ?? '', description: e.description ?? '', details: e.details ?? '', posterUrl: e.poster_url ?? '',
        eventDate: e.start_at ? ymd(e.start_at, tz) : '', startTime: e.start_at ? hhmm(e.start_at, tz) : '', endTime: e.end_at ? hhmm(e.end_at, tz) : '', venue: e.venue ?? '', city: e.city ?? '',
        registrationType: e.registration_type, price: e.amount ? String(e.amount) : '', upiId: e.organizer_upi_id ?? '', payeeName: e.organizer_payee_name ?? '', capacity: e.capacity ? String(e.capacity) : '' });
      setFields((j.fields ?? []).map((x: any) => ({ uid: x.id, definitionId: x.definition_id, key: x.field_key, label: x.label, type: x.field_type, placeholder: x.placeholder, options: x.options, required: x.is_required, custom: !x.definition_id })));
      setLocks({ schedule: ['ONGOING', 'COMPLETED'].includes(e.status), fields: j.registrationCount > 0, pricing: j.registrationCount > 0 });
      setStep(1);
    });
  }, [editId, cfg]);

  const tpls = useMemo(() => (cfg && type ? cfg.templates.filter(t => t.event_type_id === type.id) : []), [cfg, type]);
  function applyTemplate(t: Template | undefined) {
    if (!cfg) return;
    setTemplateId(t?.id ?? null);
    setFields((t?.fields ?? []).map(tf => { const d = cfg.fieldLibrary.find(x => x.id === tf.field_definition_id); return d ? fromLibrary(d, tf.is_required) : null; }).filter(Boolean) as BuilderField[]);
  }
  function pickType(t: EType) {
    setType(t); const tpl = cfg!.templates.filter(x => x.event_type_id === t.id);
    applyTemplate(tpl.find(x => x.is_default) ?? tpl[0]); setStep(1); top.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function uploadPoster(file: File) {
    setServerError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setErrors(p => ({ ...p, posterUrl: 'Poster must be JPG, JPEG, PNG or WebP.' }));
    if (file.size > (cfg?.settings.maxPosterMb ?? 5) * 1024 * 1024) return setErrors(p => ({ ...p, posterUrl: `Poster must be under ${cfg?.settings.maxPosterMb ?? 5}MB.` }));
    set('posterUrl', URL.createObjectURL(file)); // instant local preview
    const fd = new FormData(); fd.append('file', file);
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/organizer/poster'); setProgress(0);
    xhr.upload.onprogress = e => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => { setProgress(null); const j = JSON.parse(xhr.responseText || '{}'); if (xhr.status === 200) set('posterUrl', j.url); else { set('posterUrl', ''); setErrors(p => ({ ...p, posterUrl: j.error ?? 'Upload failed.' })); } };
    xhr.onerror = () => { setProgress(null); set('posterUrl', ''); setErrors(p => ({ ...p, posterUrl: 'Upload failed.' })); };
    xhr.send(fd);
  }

  function validateDetails() {
    const e: Record<string, string> = {};
    if (type?.collect_college_name && !f.collegeName.trim()) e.collegeName = 'Enter the college name';
    if (f.title.trim().length < 2) e.title = 'Enter the event name';
    if (f.organizerName.trim().length < 2) e.organizerName = 'Enter the organizer name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.organizerEmail)) e.organizerEmail = 'Enter a valid email';
    if (!f.eventDate) e.eventDate = 'Pick a date';
    if (!f.startTime) e.startTime = 'Pick a start time';
    if (!f.endTime) e.endTime = 'Pick an end time';
    if (f.startTime && f.endTime && f.startTime >= f.endTime) e.endTime = 'End time must be after the start time';
    if (f.eventDate && !locks.schedule && f.eventDate < new Date().toLocaleDateString('en-CA')) e.eventDate = 'Date cannot be in the past';
    if (f.venue.trim().length < 2) e.venue = 'Enter the venue';
    if (f.registrationType === 'PAID') {
      if (!(Number(f.price) > 0)) e.price = 'Enter a price greater than 0';
      else if (Number(f.price) > (cfg?.settings.maxPrice ?? 1e9)) e.price = `Maximum price is ₹${cfg?.settings.maxPrice}`;
      if (!/^[\w.+-]{2,256}@[a-zA-Z]{2,64}$/.test(f.upiId)) e.upiId = 'Enter a valid UPI ID, e.g. name@bank';
      if (!f.payeeName.trim()) e.payeeName = 'Enter the payee name';
    }
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function save(publish: boolean) {
    setBusy(true); setServerError('');
    const body = { eventTypeId: type!.id, templateId, ...f, price: f.registrationType === 'PAID' ? Number(f.price) : 0, capacity: f.capacity, posterUrl: f.posterUrl.startsWith('blob:') ? '' : f.posterUrl, publish,
      fields: fields.map(x => ({ definitionId: x.definitionId ?? null, key: x.key, label: x.label, type: x.custom ? x.type : undefined, placeholder: x.placeholder ?? '', options: x.options, required: x.required })) };
    try {
      const res = await fetch(editId ? `/api/organizer/events/${editId}` : '/api/organizer/events', { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { setServerError(j.error ?? 'Could not save the event.'); return; }
      if (editId && publish) await fetch(`/api/organizer/events/${editId}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }) });
      router.push('/organizer/dashboard');
    } finally { setBusy(false); }
  }

  if (loadError) return <div><Navbar authed /><p className="container-page py-10 text-sm text-rose-600">{loadError}</p></div>;
  if (!cfg) return <div><Navbar authed /><p className="container-page py-10 text-sm text-slate-500">Loading…</p></div>;

  const steps = ['Event type', 'Event details', 'Participant info', 'Review'];
  const preview: FieldConfig[] = fields.map(x => ({ field_key: x.key ?? x.uid, label: x.label, field_type: x.type as any, placeholder: x.placeholder, options: x.options ?? [], validation: {}, is_required: x.required }));

  return (
    <div className="min-h-screen bg-ticx-bg">
      <Navbar authed />
      <div ref={top} className="container-page max-w-3xl py-8">
        <h1 className="text-2xl font-bold text-navy-900">{editId ? 'Edit your event' : 'Organize your event'}</h1>
        <ol className="mt-4 flex flex-wrap gap-2 text-xs">
          {steps.map((s, i) => <li key={s} className={`rounded-full px-3 py-1 ${i === step ? 'bg-brand-blue font-semibold text-white' : i < step ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-400'}`}>{i < step ? '✓ ' : `${i + 1}. `}{s}</li>)}
        </ol>

        {step === 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-navy-900">What type of event are you organizing?</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {cfg.types.map(t => { const Icon = icons[t.icon] ?? CalendarDays; return (
                <button key={t.id} onClick={() => pickType(t)} className="group text-left">
                  <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-brand-blue group-focus-visible:ring-2 group-focus-visible:ring-brand-blue">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient-soft text-brand-blue"><Icon className="h-6 w-6" /></div>
                    <h3 className="mt-4 text-lg font-bold text-navy-900">{t.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                  </Card>
                </button>); })}
              {cfg.types.length === 0 && <p className="text-sm text-slate-500">No event types are enabled right now.</p>}
            </div>
          </div>
        )}

        {step === 1 && type && (
          <Card className="mt-6 space-y-4">
            {!editId && <button className="flex items-center gap-1 text-sm text-slate-500" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4" /> Change type ({type.name})</button>}
            <h2 className="text-lg font-semibold text-navy-900">Event information</h2>
            {type.collect_college_name && <F label="College name" req error={errors.collegeName}><Input value={f.collegeName} onChange={e => set('collegeName', e.target.value)} /></F>}
            <F label="Event name" req error={errors.title}><Input value={f.title} maxLength={150} onChange={e => set('title', e.target.value)} /></F>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Organizer name" req error={errors.organizerName}><Input value={f.organizerName} onChange={e => set('organizerName', e.target.value)} /></F>
              <F label="Organizer email" req error={errors.organizerEmail}><Input type="email" value={f.organizerEmail} onChange={e => set('organizerEmail', e.target.value)} /></F>
            </div>
            <F label="Short event description" error={errors.description}>
              <textarea rows={3} maxLength={1000} value={f.description} onChange={e => set('description', e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
            </F>
            <F label="Event poster (JPG, PNG, WebP)" error={errors.posterUrl}>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center hover:border-brand-blue">
                {f.posterUrl ? <img src={f.posterUrl} alt="Poster preview" className="max-h-56 rounded-lg object-contain" /> : <><UploadCloud className="h-8 w-8 text-brand-blue" /><span className="text-sm text-slate-600">Tap to upload a poster</span></>}
                {progress !== null && <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200"><div className="h-full bg-brand-blue transition-all" style={{ width: `${progress}%` }} /></div>}
                <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={e => e.target.files?.[0] && uploadPoster(e.target.files[0])} />
              </label>
            </F>
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="Event date" req error={errors.eventDate}><Input type="date" disabled={locks.schedule} value={f.eventDate} onChange={e => set('eventDate', e.target.value)} /></F>
              <F label="Event day"><Input readOnly tabIndex={-1} value={dayOfWeek(f.eventDate)} placeholder="Auto" className="bg-slate-50" /></F>
              <div />
              <F label="Start time" req error={errors.startTime}><Input type="time" disabled={locks.schedule} value={f.startTime} onChange={e => set('startTime', e.target.value)} /></F>
              <F label="End time" req error={errors.endTime}><Input type="time" disabled={locks.schedule} value={f.endTime} onChange={e => set('endTime', e.target.value)} /></F>
            </div>
            {locks.schedule && <p className="text-xs text-amber-700">This event has started — date and time can no longer be changed.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Location / venue" req error={errors.venue}><Input value={f.venue} onChange={e => set('venue', e.target.value)} /></F>
              <F label="City"><Input value={f.city} onChange={e => set('city', e.target.value)} /></F>
            </div>
            <F label="Capacity (optional)"><Input type="number" min={1} value={f.capacity} onChange={e => set('capacity', e.target.value)} /></F>

            <div>
              <p className="mb-2 text-sm font-medium text-navy-900">Registration type</p>
              <div className="flex gap-3">
                {(['FREE', 'PAID'] as const).map(t => {
                  const off = t === 'PAID' && (!type.allow_paid || !cfg.settings.allowPaid);
                  return <label key={t} className={`flex flex-1 items-center gap-2 rounded-xl border p-3 text-sm ${off || locks.pricing ? 'opacity-50' : 'cursor-pointer'} ${f.registrationType === t ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-200'}`}>
                    <input type="radio" name="rt" disabled={off || locks.pricing} checked={f.registrationType === t} onChange={() => set('registrationType', t)} className="accent-[#FF7A00]" />{t === 'FREE' ? 'Free' : 'Paid'}</label>;
                })}
              </div>
              {f.registrationType === 'PAID' && (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <F label="Registration price (INR ₹)" req error={errors.price}><Input type="number" min={1} step="0.01" disabled={locks.pricing} value={f.price} onChange={e => set('price', e.target.value)} /></F>
                  <div />
                  <F label="Your UPI ID (payments go here)" req error={errors.upiId}><Input placeholder="name@bank" value={f.upiId} onChange={e => set('upiId', e.target.value)} /></F>
                  <F label="Payee name" req error={errors.payeeName}><Input value={f.payeeName} onChange={e => set('payeeName', e.target.value)} /></F>
                  <p className="text-xs text-slate-500 sm:col-span-2">Participants pay to your UPI ID by QR and submit the reference number. You verify each payment before their pass is issued — MyTICX never holds the money.</p>
                </div>
              )}
            </div>
            <p className="rounded-xl bg-brand-gradient-soft p-3 text-xs text-navy-900">Registration closes automatically <b>{cfg.settings.cutoffMinutes} minutes before the event starts</b> ({cfg.settings.timezone}).</p>
            <Button className="w-full" onClick={() => { if (validateDetails()) { setStep(2); top.current?.scrollIntoView({ behavior: 'smooth' }); } }}>Continue</Button>
          </Card>
        )}

        {step === 2 && type && (
          <Card className="mt-6 space-y-4">
            <button className="flex items-center gap-1 text-sm text-slate-500" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</button>
            <h2 className="text-lg font-semibold text-navy-900">Participant information</h2>
            {tpls.length > 1 && !editId && (
              <F label="Start from template"><select className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm" value={templateId ?? ''} onChange={e => applyTemplate(tpls.find(t => t.id === e.target.value))}>
                {tpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></F>
            )}
            {locks.fields && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">People have already registered, so the field list is locked.</p>}
            <FieldBuilder value={fields} onChange={setFields} library={cfg.fieldLibrary} allowCustom={type.allow_custom_fields} maxCustom={cfg.settings.maxCustomFields}
              allowEditing={type.allow_field_editing && (tpls.find(t => t.id === templateId)?.allow_customization ?? true)} disabled={locks.fields} />
            {fields.length > 0 && <div className="rounded-xl bg-slate-50 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">What participants will see</p><DynamicForm fields={preview} preview /></div>}
            <Button className="w-full" disabled={fields.length === 0} onClick={() => setStep(3)}>Review</Button>
          </Card>
        )}

        {step === 3 && type && (
          <Card className="mt-6 space-y-4">
            <button className="flex items-center gap-1 text-sm text-slate-500" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</button>
            <h2 className="text-lg font-semibold text-navy-900">Review your event</h2>
            {f.posterUrl && <img src={f.posterUrl} alt="" className="max-h-56 rounded-xl object-contain" />}
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {([['Type', type.name], ...(type.collect_college_name ? [['College', f.collegeName]] : []), ['Event', f.title], ['Organizer', `${f.organizerName} (${f.organizerEmail})`], ['Date', `${f.eventDate} (${dayOfWeek(f.eventDate)})`], ['Time', `${f.startTime} – ${f.endTime}`], ['Venue', [f.venue, f.city].filter(Boolean).join(', ')], ['Registration', f.registrationType === 'PAID' ? `Paid — ₹${f.price}` : 'Free'], ['Collecting', fields.map(x => x.label + (x.required ? '*' : '')).join(', ')]] as string[][]).map(([k, v]) => <div key={k}><dt className="text-xs text-slate-400">{k}</dt><dd className="font-medium text-navy-900">{v}</dd></div>)}
            </dl>
            {serverError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{serverError}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" disabled={busy || progress !== null} onClick={() => save(true)}><Check className="h-4 w-4" />{busy ? 'Saving…' : editId ? 'Save & publish' : 'Publish event'}</Button>
              <Button variant="outline" className="flex-1" disabled={busy || progress !== null} onClick={() => save(false)}>Save as draft</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function OrganizeEventPage() { return <Suspense><Wizard /></Suspense>; }
