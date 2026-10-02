'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@/lib/validation/schemas';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';

type FormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(loginSchema)
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(data);
    if (error) { setServerError('Invalid email or password.'); return; }
    // honour ?redirectTo= (set by middleware / event pages); same-site paths only
    const dest = new URLSearchParams(window.location.search).get('redirectTo');
    router.push(dest && dest.startsWith('/') && !dest.startsWith('//') ? dest : '/home');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient-soft px-4 py-10">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-8 shadow-soft">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-xl font-semibold text-navy-900">Welcome back</h1>
        <p className="text-center text-sm text-slate-500">Log in to buy or sell tickets.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input placeholder="Email" type="email" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
          </div>
          <div>
            <Input placeholder="Password" type="password" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>}
          </div>
          {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-brand-blue">Forgot password?</Link>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Logging in…' : 'Log in'}</Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          New here? <Link href="/signup" className="font-medium text-brand-blue">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
