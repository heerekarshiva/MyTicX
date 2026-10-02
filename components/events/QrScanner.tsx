'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Camera QR scanner. Uses the native BarcodeDetector where available
 * (Chrome/Android/Edge) and falls back to jsQR on a canvas (Safari/Firefox).
 * Camera access needs HTTPS or localhost. It only reports decoded text —
 * all verification happens server-side.
 */
export function QrScanner({ onResult, paused }: { onResult: (text: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const pausedRef = useRef(paused); pausedRef.current = paused;

  useEffect(() => {
    let stream: MediaStream | null = null; let raf = 0; let stopped = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setError('Camera is not available here. Use HTTPS or localhost, or enter the code manually.'); return; }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const v = video.current!; v.srcObject = stream; await v.play();
        const Detector = (window as any).BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
        const jsQR = detector ? null : (await import('jsqr')).default;
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const tick = async () => {
          if (stopped) return;
          if (!pausedRef.current && v.readyState >= 2) {
            let text = '';
            try {
              if (detector) { const codes = await detector.detect(v); text = codes[0]?.rawValue ?? ''; }
              else if (jsQR) {
                canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
                text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? '';
              }
            } catch { /* frame decode errors are normal */ }
            const now = Date.now();
            if (text && (text !== last.current.text || now - last.current.at > 3000)) { last.current = { text, at: now }; onResult(text); }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e: any) {
        setError(e?.name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access and reload.' : 'Could not start the camera.');
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="flex aspect-square w-full items-center justify-center rounded-xl2 bg-slate-100 p-6 text-center text-sm text-slate-600">{error}</div>;
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl2 bg-navy-900">
      <video ref={video} playsInline muted className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-brand-blue/80" />
    </div>
  );
}
