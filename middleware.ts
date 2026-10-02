import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Protects authenticated-only routes at the edge. Even with this in place,
// every server route/component also re-checks the session — middleware is
// a UX convenience (fast redirect), not the security boundary.
const PROTECTED_PREFIXES = ['/home', '/sell', '/my-tickets', '/my-listings', '/profile', '/notifications', '/admin', '/organize-event', '/organizer', '/my-registrations'];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        }
      }
    }
  );

  // getUser() validates the JWT with Supabase Auth (getSession() only decodes the cookie and can be spoofed).
  const { data: { user } } = await supabase.auth.getUser();
  const isProtected = PROTECTED_PREFIXES.some(p => req.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/home';
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ['/home/:path*', '/sell/:path*', '/my-tickets/:path*', '/my-listings/:path*', '/profile/:path*', '/notifications/:path*', '/admin/:path*', '/organize-event/:path*', '/organizer/:path*', '/my-registrations/:path*']
};
