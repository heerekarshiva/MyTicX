'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient-soft px-4">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-8 shadow-soft">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-xl font-semibold text-navy-900">Set a new password</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input placeholder="New password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Saving…' : 'Update password'}</Button>
        </form>
      </div>
    </div>
  );
}
