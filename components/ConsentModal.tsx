'use client';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from './ui/Button';

interface ConsentModalProps {
  open: boolean;
  role: 'seller' | 'buyer';
  onAccept: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Explicit, must-read consent shown before a listing is published or a
 * purchase is completed. Acceptance is also logged server-side (see the
 * `consents` table + /api/listings and /api/purchase) so there is a
 * timestamped record if a dispute is later raised. MyTICX facilitates
 * the transaction between buyer and seller but is not a party to it, and
 * this text — and the DB record behind it — is what that rests on.
 */
export function ConsentModal({ open, role, onAccept, onCancel, loading }: ConsentModalProps) {
  const [checked, setChecked] = useState(false);
  if (!open) return null;

  const sellerTerms = [
    'Once this ticket is sold on MyTICX, you must not use it yourself or sell/transfer it anywhere else.',
    'Reselling, reusing, or double-listing this ticket after it sells is a violation of these terms and may be treated as fraud.',
    'You are responsible for the ticket being genuine and matching the details you entered.',
    'MyTICX facilitates the transaction but is not responsible for disputes arising from your own misconduct — this is between you and the buyer.'
  ];
  const buyerTerms = [
    'You are purchasing a resold ticket at your own risk. MyTICX performs the checks shown, but cannot guarantee cinema entry in every case.',
    'Refunds for seller fraud or misrepresentation are handled per MyTICX\'s dispute process and are not automatic or guaranteed.',
    'MyTICX facilitates this transaction between you and the seller but is not a party to it.'
  ];
  const terms = role === 'seller' ? sellerTerms : buyerTerms;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-soft sm:rounded-2xl">
        <div className="flex items-center gap-2 text-amber-600">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="text-base font-semibold text-navy-900">
            {role === 'seller' ? 'Before you list this ticket' : 'Before you buy this ticket'}
          </h2>
        </div>
        <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
          {terms.map((t, i) => <li key={i} className="flex gap-2"><span className="text-slate-300">•</span>{t}</li>)}
        </ul>
        <label className="mt-5 flex cursor-pointer items-start gap-2 text-sm text-navy-900">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" checked={checked} onChange={e => setChecked(e.target.checked)} />
          I have read and agree to these terms.
        </label>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" disabled={!checked || loading} onClick={onAccept}>
            {loading ? 'Please wait…' : role === 'seller' ? 'Agree & Publish' : 'Agree & Buy'}
          </Button>
        </div>
      </div>
    </div>
  );
}
