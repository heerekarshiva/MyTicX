import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE, abs } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';

const verification: Metadata['verification'] = {};
if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION;
if (process.env.BING_SITE_VERIFICATION) verification.other = { 'msvalidate.01': process.env.BING_SITE_VERIFICATION };

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: '%s | MyTICX' },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { type: 'website', siteName: SITE.name, locale: SITE.locale, title: SITE.title, description: SITE.description, url: '/' },
  twitter: { card: 'summary_large_image', title: SITE.title, description: SITE.description },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }
  },
  verification,
  category: 'entertainment'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: SITE.themeColor
};

// Site-wide structured data: lets Google show the brand name/logo and a sitelinks search box.
const siteSchema = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': abs('/#organization'),
    name: SITE.name,
    alternateName: SITE.tagline,
    url: SITE.url,
    logo: abs('/logo.svg'),
    ...(SITE.supportEmail ? { contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: SITE.supportEmail, areaServed: SITE.country, availableLanguage: ['en'] }] } : {})
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': abs('/#website'),
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    inLanguage: 'en-IN',
    publisher: { '@id': abs('/#organization') },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/marketplace?q={search_term_string}` },
      'query-input': 'required name=search_term_string'
    }
  }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <JsonLd data={siteSchema} />
        {children}
      </body>
    </html>
  );
}
