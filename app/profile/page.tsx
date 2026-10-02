'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, User } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  full_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  created_at: string;
  upi_id: string | null;
  upi_payee_name: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);
  const [upiError, setUpiError] = useState<string | null>(null);

  async function loadProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setEmail(user.email ?? null);
    const { data } = await supabase.from('profiles').select('full_name, phone, phone_verified, created_at, upi_id, upi_payee_name').eq('id', user.id).single();
    setProfile(data);
    setUpiId(data?.upi_id ?? '');
    setUpiPayeeName(data?.upi_payee_name ?? data?.full_name ?? '');
  }

  useEffect(() => { loadProfile(); }, []);

  // Saves the SELLER'S OWN UPI ID so buyers can pay them directly — nothing
  // here is a shared or hardcoded UPI ID, it's per-account and only used on
  // orders where this user is the seller.
  async function saveUpi() {
    setSavingUpi(true);
    setUpiError(null);
    setUpiSaved(false);
    try {
      const res = await fetch('/api/profile/upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upiId, upiPayeeName })
      });
      const data = await res.json();
      if (!res.ok) { setUpiError(data.error ?? 'Could not save.'); return; }
      setUpiSaved(true);
      await loadProfile();
    } finally {
      setSavingUpi(false);
    }
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page max-w-2xl py-8">
        <Card className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-white"><User className="h-7 w-7" /></div>
          <div>
            <p className="text-lg font-semibold text-navy-900">{profile?.full_name ?? 'Your account'}</p>
            <p className="text-sm text-slate-500">{email}</p>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-navy-900">Contact & Verification</h2>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-600">Phone</span>
            <span className="flex items-center gap-1 font-medium text-navy-900">
              {profile?.phone ?? 'Not added'}
              {profile?.phone_verified && <Badge tone="success"><ShieldCheck className="h-3 w-3" /> Verified</Badge>}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">Member since</span>
            <span className="font-medium text-navy-900">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</span>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-navy-900">Payout / UPI ID</h2>
          <p className="mt-1 text-xs text-slate-500">
            Used to show buyers a "pay via UPI" QR code when they purchase one of your listings. This is your own
            UPI ID — MyTICX never stores or shares anyone else's.
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-900">UPI ID</label>
              <Input placeholder="yourname@bank" value={upiId} onChange={e => setUpiId(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-900">Name shown to buyers</label>
              <Input placeholder="Your name" value={upiPayeeName} onChange={e => setUpiPayeeName(e.target.value)} />
            </div>
            {upiError && <p className="text-sm text-rose-600">{upiError}</p>}
            {upiSaved && <p className="text-sm text-emerald-700">Saved.</p>}
            <Button className="w-full sm:w-auto" onClick={saveUpi} disabled={savingUpi}>{savingUpi ? 'Saving…' : 'Save UPI ID'}</Button>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-navy-900">Security</h2>
          <Button variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => router.push('/forgot-password')}>Change password</Button>
        </Card>

        <Button variant="ghost" className="mt-6 text-rose-600" onClick={logout}><LogOut className="h-4 w-4" /> Log out</Button>
      </div>
      <MobileBottomNav />
    </div>
  );
}
