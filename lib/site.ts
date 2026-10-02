// Single source of truth for site-wide identity. NEXT_PUBLIC_* values are inlined
// at BUILD time, so NEXT_PUBLIC_APP_URL must be set in the build environment.
const rawUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const SITE = {
  name: 'MyTICX',
  tagline: 'Tickets In Connected eXchange',
  title: 'MyTICX – Buy & Sell Verified Movie Tickets, Join & Organize Events',
  description:
    'MyTICX is a safe marketplace to buy discounted movie tickets, sell the ones you cannot use, and register for college and community events. Verified listings, in-app chat and QR entry passes.',
  url: rawUrl.replace(/\/+$/, ''),
  locale: 'en_IN',
  country: 'IN',
  currency: 'INR',
  themeColor: '#071B36',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '',
  keywords: [
    'buy movie tickets', 'sell movie tickets', 'resell movie tickets', 'discounted movie tickets',
    'verified movie tickets', 'movie ticket marketplace India', 'event registration', 'college event registration',
    'organize events online', 'QR entry pass', 'MyTICX'
  ]
} as const;

export const isProd = process.env.NODE_ENV === 'production';

/** Absolute URL for a site path. */
export function abs(path = '/'): string {
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}
