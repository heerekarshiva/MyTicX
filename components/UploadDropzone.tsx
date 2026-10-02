'use client';
import { useCallback, useState } from 'react';
import { UploadCloud, FileCheck2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export function UploadDropzone({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const validateAndSet = useCallback((file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PDF, PNG, JPG, or WEBP files are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB}MB.`);
      return;
    }
    setFileName(file.name);
    onFileSelected(file);
  }, [onFileSelected]);

  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) validateAndSet(file);
        }}
        className={cn(
          'flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed px-4 text-center transition',
          dragOver ? 'border-brand-blue bg-brand-gradient-soft' : 'border-slate-200 bg-slate-50/50'
        )}
      >
        {fileName ? (
          <>
            <FileCheck2 className="h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-navy-900">{fileName}</p>
            <p className="text-xs text-slate-500">Tap to replace</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-brand-blue" />
            <p className="text-sm font-medium text-navy-900">Drag & drop your ticket, or tap to browse</p>
            <p className="text-xs text-slate-500">PDF, PNG or JPG, up to {MAX_SIZE_MB}MB</p>
          </>
        )}
        <input
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSet(f); }}
        />
      </label>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
