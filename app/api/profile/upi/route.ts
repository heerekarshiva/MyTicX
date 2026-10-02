import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { upiIdSchema } from '@/lib/validation/schemas';

// Lets a seller save THEIR OWN UPI ID to receive manual payments. Runs on
// the RLS-scoped client (not the admin client) so a user can only ever
// update their own profile row.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = upiIdSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid UPI ID' }, { status: 400 });

  const { error } = await supabase
    .from('profiles')
    .update({ upi_id: parsed.data.upiId, upi_payee_name: parsed.data.upiPayeeName })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: 'Could not save UPI ID.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
