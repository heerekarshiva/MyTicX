'use client';

// Last-resort boundary: replaces the root layout, so it must render its own <html>/<body> and use no app styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, color: '#071B36', textAlign: 'center', padding: 24 }}>
        <div>
          <h1>MyTICX is having a problem</h1>
          <p>Please try again in a moment.</p>
          <button onClick={reset} style={{ background: '#FF7A00', color: '#fff', border: 0, borderRadius: 999, padding: '12px 24px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
        </div>
      </body>
    </html>
  );
}
