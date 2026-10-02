'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema } from '@/lib/validation/schemas';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { CheckCircle2 } from 'lucide-react';

type FormData = z.infer<typeof signUpSchema>;

export default function SignupPage() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(signUpSchema)
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`
      }
    });
    if (error) { setServerError(error.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-gradient-soft px-4">
        <div className="w-full max-w-sm rounded-xl2 bg-white p-8 text-center shadow-soft">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="mt-4 text-lg font-semibold text-navy-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-500">We've sent a verification link to your email. Confirm it to activate your account.</p>
          <Link href="/login"><Button className="mt-6 w-full">Back to login</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient-soft px-4 py-10">
      <div className="w-full max-w-sm rounded-xl2 bg-white p-8 shadow-soft">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-xl font-semibold text-navy-900">Create your account</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input placeholder="Full name" {...register('fullName')} />
            {errors.fullName && <p className="mt-1 text-xs text-rose-600">{errors.fullName.message}</p>}
          </div>
          <div>
            <Input placeholder="Email" type="email" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
          </div>
          <div>
            <Input placeholder="Password" type="password" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>}
          </div>
          {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Sign up'}</Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-medium text-brand-blue">Log in</Link>
        </p>
      </div>
    </div>
  );
}
