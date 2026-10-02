'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient-soft px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-8 shadow-soft">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-xl font-semibold text-navy-900">Reset your password</h1>
        {sent ? (
          <p className="mt-4 text-center text-sm text-slate-500">If that email is registered, a reset link is on its way.</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input placeholder="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
