import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

// Only the production domain should be crawlable. Preview/staging deployments set APP_ENV != production.
const crawlable = (process.env.APP_ENV ?? process.env.NODE_ENV) === 'production';

export default function robots(): MetadataRoute.Robots {
  if (!crawlable) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    // Private pages are kept out of the index with <meta robots noindex> (crawlers must be able to read it),
    // so only genuinely sensitive/secret-token paths are blocked here.
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/organizer/', '/check-in/', '/orders/']
    }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url
  };
}
