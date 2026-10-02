import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { VerificationStepResult } from '@/types';

export function VerificationProgress({ steps, loading }: { steps: VerificationStepResult[]; loading?: boolean }) {
  return (
    <div className="space-y-3">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking show information…
        </div>
      )}
      {steps.map(s => (
        <div key={s.step} className="flex items-start gap-2">
          {s.passed ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
          )}
          <div>
            <p className="text-sm font-medium text-navy-900">{s.label}</p>
            {s.detail && <p className="text-xs text-slate-500">{s.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
